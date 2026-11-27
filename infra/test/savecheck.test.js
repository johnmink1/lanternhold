// node infra/test/savecheck.test.js — save check rules (infra/lambda/savecheck.js): honest play passes, planted cheats are held.
const assert = require('assert'), SC = require('../lambda/savecheck.js');
const H = 3600e3;
function honest(n, opt) {
  // a hero at floor f earning `mult` foe-gold multiples a second, saving every 75 s
  opt = opt || {}; let ck = null, t = Date.parse('2026-11-27T00:00:00Z'), s = { gold: 1e6, hxp: 5e6, maxFloorEver: opt.f || 120, wbTok: 0, created: 1, np: opt.np || 0, stats: { goldEarned: 1e9, playTime: 3600 }, bag: new Array(100), reno: {}, curios: {} };
  for (let i = 0; i < n; i++) {
    t += 75e3; const g = (opt.mult || 50) * SC.foeGold(s.maxFloorEver) * (1 + s.np) * 75 * (0.5 + Math.random());
    s = JSON.parse(JSON.stringify(s)); s.bag = new Array(s.bag.length + (Math.random() < 0.1 ? 1 : 0)); s.gold += g; s.stats.goldEarned += g; s.stats.playTime += 75; s.hxp += 2e4;
    if (i % 40 === 39) s.maxFloorEver++;
    const c = SC.check(ck, s, t, { dv: 'd1' }); assert.ok(c.ok, 'honest sync ' + i + ' held: ' + JSON.stringify(c.flags)); ck = c.ck;
  }
  return { ck, s, t };
}
const clone = o => { const x = JSON.parse(JSON.stringify(o)); x.bag = new Array(o.bag.length); return x; };
const run = (name, fn) => { fn(); console.log('ok  ' + name); };
const base = honest(300);
run('honest play over 6 h passes (300 syncs)', () => {});
run('8 h away then back passes', () => {
  const s = clone(base.s), g = 50 * SC.foeGold(s.maxFloorEver) * 8 * 3600 * 0.25; s.gold += g; s.stats.goldEarned += g;
  assert.ok(SC.check(base.ck, s, base.t + 8 * H, { dv: 'd1' }).ok);
});
run('edited gold is held (Kyvia 26 Nov)', () => {
  const s = clone(base.s); s.gold = 999e15; s.stats.playTime += 75;
  const c = SC.check(base.ck, s, base.t + 75e3, { dv: 'd1' }); assert.ok(!c.ok); assert.equal(c.flags[0].k, 'gold');
});
run('edited gold and gold earned together are held', () => {
  const s = clone(base.s); s.gold += 1e15; s.stats.goldEarned += 1e15; s.stats.playTime += 75;
  assert.ok(!SC.check(base.ck, s, base.t + 75e3, { dv: 'd1' }).ok);
});
run('a backup code with less play time and more gold is held', () => {
  const s = clone(base.s); s.stats.playTime -= 3000; s.gold = 5e14;
  assert.ok(!SC.check(base.ck, s, base.t + 75e3, { dv: 'd1' }).ok);
});
run('a new game id cannot carry big progress', () => {
  const s = clone(base.s); s.created = 2; s.stats.playTime = 100;
  const c = SC.check(base.ck, s, base.t + 75e3, { dv: 'd1' }); assert.ok(!c.ok); assert.ok(c.flags.some(f => f.k === 'floor'));
});
run('a real new game passes', () => {
  const s = { gold: 50, hxp: 100, maxFloorEver: 3, created: 2, np: 0, stats: { goldEarned: 60, playTime: 60 }, bag: [], reno: {}, curios: {} };
  assert.ok(SC.check(base.ck, s, base.t + 75e3, { dv: 'd2', claim: true }).ok);
});
run('floor skip is held', () => { const s = clone(base.s); s.maxFloorEver += 80; s.stats.playTime += 75; assert.ok(SC.check(base.ck, s, base.t + 75e3, { dv: 'd1' }).flags.some(f => f.k === 'floor')); });
run('hero XP edit is held', () => { const s = clone(base.s); s.hxp *= 50; s.stats.playTime += 75; assert.ok(SC.check(base.ck, s, base.t + 75e3, { dv: 'd1' }).flags.some(f => f.k === 'xp')); });
run('copied items are held', () => { const s = clone(base.s); s.bag = new Array(base.s.bag.length + 500); s.stats.playTime += 75; assert.ok(SC.check(base.ck, s, base.t + 75e3, { dv: 'd1' }).flags.some(f => f.k === 'bag')); });
run('sped-up game is held', () => { const s = clone(base.s); s.stats.playTime += 3600; assert.ok(SC.check(base.ck, s, base.t + 75e3, { dv: 'd1' }).flags.some(f => f.k === 'speed')); });
run('Rift token edit is held', () => { const s = clone(base.s); s.wbTok = 500; s.stats.playTime += 75; assert.ok(SC.check(base.ck, s, base.t + 75e3, { dv: 'd1' }).flags.some(f => f.k === 'tok')); });
run('NP+ tier the server never granted is held', () => { const s = clone(base.s); s.np = 3; assert.ok(SC.check(base.ck, s, base.t + 75e3, { dv: 'd1', np: 1 }).flags.some(f => f.k === 'np')); });
run('a renovation bought without spending gold is held', () => {
  const s = clone(base.s); s.reno = { garden: 1, tower: 1 }; s.stats.playTime += 75;
  const c = SC.check(base.ck, s, base.t + 75e3, { dv: 'd1' }); assert.ok(c.flags.some(f => f.k === 'buy'), JSON.stringify(c.flags));
});
run('a renovation paid for passes', () => {
  const hist = base.ck.h[0], med = hist.slice().sort((a, b) => a - b)[hist.length >> 1], ih = med * SC.foeGold(base.s.maxFloorEver) * 3600;
  const s = clone(base.s); s.reno = { tower: 1 }; s.stats.playTime += 75;
  s.gold = Math.max(0, base.s.gold - 24 * ih * 0.5); const c = SC.check(base.ck, s, base.t + 75e3, { dv: 'd1' });
  // with too little bank the buy is only fair if the gold was there: give the bank first
  const b2 = clone(base.s); b2.gold = 30 * ih; const c0 = SC.check(base.ck, b2, base.t + 3 * H, { dv: 'd1' });
  const s2 = clone(b2); s2.reno = { tower: 1 }; s2.gold = 6 * ih; s2.stats.playTime += 75; assert.ok(c0.ok, JSON.stringify(c0.flags));
  assert.ok(SC.check(c0.ck, s2, base.t + 3 * H + 75e3, { dv: 'd1' }).ok);
});
run('a Market sale credited by the server is allowed for', () => {
  const s = clone(base.s); s.gold += 1e16; s.stats.goldEarned += 1e16; s.stats.playTime += 75;
  assert.ok(SC.check(base.ck, s, base.t + 75e3, { dv: 'd1', crd: 1e16 }).ok);
});
run('an older copy is measured from an older point, then the main copy comes back cleanly', () => {
  // the older copy: play time from ~3 h ago, gold of that time
  const old = clone(base.s); old.stats.playTime -= 3 * 3600; old.gold = 1e6; old.stats.goldEarned -= 1e6;
  const c1 = SC.check(base.ck, old, base.t + 75e3, { dv: 'd2', claim: true }); assert.ok(c1.ok, JSON.stringify(c1.flags));
  const main = clone(base.s); main.stats.playTime += 150; const g = 50 * SC.foeGold(main.maxFloorEver) * 150; main.gold += g; main.stats.goldEarned += g;
  assert.ok(SC.check(c1.ck, main, base.t + 150e3, { dv: 'd1', claim: true }).ok);
});
run('trusted gold blocks paying 999T, allows honest bank', () => {
  assert.ok(SC.trustedGold(base.ck, base.t + 60e3) >= base.s.gold);
  assert.ok(SC.trustedGold(base.ck, base.t + 60e3) < 999e12);
});
run('first save of an account has no reference and passes', () => assert.ok(SC.check(null, base.s, base.t, {}).ok));
console.log('all save check tests passed');
