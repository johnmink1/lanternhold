// Lanternhold cloud save (GET/PUT/DELETE /save) plus the player activity log (John, 25 Nov 2026: "I need to see what
// they are doing so I can audit and see if they are cheating"). Every PUT also writes one small log row to the trade
// table (pk alog#<pid>, kept 30 days): a few numbers read from the save (gold, Dust, XP, floor, bag size...), the
// server's own clock, and the bell entries the game sent since its last sync. Only admins can read it (admin.js,
// GET /admin/log). No IP address, email or device details are stored; dv is a random id made by the game.
// The log is best effort: if it fails, the save still goes through.
// v131 Hall of Fame (John, 26 Nov 2026): each PUT also copies a few record numbers read from the save onto the
// player's public hero row (hf), and c0 keeps the first start time the server ever saw, so a later edit of
// "created" cannot shorten a Start to NP+1 time. Players appear once they next sync. Best effort, like the log.
const D = require('@aws-sdk/client-dynamodb');
const zlib = require('zlib'), crypto = require('crypto');
const db = new D.DynamoDBClient({});
const { TABLE, TRADE, HEROES } = process.env;
const res = (c, b) => ({ statusCode: c, headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });
const pidOf = sub => crypto.createHash('sha256').update('lh:' + sub).digest('hex').slice(0, 16);
const n = v => (typeof v === 'number' && isFinite(v) ? Math.round(v * 100) / 100 : 0);
// The numbers the audit view checks. Keys stay short: one row is written per sync.
function parse(data) {
  let s;
  try { s = JSON.parse(data.slice(0, 4) === 'gz1:' ? zlib.gunzipSync(Buffer.from(data.slice(4), 'base64')).toString() : data); } catch (e) { return null; }
  return s && typeof s === 'object' ? s : null;
}
function snap(s) {
  if (!s) return null;
  const t = s.stats || {}, sh = s.shards || {};
  return { g: n(s.gold), d: n(s.dust), k: n(s.kindling), e: n(s.embers), x: n(s.hxp), f: n(s.maxFloorEver), fl: n(s.floor),
    b: Array.isArray(s.bag) ? s.bag.length : 0, ki: n(t.kills), bk: n(t.bossKills), ge: n(t.goldEarned), pt: n(t.playTime),
    ls: n(s.lastSeen), cr: n(s.created), tk: n(s.wbTok), sh: Object.values(sh).reduce((a, v) => a + n(v), 0), np: n(s.np),
    wp: n(s.wagesPaid), hr: s.hires ? Object.keys(s.hires).length : 0, rk: n(t.rekindles) };
}
// Gear rating: 100 x the gear bonus of everything the player's own hero wears (core.js gearRating, same numbers).
const RAR = { common: 0.04, fine: 0.08, rare: 0.14, epic: 0.24, set: 0.18, goblin: 0.26, legend: 0.34, mythic: 0.5 };
function gearRating(s) {
  const g = (s.gear || {}).you || {}, bag = s.bag || [], of = u => bag.find(x => x.uid === u);
  const ch = of(g.chest), robe = ch && ch.slot === 'robe'; let t = 0;
  for (const p in g) {
    const it = of(g[p]); if (!it || (p === 'legs' && robe)) continue;
    t += (it.wb != null ? 0.5 : it.rset != null ? 0.22 : RAR[it.rar] || 0) * (1 + 0.03 * (it.ilvl || 0)) * (1 + 0.2 * (it.up || 0));
  }
  return Math.round(t * 100);
}
// Feats leave out hidden ones (dawn), so the count never gives a secret away.
function hof(s) {
  const t = s.stats || {}, l = [].concat(s.npLog || []).find(x => x.t === 1);
  return { g: n(s.gold), ge: n(t.goldEarned), bk: n(t.bossKills), ki: n(t.kills), pt: n(t.playTime), gr: gearRating(s),
    ft: Object.keys(s.feats || {}).filter(k => k !== 'dawn').length, n1: l ? n(l.at) : 0, cr: n(s.created) };
}
async function putHof(sub, s) {
  // Only a named, unbanned hero row gets records (a player with no public hero fails the condition, which is fine).
  const h = hof(s);
  await db.send(new D.UpdateItemCommand({ TableName: HEROES, Key: { pid: { S: pidOf(sub) } }, UpdateExpression: 'SET hf=:h, c0=if_not_exists(c0,:c)',
    ConditionExpression: 'attribute_exists(#n) AND attribute_not_exists(ban)', ExpressionAttributeNames: { '#n': 'name' },
    ExpressionAttributeValues: { ':h': { S: JSON.stringify(h) }, ':c': { N: String(h.cr || Date.now()) } } }));
}
async function logSave(sub, now, sv, b) {
  const sn = snap(sv); if (!sn) return;
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
    // rst: an admin reset this player; games created before it start over
    return res(200, { data: r.Item.data.S, updated: Number(r.Item.updated.N), rst: r.Item.rst ? Number(r.Item.rst.N) : 0 });
  }
  if (method === 'PUT') {
    let body = event.body || '';
    if (event.isBase64Encoded) body = Buffer.from(body, 'base64').toString('utf8');
    if (body.length > 300000) return res(413, { error: 'save too large' });
    let b; try { b = JSON.parse(body); } catch (e) { return res(400, { error: 'bad json' }); }
    if (typeof b.data !== 'string') return res(400, { error: 'missing data' });
    const now = Date.now();
    // UpdateItem keeps an admin reset stamp (rst); saves from games created before it are refused
    try {
      await db.send(new D.UpdateItemCommand({ TableName: TABLE, Key, UpdateExpression: 'SET #d = :d, updated = :u, floor = :f',
        ConditionExpression: 'attribute_not_exists(rst) OR rst <= :c', ExpressionAttributeNames: { '#d': 'data' },
        ExpressionAttributeValues: { ':d': { S: b.data }, ':u': { N: String(now) }, ':f': { N: String(Number(b.floor) || 0) }, ':c': { N: String(Number(b.created) || 0) } } }));
    } catch (e) {
      if (e.name !== 'ConditionalCheckFailedException') throw e;
      const r = await db.send(new D.GetItemCommand({ TableName: TABLE, Key }));
      return res(409, { error: 'reset', rst: Number(r.Item.rst.N) });
    }
    const sv = (TRADE || HEROES) && parse(b.data);
    if (TRADE) try { await logSave(sub, now, sv, b); } catch (e) { console.log('activity log', e.name || e); }
    if (HEROES && sv) try { await putHof(sub, sv); } catch (e) { console.log('hof', e.name); }
    return res(200, { ok: true, updated: now });
  }
  if (method === 'DELETE') {
    await db.send(new D.DeleteItemCommand({ TableName: TABLE, Key }));
    return res(200, { ok: true });
  }
  return res(405, { error: 'method not allowed' });
};
