// NODE_PATH=infra/test/mock node infra/test/rhythm.test.js
// Baseline for the v144 rhythm watch (rhythm.js): simulated honest players must raise no warning, planted scripts must
// be caught. Then save.js, worldboss.js and admin.js are run against the in-memory DynamoDB.
const assert = require('assert'), crypto = require('crypto'), path = require('path');
const RH = require('../lambda/rhythm');
let seed = +process.env.SEED || 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
const logn = (mean, cv) => { const s = Math.sqrt(Math.log(1 + cv * cv)); return mean * Math.exp(s * gauss() - s * s / 2); };
const H = 36e5, DAY = 864e5, T0 = Date.parse('2026-11-27T00:00:00Z'), COOL = 9e5;

// ---- the game side (same rules as ui.js RH.tap), turned into one sync summary ----
function tapSummary(taps) { // taps: [{t, x, y, repeat}]
  const c = { tp: 0, ss: 0, tw: 0, ew: 0, kr: 0 }; let lx = null, ly = null, tt = [];
  for (const e of taps) {
    c.tp++; if (e.repeat) { c.kr++; continue; }
    if (lx != null && Math.abs(e.x - lx) <= 1 && Math.abs(e.y - ly) <= 1) c.ss++; lx = e.x; ly = e.y;
    tt.push(e.t);
    if (tt.length >= 21) { const g = []; for (let i = 1; i < tt.length; i++) if (tt[i] - tt[i - 1] < 1000) g.push(tt[i] - tt[i - 1]);
      if (g.length >= 15) { const m = g.reduce((a, x) => a + x, 0) / g.length, sd = Math.sqrt(g.reduce((a, x) => a + (x - m) ** 2, 0) / g.length); c.tw++; if (sd / m < 0.05) c.ew++; } tt = []; }
  }
  return c;
}
// a burst of taps: n taps, gap(i) ms, position(i)
const burst = (t, n, gap, pos) => { const o = []; for (let i = 0; i < n; i++) { t += gap(i); const p = pos(i); o.push({ t, x: p[0], y: p[1] }); } return o; };
const human = { gap: () => logn(150, 0.3), pos: () => [400 + gauss() * 6, 300 + gauss() * 6] };
const stillMouse = { gap: () => logn(170, 0.35), pos: () => [400, 300] };

// A persona = a function giving, for each sync (every 75 s of play), { taps, btn, hr, ut } plus world boss assault times.
// Run it for `days`, feed every sync to absorb() and the boss record to boss(), and collect the worst flag per kind.
function run(p, days) {
  let st = null; const seen = {}, wb = []; let lastWb = 0;
  for (let t = T0; t < T0 + days * DAY; t += 75e3) {
    if (!p.awake(t)) continue;
    const s = p.sync(t), bh = { ...tapSummary(s.taps || []), ut: s.ut || 0, btn: (s.btn || []).map(b => [b[0], b[1], s.ut ? 0 : 1]), hr: s.taps && s.taps.length || (s.btn || []).length ? [Math.floor(t / H)] : [], cn: t };
    const r = RH.absorb(st, bh, t + 75e3); st = r.st;
    for (const f of r.flags) seen[f.k] = seen[f.k] === 'bad' || f.lv === 'bad' ? 'bad' : seen[f.k] === 'warn' || f.lv === 'warn' ? 'warn' : 'info';
    if (p.boss) { const a = p.boss(t, lastWb); if (a) { a.t += gauss() * 100; /* network */ wb.push([a.t, lastWb ? a.t - lastWb - COOL : -1, a.nd || 0, a.cr || 0.3]); lastWb = a.t; } }
  }
  for (const f of RH.boss(wb, COOL)) seen[f.k] = seen[f.k] === 'bad' || f.lv === 'bad' ? 'bad' : seen[f.k] === 'warn' || f.lv === 'warn' ? 'warn' : 'info';
  return seen;
}
const day16 = t => { const h = new Date(t).getUTCHours(); return h >= 7 && h < 23; };
const always = () => true;
// boss joiner: ready at last + COOL; joins after `delay()` ms. Assault "ends" 2 min later (the server sees end times).
const bossJoin = delay => { const plan = {}; return (t, last) => { const ready = last ? last + COOL : t, at = plan[ready] != null ? plan[ready] : (plan[ready] = Math.max(t, ready + delay())); return at >= t && at < t + 75e3 ? { t: at } : null; }; };
const chores = t => (rnd() < 0.25 ? [[['#train', '#enchant', 'tab:gear', 'tab:map', '#descend', 'merge:1', '#wbjoin'][Math.floor(rnd() * 7)], t + rnd() * 75e3]] : []);

const P = {
  // ---- honest ----
  'tapper (fast, fingers)':        { honest: 1, awake: day16, sync: t => ({ taps: rnd() < 0.5 ? burst(t, 60 + rnd() * 200 | 0, human.gap, human.pos) : [], btn: chores(t) }) },
  'tapper (mouse held still)':     { honest: 1, awake: day16, sync: t => ({ taps: rnd() < 0.6 ? burst(t, 200 + rnd() * 200 | 0, stillMouse.gap, stillMouse.pos) : [], btn: chores(t) }) },
  'held-down Space key':           { honest: 1, awake: day16, sync: t => ({ taps: burst(t, 300, () => 33, () => [0, 0]).map(e => ({ ...e, repeat: true })), btn: chores(t) }) },
  'boss on a phone alarm':         { honest: 1, awake: day16, sync: t => ({ btn: chores(t) }), boss: bossJoin(() => 5e3 + logn(60e3, 0.8)) },
  'boss, staring at the timer':    { honest: 1, awake: day16, sync: t => ({ btn: chores(t) }), boss: bossJoin(() => logn(3000, 0.6)) },
  'boss, sharp reflexes':          { honest: 1, awake: day16, sync: t => ({ btn: chores(t) }), boss: bossJoin(() => logn(1200, 0.4)) },
  'long sessions (16 h a day)':    { honest: 1, awake: day16, sync: t => ({ taps: rnd() < 0.3 ? burst(t, 50, human.gap, human.pos) : [], btn: chores(t) }) },
  'merge, confirm, merge...':      { honest: 1, awake: day16, sync: t => { const o = []; let x = t; for (let i = 0; i < 9; i++) { x += logn(5000, 0.4); o.push(['merge:1', x]); x += logn(1500, 0.4); o.push(['#mg-ok', x]); } return { btn: o }; } },
  // ---- planted scripts ----
  'boss join on setInterval 24/7': { awake: always, sync: t => ({ btn: Math.floor(t / COOL) !== Math.floor((t - 75e3) / COOL) ? [['#wbjoin', Math.floor(t / COOL) * COOL]] : [] }), boss: bossJoin(() => 1200) },
  'boss join, jitter 0-20 s, 24/7': { awake: always, sync: t => ({}), boss: bossJoin(() => rnd() * 20e3) },
  'boss join, jitter, sleeps 8 h': { awake: day16, sync: t => ({}), boss: bossJoin(() => rnd() * 20e3), evades: 1 },
  'auto-clicker 20/s':             { awake: day16, sync: t => ({ taps: burst(t, 1500, () => 50 + gauss(), () => [400, 300]) }) },
  'auto-clicker, random gaps':     { awake: day16, sync: t => ({ taps: burst(t, 600, () => logn(120, 0.25), () => [400, 300]) }), evades: 1 },
  'console script .click()':       { awake: day16, sync: t => ({ ut: 40, btn: [['#strike', t]] }) },
  'routine macro every 10 min':    { awake: day16, sync: t => { if (Math.floor(t / 6e5) === Math.floor((t - 75e3) / 6e5)) return {}; const b = Math.floor(t / 6e5) * 6e5; return { btn: [['#rekindle', b], ['tab:map', b + 4000], ['#descend', b + 9000]] }; } },
  'boss every 20 min on a timer':  { awake: day16, sync: t => ({}), boss: (t, last) => { const at = last ? last + 12e5 : t; return at >= t && at < t + 75e3 ? { t: at } : null; } },
  'edited boss score':             { awake: day16, sync: t => ({}), boss: (t, last) => { const a = bossJoin(() => logn(90e3, 0.8))(t, last); return a && { ...a, cr: 1 }; } },
};
let fp = 0, caught = 0, planted = 0;
console.log('persona'.padEnd(34) + 'flags (7 days)');
for (const k in P) {
  const f = run(P[k], 7), big = Object.keys(f).filter(x => f[x] !== 'info');
  console.log(k.padEnd(34) + (Object.keys(f).map(x => x + ':' + f[x]).join(' ') || '-'));
  if (P[k].honest) { if (big.length) fp++; }
  else { planted++; if (big.length) caught++; else if (!P[k].evades) assert.fail(k + ' not caught'); }
}
console.log('honest personas with a warning: ' + fp + '; planted scripts caught: ' + caught + ' of ' + planted);
assert.equal(fp, 0, 'no honest persona may be flagged');

// ---- handlers against the in-memory DynamoDB ----
global.__DDB = {}; global.__KEYS = { saves: ['userId'], trade: ['pk', 'sk'], heroes: ['pid'], wallets: ['userId'], boss: ['w', 's'] };
Object.assign(process.env, { TABLE: 'saves', TRADE: 'trade', HEROES: 'heroes', WALLETS: 'wallets', SAVES: 'saves', BOSS: 'boss', SAVECHECK: 'log' });
const L = p => { const f = path.join(__dirname, '../lambda', p); delete require.cache[require.resolve(f)]; return require(f); };
const sub = 'user-1', pid = crypto.createHash('sha256').update('lh:' + sub).digest('hex').slice(0, 16);
const ev = (method, body, q, routeKey, groups) => ({ routeKey, requestContext: { http: { method }, authorizer: { jwt: { claims: { sub: groups ? 'admin-1' : sub, 'cognito:groups': groups || '' } } } }, body: body && JSON.stringify(body), queryStringParameters: q });
const T = global.__DDB, get = (t, k) => T[t] && T[t].get(JSON.stringify(k));
let now = Date.parse('2026-11-28T06:00:00Z'); Date.now = () => now;
(async () => {
  const save = L('save.js'), boss = L('worldboss.js'), admin = L('admin.js');
  const s = { gold: 1e6, hxp: 5e6, maxFloorEver: 120, created: 1, stats: { goldEarned: 1e9, playTime: 3600 }, bag: [] };
  // 8 syncs, each with one press of the same button exactly 15 min apart
  let code;
  for (let i = 0; i < 8; i++) {
    now += 9e5; s.stats.playTime += 900;
    code = (await save.handler(ev('PUT', { data: JSON.stringify(s), floor: 120, created: 1, dv: 'devA', claim: i ? 0 : 1, bh: { tp: 0, ut: 0, btn: [['#wbjoin', now - 1000 + 3e5, 1]], hr: [Math.floor((now + 3e5) / H)], cn: now + 3e5 } }))).statusCode;
    assert.equal(code, 200, 'save ' + i + ' accepted (flag only)');
  }
  const fi = get('trade', [['pk', { S: 'flagidx' }], ['sk', { S: pid + '#s' }]]);
  assert.ok(fi && /cadence/.test(fi.flags.S), 'cadence flag on the Watch list');
  assert.ok(get('saves', [['userId', { S: sub }]]).rh, 'button history kept on the save row');
  console.log('ok  save: a button pressed every 15 min (device clock 5 min off) lands on the Watch list; saves still accepted');
  // world boss: hero row, then 13 assaults each 1.2 s after the cooldown ends
  T.heroes = T.heroes || new Map(); T.heroes.set(JSON.stringify([['pid', { S: pid }]]), { pid: { S: pid }, name: { S: 'Tester' }, cls: { S: 'tank' }, fl: { N: '120' } });
  now = Date.parse('2026-11-28T08:00:00Z');
  for (let i = 0; i < 13; i++) {
    const r = await boss.handler(ev('POST', { score: 1000, ck: 0, iv: [] }, null, 'POST /boss/hit'));
    assert.equal(r.statusCode, 200, 'assault ' + i); now += COOL + 1200;
  }
  const fb = get('trade', [['pk', { S: 'flagidx' }], ['sk', { S: pid + '#b' }]]);
  assert.ok(fb && /wbready/.test(fb.flags.S), 'boss timing flag');
  console.log('ok  world boss: 13 assaults each 1.2 s after the cooldown are flagged; every assault still counted');
  const lst = JSON.parse((await admin.handler(ev('GET', null, null, 'GET /admin/flags', 'admins'))).body).flags;
  assert.equal(lst.length, 2); assert.equal((await admin.handler(ev('GET', null, null, 'GET /admin/flags'))).statusCode, 403);
  assert.equal((await admin.handler(ev('POST', { id: pid }, null, 'POST /admin/flags/clear', 'admins'))).statusCode, 200);
  assert.equal(JSON.parse((await admin.handler(ev('GET', null, null, 'GET /admin/flags', 'admins'))).body).flags.length, 0);
  console.log('ok  admin: Watch list lists both, players get 403, Reviewed clears them and is audited');
  console.log('all rhythm tests passed');
})().catch(e => { console.error(e); process.exit(1); });
