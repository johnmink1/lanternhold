# Lanternhold v140: switch the save check and the payment check from watch mode to refusing. Needs John's go.
# Run only once the v140 game is live (it explains a held save to the player) and the watch week showed no honest
# player held: Admin tab > Held saves should list only real edits. Undo: run again with log instead of on.
set -e
M=${1:-on}; cd ~/lhv140 2>/dev/null || { mkdir -p ~/lhv140 && cd ~/lhv140; }
for P in "lanternhold-save SAVECHECK" "lanternhold-mail TRUSTCHECK" "lanternhold-market TRUSTCHECK" "lanternhold-gulp TRUSTCHECK"; do
  set -- $P; F=$1; K=$2
  aws lambda get-function-configuration --function-name $F --query Environment.Variables --output json > env-$F.json
  python3 -c "import json,sys;v=json.load(open('env-$F.json')) or {};v['$K']='$M';json.dump({'Variables':v},open('env-$F.json','w'))"
  aws lambda update-function-configuration --function-name $F --environment file://env-$F.json >/dev/null
  aws lambda wait function-updated --function-name $F; echo "$F $K=$M"
done
