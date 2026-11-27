// NODE_PATH=infra/test/mock/node_modules node infra/test/save.handler.test.js
// Runs save.js, admin.js and mail.js against an in-memory DynamoDB: held saves, snapshots, restore, sale credits.
const assert = require('assert'), crypto = require('crypto'), path = require('path');
global.__DDB = {}; global.__KEYS = { saves: ['userId'], trade: ['pk', 'sk'], heroes: ['pid'], wallets: ['userId'] };
Object.assign(process.env, { TABLE: 'saves', TRADE: 'trade', HEROES: 'heroes', WALLETS: 'wallets', SAVES: 'saves' });
const L = p => { const f = path.join(__dirname, '../lambda', p); delete require.cache[require.resolve(f)]; return require(f); };
const SC = require('../lambda/savecheck');
const sub = 'user-1', pid = crypto.createHash('sha256').update('lh:' + sub).digest('hex').slice(0, 16);
const ev = (method, body, q, routeKey, groups) => ({ routeKey, requestContext: { http: { method }, authorizer: { jwt: { claims: { sub: groups ? 'admin-1' : sub, 'cognito:groups': groups || '' } } } }, body: body && JSON.stringify(body), queryStringParameters: q });
const T = global.__DDB, row = () => T.saves.get(JSON.stringify([['userId', { S: sub }]])), trade = (pk, sk) => T.trade && T.trade.get(JSON.stringify([['pk', { S: pk }], ['sk', { S: sk }]]));
let now = Date.parse('2026-11-27T06:00:00Z'); Date.now = () => now;
let s = { gold: 1e6, hxp: 5e6, maxFloorEver: 120, wbTok: 0, created: 1, np: 0, stats: { goldEarned: 1e9, playTime: 3600 }, bag: [], reno: {}, curios: {} };
const put = async (save, extra) => (await save.handler(ev('PUT', Object.assign({ data: JSON.stringify(s), floor: s.maxFloorEver, created: 1, dv: 'devA' }, extra)))).statusCode;
const step = () => { now += 75e3; const g = 50 * SC.foeGold(120) * 75; s = JSON.parse(JSON.stringify(s)); s.gold += g; s.stats.goldEarned += g; s.stats.playTime += 75; };
(async () => {
  process.env.SAVECHECK = 'on'; let save = L('save.js');
  assert.equal(await put(save, { claim: 1 }), 200);
  assert.ok(row().ck, 'reference stored'); assert.ok(trade('snap#' + pid, '2026-11-27'), 'daily snapshot');
  for (let i = 0; i < 40; i++) { step(); assert.equal(await put(save), 200, 'honest ' + i); }
  console.log('ok  40 honest saves accepted, daily snapshot taken');
  const good = row().data.S;
  step(); const bad = JSON.parse(JSON.stringify(s)); s.gold = 999e15;
  assert.equal(await put(save), 409); assert.equal(row().data.S, good, 'trusted save kept');
  assert.ok(trade('held#' + pid, '0') && trade('heldidx', pid), 'held copy for admin');
  console.log('ok  edited gold refused with SAVECHECK=on; trusted save kept; held copy stored');
  process.env.SAVECHECK = 'log'; save = L('save.js'); const ck0 = row().ck.S;
  assert.equal(await put(save), 200); assert.equal(row().ck.S, ck0, 'reference not learnt from a held save');
  console.log('ok  log mode saves it but keeps the old reference');
  process.env.SAVECHECK = 'on'; save = L('save.js');
  // admin: list, then restore yesterday's (today's) snapshot; the open device then gets 'moved'
  T.heroes = T.heroes || new Map(); T.heroes.set(JSON.stringify([['pid', { S: pid }]]), { pid: { S: pid }, u: { S: sub }, name: { S: 'Tester' } });
  const admin = L('admin.js');
  const lh = JSON.parse((await admin.handler(ev('GET', null, {}, 'GET /admin/held', 'admins'))).body); assert.equal(lh.held[0].id, pid);
  const ls = JSON.parse((await admin.handler(ev('GET', null, { id: pid }, 'GET /admin/saves', 'admins'))).body); assert.ok(ls.held && ls.snaps.length === 1);
  const rs = await admin.handler(ev('POST', { id: pid, from: '2026-11-27' }, null, 'POST /admin/restore', 'admins')); assert.equal(rs.statusCode, 200, rs.body);
  assert.equal(row().dv.S, 'admin');
  s = bad; assert.equal(await put(save), 409); assert.equal(JSON.parse((await save.handler(ev('PUT', { data: JSON.stringify(s), dv: 'devA' }))).body).error, 'moved');
  console.log('ok  admin lists held saves and snapshots, restores one; the open game is told another device took over');
  s = JSON.parse(T.trade.get(JSON.stringify([['pk', { S: 'snap#' + pid }], ['sk', { S: '2026-11-27' }]])).data.S);
  now += 60e3; assert.equal(await put(save, { claim: 1 }), 200, 'Play here after a restore');
  // Market/Mail credits: a 1e16 sale claimed through mail lets the gold in
  for (let i = 0; i < 35; i++) { step(); assert.equal(await put(save), 200); }
  T.trade.set(JSON.stringify([['pk', { S: 'inbox#' + pid }], ['sk', { S: '0000000000aaaaa' }]]), { pk: { S: 'inbox#' + pid }, sk: { S: '0000000000aaaaa' }, type: { S: 'sale' }, gold: { S: '10000000000000000' }, at: { N: String(now) } });
  process.env.TABLE = 'trade'; const mail = L('mail.js'); process.env.TABLE = 'saves'; const mc = await mail.handler({ routeKey: 'POST /mail/claim', requestContext: { authorizer: { jwt: { claims: { sub } } } }, body: JSON.stringify({ id: '0000000000aaaaa' }) });
  assert.equal(mc.statusCode, 200, mc.body); assert.equal(+row().crd.N, 1e16);
  step(); s.gold += 1e16; s.stats.goldEarned += 1e16; assert.equal(await put(save), 200); assert.equal(+row().crd.N, 0);
  console.log('ok  a claimed sale is credited and the save that carries it passes');
  // older copy: the stored save is kept before it is replaced
  step(); const older = JSON.parse(JSON.stringify(s)); older.stats.playTime -= 2400; older.gold = 1; older.stats.goldEarned -= 1e16 + 50 * SC.foeGold(120) * 2400; s = older;
  assert.equal(await put(save), 200); assert.ok([...T.trade.keys()].some(k => k.includes('snap#' + pid) && k.includes('"b2026')), 'copy before an older save replaced it');
  console.log('ok  an older copy is accepted, and the newer one it replaced is kept as a snapshot');
  // trust: a mail payment larger than trusted gold is refused with TRUSTCHECK=on
  process.env.TRUSTCHECK = 'on'; delete require.cache[require.resolve('../lambda/trust.js')]; process.env.TABLE = 'trade'; const mail2 = L('mail.js'); process.env.TABLE = 'saves';
  T.trade.set(JSON.stringify([['pk', { S: 'inbox#' + pid }], ['sk', { S: '0000000000bbbbb' }]]), { pk: { S: 'inbox#' + pid }, sk: { S: '0000000000bbbbb' }, type: { S: 'offer' }, from: { S: 'f'.repeat(16) }, to: { S: pid }, toName: { S: 'Tester' }, item: { S: '{}' }, price: { S: '999000000000000000' }, at: { N: String(now) } });
  const ma = await mail2.handler({ routeKey: 'POST /mail/accept', requestContext: { authorizer: { jwt: { claims: { sub } } } }, body: JSON.stringify({ id: '0000000000bbbbb' }) });
  assert.equal(ma.statusCode, 402);
  console.log('ok  paying 999Qa by Mail with gold the server never saw is refused');
  console.log('all handler tests passed');
})().catch(e => { console.error(e); process.exit(1); });
