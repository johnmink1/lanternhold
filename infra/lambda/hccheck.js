// Hardcore save check (v142, John 27 Nov 2026). Pure: no AWS. A Hardcore hero's deaths and lost gear must never come
// undone, so the server keeps what it last accepted (hcd on the save row: run start, death/fall/wipe/lost counts and
// the last LOST_KEEP lost item ids) and refuses a save that goes backwards:
//   - a Normal save sent to the Hardcore slot, or a Hardcore save sent to the Normal slot (no carrying a hero across);
//   - the same run (same `created`) with fewer deaths, hero falls, wipes or lost pieces than before;
//   - a lost item id back in the bag (recovered Lost Pack pieces always get new ids).
// A save with a different `created` is a new run (Settings > Erase progress); the stored rst stamp already refuses
// copies made before an erase.
const LOST_KEEP = 400;
const num = v => (typeof v === 'number' && isFinite(v) && v > 0 ? Math.floor(v) : 0);
function summary(sv) {
  const h = sv && sv.hc && typeof sv.hc === 'object' ? sv.hc : null;
  if (!h) return null;
  return { c: num(sv.created), n: num(h.n), hf: num(h.hf), w: num(h.w), ln: num(h.lostN), lost: Array.isArray(h.lost) ? h.lost.filter(x => typeof x === 'string').slice(-LOST_KEEP) : [] };
}
// hc: the request is for the Hardcore slot. prev: the stored hcd (or null). Returns { ok, why, hcd }.
function check(hc, sv, prev) {
  if (!sv) return { ok: true, hcd: prev };
  const cur = summary(sv);
  if (!hc) return cur ? { ok: false, why: 'hcslot' } : { ok: true };
  if (!cur) return { ok: false, why: 'normal' };
  if (prev && prev.c === cur.c) {
    for (const k of ['n', 'hf', 'w', 'ln']) if (cur[k] < (prev[k] || 0)) return { ok: false, why: 'back-' + k };
    const gone = new Set(prev.lost || []), bag = Array.isArray(sv.bag) ? sv.bag : [];
    if (gone.size && bag.some(x => x && gone.has(x.uid))) return { ok: false, why: 'lost-back' };
    const lost = [...new Set((prev.lost || []).concat(cur.lost))].slice(-LOST_KEEP);
    return { ok: true, hcd: Object.assign({}, cur, { lost }) };
  }
  return { ok: true, hcd: cur };
}
module.exports = { check, summary, LOST_KEEP };
