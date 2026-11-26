# Lanternhold v131: Hall of Fame. Paste into AWS CloudShell (us-east-1). Needs John's go. Safe to run twice.
# 1) lanternhold-save also copies record numbers from each synced save onto the hero row (hf, c0).
# 2) new public Lambda lanternhold-hof serves GET /hof. Backs up lanternhold-save first.
set -e
R=us-east-1; API=nyu3u8gc73; TS=$(date +%Y%m%d%H%M); ACC=$(aws sts get-caller-identity --query Account --output text)
mkdir -p ~/lhbak ~/lhv131/save ~/lhv131/hof && cd ~/lhv131
curl -s "$(aws lambda get-function --function-name lanternhold-save --query Code.Location --output text)" -o ~/lhbak/lanternhold-save-$TS.zip
echo "backup: ~/lhbak/lanternhold-save-$TS.zip"
cat > save/index.js <<'JS'
const u=require("@aws-sdk/client-dynamodb"),S=require("zlib"),p=require("crypto"),m=new u.DynamoDBClient({}),{TABLE:f,TRADE:g,HEROES:b}=process.env,c=(t,e)=>({statusCode:t,headers:{"content-type":"application/json"},body:JSON.stringify(e)}),h=t=>p.createHash("sha256").update("lh:"+t).digest("hex").slice(0,16),r=t=>typeof t=="number"&&isFinite(t)?Math.round(t*100)/100:0;function N(t){let e;try{e=JSON.parse(t.slice(0,4)==="gz1:"?S.gunzipSync(Buffer.from(t.slice(4),"base64")).toString():t)}catch{return null}return e&&typeof e=="object"?e:null}function w(t){if(!t)return null;const e=t.stats||{},i=t.shards||{};return{g:r(t.gold),d:r(t.dust),k:r(t.kindling),e:r(t.embers),x:r(t.hxp),f:r(t.maxFloorEver),fl:r(t.floor),b:Array.isArray(t.bag)?t.bag.length:0,ki:r(e.kills),bk:r(e.bossKills),ge:r(e.goldEarned),pt:r(e.playTime),ls:r(t.lastSeen),cr:r(t.created),tk:r(t.wbTok),sh:Object.values(i).reduce((a,n)=>a+r(n),0),np:r(t.np),wp:r(t.wagesPaid),hr:t.hires?Object.keys(t.hires).length:0,rk:r(e.rekindles)}}const x={common:.04,fine:.08,rare:.14,epic:.24,set:.18,goblin:.26,legend:.34,mythic:.5};function E(t){const e=(t.gear||{}).you||{},i=t.bag||[],a=l=>i.find(o=>o.uid===l),n=a(e.chest),s=n&&n.slot==="robe";let d=0;for(const l in e){const o=a(e[l]);!o||l==="legs"&&s||(d+=(o.wb!=null?.5:o.rset!=null?.22:x[o.rar]||0)*(1+.03*(o.ilvl||0))*(1+.2*(o.up||0)))}return Math.round(d*100)}function k(t){const e=t.stats||{},i=[].concat(t.npLog||[]).find(a=>a.t===1);return{g:r(t.gold),ge:r(e.goldEarned),bk:r(e.bossKills),ki:r(e.kills),pt:r(e.playTime),gr:E(t),ft:Object.keys(t.feats||{}).filter(a=>a!=="dawn").length,n1:i?r(i.at):0,cr:r(t.created)}}async function C(t,e){const i=k(e);await m.send(new u.UpdateItemCommand({TableName:b,Key:{pid:{S:h(t)}},UpdateExpression:"SET hf=:h, c0=if_not_exists(c0,:c)",ConditionExpression:"attribute_exists(#n) AND attribute_not_exists(ban)",ExpressionAttributeNames:{"#n":"name"},ExpressionAttributeValues:{":h":{S:JSON.stringify(i)},":c":{N:String(i.cr||Date.now())}}}))}async function T(t,e,i,a){const n=w(i);if(!n)return;let s="";try{s=JSON.stringify(Array.isArray(a.acts)?a.acts.slice(-30):[]).slice(0,6e3)}catch{}await m.send(new u.PutItemCommand({TableName:g,Item:{pk:{S:"alog#"+h(t)},sk:{S:e.toString(36)+p.randomBytes(2).toString("hex")},at:{N:String(e)},s:{S:JSON.stringify(n)},a:{S:s},dv:{S:String(a.dv||"").slice(0,12)},ttl:{N:String(Math.floor(e/1e3)+30*86400)}}}))}exports.handler=async t=>{const e=t.requestContext&&t.requestContext.authorizer&&t.requestContext.authorizer.jwt&&t.requestContext.authorizer.jwt.claims.sub;if(!e)return c(401,{error:"not signed in"});const i=t.requestContext.http.method,a={userId:{S:e}};if(i==="GET"){const n=await m.send(new u.GetItemCommand({TableName:f,Key:a}));return n.Item?c(200,{data:n.Item.data.S,updated:Number(n.Item.updated.N),rst:n.Item.rst?Number(n.Item.rst.N):0}):c(404,{error:"no save"})}if(i==="PUT"){let n=t.body||"";if(t.isBase64Encoded&&(n=Buffer.from(n,"base64").toString("utf8")),n.length>3e5)return c(413,{error:"save too large"});let s;try{s=JSON.parse(n)}catch{return c(400,{error:"bad json"})}if(typeof s.data!="string")return c(400,{error:"missing data"});const d=Date.now();try{await m.send(new u.UpdateItemCommand({TableName:f,Key:a,UpdateExpression:"SET #d = :d, updated = :u, floor = :f",ConditionExpression:"attribute_not_exists(rst) OR rst <= :c",ExpressionAttributeNames:{"#d":"data"},ExpressionAttributeValues:{":d":{S:s.data},":u":{N:String(d)},":f":{N:String(Number(s.floor)||0)},":c":{N:String(Number(s.created)||0)}}}))}catch(o){if(o.name!=="ConditionalCheckFailedException")throw o;const y=await m.send(new u.GetItemCommand({TableName:f,Key:a}));return c(409,{error:"reset",rst:Number(y.Item.rst.N)})}const l=(g||b)&&N(s.data);if(g)try{await T(e,d,l,s)}catch(o){console.log("activity log",o.name||o)}if(b&&l)try{await C(e,l)}catch(o){console.log("hof",o.name)}return c(200,{ok:!0,updated:d})}return i==="DELETE"?(await m.send(new u.DeleteItemCommand({TableName:f,Key:a})),c(200,{ok:!0})):c(405,{error:"method not allowed"})};
JS
cat > hof/index.js <<'JS'
const{DynamoDBClient:u,ScanCommand:d}=require("@aws-sdk/client-dynamodb"),{CognitoIdentityProviderClient:f,ListUsersInGroupCommand:v}=require("@aws-sdk/client-cognito-identity-provider"),w=new u({}),g=new f({}),S=process.env.HEROES,y=process.env.POOL,N=["tank","healer","rogue","mage","necro"];let m="",h=0;const a=(r,l,i)=>r.map(t=>[t,l(t)]).filter(t=>t[1]>0).sort((t,n)=>(i?t[1]-n[1]:n[1]-t[1])||t[0].ts-n[0].ts).slice(0,3).map(([t,n])=>({name:t.name,cls:t.cls,v:n}));exports.handler=async()=>{if(!m||Date.now()-h>12e4){const r=[];let l;do{const e=await w.send(new d({TableName:S,ExclusiveStartKey:l}));r.push(...e.Items||[]),l=e.LastEvaluatedKey}while(l);const i=new Set(((await g.send(new v({UserPoolId:y,GroupName:"admins"}))).Users||[]).map(e=>e.Username)),t=Date.now()-60*864e5,n=[];for(const e of r){if(!e.name||e.ban||e.u&&i.has(e.u.S)||!e.hf||!e.seen||+e.seen.N<t)continue;let s;try{s=JSON.parse(e.hf.S)}catch{continue}const o=e.c0?+e.c0.N:0,c=e.np?+e.np.N:0;n.push({name:e.name.S,cls:e.cls?e.cls.S:"",lv:e.lv?+e.lv.N:0,np:c,ts:o||Date.now(),h:s,fast:c>=1&&s.n1>o&&o>0?s.n1-o:0})}const p={fast:a(n,e=>e.fast,!0),rich:a(n,e=>e.h.g),boss:a(n,e=>e.h.bk),np:n.filter(e=>e.np>0).sort((e,s)=>s.np-e.np||s.lv-e.lv).slice(0,3).map(e=>({name:e.name,cls:e.cls,v:e.np})),kills:a(n,e=>e.h.ki),earned:a(n,e=>e.h.ge),feats:a(n,e=>e.h.ft),time:a(n,e=>e.h.pt),cls:{},n:n.length};for(const e of N){const s=n.filter(o=>o.cls===e).sort((o,c)=>c.lv-o.lv||(c.h.gr||0)-(o.h.gr||0)||o.ts-c.ts)[0];s&&(p.cls[e]={name:s.name,lv:s.lv,gr:s.h.gr||0})}m=JSON.stringify(p),h=Date.now()}return{statusCode:200,headers:{"content-type":"application/json","cache-control":"public, max-age=120"},body:m}};
JS
(cd save && zip -qj ../save.zip index.js) && (cd hof && zip -qj ../hof.zip index.js)
HT=$(aws dynamodb describe-table --table-name lanternhold-heroes --query Table.TableArn --output text)
POOL=$(aws lambda get-function-configuration --function-name lanternhold-admin --query Environment.Variables.POOL --output text)
PA=arn:aws:cognito-idp:$R:$ACC:userpool/$POOL
# 1. save Lambda: may update hero rows, knows the heroes table
ROLE=$(aws lambda get-function-configuration --function-name lanternhold-save --query Role --output text | awk -F/ '{print $NF}')
aws iam put-role-policy --role-name "$ROLE" --policy-name lanternhold-hof --policy-document "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Action\":\"dynamodb:UpdateItem\",\"Resource\":\"$HT\"}]}"
TABLE=$(aws lambda get-function-configuration --function-name lanternhold-save --query Environment.Variables.TABLE --output text)
aws lambda update-function-configuration --function-name lanternhold-save --environment "Variables={TABLE=$TABLE,TRADE=lanternhold-trade,HEROES=lanternhold-heroes}" >/dev/null
aws lambda wait function-updated --function-name lanternhold-save
aws lambda update-function-code --function-name lanternhold-save --zip-file fileb://save.zip >/dev/null
aws lambda wait function-updated --function-name lanternhold-save
# 2. hof Lambda and its role (Scan on the heroes table, read the admins group so admins stay out)
TRUST='{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}'
if ! aws iam get-role --role-name lanternhold-hof-role >/dev/null 2>&1; then
  aws iam create-role --role-name lanternhold-hof-role --assume-role-policy-document "$TRUST" >/dev/null
  aws iam attach-role-policy --role-name lanternhold-hof-role --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
  echo "waiting 15 s for the new role"; sleep 15
fi
aws iam put-role-policy --role-name lanternhold-hof-role --policy-name hof-heroes --policy-document "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Action\":\"dynamodb:Scan\",\"Resource\":\"$HT\"},{\"Effect\":\"Allow\",\"Action\":\"cognito-idp:ListUsersInGroup\",\"Resource\":\"$PA\"}]}"
if aws lambda get-function --function-name lanternhold-hof >/dev/null 2>&1; then
  aws lambda update-function-configuration --function-name lanternhold-hof --environment "Variables={HEROES=lanternhold-heroes,POOL=$POOL}" >/dev/null
  aws lambda wait function-updated --function-name lanternhold-hof
  aws lambda update-function-code --function-name lanternhold-hof --zip-file fileb://hof.zip >/dev/null
else
  aws lambda create-function --function-name lanternhold-hof --runtime nodejs22.x --handler index.handler --memory-size 128 --timeout 10 \
    --role arn:aws:iam::$ACC:role/lanternhold-hof-role --environment "Variables={HEROES=lanternhold-heroes,POOL=$POOL}" --zip-file fileb://hof.zip >/dev/null
fi
aws lambda wait function-updated --function-name lanternhold-hof
# 3. public route GET /hof (no sign-in, like GET /leaderboard)
ARN=arn:aws:lambda:$R:$ACC:function:lanternhold-hof
INT=$(aws apigatewayv2 get-integrations --api-id $API --query "Items[?IntegrationUri=='$ARN'].IntegrationId" --output text)
[ -z "$INT" ] && INT=$(aws apigatewayv2 create-integration --api-id $API --integration-type AWS_PROXY --integration-uri $ARN --payload-format-version 2.0 --query IntegrationId --output text)
aws lambda add-permission --function-name lanternhold-hof --statement-id apigw-hof --action lambda:InvokeFunction --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:$R:$ACC:$API/*/*/*" >/dev/null 2>&1 || true
[ -z "$(aws apigatewayv2 get-routes --api-id $API --query "Items[?RouteKey=='GET /hof'].RouteId" --output text)" ] && \
  aws apigatewayv2 create-route --api-id $API --route-key 'GET /hof' --authorization-type NONE --target "integrations/$INT" >/dev/null
# 4. smoke test: hof 200 (empty lists until players sync), save 401 (no sign-in)
curl -s -w "\nhof %{http_code}\n" "https://$API.execute-api.$R.amazonaws.com/hof"
curl -s -o /dev/null -w "save %{http_code}\n" -X PUT "https://$API.execute-api.$R.amazonaws.com/save"
echo "done. Undo save: aws lambda update-function-code --function-name lanternhold-save --zip-file fileb://$HOME/lhbak/lanternhold-save-$TS.zip"
