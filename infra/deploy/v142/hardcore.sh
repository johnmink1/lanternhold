# Lanternhold v142 Hardcore (John, 27 Nov 2026). Paste into AWS CloudShell (us-east-1). Needs John's go.
# Run it BEFORE the v142 game goes live: a Hardcore game only syncs with a server that keeps the Hardcore slot apart.
# Code-only update of 9 functions (no new tables, routes, permissions or settings):
#   save     second save slot (?hc=1 = '<sub>#hc'); refuses a Hardcore save whose deaths or lost gear came undone,
#            and any save carried between the Normal and Hardcore slots; Hardcore start-over keeps an rst stamp
#   heroes   Hardcore hero row (hc flag + record), Guild board and borrowing only within the same mode
#   profile, invite   the Hardcore hero's own row; invites only within the same mode
#   market, mail      Hardcore market (mkt#<cls>#hc) and mailbox; nothing crosses between modes
#   chat     Hardcore tab (anyone reads, only Hardcore heroes post); the Hardcore hero chats as itself
#   admin    GET /leaderboard?hc=1 = Hardcore board; the plain board leaves Hardcore heroes out
#   hof      the Hall of Fame leaves Hardcore heroes out (skipped if the Hall of Fame function isn't there)
# Code comes from GitHub at commit c347948060543ebbf2827a203d94923d959872ff and is checked by md5. Each live function is checked to be the
# version we expect BEFORE anything changes and backed up to ~/lhbak. Safe to run twice. Prints the undo commands.
set -e
TS=$(date -u +%Y%m%d%H%M); mkdir -p ~/lhbak ~/lhv142 && cd ~/lhv142
RAW=https://raw.githubusercontent.com/johnmink1/lanternhold/c347948060543ebbf2827a203d94923d959872ff/infra/deploy/v142/dist/
echo "1/3 fetching the new code"
curl -sf -o lanternhold-save.js "$RAWlanternhold-save.js" && [ "$(md5sum < lanternhold-save.js | cut -c1-32)" = "caec3676f48ffcc8260595952e2baaec" ] || { echo "lanternhold-save: download failed or changed. Stopping; nothing changed."; exit 1; }
curl -sf -o lanternhold-heroes.js "$RAWlanternhold-heroes.js" && [ "$(md5sum < lanternhold-heroes.js | cut -c1-32)" = "00c3ed6fc55f18abecb8d8a5e7820973" ] || { echo "lanternhold-heroes: download failed or changed. Stopping; nothing changed."; exit 1; }
curl -sf -o lanternhold-profile.js "$RAWlanternhold-profile.js" && [ "$(md5sum < lanternhold-profile.js | cut -c1-32)" = "dc726ea6e6d8dd0bbee3ddb43c3d3ba5" ] || { echo "lanternhold-profile: download failed or changed. Stopping; nothing changed."; exit 1; }
curl -sf -o lanternhold-invite.js "$RAWlanternhold-invite.js" && [ "$(md5sum < lanternhold-invite.js | cut -c1-32)" = "88a67091c9102a35d8d86636f11044a1" ] || { echo "lanternhold-invite: download failed or changed. Stopping; nothing changed."; exit 1; }
curl -sf -o lanternhold-market.js "$RAWlanternhold-market.js" && [ "$(md5sum < lanternhold-market.js | cut -c1-32)" = "712cd43e1f73fbc858e1ae2f754b3d2f" ] || { echo "lanternhold-market: download failed or changed. Stopping; nothing changed."; exit 1; }
curl -sf -o lanternhold-mail.js "$RAWlanternhold-mail.js" && [ "$(md5sum < lanternhold-mail.js | cut -c1-32)" = "18935ceea0ecd9d76a75c6a89e8df20e" ] || { echo "lanternhold-mail: download failed or changed. Stopping; nothing changed."; exit 1; }
curl -sf -o lanternhold-chat.js "$RAWlanternhold-chat.js" && [ "$(md5sum < lanternhold-chat.js | cut -c1-32)" = "e4986763f0a8aead4a227cd7134c608f" ] || { echo "lanternhold-chat: download failed or changed. Stopping; nothing changed."; exit 1; }
curl -sf -o lanternhold-admin.js "$RAWlanternhold-admin.js" && [ "$(md5sum < lanternhold-admin.js | cut -c1-32)" = "0f05762f020ad97283eb71776c4d3b36" ] || { echo "lanternhold-admin: download failed or changed. Stopping; nothing changed."; exit 1; }
curl -sf -o lanternhold-hof.js "$RAWlanternhold-hof.js" && [ "$(md5sum < lanternhold-hof.js | cut -c1-32)" = "680f07d6ef09e707f992c0c13a3b6117" ] || { echo "lanternhold-hof: download failed or changed. Stopping; nothing changed."; exit 1; }
echo "2/3 checking the live code"
SKIP=""
for F in lanternhold-save lanternhold-heroes lanternhold-profile lanternhold-invite lanternhold-market lanternhold-mail lanternhold-chat lanternhold-admin lanternhold-hof; do
  if ! aws lambda get-function --function-name $F >/dev/null 2>&1; then [ $F = lanternhold-hof ] && { SKIP="$SKIP $F"; echo "$F: not there, skipped"; continue; }; echo "$F missing. Stopping; nothing changed."; exit 1; fi
  curl -s -o ~/lhbak/$F-$TS.zip "$(aws lambda get-function --function-name $F --query Code.Location --output text)"
  rm -rf live-$F && mkdir live-$F && unzip -q -o ~/lhbak/$F-$TS.zip -d live-$F
done
chk() { # chk <function> <strings...>: live code must contain each string, or already be this version
  F=$1; shift; case " $SKIP " in *" $F "*) return;; esac
  [ "$(md5sum < live-$F/index.js | cut -c1-32)" = "$(md5sum < $F.js | cut -c1-32)" ] && { echo "$F: already v142"; return; }
  for s in "$@"; do grep -qF -- "$s" live-$F/index.js || { echo "$F: live code is not the version this script expects (no '$s'). Stopping; nothing changed. Ask Claude."; exit 1; }; done
}
chk lanternhold-save 'snap#' heldidx
chk lanternhold-heroes paladin taken
chk lanternhold-profile f.plain 'POST /warlink'
chk lanternhold-invite noinv solo
chk lanternhold-market 'mkt#' 'untrusted gold'
chk lanternhold-mail payment 'untrusted gold'
chk lanternhold-chat 'banner#' 'dm#'
chk lanternhold-admin 'alog#' 'POST /admin/restore'
chk lanternhold-hof admins
echo "3/3 updating"
UNDO=""
for F in lanternhold-save lanternhold-heroes lanternhold-profile lanternhold-invite lanternhold-market lanternhold-mail lanternhold-chat lanternhold-admin lanternhold-hof; do
  case " $SKIP " in *" $F "*) continue;; esac
  rm -f $F.zip index.js && cp $F.js index.js && zip -qj $F.zip index.js
  aws lambda update-function-code --function-name $F --zip-file fileb://$F.zip >/dev/null
  aws lambda wait function-updated --function-name $F
  UNDO="$UNDO\naws lambda update-function-code --function-name $F --zip-file fileb://$HOME/lhbak/$F-$TS.zip"
  echo "updated $F"
done
B=https://nyu3u8gc73.execute-api.us-east-1.amazonaws.com
curl -s "$B/leaderboard?hc=1" | head -c 120; echo
for p in "save?hc=1" chat market mail heroes; do curl -s -o /dev/null -w "$p %{http_code}\n" "$B/$p"; done
echo "(401 means up and asking for sign-in)"
echo -e "done. Undo:$UNDO"
