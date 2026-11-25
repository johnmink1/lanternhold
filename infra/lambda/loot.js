// World boss loot. v120 (John, 25 Nov 2026): personal rolls, not one lottery. After an event every player who hit
// rolls their own Legendary chance, seeded by event + player so a retry sees the same roll:
// chance = min(3%, 0.4% x max(1, digits - 2)) x min(1, 0.4 + 0.2 x phases broken), digits = log10(damage).
// v125 (John, 25 Nov 2026): boss gear is Mythic and a drop should be rare (was min(20%, 2% x ...)).
// They also get boss shards and the same number of Rift tokens (the game's token shop trades 150 for a piece):
// 1 + max(0, whole digits - 2) + min(phases, 5). The preview (2026-11-23) counted monsters' worth, so its scores
// are scaled x1000 first. Boss shards trade on their own market (pk sh# for listings, ss#<seller> for the seller's
// pointers); the gold goes to the seller's mailbox as a 'sale' letter, like the gear market.
const D = require('@aws-sdk/client-dynamodb'), crypto = require('crypto');
const db = new D.DynamoDBClient({}), { BOSS: B, TRADE: T } = process.env;
const res = (c, b) => ({ statusCode: c, body: JSON.stringify(b || { error: 1 }) });
const S = v => ({ S: String(v) }), N = v => ({ N: String(v) });
const pid = s => crypto.createHash('sha256').update('lh:' + s).digest('hex').slice(0, 16);
const rnd = (id, k) => parseInt(crypto.createHash('sha256').update(id + '#' + k).digest('hex').slice(0, 8), 16) / 4294967296;
const WEEK = 6048e5, pre = id => id === '2026-11-23';
const phases = (t, id) => { let k = 0, n = pre(id) ? 1e3 : 1e9; while (t >= n && k < 30) { t -= n; n *= 2; k++; } return k; };
const end = id => Date.parse(id + 'T00:00:00Z') + (pre(id) ? 4 : 3) * 864e5;
const boss = id => Math.floor(Date.parse(id + 'T00:00:00Z') / WEEK) % 4;
const ok = n => /^[A-Za-z][A-Za-z '-]{1,15}$/.test(n);
const nid = () => Date.now().toString(36).padStart(9, '0') + crypto.randomBytes(3).toString('hex');
const q = async (t, k, v) => (await db.send(new D.QueryCommand({ TableName: t, KeyConditionExpression: k + '=:p', ExpressionAttributeValues: { ':p': S(v) } }))).Items || [];
const row = i => ({ id: i.sk.S, seller: i.seller.S, name: i.name.S, k: +i.k.N, n: +i.n.N, price: +i.price.N, at: +i.at.N });
// One player's roll for an event: { p, leg, tok, ph } or null when they did not hit.
function roll(id, rows, me) {
  const g = rows.find(i => i.s.S === '#'), my = rows.find(i => i.s.S === me), sc = my ? +my.score.N * (pre(id) ? 1e3 : 1) : 0;
  if (!(sc > 0)) return null;
  const ph = phases(g ? +g.total.N : 0, id), dg = Math.log10(sc), p = Math.min(.03, .004 * Math.max(1, dg - 2)) * Math.min(1, .4 + .2 * ph);
  return { p, leg: rnd(id, 'L' + me) < p, tok: 1 + Math.max(0, Math.floor(dg) - 2) + Math.min(ph, 5), ph };
}
exports.handler = async (e) => {
  const cl = e.requestContext.authorizer && e.requestContext.authorizer.jwt && e.requestContext.authorizer.jwt.claims;
  if (!cl || !cl.sub) return res(401);
  const me = pid(cl.sub), now = Date.now(), rk = e.routeKey;
  let b = {}; try { b = JSON.parse(e.isBase64Encoded ? Buffer.from(e.body || '', 'base64').toString() : e.body || '{}'); } catch (x) { return res(400); }
  if (rk === 'POST /boss/loot') {
    const id = String(b.id || '');
    if (!/^\d{4}-\d\d-\d\d$/.test(id) || now < end(id)) return res(409, { error: 'open' });
    const d = roll(id, await q(B, 'w', id), me);
    if (!d) return res(404, { error: 'none' });
    try {
      await db.send(new D.UpdateItemCommand({ TableName: B, Key: { w: S(id), s: S(me) }, UpdateExpression: 'SET lc=:t', ConditionExpression: 'attribute_not_exists(lc)', ExpressionAttributeValues: { ':t': N(now) } }));
    } catch (x) { if (x.name === 'ConditionalCheckFailedException') return res(409, { error: 'claimed' }); throw x; }
    return res(200, { ok: true, boss: boss(id), leg: d.leg, sh: d.tok, tok: d.tok, p: d.p, ph: d.ph });
  }
  if (rk === 'GET /shards') {
    const l = (await q(T, 'pk', (e.queryStringParameters || {}).mine ? 'ss#' + me : 'sh#')).map(row);
    return res(200, { me, l });
  }
  if (rk === 'POST /shards/list') {
    const k = Math.floor(+b.k), n = Math.floor(+b.n), p = Math.floor(+b.price);
    if (!(k >= 0 && k < 4 && n >= 1 && n <= 99 && p >= 1 && p < 1e60) || !ok(String(b.name || ''))) return res(400);
    if ((await q(T, 'pk', 'ss#' + me)).length >= 10) return res(400, { error: 'full' });
    const id = nid(), it = { seller: S(me), name: S(b.name), k: N(k), n: N(n), price: N(p), at: N(now) };
    await db.send(new D.TransactWriteItemsCommand({ TransactItems: [{ Put: { TableName: T, Item: Object.assign({ pk: S('sh#'), sk: S(id) }, it) } }, { Put: { TableName: T, Item: Object.assign({ pk: S('ss#' + me), sk: S(id) }, it) } }] }));
    return res(200, { ok: true, id });
  }
  if (rk === 'POST /shards/buy' || rk === 'POST /shards/cancel') {
    const id = String(b.id || ''), buy = rk === 'POST /shards/buy';
    if (!/^[0-9a-z]{15}$/.test(id)) return res(400);
    const g = (await db.send(new D.GetItemCommand({ TableName: T, Key: { pk: S('sh#'), sk: S(id) } }))).Item;
    if (!g) return res(404, { error: 'gone' });
    const L = row(g);
    if (buy ? L.seller === me || !ok(String(b.name || '')) : L.seller !== me) return res(403);
    const ops = [{ Delete: { TableName: T, Key: { pk: S('sh#'), sk: S(id) }, ConditionExpression: 'attribute_exists(sk)' } }, { Delete: { TableName: T, Key: { pk: S('ss#' + L.seller), sk: S(id) } } }];
    if (buy) ops.push({ Put: { TableName: T, Item: { pk: S('inbox#' + L.seller), sk: S(nid()), type: S('sale'), from: S(me), fromName: S(b.name), item: S(JSON.stringify({ shard: L.k, n: L.n })), gold: S(L.price), at: N(now) } } });
    try { await db.send(new D.TransactWriteItemsCommand({ TransactItems: ops })); } catch (x) { if (x.name === 'TransactionCanceledException') return res(404, { error: 'gone' }); throw x; }
    return res(200, { ok: true, k: L.k, n: L.n, price: L.price });
  }
  return res(404);
};
