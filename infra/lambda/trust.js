// Server-checked gold for things that leave a hero's save (v140, John 27 Nov 2026). Market buys, Mail payments and
// Gulp morsels move gold the server cannot see: the game takes it from the save. A hero with faked gold could pay
// another hero (or an alt) with it, and that gold would then be real. So each payment is checked against the gold the
// server trusts this hero to have: the last save that passed the save check (ck on the save row) plus what the hero
// could have earned since (savecheck.trustedGold). TRUSTCHECK=log only logs; TRUSTCHECK=on refuses (HTTP 402).
// credit() adds the gold a sale brings in to the seller's crd, which the save check allows for on their next save.
const D = require('@aws-sdk/client-dynamodb');
const SC = require('./savecheck');
const MODE = process.env.TRUSTCHECK || 'log';
async function canPay(db, SAVES, sub, gold, what) {
  if (!SAVES || !(gold > 0) || MODE === 'off') return true;
  try {
    const r = (await db.send(new D.GetItemCommand({ TableName: SAVES, Key: { userId: { S: sub } }, ProjectionExpression: 'ck' }))).Item;
    const ck = r && r.ck ? JSON.parse(r.ck.S) : null, max = SC.trustedGold(ck, Date.now());
    if (gold <= max) return true;
    console.log('untrusted gold', what, sub.slice(0, 8), 'pays', gold, 'trusted', max, MODE);
    return MODE !== 'on';
  } catch (e) { console.log('trust', e.name || e); return true; }
}
async function credit(db, SAVES, sub, gold) {
  if (!SAVES || !(gold > 0)) return;
  try { await db.send(new D.UpdateItemCommand({ TableName: SAVES, Key: { userId: { S: sub } }, UpdateExpression: 'ADD crd :g', ConditionExpression: 'attribute_exists(userId)', ExpressionAttributeValues: { ':g': { N: String(Math.floor(gold)) } } })); }
  catch (e) { if (e.name !== 'ConditionalCheckFailedException') console.log('credit', e.name); }
}
module.exports = { canPay, credit };
