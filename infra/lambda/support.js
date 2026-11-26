// Support tasks (v132, John 26 Nov 2026): one-time Sigil thanks for linking a Discord or itch.io account to the hero, checked and
// paid automatically. Nothing here rewards joining a server, following, collecting, rating, reviewing or commenting: Discord's guidelines
// ban artificially inflating membership and itch.io unlists pages that game its systems, and John said never break a platform's terms.
// The game signs the player in (OAuth implicit grant, identity-only scopes) and sends the access token here once; this Lambda asks
// Discord or itch who the token belongs to, so the client cannot fake it.
//   discord: GET discord.com/api/v10/users/@me (scope identify)   itch: GET api.itch.io/profile (scope profile:me)
// Once per task per account, and a Discord or itch account can pay only one game account. The token is never stored.
// Trade-table rows: sup#<sub>/<task> (st 'ok', ext id, at) and supn/<task>#<ext id> (uid). Routes: GET /support, POST /support/claim { task, token }.
const D = require('@aws-sdk/client-dynamodb'), crypto = require('crypto');
const db = new D.DynamoDBClient({}), { WALLETS: W, HEROES: H, TRADE: T } = process.env;
const res = (c, b) => ({ statusCode: c, body: JSON.stringify(b) });
const S = v => ({ S: String(v) }), N = v => ({ N: String(v) }), send = c => db.send(c);
const MINFL = 10;
const TASKS = { discord: 10, itch: 5 };
const pidOf = s => crypto.createHash('sha256').update('lh:' + s).digest('hex').slice(0, 16);
const get = async (url, tok) => { const r = await fetch(url, { headers: { Authorization: 'Bearer ' + tok }, signal: AbortSignal.timeout(5000) }); return { s: r.status, j: await r.json().catch(() => ({})) }; };
// Returns the outside account id, or an error code for the player.
async function check(task, tok) {
  const r = await get(task === 'discord' ? 'https://discord.com/api/v10/users/@me' : 'https://api.itch.io/profile', tok);
  if (r.s === 401 || r.s === 403 || r.j.errors) return { err: 'token' };
  const u = task === 'discord' ? r.j : r.j.user;
  if (r.s !== 200 || !u || !u.id) return { err: 'remote' };
  return { id: String(u.id) };
}
exports.handler = async (e) => {
  const rk = e.routeKey, cl = e.requestContext.authorizer && e.requestContext.authorizer.jwt && e.requestContext.authorizer.jwt.claims;
  if (!cl || !cl.sub) return res(401, { error: 1 });
  let b = {}; try { b = JSON.parse(e.isBase64Encoded ? Buffer.from(e.body || '', 'base64').toString() : e.body || '{}'); } catch (x) { return res(400, { error: 1 }); }
  const sub = cl.sub, now = Date.now();
  const mine = async () => {
    const r = await send(new D.QueryCommand({ TableName: T, KeyConditionExpression: 'pk = :p', ExpressionAttributeValues: { ':p': S('sup#' + sub) }, ConsistentRead: true }));
    return Object.fromEntries((r.Items || []).map(i => [i.sk.S, { st: i.st.S, at: +i.at.N }]));
  };
  if (rk === 'GET /support') return res(200, { tasks: TASKS, mine: await mine() });
  if (rk !== 'POST /support/claim') return res(404, { error: 1 });
  const task = b.task, tok = String(b.token || '');
  if (!Object.hasOwn(TASKS, task) || !/^[\w.~+/=-]{10,200}$/.test(tok)) return res(400, { error: 1 });
  if ((await mine())[task]) return res(409, { error: 'done' });
  const h = (await send(new D.GetItemCommand({ TableName: H, Key: { pid: S(pidOf(sub)) } }))).Item;
  if (!h || h.ban) return res(403, { error: 'hero' });
  if (!h.fl || +h.fl.N < MINFL) return res(403, { error: 'floor', need: MINFL });
  let c; try { c = await check(task, tok); } catch (x) { c = { err: 'remote' }; }
  if (c.err) return res(c.err === 'remote' ? 502 : 403, { error: c.err });
  const add = TASKS[task];
  try {
    await send(new D.TransactWriteItemsCommand({ TransactItems: [
      { Put: { TableName: T, Item: { pk: S('supn'), sk: S(task + '#' + c.id), uid: S(sub), at: N(now) }, ConditionExpression: 'attribute_not_exists(pk)' } },
      { Put: { TableName: T, Item: { pk: S('sup#' + sub), sk: S(task), st: S('ok'), ext: S(c.id), at: N(now), pid: h.pid }, ConditionExpression: 'attribute_not_exists(pk)' } },
      { Update: { TableName: W, Key: { userId: S(sub) }, UpdateExpression: 'SET bal = if_not_exists(bal, :g) + :a, own = if_not_exists(own, :o)',
        ExpressionAttributeValues: { ':g': N(100), ':a': N(add), ':o': { SS: ['f.plain'] } } } },
    ] }));
  } catch (x) {
    if (x.name !== 'TransactionCanceledException') throw x;
    return res(409, { error: x.CancellationReasons && x.CancellationReasons[0].Code === 'ConditionalCheckFailed' ? 'taken' : 'done' });
  }
  const w = (await send(new D.GetItemCommand({ TableName: W, Key: { userId: S(sub) }, ConsistentRead: true }))).Item;
  return res(200, { ok: true, add, bal: w && w.bal ? +w.bal.N : null, mine: await mine() });
};
