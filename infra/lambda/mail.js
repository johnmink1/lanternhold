// Mail between players. An offer carries an item and an optional price; the receiver accepts (paying
// the price, which goes to the sender as a 'payment' letter) or declines (the item goes back as a
// 'return' letter). Senders can recall an unanswered offer. Letters (sale, payment, return) are claimed.
const { DynamoDBClient, GetItemCommand, QueryCommand, TransactWriteItemsCommand } = require('@aws-sdk/client-dynamodb'), crypto = require('crypto');
const db = new DynamoDBClient({}), T = process.env.TABLE, H = process.env.HEROES;
const CLS = ['tank', 'healer', 'rogue', 'mage', 'necro', 'paladin'], SLOT = 'main off head neck chest robe legs feet ring'.split(' '), RAR = ['common', 'fine', 'rare', 'epic', 'set'], JOB = 'forage smith herb armor prospect lamp'.split(' ');
const SET = { vigil: 'tank', grace: 'healer', night: 'rogue', regalia: 'mage', crown: 'necro', dawn: 'paladin' };
const BAD = /(fuck|shit|cunt|nigg|fag|rape|nazi|hitler|bitch|whore|dick|cock|puss|slut|porn|retard)/gi;
const res = (c, b) => ({ statusCode: c, body: JSON.stringify(b) });
const pidOf = s => crypto.createHash('sha256').update('lh:' + s).digest('hex').slice(0, 16);
const E = { error: 1 };
const S = v => ({ S: String(v) }), N = v => ({ N: String(v) });
function item(i) {
  if (!i || !CLS.includes(i.cls) || !SLOT.includes(i.slot) || !RAR.includes(i.rar)) return null;
  const set = i.set || '', js = i.jset || '', a = i.aff || 0;
  if (set ? SET[set] !== i.cls || i.rar !== 'set' : js ? !JOB.includes(js) || i.rar !== 'set' : i.rar === 'set') return null;
  const ilvl = Math.floor(+i.ilvl), up = Math.floor(+i.up || 0);
  if (!(ilvl >= 1 && ilvl <= 1e6 && up >= 0 && up <= 10)) return null;
  return { cls: i.cls, slot: i.slot, rar: i.rar, set: set || undefined, jset: js || undefined, aff: JOB.includes(a.j) && a.v > 0 && a.v <= 0.5 ? { j: a.j, v: +a.v } : undefined, en: /^([a-m][1-9]){0,4}$/.test(i.en) ? i.en : undefined, ty: /^\w{3,11}$/.test(i.ty) ? i.ty : undefined, t: i.t >= 1 && i.t <= 10 ? i.t | 0 : undefined, ilvl, up };
}
const hero = p => db.send(new GetItemCommand({ TableName: H, Key: { pid: S(p) } })).then(r => r.Item || {});
// NP+ tier and whether the 24 h post-reset trade lock is on (docs/NP-PLUS.md)
const tier = h => (h.np || {}).N | 0, locked = h => (h.npAt || {}).N > Date.now() - 864e5;
const newId = () => Date.now().toString(36).padStart(9, '0') + crypto.randomBytes(3).toString('hex');
const row = i => {
  const o = { id: i.sk.S, gold: 0, price: 0 };
  for (const k in i) if (k[1] != 'k') o[k] = i[k].N ? +i[k].N : i[k].S;
  o.gold = +o.gold; o.price = +o.price; if (o.item) o.item = JSON.parse(o.item);
  return o;
};
const K = (pk, id) => ({ pk: S(pk), sk: S(id) }), del = (pk, id) => ({ Delete: { TableName: T, Key: K(pk, id), ConditionExpression: 'attribute_exists(sk)' } });
const q = pk => db.send(new QueryCommand({ TableName: T, KeyConditionExpression: 'pk = :p', ExpressionAttributeValues: { ':p': S(pk) }}));
exports.handler = async (e) => {
  const cl = e.requestContext.authorizer && e.requestContext.authorizer.jwt && e.requestContext.authorizer.jwt.claims;
  if (!cl || !cl.sub) return res(401, E);
  const me = pidOf(cl.sub), rk = e.routeKey.split('/').pop(), now = Date.now();
  let b = {}; if (e.body) { try { b = JSON.parse(e.isBase64Encoded ? Buffer.from(e.body, 'base64').toString() : e.body); } catch (x) { return res(400, E); } }
  if (rk === 'mail') {
    const [i, o] = await Promise.all([q('inbox#' + me), q('out#' + me)]);
    return res(200, { inbox: (i.Items || []).map(row), outbox: (o.Items || []).map(row) });
  }
  if (rk === 'send') {
    const it = item(b.item), to = String(b.to || ''), p = Math.max(0, Math.floor(+b.price || 0));
    if (!it || !/^[0-9a-f]{16}$/.test(to) || to === me || !(p < 1e60)) return res(400, E);
    const [th, mh] = await Promise.all([hero(to), hero(me)]), toName = th.name && th.name.S, myName = mh.name && mh.name.S;
    if (!toName || !myName) return res(404, E);
    if (tier(th) !== tier(mh) || (it.t | 0) < tier(mh) || locked(th) || locked(mh)) return res(409, E); // 409 = different NP+ tier, an old-tier item, or the 24 h lock
    if (((await q('out#' + me)).Items || []).length >= 20) return res(400, E);
    BAD.lastIndex = 0;
    const note = String(b.note || '').slice(0, 80).replace(BAD, w => '*'.repeat(w.length));
    const id = newId(), base = { type: S('offer'), from: S(me), fromName: S(myName), to: S(to), toName: S(toName), item: S(JSON.stringify(it)), price: S(p), note: S(note), at: N(now) };
    await db.send(new TransactWriteItemsCommand({ TransactItems: [
      { Put: { TableName: T, Item: Object.assign(K('inbox#' + to, id), base) } },
      { Put: { TableName: T, Item: Object.assign(K('out#' + me, id), base) } }] }));
    return res(200, { ok: true, id, toName });
  }
  const id = String(b.id || ''); if (!/^[0-9a-z]{15}$/.test(id)) return res(400, E);
  const mine = rk === 'recall' ? 'out#' + me : 'inbox#' + me;
  const g = await db.send(new GetItemCommand({ TableName: T, Key: K(mine, id) }));
  if (!g.Item) return res(404, E);
  const L = row(g.Item), ops = [del(mine, id)];
  if (rk === 'claim') { if (L.type === 'offer') return res(400, E); }
  else if (L.type !== 'offer') return res(400, E);
  else if (rk === 'recall') ops.push(del('inbox#' + L.to, id));
  else {
    ops.push({ Delete: { TableName: T, Key: K('out#' + L.from, id) } });
    const acc = rk === 'accept';
    if (!acc && rk !== 'decline') return res(404, E);
    if (!acc || L.price > 0) ops.push({ Put: { TableName: T, Item: { ...K('inbox#' + L.from, newId()), type: S(acc ? 'payment' : 'return'), from: S(me), fromName: S(L.toName), item: S(JSON.stringify(L.item)), gold: S(acc ? L.price : 0), at: N(now), ttl: N(Math.floor(now / 1000) + 5184000) } } });
  }
  try { await db.send(new TransactWriteItemsCommand({ TransactItems: ops })); }
  catch (x) { if (x.name === 'TransactionCanceledException') return res(404, E); throw x; }
  return res(200, { ok: true, letter: L });
};
