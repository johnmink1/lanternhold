# Lanternhold v142 hotfix 2 (John, 27 Nov 2026): chat marks posts from a Hardcore hero (hc: 1) so the game shows an HC tag.
# Code-only update of lanternhold-chat. Paste into AWS CloudShell (us-east-1).
set -e
TS=$(date -u +%Y%m%d%H%M); mkdir -p ~/lhbak ~/lhhctag && cd ~/lhhctag
F=lanternhold-chat
curl -sf -o new.js "https://raw.githubusercontent.com/johnmink1/lanternhold/deb3c1ae2f4b7ccd4ae053ffc4a43cd34a49a041/infra/deploy/v142-hotfix-name/lanternhold-chat.js"
[ "$(md5sum < new.js | cut -c1-32)" = "0bcbdf7ab517b1273462d1cc58134805" ] || { echo "download failed or changed. Stopping; nothing changed."; exit 1; }
curl -s -o ~/lhbak/$F-$TS.zip "$(aws lambda get-function --function-name $F --query Code.Location --output text)"
rm -rf live && mkdir live && unzip -q -o ~/lhbak/$F-$TS.zip -d live
LIVE=$(md5sum < live/index.js | cut -c1-32)
if [ "$LIVE" = "0bcbdf7ab517b1273462d1cc58134805" ]; then echo "already done"; exit 0; fi
[ "$LIVE" = "e4986763f0a8aead4a227cd7134c608f" ] || { echo "live $F is not the v142 version ($LIVE). Stopping; nothing changed. Ask Claude."; exit 1; }
rm -f f.zip index.js && cp new.js index.js && zip -qj f.zip index.js
aws lambda update-function-code --function-name $F --zip-file fileb://f.zip >/dev/null
aws lambda wait function-updated --function-name $F
curl -s -o /dev/null -w "chat %{http_code} (401 = up)\n" https://nyu3u8gc73.execute-api.us-east-1.amazonaws.com/chat
echo "done. Undo: aws lambda update-function-code --function-name $F --zip-file fileb://$HOME/lhbak/$F-$TS.zip"
