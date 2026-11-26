// Gulp the Hoard Mimic (v125, John 25 Nov 2026: a global NPC that NP+ heroes feed gold, with a fed counter; feeding
// raises an extremely rare chance that the Golden Loot Goblin bursts out). NP+ heroes only (hero row np >= 1).
// Rows in the boss table: w='gulp' s='#' the counter { fed, m, cyc, last, stir, gid, gu, prev }; w='gulpc#<cyc>' s=<pid>
// feeders this cycle { m, w, nm, c }; w='gulpd#<day>' s=<pid> morsels today { n }; w='gob#<gid>' s='#' { total, hp, cy, gu }.
// Each morsel up to DAY a day rolls p = min(2%, B + K x morsels since the last goblin); B = K = 2.5e-6 (John, 26 Nov
// 2026: rarer, ~800 morsels a goblin, about 16-22 days with 3-4 heroes feeding 12 a day). A hit "stirs" Gulp (at most
// one goblin per GAP); the goblin bursts out when an NP+ hero is online (seen in the last 3 minutes), within STIR.
// It lasts LIFE with health HPX maxed assaults per NP+ hero online. The fight and loot are in goblin.js.
const D = require('@aws-sdk/client-dynamodb'), crypto = require('crypto');
const db = new D.DynamoDBClient({}), { BOSS: T, HEROES: H } = process.env;
const res = (c, b) => ({ statusCode: c, body: JSON.stringify(b) }), S = v => ({ S: String(v) }), N = v => ({ N: String(v) });
const pidOf = s => crypto.createHash('sha256').update('lh:' + s).digest('hex').slice(0, 16);
const DAY = 12, B = 2.5e-6, K = 2.5e-6, CAPP = .02, GAP = 72 * 36e5, STIR = 48 * 36e5, LIFE = 30 * 6e4, HPX = 2.5, CEIL = 150;
const M = Math.max, mn = Math.min, fh = f => 10 * (1.22 ** (f - 1) * 1.03 ** M(0, f - 60) * 1.04 ** M(0, f - 140)) ** .4 * 1.0108 ** (M(0, f - 15) + M(0, f - 40));
const n = (i, k) => i && i[k] ? +i[k].N : 0;
const get = async (w, s) => (await db.send(new D.GetItemCommand({ TableName: T, Key: { w: S(w), s: S(s) } }))).Item;
const upd = (w, s, e, v, c, nm) => db.send(new D.UpdateItemCommand({ TableName: T, Key: { w: S(w), s: S(s) }, UpdateExpression: e, ExpressionAttributeValues: v, ConditionExpression: c, ExpressionAttributeNames: nm, ReturnValues: 'ALL_NEW' }));
const tryU = async (...a) => { try { return (await upd(...a)).Attributes; } catch (x) { if (x.name === 'ConditionalCheckFailedException') return null; throw x; } };
// Settles a goblin whose time is up, then spawns a stirred one if an NP+ hero is online.
async function tick(g, now) {
  if (g.gid && now >= n(g, 'gu')) {
    const e = await get('gob#' + g.gid.S, '#'), k = n(e, 'total') >= n(e, 'hp');
    g = await tryU('gulp', '#', 'SET prev=:i, cyc=:c, fed=:f, m=:m, #l=:t REMOVE gid', { ':i': g.gid, ':c': N(n(g, 'cyc') + 1), ':f': N(k ? 0 : Math.floor(n(g, 'fed') / 2)), ':m': N(k ? 0 : Math.floor(n(g, 'm') / 2)), ':t': N(now) }, 'gid=:i', { '#l': 'last' }) || (await get('gulp', '#'));
  }
  if (g.stir && !g.gid) {
    if (now - n(g, 'stir') > STIR) return (await tryU('gulp', '#', 'REMOVE stir', undefined, 'attribute_exists(stir)')) || g;
    const on = ((await db.send(new D.ScanCommand({ TableName: H }))).Items || []).filter(h => n(h, 'np') >= 1 && now - n(h, 'seen') < 18e4 && !h.ban);
    if (!on.length) return g;
    const id = now.toString(36), hp = HPX * on.reduce((a, h) => a + CEIL * fh(mn(1500, n(h, 'fl') + 10)), 0);
    const g2 = await tryU('gulp', '#', 'SET gid=:i, gu=:u REMOVE stir', { ':i': S(id), ':u': N(now + LIFE) }, 'attribute_not_exists(gid) AND attribute_exists(stir)');
    if (!g2) return get('gulp', '#');
    await upd('gob#' + id, '#', 'SET hp=:h, cy=:c, gu=:u, n=:n ADD #t :z', { ':h': N(hp), ':c': N(n(g2, 'cyc')), ':u': N(now + LIFE), ':n': N(on.length), ':z': N(0) }, undefined, { '#t': 'total' });
    return g2;
  }
  return g;
}
exports.handler = async (e) => {
  const cl = e.requestContext.authorizer && e.requestContext.authorizer.jwt && e.requestContext.authorizer.jwt.claims;
  if (!cl || !cl.sub) return res(401, { error: 1 });
  const me = pidOf(cl.sub), now = Date.now(), h = (await db.send(new D.GetItemCommand({ TableName: H, Key: { pid: S(me) } }))).Item;
  if (!h || !h.name || h.ban || n(h, 'np') < 1) return res(403, { error: 'np' });
  let b = {}; try { b = JSON.parse(e.isBase64Encoded ? Buffer.from(e.body || '', 'base64').toString() : e.body || '{}'); } catch (x) { return res(400, { error: 1 }); }
  let g = (await get('gulp', '#')) || {}, roll = 0;
  const day = 'gulpd#' + new Date(now).toISOString().slice(0, 10);
  if (e.routeKey === 'POST /gulp/feed') {
    const k = Math.floor(+b.n), gold = M(0, mn(1e300, +b.g || 0));
    if (!(k >= 1 && k <= 50)) return res(400, { error: 1 });
    // Hotfix 26 Nov 2026 (Kyvia): the feeder row wrote its weight to 'w', the table's key, so every feed failed after
    // the counters had moved (gold was never taken). Weight is now 'wt', the feeder row is written first, and a hero
    // can feed at most DAY morsels a day (the cap is checked before anything is written).
    const d = await tryU(day, me, 'ADD n :k', { ':k': N(k), ':c': N(DAY - k) }, 'attribute_not_exists(n) OR n <= :c');
    if (!d) return res(409, { error: 'day' });
    try { await upd('gulpc#' + n(g, 'cyc'), me, 'SET nm=:n, c=:c ADD m :k, wt :w', { ':n': h.name, ':c': h.cls || S(''), ':k': N(k), ':w': N(k * (b.t ? 1.5 : 1)) }); }
    catch (x) { await upd(day, me, 'ADD n :k', { ':k': N(-k) }); throw x; }
    g = (await upd('gulp', '#', 'ADD fed :g, m :k', { ':g': N(gold), ':k': N(k) })).Attributes;
    const m0 = n(g, 'm') - k;
    for (let i = 0; i < k; i++) if (crypto.randomInt(1e9) / 1e9 < mn(CAPP, B + K * (m0 + i))) roll = 1;
    if (roll && !g.gid && !g.stir && now - n(g, 'last') >= GAP) g = (await tryU('gulp', '#', 'SET stir=:t', { ':t': N(now) }, 'attribute_not_exists(stir) AND attribute_not_exists(gid)')) || g;
  } else if (e.routeKey !== 'GET /gulp') return res(404, { error: 1 });
  g = await tick(g, now);
  const cyc = n(g, 'cyc'), feeders = (await db.send(new D.QueryCommand({ TableName: T, KeyConditionExpression: 'w=:w', ExpressionAttributeValues: { ':w': S('gulpc#' + cyc) } }))).Items || [];
  const mine = feeders.find(i => i.s.S === me), td = await get(day, me);
  let gob = null, prev = null;
  if (g.gid) { const id = g.gid.S, ev = await get('gob#' + id, '#'), my = await get('gob#' + id, me); gob = { id, until: n(g, 'gu'), hp: n(ev, 'hp'), total: n(ev, 'total'), me: { last: n(my, 'last'), score: n(my, 'score') } }; }
  if (g.prev) { const id = g.prev.S, ev = await get('gob#' + id, '#'), my = await get('gob#' + id, me); prev = { id, killed: n(ev, 'total') >= n(ev, 'hp'), me: { score: n(my, 'score'), cl: !!(my && my.cl) } }; }
  return res(200, { ok: true, fed: n(g, 'fed'), m: n(g, 'm'), stir: !!g.stir, gob, prev, mine: { m: n(mine, 'm'), w: n(mine, 'wt'), today: n(td, 'n') },
    top: feeders.sort((x, y) => n(y, 'm') - n(x, 'm')).slice(0, 10).map(i => ({ name: i.nm.S, cls: i.c.S, m: n(i, 'm') })) });
};
