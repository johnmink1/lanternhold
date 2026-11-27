// Lanternhold admin: player list and bans (the server wipe and player reset live in reset.js). Only members of the Cognito "admins" group get in.
// GET /epoch is public: clients compare it with their save and start over after a wipe.
const D = require('@aws-sdk/client-dynamodb');
const zlib = require('zlib'), crypto = require('crypto'), SC = require('./savecheck');
const C = require('@aws-sdk/client-cognito-identity-provider');
const db = new D.DynamoDBClient({}), idp = new C.CognitoIdentityProviderClient({});
const { SAVES, HEROES, TRADE, POOL } = process.env;
const res = (c, b) => ({ statusCode: c, headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });
const S = v => ({ S: String(v) });
async function getEpoch() {
  const r = await db.send(new D.GetItemCommand({ TableName: SAVES, Key: { userId: S('#epoch') } }));
  return r.Item ? Number(r.Item.updated.N) : 0;
}
async function scanAll(T, keep) {
  const out = []; let k;
  do {
    const r = await db.send(new D.ScanCommand({ TableName: T, ExclusiveStartKey: k }));
    for (const i of r.Items || []) if (!keep || !keep(i)) out.push(i);
    k = r.LastEvaluatedKey;
  } while (k);
  return out;
}
exports.handler = async (e) => {
  const rk = e.routeKey;
  if (rk === 'GET /epoch') return res(200, { epoch: await getEpoch() });
  if (rk === 'GET /leaderboard') {
    const all = await scanAll(HEROES), online = all.filter(i => i.name && !i.ban && i.seen && Date.now() - i.seen.N < 18e4).length;
    // v142 Hardcore (John 27 Nov 2026): ?hc=1 ranks only Hardcore heroes (row flag hc), the plain board only Normal ones.
    const hcb = (e.queryStringParameters || {}).hc === '1';
    const hxOf = i => { try { return i.hx ? JSON.parse(i.hx.S) : {}; } catch (x) { return {}; } };
    const top = all.filter(i => i.name && i.fl && !i.ban && !!(i.hc && i.hc.N === '1') === hcb)
      .map(i => Object.assign({ name: i.name.S, cls: i.cls.S, level: +i.lv.N, floor: +i.fl.N, side: i.sd ? i.sd.S : 'unsworn' }, hcb ? { hx: hxOf(i) } : {}))
      .sort((a, c) => c.floor - a.floor || c.level - a.level).slice(0, 50);
    // The Lantern Keeper (John, 2026-11-24): a member of the Cognito "admins" group with a hero seen in the last 3 minutes
    // switches on a +25% buff for every player. Only the group decides it, never a hero name.
    let keeper = null;
    try {
      const ad = new Set(((await idp.send(new C.ListUsersInGroupCommand({ UserPoolId: POOL, GroupName: 'admins' }))).Users || []).map(u => u.Username));
      const k = all.find(i => i.u && ad.has(i.u.S) && i.name && !i.ban && i.seen && Date.now() - i.seen.N < 18e4);
      if (k) keeper = k.name.S;
    } catch (x) {}
    return { statusCode: 200, headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=60' }, body: JSON.stringify({ top, online, keeper }) };
  }
  const cl = e.requestContext.authorizer && e.requestContext.authorizer.jwt && e.requestContext.authorizer.jwt.claims;
  if (!cl || !String(cl['cognito:groups'] || '').includes('admins')) return res(403, { error: 'admin only' });
  let b = {};
  if (e.body) { try { b = JSON.parse(e.isBase64Encoded ? Buffer.from(e.body, 'base64').toString() : e.body); } catch (x) { return res(400, { error: 'bad json' }); } }
  if (rk === 'GET /admin/players') {
    const now = Date.now();
    const list = (await scanAll(HEROES)).map(i => ({
      id: i.pid.S, name: i.name ? i.name.S : (i.bn ? i.bn.S : ''), cls: i.cls ? i.cls.S : '', level: i.lv ? +i.lv.N : 0, floor: i.fl ? +i.fl.N : 0,
      seen: i.seen ? +i.seen.N : 0, on: i.seen ? now - i.seen.N < 18e4 : false, banned: !!i.ban, canBan: !!i.u, ref: i.rf ? i.rf.S : '',
    })).sort((a, c) => c.seen - a.seen);
    return res(200, { players: list, epoch: await getEpoch() });
  }
  // Player activity log (v125): the rows save.js writes on every cloud sync, newest first, 200 a page (?before=<sk>).
  if (rk === 'GET /admin/log') {
    const q = e.queryStringParameters || {}, id = String(q.id), bf = q.before, v = { ':p': S('alog#' + id) };
    if (!/^[0-9a-f]{16}$/.test(id)) return res(400, { error: 'id' });
    if (bf) v[':b'] = S(bf);
    const r = await db.send(new D.QueryCommand({ TableName: TRADE, KeyConditionExpression: 'pk = :p' + (bf ? ' AND sk < :b' : ''), ExpressionAttributeValues: v, ScanIndexForward: false, Limit: 200 }));
    // s and a are JSON strings; the game parses them
    return res(200, { rows: (r.Items || []).map(i => ({ sk: i.sk.S, at: +i.at.N, s: i.s.S, a: i.a && i.a.S, dv: i.dv && i.dv.S })), more: r.LastEvaluatedKey && r.LastEvaluatedKey.sk.S });
  }
  if (rk === 'POST /admin/ban' || rk === 'POST /admin/unban') {
    const id = String(b.id || '');
    if (!/^[0-9a-f]{16}$/.test(id)) return res(400, { error: 'id' });
    const r = await db.send(new D.GetItemCommand({ TableName: HEROES, Key: { pid: S(id) } }));
    if (!r.Item || !r.Item.u) return res(404, { error: 'player' });
    const user = r.Item.u.S;
    if (user === cl.sub) return res(400, { error: 'self' });
    if (rk === 'POST /admin/unban') {
      await idp.send(new C.AdminEnableUserCommand({ UserPoolId: POOL, Username: user }));
      await db.send(new D.UpdateItemCommand({ TableName: HEROES, Key: { pid: S(id) }, UpdateExpression: 'REMOVE ban' }));
      return res(200, { ok: true });
    }
    await idp.send(new C.AdminDisableUserCommand({ UserPoolId: POOL, Username: user }));
    await idp.send(new C.AdminUserGlobalSignOutCommand({ UserPoolId: POOL, Username: user }));
    // keep a small ban marker: hidden from the guild board, and the hero cannot be registered again
    const name = r.Item.name ? r.Item.name.S : (r.Item.bn ? r.Item.bn.S : '');
    await db.send(new D.PutItemCommand({ TableName: HEROES, Item: { pid: S(id), u: S(user), bn: S(name), ban: { N: String(Date.now()) } } }));
    // take down their market listings
    let k, n = 0;
    do {
      const q = await db.send(new D.QueryCommand({ TableName: TRADE, KeyConditionExpression: 'pk = :p', ExpressionAttributeValues: { ':p': S('sell#' + id) }, ExclusiveStartKey: k }));
      for (const it of q.Items || []) {
        const cls = it.cls ? it.cls.S : '';
        await db.send(new D.DeleteItemCommand({ TableName: TRADE, Key: { pk: it.pk, sk: it.sk } }));
        if (cls) await db.send(new D.DeleteItemCommand({ TableName: TRADE, Key: { pk: S('mkt#' + cls), sk: it.sk } }));
        n++;
      }
      k = q.LastEvaluatedKey;
    } while (k);
    return res(200, { ok: true, listings: n });
  }
  // v140 held saves and snapshots (save.js). GET /admin/held: every player whose last save the check held.
  if (rk === 'GET /admin/held') {
    const r = await db.send(new D.QueryCommand({ TableName: TRADE, KeyConditionExpression: 'pk = :p', ExpressionAttributeValues: { ':p': S('heldidx') } }));
    return res(200, { held: (r.Items || []).map(i => ({ id: i.sk.S, at: +i.at.N, mode: i.mode ? i.mode.S : '', flags: JSON.parse(i.flags.S) })) });
  }
  // GET /admin/saves?id=<pid>: the held save (if any) and the snapshots kept for one player, newest first.
  if (rk === 'GET /admin/saves') {
    const id = String((e.queryStringParameters || {}).id || '');
    if (!/^[0-9a-f]{16}$/.test(id)) return res(400, { error: 'id' });
    const [h, sn] = await Promise.all([
      db.send(new D.GetItemCommand({ TableName: TRADE, Key: { pk: S('held#' + id), sk: S('0') }, ProjectionExpression: 'pk, #a, flags, #r, #m', ExpressionAttributeNames: { '#a': 'at', '#r': 'ref', '#m': 'mode' } })),
      db.send(new D.QueryCommand({ TableName: TRADE, KeyConditionExpression: 'pk = :p', ExpressionAttributeValues: { ':p': S('snap#' + id) }, ProjectionExpression: 'sk, #a, #s', ExpressionAttributeNames: { '#a': 'at', '#s': 'sum' }, ScanIndexForward: false }))]);
    const hi = h.Item;
    return res(200, { held: hi ? { at: +hi.at.N, mode: hi.mode ? hi.mode.S : '', flags: JSON.parse(hi.flags.S), ref: JSON.parse(hi.ref ? hi.ref.S : 'null') } : null,
      snaps: (sn.Items || []).map(i => ({ sk: i.sk.S, at: +i.at.N, sum: JSON.parse(i.sum.S) })) });
  }
  // POST /admin/restore { id, from: 'held' | <snapshot sk> }: puts that copy back as the player's account save and makes
  // it the trusted reference. dv is set to 'admin', so the player's open game pauses with "Play here" and loads it.
  // POST /admin/held/drop { id }: forgets a held save (the trusted save stays).
  if (rk === 'POST /admin/restore' || rk === 'POST /admin/held/drop') {
    const id = String(b.id || ''), from = String(b.from || 'held');
    if (!/^[0-9a-f]{16}$/.test(id) || !/^(held|\d{4}-\d\d-\d\d|b[\dT:-]{19})$/.test(from)) return res(400, { error: 'id' });
    const hr = (await db.send(new D.GetItemCommand({ TableName: HEROES, Key: { pid: S(id) } }))).Item;
    if (!hr || !hr.u) return res(404, { error: 'player' });
    const sub = hr.u.S, now = Date.now(), dropHeld = () => Promise.all([
      db.send(new D.DeleteItemCommand({ TableName: TRADE, Key: { pk: S('held#' + id), sk: S('0') } })),
      db.send(new D.DeleteItemCommand({ TableName: TRADE, Key: { pk: S('heldidx'), sk: S(id) } }))]);
    const audit = act => db.send(new D.PutItemCommand({ TableName: TRADE, Item: { pk: S('audit#'), sk: S(now.toString(36) + crypto.randomBytes(3).toString('hex')), at: { N: String(now) }, by: S(cl.email || cl.sub), act: S(act), pid: S(id), name: S(hr.name ? hr.name.S : ''), ttl: { N: String(Math.floor(now / 1000) + 365 * 86400) } } }));
    if (rk === 'POST /admin/held/drop') { await dropHeld(); await audit('held-drop'); return res(200, { ok: true }); }
    const src = (await db.send(new D.GetItemCommand({ TableName: TRADE, Key: from === 'held' ? { pk: S('held#' + id), sk: S('0') } : { pk: S('snap#' + id), sk: S(from) } }))).Item;
    if (!src || !src.data) return res(404, { error: 'copy' });
    const data = src.data.S;
    let sv = null; try { sv = JSON.parse(data.slice(0, 4) === 'gz1:' ? zlib.gunzipSync(Buffer.from(data.slice(4), 'base64')).toString() : data); } catch (x) { return res(400, { error: 'copy' }); }
    const cur = (await db.send(new D.GetItemCommand({ TableName: SAVES, Key: { userId: S(sub) }, ProjectionExpression: 'ck' }))).Item;
    let ck0 = null; try { ck0 = cur && cur.ck ? JSON.parse(cur.ck.S) : null; } catch (x) {}
    const p = SC.point(sv, now, 'admin'), ck = { pts: ((ck0 && ck0.pts) || []).concat([p]).slice(-72), hw: p, h: (ck0 && ck0.h) || {}, sd: (ck0 && ck0.sd) || '' };
    await db.send(new D.UpdateItemCommand({ TableName: SAVES, Key: { userId: S(sub) }, UpdateExpression: 'SET #d = :d, updated = :u, floor = :f, dv = :v, ck = :k REMOVE crd',
      ExpressionAttributeNames: { '#d': 'data' }, ExpressionAttributeValues: { ':d': S(data), ':u': { N: String(now) }, ':f': { N: String(p.f) }, ':v': S('admin'), ':k': S(JSON.stringify(ck)) } }));
    if (from === 'held') await dropHeld();
    await audit('restore ' + from);
    return res(200, { ok: true, from, gold: p.g, floor: p.f, playTime: p.pt });
  }
  return res(404, { error: 'not found' });
};
