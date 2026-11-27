/* Lanternhold admin audit (v125, John 25 Nov 2026: "I need to see what they are doing so I can audit and see if
   they are cheating"). Reads the activity rows the save Lambda writes on every cloud sync (GET /admin/log) and marks
   what does not add up. Loaded only when an admin opens a player's log, never for players.

   A row: { at: server ms, s: numbers read from the save, a: [bell entries since the last sync], dv: device id }.
   s keys: g gold, d Dust, k Kindling, e Embers, x hero XP, f deepest floor, fl current floor, b bag size, ki kills,
   bk boss kills, ge gold earned (lifetime), pt play time (s), ls the device clock at save, cr game created,
   tk Rift tokens, sh boss shards, np NP+ tier, wp wages paid, hr hires, rk rekindles.

   Every threshold below was set from simulated honest play (see the v125 PR): honest play raises no warnings,
   and each planted cheat (edited gold, clock pushed forward, copied items, floor skip, sped-up game) is caught. */
(function (root) {
  'use strict';
  const R = {
    clockWarn: 180, clockBad: 3600,     // device clock ahead of the server at save, seconds
    speed: 1.25, speedPad: 90,          // game time may run at most 1.25x real time (+90 s) between syncs
    awayPad: 300,                       // "while you were away" may not claim more than the real gap + 5 min
    goldX: 6, goldMin: 5000,            // gold that appeared beyond what was earned: 6x the bank + earnings
    rateX: 40, rateMin: 8,              // earning rate 40x this player's usual rate (needs 8 earlier syncs)
    floorWarn: 12, floorBad: 30,        // new deepest floors in one sync (only past floor 40, where floors take time)
    floorFrom: 40,
    lvWarn: 5, lvBad: 12,               // hero levels in one sync (past hero level 5; honest play gains at most 1)
    lvFrom: 5,
    bagWarn: 60, bagBad: 150,           // items added to the bag in one sync (honest play: at most 3)
    tokWarn: 25,                        // Rift tokens in one sync (a whole boss gives about 15)
    shardWarn: 80,
    dustX: 8, dustMin: 2000,            // Dust that appeared: 8x the Dust held before
  };
  const xpNeed = lv => Math.round(160 * Math.pow(lv, 1.9) * Math.pow(Math.min(1, lv / 10), 1.5) + 40);
  function heroLv(x) { let lv = 1; x = x || 0; while (x >= xpNeed(lv) && lv < 5000) { x -= xpNeed(lv); lv++; } return lv; }
  const med = a => { if (!a.length) return 0; const b = a.slice().sort((p, q) => p - q); return b[b.length >> 1]; };
  function parse(r) {
    const j = v => { if (v && typeof v === 'object') return v; try { return JSON.parse(v); } catch (e) { return null; } };
    // rf: the server's rhythm-watch flags for this sync (v144, rhythm.js): timers, routines, auto-clickers, script clicks
    return { sk: r.sk, at: +r.at, s: j(r.s) || {}, a: j(r.a) || [], dv: r.dv || '', rf: j(r.rf) || [] };
  }
  // rows in any order; returns them oldest first with deltas (d), seconds since the previous sync (dt) and flags
  function analyze(rows) {
    const L = rows.map(parse).filter(r => r.at).sort((p, q) => p.at - q.at), rates = [];
    let prev = null;
    for (const r of L) {
      const s = r.s, f = r.flags = [], add = (lv, t, k) => f.push({ lv, t, k });
      r.lv = heroLv(s.x);
      for (const x of r.rf) if (x && x.t) add(x.lv === 'bad' || x.lv === 'warn' ? x.lv : 'info', 'Rhythm: ' + x.t, 'rh-' + x.k);
      const skew = s.ls ? (s.ls - r.at) / 1000 : 0;
      if (skew > R.clockWarn) add(skew > R.clockBad ? 'bad' : 'warn', 'Device clock is ' + span(skew) + ' ahead of the server. Pushing the clock forward is how away-gold is faked.', 'clock');
      for (const a of r.a) if (a && a[1] === 'away' && prev && a[2] > (r.at - prev.at) / 1000 + R.awayPad)
        add(r.dv && prev.dv && r.dv !== prev.dv ? 'info' : 'bad', 'Claimed ' + span(a[2]) + ' away (' + big(a[3]) + ' gold), but only ' + span((r.at - prev.at) / 1000) + ' passed on the server.', 'away');
      if (!prev) { prev = r; continue; }
      // a scrap, smelt or salvage on the same sync can pay out a lot of gold or Dust at once: cap those flags at a warning
      const craft = r.a.some(a => a && /craft/.test(a[1] || '')), cap = lv => (craft && lv === 'bad' ? 'warn' : lv), why = craft ? ' A crafting action on this sync may explain it.' : '';
      const pr = prev, p = pr.s, dt = r.dt = (r.at - pr.at) / 1000, d = r.d = {};
      for (const k of ['g', 'd', 'k', 'e', 'x', 'f', 'b', 'ki', 'bk', 'ge', 'pt', 'tk', 'sh', 'wp', 'rk']) d[k] = (s[k] || 0) - (p[k] || 0);
      d.lv = r.lv - pr.lv;
      prev = r;
      if (r.dv && pr.dv && r.dv !== pr.dv) add('info', 'Synced from a different device.', 'device');
      if (s.cr && p.cr && s.cr !== p.cr) { add('info', 'A different game was saved (new game, reset, or an older save picked).', 'newgame'); continue; }
      if ((s.np || 0) > (p.np || 0)) { add('info', 'Started New Playthrough NP+' + s.np + '.', 'np'); continue; }
      if (d.x < -1 || d.f < 0) { add(r.flags.some(x => x.k === 'device') ? 'info' : 'warn', 'Progress went backward (' + (d.f < 0 ? 'deepest floor ' + p.f + ' to ' + s.f : 'hero XP down ' + big(-d.x)) + '). Usually an older save from another device.', 'back'); continue; }
      if (r.a.some(a => a && a[1] === 'import')) add('warn', 'Loaded a backup code on this sync.', 'import');
      if (d.pt < -5 && d.g > 1e6 && d.g > 10 * Math.max(1, p.g || 0)) add('bad', 'Play time went back ' + span(-d.pt) + ' while gold rose ' + big(d.g) + '. A changed backup or save was loaded.', 'edit');
      if (d.pt > dt * R.speed + R.speedPad) add('bad', 'Played ' + span(d.pt) + ' of game time in ' + span(dt) + ' of real time. The game was sped up or the clock changed.', 'speed');
      const extra = d.g - Math.max(0, d.ge);
      if (extra > R.goldMin && extra > R.goldX * ((p.g || 0) + Math.max(0, d.ge)))
        add(cap(extra > 5 * R.goldX * ((p.g || 0) + Math.max(0, d.ge)) ? 'bad' : 'warn'), big(extra) + ' gold appeared that was not earned in play (had ' + big(p.g) + '). Big market sales can do this; edited saves do too.' + why, 'gold');
      if (dt > 20 && d.ge > 0) {
        const rate = d.ge / dt, m = med(rates);
        if (rates.length >= R.rateMin && m > 0 && rate > R.rateX * m && d.ge > (p.g || 0) + 1000 && !r.a.some(a => a && a[1] === 'away'))
          add(rate > 1e4 * m ? 'bad' : 'warn', 'Earned gold ' + Math.round(rate / m) + 'x faster than usual for this player (' + big(d.ge) + ' in ' + span(dt) + ').', 'rate');
        rates.push(rate); if (rates.length > 60) rates.shift();
      }
      if (p.f >= R.floorFrom && d.f >= R.floorWarn) add(d.f >= R.floorBad ? 'bad' : 'warn', 'Deepest floor jumped ' + p.f + ' to ' + s.f + ' in ' + span(dt) + '.', 'floor');
      if (pr.lv >= R.lvFrom && d.lv >= R.lvWarn) add(d.lv >= R.lvBad ? 'bad' : 'warn', 'Hero level jumped ' + (r.lv - d.lv) + ' to ' + r.lv + ' in ' + span(dt) + '.', 'xp');
      if (d.b >= R.bagWarn) add(d.b >= R.bagBad ? 'bad' : 'warn', d.b + ' items added to the bag in ' + span(dt) + '.', 'bag');
      if (d.tk >= R.tokWarn) add('bad', big(d.tk) + ' Rift tokens in one sync (a whole world boss gives about 15).', 'tok');
      if (d.sh >= R.shardWarn) add('warn', big(d.sh) + ' boss shards in one sync.', 'shard');
      if (d.d > R.dustMin && d.d > R.dustX * Math.max(1, p.d || 0)) add(cap(d.d > 5 * R.dustX * Math.max(1, p.d || 0) ? 'bad' : 'warn'), big(d.d) + ' Dust appeared (had ' + big(p.d) + ').' + why, 'dust');
    }
    const n = { bad: 0, warn: 0, info: 0 };
    L.forEach(r => r.flags.forEach(x => n[x.lv]++));
    const devs = new Set(L.map(r => r.dv).filter(Boolean)).size;
    return { rows: L, n, devs, verdict: n.bad ? 'bad' : n.warn ? 'warn' : 'ok' };
  }
  function big(v) {
    v = Math.round(v || 0); const a = Math.abs(v);
    if (a < 1e4) return String(v);
    const u = ['K', 'M', 'B', 'T', 'Qa', 'Qi']; let i = -1, x = a; while (x >= 1000 && i < u.length - 1) { x /= 1000; i++; }
    return (v < 0 ? '-' : '') + (x >= 100 ? x.toFixed(0) : x.toFixed(1)) + u[i];
  }
  function span(sec) {
    sec = Math.max(0, Math.round(sec || 0));
    if (sec < 90) return sec + ' s'; if (sec < 5400) return Math.round(sec / 60) + ' min';
    if (sec < 172800) return (sec / 3600).toFixed(sec < 36000 ? 1 : 0) + ' h'; return (sec / 86400).toFixed(1) + ' days';
  }
  const api = { R, analyze, heroLv, big, span };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.LHAudit = api;
})(typeof window !== 'undefined' ? window : this);
