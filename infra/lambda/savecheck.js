// Save sanity checks (John, 27 Nov 2026: "how can we prevent this from happening?" after Kyvia loaded hand-edited
// backups). The game runs in the browser, so the server cannot replay it; instead every cloud save is compared with the
// last save the server trusted (the "reference") and refused when it gained more than real time allows.
//
// One pure function, used by save.js (PUT /save) and by the baseline replay over the activity log. No AWS calls here.
//
// The gold rule is relative to the player's own history, because honest income differs by 100,000x between players
// (Bob earns about 0.6 gold multiples a second, Kyvia about 80, Chipplin before NP+1 up to 100,000). A sync's gold
// income is divided by the floor's foe gold (core.js foeGold at the deepest floor) and the NP+ gold bonus, giving a
// "multiple" m. The player's own 90th-percentile multiple over recent syncs on the same NP+ tier, times X, times the
// real seconds since the reference (at least W), is the most gold the sync may add. Baseline (activity log 25-27 Nov,
// 8,000 syncs, 9 players): X 50 / W 60 s caught both of Kyvia's edits (26 Nov 22:52, 2.2 million times over; 27 Nov
// 00:44, 76 times over) and flagged one honest sync, a save copy swap that the play-time reference below now handles.
//
// The reference is not always the last save: an older copy saved from another device (Chipplin, 25 Nov) is accepted,
// and when the main copy comes back it is compared with the save that had the most play time before it (hw), not
// with the old copy. So progress is always measured from the closest earlier point in play time.
'use strict';
const R = {
  X: 50, W: 60,            // gold: 50x the player's own p90 multiple, over at least 60 s
  HIST: 30, KEEP: 120,     // the gold rule starts after 30 synced samples on this NP+ tier; the last 120 are kept
  M0: 6000,                // multiple used before a player has history (above every honest p99 seen, 3,700)
  GMIN: 1e6,               // gains under a million gold are never refused
  AWAY: 73 * 3600,         // longest real gap that still earns (offline window 72 h + 1 h)
  SPEED: 1.25, SPEED_PAD: 120, // play time may run at most 1.25x real time (+2 min); honest max seen 1.06x
  FL_FROM: 40, FL_PAD: 30, FL_MIN: 6,  // deepest floor: 30 + 1 per 6 s past floor 40 (honest max seen: 7 in 75 s)
  LV_FROM: 5, LV_PAD: 6, LV_H: 6,      // hero levels: 6 + 6 an hour past hero level 5 (honest max seen: 4)
  BAG_PAD: 150, BAG_S: 10,             // bag: 150 + 1 per 10 s (honest max seen: 66)
  TK_PAD: 25, TK_MIN: 60,              // Rift tokens: 25 + 1 a minute (a whole world boss gives about 15)
  BUY_SLACK: 0.25,                     // a new renovation or Curio must have cost at least a quarter of its price
};
// core.js foeGold for the normal foes of floor f (GOLD_SOFT_FLOOR 100, GOLD_SOFT_RATE 1.06), as log10, so the server
// needs no copy of the game rules. Floors 1-100 from the table, then +log10(1.06) a floor.
const FG = [0.0969, 0.0969, 0.104, 0.1116, 0.1197, 0.1283, 0.1374, 0.147, 0.1572, 0.168, 0.1794, 0.1914, 0.204, 0.2173, 0.2312, 0.2458, 0.2611, 0.2771, 0.2937, 0.311, 0.329, 0.3477, 0.3671, 0.3871, 0.4078, 0.4292, 0.4512, 0.4738, 0.4971, 0.5209, 0.5453, 0.5703, 0.5958, 0.6219, 0.6484, 0.6754, 0.7029, 0.7308, 0.7591, 0.7879, 0.817, 0.8464, 0.8762, 0.9063, 0.9367, 0.9674, 0.9984, 1.0296, 1.061, 1.0926, 1.1245, 1.1565, 1.1888, 1.2211, 1.2537, 1.2864, 1.3192, 1.3521, 1.3852, 1.4184, 1.4517, 1.49, 1.5284, 1.567, 1.6057, 1.6444, 1.6832, 1.7221, 1.7611, 1.8001, 1.8392, 1.8783, 1.9175, 1.9567, 1.9959, 2.0352, 2.0746, 2.1139, 2.1533, 2.1927, 2.2322, 2.2716, 2.3111, 2.3506, 2.3901, 2.4296, 2.4692, 2.5087, 2.5483, 2.5878, 2.6274, 2.667, 2.7066, 2.7462, 2.7858, 2.8254, 2.8651, 2.9047, 2.9443, 2.984, 3.0236];
const foeGold = f => { f = Math.max(1, Math.floor(+f || 1)); return Math.pow(10, f <= 100 ? FG[f] : FG[100] + Math.log10(1.06) * (f - 100)); };
const norm = (f, np) => foeGold(f) * (1 + (np || 0));
// Hero level from hero XP (core.js xpNeed).
const xpNeed = lv => Math.round(160 * Math.pow(lv, 1.9) * Math.pow(Math.min(1, lv / 10), 1.5) + 40);
function heroLv(x) { let lv = 1; x = x || 0; while (x >= xpNeed(lv) && lv < 5000) { x -= xpNeed(lv); lv++; } return lv; }
// Renovation and decoration prices in hours of income (core.js RENOS/DECOS), and a Gilded Casket (12 h) for a Curio.
const RENO_H = { tower: 24, bath: 36, fire: 48, garden: 72, moth: 6, trim: 12, fount: 24, statue: 48 }, CURIO_H = 12;
const num = v => (typeof v === 'number' && isFinite(v) ? v : 0);
const keys = o => (o && typeof o === 'object' ? Object.keys(o).filter(k => o[k]) : []);

// The numbers a reference keeps, read from a parsed save. at = server time it was accepted.
function point(s, at, dv) {
  const t = (s && s.stats) || {};
  return { at, dv: String(dv || '').slice(0, 12), g: num(s.gold), ge: num(t.goldEarned), x: num(s.hxp), f: num(s.maxFloorEver), pt: num(t.playTime),
    b: Array.isArray(s.bag) ? s.bag.length : 0, tk: num(s.wbTok), cr: num(s.created), np: num(s.np),
    rn: keys(s.reno), cu: keys(s.curios) };
}
const p90 = h => { if (!h.length) return 0; const a = h.slice().sort((p, q) => p - q); return a[Math.min(a.length - 1, Math.floor(a.length * 0.9))]; };
const median = h => { if (!h.length) return 0; const a = h.slice().sort((p, q) => p - q); return a[a.length >> 1]; };

// ck: what the server keeps between saves, or null before the first check:
//   pts: accepted points, one an hour for the last 3 days (the newest is always the last save), hw: the point with the
//   most play time, h: { tier: [recent multiples] }, sd: the UTC day of the last daily snapshot (save.js).
// s: the parsed incoming save. now: server ms. ctx: { crd: gold the server credited since (Market and Mail sales),
// np: the NP+ tier the server granted (wallet), claim: a device taking over the account }.
// Returns { flags: [{ k, t }], ok, ck, ref } where ck is what to keep if the save is accepted.
const PT_GAP = 3600e3, PT_KEEP = 72;
function check(ck, s, now, ctx) {
  ctx = ctx || {};
  const cur = point(s, now, ctx.dv), flags = [], bad = (k, t) => flags.push({ k, t });
  ck = ck && Array.isArray(ck.pts) && ck.pts.length ? ck : null;
  const h = Object.assign({}, (ck && ck.h) || {});
  // The reference is the closest earlier point in play time of the same game. An older copy from another device is
  // measured from an older point; a different game (another `created`) or one older than every point starts from zero,
  // as if it began a minute ago.
  let ref = null, fresh = false;
  if (ck) {
    // Two devices with their own copies (before the one-device rule, Paktusjet 26 Nov) are each measured from their
    // own last point when there is one.
    const c = ck.pts.concat(ck.hw ? [ck.hw] : []).filter(p => p.cr === cur.cr && p.pt <= cur.pt + 5), same = c.filter(p => cur.dv && p.dv === cur.dv);
    ref = (same.length ? same : c).sort((p, q) => q.pt - p.pt || q.at - p.at)[0] || null;
    if (!ref) { fresh = true; ref = { at: now - R.W * 1000, g: 0, ge: 0, x: 0, f: 1, pt: 0, b: 0, tk: 0, cr: cur.cr, np: cur.np, rn: null, cu: null }; }
  }
  if (ctx.np != null && cur.np > ctx.np) bad('np', 'NP+' + cur.np + ' in the save, but the server granted NP+' + ctx.np + '.');
  if (ref) {
    const dt = Math.max(0, (now - ref.at) / 1000), newTier = cur.np !== ref.np;
    const dg = cur.g - ref.g, dge = fresh ? cur.g : cur.ge - ref.ge, gin = Math.max(dg, dge, 0) - Math.max(0, ctx.crd || 0);
    const hist = h[cur.np] || [], m = hist.length >= R.HIST ? p90(hist) : R.M0;
    const nm = norm(cur.f, cur.np), win = Math.max(Math.min(dt, R.AWAY), R.W);
    // Starting NP+ in this sync: the gold was earned on the old tier, so the old tier's limit applies too.
    const h0 = h[ref.np] || [], allow = Math.max(R.X * m * nm * win, newTier ? R.X * (h0.length >= R.HIST ? p90(h0) : R.M0) * norm(ref.f, ref.np) * win : 0);
    if (gin > R.GMIN && gin > allow) bad('gold', 'Gained ' + big(gin) + ' gold in ' + span(dt) + '; at most ' + big(allow) + ' is possible for this hero (' + Math.round(gin / allow) + 'x over).');
    if (!ctx.claim && !fresh && cur.pt - ref.pt > dt * R.SPEED + R.SPEED_PAD) bad('speed', 'Played ' + span(cur.pt - ref.pt) + ' of game time in ' + span(dt) + ' of real time.');
    if (!newTier && (fresh || ref.f >= R.FL_FROM) && cur.f - ref.f > R.FL_PAD + dt / R.FL_MIN) bad('floor', 'Deepest floor ' + ref.f + ' to ' + cur.f + ' in ' + span(dt) + '.');
    const lv0 = heroLv(ref.x), lv1 = heroLv(cur.x);
    if (!newTier && (fresh || lv0 >= R.LV_FROM) && lv1 - lv0 > R.LV_PAD + R.LV_H * dt / 3600) bad('xp', 'Hero level ' + lv0 + ' to ' + lv1 + ' in ' + span(dt) + '.');
    if (cur.b - ref.b > R.BAG_PAD + dt / R.BAG_S) bad('bag', (cur.b - ref.b) + ' items added to the bag in ' + span(dt) + '.');
    if (cur.tk - ref.tk > R.TK_PAD + dt / R.TK_MIN) bad('tok', big(cur.tk - ref.tk) + ' Rift tokens in ' + span(dt) + '.');
    // Things that carry through NP+ (renovations, Curios): a new one must have been paid for out of the gold the
    // player had plus what they earned since. Price = hours of income; income an hour is estimated from the player's
    // median multiple (the game prices from a slow average of its own away income, so only a quarter is required).
    // rn/cu are null on points seeded from the activity log, which does not record them.
    if (ref.rn && ref.cu) {
      const nrn = cur.rn.filter(k => !ref.rn.includes(k)), ncu = cur.cu.filter(k => !ref.cu.includes(k));
      if (nrn.length || ncu.length) {
        const ih = (hist.length >= R.HIST ? median(hist) : 0) * norm(ref.f, ref.np) * 3600;
        const hours = nrn.reduce((a, k) => a + (RENO_H[k] || 24), 0) + ncu.length * CURIO_H;
        const spent = ref.g + Math.max(0, dge) + Math.max(0, ctx.crd || 0) - cur.g, need = R.BUY_SLACK * hours * ih;
        if (ih > 0 && need > R.GMIN && spent < need) bad('buy', 'New ' + nrn.concat(ncu).join(', ') + ' (about ' + big(hours * ih) + ' gold) but only ' + big(Math.max(0, spent)) + ' gold was spent.');
      }
    }
    // Learn this sync's multiple (honest syncs only, same tier, at least 20 s apart).
    if (!flags.length && !fresh && !newTier && dt >= 20 && gin > 0) { const a = (h[cur.np] || []).concat([+(gin / (dt * nm)).toPrecision(3)]); h[cur.np] = a.slice(-R.KEEP); }
  }
  const ok = !flags.length;
  let pts = ck ? ck.pts.slice() : [];
  if (pts.length >= 2 && now - pts[pts.length - 2].at < PT_GAP) pts[pts.length - 1] = cur; else pts.push(cur);
  pts = pts.slice(-PT_KEEP);
  const hw0 = ck && ck.hw && ck.hw.cr === cur.cr ? ck.hw : null;
  return { flags, ok, ref, ck: { pts, hw: !hw0 || cur.pt >= hw0.pt ? cur : hw0, h, sd: ck ? ck.sd || '' : '' } };
}
// Gold a player can be trusted to hold right now: the last accepted save's gold plus what they could have earned
// since (same rule as above). Market, Mail and Gulp use it to refuse payments made with faked gold.
function trustedGold(ck, now) {
  if (!ck || !ck.pts || !ck.pts.length) return Infinity; // no reference yet: do not block
  const p = ck.pts[ck.pts.length - 1], hist = (ck.h || {})[p.np] || [], m = hist.length >= R.HIST ? p90(hist) : R.M0;
  return p.g + Math.max(R.GMIN, R.X * m * norm(p.f, p.np) * Math.max(Math.min((now - p.at) / 1000, R.AWAY), R.W));
}
function big(v) {
  v = Math.round(v || 0); const a = Math.abs(v);
  if (a < 1e4) return String(v);
  const u = ['K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp']; let i = -1, x = a; while (x >= 1000 && i < u.length - 1) { x /= 1000; i++; }
  return (v < 0 ? '-' : '') + (x >= 100 ? x.toFixed(0) : x.toFixed(1)) + u[i];
}
function span(sec) {
  sec = Math.max(0, Math.round(sec || 0));
  if (sec < 90) return sec + ' s'; if (sec < 5400) return Math.round(sec / 60) + ' min';
  if (sec < 172800) return (sec / 3600).toFixed(1) + ' h'; return (sec / 86400).toFixed(1) + ' days';
}
// Builds a starting ck from activity-log rows ({ at, s }, oldest first or not) so the first check after deploy already
// knows the player. The log has no renovation or Curio lists, so those start unknown (null) and are learnt next save.
function seed(rows) {
  let ck = null;
  for (const r of rows.slice().sort((p, q) => p.at - q.at)) {
    const s = r.s || {}, sv = { gold: s.g, hxp: s.x, maxFloorEver: s.f, wbTok: s.tk, created: s.cr, np: s.np, stats: { goldEarned: s.ge, playTime: s.pt }, bag: new Array(Math.max(0, s.b | 0)) };
    const c = check(ck, sv, r.at, { claim: true });
    if (c.ok) ck = c.ck; // the log also holds saves the check flagged (log-only mode); never learn from those
  }
  if (ck) { for (const p of ck.pts) p.rn = p.cu = null; if (ck.hw) ck.hw.rn = ck.hw.cu = null; }
  return ck;
}
module.exports = { R, check, trustedGold, seed, point, foeGold, heroLv, big, span };
