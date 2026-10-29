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
    if(!action){ if(aPachiView) aSet("advHud",advHudHtml()); else advDraw(); }   // 機台動畫中只更新狀態列，不然機台會整個重來
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
    if(r.rush) bits.push(`<br>🔥 確變中（掉落 +1 階、金幣 ×2）${r.rushLeft?`・還剩 ${r.rushLeft} 關`:"・確變結束"}`);
    if(r.rushStart) bits.push(`<br>🎰 確變突入！接下來 ${r.rushLeft} 關掉落 +1 階、金幣 ×2`);
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
        await aChestReel(res);
        const r=aItem(res.drop), i=AS.board.indexOf(null);
        if(i>=0){ AS.board[i]=res.drop; aQueue(); }
        aMsg=(res.up===2?"🎉 777！":res.up===1?"✨ 升階！":"")+`🎁 連續第 ${res.streak} 天！開出 ${r.e} ${r.n}（${res.drop[1]} 階）`+(i<0?"，但背包滿了沒放進去":"")+`　🦴+${res.coins}　💰+${res.gold}`;
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
  const v=aFightView;
  aSet("advHud",advHudHtml());

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

function advHudHtml(){
  const v=aFightView, P=v?v.pre:aPachiView?{...AS,gold:aPachiView.gold}:AS;
  return `<div class="advhud-row"><button class="ghost sm advback" onclick="advClose()">‹ 返回</button>`+
    `<div class="advhud-lv"><div style="display:flex;justify-content:space-between;font-weight:800;font-size:13px"><span>Lv.${P.level}</span>`+
    `<span class="hint" style="font-weight:400;font-size:11px">${P.xp}/${P.need}</span></div>${aBar(P.xp,P.need,"var(--accent)",5)}</div>`+
    `<div class="advhud-res"><span title="能量">⚡${AS.energy}</span><span title="金幣">💰${P.gold}</span><span title="藥水">🧪${P.potions}</span>`+
    `<span title="今天的骨頭幣" class="hint">🦴${P.coinToday}/${AS.coinCap}</span></div></div>`;
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
  const arena=`<div class="advarena${flash?" advflash":""}${(AS.rush&&!v)||(v&&v.res.rush)?" advrush":""}" style="background:${m.bg}">`+
    `<div class="advarena-title">${where}${m.region}・第 ${m.stage} 關${m.boss?" 👑頭目":""}${m.shiny?" ✨閃光怪":""}</div>`+
    (AS.rush&&!v||v&&v.res.rush?`<div class="advrushbar">🔥 確變時間　${v?"":`剩 ${AS.rush} 關・`}掉落 +1 階、金幣 ×2</div>`:"")+
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
  // ── 產生器：點擊或彈珠（自由切換） ──
  const gens=advGenHtml();
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
  return `<div class="advsec">🎰 遊樂場（只能用金幣）</div><div id="advPachi">${advPachiHtml()}</div>`+
    `<div class="advcardrow" style="font-size:15px"><b style="white-space:nowrap">💰 ${aPachiView?aPachiView.gold:AS.gold} 金幣</b><span class="hint">打怪、探索、賣東西、每日寶箱都會拿到</span></div>`+
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
    rows+chest+`<div id="advChestReel">${advChestReelHtml()}</div>`+`<div class="hint" style="margin-top:6px">任務每天換一次，大家同一天的任務一樣。開箱時會轉一次：聽牌成功寶箱升一階，777 升兩階。</div>`+src;
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

/* ================= 柏青哥 ================= */
const aSleep=(ms)=>new Promise(r=>setTimeout(r,ms));
let aPachiView=null, aChestView=null, aDropView=null, aAim=0;
let aGenMode=(()=>{ try{ return localStorage.getItem("advGenMode")||"tap"; }catch(e){ return "tap"; } })();
function aSetGenMode(m){ aGenMode=m; try{ localStorage.setItem("advGenMode",m); }catch(e){} advDraw(); }
function aSetAim(c){ aAim=c; aSet("advPlinko",advPlinkoHtml()); }
// 三格轉盤：shown 是目前停下來的數字（null＝還在轉）
function aReelsHtml(shown,reach,win,big){
  return `<div class="advreels${win?" win":""}${big?" big":""}">`+shown.map(x=>`<div class="advreel${x==null?" spin":""}">${x==null?"":x}</div>`).join("")+`</div>`+
    (win?`<div class="advreel-msg win">大當り！！</div>`:reach?`<div class="advreel-msg reach">リーチ！</div>`:`<div class="advreel-msg">&nbsp;</div>`);
}

/* ---------- A：遊樂場 ----------
   結果是伺服器一次給的時間軸（珠子落點、每一轉的三格與中不中），這裡只負責「演」：
   - 保留燈先讀：燈的顏色暗示那一轉的期待度（中的那轉比較容易出紅、金）
   - 聽牌分三種：普通、超級（寵物大戰怪物）、激熱（全機台金光＋大戰）
   - 大當：彩帶、金幣跳數、7 是彩虹；確變中整台變紅
   - 音效用 WebAudio 現做（不用下載音檔），可以關
   機台的外框只畫一次，之後只更新各個小區塊（用 id），飛行中的珠子、轉動中的轉盤才不會因為重畫而重來。 */
let aPachiAuto=false;
let aPachiSound=(()=>{ try{ return localStorage.getItem("pzSound")!=="0"; }catch(e){ return true; } })();
const pzEl=(id)=>document.getElementById(id);
const pzHtml=(id,h)=>{ const e=pzEl(id); if(e) e.innerHTML=h; };
const pzCls=(id,c)=>{ const e=pzEl(id); if(e) e.className=c; };
// 跳過時所有等待變 0，時間軸照樣跑完（最後的狀態一樣），只是不演
const pzWait=(ms)=>aPachiView&&aPachiView.skip?Promise.resolve():aSleep(ms);

/* ── 音效 ── */
let pzAudio=null;
function pzTone(freq,dur,type,vol,delay){
  if(!aPachiSound) return;
  try{
    const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return;
    pzAudio=pzAudio||new AC();
    const t=pzAudio.currentTime+(delay||0), o=pzAudio.createOscillator(), g=pzAudio.createGain();
    o.type=type||"square"; o.frequency.setValueAtTime(freq,t);
    g.gain.setValueAtTime(vol||0.05,t); g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    o.connect(g); g.connect(pzAudio.destination); o.start(t); o.stop(t+dur+0.02);
  }catch(e){}
}
const PZ_SFX={
  ball:()=>pzTone(1400+Math.random()*500,0.04,"square",0.02),
  start:()=>{ pzTone(880,0.08,"square",0.05); pzTone(1320,0.1,"square",0.05,0.07); },
  stop:()=>pzTone(330,0.06,"triangle",0.08),
  reach:()=>[523,659,784,1047].forEach((f,i)=>pzTone(f,0.14,"sawtooth",0.04,i*0.09)),
  geki:()=>[392,523,659,784,1047,1319].forEach((f,i)=>pzTone(f,0.16,"square",0.05,i*0.07)),
  hit:()=>pzTone(180,0.12,"sawtooth",0.07),
  win:()=>[523,659,784,1047,784,1047,1319].forEach((f,i)=>pzTone(f,0.18,"square",0.06,i*0.11)),
  lose:()=>{ pzTone(300,0.15,"triangle",0.06); pzTone(220,0.25,"triangle",0.06,0.14); },
};
function aPachiToggleSound(){ aPachiSound=!aPachiSound; try{ localStorage.setItem("pzSound",aPachiSound?"1":"0"); }catch(e){} pzHtml("pzSoundBtn",aPachiSound?"🔊":"🔇"); if(aPachiSound) PZ_SFX.start(); }
function aPachiToggleAuto(){ aPachiAuto=!aPachiAuto; pzHtml("pzFoot",pzFootHtml()); if(aPachiAuto&&!aPachiView&&!aBusy) aPachi(); }

/* ── 先讀：保留燈顏色。中的那轉偏紅金，沒中偏白藍；聽牌落空介於中間 ── */
const PZ_COLORS=["white","blue","green","red","gold"];
function pzPick(weights){ let x=Math.random(), i=0; for(;i<weights.length-1;i++){ if((x-=weights[i])<0) break; } return PZ_COLORS[i]; }
function pzHoldColor(spin){
  if(!spin) return "white";
  if(spin.win) return pzPick([0.1,0.15,0.25,0.32,0.18]);
  if(spin.reach) return pzPick([0.35,0.3,0.22,0.12,0.01]);
  return pzPick([0.72,0.2,0.07,0.01,0]);
}
// 聽牌種類：中的那轉比較容易出超級、激熱
function pzReachType(win){
  const x=Math.random();
  if(win) return x<0.2?"geki":x<0.6?"super":"normal";
  return x<0.03?"geki":x<0.3?"super":"normal";
}

/* ── 機台外框（只在整頁重畫時畫一次） ── */
function advPachiHtml(){
  const pz=AS.pachi, v=aPachiView, kaku=v?v.kaku:pz.kaku;
  return `<div id="pzMachine" class="advmachine pz${kaku?" kaku":""}">`+
    `<div class="advmachine-top"><b>🎰 健康機台</b><span style="display:flex;gap:8px;align-items:center">`+
      `<span id="pzMode">${pzModeHtml(kaku)}</span>`+
      `<button id="pzSoundBtn" class="pzicon" onclick="aPachiToggleSound()" title="音效">${aPachiSound?"🔊":"🔇"}</button></span></div>`+
    `<div class="advmachine-face pzface" id="pzFace">`+
      `<div id="pzReels">${pzReelsHtml(v?v.reels:[7,7,7].map(n=>({n,spin:false})),"")}</div>`+
      `<div id="pzMsg" class="advreel-msg">&nbsp;</div>`+
      `<div id="pzStage" class="pzstage"></div>`+
      `<div id="pzBanner" class="advbanner">&nbsp;</div>`+
      `<div class="advholds">保留 <span id="pzHolds">${pzHoldsHtml(v?v.holds:[])}</span></div>`+
      `<div id="pzFx" class="pzfx"></div>`+
    `</div>`+
    `<div class="pzmascot"><span class="pzpet">${aGlyph(34)}</span><span id="pzSay" class="pzsay">${v?"":"今天也來一發？"}</span></div>`+
    `<div class="advpins" id="pzField"><div id="pzBalls"></div><div class="advpockets"><span id="pzP1">退3</span><span></span><span id="pzP2" class="start">入賞</span><span></span><span id="pzP3">退3</span></div></div>`+
    `<div class="advmachine-foot" id="pzFoot">${pzFootHtml()}</div></div>`;
}
const pzModeHtml=(kaku)=>kaku?`<b class="advkaku pzrush">🔥 RUSH 確變 ${kaku}</b>`:`<span style="opacity:.8">通常</span>`;
function pzReelsHtml(reels,cls){
  return `<div class="advreels big pzreels ${cls||""}">`+reels.map((r,i)=>r.spin
    ?`<div class="advreel pzspin${r.slow?" slow":""}"><div class="pzstrip">${[1,2,3,4,5,6,7,1,2,3].map(n=>`<span>${n}</span>`).join("")}</div></div>`
    :`<div class="advreel${r.bump?" pzbump":""}${r.n===7?" seven":""}">${r.n}</div>`).join("")+`</div>`;
}
const pzHoldsHtml=(holds)=>[0,1,2,3].map(i=>`<i class="advhold${holds[i]?" on c-"+holds[i]:""}"></i>`).join("");
function pzFootHtml(){
  const pz=AS.pachi, v=aPachiView, cost=pz.price*pz.perPlay;
  const poor=AS.gold<cost;
  // 不能打的時候直接寫在按鈕上為什麼，不然只看到按鈕變灰，會以為壞了
  const label=poor?`金幣不夠（要 💰${cost}，有 💰${AS.gold}）`:`🎯 發射 ${pz.perPlay} 顆（💰${cost}）`;
  const main=v?`<button class="ghost" onclick="aPachiSkip()">跳過 ⏩</button>`
    :`<button ${aBusy||poor?"disabled":""} onclick="aPachi()">${label}</button>`;
  return `<div class="pzbtns">${main}<button class="ghost pzauto${aPachiAuto?" on":""}" onclick="aPachiToggleAuto()">🔁 自動${aPachiAuto?"中":""}</button></div>`+
    `<div class="hint" style="margin-top:4px">今天打了 ${pz.ballsToday} 顆。珠子掉進中央入賞口就轉一次，三個一樣大當（💰40，7 是 💰100＋4 階裝備）；奇數大當進確變，接下來 5 轉更容易中。保留燈越紅、越金越有機會。長期算下來是會輸的，玩玩就好。</div>`;
}
const pzSay=(t)=>pzHtml("pzSay",t);

/* ── 珠子：每顆一個獨立的元素，沿著隨機的鋸齒路徑落到洞裡，動畫結束自己消失 ── */
function pzBall(pocket){
  const box=pzEl("pzBalls"); if(!box||!box.appendChild) return;
  const end=[8+Math.random()*10,30,50,70,50][pocket]+(pocket===0&&Math.random()<0.5?74:0);
  const b=document.createElement("i"); b.className="pzball";
  b.style.setProperty("--x0",(46+Math.random()*8)+"%");
  b.style.setProperty("--x1",(20+Math.random()*60)+"%");
  b.style.setProperty("--x2",(15+Math.random()*70)+"%");
  b.style.setProperty("--x3",end+"%");
  box.appendChild(b);
  setTimeout(()=>{ try{ b.remove(); }catch(e){} },1000);
  if(pocket===2||pocket===4){ setTimeout(()=>{ const p=pzEl("pzP2"); if(p&&p.classList){ p.classList.add("lit"); setTimeout(()=>p.classList.remove("lit"),300); } },700); }
}
/* ── 大當的彩帶 ── */
function pzConfetti(big){
  const fx=pzEl("pzFx"); if(!fx||!fx.appendChild) return;
  const icons=big?["🌈","💰","✨","⭐","🎉"]:["💰","✨","🎉"];
  for(let k=0;k<(big?34:20);k++){
    const s=document.createElement("span"); s.className="pzconf"; s.textContent=icons[k%icons.length];
    s.style.left=Math.random()*100+"%"; s.style.animationDelay=Math.random()*0.5+"s"; s.style.fontSize=(14+Math.random()*14)+"px";
    fx.appendChild(s); setTimeout(()=>{ try{ s.remove(); }catch(e){} },2400);
  }
}
async function pzCountUp(to,prefix){
  for(let k=1;k<=10;k++){ pzHtml("pzBanner",`${prefix} 💰+${Math.round(to*k/10)}`); await pzWait(55); }
}
/* ── 超級聽牌：寵物對決怪物，三回合交手，最後一擊決定結果 ── */
async function pzBattle(win){
  const R=AD.regions[Math.floor(Math.random()*AD.regions.length)], mon=Math.random()<0.4?R.boss:R.mobs[Math.floor(Math.random()*R.mobs.length)];
  const draw=(cls,txt)=>pzHtml("pzStage",`<div class="pzvs ${cls}"><span class="pzfighter me">${aGlyph(46)}</span><span class="pzvstxt">${txt}</span><span class="pzfighter foe">${mon[0]}</span></div>`);
  draw("in",`VS ${mon[1]}`); await pzWait(700);
  for(let k=0;k<2;k++){
    draw(k%2?"foehit":"mehit",k%2?"！":"喝！"); PZ_SFX.hit(); await pzWait(420);
    draw("",`VS ${mon[1]}`); await pzWait(240);
  }
  if(win){ draw("finish win","必殺！！"); PZ_SFX.hit(); aVibe([40,30,90]); await pzWait(800); }
  else{ draw("finish lose","被反擊了…"); PZ_SFX.hit(); await pzWait(800); }
  pzHtml("pzStage","");
}

async function aPachi(){
  if(aBusy||aPachiView||!AS) return;
  const pz=AS.pachi, cost=pz.price*pz.perPlay;
  if(AS.gold<cost){ aPachiAuto=false; aMsg=`💰 金幣不夠（要 ${cost}）`; advDraw(); return; }
  aBusy=true; aMsg="";
  const pre=AS.gold;
  try{
    const res=await aSync("pachi");
    if(!res){ aPachiAuto=false; return; }
    if(res.error){ aPachiAuto=false; aMsg=`⚠️ ${res.error}`; return; }
    const spins=res.events.filter(e=>e[0]==="spin").map(e=>({win:e[3],reach:e[2]}));
    const v=aPachiView={res, gold:pre-cost, kaku:pz.kaku, holds:[], reels:[7,7,7].map(n=>({n,spin:false})), skip:false};
    for(const it of res.items){ const k=AS.board.indexOf(null); if(k>=0) AS.board[k]=it; }   // 777 送的裝備
    if(res.items.length) aQueue();
    advDraw();
    pzSay("發射！"); PZ_SFX.start();
    let nextHold=0;
    for(const ev of res.events){
      if(ev[0]==="ball"){
        pzBall(ev[1]); PZ_SFX.ball();
        if(ev[1]===2){ v.holds.push(pzHoldColor(spins[nextHold++])); pzHtml("pzHolds",pzHoldsHtml(v.holds));
          const c=v.holds[v.holds.length-1]; if(c==="red"||c==="gold"){ pzSay(c==="gold"?"金色保留！？":"紅色保留…有機會！"); PZ_SFX.start(); } }
        if(ev[1]===1||ev[1]===3){ v.gold+=3; aSet("advHud",advHudHtml()); }
        await pzWait(200);
      }else{
        await pzSpin(v,ev);
      }
    }
    await pzWait(500);
    if(aPachiView) aPachiDone();
  }finally{
    aBusy=false;
    if(!aPachiView) advDraw();
    if(aPachiAuto&&aOpen!==false) setTimeout(()=>{ if(aPachiAuto&&!aPachiView&&!aBusy&&aTab==="town") aPachi(); },700);
  }
}
async function pzSpin(v,ev){
  const [,r,reach,win,prize,enter,kaku]=ev;
  v.holds.shift(); pzHtml("pzHolds",pzHoldsHtml(v.holds));
  v.reels=[0,1,2].map(()=>({spin:true})); pzHtml("pzReels",pzReelsHtml(v.reels)); pzHtml("pzMsg","&nbsp;"); pzHtml("pzBanner","&nbsp;");
  await pzWait(520);
  v.reels[0]={n:r[0],bump:true}; pzHtml("pzReels",pzReelsHtml(v.reels)); PZ_SFX.stop(); await pzWait(300);
  v.reels[1]={n:r[1],bump:true};
  const isReach=r[0]===r[1];
  if(isReach){
    const type=pzReachType(win);
    v.reels[2]={spin:true,slow:true};
    pzHtml("pzReels",pzReelsHtml(v.reels,"reach")); PZ_SFX.stop();
    pzCls("pzMsg","advreel-msg reach"); pzHtml("pzMsg","リーチ！"); PZ_SFX.reach(); aVibe(30);
    pzSay(type==="geki"?"這、這個光是…！？":type==="super"?"上吧！我來決鬥！":"來吧來吧…");
    if(type==="geki"){ pzCls("pzMachine",`advmachine pz geki${v.kaku?" kaku":""}`); pzCls("pzMsg","advreel-msg geki"); pzHtml("pzMsg","激熱！！"); PZ_SFX.geki(); aVibe([60,40,60]); await pzWait(900); }
    if(type==="normal") await pzWait(1300);
    else await pzBattle(win);
  }else{
    pzHtml("pzReels",pzReelsHtml(v.reels)); PZ_SFX.stop(); await pzWait(280);
  }
  v.reels[2]={n:r[2],bump:true}; pzHtml("pzReels",pzReelsHtml(v.reels,win?"win":"")); PZ_SFX.stop();
  v.kaku=kaku;
  if(win){
    const seven=r[0]===7;
    pzCls("pzMachine",`advmachine pz${seven?" rainbow":""}${kaku?" kaku":""}`);
    pzCls("pzMsg","advreel-msg win"); pzHtml("pzMsg",seven?"777 超大當り！！":"大當り！！");
    PZ_SFX.win(); aVibe([80,40,80,40,120]); pzConfetti(seven);
    pzSay(seven?"7！！是 7！！":"中了！！");
    v.gold+=prize; aSet("advHud",advHudHtml());
    await pzCountUp(prize, seven?"🌈":"🎉");
    if(seven) pzHtml("pzBanner",`🌈 💰+${prize}　＋ 4 階裝備！`);
    if(enter){ pzHtml("pzMode",pzModeHtml(kaku)); pzCls("pzMachine",`advmachine pz kaku${seven?" rainbow":""}`); await pzWait(500); pzHtml("pzBanner",`🔥 確變突入！接下來 ${kaku} 轉`); pzSay("確變！繼續繼續！"); }
    await pzWait(1300);
    pzCls("pzMachine",`advmachine pz${kaku?" kaku":""}`);
  }else{
    pzCls("pzMsg","advreel-msg"); pzHtml("pzMsg",isReach?"可惜…":"&nbsp;");
    if(isReach){ PZ_SFX.lose(); pzSay("差一點點…"); }
    pzHtml("pzMode",pzModeHtml(kaku));
    if(!kaku) pzCls("pzMachine","advmachine pz");
    await pzWait(isReach?700:250);
  }
}
function aPachiSkip(){ if(aPachiView){ aPachiView.skip=true; aPachiAuto=false; } }
function aPachiDone(){
  const r=aPachiView.res;
  aPachiView=null;
  aMsg=r.wins?`🎰 這輪大當 ${r.wins} 次！金幣 +${r.gold}（花 ${r.cost}）`+(r.items.length?`，送 ${r.items.length} 件 4 階裝備`:""):`🎰 這輪沒中，退回 ${r.gold} 金幣（花 ${r.cost}）`;
  advDraw();
}
function aPachiDrawPart(){ aSet("advHud",advHudHtml()); }

/* ---------- B：寶箱轉盤（開箱時播） ---------- */
async function aChestReel(res){
  aChestView={res, shown:[null,null,null], reach:false, win:false};
  const v=aChestView, r=res.reels, draw=()=>aSet("advChestReel",advChestReelHtml());
  draw(); await aSleep(500);
  v.shown=[r[0],null,null]; draw(); await aSleep(350);
  v.shown=[r[0],r[1],null]; v.reach=r[0]===r[1]; draw(); await aSleep(v.reach?1200:350);
  v.shown=r.slice(); v.win=res.up>0; draw(); if(v.win) aVibe([80,40,80]);
  await aSleep(v.win?900:300);
  aChestView=null;
}
function advChestReelHtml(){
  const v=aChestView; if(!v) return "";
  const up=v.win?(v.res.up===2?"🎉 777！寶箱升兩階！":"✨ 寶箱升一階！"):"";
  return `<div class="advmachine" style="margin-top:12px">${aReelsHtml(v.shown,v.reach&&!v.win,v.win,true)}<div class="advbanner">${up||"&nbsp;"}</div></div>`;
}

/* ---------- C：彈珠產生器 ---------- */
async function aDrop(){
  if(aBusy||aFightView||aDropView||!AS) return false;
  if(AS.energy<1){ aMsg="⚡ 能量用完了。記錄飲食、運動、喝水都會補能量，也會隨時間慢慢回來。"; advDraw(); return false; }
  if(AS.board.indexOf(null)<0){ aMsg="背包滿了：先合成，或到城鎮把用不到的賣掉。"; advDraw(); return false; }
  aBusy=true; aMsg="";
  try{
    const res=await aSync("drop",false,{chain:aAim});
    if(!res||res.error){ if(res) aMsg=`⚠️ ${res.error}`; return false; }
    aDropView={res, step:0};
    for(let s=1;s<=6;s++){ aDropView.step=s; aSet("advPlinko",advPlinkoHtml()); await aSleep(120); }
    const i=AS.board.indexOf(null), r=aItem(res.item);
    if(i>=0){ AS.board[i]=res.item; aFlash=i; aQueue(); }
    aMsg=res.item[1]>=3?`🎯 掉進邊邊的洞！${r.e} ${r.n}（${res.item[1]} 階）`:"";
    if(res.item[1]>=3) aVibe([60,30,60]);
    return true;
  }finally{ aDropView=null; aBusy=false; advDraw(); }
}
async function aDropMany(n){ for(let k=0;k<n;k++){ if(!(await aDrop())) break; } }
function advPlinkoHtml(){
  const v=aDropView, ch=AD.chains[aAim], T=AS.dropTiers||[3,2,1,1,1,2,3];
  let ball="";
  if(v){
    const s=v.step, sum=v.res.path.slice(0,s).reduce((a,b)=>a+b,0);
    const x=50+(sum-s/2)*(100/7), y=8+s*13;
    ball=`<i class="advpl-ball" style="left:${x}%;top:${y}%"></i>`;
  }
  const pins=[];
  for(let r=0;r<6;r++) for(let k=0;k<=r;k++) pins.push(`<i class="advpl-pin" style="left:${50+(k-r/2)*(100/7)}%;top:${14+r*13}%"></i>`);
  const pockets=T.map((t,k)=>`<div class="advpl-pocket${t>=3?" hot":""}${v&&v.step===6&&v.res.pocket===k?" hit":""}"><span>${ch.items[t-1][0]}</span><small>${t}階</small></div>`).join("");
  return `<div class="advplinko"><div class="advpl-field">${pins.join("")}${ball}</div><div class="advpl-pockets">${pockets}</div></div>`;
}
function advGenHtml(){
  const v=aFightView;
  const tog=`<div style="display:flex;gap:4px;margin:14px 0 6px;align-items:center"><span class="advsec" style="margin:0;flex:1">產生裝備（每次 1⚡）</span>`+
    [["tap","👆 點擊"],["plinko","🎯 彈珠"]].map(([k,l])=>`<button class="ghost sm${aGenMode===k?" on":""}" style="width:auto;padding:4px 10px" onclick="aSetGenMode('${k}')">${l}</button>`).join("")+`</div>`;
  if(aGenMode!=="plinko")
    return tog+`<div class="advgrid3">`+AD.chains.map(c=>`<button class="ghost advgen" ${AS.energy>0&&!v?"":"disabled"} onclick="aSpawn(${c.id})">`+
      `<div style="font-size:26px">${c.gen}</div><div style="font-size:11px">${c.genName}・${c.slot}</div></button>`).join("")+`</div>`;
  const aim=`<div class="advgrid3">`+AD.chains.map(c=>`<button class="ghost sm${aAim===c.id?" on":""}" onclick="aSetAim(${c.id})">瞄準 ${c.items[0][0]} ${c.slot}</button>`).join("")+`</div>`;
  return tog+aim+`<div id="advPlinko">${advPlinkoHtml()}</div>`+
    `<div class="advgrid3" style="grid-template-columns:2fr 1fr;margin-top:6px">`+
    `<button ${aBusy||v||AS.energy<1?"disabled":""} onclick="aDrop()">🎯 發射 −1⚡</button>`+
    `<button class="ghost" ${aBusy||v||AS.energy<5?"disabled":""} onclick="aDropMany(5)">連發 ×5</button></div>`+
    `<div class="hint" style="margin-top:4px">珠子掉進哪個洞決定幾階，兩邊的洞最難掉進去（3 階）。種類是你瞄準的那一種。</div>`;
}
