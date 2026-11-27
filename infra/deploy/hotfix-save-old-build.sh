# Hotfix (27 Nov 2026): an old game build sends no device id, and lanternhold-save let it save over an account that a
# newer device had claimed (Chipplin's 35 h save was replaced by a 6 h copy at 04:36 UTC). Now a save with no device id
# is refused (409 'moved') once the account has one. Patches the live code (v138 save, md5 7536e6a7...) in place and
# stops if the live code is anything else. Paste into AWS CloudShell (us-east-1).
set -e
F=lanternhold-save; TS=$(date -u +%Y%m%d%H%M)
mkdir -p ~/lhbak ~/lhsavefix && cd ~/lhsavefix && rm -f index.js save.zip
curl -s "$(aws lambda get-function --function-name $F --query Code.Location --output text)" -o ~/lhbak/$F-$TS.zip
echo "backup: ~/lhbak/$F-$TS.zip"
unzip -o -q ~/lhbak/$F-$TS.zip index.js
[ "$(md5sum < index.js | cut -c1-32)" = 7536e6a79bb948160e61b75e02804d7b ] || { echo "live code changed since v138; stopping, nothing deployed"; exit 1; }
python3 - <<'PY'
s = open('index.js').read()
old = 'c&&(w+=", dv = :v",N[":v"]={S:c},d||(S+=" AND (attribute_not_exists(dv) OR dv = :v)"))'
new = 'c?(w+=", dv = :v",N[":v"]={S:c},d||(S+=" AND (attribute_not_exists(dv) OR dv = :v)")):S+=" AND attribute_not_exists(dv)"'
assert s.count(old) == 1
open('index.js', 'w').write(s.replace(old, new))
PY
node --check index.js
zip -qj save.zip index.js
aws lambda update-function-code --function-name $F --zip-file fileb://save.zip >/dev/null
aws lambda wait function-updated --function-name $F
curl -s -o /dev/null -w "save %{http_code} (401 = up)\n" https://nyu3u8gc73.execute-api.us-east-1.amazonaws.com/save
echo "done. Undo: aws lambda update-function-code --function-name $F --zip-file fileb://$HOME/lhbak/$F-$TS.zip"
