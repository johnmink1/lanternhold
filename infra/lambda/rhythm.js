// Rhythm watch (John, 27 Nov 2026: "keep track if any clicks are repetitive or timed... people setting up scripts
// in order to follow a sort of operation in clicking, for example every 15 min to join the boss fight").
// Flags for an admin to review. Nothing here bans, blocks or takes anything away: a flag only lists the player on the
// Admin tab's Watch list with a plain reason, and the admin decides.
//
// One pure module (no AWS calls), used by save.js (the game's input summary on each cloud sync), worldboss.js (the
// server's own assault times) and the baseline sim (infra/test/rhythm.test.js).
//
// What the game sends with each sync (bh, see ui.js RH): taps on the fight (tp), taps on the same pixel as the one
// before (ss), 20-tap windows (tw) and how many were machine-even (ew), held-key strikes (kr), inputs made by a script
// rather than a person (ut: the browser marks those isTrusted false), the hours with any input (hr), and the last
// buttons pressed with their times (btn: [key, ms, trusted]). cn is the game's clock when it sent, so times are moved
// onto the server's clock and a wrong device clock does not matter.
'use strict';
const R = {
  UT_WARN: 10, UT_BAD: 100,          // inputs a script made (isTrusted false) in one sync
  EV_CV: 0.05,                       // a 20-tap window this even (spread / mean of the gaps) is machine-like; fast human tapping is 0.15-0.4
  EV_MIN: 5, EV_SHARE: 0.6,          // at least 5 windows in the sync, 60% of them even
  EV_BAD: 20, EV_BADSHARE: 0.8,
  SS_MIN: 300, SS_SHARE: 0.95,       // 95% of 300+ taps on the very same pixel (a mouse auto-clicker; fingers never do this)
  CAD_N: 6, CAD_BAD: 12,             // the same button pressed on a fixed timer: 6 gaps in a row (7 presses), 12 = bad
  CAD_ABS: 2000, CAD_REL: 0.005,     // "fixed": every gap within 2 s (or 0.5%) of the run's middle gap
  CAD_MINP: 20e3, CAD_MAXP: 3 * 36e5,// timers between 20 s and 3 h
  SEQ_MIN: 2, SEQ_MAX: 6, SEQ_N: 8,  // a loop of 2-6 buttons repeated 8 times with the same timing
  SEQ_ABS: 400, SEQ_REL: 0.005, SEQ_MINC: 5e3, // each time round within 0.4 s (or 0.5%) of the middle one
  DAY_H: 22,                         // input in 22 of any 24 hours (no sleep): warn; 3 such stretches in a week: bad
  KEEP_B: 300, KEEP_H: 7 * 24, KEEP_MS: 3 * 864e5,
  WB_N: 8, WB_BAD: 16,               // world boss: 8 assaults in a row on the same beat
  WB_RN: 12, WB_RBAD: 24,            //   12 in a row the moment the cooldown ends (3 hours non-stop), 24 = bad
  WB_READY: 30e3, WB_TOL: 250,       //   each within 30 s of the cooldown ending, all within 0.25 s of the same delay (network jitter is ~0.1 s)
  WB_CADABS: 1000,                   //   or every gap within 1 s of the middle gap
  WB_HOURS: 20,                      //   assaults in 20 of any 24 hours
  WB_CAP: 0.6,                       //   score over 60% of the server ceiling (honest play tops out at 28-45%)
  WB_KEEP: 300,
};
const M0 = v => Math.max(0, v);
const num = v => (typeof v === 'number' && isFinite(v) ? v : 0);
const med = a => { const b = a.slice().sort((x, y) => x - y); return b.length ? b[b.length >> 1] : 0; };
const sd = a => { const m = a.reduce((x, y) => x + y, 0) / (a.length || 1); return Math.sqrt(a.reduce((x, y) => x + (y - m) * (y - m), 0) / (a.length || 1)); };
const span = ms => { const s = Math.round(ms / 1000); return s < 120 ? s + ' s' : s < 7200 ? Math.round(s / 60) + ' min' : Math.round(s / 360) / 10 + ' h'; };
const flag = (out, lv, k, t) => out.push({ lv, k, t });

// Longest run of gaps that all sit within tol of the run's middle gap. gaps: numbers; ok(g): gap allowed at all.
function evenRun(gaps, tol, ok) {
  let best = { n: 0, p: 0, at: -1 };
  for (let i = 0; i < gaps.length; i++) {
    if (!ok(gaps[i])) continue;
    let j = i, run = [];
    while (j < gaps.length && ok(gaps[j])) {
      const next = run.concat(gaps[j]), m = med(next);
      if (next.some(g => Math.abs(g - m) > tol(m))) break;
      run = next; j++;
    }
    if (run.length > best.n) best = { n: run.length, p: med(run), at: i };
    if (j >= gaps.length) break;          // no later start can make a longer run
    if (run.length > 2) i += run.length - 2; // and skip most of this one (keeps it fast on 300 presses)
  }
  return best;
}
// The same button on a fixed timer. b: [[key, server ms, trusted]] oldest first.
function cadence(b, out) {
  const by = {};
  for (const e of b) (by[e[0]] = by[e[0]] || []).push(e[1]);
  let worst = null;
  for (const k in by) {
    const t = by[k]; if (t.length <= R.CAD_N) continue;
    const gaps = t.slice(1).map((x, i) => x - t[i]);
    const r = evenRun(gaps, m => Math.max(R.CAD_ABS, R.CAD_REL * m), g => g >= R.CAD_MINP && g <= R.CAD_MAXP);
    if (r.n >= R.CAD_N && (!worst || r.n > worst.n)) worst = { ...r, k };
  }
  if (worst) flag(out, worst.n >= R.CAD_BAD ? 'bad' : 'warn', 'cadence', 'Pressed "' + worst.k + '" ' + (worst.n + 1) + ' times in a row on a fixed timer, every ' + span(worst.p) + ' (each within ' + span(Math.max(R.CAD_ABS, R.CAD_REL * worst.p)) + '). People drift by more than that; a scheduled script does not.');
}
// A loop of buttons (A, B, C, A, B, C...) with the same timing each time round.
function sequence(b, out) {
  const n = b.length;
  for (let L = R.SEQ_MIN; L <= R.SEQ_MAX; L++) {
    for (let i = 0; i + L * R.SEQ_N <= n; i++) {
      const key = b.slice(i, i + L).map(e => e[0]);
      if (new Set(key).size < 2) continue; // one button over and over is cadence's job
      let c = 1;
      while (i + (c + 1) * L <= n && b.slice(i + c * L, i + (c + 1) * L).every((e, j) => e[0] === key[j])) c++;
      if (c < R.SEQ_N) continue;
      const cyc = []; for (let q = 1; q < c; q++) cyc.push(b[i + q * L][1] - b[i + (q - 1) * L][1]);
      const m = med(cyc);
      if (m >= R.SEQ_MINC && cyc.every(x => Math.abs(x - m) <= Math.max(R.SEQ_ABS, R.SEQ_REL * m))) {
        flag(out, 'warn', 'sequence', 'Repeated the same ' + L + '-button routine (' + key.join(' > ') + ') ' + c + ' times, ' + span(m) + ' each time round, every round within ' + (Math.max(R.SEQ_ABS, R.SEQ_REL * m) / 1000).toFixed(1) + ' s.');
        return;
      }
      i += c * L - 1;
    }
  }
}
// Hours with any input, kept as hour numbers (server clock). Any 24-hour stretch with input in DAY_H of them.
function noSleep(h, out, what, need) {
  const s = Array.from(new Set(h)).sort((x, y) => x - y); let hits = 0, lastHit = -99, most = 0;
  for (let i = 0; i < s.length; i++) {
    let j = i; while (j + 1 < s.length && s[j + 1] - s[i] < 24) j++;
    const c = j - i + 1; most = Math.max(most, c);
    if (c >= need && s[i] - lastHit >= 24) { hits++; lastHit = s[i]; }
  }
  if (hits) flag(out, hits >= 3 ? 'bad' : 'warn', what === 'boss' ? 'wbhours' : 'nosleep', (what === 'boss' ? 'World boss assaults in ' : 'Input in ') + most + ' of 24 hours' + (hits > 1 ? ', ' + hits + ' times this week' : '') + '. Nobody plays without sleeping; a script or a shared account does.');
}

// One cloud sync. st: the state kept on the save row (null the first time). Returns { st, flags }.
function absorb(st, bh, now) {
  st = st && typeof st === 'object' ? st : {};
  const b = Array.isArray(st.b) ? st.b : [], h = Array.isArray(st.h) ? st.h : [], out = [];
  if (!bh || typeof bh !== 'object') return { st, flags: out };
  const off = now - (num(bh.cn) || now), H = 36e5;
  // this sync's own numbers
  const ut = num(bh.ut), tp = num(bh.tp), ss = num(bh.ss), tw = num(bh.tw), ew = num(bh.ew);
  if (ut >= R.UT_WARN) flag(out, ut >= R.UT_BAD ? 'bad' : 'warn', 'untrusted', ut + ' clicks or key presses came from a script, not a person (the browser marks them)' + (bh.uk ? ', last on "' + String(bh.uk).slice(0, 24) + '"' : '') + '. Some accessibility add-ons do this too.');
  if (tw >= R.EV_MIN && ew / tw >= R.EV_SHARE) flag(out, tw >= R.EV_BAD && ew / tw >= R.EV_BADSHARE ? 'bad' : 'warn', 'even', ew + ' of ' + tw + ' bursts of 20 taps were machine-even (gaps alike to within 5%)' + (tp >= R.SS_MIN && ss / tp >= R.SS_SHARE ? ', and ' + Math.round(ss / tp * 100) + '% of taps hit the very same pixel' : '') + '. An auto-clicker.');
  else if (tp >= R.SS_MIN && ss / tp >= R.SS_SHARE) flag(out, 'info', 'samespot', Math.round(ss / tp * 100) + '% of ' + tp + ' taps hit the very same pixel. A mouse auto-clicker does that, so can a still mouse.');
  // the running history: buttons and active hours
  for (const e of (Array.isArray(bh.btn) ? bh.btn : []).slice(-150)) if (Array.isArray(e) && typeof e[0] === 'string') b.push([e[0].slice(0, 24), Math.round(num(e[1]) + off), e[2] ? 1 : 0]);
  for (const x of (Array.isArray(bh.hr) ? bh.hr : []).slice(-48)) h.push(Math.floor((num(x) * H + off) / H));
  b.sort((x, y) => x[1] - y[1]);
  const keepB = b.filter(e => e[1] > now - R.KEEP_MS && e[1] <= now + 6e4).slice(-R.KEEP_B), nowH = Math.floor(now / H);
  const keepH = Array.from(new Set(h)).filter(x => x > nowH - R.KEEP_H && x <= nowH + 1).sort((x, y) => x - y);
  cadence(keepB, out); sequence(keepB, out); noSleep(keepH, out, 'input', R.DAY_H);
  return { st: { b: keepB, h: keepH, n: num(st.n) + (out.some(f => f.lv !== 'info') ? 1 : 0) }, flags: out };
}

// World boss, from the server's own record. a: [[end time ms, ms after the cooldown ended (or -1), Nexus drop 0/1,
// score / server ceiling]] oldest first. Returns flags.
function boss(a, cool) {
  const out = []; a = (Array.isArray(a) ? a : []).filter(Array.isArray);
  // started as soon as it was ready, every time, with the same tiny delay
  const dr = evenRun(a.map(e => e[1]), () => R.WB_TOL, d => d >= -10e3 && d <= R.WB_READY), best = dr.n >= R.WB_RN ? dr.n : 0;
  if (best) flag(out, best >= R.WB_RBAD ? 'bad' : 'warn', 'wbready', best + ' world boss assaults in a row, each started ' + span(M0(dr.p)) + ' after the cooldown ended, every one within a quarter second of that. A person watching the timer is never that regular.');
  // or on the same beat, whatever the cooldown
  const gaps = a.slice(1).map((e, i) => e[0] - a[i][0]);
  // (beats right at the cooldown are wbready's job: a sharp player there has gaps alike to within a second too)
  const r = evenRun(gaps, () => R.WB_CADABS, g => g >= (cool || 9e5) + R.WB_READY && g <= 2 * 36e5);
  if (!best && r.n >= R.WB_N) flag(out, r.n >= R.WB_BAD ? 'bad' : 'warn', 'wbcad', (r.n + 1) + ' world boss assaults on a fixed beat, every ' + span(r.p) + ' (each within 1 s).');
  noSleep(a.map(e => Math.floor(e[0] / 36e5)), out, 'boss', R.WB_HOURS);
  const nd = a.filter(e => e[2]).length;
  if (nd) flag(out, nd >= 3 ? 'warn' : 'info', 'wbnexus', nd + ' assault' + (nd > 1 ? 's' : '') + ' had machine-even strikes; the server dropped the tap damage.');
  const cp = a.filter(e => e[3] >= R.WB_CAP).length;
  if (cp) flag(out, cp >= 2 ? 'warn' : 'info', 'wbcap', cp + ' assault score' + (cp > 1 ? 's were' : ' was') + ' over ' + Math.round(R.WB_CAP * 100) + '% of the server ceiling. The game itself stops near 30-45% at their deepest floor, so the score was likely edited (or their hero card is many floors behind).');
  return out;
}
module.exports = { R, absorb, boss, evenRun };
