// World boss weekends: one huge Rift boss every player fights together, Friday 00:00 to Monday 00:00 UTC
// (plus a first preview event). Players send 2-minute assaults; scores count "monsters' worth" of damage at
// their own depth, so new and veteran delvers both matter. After the event each player claims Sigils once:
// 3 for taking part, +1 per phase the server broke (up to 5), +5 for the top three.
// v120 (John, 25 Nov 2026): after the preview, scores are real damage. Phase 1 needs HR, each phase doubles, and one
// assault counts at most CEIL monsters' worth of the hero's deepest floor + 10 (fh = the game's foeHp).
const D = require('@aws-sdk/client-dynamodb');
const crypto = require('crypto');
const db = new D.DynamoDBClient({}), { BOSS: T, HEROES: H, WALLETS: W } = process.env;
const res = (c, b) => ({ statusCode: c, body: JSON.stringify(b) }), CF = 'ConditionalCheckFailedException';
const S = v => ({ S: String(v) }), N = v => ({ N: String(v) });
const pidOf = sub => crypto.createHash('sha256').update('lh:' + sub).digest('hex').slice(0, 16);
const DAY = 864e5, P = Date.parse('2026-11-23T00:00:00Z'), PE = Date.parse('2026-11-27T00:00:00Z');
const CAP = 400, COOL = 15 * 6e4, HP1 = 1000, HR = 1e9, CEIL = 150, old = id => id === '2026-11-23';
const M = Math.max, mn = Math.min, fh = f => 10 * (1.22 ** (f - 1) * 1.03 ** M(0, f - 60) * 1.04 ** M(0, f - 140)) ** .4 * 1.0108 ** (M(0, f - 15) + M(0, f - 40));
// The event window that contains (or most recently started before) time t.
function win(t) {
  if (t >= P && t < PE) return { id: '2026-11-23', start: P, end: PE };
  const d = new Date(t), mid = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()), fri = mid - ((d.getUTCDay() + 2) % 7) * DAY;
  return { id: new Date(fri).toISOString().slice(0, 10), start: fri, end: fri + 3 * DAY };
}
// Phases broken: phase k needs HP1 * 2^(k-1) more.
const phases = (t, id) => { let k = 0, need = old(id) ? HP1 : HR; while (t >= need && k < 30) { t -= need; need *= 2; k++; } return k; };
const all = async id => (await db.send(new D.QueryCommand({ TableName: T, KeyConditionExpression: 'w=:w', ExpressionAttributeValues: { ':w': S(id) } }))).Items || [];
// The event's total row (g) and its players, best score first (ps).
const ranks = async id => { const rows = await all(id); return { g: rows.find(i => i.s.S === '#'), ps: rows.filter(i => i.s.S !== '#').sort((x, y) => y.score.N - x.score.N) }; };
const row = async (id, s) => (await db.send(new D.GetItemCommand({ TableName: T, Key: { w: S(id), s: S(s) } }))).Item;
const mine = i => i ? { score: +i.score.N, last: +(i.last || N(0)).N, cl: !!i.cl } : { score: 0, last: 0, cl: false };
exports.handler = async (e) => {
  const cl = e.requestContext.authorizer && e.requestContext.authorizer.jwt && e.requestContext.authorizer.jwt.claims;
  if (!cl || !cl.sub) return res(401, { error: 1 });
  const me = pidOf(cl.sub), now = Date.now(), w = win(now), live = now < w.end, pw = win(w.start - 1);
  let b = {}; try { b = JSON.parse(e.isBase64Encoded ? Buffer.from(e.body || '', 'base64').toString() : e.body || '{}'); } catch (x) { return res(400, { error: 1 }); }
  if (e.routeKey === 'GET /boss') {
    const { g, ps } = await ranks(w.id);
    const pr = await row(pw.id, me);
    return res(200, { w: { ...w, live, next: live ? 0 : (now < P ? P : w.start + 7 * DAY) }, total: g ? +g.total.N : 0, n: ps.length,
      top: ps.slice(0, 10).map(i => ({ name: i.nm.S, cls: i.c.S, score: +i.score.N })),
      me: mine(ps.find(i => i.s.S === me)), prev: { id: pw.id, ...mine(pr) } });
  }
  if (e.routeKey === 'POST /boss/hit') {
    if (!live) return res(409, { error: 'closed' });
    const h = (await db.send(new D.GetItemCommand({ TableName: H, Key: { pid: S(me) } }))).Item;
    if (!h || !h.name || h.ban) return res(403, { error: 'hero' });
    const o = old(w.id), x = +b.score || 0;
    let sc = M(0, mn(o ? CAP : CEIL * fh(mn(1500, (h.fl ? +h.fl.N : 1) + 10)), o ? Math.round(x * 10) / 10 : Math.floor(x)));
    // The Nexus check, server side: strike gaps (ms) that are too fast or machine-even lose the strikes' share.
    const iv = [].concat(b.iv || []).slice(0, 3e3).map(Number).filter(x => x < 1e3), n = iv.length, m = iv.reduce((a, x) => a + x, 0) / n;
    if (n > 99 && (m < 60 || iv.reduce((a, x) => a + (x - m) ** 2, 0) / n * 625 < m * m)) sc = M(0, sc - (+b.ck || 0));
    try {
      await db.send(new D.UpdateItemCommand({ TableName: T, Key: { w: S(w.id), s: S(me) }, UpdateExpression: 'SET #l=:t,nm=:n,c=:c ADD score :s',
        ConditionExpression: 'attribute_not_exists(#l) OR #l<:cut', ExpressionAttributeNames: { '#l': 'last' },
        ExpressionAttributeValues: { ':t': N(now), ':n': h.name, ':c': h.cls, ':s': N(sc), ':cut': N(now - COOL + 5000) } }));
    } catch (x) { if (x.name === CF) return res(429, { error: 'cool' }); throw x; }
    const g = await db.send(new D.UpdateItemCommand({ TableName: T, Key: { w: S(w.id), s: S('#') }, UpdateExpression: 'ADD #t :s', ExpressionAttributeNames: { '#t': 'total' }, ExpressionAttributeValues: { ':s': N(sc) }, ReturnValues: 'ALL_NEW' }));
    return res(200, { ok: true, add: sc, total: +g.Attributes.total.N });
  }
  if (e.routeKey === 'POST /boss/claim') {
    const id = String(b.id || ''), cw = [w, pw].find(x => x.id === id);
    if (!cw || now < cw.end) return res(409, { error: 'open' });
    const { g, ps } = await ranks(id);
    const rank = ps.findIndex(i => i.s.S === me) + 1, my = ps[rank - 1];
    if (!rank || !(+my.score.N > 0)) return res(404, { error: 'none' });
    const ph = phases(g ? +g.total.N : 0, id), sig = 3 + mn(5, ph) + (rank <= 3 ? 5 : 0);
    try {
      await db.send(new D.UpdateItemCommand({ TableName: T, Key: { w: S(id), s: S(me) }, UpdateExpression: 'SET cl=:t', ConditionExpression: 'attribute_not_exists(cl)', ExpressionAttributeValues: { ':t': N(now) } }));
    } catch (x) { if (x.name === CF) return res(409, { error: 'claimed' }); throw x; }
    const r = await db.send(new D.UpdateItemCommand({ TableName: W, Key: { userId: S(cl.sub) }, UpdateExpression: 'SET bal=if_not_exists(bal,:g)+:a', ExpressionAttributeValues: { ':g': N(100), ':a': N(sig) }, ReturnValues: 'UPDATED_NEW' }));
    return res(200, { ok: true, sig, bal: +r.Attributes.bal.N, rank, n: ps.length, phases: ph, score: +my.score.N });
  }
  return res(404, { error: 1 });
};
