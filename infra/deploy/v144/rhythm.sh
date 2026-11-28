# Lanternhold v144 rhythm watch (John, 27 Nov 2026: catch scripts that click on a timer, e.g. every 15 min for the
# world boss, and bug abuse). Paste into AWS CloudShell (us-east-1). Needs John's go.
# FLAG ONLY: nothing is refused, blocked or taken away; players land on the Admin tab's Watch list for a person to review.
# Changes:
#   save       reads the game's input summary on each sync (bh), keeps a 3-day button history on the save row (rh),
#              writes flags to the activity log (rf) and the Watch list (lanternhold-trade, pk flagidx)
#   worldboss  keeps each player's assault times on their boss row (ts) and flags cooldown-beat / fixed-beat / no-sleep
#              assaults, machine-even strikes and scores over the ceiling; new env TRADE + one inline policy
#              (lanternhold-rhythm: PutItem on lanternhold-trade)
#   admin      GET /admin/flags (Watch list) and POST /admin/flags/clear (Reviewed, audited); 2 new routes
# Safe before or after the v144 game: an older game sends no summary and is simply not checked.
# Off switch: set RHYTHM=off on lanternhold-save (the boss part only writes flags).
# Code comes from GitHub at commit 32dc84e and is checked by md5. Each live function is checked to be the
# version we expect BEFORE anything changes and backed up to ~/lhbak. Safe to run twice. Prints the undo commands.
set -e
TS=$(date -u +%Y%m%d%H%M); mkdir -p ~/lhbak ~/lhv144 && cd ~/lhv144
RAW=https://raw.githubusercontent.com/johnmink1/lanternhold/32dc84e/infra/deploy/v144/dist/
echo "1/4 fetching the new code"
curl -sf -o lanternhold-save.js "${RAW}lanternhold-save.js" && [ "$(md5sum < lanternhold-save.js | cut -c1-32)" = "f86fc06aa5dc48c051e4764426160a7e" ] || { echo "lanternhold-save: download failed or changed. Stopping; nothing changed."; exit 1; }
curl -sf -o lanternhold-worldboss.js "${RAW}lanternhold-worldboss.js" && [ "$(md5sum < lanternhold-worldboss.js | cut -c1-32)" = "905ddfdaf905820df1781a0d902c7c0d" ] || { echo "lanternhold-worldboss: download failed or changed. Stopping; nothing changed."; exit 1; }
curl -sf -o lanternhold-admin.js "${RAW}lanternhold-admin.js" && [ "$(md5sum < lanternhold-admin.js | cut -c1-32)" = "5a59319520fa1412f5cc59e68cec1975" ] || { echo "lanternhold-admin: download failed or changed. Stopping; nothing changed."; exit 1; }
echo "2/4 checking the live code"
for F in lanternhold-save lanternhold-worldboss lanternhold-admin; do
  aws lambda get-function --function-name $F >/dev/null 2>&1 || { echo "$F missing. Stopping; nothing changed."; exit 1; }
  curl -s -o ~/lhbak/$F-$TS.zip "$(aws lambda get-function --function-name $F --query Code.Location --output text)"
  aws lambda get-function-configuration --function-name $F --query Environment > ~/lhbak/$F-env-$TS.json
  rm -rf live-$F && mkdir live-$F && unzip -q -o ~/lhbak/$F-$TS.zip -d live-$F
done
chk() { # chk <function> <strings...>: live code must contain each string, or already be this version
  F=$1; shift
  [ "$(md5sum < live-$F/index.js | cut -c1-32)" = "$(md5sum < $F.js | cut -c1-32)" ] && { echo "$F: already v144"; return; }
  for s in "$@"; do grep -qF -- "$s" live-$F/index.js || { echo "$F: live code is not the version this script expects (no '$s'). Stopping; nothing changed. Ask Claude."; exit 1; }; done
}
chk lanternhold-save 'snap#' heldidx hcslot
chk lanternhold-worldboss 'POST /boss/hit' 'POST /boss/claim'
chk lanternhold-admin 'alog#' 'POST /admin/restore'
echo "3/4 permissions, settings and routes"
TARN=$(aws dynamodb describe-table --table-name lanternhold-trade --query Table.TableArn --output text)
WROLE=$(aws lambda get-function-configuration --function-name lanternhold-worldboss --query Role --output text | sed 's#.*/##')
aws iam put-role-policy --role-name "$WROLE" --policy-name lanternhold-rhythm --policy-document "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Action\":\"dynamodb:PutItem\",\"Resource\":\"$TARN\"}]}"
ENV=$(aws lambda get-function-configuration --function-name lanternhold-worldboss --query Environment.Variables --output json)
NEWENV=$(echo "$ENV" | python3 -c 'import json,sys; v=json.load(sys.stdin) or {}; v["TRADE"]="lanternhold-trade"; print(json.dumps({"Variables": v}))')
aws lambda update-function-configuration --function-name lanternhold-worldboss --environment "$NEWENV" >/dev/null
aws lambda wait function-updated --function-name lanternhold-worldboss
API=$(aws apigatewayv2 get-apis --query "Items[?Name=='lanternhold-api'].ApiId | [0]" --output text)
[ "$API" = "None" ] && API=nyu3u8gc73
INT=$(aws apigatewayv2 get-routes --api-id $API --query "Items[?RouteKey=='GET /admin/players'].Target" --output text)
AUTH=$(aws apigatewayv2 get-routes --api-id $API --query "Items[?RouteKey=='GET /admin/players'].AuthorizerId" --output text)
for RK in 'GET /admin/flags' 'POST /admin/flags/clear'; do
  if [ -z "$(aws apigatewayv2 get-routes --api-id $API --query "Items[?RouteKey=='$RK'].RouteId" --output text)" ]; then
    aws apigatewayv2 create-route --api-id $API --route-key "$RK" --authorization-type JWT --authorizer-id "$AUTH" --target "$INT" >/dev/null; echo "route $RK added"
  else echo "route $RK already there"; fi
done
echo "4/4 updating code"
UNDO="\naws iam delete-role-policy --role-name $WROLE --policy-name lanternhold-rhythm\naws lambda update-function-configuration --function-name lanternhold-worldboss --environment file://$HOME/lhbak/lanternhold-worldboss-env-$TS.json"
for F in lanternhold-save lanternhold-worldboss lanternhold-admin; do
  rm -f $F.zip index.js && cp $F.js index.js && zip -qj $F.zip index.js
  aws lambda update-function-code --function-name $F --zip-file fileb://$F.zip >/dev/null
  aws lambda wait function-updated --function-name $F
  UNDO="$UNDO\naws lambda update-function-code --function-name $F --zip-file fileb://$HOME/lhbak/$F-$TS.zip"
  echo "updated $F"
done
B=https://nyu3u8gc73.execute-api.us-east-1.amazonaws.com
for p in save boss admin/flags; do curl -s -o /dev/null -w "$p %{http_code}\n" "$B/$p"; done
echo "(401 means up and asking for sign-in)"
echo -e "done. Undo (the two new routes can stay; they only answer admins):$UNDO"
