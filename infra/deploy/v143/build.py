"""Builds infra/deploy/v143/server.sh and the bundles it deploys (infra/deploy/v143/dist/*.js).
Usage: COMMIT=<sha of the commit holding dist/> ESBUILD='npx --yes esbuild' python3 infra/deploy/v143/build.py
Run once to make dist/, commit it, then run again with COMMIT set to that commit and commit the script."""
import hashlib, os, subprocess, shlex
here = os.path.dirname(os.path.abspath(__file__)); infra = os.path.join(here, '..', '..')
esb = shlex.split(os.environ.get('ESBUILD', 'esbuild')); commit = os.environ.get('COMMIT', 'COMMIT')
# function: (source, strings the LIVE code must contain, so only the version we expect is replaced)
FN = {
  'lanternhold-np':       ('lambda/np.js',       ['first#np1', 'return']),
  'lanternhold-save':     ('lambda/save.js',     ['snap#', 'hcslot']),
  'lanternhold-perks':    ('lambda/perks.js',    ['POST /sigils/earn', 'cognito:groups']),
  'lanternhold-gulp':     ('lambda/gulp.js',     ['gulpd#', 'untrusted gold']),
  'lanternhold-goblin':   ('lambda/goblin.js',   ['gob#', 'claimed']),
  'lanternhold-exchange': ('lambda/exchange.js', ['sigsell#']),
  'lanternhold-market':   ('lambda/market.js',   ['mkt#', '#hc']),
  'lanternhold-mail':     ('lambda/mail.js',     ['payment', 'hc']),
}
os.makedirs(os.path.join(here, 'dist'), exist_ok=True)
rows = []
for fn, (src, fp) in FN.items():
    code = subprocess.check_output(esb + [os.path.join(infra, src), '--bundle', '--minify', '--platform=node', '--format=cjs', '--external:@aws-sdk/*', '--log-level=warning'])
    open(os.path.join(here, 'dist', fn + '.js'), 'wb').write(code)
    rows.append((fn, hashlib.md5(code).hexdigest(), fp, len(code)))
raw = 'https://raw.githubusercontent.com/johnmink1/lanternhold/' + commit + '/infra/deploy/v143/dist/'
names = ' '.join(r[0] for r in rows)
out = ['''# Lanternhold v143 server (John, 27 Nov 2026). Paste into AWS CloudShell (us-east-1). Needs John's go.
# Run it BEFORE the v143 game goes live (the Hardcore NP+ button waits for this server's answer).
#   np        each save slot has its own NP+ tier: ?hc=1 reads/writes hnp/hnpAt on the account wallet, stamps the
#             Hardcore hero row and clears Hardcore trades; +25 Sigils to the account; no First Dawn in Hardcore
#   save      a Hardcore save's NP+ check reads hnp from the account wallet
#   perks     Sigils found in Hardcore bank while the Hardcore save is being played (daily limits stay per account)
#   gulp, goblin   Hardcore NP+ heroes feed and fight as their Hardcore hero (gold checked against the Hardcore save)
#   exchange  shut to Hardcore heroes; a buy is checked against the gold the server trusts (like Market and Mail).
#             Gets env SAVES (+ TRUSTCHECK copied from lanternhold-market) and read access to the saves table.
#   market, mail   Hardcore NP+ markets (mkt#<cls>#hc#<tier>); no item above deepest floor + 10 (raised by NP+)
#   saves table    point-in-time recovery switched on (35 days of rolling backups; a few cents a month)
# Code comes from GitHub at commit ''' + commit + ''' and is checked by md5. Each live function is checked to be the
# version we expect BEFORE anything changes and backed up to ~/lhbak. Safe to run twice. Prints the undo commands.
set -e
TS=$(date -u +%Y%m%d%H%M); mkdir -p ~/lhbak ~/lhv143 && cd ~/lhv143
RAW=''' + raw + '''
echo "1/4 fetching the new code"''']
for fn, md5, fp, n in rows:
    out.append('curl -sf -o ' + fn + '.js "${RAW}' + fn + '.js" && [ "$(md5sum < ' + fn + '.js | cut -c1-32)" = "' + md5 + '" ] || { echo "' + fn + ': download failed or changed. Stopping; nothing changed."; exit 1; }')
out.append('''echo "2/4 checking the live code"
for F in ''' + names + '''; do
  aws lambda get-function --function-name $F >/dev/null 2>&1 || { echo "$F missing. Stopping; nothing changed."; exit 1; }
  curl -s -o ~/lhbak/$F-$TS.zip "$(aws lambda get-function --function-name $F --query Code.Location --output text)"
  rm -rf live-$F && mkdir live-$F && unzip -q -o ~/lhbak/$F-$TS.zip -d live-$F
done
chk() { # chk <function> <strings...>: live code must contain each string, or already be this version
  F=$1; shift
  [ "$(md5sum < live-$F/index.js | cut -c1-32)" = "$(md5sum < $F.js | cut -c1-32)" ] && { echo "$F: already v143"; return; }
  for s in "$@"; do grep -qF -- "$s" live-$F/index.js || { echo "$F: live code is not the version this script expects (no '$s'). Stopping; nothing changed. Ask Claude."; exit 1; }; done
}''')
for fn, md5, fp, n in rows:
    out.append('chk ' + fn + ' ' + ' '.join(shlex.quote(x) for x in fp))
out.append('''echo "3/4 exchange settings"
ST=$(aws dynamodb describe-table --table-name lanternhold-saves --query Table.TableArn --output text)
TC=$(aws lambda get-function-configuration --function-name lanternhold-market --query Environment.Variables.TRUSTCHECK --output text)
[ "$TC" = "None" ] && TC=log
ROLE=$(aws lambda get-function-configuration --function-name lanternhold-exchange --query Role --output text | awk -F/ '{print $NF}')
aws iam put-role-policy --role-name "$ROLE" --policy-name lanternhold-v143-SAVES --policy-document "{\\"Version\\":\\"2012-10-17\\",\\"Statement\\":[{\\"Effect\\":\\"Allow\\",\\"Action\\":\\"dynamodb:GetItem\\",\\"Resource\\":\\"$ST\\"}]}"
aws lambda get-function-configuration --function-name lanternhold-exchange --query Environment > env-ex.json
cp env-ex.json ~/lhbak/lanternhold-exchange-env-$TS.json
python3 -c "import json; e=json.load(open('env-ex.json')) or {}; v=e.get('Variables',{}); v['SAVES']='lanternhold-saves'; v['TRUSTCHECK']='$TC'; print(json.dumps({'Variables':v}))" > env2-ex.json
aws lambda update-function-configuration --function-name lanternhold-exchange --environment file://env2-ex.json >/dev/null
aws lambda wait function-updated --function-name lanternhold-exchange
echo "exchange: SAVES set, TRUSTCHECK=$TC"
echo "4/4 updating code"
UNDO="\\naws lambda update-function-configuration --function-name lanternhold-exchange --environment file://$HOME/lhbak/lanternhold-exchange-env-$TS.json"
for F in ''' + names + '''; do
  rm -f $F.zip index.js && cp $F.js index.js && zip -qj $F.zip index.js
  aws lambda update-function-code --function-name $F --zip-file fileb://$F.zip >/dev/null
  aws lambda wait function-updated --function-name $F
  UNDO="$UNDO\\naws lambda update-function-code --function-name $F --zip-file fileb://$HOME/lhbak/$F-$TS.zip"
  echo "updated $F"
done
aws dynamodb update-continuous-backups --table-name lanternhold-saves --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true --query ContinuousBackupsDescription.PointInTimeRecoveryDescription.PointInTimeRecoveryStatus --output text
B=https://nyu3u8gc73.execute-api.us-east-1.amazonaws.com
for p in "np?hc=1" np sigils gulp market mail "save?hc=1"; do curl -s -o /dev/null -w "$p %{http_code}\\n" "$B/$p"; done
echo "(401 means up and asking for sign-in)"
echo -e "done. Undo:$UNDO"''')
open(os.path.join(here, 'server.sh'), 'w').write('\n'.join(out) + '\n')
for fn, md5, fp, n in rows: print(fn, n, 'bytes', md5)
