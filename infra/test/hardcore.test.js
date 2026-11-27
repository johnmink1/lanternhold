// node infra/test/hardcore.test.js            (core rules)
// NODE_PATH=infra/test/mock node infra/test/hardcore.test.js   (also the save, market, mail, heroes and chat walls)
// v142 Hardcore (John 27 Nov 2026).
const assert = require('assert'), crypto = require('crypto'), path = require('path');
const L = require('../../lanternhold/core.js');
const r = (() => { let x = 7; return () => ((x = (x * 16807) % 2147483647) / 2147483647); })();
function party() {
  const s = L.newState(); L.startGame(s, 'multi', 'tank', 'Ember', 'mercy'); L.startHardcore(s);
  for (const id of ['ashe', 'alder', 'varga', 'wren']) L.recruit(s, id);
  s.maxFloor = s.maxFloorEver = 60; L.gotoFloor(s, 51);
  for (const id of s.party.filter(Boolean)) { s.gear[id] = {}; for (let i = 0; i < 12 && Object.keys(s.gear[id]).length < 3; i++) { const it = L.rollGear(s, 51, null, r); if (s.gear[id][it.slot]) continue; it.cls = L.memberById(id).cls; s.bag.push(it); s.gear[id][it.slot] = it.uid; } }
  return s;
}
const worn = (s, id) => Object.values(s.gear[id] || {});
const now0 = 1.8e12;
(async () => {
  // 1. a companion dies after the dying window unless raised; gear is carried, then safe at camp
  let s = party(), ev = [];
  const id = s.party[1], g = worn(s, id); assert.ok(g.length, 'companion wears gear');
  s.hp[id] = 0; s.down[id] = now0 + L.HC_DYING * 1000; s.foe = null;
  L.tick(s, 0.1, now0 + L.HC_DYING * 1000 + 1, r, ev);
  assert.ok(ev.some(e => e.type === 'hcdie' && e.id === id), 'died');
  assert.ok(!s.unlocked.includes(id) && !s.party.includes(id), 'gone for good');
  assert.deepStrictEqual(Object.values(s.hc.carry[id]).sort(), g.sort(), 'gear carried');
  assert.ok(g.every(u => s.bag.some(x => x.uid === u)), 'still in the bag');
  L.hcHome(s); ev = []; L.tick(s, 0.1, now0 + 40000, r, ev);
  assert.ok(!Object.keys(s.hc.carry).length && ev.some(e => e.type === 'hccarry'), 'carried gear safe at camp');
  assert.ok(g.every(u => s.bag.some(x => x.uid === u)), 'kept');
  console.log('ok  companion dies after', L.HC_DYING, 's; gear carried, safe once home');
  // 2. a healer's Hymn raises at 3x mana; without the mana, no raise
  s = party(); const heal = s.party.find(x => x && L.memberById(x).cls === 'healer'), tank = 'you', vic = s.party.find(x => x && x !== heal && x !== 'you');
  assert.ok(heal, 'party has a healer');
  s.res = s.res || {}; s.down[vic] = now0 + 30000; s.hp[vic] = 0; s.res[heal] = 100; ev = [];
  L.castAbility(s, heal, now0, ev);
  assert.ok(!s.down[vic] && ev.some(e => e.type === 'revive'), 'raised');
  assert.ok(Math.abs(s.res[heal] - (100 - L.AB_COST * L.HC_RAISE)) < 1e-6, 'paid 3x mana: ' + s.res[heal]);
  s.down[vic] = now0 + 30000; s.hp[vic] = 0; s.res[heal] = 70; s.abil[heal] = { readyAt: 0, until: 0 }; ev = [];
  L.castAbility(s, heal, now0 + 60000, ev);
  assert.ok(s.down[vic] && ev.some(e => e.type === 'hcnomana'), 'not enough mana: no raise');
  console.log('ok  Hymn raises for', L.AB_COST * L.HC_RAISE, 'mana; less mana, no raise');
  // 3. hero falls with companions standing: hero gear lost, a quarter to the Lost Pack, everyone home, levels kept
  s = party(); const hg = worn(s, 'you'), lv = s.levels.you, cg = worn(s, s.party[2]); ev = [];
  s.hp.you = 0; s.down.you = now0 + 1; L.tick(s, 0.1, now0 + 2, r, ev);
  assert.ok(ev.some(e => e.type === 'hcherofall'), 'hero fell');
  assert.ok(hg.every(u => !s.bag.some(x => x.uid === u)), 'hero gear gone');
  assert.ok(cg.every(u => s.bag.some(x => x.uid === u)), 'companion gear kept');
  assert.equal(s.levels.you, lv, 'hero level kept'); assert.equal(s.floor, L.CAMP_FLOOR, 'back at camp');
  assert.equal(s.hc.pack.items.length, Math.ceil(hg.length * L.HC_PACK), 'Lost Pack holds 25%'); assert.equal(s.hc.pack.f, 51);
  console.log('ok  hero fall: hero gear lost (' + hg.length + '), pack', s.hc.pack.items.length + ', companions and levels kept');
  // 4. wipe: seated companions die, all worn gear lost; Campfire companions safe; Lost Pack back with new ids
  s = party(); const benched = 'kestrel'; L.recruit(s, benched); s.party = s.party.map(x => x === benched ? null : x);
  assert.ok(s.unlocked.includes(benched), 'a companion resting at the Campfire');
  const all = s.party.filter(Boolean).flatMap(x => worn(s, x)), seated = s.party.filter(x => x && x !== 'you');
  for (const x of s.party) if (x) { s.hp[x] = 0; s.down[x] = now0 + L.HC_DYING * 1000; }
  const wev = []; L.wipe(s, now0, wev);
  assert.ok(wev.some(e => e.type === 'hcwipe'), 'wipe event');
  assert.ok(seated.every(x => !s.unlocked.includes(x)), 'seated companions died');
  assert.ok(s.unlocked.includes(benched), 'Campfire companion safe');
  assert.ok(all.every(u => !s.bag.some(x => x.uid === u)), 'all worn gear lost');
  assert.equal(s.floor, L.CAMP_FLOOR, 'hero wakes at camp');
  const pack = s.hc.pack; assert.ok(pack && pack.f === 51 && pack.items.length === Math.ceil(all.length * L.HC_PACK), 'pack holds 25%');
  console.log('ok  wipe: ' + seated.length + ' seated companions died, ' + all.length + ' worn pieces lost, Campfire companion safe');
  // 5. the Lost Pack comes back on that floor, with new ids (lost ids never return)
  const n0 = s.bag.length, rev = []; s.floor = 51; assert.equal(L.hcRecover(s, now0 + 1000, rev), pack.items.length);
  assert.equal(s.bag.length, n0 + pack.items.length); assert.ok(!s.bag.some(x => all.includes(x.uid)), 'new ids');
  const s2 = party(); s2.hc.pack = { f: 51, at: now0 - 8 * 864e5, n: 4, items: [s2.bag[0]] }; assert.equal(L.hcRecover(s2, now0, []), 0, 'a pack older than 7 days is gone');
  console.log('ok  Lost Pack: ' + pack.items.length + ' pieces back with new ids; gone after ' + L.HC_PACK_DAYS + ' days');
  // 6. migrate: someone dying when the game closed dies on load
  s = party(); const v2 = s.party[3]; s.down[v2] = now0 + 20000; const o = JSON.parse(JSON.stringify(s));
  const m = L.migrate(o); ev = []; L.tick(m, 0.1, now0, r, ev);
  assert.ok(!m.unlocked.includes(v2) && ev.some(e => e.type === 'hcdie'), 'dying on close = died');
  console.log('ok  closing the game while someone lies dying does not save them');
  // 7. world boss and Ring are off; v143 (John): NP+ (own tier) and Sigil finds are open
  assert.ok(L.npReady(Object.assign(party(), { maxFloorEver: 999 })) && !L.canUse(s, 'ring') && !L.canUse(s, 'boss') && L.sigilChance(s, 'chest') > 0);
  assert.equal(L.startAssault(s, now0, 'x'), false);
  console.log('ok  world boss and Ember Ring closed to Hardcore; NP+ and Sigil finds open (v143)');
  // 8. Normal play is unchanged: a fallen Normal member stands up on the timer
  const n = L.newState(); L.startGame(n, 'multi', 'tank', 'N', 'mercy'); L.recruit(n, 'ashe'); n.hp.ashe = 0; n.down.ashe = now0; L.gotoFloor(n, 1); n.maxFloor = 5; L.gotoFloor(n, 3);
  L.tick(n, 0.1, now0 + 1, r, []); assert.ok(!n.down.ashe && n.unlocked.includes('ashe'), 'normal revive');
  console.log('ok  Normal heroes unchanged');

  // ---------- server ----------
  let mock = true; try { require.resolve('@aws-sdk/client-dynamodb'); } catch (e) { mock = false; }
  if (!mock) { console.log('(server part skipped: run with NODE_PATH=infra/test/mock)'); return; }
  global.__DDB = {}; global.__KEYS = { saves: ['userId'], trade: ['pk', 'sk'], heroes: ['pid'], wallets: ['userId'], chat: ['pk', 'sk'] };
  Object.assign(process.env, { TABLE: 'saves', TRADE: 'trade', HEROES: 'heroes', H: 'heroes', WALLETS: 'wallets', SAVES: 'saves', SAVECHECK: 'log' });
  const Lm = p => { const f = path.join(__dirname, '../lambda', p); delete require.cache[require.resolve(f)]; return require(f); };
  const sub = 'user-hc', pidN = crypto.createHash('sha256').update('lh:' + sub).digest('hex').slice(0, 16), pidH = crypto.createHash('sha256').update('lh:' + sub + '#hc').digest('hex').slice(0, 16);
  const evs = (method, body, hc, routeKey) => ({ routeKey: routeKey || method + ' /save', queryStringParameters: hc ? { hc: '1' } : {}, requestContext: { http: { method }, authorizer: { jwt: { claims: { sub } } } }, body: body ? JSON.stringify(body) : undefined });
  const save = Lm('save.js');
  const hs = party(); hs.created = 5; hs.stats.playTime = 100;
  const put = async (sv, hc, extra) => (await save.handler(evs('PUT', Object.assign({ data: JSON.stringify(sv), floor: 1, created: sv.created, dv: 'd1', claim: 1 }, extra), hc))).statusCode;
  assert.equal(JSON.parse((await save.handler(evs('GET', null, true))).body).hc, 1, 'GET says hc');
  assert.equal(await put(hs, true), 200, 'Hardcore save to Hardcore slot');
  const rowH = global.__DDB.saves.get(JSON.stringify([['userId', { S: sub + '#hc' }]])); assert.ok(rowH && rowH.hcd, 'stored apart with hcd');
  assert.equal(global.__DDB.saves.get(JSON.stringify([['userId', { S: sub }]])), undefined, 'Normal slot untouched');
  assert.equal(await put(hs, false), 409, 'Hardcore save refused in the Normal slot');
  const ns = L.newState(); L.startGame(ns, 'multi', 'rogue', 'Norm', 'mercy'); ns.created = 6;
  assert.equal(await put(ns, true), 409, 'Normal save refused in the Hardcore slot');
  assert.equal(await put(ns, false), 200, 'Normal save to Normal slot');
  const old = JSON.parse(JSON.stringify(hs));
  const dying = hs.party[1]; hs.down[dying] = 1; L.hcDie(hs, dying, now0, []); hs.stats.playTime += 60;
  assert.equal(await put(hs, true), 200, 'save after a death');
  assert.equal(await put(old, true), 409, 'older copy with the companion alive refused');
  const lostU = worn(hs, 'you'); hs.hp.you = 0; hs.down.you = 1; L.tick(hs, 0.1, now0 + 5, r, []); hs.stats.playTime += 60;
  assert.equal(await put(hs, true), 200, 'save after a hero fall');
  const cheat = JSON.parse(JSON.stringify(hs)); cheat.bag.push(Object.assign({}, old.bag.find(x => x.uid === lostU[0]))); cheat.stats.playTime += 60;
  assert.equal(await put(cheat, true), 409, 'lost gear back in the bag refused');
  console.log('ok  server: slots kept apart, deaths and lost gear never come undone');
  assert.equal((await save.handler(evs('DELETE', null, true))).statusCode, 200);
  const st = JSON.parse((await save.handler(evs('GET', null, true))).body); assert.ok(st.rst && st.data === '', 'start over leaves an rst stamp');
  assert.equal(await put(old, true), 409, 'a copy from before the start-over is refused');
  const fresh = party(); fresh.created = Date.now() + 1;
  assert.equal(await put(fresh, true), 200, 'a new Hardcore run is accepted');
  console.log('ok  start over: old copies refused, new run accepted');
  // walls: market, mail, heroes, chat
  const heroes = Lm('heroes.js'), hev = (body, hc, rk, q) => ({ routeKey: rk, queryStringParameters: Object.assign(hc ? { hc: '1' } : {}, q || {}), requestContext: { authorizer: { jwt: { claims: { sub } } } }, body: body ? JSON.stringify(body) : undefined });
  process.env.TABLE = 'heroes'; const hh = Lm('heroes.js');
  assert.equal((await hh.handler(hev({ name: 'Embera', cls: 'tank', side: 'mercy', level: 5, floor: 9 }, true, 'PUT /hero'))).statusCode, 200);
  assert.equal((await hh.handler(hev({ name: 'Normy', cls: 'rogue', side: 'mercy', level: 5, floor: 9 }, false, 'PUT /hero'))).statusCode, 200);
  const hrow = global.__DDB.heroes.get(JSON.stringify([['pid', { S: pidH }]])); assert.ok(hrow && hrow.hc && hrow.u.S === sub, 'Hardcore hero row flagged, u = real account');
  console.log('ok  heroes: Hardcore hero row is separate and flagged');
  assert.equal((await hh.handler(hev({ name: 'Normy', cls: 'tank', side: 'mercy', level: 5, floor: 9 }, true, 'PUT /hero'))).statusCode, 200, 'Hardcore hero may use the same name as its own Normal hero');
  const other = ev2 => Object.assign(ev2, { requestContext: { authorizer: { jwt: { claims: { sub: 'someone-else' } } } } });
  assert.equal((await hh.handler(other(hev({ name: 'Normy', cls: 'rogue', side: 'mercy', level: 5, floor: 9 }, false, 'PUT /hero')))).statusCode, 409, 'another player still cannot take it');
  assert.equal((await hh.handler(other(hev({ name: 'Normy', cls: 'rogue', side: 'mercy', level: 5, floor: 9 }, true, 'PUT /hero')))).statusCode, 409, 'nor in their Hardcore slot');
  console.log('ok  heroes: your Hardcore hero can share your Normal name, nobody else can');
  process.env.TABLE = 'chat'; const chat = Lm('../chat/index.js');
  const chev = (hc, body) => ({ routeKey: 'POST /chat', queryStringParameters: hc ? { hc: '1' } : {}, requestContext: { authorizer: { jwt: { claims: { sub } } } }, body: JSON.stringify(body) });
  assert.equal((await chat.handler(chev(false, { ch: 'hc', text: 'hi', name: 'Normy', cls: 'rogue' }))).statusCode, 403, 'Normal hero cannot post in Hardcore chat');
  assert.equal((await chat.handler(chev(true, { ch: 'hc', text: 'hi', name: 'Embera', cls: 'tank' }))).statusCode, 200, 'Hardcore hero can');
  console.log('ok  chat: only Hardcore heroes post in the Hardcore tab');
  const got = JSON.parse((await chat.handler({ routeKey: 'GET /chat', queryStringParameters: { ch: 'hc' }, requestContext: { authorizer: { jwt: { claims: { sub } } } } })).body).msgs;
  assert.ok(got.length && got.every(m => m.hc === 1), 'Hardcore posts carry the HC flag');
  assert.equal((await chat.handler(chev(false, { ch: 'global', text: 'yo', name: 'Normy', cls: 'rogue' }))).statusCode, 200);
  const gl = JSON.parse((await chat.handler({ routeKey: 'GET /chat', queryStringParameters: { ch: 'global' }, requestContext: { authorizer: { jwt: { claims: { sub } } } } })).body).msgs;
  assert.ok(gl.length && gl.every(m => !m.hc), 'Normal posts have no HC flag');
  console.log('ok  chat: Hardcore posts carry the HC tag, Normal posts do not');
  process.env.TABLE = 'trade'; const mail = Lm('mail.js');
  const it = { cls: 'tank', slot: 'main', rar: 'common', ilvl: 5, up: 0 };
  const mev = (hc, rk, body) => ({ routeKey: rk, queryStringParameters: hc ? { hc: '1' } : {}, requestContext: { authorizer: { jwt: { claims: { sub } } } }, body: JSON.stringify(body) });
  assert.equal((await mail.handler(mev(true, 'POST /mail/send', { item: it, to: pidN, price: 0 }))).statusCode, 409, 'no mail from Hardcore to Normal');
  assert.equal((await mail.handler(mev(false, 'POST /mail/send', { item: it, to: pidH, price: 0 }))).statusCode, 409, 'no mail from Normal to Hardcore');
  console.log('ok  mail: nothing crosses the wall');
  const market = Lm('market.js');
  assert.equal((await market.handler(mev(true, 'POST /market/list', { item: it, price: 10, name: 'Embera' }))).statusCode, 200);
  const keys = [...global.__DDB.trade.keys()].filter(k => k.includes('mkt#'));
  assert.ok(keys.length && keys.every(k => k.includes('mkt#tank#hc')), 'Hardcore listing in its own market');
  const nl = JSON.parse((await market.handler(Object.assign(mev(false, 'GET /market', {}), { queryStringParameters: { cls: 'tank' } }))).body).listings;
  assert.equal(nl.length, 0, 'Normal market does not show it');
  console.log('ok  market: Hardcore has its own market');
})().catch(e => { console.error(e); process.exit(1); });
