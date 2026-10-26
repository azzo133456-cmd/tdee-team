/* ---------- 小遊戲：合成冒險（取代合成小屋） ----------
   點產生器花 1 點能量掉一件裝備 → 兩件一樣的合成高一階 → 穿到寵物身上 → 自動打怪、升等、往下一關。
   能量來自健康行為與時間回復，由伺服器發；戰鬥結果也由伺服器算（規則在 adv_logic.js）。
   操作用「點一下選取、再點目標」而不是拖曳：手機上拖曳會跟頁面捲動打架。
   同步一律排隊（aChain），一次只送一個請求；請求在路上時花掉的能量，回來時從伺服器的數字扣掉。 */
let AD=null, AS=null, aSel=null, aMsg="", aFlash=-1;
let aPend={spent:0}, aChain=Promise.resolve(), aTimer=null, aBusy=false, aFightView=null, aAnimTimer=null;
async function loadAdvGame(){
  const card=document.getElementById("advCard"); if(!card) return;
  try{
    if(!AD) AD=await (await fetch("adv_data.json")).json();
    const r=await api("/api/game/adv");
    AS=r.state; aPend={spent:0}; aSel=null; aSync.last=JSON.stringify([AS.board,AS.equip]);
    card.style.display="";
    const bits=[];
    if(r.migrated) bits.push(`🏡 合成小屋改版成合成冒險了！舊棋盤上的東西已經換回 ⚡${r.migrated.refund} 能量。`);
    if(r.gained&&r.gained.length) bits.push(`⚡ +${r.gained.length*AS.energyPer} 能量：${r.gained.map(g=>g.label).join("、")}`);
    if(bits.length) aMsg=bits.join("<br>");
    advDraw();
  }catch(e){ card.style.display="none"; }
}
const aItem=([c,t])=>{ const ch=AD.chains[c], it=ch.items[t-1]; return {e:it[0], n:it[1], ch}; };
// 跟伺服器 heroStats 同一條公式：穿脫裝備時畫面立刻更新，不用等存檔回來
function aHero(){
  const g=AD.gear, e=AS.equip, m=1+0.04*(AS.level-1);
  return {atk:Math.round((8+g.atk[e[0]])*m), hp:Math.round((60+g.hp[e[1]])*m), crit:g.crit[e[2]]};
}
function aStatText(c,t){
  const g=AD.gear;
  return c===0?`攻擊 +${g.atk[t]}`:c===1?`血量 +${g.hp[t]}`:`暴擊 ${Math.round(g.crit[t]*100)}%`;
}
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
  if(i<0){ aMsg="背包滿了：先合成，或選一個用不到的按 🗑 丟掉。"; advDraw(); return; }
  AS.board[i]=[c, Math.random()<0.15?2:1]; AS.energy--; aPend.spent++;
  aSel=null; aFlash=i; aMsg=""; advDraw(); aQueue();
}
function aTrash(){
  if(aSel===null) return;
  const x=AS.board[aSel], r=aItem(x);
  if(x[1]>=4 && !confirm(`確定丟掉 ${r.e} ${r.n}？`)) return;
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
function aQueue(){ clearTimeout(aTimer); aTimer=setTimeout(()=>aSync(),1200); }
/* 存檔（＋可選動作 fight / train）。全部排進同一條隊伍，前一個回來才送下一個。 */
function aSync(action,keepalive){
  if(!action) clearTimeout(aTimer);
  const job=aChain.then(()=>aSend(action,keepalive));
  aChain=job.catch(()=>{});
  return job;
}
async function aSend(action,keepalive){
  if(!AS) return null;
  const send={board:AS.board.slice(), equip:AS.equip.slice(), spent:aPend.spent};
  const snap=JSON.stringify([send.board,send.equip]);
  if(!action&&!send.spent&&aSync.last===snap) return null;
  if(action) send.action=action;
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

async function aFight(){
  if(aBusy||aFightView||!AS) return;
  aBusy=true; aSel=null; aMsg="⚔️ 出發！"; advDraw();
  const pre={level:AS.level, xp:AS.xp, need:AS.need, coinToday:AS.coinToday};   // 動畫播完前先顯示打之前的數字，不劇透
  try{
    const res=await aSync("fight");
    if(!res) return;
    // 掉落物馬上放進背包（伺服器已經記了這件的額度），訊息等動畫播完再說
    let dropTxt="";
    if(res.drop){
      const i=AS.board.indexOf(null), r=aItem(res.drop);
      if(i>=0){ AS.board[i]=res.drop; dropTxt=`掉落 ${r.e} ${r.n}`; aQueue(); }
      else dropTxt=`掉落的 ${r.e} ${r.n} 背包放不下，沒撿到`;
    }
    aFightView={res, i:0, dropTxt, pre};
    aAnim();
  }finally{ aBusy=false; if(!aFightView) advDraw(); }
}
function aAnim(){
  clearTimeout(aAnimTimer);
  const v=aFightView; if(!v) return;
  if(v.i>=v.res.events.length){ aFightDone(); return; }
  v.i++; advDraw();
  aAnimTimer=setTimeout(aAnim, 420);
}
function aSkip(){ if(!aFightView) return; clearTimeout(aAnimTimer); aFightView.i=aFightView.res.events.length; aFightDone(); }
function aFightDone(){
  const v=aFightView; if(!v) return;
  const r=v.res, m=r.mon;
  if(r.win){
    const bits=[`🎉 打倒 ${m.e} ${m.name}！經驗 +${r.xp}`];
    if(r.coins) bits.push(`🦴+${r.coins}`);
    if(r.capped) bits.push("（今天骨頭幣已封頂）");
    if(v.dropTxt) bits.push(v.dropTxt);
    if(r.levelUps) bits.push(`<br>⬆️ 升到 Lv.${AS.level}！`);
    aMsg=bits.join("　");
  }else{
    aMsg=`💥 被 ${m.e} ${m.name} 打倒了…合成更好的裝備，或訓練升級再來。`;
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

/* ---------- 畫面 ---------- */
const aBar=(cur,max,col)=>`<div style="height:7px;border-radius:4px;background:rgba(0,0,0,.12);overflow:hidden">`+
  `<div style="height:100%;width:${Math.max(0,Math.min(100,cur/max*100))}%;background:${col};transition:width .3s"></div></div>`;
function advDraw(){
  const box=document.getElementById("advBox"); if(!box||!AS||!AD) return;
  const v=aFightView, H=v?v.res.hero:aHero(), P=v?v.pre:AS, m=v?v.res.mon:AS.next;
  // ── 角色列 ──
  const glyph=(typeof petGlyph==="function"&&typeof petData!=="undefined"&&petData)?petGlyph(petData,52):`<span style="font-size:34px">🐾</span>`;
  const regen=AS.nextRegenMs==null?"":`　<span class="hint">下一點回復 ${Math.ceil(AS.nextRegenMs/60000)} 分鐘</span>`;
  const head=`<div style="display:flex;gap:10px;align-items:center">`+
    `<div style="width:52px;height:52px;display:flex;align-items:center;justify-content:center">${glyph}</div>`+
    `<div style="flex:1;min-width:0"><div style="display:flex;justify-content:space-between;font-weight:800"><span>Lv.${P.level}</span>`+
    `<span style="font-weight:400;font-size:12px" class="hint">經驗 ${P.xp}/${P.need}</span></div>${aBar(P.xp,P.need,"var(--accent)")}`+
    `<div style="font-size:12px;margin-top:4px">⚔️ ${H.atk}　❤️ ${H.hp}　💥 ${Math.round(H.crit*100)}%</div></div></div>`+
    `<div style="display:flex;gap:14px;align-items:baseline;flex-wrap:wrap;font-weight:700;margin-top:8px">`+
    `<span>⚡ ${AS.energy}</span><span style="font-weight:400" class="hint">今日 🦴 ${P.coinToday}/${AS.coinCap}</span>${regen}</div>`;
  const B=[["logged","記錄飲食"],["protein_hit","蛋白達標"],["exercised","有運動"],["water_hit","喝水達標"]];
  const g=AS.granted||{today:[],yesterday:[]};
  const src=`<details class="gdet" style="margin-top:6px"><summary class="ghd" style="font-size:12px">⚡ 能量怎麼來？</summary>`+
    `<div class="hint" style="line-height:1.9">每項健康行為 +${AS.energyPer}（每天各一次）：`+
    B.map(([k,l])=>`${g.today.includes(k)?"✅":"⬜"} ${l}`).join("　")+
    `<br>${g.yesterday.includes("kcal_hit")?"✅":"⬜"} 昨天熱量達標（熱量要等一天過完才算數，所以隔天才發）`+
    `<br>另外每 10 分鐘自動回 1 點，最多回到 ${AS.regenCap}。</div></details>`;
  const msg=aMsg?`<div style="margin:8px 0;padding:6px 10px;border-radius:8px;background:var(--soft);font-size:13px">${aMsg}</div>`:"";
  // ── 戰場 ──
  let hHp=H.hp, mHp=m.hp, hit="";
  if(v){
    hHp=v.res.hero.hp; mHp=m.hp;
    for(let k=0;k<v.i;k++){ const [who,,,left]=v.res.events[k]; if(who==="h") mHp=left; else hHp=left; }
    const last=v.res.events[v.i-1];
    if(last) hit=last[0]==="h"?`<div style="position:absolute;right:22%;top:18%;font-weight:800;color:${last[2]?"#e8590c":"#c92a2a"};font-size:${last[2]?20:16}px">-${last[1]}${last[2]?" 暴擊！":""}</div>`
      :`<div style="position:absolute;left:18%;top:18%;font-weight:800;color:#c92a2a;font-size:16px">-${last[1]}</div>`;
  }
  const hMax=v?v.res.hero.hp:H.hp;
  const lastWho=v&&v.res.events[v.i-1]?v.res.events[v.i-1][0]:"";
  const arena=`<div style="position:relative;margin-top:10px;padding:10px;border-radius:12px;background:${m.bg}">`+
    `<div style="font-size:12px;font-weight:700;text-align:center">${m.region}・第 ${m.stage} 關${m.boss?" 👑頭目":""}</div>`+
    `<div style="display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);gap:8px;align-items:center;margin-top:8px">`+
    `<div style="text-align:center"><div style="height:46px;display:flex;align-items:center;justify-content:center;${lastWho==="h"?"transform:translateX(10px);":""}transition:transform .15s">${glyph}</div>`+
    `<div style="font-size:11px;margin:2px 0">❤️ ${hHp}/${hMax}</div>${aBar(hHp,hMax,"#2f9e44")}</div>`+
    `<div style="font-weight:800;color:var(--sub)">VS</div>`+
    `<div style="text-align:center"><div style="font-size:40px;line-height:46px;${lastWho==="m"?"transform:translateX(-10px);":""}transition:transform .15s">${m.e}</div>`+
    `<div style="font-size:11px;margin:2px 0">${m.name}　❤️ ${mHp}/${m.hp}</div>${aBar(mHp,m.hp,"#e03131")}</div></div>`+
    `<div style="font-size:11px;text-align:center;margin-top:6px;color:var(--sub)">怪物攻擊 ${m.atk}</div>${hit}</div>`;
  const acts=v?`<div style="text-align:center;margin-top:8px"><button class="ghost sm" onclick="aSkip()">跳過動畫 ⏩</button></div>`
    :`<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin-top:8px">`+
      `<button ${aBusy?"disabled":""} onclick="aFight()">⚔️ 挑戰第 ${AS.stage} 關</button>`+
      `<button class="ghost" ${aBusy||AS.energy<AS.trainCost?"disabled":""} onclick="aTrain()">💪 訓練 −${AS.trainCost}⚡ 經驗+${AS.trainXp}</button></div>`+
      `<div class="hint" style="margin-top:4px">打贏新的一關給 🦴3（頭目 🦴15）、經驗和一件裝備；同樣的裝備打同一隻怪，結果每次都一樣。</div>`;
  // ── 裝備欄 ──
  const selX=aSel!==null?AS.board[aSel]:null;
  const slots=`<div style="font-size:12px;color:var(--sub);margin:12px 0 4px">🎽 裝備</div>`+
    `<div style="display:grid;grid-template-columns:repeat(${AD.chains.length},minmax(0,1fr));gap:6px">`+
    AD.chains.map(ch=>{
      const t=AS.equip[ch.id], it=t?ch.items[t-1]:null, hl=selX&&selX[0]===ch.id;
      return `<div style="border:1px ${hl?"solid var(--accent)":"dashed var(--line)"};border-radius:10px;padding:6px 4px;text-align:center">`+
        `<div style="font-size:11px;color:var(--sub)">${ch.slot}</div>`+
        `<div style="font-size:24px;line-height:1.3">${it?it[0]:"・"}</div>`+
        `<div style="font-size:11px">${it?`${it[1]} ${t}階`:"空"}</div>`+
        `<div style="font-size:10px;color:var(--sub)">${t?aStatText(ch.id,t):"&nbsp;"}</div></div>`;
    }).join("")+`</div>`;
  // ── 產生器 ──
  const gens=`<div style="font-size:12px;color:var(--sub);margin:12px 0 4px">點一下花 1 點能量，掉一件裝備到背包</div>`+
    `<div style="display:grid;grid-template-columns:repeat(${AD.chains.length},minmax(0,1fr));gap:6px">`+
    AD.chains.map(c=>`<button class="ghost sm" style="padding:6px 0;line-height:1.2" ${AS.energy>0&&!v?"":"disabled"} onclick="aSpawn(${c.id})">`+
      `<div style="font-size:20px">${c.gen}</div><div style="font-size:11px">${c.genName}・${c.slot}</div></button>`).join("")+`</div>`;
  // ── 背包棋盤 ──
  const cells=AS.board.map((x,i)=>{
    const sel=i===aSel, fl=i===aFlash;
    let inner="";
    if(x){ const r=aItem(x), better=x[1]>AS.equip[x[0]];
      inner=`<span style="font-size:22px;line-height:1">${r.e}</span>`+
        `<span style="position:absolute;right:3px;bottom:0;font-size:9px;color:var(--sub)">${x[1]}</span>`+
        (better?`<span style="position:absolute;left:2px;top:0;font-size:9px;color:var(--green)">▲</span>`:""); }
    return `<div onclick="aTap(${i})" style="position:relative;aspect-ratio:1;display:flex;align-items:center;justify-content:center;`+
      `border-radius:8px;cursor:pointer;background:${x?"#fff":"var(--soft)"};`+
      `box-shadow:${sel?"0 0 0 2px var(--accent) inset":fl?"0 0 0 2px var(--green) inset":"none"};">${inner}</div>`;
  }).join("");
  aFlash=-1;
  const board=`<div style="display:grid;grid-template-columns:repeat(${AD.cols},minmax(0,1fr));gap:4px;margin-top:8px;user-select:none">${cells}</div>`;
  // ── 選取中的物品 ──
  let selBar=`<div class="hint" style="margin-top:6px;text-align:center">點一件選取，再點另一件一樣的就合成；點空格可以移動。▲＝比身上穿的好。</div>`;
  if(selX){
    const r=aItem(selX), max=selX[1]>=r.ch.items.length, cur=AS.equip[selX[0]];
    const next=max?"已經是最高階":`再一件就合成 ${r.ch.items[selX[1]][0]} ${r.ch.items[selX[1]][1]}`;
    selBar=`<div style="margin-top:6px;text-align:center;font-size:13px">${r.e} <b>${r.n}</b>（${r.ch.slot} ${selX[1]}/${r.ch.items.length}・${aStatText(selX[0],selX[1])}）・${next}</div>`+
      `<div style="display:flex;gap:6px;justify-content:center;margin-top:4px">`+
      `<button class="sm" style="width:auto;padding:4px 12px" ${v?"disabled":""} onclick="aEquip()">🎽 穿上${cur?`（換下 ${cur} 階）`:""}</button>`+
      `<button class="ghost sm" style="width:auto;padding:4px 10px" onclick="aTrash()">🗑</button></div>`;
  }
  box.innerHTML=head+src+msg+arena+acts+slots+gens+board+selBar;
}
