// Support tasks (v132, John 26 Nov 2026): one-time Sigil thanks for joining the Discord or following Born 2 Game on itch.io.
// No Sigils for ratings, reviews or comments (itch.io unlists pages that game them). A player sends their Discord or itch name,
// an admin checks it by hand and approves or denies; Sigils land only on approval. Once per task per account, and a name can
// back only one account. Rows in the trade table: sup#<sub>/<task> (claim), supq/<task>#<sub> (open queue), supn/<task>#<name> (name lock).
// GET /support (own claims), POST /support/claim { task, name }, GET /admin/support (queue), POST /admin/support { task, uid, ok }.
const D = require('@aws-sdk/client-dynamodb'), crypto = require('crypto');
const db = new D.DynamoDBClient({}), { WALLETS: W, HEROES: H, TRADE: T } = process.env;
const res = (c, b) => ({ statusCode: c, body: JSON.stringify(b) });
const S = v => ({ S: String(v) }), N = v => ({ N: String(v) }), send = c => db.send(c);
const TASKS = { discord: { sig: 10, re: /^[a-z0-9_.]{2,32}$/ }, itch: { sig: 5, re: /^[a-z0-9_-]{2,40}$/ } };
const EXP = 14 * 864e5, MINFL = 10;
const pidOf = s => crypto.createHash('sha256').update('lh:' + s).digest('hex').slice(0, 16);
const mine = async sub => {
  const r = await send(new D.QueryCommand({ TableName: T, KeyConditionExpression: 'pk = :p', ExpressionAttributeValues: { ':p': S('sup#' + sub) }, ConsistentRead: true }));
  const out = {}, now = Date.now();
  for (const i of r.Items || []) { const st = i.st.S, at = +i.at.N; out[i.sk.S] = { st: st === 'pend' && now - at > EXP ? 'exp' : st, name: i.nm.S, at }; }
  return out;
};
exports.handler = async (e) => {
  const rk = e.routeKey, cl = e.requestContext.authorizer && e.requestContext.authorizer.jwt && e.requestContext.authorizer.jwt.claims;
  if (!cl || !cl.sub) return res(401, { error: 1 });
  let b = {}; try { b = JSON.parse(e.isBase64Encoded ? Buffer.from(e.body || '', 'base64').toString() : e.body || '{}'); } catch (x) { return res(400, { error: 1 }); }
  const sub = cl.sub, now = Date.now();
  if (rk === 'GET /support') return res(200, { tasks: Object.fromEntries(Object.entries(TASKS).map(([k, t]) => [k, t.sig])), mine: await mine(sub) });
  if (rk === 'POST /support/claim') {
    const t = TASKS[b.task], nm = String(b.name || '').trim().replace(/^@/, '').toLowerCase();
    if (!Object.hasOwn(TASKS, b.task) || !t.re.test(nm)) return res(400, { error: 'name' });
    const h = (await send(new D.GetItemCommand({ TableName: H, Key: { pid: S(pidOf(sub)) } }))).Item;
    if (!h || h.ban) return res(403, { error: 'hero' });
    if (!h.fl || +h.fl.N < MINFL) return res(403, { error: 'floor', need: MINFL });
    const old = (await mine(sub))[b.task];
    if (old && (old.st === 'ok' || old.st === 'pend')) return res(409, { error: old.st === 'ok' ? 'done' : 'pending' });
    const oldRaw = old ? (await send(new D.GetItemCommand({ TableName: T, Key: { pk: S('sup#' + sub), sk: S(b.task) }, ConsistentRead: true }))).Item : null;
    const ops = [
      // the name lock: free, or already ours (a resend after a deny or an expiry)
      { Put: { TableName: T, Item: { pk: S('supn'), sk: S(b.task + '#' + nm), uid: S(sub), at: N(now) }, ConditionExpression: 'attribute_not_exists(pk) OR uid = :u', ExpressionAttributeValues: { ':u': S(sub) } } },
      { Put: { TableName: T, Item: { pk: S('sup#' + sub), sk: S(b.task), st: S('pend'), nm: S(nm), at: N(now) },
        ConditionExpression: oldRaw ? 'st = :s AND #a = :a' : 'attribute_not_exists(pk)', ExpressionAttributeNames: oldRaw ? { '#a': 'at' } : undefined,
        ExpressionAttributeValues: oldRaw ? { ':s': oldRaw.st, ':a': oldRaw.at } : undefined } },
      { Put: { TableName: T, Item: { pk: S('supq'), sk: S(b.task + '#' + sub), nm: S(nm), at: N(now), pid: h.pid, hn: h.name || S('') } } },
    ];
    try { await send(new D.TransactWriteItemsCommand({ TransactItems: ops })); }
    catch (x) {
      if (x.name !== 'TransactionCanceledException') throw x;
      return res(409, { error: x.CancellationReasons && x.CancellationReasons[0].Code === 'ConditionalCheckFailed' ? 'taken' : 'state' });
    }
    // a resend under a new name lets go of the old name, if it is still ours (a denied name was already freed)
    if (oldRaw && oldRaw.nm.S !== nm) {
      try { await send(new D.DeleteItemCommand({ TableName: T, Key: { pk: S('supn'), sk: S(b.task + '#' + oldRaw.nm.S) }, ConditionExpression: 'uid = :u', ExpressionAttributeValues: { ':u': S(sub) } })); }
      catch (x) { if (x.name !== 'ConditionalCheckFailedException') throw x; }
    }
    return res(200, { ok: true, mine: await mine(sub) });
  }
  if (!String(cl['cognito:groups'] || '').includes('admins')) return res(403, { error: 'admin only' });
  if (rk === 'GET /admin/support') {
    const r = await send(new D.QueryCommand({ TableName: T, KeyConditionExpression: 'pk = :p', ExpressionAttributeValues: { ':p': S('supq') } }));
    const list = (r.Items || []).map(i => { const [task, uid] = i.sk.S.split('#'); return { task, uid, name: i.nm.S, at: +i.at.N, pid: i.pid.S, hero: i.hn.S, sig: TASKS[task] ? TASKS[task].sig : 0, exp: now - +i.at.N > EXP }; });
    return res(200, { list: list.sort((a, c) => a.at - c.at) });
  }
  if (rk === 'POST /admin/support') {
    const t = TASKS[b.task], uid = String(b.uid || '');
    if (!Object.hasOwn(TASKS, b.task) || !/^[0-9a-f-]{36}$/.test(uid)) return res(400, { error: 1 });
    const c = (await send(new D.GetItemCommand({ TableName: T, Key: { pk: S('sup#' + uid), sk: S(b.task) }, ConsistentRead: true }))).Item;
    if (!c || c.st.S !== 'pend') {
      await send(new D.DeleteItemCommand({ TableName: T, Key: { pk: S('supq'), sk: S(b.task + '#' + uid) } }));
      return res(409, { error: 'state' });
    }
    const ok = !!b.ok, ops = [
      { Update: { TableName: T, Key: { pk: S('sup#' + uid), sk: S(b.task) }, UpdateExpression: 'SET st = :n, #b = :b, dt = :d', ConditionExpression: 'st = :p', ExpressionAttributeNames: { '#b': 'by' },
        ExpressionAttributeValues: { ':n': S(ok ? 'ok' : 'no'), ':p': S('pend'), ':b': S(cl.sub), ':d': N(now) } } },
      { Delete: { TableName: T, Key: { pk: S('supq'), sk: S(b.task + '#' + uid) } } },
    ];
    if (ok) ops.push({ Update: { TableName: W, Key: { userId: S(uid) }, UpdateExpression: 'SET bal = if_not_exists(bal, :g) + :a, own = if_not_exists(own, :o)',
      ExpressionAttributeValues: { ':g': N(100), ':a': N(t.sig), ':o': { SS: ['f.plain'] } } } });
    // a denied name is freed so its real owner can claim it
    else ops.push({ Delete: { TableName: T, Key: { pk: S('supn'), sk: S(b.task + '#' + c.nm.S) } } });
    try { await send(new D.TransactWriteItemsCommand({ TransactItems: ops })); }
    catch (x) { if (x.name === 'TransactionCanceledException') return res(409, { error: 'state' }); throw x; }
    return res(200, { ok: true, add: ok ? t.sig : 0 });
  }
  return res(404, { error: 1 });
};
