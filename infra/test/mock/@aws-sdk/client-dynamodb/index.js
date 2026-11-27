// In-memory stand-in for the DynamoDB client, enough for the save/admin/trust tests (infra/test). Not for production.
const T = global.__DDB = global.__DDB || {};
const keyOf = (t, k) => JSON.stringify(Object.keys(k).sort().map(n => [n, k[n]]));
const tab = n => T[n] || (T[n] = new Map());
class Cmd { constructor(i) { this.input = i; } }
const names = ['GetItemCommand', 'PutItemCommand', 'UpdateItemCommand', 'DeleteItemCommand', 'QueryCommand', 'ScanCommand', 'TransactWriteItemsCommand', 'BatchWriteItemCommand'];
const E = {}; for (const n of names) E[n] = class extends Cmd {}; E.GetItemCommand.prototype.op = 'get'; E.PutItemCommand.prototype.op = 'put'; E.UpdateItemCommand.prototype.op = 'update';
E.DeleteItemCommand.prototype.op = 'del'; E.QueryCommand.prototype.op = 'query'; E.ScanCommand.prototype.op = 'scan'; E.TransactWriteItemsCommand.prototype.op = 'tx';
const val = (v, vals) => v.startsWith(':') ? vals[v] : null;
const nm = (n, names) => (n.startsWith('#') ? names[n] : n);
function cond(expr, item, vals, names) {
  if (!expr) return true;
  const or = expr.split(/\s+OR\s+/).length > 1 && !/\(/.test(expr) ? expr.split(/\s+OR\s+/) : null;
  // split top-level AND
  const parts = []; let d = 0, cur = '';
  for (const tok of expr.split(/(\(|\)|\s+AND\s+)/)) { if (tok === '(') d++; if (tok === ')') d--; if (/^\s+AND\s+$/.test(tok) && d === 0) { parts.push(cur); cur = ''; } else cur += tok; }
  parts.push(cur);
  return parts.every(p => {
    p = p.trim(); if (p.startsWith('(') && p.endsWith(')')) p = p.slice(1, -1);
    return p.split(/\s+OR\s+/).some(q => {
      q = q.trim(); let m;
      if ((m = q.match(/^attribute_not_exists\((.+)\)$/))) return !(nm(m[1], names) in item);
      if ((m = q.match(/^attribute_exists\((.+)\)$/))) return nm(m[1], names) in item;
      if ((m = q.match(/^(\S+)\s*(<=|=|<|>)\s*(\S+)$/))) {
        const a = item[nm(m[1], names)], b = vals[m[3]]; if (!a) return false;
        const x = a.N != null ? +a.N : a.S, y = b.N != null ? +b.N : b.S;
        return m[2] === '=' ? x === y : m[2] === '<=' ? x <= y : m[2] === '<' ? x < y : x > y;
      }
      throw new Error('mock cond ' + q);
    });
  });
}
function update(item, expr, vals, names) {
  const secs = expr.split(/\b(SET|ADD|REMOVE)\b/).map(s => s.trim()).filter(Boolean);
  for (let i = 0; i < secs.length; i += 2) {
    const kind = secs[i], body = secs[i + 1];
    for (const c of body.split(/,(?![^(]*\))/).map(s => s.trim())) {
      if (kind === 'SET') { const [a, b] = c.split('=').map(s => s.trim()); let m;
        if ((m = b.match(/^if_not_exists\((\S+),\s*(\S+)\)\s*([+-])\s*(\S+)$/))) { const k = nm(m[1], names), base = k in item ? +item[k].N : +vals[m[2]].N; item[nm(a, names)] = { N: String(m[3] === '+' ? base + +vals[m[4]].N : base - +vals[m[4]].N) }; }
        else if ((m = b.match(/^(\S+)\s*([+-])\s*(:\S+)$/))) { const k = nm(m[1], names), base = k in item ? +item[k].N : 0; item[nm(a, names)] = { N: String(m[2] === '+' ? base + +vals[m[3]].N : base - +vals[m[3]].N) }; }
        else if ((m = b.match(/^if_not_exists\((\S+),\s*(\S+)\)$/))) { if (!(nm(a, names) in item)) item[nm(a, names)] = vals[m[2]]; }
        else item[nm(a, names)] = vals[b]; }
      if (kind === 'ADD') { const [a, b] = c.split(/\s+/); const k = nm(a, names), v = vals[b]; if (v.SS) item[k] = { SS: [...new Set([...(item[k] ? item[k].SS : []), ...v.SS])] }; else item[k] = { N: String((item[k] ? +item[k].N : 0) + +v.N) }; }
      if (kind === 'REMOVE') delete item[nm(c, names)];
    }
  }
}
class DynamoDBClient {
  async send(c) {
    const i = c.input, t = i.TableName && tab(i.TableName);
    if (c.op === 'get') { const it = t.get(keyOf(i.TableName, i.Key)); return { Item: it ? JSON.parse(JSON.stringify(it)) : undefined }; }
    if (c.op === 'put') { const k = {}; for (const n of global.__KEYS[i.TableName]) k[n] = i.Item[n]; const old = t.get(keyOf(i.TableName, k)) || {};
      if (!cond(i.ConditionExpression, old, i.ExpressionAttributeValues || {}, i.ExpressionAttributeNames || {})) { const e = new Error('cond'); e.name = 'ConditionalCheckFailedException'; throw e; }
      t.set(keyOf(i.TableName, k), JSON.parse(JSON.stringify(i.Item))); return {}; }
    if (c.op === 'update') { const kk = keyOf(i.TableName, i.Key), old = t.get(kk), it = JSON.parse(JSON.stringify(old || i.Key));
      if (!cond(i.ConditionExpression, old || {}, i.ExpressionAttributeValues || {}, i.ExpressionAttributeNames || {})) { const e = new Error('cond'); e.name = 'ConditionalCheckFailedException'; throw e; }
      update(it, i.UpdateExpression, i.ExpressionAttributeValues || {}, i.ExpressionAttributeNames || {}); t.set(kk, it); return { Attributes: it }; }
    if (c.op === 'del') { t.delete(keyOf(i.TableName, i.Key)); return {}; }
    if (c.op === 'query') { const km = (i.KeyConditionExpression || 'pk = :p').match(/^(\w+)\s*=\s*(:\w+)$/), kn = km ? km[1] : 'pk', pk = i.ExpressionAttributeValues[km ? km[2] : ':p'].S; let it = [...t.values()].filter(x => x[kn] && x[kn].S === pk).sort((a, b) => (a.sk || a.s || {}).S < (b.sk || b.s || {}).S ? -1 : 1);
      if (i.ScanIndexForward === false) it.reverse(); if (i.Limit) it = it.slice(0, i.Limit); return { Items: JSON.parse(JSON.stringify(it)), Count: it.length }; }
    if (c.op === 'scan') return { Items: [...t.values()] };
    if (c.op === 'tx') { for (const x of i.TransactItems) { const [k, v] = Object.entries(x)[0]; await this.send(k === 'Put' ? new E.PutItemCommand(v) : k === 'Delete' ? new E.DeleteItemCommand(v) : new E.UpdateItemCommand(v)); } return {}; }
    throw new Error('mock op ' + c.op);
  }
}
module.exports = Object.assign({ DynamoDBClient }, E);
