const { DynamoDBClient, UpdateItemCommand, ScanCommand, PutItemCommand, GetItemCommand } = require('@aws-sdk/client-dynamodb');
const crypto = require('crypto');
const db = new DynamoDBClient({});
const T = process.env.TABLE, CH = process.env.CHAT;
const SIDE_NAME = { covenant: 'the Iron Covenant', radiant: 'the Radiant Ascendancy', tide: 'the Devouring Tide', mercy: 'the Mercy Corps', unsworn: 'the Unsworn' };
const CLS_NAME = { tank: 'tank', healer: 'healer', rogue: 'rogue', mage: 'mage', necro: 'necromancer' };
const CLS = ['tank', 'healer', 'rogue', 'mage', 'necro'];
const SIDES = ['covenant', 'radiant', 'tide', 'mercy', 'unsworn'];
const BAD = /(fuck|shit|cunt|nigg|fag|rape|nazi|hitler|bitch|whore|dick|cock|puss|slut|porn|retard|jizz|dildo|penis|vagin|cumsh|cumsl)/i;
// Short words that are rude alone but sit inside real names (Cumberland), so only whole words count (v125).
const BADW = /(^|[ '\-])(cum+s?|cumming|tits?|boobs?|anal|sexy?)([ '\-]|$)/i;
const res = (c, b) => ({ statusCode: c, headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });
// Build card (v130, John 26 Nov 2026): a hero's steady damage, health, healing and Piercing, so a borrowed copy fights
// like the real hero. Saves live on the player's device, so only finite numbers are kept; the borrowing game also caps
// a card at 2x its own hero (GUEST_CAP in core.js), so a faked card can't carry anyone.
const num = v => (typeof v === 'number' && isFinite(v) && v >= 0 ? Math.min(v, 1e300) : 0);
const cardOf = b => { if (!b || typeof b !== 'object') return null; const c = { d: num(b.d), h: num(b.h), hl: num(b.hl), pc: Math.min(1, num(b.pc)), t: Math.min(10, num(b.t) | 0) }; return c.h > 0 ? JSON.stringify(c) : null; };
const heroOut = i => ({ id: i.pid.S, name: i.name.S, cls: i.cls.S, level: Number(i.lv.N), floor: Number(i.fl.N), side: i.sd ? i.sd.S : 'unsworn', on: Date.now() - Number(i.seen.N) < 18e4, pf: i.pf ? JSON.parse(i.pf.S) : null, wd: i.wd ? JSON.parse(i.wd.S) : null, w: i.wv && i.wv.N === '1' ? i.wl.S : '', np: i.np ? +i.np.N : 0, bp: i.bp ? JSON.parse(i.bp.S) : null });
const pidOf = sub => crypto.createHash('sha256').update('lh:' + sub).digest('hex').slice(0, 16);
// Public profile (v132, John 26 Nov 2026): ps is the showcase the game sends (combat stats, worn gear, records, party).
// Owners hide parts of their profile with pf.h (set through PUT /profile); hidden parts never leave the server.
const str = (v, n) => String(v == null ? '' : v).replace(/[<>"\u0000-\u001f]/g, '').slice(0, n);
const RAR = ['common', 'fine', 'rare', 'epic', 'set', 'legend', 'mythic'];
function showOf(p) {
  if (!p || typeof p !== 'object') return null;
  const o = {}, s = p.s, r = p.r;
  if (s && typeof s === 'object') o.s = { d: Math.round(num(s.d)), h: Math.round(num(s.h)), hl: Math.round(num(s.hl)) };
  if (Array.isArray(p.g)) o.g = p.g.slice(0, 14).filter(Array.isArray).map(x => [str(x[0], 8), str(x[1], 40), RAR.includes(x[2]) ? x[2] : 'common', Math.min(99, num(x[3]) | 0)]);
  if (r && typeof r === 'object') o.r = { k: Math.floor(num(r.k)), b: Math.floor(num(r.b)), c: Math.floor(num(r.c)), t: Math.floor(num(r.t)), f: Math.min(999, num(r.f) | 0), rk: Math.floor(num(r.rk)) };
  if (Array.isArray(p.pa)) o.pa = p.pa.slice(0, 4).filter(Array.isArray).map(x => [str(x[0], 20), CLS.includes(x[1]) ? x[1] : 'tank']);
  const j = JSON.stringify(o); return j.length > 2 && j.length < 2500 ? j : null;
}
function pub(i, o, party) {
  const h = o.pf && Array.isArray(o.pf.h) ? o.pf.h : [], x = k => h.includes(k);
  let ps = null; try { ps = i.ps ? JSON.parse(i.ps.S) : null; } catch (e) {}
  if (ps) { if (x('st')) delete ps.s; if (x('gr')) delete ps.g; if (x('rc')) delete ps.r; if (x('pa')) delete ps.pa; }
  o.ps = ps;
  if (x('fl')) o.floor = 0; if (x('np')) o.np = 0; if (x('on')) o.on = false; if (x('w')) o.w = '';
  if (o.pf) { if (x('b')) o.pf.b = ''; if (x('e')) o.pf.e = []; delete o.pf.h; }
  if (x('st') && !party) o.bp = null; // borrowed heroes in your own party still get their build card to fight with
  return o;
}
exports.handler = async (e) => {
  const cl = e.requestContext.authorizer && e.requestContext.authorizer.jwt && e.requestContext.authorizer.jwt.claims;
  if (!cl || !cl.sub) return res(401, { error: 'not signed in' });
  const me = pidOf(cl.sub), rk = e.routeKey;
  let b = {};
  if (e.body) { try { b = JSON.parse(e.isBase64Encoded ? Buffer.from(e.body, 'base64').toString() : e.body); } catch (x) { return res(400, { error: 'bad json' }); } }
  if (rk === 'PUT /hero') {
    // rf: the channel tag (?ref=) the player first arrived with, kept once, to count players per channel.
    const name = String(b.name || '').trim();
    if (!/^[A-Za-z][A-Za-z '\-]{1,15}$/.test(name) || BAD.test(name.replace(/[^a-z]/gi, '')) || BADW.test(name)) return res(400, { error: 'name' });
    if (!CLS.includes(b.cls)) return res(400, { error: 'class' });
    const floor = Math.max(1, Math.min(100000, Math.floor(Number(b.floor) || 1)));
    const level = Math.max(1, Math.min(50 + floor * 8, Math.floor(Number(b.level) || 1)));
    const side = SIDES.includes(b.side) ? b.side : 'unsworn', card = cardOf(b.bp), show = showOf(b.ps);
    let r;
    try {
      r = await db.send(new UpdateItemCommand({ TableName: T, Key: { pid: { S: me } },
        UpdateExpression: 'SET #n = :n, cls = :c, lv = :l, fl = :f, sd = :s, seen = :t, recruits = :z, u = :u, rf = if_not_exists(rf, :r)' + (card ? ', bp = :bp' : '') + (show ? ', ps = :ps' : ''),
        ConditionExpression: 'attribute_not_exists(ban)',
        ExpressionAttributeNames: { '#n': 'name' },
        ExpressionAttributeValues: Object.assign(card ? { ':bp': { S: card } } : {}, show ? { ':ps': { S: show } } : {}, { ':n': { S: name }, ':c': { S: b.cls }, ':l': { N: String(level) }, ':f': { N: String(floor) }, ':s': { S: side }, ':t': { N: String(Date.now()) }, ':z': { N: '0' }, ':u': { S: cl.sub }, ':r': { S: /^[a-z0-9_-]{1,24}$/.test(b.ref || '') ? b.ref : '-' } }),
        ReturnValues: 'UPDATED_OLD' }));
    } catch (x) { if (x.name === 'ConditionalCheckFailedException') return res(403, { error: 'banned' }); throw x; }
    // A brand-new hero is announced in Global chat with their alliance.
    if (CH && !(r.Attributes && r.Attributes.name)) {
      const now = Date.now();
      try { await db.send(new PutItemCommand({ TableName: CH, Item: { pk: { S: 'global' }, sk: { S: now.toString(36).padStart(9, '0') + crypto.randomBytes(3).toString('hex') }, from: { S: 'sys' }, name: { S: 'Lanternhold' }, cls: { S: 'sys-' + side },
        text: { S: name + ' took up the lantern for ' + SIDE_NAME[side] + ' as a ' + CLS_NAME[b.cls] + '. Welcome to the deep!' }, ttl: { N: String(Math.floor(now / 1000) + 7 * 86400) } } })); } catch (x) {}
    }
    const old = r.Attributes && r.Attributes.recruits;
    return res(200, { ok: true, id: me, recruits: old ? Number(old.N) : 0 });
  }
  if (rk === 'GET /heroes') {
    const r = await db.send(new ScanCommand({ TableName: T, Limit: 300 }));
    const cut = Date.now() - 30 * 864e5;
    let list = (r.Items || []).filter(i => i.pid.S !== me && i.name && i.seen && Number(i.seen.N) > cut)
      .map(i => pub(i, heroOut(i)));
    for (let k = list.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [list[k], list[j]] = [list[j], list[k]]; }
    list.sort((a, c) => c.on - a.on);
    // ?ids=a,b: fresh cards for heroes already in the asker's party, even if the scan missed them.
    const ids = String((e.queryStringParameters && e.queryStringParameters.ids) || '').split(',').filter(x => /^[0-9a-f]{16}$/.test(x) && x !== me).slice(0, 4);
    const party = [];
    for (const id of ids) { try { const g = await db.send(new GetItemCommand({ TableName: T, Key: { pid: { S: id } } })); if (g.Item && g.Item.name) party.push(pub(g.Item, heroOut(g.Item), true)); } catch (x) {} }
    return res(200, { heroes: list.slice(0, 10), party });
  }
  if (rk === 'POST /recruit') {
    const id = String(b.heroId || '');
    if (!/^[0-9a-f]{16}$/.test(id) || id === me) return res(400, { error: 'hero' });
    try {
      await db.send(new UpdateItemCommand({ TableName: T, Key: { pid: { S: id } }, UpdateExpression: 'ADD recruits :one',
        ConditionExpression: 'attribute_exists(pid)', ExpressionAttributeValues: { ':one': { N: '1' } } }));
    } catch (x) { if (x.name === 'ConditionalCheckFailedException') return res(404, { error: 'no hero' }); throw x; }
    // party ties for party chat: the leader's room admits the hero's owner, and the owner can find the room
    await db.send(new UpdateItemCommand({ TableName: T, Key: { pid: { S: id } }, UpdateExpression: 'ADD pin :me', ExpressionAttributeValues: { ':me': { SS: [me] } } }));
    await db.send(new UpdateItemCommand({ TableName: T, Key: { pid: { S: me } }, UpdateExpression: 'ADD inv :id', ExpressionAttributeValues: { ':id': { SS: [id] } } }));
    return res(200, { ok: true });
  }
  return res(404, { error: 'not found' });
};