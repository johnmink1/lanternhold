// Discord Activity sign-in (v133 private test, John 26 Nov 2026). Lanternhold inside Discord signs players in with
// their Discord account, like wixlogin.js does for the Born 2 Game store.
//   POST /discord/login { code }            no sign-in needed. Swaps the Activity's OAuth code for a Discord token
//                                           (needs the app's client secret), asks Discord who it is, and signs in the
//                                           game account linked to that Discord id. Not linked yet: { link: 1, access_token }.
//   POST /discord/login { token, create: 1 } makes a fresh game account for that Discord id and signs it in.
//   POST /discord/link { token }             with the game's sign-in: links that Discord id to the signed-in account.
//   POST /discord/code { token }             no sign-in needed. For heroes with no password (Born 2 Game store sign-in):
//                                           gives a short code that lives 15 minutes. The player opens the website,
//                                           signs in there any way they like and confirms the code:
//   POST /discord/link { pair }              with the game's sign-in: links the Discord id behind that code. The Activity
//                                           keeps asking POST /discord/login { token } and signs in once the link exists.
// Every answer carries access_token so the page can finish the SDK's authenticate(). Tokens are never stored.
// Links: trade row dc#<discord id>/link (u = Cognito sub). The v132 support task row supn/discord#<id> (uid) also counts.
// Sign-in uses Cognito's custom flow with a one-time code that only this function can write (authchal.js checks it).
// Scope is identify only: we learn the Discord id and name, nothing else, and never read messages.
const D = require('@aws-sdk/client-dynamodb'), C = require('@aws-sdk/client-cognito-identity-provider'), crypto = require('crypto');
const db = new D.DynamoDBClient({}), idp = new C.CognitoIdentityProviderClient({});
const { TABLE: T, POOL: P, CLIENT: CI, DC_ID, DC_SECRET } = process.env;
const res = (c, b) => ({ statusCode: c, headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });
const S = v => ({ S: String(v) }), N = v => ({ N: String(v) });
const get = k => db.send(new D.GetItemCommand({ TableName: T, Key: k, ConsistentRead: true })).then(r => r.Item);
const userBy = async f => ((await idp.send(new C.ListUsersCommand({ UserPoolId: P, Filter: f, Limit: 1 }))).Users || [])[0];
const linkKey = id => ({ pk: S('dc#' + id), sk: S('link') });
async function swap(code) {
  const r = await fetch('https://discord.com/api/oauth2/token', { method: 'POST', signal: AbortSignal.timeout(6000),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: DC_ID, client_secret: DC_SECRET, grant_type: 'authorization_code', code }) });
  const j = await r.json().catch(() => ({}));
  return r.ok && j.access_token ? j.access_token : null;
}
async function who(tok) {
  const r = await fetch('https://discord.com/api/v10/users/@me', { headers: { Authorization: 'Bearer ' + tok }, signal: AbortSignal.timeout(6000) });
  const u = r.ok ? await r.json().catch(() => null) : null;
  return u && /^\d{5,25}$/.test(String(u.id)) ? { id: String(u.id), name: String(u.global_name || u.username || 'Adventurer').slice(0, 40) } : null;
}
// The Cognito sub already linked to this Discord id, if any.
async function linked(id) {
  const a = await get(linkKey(id)); if (a) return a.u.S;
  const b = await get({ pk: S('supn'), sk: S('discord#' + id) }); return b ? b.uid.S : null;
}
async function signIn(user) {
  const code = crypto.randomBytes(18).toString('hex');
  await db.send(new D.PutItemCommand({ TableName: T, Item: { pk: S('otp#' + user.Username), sk: S('-'), c: S(code), exp: N(Date.now() + 6e4), ttl: N(Math.floor(Date.now() / 1000) + 600) } }));
  const a = await idp.send(new C.AdminInitiateAuthCommand({ UserPoolId: P, ClientId: CI, AuthFlow: 'CUSTOM_AUTH', AuthParameters: { USERNAME: user.Username } }));
  const t = await idp.send(new C.AdminRespondToAuthChallengeCommand({ UserPoolId: P, ClientId: CI, ChallengeName: 'CUSTOM_CHALLENGE', Session: a.Session,
    ChallengeResponses: { USERNAME: user.Username, ANSWER: code } }));
  return t.AuthenticationResult;
}
// Link codes: 6 letters and digits that are easy to read aloud (no 0/O, 1/I/L).
const ABC = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const pairKey = c => ({ pk: S('dccode#' + c), sk: S('-') });
exports.handler = async (e) => {
  let b = {}; try { b = JSON.parse(e.isBase64Encoded ? Buffer.from(e.body || '', 'base64').toString() : e.body || '{}'); } catch (x) { return res(400, { error: 'json' }); }
  const code = String(b.code || ''), given = String(b.token || ''), pair = String(b.pair || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
  if (code.length > 200 || given.length > 200) return res(400, { error: 'token' });
  const cl = e.requestContext && e.requestContext.authorizer && e.requestContext.authorizer.jwt && e.requestContext.authorizer.jwt.claims;
  let tok = '', me = null, pairRow = null;
  if (e.routeKey === 'POST /discord/link' && b.pair !== undefined) {
    // Linking from the website with a code the Activity showed: the Discord id comes from the code, not a token.
    if (!cl || !cl.sub) return res(401, { error: 'auth' });
    if (pair.length !== 6) return res(404, { error: 'code' });
    pairRow = await get(pairKey(pair));
    if (!pairRow || +pairRow.exp.N < Date.now()) return res(404, { error: 'code' });
    me = { id: pairRow.d.S, name: pairRow.name.S };
  } else {
    tok = code ? await swap(code) : given;
    if (!tok) return res(401, { error: 'token' });
    me = await who(tok);
    if (!me) return res(401, { error: 'token' });
  }
  const now = Date.now(), place = sub => db.send(new D.PutItemCommand({ TableName: T, ConditionExpression: 'attribute_not_exists(pk)',
    Item: Object.assign(linkKey(me.id), { u: S(sub), name: S(me.name), at: N(now) }) }));

  if (e.routeKey === 'POST /discord/code') {
    if (await linked(me.id)) return res(200, { linked: 1 });
    for (let i = 0; i < 5; i++) {
      const c = Array.from(crypto.randomBytes(6), x => ABC[x % ABC.length]).join('');
      try {
        await db.send(new D.PutItemCommand({ TableName: T, ConditionExpression: 'attribute_not_exists(pk)', Item: Object.assign(pairKey(c),
          { d: S(me.id), name: S(me.name), exp: N(now + 15 * 6e4), ttl: N(Math.floor(now / 1000) + 3600) }) }));
        return res(200, { pair: c, name: me.name });
      } catch (x) { if (x.name !== 'ConditionalCheckFailedException') throw x; }
    }
    return res(503, { error: 'busy' });
  }

  if (e.routeKey === 'POST /discord/link') {
    if (!cl || !cl.sub) return res(401, { error: 'auth' });
    const was = await linked(me.id);
    if (was && was !== cl.sub) return res(409, { error: 'taken' });
    if (!was) { try { await place(cl.sub); } catch (x) { if (x.name !== 'ConditionalCheckFailedException') throw x; return res(409, { error: 'taken' }); } }
    // Used up: the code stops working (PutItem only; the shared role has no DeleteItem). The row's ttl removes it later.
    if (pairRow) { await db.send(new D.PutItemCommand({ TableName: T, Item: Object.assign({}, pairRow, { exp: N(0) }) })); return res(200, { ok: 1, name: me.name }); }
    return res(200, { ok: 1, access_token: tok });
  }

  let sub = await linked(me.id), user = sub && await userBy('sub = "' + sub.replace(/[^0-9a-f-]/g, '') + '"');
  if (user && user.Enabled === false) return res(403, { error: 'banned' });
  if (!user) {
    if (!b.create) return res(200, { link: 1, access_token: tok, name: me.name });
    // A fresh account under a private placeholder address (no email is ever sent), like store sign-ins.
    const mail = 'discord-' + me.id + '@players.born2gamellc.com';
    user = await userBy('email = "' + mail + '"');
    if (!user) {
      user = (await idp.send(new C.AdminCreateUserCommand({ UserPoolId: P, Username: mail, MessageAction: 'SUPPRESS',
        UserAttributes: [{ Name: 'email', Value: mail }, { Name: 'email_verified', Value: 'true' }] }))).User;
      await idp.send(new C.AdminSetUserPasswordCommand({ UserPoolId: P, Username: user.Username, Password: crypto.randomBytes(24).toString('base64') + 'aA1!', Permanent: true }));
    }
    sub = user.Attributes.find(a => a.Name === 'sub').Value;
    try { await place(sub); } catch (x) { if (x.name !== 'ConditionalCheckFailedException') throw x; return res(409, { error: 'state' }); }
  }
  const auth = await signIn(user);
  if (!auth) return res(401, { error: 'auth' });
  return res(200, { AuthenticationResult: auth, access_token: tok, name: me.name });
};
