# Lanternhold v143 server (John, 27 Nov 2026). Paste into AWS CloudShell (us-east-1). Needs John's go.
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
# Code comes from GitHub at commit a49c7ffc55397da2af419a3dcb7f4c9747a24581 and is checked by md5. Each live function is checked to be the
# version we expect BEFORE anything changes and backed up to ~/lhbak. Safe to run twice. Prints the undo commands.
set -e
TS=$(date -u +%Y%m%d%H%M); mkdir -p ~/lhbak ~/lhv143 && cd ~/lhv143
RAW=https://raw.githubusercontent.com/johnmink1/lanternhold/a49c7ffc55397da2af419a3dcb7f4c9747a24581/infra/deploy/v143/dist/
echo "1/4 fetching the new code"
curl -sf -o lanternhold-np.js "${RAW}lanternhold-np.js" && [ "$(md5sum < lanternhold-np.js | cut -c1-32)" = "9cd44e79b52788854869e7d43e75a3db" ] || { echo "lanternhold-np: download failed or changed. Stopping; nothing changed."; exit 1; }
curl -sf -o lanternhold-save.js "${RAW}lanternhold-save.js" && [ "$(md5sum < lanternhold-save.js | cut -c1-32)" = "f2fca1c06fb6513e007f0db5af574597" ] || { echo "lanternhold-save: download failed or changed. Stopping; nothing changed."; exit 1; }
curl -sf -o lanternhold-perks.js "${RAW}lanternhold-perks.js" && [ "$(md5sum < lanternhold-perks.js | cut -c1-32)" = "01e58b21553de038e0caffcb5ee062c9" ] || { echo "lanternhold-perks: download failed or changed. Stopping; nothing changed."; exit 1; }
curl -sf -o lanternhold-gulp.js "${RAW}lanternhold-gulp.js" && [ "$(md5sum < lanternhold-gulp.js | cut -c1-32)" = "2fd2b1852838e0e573d01a6ada10d217" ] || { echo "lanternhold-gulp: download failed or changed. Stopping; nothing changed."; exit 1; }
curl -sf -o lanternhold-goblin.js "${RAW}lanternhold-goblin.js" && [ "$(md5sum < lanternhold-goblin.js | cut -c1-32)" = "5c2fd35457e7314d1534c8589e7d6949" ] || { echo "lanternhold-goblin: download failed or changed. Stopping; nothing changed."; exit 1; }
curl -sf -o lanternhold-exchange.js "${RAW}lanternhold-exchange.js" && [ "$(md5sum < lanternhold-exchange.js | cut -c1-32)" = "5d12513b79458f5c57735334a680e105" ] || { echo "lanternhold-exchange: download failed or changed. Stopping; nothing changed."; exit 1; }
curl -sf -o lanternhold-market.js "${RAW}lanternhold-market.js" && [ "$(md5sum < lanternhold-market.js | cut -c1-32)" = "fe897df0371ef3a41848d151be2e93f4" ] || { echo "lanternhold-market: download failed or changed. Stopping; nothing changed."; exit 1; }
curl -sf -o lanternhold-mail.js "${RAW}lanternhold-mail.js" && [ "$(md5sum < lanternhold-mail.js | cut -c1-32)" = "0904fdf1af80472ed01324ddea8f9594" ] || { echo "lanternhold-mail: download failed or changed. Stopping; nothing changed."; exit 1; }
echo "2/4 checking the live code"
for F in lanternhold-np lanternhold-save lanternhold-perks lanternhold-gulp lanternhold-goblin lanternhold-exchange lanternhold-market lanternhold-mail; do
  aws lambda get-function --function-name $F >/dev/null 2>&1 || { echo "$F missing. Stopping; nothing changed."; exit 1; }
  curl -s -o ~/lhbak/$F-$TS.zip "$(aws lambda get-function --function-name $F --query Code.Location --output text)"
  rm -rf live-$F && mkdir live-$F && unzip -q -o ~/lhbak/$F-$TS.zip -d live-$F
done
chk() { # chk <function> <strings...>: live code must contain each string, or already be this version
  F=$1; shift
  [ "$(md5sum < live-$F/index.js | cut -c1-32)" = "$(md5sum < $F.js | cut -c1-32)" ] && { echo "$F: already v143"; return; }
  for s in "$@"; do grep -qF -- "$s" live-$F/index.js || { echo "$F: live code is not the version this script expects (no '$s'). Stopping; nothing changed. Ask Claude."; exit 1; }; done
}
chk lanternhold-np 'first#np1' return
chk lanternhold-save 'snap#' hcslot
chk lanternhold-perks 'POST /sigils/earn' cognito:groups
chk lanternhold-gulp 'gulpd#' 'untrusted gold'
chk lanternhold-goblin 'gob#' claimed
chk lanternhold-exchange 'sigsell#'
chk lanternhold-market 'mkt#' '#hc'
chk lanternhold-mail payment hc
echo "3/4 exchange settings"
ST=$(aws dynamodb describe-table --table-name lanternhold-saves --query Table.TableArn --output text)
TC=$(aws lambda get-function-configuration --function-name lanternhold-market --query Environment.Variables.TRUSTCHECK --output text)
[ "$TC" = "None" ] && TC=log
ROLE=$(aws lambda get-function-configuration --function-name lanternhold-exchange --query Role --output text | awk -F/ '{print $NF}')
aws iam put-role-policy --role-name "$ROLE" --policy-name lanternhold-v143-SAVES --policy-document "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Action\":\"dynamodb:GetItem\",\"Resource\":\"$ST\"}]}"
aws lambda get-function-configuration --function-name lanternhold-exchange --query Environment > env-ex.json
cp env-ex.json ~/lhbak/lanternhold-exchange-env-$TS.json
python3 -c "import json; e=json.load(open('env-ex.json')) or {}; v=e.get('Variables',{}); v['SAVES']='lanternhold-saves'; v['TRUSTCHECK']='$TC'; print(json.dumps({'Variables':v}))" > env2-ex.json
aws lambda update-function-configuration --function-name lanternhold-exchange --environment file://env2-ex.json >/dev/null
aws lambda wait function-updated --function-name lanternhold-exchange
echo "exchange: SAVES set, TRUSTCHECK=$TC"
echo "4/4 updating code"
UNDO="\naws lambda update-function-configuration --function-name lanternhold-exchange --environment file://$HOME/lhbak/lanternhold-exchange-env-$TS.json"
for F in lanternhold-np lanternhold-save lanternhold-perks lanternhold-gulp lanternhold-goblin lanternhold-exchange lanternhold-market lanternhold-mail; do
  rm -f $F.zip index.js && cp $F.js index.js && zip -qj $F.zip index.js
  aws lambda update-function-code --function-name $F --zip-file fileb://$F.zip >/dev/null
  aws lambda wait function-updated --function-name $F
  UNDO="$UNDO\naws lambda update-function-code --function-name $F --zip-file fileb://$HOME/lhbak/$F-$TS.zip"
  echo "updated $F"
done
aws dynamodb update-continuous-backups --table-name lanternhold-saves --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true --query ContinuousBackupsDescription.PointInTimeRecoveryDescription.PointInTimeRecoveryStatus --output text
B=https://nyu3u8gc73.execute-api.us-east-1.amazonaws.com
for p in "np?hc=1" np sigils gulp market mail "save?hc=1"; do curl -s -o /dev/null -w "$p %{http_code}\n" "$B/$p"; done
echo "(401 means up and asking for sign-in)"
echo -e "done. Undo:$UNDO"
