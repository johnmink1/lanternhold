// Lanternhold cloud save (GET/PUT/DELETE /save) plus the player activity log (John, 25 Nov 2026: "I need to see what
// they are doing so I can audit and see if they are cheating"). Every PUT also writes one small log row to the trade
// table (pk alog#<pid>, kept 30 days): a few numbers read from the save (gold, Dust, XP, floor, bag size...), the
// server's own clock, and the bell entries the game sent since its last sync. Only admins can read it (admin.js,
// GET /admin/log). No IP address, email or device details are stored; dv is a random id made by the game.
// The log is best effort: if it fails, the save still goes through.
// v131 Hall of Fame (John, 26 Nov 2026): each PUT also copies a few record numbers read from the save onto the
// player's public hero row (hf), and c0 keeps the first start time the server ever saw, so a later edit of
// "created" cannot shorten a Start to NP+1 time. Players appear once they next sync. Best effort, like the log.
// v140 save checks (John, 27 Nov 2026, after Kyvia's edited backups and Chipplin's lost 35 h save; savecheck.js):
// - Each PUT is compared with the last save the server trusted (attribute ck on the save row). A save that gained
//   more gold, floors, hero levels, bag items or Rift tokens than real time allows, built a renovation or found a Curio
//   without spending the gold, or claims an NP+ tier the server never granted, is "held": with SAVECHECK=on it is
//   refused (409 'held') and the trusted save stays; with SAVECHECK=log (the first week) it is saved anyway. Either way
//   a copy goes to held#<pid> for an admin to approve or drop (admin.js), and the activity-log row is marked.
// - Daily snapshots: the first save of each UTC day is copied to snap#<pid> (sk = the day, kept 35 days), and before
//   a save with much less play time replaces the stored one, the stored one is copied too (sk = 'b' + time). Admins
//   restore any copy (admin.js POST /admin/restore). The table also has point-in-time recovery (35 days).
// - Market and Mail sales credit the seller's crd (gold the server knows arrived), which the gold rule allows for.
// v142 Hardcore (John, 27 Nov 2026): ?hc=1 is the account's second save slot. It is stored as its own player
// (userId '<sub>#hc', so its own pid, snapshots, activity log and hero row). hccheck.js refuses a Hardcore save whose
// deaths or lost gear came undone (409 'hcback'), and any save carried between the two slots (409 'hcslot').
// DELETE on the Hardcore slot (start over) keeps the row with an rst stamp, so an old copy can't come back.
const D = require('@aws-sdk/client-dynamodb');
const zlib = require('zlib'), crypto = require('crypto');
const SC = require('./savecheck');
const HC = require('./hccheck');
const db = new D.DynamoDBClient({});
const { TABLE, TRADE, HEROES, WALLETS } = process.env, MODE = process.env.SAVECHECK || 'log';
const DAY = 864e5, SNAP_DAYS = 35, HELD_DAYS = 30, BACK = 1800;
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
    wp: n(s.wagesPaid), hr: s.hires ? Object.keys(s.hires).length : 0, rk: n(t.rekindles), ...(s.hc ? { hc: [n(s.hc.n), n(s.hc.hf), n(s.hc.w), n(s.hc.lostN)] } : {}) };
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
async function logSave(sub, now, sv, b, flags) {
  const sn = snap(sv); if (!sn) return;
  let a = ''; try { a = JSON.stringify(Array.isArray(b.acts) ? b.acts.slice(-30) : []).slice(0, 6000); } catch (e) {}
  await db.send(new D.PutItemCommand({ TableName: TRADE, Item: { pk: { S: 'alog#' + pidOf(sub) }, sk: { S: now.toString(36) + crypto.randomBytes(2).toString('hex') },
    at: { N: String(now) }, s: { S: JSON.stringify(sn) }, a: { S: a }, dv: { S: String(b.dv || '').slice(0, 12) }, ...(flags ? { ck: { S: JSON.stringify(flags).slice(0, 2000) } } : {}), ttl: { N: String(Math.floor(now / 1000) + 30 * 86400) } } }));
}
// The first check for a player starts from their activity log (up to 600 rows, 30 days), so it knows their income.
async function seedFrom(sub) {
  const rows = []; let k;
  do {
    const r = await db.send(new D.QueryCommand({ TableName: TRADE, KeyConditionExpression: 'pk = :p', ExpressionAttributeValues: { ':p': { S: 'alog#' + pidOf(sub) } }, ScanIndexForward: false, Limit: 200, ExclusiveStartKey: k }));
    for (const i of r.Items || []) { if (i.ck) continue; let x = null; try { x = JSON.parse(i.s.S); } catch (e) {} if (x) rows.push({ at: +i.at.N, s: x }); }
    k = r.LastEvaluatedKey;
  } while (k && rows.length < 600);
  return SC.seed(rows);
}
const gzip = d => (d.slice(0, 4) === 'gz1:' || d.length < 50000 ? d : 'gz1:' + zlib.gzipSync(d).toString('base64'));
const dayOf = t => new Date(t).toISOString().slice(0, 10);
async function copySave(sub, sk, data, now, sv, why) {
  const p = SC.point(sv || {}, now);
  await db.send(new D.PutItemCommand({ TableName: TRADE, Item: { pk: { S: 'snap#' + pidOf(sub) }, sk: { S: sk }, data: { S: gzip(data) }, at: { N: String(now) },
    sum: { S: JSON.stringify({ g: p.g, f: p.f, pt: p.pt, np: p.np, x: p.x, why }) }, ttl: { N: String(Math.floor(now / 1000) + SNAP_DAYS * 86400) } } }));
}
exports.handler = async (event) => {
  const sub0 = event.requestContext && event.requestContext.authorizer && event.requestContext.authorizer.jwt && event.requestContext.authorizer.jwt.claims.sub;
  if (!sub0) return res(401, { error: 'not signed in' });
  const hc = !!(event.queryStringParameters && event.queryStringParameters.hc === '1'), sub = hc ? sub0 + '#hc' : sub0;
  const method = event.requestContext.http.method;
  const Key = { userId: { S: sub } };
  if (method === 'GET') {
    const r = await db.send(new D.GetItemCommand({ TableName: TABLE, Key }));
    // hc: 1 tells a Hardcore game this server keeps the Hardcore slot apart (an older server would hand back the Normal save).
    if (!r.Item || !r.Item.data || !r.Item.data.S) return r.Item && r.Item.rst ? res(200, { data: '', updated: Number(r.Item.updated.N), rst: Number(r.Item.rst.N), dv: '', hc: hc ? 1 : 0 }) : res(404, { error: 'no save', hc: hc ? 1 : 0 });
    const dv = r.Item.dv ? r.Item.dv.S : '';
    // ?peek=1: only who plays and when it last saved, so a device coming back can check without downloading the save.
    if (event.queryStringParameters && event.queryStringParameters.peek) return res(200, { updated: Number(r.Item.updated.N), dv, hc: hc ? 1 : 0 });
    // rst: an admin reset this player; games created before it start over
    return res(200, { data: r.Item.data.S, updated: Number(r.Item.updated.N), rst: r.Item.rst ? Number(r.Item.rst.N) : 0, dv, hc: hc ? 1 : 0 });
  }
  if (method === 'PUT') {
    let body = event.body || '';
    if (event.isBase64Encoded) body = Buffer.from(body, 'base64').toString('utf8');
    if (body.length > 300000) return res(413, { error: 'save too large' });
    let b; try { b = JSON.parse(body); } catch (e) { return res(400, { error: 'bad json' }); }
    if (typeof b.data !== 'string') return res(400, { error: 'missing data' });
    const now = Date.now();
    const sv = parse(b.data);
    // Hardcore: deaths and lost gear never come undone, and no save crosses between the slots (always on).
    let hcd = null;
    if (sv) {
      let prev = null;
      if (hc) { const h = (await db.send(new D.GetItemCommand({ TableName: TABLE, Key, ProjectionExpression: 'hcd', ConsistentRead: true }))).Item; try { prev = h && h.hcd ? JSON.parse(h.hcd.S) : null; } catch (e) {} }
      const hk = HC.check(hc, sv, prev);
      if (!hk.ok) { console.log('hc refused', pidOf(sub), hk.why); return res(409, { error: hk.why === 'hcslot' || hk.why === 'normal' ? 'hcslot' : 'hcback', why: hk.why }); }
      hcd = hc ? hk.hcd : null;
    }
    // The save check reads the trusted reference first (a small read: only ck, crd, the device and the play time).
    let ck = null, crd = 0, chk = null, row = null;
    if (MODE !== 'off' && sv && TRADE) try {
      row = (await db.send(new D.GetItemCommand({ TableName: TABLE, Key, ProjectionExpression: 'ck, crd, dv, updated', ConsistentRead: true }))).Item || null;
      // A save another device's claim already blocks (409 'moved' below) is not checked: the player gets "Play here".
      const moved = row && row.dv && !b.claim && row.dv.S !== String(b.dv || '').slice(0, 24);
      if (moved) throw { name: 'moved' };
      if (row && row.ck) ck = JSON.parse(row.ck.S); else if (row) ck = await seedFrom(sub);
      crd = row && row.crd ? Number(row.crd.N) : 0;
      let np = null;
      const last = ck && ck.pts && ck.pts[ck.pts.length - 1];
      if (WALLETS && (Number(sv.np) || 0) > (last ? last.np : 0)) {
        const w = (await db.send(new D.GetItemCommand({ TableName: WALLETS, Key, ProjectionExpression: 'np' }))).Item;
        np = w && w.np ? Number(w.np.N) : 0;
      }
      chk = SC.check(ck, sv, now, { crd, np, claim: !!b.claim, dv: String(b.dv || '') });
    } catch (e) { if (e.name !== 'moved') console.log('savecheck', e.name || e.message || e); chk = null; }
    if (chk && !chk.ok) {
      console.log('held', pidOf(sub), MODE, JSON.stringify(chk.flags));
      try {
        await db.send(new D.PutItemCommand({ TableName: TRADE, Item: { pk: { S: 'held#' + pidOf(sub) }, sk: { S: '0' }, data: { S: gzip(b.data) }, at: { N: String(now) },
          flags: { S: JSON.stringify(chk.flags).slice(0, 4000) }, ref: { S: JSON.stringify(chk.ref || null) }, mode: { S: MODE }, dv: { S: String(b.dv || '').slice(0, 24) },
          ttl: { N: String(Math.floor(now / 1000) + HELD_DAYS * 86400) } } }));
        // one small row per held player, so the Admin tab lists them with one query
        await db.send(new D.PutItemCommand({ TableName: TRADE, Item: { pk: { S: 'heldidx' }, sk: { S: pidOf(sub) }, at: { N: String(now) }, flags: { S: JSON.stringify(chk.flags).slice(0, 2000) },
          mode: { S: MODE }, ttl: { N: String(Math.floor(now / 1000) + HELD_DAYS * 86400) } } }));
      } catch (e) { console.log('held copy', e.name); }
      if (MODE === 'on') {
        if (TRADE) try { await logSave(sub, now, sv, b, chk.flags); } catch (e) {}
        return res(409, { error: 'held', flags: chk.flags.map(f => f.k) });
      }
    }
    // UpdateItem keeps an admin reset stamp (rst); saves from games created before it are refused.
    // One device plays at a time (John, 26 Nov 2026: no races between web, phone and Discord). dv is the game's random
    // device id. A game claims the account when it opens (claim: 1, after it picked the newer save); from then on a save
    // from any other device is refused with 409 'moved', and that device pauses until the player presses Play here.
    const dv = String(b.dv || '').slice(0, 24), claim = !!b.claim && !!dv;
    let cond = '(attribute_not_exists(rst) OR rst <= :c)', vals = { ':d': { S: b.data }, ':u': { N: String(now) }, ':f': { N: String(Number(b.floor) || 0) }, ':c': { N: String(Number(b.created) || 0) } };
    let upd = 'SET #d = :d, updated = :u, floor = :f';
    if (hcd) { upd += ', hcd = :h'; vals[':h'] = { S: JSON.stringify(hcd) }; }
    if (dv) { upd += ', dv = :v'; vals[':v'] = { S: dv }; if (!claim) cond += ' AND (attribute_not_exists(dv) OR dv = :v)'; }
    else cond += ' AND attribute_not_exists(dv)'; // hotfix 27 Nov 04:47 UTC: an old tab with no device id can't overwrite a newer save
    // Trusted reference: an accepted, clean save becomes the new reference; a held save accepted in log mode does not.
    const day = dayOf(now), snapToday = chk && chk.ok && chk.ck.sd !== day;
    if (chk && chk.ok) {
      if (snapToday) chk.ck.sd = day;
      upd += ', ck = :k'; vals[':k'] = { S: JSON.stringify(chk.ck) };
      if (crd) { upd += ' ADD crd :n'; vals[':n'] = { N: String(-crd) }; } // the credits it used; a sale claimed meanwhile stays
    }
    // Before a save with much less play time replaces the stored one (an old copy), keep the stored one.
    const hw = ck && ck.hw, back = sv && hw && (Number((sv.stats || {}).playTime) || 0) < hw.pt - BACK;
    if (back && TRADE) try {
      const old = (await db.send(new D.GetItemCommand({ TableName: TABLE, Key, ProjectionExpression: '#d', ExpressionAttributeNames: { '#d': 'data' } }))).Item;
      if (old && old.data && old.data.S) await copySave(sub, 'b' + new Date(now).toISOString().slice(0, 19), old.data.S, now, parse(old.data.S), 'before an older copy replaced it');
    } catch (e) { console.log('back copy', e.name); }
    try {
      await db.send(new D.UpdateItemCommand({ TableName: TABLE, Key, UpdateExpression: upd,
        ConditionExpression: cond, ExpressionAttributeNames: { '#d': 'data' }, ExpressionAttributeValues: vals }));
    } catch (e) {
      if (e.name !== 'ConditionalCheckFailedException') throw e;
      const r = await db.send(new D.GetItemCommand({ TableName: TABLE, Key }));
      if (r.Item && r.Item.rst && Number(r.Item.rst.N) > (Number(b.created) || 0)) return res(409, { error: 'reset', rst: Number(r.Item.rst.N) });
      return res(409, { error: 'moved', updated: r.Item ? Number(r.Item.updated.N) : 0 });
    }
    // Daily snapshot: the first accepted save of each UTC day.
    if (snapToday && TRADE) try { await copySave(sub, day, b.data, now, sv, 'daily'); } catch (e) { console.log('snapshot', e.name); }
    if (TRADE) try { await logSave(sub, now, sv, b, chk && !chk.ok ? chk.flags : null); } catch (e) { console.log('activity log', e.name || e); }
    if (HEROES && sv && !(chk && !chk.ok)) try { await putHof(sub, sv); } catch (e) { console.log('hof', e.name); }
    return res(200, { ok: true, updated: now });
  }
  if (method === 'DELETE') {
    // Hardcore start-over: the row stays as an rst stamp, so a copy made before it is refused (409 'reset').
    if (hc) { const now = Date.now(); await db.send(new D.PutItemCommand({ TableName: TABLE, Item: { userId: { S: sub }, rst: { N: String(now) }, updated: { N: String(now) }, data: { S: '' } } })); return res(200, { ok: true }); }
    await db.send(new D.DeleteItemCommand({ TableName: TABLE, Key }));
    return res(200, { ok: true });
  }
  return res(405, { error: 'method not allowed' });
};
