// New Playthrough (NP+, John 25 Nov 2026, docs/NP-PLUS.md). POST /np starts the next tier for the signed-in player:
// +25 Sigils once per tier (cap NP+10, at least 7 days between tiers), stamps np/npAt on the wallet and the hero
// (market and mail read them: per-tier markets, same-tier mail, 24 h trade lock), and clears the player's trades so
// no gold or items cross over: own listings and sent offers are dropped, gold/item letters are dropped, and offers
// other players sent go back to them as 'return' letters.
const D = require('@aws-sdk/client-dynamodb'), crypto = require('crypto');
const db = new D.DynamoDBClient({}), { WALLETS: W, HEROES: H, TRADE: T } = process.env;
const res = (c, b) => ({ statusCode: c, body: JSON.stringify(b) });
const S = v => ({ S: String(v) }), N = v => ({ N: String(v) }), send = c => db.send(c);
const MAX = 10, GAP = 7 * 864e5, GIFT = 25, FLOOR = 151;
const pidOf = s => crypto.createHash('sha256').update('lh:' + s).digest('hex').slice(0, 16);
const q = pk => send(new D.QueryCommand({ TableName: T, KeyConditionExpression: 'pk = :p', ExpressionAttributeValues: { ':p': S(pk) } })).then(r => r.Items || []);
const del = (pk, sk) => send(new D.DeleteItemCommand({ TableName: T, Key: { pk: S(pk), sk } }));
exports.handler = async (e) => {
  const cl = e.requestContext.authorizer && e.requestContext.authorizer.jwt && e.requestContext.authorizer.jwt.claims;
  if (!cl || !cl.sub) return res(401, { error: 1 });
  const me = pidOf(cl.sub), now = Date.now(), K = { userId: S(cl.sub) };
  const w = (await send(new D.GetItemCommand({ TableName: W, Key: K, ConsistentRead: true }))).Item || {};
  const np = w.np ? +w.np.N : 0, at = w.npAt ? +w.npAt.N : 0;
  if (e.routeKey === 'GET /np') return res(200, { np, npAt: at, next: at ? at + GAP : 0 });
  if (np >= MAX) return res(400, { error: 'max' });
  if (at && now - at < GAP) return res(400, { error: 'wait', next: at + GAP });
  const h = (await send(new D.GetItemCommand({ TableName: H, Key: { pid: S(me) } }))).Item;
  if (!h || !h.fl || +h.fl.N < FLOOR) return res(400, { error: 'floor' });
  const t = np + 1;
  try {
    await send(new D.UpdateItemCommand({ TableName: W, Key: K, UpdateExpression: 'SET np = :t, npAt = :a, bal = if_not_exists(bal, :h) + :g',
      ConditionExpression: w.np ? 'np = :o' : 'attribute_not_exists(np)',
      ExpressionAttributeValues: Object.assign({ ':t': N(t), ':a': N(now), ':h': N(100), ':g': N(GIFT) }, w.np ? { ':o': w.np } : {}), ReturnValues: 'UPDATED_NEW' }))
      .then(r => { w.bal = r.Attributes.bal; });
  } catch (x) { if (x.name === 'ConditionalCheckFailedException') return res(409, { error: 'race' }); throw x; }
  await send(new D.UpdateItemCommand({ TableName: H, Key: { pid: S(me) }, UpdateExpression: 'SET np = :t, npAt = :a', ExpressionAttributeValues: { ':t': N(t), ':a': N(now) } }));
  let n = 0;
  for (const i of await q('sell#' + me)) { await del('sell#' + me, i.sk); await del('mkt#' + i.cls.S + (np ? '#' + np : ''), i.sk); n++; }
  for (const i of await q('out#' + me)) { await del('out#' + me, i.sk); await del('inbox#' + i.to.S, i.sk); n++; }
  for (const i of await q('inbox#' + me)) {
    await del('inbox#' + me, i.sk); n++;
    if (i.type.S !== 'offer') continue;
    await del('out#' + i.from.S, i.sk);
    await send(new D.PutItemCommand({ TableName: T, Item: { pk: S('inbox#' + i.from.S), sk: S(now.toString(36).padStart(9, '0') + crypto.randomBytes(3).toString('hex')), type: S('return'), from: S(me), fromName: i.toName, item: i.item, gold: S(0), at: N(now), ttl: N(Math.floor(now / 1000) + 5184000) } }));
  }
  return res(200, { ok: true, np: t, npAt: now, bal: +w.bal.N, cleared: n });
};
