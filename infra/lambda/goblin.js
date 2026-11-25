// The Golden Loot Goblin's fight and loot (v126, NP+ only). gulp.js spawns it (w='gob#<gid>' s='#' { hp, total, cy, gu }).
// POST /goblin/hit { id, score, ck, iv }: a 2-minute assault while it is loose, one per COOL, capped at CEIL monsters'
// worth of the hero's deepest floor + 10 (like the world boss), with the same rhythm check.
// POST /goblin/claim { id }: once it has gone. Killed (total >= hp): Gilded shards 3 + digits over 100, a ring roll of
// 20% + 2% per morsel the player fed that cycle (weighted, up to +30%; the top three always win), Sigils 2 (+3 for the
// top three). Escaped: 1 shard per assault, nothing else. The game picks which ring (one the player lacks).
const D = require('@aws-sdk/client-dynamodb'), crypto = require('crypto');
const db = new D.DynamoDBClient({}), { BOSS: T, HEROES: H, WALLETS: W } = process.env;
const res = (c, b) => ({ statusCode: c, body: JSON.stringify(b) }), S = v => ({ S: String(v) }), N = v => ({ N: String(v) });
const pidOf = s => crypto.createHash('sha256').update('lh:' + s).digest('hex').slice(0, 16);
const rnd = k => parseInt(crypto.createHash('sha256').update(k).digest('hex').slice(0, 8), 16) / 4294967296;
const COOL = 5 * 6e4, CEIL = 150, M = Math.max, mn = Math.min, CF = 'ConditionalCheckFailedException';
const fh = f => 10 * (1.22 ** (f - 1) * 1.03 ** M(0, f - 60) * 1.04 ** M(0, f - 140)) ** .4 * 1.0108 ** (M(0, f - 15) + M(0, f - 40));
const n = (i, k) => i && i[k] ? +i[k].N : 0;
const get = async (w, s) => (await db.send(new D.GetItemCommand({ TableName: T, Key: { w: S(w), s: S(s) } }))).Item;
exports.handler = async (e) => {
  const cl = e.requestContext.authorizer && e.requestContext.authorizer.jwt && e.requestContext.authorizer.jwt.claims;
  if (!cl || !cl.sub) return res(401, { error: 1 });
  const me = pidOf(cl.sub), now = Date.now(), h = (await db.send(new D.GetItemCommand({ TableName: H, Key: { pid: S(me) } }))).Item;
  if (!h || !h.name || h.ban || n(h, 'np') < 1) return res(403, { error: 'np' });
  let b = {}; try { b = JSON.parse(e.isBase64Encoded ? Buffer.from(e.body || '', 'base64').toString() : e.body || '{}'); } catch (x) { return res(400, { error: 1 }); }
  const id = String(b.id || ''); if (!/^[0-9a-z]{6,12}$/.test(id)) return res(400, { error: 1 });
  const ev = await get('gob#' + id, '#'); if (!ev) return res(404, { error: 'none' });
  const w = S('gob#' + id), gu = n(ev, 'gu');
  if (e.routeKey === 'POST /goblin/hit') {
    if (now > gu + 15e3) return res(409, { error: 'gone' });
    let sc = M(0, mn(CEIL * fh(mn(1500, n(h, 'fl') + 10)), Math.floor(+b.score || 0)));
    const iv = [].concat(b.iv || []).slice(0, 3e3).map(Number).filter(x => x < 1e3), k = iv.length, a = iv.reduce((p, x) => p + x, 0) / k;
    if (k > 99 && (a < 60 || iv.reduce((p, x) => p + (x - a) ** 2, 0) / k * 625 < a * a)) sc = M(0, sc - (+b.ck || 0));
    try {
      await db.send(new D.UpdateItemCommand({ TableName: T, Key: { w, s: S(me) }, UpdateExpression: 'SET #l=:t, nm=:n, c=:c ADD score :s, a :one',
        ConditionExpression: 'attribute_not_exists(#l) OR #l<:cut', ExpressionAttributeNames: { '#l': 'last' },
        ExpressionAttributeValues: { ':t': N(now), ':n': h.name, ':c': h.cls, ':s': N(sc), ':one': N(1), ':cut': N(now - COOL + 5000) } }));
    } catch (x) { if (x.name === CF) return res(429, { error: 'cool' }); throw x; }
    const g = await db.send(new D.UpdateItemCommand({ TableName: T, Key: { w, s: S('#') }, UpdateExpression: 'ADD #t :s', ExpressionAttributeNames: { '#t': 'total' }, ExpressionAttributeValues: { ':s': N(sc) }, ReturnValues: 'ALL_NEW' }));
    return res(200, { ok: true, add: sc, total: n(g.Attributes, 'total') });
  }
  if (e.routeKey !== 'POST /goblin/claim') return res(404, { error: 1 });
  if (now < gu) return res(409, { error: 'open' });
  const ps = ((await db.send(new D.QueryCommand({ TableName: T, KeyConditionExpression: 'w=:w', ExpressionAttributeValues: { ':w': w } }))).Items || []).filter(i => i.s.S !== '#').sort((x, y) => n(y, 'score') - n(x, 'score'));
  const rank = ps.findIndex(i => i.s.S === me) + 1, my = ps[rank - 1];
  if (!rank || !(n(my, 'score') > 0)) return res(404, { error: 'none' });
  try { await db.send(new D.UpdateItemCommand({ TableName: T, Key: { w, s: S(me) }, UpdateExpression: 'SET cl=:t', ConditionExpression: 'attribute_not_exists(cl)', ExpressionAttributeValues: { ':t': N(now) } })); }
  catch (x) { if (x.name === CF) return res(409, { error: 'claimed' }); throw x; }
  const killed = n(ev, 'total') >= n(ev, 'hp');
  if (!killed) return res(200, { ok: true, killed: false, sh: n(my, 'a'), rank, n: ps.length });
  const fed = await get('gulpc#' + n(ev, 'cy'), me), p = .2 + mn(.3, .02 * n(fed, 'w')), top = rank <= 3;
  const sig = 2 + (top ? 3 : 0), sh = 3 + M(0, Math.floor(Math.log10(n(my, 'score'))) - 2);
  const r = await db.send(new D.UpdateItemCommand({ TableName: W, Key: { userId: S(cl.sub) }, UpdateExpression: 'SET bal=if_not_exists(bal,:g)+:a', ExpressionAttributeValues: { ':g': N(100), ':a': N(sig) }, ReturnValues: 'UPDATED_NEW' }));
  return res(200, { ok: true, killed: true, ring: top || rnd(id + '#' + me) < p, p, sh, sig, rank, n: ps.length, bal: n(r.Attributes, 'bal') });
};
