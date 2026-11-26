# Lanternhold v128: let the plain word "discord" through chat (invite links stay blocked).
# Paste into AWS CloudShell (us-east-1). Needs John's go. Backs up the live code to ~/lhbak first. Safe to run twice.
set -e
F=lanternhold-chat; TS=$(date +%Y%m%d%H%M)
mkdir -p ~/lhbak ~/lhv128 && cd ~/lhv128 && rm -rf chat && mkdir chat
curl -s "$(aws lambda get-function --function-name $F --query Code.Location --output text)" -o ~/lhbak/$F-$TS.zip
echo "backup: ~/lhbak/$F-$TS.zip"
cd chat && unzip -q ~/lhbak/$F-$TS.zip
OLD='const LINK = /(https?:|www\.|\.(com|net|org|gg|io|ly|xyz)\b|discord)/i;'
NEW='const LINK = /(https?:|www\.|\.(com|net|org|gg|io|ly|xyz)\b|discord(app)?\s*\.\s*\w|discord\s*\/)/i;'
if grep -qF "$NEW" index.js; then echo "already done"; exit 0; fi
[ "$(grep -cF "$OLD" index.js)" = "1" ] || { echo "STOP: the live chat code is not what we expected. Nothing changed."; exit 1; }
python3 - "$OLD" "$NEW" <<'PY'
import sys; p='index.js'; s=open(p).read(); s=s.replace(sys.argv[1], sys.argv[2], 1); open(p,'w').write(s)
PY
node --check index.js && zip -qr ../chat.zip . && cd ..
aws lambda update-function-code --function-name $F --zip-file fileb://chat.zip >/dev/null
aws lambda wait function-updated --function-name $F
echo "done. Undo: aws lambda update-function-code --function-name $F --zip-file fileb://$HOME/lhbak/$F-$TS.zip"
