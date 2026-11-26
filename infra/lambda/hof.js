// Lanternhold Hall of Fame (v131, John, 26 Nov 2026: "a Hall of Fame section ... Start to NP+1 (time), most net worth
// (gold), best in class (power level + gear rating), boss kills"). GET /hof, public like GET /leaderboard.
// It reads the public hero rows only: name, class, power level (lv), NP+ tier and time (np/npAt, stamped by np.js),
// c0 (first start time the server saw) and hf (record numbers save.js copies from each synced save). Banned heroes
// and heroes unseen for 60 days are left out. Hidden feats are never counted (save.js drops them), and nothing here
// says who was first to NP+1. Top 3 per category; the answer is kept for 2 minutes.
const { DynamoDBClient, ScanCommand } = require('@aws-sdk/client-dynamodb');
const db = new DynamoDBClient({});
const T = process.env.HEROES, CLS = ['tank', 'healer', 'rogue', 'mage', 'necro'];
let body = '', at = 0;
const top = (rows, val, asc) => rows.map(r => [r, val(r)]).filter(x => x[1] > 0)
  .sort((a, b) => (asc ? a[1] - b[1] : b[1] - a[1]) || a[0].ts - b[0].ts).slice(0, 3).map(([r, v]) => ({ name: r.name, cls: r.cls, v }));
exports.handler = async () => {
  if (!body || Date.now() - at > 120000) {
    const items = []; let k;
    do { const r = await db.send(new ScanCommand({ TableName: T, ExclusiveStartKey: k })); items.push(...(r.Items || [])); k = r.LastEvaluatedKey; } while (k);
    const cut = Date.now() - 60 * 864e5, rows = [];
    for (const i of items) {
      if (!i.name || i.ban || !i.hf || !i.seen || +i.seen.N < cut) continue;
      let h; try { h = JSON.parse(i.hf.S); } catch (e) { continue; }
      const c0 = i.c0 ? +i.c0.N : 0, np = i.np ? +i.np.N : 0;
      rows.push({ name: i.name.S, cls: i.cls ? i.cls.S : '', lv: i.lv ? +i.lv.N : 0, np, ts: c0 || Date.now(), h,
        fast: np >= 1 && h.n1 > c0 && c0 > 0 ? h.n1 - c0 : 0 });
    }
    const out = {
      fast: top(rows, r => r.fast, true),
      rich: top(rows, r => r.h.g),
      boss: top(rows, r => r.h.bk),
      // Ties go to power level, never to who got there first, so this never points at the First Dawn.
      np: rows.filter(r => r.np > 0).sort((a, b) => b.np - a.np || b.lv - a.lv).slice(0, 3).map(r => ({ name: r.name, cls: r.cls, v: r.np })),
      kills: top(rows, r => r.h.ki),
      earned: top(rows, r => r.h.ge),
      feats: top(rows, r => r.h.ft),
      time: top(rows, r => r.h.pt),
      cls: {}, n: rows.length,
    };
    for (const c of CLS) {
      const b = rows.filter(r => r.cls === c).sort((a, z) => z.lv - a.lv || (z.h.gr || 0) - (a.h.gr || 0) || a.ts - z.ts)[0];
      if (b) out.cls[c] = { name: b.name, lv: b.lv, gr: b.h.gr || 0 };
    }
    body = JSON.stringify(out); at = Date.now();
  }
  return { statusCode: 200, headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=120' }, body };
};
