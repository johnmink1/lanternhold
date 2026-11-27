"""Builds infra/deploy/v142/hardcore.sh and the bundles it deploys (infra/deploy/v142/dist/*.js).
Usage: COMMIT=<sha of the commit holding dist/> python3 infra/deploy/v142/build.py   (needs esbuild, e.g. ESBUILD='npx --yes esbuild')
Run once to make dist/, commit it, then run again with COMMIT set to that commit and commit the script."""
import hashlib, os, subprocess, shlex
here = os.path.dirname(os.path.abspath(__file__)); infra = os.path.join(here, '..', '..')
esb = shlex.split(os.environ.get('ESBUILD', 'esbuild')); commit = os.environ.get('COMMIT', 'COMMIT')
# function: (source, strings the LIVE code must contain, so only the version we expect is replaced)
FN = {
  'lanternhold-save':    ('lambda/save.js',    ['snap#', 'heldidx']),
  'lanternhold-heroes':  ('lambda/heroes.js',  ['paladin', 'taken']),
  'lanternhold-profile': ('lambda/profile.js', ['f.plain', 'POST /warlink']),
  'lanternhold-invite':  ('lambda/invite.js',  ['noinv', 'solo']),
  'lanternhold-market':  ('lambda/market.js',  ['mkt#', 'untrusted gold']),
  'lanternhold-mail':    ('lambda/mail.js',    ['payment', 'untrusted gold']),
  'lanternhold-chat':    ('chat/index.js',     ['banner#', 'dm#']),
  'lanternhold-admin':   ('lambda/admin.js',   ['alog#', 'POST /admin/restore']),
  'lanternhold-hof':     ('lambda/hof.js',     ['admins']),
}
os.makedirs(os.path.join(here, 'dist'), exist_ok=True)
rows = []
for fn, (src, fp) in FN.items():
    code = subprocess.check_output(esb + [os.path.join(infra, src), '--bundle', '--minify', '--platform=node', '--format=cjs', '--external:@aws-sdk/*', '--log-level=warning'])
    open(os.path.join(here, 'dist', fn + '.js'), 'wb').write(code)
    rows.append((fn, hashlib.md5(code).hexdigest(), fp, len(code)))
raw = 'https://raw.githubusercontent.com/johnmink1/lanternhold/' + commit + '/infra/deploy/v142/dist/'
out = ['''# Lanternhold v142 Hardcore (John, 27 Nov 2026). Paste into AWS CloudShell (us-east-1). Needs John's go.
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
# Code comes from GitHub at commit ''' + commit + ''' and is checked by md5. Each live function is checked to be the
# version we expect BEFORE anything changes and backed up to ~/lhbak. Safe to run twice. Prints the undo commands.
set -e
TS=$(date -u +%Y%m%d%H%M); mkdir -p ~/lhbak ~/lhv142 && cd ~/lhv142
RAW=''' + raw + '''
echo "1/3 fetching the new code"''']
for fn, md5, fp, n in rows:
    out.append('curl -sf -o ' + fn + '.js "$RAW' + fn + '.js" && [ "$(md5sum < ' + fn + '.js | cut -c1-32)" = "' + md5 + '" ] || { echo "' + fn + ': download failed or changed. Stopping; nothing changed."; exit 1; }')
out.append('''echo "2/3 checking the live code"
SKIP=""
for F in ''' + ' '.join(r[0] for r in rows) + '''; do
  if ! aws lambda get-function --function-name $F >/dev/null 2>&1; then [ $F = lanternhold-hof ] && { SKIP="$SKIP $F"; echo "$F: not there, skipped"; continue; }; echo "$F missing. Stopping; nothing changed."; exit 1; fi
  curl -s -o ~/lhbak/$F-$TS.zip "$(aws lambda get-function --function-name $F --query Code.Location --output text)"
  rm -rf live-$F && mkdir live-$F && unzip -q -o ~/lhbak/$F-$TS.zip -d live-$F
done
chk() { # chk <function> <strings...>: live code must contain each string, or already be this version
  F=$1; shift; case " $SKIP " in *" $F "*) return;; esac
  [ "$(md5sum < live-$F/index.js | cut -c1-32)" = "$(md5sum < $F.js | cut -c1-32)" ] && { echo "$F: already v142"; return; }
  for s in "$@"; do grep -qF -- "$s" live-$F/index.js || { echo "$F: live code is not the version this script expects (no '$s'). Stopping; nothing changed. Ask Claude."; exit 1; }; done
}''')
for fn, md5, fp, n in rows:
    out.append('chk ' + fn + ' ' + ' '.join(shlex.quote(x) for x in fp))
out.append('''echo "3/3 updating"
UNDO=""
for F in ''' + ' '.join(r[0] for r in rows) + '''; do
  case " $SKIP " in *" $F "*) continue;; esac
  rm -f $F.zip index.js && cp $F.js index.js && zip -qj $F.zip index.js
  aws lambda update-function-code --function-name $F --zip-file fileb://$F.zip >/dev/null
  aws lambda wait function-updated --function-name $F
  UNDO="$UNDO\\naws lambda update-function-code --function-name $F --zip-file fileb://$HOME/lhbak/$F-$TS.zip"
  echo "updated $F"
done
B=https://nyu3u8gc73.execute-api.us-east-1.amazonaws.com
curl -s "$B/leaderboard?hc=1" | head -c 120; echo
for p in "save?hc=1" chat market mail heroes; do curl -s -o /dev/null -w "$p %{http_code}\\n" "$B/$p"; done
echo "(401 means up and asking for sign-in)"
echo -e "done. Undo:$UNDO"''')
open(os.path.join(here, 'hardcore.sh'), 'w').write('\n'.join(out) + '\n')
for fn, md5, fp, n in rows: print(fn, n, 'bytes', md5)
