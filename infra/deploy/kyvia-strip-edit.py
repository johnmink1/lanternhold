# Remove what an edited backup bought (John, 27 Nov 2026: "warn her, remove the gain and block the bug", "push immediately").
# Player pid e695f1f606a55c95 loaded a hand-edited backup between 22:51:50 and 22:52:28 UTC on 26 Nov (gold 227.7B -> 999.2T)
# and spent it on Gilded Caskets and camp renovations until ~23:03 UTC.
# Run in AWS CloudShell: python3 kyvia-strip-edit.py        (dry run: prints what would change)
#                        APPLY=1 python3 kyvia-strip-edit.py (backs up the save item to ~/lhbak, then writes the fix)
import os, json, gzip, base64, time, boto3
PID = 'e695f1f606a55c95'
T0 = 1795733510000   # 2026-11-26T22:51:50Z, last sync before the edited save
T1 = 1795734240000   # 2026-11-26T23:04:00Z, after the last casket opened
APPLY = os.environ.get('APPLY') == '1'
lam, ddb, idp = boto3.client('lambda'), boto3.client('dynamodb'), boto3.client('cognito-idp')
env = lam.get_function_configuration(FunctionName='lanternhold-admin')['Environment']['Variables']
SAVES, HEROES, TRADE, POOL = env['SAVES'], env['HEROES'], env['TRADE'], env['POOL']
hero = ddb.get_item(TableName=HEROES, Key={'pid': {'S': PID}})['Item']
user = hero['u']['S']
sub = next(a['Value'] for a in idp.admin_get_user(UserPoolId=POOL, Username=user)['UserAttributes'] if a['Name'] == 'sub')
# gold and gold earned just before and just after the edit, from the activity log
def b36(n):
    d = '0123456789abcdefghijklmnopqrstuvwxyz'; o = ''
    while n: n, r = divmod(n, 36); o = d[r] + o
    return o
rows = ddb.query(TableName=TRADE, KeyConditionExpression='pk = :p AND sk BETWEEN :a AND :b', ExpressionAttributeValues={
    ':p': {'S': 'alog#' + PID}, ':a': {'S': b36(T0 - 3600000)}, ':b': {'S': b36(T1 + 3600000)}})['Items']
pass_rows = sorted(rows, key=lambda r: int(r['at']['N']))
before = [json.loads(r['s']['S']) for r in pass_rows if int(r['at']['N']) <= T0][-1]
after = [json.loads(r['s']['S']) for r in pass_rows if T0 < int(r['at']['N']) <= T1][0]
item = ddb.get_item(TableName=SAVES, Key={'userId': {'S': sub}})['Item']
raw = item['data']['S']; gz = raw.startswith('gz1:')
s = json.loads(gzip.decompress(base64.b64decode(raw[4:])).decode() if gz else raw)
def uid_ms(u):
    try: return int(str(u)[:8], 36)
    except Exception: return 0
gone = [it for it in s.get('bag', []) if T0 <= uid_ms(it.get('uid', '')) <= T1 and it.get('rar') != 'common']
gone_ids = {it['uid'] for it in gone}
reno = {k: v for k, v in (s.get('reno') or {}).items() if T0 <= v <= T1}
cur = {k: v for k, v in (s.get('curios') or {}).items() if T0 <= v <= T1}
worn = [(m, p) for m, slots in (s.get('gear') or {}).items() for p, u in slots.items() if u in gone_ids]
fake_earned = after['ge'] - before['ge']
print('player', hero.get('name', {}).get('S'), 'save gz' if gz else 'save plain', 'updated', item['updated']['N'])
print('gold now', s.get('gold'), '-> +', before['g'], '(her real gold before the edit)')
print('goldEarned', s['stats'].get('goldEarned'), '-> -', fake_earned)
print('remove', len(gone), 'items:', sorted({(it.get('rar'), 'curio' if it.get('cu') else it.get('slot')) for it in gone}))
print('worn among them:', worn)
print('renovations to undo:', list(reno))
print('curios to undo:', list(cur))
if not APPLY: print('dry run only. APPLY=1 to write.'); raise SystemExit
os.makedirs(os.path.expanduser('~/lhbak'), exist_ok=True)
bk = os.path.expanduser('~/lhbak/kyvia-save-%s.json' % time.strftime('%Y%m%d%H%M'))
json.dump(item, open(bk, 'w')); print('backup', bk)
s['bag'] = [it for it in s['bag'] if it.get('uid') not in gone_ids]
for m, p in worn: del s['gear'][m][p]
for k in reno: del s['reno'][k]
for k in cur: del s['curios'][k]
s['gold'] = (s.get('gold') or 0) + before['g']
s['stats']['goldEarned'] = max(0, s['stats'].get('goldEarned', 0) - fake_earned)
s['stats']['playTime'] = s['stats'].get('playTime', 0) + 30  # newer than any copy on her device, so a reload takes this one
out = json.dumps(s, separators=(',', ':'))
data = 'gz1:' + base64.b64encode(gzip.compress(out.encode())).decode() if gz else out
now = int(time.time() * 1000)
ddb.update_item(TableName=SAVES, Key={'userId': {'S': sub}}, UpdateExpression='SET #d = :d, updated = :u, dv = :v',
    ExpressionAttributeNames={'#d': 'data'}, ExpressionAttributeValues={':d': {'S': data}, ':u': {'N': str(now)}, ':v': {'S': 'admin-fix'}})
print('written. Her open game pauses on its next save ("Playing on another device"); Play here loads this save.')
print('undo: python3 -c "import json,boto3;boto3.client(\'dynamodb\').put_item(TableName=\'%s\',Item=json.load(open(\'%s\')))"' % (SAVES, bk))
