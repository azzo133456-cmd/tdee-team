/* ---------- 小遊戲：合成冒險（全螢幕遊戲頁） ----------
   遊戲分頁上只有一張入口卡（app_pets.js 的 loadAdvCard），按「進入冒險」才載入這個檔案、打開全螢幕畫面。
   點產生器花 1 點能量掉一件裝備 → 兩件一樣的合成高一階 → 穿到寵物身上 → 自動打怪、升等、往下一關。
   能量來自健康行為與時間回復，由伺服器發；戰鬥結果、金幣、藥水也由伺服器算（規則在 adv_logic.js）。
   操作用「點一下選取、再點目標」而不是拖曳：手機上拖曳會跟頁面捲動打架。
   同步一律排隊（aChain），一次只送一個請求；請求在路上時花掉的能量，回來時從伺服器的數字扣掉。
   畫面：#advHud（上方狀態列）、#advBox（中間可捲動的內容）、#advNav（下方分頁）三塊分開畫，
   戰鬥動畫每一下都重畫 #advBox，但捲動容器本身不換，所以不會一直跳回最上面。 */
let AD=null, AS=null, aSel=null, aMsg="", aFlash=-1;
let aPend={spent:0}, aChain=Promise.resolve(), aTimer=null, aBusy=false, aFightView=null, aAnimTimer=null;
let aTab="battle", aRank=null, aMapOpen=null, aMapPick=null, aTown={mode:"sell", picks:[]}, aOpen=false;

/* ---------- 開關全螢幕 ---------- */
function advOpen(){
  const el=document.getElementById("advFull"); if(!el) return;
  el.style.display=""; document.body.style.overflow="hidden"; aOpen=true;
  if(!(history.state&&history.state.adv)) history.pushState({adv:1},"");   // 手機的返回手勢 → 關掉遊戲，不是離開 App
  loadAdvGame();
}
function advClose(fromPop){
  const el=document.getElementById("advFull"); if(!el||!aOpen) return;
  aOpen=false; el.style.display="none"; document.body.style.overflow="";
  if(aFightView) aSkip();
  aSync();
  if(!fromPop&&history.state&&history.state.adv) history.back();
  if(typeof loadAdvCard==="function") loadAdvCard();
}
window.addEventListener("popstate",()=>{ if(aOpen&&!(history.state&&history.state.adv)) advClose(true); });

async function loadAdvGame(){
  try{
    if(!AD) AD=await (await fetch("adv_data.json")).json();
    const r=await api("/api/game/adv");
    AS=r.state; aPend={spent:0}; aSel=null; aSync.last=JSON.stringify([AS.board,AS.equip]);
    const bits=[];
    if(r.migrated) bits.push(`🏡 合成小屋改版成合成冒險了！舊棋盤上的東西已經換回 ⚡${r.migrated.refund} 能量。`);
    if(r.gained&&r.gained.length) bits.push(`⚡ +${r.gained.length*AS.energyPer} 能量：${r.gained.map(g=>g.label).join("、")}`);
    if(bits.length) aMsg=bits.join("<br>");
    advDraw();
  }catch(e){ aMsg="載入失敗："+e.message; advDraw(); }
}
const aItem=([c,t])=>{ const ch=AD.chains[c], it=ch.items[t-1]; return {e:it[0], n:it[1], ch}; };
// 跟伺服器 heroStats 同一條公式：穿脫裝備時畫面立刻更新，不用等存檔回來
function aHero(){
  const g=AD.gear, e=AS.equip, h=AS.enh||[0,0,0], m=1+0.04*(AS.level-1);
  return {atk:Math.round((8+g.atk[e[0]])*m*(1+0.05*h[0])), hp:Math.round((60+g.hp[e[1]])*m*(1+0.05*h[1])),
    crit:Math.round((g.crit[e[2]]+0.01*h[2])*100)/100, skills:(AS.skills||[]).slice(0,AS.skillSlots), potions:AS.potions||0};
}
// 圖鑑清單：跟伺服器 DEX_LIST 同樣的規則（依區域順序、名字不重複）
function aDexList(){
  const seen=new Set(), out=[];
  AD.regions.forEach(r=>[...r.mobs,r.boss].forEach(([e,name],i)=>{ if(seen.has(name)) return; seen.add(name); out.push({e,name,region:r.name,boss:i===r.mobs.length}); }));
  return out;
}
function aStatText(c,t){
  const g=AD.gear;
  return c===0?`攻擊 +${g.atk[t]}`:c===1?`血量 +${g.hp[t]}`:`暴擊 ${Math.round(g.crit[t]*100)}%`;
}
const aVibe=(ms)=>{ try{ if(navigator.vibrate) navigator.vibrate(ms); }catch(e){} };

/* ---------- 背包操作 ---------- */
function aTap(i){
  if(aFightView) return;
  const b=AS.board;
  if(aSel===null){ if(b[i]) aSel=i; }
  else if(aSel===i){ aSel=null; }
  else{
    const a=b[aSel], x=b[i];
    if(!x){ b[i]=a; b[aSel]=null; aSel=null; aQueue(); }
    else if(a[0]===x[0]&&a[1]===x[1]&&a[1]<AD.chains[a[0]].items.length){
      b[i]=[a[0],a[1]+1]; b[aSel]=null; aSel=null; aFlash=i;
      const r=aItem(b[i]); aMsg=`✨ 合成出 ${r.e} ${r.n}（${aStatText(b[i][0],b[i][1])}）`; aQueue();
    }
    else aSel=i;
  }
  advDraw();
}
function aSpawn(c){
  if(aFightView) return;
  if(AS.energy<=0){ aMsg="⚡ 能量用完了。記錄飲食、運動、喝水都會補能量，也會隨時間慢慢回來。"; advDraw(); return; }
  const i=AS.board.indexOf(null);
  if(i<0){ aMsg="背包滿了：先合成，或到城鎮把用不到的賣掉。"; advDraw(); return; }
  AS.board[i]=[c, Math.random()<0.15?2:1]; AS.energy--; aPend.spent++;
  aSel=null; aFlash=i; aMsg=""; advDraw(); aQueue();
}
function aTrash(){
  if(aSel===null) return;
  const x=AS.board[aSel], r=aItem(x);
  if(x[1]>=4 && !confirm(`確定丟掉 ${r.e} ${r.n}？（到城鎮賣掉可以換金幣）`)) return;
  AS.board[aSel]=null; aSel=null; advDraw(); aQueue();
}
// 穿上選取的裝備；原本那件換回同一格
function aEquip(){
  if(aSel===null||aFightView) return;
  const [c,t]=AS.board[aSel], old=AS.equip[c];
  AS.equip[c]=t; AS.board[aSel]=old?[c,old]:null;
  const r=aItem([c,t]); aMsg=`🎽 穿上 ${r.e} ${r.n}`+(old?`，換下來的放回背包`:"");
  aSel=null; advDraw(); aQueue();
}

/* ---------- 同步 ---------- */
function aQueue(){ clearTimeout(aTimer); aTimer=setTimeout(()=>aSync(),1200); }
/* 存檔（＋可選動作）。全部排進同一條隊伍，前一個回來才送下一個。extra 是動作要帶的參數。 */
function aSync(action,keepalive,extra){
  if(!action) clearTimeout(aTimer);
  const job=aChain.then(()=>aSend(action,keepalive,extra));
  aChain=job.catch(()=>{});
  return job;
}
async function aSend(action,keepalive,extra){
  if(!AS) return null;
  const send={board:AS.board.slice(), equip:AS.equip.slice(), spent:aPend.spent};
  const snap=JSON.stringify([send.board,send.equip]);
  if(!action&&!send.spent&&aSync.last===snap) return null;
  if(action) Object.assign(send,extra||{},{action});
  aPend.spent=0;
  try{
    const r=await api("/api/game/adv/sync",{method:"POST",body:JSON.stringify(send),keepalive:!!keepalive});
    aSync.last=snap;
    const board=AS.board, equip=AS.equip;
    AS={...r.state, board, equip};                          // 棋盤、裝備以本機為準（路上可能又動過）
    AS.energy=Math.max(0, r.state.energy-aPend.spent);      // 路上又花的能量
    if(r.pet){ petData=r.pet; if(typeof renderPet==="function") renderPet(); }
    if(!action) advDraw();
    return r.result;
  }catch(e){
    if(/資料|不正確|不合理/.test(e.message)){                 // 伺服器拒收：直接換成伺服器的版本
      aPend.spent=0; await loadAdvGame(); aMsg=`⚠️ ${e.message}，已重新載入`; advDraw(); return null;
    }
    aPend.spent+=send.spent;                                 // 送不出去就放回去，下次一起送
    aMsg="同步失敗，下次操作時會再送："+e.message; advDraw(); return null;
  }
}
document.addEventListener("visibilitychange",()=>{ if(document.visibilityState==="hidden"&&AS) aSync(null,true); });

/* ---------- 戰鬥（挑戰下一關 / 探索打過的關） ---------- */
function aFight(){ return aBattleGo("fight"); }
function aExplore(stage){ return aBattleGo("explore",{stage}); }
async function aBattleGo(action,extra){
  if(aBusy||aFightView||!AS) return;
  if(action==="explore"&&AS.energy<AS.exploreCost){ aMsg=`⚡ 探索要 ${AS.exploreCost} 點能量`; advDraw(); return; }
  aBusy=true; aSel=null; aMsg="⚔️ 出發！"; aTab="battle"; advScrollTop(); advDraw();
  const pre={level:AS.level, xp:AS.xp, need:AS.need, coinToday:AS.coinToday, gold:AS.gold, potions:AS.potions}, preSlots=AS.skillSlots;   // 動畫播完前先顯示打之前的數字，不劇透
  try{
    const res=await aSync(action,false,extra);
    if(!res) return;
    if(res.error){ aMsg=`⚠️ ${res.error}`; return; }
    // 掉落物馬上放進背包（伺服器已經記了這件的額度），訊息等動畫播完再說
    let dropTxt="";
    if(res.drop){
      const i=AS.board.indexOf(null), r=aItem(res.drop);
      if(i>=0){ AS.board[i]=res.drop; dropTxt=`掉落 ${r.e} ${r.n}`; aQueue(); }
      else dropTxt=`掉落的 ${r.e} ${r.n} 背包放不下，沒撿到`;
    }
    aFightView={res, i:0, dropTxt, pre, preSlots};
    aAnim();
  }finally{ aBusy=false; if(!aFightView) advDraw(); }
}
function aAnim(){
  clearTimeout(aAnimTimer);
  const v=aFightView; if(!v) return;
  if(v.i>=v.res.events.length){ aFightDone(); return; }
  v.i++;
  const ev=v.res.events[v.i-1];
  if(ev&&ev[0]==="h"&&ev[2]) aVibe(40);
  advDraw();
  aAnimTimer=setTimeout(aAnim, 420);
}
function aSkip(){ if(!aFightView) return; clearTimeout(aAnimTimer); aFightView.i=aFightView.res.events.length; aFightDone(); }
function aFightDone(){
  const v=aFightView; if(!v) return;
  const r=v.res, m=r.mon;
  if(r.win){
    aVibe([60,40,60]);
    const bits=[`🎉 打倒 ${m.shiny?"✨閃光":""}${m.e} ${m.name}！經驗 +${r.xp}`];
    if(r.coins) bits.push(`🦴+${r.coins}`);
    if(r.gold) bits.push(`💰+${r.gold}`);
    if(r.capped) bits.push("（今天打怪的骨頭幣已封頂）");
    if(v.dropTxt) bits.push(v.dropTxt);
    if(r.potionsUsed) bits.push(`🧪 用了 ${r.potionsUsed} 瓶藥水`);
    if(r.dexNew) bits.push(`<br>📖 圖鑑新增 ${m.e} ${m.name}（🦴+5）`);
    if(r.dexShinyNew) bits.push(`<br>✨ 第一次打倒閃光${m.name}（🦴+10）`);
    if(r.levelUps) bits.push(`<br>⬆️ 升到 Lv.${AS.level}！`);
    if(r.levelUps&&AS.skillSlots>v.preSlots) bits.push(`<br>🌀 解鎖第 ${AS.skillSlots} 個技能欄，到「技能」分頁裝上吧！`);
    if(r.kind==="fight"&&AS.next.shiny) bits.push(`<br>✨ 下一關出現閃光怪！`);
    if(r.kind==="fight"&&r.stage%10===0) bits.push(`<br>🗺️ 新區域「${AS.next.region}」開放了！`);
    aMsg=bits.join("　");
  }else{
    const tip=m.boss&&AS.skillSlots?"看看頭目的特性，到「技能」換一組再試試；":"";
    const pot=r.potionsUsed?`（🧪 用了 ${r.potionsUsed} 瓶藥水）`:"";
    aMsg=`💥 被 ${m.e} ${m.name} 打倒了${pot}…${tip}合成更好的裝備、到城鎮強化，或訓練升級再來。`;
  }
  aFightView=null; advDraw();
}
async function aTrain(){
  if(aBusy||aFightView||!AS) return;
  if(AS.energy<AS.trainCost){ aMsg=`⚡ 訓練要 ${AS.trainCost} 點能量`; advDraw(); return; }
  aBusy=true;
  try{
    const res=await aSync("train");
    if(res) aMsg=res.error?`⚠️ ${res.error}`:`💪 訓練完成，經驗 +${res.xp}`+(res.levelUps?`　⬆️ 升到 Lv.${AS.level}！`:"");
  }finally{ aBusy=false; advDraw(); }
}
/* 每日寶箱：三個任務都完成才能開，裝備直接放進背包 */
async function aChest(){
  if(aBusy||aFightView||!AS) return;
  aBusy=true;
  try{
    const res=await aSync("chest");
    if(res){
      if(res.error) aMsg=`⚠️ ${res.error}`;
      else{
        const r=aItem(res.drop), i=AS.board.indexOf(null);
        if(i>=0){ AS.board[i]=res.drop; aQueue(); }
        aMsg=`🎁 連續第 ${res.streak} 天！開出 ${r.e} ${r.n}（${res.drop[1]} 階）`+(i<0?"，但背包滿了沒放進去":"")+`　🦴+${res.coins}　💰+${res.gold}`;
      }
    }
  }finally{ aBusy=false; advDraw(); }
}
/* 技能：裝上／卸下，馬上存到伺服器（戰鬥由伺服器算，要用伺服器上的技能） */
async function aToggleSkill(id){
  if(aBusy||aFightView||!AS) return;
  const cur=(AS.skills||[]).slice(0,AS.skillSlots);
  const next=cur.includes(id)?cur.filter(x=>x!==id):cur.length<AS.skillSlots?cur.concat(id):null;
  if(!next){ aMsg=`技能欄滿了（${AS.skillSlots} 格），先卸下一個`; advDraw(); return; }
  aBusy=true;
  try{
    const res=await aSync("skills",false,{skills:next});
    if(res&&res.error) aMsg=`⚠️ ${res.error}`; else aMsg="";
  }finally{ aBusy=false; advDraw(); }
}
async function aLoadRank(){
  try{ aRank=(await api("/api/game/adv/board")).board; }catch(e){ aRank=[]; }
  advDraw();
}

/* ---------- 城鎮：商店、鐵匠、工坊 ---------- */
async function aTownAct(action,extra,ok){
  if(aBusy||!AS) return null;
  aBusy=true;
  try{
    const res=await aSync(action,false,extra);
    if(res) aMsg=res.error?`⚠️ ${res.error}`:ok(res);
    return res;
  }finally{ aBusy=false; advDraw(); }
}
function aBuy(){
  if(AS.potions>=AS.potionMax){ aMsg=`藥水最多帶 ${AS.potionMax} 瓶`; advDraw(); return; }
  if(AS.gold<AS.potionPrice){ aMsg=`💰 金幣不夠（要 ${AS.potionPrice}）`; advDraw(); return; }
  return aTownAct("buy",null,()=>`🧪 買了一瓶回復藥（現在 ${AS.potions} 瓶）`);
}
function aEnhance(slot){
  const lv=AS.enh[slot], cost=30*(lv+1)**2;
  if(lv>=AS.enhMax){ aMsg="已經強化到頂了"; advDraw(); return; }
  if(AS.gold<cost){ aMsg=`💰 金幣不夠（要 ${cost}）`; advDraw(); return; }
  return aTownAct("enhance",{slot},r=>`🔨 ${AD.chains[slot].slot}欄強化到 +${r.level}！`);
}
function aTownMode(m){ aTown={mode:m, picks:[]}; advDraw(); }
function aTownPick(i){
  const x=AS.board[i]; if(!x||aBusy) return;
  const p=aTown.picks, k=p.indexOf(i);
  if(k>=0) p.splice(k,1);
  else{
    const max=aTown.mode==="sell"?1:aTown.mode==="convert"?2:3;
    if(aTown.mode==="brew"&&x[1]>2){ aMsg="釀藥只能用 1～2 階的東西"; advDraw(); return; }
    if(p.length>=max) p.shift();
    p.push(i);
  }
  aMsg=""; advDraw();
}
function aSell(){
  const i=aTown.picks[0], x=AS.board[i]; if(x==null) return;
  const r=aItem(x), price=3*2**(x[1]-1);
  if(x[1]>=5&&!confirm(`確定把 ${r.e} ${r.n}（${x[1]} 階）賣 ${price} 金幣？`)) return;
  AS.board[i]=null; aTown.picks=[];                         // 先從背包拿掉，伺服器會確認價值真的少了
  return aTownAct("sell",{item:x},res=>`💰 賣掉 ${r.e} ${r.n}，金幣 +${res.gold}`);
}
// 轉換配方：兩件同階、不同種 → 指定種類高一階。價值不變（2×2^(t-1) = 2^t），所以在本機做、存檔就好
function aConvert(chain){
  const [a,b]=aTown.picks, x=AS.board[a], y=AS.board[b];
  if(!x||!y||x[1]!==y[1]||x[0]===y[0]||x[1]>=AD.chains[chain].items.length) return;
  AS.board[a]=[chain,x[1]+1]; AS.board[b]=null; aTown.picks=[]; aFlash=a;
  const r=aItem(AS.board[a]); aMsg=`🔁 轉換成 ${r.e} ${r.n}（${x[1]+1} 階）`; advDraw(); aQueue();
}
function aBrew(){
  const items=aTown.picks.map(i=>AS.board[i]);
  if(items.length!==3||items.some(x=>!x||x[1]>2)) return;
  if(AS.potions>=AS.potionMax){ aMsg=`藥水最多帶 ${AS.potionMax} 瓶`; advDraw(); return; }
  aTown.picks.forEach(i=>{ AS.board[i]=null; }); aTown.picks=[];
  return aTownAct("brew",{items},res=>`⚗️ 釀好一瓶回復藥（現在 ${res.potions} 瓶）`);
}

/* ---------- 地圖 ---------- */
function aMapToggle(ri){ aMapOpen=aMapOpen===ri?null:ri; aMapPick=null; advDraw(); }
function aMapSel(s){ aMapPick=aMapPick===s?null:s; advDraw(); }
function aSetTab(t){ aTab=t; aSel=null; aTown.picks=[]; if(t==="rank") aLoadRank(); if(t==="map"&&aMapOpen===null&&AS) aMapOpen=Math.floor((AS.stage-1)/10)%AD.regions.length; advScrollTop(); advDraw(); }
function advScrollTop(){ const s=document.getElementById("advScroll"); if(s) s.scrollTop=0; }

/* ================= 畫面 ================= */
const aBar=(cur,max,col,h)=>`<div style="height:${h||7}px;border-radius:4px;background:rgba(0,0,0,.12);overflow:hidden">`+
  `<div style="height:100%;width:${Math.max(0,Math.min(100,cur/max*100))}%;background:${col};transition:width .3s"></div></div>`;
const aSet=(id,html)=>{ const el=document.getElementById(id); if(el) el.innerHTML=html; };
const aGlyph=(size)=>(typeof petGlyph==="function"&&typeof petData!=="undefined"&&petData)?petGlyph(petData,size):`<span style="font-size:${Math.round(size*0.65)}px">🐾</span>`;
function advDraw(){
  if(!AS||!AD){ aSet("advBox",`<div class="hint" style="text-align:center;padding:40px">${aMsg||"載入中…"}</div>`); return; }
  const v=aFightView, P=v?v.pre:AS;
  // ── 上方狀態列 ──
  aSet("advHud",`<div class="advhud-row"><button class="ghost sm advback" onclick="advClose()">‹ 返回</button>`+
    `<div class="advhud-lv"><div style="display:flex;justify-content:space-between;font-weight:800;font-size:13px"><span>Lv.${P.level}</span>`+
    `<span class="hint" style="font-weight:400;font-size:11px">${P.xp}/${P.need}</span></div>${aBar(P.xp,P.need,"var(--accent)",5)}</div>`+
    `<div class="advhud-res"><span title="能量">⚡${AS.energy}</span><span title="金幣">💰${P.gold}</span><span title="藥水">🧪${P.potions}</span>`+
    `<span title="今天的骨頭幣" class="hint">🦴${P.coinToday}/${AS.coinCap}</span></div></div>`);
  // ── 下方分頁 ──
  const q=AS.daily||{quests:[],claimed:true}, qDone=q.quests.filter(x=>x.done).length;
  const qDot=!q.claimed&&qDone===q.quests.length?`<i class="advdot"></i>`:"";
  const tabs=[["battle","⚔️","冒險"],["map","🗺️","地圖"],["town","🏘️","城鎮"],["quest","📋","任務"],["skill","🌀","技能"],["dex","📖","圖鑑"],["rank","🏆","排行"]];
  aSet("advNav",tabs.map(([k,e,l])=>`<button class="advtab${aTab===k?" on":""}" ${v&&k!=="battle"?"disabled":""} onclick="aSetTab('${k}')">`+
    `<span class="advtab-e">${e}${k==="quest"?qDot:""}${k==="skill"&&!AS.skillSlots?"<i class='advlock'>🔒</i>":""}</span><span>${l}</span></button>`).join(""));
  const msg=aMsg?`<div class="advmsg">${aMsg}</div>`:"";
  const body=aTab==="map"?advMapHtml():aTab==="town"?advTownHtml():aTab==="quest"?advQuestHtml():aTab==="skill"?advSkillHtml()
    :aTab==="dex"?advDexHtml():aTab==="rank"?advRankHtml():advBattleHtml();
  aSet("advBox",msg+body);
}

function advBattleHtml(){
  const v=aFightView, H=v?v.res.hero:aHero(), m=v?v.res.mon:AS.next, glyph=aGlyph(84);
  // ── 戰場 ──
  let hHp=H.hp, mHp=m.hp, hit="", shake="", flash=false;
  if(v){
    for(let k=0;k<v.i;k++){ const [who,,,left]=v.res.events[k]; if(who==="h"||who==="mh"||who==="hx") mHp=left; else hHp=left; }
    const last=v.res.events[v.i-1];
    if(last){
      const [who,n,flag]=last, onMon=who==="h"||who==="mh"||who==="hx", heal=who==="hh"||who==="mh"||who==="hp";
      const txt=who==="hx"?"MISS":who==="hp"?`🧪+${n}`:heal?`+${n}`:who==="m"&&flag?"格擋！":`-${n}${who==="h"&&flag?" 暴擊！":""}`;
      const col=who==="hx"?"#868e96":heal?"#2f9e44":who==="h"&&flag?"#e8590c":who==="m"&&flag?"#1971c2":"#c92a2a";
      hit=`<div class="advfloat" style="${onMon?"right:16%":"left:16%"};color:${col};font-size:${who==="h"&&flag?26:20}px">${txt}</div>`;
      if(who==="h") shake="mon"; else if(who==="m"&&!flag) shake="hero";
      flash=who==="h"&&flag;
    }
  }
  const skillTxt=H.skills&&H.skills.length?H.skills.map(id=>{ const k=AD.skills.find(x=>x.id===id); return k?k.e+k.name:""; }).join(" "):"";
  const where=v&&v.res.kind==="explore"?"🔍 探索・":"";
  const arena=`<div class="advarena${flash?" advflash":""}" style="background:${m.bg}">`+
    `<div class="advarena-title">${where}${m.region}・第 ${m.stage} 關${m.boss?" 👑頭目":""}${m.shiny?" ✨閃光怪":""}</div>`+
    `<div class="advarena-vs">`+
    `<div class="advfighter"><div class="advsprite${shake==="hero"?" advshake":""}${v&&v.res.events[v.i-1]&&v.res.events[v.i-1][0]==="h"?" advlunge-r":""}">${glyph}</div>`+
    `<div class="advhp">❤️ ${hHp}/${H.hp}${H.potions?`　🧪${H.potions}`:""}</div>${aBar(hHp,H.hp,"#2f9e44",9)}</div>`+
    `<div class="advvs">VS</div>`+
    `<div class="advfighter"><div class="advsprite advmon${m.shiny?" advshiny":""}${shake==="mon"?" advshake":""}${v&&v.res.events[v.i-1]&&v.res.events[v.i-1][0]==="m"?" advlunge-l":""}">${m.e}</div>`+
    `<div class="advhp">${m.shiny?"✨":""}${m.name}　❤️ ${mHp}/${m.hp}</div>${aBar(mHp,m.hp,"#e03131",9)}</div></div>`+
    `<div class="advarena-foot">怪物攻擊 ${m.atk}　我：⚔️${H.atk} 💥${Math.round(H.crit*100)}%${skillTxt?"　"+skillTxt:""}</div>`+
    (m.traitText?`<div class="advarena-trait">⚠️ ${m.traitText}</div>`:"")+hit+`</div>`;
  const acts=v?`<div style="text-align:center;margin-top:10px"><button class="ghost" style="width:auto;padding:8px 18px" onclick="aSkip()">跳過動畫 ⏩</button></div>`
    :`<div class="advacts">`+
      `<button ${aBusy?"disabled":""} onclick="aFight()">⚔️ 挑戰第 ${AS.stage} 關</button>`+
      `<button class="ghost" ${aBusy||AS.energy<AS.trainCost?"disabled":""} onclick="aTrain()">💪 訓練 −${AS.trainCost}⚡<br><small>經驗 +${AS.trainXp}</small></button></div>`+
      `<div class="hint" style="margin-top:6px">打贏新的一關給 🦴3（頭目 🦴15、閃光怪 🦴8）、金幣、經驗和一件裝備。同樣的裝備和技能打同一隻怪，結果每次都一樣。藥水會在血量低於 35% 時自動喝。</div>`;
  // ── 裝備欄 ──
  const selX=aSel!==null?AS.board[aSel]:null;
  const slots=`<div class="advsec">🎽 裝備</div><div class="advgrid3">`+
    AD.chains.map(ch=>{
      const t=AS.equip[ch.id], it=t?ch.items[t-1]:null, hl=selX&&selX[0]===ch.id, enh=AS.enh[ch.id];
      return `<div class="advslot${hl?" hl":""}"><div style="font-size:11px;color:var(--sub)">${ch.slot}${enh?` <b style="color:#e8590c">+${enh}</b>`:""}</div>`+
        `<div style="font-size:30px;line-height:1.3">${it?it[0]:"・"}</div>`+
        `<div style="font-size:12px">${it?`${it[1]} ${t}階`:"空"}</div>`+
        `<div style="font-size:10px;color:var(--sub)">${t?aStatText(ch.id,t):"&nbsp;"}</div></div>`;
    }).join("")+`</div>`;
  // ── 產生器 ──
  const gens=`<div class="advsec">點一下花 1 點能量，掉一件裝備到背包</div><div class="advgrid3">`+
    AD.chains.map(c=>`<button class="ghost advgen" ${AS.energy>0&&!v?"":"disabled"} onclick="aSpawn(${c.id})">`+
      `<div style="font-size:26px">${c.gen}</div><div style="font-size:11px">${c.genName}・${c.slot}</div></button>`).join("")+`</div>`;
  // ── 背包 ──
  const board=`<div class="advsec">🎒 背包</div>`+advBoardHtml(i=>`aTap(${i})`, i=>i===aSel, true);
  let selBar=`<div class="hint" style="margin-top:6px;text-align:center">點一件選取，再點另一件一樣的就合成；點空格可以移動。▲＝比身上穿的好。</div>`;
  if(selX){
    const r=aItem(selX), max=selX[1]>=r.ch.items.length, cur=AS.equip[selX[0]];
    const next=max?"已經是最高階":`再一件就合成 ${r.ch.items[selX[1]][0]} ${r.ch.items[selX[1]][1]}`;
    selBar=`<div style="margin-top:8px;text-align:center;font-size:13px">${r.e} <b>${r.n}</b>（${r.ch.slot} ${selX[1]}/${r.ch.items.length}・${aStatText(selX[0],selX[1])}）・${next}</div>`+
      `<div style="display:flex;gap:6px;justify-content:center;margin-top:6px">`+
      `<button class="sm" style="width:auto;padding:6px 14px" ${v?"disabled":""} onclick="aEquip()">🎽 穿上${cur?`（換下 ${cur} 階）`:""}</button>`+
      `<button class="ghost sm" style="width:auto;padding:6px 12px" onclick="aTrash()">🗑</button></div>`;
  }
  return `<div class="advsplit"><div>${arena}${acts}</div><div>${slots}${gens}${board}${selBar}</div></div>`;
}
// 背包格子：城鎮和冒險共用。onTap(i) 回傳 onclick 字串，isSel(i) 決定是否框起來
function advBoardHtml(onTap,isSel,showBetter){
  const cells=AS.board.map((x,i)=>{
    const sel=isSel(i), fl=i===aFlash;
    let inner="";
    if(x){ const r=aItem(x), better=showBetter&&x[1]>AS.equip[x[0]];
      inner=`<span class="advitem">${r.e}</span><span class="advtier">${x[1]}</span>`+
        (better?`<span class="advbetter">▲</span>`:""); }
    return `<div onclick="${onTap(i)}" class="advcell${x?" full":""}" style="box-shadow:${sel?"0 0 0 3px var(--accent) inset":fl?"0 0 0 3px var(--green) inset":"none"}">${inner}</div>`;
  }).join("");
  aFlash=-1;
  return `<div class="advboard" style="grid-template-columns:repeat(${AD.cols},minmax(0,1fr))">${cells}</div>`;
}

function advMapHtml(){
  const cur=AS.stage, R=AD.regions, curR=Math.floor((cur-1)/10)%R.length, round=Math.floor((cur-1)/(10*R.length));
  const glyph=aGlyph(26);
  let html=`<div class="hint" style="margin:4px 0 8px">打過的關卡可以再去「探索」（−${AS.exploreCost}⚡）：閃光怪機率比較高，適合補圖鑑；經驗、金幣減半，有機會掉裝備。</div>`;
  R.forEach((r,ri)=>{
    const base=round*10*R.length+ri*10;                    // 這一輪中，這個區域的第 1 關之前
    const reached=base<cur, cleared=Math.max(0,Math.min(10,cur-1-base)), open=aMapOpen===ri;
    const got=r.mobs.concat([r.boss]).filter(([,n])=>AS.dex&&AS.dex[n]).length;
    html+=`<div class="advregion${reached?"":" locked"}" style="background:${reached?r.bg:"var(--soft)"}">`+
      `<div class="advregion-head" ${reached?`onclick="aMapToggle(${ri})"`:""}>`+
      `<span style="font-size:26px">${reached?r.boss[0]:"🔒"}</span>`+
      `<div style="flex:1;min-width:0"><b>${reached?r.name:"？？？"}</b>${ri===curR?` <span style="display:inline-block;vertical-align:middle">${glyph}</span>`:""}`+
      `<div class="hint">${reached?`第 ${base+1}～${base+10} 關・已過 ${cleared}/10・圖鑑 ${got}/${r.mobs.length+1}`:"打倒前一區的頭目才會開放"}</div></div>`+
      `${reached?`<span class="hint">${open?"▴":"▾"}</span>`:""}</div>`;
    if(open&&reached){
      html+=`<div class="advpath">`;
      for(let k=1;k<=10;k++){
        const s=base+k, done=s<cur, here=s===cur, boss=k===10, sel=aMapPick===s;
        const mon=boss?r.boss:r.mobs[(k-1)%r.mobs.length];
        const cls=done?"done":here?"here":"lock";
        html+=`<div class="advnode ${cls}${sel?" sel":""}${boss?" boss":""}" ${done||here?`onclick="aMapSel(${s})"`:""}>`+
          `<span>${done||here?mon[0]:"・"}</span><small>${here?"▶":done?"✓":s}</small></div>`;
      }
      html+=`</div>`;
      if(aMapPick&&aMapPick>base&&aMapPick<=base+10){
        const s=aMapPick, m=AD.regions[ri], k=s-base, boss=k===10, mon=boss?m.boss:m.mobs[(k-1)%m.mobs.length], d=AS.dex[mon[1]];
        html+=`<div class="advpick"><span style="font-size:34px">${mon[0]}</span><div style="flex:1"><b>第 ${s} 關　${mon[1]}</b>${boss?" 👑":""}`+
          `<div class="hint">${d?`打倒過 ${d[0]} 次${d[1]?`・✨閃光 ${d[1]} 次`:""}`:"還沒打倒過"}</div></div>`+
          (s<cur?`<button style="width:auto;padding:8px 12px" ${aBusy||AS.energy<AS.exploreCost?"disabled":""} onclick="aExplore(${s})">🔍 探索 −${AS.exploreCost}⚡</button>`
            :`<button style="width:auto;padding:8px 12px" ${aBusy?"disabled":""} onclick="aFight()">⚔️ 挑戰</button>`)+`</div>`;
      }
    }
    html+=`</div>`;
  });
  if(round>0) html+=`<div class="hint" style="text-align:center;margin-top:6px">目前是第 ${round+1} 輪，怪物比第一輪強很多。</div>`;
  return html;
}

function advTownHtml(){
  const shop=`<div class="advsec">🏪 商店</div><div class="advcardrow">`+
    `<span style="font-size:30px">🧪</span><div style="flex:1"><b>回復藥</b>　<span class="hint">身上 ${AS.potions}/${AS.potionMax}</span>`+
    `<div class="hint">戰鬥中血量低於 35% 自動喝，回 40% 血。</div></div>`+
    `<button style="width:auto;padding:8px 12px" ${aBusy||AS.potions>=AS.potionMax||AS.gold<AS.potionPrice?"disabled":""} onclick="aBuy()">💰${AS.potionPrice}</button></div>`;
  const smith=`<div class="advsec">🔨 鐵匠（強化欄位，換裝備也不會不見）</div>`+AD.chains.map(ch=>{
    const lv=AS.enh[ch.id], max=lv>=AS.enhMax, cost=30*(lv+1)**2;
    const eff=ch.id===0?`攻擊 +${lv*5}%`:ch.id===1?`血量 +${lv*5}%`:`暴擊 +${lv}%`;
    const nxt=ch.id===0||ch.id===1?"+5%":"+1%";
    return `<div class="advcardrow"><span style="font-size:26px">${ch.items[Math.max(0,AS.equip[ch.id]-1)][0]}</span>`+
      `<div style="flex:1"><b>${ch.slot} +${lv}</b>　<span class="hint">${eff}</span>`+
      `<div style="margin-top:4px">${aBar(lv,AS.enhMax,"#e8590c",5)}</div></div>`+
      `<button style="width:auto;padding:8px 12px" ${max||aBusy||AS.gold<cost?"disabled":""} onclick="aEnhance(${ch.id})">${max?"已滿":`${nxt} 💰${cost}`}</button></div>`;
  }).join("");
  // ── 工坊：賣東西／轉換配方／釀藥，共用一個背包 ──
  const modes=[["sell","💰 賣東西"],["convert","🔁 轉換"],["brew","⚗️ 釀藥"]];
  const picks=aTown.picks.map(i=>AS.board[i]).filter(Boolean);
  let panel="";
  if(aTown.mode==="sell"){
    const x=picks[0];
    panel=x?`<div class="advcardrow"><span style="font-size:28px">${aItem(x).e}</span><div style="flex:1"><b>${aItem(x).n}</b> ${x[1]} 階</div>`+
      `<button style="width:auto;padding:8px 12px" ${aBusy?"disabled":""} onclick="aSell()">賣 💰${3*2**(x[1]-1)}</button></div>`
      :`<div class="hint">點背包裡的一件東西，賣掉換金幣（價格 = 3 × 它值多少能量）。</div>`;
  }else if(aTown.mode==="convert"){
    const ok=picks.length===2&&picks[0][1]===picks[1][1]&&picks[0][0]!==picks[1][0]&&picks[0][1]<AD.chains[0].items.length;
    panel=`<div class="hint">配方：任兩件<b>同階、不同種</b>的東西 → 你指定種類的<b>高一階</b>一件。用多出來的防具換武器之類的。</div>`+
      (ok?`<div class="advgrid3" style="margin-top:6px">`+AD.chains.map(ch=>`<button class="ghost" onclick="aConvert(${ch.id})"><div style="font-size:24px">${ch.items[picks[0][1]][0]}</div><small>${ch.items[picks[0][1]][1]}</small></button>`).join("")+`</div>`
        :`<div class="hint" style="margin-top:4px">已選 ${picks.length}/2${picks.length===2?"：要同階、不同種才行":""}</div>`);
  }else{
    const ok=picks.length===3&&picks.every(x=>x[1]<=2);
    panel=`<div class="hint">配方：任 3 件 <b>1～2 階</b>的東西 → 一瓶回復藥（身上最多 ${AS.potionMax} 瓶）。</div>`+
      (ok?`<button style="margin-top:6px;width:100%" ${aBusy||AS.potions>=AS.potionMax?"disabled":""} onclick="aBrew()">⚗️ 釀藥</button>`
        :`<div class="hint" style="margin-top:4px">已選 ${picks.length}/3</div>`);
  }
  const shop2=`<div class="advsec">🛠️ 工坊</div><div style="display:flex;gap:4px;margin-bottom:6px">`+
    modes.map(([k,l])=>`<button class="ghost sm${aTown.mode===k?" on":""}" style="width:auto;padding:5px 10px" onclick="aTownMode('${k}')">${l}</button>`).join("")+`</div>`+
    panel+advBoardHtml(i=>`aTownPick(${i})`, i=>aTown.picks.includes(i), false);
  return `<div class="advcardrow" style="font-size:15px"><b style="white-space:nowrap">💰 ${AS.gold} 金幣</b><span class="hint">打怪、探索、賣東西、每日寶箱都會拿到</span></div>`+
    `<div class="advsplit"><div>${shop}${smith}</div><div>${shop2}</div></div>`;
}

function advQuestHtml(){
  const q=AS.daily, all=q.quests.every(x=>x.done);
  const rows=q.quests.map(x=>`<div class="advquest${x.done?" done":""}">`+
    `<div style="display:flex;justify-content:space-between;font-size:14px"><span>${x.done?"✅":"⬜"} ${x.label}</span><span class="hint">${x.cur}/${x.n}</span></div>`+
    `<div style="margin-top:6px">${aBar(x.cur,x.n,x.done?"#2f9e44":"var(--accent)")}</div></div>`).join("");
  const it=AD.chains.map(c=>c.items[q.chestTier-1][0]).join(" ／ ");
  const chest=q.claimed?`<div style="text-align:center;margin-top:12px;color:var(--green);font-weight:700">今天的寶箱已經開了，明天再來！</div>`
    :`<button style="margin-top:12px;width:100%;padding:12px" ${all&&!aBusy?"":"disabled"} onclick="aChest()">🎁 開寶箱</button>`+
      `<div class="hint" style="text-align:center;margin-top:4px">今天的寶箱：${q.chestTier} 階裝備一件（${it} 其中之一）＋ 🦴${5+Math.min(q.streak,7)} ＋ 💰${20*q.streak}</div>`;
  const B=[["logged","記錄飲食"],["protein_hit","蛋白達標"],["exercised","有運動"],["water_hit","喝水達標"]];
  const g=AS.granted||{today:[],yesterday:[]};
  const regen=AS.nextRegenMs==null?"":`下一點回復 ${Math.ceil(AS.nextRegenMs/60000)} 分鐘。`;
  const src=`<div class="advsec">⚡ 能量怎麼來</div><div class="hint" style="line-height:1.9">每項健康行為 +${AS.energyPer}（每天各一次）：`+
    B.map(([k,l])=>`${g.today.includes(k)?"✅":"⬜"} ${l}`).join("　")+
    `<br>${g.yesterday.includes("kcal_hit")?"✅":"⬜"} 昨天熱量達標（熱量要等一天過完才算數，所以隔天才發）`+
    `<br>另外每 10 分鐘自動回 1 點，最多回到 ${AS.regenCap}。${regen}</div>`;
  return `<div style="font-size:14px;margin-top:4px">🔥 連續 <b>${q.streak}</b> 天　<span class="hint">每天開寶箱就會累積；越連續，寶箱越好（裝備最高 6 階）。斷一天從頭算。</span></div>`+
    rows+chest+`<div class="hint" style="margin-top:6px">任務每天換一次，大家同一天的任務一樣。</div>`+src;
}
function advSkillHtml(){
  const slots=AS.skillSlots, cur=(AS.skills||[]).slice(0,slots), next=AD.skillSlots.find(l=>l>AS.level);
  const head=`<div style="font-size:14px;margin-top:4px">技能欄 <b>${cur.length}/${slots}</b>`+
    (next?`　<span class="hint">Lv.${next} 再開一格</span>`:"")+`</div>`+
    (slots?"":`<div class="hint" style="margin-top:4px">Lv.${AD.skillSlots[0]} 解鎖第一個技能欄。</div>`);
  const list=AD.skills.map(k=>{
    const on=cur.includes(k.id), can=on||cur.length<slots;
    return `<div class="advcardrow${on?" on":""}">`+
      `<span style="font-size:28px">${k.e}</span><div style="flex:1;min-width:0"><b style="font-size:14px">${k.name}</b><div class="hint">${k.desc}</div></div>`+
      `<button class="${on?"":"ghost "}sm" style="width:auto;padding:6px 12px" ${can&&!aBusy?"":"disabled"} onclick="aToggleSkill('${k.id}')">${on?"卸下":"裝上"}</button></div>`;
  }).join("");
  const traits=AD.regions.map(r=>`${r.boss[0]} ${r.boss[1]}（${r.name}）：${AD.traits[r.trait]}`).join("<br>");
  return head+`<div class="advsplit"><div>${list}</div><div><div class="advsec">👑 頭目特性（換技能的參考）</div><div class="hint" style="line-height:1.9">${traits}</div></div></div>`;
}
function advDexHtml(){
  const dex=AS.dex||{}, list=aDexList(), got=list.filter(x=>dex[x.name]).length, shiny=list.filter(x=>dex[x.name]&&dex[x.name][1]).length;
  let html=`<div style="font-size:14px;margin-top:4px">已收集 <b>${got}/${list.length}</b>　✨閃光 ${shiny}　<span class="hint">第一次打倒 🦴5、第一次打倒閃光版 🦴10。打過的關卡可以到地圖探索，閃光機率比較高。</span></div>`;
  AD.regions.forEach(r=>{
    const items=list.filter(x=>x.region===r.name);
    html+=`<div class="advsec">${r.name}</div><div class="advdex">`+
      items.map(x=>{ const d=dex[x.name];
        return `<div class="advslot" style="${d?"":"opacity:.45"}">`+
          `<div style="font-size:30px;line-height:1.2;${d?"":"filter:grayscale(1) brightness(.4)"}">${x.e}</div>`+
          `<div style="font-size:11px">${d?x.name:"？？？"}${x.boss?" 👑":""}</div>`+
          `<div style="font-size:10px;color:var(--sub)">${d?`打倒 ${d[0]} 次${d[1]?" ✨"+d[1]:""}`:"&nbsp;"}</div></div>`; }).join("")+`</div>`;
  });
  return html;
}
function advRankHtml(){
  if(!aRank) return `<div class="hint" style="text-align:center;padding:16px">載入中…</div>`;
  if(!aRank.length) return `<div class="hint" style="text-align:center;padding:16px">還沒有人開始冒險</div>`;
  const medal=i=>["🥇","🥈","🥉"][i]||`${i+1}.`;
  return `<div class="hint" style="margin:6px 0">比打過的最高關卡，同關比等級。</div>`+aRank.map((x,i)=>
    `<div class="advcardrow${x.me?" on":""}" style="justify-content:space-between">`+
    `<span style="font-size:15px">${medal(i)} ${x.name}</span><span style="font-size:13px">第 ${x.cleared} 關　Lv.${x.level}　📖${x.dex}</span></div>`).join("");
}
