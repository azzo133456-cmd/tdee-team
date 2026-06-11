const API = "";
const SKEY = "tdeeUser_session";
let session = JSON.parse(localStorage.getItem(SKEY) || "null"); // {token,userId,username}
let store = { profile:{}, records:[], exercises:[] };
let chart = null, foodCart = [], authMode = "login";

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
  const C = Object.assign({}, window.FOODS_XLSX || {}, window.FOODS_CHAIN || {}, window.FOODS_DRINKS || {}, window.FOODS_BREAKFAST || {}, window.FOODS_CONVENIENCE || {}, window.FOODS_STREET || {}, window.FOODS_PROTEIN || {}, window.FOODS_PIZZA || {}, window.FOODS_BREAD || {}, window.FOODS_MORECHAINS || {});
  for(const n in C){
    const [k,p,f,c,g] = C[n]; const G=g||100, fac=100/G;
    FOODS_DYN[n]=[Math.round(k*fac*10)/10, Math.round(p*fac*10)/10, Math.round(f*fac*10)/10, Math.round(c*fac*10)/10];
    SERVINGS[n]=G;
  }
  // 50嵐 / 茶湯會：依官方糖量熱量表自動產生各甜度版本
  const LV=[["無糖",0],["1分糖10%",0.1],["微糖30%",0.3],["半糖50%",0.5],["少糖70%",0.7],["全糖",1]];
  const ML=700, S=window.FOODS_5050||{};
  for(const brand in S){
    for(const [name,fullK,sugarG] of S[brand]){
      const nonSugar=Math.max(0,fullK-sugarG*4);     // 茶底＋奶/料的固定熱量
      const fat=Math.round(nonSugar/9*10)/10;          // 推估：非糖熱量視為脂肪
      const fac=100/ML;
      for(const [lvName,lv] of LV){
        const sg=Math.round(sugarG*lv*10)/10;          // 該甜度的糖量(g)
        const kcal=Math.round(nonSugar+sg*4);
        const key=`${brand} ${name}(${lvName})`;
        FOODS_DYN[key]=[Math.round(kcal*fac*10)/10, 0, Math.round(fat*fac*10)/10, Math.round(sg*fac*10)/10];
        SERVINGS[key]=ML;
      }
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
let aiCalls=[], aiLastCall=0;
function aiThrottleOk(path){
  if(!AI_PATHS.some(p=>path.startsWith(p))) return true;
  const now=Date.now();
  if(now-aiLastCall<4000){ const w=Math.ceil((4000-(now-aiLastCall))/1000); throw new Error(`操作太快，請 ${w} 秒後再試一次。`); }
  aiCalls=aiCalls.filter(t=>now-t<60000);
  if(aiCalls.length>=6){ const wait=Math.ceil((60000-(now-aiCalls[0]))/1000); throw new Error(`AI 請求太頻繁，請 ${wait} 秒後再試（每分鐘上限 6 次，避免被系統限流）。`); }
  aiCalls.push(now); aiLastCall=now; return true;
}
async function api(path, opts={}){
  aiThrottleOk(path);
  const headers = Object.assign({"Content-Type":"application/json"}, opts.headers||{});
  if(session) headers["x-token"]=session.token;
  const r = await fetch(API+path, Object.assign({}, opts, {headers}));
  if(r.status===401){ logout(); throw new Error("登入已失效"); }
  if(!r.ok){ const e=await r.json().catch(()=>({})); throw new Error(e.error||"錯誤"); }
  return r.json();
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
function logout(){ localStorage.removeItem(SKEY); session=null; location.reload(); }
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
const pIds=["sex","age","height","weight","act","goal","goalRate","tdeeBasis","targetWeight"];
function applyProfile(p){ pIds.forEach(id=>{ if(p && p[id]!=null) document.getElementById(id).value=p[id]; }); }
function readProfile(){ const o={}; pIds.forEach(id=> o[id]=val(id)); return o; }
let saveTimer=null;
function saveProfile(){
  renderDerived();
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
// 依使用者選的基準回傳要用的 TDEE
function baseTDEE(){
  const R=calcReal(store.records, store.exercises);
  const mode=val("tdeeBasis")||"gross";
  if(mode==="base" && R.tdeeBase) return {tdee:R.tdeeBase, src:"基礎 TDEE(不含運動)", mode:"base"};
  if(R.tdee) return {tdee:R.tdee, src:"真實 TDEE(含運動)", mode:"gross"};
  return {tdee:calcMifflin(), src:"公式估算", mode:"gross"};
}
function applyGoal(tdee){
  const goal=val("goal"), rate=+val("goalRate");
  if(goal==="cut") return Math.round(tdee*(1-rate));
  if(goal==="bulk") return Math.round(tdee*(1+rate*0.5));
  return tdee;
}
function goalTargets(){
  const base=baseTDEE(); if(!base.tdee) return null;
  const target=applyGoal(base.tdee);
  const w=+val("weight")|| (store.records.length? +store.records[store.records.length-1].weight||60 : 60);
  const protein=Math.round(w*2.0), fatKcal=target*0.25, fat=Math.round(fatKcal/9);
  const carb=Math.round(Math.max(0,target-protein*4-fatKcal)/4);
  return {kcal:target, protein, fat, carb, base};
}
// 減重計畫脈絡：把「目標TDEE是否實測、目標體重、目標vs實際每週速度、預計達成日、赤字」整合一包
// 給 AI 教練與報表共用，讓建議都對準『減重進度』而非泛泛營養
function planContext(){
  const base=baseTDEE();
  const t=goalTargets();
  const R=calcReal(store.records, store.exercises);
  const goal=val("goal"), rate=+val("goalRate")||0;
  const wRecs=(store.records||[]).filter(r=>r.weight!=null);
  const curW=wRecs.length?+wRecs[wRecs.length-1].weight:(+val("weight")||null);
  const tgtW=+val("targetWeight")||null;
  const tdeeIsReal=!!(base&&/真實|基礎/.test(base.src||""));
  // 體脂近期變化（取有體脂的最近 ~14 筆，首尾差，負=下降）
  const bfRecs=(store.records||[]).filter(r=>r.body_fat!=null).slice(-14);
  const bfDelta=bfRecs.length>=2?+(+bfRecs[bfRecs.length-1].body_fat-+bfRecs[0].body_fat).toFixed(1):null;
  const bfNow=bfRecs.length?+bfRecs[bfRecs.length-1].body_fat:null;
  // 目標每日赤字與每週應減公斤（減脂才有意義）
  const dailyDeficitTarget = (goal==="cut" && base.tdee) ? Math.round(base.tdee*rate) : 0;
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
  return {
    goal, tdee:base.tdee||null, tdeeSource:base.src||"", tdeeIsReal, dataDays:R.days||0,
    target:t?{kcal:t.kcal,protein:t.protein,fat:t.fat,carb:t.carb}:null,
    weight:curW, targetWeight:tgtW, bfNow, bfDelta,
    dailyDeficitTarget, weeklyTargetKg, weeklyObservedKg,
    dailyDeficitObserved:R.deficit!=null?R.deficit:null, etaText
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
  set("goalBasis", basis);
  drawMacroBar("goalBar","goalLeg",protein,fat,carb);
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
function foodSuggest(){
  const q=val("foodPick").trim(), box=document.getElementById("foodSuggest");
  if(!q){ box.style.display="none"; box.innerHTML=""; return; }
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
  res=res.slice(0,50); window.__fs=res;
  if(!res.length){ box.innerHTML='<div class="sg" style="color:var(--sub)">查無 — 用「📷 掃條碼」或「✏️ 自訂食物」建立</div>'; box.style.display="block"; return; }
  box.innerHTML=res.map((n,i)=>{ const d=foodData(n); const tag=SHARED_NAMES.has(n)?'<span title="共享食物庫" style="color:var(--sub);font-size:11px">👥 </span>':""; const used=(FOOD_STATS[n]?.c||0)>0?'<span title="常用" style="color:var(--sub);font-size:11px">🕘</span>':""; return `<div class="sg" onclick="pickFood(${i})">${tag}${n} ${densityTags(d)}${used}<span style="color:var(--green);float:right">${d?Math.round(d[0]):""}</span></div>`; }).join("");
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
    const hasLevel=/(無糖|分糖|微糖|半糖|少糖|全糖)\)/.test(it.n);  // 50嵐/茶湯會已內含甜度，不重複給選單
    if(foodCat(it.n)==="drink" && !hasLevel){
      const opts=[[1,"全糖"],[0.7,"少糖"],[0.5,"半糖"],[0.3,"微糖"],[0.1,"1分糖"],[0,"無糖"]]
        .map(([v,t])=>`<option value="${v}"${v===lv?" selected":""}>${t}</option>`).join("");
      sugarSel=`<select onchange="setSugar(${i},this.value)" style="padding:5px 4px;font-size:12px;width:64px">${opts}</select>`;
    }
    return `<div class="foodrow"><span class="nm">${it.n} ${densityTags(it.base)}<br><span style="color:var(--sub);font-size:11px">${portionHint(it.n,it.g)}</span></span>`+
      sugarSel+
      `<input type="number" inputmode="decimal" value="${it.g}" onchange="setGram(${i},this.value)" style="width:62px;padding:6px 8px;text-align:right;font-size:14px"><span style="color:var(--sub);font-size:12px">g</span>`+
      `<span class="kc" style="min-width:54px;text-align:right">${Math.round(m.k)}</span>`+
      `<span class="x" onclick="rmFood(${i})">✕</span></div>`;
  }).join("");
  const tot=foodCart.reduce((a,b)=>{const m=cartMacros(b);return {k:a.k+m.k,p:a.p+m.p,f:a.f+m.f,c:a.c+m.c};},{k:0,p:0,f:0,c:0});
  const el=document.getElementById("foodTotal"), sb=document.getElementById("cartSaveBtns");
  if(foodCart.length){ el.style.display="block"; sb.style.display="block";
    el.innerHTML=`<div class="lbl">合計</div><div class="big">${Math.round(tot.k)} kcal</div><div class="hint">蛋白 ${tot.p.toFixed(0)}g · 脂肪 ${tot.f.toFixed(0)}g · 碳水 ${tot.c.toFixed(0)}g</div>`;
  }else{ el.style.display="none"; sb.style.display="none"; }
}
function rmFood(i){ foodCart.splice(i,1); renderFood(); }
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
  ["overview","food","exercise","records"].forEach(t=>document.getElementById("page-"+t).classList.toggle("hidden", t!==name));
  document.querySelectorAll(".bottomnav .nav").forEach(n=>n.classList.toggle("on", n.dataset.tab===name));
  window.scrollTo(0,0);
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
  try{ await api("/api/sharedfood",{method:"POST",body:JSON.stringify({name,kcal:d[0],protein:d[1],fat:d[2],carb:d[3],grams:grams||100,kind:kind||"food"})}); }catch(e){}
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
    document.getElementById("mealPhotoPreview").innerHTML=
      `<img src="${mealPhoto}" style="max-width:120px;border-radius:8px;border:1px solid var(--line)"> <span class="x" style="color:#b5564e;cursor:pointer" onclick="clearMealPhoto()">移除</span>`
      +`<div style="margin-top:6px;"><button class="ghost sm" onclick="analyzePhoto()">✨ AI 辨識熱量</button> <span id="aiHint" class="hint" style="display:inline">AI 估算僅供參考，可再手動微調</span></div>`;
    URL.revokeObjectURL(img.src);
  };
  img.src=URL.createObjectURL(file);
  ev.target.value="";
}
function clearMealPhoto(){ mealPhoto=null; document.getElementById("mealPhotoPreview").innerHTML=""; }
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
    h.innerHTML=`已建立 <b>${added}</b> 項食物（共讀 ${items.length} 張），都已加入下方清單與共享庫，可逐筆改克數。`+
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
      `下方清單已帶入 <b>${serv}g</b>${r.serving>0?"（=標示一份）":"（預設值，請改成你吃的克數）"}，可直接調整。`;
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
    const r=await api("/api/analyze",{method:"POST",body:JSON.stringify({image:mealPhoto,hint})});
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
        +`<div style="margin-top:8px;font-size:13px;">整體份量（一次調整全部）：`
        +[["½",0.5],["原始",1],["1.5",1.5],["2人份",2],["3人份",3]].map(([lbl,f])=>`<button class="ghost sm" style="padding:5px 9px;" onclick="scaleAiPortions(${f})">${lbl}</button>`).join(" ")+`</div>`
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
async function estimateText(){
  const text=val("estText").trim();
  const h=document.getElementById("estHint");
  if(!text){ h.textContent="請先輸入一句描述"; return; }
  foodCart=foodCart.filter(it=>!String(it.n).startsWith("✨ ")); renderFood();
  h.textContent="🔎 估算中…約 3–8 秒";
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
    h.innerHTML=`估算失敗：${e.message} <button class="ghost sm" onclick="estimateText()">🔁 再試</button>`;
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
    const r=await api("/api/coach",{method:"POST",body:JSON.stringify({mode:"report",days:7,
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
  await genWeeklyReview(ws,false);
}
function renderReviews(){
  const box=document.getElementById("reviewList"); if(!box) return;
  const list=store.reviews||[];
  const pill=document.getElementById("reviewCount"); if(pill) pill.textContent=list.length?list.length+" 篇":"";
  if(!list.length){ box.innerHTML='<div class="empty">還沒有覆盤。每週一開 App 會自動產生上週點評，或按上方按鈕手動產生。</div>'; return; }
  box.innerHTML=list.map(r=>{
    const ws=r.week_start.slice(0,10), we=addDaysIso(ws,6);
    const acts=(r.actions||[]).length?`<ul style="margin:6px 0 0;padding-left:18px;font-size:13px;line-height:1.7;">`+r.actions.map(a=>`<li>${a}</li>`).join("")+`</ul>`:"";
    return `<div style="border:1px solid var(--line);border-radius:10px;padding:10px 12px;margin-bottom:8px;">`+
      `<div style="font-weight:600;font-size:13px;color:var(--accent);margin-bottom:4px;">${ws.slice(5)} ~ ${we.slice(5)} 那週</div>`+
      `<div class="hint" style="color:var(--ink);line-height:1.6;">${(r.summary||"").replace(/\n/g,"<br>")}</div>${acts}</div>`;
  }).join("");
}

/* ---------- 群組競賽 ---------- */
let myGroups=[];
const METRIC_LABEL={all:"全能賽",discipline:"自律分",streak:"連續打卡",weightpct:"體重變化%",bodyfat:"體脂變化%",exercise:"運動次數",volume:"訓練量",kcaldays:"熱量達標天數",protein:"蛋白達成率",water:"喝水達成率",poop:"嗯嗯次數",team:"團隊挑戰"};
const PERIOD_LABEL={day:"每日",week:"每週",month:"每月"};
// 計算自己近 35 天的隱私安全統計並上傳（flag 由本機算，體重只供算個人%）
async function syncDailyStats(){
  const t=goalTargets();
  const w=+val("weight")|| (store.records&&store.records.length? +store.records[store.records.length-1].weight||60 : 60);
  const waterGoal=Math.round(w*45/50)*50;
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
    rows.push({ date:ds, logged,
      kcal_hit: !!(t && logged && nut.k<=t.kcal),
      protein_hit: !!(t && logged && nut.p>=t.protein),
      exercised, water_hit: water>=waterGoal,
      ex_count: exsDay.length,
      volume: exsDay.filter(e=>e.kind==="strength").reduce((a,b)=>a+(+b.volume||0),0),
      weight: rec&&rec.weight!=null?+rec.weight:null,
      water_pct: (rec&&rec.water_ml!=null)?Math.round(water/waterGoal*100):null,  // 喝水達成率(已喝/該喝)
      protein_pct: (t&&logged&&t.protein>0)?Math.round(nut.p/t.protein*100):null,  // 蛋白達成率(已吃/目標)
      poop: (rec&&rec.poop!=null)?+rec.poop:null,  // 嗯嗯次數
      body_fat: (rec&&rec.body_fat!=null)?+rec.body_fat:null });  // 體脂%
  }
  if(!rows.length) return;
  try{ await api("/api/dailystats",{method:"POST",body:JSON.stringify({rows})}); }catch(e){}
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
  const medal=(i)=>["🥇","🥈","🥉"][i]||(i+1)+".";
  const today=todayStr();
  box.innerHTML=myGroups.map(g=>{
    const isTeam=g.metric==="team", asc=g.metric==="weightpct"||g.metric==="bodyfat";
    // 賽馬跑道：依分數相對名次定位（領先=最右）
    const scores=g.members.map(m=>m.score);
    const best=asc?Math.min(...scores):Math.max(...scores);
    const worst=asc?Math.max(...scores):Math.min(...scores);
    const range=Math.abs(best-worst)||1;
    // 賽馬跑道：每人一條，上排顯示名次/名字(特效)/分數，下排是自己的角色往🏁前進
    const race=g.members.map((m,i)=>{
      const p=Math.round(Math.abs(m.score-worst)/range*86);   // 0~86%
      const racer=m.racer||"🏁";
      // 角色：頭像圖（avatar）或表情符號
      const runnerInner=(racer==="avatar"&&m.avatar)
        ?`<img src="${m.avatar}" style="width:18px;height:18px;border-radius:50%;object-fit:cover;display:block;">`
        :(racer==="avatar"?"🏁":racer);
      const fxCls=(m.fx&&m.fx!=="fx0")?(" "+m.fx):"";
      const nm=`<span class="namefx${fxCls}" data-emoji="${fxEmoji(m.fx)}">${m.name}</span>`;
      // 各自的賽道皮膚：套在「自己這條跑道」的背景，給所有人看（增加特殊感）
      const sk=skinById(m.skin);
      const laneBg=sk.id?`background:${sk.css};border-radius:8px;padding:0 8px;${sk.dark?"color:#eef;":""}`:"";
      const dashCol=sk.dark?"rgba(255,255,255,.35)":"var(--line)";
      return `<div style="margin:7px 0;${laneBg}">`+
        `<div style="display:flex;align-items:center;gap:5px;font-size:12px;margin-bottom:1px;${sk.id?'padding-top:4px;':''}">`+
          `<span>${medal(i)}</span>`+
          (m.avatar?`<img class="avatar sm" src="${m.avatar}">`:"")+
          `<span style="${m.me?'font-weight:700;'+(sk.dark?'color:#fff;':'color:var(--accent);'):''}">${nm}${m.me?'（我）':''}</span>`+
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
    const msgList=msgs.length?msgs.slice(-6).map(m=>`<div style="font-size:12px;margin:2px 0;"><b style="color:${m.me?'var(--accent)':'var(--ink)'}">${m.name}</b>：${escapeHtml(m.body)}</div>`).join(""):`<div class="hint">還沒有留言，先喊一聲幫大家加油吧！</div>`;
    const msgsHtml=`<details style="margin-top:8px;"><summary style="cursor:pointer;font-size:13px;color:var(--sub);">💬 留言加油（${msgs.length}）</summary>`+
      `<div style="margin-top:4px;max-height:140px;overflow-y:auto;">${msgList}</div>`+
      `<div class="row" style="margin-top:6px;"><div style="flex:1 1 auto;"><input id="gmsg-${g.id}" maxlength="120" placeholder="說句加油/嗆聲（不會洩漏體重）" autocomplete="off"></div>`+
      `<div style="flex:0 0 auto;align-self:flex-end;"><button class="ghost sm" onclick="sendGroupMsg(${g.id})">送出</button></div></div></details>`;
    const myIdx=g.members.findIndex(m=>m.me); const myRank=myIdx>=0?`第 ${myIdx+1}/${g.members.length}`:"";
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
  const w=+val("weight")|| (store.records&&store.records.length? +store.records[store.records.length-1].weight||60 : 60);
  const waterGoal=Math.round(w*45/50)*50;
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
    if(water>=waterGoal) activity+=1;
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
function viewPhoto(id){
  const m=(store.meals||[]).find(x=>String(x.id)===String(id)); if(!m||!m.photo) return;
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
  let html="";
  for(const mt of MEAL_ORDER){
    const g=list.filter(m=>m.meal===mt); if(!g.length) continue;
    const sub=g.reduce((a,b)=>a+(+b.kcal||0),0);
    const photos=g.filter(m=>m.photo).map(m=>`<div style="position:relative;display:inline-block;margin:6px 6px 0 0"><img src="${m.photo}" onclick="viewPhoto('${m.id}')" style="width:64px;height:64px;object-fit:cover;border-radius:8px;border:1px solid var(--line);cursor:pointer"><span onclick="delMealPhoto(${m.id})" style="position:absolute;top:-7px;right:-7px;width:20px;height:20px;line-height:18px;text-align:center;background:#fff;border:1px solid var(--line);border-radius:50%;color:#b5564e;font-size:12px;cursor:pointer">✕</span></div>`).join("");
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
function renderWater(date){
  const cur=waterFor(date), w=+val("weight")||60, goal=Math.round(w*45/50)*50;
  set("waterOut", cur.toLocaleString()+" ml");
  set("waterGoal", `目標約 ${goal.toLocaleString()} ml（體重×45）　${cur>=goal?"✅ 已達標":"還差 "+(goal-cur).toLocaleString()+" ml"}`);
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
  renderNet(); renderRings(d); renderMeals(d); renderWater(d); renderPoop(d);
}

/* ---------- 食譜 ---------- */
function cartTotal(){ return foodCart.reduce((a,b)=>{const m=cartMacros(b);return {k:a.k+m.k,p:a.p+m.p,f:a.f+m.f,c:a.c+m.c};},{k:0,p:0,f:0,c:0}); }
async function saveRecipe(){
  if(!foodCart.length){ alert("清單是空的"); return; }
  const name=prompt("食譜名稱（例如：我的早餐）");
  if(!name||!name.trim()) return;
  const t=cartTotal();
  const nm=name.trim();
  try{
    await api("/api/recipe",{method:"POST",body:JSON.stringify({
      name:nm, items:foodCart,
      kcal:Math.round(t.k), protein:+t.p.toFixed(1), fat:+t.f.toFixed(1), carb:+t.c.toFixed(1)
    })});
    // 整份食譜也上架共享食物庫（以整份總重為一份）
    const totalG=foodCart.reduce((a,it)=>a+(+it.g||0),0)||100;
    const per100=[t.k*100/totalG, t.p*100/totalG, t.f*100/totalG, t.c*100/totalG];
    shareFood("🍱 "+nm, per100, Math.round(totalG), "recipe");
    FOODS_DYN["🍱 "+nm]=per100; SERVINGS["🍱 "+nm]=Math.round(totalG);
    await reload();
    alert("已存成食譜「"+nm+"」，並上架共享食物庫（可直接搜尋「🍱 "+nm+"」）");
  }catch(e){ alert(e.message); }
}
function renderRecipes(){
  const list=store.recipes||[];
  set("recipeCount", list.length?list.length+" 份":"");
  const box=document.getElementById("recipeList");
  if(!list.length){ box.innerHTML='<div class="empty">還沒有食譜。在上方食物計算機組好餐點後按「存成食譜」。</div>'; return; }
  box.innerHTML=list.map(r=>{
    const items=(r.items||[]).map(it=>it.n+(it.g?` ${it.g}g`:"")).join("、");
    return `<div class="foodrow"><span class="nm"><b>${r.name}</b><br><span style="color:var(--sub);font-size:12px">${items}</span></span>`+
      `<span class="kc">${r.kcal||0} kcal</span>`+
      `<span class="x" style="color:var(--accent)" onclick="applyRecipe(${r.id})">套用</span>`+
      `<span class="x" onclick="delRecipe(${r.id})">✕</span></div>`;
  }).join("");
}
function applyRecipe(id){
  const r=(store.recipes||[]).find(x=>x.id===id); if(!r) return;
  foodCart=(r.items||[]).map(it=>{
    const g=it.g||100;
    let base=it.base;
    if(!base) base=(it.k!=null)?[it.k/g*100,(it.p||0)/g*100,(it.f||0)/g*100,(it.c||0)/g*100]:(foodData(it.n)||[0,0,0,0]);
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
function renderPlates(){
  const list=store.plates||[];
  set("plateCount", list.length?list.length+" 個":"");
  const box=document.getElementById("plateList"); if(!box) return;
  if(!list.length){ box.innerHTML='<div class="empty">還沒有餐盤。組好常吃的一餐（可先拍照）後按「存成我的餐盤」，下次一鍵帶入。</div>'; return; }
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
function stEstKcal(sets){ const w=+val("weight")||60; return Math.round(exKcalPerMin(2.0,w)*(sets*2.5)); } // 保守估：每組約2.5分鐘、MET2(含組間休息)
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
function renderExRec(){
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
  box.style.display="block";
  box.innerHTML=`<div class="lbl">${date.slice(5)} 淨熱量（攝取 − 運動消耗）</div>`+
    `<div class="big">${net.toLocaleString()} kcal</div>`+
    `<div class="hint">攝取 ${intake!=null?intake.toLocaleString():"—"} − 運動 ${burn.toLocaleString()}`+
    (target?`<br>對目標（${base.mode==="base"?"不含運動":"含運動"}基準 ${target.toLocaleString()}，比${cmpLbl} ${cmpVal.toLocaleString()}）　${cmpVal<=target?`<span style="color:var(--green)">↓ 還可吃 ${(target-cmpVal).toLocaleString()}</span>`:`<span style="color:var(--warm)">↑ 超出 ${(cmpVal-target).toLocaleString()}</span>`}`:"")+`</div>`;
}
async function delRecord(rid){
  if(!confirm("刪除這筆紀錄？")) return;
  await api("/api/record/"+rid,{method:"DELETE"}); await reload();
}

/* ---------- 真實 TDEE ---------- */
// tdee = 含運動的總 TDEE；tdeeBase = 不含運動的基礎 TDEE；avgBurn = 期間平均每日運動消耗
function calcReal(records, exercises){
  const recs=(records||[]).filter(r=>r.weight!=null).slice(-14);
  const out={tdee:null,tdeeBase:null,avgK:null,avgBurn:0,slopeWk:null,deficit:null,days:recs.length};
  if(recs.length<7) return out;
  const t0=new Date(recs[0].date).getTime();
  const xs=recs.map(r=>(new Date(r.date).getTime()-t0)/86400000), ys=recs.map(r=>+r.weight);
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

/* ---------- 渲染 ---------- */
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
  const box=document.getElementById("dashBox"); if(!box) return;
  const d=todayStr(), t=goalTargets(), nut=dayNutrition(d), burn=burnByDate(d);
  const w=+val("weight")|| (store.records&&store.records.length? +store.records[store.records.length-1].weight||60 : 60);
  const waterGoal=Math.round(w*45/50)*50, water=waterFor(d);
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
      const idx=g.members.findIndex(m=>m.me); const rank=idx>=0?idx+1:"-";
      return `${g.name}：第 ${rank}/${g.members.length}`;
    });
    html+=`<div class="hint" style="margin-top:8px;">🏆 ${parts.join("　·　")}</div>`;
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
  // ── 減重 KPI（最上方，核心）──
  const P=planContext();
  let html="";
  if(P.goal==="cut"){
    const obs=P.weeklyObservedKg;                       // 實測每週kg（負=下降）
    const tgtRate=P.weeklyTargetKg!=null?-Math.abs(P.weeklyTargetKg):null; // 目標每週應為負
    // 是否在軌道：有實測速度且在下降，且達到目標速度的 60% 以上
    let track="—", trackCol="var(--sub)";
    if(obs!=null && tgtRate!=null){
      if(obs<=tgtRate*0.6){ track="✅ 在軌道"; trackCol="var(--green)"; }
      else if(obs<0){ track="偏慢"; trackCol="var(--warm)"; }
      else { track="⚠ 未下降"; trackCol="#b5564e"; }
    }
    const rateTxt=obs!=null?(obs>0?"+":"")+obs+"kg/週":"資料不足";
    const tgtTxt=tgtRate!=null?tgtRate+"kg/週":"—";
    const distTxt=(P.weight!=null&&P.targetWeight!=null)?(+(P.weight-P.targetWeight).toFixed(1))+"kg":"—";
    html+=`<div class="stat-row" style="margin-top:4px;">`+
      stat(rateTxt,"實際週速度",obs!=null&&obs<0?"var(--green)":(obs>0?"#b5564e":""))+
      stat(tgtTxt,"目標週速度")+
      stat(distTxt,"距目標")+
      stat(track,"進度",trackCol)+`</div>`;
    const etaTxt=P.etaText||"需更多體重紀錄";
    const tdeeTxt=P.tdee?P.tdee.toLocaleString()+(P.tdeeIsReal?"":"*"):"—";
    html+=`<div class="hint" style="margin-top:8px;">`+
      `🎯 目標 ${P.targetWeight??"—"}kg｜預計達成：<b>${etaTxt}</b>　·　`+
      `每日攝取目標 ${P.target?P.target.kcal.toLocaleString():"—"} kcal（赤字約 ${P.dailyDeficitTarget||"—"}）　·　`+
      `TDEE ${tdeeTxt} ${P.tdeeIsReal?"（實測）":`（公式估*，已記 ${P.dataDays} 天，滿約7天自動轉實測）`}</div>`;
  }
  // ── 飲食/運動執行面（次要）──
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
  const cmp=document.querySelector("#cmpTbl tbody");
  if(R.tdee){
    set("realTdee",R.tdee.toLocaleString()); set("realTdeeBase",R.tdeeBase.toLocaleString());
    set("realDetail",`根據最近 ${R.days} 天紀錄`);
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
    row("平均每日攝取", R.avgK.toLocaleString()+" kcal", "14 天吃進的平均")+
    row("週體重變化", (R.slopeWk>=0?"+":"")+R.slopeWk.toFixed(2)+" kg", R.slopeWk<0?"下降中":R.slopeWk>0?"上升中":"持平")+
    row("體重反推每日赤字", (R.deficit>=0?"+":"")+R.deficit.toLocaleString()+" kcal", "脂肪 1kg≈7700kcal")+
    row("平均每日運動消耗", R.avgBurn.toLocaleString()+" kcal", "你記錄的運動")+
    row("➊ 總 TDEE（含運動）", "<b>"+R.tdee.toLocaleString()+"</b> kcal", "攝取＋赤字")+
    row("➋ 基礎 TDEE（不含運動）", "<b>"+R.tdeeBase.toLocaleString()+"</b> kcal", "➊ − 運動消耗");
  const goal=val("goal"), rate=+val("goalRate");
  let useGross=R.tdee; if(goal==="cut")useGross=Math.round(R.tdee*(1-rate)); if(goal==="bulk")useGross=Math.round(R.tdee*(1+rate*0.5));
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
function renderDerived(){ calcMifflin(); calcGoal(); renderExRec(); renderEta(); if(store.records){ renderDay(); renderPlan(); renderReport(); renderDashboard(); } }
function renderAll(){ set("curName",session.username); renderDerived(); renderTable(); renderDashboard(); renderPlan(); renderReviews(); renderReport(); renderReal(); renderPoints(); drawChart(); renderExercises(); renderPR(); renderVolTrend(); renderBalance(); renderRecipes(); renderPlates(); renderFavs(); renderShared(); renderDay(); }

async function reload(){
  store = await api("/api/me/all");
  // 造型選擇雙向同步：伺服器有就用伺服器；伺服器沒有但本機有（舊版只存本機）就補傳到伺服器，
  // 確保你選的特效/角色在所有競賽都生效。
  try{
    const lfx=localStorage.getItem("tdee_fx"), lrc=localStorage.getItem("tdee_racer");
    if(store.fx){ localStorage.setItem("tdee_fx",store.fx); }
    else if(lfx){ api("/api/cosmetic",{method:"POST",body:JSON.stringify({fx:lfx})}).catch(()=>{}); }
    if(store.racer){ localStorage.setItem("tdee_racer",store.racer); }
    else if(lrc){ api("/api/cosmetic",{method:"POST",body:JSON.stringify({racer:lrc})}).catch(()=>{}); }
    const lsk=localStorage.getItem("tdee_skin");
    if(store.skin){ localStorage.setItem("tdee_skin",store.skin); }
    else if(lsk){ api("/api/cosmetic",{method:"POST",body:JSON.stringify({skin:lsk})}).catch(()=>{}); }
  }catch(e){}
  store.profile = store.profile||{}; store.recipes = store.recipes||[];
  store.favorites = store.favorites||[]; store.meals = store.meals||[];
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
  scheduleGroupSync();   // 資料更新後，背景自動同步並刷新競賽排行（免手動按更新）
}
// 防抖：資料變動 2.5 秒後，把最新統計上傳並重抓排行榜
let _grpSyncTimer=null;
function scheduleGroupSync(){
  if(!(myGroups&&myGroups.length)) return;   // 沒參賽就不用打 API
  clearTimeout(_grpSyncTimer);
  _grpSyncTimer=setTimeout(async()=>{ try{ await syncDailyStats(); await loadGroups(); }catch(e){} },2500);
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
  document.getElementById("exDate").value=todayStr();
  document.getElementById("foodDate").value=todayStr();
  await reload();
  if(store.profile) applyProfile(store.profile);
  renderDerived();
  restoreCards();
  applyTips();
  renderPushUI();        // 提醒通知狀態
  maybeOnboard();        // 首次登入顯示引導
  maybeWeeklyReview();   // 背景補產生上週覆盤（有資料且尚未產生時）
  (async()=>{ await handleJoinParam(); await syncDailyStats(); await loadGroups(); })();  // 競賽：加入連結→上傳統計→載排行
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
