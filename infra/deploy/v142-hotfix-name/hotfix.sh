# Lanternhold v142 hotfix (John, 27 Nov 2026): a Hardcore hero may use the same name as the same account's Normal hero.
# Names stay unique between different players. Code-only update of lanternhold-heroes. Paste into AWS CloudShell (us-east-1).
set -e
TS=$(date -u +%Y%m%d%H%M); mkdir -p ~/lhbak ~/lhhcname && cd ~/lhhcname
F=lanternhold-heroes
curl -sf -o new.js "https://raw.githubusercontent.com/johnmink1/lanternhold/8e17cd774ee90beda6ff59b4433ffbe19b50c0c8/infra/deploy/v142-hotfix-name/lanternhold-heroes.js"
[ "$(md5sum < new.js | cut -c1-32)" = "c0394b83701824eebe89cb9e366c6294" ] || { echo "download failed or changed. Stopping; nothing changed."; exit 1; }
curl -s -o ~/lhbak/$F-$TS.zip "$(aws lambda get-function --function-name $F --query Code.Location --output text)"
rm -rf live && mkdir live && unzip -q -o ~/lhbak/$F-$TS.zip -d live
LIVE=$(md5sum < live/index.js | cut -c1-32)
if [ "$LIVE" = "c0394b83701824eebe89cb9e366c6294" ]; then echo "already fixed"; exit 0; fi
[ "$LIVE" = "00c3ed6fc55f18abecb8d8a5e7820973" ] || { echo "live $F is not the v142 version ($LIVE). Stopping; nothing changed. Ask Claude."; exit 1; }
rm -f f.zip index.js && cp new.js index.js && zip -qj f.zip index.js
aws lambda update-function-code --function-name $F --zip-file fileb://f.zip >/dev/null
aws lambda wait function-updated --function-name $F
curl -s -o /dev/null -w "heroes %{http_code} (401 = up)\n" https://nyu3u8gc73.execute-api.us-east-1.amazonaws.com/heroes
echo "done. Undo: aws lambda update-function-code --function-name $F --zip-file fileb://$HOME/lhbak/$F-$TS.zip"
