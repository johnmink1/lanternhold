// NODE_PATH=infra/test/mock node infra/test/ring.season.test.js
// v141 Ember Ring: class bases (no dungeon power), Ring Mastery stats, and monthly seasons (soft reset, final standings, awards).
const assert = require('assert'), crypto = require('crypto'), path = require('path');
global.__DDB = {}; global.__KEYS = { arena: ['pid'], heroes: ['pid'], wallets: ['userId'] };
Object.assign(process.env, { ARENA: 'arena', HEROES: 'heroes', WALLETS: 'wallets' });
const ring = require(path.join(__dirname, '../ring/index.js')), R = ring._test, T = global.__DDB;
const pidOf = s => crypto.createHash('sha256').update('lh:' + s).digest('hex').slice(0, 16);
const ev = (sub, routeKey, body) => ({ routeKey, requestContext: { authorizer: { jwt: { claims: { sub } } } }, body: body && JSON.stringify(body) });
const key = p => JSON.stringify([['pid', { S: p }]]);
let now = Date.parse('2026-12-10T12:00:00Z'); Date.now = () => now;
(async () => {
  // dungeon power never counts; classes differ; Mastery adds 1% a rank
  const base = { k: [0, 0, 0, 0, 0], c: 'tank' };
  assert.deepEqual(R.stats(Object.assign({ m: 60, v: 60 }, base)), R.stats(Object.assign({ m: 0, v: 0 }, base)));
  assert.notEqual(R.stats({ k: [0, 0, 0, 0, 0], c: 'rogue' }).at, R.stats(base).at);
  assert.equal(R.stats(Object.assign({ ms: 10 }, base)).hp, Math.round(R.RBASE.tank[0] * 1.1));
  console.log('ok  faked dungeon power changes nothing; classes start apart; Mastery 10 = +10%');
  assert.equal(R.seasonOf(Date.parse('2026-11-27T00:00:00Z')), '2026-12'); assert.equal(R.seasonOf(Date.parse('2027-01-01T00:00:00Z')), '2027-01');
  assert.equal(R.prevSeason('2027-01'), '2026-12'); assert.equal(R.seasonNo('2026-12'), 1); assert.equal(R.seasonNo('2027-01'), 2);
  console.log('ok  Season 1 runs from launch to the end of December');
  // five heroes; sub i has an old row with no season field
  const subs = ['a', 'b', 'c', 'd', 'e'];
  T.heroes = new Map(); T.arena = new Map(); T.wallets = new Map();
  subs.forEach((s, i) => {
    const p = pidOf(s);
    T.heroes.set(key(p), { pid: { S: p }, u: { S: s }, name: { S: 'Hero' + s }, cls: { S: ['tank', 'healer', 'rogue', 'mage', 'necro'][i] }, lv: { N: '50' } });
    T.arena.set(key(p), { pid: { S: p }, n: { S: 'Hero' + s }, c: { S: ['tank', 'healer', 'rogue', 'mage', 'necro'][i] }, sd: { S: 'x' }, k: { S: '0.0.0.0.0' }, r: { N: String(1400 - 100 * i) }, pk: { N: '1400' }, w: { N: '5' }, l: { N: '1' }, tr: { N: '1200' }, et: { N: '0' } });
  });
  let g = JSON.parse((await ring.handler(ev('a', 'GET /arena'))).body);
  assert.equal(g.season.no, 1); assert.equal(g.season.last, null); assert.equal(g.me.r, 1400);
  const f = await ring.handler(ev('a', 'POST /arena/fight', { id: pidOf('b') })); assert.equal(f.statusCode, 200, f.body);
  const ra = +T.arena.get(key(pidOf('a'))).r.N;
  console.log('ok  December: no reset, duels work (a now ' + ra + ')');
  // January: everyone halfway back to 1,000, standings saved once, awards granted
  now = Date.parse('2027-01-02T09:00:00Z');
  g = JSON.parse((await ring.handler(ev('c', 'GET /arena'))).body);
  assert.equal(g.season.no, 2); assert.equal(g.season.last.no, 1); assert.equal(g.season.last.top[0].id, pidOf('a'));
  assert.equal(g.me.r, Math.round(1000 + (1200 - 1000) / 2));
  assert.ok(T.arena.get(key('season#2026-12')), 'standings saved');
  assert.deepEqual(T.wallets.get(JSON.stringify([['userId', { S: 'a' }]])).own.SS.sort(), ['e.laurel', 'f.emberchamp', 't.emberchamp']);
  assert.deepEqual(T.wallets.get(JSON.stringify([['userId', { S: 'e' }]])).own.SS, ['e.laurel']);
  assert.ok(T.arena.get(key(pidOf('a'))).sa.SS.includes('2026-12:1'));
  const own0 = JSON.stringify([...T.wallets.entries()]);
  await ring.handler(ev('d', 'GET /arena'));
  assert.equal(JSON.stringify([...T.wallets.entries()]), own0, 'awards only once');
  console.log('ok  January: ratings halve toward 1,000; Season 1 standings saved once; top 3 get title + frame, top 25 the Laurel');
  // a duel in the new season stores the reset ratings and last season's final rating
  const r0 = soft => soft;
  const f2 = await ring.handler(ev('d', 'POST /arena/fight', { id: pidOf('e') })); assert.equal(f2.statusCode, 200, f2.body);
  const rd = T.arena.get(key(pidOf('d'))), re = T.arena.get(key(pidOf('e')));
  assert.equal(rd.sn.S, '2027-01'); assert.equal(+rd.ps.N, 1100); assert.equal(+rd.tr.N, 1100); assert.equal(re.sn.S, '2027-01'); assert.equal(+re.ps.N, 1000);
  assert.ok(Math.abs(+rd.r.N - 1050) <= 32);
  g = JSON.parse((await ring.handler(ev('d', 'GET /arena'))).body);
  assert.ok(Math.abs(g.me.r - 1050) <= 32, 'not reset twice');
  console.log('ok  fights write the new season; nobody is reset twice');
})().catch(e => { console.error(e); process.exit(1); });
