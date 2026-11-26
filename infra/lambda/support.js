// Support tasks (v132, John 26 Nov 2026): one-time Sigil thanks for joining the Born 2 Game Discord or adding Lanternhold to an
// itch.io collection, checked and paid automatically. No Sigils for ratings, reviews, comments or follows (itch.io unlists pages that
// game ratings or comments, and its API cannot see follows). The game signs the player in to Discord or itch.io (OAuth implicit grant,
// read-only scopes) and sends the access token here once; this Lambda asks Discord or itch itself, so the client cannot fake it.
//   discord: GET discord.com/api/v10/users/@me/guilds/<GUILD>/member (scope guilds.members.read) -> member, plus role ROLE if set
//   itch:    GET api.itch.io/profile (profile:me) and /profile/collections?game_id=<GAME> (profile:collections) -> any has_game
// Once per task per account, and a Discord or itch account can pay only one game account. The token is never stored.
// Trade-table rows: sup#<sub>/<task> (st 'ok', ext id, at) and supn/<task>#<ext id> (uid). Routes: GET /support, POST /support/claim { task, token }.
const D = require('@aws-sdk/client-dynamodb'), crypto = require('crypto');
const db = new D.DynamoDBClient({}), { WALLETS: W, HEROES: H, TRADE: T, ROLE } = process.env;
const res = (c, b) => ({ statusCode: c, body: JSON.stringify(b) });
const S = v => ({ S: String(v) }), N = v => ({ N: String(v) }), send = c => db.send(c);
const GUILD = '860889720456347688', GAME = 5427018, MINFL = 10;
const TASKS = { discord: 10, itch: 5 };
const pidOf = s => crypto.createHash('sha256').update('lh:' + s).digest('hex').slice(0, 16);
const get = async (url, tok) => { const r = await fetch(url, { headers: { Authorization: 'Bearer ' + tok }, signal: AbortSignal.timeout(5000) }); return { s: r.status, j: await r.json().catch(() => ({})) }; };
// Returns the outside account id, or an error code for the player.
async function check(task, tok) {
  if (task === 'discord') {
    const r = await get('https://discord.com/api/v10/users/@me/guilds/' + GUILD + '/member', tok);
    if (r.s === 401) return { err: 'token' };
    if (r.s === 404 || r.s === 403 && r.j.code === 10004) return { err: 'notmember' };
    if (r.s !== 200 || !r.j.user || !r.j.user.id) return { err: 'remote' };
    if (ROLE && !(r.j.roles || []).includes(ROLE)) return { err: 'role' };
    return { id: r.j.user.id };
  }
  const p = await get('https://api.itch.io/profile', tok);
  if (p.s === 401 || p.s === 403 || p.j.errors) return { err: 'token' };
  if (p.s !== 200 || !p.j.user || !p.j.user.id) return { err: 'remote' };
  const c = await get('https://api.itch.io/profile/collections?game_id=' + GAME, tok);
  if (c.s !== 200 || c.j.errors) return { err: 'remote' };
  if (!(c.j.collections || []).some(x => x.has_game)) return { err: 'nogame' };
  return { id: String(p.j.user.id) };
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
