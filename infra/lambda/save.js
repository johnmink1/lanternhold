// Lanternhold cloud save (GET/PUT/DELETE /save) plus the player activity log (John, 25 Nov 2026: "I need to see what
// they are doing so I can audit and see if they are cheating"). Every PUT also writes one small log row to the trade
// table (pk alog#<pid>, kept 30 days): a few numbers read from the save (gold, Dust, XP, floor, bag size...), the
// server's own clock, and the bell entries the game sent since its last sync. Only admins can read it (admin.js,
// GET /admin/log). No IP address, email or device details are stored; dv is a random id made by the game.
// The log is best effort: if it fails, the save still goes through.
const D = require('@aws-sdk/client-dynamodb');
const zlib = require('zlib'), crypto = require('crypto');
const db = new D.DynamoDBClient({});
const { TABLE, TRADE } = process.env;
const res = (c, b) => ({ statusCode: c, headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });
const pidOf = sub => crypto.createHash('sha256').update('lh:' + sub).digest('hex').slice(0, 16);
const n = v => (typeof v === 'number' && isFinite(v) ? Math.round(v * 100) / 100 : 0);
// The numbers the audit view checks. Keys stay short: one row is written per sync.
function snap(data) {
  let s;
  try { s = JSON.parse(data.slice(0, 4) === 'gz1:' ? zlib.gunzipSync(Buffer.from(data.slice(4), 'base64')).toString() : data); } catch (e) { return null; }
  if (!s || typeof s !== 'object') return null;
  const t = s.stats || {}, sh = s.shards || {};
  return { g: n(s.gold), d: n(s.dust), k: n(s.kindling), e: n(s.embers), x: n(s.hxp), f: n(s.maxFloorEver), fl: n(s.floor),
    b: Array.isArray(s.bag) ? s.bag.length : 0, ki: n(t.kills), bk: n(t.bossKills), ge: n(t.goldEarned), pt: n(t.playTime),
    ls: n(s.lastSeen), cr: n(s.created), tk: n(s.wbTok), sh: Object.values(sh).reduce((a, v) => a + n(v), 0), np: n(s.np),
    wp: n(s.wagesPaid), hr: s.hires ? Object.keys(s.hires).length : 0, rk: n(t.rekindles) };
}
async function logSave(sub, now, data, b) {
  const sn = snap(data); if (!sn) return;
  let a = ''; try { a = JSON.stringify(Array.isArray(b.acts) ? b.acts.slice(-30) : []).slice(0, 6000); } catch (e) {}
  await db.send(new D.PutItemCommand({ TableName: TRADE, Item: { pk: { S: 'alog#' + pidOf(sub) }, sk: { S: now.toString(36) + crypto.randomBytes(2).toString('hex') },
    at: { N: String(now) }, s: { S: JSON.stringify(sn) }, a: { S: a }, dv: { S: String(b.dv || '').slice(0, 12) }, ttl: { N: String(Math.floor(now / 1000) + 30 * 86400) } } }));
}
exports.handler = async (event) => {
  const sub = event.requestContext && event.requestContext.authorizer && event.requestContext.authorizer.jwt && event.requestContext.authorizer.jwt.claims.sub;
  if (!sub) return res(401, { error: 'not signed in' });
  const method = event.requestContext.http.method;
  const Key = { userId: { S: sub } };
  if (method === 'GET') {
    const r = await db.send(new D.GetItemCommand({ TableName: TABLE, Key }));
    if (!r.Item) return res(404, { error: 'no save' });
    const dv = r.Item.dv ? r.Item.dv.S : '';
    // ?peek=1: only who plays and when it last saved, so a device coming back can check without downloading the save.
    if (event.queryStringParameters && event.queryStringParameters.peek) return res(200, { updated: Number(r.Item.updated.N), dv });
    // rst: an admin reset this player; games created before it start over
    return res(200, { data: r.Item.data.S, updated: Number(r.Item.updated.N), rst: r.Item.rst ? Number(r.Item.rst.N) : 0, dv });
  }
  if (method === 'PUT') {
    let body = event.body || '';
    if (event.isBase64Encoded) body = Buffer.from(body, 'base64').toString('utf8');
    if (body.length > 300000) return res(413, { error: 'save too large' });
    let b; try { b = JSON.parse(body); } catch (e) { return res(400, { error: 'bad json' }); }
    if (typeof b.data !== 'string') return res(400, { error: 'missing data' });
    const now = Date.now();
    // UpdateItem keeps an admin reset stamp (rst); saves from games created before it are refused.
    // One device plays at a time (John, 26 Nov 2026: no races between web, phone and Discord). dv is the game's random
    // device id. A game claims the account when it opens (claim: 1, after it picked the newer save); from then on a save
    // from any other device is refused with 409 'moved', and that device pauses until the player presses Play here.
    const dv = String(b.dv || '').slice(0, 24), claim = !!b.claim && !!dv;
    let cond = '(attribute_not_exists(rst) OR rst <= :c)', vals = { ':d': { S: b.data }, ':u': { N: String(now) }, ':f': { N: String(Number(b.floor) || 0) }, ':c': { N: String(Number(b.created) || 0) } };
    let upd = 'SET #d = :d, updated = :u, floor = :f';
    if (dv) { upd += ', dv = :v'; vals[':v'] = { S: dv }; if (!claim) cond += ' AND (attribute_not_exists(dv) OR dv = :v)'; }
    try {
      await db.send(new D.UpdateItemCommand({ TableName: TABLE, Key, UpdateExpression: upd,
        ConditionExpression: cond, ExpressionAttributeNames: { '#d': 'data' }, ExpressionAttributeValues: vals }));
    } catch (e) {
      if (e.name !== 'ConditionalCheckFailedException') throw e;
      const r = await db.send(new D.GetItemCommand({ TableName: TABLE, Key }));
      if (r.Item && r.Item.rst && Number(r.Item.rst.N) > (Number(b.created) || 0)) return res(409, { error: 'reset', rst: Number(r.Item.rst.N) });
      return res(409, { error: 'moved', updated: r.Item ? Number(r.Item.updated.N) : 0 });
    }
    if (TRADE) try { await logSave(sub, now, b.data, b); } catch (e) { console.log('activity log', e.name || e); }
    return res(200, { ok: true, updated: now });
  }
  if (method === 'DELETE') {
    await db.send(new D.DeleteItemCommand({ TableName: TABLE, Key }));
    return res(200, { ok: true });
  }
  return res(405, { error: 'method not allowed' });
};
