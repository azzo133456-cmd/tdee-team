const API = "";
const SKEY = "tdeeUser_session";
let session = JSON.parse(localStorage.getItem(SKEY) || "null"); // {token,userId,username}
let store = { profile:{}, records:[], exercises:[] };
let chart = null, kcalChart = null, tdeeChart = null, foodCart = [], authMode = "login";

/* ---------- 食物資料庫（每 100g：kcal, 蛋白P, 脂肪F, 碳水C） ---------- */
const FOODS = {
  // 主食 / 澱粉
  "白飯":[130,2.7,0.3,28],"糙米飯":[112,2.6,0.9,23],"五穀飯":[120,3,1.2,24],
  "白吐司":[265,8,3.6,49],"全麥吐司":[247,13,4.2,41],"貝果":[250,10,1.5,48],
  "地瓜":[86,1.6,0.1,20],"馬鈴薯":[77,2,0.1,17],"南瓜":[26,1,0.1,6.5],
  "玉米":[86,3.2,1.2,19],"燕麥":[389,17,7,66],"麥片":[379,8,7,77],
  "義大利麵(熟)":[158,6,0.9,31],"烏龍麵(熟)":[105,2.6,0.4,21],"白麵條(熟)":[138,4.5,0.6,25],
  "水餃(每顆約20g)":[240,9,9,30],"小籠包(每顆約25g)":[238,9,11,25],"饅頭":[223,7,1,47],
  "蘿蔔糕":[140,2,4,24],"飯糰(超商)":[180,4,2,36],"白粥":[51,0.9,0.1,11],
  // 肉 / 海鮮 / 蛋
  "雞胸肉":[165,31,3.6,0],"雞腿(去皮)":[120,20,4,0],"雞腿(帶皮)":[211,18,15,0],
  "豬里肌":[143,21,6,0],"豬五花":[518,9,53,0],"梅花豬":[210,17,15,0],
  "牛腱":[150,22,6,0],"牛排(沙朗)":[271,25,18,0],"牛絞肉":[250,17,20,0],
  "鮭魚":[208,20,13,0],"鯛魚":[96,21,1,0],"鯖魚":[262,19,21,0],"鮪魚(水煮罐)":[116,26,0.8,0],
  "蝦":[99,24,0.3,0],"花枝":[92,16,1.4,3],"蛤蜊":[86,15,1,4],
  "雞蛋(1顆約50g)":[155,13,11,1.1],"水煮蛋":[155,13,11,1.1],"蛋白":[52,11,0.2,0.7],
  // 豆 / 奶
  "豆腐":[76,8,4.8,1.9],"嫩豆腐":[61,6,3.5,2],"豆干":[192,19,11,5],
  "毛豆":[122,11,5,10],"無糖豆漿":[33,3.3,1.8,1.5],"鷹嘴豆(熟)":[164,9,2.6,27],
  "牛奶":[64,3.4,3.6,4.7],"低脂牛奶":[42,3.4,1,5],"希臘優格(無糖)":[59,10,0.4,3.6],
  "優格(無糖)":[63,3.5,3.3,4.7],"起司片":[350,25,27,2],"乳清蛋白(1匙約30g)":[120,24,1.5,3],
  // 蔬菜
  "花椰菜":[34,2.8,0.4,7],"白花椰":[25,1.9,0.3,5],"高麗菜":[25,1.3,0.1,6],
  "菠菜":[23,2.9,0.4,3.6],"地瓜葉":[30,2.8,0.3,4],"青江菜":[13,1.5,0.2,2.2],
  "番茄":[18,0.9,0.2,3.9],"小黃瓜":[15,0.7,0.1,3.6],"紅蘿蔔":[41,0.9,0.2,10],
  "香菇":[34,2.2,0.5,7],"金針菇":[37,2.7,0.3,8],"木耳":[25,1.5,0.2,6],
  // 水果
  "香蕉":[89,1.1,0.3,23],"蘋果":[52,0.3,0.2,14],"芭樂":[68,2.6,0.9,14],
  "橘子":[47,0.9,0.1,12],"葡萄":[69,0.7,0.2,18],"奇異果":[61,1.1,0.5,15],
  "草莓":[32,0.7,0.3,7.7],"西瓜":[30,0.6,0.2,8],"鳳梨":[50,0.5,0.1,13],"酪梨":[160,2,15,9],
  // 堅果 / 油脂
  "花生":[567,26,49,16],"杏仁":[579,21,50,22],"腰果":[553,18,44,30],"核桃":[654,15,65,14],
  "橄欖油":[884,0,100,0],"奶油":[717,0.9,81,0.1],"美乃滋":[680,1,75,4],
  // 點心 / 飲料 / 外食
  "白糖":[400,0,0,100],"黑巧克力":[546,5,31,61],"洋芋片":[536,7,35,53],
  "珍珠奶茶(每100ml)":[68,0.6,1.5,13],"含糖紅茶(每100ml)":[40,0,0,10],"無糖綠茶":[1,0,0,0.3],
  "可樂(每100ml)":[42,0,0,11],"雞排":[280,18,18,12],"鹽酥雞":[290,17,19,14],
  "滷肉飯(1碗約350g)":[180,6,8,22],"牛肉麵(1碗約600g)":[110,7,3,13],"便當(雞腿)":[180,9,8,18],
  "漢堡(麥香雞)":[230,12,9,26],"薯條(中)":[312,3.4,15,41],"披薩(1片約100g)":[266,11,10,33]
};
function macroKcal(p,f,c){ return p*4 + f*9 + c*4; }
// 線上查到後暫存的食物
const FOODS_DYN = {};
const FOODS_TW = window.FOODS_TW || {};
const SERVINGS = {};  // 食物 → 預設一份的克數
const SHARED_NAMES = new Set();  // 來自共享食物庫的品項名
/* ---------- 使用統計（次數＋上次克數，存本機） ---------- */
let FOOD_STATS = (()=>{ try{ return JSON.parse(localStorage.getItem("tdee_foodstats")||"{}"); }catch(e){ return {}; } })();
function saveFoodStats(){ try{ localStorage.setItem("tdee_foodstats",JSON.stringify(FOOD_STATS)); }catch(e){} }
function bumpFoodStat(n,g){ const s=FOOD_STATS[n]||(FOOD_STATS[n]={c:0,g:0}); s.c=(s.c||0)+1; if(g>0) s.g=g; saveFoodStats(); }
function statG(n){ const s=FOOD_STATS[n]; return (s&&s.g>0)?s.g:(SERVINGS[n]||100); }
/* ---------- 食物分類（給快速篩選用） ---------- */
function foodCat(n){
  if(/茶|奶|咖啡|拿鐵|那堤|可樂|多多|檸檬汁|豆漿|米漿|汽水|果汁|思樂冰|星冰樂|50嵐|茶湯會/.test(n) && !/便當|飯|麵/.test(n)) return "drink";
  if(/便當|飯|麵|粥|燴|義大利|焗烤|炒飯|滷肉|雞腿|排骨/.test(n)) return "meal";
  if(/超商|7-?11|全家|關東煮|御飯糰|飯糰|三明治/.test(n)) return "store";
  return "raw";
}
// FDA 烹調變體（如「鯖魚(烤,150度,20分)」「雞胸(水煮)」）→ 搜尋時排到乾淨主名稱之後，減少洗版。
// 注意：手搖甜度「(半糖)」「(全糖大杯)」不含這些字，不會被誤判。
const VARIANT_RE=/\([^)]*(度|分|炒|爆|煮|烤|蒸|煎|炸|滷|燙|微波|乾|醃|燜|焗|川|汆|罐頭|生鮮|帶皮|去皮|帶骨)/;
function isVariant(n){ return VARIANT_RE.test(n); }
/* ---------- 營養密度標籤（每100g門檻） ---------- */
function densityTags(d){
  if(!d) return "";
  const [k,p,f,c]=d; let t="";
  if(p>=15) t+='<span style="color:#5b8aa6">💪</span>';
  if(c>=40) t+='<span style="color:#b5836a" title="高糖/高碳">🍬</span>';
  if(f>=20) t+='<span style="color:#c98b5e" title="高脂">🧈</span>';
  return t;
}
let FOOD_FILTER = "";  // "", drink, meal, store, raw
/* ---------- 份量視覺化（換算成生活化單位） ---------- */
function portionHint(n,g){
  if(!g) return "";
  const serv=SERVINGS[n];
  if(serv && serv>=120){ const x=g/serv; const unit=foodCat(n)==="drink"?"杯":"份"; return `≈ ${x.toFixed(x>=10?0:1)} ${unit}`; }
  if(/白飯|糙米飯|飯$|米飯/.test(n)) return `≈ ${(g/200).toFixed(1)} 碗`;       // 1碗飯≈200g
  if(/肉|雞胸|魚|排|牛|豬/.test(n)) return `≈ ${(g/100).toFixed(1)} 個手掌`;    // 1掌≈100g
  if(/麵$|麵條|義大利麵/.test(n)) return `≈ ${(g/100).toFixed(1)} 把(乾)`;
  return "";
}
// 載入台灣連鎖餐點包：每份值換算成每100g，並記下一份的克數
(function(){
  // 注意：FOODS_XLSX 放最前面＝優先序最低，遇到既有(已校正)品項由後面的包覆蓋，只新增沒有的品項。
  const C = Object.assign({}, window.FOODS_XLSX || {}, window.FOODS_CHAIN || {}, window.FOODS_DRINKS || {}, window.FOODS_BREAKFAST || {}, window.FOODS_CONVENIENCE || {}, window.FOODS_STREET || {}, window.FOODS_PROTEIN || {}, window.FOODS_PIZZA || {}, window.FOODS_BREAD || {}, window.FOODS_MORECHAINS || {}, window.FOODS_HOTPOT_SUSHI || {});
  for(const n in C){
    const [k,p,f,c,g] = C[n]; const G=g||100, fac=100/G;
    FOODS_DYN[n]=[Math.round(k*fac*10)/10, Math.round(p*fac*10)/10, Math.round(f*fac*10)/10, Math.round(c*fac*10)/10];
    SERVINGS[n]=G;
  }
  // 50嵐 / 茶湯會：依官方糖量熱量表自動產生各甜度版本
  const ML=700, S=window.FOODS_5050||{};
  // 只存「全糖」基準一筆/杯（品名不帶甜度後綴）→ 自動出現糖量選單，使用者自選甜度；
  // cartMacros 依甜度線性換算(糖量×甜度)，與舊版預先產生 6 種甜度完全等價，但飲料庫精簡 6 倍。
  for(const brand in S){
    for(const [name,fullK,sugarG] of S[brand]){
      const nonSugar=Math.max(0,fullK-sugarG*4);     // 茶底＋奶/料的固定熱量(非糖)
      const fac=100/ML;
      const key=`${brand} ${name}`;                   // 不帶「(全糖)」等後綴
      FOODS_DYN[key]=[Math.round(fullK*fac*10)/10, 0, Math.round(nonSugar/9*fac*10)/10, Math.round(sugarG*fac*10)/10];
      SERVINGS[key]=ML;                               // 碳水＝全糖糖量；糖量選單會依甜度扣除
    }
  }
})();
// 統一查詢：手動 → 連鎖/暫存 → 台灣FDA
function foodData(n){ return FOODS[n] || FOODS_DYN[n] || FOODS_TW[n] || null; }

/* ---------- 運動資料庫（MET 值；kcal/分 = MET×3.5×體重/200） ---------- */
const EXS = {
  "走路(慢)":3.0,"走路(快)":4.5,"健走":5.0,"慢跑":7.0,"跑步(8km/h)":8.3,"跑步(10km/h)":9.8,
  "騎腳踏車(休閒)":4.0,"騎腳踏車(中等)":6.8,"飛輪":8.5,"游泳(休閒)":6.0,"游泳(快)":9.8,
  "重訓(一般)":3.5,"重訓(高強度)":6.0,"徒手健身":5.0,"HIIT":8.0,"瑜珈":2.5,"皮拉提斯":3.0,
  "跳繩":11.0,"爬山":7.0,"爬樓梯":8.0,"籃球":6.5,"羽球":5.5,"網球":7.0,"桌球":4.0,
  "足球":7.0,"舞蹈(中等)":5.0,"拳擊有氧":7.5,"划船機":7.0,"橢圓機":5.0,"伸展操":2.3
};
function exKcalPerMin(met, weight){ return met * 3.5 * (weight||60) / 200; }

/* ---------- API ---------- */
// AI 端點的前端節流：避免短時間連發（與後端限流呼應，減少觸發上游限流）
const AI_PATHS=["/api/coach","/api/analyze","/api/estimate","/api/label","/api/labels"];
let aiCalls=[], aiLastCall=0, aiInFlight=false;
function isAiPath(path){ return AI_PATHS.some(p=>path.startsWith(p)); }
function aiThrottleOk(path){
  if(!isAiPath(path)) return true;
  // 防連點：同一時間只允許一個 AI 請求在跑，未回來前重複點擊一律擋掉
  if(aiInFlight) throw new Error("AI 正在處理中，請等上一個結果出來再操作。");
  const now=Date.now();
  if(now-aiLastCall<4000){ const w=Math.ceil((4000-(now-aiLastCall))/1000); throw new Error(`操作太快，請 ${w} 秒後再試一次。`); }
  aiCalls=aiCalls.filter(t=>now-t<60000);
  if(aiCalls.length>=6){ const wait=Math.ceil((60000-(now-aiCalls[0]))/1000); throw new Error(`AI 請求太頻繁，請 ${wait} 秒後再試（每分鐘上限 6 次，避免被系統限流）。`); }
  aiCalls.push(now); aiLastCall=now; return true;
}
async function api(path, opts={}){
  const ai=isAiPath(path), bg=!!opts.bg;
  // 背景自動呼叫(如每週覆盤)不走「連點鎖」：避免它把鎖佔住害到使用者的手動操作。
  // 但仍會送到後端，受後端的回數/間隔/全站上限把關（安全性不變）。
  if(ai && !bg) aiThrottleOk(path);
  if(ai && !bg) aiInFlight=true;
  try{
    const headers = Object.assign({"Content-Type":"application/json"}, opts.headers||{});
    if(session) headers["x-token"]=session.token;
    if(ai && bg) headers["x-ai-bg"]="1";
    const fetchOpts={}; for(const k in opts) if(k!=="bg") fetchOpts[k]=opts[k];
    const r = await fetch(API+path, Object.assign(fetchOpts, {headers}));
    if(r.status===401){ logout(); throw new Error("登入已失效"); }
    if(!r.ok){ const e=await r.json().catch(()=>({})); throw new Error(e.error||"錯誤"); }
    return r.json();
  } finally { if(ai && !bg) aiInFlight=false; }
}

/* ---------- 登入 / 註冊 ---------- */
function setAuthMode(m){
  authMode=m;
  document.getElementById("tabLogin").classList.toggle("on", m==="login");
  document.getElementById("tabReg").classList.toggle("on", m==="register");
  document.getElementById("auBtn").textContent = m==="login"?"登入":"註冊";
  document.getElementById("auPass").setAttribute("autocomplete", m==="login"?"current-password":"new-password");
  set("auErr","");
}
async function doAuth(){
  const username=val("auUser").trim(), password=val("auPass");
  if(!username||!password){ set("auErr","請輸入帳號與密碼"); return; }
  try{
    const m = await api("/api/"+(authMode==="login"?"login":"register"),
      {method:"POST", body:JSON.stringify({username,password})});
    session={token:m.token, userId:m.userId, username:m.username};
    localStorage.setItem(SKEY, JSON.stringify(session));
    boot();
  }catch(e){ set("auErr", e.message); }
}
function logout(){ try{ localStorage.removeItem(storeCacheKey()); }catch(e){} localStorage.removeItem(SKEY); session=null; location.reload(); }
async function changeName(){
  const cur=session&&session.username||"";
  const nv=(prompt("輸入新的暱稱（最多 20 字）：",cur)||"").trim();
  if(!nv||nv===cur) return;
  try{
    const r=await api("/api/username",{method:"PUT",body:JSON.stringify({username:nv})});
    session.username=r.username; localStorage.setItem(SKEY,JSON.stringify(session));
    set("curName",session.username); applyNameFx();
    await loadGroups();   // 排行榜/戰績換成新名字
    alert("暱稱已更新為「"+session.username+"」");
  }catch(e){ alert(e.message); }
}

/* ---------- profile ---------- */
const pIds=["sex","age","height","weight","act","goal","goalRate","tdeeBasis","targetWeight","targetDate","macroStyle","proteinPerKg"];
// 在伺服器的真實 profile 套進表單「之前」，絕不可儲存：否則會把空白/預設表單 PUT 上去，蓋掉雲端真資料。
let profileReady=false;
function applyProfile(p){ pIds.forEach(id=>{ if(p && p[id]!=null) document.getElementById(id).value=p[id]; }); profileReady=true; }
function readProfile(){
  const o={};
  // 數值類欄位若為空字串就「不送」，避免空值覆蓋雲端既有資料（防止再次發生 profile 被洗白）
  const numeric=new Set(["age","height","weight","targetWeight"]);
  pIds.forEach(id=>{ const v=val(id); if(numeric.has(id) && (v===""||v==null)) return; o[id]=v; });
  return o;
}
let saveTimer=null;
function saveProfile(){
  renderDerived();
  if(!profileReady) return;   // 尚未載入真實 profile，這次不存（防止覆蓋）
  clearTimeout(saveTimer);
  saveTimer=setTimeout(()=> api("/api/profile",{method:"PUT",body:JSON.stringify(readProfile())}).catch(()=>{}), 600);
}

function calcMifflin(){
  const a=+val("age"), h=+val("height"), w=+val("weight"), act=+val("act")||1.4;
  if(!a||!h||!w){ set("mifflinOut","—"); set("bmrOut",""); return null; }
  const bmr=10*w+6.25*h-5*a+(val("sex")==="f"?-161:5);
  const tdee=Math.round(bmr*act);
  set("mifflinOut", tdee.toLocaleString()+" kcal");
  set("bmrOut","BMR "+Math.round(bmr).toLocaleString()+" × "+act);
  return tdee;
}

/* ---------- 目標建議 ---------- */
// 單一真相來源：把「原始反推 / 公式 / 夾限校正後」全算好，全 App（真實TDEE卡、目標建議、
// 減重計畫）都用這個，避免各處算法不一致而顯示出不同的 TDEE。
//   gross = 校正後採用的含運動 TDEE；rawGross = 未校正的原始反推；formula = 公式估算。
function tdeeModel(){
  const R=calcReal(store.records, store.exercises);
  const formula=calcMifflin();   // 公式估算（含活動係數）的 gross TDEE，用來當夾限基準
  if(R.tdee && formula){
    const days=R.days||0;
    // 資料越少越信任公式：7 天→全用公式，14 天→全用實測，中間線性過渡
    const wReal=Math.min(1, Math.max(0, (days-7)/7));
    const blend=R.tdee*wReal + formula*(1-wReal);
    // 硬上下限：實測不得偏離公式 ±30%（防止初期掉水分被當成超大赤字而灌水）
    const grossClamped=Math.round(Math.min(formula*1.3, Math.max(formula*0.7, blend)));
    return {hasReal:true, formula, rawGross:R.tdee, gross:grossClamped, base:grossClamped-(R.avgBurn||0),
            avgBurn:R.avgBurn||0, corrected:grossClamped!==Math.round(R.tdee), days, R};
  }
  // 沒有實測（或基本資料沒填全無法比對）：用公式
  return {hasReal:false, formula, rawGross:R.tdee||null, gross:formula||null,
          base:(R.tdeeBase!=null?R.tdeeBase:formula), avgBurn:R.avgBurn||0, corrected:false, days:R.days||0, R};
}
// 依使用者選的基準回傳要用的 TDEE
function baseTDEE(){
  const m=tdeeModel(), mode=val("tdeeBasis")||"gross";
  if(!m.hasReal){
    if(mode==="base" && m.R.tdeeBase!=null) return {tdee:m.R.tdeeBase, src:"基礎 TDEE(不含運動)", mode:"base"};
    if(m.R.tdee) return {tdee:m.R.tdee, src:"真實 TDEE(含運動)", mode:"gross"};
    return {tdee:m.formula, src:"公式估算", mode:"gross"};
  }
  const tag=m.corrected?"·已校正":"";
  if(mode==="base") return {tdee:m.base, src:"基礎 TDEE(不含運動)"+tag, mode:"base", corrected:m.corrected};
  return {tdee:m.gross, src:"真實 TDEE(含運動)"+tag, mode:"gross", corrected:m.corrected};
}
// 建議攝取的絕對下限。低於這條線很難吃滿微量營養素，且低熱量＋高訓練量正是內分泌
// 失調的組合（見 EA 警示）；再兇的赤字設定也不該讓 App 建議吃到 1200 以下。
const MIN_GOAL_KCAL=1200;
const MAX_WEEKLY_PCT=0.01;   // 每週最多減體重的 1%，超過就開始賠掉肌肉
/* ---------- 目標日期 ----------
   日期用來「決定赤字」，但永遠夾在安全範圍內：不破 1200 下限、不超過每週 1% 體重。
   夾不住時不會硬壓熱量，而是誠實說「這個日期做不到」並給出最快的健康達成日，
   讓使用者自己選擇延期或調整目標體重——這才是協助健康減重，而不是催進度。 */
function currentWeight(){
  const wr=(store.records||[]).filter(r=>r.weight!=null);
  return wr.length ? +wr[wr.length-1].weight : (+val("weight")||null);
}
function datePlan(tdee){
  const dateStr=val("targetDate");
  if(!dateStr || val("goal")!=="cut" || !tdee) return null;
  const cur=currentWeight(), tgt=+val("targetWeight");
  if(!cur||!tgt||tgt>=cur) return null;
  const needKg=cur-tgt;
  const days=Math.round((new Date(dateStr)-new Date(todayStr()))/86400000);
  // 兩道安全上限各自算，才知道擋住的是「速率太快」還是「熱量已到下限」——兩者的解法不同
  const capByRate=Math.round(cur*MAX_WEEKLY_PCT*7700/7);
  const capByFloor=Math.round(tdee-MIN_GOAL_KCAL);
  const maxDeficit=Math.max(0, Math.min(capByRate, capByFloor));
  const limitedBy = capByFloor<capByRate ? "floor" : "rate";
  const fastestWeeks = maxDeficit>0 ? needKg/(maxDeficit*7/7700) : null;
  const fastestDate = fastestWeeks!=null
    ? new Date(new Date(todayStr()).getTime()+Math.ceil(fastestWeeks*7)*86400000).toISOString().slice(0,10) : null;
  if(days<=0) return {status:"past", dateStr, needKg, maxDeficit, fastestDate};
  const weeks=days/7;
  const needRateWk=needKg/weeks;
  const rawDeficit=Math.round(needRateWk*7700/7);
  const deficit=Math.max(0, Math.min(rawDeficit, maxDeficit));
  const status = rawDeficit>maxDeficit ? "tooFast"
               : rawDeficit<=0 ? "reached" : "ok";
  return {status, dateStr, days, weeks, needKg, needRateWk, pctBW:needRateWk/cur*100,
          rawDeficit, maxDeficit, deficit, fastestDate, cur, tgt, capByRate, capByFloor, limitedBy,
          nearRateCap: rawDeficit<=maxDeficit && needRateWk/cur*100>=0.85,
          rawKcal:Math.round(tdee-rawDeficit)};
}
function rawGoal(tdee){
  const goal=val("goal"), rate=+val("goalRate");
  if(goal==="cut"){
    // 有設目標日就由日期決定赤字（已夾限），否則沿用使用者選的強度
    const P=datePlan(tdee);
    if(P && P.deficit!=null && P.status!=="past") return Math.round(tdee-P.deficit);
    return Math.round(tdee*(1-rate));
  }
  if(goal==="bulk") return Math.round(tdee*(1+rate*0.5));
  return tdee;
}
// 全 App 的建議攝取都走這裡，夾限才不會有的地方套、有的地方沒套
function applyGoal(tdee){ return Math.max(MIN_GOAL_KCAL, rawGoal(tdee)); }
// 取最近一筆體脂（優先用紀錄，其次用基本資料欄位），用來算瘦體重
function latestBodyFat(){
  const bf=(store.records||[]).filter(r=>r.body_fat!=null);
  if(bf.length) return +bf[bf.length-1].body_fat;
  return null;
}
function goalTargets(){
  const base=baseTDEE(); if(!base.tdee) return null;
  const raw=rawGoal(base.tdee), target=applyGoal(base.tdee);
  const floored=target>raw;   // 下限有生效 → 要讓使用者知道為什麼跟他選的強度對不上
  const w=+val("weight")|| (store.records.length? +store.records[store.records.length-1].weight||60 : 60);
  // 蛋白質依「目標 × 體脂」分級（實證：減脂赤字保肌肉需求最高，增肌夠用即可）
  //   有填體脂→用瘦體重(LBM)更準；否則退回體重。
  //   LBM 係數 減脂2.4/維持2.0/增肌2.2；體重 係數 減脂2.0/維持1.6/增肌1.8
  const goalNow=val("goal");
  const bf=latestBodyFat();
  // 基準與現行一致：有體脂用瘦體重、沒有就用體重。自訂係數只是接手「乘幾」這件事。
  const hasBf = bf!=null && bf>0 && bf<60;
  const basis = hasBf ? w*(1-bf/100) : w;
  const basisName = hasBf ? "瘦體重"+basis.toFixed(1)+"kg" : "體重";
  const custom = +val("proteinPerKg")||0;
  let protein, proteinBasis, proteinCustom=false;
  if(custom>0){
    protein=Math.round(basis*custom); proteinBasis=basisName+"×"+custom+"（自訂）"; proteinCustom=true;
  }else if(hasBf){
    const k={cut:2.4,maintain:2.0,bulk:2.2}[goalNow]||2.0;
    protein=Math.round(basis*k); proteinBasis=basisName+"×"+k;
  }else{
    const k={cut:2.0,maintain:1.6,bulk:1.8}[goalNow]||1.6;
    protein=Math.round(basis*k); proteinBasis=basisName+"×"+k;
  }
  // 女性下限 1.6 g/kg 體重：低熱量＋高訓練量是內分泌失調的組合，蛋白質不該因為赤字或
  // 低體脂估算被壓到這條線以下。但自訂係數是教練的明確決定 → 不強制拉高，只標記後提醒。
  const floor=Math.round(w*1.6);
  if(isFemale() && !proteinCustom && protein<floor){ protein=floor; proteinBasis="體重×1.6（女性下限）"; }
  // 旗標要在套用下限「之後」才算：自動模式已經被拉到下限，就不該再說它低於下限
  const proteinLow = isFemale() && protein<floor;
  // 脂肪佔比依碳水風格：低碳40% / 均衡25% / 高碳18%
  const style=val("macroStyle")||"balanced";
  const fatPct=style==="low"?0.40:style==="high"?0.18:0.25;
  const fatKcal=target*fatPct, fat=Math.round(fatKcal/9);
  const carb=Math.round(Math.max(0,target-protein*4-fatKcal)/4);
  return {kcal:target, protein, fat, carb, base, proteinBasis, fatPct, macroStyle:style, floored, raw,
          proteinCustom, proteinLow, proteinFloor:floor, proteinAutoBasis:basisName, proteinBasisKg:basis};
}
/* ---------- 能量可用性 EA（女性專屬） ---------- */
// EA =（攝取 − 運動消耗）/ 瘦體重(kg)，單位 kcal/kg LBM。
// 為什麼要另外算：熱量赤字只看「相對 TDEE 少吃多少」，看不出「扣掉運動後身體還剩多少能量
// 維持生理功能」。赤字設得很合理、但運動量很大時，EA 仍可能掉到危險區。女性對低 EA 特別
// 敏感（與經期紊亂、內分泌與骨質流失相關），所以這張卡只對女性顯示。
function leanMassKg(){
  const w=+val("weight")|| (store.records.length? +store.records[store.records.length-1].weight||0 : 0);
  if(!w) return null;
  const bf=latestBodyFat();
  if(bf!=null && bf>0 && bf<60) return {lbm:w*(1-bf/100), est:false, w};
  return {lbm:w*0.75, est:true, w};   // 沒體脂資料時的粗估（女性體脂約 25%）
}
// 門檻：<30 低能量可用性（風險區）、30–45 偏低、>=45 充足
function eaLevel(ea){
  if(ea<30) return {key:"low",  color:"#b5564e",      label:"偏低"};
  if(ea<45) return {key:"mid",  color:"var(--warm)",  label:"稍低"};
  return      {key:"ok",   color:"var(--green)", label:"充足"};
}
/* ---------- 飲食記錄可靠度 ----------
   為什麼需要這個：反推 TDEE = 平均記錄攝取 + 赤字。漏記會讓「平均記錄攝取」偏低，
   反推 TDEE 跟著被低估，建議攝取又是從它算出來的，於是被壓得更低，最後 EA 跳紅字——
   一個純粹由漏記造成的假警報，而且會自我強化。所以 EA 示警前要先確認記錄是可信的。 */
const LOW_DAY_KCAL=1000;      // 一整天記不到 1000 kcal，多半是漏記而非真的只吃這麼少
function intakeReliability(){
  const agg=store.mealAgg||{};
  const since=new Date(Date.now()-28*86400000).toISOString().slice(0,10);
  const days=Object.keys(agg).filter(d=>d>=since);
  if(days.length<7) return {enough:false, days:days.length, lowDays:0, ratio:0, reliable:true};
  const lowDays=days.filter(d=>agg[d].k>0 && agg[d].k<LOW_DAY_KCAL).length;
  const ratio=lowDays/days.length;
  // 四分之一以上的日子低到不合理 → 這份攝取資料不足以拿來嚇人
  return {enough:true, days:days.length, lowDays, ratio, reliable:ratio<0.25,
          avgK:Math.round(days.reduce((s,d)=>s+agg[d].k,0)/days.length)};
}
// 反推 TDEE 明顯低於公式 + 記錄不可靠 → 幾乎可以斷定是漏記把 TDEE 拉低了
function tdeeLikelyUnderestimated(){
  const m=tdeeModel(), rel=intakeReliability();
  if(!m.rawGross||!m.formula||!rel.enough) return false;
  return !rel.reliable && m.rawGross < m.formula*0.85;
}
function energyAvailability(intake, burn){
  const L=leanMassKg();
  if(!L || intake==null) return null;
  const ea=(intake-(burn||0))/L.lbm;
  return {ea:Math.round(ea*10)/10, lbm:Math.round(L.lbm*10)/10, est:L.est, level:eaLevel(ea)};
}
// 減重計畫脈絡：把「目標TDEE是否實測、目標體重、目標vs實際每週速度、預計達成日、赤字」整合一包
// 給 AI 教練與報表共用，讓建議都對準『減重進度』而非泛泛營養
function planContext(){
  const base=baseTDEE();
  const t=goalTargets();
  const R=calcReal(store.records, store.exercises);
  const goal=val("goal");
  const wRecs=(store.records||[]).filter(r=>r.weight!=null);
  const curW=wRecs.length?+wRecs[wRecs.length-1].weight:(+val("weight")||null);
  const tgtW=+val("targetWeight")||null;
  const tdeeIsReal=!!(base&&/真實|基礎/.test(base.src||""));
  // 體脂近期變化（取有體脂的最近 ~14 筆，首尾差，負=下降）
  const bfRecs=(store.records||[]).filter(r=>r.body_fat!=null).slice(-14);
  const bfDelta=bfRecs.length>=2?+(+bfRecs[bfRecs.length-1].body_fat-+bfRecs[0].body_fat).toFixed(1):null;
  const bfNow=bfRecs.length?+bfRecs[bfRecs.length-1].body_fat:null;
  // 目標每日赤字與每週應減公斤（減脂才有意義）
  // 從「實際會建議的攝取量」反推赤字，而不是 tdee×rate：1200 下限生效時後者會高估赤字，
  // 連帶讓每週應減公斤與預計達成日都太樂觀。
  const dailyDeficitTarget = (goal==="cut" && base.tdee && t) ? Math.max(0, Math.round(base.tdee-t.kcal)) : 0;
  const weeklyTargetKg = dailyDeficitTarget ? +(dailyDeficitTarget*7/7700).toFixed(2) : null;
  const weeklyObservedKg = R.slopeWk!=null ? +R.slopeWk.toFixed(2) : null;  // 實測每週體重變化(負=下降)
  // 預計達成日
  let etaText=null;
  if(tgtW!=null && curW!=null){
    const diff=tgtW-curW;
    if(Math.abs(diff)<0.1) etaText="已達標 🎉";
    else if(weeklyObservedKg!=null && weeklyObservedKg!==0){
      const perDay=weeklyObservedKg/7;
      if((diff<0&&perDay<0)||(diff>0&&perDay>0)){
        const days=Math.round(diff/perDay), e=new Date(Date.now()+days*86400000);
        etaText=`約 ${e.getFullYear()}/${e.getMonth()+1}/${e.getDate()}（${days}天）`;
      }else etaText="趨勢與目標相反";
    }
  }
  // 經期相位（女性有記錄才有）：解讀體重/身體組成時把水分變因納入
  const cyc=(typeof cyclePhase==="function")?cyclePhase():null;
  // training/caution 一併帶給 AI 教練與週報，建議才會跟著相位走（例如排卵期不叫人挑戰 PR）
  const stripTags=s=>s?String(s).replace(/<[^>]+>/g,""):null;
  const cycleSummary = cyc ? { day:cyc.day, phase:cyc.phase, highWater:!!cyc.highWater,
                               training:stripTags(cyc.training), caution:stripTags(cyc.caution) } : null;
  // 身體組成趨勢（脂肪量/瘦體重），給教練與覆盤參考「掉的是脂肪還是肌肉」
  const bc=bodyComp();
  const bodyCompSummary = bc.ok ? {
    fatWk:bc.fatWk, leanWk:bc.leanWk, wWk:bc.wWk, spanWk:bc.spanWk,
    fatNow:bc.fatNow, leanNow:bc.leanNow, quality:bc.quality.key, qualityLabel:bc.quality.label
  } : null;
  return {
    goal, tdee:base.tdee||null, tdeeSource:base.src||"", tdeeIsReal, dataDays:R.days||0,
    target:t?{kcal:t.kcal,protein:t.protein,fat:t.fat,carb:t.carb}:null,
    weight:curW, targetWeight:tgtW, bfNow, bfDelta,
    dailyDeficitTarget, weeklyTargetKg, weeklyObservedKg,
    dailyDeficitObserved:R.deficit!=null?R.deficit:null, etaText,
    bodyComp:bodyCompSummary, cycle:cycleSummary
  };
}
// 依資料自動判斷減重計畫的階段
const PLAN_STEPS=[["base","建基準"],["cut","執行赤字"],["stall","停滯處理"],["finish","收尾"],["done","達標"]];
function planPhase(){
  const P=planContext();
  const R=calcReal(store.records, store.exercises);
  const dist=(P.weight!=null&&P.targetWeight!=null)?+(P.weight-P.targetWeight).toFixed(1):null;
  const obs=P.weeklyObservedKg;                 // 實測每週體重變化（負=下降）
  const enoughForStall=R.days>=12 && obs!=null; // 至少約 2 週體重資料才談停滯
  if(P.goal!=="cut") return {key:"non-cut",P,R,dist,obs};
  if(dist!=null && dist<=0.1) return {key:"done",P,R,dist,obs};
  if(!R.tdee) return {key:"base",P,R,dist,obs};
  if(dist!=null && dist<=2) return {key:"finish",P,R,dist,obs};
  if(enoughForStall && obs>-0.1){
    // 體重沒動但體脂有降 → body recomposition，不是真停滯
    if(P.bfDelta!=null && P.bfDelta<=-0.3) return {key:"recomp",P,R,dist,obs};
    return {key:"stall",P,R,dist,obs};
  }
  return {key:"cut",P,R,dist,obs};
}
function renderPlan(){
  const box=document.getElementById("planBox"); if(!box) return;
  const ph=planPhase(), P=ph.P, R=ph.R, pill=document.getElementById("planPhasePill");
  if(ph.key==="non-cut"){
    if(pill) pill.textContent="維持/增肌";
    box.innerHTML=`<div class="hint">目前目標為「${({maintain:"維持",bulk:"增肌"})[P.goal]||P.goal}」。要啟用減重計畫，請到 ①基本資料 把「目標」改成<b>減脂</b>。</div>`;
    return;
  }
  const STEP_LABEL={base:"建基準",cut:"執行赤字",recomp:"增肌減脂",stall:"停滯處理",finish:"收尾",done:"達標"};
  if(pill) pill.textContent=STEP_LABEL[ph.key]||"";
  // 階段進度條（recomp 視覺上停在「執行赤字」位置）
  const idx=PLAN_STEPS.findIndex(s=>s[0]===(ph.key==="recomp"?"cut":ph.key));
  const stepper=`<div style="display:flex;gap:4px;margin-bottom:12px;font-size:11px;text-align:center;">`+
    PLAN_STEPS.map(([k,lbl],i)=>{
      const on=i===idx, done=i<idx;
      const col=on?"var(--accent)":done?"var(--green)":"var(--line)";
      const txt=on?"var(--accent)":done?"var(--green)":"var(--sub)";
      return `<div style="flex:1;"><div style="height:4px;border-radius:2px;background:${col};"></div>`+
        `<div style="margin-top:4px;color:${txt};font-weight:${on?"700":"400"}">${lbl}</div></div>`;
    }).join("")+`</div>`;
  const num=(v)=>v==null?"—":v.toLocaleString();
  const tdeeStr=P.tdee?num(P.tdee)+(P.tdeeIsReal?" kcal（實測）":" kcal（公式估*）"):"—";
  const wkObs=ph.obs!=null?(ph.obs>0?"+":"")+ph.obs+"kg/週":"資料不足";
  let title,body,actions=[];
  if(ph.key==="base"){
    const wDays=(store.records||[]).filter(r=>r.weight!=null).length;
    const kDays=(store.records||[]).filter(r=>r.weight!=null&&r.kcal!=null).length;
    const needW=Math.max(0,7-wDays), needK=Math.max(0,3-kDays);
    const cd=(needW>0&&needK>0)?`還差 ${needW} 天體重 + ${needK} 天飲食`:needW>0?`還差 ${needW} 天體重`:needK>0?`還差 ${needK} 天飲食`:"再記一天即可";
    title="🧪 第 0 階段：建立基準";
    body=`先<b>正常吃、認真記</b>，讓系統用你的體重趨勢＋實際攝取反推出<b>真正的 TDEE</b>，之後的赤字才會準。現在的目標只是公式估的暫定值，先別在意短期體重波動。`;
    actions=[`📌 ${cd}就能算出實測 TDEE`,`每天記體重（固定早上空腹）＋當天吃的東西`];
  }else if(ph.key==="cut"){
    title="🔥 執行赤字中";
    const slow=(ph.obs!=null && P.weeklyTargetKg!=null && ph.obs>-Math.abs(P.weeklyTargetKg)*0.6);
    body=`用實測 TDEE 抓赤字、蛋白吃滿（目標 ${num(P.target&&P.target.protein)}g）。每日攝取目標 <b>${num(P.target&&P.target.kcal)} kcal</b>（赤字約 ${num(P.dailyDeficitTarget)}）。`+
      `目標週速度 ${P.weeklyTargetKg!=null?(-Math.abs(P.weeklyTargetKg))+"kg":"—"}、實際 <b>${wkObs}</b>。`+
      (slow?`<br>⚠ 下降偏慢，可再收緊一點攝取或增加活動量。`:`<br>✅ 方向不錯，穩住就好。`);
    actions=[`每週看一次「實際 vs 目標週速度」，差很多才調`,`別靠運動硬湊赤字；重訓保肌、有氧加成`];
    if(P.etaText) actions.push(`依目前速度預計達標：${P.etaText}`);
  }else if(ph.key==="recomp"){
    title="💪 增肌減脂中（體重沒動但體脂在降）";
    body=`體重近 2 週幾乎沒動（<b>${wkObs}</b>），<b>但體脂下降了 ${P.bfDelta}%</b>${P.bfNow!=null?`（目前 ${P.bfNow}%）`:""}。`+
      `這代表你<b>在掉脂肪、同時長/保住肌肉</b>（body recomposition）——這其實是<b>好結果，不是停滯</b>。體重計會騙人，體脂才說實話。`;
    actions=[`別因為體重沒掉就慌著砍熱量，維持現在的赤字＋蛋白＋重訓`,`持續追蹤體脂與圍度（腰圍）當輔助指標`,`若也想看到體重數字下降，可把赤字再加一點點`];
  }else if(ph.key==="stall"){
    title="⏸ 疑似停滯期";
    const maint=R.tdee?num(R.tdee):"你的維持熱量";
    body=`近 2 週體重幾乎沒動（<b>${wkObs}</b>）。常見原因：<b>代謝適應</b>（長期赤字身體下修消耗）、<b>記錄低估</b>、或水分/賀爾蒙波動。`+
      `<br>建議來個 <b>diet break</b>：回到<b>維持熱量（約 ${maint} kcal）</b>吃 1–2 週，讓代謝與賀爾蒙回升，再重啟赤字往往又會開始掉。`;
    actions=[`回維持熱量約 ${maint} kcal、吃 1–2 週（不是放縱，是吃到 TDEE）`,`同時檢查：份量是否低估、量測是否同條件（早上空腹）`,`兩週後仍想減，再把目標切回減脂續跑`];
  }else if(ph.key==="finish"){
    title="🎯 收尾階段";
    body=`距目標僅 <b>${ph.dist}kg</b>，越接近越該<b>放慢</b>，避免反彈與掉肌。建議把赤字縮小（①目標速率改「溫和 10%」），或準備轉成維持。`;
    actions=[`赤字改溫和（10%），速度放緩更穩`,`規劃達標後的維持熱量（約 ${R.tdee?num(R.tdee):"實測 TDEE"} kcal）`];
  }else if(ph.key==="done"){
    title="🎉 已達標！";
    body=`恭喜到達目標體重。接下來重點是<b>不反彈</b>：把攝取拉回<b>維持熱量（約 ${R.tdee?num(R.tdee):"實測 TDEE"} kcal）</b>，持續記錄 1–2 週確認體重穩定。`;
    actions=[`目標改「維持」，吃到實測 TDEE`,`持續記 1–2 週，體重穩了就成功收尾`];
  }
  box.innerHTML=stepper+
    `<div style="font-weight:600;margin-bottom:6px;">${title}</div>`+
    `<div class="hint" style="color:var(--ink);line-height:1.6;">${body}</div>`+
    (actions.length?`<ul style="margin:8px 0 0;padding-left:18px;font-size:13px;line-height:1.7;">`+actions.map(a=>`<li>${a}</li>`).join("")+`</ul>`:"")+
    `<div class="hint" style="margin-top:8px;">目前 TDEE：${tdeeStr}${P.tdeeIsReal?"":"　·　多記幾天會自動轉實測"}</div>`;
}
function calcGoal(){
  const t=goalTargets();
  if(!t){ set("goalKcal","—"); set("goalBasis",""); document.getElementById("goalBar").innerHTML=""; document.getElementById("goalLeg").innerHTML=""; return; }
  const base=t.base, goal=val("goal"), target=t.kcal, protein=t.protein, fat=t.fat, carb=t.carb;
  set("goalKcal", target.toLocaleString()+" kcal");
  let basis=`基準：${base.src} ${base.tdee.toLocaleString()} kcal · ${({cut:"減脂",maintain:"維持",bulk:"增肌"})[goal]}`;
  if(base.mode==="base") basis+="　→ 這是「沒運動」的量，有運動的當天請把消耗加回去再吃。";
  const styleName={low:"低碳",balanced:"均衡",high:"高碳"}[t.macroStyle]||"均衡";
  basis+=`　·　蛋白 ${t.proteinBasis}　·　${styleName}（脂肪${Math.round(t.fatPct*100)}%）`;
  if(base.corrected) basis+="　⚠️ 初期掉的多為水分，實測 TDEE 已向公式校正，避免高估；記滿約 2 週會更準。";
  if(t.floored) basis+=`　⚠️ 照你選的強度算出來是 ${t.raw.toLocaleString()} kcal，已提高到下限 ${MIN_GOAL_KCAL.toLocaleString()}：`+
    `吃更低不會瘦得更快，只會讓微量營養素吃不夠、恢復變差。想加大赤字請改成增加活動量，而不是再往下砍。`;
  set("goalBasis", basis);
  drawMacroBar("goalBar","goalLeg",protein,fat,carb);
  renderProteinHint(t);
  renderGoalEa(t);
}
// 蛋白質係數欄位下方的說明：自訂時要看得到「自動會給多少」才好比較
function renderProteinHint(t){
  const box=document.getElementById("proteinHint"); if(!box) return;
  const w=+val("weight")||0;
  const perKgBW = w ? (t.protein/w).toFixed(2) : "—";
  const pctKcal = Math.round(t.protein*4/t.kcal*100);
  let s=`目前 <b>${t.protein}g</b>（${t.proteinBasis}）＝ 每公斤體重 ${perKgBW}g・佔總熱量 ${pctKcal}%`;
  if(!t.proteinCustom){
    s+=`<br>係數留空時由系統決定：有體脂用瘦體重×2.4/2.0/2.2（減脂/維持/增肌），否則體重×2.0/1.6/1.8。`+
       `填數字就會乘在<b>${t.proteinAutoBasis.replace(/[\d.]+kg/,"")}</b>（${t.proteinBasisKg.toFixed(1)}kg）上。`;
  }
  if(t.proteinLow){
    s=`<span style="color:var(--warm)">⚠️ 這個係數算出來是 ${t.protein}g，低於女性建議下限 ${t.proteinFloor}g（體重×1.6）。`+
      `減脂期蛋白質不足會讓掉的變成肌肉，經期與恢復也容易出狀況。確定要這樣設就留著，我不會擋。</span><br>`+s;
  }
  if(t.proteinCustom && pctKcal>45){
    s+=`<br><span style="color:var(--warm)">蛋白質已佔 ${pctKcal}% 的熱量，碳水只剩 ${t.carb}g——訓練強度高的話會不夠用。</span>`;
  }
  box.innerHTML=`<div class="hint" style="margin-top:6px;line-height:1.6;">${s}</div>`;
}
// 事前檢查：照現在這組「目標 kcal ＋ 平均運動量」吃下去，EA 會落在哪裡
function renderGoalEa(t){
  const box=document.getElementById("goalEa"); if(!box) return;
  if(!isFemale()){ box.innerHTML=""; return; }
  const m=tdeeModel(), burn=Math.round(m.avgBurn||0);
  // base 基準的目標本來就不含運動（使用者會自行把消耗加回去吃），所以扣的運動量是 0
  const E=energyAvailability(t.kcal, t.base.mode==="base"?0:burn);
  if(!E){ box.innerHTML=""; return; }
  const L=E.level;
  // 記錄不可靠時，低 EA 多半是漏記的產物 → 先請他補記錄，而不是叫他吃更多／少練
  const rel=intakeReliability();
  if(L.key==="low" && !rel.reliable){
    const under=tdeeLikelyUnderestimated();
    box.innerHTML=
      `<div style="margin-top:12px;background:var(--soft);border-radius:12px;padding:10px 14px;border-left:4px solid var(--warm);">`+
        `<div style="font-size:13px;font-weight:700;color:var(--warm);">📝 先確認飲食記錄有沒有漏</div>`+
        `<div style="font-size:12px;color:var(--ink);line-height:1.6;margin-top:5px;">`+
          `近 28 天有記錄的 ${rel.days} 天裡，有 <b>${rel.lowDays} 天</b>整天加起來不到 ${LOW_DAY_KCAL} kcal。`+
          `這個量通常代表「有吃但沒記」，而不是真的只吃這些。`+
          (under?`<br>而且你的實測 TDEE（${tdeeModel().rawGross.toLocaleString()}）明顯低於公式估算（${tdeeModel().formula.toLocaleString()}）——`+
                 `<b>漏記會讓實測 TDEE 被低估，建議攝取跟著被壓低</b>，愈記愈少、建議也愈少。`:"")+
          `<br>把飲料、調味油、零食也記進去之後，這張卡才有參考價值。`+
        `</div>`+
      `</div>`;
    return;
  }
  const note = L.key==="low"
    ? `⚠️ 低能量可用性：扣掉運動後身體剩下的能量不足以好好維持生理功能與修復，長期容易造成經期紊亂、內分泌失調、恢復變差與骨質流失。<b>建議把減脂強度調低一階，或減少有氧總量</b>——不是少吃就會瘦得更好。`
    : L.key==="mid"
    ? `這個區間還算可行，但若同時出現睡不好、情緒起伏大、訓練體感變差，優先把吃的加回去而不是再加運動。`
    : `能量充足，身體有餘裕修復與適應，可以放心把訓練強度拉上去。`;
  box.innerHTML=
    `<div style="margin-top:12px;background:var(--soft);border-radius:12px;padding:10px 14px;border-left:4px solid ${L.color};">`+
      `<div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;">`+
        `<span style="font-size:12px;color:var(--sub);">能量可用性 EA</span>`+
        `<span style="font-size:20px;font-weight:800;color:${L.color};line-height:1;">${E.ea}</span>`+
        `<span style="font-size:12px;color:var(--sub);">kcal/kg 瘦體重</span>`+
        `<span style="font-size:12px;font-weight:700;color:${L.color};">${L.label}</span>`+
      `</div>`+
      `<div style="font-size:11px;color:var(--sub);margin-top:4px;">`+
        `（${t.kcal.toLocaleString()}${(t.base.mode!=="base"&&burn)?` − 運動 ${burn.toLocaleString()}`:""}）÷ 瘦體重 ${E.lbm}kg`+
        `${E.est?"（未填體脂，瘦體重以體重×0.75 粗估）":""}`+
      `</div>`+
      `<div style="font-size:12px;color:var(--ink);line-height:1.5;margin-top:5px;">${note}</div>`+
    `</div>`;
}
function drawMacroBar(barId,legId,p,f,c){
  const pk=p*4,fk=f*9,ck=c*4,tot=pk+fk+ck||1;
  document.getElementById(barId).innerHTML=
    `<i style="width:${pk/tot*100}%;background:#5b8aa6"></i><i style="width:${fk/tot*100}%;background:#c98b5e"></i><i style="width:${ck/tot*100}%;background:#7c9070"></i>`;
  document.getElementById(legId).innerHTML=
    `<span><i class="dot" style="background:#5b8aa6"></i>蛋白 <b>${p}g</b></span><span><i class="dot" style="background:#c98b5e"></i>脂肪 <b>${f}g</b></span><span><i class="dot" style="background:#7c9070"></i>碳水 <b>${c}g</b></span>`;
}

/* ---------- 食物計算機 ---------- */
function fillFoodList(){}  // 已改用自訂下拉，保留空函式相容
function allFoodNames(){ return Object.keys(FOODS).concat(Object.keys(FOODS_DYN)).concat(Object.keys(FOODS_TW)); }
// 別名/同義詞正規化：讓「五十嵐」找得到「50嵐」等
const SEARCH_ALIAS=[["五十嵐","50嵐"],["五0嵐","50嵐"],["可可","可不可"],["coco","都可"],["cama","cama"],["7-11","超商"],["711","超商"],["小七","超商"],["7-eleven","超商"],["全家","超商"],["星巴克","starbucks 星巴克"],["路易莎","louisa 路易莎"],["美而美","早餐店"],["麥味登","早餐店"],["弘爺","早餐店"],["晨間","早餐店"],["sushi","爭鮮"],["laya","拉亞"]];
function normSearch(s){
  s=s.toLowerCase();
  for(const [a,b] of SEARCH_ALIAS){ if(s.includes(a)) s+=" "+b; }
  return s;
}
// 查詢用：把別名「替換」成對應詞（如 美而美→早餐店、五十嵐→50嵐），
// 而非附加，否則多關鍵字 AND 比對會要求兩者都命中而查無結果。
function aliasQuery(s){
  s=s.toLowerCase();
  for(const [a,b] of SEARCH_ALIAS){ if(s.includes(a)) s=s.split(a).join(" "+b+" "); }
  return s;
}
// 單列 HTML（i = window.__fs 內的索引，點擊即加入）
function sgRow(n,i){
  const d=foodData(n);
  const tag=SHARED_NAMES.has(n)?'<span title="共享食物庫" style="color:var(--sub);font-size:11px">👥 </span>':"";
  const used=(FOOD_STATS[n]?.c||0)>0?'<span title="常用" style="color:var(--sub);font-size:11px">🕘</span>':"";
  return `<div class="sg" onclick="pickFood(${i})">${tag}${n} ${densityTags(d)}${used}<span style="color:var(--green);float:right">${d?Math.round(d[0]):""}</span></div>`;
}
const sgHeader=(t)=>`<div class="sg" style="color:var(--sub);font-size:11px;pointer-events:none;cursor:default;background:transparent;">${t}</div>`;
function foodSuggest(){
  const q=val("foodPick").trim(), box=document.getElementById("foodSuggest");
  if(!q){
    // 沒打字 → 只顯示「最愛 + 最近常用」，不倒一堆出來
    const favs=(store.favorites||[]).map(f=>f.n).filter(n=>foodData(n)).slice(0,6);
    const recent=Object.keys(FOOD_STATS).filter(n=>foodData(n)&&!favs.includes(n)).sort((a,b)=>(FOOD_STATS[b].c||0)-(FOOD_STATS[a].c||0)).slice(0,6);
    const list=[...favs,...recent]; window.__fs=list;
    if(!list.length){ box.style.display="none"; box.innerHTML=""; return; }
    let html="", idx=0;
    if(favs.length){ html+=sgHeader("⭐ 最愛"); favs.forEach(n=>{ html+=sgRow(n,idx++); }); }
    if(recent.length){ html+=sgHeader("🕘 最近常用"); recent.forEach(n=>{ html+=sgRow(n,idx++); }); }
    box.innerHTML=html; box.style.display="block"; return;
  }
  const ql=q.toLowerCase();
  const toks=aliasQuery(q).split(/\s+/).filter(Boolean);  // 多關鍵字：全部命中才算（別名先替換）
  let res=[...new Set(allFoodNames())].filter(n=>{ const nn=normSearch(n); return toks.every(t=>nn.includes(t)); });
  if(FOOD_FILTER) res=res.filter(n=>foodCat(n)===FOOD_FILTER);
  res.sort((a,b)=>{
    // 1) 完全相符優先
    const ea=(a.toLowerCase()===ql?0:1)-(b.toLowerCase()===ql?0:1); if(ea) return ea;
    // 2) 開頭相符優先
    const sa=(a.toLowerCase().startsWith(ql)?0:1)-(b.toLowerCase().startsWith(ql)?0:1); if(sa) return sa;
    // 3) 烹調變體（含溫度/時間/烹法）排到後面，乾淨主名稱先出
    const va=(isVariant(a)?1:0)-(isVariant(b)?1:0); if(va) return va;
    // 4) 較短名稱優先（通常是主品項，變體名較長）
    const ca=(FOOD_STATS[b]?.c||0)-(FOOD_STATS[a]?.c||0); if(ca) return ca;   // 常用優先
    return a.length-b.length;
  });
  const more=res.length>14;
  res=res.slice(0,14); window.__fs=res;
  const aiBtn=`<div class="sg" style="cursor:default;background:transparent;text-align:center;padding:8px 0;">`+
    `庫裡${res.length?"沒有你要的？":"找不到「"+q+"」"} `+
    `<button class="ghost sm" onclick='estimateFromPick()'>✨ 用 AI 估這句</button></div>`;
  if(!res.length){ box.innerHTML=aiBtn; box.style.display="block"; return; }
  box.innerHTML=res.map((n,i)=>sgRow(n,i)).join("")+(more?sgHeader("…還有更多，再多打幾個字縮小範圍"):"")+aiBtn;
  box.style.display="block";
}
function renderShared(){
  const list=(store.sharedFoods||[]);
  set("sharedCount", list.length?list.length+" 筆":"");
  const q=(document.getElementById("sharedSearch").value||"").trim().toLowerCase();
  const box=document.getElementById("sharedList");
  let rows=list.filter(s=>!q||s.name.toLowerCase().includes(q));
  if(!rows.length){ box.innerHTML='<div class="empty">'+(q?"查無":"還沒有共享品項。建立自訂食物或食譜就會出現在這裡。")+'</div>'; return; }
  rows=rows.slice(0,200);
  box.innerHTML=rows.map(s=>{
    const mine=session&&s.created_by===session.userId;
    const esc=s.name.replace(/'/g,"\\'");
    if(mine&&editingShared===s.name){
      // 編輯模式：可改名稱 + 每100g 數值
      return `<div class="foodrow" style="flex-wrap:wrap;gap:4px;">`+
        `<span class="nm" style="flex:1 1 100%;">✏️ 編輯<span style="color:var(--sub);font-size:11px"> · 每100g</span></span>`+
        `<input id="esN" type="text" value="${s.name.replace(/"/g,'&quot;')}" style="flex:1 1 100%;padding:5px" placeholder="名稱">`+
        `<input id="esK" type="number" value="${Math.round(s.kcal||0)}" style="width:64px;padding:5px" placeholder="kcal"><span style="font-size:11px;color:var(--sub)">kcal</span>`+
        `<input id="esP" type="number" value="${Math.round(s.protein||0)}" style="width:52px;padding:5px" placeholder="蛋"><span style="font-size:11px;color:var(--sub)">蛋</span>`+
        `<input id="esF" type="number" value="${Math.round(s.fat||0)}" style="width:52px;padding:5px" placeholder="脂"><span style="font-size:11px;color:var(--sub)">脂</span>`+
        `<input id="esC" type="number" value="${Math.round(s.carb||0)}" style="width:52px;padding:5px" placeholder="碳"><span style="font-size:11px;color:var(--sub)">碳</span>`+
        `<span style="flex:1 1 100%;margin-top:4px;"><button class="sm" style="width:auto;padding:6px 14px;margin:0;" onclick="saveShared('${esc}')">儲存</button> `+
        `<button class="ghost sm" onclick="cancelSharedEdit()">取消</button></span></div>`;
    }
    const btns=mine
      ?`<span class="x" style="color:var(--accent)" onclick="editSharedItem('${esc}')">✏️</span><span class="x" onclick="delShared('${esc}')">✕</span>`
      :`<span class="x" style="visibility:hidden">✕</span>`;
    return `<div class="foodrow"><span class="nm">${mine?"⭐ ":""}${s.name}<br><span style="color:var(--sub);font-size:11px">每100g · 蛋${Math.round(s.protein||0)} 脂${Math.round(s.fat||0)} 碳${Math.round(s.carb||0)}</span></span>`+
      `<span class="kc">${Math.round(s.kcal||0)}</span>${btns}</div>`;
  }).join("");
}
let editingShared=null;
function editSharedItem(name){ editingShared=name; renderShared(); }
function cancelSharedEdit(){ editingShared=null; renderShared(); }
async function saveShared(oldName){
  const it=(store.sharedFoods||[]).find(s=>s.name===oldName); if(!it) return;
  const name=(val("esN")||"").trim()||oldName;
  const kcal=+val("esK")||0;
  if(kcal<=0){ alert("熱量需大於 0"); return; }
  const body={name, oldName, kcal, protein:+val("esP")||0, fat:+val("esF")||0, carb:+val("esC")||0, grams:it.grams||100, kind:it.kind||"food"};
  try{ await api("/api/sharedfood",{method:"POST",body:JSON.stringify(body)}); editingShared=null; await reload(); }
  catch(e){ alert(e.message); }
}
async function delShared(name){
  if(!confirm(`從共享庫刪除「${name}」？`)) return;
  try{ await api("/api/sharedfood",{method:"DELETE",body:JSON.stringify({name})}); await reload(); }
  catch(e){ alert(e.message); }
}
function setFoodFilter(f,btn){
  FOOD_FILTER=f;
  document.querySelectorAll("#foodFilters .fbtn").forEach(b=>b.classList.toggle("on",b===btn));
  foodSuggest();
}
function pickFood(i){
  const n=window.__fs[i]; if(n==null) return;
  addToCart(n, statG(n));   // 用上次克數，否則一份/100g
  document.getElementById("foodPick").value="";
  document.getElementById("foodSuggest").style.display="none";
}
// 把食物加入清單（預設克數），克數可在清單內調整
function addToCart(n,g){
  const d=foodData(n); if(!d) return false;
  foodCart.push({n, g:g||100, base:[+d[0]||0,+d[1]||0,+d[2]||0,+d[3]||0]});
  renderFood(); return true;
}
// 照片辨識後：把所有 ✨ 項目的克數一次縮放（相對 AI 原始克數）
let aiBaseG={};
function scaleAiPortions(f){
  foodCart.forEach(it=>{ const b=aiBaseG[it.n]; if(b!=null) it.g=Math.max(1,Math.round(b*f)); });
  renderFood();
}
function cartMacros(it){
  const g=it.g, b=it.base;
  const lv=(it.sugarLv==null?1:it.sugarLv);
  const cFull=b[3], c=cFull*lv;                 // 把碳水視為糖，按甜度比例保留
  const k=Math.max(0, b[0]-(cFull-c)*4);        // 扣掉減掉的糖熱量(4kcal/g)
  return {k:k*g/100, p:b[1]*g/100, f:b[2]*g/100, c:c*g/100};
}
function setGram(i,v){ foodCart[i].g=Math.max(0,parseFloat(v)||0); renderFood(); }
function setSugar(i,v){ foodCart[i].sugarLv=parseFloat(v); renderFood(); }
function foodPreview(){}  // 已不需要（份量改在清單內調整）
function renderFood(){
  document.getElementById("foodItems").innerHTML=foodCart.map((it,i)=>{
    const m=cartMacros(it);
    const lv=(it.sugarLv==null?1:it.sugarLv);
    let sugarSel="";
    const hasLevel=/(無糖|分糖|微糖|半糖|少糖|全糖)\d*%?\)/.test(it.n);  // 50嵐/茶湯會已內含甜度(如「半糖50%」)，不重複給選單→避免雙重扣糖
    if(foodCat(it.n)==="drink" && !hasLevel){
      const opts=[[1,"全糖"],[0.7,"少糖"],[0.5,"半糖"],[0.3,"微糖"],[0.1,"1分糖"],[0,"無糖"]]
        .map(([v,t])=>`<option value="${v}"${v===lv?" selected":""}>${t}</option>`).join("");
      sugarSel=`<select onchange="setSugar(${i},this.value)" style="padding:5px 4px;font-size:12px;width:64px">${opts}</select>`;
    }
    const canRename=!!FOODS_DYN[it.n];   // 拍標示/AI/自訂等動態建立的食物才給改名（內建食物不動）
    const renameBtn=canRename?`<span class="x" title="改商品名稱" onclick="renameFood(${i})" style="color:var(--accent)">✏️</span>`:"";
    return `<div class="foodrow"><span class="nm">${it.n} ${densityTags(it.base)}<br><span style="color:var(--sub);font-size:11px">${portionHint(it.n,it.g)}</span></span>`+
      sugarSel+
      `<input type="number" inputmode="decimal" value="${it.g}" onchange="setGram(${i},this.value)" style="width:62px;padding:6px 8px;text-align:right;font-size:14px"><span style="color:var(--sub);font-size:12px">g</span>`+
      `<span class="kc" style="min-width:54px;text-align:right">${Math.round(m.k)}</span>`+
      renameBtn+
      `<span class="x" onclick="rmFood(${i})">✕</span></div>`;
  }).join("");
  const tot=foodCart.reduce((a,b)=>{const m=cartMacros(b);return {k:a.k+m.k,p:a.p+m.p,f:a.f+m.f,c:a.c+m.c};},{k:0,p:0,f:0,c:0});
  const el=document.getElementById("foodTotal"), sb=document.getElementById("cartSaveBtns");
  const mb=document.getElementById("mealAddBox"); if(mb) mb.classList.toggle("on", foodCart.length>0);   // 有東西才把存餐列固定置底
  if(foodCart.length){ el.style.display="block"; sb.style.display="block";
    el.innerHTML=`<div class="lbl">合計</div><div class="big">${Math.round(tot.k)} kcal</div><div class="hint">蛋白 ${tot.p.toFixed(0)}g · 脂肪 ${tot.f.toFixed(0)}g · 碳水 ${tot.c.toFixed(0)}g</div>`;
  }else{ el.style.display="none"; sb.style.display="none"; }
}
function rmFood(i){ foodCart.splice(i,1); renderFood(); }
// 改商品名稱（拍標示/AI/自訂食物）：同步更新動態食物表、購物車、最愛與共享庫
function renameFood(i){
  const it=foodCart[i]; if(!it) return;
  const prefix=/^✨\s*/.test(it.n)?"✨ ":"";   // 保留 AI 標記
  const cur=it.n.replace(/^✨\s*/,"");
  const inp=(prompt("商品名稱改成：",cur)||"").trim();
  if(!inp) return;
  const finalName=prefix+inp;
  if(finalName===it.n) return;
  if(FOODS[finalName]||FOODS_TW[finalName]||FOODS_DYN[finalName]){ if(!confirm("已有同名項目，仍要改成這個名稱？（會共用同一筆資料）")) return; }
  const oldName=it.n;
  // 搬移動態食物資料（營養/份量）
  if(FOODS_DYN[oldName]){ FOODS_DYN[finalName]=FOODS_DYN[oldName]; delete FOODS_DYN[oldName]; }
  if(SERVINGS[oldName]!=null){ SERVINGS[finalName]=SERVINGS[oldName]; delete SERVINGS[oldName]; }
  // 更新購物車所有同名項
  foodCart.forEach(x=>{ if(x.n===oldName) x.n=finalName; });
  // 更新最愛
  if(store.favorites){ let changed=false; store.favorites.forEach(f=>{ if(f.n===oldName){ f.n=finalName; changed=true; } }); if(changed){ saveFavs(); if(typeof renderFavs==="function") renderFavs(); } }
  // 非 AI 暫存項（拍標示/自訂）用新名稱重新上傳共享庫
  if(!prefix && FOODS_DYN[finalName]) shareFood(finalName,FOODS_DYN[finalName],SERVINGS[finalName]||100,"food");
  renderFood();
}
function selDate(){ return val("foodDate")||todayStr(); }
const CARD_STATE = (()=>{ try{ return JSON.parse(localStorage.getItem("tdee_cardstate")||"{}"); }catch(e){ return {}; } })();
function toggleCard(h){
  const card=h.parentElement; card.classList.toggle("collapsed");
  const k=h.getAttribute("data-ck"); if(k){ CARD_STATE[k]=card.classList.contains("collapsed"); try{ localStorage.setItem("tdee_cardstate",JSON.stringify(CARD_STATE)); }catch(e){} }
}
function restoreCards(){
  document.querySelectorAll("h2.ch[data-ck]").forEach(h=>{ const k=h.getAttribute("data-ck"); if(k in CARD_STATE) h.parentElement.classList.toggle("collapsed", CARD_STATE[k]); });
}
function applyTips(){
  const on=localStorage.getItem("tdee_tips")==="1";
  document.body.classList.toggle("show-tips",on);
  const b=document.getElementById("tipBtn"); if(b) b.classList.toggle("on",on);
}
function toggleTips(){ localStorage.setItem("tdee_tips", localStorage.getItem("tdee_tips")==="1"?"0":"1"); applyTips(); }
function showTab(name){
  ["overview","food","exercise","records","games","grocery"].forEach(t=>document.getElementById("page-"+t).classList.toggle("hidden", t!==name));
  document.querySelectorAll(".bottomnav .nav").forEach(n=>n.classList.toggle("on", n.dataset.tab===name));
  if(name==="games" && typeof loadAllGames==="function") loadAllGames();   // 進遊戲分頁才載入(lazy)，整個 session 只載一次
  if(name==="games" && typeof loadDexGame==="function") loadDexGame();      // 圖鑑每次進來都刷新(反映最新扭蛋/培養)
  if(name==="grocery" && typeof renderGrocery==="function") renderGrocery();
  window.scrollTo(0,0);
}

/* ---------- 買菜月結（現金流法，僅 zen 顯示） ---------- */
function setGType(t){
  ["buy","meal","extra","settle"].forEach(k=>{
    document.getElementById("gForm-"+k).classList.toggle("hidden", k!==t);
  });
  document.querySelectorAll(".gtypebtn").forEach(b=>b.classList.toggle("on", b.dataset.gt===t));
}
function isZen(){ return ((session&&session.username)||"").trim().toLowerCase()==="zen"; }
function applyGroceryVisibility(){ const nav=document.querySelector('.bottomnav .nav[data-tab="grocery"]'); if(nav) nav.style.display=isZen()?"":"none"; }
function seedGroceryZen(){
  if(!isZen()) return;
  if(localStorage.getItem("grocery_seeded_v1")) return;
  const g=store.grocery||{buys:[],meals:[]};
  if((g.buys&&g.buys.length)||(g.meals&&g.meals.length)){ localStorage.setItem("grocery_seeded_v1","1"); return; }
  const uid=()=>Date.now()+""+Math.random();
  const buys=[
    {date:"2026-06-29",amount:2465,note:"雞腿8kg、雞柳3kg、蒜仁200g、辣椒100g"},
    {date:"2026-06-29",amount:3295,note:"蒜泥21罐、辣味噌160g、燒肉醬350ml、海帶140g、白胡椒粉2罐、芝麻油1罐、四季豆14包"},
    {date:"2026-06-29",amount:1252,note:"裙帶菜1.5包、餛飩2盒、蝦仁907g、橄欖油1L、雞蛋豆腐3盒"},
    {date:"2026-07-15",amount:666,note:"胡椒粉、四季豆"},
  ];
  const meals=[["2026-06-30","中午"],["2026-07-02","中午"],["2026-07-04","一餐"],["2026-07-06","一餐"],["2026-07-07","一餐"],["2026-07-08","一餐"],["2026-07-09","一餐"],["2026-07-15","一餐"]];
  store.grocery={
    buys: buys.map(b=>({id:uid(),date:b.date,note:b.note,amount:b.amount})),
    meals: meals.map(m=>({id:uid(),date:m[0],note:m[1],people:2})),
  };
  localStorage.setItem("grocery_seeded_v1","1");
  saveGrocery();
}
function saveGrocery(){ api("/api/grocery",{method:"PUT",body:JSON.stringify(store.grocery||{buys:[],meals:[]})}).catch(()=>{}); }
function addGBuy(){
  const date=val("gBuyDate")||todayStr(), amount=Math.round(+val("gBuyAmount")||0), note=(val("gBuyNote")||"").trim();
  if(!amount){ alert("請輸入進貨金額"); return; }
  store.grocery=store.grocery||{buys:[],meals:[]}; store.grocery.buys=store.grocery.buys||[];
  store.grocery.buys.push({id:Date.now()+""+Math.random(),date,note,amount});
  set("gBuyAmount",""); set("gBuyNote","");
  saveGrocery(); renderGrocery();
}
function addGMeal(){
  const date=val("gMealDate")||todayStr(), people=Math.max(1,Math.round(+val("gMealPeople")||1)), note=(val("gMealNote")||"").trim();
  store.grocery=store.grocery||{buys:[],meals:[]}; store.grocery.meals=store.grocery.meals||[];
  store.grocery.meals.push({id:Date.now()+""+Math.random(),date,people,note});
  set("gMealNote","");
  saveGrocery(); renderGrocery();
}
function delGBuy(id){ if(!store.grocery) return; store.grocery.buys=(store.grocery.buys||[]).filter(x=>x.id!==id); saveGrocery(); renderGrocery(); }
function delGMeal(id){ if(!store.grocery) return; store.grocery.meals=(store.grocery.meals||[]).filter(x=>x.id!==id); saveGrocery(); renderGrocery(); }
const SUBSIDY_PER_DAY=200;
function isWeekday(dstr){ const d=new Date(dstr+"T00:00:00"); const w=d.getDay(); return w>=1&&w<=5; }   // 週一~五
function addGSettle(){
  const date=val("gSetDate")||todayStr(), amount=Math.round(+val("gSetAmount")||0), note=(val("gSetNote")||"").trim();
  if(!amount){ alert("請輸入領到的金額"); return; }
  store.grocery=store.grocery||{buys:[],meals:[],settles:[]}; store.grocery.settles=store.grocery.settles||[]; store.grocery.extras=store.grocery.extras||[];
  store.grocery.settles.push({id:Date.now()+""+Math.random(),date,amount,note});
  set("gSetAmount",""); set("gSetNote","");
  saveGrocery(); renderGrocery();
}
function delGSettle(id){ if(!store.grocery) return; store.grocery.settles=(store.grocery.settles||[]).filter(x=>x.id!==id); saveGrocery(); renderGrocery(); }
function addGExtra(){
  const date=val("gExtraDate")||todayStr(), amount=Math.round(+val("gExtraAmount")||0), note=(val("gExtraNote")||"").trim();
  if(!amount){ alert("請輸入金額"); return; }
  store.grocery=store.grocery||{buys:[],meals:[],settles:[],extras:[]}; store.grocery.extras=store.grocery.extras||[];
  store.grocery.extras.push({id:Date.now()+""+Math.random(),date,note,amount});
  set("gExtraAmount",""); set("gExtraNote","");
  saveGrocery(); renderGrocery();
}
function delGExtra(id){ if(!store.grocery) return; store.grocery.extras=(store.grocery.extras||[]).filter(x=>x.id!==id); saveGrocery(); renderGrocery(); }
function gMonth(d){ return (d||"").slice(0,7); }
function renderGrocery(){
  seedGroceryZen();
  const g=store.grocery||{buys:[],meals:[]};
  const buys=g.buys||[], meals=g.meals||[], extras=g.extras||[];
  // 預設日期為今天
  if(!val("gBuyDate")) set("gBuyDate",todayStr());
  if(!val("gMealDate")) set("gMealDate",todayStr());
  if(!val("gExtraDate")) set("gExtraDate",todayStr());
  // 依月份彙整（進貨＋額外伙食費 = 當月總伙食費）
  const months={};
  buys.forEach(b=>{ const m=gMonth(b.date); if(!m) return; (months[m]=months[m]||{buy:0,extra:0,mealCnt:0,people:0}).buy+=+b.amount||0; });
  extras.forEach(x=>{ const m=gMonth(x.date); if(!m) return; (months[m]=months[m]||{buy:0,extra:0,mealCnt:0,people:0}).extra+=+x.amount||0; });
  meals.forEach(x=>{ const m=gMonth(x.date); if(!m) return; const o=months[m]=months[m]||{buy:0,extra:0,mealCnt:0,people:0}; o.mealCnt+=1; o.people+=+x.people||0; });
  const keys=Object.keys(months).sort((a,b)=>b.localeCompare(a));
  const sb=document.getElementById("gSummaryBox");
  if(!keys.length){ sb.innerHTML=`<div class="hint">還沒有資料，先在上面記一筆吧。</div>`; }
  else{
    let totBuy=0, totExtra=0, totMeal=0;
    const rows=keys.map(m=>{
      const o=months[m]; const tot=o.buy+o.extra; totBuy+=o.buy; totExtra+=o.extra; totMeal+=o.mealCnt;
      // 平均每餐/每人只算自煮進貨，外食不併入（避免拉高/拉低自煮成本）
      const avg=o.mealCnt?Math.round(o.buy/o.mealCnt):0;
      const avgP=o.people?Math.round(o.buy/o.people):0;
      return `<tr><td>${m}</td><td style="text-align:right">$${o.buy.toLocaleString()}</td><td style="text-align:right">$${o.extra.toLocaleString()}</td><td style="text-align:right;font-weight:600">$${tot.toLocaleString()}</td><td style="text-align:right">${o.mealCnt}</td>`+
        `<td style="text-align:right;font-weight:600;color:var(--accent)">$${avg.toLocaleString()}</td>`+
        `<td style="text-align:right">$${avgP.toLocaleString()}</td></tr>`;
    }).join("");
    const totAll=totBuy+totExtra;
    const gAvg=totMeal?Math.round(totBuy/totMeal):0;
    sb.innerHTML=`<div class="gtblwrap"><table class="gtbl"><thead><tr><th>月份</th><th style="text-align:right">進貨</th><th style="text-align:right">外食</th><th style="text-align:right">月總計</th><th style="text-align:right">餐數</th><th style="text-align:right">自煮每餐</th><th style="text-align:right">自煮每人</th></tr></thead><tbody>${rows}</tbody></table></div>`+
      `<div class="hint" style="margin-top:8px">全期累計：自煮進貨 $${totBuy.toLocaleString()}　÷　${totMeal} 餐　=　平均每餐 <b style="color:var(--accent)">$${gAvg.toLocaleString()}</b>　（外食累計另計 $${totExtra.toLocaleString()}，全部合計 $${totAll.toLocaleString()}）</div>`;
  }
  // 公司補給：平日有煮的天數 × 200 = 累計補給；已申請現金 = settles 加總；結餘 = 差額
  const settles=g.settles||[];
  const cookWeekdays=new Set(); meals.forEach(x=>{ if(x.date&&isWeekday(x.date)) cookWeekdays.add(x.date); });
  const accrued=cookWeekdays.size*SUBSIDY_PER_DAY;
  const claimed=settles.reduce((a,s)=>a+(+s.amount||0),0);
  const balance=accrued-claimed;
  const sbx=document.getElementById("gSubsidyBox");
  if(sbx){
    const setList=settles.slice().sort((a,b)=>(b.date||"").localeCompare(a.date||""));
    const setRows=setList.length?setList.map(s=>`<div class="grow"><span class="gd">${s.date}</span><span class="gn">${s.note||"申請現金"}</span><span class="ga">$${(+s.amount||0).toLocaleString()}</span><span class="x" onclick="delGSettle('${s.id}')">✕</span></div>`).join(""):`<div class="hint">尚未記錄任何申請</div>`;
    const balColor=balance>0?"var(--green)":(balance<0?"#b5564e":"var(--sub)");
    const balLabel=balance>0?"還沒領（可申請）":(balance<0?"多領了⚠️":"已結清");
    // 每月分解：累計依當月平日煮餐天數計算；已領按申請日期所在月份計算（跟現金流法一致，用實際入帳月）
    const subMonths={};
    cookWeekdays.forEach(d=>{ const m=gMonth(d); if(!m) return; (subMonths[m]=subMonths[m]||{accrued:0,claimed:0}).accrued+=SUBSIDY_PER_DAY; });
    settles.forEach(s=>{ const m=gMonth(s.date); if(!m) return; (subMonths[m]=subMonths[m]||{accrued:0,claimed:0}).claimed+=(+s.amount||0); });
    const subKeys=Object.keys(subMonths).sort((a,b)=>b.localeCompare(a));
    const subRows=subKeys.map(m=>{
      const o=subMonths[m], bal=o.accrued-o.claimed;
      const c=bal>0?"var(--green)":(bal<0?"#b5564e":"var(--sub)");
      return `<tr><td>${m}</td><td style="text-align:right">$${o.accrued.toLocaleString()}</td><td style="text-align:right">$${o.claimed.toLocaleString()}</td><td style="text-align:right;font-weight:600;color:${c}">$${bal.toLocaleString()}</td></tr>`;
    }).join("");
    const subTable=subKeys.length?`<div class="gtblwrap" style="margin-top:10px"><table class="gtbl"><thead><tr><th>月份</th><th style="text-align:right">補給</th><th style="text-align:right">已領</th><th style="text-align:right">結餘</th></tr></thead><tbody>${subRows}</tbody></table></div>`:"";
    sbx.innerHTML=
      `<div class="subgrid">`+
        `<div class="subcell"><div class="subnum">$${accrued.toLocaleString()}</div><div class="sublab">累計補給<br><span class="hint">平日煮 ${cookWeekdays.size} 天×200</span></div></div>`+
        `<div class="subcell"><div class="subnum">$${claimed.toLocaleString()}</div><div class="sublab">已申請現金</div></div>`+
        `<div class="subcell"><div class="subnum" style="color:${balColor}">$${balance.toLocaleString()}</div><div class="sublab">${balLabel}</div></div>`+
      `</div>`+
      subTable+
      `<details class="gdet" style="margin-top:10px"><summary class="ghd">🧾 申請紀錄（${setList.length}）</summary>${setRows}</details>`;
  }
  if(!val("gSetDate")) set("gSetDate",todayStr());
  // 明細（快取各類清單，供 setGDetailType 切換時重繪）
  const bList=buys.slice().sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  const mList=meals.slice().sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  const eList=extras.slice().sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  GDETAIL_ROWS={
    buy:{count:bList.length, html: bList.length?bList.map(b=>`<div class="grow"><span class="gd">${b.date}</span><span class="gn">${b.note||"（進貨）"}</span><span class="ga">$${(+b.amount||0).toLocaleString()}</span><span class="x" onclick="delGBuy('${b.id}')">✕</span></div>`).join(""):`<div class="hint">尚無進貨</div>`},
    meal:{count:mList.length, html: mList.length?mList.map(x=>`<div class="grow"><span class="gd">${x.date}</span><span class="gn">${x.note||"一餐"}　<span class="pill">${x.people||1}人</span></span><span class="x" onclick="delGMeal('${x.id}')">✕</span></div>`).join(""):`<div class="hint">尚無煮餐紀錄</div>`},
    extra:{count:eList.length, html: eList.length?eList.map(x=>`<div class="grow"><span class="gd">${x.date}</span><span class="gn">${x.note||"（額外伙食費）"}</span><span class="ga">$${(+x.amount||0).toLocaleString()}</span><span class="x" onclick="delGExtra('${x.id}')">✕</span></div>`).join(""):`<div class="hint">尚無額外伙食費</div>`},
  };
  renderGDetail();
}
let GDETAIL_ROWS={buy:{count:0,html:""},meal:{count:0,html:""},extra:{count:0,html:""}};
let gDetailType="buy";
function setGDetailType(t){ gDetailType=t; renderGDetail(); }
function renderGDetail(){
  const db=document.getElementById("gDetailBox"); if(!db) return;
  const labels={buy:"🛒 進貨",meal:"🍳 煮餐",extra:"🍽️ 外食"};
  const bar=Object.keys(labels).map(k=>`<button class="gtypebtn${k===gDetailType?" on":""}" onclick="setGDetailType('${k}')">${labels[k]}（${GDETAIL_ROWS[k].count}）</button>`).join("");
  db.innerHTML=`<div class="gtypebar">${bar}</div>${GDETAIL_ROWS[gDetailType].html}`;
}

/* ---------- 我的最愛 ---------- */
function saveFavs(){ api("/api/favorites",{method:"PUT",body:JSON.stringify(store.favorites||[])}).catch(()=>{}); }
function addFav(){
  const n=val("foodPick"), d=foodData(n);
  if(!d){ alert("先選一個食物再加入最愛"); return; }
  store.favorites=store.favorites||[];
  if(store.favorites.find(f=>f.n===n)){ alert("已經在最愛了"); return; }
  store.favorites.push({n,d}); saveFavs(); renderFavs();
}
function removeFav(i){ store.favorites.splice(i,1); saveFavs(); renderFavs(); }
function useFav(i){
  const f=store.favorites[i]; if(!f) return;
  FOODS_DYN[f.n]=f.d; addToCart(f.n,100);
}
function renderFavs(){
  const box=document.getElementById("favChips");
  const favs=store.favorites||[];
  if(!favs.length){ box.innerHTML='<span class="hint">⭐ 常吃的食物按「加入最愛」，下次一鍵帶入</span>'; return; }
  box.innerHTML=favs.map((f,i)=>`<span class="chip" onclick="useFav(${i})">${f.n} <b onclick="event.stopPropagation();removeFav(${i})" style="color:#b5564e">✕</b></span>`).join("");
}

/* ---------- 自訂食物 ---------- */
function toggleCustom(){
  const b=document.getElementById("customBox");
  b.style.display = b.style.display==="none"?"block":"none";
  if(b.style.display==="block"){ document.getElementById("cfName").value=val("foodPick"); document.getElementById("cfName").focus(); }
}
function cfUnitChange(){
  const serv=val("cfUnit")==="serv";
  document.getElementById("cfServWrap").style.display=serv?"block":"none";
  set("cfHint", serv?"照包裝「每份」欄抄，並填上每份重量；建立後份量會自動帶入一份。":"照包裝「每 100 公克」那一欄抄即可。");
}
function addCustom(){
  const n=val("cfName").trim();
  let k=parseFloat(val("cfK")), p=parseFloat(val("cfP")), f=parseFloat(val("cfF")), c=parseFloat(val("cfC"));
  if(!n){ alert("請輸入食物名稱"); return; }
  if(isNaN(k)){ alert("至少要有熱量"); return; }
  p=isNaN(p)?0:p; f=isNaN(f)?0:f; c=isNaN(c)?0:c;
  let defGram=100;
  if(val("cfUnit")==="serv"){
    const servG=parseFloat(val("cfServ"));
    if(!servG){ alert("請填每份重量(克)"); return; }
    const r=v=>Math.round(v*100/servG*10)/10;   // 換算成每100g
    k=r(k); p=r(p); f=r(f); c=r(c); defGram=servG;
  }
  registerFood(n,[k,p,f,c],defGram);
  saveBarcode(n,k,p,f,c);   // 若是掃碼後手填，存回共享條碼庫
  ["cfName","cfK","cfP","cfF","cfC","cfServ"].forEach(id=>document.getElementById(id).value="");
  document.getElementById("cfUnit").value="100"; cfUnitChange();
  document.getElementById("customBox").style.display="none";
}
// 建立一個食物：登記、存最愛、選用，並上傳到共享食物庫
function registerFood(n,d,defGram){
  FOODS_DYN[n]=d; SERVINGS[n]=defGram||100;
  store.favorites=store.favorites||[];
  if(!store.favorites.find(x=>x.n===n)){ store.favorites.push({n,d}); saveFavs(); renderFavs(); }
  addToCart(n,defGram||100);
  shareFood(n,d,defGram||100,"food");
}
// 上傳到共享食物庫（全體共用，每100g）；失敗不影響本地使用
async function shareFood(name,d,grams,kind){
  try{
    await api("/api/sharedfood",{method:"POST",body:JSON.stringify({name,kcal:d[0],protein:d[1],fat:d[2],carb:d[3],grams:grams||100,kind:kind||"food"})});
    // 即時更新本機共享庫清單，免得要重開才看得到（伺服器成功後才更新）
    store.sharedFoods=store.sharedFoods||[];
    const rec={name,kcal:+d[0]||0,protein:+d[1]||0,fat:+d[2]||0,carb:+d[3]||0,grams:grams||100,kind:kind||"food",created_by:(session&&session.userId)};
    const ex=store.sharedFoods.find(s=>s.name===name);
    if(ex) Object.assign(ex,rec); else store.sharedFoods.push(rec);
    SHARED_NAMES.add(name);
    if(typeof renderShared==="function") renderShared();
  }catch(e){}
}

/* ---------- 條碼掃描（ZXing + Open Food Facts） ---------- */
let zxingReader=null, zxingLoaded=false;
function loadZXing(){
  if(zxingLoaded) return Promise.resolve();
  return new Promise((res,rej)=>{
    const s=document.createElement("script");
    s.src="https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js";
    s.onload=()=>{ zxingLoaded=true; res(); }; s.onerror=()=>rej(new Error("掃碼元件載入失敗"));
    document.head.appendChild(s);
  });
}
async function startScan(){
  const ov=document.getElementById("scanOverlay");
  ov.style.display="flex";
  set("scanStatus","啟動相機中…");
  try{
    await loadZXing();
    zxingReader=new ZXing.BrowserMultiFormatReader();
    set("scanStatus","把條碼對準框內…");
    await zxingReader.decodeFromConstraints(
      {video:{facingMode:"environment"}},
      "scanVideo",
      (result,err)=>{ if(result){ const code=result.getText(); stopScan(); onBarcode(code); } }
    );
  }catch(e){
    set("scanStatus","無法開啟相機："+e.message);
  }
}
function stopScan(){
  try{ if(zxingReader) zxingReader.reset(); }catch(e){}
  document.getElementById("scanOverlay").style.display="none";
}
let pendingBarcode=null; // 尚未建檔的條碼：標籤辨識／手填成功後存回
async function onBarcode(code){
  document.getElementById("customBox").style.display="block";
  pendingBarcode=null;
  try{
    const r=await api("/api/barcode?code="+encodeURIComponent(code));
    if(r.found && r.k>0){
      registerFood(r.n,[r.k,r.p,r.f,r.c],100);
      alert("已帶入：「"+r.n+"」（每100g "+r.k+" kcal"+(r.src==="db"?"，來自共享條碼庫":"")+"），確認份量後加入餐別即可。");
    }else if(r.found){
      document.getElementById("cfName").value=r.n;
      pendingBarcode=code;
      alert("查到商品「"+r.n+"」但沒有營養數值，請照標籤手動填或拍標示，建立後會自動記住此條碼。");
    }else{
      document.getElementById("cfName").value="商品 "+code;
      document.getElementById("customBox").style.display="block";
      pendingBarcode=code;
      alert("資料庫查無此條碼（"+code+"）。可改按「📋 拍營養標示」用 AI 自動帶入，或手動填，建立後會記住此條碼，下次秒帶。");
    }
  }catch(e){ alert("查詢失敗："+e.message); }
}
// 把目前條碼（per-100g 營養）存回共享條碼庫
async function saveBarcode(name,k,p,f,c){
  if(!pendingBarcode) return;
  const code=pendingBarcode; pendingBarcode=null;
  try{
    await api("/api/barcode",{method:"POST",body:JSON.stringify({code,name,kcal:k,protein:p,fat:f,carb:c})});
  }catch(e){ pendingBarcode=code; /* 失敗保留，之後可再存 */ }
}

/* ---------- 餐別飲食 ---------- */
let mealPhoto=null; // 壓縮後的 data URL
function onPhotoPick(ev){
  const file=ev.target.files&&ev.target.files[0]; if(!file) return;
  const img=new Image();
  img.onload=()=>{
    const max=700, scale=Math.min(1,max/Math.max(img.width,img.height));
    const w=Math.round(img.width*scale), h=Math.round(img.height*scale);
    const cv=document.createElement("canvas"); cv.width=w; cv.height=h;
    cv.getContext("2d").drawImage(img,0,0,w,h);
    mealPhoto=cv.toDataURL("image/jpeg",0.6);
    document.getElementById("photoBox").innerHTML=
      `<div style="display:flex;align-items:center;gap:10px;border:1px solid var(--line);border-radius:12px;padding:10px;">`+
      `<img src="${mealPhoto}" style="width:84px;height:84px;object-fit:cover;border-radius:8px;border:1px solid var(--line);flex:0 0 auto;">`+
      `<div style="flex:1 1 auto;min-width:0;">`+
      `<button class="sm" style="width:auto;padding:7px 14px;margin:0;" onclick="analyzePhoto()">✨ AI 辨識熱量</button> `+
      `<span class="x" style="color:#b5564e;cursor:pointer;font-size:13px;margin-left:6px;" onclick="clearMealPhoto()">移除</span>`+
      `<label style="display:inline-flex;align-items:center;gap:4px;font-size:12px;color:var(--sub);margin-top:6px;cursor:pointer;"><input type="checkbox" id="aiWhole" style="margin:0;">整道菜一筆（不拆食材）</label>`+
      `<div id="aiHint" class="hint" style="margin-top:4px;">要熱量數字 → 按「✨ AI 辨識」；<b>只想留照片當日記</b> → 直接到下方選餐別「＋加入」即可。</div></div></div>`;
    URL.revokeObjectURL(img.src);
  };
  img.src=URL.createObjectURL(file);
  ev.target.value="";
}
function clearMealPhoto(){ mealPhoto=null; const b=document.getElementById("photoBox"); if(b) b.innerHTML=""; }
function compressImg(file){
  return new Promise((res)=>{
    const img=new Image();
    img.onload=()=>{
      const max=900, scale=Math.min(1,max/Math.max(img.width,img.height));
      const w=Math.round(img.width*scale), h=Math.round(img.height*scale);
      const cv=document.createElement("canvas"); cv.width=w; cv.height=h;
      cv.getContext("2d").drawImage(img,0,0,w,h);
      const url=cv.toDataURL("image/jpeg",0.7);
      URL.revokeObjectURL(img.src); res(url);
    };
    img.src=URL.createObjectURL(file);
  });
}
let lastLabelImg=null;
async function onLabelPick(ev){
  const files=ev.target.files?[...ev.target.files]:[]; ev.target.value=""; if(!files.length) return;
  if(files.length===1){ lastLabelImg=await compressImg(files[0]); await runLabel(); return; }
  // 多張 → 批次辨識
  const h=document.getElementById("labelHint");
  h.style.display="block"; h.textContent=`🔎 批次辨識 ${files.length} 張標示中…約 ${Math.ceil(files.length*1.5)+3} 秒`;
  try{
    const imgs=await Promise.all(files.slice(0,6).map(compressImg));
    const r=await api("/api/labels",{method:"POST",body:JSON.stringify({images:imgs})});
    const items=r.items||[]; let added=0;
    items.forEach((it,i)=>{
      if(!(it.kcal>0)) return;
      const name=(it.name&&it.name.trim())?it.name.trim():("商品"+(i+1)+" "+new Date().toLocaleTimeString().slice(0,5));
      const serv=it.serving>0?it.serving:100;
      registerFood(name,[it.kcal,it.protein,it.fat,it.carb],serv); added++;
    });
    h.innerHTML=`已建立 <b>${added}</b> 項食物（共讀 ${items.length} 張），都已加入下方清單與共享庫，可逐筆改克數，名稱不對按 <b>✏️</b> 改。`+
      (files.length>6?`（一次最多 6 張，多的略過）`:"");
  }catch(e){
    h.innerHTML=`批次辨識失敗：${e.message} <button class="ghost sm" onclick="document.getElementById('labelInput').click()">🔁 重選</button>`;
  }
}
async function runLabel(){
  if(!lastLabelImg) return;
  const h=document.getElementById("labelHint");
  h.style.display="block"; h.textContent="🔎 辨識營養標示中…約 3–8 秒";
  try{
    const r=await api("/api/label",{method:"POST",body:JSON.stringify({image:lastLabelImg})});
    // 直接建立食物並加入清單（預設帶「一份」的克數，沒讀到就 100g）；不必再碰 100g/份 切換
    const name=(r.name&&r.name.trim())?r.name.trim():("商品 "+new Date().toLocaleTimeString().slice(0,5));
    const serv=r.serving>0?r.serving:100;
    registerFood(name,[r.kcal,r.protein,r.fat,r.carb],serv);   // per100g，預設份量=一份
    saveBarcode(name,r.kcal,r.protein,r.fat,r.carb);           // 若是掃碼後拍標示，存回條碼庫
    h.innerHTML=`已加入「<b>${name}</b>」：每100g ${r.kcal}kcal／蛋${r.protein} 脂${r.fat} 碳${r.carb}。`+
      `下方清單已帶入 <b>${serv}g</b>${r.serving>0?"（=標示一份）":"（預設值，請改成你吃的克數）"}，可直接調整。名稱不對可按 <b>✏️</b> 改。`;
  }catch(e){
    h.innerHTML=`辨識失敗：${e.message} <button class="ghost sm" onclick="runLabel()">🔁 再試一次</button>（也可按✏️自訂食物手動填）`;
  }
}
async function analyzePhoto(){
  if(!mealPhoto){ alert("請先拍照或選圖"); return; }
  const h=document.getElementById("aiHint");
  // 取得修正提示（重新辨識時）
  const hintEl=document.getElementById("aiFixInput");
  const hint=hintEl?hintEl.value.trim():"";
  // 移除上一輪 AI 加入的項目（名稱以 ✨ 開頭），避免重複堆疊
  foodCart=foodCart.filter(it=>!String(it.n).startsWith("✨ ")); renderFood();
  if(h){ h.textContent="🔎 辨識中…約 3–8 秒"; }
  try{
    const whole=!!(document.getElementById("aiWhole")&&document.getElementById("aiWhole").checked);
    const r=await api("/api/analyze",{method:"POST",body:JSON.stringify({image:mealPhoto,hint,whole})});
    const items=r.items||[]; let tot=0;
    aiBaseG={};   // 記下 AI 原始克數，供「整體份數」縮放用
    items.forEach(it=>{
      const g=it.grams||100, sc=100/g;
      const name="✨ "+it.name;
      FOODS_DYN[name]=[Math.round(it.kcal*sc),+(it.protein*sc).toFixed(1),+(it.fat*sc).toFixed(1),+(it.carb*sc).toFixed(1)];
      addToCart(name,g); aiBaseG[name]=g; tot+=it.kcal||0;
    });
    const mealNote=applyMealGuess(r.meal);
    if(h){
      h.innerHTML=`已列出 <b>${items.length}</b> 道、共約 <b>${Math.round(tot)} kcal</b>。${mealNote}`
        +`<div style="margin-top:8px;font-size:13px;">我吃的量（一次調整全部）：`
        +[["½",0.5],["原始",1],["1.5×",1.5],["×2",2]].map(([lbl,f])=>`<button class="ghost sm" style="padding:5px 9px;" onclick="scaleAiPortions(${f})">${lbl}</button>`).join(" ")+`</div>`
        +`<div style="margin-top:6px;font-size:13px;">合菜分食（整盤是幾人份 → 算我 1 份）：`
        +[["2人份",1/2],["3人份",1/3],["4人份",1/4],["5人份",1/5]].map(([lbl,f])=>`<button class="ghost sm" style="padding:5px 9px;" onclick="scaleAiPortions(${f})">${lbl}</button>`).join(" ")+`</div>`
        +`<div class="hint" style="margin-top:4px;">或在下方清單逐筆改克數。確認後選餐別「＋加入」。</div>`
        +`<div style="margin-top:8px;display:flex;gap:6px;align-items:center;flex-wrap:wrap">`
        +`<input id="aiFixInput" placeholder="辨識不對？例：這是滷肉飯不是燴飯／雞肉約300g" style="flex:1 1 200px;padding:6px 8px;font-size:13px">`
        +`<button class="ghost sm" onclick="analyzePhoto()">🔁 依提示重新辨識</button>`
        +`<button class="ghost sm" onclick="saveAiFoods()">💾 存成自訂食物</button></div>`;
    }
  }catch(e){
    if(h){ h.innerHTML=`辨識失敗：${e.message} <button class="ghost sm" onclick="analyzePhoto()">🔁 再試一次</button>`; }
  }
}
// 用一句話估熱量（Gemini 文字），結果加入購物車
// 從搜尋框直接用 AI 估（合併「搜尋」與「一句話估」成同一個框）
function estimateFromPick(){ const t=val("foodPick").trim(); if(t){ document.getElementById("foodSuggest").style.display="none"; aiEstimate(t); } }
function estimateText(){ const el=document.getElementById("estText"); aiEstimate(el?el.value.trim():""); }
async function aiEstimate(text){
  const h=document.getElementById("estHint");
  if(!text){ h.textContent="請先輸入一句描述"; return; }
  foodCart=foodCart.filter(it=>!String(it.n).startsWith("✨ ")); renderFood();
  h.textContent="🔎 AI 估算中…約 3–8 秒";
  try{
    const r=await api("/api/estimate",{method:"POST",body:JSON.stringify({text})});
    const items=r.items||[]; let tot=0;
    items.forEach(it=>{
      const g=it.grams||100, sc=100/g;
      const name="✨ "+it.name;
      FOODS_DYN[name]=[Math.round(it.kcal*sc),+(it.protein*sc).toFixed(1),+(it.fat*sc).toFixed(1),+(it.carb*sc).toFixed(1)];
      addToCart(name,g); tot+=it.kcal||0;
    });
    const mealNote=applyMealGuess(r.meal);
    h.innerHTML=`已估 <b>${items.length}</b> 項、共約 <b>${Math.round(tot)} kcal</b>，已加入下方清單。可改克數後選餐別「＋加入」。${mealNote} <button class="ghost sm" onclick="saveAiFoods()">💾 存成自訂</button>`;
  }catch(e){
    h.innerHTML=`估算失敗：${e.message} <button class="ghost sm" onclick='aiEstimate(${JSON.stringify(text)})'>🔁 再試</button>`;
  }
}
// 把目前 AI 辨識（✨）的項目存成自訂食物（去掉 ✨、進最愛＋共享庫，之後可直接搜尋）
function saveAiFoods(){
  const ai=foodCart.filter(it=>String(it.n).startsWith("✨ "));
  if(!ai.length){ alert("沒有 AI 辨識的項目可存"); return; }
  let saved=0;
  ai.forEach(it=>{
    const clean=it.n.replace(/^✨\s*/,"").trim(); if(!clean) return;
    FOODS_DYN[clean]=it.base.slice(); SERVINGS[clean]=it.g||100;
    store.favorites=store.favorites||[];
    if(!store.favorites.find(x=>x.n===clean)){ store.favorites.push({n:clean,d:it.base.slice()}); }
    shareFood(clean,it.base,it.g||100,"food"); saved++;
  });
  saveFavs(); renderFavs();
  alert(`已存 ${saved} 項自訂食物（已加入我的最愛與共享庫，之後可直接搜尋）`);
}
// AI 猜的餐別 → 自動選好「加到哪一餐」下拉，回一段提示字
function applyMealGuess(meal){
  const m=String(meal||"").trim();
  if(!["早餐","午餐","晚餐","點心"].includes(m)) return "";
  const sel=document.getElementById("mealType"); if(sel) sel.value=m;
  return `已自動選為<b>「${m}」</b>（可改）。`;
}

/* ---------- AI 教練（每日建議／剩餘額度推薦／週報點評） ---------- */
// 取常吃食物名稱（給「還能吃什麼」當口味參考）
function topFoods(n){
  const ranked=Object.entries(FOOD_STATS||{}).sort((a,b)=>(b[1].c||0)-(a[1].c||0)).map(e=>e[0]);
  const favs=(store.favorites||[]).map(f=>f.n);
  return [...new Set([...ranked,...favs])].slice(0,n||10);
}
async function coachDaily(){
  const box=document.getElementById("coachBox");
  const t=goalTargets(); if(!t){ box.innerHTML="先在①②填基本資料與目標，才能給建議。"; return; }
  const d=dayNutrition(selDate()), burn=burnByDate(selDate());
  box.textContent="🤖 AI 教練思考中…約 3–6 秒";
  try{
    const r=await api("/api/coach",{method:"POST",body:JSON.stringify({mode:"daily",
      today:{kcal:d.k,protein:d.p,fat:d.f,carb:d.c},
      target:{kcal:t.kcal,protein:t.protein,fat:t.fat,carb:t.carb},
      burn, goal:val("goal"), plan:planContext()})});
    box.innerHTML=coachHtml(r);
  }catch(e){ box.innerHTML=`建議失敗：${e.message} <button class="ghost sm" onclick="coachDaily()">🔁 再試</button>`; }
}
async function coachRemain(){
  const box=document.getElementById("coachBox");
  const t=goalTargets(); if(!t){ box.innerHTML="先在①②填基本資料與目標，才能推薦。"; return; }
  const d=dayNutrition(selDate()), burn=burnByDate(selDate());
  const remain={kcal:Math.round(t.kcal+burn-d.k), protein:Math.round(t.protein-d.p), fat:Math.round(t.fat-d.f), carb:Math.round(t.carb-d.c)};
  box.textContent="🍱 AI 依你剩餘額度找選擇中…約 3–6 秒";
  try{
    const r=await api("/api/coach",{method:"POST",body:JSON.stringify({mode:"remain",remain,goal:val("goal"),prefs:topFoods(10)})});
    const items=r.items||[];
    if(!items.length){ box.innerHTML="AI 沒有給出建議，稍後再試。"; return; }
    window.__remain=items;
    box.innerHTML=`<div style="margin-bottom:6px;">今天還剩 <b>${remain.kcal.toLocaleString()} kcal</b>`+
      `（蛋白還缺 ${Math.max(0,remain.protein)}g）。AI 推薦：</div>`+
      items.map((it,i)=>`<div class="foodrow"><span class="nm">${it.name}<br><span style="color:var(--sub);font-size:11px">${it.kcal}kcal · P${it.protein} F${it.fat} C${it.carb}${it.reason?" · "+it.reason:""}</span></span>`+
        `<span class="x" style="color:var(--accent)" onclick="addRemainItem(${i})">＋加入</span></div>`).join("");
  }catch(e){ box.innerHTML=`推薦失敗：${e.message} <button class="ghost sm" onclick="coachRemain()">🔁 再試</button>`; }
}
// 把 AI 推薦的一項加入下方食物清單（以一份=其重量近似 100g 帶入）
function addRemainItem(i){
  const it=(window.__remain||[])[i]; if(!it) return;
  const name="✨ "+it.name;
  FOODS_DYN[name]=[it.kcal,it.protein,it.fat,it.carb]; SERVINGS[name]=100;
  addToCart(name,100);
  document.getElementById("foodTotal").scrollIntoView({behavior:"smooth"});
}
async function coachReport(){
  const box=document.getElementById("coachReportBox");
  const t=goalTargets();
  const since=isoLocal(new Date(new Date(todayStr())-(reportDays-1)*86400000));
  const recs=(store.records||[]).filter(r=>r.date.slice(0,10)>=since);
  const exs=(store.exercises||[]).filter(e=>e.date.slice(0,10)>=since);
  const intakeDays=recs.filter(r=>r.kcal!=null);
  if(!intakeDays.length){ box.innerHTML="這段期間還沒有飲食紀錄，先記幾天再來點評。"; return; }
  const avgI=Math.round(avg(intakeDays.map(r=>+r.kcal||0)));
  const avgP=Math.round(avg(intakeDays.map(r=>+r.protein||0)));
  const avgF=Math.round(avg(intakeDays.map(r=>+r.fat||0)));
  const avgC=Math.round(avg(intakeDays.map(r=>+r.carb||0)));
  const avgBurn=Math.round(exs.reduce((a,b)=>a+(+b.kcal||0),0)/reportDays);
  const wRecs=recs.filter(r=>r.weight!=null);
  const wDelta=wRecs.length>=2?+(+wRecs[wRecs.length-1].weight-+wRecs[0].weight).toFixed(1):null;
  box.textContent="🤖 教練點評產生中…約 3–6 秒";
  try{
    const r=await api("/api/coach",{method:"POST",body:JSON.stringify({mode:"report",days:reportDays,
      avg:{kcal:avgI,protein:avgP,fat:avgF,carb:avgC},
      target:t?{kcal:t.kcal,protein:t.protein,fat:t.fat,carb:t.carb}:null,
      avgBurn, avgNet:avgI-avgBurn, weightDelta:wDelta, goal:val("goal"), plan:planContext()})});
    box.innerHTML=coachHtml(r);
  }catch(e){ box.innerHTML=`點評失敗：${e.message} <button class="ghost sm" onclick="coachReport()">🔁 再試</button>`; }
}
async function coachShopping(){
  const box=document.getElementById("coachReportBox");
  const t=goalTargets(); if(!t){ box.innerHTML="先在①②填基本資料與目標，才能產生採購清單。"; return; }
  const since=isoLocal(new Date(new Date(todayStr())-6*86400000));
  const intakeDays=(store.records||[]).filter(r=>r.date.slice(0,10)>=since&&r.kcal!=null);
  const avgI=intakeDays.length?Math.round(avg(intakeDays.map(r=>+r.kcal||0))):0;
  const avgP=intakeDays.length?Math.round(avg(intakeDays.map(r=>+r.protein||0))):0;
  const avgF=intakeDays.length?Math.round(avg(intakeDays.map(r=>+r.fat||0))):0;
  const avgC=intakeDays.length?Math.round(avg(intakeDays.map(r=>+r.carb||0))):0;
  box.textContent="🛒 AI 產生一週採購清單中…約 3–6 秒";
  try{
    const r=await api("/api/coach",{method:"POST",body:JSON.stringify({mode:"shopping",
      target:{kcal:t.kcal,protein:t.protein,fat:t.fat,carb:t.carb},
      avg:{kcal:avgI,protein:avgP,fat:avgF,carb:avgC},
      prefs:topFoods(12), goal:val("goal"), plan:planContext()})});
    const groups=r.groups||[];
    if(!groups.length){ box.innerHTML="AI 沒有給出清單，稍後再試。"; return; }
    box.innerHTML=`<div style="font-weight:600;margin-bottom:6px;">🛒 一週採購清單（依你的目標與常吃口味）</div>`+
      groups.map(g=>`<div style="margin:6px 0;"><div style="font-weight:600;font-size:13px;color:var(--accent);">${escapeHtml(g.cat)}</div>`+
        g.items.map(it=>`<div style="font-size:13px;line-height:1.6;">☐ ${escapeHtml(it.name)}${it.qty?` <span style="color:var(--sub)">${escapeHtml(it.qty)}</span>`:""}${it.reason?` <span style="color:var(--sub);font-size:11px">· ${escapeHtml(it.reason)}</span>`:""}</div>`).join("")+
      `</div>`).join("")+`<div class="hint tip" style="margin-top:6px;">清單僅供參考，依個人口味與預算自行調整。</div>`;
  }catch(e){ box.innerHTML=`產生失敗：${e.message} <button class="ghost sm" onclick="coachShopping()">🔁 再試</button>`; }
}
// 把 {summary, actions[]} 轉成顯示用 HTML
function coachHtml(r){
  let html=`<div style="color:var(--ink);">${(r.summary||"").replace(/\n/g,"<br>")}</div>`;
  if(r.actions&&r.actions.length){
    html+=`<ul style="margin:6px 0 0;padding-left:18px;">`+r.actions.map(a=>`<li>${a}</li>`).join("")+`</ul>`;
  }
  return html;
}

/* ---------- 每週覆盤（每週一自動產生上週點評，存後端可回看） ---------- */
function mondayOf(dateStr){ const d=new Date(dateStr+"T00:00:00"); const dow=(d.getDay()+6)%7; d.setDate(d.getDate()-dow); return isoLocal(d); }
function prevWeekStart(){ const m=new Date(mondayOf(todayStr())+"T00:00:00"); m.setDate(m.getDate()-7); return isoLocal(m); }
function addDaysIso(iso,n){ const d=new Date(iso+"T00:00:00"); d.setDate(d.getDate()+n); return isoLocal(d); }
// 算某一週(7天)的覆盤資料包
function weekStats(since,until){
  const recs=(store.records||[]).filter(r=>{const d=r.date.slice(0,10);return d>=since&&d<=until;});
  const exs=(store.exercises||[]).filter(e=>{const d=e.date.slice(0,10);return d>=since&&d<=until;});
  const intakeDays=recs.filter(r=>r.kcal!=null);
  const wRecs=recs.filter(r=>r.weight!=null);
  return {
    intakeDays, exs, hasData:intakeDays.length>0,
    avgI:intakeDays.length?Math.round(avg(intakeDays.map(r=>+r.kcal||0))):0,
    avgP:intakeDays.length?Math.round(avg(intakeDays.map(r=>+r.protein||0))):0,
    avgF:intakeDays.length?Math.round(avg(intakeDays.map(r=>+r.fat||0))):0,
    avgC:intakeDays.length?Math.round(avg(intakeDays.map(r=>+r.carb||0))):0,
    avgBurn:Math.round(exs.reduce((a,b)=>a+(+b.kcal||0),0)/7),
    wDelta:wRecs.length>=2?+(+wRecs[wRecs.length-1].weight-+wRecs[0].weight).toFixed(1):null,
  };
}
// 產生並儲存某週覆盤；manual=true 會顯示載入訊息與錯誤
async function genWeeklyReview(weekStart,manual){
  const until=addDaysIso(weekStart,6);
  const s=weekStats(weekStart,until);
  const listBox=document.getElementById("reviewList");
  if(!s.hasData){ if(manual&&listBox) alert("那一週沒有飲食紀錄，沒東西可覆盤。"); return false; }
  if(manual&&listBox) listBox.innerHTML=`<div class="hint">🤖 產生 ${weekStart} 那週的覆盤中…約 3–6 秒</div>`+listBox.innerHTML;
  const t=goalTargets();
  try{
    const r=await api("/api/coach",{method:"POST",bg:!manual,body:JSON.stringify({mode:"report",days:7,
      avg:{kcal:s.avgI,protein:s.avgP,fat:s.avgF,carb:s.avgC},
      target:t?{kcal:t.kcal,protein:t.protein,fat:t.fat,carb:t.carb}:null,
      avgBurn:s.avgBurn, avgNet:s.avgI-s.avgBurn, weightDelta:s.wDelta, goal:val("goal"), plan:planContext()})});
    await api("/api/review",{method:"POST",body:JSON.stringify({week_start:weekStart, summary:r.summary||"", actions:r.actions||[]})});
    // 本地更新（避免整頁 reload）
    store.reviews=(store.reviews||[]).filter(x=>x.week_start.slice(0,10)!==weekStart);
    store.reviews.unshift({week_start:weekStart, summary:r.summary||"", actions:r.actions||[]});
    store.reviews.sort((a,b)=>b.week_start.slice(0,10)<a.week_start.slice(0,10)?-1:1);
    renderReviews();
    return true;
  }catch(e){
    if(manual&&listBox) listBox.innerHTML=`<div class="hint" style="color:#b5564e">覆盤失敗：${e.message} <button class="ghost sm" onclick="genWeeklyReview('${weekStart}',true)">🔁 再試</button></div>`+ (listBox.innerHTML.replace(/^<div class="hint">🤖[\s\S]*?<\/div>/,""));
    return false;
  }
}
// 開 App 時：若上一個完整週(週一~週日)還沒覆盤、且那週有資料，自動補產生
async function maybeWeeklyReview(){
  const ws=prevWeekStart();
  if((store.reviews||[]).some(r=>r.week_start.slice(0,10)===ws)) return;
  if(aiInFlight) return;   // 使用者正在用 AI，這次先讓賢，下次開 App 再補
  await genWeeklyReview(ws,false);
}
/* ---------- 經期記錄（僅女性顯示；只記「開始日」，自動算週期天數與相位） ---------- */
// 女性專屬邏輯（EA 警示、極化訓練、週期建議、營養窗口）共用的判斷。
// 以「表單值」為準而非 store.profile：saveProfile() 只把改動送到伺服器、不會更新本地
// store.profile，若以 profile 為準，使用者改了性別要等重新載入才生效。表單值也和
// calcMifflin() 算 BMR 用的來源一致。表單尚未由 applyProfile 填入時才退回 profile。
function isFemale(){ return (val("sex")||(store.profile&&store.profile.sex))==="f"; }
function periodDates(){ const p=store.profile&&store.profile.periods; return Array.isArray(p)?p.slice().sort():[]; }
// 個人平均週期長度：黃體期長度相對固定（約 14 天），變動的是濾泡期，所以排卵日要用
// 「週期長度 − 14」推算，而不是寫死第 14 天。28 天的人排卵在第 14 天，27 天的人在第 13 天。
const DEFAULT_CYCLE=28, LUTEAL_LEN=14;
function cycleLength(){
  const ds=periodDates();
  if(ds.length<2) return {len:DEFAULT_CYCLE, est:true, n:ds.length};
  const gaps=[];
  for(let i=1;i<ds.length;i++){
    const g=Math.round((new Date(ds[i])-new Date(ds[i-1]))/86400000);
    if(g>=21&&g<=45) gaps.push(g);   // 濾掉補記錯誤造成的離譜間隔
  }
  if(!gaps.length) return {len:DEFAULT_CYCLE, est:true, n:ds.length};
  const len=Math.round(gaps.reduce((a,b)=>a+b,0)/gaps.length);
  return {len, est:false, n:gaps.length+1};
}
// 依「最近一次經期開始日」算目前是第幾天、處於哪個相位
function cyclePhase(){
  const ds=periodDates(); if(!ds.length) return null;
  const last=ds[ds.length-1];
  const day=Math.floor((new Date(todayStr())-new Date(last))/86400000)+1;  // 開始日當第 1 天
  if(day<1) return null;
  const CL=cycleLength(), len=CL.len, ovu=Math.max(10, len-LUTEAL_LEN);
  // 概略相位：1-5 月經期、6-13 濾泡期、14-15 排卵、16-28 黃體期(易水腫)、>28 可能下次將至
  // training=該相位的訓練安排建議；caution=該相位特有的風險提醒（沒有就 null）
  // 女性的身體是「週期系統」而非穩定系統，能量、恢復能力與受傷風險都隨相位變動，
  // 所以訓練要明確但不能僵化——把加量放在濾泡期，把恢復放在月經期，才不會每個月都硬撞。
  let phase, note, training, caution=null, highWater=false;
  if(day<=5){
    phase="月經期"; highWater=true;
    note="這幾天體重可能偏高（水分），屬正常，別過度節食。";
    training="雌激素低、容易疲勞不適：以恢復為主——瑜珈、散步、簡單伸展或滾筒放鬆就好。";
    caution="如果疼痛劇烈，直接休息，不要勉強自己。";
  }else if(day<ovu){
    phase="濾泡期";
    note="水分通常較穩定，是看減重趨勢的好時機。";
    training="雌激素上升，體力、耐力與情緒都在變好：<b>這是加量、加強度的最佳時機</b>，重訓與高強度間歇都排在這幾天。";
  }else if(day<=ovu+1){
    phase="排卵期";
    note="體重可能小幅波動，正常。";
    training="個體差異最大：狀態好就比照濾泡期上強度，不舒服就轉中等強度重訓或有氧。關鍵是傾聽並尊重身體的反應。";
    caution="雌激素達到高峰會讓韌帶暫時鬆弛，運動損傷風險升高：<b>避免挑戰個人最佳成績與高衝擊跳躍動作</b>，暖身與動作控制不能馬虎。";
  }else if(day<=len+3){
    phase="黃體期"; highWater=true;
    note="⚠️ 易水分滯留、體重偏高 0.5–2kg，是水不是脂肪，別慌。";
    training="體能會波動、體溫升高、耐熱下降。採用<b>「10 分鐘原則」</b>：狀態不好時先輕度暖身 10 分鐘，若沒改善就改做中低強度課表、滾筒放鬆或散步，不要硬上強度。";
    caution="經期前幾天若感覺非常疲勞，可以主動安排<b>減量週</b>，大幅降低訓練量與強度，專心把睡眠和恢復顧好。";
  }else{
    // 超過個人週期長度＋3 天，最常見的原因是「已經來了但忘了記」，而不是週期真的變長。
    // 講成「週期偏長」會讓規律的人被誤判，也讓後面的相位建議全部錯位。
    phase="待補記";
    note=`距離上次已 ${day} 天${CL.est?"":`，你的平均週期是 ${len} 天`}。多半是經期已經來了但忘了記。`;
    training="補記上一次的經期開始日，相位與訓練建議才會回到正軌；在那之前先照身體感受安排。";
    caution=null;
  }
  // highWater=易水分滯留期（黃體/月經）→ 解讀體重/身體組成時要把水分變因考慮進去
  return {day, phase, note, training, caution, last, highWater, cycleLen:len, cycleEst:CL.est};
}
function renderPeriod(){
  const card=document.getElementById("cardPeriod"); if(!card) return;
  const isF=isFemale();
  card.style.display=isF?"":"none";
  if(!isF) return;
  // 經期卡有自己的日期欄（可自由往前補記，不再借用體重日期）
  const dInp=document.getElementById("periodDate");
  if(dInp){ if(!dInp.value) dInp.value=todayStr(); dInp.max=todayStr(); }
  const ds=periodDates(), cur=(dInp&&dInp.value)||todayStr(), on=ds.includes(cur);
  const btn=document.getElementById("periodBtn");
  if(btn) btn.textContent=on?"🩸 取消這天":"🩸 記錄這天";
  const ph=cyclePhase(), pill=document.getElementById("periodPill");
  if(pill) pill.textContent=ph?("第 "+ph.day+" 天·"+ph.phase):"";
  // 相位配色：月經#紅 / 濾泡#綠 / 排卵#accent / 黃體#warm / 偏長#sub
  const phaseCol={"月經期":"#b5564e","濾泡期":"var(--green)","排卵期":"var(--accent)","黃體期":"var(--warm)","待補記":"var(--sub)"}[ph&&ph.phase]||"var(--sub)";
  const st=document.getElementById("periodStatus");
  if(st){
    st.innerHTML = ph
      ? `<div style="background:var(--soft);border-radius:12px;padding:10px 14px;border-left:4px solid ${phaseCol};">`+
          `<div style="display:flex;align-items:baseline;gap:8px;">`+
            `<span style="font-size:22px;font-weight:800;color:${phaseCol};line-height:1;">第 ${ph.day} 天</span>`+
            `<span style="font-size:14px;font-weight:700;color:${phaseCol};">${ph.phase}</span>`+
          `</div>`+
          `<div style="font-size:12px;color:var(--ink);line-height:1.5;margin-top:5px;">${ph.note}</div>`+
          (ph.training?`<div style="font-size:12px;color:var(--ink);line-height:1.5;margin-top:6px;padding-top:6px;border-top:1px solid var(--line);"><b>🏋️ 這幾天怎麼練：</b>${ph.training}</div>`:"")+
          (ph.caution?`<div style="font-size:12px;color:var(--warm);line-height:1.5;margin-top:5px;">⚠️ ${ph.caution}</div>`:"")+
          `<div style="font-size:11px;color:var(--sub);margin-top:6px;">起算日：${ph.last}</div>`+
        `</div>`
      : `<div style="background:var(--soft);border-radius:12px;padding:12px 14px;color:var(--sub);font-size:13px;line-height:1.6;">還沒記錄經期。選好「經期第一天」按記錄即可；過去的月份把日期往前選就能補。</div>`;
  }
  const list=document.getElementById("periodList");
  if(list){
    if(ds.length){
      list.innerHTML = `<div style="font-size:12px;color:var(--sub);margin-bottom:6px;">已記錄 ${ds.length} 次（點一下帶入日期，再按「取消這天」可刪）</div>`+
        `<div style="display:flex;flex-wrap:wrap;gap:6px;">`+
        ds.slice().reverse().map(d=>{
          const sel=d===cur;
          return `<span onclick="pickPeriodDate('${d}')" title="點擊帶入日期" style="cursor:pointer;font-size:12px;padding:4px 10px;border-radius:999px;border:1px solid ${sel?'var(--accent)':'var(--line)'};background:${sel?'var(--soft)':'#fff'};color:${sel?'var(--accent)':'var(--ink)'};font-weight:${sel?'700':'400'};">🩸 ${d.slice(5).replace('-','/')}</span>`;
        }).join("")+`</div>`;
    }else list.innerHTML="";
  }
}
// 點已記錄的日期：帶入經期卡的日期欄並重繪（不直接刪，避免誤刪）；要取消請按「取消這天」
function pickPeriodDate(d){
  const inp=document.getElementById("periodDate"); if(inp){ inp.value=d; }
  renderPeriod();
}
async function togglePeriod(){ const dInp=document.getElementById("periodDate"); await togglePeriodDate((dInp&&dInp.value)||todayStr()); }
async function togglePeriodDate(date){
  // 取消（刪除）既有日期時跳確認，避免誤刪
  if(periodDates().includes(date) && !confirm(`取消「${date}」的經期開始記錄？`)) return;
  try{
    const r=await api("/api/period/toggle",{method:"POST",body:JSON.stringify({date})});
    store.profile=store.profile||{}; store.profile.periods=r.periods;
    try{ localStorage.setItem(storeCacheKey(), JSON.stringify({...store, sharedFoods:undefined})); }catch(e){}
    renderPeriod(); renderDashboard();
  }catch(e){ alert("經期記錄失敗："+e.message); }
}
function renderReviews(){
  const box=document.getElementById("reviewList"); if(!box) return;
  const list=store.reviews||[];
  const pill=document.getElementById("reviewCount"); if(pill) pill.textContent=list.length?list.length+" 篇":"";
  if(!list.length){ box.innerHTML='<div class="empty">還沒有覆盤。每週一開 App 會自動產生上週點評，或按上方按鈕手動產生。</div>'; return; }
  // 依週次新到舊排序，最新一週預設展開、其餘收合
  const sorted=list.slice().sort((a,b)=>b.week_start.localeCompare(a.week_start));
  box.innerHTML=sorted.map((r,i)=>{
    const ws=r.week_start.slice(0,10), we=addDaysIso(ws,6);
    const acts=(r.actions||[]).length?`<ul style="margin:6px 0 0;padding-left:18px;font-size:13px;line-height:1.7;">`+r.actions.map(a=>`<li>${a}</li>`).join("")+`</ul>`:"";
    return `<details ${i===0?"open":""} style="border:1px solid var(--line);border-radius:10px;padding:0 12px;margin-bottom:8px;">`+
      `<summary style="cursor:pointer;padding:10px 0;font-weight:600;font-size:13px;color:var(--accent);">${ws.slice(5)} ~ ${we.slice(5)} 那週</summary>`+
      `<div style="padding-bottom:10px;">`+
      `<div class="hint" style="color:var(--ink);line-height:1.6;">${(r.summary||"").replace(/\n/g,"<br>")}</div>${acts}</div></details>`;
  }).join("");
}

/* ---------- 群組競賽 ---------- */
let myGroups=[];
const METRIC_LABEL={all:"全能賽",discipline:"自律分",streak:"連續打卡",weightpct:"體重變化%",bodyfat:"體脂變化%",exercise:"運動次數",volume:"訓練量",kcaldays:"熱量達標天數",protein:"蛋白達成率",water:"喝水達成率",poop:"嗯嗯次數",team:"團隊挑戰"};
const PERIOD_LABEL={day:"每日",week:"每週",month:"每月"};
// 計算自己近 35 天的隱私安全統計並上傳（flag 由本機算，體重只供算個人%）
async function syncDailyStats(){
  const t=goalTargets();
  const rows=[];
  // 涵蓋所有有資料的日期（與積分計算同範圍，讓排行榜分數一致），上限 366 天
  const dates=new Set();
  (store.records||[]).forEach(r=>dates.add(r.date.slice(0,10)));
  Object.keys(store.mealAgg||{}).forEach(d=>dates.add(d));
  (store.exercises||[]).forEach(e=>dates.add(e.date.slice(0,10)));
  const sorted=[...dates].sort().slice(-366);
  for(const ds of sorted){
    const nut=dayNutrition(ds);
    const exsDay=(store.exercises||[]).filter(e=>e.date.slice(0,10)===ds);
    const rec=(store.records||[]).find(r=>r.date.slice(0,10)===ds);
    const logged=nut.k>0;
    const exercised=exsDay.length>0;
    const water=rec&&rec.water_ml?+rec.water_ml:0;
    const waterGoal=waterGoalFor(ds);   // 依當天體重動態計算
    rows.push({ date:ds, logged,
      kcal_hit: !!(t && logged && nut.k<=t.kcal),
      protein_hit: !!(t && logged && nut.p>=t.protein),
      exercised, water_hit: water>=waterGoal,
      // 運動次數：同一天「有氧」算1次、「重訓」算1次（各類別當天有做就+1），不再每個動作各記一次
      ex_count: (exsDay.some(e=>e.kind!=="strength")?1:0) + (exsDay.some(e=>e.kind==="strength")?1:0),
      volume: exsDay.filter(e=>e.kind==="strength").reduce((a,b)=>a+(+b.volume||0),0),
      weight: rec&&rec.weight!=null?+rec.weight:null,
      water_pct: (rec&&rec.water_ml!=null)?Math.round(water/waterGoal*100):null,  // 喝水達成率(已喝/該喝)
      protein_pct: (t&&logged&&t.protein>0)?Math.round(nut.p/t.protein*100):null,  // 蛋白達成率(已吃/目標)
      poop: (rec&&rec.poop!=null)?+rec.poop:null,  // 嗯嗯次數
      body_fat: (rec&&rec.body_fat!=null)?+rec.body_fat:null });  // 體脂%
  }
  if(!rows.length) return;
  // 只上傳「有變動」的日期：跟上次同步的快照比對，沒變的不送（大幅減少傳輸量）
  const ck="dstatsSig:"+(session&&session.userId||"");
  let prev={}; try{ prev=JSON.parse(localStorage.getItem(ck)||"{}"); }catch(e){}
  const changed=[], sig={};
  for(const r of rows){ const s=JSON.stringify(r); sig[r.date]=s; if(prev[r.date]!==s) changed.push(r); }
  if(!changed.length) return;
  try{
    await api("/api/dailystats",{method:"POST",body:JSON.stringify({rows:changed})});
    localStorage.setItem(ck, JSON.stringify(sig));   // 成功才更新快照
  }catch(e){}
}
async function loadGroups(){
  try{ const r=await api("/api/groups"); myGroups=r.groups||[]; }catch(e){ myGroups=[]; }
  renderGroups(); renderPoints(); checkCelebrations(); renderDashboard();
}
// 記住各競賽展開/收合狀態（重新整理排行榜時保留）
const grpClosed=new Set();
function onGroupToggle(d){ const id=+d.dataset.gid; if(d.open) grpClosed.delete(id); else grpClosed.add(id); }
function escapeHtml(s){ return String(s||"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])); }
async function sendGroupMsg(gid){
  const el=document.getElementById("gmsg-"+gid); const body=(el&&el.value||"").trim(); if(!body) return;
  try{ await api("/api/group/"+gid+"/message",{method:"POST",body:JSON.stringify({body})}); if(el) el.value=""; grpClosed.delete(gid); await loadGroups(); }
  catch(e){ alert(e.message); }
}
function daysBetween(a,b){ return Math.round((new Date(b+"T00:00:00")-new Date(a+"T00:00:00"))/86400000); }
function renderGroups(){
  const box=document.getElementById("groupList"); if(!box) return;
  const pill=document.getElementById("groupCount"); if(pill) pill.textContent=myGroups.length?myGroups.length+" 組":"";
  if(!myGroups.length){ box.innerHTML='<div class="empty">還沒加入競賽。建立一個或用邀請碼加入，揪朋友一起比！</div>'; return; }
  // 名次徽章：用後端算好的 rank（同分同名次）；null=沒資料顯示「–」
  const medal=(r)=>r==null?"–":(["🥇","🥈","🥉"][r-1]||r+".");
  const today=todayStr();
  box.innerHTML=myGroups.map(g=>{
    const isTeam=g.metric==="team", asc=g.metric==="weightpct"||g.metric==="bodyfat";
    // 賽馬跑道：依分數相對名次定位（領先=最右）
    const scores=g.members.filter(m=>!m.noData).map(m=>m.score);
    const best=scores.length?(asc?Math.min(...scores):Math.max(...scores)):0;
    const worst=scores.length?(asc?Math.max(...scores):Math.min(...scores)):0;
    const range=Math.abs(best-worst)||1;
    // 賽馬跑道：每人一條，上排顯示名次/名字(特效)/分數，下排是自己的角色往🏁前進
    const race=g.members.map((m,i)=>{
      const p=m.noData?0:Math.round(Math.abs(m.score-worst)/range*86);   // 0~86%（沒資料者停在起點）
      const racer=m.racer||"🏁";
      // 角色：頭像圖（avatar）／賽道小圖（racerart:<key>）／表情符號
      const runnerInner=(racer==="avatar"&&m.avatar)
        ?`<img src="${m.avatar}" style="width:18px;height:18px;border-radius:50%;object-fit:cover;display:block;">`
        :(typeof racer==="string"&&racer.indexOf("racerart:")===0)
          ?`<img src="racers/${racer.slice(9)}_sm.png?v=${ASSETV}" onerror="this.onerror=null;this.src='racers/${racer.slice(9)}.png?v=${ASSETV}'" style="width:20px;height:20px;object-fit:contain;display:block;image-rendering:auto;">`
        :(racer==="avatar"?"🏁":racer);
      const fxCls=(m.fx&&m.fx!=="fx0")?(" "+m.fx):"";
      const nm=`<span class="namefx${fxCls}" data-emoji="${fxEmoji(m.fx)}">${m.name}</span>`;
      // 各自的賽道皮膚：套在「自己這條跑道」的背景，給所有人看（增加特殊感）
      const sk=skinById(m.skin);
      const laneBg=sk.id?`background:${sk.css};border-radius:8px;padding:0 8px;${sk.dark?"color:#eef;":""}`:"";
      const dashCol=sk.dark?"rgba(255,255,255,.35)":"var(--line)";
      return `<div style="margin:7px 0;${laneBg}">`+
        `<div style="display:flex;align-items:center;gap:5px;font-size:12px;margin-bottom:1px;${sk.id?'padding-top:4px;':''}">`+
          `<span>${medal(m.rank)}</span>`+
          (m.avatar?`<img class="avatar sm" src="${m.avatar}">`:"")+
          `<span style="${m.me?'font-weight:700;'+(sk.dark?'color:#fff;':'color:var(--accent);'):''}">${nm}</span>`+
          (m.pet?`<span title="${m.pet.stage}寵物 ${m.pet.mood||''}" style="position:relative;display:inline-flex;align-items:center;line-height:0;">${(m.pet.hat&&!petArtUrl(m.pet.species,m.pet.breed,m.pet.stageIdx))?`<span style="position:absolute;top:-9px;left:50%;transform:translateX(-50%);font-size:10px;z-index:2;">${m.pet.hat}</span>`:""}${petGlyph(m.pet,22)}</span>`:"")+
          (m.trophies?`<span>🏆×${m.trophies}</span>`:"")+
          `<span style="margin-left:auto;${sk.dark?'color:#dde;':'color:var(--sub);'}">${m.detail}</span></div>`+
        `<div style="position:relative;height:18px;border-bottom:1px dashed ${dashCol};${sk.id?'margin-bottom:4px;':''}">`+
          `<span class="runner" data-p="${p}" style="position:absolute;left:0%;top:-1px;transition:left 1.1s cubic-bezier(.2,.8,.2,1);font-size:16px;">${runnerInner}</span></div>`+
      `</div>`;
    }).join("");
    const raceBox=`<div style="margin:8px 0;">${race}</div>`;
    // 團隊模式沒有賽道，用精簡清單
    const teamList=g.members.map((m,i)=>
      `<div class="rec-line"${m.me?' style="font-weight:700;color:var(--accent)"':""}><span>• ${m.avatar?`<img class="avatar sm" src="${m.avatar}">`:""}<span class="namefx ${m.fx||"fx0"}" data-emoji="${fxEmoji(m.fx)}">${m.name}</span>${m.me?"（我）":""}${m.trophies?` 🏆×${m.trophies}`:""}</span><span>${m.detail}</span></div>`).join("");
    let teamBar="";
    if(isTeam&&g.team){
      const pct=Math.min(100,g.team.goal?Math.round(g.team.total/g.team.goal*100):0);
      teamBar=`<div style="margin:6px 0 8px;"><div style="display:flex;justify-content:space-between;font-size:13px;"><span>團隊總分</span><b>${g.team.total} / ${g.team.goal}</b></div>`+
        `<div class="prog"><i style="width:${pct}%"></i></div><div class="hint">大家一起衝，達 ${g.team.goal} 分過關（${pct}%）</div></div>`;
    }
    const left=g.seasonEnd?daysBetween(today,g.seasonEnd):null;
    // 非每日賽顯示實際結算日期；每日賽只顯示倒數
    const endTxt=(g.period!=="day"&&g.seasonEnd)?`結算日 ${g.seasonEnd.slice(5)}（週${"日一二三四五六"[new Date(g.seasonEnd+"T00:00:00").getDay()]}）　·　`:"";
    const cd=left==null?"":left<0?"結算中…":left===0?`${endTxt}今天結算！`:`${endTxt}距結算還有 ${left} 天`;
    const hist=(g.history||[]).filter(h=>h.winner);
    const histHtml=hist.length?`<details style="margin-top:8px;"><summary style="cursor:pointer;font-size:13px;color:var(--sub);">🏆 歷屆冠軍（${hist.length}）</summary>`+
      hist.map(h=>`<div class="hint" style="margin-top:2px;">第 ${h.round} 輪（${h.start.slice(5)}~${h.end.slice(5)}）：<b>${h.winner}</b>${h.boss?" 🔥魔王(雙倍)":""}</div>`).join("")+`</details>`:"";
    // 魔王輪橫幅
    const winPer={day:15,week:100,month:500}[g.period]||100;
    const bossBanner=g.boss?`<div style="margin:6px 0;padding:6px 10px;border-radius:8px;background:linear-gradient(90deg,#fde2d0,#f7c9b0);color:#9a4a2a;font-size:12.5px;font-weight:600;">🔥 本輪是「魔王輪」！奪冠積分 <b>雙倍（${winPer*2} 分）</b>，把握機會衝一波！</div>`:"";
    // 留言／加油
    const msgs=g.messages||[];
    const msgList=msgs.length?msgs.map(m=>`<div style="font-size:12px;margin:2px 0;"><b style="color:${m.me?'var(--accent)':'var(--ink)'}">${m.name}</b>：${escapeHtml(m.body)}</div>`).join(""):`<div class="hint">還沒有留言，先喊一聲幫大家加油吧！</div>`;
    const msgsHtml=`<details style="margin-top:8px;"><summary style="cursor:pointer;font-size:13px;color:var(--sub);">💬 留言加油（${msgs.length}）</summary>`+
      `<div style="margin-top:4px;max-height:140px;overflow-y:auto;">${msgList}</div>`+
      `<div class="row" style="margin-top:6px;"><div style="flex:1 1 auto;"><input id="gmsg-${g.id}" maxlength="120" placeholder="說句加油/嗆聲（不會洩漏體重）" autocomplete="off"></div>`+
      `<div style="flex:0 0 auto;align-self:flex-end;"><button class="ghost sm" onclick="sendGroupMsg(${g.id})">送出</button></div></div></details>`;
    const meM=g.members.find(m=>m.me); const myRank=meM?(meM.rank==null?"未上榜":`第 ${meM.rank}/${g.members.length}`):"";
    const open=(grpClosed.has(g.id))?"":" open";
    return `<details${open} data-gid="${g.id}" ontoggle="onGroupToggle(this)" style="border:1px solid var(--line);border-radius:10px;padding:2px 12px;margin-bottom:10px;">`+
      `<summary style="cursor:pointer;padding:8px 0;list-style:none;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">`+
        `<b>${g.name}</b><span class="pill">${PERIOD_LABEL[g.period]}·${METRIC_LABEL[g.metric]}</span>`+
        `<span class="pill" style="background:var(--soft);color:var(--accent)">第 ${g.roundNo} 輪</span>`+
        (myRank?`<span class="pill" style="margin-left:auto;">${myRank}</span>`:"")+`</summary>`+
      `<div class="hint" style="margin-bottom:4px;">${cd}${g.stakes?`　·　🎁 ${g.stakes}`:""}</div>`+
      bossBanner+
      (isTeam?teamBar+teamList:raceBox)+
      histHtml+
      msgsHtml+
      `<div class="chipbar" style="margin-top:8px;">`+
        `<button class="ghost sm" onclick="loadGroups()">🔄 更新</button>`+
        `<button class="ghost sm" onclick="copyInvite('${g.code}')">🔗 邀請連結</button>`+
        `<button class="ghost sm" onclick="leaveGroup(${g.id},${g.isOwner})">${g.isOwner?"解散":"離開"}</button>`+
      `</div>`+
      `<div class="hint" style="padding-bottom:6px;">邀請碼 <b>${g.code}</b></div></details>`;
  }).join("");
  // 賽馬動畫：插入後再把跑者移到目標位置，觸發過場
  requestAnimationFrame(()=>{ box.querySelectorAll(".runner").forEach(el=>{ el.style.left=(el.dataset.p||0)+"%"; }); });
}

/* ---------- 積分制 + 名稱特效 ---------- */
const FX_TIERS=[
  {min:0,    cls:"fx0",  name:"新手(預設)", emoji:""},
  {min:50,   cls:"fx1",  name:"微光",     emoji:"✨"},
  {min:120,  cls:"fx2",  name:"花環",     emoji:"🌸"},
  {min:220,  cls:"fx3",  name:"貓咪",     emoji:"🐱"},
  {min:280,  cls:"fx4",  name:"雲朵狗狗", emoji:"☁️"},
  {min:350,  cls:"fx5",  name:"火焰",     emoji:"🔥"},
  {min:500,  cls:"fx6",  name:"幼龍",     emoji:"🐉"},
  {min:700,  cls:"fx7",  name:"小美人魚", emoji:"🧜‍♀️"},
  {min:950,  cls:"fx8",  name:"靈狐",     emoji:"🦊"},
  {min:1100, cls:"fx9",  name:"企鵝",     emoji:"🐧"},
  {min:1300, cls:"fx10", name:"獨角獸",   emoji:"🦄"},
  {min:1600, cls:"fx11", name:"雷霆",     emoji:"⚡"},
  {min:2000, cls:"fx12", name:"皇冠",     emoji:"👑"},
  {min:2800, cls:"fx13", name:"神龍",     emoji:"🐲"},
  {min:3500, cls:"fx14", name:"彩虹傳說", emoji:"🌈"},
  {min:5000, cls:"fx15", name:"鑽石傳奇", emoji:"💎"},
];
// 賽道角色（積分解鎖）：預設 🏁 旗子，解鎖後在所有競賽的賽馬跑道變成你的專屬角色
const RACER_TIERS=[
  {min:0,    emoji:"🏁", name:"旗子(預設)"},
  {min:30,   emoji:"🐢", name:"烏龜"},
  {min:70,   emoji:"🐹", name:"倉鼠"},
  {min:110,  emoji:"🐱", name:"貓咪"},
  {min:160,  emoji:"🐇", name:"兔子"},
  {min:230,  emoji:"🐧", name:"企鵝"},
  {min:320,  emoji:"🐕", name:"狗狗"},
  {min:420,  emoji:"🐨", name:"無尾熊"},
  {min:540,  emoji:"🐖", name:"小豬"},
  {min:680,  emoji:"🦊", name:"狐狸"},
  {min:850,  emoji:"🐼", name:"熊貓"},
  {min:1050, emoji:"🐐", name:"山羊"},
  {min:1300, emoji:"🦌", name:"小鹿"},
  {min:1600, emoji:"🐅", name:"老虎"},
  {min:2000, emoji:"🦁", name:"獅子"},
  {min:2500, emoji:"🐎", name:"駿馬"},
  {min:3200, emoji:"🦅", name:"老鷹"},
  {min:4000, emoji:"🐬", name:"海豚"},
  {min:5000, emoji:"🦄", name:"獨角獸"},
  {min:6500, emoji:"🐉", name:"飛龍"},
  {min:8000, emoji:"🚀", name:"火箭"},
];
// 賽道皮膚（積分解鎖）：套用在競賽賽道背景，只影響自己的畫面
const SKIN_TIERS=[
  {id:"",      min:0,    name:"預設",   css:"transparent"},
  {id:"grass", min:100,  name:"草原",   css:"linear-gradient(180deg,#eef7e8,#dceccf)"},
  {id:"sky",   min:300,  name:"晴空",   css:"linear-gradient(180deg,#e8f3fb,#d3e8f7)"},
  {id:"sunset",min:600,  name:"黃昏",   css:"linear-gradient(180deg,#fdeede,#f7d9c4)"},
  {id:"sea",   min:1000, name:"海邊",   css:"linear-gradient(180deg,#e2f5f3,#c6e8ea)"},
  {id:"night", min:1600, name:"夜跑",   css:"linear-gradient(180deg,#3a3d57,#262a44)", dark:true},
  {id:"neon",  min:2600, name:"霓虹",   css:"linear-gradient(180deg,#2b1840,#3a1c52)", dark:true},
  {id:"galaxy",min:4000, name:"星河",   css:"linear-gradient(180deg,#1c2347,#3a2a5c)", dark:true},
];
function skinById(id){ return SKIN_TIERS.find(s=>s.id===(id||""))||SKIN_TIERS[0]; }
function chooseSkin(id){ try{ localStorage.setItem("tdee_skin",id); }catch(e){} store.skin=id||null; renderPoints();
  api("/api/cosmetic",{method:"POST",body:JSON.stringify({skin:id||""})}).then(()=>loadGroups()).catch(()=>{});
}
// 積分＝歷史每日自律分總和 ＋ 每座冠軍獎盃 100 分
function computePoints(){
  const t=goalTargets();
  const dates=new Set();
  (store.records||[]).forEach(r=>dates.add(r.date.slice(0,10)));
  Object.keys(store.mealAgg||{}).forEach(d=>dates.add(d));
  (store.exercises||[]).forEach(e=>dates.add(e.date.slice(0,10)));
  let activity=0;
  dates.forEach(ds=>{
    const nut=dayNutrition(ds);
    const rec=(store.records||[]).find(r=>r.date.slice(0,10)===ds);
    const water=rec&&rec.water_ml?+rec.water_ml:0;
    const logged=nut.k>0, exercised=(store.exercises||[]).some(e=>e.date.slice(0,10)===ds);
    if(logged) activity+=1;
    if(t&&logged&&nut.k<=t.kcal) activity+=1;
    if(t&&logged&&nut.p>=t.protein) activity+=1;
    if(exercised) activity+=1;
    if(water>=waterGoalFor(ds)) activity+=1;
  });
  let trophies=0, trophyPts=0;
  (myGroups||[]).forEach(g=>{ const me=(g.members||[]).find(m=>m.me); if(me){ trophies+=me.trophies||0; trophyPts+=me.trophyPts||0; } });
  return {points:activity+trophyPts, activity, trophies, trophyPts};
}
function tierFor(points){ let cur=FX_TIERS[0]; for(const t of FX_TIERS){ if(points>=t.min) cur=t; } return cur; }
function fxEmoji(cls){ const t=FX_TIERS.find(t=>t.cls===cls); return t?t.emoji:""; }
function applyNameFx(){
  const el=document.getElementById("nameFrame"); if(!el) return;
  const {points}=computePoints();
  const unlocked=FX_TIERS.filter(t=>points>=t.min);
  // 選用：localStorage 記住手選，否則用最高已解鎖
  let pick=null; try{ pick=localStorage.getItem("tdee_fx"); }catch(e){}
  let tier=unlocked.find(t=>t.cls===pick)||unlocked[unlocked.length-1];
  el.className="namefx "+tier.cls;
  el.setAttribute("data-emoji", tier.emoji||"");
}
function chooseFx(cls){ try{ localStorage.setItem("tdee_fx",cls); }catch(e){} applyNameFx(); renderPoints();
  // 存到伺服器，讓所有競賽的名字都套用這個特效
  api("/api/cosmetic",{method:"POST",body:JSON.stringify({fx:cls})}).then(()=>loadGroups()).catch(()=>{});
}
// 選擇賽道角色（解鎖後在所有競賽的賽馬跑道顯示）
function chooseRacer(emoji){ try{ localStorage.setItem("tdee_racer",emoji); }catch(e){} renderPoints();
  api("/api/cosmetic",{method:"POST",body:JSON.stringify({racer:emoji})}).then(()=>loadGroups()).catch(()=>{});
}
// 自訂頭像（積分獎勵，滿 AV_MIN 解鎖）
const AV_MIN=1000;
function applyAvatar(){ const el=document.getElementById("myAvatar"); if(!el) return; if(store.avatar){ el.src=store.avatar; el.style.display=""; } else { el.style.display="none"; } }
function compressAvatar(file){
  return new Promise((res)=>{ const img=new Image(); img.onload=()=>{ const s=96, cv=document.createElement("canvas"); cv.width=s; cv.height=s;
    const ctx=cv.getContext("2d"), m=Math.min(img.width,img.height), sx=(img.width-m)/2, sy=(img.height-m)/2;
    ctx.drawImage(img,sx,sy,m,m,0,0,s,s); const url=cv.toDataURL("image/jpeg",0.72); URL.revokeObjectURL(img.src); res(url); }; img.src=URL.createObjectURL(file); });
}
async function uploadAvatar(ev){
  const f=ev.target.files&&ev.target.files[0]; ev.target.value=""; if(!f) return;
  const img=await compressAvatar(f);
  try{ await api("/api/avatar",{method:"POST",body:JSON.stringify({image:img})}); store.avatar=img; applyAvatar(); renderPoints(); }
  catch(e){ alert("上傳失敗："+e.message); }
}
async function removeAvatar(){
  try{ await api("/api/avatar",{method:"POST",body:JSON.stringify({image:""})}); store.avatar=null; applyAvatar(); renderPoints(); }catch(e){ alert(e.message); }
}

/* ---------- 推播提醒 ---------- */
function b64ToU8(base64){
  const pad="=".repeat((4-base64.length%4)%4); const b=(base64+pad).replace(/-/g,"+").replace(/_/g,"/");
  const raw=atob(b); const arr=new Uint8Array(raw.length); for(let i=0;i<raw.length;i++) arr[i]=raw.charCodeAt(i); return arr;
}
function pushPrefs(){ return (store.profile&&store.profile.push)||{water:false,log:false,comp:false}; }
function renderPushUI(){
  const p=pushPrefs();
  const set=(id,v)=>{const el=document.getElementById(id); if(el) el.checked=!!v;};
  set("pkWater",p.water); set("pkLog",p.log); set("pkComp",p.comp);
  const st=document.getElementById("pushStatus"); if(!st) return;
  if(!("Notification" in window)||!("serviceWorker" in navigator)){ st.textContent="此裝置/瀏覽器不支援推播。"; return; }
  st.textContent=Notification.permission==="granted"?"✅ 通知已開啟":"尚未開啟通知，請按「開啟通知」。";
}
async function enablePush(){
  const st=document.getElementById("pushStatus");
  if(!("serviceWorker" in navigator)||!("PushManager" in window)){ alert("此瀏覽器不支援推播"); return; }
  try{
    const perm=await Notification.requestPermission();
    if(perm!=="granted"){ st.textContent="未允許通知。請到瀏覽器/系統設定開啟。"; return; }
    const reg=await navigator.serviceWorker.ready;
    const {key}=await api("/api/push/key");
    let sub=await reg.pushManager.getSubscription();
    if(!sub) sub=await reg.pushManager.subscribe({userVisibleOnly:true, applicationServerKey:b64ToU8(key)});
    await api("/api/push/subscribe",{method:"POST",body:JSON.stringify({sub})});
    st.textContent="✅ 通知已開啟";
  }catch(e){ st.textContent="開啟失敗："+e.message; }
}
async function savePushPrefs(){
  const prefs={water:document.getElementById("pkWater").checked, log:document.getElementById("pkLog").checked, comp:document.getElementById("pkComp").checked};
  store.profile=store.profile||{}; store.profile.push=prefs;
  if((prefs.water||prefs.log||prefs.comp) && Notification.permission!=="granted") await enablePush();
  try{ await api("/api/push/prefs",{method:"POST",body:JSON.stringify(prefs)}); }catch(e){ alert(e.message); }
}
async function testPush(){
  if(Notification.permission!=="granted"){ await enablePush(); }
  try{ await api("/api/push/test",{method:"POST"}); }catch(e){ alert(e.message); }
}
function renderPoints(){
  const box=document.getElementById("pointsBox"); if(!box){ applyNameFx(); return; }
  const {points,activity,trophies,trophyPts}=computePoints();
  const cur=tierFor(points), next=FX_TIERS.find(t=>t.min>points);
  const pill=document.getElementById("pointsPill"); if(pill) pill.textContent=points+" 分";
  let pick=null; try{ pick=localStorage.getItem("tdee_fx"); }catch(e){}
  const prog=next?Math.round((points-cur.min)/(next.min-cur.min)*100):100;
  const gallery=FX_TIERS.map(t=>{
    const got=points>=t.min, sel=(pick?pick===t.cls:(got&&t===tierFor(points)));
    return `<div onclick="${got?`chooseFx('${t.cls}')`:''}" title="${t.min} 分解鎖" `+
      `style="flex:0 0 auto;text-align:center;padding:6px 8px;border:1px solid ${sel?'var(--accent)':'var(--line)'};border-radius:10px;${got?'cursor:pointer;':'opacity:.4;'}background:${sel?'var(--soft)':'#fff'};">`+
      `<div style="font-size:18px;">${t.emoji||"🙂"}</div><div style="font-size:11px;${got?'':'color:var(--sub)'}">${t.name}</div>`+
      `<div style="font-size:10px;color:var(--sub)">${got?(sel?"使用中":"可用"):t.min+"分"}</div></div>`;
  }).join("");
  // 賽道角色畫廊
  let pickR="🏁"; try{ pickR=localStorage.getItem("tdee_racer")||"🏁"; }catch(e){}
  let racerGallery=RACER_TIERS.map(t=>{
    const got=points>=t.min, on=pickR===t.emoji;
    return `<div onclick="${got?`chooseRacer('${t.emoji}')`:''}" title="${t.min} 分解鎖" `+
      `style="flex:0 0 auto;text-align:center;padding:6px 8px;border:1px solid ${on?'var(--accent)':'var(--line)'};border-radius:10px;${got?'cursor:pointer;':'opacity:.4;'}background:${on?'var(--soft)':'#fff'};">`+
      `<div style="font-size:18px;">${t.emoji}</div><div style="font-size:11px;${got?'':'color:var(--sub)'}">${t.name}</div>`+
      `<div style="font-size:10px;color:var(--sub)">${got?(on?"使用中":"可用"):t.min+"分"}</div></div>`;
  }).join("");
  // 用「自訂頭像」當賽道角色（需先在下方上傳頭像，滿 AV_MIN 分）
  {
    const okAv=points>=AV_MIN&&!!store.avatar, on=pickR==="avatar";
    const inner=store.avatar?`<img src="${store.avatar}" style="width:18px;height:18px;border-radius:50%;object-fit:cover;margin:0 auto;display:block;">`:"🖼️";
    racerGallery+=`<div onclick="${okAv?`chooseRacer('avatar')`:''}" title="滿 ${AV_MIN} 分並上傳頭像" `+
      `style="flex:0 0 auto;text-align:center;padding:6px 8px;border:1px solid ${on?'var(--accent)':'var(--line)'};border-radius:10px;${okAv?'cursor:pointer;':'opacity:.4;'}background:${on?'var(--soft)':'#fff'};">`+
      `<div style="font-size:18px;">${inner}</div><div style="font-size:11px;${okAv?'':'color:var(--sub)'}">我的頭像</div>`+
      `<div style="font-size:10px;color:var(--sub)">${okAv?(on?"使用中":"可用"):(store.avatar?AV_MIN+"分":"需頭像")}</div></div>`;
  }
  // 扭蛋抽到的「賽道小圖」：擁有才出現，點即套用（不需積分，靠扭蛋取得）
  if(typeof petData==="object"&&petData&&Array.isArray(petData.racers)&&petData.racers.length){
    const arts=(typeof petMeta==="object"&&petMeta&&petMeta.racerArts)||{};
    petData.racers.forEach(k=>{
      const key="racerart:"+k, on=pickR===key, label=(arts[k]&&arts[k].label)||k;
      racerGallery+=`<div onclick="chooseRacer('${key}')" title="扭蛋取得的賽道角色" `+
        `style="flex:0 0 auto;text-align:center;padding:6px 8px;border:1px solid ${on?'var(--accent)':'var(--line)'};border-radius:10px;cursor:pointer;background:${on?'var(--soft)':'#fff'};">`+
        `<div style="height:20px;display:flex;align-items:center;justify-content:center;"><img src="racers/${k}_sm.png?v=${ASSETV}" onerror="this.onerror=null;this.src='racers/${k}.png?v=${ASSETV}'" style="width:20px;height:20px;object-fit:contain;"></div>`+
        `<div style="font-size:11px;">${label}</div><div style="font-size:10px;color:var(--sub)">${on?"使用中":"可用"}</div></div>`;
    });
  }
  // 賽道皮膚畫廊
  let pickS=""; try{ pickS=localStorage.getItem("tdee_skin")||(store.skin||""); }catch(e){ pickS=store.skin||""; }
  const skinGallery=SKIN_TIERS.map(t=>{
    const got=points>=t.min, on=pickS===t.id;
    return `<div onclick="${got?`chooseSkin('${t.id}')`:''}" title="${t.min} 分解鎖" `+
      `style="flex:0 0 auto;text-align:center;padding:5px;border:2px solid ${on?'var(--accent)':'var(--line)'};border-radius:10px;${got?'cursor:pointer;':'opacity:.4;'}">`+
      `<div style="width:54px;height:24px;border-radius:6px;background:${t.css==='transparent'?'#f0f0f0':t.css};"></div>`+
      `<div style="font-size:11px;${got?'':'color:var(--sub)'}">${t.name}</div>`+
      `<div style="font-size:10px;color:var(--sub)">${got?(on?"使用中":"可用"):t.min+"分"}</div></div>`;
  }).join("");
  box.innerHTML=
    `<div class="stat-row" style="margin-top:2px;">`+
      `<div><div class="v">${points.toLocaleString()}</div><div class="k">總積分</div></div>`+
      `<div><div class="v">${activity.toLocaleString()}</div><div class="k">自律累積</div></div>`+
      `<div><div class="v">🏆 ${trophies}</div><div class="k">冠軍 ${trophyPts?`(${trophyPts}分)`:""}</div></div>`+
    `</div>`+
    `<div class="hint" style="margin-top:8px;">目前稱號：<b>${cur.emoji} ${cur.name}</b>${next?`　·　距「${next.emoji} ${next.name}」還差 ${next.min-points} 分`:`　·　已達最高稱號！`}</div>`+
    (next?`<div class="prog" style="margin-top:6px;"><i style="width:${prog}%"></i></div>`:"")+
    `<div style="font-weight:500;font-size:13px;margin:10px 0 6px;">名稱特效（點選已解鎖的套用，所有競賽都會顯示）</div>`+
    `<div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:4px;">${gallery}</div>`+
    `<div style="font-weight:500;font-size:13px;margin:12px 0 6px;">🏇 賽道角色（解鎖後在競賽跑道變成你的專屬角色）</div>`+
    `<div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:4px;">${racerGallery}</div>`+
    `<div style="font-weight:500;font-size:13px;margin:12px 0 6px;">🎨 賽道皮膚（套在你的跑道背景，<b>所有人都看得到</b>）</div>`+
    `<div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:4px;">${skinGallery}</div>`+
    avatarSection(points)+
    `<div class="hint tip" style="margin-top:6px;line-height:1.7;">📋 <b>積分怎麼算</b>（每天最多 +5）：<br>`+
      `・有記飲食 +1　・熱量達標(吃在目標內) +1<br>`+
      `・蛋白達標 +1　・有運動 +1　・喝水達標 +1<br>`+
      `競賽<b>前三名</b>都有分（冠軍 每日15/每週100/每月500，亞軍 50%、季軍 30%，魔王輪雙倍）。分數只會累積、不會倒扣。<br>`+
      `用途：解鎖名稱特效、賽道角色、賽道皮膚、自訂頭像（${AV_MIN} 分）。</div>`;
  applyNameFx(); applyAvatar();
}
function avatarSection(points){
  const head=`<div style="font-weight:500;font-size:13px;margin:12px 0 6px;">🖼️ 自訂頭像 ${points>=AV_MIN?"（已解鎖）":`（滿 ${AV_MIN} 分解鎖，還差 ${AV_MIN-points} 分）`}</div>`;
  if(points<AV_MIN) return head+`<div class="hint">達到 ${AV_MIN} 分後可上傳一張圖當頭像，顯示在名字旁與競賽排行榜。`+`<div class="prog" style="margin-top:6px;"><i style="width:${Math.round(points/AV_MIN*100)}%"></i></div></div>`;
  const cur=store.avatar?`<img class="avatar" src="${store.avatar}" style="width:48px;height:48px;">`:`<span class="hint">尚未設定</span>`;
  return head+`<div style="display:flex;align-items:center;gap:10px;">`+cur+
    `<input id="avatarInput" type="file" accept="image/*" style="display:none;" onchange="uploadAvatar(event)">`+
    `<button class="ghost sm" onclick="document.getElementById('avatarInput').click()">${store.avatar?"更換":"上傳"}頭像</button>`+
    (store.avatar?`<button class="ghost sm" onclick="removeAvatar()">移除</button>`:"")+`</div>`;
}

/* ---------- 新手引導（首次登入 3 步驟） ---------- */
const ONBOARD_STEPS=[
  {ic:"👋",t:"歡迎使用！",b:"這是你的個人減重夥伴。第一步：到<b>「概覽」</b>分頁的 ①②，填性別/年齡/身高/體重與目標，系統會算出你<b>每天該吃多少</b>。"},
  {ic:"🍽️",t:"記錄三餐很輕鬆",b:"「飲食」分頁可<b>搜尋台灣常見食物</b>、<b>掃條碼</b>、<b>拍照 AI 辨識</b>，或<b>一句話</b>讓 AI 估熱量。記得每天記，TDEE 才會越來越準。"},
  {ic:"🏆",t:"計畫・報表・競賽",b:"「紀錄」分頁有<b>自動減重計畫</b>、<b>每週覆盤</b>、還有<b>群組競賽</b>——揪朋友一起比，看不到彼此體重、累積積分還能解鎖名稱特效與賽道角色！"},
  {ic:"🎖️",t:"積分怎麼累積",b:"每天最多 +5 分：<b>有記飲食</b>+1、<b>熱量達標</b>(吃在目標內)+1、<b>蛋白達標</b>+1、<b>有運動</b>+1、<b>喝水達標</b>+1。競賽奪冠：<b>每日+15／每週+100／每月+500</b>（魔王輪雙倍）。積分用來解鎖名稱特效、賽道角色、賽道皮膚、自訂頭像。<b>越自律分數越高，不會因偷懶倒扣。</b>"},
  {ic:"📲",t:"加到主畫面（重要）",b:"把網頁<b>加到手機主畫面</b>，就能像 App 一樣全螢幕開啟、收到提醒：<br><br><b>iPhone(Safari)：</b>點下方<b>分享 </b>↑<b> → 加入主畫面</b>。<br><b>Android(Chrome)：</b>點右上<b> ⋮ 選單 → 加到主畫面／安裝應用程式</b>。<br><br>之後從主畫面圖示開啟，到「紀錄→提醒通知」開啟喝水/記錄提醒。"},
];
let onbI=0;
function showOnboarding(){
  onbI=0; renderOnboard();
}
function renderOnboard(){
  let ov=document.getElementById("onboardOv");
  if(!ov){ ov=document.createElement("div"); ov.id="onboardOv"; ov.className="celebrate"; document.body.appendChild(ov); }
  const s=ONBOARD_STEPS[onbI], last=onbI===ONBOARD_STEPS.length-1;
  const dots=ONBOARD_STEPS.map((_,i)=>`<span style="display:inline-block;width:7px;height:7px;border-radius:50%;margin:0 3px;background:${i===onbI?'var(--accent)':'var(--line)'}"></span>`).join("");
  ov.innerHTML=`<div class="cele-card" style="max-width:320px;">`+
    `<div style="font-size:42px;">${s.ic}</div>`+
    `<div style="font-size:19px;font-weight:700;margin-top:6px;">${s.t}</div>`+
    `<div class="hint" style="color:var(--ink);line-height:1.7;margin-top:8px;text-align:left;">${s.b}</div>`+
    `<div style="margin:12px 0 4px;">${dots}</div>`+
    `<div style="display:flex;gap:8px;justify-content:center;">`+
      `<button class="ghost sm" onclick="endOnboard()">略過</button>`+
      `<button class="sm" style="width:auto;padding:8px 20px;margin-top:0;" onclick="${last?'endOnboard()':'nextOnboard()'}">${last?'開始使用 🚀':'下一步'}</button>`+
    `</div></div>`;
}
function nextOnboard(){ onbI++; renderOnboard(); }
function endOnboard(){ const ov=document.getElementById("onboardOv"); if(ov) ov.remove(); try{ localStorage.setItem("tdee_onboarded","1"); }catch(e){} }
function maybeOnboard(){ let seen; try{ seen=localStorage.getItem("tdee_onboarded"); }catch(e){} if(!seen) showOnboarding(); }

/* ---------- 賽季結算慶祝 ---------- */
function celebrate(title,sub){
  const ov=document.createElement("div"); ov.className="celebrate";
  const conf=Array.from({length:24},(_,i)=>`<span style="left:${Math.random()*100}%;animation-delay:${(Math.random()*0.8).toFixed(2)}s;background:hsl(${Math.floor(Math.random()*360)},80%,60%)"></span>`).join("");
  ov.innerHTML=`<div class="confetti">${conf}</div><div class="cele-card"><div style="font-size:46px;">🏆</div>`+
    `<div style="font-size:20px;font-weight:700;margin-top:6px;">${title}</div>`+
    `<div class="hint" style="margin-top:6px;">${sub||""}</div>`+
    `<button class="sm" style="margin-top:12px;width:auto;padding:8px 20px;" onclick="this.closest('.celebrate').remove()">太讚了 🎉</button></div>`;
  ov.onclick=(e)=>{ if(e.target===ov) ov.remove(); };
  document.body.appendChild(ov);
  setTimeout(()=>{ if(ov.parentNode) ov.remove(); }, 9000);
}
// 載入競賽後：找出我剛奪冠、還沒慶祝過的輪次
function checkCelebrations(){
  let done=[]; try{ done=JSON.parse(localStorage.getItem("tdee_celebrated")||"[]"); }catch(e){}
  const me=session&&session.username;
  for(const g of (myGroups||[])){
    for(const h of (g.history||[])){
      if(h.winner!==me) continue;
      const key=g.id+":"+h.round;
      if(done.includes(key)) continue;
      done.push(key);
      celebrate(`第 ${h.round} 輪冠軍是你！`, `「${g.name}」· ${PERIOD_LABEL[g.period]}${METRIC_LABEL[g.metric]}　獲得 🏆 +100 積分`);
    }
  }
  try{ localStorage.setItem("tdee_celebrated",JSON.stringify(done.slice(-200))); }catch(e){}
}
async function createGroup(){
  const name=val("grpName").trim()||"減重小隊";
  const metric=val("grpMetric"), period=val("grpPeriod"), stakes=val("grpStakes").trim();
  try{
    const r=await api("/api/group",{method:"POST",body:JSON.stringify({name,metric,period,stakes})});
    document.getElementById("grpName").value="";
    await loadGroups();
    copyInvite(r.code);
  }catch(e){ alert(e.message); }
}
async function joinGroupByCode(){
  const code=val("grpJoinCode").trim().toUpperCase();
  if(!code){ alert("請輸入邀請碼"); return; }
  try{ await api("/api/group/join",{method:"POST",body:JSON.stringify({code})}); document.getElementById("grpJoinCode").value=""; await syncDailyStats(); await loadGroups(); alert("已加入競賽！"); }
  catch(e){ alert(e.message); }
}
async function leaveGroup(id,isOwner){
  if(!confirm(isOwner?"解散這個競賽？所有成員都會移除。":"離開這個競賽？")) return;
  try{ await api("/api/group/"+id+"/leave",{method:"POST"}); await loadGroups(); }catch(e){ alert(e.message); }
}
function copyInvite(code){
  const url=location.origin+location.pathname+"?join="+code;
  const msg=`邀請碼：${code}\n邀請連結（已複製）：\n${url}\n\n朋友可貼上連結直接加入，或在競賽區輸入邀請碼 ${code}。`;
  const done=()=>alert(msg);
  if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done,()=>prompt("複製這個連結分享：",url));
  else prompt("複製這個連結分享（邀請碼 "+code+"）：",url);
}
// 處理 ?join=CODE 連結加入
async function handleJoinParam(){
  const m=location.search.match(/[?&]join=([A-Za-z0-9]+)/);
  if(!m) return;
  const code=m[1].toUpperCase();
  history.replaceState(null,"",location.pathname);  // 清掉網址參數
  try{ await api("/api/group/join",{method:"POST",body:JSON.stringify({code})}); await syncDailyStats(); alert("已加入競賽！"); }
  catch(e){ alert("加入失敗："+e.message); }
}

async function addMeal(){
  if(!foodCart.length && !mealPhoto){ alert("先加入食物，或拍一張照片"); return; }
  const date=selDate(), meal=val("mealType");
  const items=foodCart.map(it=>{const m=cartMacros(it);return {name:it.n+` ${it.g}g`,kcal:Math.round(m.k),protein:+m.p.toFixed(1),fat:+m.f.toFixed(1),carb:+m.c.toFixed(1)};});
  foodCart.forEach(it=>bumpFoodStat(it.n,it.g));   // 記錄常用與上次克數
  try{
    await api("/api/meal",{method:"POST",body:JSON.stringify({date,meal,items,photo:mealPhoto})});
    foodCart=[]; renderFood(); clearMealPhoto(); await reload();
    document.getElementById("mealGroups").scrollIntoView({behavior:"smooth"});
  }catch(e){ alert(e.message); }
}
// 複製某天的飲食到目前選的日期（不含照片）
async function copyDayFrom(fromDate){
  const to=selDate();
  if(fromDate===to){ alert("來源與目標是同一天"); return; }
  const src=(store.meals||[]).filter(m=>m.date.slice(0,10)===fromDate && m.name!=="📷 照片紀錄");
  if(!src.length){ alert(fromDate+" 沒有可複製的飲食"); return; }
  if(!confirm(`把 ${fromDate} 的 ${src.length} 筆飲食複製到 ${to}？`)) return;
  const byMeal={};
  src.forEach(m=>{ (byMeal[m.meal]=byMeal[m.meal]||[]).push({name:m.name,kcal:m.kcal,protein:m.protein,fat:m.fat,carb:m.carb}); });
  try{
    for(const meal in byMeal){ await api("/api/meal",{method:"POST",body:JSON.stringify({date:to,meal,items:byMeal[meal]})}); }
    await reload();
    alert("已複製到 "+to);
  }catch(e){ alert(e.message); }
}
function copyDay(daysBack){
  const d=new Date(selDate()); d.setDate(d.getDate()-daysBack);
  const o=d.getTimezoneOffset(); copyDayFrom(new Date(d-o*60000).toISOString().slice(0,10));
}
function copyDayPrompt(){
  const f=prompt("要複製哪一天？（格式 2026-06-08）", selDate());
  if(f&&/^\d{4}-\d{2}-\d{2}$/.test(f.trim())) copyDayFrom(f.trim());
}
// 預設帶昨天，可改成任一天
function copyMealPrompt(){
  const d=new Date(selDate()); d.setDate(d.getDate()-1);
  const o=d.getTimezoneOffset(), y=new Date(d-o*60000).toISOString().slice(0,10);
  const f=prompt("複製哪一天的飲食到今天？（預設昨天，格式 2026-06-08）", y);
  if(f&&/^\d{4}-\d{2}-\d{2}$/.test(f.trim())) copyDayFrom(f.trim());
}
let editingMeal=null;
function mealGramOf(name){ const m=String(name).match(/(\d+(?:\.\d+)?)\s*g\b/); return m?+m[1]:0; }
function mealRowHtml(m){
  if(editingMeal===m.id){
    const gNow=mealGramOf(m.name);
    const inner=gNow>0
      ? `<input id="emG" type="number" value="${gNow}" style="width:70px;padding:5px"><span style="font-size:12px;color:var(--sub)">g（改克數自動換算）</span>`
      : `<input id="emK" type="number" value="${m.kcal||0}" style="width:70px;padding:5px"><span style="font-size:12px;color:var(--sub)">kcal</span>`;
    return `<div class="foodrow" style="flex-wrap:wrap;gap:6px;background:var(--soft);border-radius:8px;padding:8px;">`+
      `<span class="nm" style="flex:1 1 100%;font-weight:500;">✏️ ${m.name}</span>${inner}`+
      `<button class="ghost sm" onclick="saveMealEdit(${m.id},${gNow})">儲存</button>`+
      `<button class="ghost sm" onclick="cancelMealEdit()">取消</button></div>`;
  }
  return `<div class="foodrow"><span class="nm">${m.name}<br><span style="color:var(--sub);font-size:11px">P${Math.round(m.protein||0)} F${Math.round(m.fat||0)} C${Math.round(m.carb||0)}</span></span>`+
    `<span class="kc">${m.kcal||0}</span>`+
    `<span class="x" style="color:var(--accent)" onclick="editMeal(${m.id})">✏️</span>`+
    `<span class="x" onclick="delMeal(${m.id})">✕</span></div>`;
}
function editMeal(id){ editingMeal=id; renderDay(); }
function cancelMealEdit(){ editingMeal=null; renderDay(); }
async function saveMealEdit(id,gNow){
  const m=(store.meals||[]).find(x=>x.id===id); if(!m) return;
  let body;
  if(gNow>0){
    const ng=+val("emG"); if(!ng||ng<=0){ alert("請輸入克數"); return; }
    const f=ng/gNow;
    body={ name:m.name.replace(/(\d+(?:\.\d+)?)\s*g\b/, ng+"g"),
      kcal:Math.round((+m.kcal||0)*f), protein:+((+m.protein||0)*f).toFixed(1),
      fat:+((+m.fat||0)*f).toFixed(1), carb:+((+m.carb||0)*f).toFixed(1) };
  }else{
    const nk=+val("emK"); const ok=+m.kcal||0; const f=ok>0?nk/ok:1;
    body={ kcal:Math.round(nk), protein:+((+m.protein||0)*f).toFixed(1),
      fat:+((+m.fat||0)*f).toFixed(1), carb:+((+m.carb||0)*f).toFixed(1) };
  }
  try{ await api("/api/meal/"+id,{method:"PUT",body:JSON.stringify(body)}); editingMeal=null; await reload(); }
  catch(e){ alert(e.message); }
}
async function delMeal(id){ await api("/api/meal/"+id,{method:"DELETE"}); await reload(); }
async function delMealPhoto(id){ if(!confirm("移除這張照片？")) return; await api("/api/meal/"+id+"/photo",{method:"DELETE"}); await reload(); }
// 按需載入餐點照片：開 App 時不撈大圖，看到某天才抓那天的照片，抓到後存回 store.meals 並重繪
let _photoLoading=new Set();
async function ensureMealPhotos(ids,date){
  const need=ids.filter(id=>!_photoLoading.has(id)); if(!need.length) return;
  need.forEach(id=>_photoLoading.add(id));
  try{
    const r=await api("/api/meal/photos",{method:"POST",body:JSON.stringify({ids:need})});
    (r.photos||[]).forEach(p=>{ const m=(store.meals||[]).find(x=>String(x.id)===String(p.id)); if(m) m.photo=p.photo; });
    renderMeals(date);
  }catch(e){}
  finally{ need.forEach(id=>_photoLoading.delete(id)); }
}
async function viewPhoto(id){
  const m=(store.meals||[]).find(x=>String(x.id)===String(id)); if(!m) return;
  if(!m.photo&&m.has_photo){ try{ const r=await api("/api/meal/photos",{method:"POST",body:JSON.stringify({ids:[m.id]})}); if(r.photos&&r.photos[0]) m.photo=r.photos[0].photo; }catch(e){} }
  if(!m.photo) return;
  const ov=document.createElement("div");
  ov.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:60;display:flex;align-items:center;justify-content:center;padding:20px";
  ov.onclick=()=>ov.remove();
  ov.innerHTML=`<img src="${m.photo}" style="max-width:100%;max-height:100%;border-radius:10px">`;
  document.body.appendChild(ov);
}
const MEAL_ORDER=["早餐","午餐","晚餐","點心"];
function renderMeals(date){
  const box=document.getElementById("mealGroups");
  const list=(store.meals||[]).filter(m=>m.date.slice(0,10)===date);
  if(!list.length){ box.innerHTML='<div class="empty">今天還沒記錄飲食</div>'; return; }
  // 這天有照片但還沒載入的 → 背景按需抓，抓到後會重繪
  const missing=list.filter(m=>m.has_photo&&!m.photo).map(m=>m.id);
  if(missing.length) ensureMealPhotos(missing,date);
  let html="";
  for(const mt of MEAL_ORDER){
    const g=list.filter(m=>m.meal===mt); if(!g.length) continue;
    const sub=g.reduce((a,b)=>a+(+b.kcal||0),0);
    const photos=g.filter(m=>m.photo||m.has_photo).map(m=>{
      const cell=m.photo
        ?`<img src="${m.photo}" onclick="viewPhoto('${m.id}')" style="width:64px;height:64px;object-fit:cover;border-radius:8px;border:1px solid var(--line);cursor:pointer">`
        :`<div style="width:64px;height:64px;border-radius:8px;border:1px solid var(--line);display:flex;align-items:center;justify-content:center;color:var(--sub);font-size:18px">⏳</div>`;
      return `<div style="position:relative;display:inline-block;margin:6px 6px 0 0">${cell}<span onclick="delMealPhoto(${m.id})" style="position:absolute;top:-7px;right:-7px;width:20px;height:20px;line-height:18px;text-align:center;background:#fff;border:1px solid var(--line);border-radius:50%;color:#b5564e;font-size:12px;cursor:pointer">✕</span></div>`;
    }).join("");
    const subP=g.reduce((a,b)=>a+(+b.protein||0),0), subF=g.reduce((a,b)=>a+(+b.fat||0),0), subC=g.reduce((a,b)=>a+(+b.carb||0),0);
    html+=`<div class="mealgrp"><div class="mh"><span>${mt}</span><span>${sub} kcal <span style="color:var(--sub);font-weight:400;font-size:11px">P${Math.round(subP)}·F${Math.round(subF)}·C${Math.round(subC)}</span></span></div>`+
      g.map(mealRowHtml).join("")+
      (photos?`<div style="display:flex;flex-wrap:wrap">${photos}</div>`:"")+`</div>`;
  }
  box.innerHTML=html;
}

/* ---------- 營養素達成環 ---------- */
function dayNutrition(date){
  const a=store.mealAgg&&store.mealAgg[date];
  if(a) return {k:Math.round(a.k),p:Math.round(a.p),f:Math.round(a.f),c:Math.round(a.c)};
  const r=store.records.find(x=>x.date.slice(0,10)===date);
  if(r) return {k:r.kcal!=null?+r.kcal:0,p:+r.protein||0,f:+r.fat||0,c:+r.carb||0};
  return {k:0,p:0,f:0,c:0};
}
function ringSvg(pct,color){
  const r=24,c=2*Math.PI*r,off=c*(1-Math.min(1,Math.max(0,pct)));
  return `<svg width="56" height="56" viewBox="0 0 56 56"><circle cx="28" cy="28" r="24" fill="none" stroke="#eee5d8" stroke-width="6"/><circle cx="28" cy="28" r="24" fill="none" stroke="${color}" stroke-width="6" stroke-linecap="round" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}" transform="rotate(-90 28 28)"/><text x="28" y="32" text-anchor="middle" font-size="13" font-weight="700" fill="#2b2b2b">${Math.round(pct*100)}%</text></svg>`;
}
function renderRings(date){
  const box=document.getElementById("rings");
  const t=goalTargets(), d=dayNutrition(date);
  if(!t){ box.innerHTML='<div class="hint">先填基本資料與目標，才能顯示達成環</div>'; return; }
  const items=[
    ["熱量","#7c9070",d.k,t.kcal,"kcal"],
    ["蛋白","#5b8aa6",d.p,t.protein,"g"],
    ["脂肪","#c98b5e",d.f,t.fat,"g"],
    ["碳水","#7c9070",d.c,t.carb,"g"]
  ];
  box.innerHTML=items.map(([nm,col,v,tg,u])=>
    `<div class="ring">${ringSvg(tg?v/tg:0,col)}<div class="rv">${v}/${tg}</div><div class="rk">${nm}(${u})</div></div>`).join("");
}

/* ---------- 訓練前後營養窗口 ＋ 每餐蛋白分配（女性專屬） ---------- */
// 訓前吃東西的目的不是吃飽，是送出「能量很充足、不必分解肌肉」的訊號；
// 訓後女性的恢復窗口比男性短（約 45–60 分鐘），碳水就算在減脂期也不能省。
const POST_PROTEIN_G=35;      // 訓後蛋白目標（g）
const POST_CARB_PER_KG=0.3;   // 訓後碳水目標（g/kg 體重）
function fuelWindow(date){
  if(!isFemale()) return null;
  // created_at 是判斷窗口的依據，但 migration 會把舊資料的時間戳補成當下 → 只採用「日期＝該筆
  // 紀錄日期」的時間戳，時間對不上就當作沒有時間資訊，寧可不提示也不要提示錯的。
  const sameDay=(ts,d)=>{ if(!ts) return false;
    const t=new Date(ts); if(isNaN(t)) return false;
    return new Date(t.getTime()+8*3600000).toISOString().slice(0,10)===d; };
  const hard=store.exercises.filter(e=>e.date.slice(0,10)===date &&
    (e.kind==="strength"||HIIT_NAMES.includes(e.name)||["重訓(一般)","重訓(高強度)","徒手健身"].includes(e.name)) &&
    sameDay(e.created_at,date));
  if(!hard.length) return null;
  const exT=Math.min(...hard.map(e=>new Date(e.created_at).getTime()));
  const meals=(store.meals||[]).filter(m=>m.date.slice(0,10)===date && sameDay(m.created_at,date))
                         .map(m=>({...m, t:new Date(m.created_at).getTime()}));
  const pre=meals.filter(m=>m.t<=exT && m.t>=exT-90*60000);       // 訓前 0–90 分鐘
  const post=meals.filter(m=>m.t>exT && m.t<=exT+60*60000);       // 訓後 60 分鐘內
  const sum=(a,k)=>Math.round(a.reduce((s,m)=>s+(+m[k]||0),0));
  const w=+val("weight")|| (store.records.length? +store.records[store.records.length-1].weight||0 : 0);
  const carbTarget=Math.round(w*POST_CARB_PER_KG*10)/10;
  return {exT, preOk:pre.length>0, postP:sum(post,"protein"), postC:sum(post,"carb"),
          carbTarget, w, minsSince:Math.round((Date.now()-exT)/60000)};
}
function renderFuel(date){
  const box=document.getElementById("fuelBox"); if(!box) return;
  const F=fuelWindow(date);
  if(!F){ box.innerHTML=""; return; }
  const hhmm=new Date(F.exT).toLocaleTimeString("zh-TW",{hour:"2-digit",minute:"2-digit",hour12:false});
  const row=(ok,txt)=>`<div style="font-size:12px;line-height:1.6;color:${ok?"var(--green)":"var(--warm)"};">${ok?"✅":"⚠️"} ${txt}</div>`;
  const pOk=F.postP>=POST_PROTEIN_G, cOk=F.carbTarget?F.postC>=F.carbTarget:true;
  box.innerHTML=
    `<div class="result" style="margin-top:10px;">`+
      `<div class="lbl">訓練前後營養窗口（${hhmm} 那場訓練）</div>`+
      row(F.preOk,F.preOk?"訓前 90 分鐘內有進食，能量訊號充足。"
        :"訓前 30–90 分鐘沒有進食紀錄。下次訓練前吃一點蛋白質＋碳水（例如一根香蕉配乳清或希臘優格），是告訴身體「能量充足、不必分解肌肉」的訊號。")+
      row(pOk,`訓後 60 分鐘內蛋白 <b>${F.postP}g</b> / ${POST_PROTEIN_G}g${pOk?"":`　還差 ${POST_PROTEIN_G-F.postP}g`}`)+
      (F.carbTarget?row(cOk,`訓後 60 分鐘內碳水 <b>${F.postC}g</b> / ${F.carbTarget}g（${F.w}kg × ${POST_CARB_PER_KG}）${cOk?"":`　還差 ${Math.round((F.carbTarget-F.postC)*10)/10}g`}`):"")+
      `<div class="hint" style="margin-top:6px;">女性的恢復窗口比男性短，訓後 45–60 分鐘內要補到。碳水就算在減脂期也不能省，是用來補回肌肝醣的。`+
        `建議用<b>有適當調味的正餐</b>而不是完全沒加鹽的水煮餐，順便補回流汗流失的電解質。</div>`+
    `</div>`;
}
// 每餐蛋白分佈：總量達標但全部集中在晚餐，肌肉合成效率會差很多
function renderProteinSplit(date){
  const box=document.getElementById("pSplit"); if(!box) return;
  if(!isFemale()){ box.innerHTML=""; return; }
  const t=goalTargets(); if(!t){ box.innerHTML=""; return; }
  const ORDER=["早餐","午餐","晚餐","點心"];
  const meals=(store.meals||[]).filter(m=>m.date.slice(0,10)===date);
  if(!meals.length){ box.innerHTML=""; return; }
  const by={};
  meals.forEach(m=>{ const k=m.meal||"點心"; by[k]=(by[k]||0)+(+m.protein||0); });
  const keys=ORDER.filter(k=>by[k]!=null).concat(Object.keys(by).filter(k=>!ORDER.includes(k)));
  const tot=Math.round(keys.reduce((s,k)=>s+by[k],0));
  const cells=keys.map(k=>{
    const g=Math.round(by[k]);
    return `<span style="font-size:12px;padding:4px 10px;border-radius:999px;border:1px solid var(--line);background:var(--soft);">`+
           `${k} <b>${g}g</b><span style="color:var(--sub);"> ${tot?Math.round(g/tot*100):0}%</span></span>`;
  }).join("");
  const missing=ORDER.slice(0,3).filter(k=>!by[k]||by[k]<10);
  box.innerHTML=
    `<div style="margin-top:10px;">`+
      `<div style="font-size:12px;color:var(--sub);margin-bottom:6px;">每餐蛋白分佈（今日合計 ${tot}g / 目標 ${t.protein}g）</div>`+
      `<div style="display:flex;flex-wrap:wrap;gap:6px;">${cells}</div>`+
      `<div class="hint" style="margin-top:8px;">每一餐都要有蛋白質，其中<b>早餐與訓練後的比例要最高</b>。`+
        (missing.length?`<span style="color:var(--warm)"><br>${missing.join("、")}的蛋白質偏少，補一份會比全部集中在同一餐更有效。</span>`:"")+
      `</div>`+
    `</div>`;
}

/* ---------- 飲水 ---------- */
function waterFor(date){ const r=store.records.find(x=>x.date.slice(0,10)===date); return r&&r.water_ml?+r.water_ml:0; }
async function addWater(amt,reset){
  const date=selDate(), cur=waterFor(date);
  const nv=reset?0:Math.max(0,cur+amt);
  try{ await api("/api/water",{method:"POST",body:JSON.stringify({date,water_ml:nv})}); await reload(); }
  catch(e){ alert(e.message); }
}
async function addWaterCustom(){
  const el=document.getElementById("waterCustom"), amt=parseInt(el.value,10);
  if(!amt){ alert("請輸入 ml"); return; }
  el.value=""; await addWater(amt);
}
// 直接把今天總量設成輸入值（修正用，例如 350 改成 1180）
async function setWaterCustom(){
  const el=document.getElementById("waterCustom"), v=parseInt(el.value,10);
  if(isNaN(v)||v<0){ alert("請輸入 ml（0 以上）"); return; }
  const date=selDate(); el.value="";
  try{ await api("/api/water",{method:"POST",body:JSON.stringify({date,water_ml:v})}); await reload(); }
  catch(e){ alert(e.message); }
}
// 某日的有效體重：用「當天或之前最近一次」的體重紀錄(每日量測的真實體重)；還沒有紀錄才退回個人資料體重/60。
// → 飲水目標隨實際體重變化：減重(每天記體重)時目標會跟著下降。#weight 是個人資料的固定體重(算TDEE用)，不拿來當每日飲水基準。
function bodyWeightFor(date){
  const recs=(store.records||[]).filter(r=>r.weight!=null);   // store.records 依日期升冪
  if(date){ const le=recs.filter(r=>r.date.slice(0,10)<=date); if(le.length) return +le[le.length-1].weight; }
  if(recs.length) return +recs[recs.length-1].weight;   // 該日之前沒有，就用最新一次量測
  return +val("weight")||60;   // 完全沒有體重紀錄才退回個人資料體重
}
function waterGoalFor(date){ return Math.round(bodyWeightFor(date)*45/50)*50; }
function renderWater(date){
  const cur=waterFor(date), goal=waterGoalFor(date);
  set("waterOut", cur.toLocaleString()+" ml");
  set("waterGoal", `目標約 ${goal.toLocaleString()} ml（當天體重×45）　${cur>=goal?"✅ 已達標":"還差 "+(goal-cur).toLocaleString()+" ml"}`);
  document.getElementById("waterBar").style.width=Math.min(100,goal?cur/goal*100:0)+"%";
}
function poopFor(date){ const r=store.records.find(x=>x.date.slice(0,10)===date); return r&&r.poop?+r.poop:0; }
async function addPoop(amt,reset){
  const date=selDate(), cur=poopFor(date);
  const nv=reset?0:Math.max(0,Math.min(20,cur+amt));
  try{ await api("/api/poop",{method:"POST",body:JSON.stringify({date,poop:nv})}); await reload(); }
  catch(e){ alert(e.message); }
}
function renderPoop(date){
  const cur=poopFor(date);
  const o=document.getElementById("poopOut"); if(o) o.textContent=cur+" 次";
  const g=document.getElementById("poopGoal"); if(g) g.textContent=cur>0?(date===todayStr()?"今天順暢 👍":"這天 "+cur+" 次"):"記錄每天排便次數，可開「💩 嗯嗯比賽」跟朋友比規律。";
  const today=poopFor(todayStr()); const pill=document.getElementById("poopPill"); if(pill) pill.textContent=today>0?"今日 "+today+" 次":"";
}

function renderDay(){
  const d=selDate();
  set("dayLabel", d.slice(5));
  renderNet(); renderRings(d); renderProteinSplit(d); renderFuel(d); renderMeals(d); renderWater(d); renderPoop(d);
}

/* ---------- 食譜 ---------- */
function cartTotal(){ return foodCart.reduce((a,b)=>{const m=cartMacros(b);return {k:a.k+m.k,p:a.p+m.p,f:a.f+m.f,c:a.c+m.c};},{k:0,p:0,f:0,c:0}); }
async function saveRecipe(){
  if(!foodCart.length){ alert("清單是空的"); return; }
  const name=prompt("食譜名稱（例如：我的早餐）");
  if(!name||!name.trim()) return;
  const servText=prompt("這份食譜（這鍋／整份）總共是幾人份？\n之後套用時可選「1份」或「整鍋」。\n吃 1 份就直接按確定。","1");
  if(servText===null) return;
  const servings=Math.max(1,Math.min(50,parseInt(servText)||1));
  const t=cartTotal();
  const nm=name.trim();
  try{
    await api("/api/recipe",{method:"POST",body:JSON.stringify({
      name:nm, items:foodCart, servings,
      kcal:Math.round(t.k), protein:+t.p.toFixed(1), fat:+t.f.toFixed(1), carb:+t.c.toFixed(1)
    })});
    // 整份食譜也上架共享食物庫，預設一份＝整份÷人份（搜尋帶入時就是 1 人份）
    const totalG=foodCart.reduce((a,it)=>a+(+it.g||0),0)||100;
    const per100=[t.k*100/totalG, t.p*100/totalG, t.f*100/totalG, t.c*100/totalG];
    const oneServG=Math.round(totalG/servings);
    shareFood("🍱 "+nm, per100, oneServG, "recipe");
    FOODS_DYN["🍱 "+nm]=per100; SERVINGS["🍱 "+nm]=oneServG;
    await reload();
    alert("已存成食譜「"+nm+"」"+(servings>1?`（${servings} 人份，搜尋／套用預設為 1 份）`:"")+"，並上架共享食物庫（可搜尋「🍱 "+nm+"」）");
  }catch(e){ alert(e.message); }
}
function renderRecipes(){
  const list=store.recipes||[];
  set("recipeCount", list.length?list.length+" 份":"");
  const box=document.getElementById("recipeList");
  if(!list.length){ box.innerHTML='<div class="empty">還沒有食譜。在上方食物計算機組好餐點後按「存成食譜」。</div>'; return; }
  box.innerHTML=list.map(r=>{
    const items=(r.items||[]).map(it=>it.n+(it.g?` ${it.g}g`:"")).join("、");
    const sv=r.servings||1, perK=Math.round((r.kcal||0)/sv);
    const kc=sv>1?`每份 ${perK}<br><span style="font-size:10px;color:var(--sub)">全 ${r.kcal||0} · ${sv}人份</span>`:`${r.kcal||0} kcal`;
    const applyBtns=sv>1
      ? `<span class="x" style="color:var(--accent)" onclick="applyRecipe(${r.id})">套用1份</span><span class="x" style="color:var(--sub)" onclick="applyRecipe(${r.id},true)">整鍋</span>`
      : `<span class="x" style="color:var(--accent)" onclick="applyRecipe(${r.id})">套用</span>`;
    return `<div class="foodrow"><span class="nm"><b>${r.name}</b><br><span style="color:var(--sub);font-size:12px">${items}</span></span>`+
      `<span class="kc" style="text-align:right">${kc}</span>`+applyBtns+
      `<span class="x" onclick="delRecipe(${r.id})">✕</span></div>`;
  }).join("");
}
function applyRecipe(id, whole){
  const r=(store.recipes||[]).find(x=>x.id===id); if(!r) return;
  const sv=whole?1:(r.servings||1);   // 預設套用 1 份(整份÷人份)；whole=true 載入整鍋
  foodCart=(r.items||[]).map(it=>{
    const fullG=it.g||100, g=Math.round(fullG/sv*10)/10;
    let base=it.base;
    if(!base) base=(it.k!=null)?[it.k/fullG*100,(it.p||0)/fullG*100,(it.f||0)/fullG*100,(it.c||0)/fullG*100]:(foodData(it.n)||[0,0,0,0]);
    return {n:it.n, g, base:base.map(Number)};
  });
  renderFood();
  document.getElementById("foodTotal").scrollIntoView({behavior:"smooth"});
}
async function delRecipe(id){
  if(!confirm("刪除這份食譜？")) return;
  await api("/api/recipe/"+id,{method:"DELETE"}); await reload();
}

/* ---------- 我的餐盤（拍照存的快速餐點） ---------- */
// 把目前的餐點照片縮成小縮圖（控制存量）
function plateThumb(){
  return new Promise((res)=>{
    if(!mealPhoto){ res(""); return; }
    const img=new Image(); img.onload=()=>{ const s=90, cv=document.createElement("canvas"); cv.width=s; cv.height=s;
      const ctx=cv.getContext("2d"), m=Math.min(img.width,img.height), sx=(img.width-m)/2, sy=(img.height-m)/2;
      ctx.drawImage(img,sx,sy,m,m,0,0,s,s); res(cv.toDataURL("image/jpeg",0.6)); };
    img.onerror=()=>res(""); img.src=mealPhoto;
  });
}
async function savePlate(){
  if(!foodCart.length){ alert("清單是空的，先加入食物"); return; }
  const name=prompt("餐盤名稱（例如：早餐燕麦蛋）"); if(!name||!name.trim()) return;
  const t=cartTotal(); const thumb=await plateThumb();
  try{
    await api("/api/plate",{method:"POST",body:JSON.stringify({name:name.trim(),items:foodCart,kcal:Math.round(t.k),thumb})});
    await reload();
    alert("已存成餐盤「"+name.trim()+"」"+(thumb?"（含照片）":"")+"，下次可一鍵帶入。");
  }catch(e){ alert(e.message); }
}
let _thumbLoading=new Set();
async function ensurePlateThumbs(ids){
  const need=ids.filter(id=>!_thumbLoading.has(id)); if(!need.length) return;
  need.forEach(id=>_thumbLoading.add(id));
  try{
    const r=await api("/api/plate/thumbs",{method:"POST",body:JSON.stringify({ids:need})});
    (r.thumbs||[]).forEach(t=>{ const p=(store.plates||[]).find(x=>x.id===t.id); if(p) p.thumb=t.thumb; });
    renderPlates();
  }catch(e){}
  finally{ need.forEach(id=>_thumbLoading.delete(id)); }
}
function renderPlates(){
  const list=store.plates||[];
  set("plateCount", list.length?list.length+" 個":"");
  const box=document.getElementById("plateList"); if(!box) return;
  if(!list.length){ box.innerHTML='<div class="empty">還沒有餐盤。組好常吃的一餐（可先拍照）後按「存成我的餐盤」，下次一鍵帶入。</div>'; return; }
  const missing=list.filter(p=>p.has_thumb&&!p.thumb).map(p=>p.id);
  if(missing.length) ensurePlateThumbs(missing);
  box.innerHTML=`<div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;">`+list.map(p=>{
    const items=(p.items||[]).map(it=>it.n).slice(0,4).join("、");
    const img=p.thumb?`<img src="${p.thumb}" style="width:84px;height:84px;border-radius:10px;object-fit:cover;">`
      :`<div style="width:84px;height:84px;border-radius:10px;background:var(--soft);display:flex;align-items:center;justify-content:center;font-size:30px;">🍽️</div>`;
    return `<div style="flex:0 0 auto;width:84px;text-align:center;position:relative;">`+
      `<div onclick="applyPlate(${p.id})" style="cursor:pointer;">${img}`+
      `<div style="font-size:11px;font-weight:600;margin-top:2px;line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(p.name)}</div>`+
      `<div style="font-size:10px;color:var(--sub)">${p.kcal||0} kcal</div></div>`+
      `<span class="x" style="position:absolute;top:-4px;right:-2px;background:#fff;border-radius:50%;" onclick="delPlate(${p.id})">✕</span>`+
      `<div class="hint" style="font-size:9px;white-space:normal;">${escapeHtml(items)}</div></div>`;
  }).join("")+`</div>`;
}
function applyPlate(id){
  const p=(store.plates||[]).find(x=>x.id===id); if(!p) return;
  foodCart=(p.items||[]).map(it=>{
    const g=it.g||100; let base=it.base;
    if(!base) base=(it.k!=null)?[it.k/g*100,(it.p||0)/g*100,(it.f||0)/g*100,(it.c||0)/g*100]:(foodData(it.n)||[0,0,0,0]);
    return {n:it.n, g, base:base.map(Number)};
  });
  renderFood();
  document.getElementById("foodTotal").scrollIntoView({behavior:"smooth"});
}
async function delPlate(id){
  if(!confirm("刪除這個餐盤？")) return;
  try{ await api("/api/plate/"+id,{method:"DELETE"}); await reload(); }catch(e){ alert(e.message); }
}

/* ---------- 運動 ---------- */
function fillExList(){}  // 改用自訂下拉
function exSuggest(){
  const q=val("exPick").trim(), box=document.getElementById("exSuggest");
  if(!q){ box.style.display="none"; box.innerHTML=""; return; }
  const ql=q.toLowerCase();
  let res=Object.keys(EXS).filter(n=>n.toLowerCase().includes(ql)).slice(0,30); window.__es=res;
  if(!res.length){ box.innerHTML='<div class="sg" style="color:var(--sub)">查無此運動</div>'; box.style.display="block"; return; }
  box.innerHTML=res.map((n,i)=>`<div class="sg" onclick="pickEx(${i})">${n}</div>`).join("");
  box.style.display="block";
}
function pickEx(i){
  const n=window.__es[i]; if(n==null) return;
  document.getElementById("exPick").value=n;
  document.getElementById("exSuggest").style.display="none";
  exPreview(); document.getElementById("exMin").focus();
}
function exPreview(){
  const n=val("exPick"), m=+val("exMin"), w=+val("weight")||60;
  if(!EXS[n]||!m){ set("exPreview",""); return; }
  set("exPreview", `${m} 分鐘 ≈ 消耗 ${Math.round(exKcalPerMin(EXS[n],w)*m)} kcal`);
}
async function addExercise(){
  const n=val("exPick"), m=+val("exMin"), w=+val("weight")||60;
  const date=val("exDate")||todayStr();
  if(!EXS[n]){ alert("請從清單選運動項目"); return; }
  if(!m){ alert("請輸入運動時間"); return; }
  const kcal=Math.round(exKcalPerMin(EXS[n],w)*m);
  try{
    await api("/api/exercise",{method:"POST",body:JSON.stringify({date,name:n,minutes:m,kcal})});
    document.getElementById("exPick").value=""; document.getElementById("exMin").value=""; set("exPreview","");
    await reload();
  }catch(e){ alert(e.message); }
}
async function delExercise(id){
  if(!confirm("刪除這筆運動？")) return;
  await api("/api/exercise/"+id,{method:"DELETE"}); await reload();
}
async function delGroupEx(idsStr){
  const ids=String(idsStr).split(",").filter(Boolean);
  if(!ids.length) return;
  if(!confirm(`刪除這天這個動作的 ${ids.length} 組紀錄？`)) return;
  for(const id of ids){ await api("/api/exercise/"+id,{method:"DELETE"}); }
  await reload();
}
function isoLocal(d){ const o=d.getTimezoneOffset(); return new Date(d-o*60000).toISOString().slice(0,10); }
// 部位平衡（近30天，依組數佔比）
function renderBalance(){
  const box=document.getElementById("stBalance"); if(!box) return;
  const since=isoLocal(new Date(new Date(todayStr())-29*86400000));
  const st=(store.exercises||[]).filter(e=>e.kind==="strength"&&e.date.slice(0,10)>=since);
  if(!st.length){ box.innerHTML=""; return; }
  const by={}; let total=0;
  st.forEach(e=>{ const mu=e.muscle||MUSCLE[e.name]||"其他"; const sets=+e.sets||0; by[mu]=(by[mu]||0)+sets; total+=sets; });
  if(!total){ box.innerHTML=""; return; }
  const colors={"胸":"#c0586f","背":"#5b8aa6","腿":"#7c9070","肩":"#c98b5e","手臂":"#9b7cb6","二頭":"#9b7cb6","三頭":"#7b6cae","前臂":"#b0a4d6","小腿":"#9aac84","臀":"#d39bb0","核心":"#8a9a5b","其他":"#aaa"};
  const order=Object.entries(by).sort((a,b)=>b[1]-a[1]);
  const inner=`<div style="display:flex;height:14px;border-radius:7px;overflow:hidden;">`+
    order.map(([m,v])=>`<i title="${m} ${v}組" style="width:${v/total*100}%;background:${colors[m]||"#aaa"}"></i>`).join("")+`</div>`+
    `<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:6px;font-size:12px;color:var(--sub)">`+
    order.map(([m,v])=>`<span><i style="display:inline-block;width:9px;height:9px;border-radius:2px;background:${colors[m]||"#aaa"};margin-right:3px"></i>${m} ${Math.round(v/total*100)}%</span>`).join("")+`</div>`;
  box.innerHTML=collapsible("🧩 部位平衡（近30天）", inner, "balance");
}
// 近7天訓練量趨勢
function renderVolTrend(){
  const box=document.getElementById("stTrend"); if(!box) return;
  const st=(store.exercises||[]).filter(e=>e.kind==="strength");
  if(!st.length){ box.innerHTML=""; return; }
  const today=new Date(todayStr()), days=[];
  for(let i=6;i>=0;i--){ const d=new Date(today); d.setDate(d.getDate()-i); const ds=isoLocal(d);
    days.push({ds, vol:st.filter(e=>e.date.slice(0,10)===ds).reduce((a,b)=>a+(+b.volume||0),0)}); }
  const max=Math.max(1,...days.map(d=>d.vol));
  const inner=`<div style="display:flex;align-items:flex-end;gap:4px;height:60px;">`+
    days.map(d=>`<div style="flex:1;text-align:center;"><div style="background:var(--accent);border-radius:3px 3px 0 0;height:${Math.round(d.vol/max*50)}px;min-height:2px"></div><div style="font-size:9px;color:var(--sub)">${d.ds.slice(5)}</div></div>`).join("")+
    `</div><div class="hint">7天總量 ${Math.round(days.reduce((a,b)=>a+b.vol,0)).toLocaleString()} kg</div>`;
  box.innerHTML=collapsible("📊 近7天訓練量", inner, "trend");
}
/* ---------- 重訓 ---------- */
// 各部位 → 該部位動作（含自由重量＋機械）。順序＝部位分組，方便閱讀
const STRENGTH_BY_MUSCLE={
  "胸":["臥推","上斜臥推","下斜臥推","啞鈴臥推","上斜啞鈴臥推","胸推機","蝴蝶機夾胸","滑輪夾胸","雙槓撐體","伏地挺身"],
  "背":["硬舉","引體向上","滑輪下拉","槓鈴划船","啞鈴單臂划船","坐姿划船","T槓划船","直臂下壓","反式划船","山羊挺身"],
  "腿":["深蹲","前蹲舉","哈克深蹲","史密斯深蹲","腿推","腿伸屈","腿後勾","羅馬尼亞硬舉","保加利亞分腿蹲","弓步蹲","腿外展機","腿內收機"],
  "臀":["臀推","髖外展機","臀橋","驢踢","早安運動"],
  "肩":["肩推","啞鈴肩推","阿諾肩推","史密斯肩推","側平舉","前平舉","反向飛鳥","面拉","直立划船","聳肩"],
  "二頭":["二頭彎舉","啞鈴彎舉","錘式彎舉","槓鈴彎舉","牧師椅彎舉","滑輪彎舉"],
  "三頭":["三頭下壓","過頭三頭伸展","窄距臥推","三頭撐體","仰臥臂屈伸"],
  "前臂":["腕彎舉","反向腕彎舉"],
  "小腿":["站姿提踵","坐姿提踵","小腿推舉"],
  "核心":["核心捲腹","棒式","懸吊抬腿","俄羅斯轉體","滑輪捲腹"],
};
const STRENGTH=[], MUSCLE={};
for(const mu in STRENGTH_BY_MUSCLE){ for(const n of STRENGTH_BY_MUSCLE[mu]){ STRENGTH.push(n); MUSCLE[n]=mu; } }
function stSuggest(){
  const q=val("stPick").trim(), box=document.getElementById("stSuggest");
  if(!q){ box.style.display="none"; box.innerHTML=""; return; }
  const res=STRENGTH.filter(n=>n.includes(q)).slice(0,20); window.__st=res;
  if(!res.length){ box.style.display="none"; return; }   // 允許自訂動作，不擋
  box.innerHTML=res.map((n,i)=>`<div class="sg" onclick="pickSt(${i})">${n}</div>`).join("");
  box.style.display="block";
}
function pickSt(i){ const n=window.__st[i]; if(n==null) return; document.getElementById("stPick").value=n; document.getElementById("stSuggest").style.display="none"; if(MUSCLE[n]) document.getElementById("stMuscle").value=MUSCLE[n]; document.getElementById("stW").focus(); }
// 每組約 2.5 分鐘（含組間休息）。
// MET 取 3.0：Compendium 對一般阻力訓練給 3.5（EXS 表裡的「重訓(一般)」也是 3.5），
// 但 MET 是「總消耗」而非「淨增加」——其中約 1 MET 是靜息，而 TDEE 已經算過那段時間了，
// 運動熱量又是另外加上去，所以會重複計算。這裡刻意取比 3.5 保守一點的 3.0。
// 原本的 2.0 則太低（約等於站著不動），會嚴重低估重訓，連帶把反推 TDEE 和 EA 都算歪。
const ST_MET=3.0;
function stEstKcal(sets){ const w=+val("weight")||60; return Math.round(exKcalPerMin(ST_MET,w)*(sets*2.5)); }
function stPreview(){
  const w=+val("stW"),r=+val("stR"),s=+val("stS");
  if(!w||!r||!s){ set("stPreview",""); return; }
  set("stPreview", `訓練量 ${ (s*r*w).toLocaleString() } kg（${s}組×${r}次×${w}kg）· 估耗 ${stEstKcal(s)} kcal`);
}
async function addStrength(){
  const n=val("stPick").trim(), w=+val("stW"), r=+val("stR"), s=+val("stS");
  const date=val("exDate")||todayStr();
  if(!n){ alert("請輸入或選擇重訓動作"); return; }
  if(!w||!r||!s){ alert("請填重量、次數、組數"); return; }
  const volume=s*r*w, kcal=stEstKcal(s), minutes=Math.round(s*2.5);
  const muscle=val("stMuscle")||MUSCLE[n]||"其他";
  try{
    await api("/api/exercise",{method:"POST",body:JSON.stringify({date,name:n,minutes,kcal,kind:"strength",sets:s,reps:r,weight:w,volume,muscle})});
    document.getElementById("stPick").value=""; document.getElementById("stW").value=""; document.getElementById("stR").value=""; document.getElementById("stS").value=""; set("stPreview","");
    await reload();
  }catch(e){ alert(e.message); }
}
// 收放區塊小工具（key 提供時會記住展開/收合）
function collapsible(title, inner, key){
  const open = (key && (key in CARD_STATE)) ? !CARD_STATE[key] : false;
  const attr = key ? ` data-dk="${key}" ontoggle="saveDetail(this)"` : "";
  return `<details${open?" open":""}${attr} style="border:1px solid var(--line);border-radius:10px;margin-top:8px;padding:2px 10px;">`+
    `<summary style="cursor:pointer;padding:8px 0;font-size:14px;font-weight:500;">${title}</summary><div style="padding-bottom:8px;">${inner}</div></details>`;
}
function saveDetail(d){ const k=d.getAttribute("data-dk"); if(!k) return; CARD_STATE[k]=!d.open; try{ localStorage.setItem("tdee_cardstate",JSON.stringify(CARD_STATE)); }catch(e){} }
// 每個動作的最佳重量 / 最近一次（PR 進度）
function renderPR(){
  const box=document.getElementById("stPR"); if(!box) return;
  const st=(store.exercises||[]).filter(e=>e.kind==="strength"&&e.weight>0);
  if(!st.length){ box.innerHTML=""; return; }
  const by={};
  st.forEach(e=>{ const a=by[e.name]||(by[e.name]={best:0,bestReps:0,last:null,lastDate:""});
    if(+e.weight>a.best){ a.best=+e.weight; a.bestReps=+e.reps||0; }
    if(e.date>=a.lastDate){ a.lastDate=e.date; a.last=e; } });
  const rows=Object.entries(by).sort((x,y)=>y[1].best-x[1].best).slice(0,12).map(([n,a])=>
    `<div class="rec-line"><span>${n}</span><span><b>最佳 ${a.best}kg</b>×${a.bestReps}　<span style="color:var(--sub);font-size:12px">上次 ${a.last.weight}kg×${a.last.reps}×${a.last.sets}組</span></span></div>`).join("");
  box.innerHTML=collapsible("💪 各動作進度（PR）", rows, "pr");
}
let editingEx=null;  // 正在編輯的紀錄 id
function exRowHtml(e){
  const isS=e.kind==="strength";
  if(editingEx===e.id){
    // 編輯表單
    if(isS){
      return `<div class="foodrow" style="flex-wrap:wrap;gap:6px;background:var(--soft);border-radius:8px;padding:8px;">`+
        `<span class="nm" style="flex:1 1 100%;font-weight:500;">✏️ ${e.name}</span>`+
        `<input id="edW" type="number" value="${e.weight||0}" style="width:60px;padding:5px" placeholder="kg"><span style="font-size:12px;color:var(--sub)">kg</span>`+
        `<input id="edR" type="number" value="${e.reps||0}" style="width:50px;padding:5px" placeholder="次"><span style="font-size:12px;color:var(--sub)">次</span>`+
        `<input id="edS" type="number" value="${e.sets||0}" style="width:50px;padding:5px" placeholder="組"><span style="font-size:12px;color:var(--sub)">組</span>`+
        `<button class="ghost sm" onclick="saveExEdit(${e.id},true)">儲存</button><button class="ghost sm" onclick="cancelExEdit()">取消</button></div>`;
    }
    return `<div class="foodrow" style="flex-wrap:wrap;gap:6px;background:var(--soft);border-radius:8px;padding:8px;">`+
      `<span class="nm" style="flex:1 1 100%;font-weight:500;">✏️ ${e.name}</span>`+
      `<input id="edM" type="number" value="${e.minutes||0}" style="width:60px;padding:5px"><span style="font-size:12px;color:var(--sub)">分</span>`+
      `<input id="edK" type="number" value="${e.kcal||0}" style="width:70px;padding:5px"><span style="font-size:12px;color:var(--sub)">kcal</span>`+
      `<button class="ghost sm" onclick="saveExEdit(${e.id},false)">儲存</button><button class="ghost sm" onclick="cancelExEdit()">取消</button></div>`;
  }
  const detail=isS
    ? `<span style="color:var(--sub)">${e.weight}kg × ${e.reps}次 × ${e.sets}組 · ${Math.round(+e.volume||0).toLocaleString()}kg</span>`
    : `<span style="color:var(--sub)">${e.minutes||"—"} 分</span>`;
  return `<div class="foodrow"><span class="nm">${isS?"💪":"🏃"} ${e.name}<br>${detail}</span>`+
    `<span class="kc">${Math.round(+e.kcal||0)} kcal</span>`+
    `<span class="x" style="color:var(--accent)" onclick="editExercise(${e.id})">✏️</span>`+
    `<span class="x" onclick="delExercise(${e.id})">✕</span></div>`;
}
function renderExercises(){
  const box=document.getElementById("exItems");
  if(!store.exercises.length){ box.innerHTML='<div class="empty">還沒有運動紀錄。</div>'; return; }
  // 依日期分組（每筆獨立、可編輯）
  const byDate={}, dorder=[];
  store.exercises.forEach(e=>{ const d=e.date.slice(0,10); if(!byDate[d]){ byDate[d]=[]; dorder.push(d); } byDate[d].push(e); });
  box.innerHTML=dorder.slice(0,30).map((d,i)=>{
    const list=byDate[d];
    const kcal=list.reduce((a,e)=>a+(+e.kcal||0),0);
    const vol=list.filter(e=>e.kind==="strength").reduce((a,e)=>a+(+e.volume||0),0);
    return `<details style="border:1px solid var(--line);border-radius:10px;margin-bottom:8px;padding:2px 10px;">`+
      `<summary style="cursor:pointer;padding:8px 0;font-weight:500;">${d} <span style="float:right;color:var(--sub);font-weight:400;font-size:12px">${Math.round(kcal)} kcal${vol?` · 💪${Math.round(vol).toLocaleString()}kg`:""}</span></summary>`+
      list.map(exRowHtml).join("")+`</details>`;
  }).join("");
}
function editExercise(id){ editingEx=id; renderExercises(); }
function cancelExEdit(){ editingEx=null; renderExercises(); }
async function saveExEdit(id,isStrength){
  let body;
  if(isStrength){
    const w=+val("edW"), r=+val("edR"), s=+val("edS");
    if(!w||!r||!s){ alert("請填重量/次數/組數"); return; }
    const volume=s*r*w, kcal=stEstKcal(s);
    body={weight:w,reps:r,sets:s,volume,kcal,minutes:Math.round(s*2.5)};
  }else{
    const m=+val("edM"), k=+val("edK");
    body={minutes:m||0,kcal:k||0};
  }
  try{ await api("/api/exercise/"+id,{method:"PUT",body:JSON.stringify(body)}); editingEx=null; await reload(); }
  catch(e){ alert(e.message); }
}
// 女性極化訓練建議：兩端（高強度重訓／間歇 ＋ 低強度活動）取代中間的「長時間中等強度有氧」。
// 中等強度有氧對女性主要貢獻的是疲勞與發炎累積，強度又不足以刺激肌肉與骨骼生長；
// 訓練的目的是「刺激」不是「消耗」，所以這裡追蹤的是重訓與間歇的次數，而非有氧總分鐘數。
const HIIT_NAMES=["HIIT","跳繩","飛輪","拳擊有氧"];
const EASY_NAMES=["走路(慢)","走路(快)","健走","瑜珈","伸展操","皮拉提斯"];
function renderExRecF(){
  const goal=val("goal")||"maintain";
  const plans={
    cut:{strength:3,hiit:2,easyMin:150,note:"減脂期：重訓保留（甚至增加）肌肉，間歇拉最大攝氧量，其餘時間用散步等低強度活動累積活動量。"},
    maintain:{strength:3,hiit:1,easyMin:150,note:"維持期：把重訓當保養，強度要夠；低強度活動維持日常代謝。"},
    bulk:{strength:4,hiit:1,easyMin:90,note:"增肌期：重訓為主，間歇維持心肺即可，別讓有氧吃掉恢復資源。"}
  };
  const p=plans[goal]||plans.maintain;
  const now=new Date(), wk=new Date(now-6*86400000).toISOString().slice(0,10);
  const week=store.exercises.filter(e=>e.date>=wk);
  const strongNames=["重訓(一般)","重訓(高強度)","徒手健身"];
  const strengthDays=new Set(week.filter(e=>e.kind==="strength"||strongNames.includes(e.name)).map(e=>e.date.slice(0,10)));
  const hiitDays=new Set(week.filter(e=>HIIT_NAMES.includes(e.name)).map(e=>e.date.slice(0,10)));
  const doneS=strengthDays.size, doneH=hiitDays.size;
  const easyMin=week.filter(e=>EASY_NAMES.includes(e.name)).reduce((a,b)=>a+(+b.minutes||0),0);
  const bar=(v,t)=>`<div class="prog"><i style="width:${Math.min(100,Math.round(v/t*100))}%"></i></div>`;
  // 間歇是「加分項」而非硬指標：多數使用者根本沒在做，把它算進達標會讓進度條永遠難看，
  // 反而讓真正做到的重訓與低強度活動失去回饋。達標只看重訓＋低強度活動。
  const hit=doneS>=p.strength&&easyMin>=p.easyMin;
  const ex28=store.exercises.filter(e=>e.date>=new Date(Date.now()-28*86400000).toISOString().slice(0,10));
  const hiitEver=ex28.some(e=>HIIT_NAMES.includes(e.name));
  const hiitLine = hiitEver
    ? `<div class="rec-line" style="margin-top:10px;"><span>每週高強度間歇 <span style="color:var(--sub);font-weight:400;">(加分)</span></span><span><b>${doneH}</b> / ${p.hiit} 次</span></div>`+bar(doneH,p.hiit)
    : `<div class="hint" style="margin-top:10px;padding:8px 10px;background:var(--soft);border-radius:10px;">`+
      `💡 <b>還沒試過高強度間歇</b>：每週 1–2 次、每次 10–15 分鐘就有效，是提高最大攝氧量效率最高的方式。`+
      `App 裡的 HIIT、跳繩、飛輪、拳擊有氧都算。先從一次開始就好。</div>`;
  // 後側鏈：已經在練的人不需要被從頭教一次，該給的是進階方向
  const POSTERIOR=["臀推","臀橋","硬舉","腿後勾","早安","登階","分腿蹲","背伸展"];
  const doesPosterior=ex28.some(e=>e.kind==="strength"&&POSTERIOR.some(k=>String(e.name).includes(k)));
  const posteriorLine = doesPosterior
    ? `你的課表裡已經有<b>後側鏈</b>動作，這點做得很好——女性骨盆較寬、Q-angle 較大，容易變成股四頭主導，後側練得夠能降低膝關節與前十字韌帶的風險。`+
      `接下來可以往<b>單邊動作</b>（單腳羅馬尼亞硬舉、保加利亞分腿蹲）和漸進加重發展。`
    : `請把<b>後側鏈</b>（硬舉、臀推、單腳羅馬尼亞硬舉、腿後勾）加進課表——女性骨盆較寬、Q-angle 較大，`+
      `容易變成股四頭主導，平衡後側能降低膝關節與前十字韌帶的受傷風險。`;
  document.getElementById("exRec").innerHTML=
    `<div class="rec-line"><span>每週重訓次數</span><span><b>${doneS}</b> / ${p.strength} 次</span></div>`+bar(doneS,p.strength)+
    `<div class="rec-line" style="margin-top:10px;"><span>每週低強度活動</span><span><b>${easyMin}</b> / ${p.easyMin} 分</span></div>`+bar(easyMin,p.easyMin)+
    hiitLine+
    `<div class="hint" style="margin-top:10px;">${p.note} ${hit?"✅ 本週已達標，做得好！":"加油，距離目標還有一點。"}</div>`+
    `<div class="hint tip" style="margin-top:8px;">重訓請優先選<b>較重的重量、每組 5–8 下</b>（疲勞時做到 12 下也沒關係），保留 1–2 下不做到力竭。`+
      `女性慢縮肌比例較高、恢復較快，<b>組間休息 90 秒–2 分鐘</b>通常就夠，不必比照男生休 2–3 分鐘。`+
      `${posteriorLine}</div>`;
}
function renderExRec(){
  if(isFemale()) return renderExRecF();
  const goal=val("goal")||"maintain";
  const plans={
    cut:{cardioMin:200,strength:3,note:"減脂期：有氧拉高總消耗，重訓保留肌肉。"},
    maintain:{cardioMin:150,strength:2,note:"維持期：符合健康基準活動量即可。"},
    bulk:{cardioMin:90,strength:4,note:"增肌期：重訓為主，有氧維持心肺、別過量。"}
  };
  const p=plans[goal];
  // 本週(近7天)已完成
  const now=new Date(), wk=new Date(now-6*86400000).toISOString().slice(0,10);
  const week=store.exercises.filter(e=>e.date>=wk);
  const doneMin=week.filter(e=>e.kind!=="strength").reduce((a,b)=>a+(+b.minutes||0),0);
  const strongNames=["重訓(一般)","重訓(高強度)","徒手健身","HIIT"];
  const strengthDays=new Set(week.filter(e=>e.kind==="strength"||strongNames.includes(e.name)).map(e=>e.date.slice(0,10)));
  const doneStrength=strengthDays.size;
  const pct=Math.min(100,Math.round(doneMin/p.cardioMin*100));
  const sPct=Math.min(100,Math.round(doneStrength/p.strength*100));
  document.getElementById("exRec").innerHTML=
    `<div class="rec-line"><span>每週有氧時間</span><span><b>${doneMin}</b> / ${p.cardioMin} 分</span></div>`+
    `<div class="prog"><i style="width:${pct}%"></i></div>`+
    `<div class="rec-line" style="margin-top:10px;"><span>每週重訓次數</span><span><b>${doneStrength}</b> / ${p.strength} 次</span></div>`+
    `<div class="prog"><i style="width:${sPct}%"></i></div>`+
    `<div class="hint" style="margin-top:10px;">${p.note} ${doneMin>=p.cardioMin&&doneStrength>=p.strength?"✅ 本週已達標，做得好！":"加油，距離目標還有一點。"}</div>`;
}

/* ---------- 紀錄 ---------- */
// 一天的分界＝凌晨 4 點（台灣時間）；00:00–03:59 仍算前一天，與競賽結算一致（夜貓族友善）
function todayStr(){ return new Date(Date.now()+8*3600000-4*3600000).toISOString().slice(0,10); }
async function addRecord(){
  const date=val("rDate")||todayStr();
  const w=parseFloat(val("rWeight")), wpm=parseFloat(val("rWeightPm")), bf=parseFloat(val("rBodyFat"));
  if(isNaN(w)&&isNaN(wpm)&&isNaN(bf)){ alert("請至少填體重或體脂"); return; }
  try{
    await api("/api/record",{method:"POST",body:JSON.stringify({date,weight:isNaN(w)?null:w,weight_pm:isNaN(wpm)?null:wpm,body_fat:isNaN(bf)?null:bf})});
    ["rWeight","rWeightPm","rBodyFat"].forEach(id=>document.getElementById(id).value="");
    await reload();
  }catch(e){ alert(e.message); }
}
// 每日運動消耗
function burnByDate(date){ return store.exercises.filter(e=>e.date.slice(0,10)===date).reduce((a,b)=>a+(+b.kcal||0),0); }
function renderNet(){
  const box=document.getElementById("netBox");
  const date=selDate();
  const rec=store.records.find(r=>r.date.slice(0,10)===date);
  const intake=rec&&rec.kcal!=null?+rec.kcal:null;
  const burn=burnByDate(date);
  if(intake==null&&burn===0){ box.style.display="none"; return; }
  const net=(intake||0)-burn;
  const base=baseTDEE();
  const target=base.tdee?applyGoal(base.tdee):null;
  // 含運動基準：目標已含運動，拿原始攝取比；不含運動基準：拿淨熱量比
  const cmpVal=base.mode==="base"?net:(intake||0);
  const cmpLbl=base.mode==="base"?"淨熱量":"攝取";
  // 當日實際 EA（女性才顯示）；沒記到攝取就不算，避免用半天的資料嚇人
  const E=(isFemale()&&intake!=null)?energyAvailability(intake,burn):null;
  const eaLine=E?`<div class="hint" style="margin-top:6px;padding-top:6px;border-top:1px solid var(--line);">`+
      `能量可用性 EA <b style="color:${E.level.color}">${E.ea}</b> kcal/kg 瘦體重 ·「${E.level.label}」`+
      (E.level.key==="low"?`<br><span style="color:#b5564e">今天扣掉運動後能量偏低，睡前若還很餓請務必補足，別硬撐。</span>`:"")+
    `</div>`:"";
  box.style.display="block";
  box.innerHTML=`<div class="lbl">${date.slice(5)} 淨熱量（攝取 − 運動消耗）</div>`+
    `<div class="big">${net.toLocaleString()} kcal</div>`+
    `<div class="hint">攝取 ${intake!=null?intake.toLocaleString():"—"} − 運動 ${burn.toLocaleString()}`+
    (target?`<br>對目標（${base.mode==="base"?"不含運動":"含運動"}基準 ${target.toLocaleString()}，比${cmpLbl} ${cmpVal.toLocaleString()}）　${cmpVal<=target?`<span style="color:var(--green)">↓ 還可吃 ${(target-cmpVal).toLocaleString()}</span>`:`<span style="color:var(--warm)">↑ 超出 ${(cmpVal-target).toLocaleString()}</span>`}`:"")+`</div>`+eaLine;
}
async function delRecord(rid){
  if(!confirm("刪除這筆紀錄？")) return;
  await api("/api/record/"+rid,{method:"DELETE"}); await reload();
}

/* ---------- 真實 TDEE ---------- */
// tdee = 含運動的總 TDEE；tdeeBase = 不含運動的基礎 TDEE；avgBurn = 期間平均每日運動消耗
// 視窗取近 28 天（蓋滿一個生理週期，抹平女性週期性水分滯留）；體重先做 EMA 平滑再算趨勢，
// 削掉單日鈉/碳水造成的暴衝暴跌，讓斜率（每週體重變化）更貼近真實脂肪變化。
function calcReal(records, exercises){
  const recs=(records||[]).filter(r=>r.weight!=null).slice(-28);
  const out={tdee:null,tdeeBase:null,avgK:null,avgBurn:0,slopeWk:null,deficit:null,days:recs.length};
  if(recs.length<7) return out;
  const t0=new Date(recs[0].date).getTime();
  const xs=recs.map(r=>(new Date(r.date).getTime()-t0)/86400000);
  // 體重 EMA 平滑（α=0.3）：先把每日水分雜訊壓掉，再對平滑後的曲線做線性回歸取斜率
  const raw=recs.map(r=>+r.weight);
  const ALPHA=0.3; const ys=[]; let e=raw[0];
  for(let i=0;i<raw.length;i++){ e = i===0 ? raw[0] : ALPHA*raw[i]+(1-ALPHA)*e; ys.push(e); }
  const n=xs.length,mx=avg(xs),my=avg(ys);
  let num=0,den=0; for(let i=0;i<n;i++){num+=(xs[i]-mx)*(ys[i]-my);den+=(xs[i]-mx)**2;}
  const slope=den?num/den:0;
  out.slopeWk=slope*7;
  // 期間平均每日運動消耗（用首尾日期跨越的天數當分母）
  const d0=recs[0].date.slice(0,10), d1=recs[recs.length-1].date.slice(0,10);
  const spanDays=Math.max(1,Math.round((new Date(d1)-new Date(d0))/86400000)+1);
  const totalBurn=(exercises||[]).filter(e=>{const d=e.date.slice(0,10); return d>=d0&&d<=d1;}).reduce((a,b)=>a+(+b.kcal||0),0);
  out.avgBurn=Math.round(totalBurn/spanDays);
  const ks=recs.filter(r=>r.kcal!=null).map(r=>+r.kcal);
  if(ks.length<3) return out;
  const avgK=avg(ks),deficit=-slope*7700;
  out.avgK=Math.round(avgK); out.deficit=Math.round(deficit);
  out.tdee=Math.round(avgK+deficit);                 // 含運動：你真正每天總消耗
  out.tdeeBase=Math.round(avgK+deficit-out.avgBurn); // 不含運動：基礎(NEAT+BMR)
  return out;
}

/* ---------- 身體組成：脂肪量 vs 瘦體重趨勢（解讀「掉的是脂肪還是肌肉」） ----------
   用體脂拆出 脂肪量=體重×體脂%、瘦體重=體重×(1−體脂%)，各自做 28 天 EMA 平滑再取週斜率。
   ⚠️ BIA 體脂雜訊大、且受水分影響（水多→體脂讀偏低→瘦體重被灌高），所以只看長期平滑趨勢、且資料要夠密才判讀。*/
function bodyComp(){
  const recs=(store.records||[]).filter(r=>r.weight!=null && r.body_fat!=null).slice(-28);
  const out={ok:false, days:recs.length};
  // 上鎖：體脂紀錄要夠密（≥8 筆且跨距≥14 天）才判讀，否則拿稀疏 BIA 亂判會誤導
  if(recs.length<8) return out;
  const t0=new Date(recs[0].date).getTime();
  const xs=recs.map(r=>(new Date(r.date).getTime()-t0)/86400000);
  if(xs[xs.length-1]-xs[0] < 14) return out;
  const ema=(arr)=>{const o=[];let e=arr[0];for(let i=0;i<arr.length;i++){e=i===0?arr[0]:0.3*arr[i]+0.7*e;o.push(e);}return o;};
  const fat=ema(recs.map(r=>+r.weight*(+r.body_fat)/100));
  const lean=ema(recs.map(r=>+r.weight*(1-(+r.body_fat)/100)));
  const wt=ema(recs.map(r=>+r.weight));
  const slopeWk=(ys)=>{const n=xs.length,mx=avg(xs),my=avg(ys);let num=0,den=0;for(let i=0;i<n;i++){num+=(xs[i]-mx)*(ys[i]-my);den+=(xs[i]-mx)**2;}return den?(num/den)*7:0;};
  const fatWk=slopeWk(fat), leanWk=slopeWk(lean), wWk=slopeWk(wt);
  const spanWk=Math.max(1,(xs[xs.length-1]-xs[0])/7);
  out.ok=true; out.days=recs.length; out.spanWk=+spanWk.toFixed(1);
  out.fatWk=+fatWk.toFixed(2); out.leanWk=+leanWk.toFixed(2); out.wWk=+wWk.toFixed(2);
  out.fatD=+(fatWk*spanWk).toFixed(1); out.leanD=+(leanWk*spanWk).toFixed(1); out.wD=+(wWk*spanWk).toFixed(1);
  out.fatNow=+fat[fat.length-1].toFixed(1); out.leanNow=+lean[lean.length-1].toFixed(1);
  // 判讀（噪音地板 0.05kg/週；真肌肉流失很慢，短期「瘦體重掉」多為水分，所以門檻設保守）
  const F=0.05;
  let key,label,note,col;
  if(wWk>-0.05 && fatWk<-F && leanWk>=-0.03){ key="recomp"; label="💪 增肌減脂"; col="var(--green)"; note="體重幾乎沒動，但脂肪在降、瘦體重保住甚至增加——是好結果，別誤判為停滯。"; }
  else if(fatWk<-F && leanWk>=-0.05){ key="good"; label="✅ 高品質減脂"; col="var(--green)"; note="掉的主要是脂肪，肌肉守得住。維持目前的赤字＋蛋白＋重訓就好。"; }
  else if(wWk<-F && leanWk<=-0.10 && fatWk<-F){ key="muscle"; label="⚠️ 有掉到肌肉"; col="var(--warm)"; note="體重在降，但瘦體重也明顯下滑——可能赤字太大／蛋白不足／重訓不夠。別再砍熱量，先補蛋白＋重訓。"; }
  else if(fatWk>=-0.03 && leanWk<=-F){ key="bad"; label="🚨 掉的不是脂肪"; col="#b5564e"; note="脂肪沒怎麼降、瘦體重卻在掉——掉的多是肌肉/水。立刻停止再減，回維持熱量、加蛋白與重訓。"; }
  else if(fatWk>F){ key="fatup"; label="📈 脂肪量上升"; col=(val("goal")==="bulk")?"var(--sub)":"#b5564e"; note=(val("goal")==="bulk")?"增肌期脂肪小幅上升正常，但留意上升速度別太快。":"脂肪量在增加，檢查是否熱量超出。"; }
  else { key="flat"; label="平穩／變化不明顯"; col="var(--sub)"; note="近期身體組成變化不大，或資料雜訊較高，持續記錄會更清楚。"; }
  out.quality={key,label,note,col};
  return out;
}

/* ---------- 渲染 ---------- */
// 概覽的「減脂品質／肌肉守恆」面板：用脂肪量 vs 瘦體重趨勢解讀「掉的是脂肪還是肌肉」
function renderBodyComp(){
  const card=document.getElementById("bodyCompCard"); if(!card) return;
  const box=document.getElementById("bodyCompBox"); if(!box) return;
  const bc=bodyComp();
  if(!bc.ok){
    // 上鎖：體脂資料不夠就不顯示判讀，只給一句引導（避免拿稀疏 BIA 亂判）
    const bfDays=(store.records||[]).filter(r=>r.body_fat!=null).length;
    // 完全沒記過體脂、又不是減脂目標 → 直接隱藏整張卡，避免對沒在追體脂的人造成雜訊
    if(bfDays===0 && val("goal")!=="cut"){ card.style.display="none"; return; }
    card.style.display="";
    box.innerHTML=`<div class="hint">記錄體脂後，這裡會分析「你掉的是脂肪還是肌肉」。需要約 2 週、且體脂量測夠規律（目前 ${bfDays} 筆）。<br>建議固定早上空腹、同一台體脂計量，趨勢才準。</div>`;
    return;
  }
  card.style.display="";
  const q=bc.quality;
  const sign=(v)=>v>0?"+"+v:""+v;
  const col=(v,goodNeg)=>{ if(Math.abs(v)<0.05) return "var(--sub)"; const good=goodNeg?v<0:v>0; return good?"var(--green)":"#b5564e"; };
  // 脂肪：降為好(綠)；瘦體重：升/持平為好，掉為紅
  const stat=(v,k,c)=>`<div><div class="v" style="color:${c}">${v}</div><div class="k">${k}</div></div>`;
  let html=`<div style="font-weight:600;margin-bottom:4px;color:${q.col}">${q.label}</div>`+
    `<div class="hint" style="color:var(--ink);line-height:1.6;">${q.note}</div>`+
    `<div class="stat-row" style="margin-top:8px;">`+
      stat((bc.fatWk>0?"+":"")+bc.fatWk+"kg/週", "脂肪量趨勢", col(bc.fatWk,true))+
      stat((bc.leanWk>0?"+":"")+bc.leanWk+"kg/週", "瘦體重(肌肉)趨勢", bc.leanWk<-0.05?"#b5564e":(bc.leanWk>0.05?"var(--green)":"var(--sub)"))+
      stat(bc.fatNow+"kg", "目前脂肪量", "var(--sub)")+
      stat(bc.leanNow+"kg", "目前瘦體重", "var(--sub)")+`</div>`;
  // 近 N 週體重變化的「脂肪/肌肉」拆解
  if(bc.wD<-0.2){
    const fatPart=Math.min(100,Math.max(0,Math.round(bc.fatD/bc.wD*100)));
    html+=`<div class="hint" style="margin-top:8px;">近 ${bc.spanWk} 週共變化 ${bc.wD}kg：其中脂肪 ${bc.fatD}kg、瘦組織 ${bc.leanD}kg。<b>${fatPart>=75?"七成以上是脂肪，品質好 👍":fatPart>=50?"約一半是脂肪，還可更好":"脂肪佔比偏低，留意肌肉流失"}</b></div>`;
  }
  // 經期相位提醒：易水腫期時，提醒這幾天的數據受水分影響（女性有記經期才會出現）
  const cyc=(typeof cyclePhase==="function")?cyclePhase():null;
  if(cyc && cyc.highWater){
    html+=`<div class="hint" style="margin-top:8px;color:var(--warm)">🩸 目前第 ${cyc.day} 天（${cyc.phase}）：易水分滯留，這幾天體重與瘦體重讀數可能偏高，屬正常水分，判讀以整段趨勢為準。</div>`;
  }
  html+=`<div class="hint tip" style="margin-top:8px;">脂肪量＝體重×體脂%、瘦體重＝體重×(1−體脂%)，皆取 28 天平滑趨勢。體脂計受水分影響大，只看長期趨勢、別看單日。</div>`;
  box.innerHTML=html;
}
function renderTable(){
  const recs=store.records, tb=document.querySelector("#tbl tbody"); tb.innerHTML="";
  if(recs.length===0){ show("tblEmpty"); document.getElementById("tbl").style.display="none"; return; }
  hide("tblEmpty"); document.getElementById("tbl").style.display="table";
  recs.slice().reverse().forEach(r=>{
    const tr=document.createElement("tr");
    const burn=burnByDate(r.date.slice(0,10));
    const net=r.kcal!=null? (+r.kcal-burn) : null;
    tr.innerHTML=`<td>${r.date.slice(0,10)}</td><td>${r.weight??"—"}</td><td>${r.weight_pm??"—"}</td><td>${r.body_fat!=null?r.body_fat+"%":"—"}</td><td>${r.kcal??"—"}</td><td>${burn>0?"−"+burn.toLocaleString():"—"}</td><td>${net!=null?net.toLocaleString():"—"}</td><td><span class="del" onclick="delRecord(${r.id})">刪除</span></td>`;
    tb.appendChild(tr);
  });
}
// 今日摘要儀表板（概覽頁最上方）
function renderDashboard(){
  if(typeof renderDailyTasks==="function") renderDailyTasks();   // 概覽的今日任務卡（即時反映打勾）
  const box=document.getElementById("dashBox"); if(!box) return;
  const d=todayStr(), t=goalTargets(), nut=dayNutrition(d), burn=burnByDate(d);
  const waterGoal=waterGoalFor(d), water=waterFor(d);
  const stat=(v,k,col)=>`<div><div class="v"${col?` style="color:${col}"`:""}>${v}</div><div class="k">${k}</div></div>`;
  let html="";
  if(t){
    const remain=Math.round(t.kcal+burn-nut.k);
    const pLeft=Math.max(0,Math.round(t.protein-nut.p));
    html+=`<div class="stat-row" style="margin-top:2px;">`+
      stat((remain>=0?"":"")+remain.toLocaleString(),"還可吃 kcal",remain<0?"#b5564e":"var(--green)")+
      stat(nut.p+"/"+t.protein,"蛋白(g)",pLeft>0?"var(--warm)":"var(--green)")+
      stat(Math.round(water/waterGoal*100)+"%","飲水",water>=waterGoal?"var(--green)":"")+
      stat(nut.k>0?"✓":"—","今日打卡",nut.k>0?"var(--green)":"var(--sub)")+`</div>`;
  }else{
    html+=`<div class="hint">先在下方 ①②填基本資料與目標，這裡就會顯示「今天還能吃多少、蛋白、飲水、打卡」。</div>`;
  }
  // 競賽名次摘要
  if((myGroups||[]).length){
    const parts=myGroups.slice(0,3).map(g=>{
      const me=g.members.find(m=>m.me); const rank=me?(me.rank==null?"-":me.rank):"-";
      return `${g.name}：第 ${rank}/${g.members.length}`;
    });
    html+=`<div class="hint" style="margin-top:8px;">🏆 ${parts.join("　·　")}</div>`;
  }
  // 經期相位提示（黃體期/月經期時提醒水分浮動，避免被體重嚇到）
  const ph=(typeof cyclePhase==="function")?cyclePhase():null;
  if(ph && (ph.phase==="黃體期"||ph.phase==="月經期")){
    html+=`<div class="hint" style="margin-top:8px;color:var(--warm)">🩸 週期第 ${ph.day} 天（${ph.phase}）：${ph.note}</div>`;
  }
  box.innerHTML=html;
}
let reportDays=7;
function setReport(n,btn){
  reportDays=n;
  document.querySelectorAll("#rep7,#rep30").forEach(b=>b.classList.toggle("on",b===btn));
  renderReport();
}
function renderReport(){
  const box=document.getElementById("reportBox"); if(!box) return;
  const since=isoLocal(new Date(new Date(todayStr())-(reportDays-1)*86400000));
  const recs=(store.records||[]).filter(r=>r.date.slice(0,10)>=since);
  const exs=(store.exercises||[]).filter(e=>e.date.slice(0,10)>=since);
  // 攝取（有記飲食的天）
  const intakeDays=recs.filter(r=>r.kcal!=null);
  const avgIntake=intakeDays.length?Math.round(avg(intakeDays.map(r=>+r.kcal||0))):0;
  const avgP=intakeDays.length?Math.round(avg(intakeDays.map(r=>+r.protein||0))):0;
  const avgF=intakeDays.length?Math.round(avg(intakeDays.map(r=>+r.fat||0))):0;
  const avgC=intakeDays.length?Math.round(avg(intakeDays.map(r=>+r.carb||0))):0;
  // 運動
  const burnTotal=exs.reduce((a,b)=>a+(+b.kcal||0),0);
  const avgBurn=Math.round(burnTotal/reportDays);
  const strengthDays=new Set(exs.filter(e=>e.kind==="strength").map(e=>e.date.slice(0,10))).size;
  const volTotal=exs.filter(e=>e.kind==="strength").reduce((a,b)=>a+(+b.volume||0),0);
  // 淨熱量
  const avgNet=avgIntake?avgIntake-avgBurn:0;
  // 體重變化（用有早上體重的最早/最晚）
  const wRecs=recs.filter(r=>r.weight!=null);
  let wDelta=null, wFrom=null, wTo=null;
  if(wRecs.length>=2){ wFrom=+wRecs[0].weight; wTo=+wRecs[wRecs.length-1].weight; wDelta=+(wTo-wFrom).toFixed(1); }
  // 目標達成（攝取在目標±?）— 簡單比對：有目標時算低於目標的天數
  const tgt=goalTargets();
  let underGoal=0;
  if(tgt){ underGoal=intakeDays.filter(r=>(+r.kcal||0)<=tgt.kcal).length; }
  const stat=(v,k,col)=>`<div><div class="v"${col?` style="color:${col}"`:""}>${v}</div><div class="k">${k}</div></div>`;
  // 減重進度 KPI（週速度/距目標/ETA/TDEE）統一在「📋 我的減重計畫」呈現，這裡不重複，
  // 報表專注於「執行面」明細：攝取/運動/淨熱量/三大營養/體重體脂變化/達標天數。
  const P=planContext();
  let html="";
  if(P.goal==="cut"){
    html+=`<div class="hint" style="margin-top:2px;">📋 減重進度、週速度與預計達成日請看上方「我的減重計畫」。以下為執行面明細。</div>`;
  }
  // ── 飲食/運動執行面 ──
  html+=`<div class="stat-row" style="margin-top:10px;">`+
    stat(avgIntake?avgIntake.toLocaleString():"—","平均攝取/天")+
    stat(avgBurn?"−"+avgBurn.toLocaleString():"0","平均運動/天")+
    stat(avgNet?avgNet.toLocaleString():"—","平均淨/天")+
    stat(intakeDays.length+"天","有記飲食")+`</div>`;
  html+=`<div class="stat-row" style="margin-top:8px;">`+
    stat(`P${avgP}`,"平均蛋白")+stat(`F${avgF}`,"平均脂肪")+stat(`C${avgC}`,"平均碳水")+
    stat(tgt?underGoal+"/"+intakeDays.length:"—","達標天數")+`</div>`;
  // 體脂變化（範圍內有體脂的首尾差，負=下降）
  const bfRecs=recs.filter(r=>r.body_fat!=null);
  const bfDelta=bfRecs.length>=2?+(+bfRecs[bfRecs.length-1].body_fat-+bfRecs[0].body_fat).toFixed(1):null;
  const bfCol=bfDelta==null?"":(bfDelta<0?"var(--green)":bfDelta>0?"#b5564e":"");
  html+=`<div class="stat-row" style="margin-top:8px;">`+
    stat(wDelta!=null?(wDelta>0?"+":"")+wDelta+"kg":"—","體重變化")+
    stat(bfDelta!=null?(bfDelta>0?"+":"")+bfDelta+"%":"—","體脂變化",bfCol)+
    stat(strengthDays+"天","重訓天數")+
    stat(Math.round(volTotal).toLocaleString(),"訓練量kg")+`</div>`;
  box.innerHTML=html;
}
function renderReal(){
  const R=calcReal(store.records, store.exercises);
  const M=tdeeModel();
  const cmp=document.querySelector("#cmpTbl tbody");
  // 防呆：基本資料沒填全時 calcMifflin()=null → M.gross/base 為 null，退回原始實測，避免 toLocaleString 崩潰
  const gross=(M.gross!=null?M.gross:R.tdee), base=(M.base!=null?M.base:R.tdeeBase);
  if(R.tdee){
    // 顯示「校正後採用值」（與目標建議、減重計畫一致），不再顯示未夾限的原始反推，避免四處數字打架
    set("realTdee",gross!=null?gross.toLocaleString():"—"); set("realTdeeBase",base!=null?base.toLocaleString():"—");
    set("realDetail", M.corrected
      ? `根據最近 ${R.days} 天紀錄校正（原始反推 ${R.tdee.toLocaleString()}，因初期掉水分偏高，已向公式收斂）`
      : `根據最近 ${R.days} 天紀錄`);
  }else{
    set("realTdee","—"); set("realTdeeBase","—");
    // 還差幾天能算出實測：需 ≥7 天有體重 且 其中 ≥3 天有攝取
    const wDays=(store.records||[]).filter(r=>r.weight!=null).length;
    const kDays=(store.records||[]).filter(r=>r.weight!=null&&r.kcal!=null).length;
    const needW=Math.max(0,7-wDays), needK=Math.max(0,3-kDays);
    let msg;
    if(needW>0&&needK>0) msg=`還差 ${needW} 天體重 + ${needK} 天飲食紀錄就能算出你的實測 TDEE`;
    else if(needW>0) msg=`還差 ${needW} 天體重紀錄就能算出實測 TDEE（飲食已足）`;
    else if(needK>0) msg=`體重天數已足，還差 ${needK} 天飲食紀錄就能算出實測 TDEE`;
    else msg="資料即將足夠，再記一天即可";
    set("realDetail", `⏳ ${msg}（目前用公式估）`);
  }
  set("sAvgKcal", R.avgK?R.avgK.toLocaleString():"—");
  set("sBurn", R.avgBurn?R.avgBurn.toLocaleString():"0");
  set("sSlope", R.slopeWk!=null?(R.slopeWk>=0?"+":"")+R.slopeWk.toFixed(2)+"kg":"—");
  set("sDeficit", R.deficit!=null?(R.deficit>=0?"+":"")+R.deficit.toLocaleString():"—");

  if(!R.tdee){ cmp.innerHTML=`<tr><td class="empty" colspan="3">資料足夠後會顯示比較</td></tr>`; set("cmpHint",""); return; }
  const row=(k,v,note)=>`<tr><td style="text-align:left">${k}</td><td style="font-weight:700">${v}</td><td style="text-align:left;color:var(--sub);font-size:12px">${note}</td></tr>`;
  cmp.innerHTML=
    row("平均每日攝取", R.avgK.toLocaleString()+" kcal", "近 28 天吃進的平均")+
    row("週體重變化", (R.slopeWk>=0?"+":"")+R.slopeWk.toFixed(2)+" kg", R.slopeWk<0?"下降中":R.slopeWk>0?"上升中":"持平")+
    row("體重反推每日赤字", (R.deficit>=0?"+":"")+R.deficit.toLocaleString()+" kcal", "脂肪 1kg≈7700kcal")+
    (M.corrected?row("原始反推 TDEE", R.tdee.toLocaleString()+" kcal", "未校正，初期掉水分易偏高"):"")+
    row("平均每日運動消耗", R.avgBurn.toLocaleString()+" kcal", "你記錄的運動")+
    row("➊ 總 TDEE（含運動）", "<b>"+gross.toLocaleString()+"</b> kcal", M.corrected?"校正後採用值":"攝取＋赤字")+
    row("➋ 基礎 TDEE（不含運動）", "<b>"+base.toLocaleString()+"</b> kcal", "➊ − 運動消耗");
  const goal=val("goal"), rate=+val("goalRate");
  let useGross=gross; if(goal==="cut")useGross=Math.round(gross*(1-rate)); if(goal==="bulk")useGross=Math.round(gross*(1+rate*0.5));
  set("cmpHint",
    `兩者差 ${R.avgBurn.toLocaleString()} kcal ＝ 你平均每天靠運動多燒的量。`+
    `\n· 想「維持現在的運動量」設定吃多少 → 用 ➊ 總 TDEE（已含運動），目前目標建議 ${useGross.toLocaleString()} kcal。`+
    `\n· 想「把運動另外算、運動多就多吃」→ 用 ➋ 基礎 TDEE 當底，再每天加回當天實際運動消耗。`);
  document.getElementById("cmpHint").style.whiteSpace="pre-line";
}
function drawChart(){
  const recs=store.records.filter(r=>r.weight!=null), cv=document.getElementById("chart");
  if(recs.length<2){ cv.style.display="none"; show("chartEmpty"); if(chart){chart.destroy();chart=null;} return; }
  cv.style.display="block"; hide("chartEmpty");
  const labels=recs.map(r=>r.date.slice(5,10)), data=recs.map(r=>+r.weight);
  const t0=new Date(recs[0].date).getTime(), xs=recs.map(r=>(new Date(r.date).getTime()-t0)/86400000);
  const n=xs.length,mx=avg(xs),my=avg(data); let num=0,den=0;
  for(let i=0;i<n;i++){num+=(xs[i]-mx)*(data[i]-my);den+=(xs[i]-mx)**2;}
  const sl=den?num/den:0,ic=my-sl*mx,trend=xs.map(x=>+(sl*x+ic).toFixed(2));
  // 7 日移動平均（過濾每日水分波動）
  const ma=data.map((_,i)=>{ const s=Math.max(0,i-6); const w=data.slice(s,i+1); return +(w.reduce((a,b)=>a+b,0)/w.length).toFixed(2); });
  // 體脂%（沿用同一組日期，沒填的點留空、連線跳過）
  const bf=recs.map(r=>r.body_fat!=null?+r.body_fat:null);
  const hasBf=bf.some(v=>v!=null);
  const datasets=[
    {label:"體重",data,borderColor:"#5b8aa6",backgroundColor:"rgba(91,138,166,.12)",fill:true,tension:.3,pointRadius:3,yAxisID:"y"},
    {label:"7日平均",data:ma,borderColor:"#c98b5e",borderWidth:2,pointRadius:0,fill:false,tension:.3,yAxisID:"y"},
    {label:"趨勢",data:trend,borderColor:"#7c9070",borderDash:[5,4],pointRadius:0,fill:false,yAxisID:"y"}
  ];
  if(hasBf) datasets.push({label:"體脂%",data:bf,borderColor:"#9b7cb6",borderWidth:2,pointRadius:3,fill:false,tension:.3,spanGaps:true,yAxisID:"y1"});
  // 預測線：用實測 TDEE 反推的每日斜率，從目前體重延伸到目標體重（虛線）
  let projLabels=[];
  const target=+val("targetWeight");
  const R=calcReal(store.records, store.exercises);
  const slopeDay=R.slopeWk!=null?R.slopeWk/7:(den?sl:null);   // 優先實測週斜率，否則用回歸斜率
  const cur=data[data.length-1];
  const towardTarget=target&&slopeDay&&((target<cur&&slopeDay<0)||(target>cur&&slopeDay>0));
  if(towardTarget&&Math.abs(target-cur)>0.1){
    const dir=target<cur?-1:1, lastT=new Date(recs[recs.length-1].date).getTime();
    const proj=data.map(()=>null); proj[proj.length-1]=cur;   // 從最後一個實測點接上
    for(let d=7;d<=210;d+=7){
      const w=cur+slopeDay*d, reached=dir<0?w<=target:w>=target;
      const fd=new Date(lastT+d*86400000);
      projLabels.push(("0"+(fd.getMonth()+1)).slice(-2)+"/"+("0"+fd.getDate()).slice(-2));
      proj.push(reached?+target.toFixed(2):+w.toFixed(2));
      if(reached) break;
    }
    const fullLen=data.length+projLabels.length;   // 先固定目標長度，避免對 data 本身 push 時長度一直變動造成無窮迴圈
    datasets.forEach(ds=>{ while(ds.data.length<fullLen) ds.data.push(null); }); // 對齊長度
    datasets.push({label:"預測",data:proj,borderColor:"#d08bb0",borderDash:[3,3],borderWidth:2,pointRadius:0,fill:false,tension:.1,yAxisID:"y",spanGaps:true});
  }
  const allLabels=labels.concat(projLabels);
  const scales={y:{ticks:{font:{size:11}}},x:{ticks:{font:{size:10}}}};
  if(hasBf) scales.y1={position:"right",grid:{drawOnChartArea:false},ticks:{font:{size:11},callback:v=>v+"%"}};
  if(chart)chart.destroy();
  chart=new Chart(cv,{type:"line",data:{labels:allLabels,datasets},options:{responsive:true,plugins:{legend:{labels:{boxWidth:12,font:{size:11}}}},scales}});
}
// 計算「每天」的滾動真實 TDEE 歷史（用截至當天的資料、套同一套夾限校正），給代謝/熱量收支圖用
function tdeeSeries(daysBack){
  daysBack=daysBack||45;
  const recs=store.records||[], exs=store.exercises||[];
  const formula=calcMifflin();                          // 公式估算當基準（依目前基本資料）
  const since=isoLocal(new Date(new Date(todayStr())-(daysBack-1)*86400000));
  const dates=[...new Set(recs.filter(r=>r.date.slice(0,10)>=since && (r.weight!=null||r.kcal!=null)).map(r=>r.date.slice(0,10)))].sort();
  const series=dates.map(d=>{
    const upto=recs.filter(r=>r.date.slice(0,10)<=d);
    const R=calcReal(upto, exs);                         // calcReal 內部自動取截至當天的近 28 天
    let real=null;
    if(R.tdee && formula){
      const days=R.days||0, wReal=Math.min(1,Math.max(0,(days-7)/7));
      const blend=R.tdee*wReal+formula*(1-wReal);
      real=Math.round(Math.min(formula*1.3, Math.max(formula*0.7, blend)));
    }
    const rec=recs.find(r=>r.date.slice(0,10)===d);
    const intake=(rec&&rec.kcal!=null)?Math.round(+rec.kcal):null;
    return {date:d, real, formula:formula||null, intake};
  });
  return {series, formula};
}
// A. 攝取 vs 消耗(TDEE)　B. 代謝(TDEE)趨勢　兩張小圖；資料不足時整張卡隱藏
function drawMetabolismCharts(){
  const card=document.getElementById("metabCard"); if(!card) return;
  const {series,formula}=tdeeSeries(45);
  const haveReal=series.some(s=>s.real!=null);
  const intakeDays=series.filter(s=>s.intake!=null).length;
  if(series.length<5 || (!haveReal && intakeDays<4)){
    card.style.display="none";
    if(kcalChart){kcalChart.destroy();kcalChart=null;} if(tdeeChart){tdeeChart.destroy();tdeeChart=null;}
    return;
  }
  card.style.display="";
  const labels=series.map(s=>s.date.slice(5).replace("-","/"));
  // 「今天」還沒記完，攝取會異常低 → 不畫今天那根柱與其均值，避免看起來像超大赤字
  const todayS=todayStr();
  const intake=series.map(s=> s.date===todayS ? null : s.intake);
  const maIntake=series.map((s,i)=>{ if(s.date===todayS) return null; const w=intake.slice(Math.max(0,i-6),i+1).filter(v=>v!=null); return w.length?Math.round(w.reduce((a,b)=>a+b,0)/w.length):null; });
  const realLine=series.map(s=>s.real);
  const cvA=document.getElementById("kcalChart");
  if(cvA){
    if(kcalChart)kcalChart.destroy();
    kcalChart=new Chart(cvA,{data:{labels,datasets:[
      {type:"bar",label:"攝取",data:intake,backgroundColor:"rgba(91,138,166,.30)",borderWidth:0},
      {type:"line",label:"7日均攝取",data:maIntake,borderColor:"#5b8aa6",borderWidth:2,pointRadius:0,tension:.3,spanGaps:true},
      {type:"line",label:"TDEE",data:realLine,borderColor:"#b5564e",borderDash:[5,4],borderWidth:2,pointRadius:0,tension:.3,spanGaps:true}
    ]},options:{responsive:true,plugins:{legend:{labels:{boxWidth:12,font:{size:11}}}},scales:{y:{ticks:{font:{size:10}}},x:{ticks:{font:{size:9},maxRotation:0,autoSkip:true,maxTicksLimit:8}}}}});
  }
  const cvB=document.getElementById("tdeeChart");
  if(cvB){
    const formLine=series.map(()=>formula||null);
    if(tdeeChart)tdeeChart.destroy();
    tdeeChart=new Chart(cvB,{type:"line",data:{labels,datasets:[
      {label:"真實 TDEE",data:realLine,borderColor:"#c98b5e",backgroundColor:"rgba(201,139,94,.12)",borderWidth:2,pointRadius:0,fill:true,tension:.3,spanGaps:true},
      {label:"公式估算",data:formLine,borderColor:"#9aa0a6",borderDash:[4,4],borderWidth:1.5,pointRadius:0,fill:false}
    ]},options:{responsive:true,plugins:{legend:{labels:{boxWidth:12,font:{size:11}}}},scales:{y:{ticks:{font:{size:10}}},x:{ticks:{font:{size:9},maxRotation:0,autoSkip:true,maxTicksLimit:8}}}}});
  }
}
function renderEta(){
  const target=+val("targetWeight");
  const recs=store.records.filter(r=>r.weight!=null);
  if(!target||recs.length<2){ set("etaOut","—"); set("etaDetail", target?"需要更多體重紀錄":"輸入目標體重後估算"); return; }
  const cur=+recs[recs.length-1].weight;
  const diff=target-cur;
  if(Math.abs(diff)<0.1){ set("etaOut","已達成 🎉"); set("etaDetail","目前 "+cur+" kg"); return; }
  const R=calcReal(store.records, store.exercises);
  const slopeDay=R.slopeWk!=null? R.slopeWk/7 : null;
  if(slopeDay==null){ set("etaOut","—"); set("etaDetail","需至少 7 天體重紀錄才能推估速度"); return; }
  // 方向不一致（想減卻在增，或反之）
  if((diff<0&&slopeDay>=0)||(diff>0&&slopeDay<=0)||slopeDay===0){
    set("etaOut","趨勢相反"); set("etaDetail",`目前 ${cur}kg，目標 ${target}kg，但體重正${slopeDay>0?"上升":"持平"}中，需調整攝取`); return;
  }
  const days=Math.round(diff/slopeDay);
  const eta=new Date(Date.now()+days*86400000);
  const y=eta.getFullYear(), m=eta.getMonth()+1, d=eta.getDate();
  set("etaOut", `${y}/${m}/${d}`);
  set("etaDetail", `目前 ${cur}kg → 目標 ${target}kg（差 ${Math.abs(diff).toFixed(1)}kg）｜約 ${days} 天、每週 ${Math.abs(R.slopeWk).toFixed(2)}kg`);
}
/* ---------- 目標體重健康區間（提醒，不阻擋） ----------
   台灣國健署標準：BMI 18.5–24 為健康範圍。只提示、不改任何計算，設定權仍在使用者手上。 */
function renderTargetHint(){
  const box=document.getElementById("targetHint"); if(!box) return;
  const h=+val("height")/100, tgt=+val("targetWeight");
  if(!h||!tgt){ box.innerHTML=""; return; }
  const bmi=tgt/(h*h);
  const lo=(18.5*h*h).toFixed(1), hi=(24*h*h).toFixed(1);
  let msg=null, col="var(--sub)";
  if(bmi<18.5){ col="#b5564e";
    msg=`⚠️ 這個目標的 BMI 是 <b>${bmi.toFixed(1)}</b>，已低於健康範圍（18.5）。以你的身高，健康區間約是 <b>${lo}–${hi} kg</b>。`+
        `體重再往下掉，掉的多半是肌肉與骨質，代謝會跟著變差。建議把目標設在 ${lo} kg 以上，用體脂率和圍度來看進步會更準。`; }
  // 18.5–19.5 是緩衝帶：技術上還在健康範圍，但只要再掉 1–2 公斤就出界了，
  // 而減重過程本來就會超調，所以這裡先提醒改看體脂與圍度，比事後才擋更有意義。
  else if(bmi<19.5){ col="var(--warm)";
    msg=`這個目標的 BMI 是 <b>${bmi.toFixed(1)}</b>，還在健康範圍內，但已經很接近下限（18.5，約 ${lo} kg）。`+
        `再往下就容易掉到過輕，而且掉的多半是肌肉。建議<b>把這裡當終點</b>，之後改用體脂率和圍度來看進步。`; }
  else if(bmi>=27){ col="var(--warm)";
    msg=`這個目標的 BMI 是 <b>${bmi.toFixed(1)}</b>，仍在肥胖範圍。以你的身高，健康區間約是 <b>${lo}–${hi} kg</b>——不必一次到位，但可以把它當成下一個里程碑。`; }
  else if(bmi>=24){ col="var(--sub)";
    msg=`這個目標的 BMI 是 <b>${bmi.toFixed(1)}</b>，略高於健康範圍上限（24）。以你的身高，健康區間約是 <b>${lo}–${hi} kg</b>。`; }
  else {
    msg=`這個目標的 BMI 是 <b>${bmi.toFixed(1)}</b>，落在健康範圍（18.5–24）內 👍`; }
  box.innerHTML=`<div class="hint" style="margin-top:6px;color:${col};line-height:1.6;">${msg}</div>`;
}
// 目標日期的可行性判定
function renderDatePlan(){
  const box=document.getElementById("datePlan"); if(!box) return;
  const base=baseTDEE();
  const P=base.tdee?datePlan(base.tdee):null;
  if(!P){ box.innerHTML=""; return; }
  const wrap=(col,title,body)=>`<div style="margin-top:10px;background:var(--soft);border-radius:12px;padding:10px 14px;border-left:4px solid ${col};">`+
    `<div style="font-size:13px;font-weight:700;color:${col};">${title}</div>`+
    `<div style="font-size:12px;color:var(--ink);line-height:1.6;margin-top:5px;">${body}</div></div>`;
  const dstr=d=>d?d.replace(/-/g,"/"):"—";
  if(P.status==="past"){
    box.innerHTML=wrap("var(--sub)","目標日期已經過了",
      `還差 ${P.needKg.toFixed(1)} kg。照安全速度最快約 ${dstr(P.fastestDate)} 可以達成，把日期往後調一下吧。`);
    return;
  }
  // 實測 TDEE 若因漏記被低估，maxDeficit 會跟著變小，判定會過度悲觀 → 要講清楚
  const underNote = tdeeLikelyUnderestimated()
    ? `<br><span style="color:var(--warm)">另外：你的實測 TDEE 可能因為飲食漏記而被低估，這個判定會偏保守。先把記錄補齊，日期評估才準。</span>` : "";
  if(P.status==="tooFast"){
    // 擋住的是熱量下限還是速率上限，解法不同，不能混為一談
    const why = P.limitedBy==="floor"
      ? `要準時只能每天吃 <b>${P.rawKcal.toLocaleString()} kcal</b>，低於 ${MIN_GOAL_KCAL} 的安全下限——`+
        `你的 TDEE 是 ${(P.maxDeficit+MIN_GOAL_KCAL).toLocaleString()}，能挪出來的赤字最多就是每天 ${P.maxDeficit} kcal。`
      : `等於每週要掉 <b>${P.needRateWk.toFixed(2)} kg</b>（體重的 ${P.pctBW.toFixed(2)}%），超過每週 1% 的安全上限，`+
        `再快就會開始賠掉肌肉與代謝。`;
    box.innerHTML=wrap("#b5564e","⛔ 這個日期趕不上（照健康的方式）",
      `距離 ${dstr(P.dateStr)} 還有 ${P.days} 天，要減 ${P.needKg.toFixed(1)} kg。${why}<br>`+
      `<b>建議二選一：</b>把日期延到 <b>${dstr(P.fastestDate)}</b> 之後，或把目標體重調得溫和一些。`+
      `攝取我已經幫你壓在安全範圍（每日赤字 ${P.maxDeficit} kcal），不會照這個日期硬壓。`+
      (P.limitedBy==="floor"?`<br>想提早達成，比較安全的做法是<b>把 TDEE 拉高</b>——增加重訓與日常活動量，而不是再少吃。`:"")+
      underNote);
    return;
  }
  box.innerHTML=wrap(P.nearRateCap?"var(--warm)":"var(--green)",
    P.nearRateCap?"⚠️ 做得到，但貼著安全上限":"✅ 這個日期是做得到的",
    `距離 ${dstr(P.dateStr)} 還有 ${P.days} 天，要減 ${P.needKg.toFixed(1)} kg，每週約 <b>${P.needRateWk.toFixed(2)} kg</b>`+
    `（體重的 ${P.pctBW.toFixed(2)}%）。已依這個日期把每日赤字設為 <b>${P.deficit} kcal</b>。`+
    (P.nearRateCap?`<br>這個速度已經接近每週 1% 的上限，沒有犯錯空間：蛋白質要吃滿、重訓不能停，`+
      `並且要盯著體脂與瘦體重的走勢，確認掉的是脂肪。只要覺得恢復變差就把日期往後放。`:"")+
    (!P.nearRateCap&&P.deficit<P.maxDeficit*0.6?`<br>其實還有餘裕——比起再少吃，把蛋白質和訓練顧好，成果會更漂亮。`:"")+
    underNote);
}
function renderDerived(){ calcMifflin(); calcGoal(); renderExRec(); renderEta(); renderTargetHint(); renderDatePlan(); if(typeof renderPeriod==="function") renderPeriod(); if(store.records){ renderDay(); renderPlan(); if(typeof renderBodyComp==="function") renderBodyComp(); renderReport(); renderDashboard(); } }
function renderAll(){
  set("curName",session.username);
  // 每個區塊獨立 try/catch：任一區塊渲染出錯也不會中斷其他區塊（避免單一錯誤讓整頁看起來「資料全不見」）
  const parts=[renderDerived,renderTable,renderDashboard,renderPlan,renderBodyComp,renderReviews,renderReport,renderReal,renderPoints,drawChart,drawMetabolismCharts,renderExercises,renderPR,renderVolTrend,renderBalance,renderRecipes,renderFavs,renderShared,renderDay,renderPeriod];
  for(const fn of parts){ try{ fn(); }catch(e){ console.error("render 區塊出錯：",fn.name,e); } }
}

const storeCacheKey=()=>"cacheAll:"+(session&&session.userId||"");
// 把 /api/me/all 的資料套進 store 並渲染（離線/快取與網路兩條路共用）
function applyStoreData(data){
  store = data;
  store.profile = store.profile||{}; store.recipes = store.recipes||[];
  store.favorites = store.favorites||[]; store.meals = store.meals||[];
  store.grocery = store.grocery||{buys:[],meals:[]}; store.grocery.buys=store.grocery.buys||[]; store.grocery.meals=store.grocery.meals||[]; store.grocery.settles=store.grocery.settles||[]; store.grocery.extras=store.grocery.extras||[];
  if(typeof applyGroceryVisibility==="function") applyGroceryVisibility();
  if(typeof seedGroceryZen==="function") seedGroceryZen();
  // 載入共享食物庫（其他人建立的自訂食物/食譜）→ 可被搜尋
  (store.sharedFoods||[]).forEach(s=>{
    if(FOODS[s.name]) return;  // 不覆蓋內建
    FOODS_DYN[s.name]=[+s.kcal||0,+s.protein||0,+s.fat||0,+s.carb||0];
    SERVINGS[s.name]=+s.grams||100;
    SHARED_NAMES.add(s.name);
  });
  // 彙整各日餐別營養素，並覆寫當日紀錄的攝取/營養素
  store.mealAgg={};
  store.meals.forEach(m=>{ const d=m.date.slice(0,10); const a=store.mealAgg[d]||(store.mealAgg[d]={k:0,p:0,f:0,c:0});
    a.k+=+m.kcal||0; a.p+=+m.protein||0; a.f+=+m.fat||0; a.c+=+m.carb||0; });
  store.records.forEach(r=>{ const a=store.mealAgg[r.date.slice(0,10)]; if(a){ r.kcal=Math.round(a.k); r.protein=Math.round(a.p); r.fat=Math.round(a.f); r.carb=Math.round(a.c); } });
  renderAll();
}
async function reload(){
  const data = await api("/api/me/all");
  // 造型選擇雙向同步：伺服器有就用伺服器；伺服器沒有但本機有（舊版只存本機）就補傳到伺服器
  try{
    const lfx=localStorage.getItem("tdee_fx"), lrc=localStorage.getItem("tdee_racer");
    if(data.fx){ localStorage.setItem("tdee_fx",data.fx); }
    else if(lfx){ api("/api/cosmetic",{method:"POST",body:JSON.stringify({fx:lfx})}).catch(()=>{}); }
    if(data.racer){ localStorage.setItem("tdee_racer",data.racer); }
    else if(lrc){ api("/api/cosmetic",{method:"POST",body:JSON.stringify({racer:lrc})}).catch(()=>{}); }
    const lsk=localStorage.getItem("tdee_skin");
    if(data.skin){ localStorage.setItem("tdee_skin",data.skin); }
    else if(lsk){ api("/api/cosmetic",{method:"POST",body:JSON.stringify({skin:lsk})}).catch(()=>{}); }
  }catch(e){}
  applyStoreData(data);
  // 存一份到本機，下次開啟先用它「秒畫」再背景更新。
  //   不含 sharedFoods（全站共享庫、會無限成長）→ 控制體積、避免配額爆掉；秒畫不需要它，reload 回來就補上。
  try{ const slim = Object.assign({}, data, { sharedFoods: [] }); localStorage.setItem(storeCacheKey(), JSON.stringify(slim)); }catch(e){}
  scheduleGroupSync();   // 資料更新後，背景自動同步並刷新競賽排行（免手動按更新）
}
// 防抖：資料變動 2.5 秒後，上傳每日統計並刷新寵物（所有人都要，寵物成長/每日任務都靠它）；
//   競賽排行只有參賽者才額外重抓。先前「沒參賽就 return」會導致非參賽者的寵物今日不成長、任務不更新。
let _grpSyncTimer=null;
function scheduleGroupSync(){
  clearTimeout(_grpSyncTimer);
  _grpSyncTimer=setTimeout(async()=>{ try{
    await syncDailyStats();                       // 把今天的統計寫進 daily_stats（寵物 EXP/任務全清都讀這張表）
    if(myGroups&&myGroups.length) await loadGroups();   // 有參賽才刷新排行榜
    if(petData) await loadPet();                  // 刷新寵物（反映今日新成長/任務/全清獎勵）
  }catch(e){} },2500);
}

/* ---------- helpers ---------- */
function val(id){ return document.getElementById(id).value; }
function set(id,t){ const el=document.getElementById(id); if(el) el.textContent=t; }
function show(id){ document.getElementById(id).style.display="block"; }
function hide(id){ document.getElementById(id).style.display="none"; }
function avg(a){ return a.reduce((x,y)=>x+y,0)/a.length; }

/* ---------- 啟動 ---------- */
async function boot(){
  document.getElementById("loginView").classList.add("hidden");
  document.getElementById("appView").classList.remove("hidden");
  document.getElementById("rDate").value=todayStr();
  { const pd=document.getElementById("periodDate"); if(pd) pd.addEventListener("change",()=>{ if(typeof renderPeriod==="function") renderPeriod(); }); }
  document.getElementById("exDate").value=todayStr();
  document.getElementById("foodDate").value=todayStr();
  // 先用上次的本機快取「秒畫」（即使伺服器回應慢，畫面也立刻有資料），再背景抓最新覆蓋
  try{
    const cached=localStorage.getItem(storeCacheKey());
    if(cached){ applyStoreData(JSON.parse(cached)); if(store.profile) applyProfile(store.profile); renderDerived(); restoreCards(); }
  }catch(e){}
  await reload();
  if(store.profile) applyProfile(store.profile);
  renderDerived();
  restoreCards();
  applyTips();
  renderPushUI();        // 提醒通知狀態
  maybeOnboard();        // 首次登入顯示引導
  maybeWeeklyReview();   // 背景補產生上週覆盤（有資料且尚未產生時）
  (async()=>{ await handleJoinParam(); await syncDailyStats(); await loadGroups(); await loadPet(); })();  // 競賽：加入連結→上傳統計→載排行→寵物
}

window.addEventListener("DOMContentLoaded", ()=>{
  pIds.forEach(id=> document.getElementById(id).addEventListener("input",saveProfile));
  document.getElementById("exMin").addEventListener("input",exPreview);
  document.getElementById("auPass").addEventListener("keydown",e=>{ if(e.key==="Enter") doAuth(); });
  if(session) boot();
});
// 註冊 Service Worker（PWA 可安裝 + 離線）
if("serviceWorker" in navigator){
  window.addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(()=>{}));
  // 有新版 service worker 接手時自動重整一次，套用最新版（避免手動清快取）
  let swReloaded=false;
  navigator.serviceWorker.addEventListener("controllerchange",()=>{ if(swReloaded) return; swReloaded=true; location.reload(); });
}
