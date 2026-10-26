/* ---------- 休閒小遊戲：方塊爆破／貨架三消／羊了個羊三消／倒水分類 ----------
   2026/10 取代原本的轉盤、熱量猜謎、健康知識、健康賓果、記憶翻牌、打地鼠、2048、寵物跳跳。
   四款共用一套發幣規則（伺服器 arcade_rules.js）：每天第一次結束時依成績發幣，之後可以繼續玩、不再發。
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

/* ===== 貨架三消：同一層貨架湊滿 3 個一樣的就消掉，後面那層會補上來 =====
   shelf = { f:[前排 3 格，null=空], b:[後排，一層 3 個] }
   後排只在「消掉」之後才補上來（不是手動清空就補）：這樣空格數永遠不會變少，
   至少有一格空位時，前排的東西可以任意調位置，題目就不會卡死。 */
ARC.goodsLevelSpec=(level)=>({ shelves:Math.min(3+level,9), types:Math.min(2*level+1,15) });
ARC.goodsGen=(level,rand)=>{
  const {shelves,types}=ARC.goodsLevelSpec(level);
  for(let tries=0;tries<60;tries++){
    const items=[]; for(let t=0;t<types;t++) for(let k=0;k<3;k++) items.push(t);
    ARC.shuffle(items,rand);
    const frontCount=Math.min(items.length, shelves*3-3);       // 前排留 3 個空位
    const front=items.slice(0,frontCount), back=items.slice(frontCount);
    const slots=Array(shelves*3).fill(null);
    const idx=ARC.shuffle([...Array(shelves*3).keys()],rand).slice(0,frontCount);
    idx.forEach((p,i)=>{ slots[p]=front[i]; });
    const st=[]; for(let s=0;s<shelves;s++) st.push({f:slots.slice(s*3,s*3+3), b:[]});
    for(let i=0;i<back.length;i+=3) st[Math.floor(rand()*shelves)].b.push(back.slice(i,i+3));
    const preMatched=st.some(sh=>sh.f[0]!=null && sh.f.every(x=>x===sh.f[0]));
    if(!preMatched && ARC.goodsSolvable(st)) return st;
  }
  // 保底：沒有後排，全部攤在前排（有空位就一定解得開）
  const items=[]; for(let t=0;t<3;t++) for(let k=0;k<3;k++) items.push(t);
  ARC.shuffle(items,rand); const st=[];
  for(let s=0;s<4;s++) st.push({f:[items[s*3]??null, items[s*3+1]??null, items[s*3+2]??null], b:[]});
  return st;
};
// 抽象成「看得到的有哪些、每個貨架後面還藏幾層」來搜尋：每次湊一組 3 個消掉，選一個貨架翻出它的下一層
ARC.goodsSolvable=(st,limit)=>{
  const cap=limit||20000, V={}; let nodes=0;
  st.forEach(sh=>sh.f.forEach(x=>{ if(x!=null) V[x]=(V[x]||0)+1; }));
  const backs=st.map(sh=>sh.b), ptr=backs.map(()=>0), seen=new Set();
  const left=()=>Object.values(V).reduce((a,b)=>a+b,0)+backs.reduce((a,b,i)=>a+(b.length-ptr[i])*3,0);
  const dfs=()=>{
    if(left()===0) return true;
    if(++nodes>cap) return false;
    const key=JSON.stringify(Object.keys(V).sort().map(k=>[k,V[k]]))+"/"+ptr.join(",");
    if(seen.has(key)) return false; seen.add(key);
    const tri=Object.keys(V).filter(t=>V[t]>=3);
    for(const t of tri){
      V[t]-=3;
      let noBack=false; const choices=[];
      backs.forEach((b,i)=>{ if(ptr[i]<b.length) choices.push(i); else noBack=true; });
      for(const s of choices){
        const layer=backs[s][ptr[s]]; ptr[s]++; layer.forEach(x=>{ V[x]=(V[x]||0)+1; });
        const ok=dfs(); ptr[s]--; layer.forEach(x=>{ V[x]--; });
        if(ok){ V[t]+=3; return true; }
      }
      if(noBack && dfs()){ V[t]+=3; return true; }               // 在沒有後排的貨架上消，不翻新的
      V[t]+=3;
    }
    return false;
  };
  return dfs();
};
// 把 from 的東西搬到 to 這個空格；搬完若 to 的貨架湊成 3 個一樣就消掉並補上後排
ARC.goodsMove=(st,from,to)=>{
  const A=st[from.s], B=st[to.s];
  if(!A||!B||A.f[from.i]==null||B.f[to.i]!=null) return {ok:false, cleared:0};
  B.f[to.i]=A.f[from.i]; A.f[from.i]=null;
  let cleared=0;
  if(B.f[0]!=null && B.f.every(x=>x===B.f[0])){
    cleared=1; B.f=[null,null,null];
    if(B.b.length) B.f=B.b.shift().slice();
  }
  return {ok:true, cleared};
};
ARC.goodsDone=(st)=>st.every(sh=>sh.f.every(x=>x==null) && !sh.b.length);

/* ===== 羊了個羊三消：點最上層的牌放進 7 格槽，3 張一樣就消掉，槽滿就輸 =====
   座標用「半格」為單位，一張牌佔 2×2 半格；上層的牌只要有重疊，就會把下層壓住點不到。 */
ARC.TILE_W=12; ARC.TILE_H=14; ARC.TRAY=7;
ARC.tileLevelSpec=(level)=>({ types:Math.min(2+level,12), copies:level>=4?2:1, layers:Math.min(level,5) });
ARC.tileGen=(level,rand)=>{
  const {types,copies,layers}=ARC.tileLevelSpec(level);
  const kinds=[]; for(let t=0;t<types;t++) for(let k=0;k<3*copies;k++) kinds.push(t);
  ARC.shuffle(kinds,rand);
  // 每層的格點錯開半格，牌才會互相壓到；越上層放越少
  const weights=[]; for(let z=0;z<layers;z++) weights.push(layers-z);
  const wsum=weights.reduce((a,b)=>a+b,0), tiles=[]; let id=0, used=0;
  for(let z=0;z<layers;z++){
    const off=z%2, grid=[];
    for(let y=off;y+2<=ARC.TILE_H;y+=2) for(let x=off;x+2<=ARC.TILE_W;x+=2) grid.push([x,y]);
    ARC.shuffle(grid,rand);
    const n=z===layers-1 ? kinds.length-used : Math.min(grid.length, Math.round(kinds.length*weights[z]/wsum));
    grid.slice(0,n).forEach(([x,y])=>{ tiles.push({id:id++, t:kinds[used++], x, y, z}); });
  }
  return tiles;
};
ARC.tileCovered=(tiles,tile)=>tiles.some(u=>u.z>tile.z && Math.abs(u.x-tile.x)<2 && Math.abs(u.y-tile.y)<2);
// 點一張牌：放進槽裡同種類的旁邊，湊滿 3 張就消掉。回傳 {ok, lose, win}
ARC.tilePick=(st,id)=>{
  const i=st.tiles.findIndex(x=>x.id===id); if(i<0) return {ok:false};
  const tile=st.tiles[i]; if(ARC.tileCovered(st.tiles,tile)) return {ok:false};
  st.tiles.splice(i,1);
  let at=st.tray.length; for(let k=st.tray.length-1;k>=0;k--) if(st.tray[k]===tile.t){ at=k+1; break; }
  st.tray.splice(at,0,tile.t);
  const same=st.tray.filter(x=>x===tile.t).length;
  let matched=false;
  if(same>=3){ let n=0; st.tray=st.tray.filter(x=>!(x===tile.t && n++<3)); matched=true; }
  return {ok:true, matched, win:!st.tiles.length && !st.tray.length, lose:st.tray.length>=ARC.TRAY};
};
// 洗牌道具：盤面上剩下的牌重新分配種類（每種的數量不變，所以仍然都是 3 的倍數）
ARC.tileShuffle=(st,rand)=>{ const ks=ARC.shuffle(st.tiles.map(t=>t.t),rand); st.tiles.forEach((t,i)=>{ t.t=ks[i]; }); };

/* ================= 以下是畫面 ================= */
const BLAST_COL={1:["#f6a5a0","🍎"],2:["#fcc68b","🍊"],3:["#fbe38e","🍋"],4:["#b7dcae","🥦"],5:["#cdb4ee","🍇"],6:["#f7b6c8","🍓"]};
const GOODS_ITEMS=["🥛","🧃","🍞","🥚","🧀","🥫","🍌","🍎","🥕","🥦","🍗","🐟","🍙","🍯","🥜"];
const TILE_ITEMS=["🍎","🥕","🥦","🍇","🍋","🍑","🌽","🍆","🥚","🧀","🍞","🍓"];
const WATER_COL=[["#c9a079","珍奶"],["#86c07a","抹茶"],["#f3c13e","芒果"],["#9b6ad6","葡萄"],["#f28b9b","草莓"],["#56aee3","藍柑"],["#b5523b","紅茶"],["#e3dc5c","檸檬"]];
const ARC_INFO={
  blast:{title:"🧩 方塊爆破", hint:"把下面的方塊拖進格子裡，排滿一整列或一整行就消掉，一次消越多分數越高。三塊都放不下就結束。"},
  goods:{title:"🛒 貨架三消", hint:"點一樣東西、再點空格搬過去。同一層湊滿 3 個一樣的就消掉，後面那層會補上來。限時 3 分鐘，能清幾層算幾層。"},
  tile:{title:"🐑 羊了個羊", hint:"只能點沒被壓住的牌。點下的牌會進到下面 7 格的槽，3 張一樣就消掉；槽滿就輸。每關有一次洗牌。"},
  water:{title:"🥤 倒水分類", hint:"點一杯、再點另一杯，把飲料倒過去（只能倒在同口味上面或空杯）。每杯都變成單一口味就過關。限時 5 分鐘。"},
};
let ARC_ST={};
async function loadArcadeGames(){
  try{ const r=await api("/api/game/arcade"); ARC_ST=r.games||{}; }
  catch(e){ ARC_ST={}; }
  ["blast","goods","tile","water"].forEach(id=>arcIdle(id));   // 不能直接 forEach(arcIdle)：索引會被當成第二個參數
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
    `<div style="text-align:center;margin-top:8px"><button onclick="arcStart('${id}')" style="width:auto;padding:12px 26px">${extra?"再玩一次":"開始遊戲"}</button></div>`;
}
function arcStart(id){ ({blast:blastStart, goods:goodsStart, tile:tileStart, water:waterStart})[id](); }
async function arcFinish(id,score,line){
  try{
    const r=await api("/api/game/arcade/"+id,{method:"POST",body:JSON.stringify({score})});
    if(r.pet){ petData=r.pet; if(typeof renderPet==="function") renderPet(); }
    ARC_ST[id]=Object.assign(ARC_ST[id]||{}, {played:true, best:r.best, coins:(ARC_ST[id]&&ARC_ST[id].played)?ARC_ST[id].coins:r.coins});
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

/* ---------- 貨架三消：點選搬移，限時 3 分鐘 ---------- */
let GS=null;
function goodsStart(){
  if(GS&&GS.timer) clearInterval(GS.timer);
  GS={level:1, score:0, endAt:Date.now()+180000, sel:null, msg:"", over:false};
  GS.s=ARC.goodsGen(GS.level,Math.random);
  GS.timer=setInterval(goodsTick,500); goodsDraw();
}
function goodsTick(){ if(!GS||GS.over) return; if(Date.now()>=GS.endAt) goodsEnd(); else goodsDraw(true); }
function goodsTap(s,i){
  if(!GS||GS.over) return;
  const it=GS.s[s].f[i];
  if(GS.sel===null){ if(it!=null) GS.sel={s,i}; }
  else if(GS.sel.s===s&&GS.sel.i===i){ GS.sel=null; }
  else if(it==null){
    const r=ARC.goodsMove(GS.s,GS.sel,{s,i}); GS.sel=null;
    if(r.cleared){ GS.score+=10; GS.msg="✨ 消掉一組 +10"; }
    if(ARC.goodsDone(GS.s)){ GS.score+=30; GS.msg=`🎉 第 ${GS.level} 層清空 +30`; GS.level++; GS.s=ARC.goodsGen(GS.level,Math.random); }
  }
  else GS.sel={s,i};
  goodsDraw();
}
function goodsDraw(tickOnly){
  const box=arcBox("goods"); if(!box||!GS) return;
  const left=Math.max(0,Math.ceil((GS.endAt-Date.now())/1000));
  if(tickOnly){ const t=document.getElementById("goodsTime"); if(t){ t.textContent=`⏱ ${Math.floor(left/60)}:${String(left%60).padStart(2,"0")}`; return; } }
  const shelves=GS.s.map((sh,s)=>{
    const slots=sh.f.map((x,i)=>{
      const sel=GS.sel&&GS.sel.s===s&&GS.sel.i===i;
      return `<div onclick="goodsTap(${s},${i})" style="aspect-ratio:1;display:flex;align-items:center;justify-content:center;font-size:min(24px,6vw);cursor:pointer;`+
        `border-radius:7px;background:${x==null?"rgba(255,255,255,.45)":"#fff"};box-shadow:${sel?"0 0 0 2px var(--accent) inset":"none"}">${x==null?"":GOODS_ITEMS[x]}</div>`;
    }).join("");
    const back=sh.b.length?`<div style="font-size:10px;color:var(--sub);text-align:center;margin-top:2px">後面還有 ${sh.b.length} 層</div>`:`<div style="height:14px"></div>`;
    return `<div><div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:3px;padding:4px;border-radius:9px;background:#e9dcc5;border-bottom:4px solid #c9b38f">${slots}</div>${back}</div>`;
  }).join("");
  box.innerHTML=arcBar(`🛒 第 ${GS.level} 層　${GS.score} 分`, `<span id="goodsTime">⏱ ${Math.floor(left/60)}:${String(left%60).padStart(2,"0")}</span>　${arcEndBtn("goodsEnd()")}`)+
    (GS.msg?`<div style="text-align:center;font-size:13px;color:var(--green);margin-bottom:4px">${GS.msg}</div>`:"")+
    `<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px">${shelves}</div>`+
    `<div class="hint" style="text-align:center;margin-top:6px">點一樣東西，再點一個空格</div>`;
}
function goodsEnd(){
  if(!GS||GS.over) return; GS.over=true; clearInterval(GS.timer);
  arcFinish("goods",GS.score,`時間到！清到第 ${GS.level} 層，${GS.score} 分`);
}

/* ---------- 羊了個羊三消 ---------- */
let TL=null;
function tileStart(){ TL={level:1, cleared:0, over:false}; tileLevel(); }
function tileLevel(){ TL.tiles=ARC.tileGen(TL.level,Math.random); TL.tray=[]; TL.shuffles=1; TL.msg=""; tileDraw(); }
function tileTap(id){
  if(!TL||TL.over) return;
  const r=ARC.tilePick(TL,id); if(!r.ok) return;
  if(r.win){ TL.cleared++; TL.level++; TL.msg=`🎉 過關！`; tileDraw(); setTimeout(()=>{ if(TL&&!TL.over) tileLevel(); },700); return; }
  if(r.lose){ tileDraw(); TL.over=true; arcFinish("tile",TL.cleared,`槽滿了！過了 ${TL.cleared} 關`); return; }
  tileDraw();
}
function tileShuffleBtn(){ if(!TL||TL.over||TL.shuffles<1) return; TL.shuffles--; ARC.tileShuffle(TL,Math.random); tileDraw(); }
function tileEnd(){ if(!TL||TL.over) return; TL.over=true; arcFinish("tile",TL.cleared,`過了 ${TL.cleared} 關`); }
function tileDraw(){
  const box=arcBox("tile"); if(!box||!TL) return;
  const pct=100/ARC.TILE_W;
  const tiles=TL.tiles.slice().sort((a,b)=>a.z-b.z).map(t=>{
    const cov=ARC.tileCovered(TL.tiles,t);
    return `<div onclick="tileTap(${t.id})" style="position:absolute;left:${t.x*pct}%;top:${t.y/ARC.TILE_H*100}%;width:${2*pct}%;height:${2/ARC.TILE_H*100}%;`+
      `padding:1px;box-sizing:border-box;z-index:${t.z+1};cursor:${cov?"default":"pointer"}">`+
      `<div style="width:100%;height:100%;border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:22px;`+
      `background:${cov?"#cfc6b8":"#fffaf0"};border:1px solid #d8c9ac;box-shadow:0 2px 0 #c9b38f;${cov?"filter:brightness(.72);":""}">${TILE_ITEMS[t.t]}</div></div>`;
  }).join("");
  const tray=[...Array(ARC.TRAY).keys()].map(k=>{
    const t=TL.tray[k];
    return `<div style="aspect-ratio:1;border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:20px;background:${t==null?"var(--soft)":"#fffaf0"}">${t==null?"":TILE_ITEMS[t]}</div>`;
  }).join("");
  box.innerHTML=arcBar(`🐑 第 ${TL.level} 關　已過 ${TL.cleared} 關`, arcEndBtn("tileEnd()"))+
    (TL.msg?`<div style="text-align:center;font-size:13px;color:var(--green);margin-bottom:4px">${TL.msg}</div>`:"")+
    `<div style="position:relative;width:100%;max-width:330px;margin:0 auto;aspect-ratio:${ARC.TILE_W}/${ARC.TILE_H}">${tiles}</div>`+
    `<div style="display:grid;grid-template-columns:repeat(${ARC.TRAY},minmax(0,1fr));gap:4px;margin-top:10px;padding:6px;border-radius:10px;background:#e9dcc5">${tray}</div>`+
    `<div style="text-align:center;margin-top:8px"><button class="ghost sm" ${TL.shuffles?"":"disabled"} onclick="tileShuffleBtn()">🔀 洗牌（剩 ${TL.shuffles} 次）</button></div>`;
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
