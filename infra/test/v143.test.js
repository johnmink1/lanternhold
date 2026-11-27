// NODE_PATH=infra/test/mock node infra/test/v143.test.js
// v143 (John, 27 Nov 2026): Hardcore NP+ per slot, Sigils in Hardcore, Hardcore Gulp, exchange wall + trust, trade item level cap.
const assert = require('assert'), crypto = require('crypto'), path = require('path');
const L = require('../../lanternhold/core.js');
(async () => {
  // ---------- core: a Hardcore hero can start NP+ and keeps its run counters ----------
  const s = L.newState(); L.startGame(s, 'multi', 'tank', 'Ember', 'mercy'); L.startHardcore(s);
  s.maxFloor = s.maxFloorEver = 151; s.story.seen.act1 = 1; s.created = 9;
  Object.assign(s.hc, { n: 3, hf: 2, w: 1, lostN: 7, lost: ['a', 'b'], carry: { x: { main: 'u1' } }, pack: { f: 40, items: [{ uid: 'p1' }], at: Date.now() } });
  assert.ok(L.npReady(s), 'NP+ ready in Hardcore');
  assert.ok(L.startNP(s, 1, Date.now()), 'Hardcore NP+1 starts');
  assert.equal(L.npTier(s), 1); assert.ok(s.hc, 'still a Hardcore hero');
  assert.deepStrictEqual([s.hc.n, s.hc.hf, s.hc.w, s.hc.lostN], [3, 2, 1, 7], 'death and lost counts kept');
  assert.deepStrictEqual(s.hc.lost, ['a', 'b']); assert.equal(s.hc.pack, null, 'Lost Pack of the old tier gone'); assert.deepStrictEqual(s.hc.carry, {});
  assert.equal(s.created, 9, 'same run');
  assert.ok(require('../lambda/hccheck').check(true, s, { c: 9, n: 3, hf: 2, w: 1, ln: 7, lost: ['a', 'b'] }).ok, 'server accepts the NP+ Hardcore save');
  assert.ok(L.sigilChance(s, 'chest') > 0, 'Sigil finds in Hardcore');
  console.log('ok  core: Hardcore NP+ keeps the run counters, Sigil finds on');
  const n = L.newState(); L.startGame(n, 'multi', 'rogue', 'Normy', 'mercy'); n.maxFloor = n.maxFloorEver = 151; n.story.seen.act1 = 1;
  assert.ok(L.startNP(n, 1, Date.now()) && !n.hc, 'Normal NP+ unchanged');
  console.log('ok  core: Normal NP+ unchanged');

  let mock = true; try { require.resolve('@aws-sdk/client-dynamodb'); } catch (e) { mock = false; }
  if (!mock) { console.log('(server part skipped: run with NODE_PATH=infra/test/mock)'); return; }
  global.__DDB = {}; global.__KEYS = { saves: ['userId'], trade: ['pk', 'sk'], heroes: ['pid'], wallets: ['userId'], boss: ['w', 's'] };
  Object.assign(process.env, { TRADE: 'trade', HEROES: 'heroes', H: 'heroes', WALLETS: 'wallets', SAVES: 'saves', BOSS: 'boss', TRUSTCHECK: 'on' });
  const Lm = (p, env) => { Object.assign(process.env, env || {}); const f = path.join(__dirname, '../lambda', p); delete require.cache[require.resolve(f)]; delete require.cache[require.resolve(path.join(__dirname, '../lambda/trust.js'))]; return require(f); };
  const sub = 'user-v143', pid = x => crypto.createHash('sha256').update('lh:' + x).digest('hex').slice(0, 16), pN = pid(sub), pH = pid(sub + '#hc');
  const ev = (rk, hc, body) => ({ routeKey: rk, queryStringParameters: hc ? { hc: '1' } : {}, requestContext: { authorizer: { jwt: { claims: { sub } } } }, body: body ? JSON.stringify(body) : undefined });
  const D = require('@aws-sdk/client-dynamodb'), db = new D.DynamoDBClient({});
  const putHero = (p, o) => db.send(new D.PutItemCommand({ TableName: 'heroes', Item: Object.assign({ pid: { S: p }, name: { S: o.name }, cls: { S: 'tank' }, fl: { N: String(o.fl) }, seen: { N: String(Date.now()) } }, o.hc ? { hc: { N: '1' } } : {}) }));
  await putHero(pN, { name: 'Normy', fl: 160 }); await putHero(pH, { name: 'Hardy', fl: 151, hc: 1 });
  await db.send(new D.PutItemCommand({ TableName: 'wallets', Item: { userId: { S: sub }, bal: { N: '100' }, np: { N: '2' }, npAt: { N: String(Date.now() - 1e9) } } }));
  // np.js
  const np = Lm('np.js');
  let r = JSON.parse((await np.handler(ev('GET /np', true))).body);
  assert.deepStrictEqual([r.np, r.hc], [0, 1], 'Hardcore reads its own tier (0), not the Normal NP+2');
  r = JSON.parse((await np.handler(ev('GET /np', false))).body); assert.deepStrictEqual([r.np, r.hc], [2, 0], 'Normal still NP+2');
  const p1 = await np.handler(ev('POST /np', true)); r = JSON.parse(p1.body);
  assert.equal(p1.statusCode, 200, p1.body); assert.deepStrictEqual([r.np, r.hc, r.first], [1, 1, false], 'Hardcore NP+1, no First Dawn');
  const w = (await db.send(new D.GetItemCommand({ TableName: 'wallets', Key: { userId: { S: sub } } }))).Item;
  assert.deepStrictEqual([+w.np.N, +w.hnp.N, +w.bal.N], [2, 1, 125], 'Normal tier untouched, Hardcore tier 1, +25 Sigils on the account');
  const hh = (await db.send(new D.GetItemCommand({ TableName: 'heroes', Key: { pid: { S: pH } } }))).Item, hn = (await db.send(new D.GetItemCommand({ TableName: 'heroes', Key: { pid: { S: pN } } }))).Item;
  assert.equal(+hh.np.N, 1, 'Hardcore hero row stamped'); assert.ok(!hn.np, 'Normal hero row not touched');
  assert.equal((await np.handler(ev('POST /np', true))).statusCode, 400, 'one tier a week in Hardcore too');
  console.log('ok  np: Hardcore has its own tier; Normal untouched; +25 Sigils; weekly gap');
  // market: Hardcore NP+ market key, and the item level cap
  await db.send(new D.UpdateItemCommand({ TableName: 'heroes', Key: { pid: { S: pH } }, UpdateExpression: 'SET npAt = :a', ExpressionAttributeValues: { ':a': { N: String(Date.now() - 2 * 864e5) } } }));
  const market = Lm('market.js', { TABLE: 'trade' });
  const it = (ilvl, t) => ({ cls: 'tank', slot: 'main', rar: 'common', ilvl, up: 0, t });
  assert.equal((await market.handler(ev('POST /market/list', true, { item: it(150, 1), price: 10, name: 'Hardy' }))).statusCode, 200, 'fair item lists');
  const keys = [...global.__DDB.trade.keys()].filter(k => k.includes('mkt#'));
  assert.ok(keys.length === 1 && keys[0].includes('mkt#tank#hc#1'), 'Hardcore NP+1 market: ' + keys);
  assert.equal((await market.handler(ev('POST /market/list', true, { item: it(5000, 1), price: 10, name: 'Hardy' }))).statusCode, 400, 'item level far above the floor is refused');
  console.log('ok  market: Hardcore NP+ market, item level cap', Math.ceil((151 + 10) * 1.1));
  // mail: item level cap
  const mail = Lm('mail.js', { TABLE: 'trade' });
  await putHero(pid('someone'), { name: 'Somebody', fl: 10 });
  assert.equal((await mail.handler(ev('POST /mail/send', false, { item: it(150, 2), to: pid('someone'), price: 0 }))).statusCode, 200, 'a fair item still mails');
  assert.equal((await mail.handler(ev('POST /mail/send', false, { item: it(1e6), to: pid('someone'), price: 0 }))).statusCode, 400, 'mail refuses a 1,000,000 item level');
  console.log('ok  mail: item level cap');
  // exchange: shut in Hardcore; buys need trusted gold
  const ex = Lm('exchange.js', { TABLE: 'trade' });
  assert.equal((await ex.handler(ev('GET /sigils', true))).statusCode, 403, 'exchange shut in Hardcore');
  await db.send(new D.PutItemCommand({ TableName: 'trade', Item: { pk: { S: 'sig#' }, sk: { S: '000000000000001000-aaaaaaaaaaaaaaa' }, seller: { S: pid('seller') }, u: { S: 'seller' }, name: { S: 'Sella' }, n: { N: '5' }, price: { N: '5000000000' }, at: { N: '1' } } }));
  await db.send(new D.PutItemCommand({ TableName: 'saves', Item: { userId: { S: sub }, ck: { S: JSON.stringify({ pts: [{ at: Date.now(), g: 10, f: 1, np: 0 }], h: {} }) } } }));
  const buy = await ex.handler(ev('POST /sigils/buy', false, { id: '000000000000001000-aaaaaaaaaaaaaaa', name: 'Normy' }));
  assert.equal(buy.statusCode, 402, 'no trusted gold, no buy: ' + buy.body);
  console.log('ok  exchange: shut in Hardcore, buys checked against trusted gold');
  // gulp: a Hardcore NP+ hero feeds as itself
  const gulp = Lm('gulp.js');
  assert.equal((await gulp.handler(ev('GET /gulp', false))).statusCode, 403, 'Normal hero row without NP+ is turned away');
  let gc = 0; try { gc = (await gulp.handler(ev('GET /gulp', true))).statusCode; } catch (e) { gc = 'past the NP+ check'; } // the mock can't run Gulp's boss-table queries
  assert.notEqual(gc, 403, 'Hardcore NP+1 hero passes');
  console.log('ok  gulp: Hardcore NP+ hero can visit');
})().catch(e => { console.error(e); process.exit(1); });
