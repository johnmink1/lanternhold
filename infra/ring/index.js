// The Ember Ring: Lanternhold's PvP. Only each player's own hero fights, one on one, against the saved build of
// another player's hero (async, like the rest of the multiplayer). The server fights every duel.
//
// What decides a duel:
// - the same base strength for every hero (800 health, 100 attack): dungeon power never counts (John, 27 Nov 2026:
//   keep PvP and PvE separate, so no dungeon exploit can carry into the Ring; the old m/v were sent by the client),
// - the Ringwarden kit: PvP-only gear with Edge (more damage to heroes) and Resolve (less damage from heroes),
// - the class matchup: every class has the advantage over two classes (+4% damage) and is countered by two others,
// - the class's own nature (tanks are sturdy, healers mend, rogues crit, mages hit hard with spells, necromancers leech),
// - the Ring skills the player bought with Laurels and chose for their loadout: 2 abilities (used in the order
//   the player sets, when they make sense) and 2 passives.
// Laurels are earned only by fighting. Sigils and real money never touch any of this.
//
// Team battles (John, 27 Nov 2026): the hero plus two of the player's own companions (never borrowed player
// heroes) against another player's saved team, 3 vs 3. Front, Middle and Back: the front fighter takes most of
// the blows, rogues go for the weakest foe, healers mend the weakest teammate. Companions bring their class's
// free Ring ability and class nature, and wear a companion Ring kit (Arms, Mail, Charm, 10 ranks, Laurels) that
// stays with that companion. Team battles share the 10 challenges, have their own team rating and standings,
// and pay a little more Laurels than duels. No new routes: the team rides on the existing ones
// (PUT /arena with tl, POST /arena/kit with cid, POST /arena/fight with team: 1).
//
// Unlike the other functions this one is not inlined into the template; `aws cloudformation package` uploads it.
// Routes: GET /arena, PUT /arena, POST /arena/kit, POST /arena/skill, POST /arena/loadout, POST /arena/fight.
const D = require('@aws-sdk/client-dynamodb');
const crypto = require('crypto');
const db = new D.DynamoDBClient({}), { ARENA: T, HEROES: H, WALLETS: W } = process.env;
const res = (c, b) => ({ statusCode: c, headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });
const S = v => ({ S: String(v) }), N = v => ({ N: String(v) });
const pidOf = sub => crypto.createHash('sha256').update('lh:' + sub).digest('hex').slice(0, 16);

// ---- the Ringwarden kit (keep in step with RING_KIT in the game's v_pvp.js) ----
// Per rank: [Resolve, Edge, +hp share, +attack share]. Ranks 6-10 need a best rating of 1300, 11-15 need 1600.
const KIT = [[5, 0, .02, 0], [7, 0, .015, 0], [0, 5, 0, .015], [3, 3, .01, .01], [0, 7, 0, .02]];
const gate = r => r >= 10 ? 1600 : r >= 5 ? 1300 : 0, cost = r => 60 + 30 * r;
// v141 (John, 27 Nov 2026): dungeon power never counts. Each class starts from its own Ring base [health, attack],
// tuned in the sim so every class still wins about half its duels with equal kits; then only Ring kit and skills change it.
// Sim 27 Nov 2026 (best loadouts, kit ranks 0/5/15): class win rates 42-59%; the old shared base gave 36-66%.
const RBASE = { tank: [1420, 115], healer: [1250, 140], rogue: [970, 205], mage: [1000, 195], necro: [1140, 150], paladin: [1250, 155] };
const rbase = c => RBASE[c] || RBASE.necro;
// ---- Ring Mastery (v141, John 27 Nov 2026): once all five kit pieces are at rank 15, Laurels keep buying Mastery ranks,
// each +1% Ring health and attack, up to 10. Counts only in the Ring (the hero in duels and team battles).
const MS = { max: 10, cost: 500, per: .01 };
// ---- Seasons (v141, John 27 Nov 2026): one calendar month each (UTC); Season 1 runs from launch to the end of December 2026.
// When a season ends, every duel and team rating moves halfway back to 1,000 (best rating pk, which opens kit tiers, stays).
// The final duel standings are saved once as 'season#YYYY-MM'; the top 3 win the Ember Champion title and frame, the top 25
// the Season Laurel emblem (cosmetics on the wallet, so they show on the profile card). Rows reset lazily, on read.
const SEASON0 = '2026-12', AWARD = [[3, ['t.emberchamp', 'f.emberchamp', 'e.laurel']], [25, ['e.laurel']]];
const seasonOf = now => { const s = new Date(now).toISOString().slice(0, 7); return s < SEASON0 ? SEASON0 : s; };
const prevSeason = s => { let [y, m] = s.split('-').map(Number); if (--m < 1) { m = 12; y--; } return y + '-' + String(m).padStart(2, '0'); };
const seasonNo = s => { const [y, m] = s.split('-').map(Number); return (y - 2026) * 12 + m - 11; };
const seasonEnd = s => { const [y, m] = s.split('-').map(Number); return Date.UTC(y, m, 1); };
const soft = r => Math.round(START + (r - START) / 2);
const EMAX = 10, EINT = 30 * 6e4, START = 1000;

// ---- classes ----
// Each class beats two classes and is beaten by the other two (a five-way rock-paper-scissors circle):
// with the edge a hero deals 4% more damage, against a counter 4% less.
const BEATS = { tank: ['rogue', 'healer'], healer: ['necro', 'mage'], rogue: ['mage', 'healer'], mage: ['tank', 'necro'], necro: ['tank', 'rogue'], paladin: [] };
// v139 Paladin (a Sigil class): no edge and no counter (sim 27 Nov 2026, equal builds: 50% average win rate, 45-60% per matchup), so it changes no live matchup and buys no advantage.
// Its duels and team battles also move no rating until PAL_RATED (two weeks after it opened); Laurels are paid as usual.
const PAL_RATED = Date.UTC(2026, 11, 14);
const palQuiet = (now, ...c) => now < PAL_RATED && c.includes('paladin');
const ADV = 0.04;
const WHY = {
  'tank>rogue': 'Plate turns daggers aside', 'tank>healer': 'Outlasts every prayer', 'healer>necro': 'Holy light burns the dead', 'healer>mage': 'Mends faster than spells can burn',
  'rogue>mage': 'Gets inside the spell', 'rogue>healer': 'Strikes before the healing lands', 'mage>tank': 'Fire melts through plate', 'mage>necro': 'Flame scours bone',
  'necro>tank': 'Curses ignore armor', 'necro>rogue': 'Drains what it cannot catch' };
// Each class's nature, always on. Same keys as the passives below.
const NATURE = { tank: { armor: .1 }, healer: { regen: .01, armor: .06 }, rogue: { crit: .08 }, mage: { power: .1 }, necro: { leech: .12 }, paladin: { armor: .05, regen: .005 } };

// ---- Ring skills, bought with Laurels ----
// k: 'a' ability (takes the hero's turn, has a cooldown in own turns) or 'p' passive. v: value at ranks 1-3.
// Ability fx: hit (damage x v), pierce (hit that ignores Resolve and armor), stun (hit x v, foe loses a turn),
// heal (v of max health, used below 70%), shield (absorbs v of max health), dot (v x attack on each of the foe's
// next 3 turns), drain (hit x v, heals what it deals), weaken (foe deals v less for 3 turns), ward (take v less
// from the next 3 hits), evade (dodge the next v attacks).
// Passive fx: armor (take less), reflect (return a share of damage taken), regen (heal v of max health each turn),
// crit (+crit chance), dodge (+chance foes miss), power (abilities hit and heal harder), leech (heal a share of
// damage dealt), undying (once per duel, survive a killing blow with v of max health), execute (+v damage to
// foes under 30% health).
// The first ability of each class is free at rank 1.
const SK = [
  ['bash', 'tank', 'a', 'Shield Bash', 'stun', [.8, 1, 1.2], 6],
  ['bulwark', 'tank', 'a', 'Bulwark', 'shield', [.12, .16, .2], 6],
  ['rally', 'tank', 'a', 'Rallying Roar', 'weaken', [.25, .3, .35], 6],
  ['ironhide', 'tank', 'p', 'Iron Hide', 'armor', [.06, .09, .12]],
  ['spikes', 'tank', 'p', 'Spiked Plate', 'reflect', [.1, .15, .2]],
  ['laststand', 'tank', 'p', 'Last Stand', 'undying', [.08, .12, .16]],
  ['mend', 'healer', 'a', 'Mend', 'heal', [.2, .22, .24], 5],
  ['smite', 'healer', 'a', 'Smite', 'pierce', [1.6, 1.9, 2.2], 4],
  ['holyward', 'healer', 'a', 'Holy Ward', 'ward', [.3, .4, .5], 7],
  ['renewal', 'healer', 'p', 'Renewal', 'regen', [.006, .009, .012]],
  ['zeal', 'healer', 'p', 'Zeal', 'power', [.08, .12, .16]],
  ['sanctity', 'healer', 'p', 'Sanctity', 'armor', [.04, .06, .08]],
  ['backstab', 'rogue', 'a', 'Backstab', 'hit', [1.6, 1.9, 2.2], 4],
  ['poison', 'rogue', 'a', 'Poisoned Blade', 'dot', [.4, .5, .6], 5],
  ['smoke', 'rogue', 'a', 'Smoke Bomb', 'evade', [1, 1, 2], 8],
  ['precision', 'rogue', 'p', 'Precision', 'crit', [.06, .1, .14]],
  ['shadowstep', 'rogue', 'p', 'Shadowstep', 'dodge', [.04, .06, .08]],
  ['finisher', 'rogue', 'p', 'Finisher', 'execute', [.25, .4, .55]],
  ['fireball', 'mage', 'a', 'Fireball', 'hit', [1.7, 2, 2.3], 4],
  ['frostnova', 'mage', 'a', 'Frost Nova', 'stun', [.9, 1.1, 1.3], 6],
  ['barrier', 'mage', 'a', 'Arcane Barrier', 'shield', [.12, .16, .2], 6],
  ['spellweave', 'mage', 'p', 'Spellweave', 'power', [.1, .15, .2]],
  ['overload', 'mage', 'p', 'Overload', 'crit', [.05, .08, .11]],
  ['blink', 'mage', 'p', 'Blink', 'dodge', [.04, .06, .08]],
  ['drain', 'necro', 'a', 'Life Drain', 'drain', [1, 1.2, 1.4], 4],
  ['frailty', 'necro', 'a', 'Curse of Frailty', 'weaken', [.25, .3, .35], 6],
  ['plague', 'necro', 'a', 'Plague', 'dot', [.35, .45, .55], 5],
  ['siphon', 'necro', 'p', 'Soul Siphon', 'leech', [.08, .12, .16]],
  ['bonearmor', 'necro', 'p', 'Bone Armor', 'armor', [.06, .09, .12]],
  ['unholy', 'necro', 'p', 'Unholy Will', 'undying', [.08, .12, .16]],
  ['judgment', 'paladin', 'a', 'Judgment', 'stun', [.8, 1, 1.2], 6],
  ['oath', 'paladin', 'a', 'Oath of Dawn', 'heal', [.18, .2, .22], 5],
  ['aegis', 'paladin', 'a', 'Aegis', 'ward', [.3, .4, .5], 7],
  ['devotion', 'paladin', 'p', 'Devotion', 'regen', [.005, .008, .011]],
  ['blessedplate', 'paladin', 'p', 'Blessed Plate', 'armor', [.05, .08, .11]],
  ['vow', 'paladin', 'p', 'Unbroken Vow', 'undying', [.08, .12, .16]],
].map(([id, c, k, n, fx, v, cd]) => ({ id, c, k, n, fx, v, cd }));
const SKB = Object.fromEntries(SK.map(s => [s.id, s]));
const FREE = { tank: 'bash', healer: 'mend', rogue: 'backstab', mage: 'fireball', necro: 'drain', paladin: 'judgment' };
const SKCOST = [150, 300, 600]; // Laurels for rank 1, 2, 3
const LO_A = 2, LO_P = 2;

// ---- team battles ----
// Companion Ring kit per rank: [Resolve, Edge, +hp share, +attack share] for Arms, Mail, Charm. 10 ranks;
// ranks 6-10 need a best team rating of 1300. Keep in step with TEAM_KIT in the game's ui.js.
const CKIT = [[0, 6, 0, .02], [6, 0, .02, 0], [3, 3, .01, .01]];
const CMAX = 10, cgate = r => r >= 5 ? 1300 : 0, ccost = r => 40 + 20 * r;
const TPOS = [.6, .25, .15];          // share of blows aimed at Front, Middle, Back
const CLS = ['tank', 'healer', 'rogue', 'mage', 'necro', 'paladin'];
// A companion id: a story/unique companion (letters) or a hired NPC ('n' + base 36). Never a player id (16 hex).
const CID = /^(?:[a-z]{2,12}|n[0-9a-z]{1,8})$/;
const cname = x => String(x || '').replace(/[^A-Za-z .'-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 24);

function stats(x) {
  let R = 0, E = 0, hp = 1, at = 1;
  x.k.forEach((r, i) => { const p = KIT[i]; R += p[0] * r; E += p[1] * r; hp += p[2] * r; at += p[3] * r; });
  const mm = 1 + MS.per * Math.min(MS.max, x.ms || 0);
  return { hp: Math.round(rbase(x.c)[0] * hp * mm), at: Math.round(rbase(x.c)[1] * at * mm), E, R, c: x.c };
}
// Skills a hero owns ({id: rank}), with the class's free ability.
function owned(x) {
  const o = {};
  for (const [id, r] of Object.entries(x.sk || {})) if (SKB[id] && r >= 1) o[id] = Math.min(3, r | 0);
  if (FREE[x.c] && !o[FREE[x.c]]) o[FREE[x.c]] = 1;
  return o;
}
// The loadout as it will fight: only owned skills of the hero's current class, at most 2 + 2.
function loadout(x) {
  const o = owned(x), lo = x.lo || {};
  const pick = (ids, k, n) => (ids || []).filter((id, i, a) => o[id] && SKB[id].c === x.c && SKB[id].k === k && a.indexOf(id) === i).slice(0, n);
  let a = pick(lo.a, 'a', LO_A);
  if (!x.lo) a = [FREE[x.c]].filter(Boolean);
  return { a, p: pick(lo.p, 'p', LO_P) };
}

// ---- the duel ----
function fighter(x) {
  const f = stats(x), o = owned(x), lo = loadout(x);
  f.P = Object.assign({}, NATURE[x.c]);
  for (const id of lo.p) { const s = SKB[id]; f.P[s.fx] = (f.P[s.fx] || 0) + s.v[o[id] - 1]; }
  f.ab = lo.a.map(id => ({ s: SKB[id], v: SKB[id].v[o[id] - 1], cd: 0 }));
  Object.assign(f, { h: f.hp, sh: 0, dot: [], weak: 0, wv: 0, ward: 0, wdv: 0, ev: 0, stun: false, und: f.P.undying || 0 });
  return f;
}
function duel(A, B, rnd) {
  const f = [fighter(A), fighter(B)], log = [], first = rnd() < .5 ? 0 : 1;
  const P = (x, k) => x.P[k] || 0;
  const push = (i, d, fl, hl, tag) => log.push([i, Math.round(d), fl, Math.round(hl), tag || '', Math.max(0, Math.round(f[0].h)), Math.max(0, Math.round(f[1].h))]);
  const heal = (x, v) => { const h = Math.max(0, Math.min(x.hp - x.h, v)); x.h += h; return h; };
  // Damage from a to d. Returns [damage, flag]: flag 0 hit, 1 crit, 2 miss.
  function strike(a, d, mult, o, t) {
    if (d.ev > 0) { d.ev--; return [0, 2]; }
    if (!o.sure && rnd() < .08 + P(d, 'dodge')) return [0, 2];
    const cr = rnd() < .1 + P(a, 'crit');
    let x = a.at * (.75 + .5 * rnd()) * mult * (cr ? (a.c === 'rogue' ? 1.8 : 1.5) : 1) * (1 + a.E / (a.E + 300));
    if (!o.pierce) x *= (1 - .5 * d.R / (d.R + 300)) * (1 - P(d, 'armor'));
    if (BEATS[a.c].includes(d.c)) x *= 1 + ADV; else if (BEATS[d.c].includes(a.c)) x *= 1 - ADV;
    if (a.weak > 0) x *= 1 - a.wv;
    if (d.ward > 0) { x *= 1 - d.wdv; d.ward--; }
    if (d.h < d.hp * .3) x *= 1 + P(a, 'execute');
    if (o.ab) x *= 1 + P(a, 'power');
    if (t >= 50) x *= 1.5; // a long duel: the crowd wants blood
    const ab = Math.min(d.sh, x); d.sh -= ab;
    d.h -= x - ab;
    if (P(d, 'reflect')) a.h -= x * P(d, 'reflect');
    return [x, cr ? 1 : 0];
  }
  const fell = x => { if (x.h > 0) return false; if (x.und) { x.h = x.hp * x.und; x.und = 0; return 'und'; } return true; };
  for (let t = 0; t < 100 && f[0].h > 0 && f[1].h > 0; t++) {
    const i = (t + first) % 2, a = f[i], d = f[1 - i];
    // poison and plague tick at the start of the victim's turn
    if (a.dot.length) {
      let x = 0; for (const p of a.dot) { x += p.v; p.n--; } a.dot = a.dot.filter(p => p.n > 0);
      a.h -= x; const u = fell(a); push(1 - i, x, 4, 0, 'dot');
      if (u === 'und') push(i, 0, 5, 0, 'und'); else if (u) break;
    }
    if (a.stun) { a.stun = false; push(i, 0, 3, 0, 'stun'); continue; }
    for (const b of a.ab) if (b.cd > 0) b.cd--;
    if (a.weak > 0) a.weak--;
    // the first ready ability in the player's order that makes sense right now
    const b = a.ab.find(b => b.cd <= 0 && (b.s.fx === 'heal' ? a.h < a.hp * .7 : b.s.fx === 'shield' ? a.sh <= 0 : b.s.fx === 'ward' ? a.ward <= 0 : b.s.fx === 'evade' ? a.ev <= 0 : b.s.fx === 'weaken' ? d.weak <= 0 : b.s.fx === 'dot' ? !d.dot.length : true));
    let dmg = 0, fl = 0, hl = 0, tag = '';
    if (b) {
      b.cd = b.s.cd; tag = b.s.id;
      const v = b.v, pw = 1 + P(a, 'power'), fx = b.s.fx;
      if (fx === 'heal') hl = heal(a, a.hp * v * pw);
      else if (fx === 'shield' || fx === 'ward' || fx === 'evade') {
        // guarding moves still get a light blow in
        if (fx === 'shield') a.sh = a.hp * v * pw; else if (fx === 'ward') { a.ward = 3; a.wdv = v; } else a.ev = v;
        [dmg, fl] = strike(a, d, .6, {}, t);
      }
      else if (fx === 'weaken') { d.weak = 4; d.wv = v; [dmg, fl] = strike(a, d, .8, {}, t); }
      else if (fx === 'dot') { d.dot.push({ v: a.at * v * pw, n: 3 }); [dmg, fl] = strike(a, d, .7, {}, t); }
      else {
        [dmg, fl] = strike(a, d, v, { ab: 1, pierce: fx === 'pierce', sure: fx === 'pierce' }, t);
        if (fx === 'stun' && fl !== 2) d.stun = true;
        if (fx === 'drain') hl = heal(a, dmg);
      }
    } else [dmg, fl] = strike(a, d, 1, {}, t);
    hl += heal(a, dmg * P(a, 'leech') + a.hp * P(a, 'regen'));
    const u = fell(d);
    push(i, dmg, fl, hl, tag);
    if (u === 'und') push(1 - i, 0, 5, 0, 'und');
    if (a.h <= 0 && fell(a) === 'und') push(i, 0, 5, 0, 'und');
  }
  const win = f[1].h <= 0 && f[0].h > 0 ? true : f[0].h <= 0 ? false : f[0].h / f[0].hp >= f[1].h / f[1].hp;
  return { win, log, first };
}

// ---- team battles: fighters and the fight ----
// A companion: the same base as every hero (dungeon power never counts), plus its companion kit.
function cstats(x, k) {
  let R = 0, E = 0, hp = 1, at = 1;
  (k || [0, 0, 0]).forEach((r, i) => { const p = CKIT[i]; R += p[0] * r; E += p[1] * r; hp += p[2] * r; at += p[3] * r; });
  return { hp: Math.round(rbase(x.c)[0] * hp), at: Math.round(rbase(x.c)[1] * at), E, R, c: x.c };
}
const ckOf = (row, id) => ((row.ck || {})[id] || '0.0.0').split('.').map(Number).slice(0, 3);
// The saved lineup as it will fight: [{id, n, c, s, lo}] with the hero ('you') filled in from the hero's row.
function team(row) {
  const tl = Array.isArray(row.tl) ? row.tl : [];
  return tl.map(e => e.id === 'you'
    ? { id: 'you', n: row.n, c: row.c, s: stats(row), lo: loadout(row), hero: 1 }
    : { id: e.id, n: e.n, c: e.c, s: cstats(e, ckOf(row, e.id)), lo: { a: [FREE[e.c]], p: [] }, k: ckOf(row, e.id) });
}
const hasTeam = row => Array.isArray(row.tl) && row.tl.length === 3;
function tfighter(t, row) {
  let f;
  if (t.hero) f = fighter(row);
  else {
    f = Object.assign({}, t.s);
    f.P = Object.assign({}, NATURE[t.c]);
    f.ab = [{ s: SKB[FREE[t.c]], v: SKB[FREE[t.c]].v[0], cd: 0 }];
  }
  return Object.assign(f, { h: f.hp, sh: 0, dot: [], weak: 0, wv: 0, ward: 0, wdv: 0, ev: 0, stun: false, und: f.P.undying || 0 });
}
// 3 vs 3. Sides take turns; on a side's turn its next standing fighter (Front, Middle, Back, round and round) acts.
// Log entries: [side, slot, target side, target slot, damage, flag, heal, tag, ...health of all six].
// Flags as in duels: 0 hit, 1 crit, 2 miss, 3 stunned, 4 poison ticking, 5 survives a killing blow.
function teamFight(A, B, rowA, rowB, rnd) {
  const T = [team(rowA).map(t => tfighter(t, rowA)), team(rowB).map(t => tfighter(t, rowB))];
  const log = [], first = rnd() < .5 ? 0 : 1, nx = [0, 0];
  const P = (x, k) => x.P[k] || 0, up = x => x.h > 0;
  const hps = () => T[0].concat(T[1]).map(x => Math.max(0, Math.round(x.h)));
  const push = (sd, i, ts, ti, d, fl, hl, tag) => log.push([sd, i, ts, ti, Math.round(d), fl, Math.round(hl), tag || ''].concat(hps()));
  const heal = (x, v) => { const h = Math.max(0, Math.min(x.hp - x.h, v)); x.h += h; return h; };
  const alive = sd => T[sd].map((x, i) => i).filter(i => up(T[sd][i]));
  function aim(a, sd) {
    const live = alive(sd); if (!live.length) return -1;
    // rogues slip past the front line to the weakest foe
    if (a.c === 'rogue') return live.slice().sort((x, y) => T[sd][x].h / T[sd][x].hp - T[sd][y].h / T[sd][y].hp)[0];
    let w = live.reduce((t, i) => t + TPOS[i], 0), r = rnd() * w;
    for (const i of live) { r -= TPOS[i]; if (r <= 0) return i; }
    return live[live.length - 1];
  }
  function strike(a, d, mult, o, t) {
    if (d.ev > 0) { d.ev--; return [0, 2]; }
    if (!o.sure && rnd() < .08 + P(d, 'dodge')) return [0, 2];
    const cr = rnd() < .1 + P(a, 'crit');
    let x = a.at * (.75 + .5 * rnd()) * mult * (cr ? (a.c === 'rogue' ? 1.8 : 1.5) : 1) * (1 + a.E / (a.E + 300));
    if (!o.pierce) x *= (1 - .5 * d.R / (d.R + 300)) * (1 - P(d, 'armor'));
    if (BEATS[a.c].includes(d.c)) x *= 1 + ADV; else if (BEATS[d.c].includes(a.c)) x *= 1 - ADV;
    if (a.weak > 0) x *= 1 - a.wv;
    if (d.ward > 0) { x *= 1 - d.wdv; d.ward--; }
    if (d.h < d.hp * .3) x *= 1 + P(a, 'execute');
    if (o.ab) x *= 1 + P(a, 'power');
    if (t >= 40) x *= 1.5; // a long battle: the crowd wants blood
    const ab = Math.min(d.sh, x); d.sh -= ab;
    d.h -= x - ab;
    if (P(d, 'reflect')) a.h -= x * P(d, 'reflect');
    return [x, cr ? 1 : 0];
  }
  const fell = x => { if (x.h > 0) return false; if (x.und) { x.h = x.hp * x.und; x.und = 0; return 'und'; } return true; };
  for (let t = 0; t < 120 && alive(0).length && alive(1).length; t++) {
    const sd = (t + first) % 2, os = 1 - sd;
    // the side's next standing fighter, in lineup order
    let i = -1; for (let k = 0; k < 3; k++) { const j = (nx[sd] + k) % 3; if (T[sd][j] && up(T[sd][j])) { i = j; break; } }
    if (i < 0) break; nx[sd] = (i + 1) % 3;
    const a = T[sd][i];
    if (a.dot.length) {
      let x = 0; for (const p of a.dot) { x += p.v; p.n--; } a.dot = a.dot.filter(p => p.n > 0);
      a.h -= x; const u = fell(a); push(os, -1, sd, i, x, 4, 0, 'dot');
      if (u === 'und') push(sd, i, sd, i, 0, 5, 0, 'und'); else if (u) continue;
    }
    if (a.stun) { a.stun = false; push(sd, i, sd, i, 0, 3, 0, 'stun'); continue; }
    for (const b of a.ab) if (b.cd > 0) b.cd--;
    if (a.weak > 0) a.weak--;
    const ti = aim(a, os); if (ti < 0) break;
    const d = T[os][ti];
    // the weakest standing teammate, for heals
    const low = alive(sd).map(j => T[sd][j]).sort((x, y) => x.h / x.hp - y.h / y.hp)[0];
    const b = a.ab.find(b => b.cd <= 0 && (b.s.fx === 'heal' ? low.h < low.hp * .7 : b.s.fx === 'shield' ? a.sh <= 0 : b.s.fx === 'ward' ? a.ward <= 0 : b.s.fx === 'evade' ? a.ev <= 0 : b.s.fx === 'weaken' ? d.weak <= 0 : b.s.fx === 'dot' ? !d.dot.length : true));
    let dmg = 0, fl = 0, hl = 0, tag = '', hs = sd, hi = ti, hts = os;
    if (b) {
      b.cd = b.s.cd; tag = b.s.id;
      const v = b.v, pw = 1 + P(a, 'power'), fx = b.s.fx;
      if (fx === 'heal') { hl = heal(low, low.hp * v * pw); hi = T[sd].indexOf(low); hts = sd; }
      else if (fx === 'shield' || fx === 'ward' || fx === 'evade') {
        if (fx === 'shield') a.sh = a.hp * v * pw; else if (fx === 'ward') { a.ward = 3; a.wdv = v; } else a.ev = v;
        [dmg, fl] = strike(a, d, .6, {}, t);
      }
      else if (fx === 'weaken') { d.weak = 4; d.wv = v; [dmg, fl] = strike(a, d, .8, {}, t); }
      else if (fx === 'dot') { d.dot.push({ v: a.at * v * pw, n: 3 }); [dmg, fl] = strike(a, d, .7, {}, t); }
      else {
        [dmg, fl] = strike(a, d, v, { ab: 1, pierce: fx === 'pierce', sure: fx === 'pierce' }, t);
        if (fx === 'stun' && fl !== 2) d.stun = true;
        if (fx === 'drain') hl = heal(a, dmg);
      }
    } else [dmg, fl] = strike(a, d, 1, {}, t);
    hl += heal(a, dmg * P(a, 'leech') + a.hp * P(a, 'regen'));
    const u = hts === os ? fell(d) : false;
    push(sd, i, hts, hi, dmg, fl, hl, tag);
    if (u === 'und') push(os, ti, os, ti, 0, 5, 0, 'und');
    if (a.h <= 0 && fell(a) === 'und') push(sd, i, sd, i, 0, 5, 0, 'und');
  }
  const share = sd => T[sd].reduce((t, x) => t + Math.max(0, x.h) / x.hp, 0);
  const win = !alive(1).length && alive(0).length ? true : !alive(0).length ? false : share(0) >= share(1);
  return { win, log, first };
}

// ---- storage ----
const n = (i, k, d) => i && i[k] ? +i[k].N : d;
const js = (i, k) => { try { return i && i[k] ? JSON.parse(i[k].S) : null; } catch (e) { return null; } };
const row0 = i => ({ id: i.pid.S, n: i.n.S, c: i.c.S, sd: i.sd.S, lv: n(i, 'lv', 1), m: n(i, 'm', 0), v: n(i, 'v', 0), k: (i.k ? i.k.S : '0.0.0.0.0').split('.').map(Number),
  r: n(i, 'r', START), pk: n(i, 'pk', START), w: n(i, 'w', 0), l: n(i, 'l', 0), dw: n(i, 'dw', 0), dl: n(i, 'dl', 0), ll: n(i, 'll', 0), et: n(i, 'et', 0), fd: i.fd ? i.fd.S : '',
  sk: js(i, 'sk') || {}, lo: js(i, 'lo'), rp: js(i, 'rp') || {},
  // team battles: lineup, companion kits, team rating, best, wins, losses, defense wins/losses, first team win day, repeats
  tl: js(i, 'tl'), ck: js(i, 'ck') || {}, tr: n(i, 'tr', START), tp: n(i, 'tp', START), tw: n(i, 'tw', 0), tx: n(i, 'tx', 0),
  tdw: n(i, 'tdw', 0), tdl: n(i, 'tdl', 0), tfd: i.tfd ? i.tfd.S : '', trp: js(i, 'trp') || {},
  // v141: Ring Mastery ranks, the season this row's ratings belong to, last season's final ratings, season awards
  ms: n(i, 'ms', 0), sn: i.sn ? i.sn.S : SEASON0, ps: n(i, 'ps', 0), psn: i.psn ? i.psn.S : '', tps: n(i, 'tps', 0), sa: i.sa ? i.sa.SS : [] });
const row = i => season(row0(i), Date.now());
// A row from an older season: keep its final ratings as last season's, and move both ratings halfway back to 1,000.
function season(x, now) {
  const cur = seasonOf(now);
  if (x.sn !== cur) Object.assign(x, { ps: x.r, tps: x.tr, psn: x.sn, r: soft(x.r), tr: soft(x.tr), sn: cur });
  return x;
}
// The season fields to write with any rating change, so the stored row is in the current season too. k is the rating the
// caller writes itself ('r' or 'tr'); the other one is written here, already reset if the season changed.
const sv = (x, k) => { const o = k === 'r' ? 'tr' : 'r'; return [', sn = :sn, ps = :ps, psn = :psn, tps = :tps, ' + o + ' = :so', { ':sn': S(x.sn), ':ps': N(x.ps), ':psn': S(x.psn || '-'), ':tps': N(x.tps), ':so': N(x[o]) }]; };
// Repeat duels (John): fighting the same hero again within a day pays less each time, then nothing.
// rc (per foe, for the client): [duels in the last day, when a rematch pays something again].
const REP = [1, .5, .25, 0], REPW = 864e5;
const reps = (x, now, key) => { const o = {}, src = x[key || 'rp'] || {}; for (const k in src) { const t = src[k].filter(v => now - v < REPW); if (t.length) o[k] = t; } return o; };
const pub = x => ({ id: x.id, n: x.n, c: x.c, sd: x.sd, lv: x.lv, r: x.r, w: x.w, l: x.l, k: x.k, s: stats(x), lo: loadout(x), sk: owned(x) });
// A team as others see it: the three fighters with their Ring stats, plus team rating and record.
const tpub = x => ({ id: x.id, n: x.n, c: x.c, sd: x.sd, tr: x.tr, tw: x.tw, tx: x.tx, t: team(x).map(t => ({ id: t.id, n: t.n, c: t.c, s: t.s, k: t.k, lo: t.lo, hero: t.hero || 0 })) });
const TEAM = { kit: CKIT, max: CMAX, gate: 1300, pos: TPOS };
const MATCH = { beats: BEATS, adv: ADV, why: WHY, nature: NATURE };
const SKILLS = SK.map(s => ({ id: s.id, c: s.c, k: s.k, n: s.n, fx: s.fx, v: s.v, cd: s.cd || 0 }));

exports.handler = async (e) => {
  const cl = e.requestContext.authorizer && e.requestContext.authorizer.jwt && e.requestContext.authorizer.jwt.claims;
  if (!cl || !cl.sub) return res(401, { error: 1 });
  const me = pidOf(cl.sub), now = Date.now(), rk = e.routeKey, K = p => ({ pid: S(p) });
  let b = {}; try { b = JSON.parse(e.isBase64Encoded ? Buffer.from(e.body || '', 'base64').toString() : e.body || '{}'); } catch (x) { return res(400, { error: 1 }); }
  const get = async (t, p) => (await db.send(new D.GetItemCommand({ TableName: t, Key: K(p), ConsistentRead: true }))).Item;
  const up = (p, x, v, c) => db.send(new D.UpdateItemCommand(Object.assign({ TableName: T, Key: K(p), UpdateExpression: x, ExpressionAttributeValues: v, ReturnValues: 'ALL_NEW' }, c ? { ConditionExpression: c } : {})));
  // A season award: noted on the Ring row, and its cosmetics added to the wallet (by the hero's account) when WALLETS is set.
  const award = async (pid, s, p) => {
    await db.send(new D.UpdateItemCommand({ TableName: T, Key: K(pid), UpdateExpression: 'ADD sa :a', ConditionExpression: 'attribute_exists(pid)', ExpressionAttributeValues: { ':a': { SS: [s + ':' + p] } } })).catch(() => {});
    const items = (AWARD.find(a => p <= a[0]) || [0, []])[1], h = W && items.length && await get(H, pid);
    if (h && h.u) await db.send(new D.UpdateItemCommand({ TableName: W, Key: { userId: h.u }, UpdateExpression: 'ADD own :o', ExpressionAttributeValues: { ':o': { SS: items } } })).catch(e => console.log('award wallet', pid, e.name));
  };
  const mine = x => { if (!x) return x; const rp = reps(x, now), rc = {}; for (const k in rp) { const t = rp[k].slice().sort((x, y) => x - y); rc[k] = [t.length, t[Math.max(0, t.length - REP.length + 1)] + REPW]; } const tp = reps(x, now, 'trp'), trc = {}; for (const k in tp) { const t = tp[k].slice().sort((x, y) => x - y); trc[k] = [t.length, t[Math.max(0, t.length - REP.length + 1)] + REPW]; }
    return Object.assign(pub(x), { ms: x.ms, sa: x.sa, pk: x.pk, dw: x.dw, dl: x.dl, ll: x.ll, en: Math.max(0, EMAX - Math.ceil(Math.max(0, x.et - now) / EINT)), et: x.et, rc, rep: REP,
      tl: x.tl || null, ck: x.ck, tr: x.tr, tp: x.tp, tw: x.tw, tx: x.tx, tdw: x.tdw, tdl: x.tdl, team: hasTeam(x) ? tpub(x).t : [], trc }); };
  try {
    if (rk === 'GET /arena') {
      const all = [];
      let k; do { const r = await db.send(new D.ScanCommand({ TableName: T, ExclusiveStartKey: k })); all.push(...(r.Items || []).filter(i => i.n).map(row)); k = r.LastEvaluatedKey; } while (k);
      const m = all.find(x => x.id === me), r0 = m ? m.r : START;
      const cur = seasonOf(now), prev = prevSeason(cur);
      let last = null;
      if (prev >= SEASON0) {
        const rec = await get(T, 'season#' + prev);
        if (rec) last = js(rec, 'top') || [];
        else {
          const fin = all.filter(x => x.psn === prev && x.w + x.l > 0).sort((x, y) => y.ps - x.ps || y.w - x.w).slice(0, 25).map((x, i) => ({ id: x.id, n: x.n, c: x.c, r: x.ps, p: i + 1 }));
          try {
            await db.send(new D.UpdateItemCommand({ TableName: T, Key: K('season#' + prev), UpdateExpression: 'SET #t = :t, at = :a', ConditionExpression: 'attribute_not_exists(pid)', ExpressionAttributeNames: { '#t': 'top' }, ExpressionAttributeValues: { ':t': S(JSON.stringify(fin)), ':a': N(now) } }));
            for (const f of fin) await award(f.id, prev, f.p);
          } catch (x) { if (x.name !== 'ConditionalCheckFailedException') throw x; }
          last = fin;
        }
      }
      const top = all.slice().sort((x, y) => y.r - x.r || y.w - x.w), foes = all.filter(x => x.id !== me).sort((x, y) => Math.abs(x.r - r0) - Math.abs(y.r - r0)).slice(0, 8);
      for (let i = foes.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [foes[i], foes[j]] = [foes[j], foes[i]]; }
      // team battles: teams that have a full lineup, nearest team rating first
      const teams = all.filter(hasTeam), t0 = m ? m.tr : START;
      const fought = x => x.tw + x.tx + x.tdw + x.tdl > 0, ttop = teams.filter(fought).sort((x, y) => y.tr - x.tr || y.tw - x.tw);
      const tfoes = teams.filter(x => x.id !== me).sort((x, y) => Math.abs(x.tr - t0) - Math.abs(y.tr - t0)).slice(0, 8);
      for (let i = tfoes.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [tfoes[i], tfoes[j]] = [tfoes[j], tfoes[i]]; }
      return res(200, { me: mine(m), rank: m ? top.indexOf(m) + 1 : 0, n: all.length, top: top.slice(0, 25).map(pub), foes: foes.slice(0, 4).map(pub), skills: SKILLS, skcost: SKCOST, slots: [LO_A, LO_P], match: MATCH,
        tfoes: tfoes.slice(0, 4).map(tpub), ttop: ttop.slice(0, 25).map(tpub), trank: m && hasTeam(m) && fought(m) ? ttop.indexOf(m) + 1 : 0, tn: ttop.length, tkit: TEAM, mastery: MS,
        season: { no: seasonNo(cur), ends: seasonEnd(cur), awards: AWARD.map(a => [a[0], a[1]]), last: last ? { no: seasonNo(prev), top: last.slice(0, 10) } : null } });
    }
    if (rk === 'PUT /arena') {
      // The build: the hero's name, class and banner come from the hero board. m and v (the log of dungeon damage
      // and health) are still stored for old clients but no longer count in any fight (v141).
      const h = await get(H, me), c = x => Math.max(0, Math.min(60, Math.round((+x || 0) * 10) / 10));
      if (!h || !h.name || h.ban) return res(403, { error: 'hero' });
      // The team lineup (optional): exactly the hero ('you') once and two different companions of the player's own,
      // each with class, name and the log of its own damage and health. Player heroes (16 hex ids) can never join.
      let tl = null;
      if (Array.isArray(b.tl)) {
        const ids = b.tl.map(e => e && String(e.id || ''));
        const ok = b.tl.length === 3 && ids.filter(x => x === 'you').length === 1 && new Set(ids).size === 3 &&
          b.tl.every(e => e && (e.id === 'you' || (CID.test(String(e.id)) && CLS.includes(e.c) && cname(e.n))));
        if (!ok) return res(400, { error: 'team' });
        tl = b.tl.map(e => e.id === 'you' ? { id: 'you' } : { id: String(e.id), n: cname(e.n), c: e.c, m: c(e.m), v: c(e.v) });
      }
      const r = await up(me, 'SET n = :n, c = :c, sd = :s, lv = :l, m = :m, v = :v, t = :t, r = if_not_exists(r, :r), pk = if_not_exists(pk, :r)' + (tl ? ', tl = :tl, tr = if_not_exists(tr, :r), tp = if_not_exists(tp, :r)' : ''),
        Object.assign({ ':n': h.name, ':c': h.cls, ':s': h.sd || S('unsworn'), ':l': h.lv, ':m': N(c(b.m)), ':v': N(c(b.v)), ':t': N(now), ':r': N(START) }, tl ? { ':tl': S(JSON.stringify(tl)) } : {}));
      return res(200, { me: mine(row(r.Attributes)) });
    }
    const x = await get(T, me), my = x && row(x);
    if (!my) return res(409, { error: 'build' });
    if (rk === 'POST /arena/kit' && b.cid != null) {
      // A companion Ring kit rank. Only for a companion in the saved team lineup; the kit stays with that companion.
      const id = String(b.cid), p = Math.floor(b.p);
      if (!CID.test(id) || !(p >= 0 && p < 3) || !(my.tl || []).some(e => e.id === id)) return res(400, { error: 'piece' });
      const k = ckOf(my, id), r = k[p];
      if (r >= CMAX) return res(400, { error: 'piece' });
      if (my.tp < cgate(r)) return res(409, { error: 'rating', need: cgate(r) });
      if (my.ll < ccost(r)) return res(409, { error: 'laurels' });
      const ck = Object.assign({}, my.ck); k[p]++; ck[id] = k.join('.');
      // at most 40 companions keep a kit; the oldest unused ones drop off
      const keys = Object.keys(ck); if (keys.length > 40) for (const x of keys) { if (Object.keys(ck).length <= 40) break; if (!(my.tl || []).some(e => e.id === x)) delete ck[x]; }
      const a = await up(me, 'SET ck = :k, ll = ll - :c', { ':k': S(JSON.stringify(ck)), ':c': N(ccost(r)), ':o': S(JSON.stringify(my.ck)) }, 'll >= :c AND (ck = :o OR attribute_not_exists(ck))');
      return res(200, { me: mine(row(a.Attributes)) });
    }
    if (rk === 'POST /arena/kit' && b.p === 'm') {
      // A Ring Mastery rank: only once every kit piece is at rank 15.
      if (!my.k.every(r => r >= 15) || my.ms >= MS.max) return res(400, { error: 'piece' });
      if (my.ll < MS.cost) return res(409, { error: 'laurels' });
      const a = await up(me, 'SET ms = :m, ll = ll - :c', { ':m': N(my.ms + 1), ':c': N(MS.cost), ':o': N(my.ms) }, 'll >= :c AND (ms = :o OR attribute_not_exists(ms))');
      return res(200, { me: mine(row(a.Attributes)) });
    }
    if (rk === 'POST /arena/kit') {
      const p = Math.floor(b.p), r = my.k[p];
      if (!(p >= 0 && p < 5) || r >= 15) return res(400, { error: 'piece' });
      if (my.pk < gate(r)) return res(409, { error: 'rating', need: gate(r) });
      if (my.ll < cost(r)) return res(409, { error: 'laurels' });
      const k = my.k.slice(); k[p]++;
      const a = await up(me, 'SET k = :k, ll = ll - :c', { ':k': S(k.join('.')), ':c': N(cost(r)), ':o': S(my.k.join('.')) }, 'll >= :c AND (k = :o OR attribute_not_exists(k))');
      return res(200, { me: mine(row(a.Attributes)) });
    }
    if (rk === 'POST /arena/skill') {
      // Learn a Ring skill or raise it one rank. Only skills of the hero's own class.
      const s = SKB[String(b.id || '')], o = owned(my);
      if (!s || s.c !== my.c) return res(400, { error: 'skill' });
      const r = o[s.id] || 0;
      if (r >= 3) return res(409, { error: 'max' });
      const c = SKCOST[r];
      if (my.ll < c) return res(409, { error: 'laurels' });
      const sk = Object.assign({}, my.sk, { [s.id]: r + 1 });
      const a = await up(me, 'SET sk = :s, ll = ll - :c', { ':s': S(JSON.stringify(sk)), ':c': N(c), ':o': S(JSON.stringify(my.sk)) }, 'll >= :c AND (sk = :o OR attribute_not_exists(sk))');
      return res(200, { me: mine(row(a.Attributes)) });
    }
    if (rk === 'POST /arena/loadout') {
      // The skills the hero takes into duels: abilities in priority order, then passives.
      const o = owned(my), ok = (ids, k, nn) => Array.isArray(ids) && ids.length <= nn && ids.every(id => o[id] && SKB[id].c === my.c && SKB[id].k === k) && new Set(ids).size === ids.length;
      if (!ok(b.a, 'a', LO_A) || !ok(b.p, 'p', LO_P)) return res(400, { error: 'loadout' });
      const a = await up(me, 'SET lo = :l', { ':l': S(JSON.stringify({ a: b.a, p: b.p })) });
      return res(200, { me: mine(row(a.Attributes)) });
    }
    if (rk === 'POST /arena/fight' && b.team) {
      const id = String(b.id || ''), y = /^[0-9a-f]{16}$/.test(id) && id !== me && await get(T, id), fo = y && row(y);
      if (!fo || !hasTeam(fo)) return res(404, { error: 'foe' });
      if (!hasTeam(my)) return res(409, { error: 'team' });
      if (my.et > now + (EMAX - 1) * EINT) return res(429, { error: 'tired' });
      let s = crypto.randomBytes(4).readUInt32LE(0);
      const rnd = () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
      const d = teamFight(null, null, my, fo, rnd), w = d.win ? 1 : 0, ex = 1 / (1 + Math.pow(10, (fo.tr - my.tr) / 400));
      const rp = reps(my, now, 'trp'), seen = (rp[id] || []).length, q = REP[Math.min(seen, REP.length - 1)];
      rp[id] = (rp[id] || []).concat(now); const ks = Object.keys(rp).sort((x, y) => Math.max(...rp[y]) - Math.max(...rp[x])).slice(0, 40), rp2 = {}; ks.forEach(k => rp2[k] = rp[k]);
      const pq = palQuiet(now, my.c, fo.c) ? 0 : 1;
      const dr = Math.round(32 * (w - ex) * q * pq), fr = Math.round(16 * (w - ex) * q * pq), day = new Date(now).toISOString().slice(0, 10), fw = w && q > 0 && my.tfd !== day;
      // Team battles pay a little more than duels (John OK'd 27 Nov 2026): a win 10, up to 14 against a stronger team, a loss 4, the day's first team win +10.
      const ll = Math.round((w ? 10 + Math.min(4, Math.max(0, Math.round((fo.tr - my.tr) / 50))) : 4) * q) + (fw ? 10 : 0), dl = Math.round(2 * q);
      const [sx, sv1] = sv(my, 'tr'), [fx2, sv2] = sv(fo, 'tr');
      const a = await up(me, 'SET tr = :r, tp = :pk, et = :et, tfd = :fd, trp = :rp' + sx + ' ADD ' + (w ? 'tw' : 'tx') + ' :one, ll :ll',
        { ...sv1, ':r': N(Math.max(0, my.tr + dr)), ':pk': N(Math.max(my.tp, my.tr + dr)), ':et': N(Math.max(my.et, now) + EINT), ':fd': S(fw ? day : my.tfd || '-'), ':rp': S(JSON.stringify(rp2)), ':one': N(1), ':ll': N(ll), ':o': N(my.et) }, 'et = :o OR attribute_not_exists(et)');
      await up(id, 'SET tr = :r' + fx2 + ' ADD ' + (w ? 'tdl :one' : 'tdw :one, ll :d'), Object.assign({ ...sv2, ':r': N(Math.max(0, fo.tr - fr)), ':one': N(1) }, w ? {} : { ':d': N(dl) }));
      return res(200, { team: 1, win: !!w, log: d.log, first: d.first, dr, ll, fw: !!fw, q, a: tpub(my), b: tpub(fo), me: mine(row(a.Attributes)) });
    }
    if (rk === 'POST /arena/fight') {
      const id = String(b.id || ''), y = /^[0-9a-f]{16}$/.test(id) && id !== me && await get(T, id), fo = y && row(y);
      if (!fo) return res(404, { error: 'foe' });
      if (my.et > now + (EMAX - 1) * EINT) return res(429, { error: 'tired' });
      let s = crypto.randomBytes(4).readUInt32LE(0);
      const rnd = () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
      const d = duel(my, fo, rnd), w = d.win ? 1 : 0, ex = 1 / (1 + Math.pow(10, (fo.r - my.r) / 400));
      // Repeat duels against the same hero within a day: full, half, a quarter, then nothing (rating and Laurels, both sides).
      const rp = reps(my, now), seen = (rp[id] || []).length, q = REP[Math.min(seen, REP.length - 1)];
      rp[id] = (rp[id] || []).concat(now); const ks = Object.keys(rp).sort((x, y) => Math.max(...rp[y]) - Math.max(...rp[x])).slice(0, 40), rp2 = {}; ks.forEach(k => rp2[k] = rp[k]);
      const pq = palQuiet(now, my.c, fo.c) ? 0 : 1;
      const dr = Math.round(32 * (w - ex) * q * pq), fr = Math.round(16 * (w - ex) * q * pq), day = new Date(now).toISOString().slice(0, 10), fw = w && q > 0 && my.fd !== day;
      // Laurels are a grind on purpose (John): a win is 8, up to 12 against a stronger hero, a loss 3, the day's first win +10.
      const ll = Math.round((w ? 8 + Math.min(4, Math.max(0, Math.round((fo.r - my.r) / 50))) : 3) * q) + (fw ? 10 : 0), dl = Math.round(2 * q);
      const [sx, sv1] = sv(my, 'r'), [fx2, sv2] = sv(fo, 'r');
      const a = await up(me, 'SET r = :r, pk = :pk, et = :et, fd = :fd, rp = :rp' + sx + ' ADD ' + (w ? 'w' : 'l') + ' :one, ll :ll',
        { ...sv1, ':r': N(Math.max(0, my.r + dr)), ':pk': N(Math.max(my.pk, my.r + dr)), ':et': N(Math.max(my.et, now) + EINT), ':fd': S(fw ? day : my.fd || '-'), ':rp': S(JSON.stringify(rp2)), ':one': N(1), ':ll': N(ll), ':o': N(my.et) }, 'et = :o OR attribute_not_exists(et)');
      await up(id, 'SET r = :r' + fx2 + ' ADD ' + (w ? 'dl :one' : 'dw :one, ll :d'), Object.assign({ ...sv2, ':r': N(Math.max(0, fo.r - fr)), ':one': N(1) }, w ? {} : { ':d': N(dl) }));
      return res(200, { win: !!w, log: d.log, first: d.first, dr, ll, fw: !!fw, q, a: pub(my), b: pub(fo), me: mine(row(a.Attributes)) });
    }
  } catch (x) { if (x.name === 'ConditionalCheckFailedException') return res(409, { error: 'state' }); throw x; }
  return res(404, { error: 1 });
};
exports._test = { RBASE, MS, seasonOf, prevSeason, seasonNo, seasonEnd, season, row0, duel, stats, owned, loadout, SK, BEATS, teamFight, team, cstats, CKIT, ccost, cgate, tpub };
