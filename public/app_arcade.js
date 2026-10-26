/* ---------- 休閒小遊戲：方塊爆破／倒水分類 ----------
   2026/10 取代原本的轉盤、熱量猜謎、健康知識、健康賓果、記憶翻牌、打地鼠、2048、寵物跳跳。
   （貨架三消、羊了個羊後來也拿掉了。）兩款共用一套發幣規則（伺服器 arcade_rules.js）：每天第一次結束時依成績發幣，之後可以繼續玩、不再發。
   檔案分兩半：上半是純邏輯（ARC.*，不碰畫面，test/arcade.test.mjs 直接測），下半是畫面。
   表情符號一律用 Emoji 12 以前的字元 —— 13 以後的在 Windows 10 與較舊手機上會變方框。 */
const ARC={};
ARC.shuffle=(a,rand)=>{ for(let i=a.length-1;i>0;i--){ const j=Math.floor(rand()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; };

/* ===== 方塊爆破：8×8，把方塊放進去，排滿一整列或一整行就消掉 ===== */
ARC.BN=8;
ARC.SHAPES=[
  [[0,0]],
  [[0,0],[0,1]], [[0,0],[1,0]],
  [[0,0],[0,1],[0,2]], [[0,0],[1,0],[2,0]],
  [[0,0],[0,1],[0,2],[0,3]], [[0,0],[1,0],[2,0],[3,0]],
  [[0,0],[0,1],[1,0],[1,1]],
  [[0,0],[1,0],[1,1]], [[0,1],[1,0],[1,1]], [[0,0],[0,1],[1,0]], [[0,0],[0,1],[1,1]],
  [[0,0],[1,0],[2,0],[2,1]], [[0,0],[0,1],[0,2],[1,0]], [[0,0],[0,1],[1,1],[2,1]], [[0,2],[1,0],[1,1],[1,2]],
  [[0,0],[0,1],[0,2],[1,1]],
  [[0,0],[0,1],[1,1],[1,2]], [[0,1],[1,0],[1,1],[2,0]],
  [[0,0],[0,1],[0,2],[1,0],[1,1],[1,2]],
  [[0,0],[0,1],[0,2],[1,0],[1,1],[1,2],[2,0],[2,1],[2,2]],
];
ARC.blastFits=(g,sh,r,c)=>sh.every(([dr,dc])=>{ const R=r+dr,C=c+dc; return R>=0&&R<ARC.BN&&C>=0&&C<ARC.BN&&!g[R*ARC.BN+C]; });
// 放下去，同時找出排滿的列與行（先全部找出來再一起清，交叉那格才不會只算一次）
ARC.blastPlace=(g,sh,r,c,v)=>{
  const n=ARC.BN, out=g.slice();
  sh.forEach(([dr,dc])=>{ out[(r+dr)*n+c+dc]=v; });
  const rows=[], cols=[];
  for(let i=0;i<n;i++){
    let full=true; for(let j=0;j<n;j++) if(!out[i*n+j]) { full=false; break; } if(full) rows.push(i);
    full=true; for(let j=0;j<n;j++) if(!out[j*n+i]) { full=false; break; } if(full) cols.push(i);
  }
  rows.forEach(i=>{ for(let j=0;j<n;j++) out[i*n+j]=0; });
  cols.forEach(i=>{ for(let j=0;j<n;j++) out[j*n+i]=0; });
  const lines=rows.length+cols.length;
  return {grid:out, rows, cols, lines, gained: sh.length + 10*lines*lines};   // 一次消越多越划算
};
ARC.blastCanPlace=(g,sh)=>{ for(let r=0;r<ARC.BN;r++) for(let c=0;c<ARC.BN;c++) if(ARC.blastFits(g,sh,r,c)) return true; return false; };
ARC.blastDeal=(rand)=>[0,1,2].map(()=>({sh:ARC.SHAPES[Math.floor(rand()*ARC.SHAPES.length)], v:1+Math.floor(rand()*6)}));
ARC.blastOver=(g,pieces)=>pieces.filter(Boolean).every(p=>!ARC.blastCanPlace(g,p.sh));

/* ===== 倒水分類：同顏色倒在同一杯，每杯 4 格 ===== */
ARC.WCAP=4;
ARC.waterTop=(t)=>{ if(!t.length) return {c:null,n:0}; const c=t[t.length-1]; let n=0; for(let i=t.length-1;i>=0&&t[i]===c;i--) n++; return {c,n}; };
ARC.waterCanPour=(ts,a,b)=>{
  if(a===b) return false; const A=ts[a], B=ts[b];
  if(!A.length||B.length>=ARC.WCAP) return false;
  return !B.length || B[B.length-1]===A[A.length-1];
};
ARC.waterPour=(ts,a,b)=>{
  if(!ARC.waterCanPour(ts,a,b)) return null;
  const out=ts.map(t=>t.slice()), {c,n}=ARC.waterTop(out[a]), k=Math.min(n, ARC.WCAP-out[b].length);
  for(let i=0;i<k;i++){ out[a].pop(); out[b].push(c); }
  return out;
};
ARC.waterSolved=(ts)=>ts.every(t=>!t.length || (t.length===ARC.WCAP && t.every(x=>x===t[0])));
// 深度優先找解，用來確保出的題目一定解得開；超過上限就當作解不開、換一題
ARC.waterSolvable=(ts,limit)=>{
  const seen=new Set(), cap=limit||30000; let nodes=0;
  const key=s=>s.map(t=>t.join(",")).sort().join("|");     // 杯子順序不重要
  const dfs=(s)=>{
    if(ARC.waterSolved(s)) return true;
    if(++nodes>cap) return false;
    const k=key(s); if(seen.has(k)) return false; seen.add(k);
    for(let a=0;a<s.length;a++) for(let b=0;b<s.length;b++){
      if(!ARC.waterCanPour(s,a,b)) continue;
      const A=s[a]; if(!s[b].length && A.every(x=>x===A[0])) continue;   // 單色整杯倒進空杯沒意義
      if(dfs(ARC.waterPour(s,a,b))) return true;
    }
    return false;
  };
  return dfs(ts);
};
ARC.waterGen=(colors,rand)=>{
  for(let tries=0;tries<40;tries++){
    const units=[]; for(let c=0;c<colors;c++) for(let i=0;i<ARC.WCAP;i++) units.push(c);
    ARC.shuffle(units,rand);
    const ts=[]; for(let c=0;c<colors;c++) ts.push(units.slice(c*ARC.WCAP,(c+1)*ARC.WCAP));
    ts.push([],[]);
    if(!ARC.waterSolved(ts) && ARC.waterSolvable(ts)) return ts;
  }
  return colors>2 ? ARC.waterGen(colors-1,rand) : [[0,1,0,1],[1,0,1,0],[],[]];   // 保底：少一個顏色再試
};

/* ================= 以下是畫面 ================= */
const BLAST_COL={1:["#f6a5a0","🍎"],2:["#fcc68b","🍊"],3:["#fbe38e","🍋"],4:["#b7dcae","🥦"],5:["#cdb4ee","🍇"],6:["#f7b6c8","🍓"]};
const WATER_COL=[["#c9a079","珍奶"],["#86c07a","抹茶"],["#f3c13e","芒果"],["#9b6ad6","葡萄"],["#f28b9b","草莓"],["#56aee3","藍柑"],["#b5523b","紅茶"],["#e3dc5c","檸檬"]];
const ARC_INFO={
  blast:{title:"🧩 方塊爆破", hint:"把下面的方塊拖進格子裡，排滿一整列或一整行就消掉，一次消越多分數越高。三塊都放不下就結束。"},
  water:{title:"🥤 倒水分類", hint:"點一杯、再點另一杯，把飲料倒過去（只能倒在同口味上面或空杯）。每杯都變成單一口味就過關。限時 5 分鐘。"},
};
let ARC_ST={};
async function loadArcadeGames(){
  try{ const r=await api("/api/game/arcade"); ARC_ST=r.games||{}; }
  catch(e){ ARC_ST={}; }
  ["blast","water"].forEach(id=>arcIdle(id));   // 不能直接 forEach(arcIdle)：索引會被當成第二個參數
}
function arcBox(id){ return document.getElementById(id+"Box"); }
function arcIdle(id,extra){
  const card=document.getElementById(id+"Card"), box=arcBox(id); if(!card||!box) return;
  card.style.display="";
  const s=ARC_ST[id]||{}, unit=s.unit||"";
  const today=s.played?`<div class="hint" style="text-align:center">今天最佳 ${s.best} ${unit}，已得 🦴${s.coins}（可以再玩，但不再發幣）</div>`
    :(s.tiers?`<div class="hint" style="text-align:center">今天第一次結束時發幣：`+
      s.tiers.slice().reverse().map(([m,c])=>`${m} ${unit}→🦴${c}`).join("　")+`</div>`:"");
  box.innerHTML=(extra||"")+`<div class="hint" style="margin-bottom:6px">${ARC_INFO[id].hint}</div>`+today+
    `<div style="text-align:center;margin-top:8px"><button onclick="arcStart('${id}')" style="width:auto;padding:12px 26px">${extra?"再玩一次":"開始遊戲"}</button></div>`+
    `<div id="${id}Rank">${arcRankHtml(id)}</div>`;
}
/* 小排行榜（目前只有方塊爆破）：今天最佳／歷史最佳 */
const ARC_RANK_TAB={};
const rankMedal=(i)=>["🥇","🥈","🥉"][i]||`${i+1}.`;
function arcRankHtml(id){
  const b=ARC_ST[id]&&ARC_ST[id].board; if(!b) return "";
  const tab=ARC_RANK_TAB[id]||"today", list=b[tab]||[], unit=(ARC_ST[id].unit)||"";
  const btn=(k,l)=>`<button class="ghost sm${tab===k?" on":""}" style="width:auto;padding:3px 10px;font-size:12px" onclick="arcRankTab('${id}','${k}')">${l}</button>`;
  const rows=list.length?list.map((x,i)=>`<div style="display:flex;justify-content:space-between;padding:4px 8px;border-radius:8px;${x.me?"background:var(--soft);font-weight:700":""}">`+
    `<span>${rankMedal(i)} ${x.name}</span><span>${x.score} ${unit}</span></div>`).join("")
    :`<div class="hint" style="text-align:center;padding:6px">${tab==="today"?"今天還沒有人玩":"還沒有紀錄"}</div>`;
  return `<div style="margin-top:12px;border-top:1px dashed var(--line);padding-top:8px">`+
    `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><b style="font-size:13px">🏆 排行榜</b>`+
    `<span style="display:flex;gap:4px">${btn("today","今天")}${btn("all","歷史最佳")}</span></div>${rows}</div>`;
}
function arcRankTab(id,tab){ ARC_RANK_TAB[id]=tab; const el=document.getElementById(id+"Rank"); if(el) el.innerHTML=arcRankHtml(id); }
function arcStart(id){ ({blast:blastStart, water:waterStart})[id](); }
async function arcFinish(id,score,line){
  try{
    const r=await api("/api/game/arcade/"+id,{method:"POST",body:JSON.stringify({score})});
    if(r.pet){ petData=r.pet; if(typeof renderPet==="function") renderPet(); }
    ARC_ST[id]=Object.assign(ARC_ST[id]||{}, {played:true, best:r.best, coins:(ARC_ST[id]&&ARC_ST[id].played)?ARC_ST[id].coins:r.coins});
    if(r.board) ARC_ST[id].board=r.board;
    arcIdle(id,`<div style="text-align:center;font-weight:800;margin:4px 0 8px;color:var(--green)">${line}${r.already?"（今天獎勵已領過，純練習）":`　+🦴${r.coins}`}</div>`);
  }catch(e){ arcIdle(id,`<div style="text-align:center;margin-bottom:8px">${line}<br><span class="hint">成績送出失敗：${e.message}</span></div>`); }
}
const arcBar=(left,right)=>`<div style="display:flex;justify-content:space-between;align-items:center;font-weight:700;margin-bottom:8px">${left}<span>${right||""}</span></div>`;
const arcEndBtn=(fn)=>`<button class="ghost sm" style="padding:4px 10px" onclick="${fn}">結束</button>`;

/* ---------- 方塊爆破：拖曳 ---------- */
let BL=null;
function blastStart(){ BL={g:Array(ARC.BN*ARC.BN).fill(0), pieces:ARC.blastDeal(Math.random), score:0, over:false, drag:null, preview:null, msg:""}; blastDraw(); }
function blastCell(v,extra){
  const col=v?BLAST_COL[v]:null;
  return `<div style="aspect-ratio:1;border-radius:5px;display:flex;align-items:center;justify-content:center;font-size:15px;`+
    `background:${col?col[0]:"var(--soft)"};${extra||""}">${col?col[1]:""}</div>`;
}
function blastDraw(){
  const box=arcBox("blast"); if(!box||!BL) return;
  const pv=BL.preview, pvSet=new Set(pv&&pv.ok?pv.cells:[]), bad=new Set(pv&&!pv.ok?pv.cells:[]);
  const cells=BL.g.map((v,i)=>{
    if(pvSet.has(i)) return blastCell(BL.pieces[BL.drag.i].v,"opacity:.55;box-shadow:0 0 0 2px var(--green) inset");
    if(bad.has(i)) return blastCell(v,"box-shadow:0 0 0 2px #e57373 inset");
    return blastCell(v);
  }).join("");
  const tray=BL.pieces.map((p,i)=>{
    if(!p) return `<div></div>`;
    const h=Math.max(...p.sh.map(s=>s[0]))+1, w=Math.max(...p.sh.map(s=>s[1]))+1, set=new Set(p.sh.map(([r,c])=>r*w+c));
    const mini=[...Array(h*w).keys()].map(k=>set.has(k)?`<div style="width:16px;height:16px;border-radius:3px;background:${BLAST_COL[p.v][0]}"></div>`:`<div style="width:16px;height:16px"></div>`).join("");
    const dim=BL.drag&&BL.drag.i===i?"opacity:.25;":"";
    return `<div onpointerdown="blastDown(event,${i})" style="touch-action:none;cursor:grab;display:flex;align-items:center;justify-content:center;min-height:70px;${dim}">`+
      `<div style="display:grid;grid-template-columns:repeat(${w},16px);gap:2px">${mini}</div></div>`;
  }).join("");
  box.innerHTML=arcBar(`🧩 ${BL.score} 分`, arcEndBtn("blastEnd(true)"))+
    (BL.msg?`<div style="text-align:center;font-size:13px;color:var(--green);margin-bottom:4px">${BL.msg}</div>`:"")+
    `<div id="blastBoard" style="display:grid;grid-template-columns:repeat(${ARC.BN},minmax(0,1fr));gap:3px;touch-action:none;user-select:none">${cells}</div>`+
    `<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-top:10px">${tray}</div>`;
}
function blastDown(e,i){
  if(!BL||BL.over||!BL.pieces[i]) return;
  e.preventDefault();
  BL.drag={i}; BL.msg="";
  const p=BL.pieces[i], b=document.getElementById("blastBoard").getBoundingClientRect(), cell=b.width/ARC.BN;
  const h=Math.max(...p.sh.map(s=>s[0]))+1, w=Math.max(...p.sh.map(s=>s[1]))+1, set=new Set(p.sh.map(([r,c])=>r*w+c));
  const gh=document.createElement("div"); gh.id="blastGhost";
  gh.style.cssText=`position:fixed;z-index:9999;pointer-events:none;display:grid;grid-template-columns:repeat(${w},${cell-3}px);gap:3px;opacity:.9`;
  gh.innerHTML=[...Array(h*w).keys()].map(k=>set.has(k)?`<div style="width:${cell-3}px;height:${cell-3}px;border-radius:5px;background:${BLAST_COL[p.v][0]};display:flex;align-items:center;justify-content:center;font-size:15px">${BLAST_COL[p.v][1]}</div>`:`<div></div>`).join("");
  document.body.appendChild(gh);
  BL.drag.gh=gh; BL.drag.w=w; BL.drag.h=h;
  blastMove(e);
  window.addEventListener("pointermove",blastMove);
  window.addEventListener("pointerup",blastUp,{once:true});
  window.addEventListener("pointercancel",blastCancel,{once:true});
  blastDraw();
}
function blastMove(e){
  const d=BL&&BL.drag; if(!d||!d.gh) return;
  const b=document.getElementById("blastBoard").getBoundingClientRect(), cell=b.width/ARC.BN;
  // 方塊浮在手指上方一格多，手指才不會把它擋住
  const left=e.clientX-d.w*cell/2, top=e.clientY-d.h*cell-cell*1.2;
  d.gh.style.left=left+"px"; d.gh.style.top=top+"px";
  const c=Math.round((left-b.left)/cell), r=Math.round((top-b.top)/cell), p=BL.pieces[d.i];
  const inside=r>-2&&c>-2&&r<ARC.BN+1&&c<ARC.BN+1;
  const prev=BL.preview;
  if(!inside){ if(prev){ BL.preview=null; blastDraw(); } return; }
  const ok=ARC.blastFits(BL.g,p.sh,r,c);
  const cells=p.sh.map(([dr,dc])=>[r+dr,c+dc]).filter(([R,C])=>R>=0&&R<ARC.BN&&C>=0&&C<ARC.BN).map(([R,C])=>R*ARC.BN+C);
  if(!prev||prev.r!==r||prev.c!==c){ BL.preview={r,c,ok,cells}; blastDraw(); }
}
function blastCleanup(){
  window.removeEventListener("pointermove",blastMove);
  if(BL&&BL.drag&&BL.drag.gh) BL.drag.gh.remove();
  if(BL){ BL.drag=null; BL.preview=null; }
}
function blastCancel(){ window.removeEventListener("pointerup",blastUp); blastCleanup(); blastDraw(); }
function blastUp(){
  window.removeEventListener("pointercancel",blastCancel);
  const d=BL&&BL.drag, pv=BL&&BL.preview;
  if(d&&pv&&pv.ok){
    const p=BL.pieces[d.i], res=ARC.blastPlace(BL.g,p.sh,pv.r,pv.c,p.v);
    BL.g=res.grid; BL.score+=res.gained; BL.pieces[d.i]=null;
    if(res.lines) BL.msg=res.lines>1?`🎉 一次消 ${res.lines} 條！+${res.gained}`:`✨ 消掉 1 條 +${res.gained}`;
    if(BL.pieces.every(x=>!x)) BL.pieces=ARC.blastDeal(Math.random);
  }
  blastCleanup(); blastDraw();
  if(BL&&ARC.blastOver(BL.g,BL.pieces)) blastEnd();
}
function blastEnd(quit){
  if(!BL||BL.over) return; BL.over=true; blastCleanup();
  arcFinish("blast",BL.score,`${quit?"結束":"沒有地方放了"}！${BL.score} 分`);
}

/* ---------- 倒水分類：限時 5 分鐘 ---------- */
let WS=null;
function waterStart(){
  if(WS&&WS.timer) clearInterval(WS.timer);
  WS={level:1, solved:0, endAt:Date.now()+300000, sel:null, over:false, msg:""};
  waterLevel(); WS.timer=setInterval(waterTick,500);
}
function waterLevel(){ WS.tubes=ARC.waterGen(Math.min(2+WS.level,WATER_COL.length),Math.random); WS.start=WS.tubes.map(t=>t.slice()); WS.sel=null; waterDraw(); }
function waterTick(){ if(!WS||WS.over) return; if(Date.now()>=WS.endAt) waterEnd(); else waterDraw(true); }
function waterTap(i){
  if(!WS||WS.over) return;
  if(WS.sel===null){ if(WS.tubes[i].length) WS.sel=i; }
  else if(WS.sel===i) WS.sel=null;
  else{
    const nx=ARC.waterPour(WS.tubes,WS.sel,i);
    if(nx){ WS.tubes=nx; WS.sel=null; WS.msg="";
      if(ARC.waterSolved(WS.tubes)){ WS.solved++; WS.level++; WS.msg=`🎉 第 ${WS.solved} 關完成！`; waterDraw(); setTimeout(()=>{ if(WS&&!WS.over) waterLevel(); },700); return; } }
    else WS.sel=WS.tubes[i].length?i:null;
  }
  waterDraw();
}
function waterRestart(){ if(!WS||WS.over) return; WS.tubes=WS.start.map(t=>t.slice()); WS.sel=null; waterDraw(); }
function waterDraw(tickOnly){
  const box=arcBox("water"); if(!box||!WS) return;
  const left=Math.max(0,Math.ceil((WS.endAt-Date.now())/1000)), tStr=`⏱ ${Math.floor(left/60)}:${String(left%60).padStart(2,"0")}`;
  if(tickOnly){ const t=document.getElementById("waterTime"); if(t){ t.textContent=tStr; return; } }
  const tubes=WS.tubes.map((t,i)=>{
    const seg=[...Array(ARC.WCAP).keys()].map(k=>{ const c=t[k]; return `<div style="flex:1;${c==null?"":`background:${WATER_COL[c][0]};`}${k===0?"border-radius:0 0 14px 14px;":""}"></div>`; }).join("");
    const up=WS.sel===i?"transform:translateY(-12px);":"";
    return `<div onclick="waterTap(${i})" style="cursor:pointer;display:flex;flex-direction:column-reverse;width:38px;height:128px;margin:0 auto;`+
      `border:2px solid #b9a98c;border-top:none;border-radius:0 0 16px 16px;overflow:hidden;background:rgba(255,255,255,.55);transition:transform .12s;${up}">${seg}</div>`;
  }).join("");
  const n=WS.tubes.length, cols=Math.min(n,6);
  const legend=[...new Set(WS.tubes.flat())].sort((a,b)=>a-b).map(c=>`<span style="display:inline-block;margin:0 5px"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${WATER_COL[c][0]};vertical-align:middle"></span> ${WATER_COL[c][1]}</span>`).join("");
  box.innerHTML=arcBar(`🥤 第 ${WS.level} 關　已過 ${WS.solved} 關`, `<span id="waterTime">${tStr}</span>　${arcEndBtn("waterEnd()")}`)+
    (WS.msg?`<div style="text-align:center;font-size:13px;color:var(--green);margin-bottom:4px">${WS.msg}</div>`:"")+
    `<div style="display:grid;grid-template-columns:repeat(${cols},minmax(0,1fr));row-gap:18px;padding-top:14px">${tubes}</div>`+
    `<div class="hint" style="text-align:center;margin-top:10px">${legend}</div>`+
    `<div style="text-align:center;margin-top:6px"><button class="ghost sm" onclick="waterRestart()">↺ 這關重來</button></div>`;
}
function waterEnd(){
  if(!WS||WS.over) return; WS.over=true; clearInterval(WS.timer);
  arcFinish("water",WS.solved,`時間到！過了 ${WS.solved} 關`);
}
