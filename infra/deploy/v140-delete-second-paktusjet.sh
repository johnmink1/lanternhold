# Lanternhold: delete the second "Paktusjet" account (John, 27 Nov 2026: "7. delete it").
# Paste into AWS CloudShell (us-east-1). Needs John's go; John runs it himself.
#
# Target: hero pid f7e6bdb24af3a2a4 (rogue, power level 1, floor 2, last seen 25 Nov). NEVER John's main
# pid 772506631c6acf40. The script checks the pid, name, power level and floor first, backs up every row
# to ~/lhbak, shows you what it found, and deletes only after you type DELETE.
# Removes: the hero row, the arena row, the cloud save, the wallet row and the sign-in (Cognito user).
set -e
PID=f7e6bdb24af3a2a4; MAIN=772506631c6acf40; TS=$(date -u +%Y%m%d%H%M)
B=~/lhbak/second-paktusjet-$TS; mkdir -p $B
[ "$PID" != "$MAIN" ] || { echo "STOP: that is John's main hero"; exit 1; }
key() { printf '{"%s":{"S":"%s"}}' "$1" "$2"; }

aws dynamodb get-item --table-name lanternhold-heroes --key "$(key pid $PID)" > $B/hero.json
[ -s $B/hero.json ] || { echo "STOP: no hero with pid $PID (already gone?)"; exit 1; }
NAME=$(jq -r '.Item.name.S // ""' $B/hero.json); LV=$(jq -r '.Item.lv.N // "0"' $B/hero.json)
FL=$(jq -r '.Item.fl.N // "0"' $B/hero.json); CLS=$(jq -r '.Item.cls.S // ""' $B/hero.json); SUB=$(jq -r '.Item.u.S // ""' $B/hero.json)
SEEN=$(jq -r '.Item.seen.N // "0"' $B/hero.json)
echo "hero: $NAME ($CLS) power level $LV, floor $FL, last seen $(date -u -d @$((SEEN/1000)) '+%d %b %H:%M UTC' 2>/dev/null)"
[ "$(echo "$NAME" | tr A-Z a-z)" = "paktusjet" ] || { echo "STOP: name is '$NAME', not Paktusjet"; exit 1; }
[ "$LV" -le 5 ] && [ "$FL" -le 5 ] || { echo "STOP: power level $LV / floor $FL is higher than the account we expect"; exit 1; }
[ -n "$SUB" ] || { echo "STOP: hero row has no account id"; exit 1; }
CHK=$(printf 'lh:%s' "$SUB" | sha256sum | cut -c1-16)
[ "$CHK" = "$PID" ] || { echo "STOP: account id does not match pid ($CHK)"; exit 1; }

POOL=$(aws cognito-idp list-user-pools --max-results 60 --query "UserPools[?Name=='lanternhold-players'].Id" --output text)
aws cognito-idp admin-get-user --user-pool-id $POOL --username $SUB > $B/user.json 2>/dev/null || echo '{}' > $B/user.json
EMAIL=$(jq -r '.UserAttributes[]? | select(.Name=="email") | .Value' $B/user.json)
UGRP=$(aws cognito-idp admin-list-groups-for-user --user-pool-id $POOL --username $SUB --query 'Groups[].GroupName' --output text 2>/dev/null || true)
[ -z "$UGRP" ] || { echo "STOP: this account is in group(s) $UGRP (admins are never deleted here)"; exit 1; }
aws dynamodb get-item --table-name lanternhold-saves   --key "$(key userId $SUB)" > $B/save.json
aws dynamodb get-item --table-name lanternhold-wallets --key "$(key userId $SUB)" > $B/wallet.json
aws dynamodb get-item --table-name lanternhold-arena   --key "$(key pid $PID)"    > $B/arena.json
PAID=$(jq -r '[.Item // {} | to_entries[] | select(.key|test("^(fp|pass|stp)$"))] | length' $B/wallet.json 2>/dev/null || echo 0)
echo "account: ${EMAIL:-no email found} | save: $([ -s $B/save.json ] && echo yes || echo none) | wallet: $([ -s $B/wallet.json ] && jq -c '.Item' $B/wallet.json | cut -c1-200 || echo none) | arena: $([ -s $B/arena.json ] && echo yes || echo none)"
[ "${PAID:-0}" = 0 ] || { echo "STOP: the wallet shows purchases; ask Claude before deleting"; exit 1; }
echo "Backups in $B"
read -p "Type DELETE to remove this account for good: " OK
[ "$OK" = "DELETE" ] || { echo "Nothing deleted."; exit 0; }

aws dynamodb delete-item --table-name lanternhold-heroes  --key "$(key pid $PID)"
aws dynamodb delete-item --table-name lanternhold-arena   --key "$(key pid $PID)"
aws dynamodb delete-item --table-name lanternhold-saves   --key "$(key userId $SUB)"
aws dynamodb delete-item --table-name lanternhold-wallets --key "$(key userId $SUB)"
[ "$(jq -r '.Username // ""' $B/user.json)" = "" ] || aws cognito-idp admin-delete-user --user-pool-id $POOL --username $SUB
aws dynamodb get-item --table-name lanternhold-heroes --key "$(key pid $MAIN)" --query 'Item.name.S' --output text | sed 's/^/main hero still here: /'
echo "done: second Paktusjet ($PID) deleted. Rows backed up in $B (the sign-in itself cannot be restored)."
