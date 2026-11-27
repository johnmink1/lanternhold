// Party invites. Recruiting a player's hero sends them an invite; they accept or decline it in their own game.
// On the hero row: req = leaders asking for me, sent = heroes I invited, acc / dec = answers waiting for me to read.
// Accepting does what the old instant recruit did: gold for the owner (recruits), party chat ties (pin / inv).
const D = require('@aws-sdk/client-dynamodb');
const crypto = require('crypto');
const db = new D.DynamoDBClient({}), T = process.env.TABLE;
const res = (c, b) => ({ statusCode: c, headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });
const pidOf = sub => crypto.createHash('sha256').update('lh:' + sub).digest('hex').slice(0, 16);
const SS = a => ({ SS: a }), K = p => ({ pid: { S: p } });
// 'dec' is a DynamoDB reserved word, so expressions name it #d (hotfix #49, kept in v132).
const up = (p, x, v, c) => db.send(new D.UpdateItemCommand(Object.assign({ TableName: T, Key: K(p), UpdateExpression: x, ExpressionAttributeValues: v }, /#d/.test(x) ? { ExpressionAttributeNames: { '#d': 'dec' } } : {}, c ? { ConditionExpression: c } : {})));
const set = i => (i && i.SS) || [];
async function heroes(ids) {
  if (!ids.length) return {};
  const r = await db.send(new D.BatchGetItemCommand({ RequestItems: { [T]: { Keys: ids.slice(0, 50).map(K), ProjectionExpression: 'pid, #n, cls, lv, sd, pf, wl, wv, seen', ExpressionAttributeNames: { '#n': 'name' } } } }));
  const o = {};
  for (const i of r.Responses[T] || []) if (i.name) { const pf = i.pf ? JSON.parse(i.pf.S) : null, hid = pf && Array.isArray(pf.h) ? pf.h : []; if (pf) { if (hid.includes('b')) pf.b = ''; if (hid.includes('e')) pf.e = []; delete pf.h; } o[i.pid.S] = { id: i.pid.S, name: i.name.S, cls: i.cls.S, level: +i.lv.N, side: i.sd ? i.sd.S : 'unsworn', on: !hid.includes('on') && Date.now() - +(i.seen || { N: 0 }).N < 18e4, pf, w: i.wv && i.wv.N === '1' && !hid.includes('w') ? i.wl.S : '' }; }
  return o;
}
exports.handler = async (e) => {
  const cl = e.requestContext.authorizer && e.requestContext.authorizer.jwt && e.requestContext.authorizer.jwt.claims;
  if (!cl || !cl.sub) return res(401, { error: 1 });
  // v142 Hardcore (?hc=1): the Hardcore hero is its own row, and invites only go to heroes of the same mode.
  const hc = (e.queryStringParameters || {}).hc === '1', me = pidOf(hc ? cl.sub + '#hc' : cl.sub);
  if (e.routeKey === 'GET /invites') {
    const r = (await db.send(new D.GetItemCommand({ TableName: T, Key: K(me), ProjectionExpression: 'req, sent, acc, #d, noinv', ExpressionAttributeNames: { '#d': 'dec' } }))).Item || {};
    const req = set(r.req), acc = set(r.acc), dec = set(r.dec), h = await heroes([...new Set([...req, ...acc, ...dec])]);
    // Answers are read once: take away exactly what we are about to report.
    if (acc.length || dec.length) {
      const x = [], v = {};
      if (acc.length) { x.push('acc :a'); v[':a'] = SS(acc); }
      if (dec.length) { x.push('#d :d'); v[':d'] = SS(dec); }
      await up(me, 'DELETE ' + x.join(', '), v);
    }
    return res(200, { asks: req.map(p => h[p]).filter(Boolean), acc: acc.map(p => h[p]).filter(Boolean), dec: dec.map(p => (h[p] || { id: p, name: 'A player' })), sent: set(r.sent), solo: r.noinv ? 1 : 0 });
  }
  if (e.routeKey !== 'POST /invite') return res(404, { error: 1 });
  let b = {}; try { b = JSON.parse(e.isBase64Encoded ? Buffer.from(e.body || '', 'base64').toString() : e.body || '{}'); } catch (x) { return res(400, { error: 1 }); }
  // v140 (John 27 Nov): players can turn party invites off to play solo with NPCs. noinv on the hero row blocks new
  // invites; turning it on declines the ones waiting.
  if (b.act === 'solo') {
    if (!b.on) { await db.send(new D.UpdateItemCommand({ TableName: T, Key: K(me), UpdateExpression: 'REMOVE noinv' })); return res(200, { ok: true, solo: 0 }); }
    const r = (await db.send(new D.GetItemCommand({ TableName: T, Key: K(me), ProjectionExpression: 'req' }))).Item || {}, req = set(r.req);
    await up(me, 'SET noinv = :t' + (req.length ? ' DELETE req :r' : ''), Object.assign({ ':t': { N: String(Date.now()) } }, req.length ? { ':r': SS(req) } : {}), 'attribute_exists(cls)');
    for (const p of req) { try { await up(p, 'DELETE sent :m ADD #d :m', { ':m': SS([me]) }); } catch (x) {} }
    return res(200, { ok: true, solo: 1 });
  }
  const id = String(b.id || ''), a = b.act, mine = SS([me]), them = SS([id]);
  if (!/^[0-9a-f]{16}$/.test(id) || id === me) return res(400, { error: 'hero' });
  try {
    if (a === 'ask') {
      const t = (await db.send(new D.GetItemCommand({ TableName: T, Key: K(id), ProjectionExpression: 'noinv, hc' }))).Item;
      if (t && t.noinv) return res(409, { error: 'solo' });
      if (!!(t && t.hc) !== hc) return res(403, { error: 'hc' });
      await up(id, 'ADD req :m', { ':m': mine }, 'attribute_exists(cls) AND attribute_not_exists(ban) AND attribute_not_exists(noinv)');
      await up(me, 'ADD sent :i', { ':i': them });
    } else if (a === 'cancel') {
      await up(id, 'DELETE req :m', { ':m': mine });
      await up(me, 'DELETE sent :i', { ':i': them });
    } else if (a === 'yes' || a === 'no') {
      // Only an invite that is really waiting can be answered.
      const y = a === 'yes';
      await up(me, 'DELETE req :i' + (y ? ' ADD recruits :one, pin :i' : ''), Object.assign({ ':i': them, ':s': { S: id } }, y ? { ':one': { N: '1' } } : {}), 'contains(req, :s)');
      await up(id, 'DELETE sent :m ADD ' + (y ? 'inv :m, acc :m' : '#d :m'), { ':m': mine });
    } else return res(400, { error: 'act' });
  } catch (x) { if (x.name === 'ConditionalCheckFailedException') return res(404, { error: 'gone' }); throw x; }
  return res(200, { ok: true });
};
