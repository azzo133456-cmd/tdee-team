// 寵物系統（從 app.js 拆出；classic script，與 app.js 共用全域。需在 app.js 之前載入）
/* ---------- 養寵物（成長＝健康習慣；不碰 AI） ---------- */
let petData=null, petMeta=null;
// 貓/狗品種：自訂可愛 SVG（配色/耳型/花紋差異），其他物種維持 emoji
const PET_BREEDS={
  cat:{
    orange:{label:"橘貓", body:"#f4a64c", body2:"#e89636", belly:"#fde9cc", inner:"#f6c79b", ear:"up", eye:"#3aa563", markings:"tabby", stripe:"#d97c24"},
    tuxedo:{label:"賓士貓", body:"#34343c", body2:"#24242b", belly:"#ffffff", inner:"#cba6a6", ear:"up", eye:"#8ad06a", markings:"tuxedo"},
    calico:{label:"三花貓", body:"#fbf6ef", body2:"#ece3d6", belly:"#ffffff", inner:"#f3c9a0", ear:"up", eye:"#5bb6c9", markings:"calico", patchA:"#e89636", patchB:"#3a3a40"},
    cream:{label:"奶油金", body:"#f7d489", body2:"#eec76a", belly:"#fdf3d6", inner:"#f7dca7", ear:"up", eye:"#49a6d8", markings:"solid"},
    silvertabby:{label:"花花", body:"#b9bcc0", body2:"#8f9398", belly:"#edeef0", inner:"#e3b7b7", ear:"up", eye:"#8aa86a", markings:"tabby", stripe:"#6b6f76"},
  },
  dog:{
    shiba:{label:"柴犬", body:"#e7a05a", body2:"#d98c40", belly:"#fbf3e6", inner:"#f3c79a", ear:"up", eye:"#5a3a2a", markings:"shiba", white:"#fbf3e6"},
    frenchie:{label:"法鬥", body:"#bcb3a6", body2:"#a89e90", belly:"#efe9df", inner:"#d8b0b0", ear:"bat", eye:"#3a3a3a", markings:"frenchie", white:"#efe9df"},
    golden:{label:"黃金獵犬", body:"#f0c47a", body2:"#e3b066", belly:"#f8e6c2", inner:"#e8c79a", ear:"flop", eye:"#5a3a2a", markings:"solid"},
    collie:{label:"那那狗", body:"#34343c", body2:"#24242b", belly:"#ffffff", inner:"#cba6a6", ear:"flop", eye:"#7a5a3a", markings:"collie", white:"#ffffff"},
    dachshund:{label:"臘腸狗", body:"#bf6a30", body2:"#9c511d", belly:"#e8b27a", inner:"#d98c5a", ear:"longflop", eye:"#3a241a", markings:"dachshund", white:"#edc594"},
  },
};
function petBreedOf(species,breed){ const m=PET_BREEDS[species]; if(!m) return null; return m[breed]||m[Object.keys(m)[0]]; }

// 哪些寵物有「使用者提供的插圖」。圖檔放 public/pets/<資料夾>/<stage>.png（stage 0~4，缺哪張就回退）。
//   有品種：key "species:breed" → 資料夾 species_breed/   （例 cat_silvertabby）
//   無品種：key "species"        → 資料夾 species/        （例 jelly）
const PET_ART_KEYS=new Set([
  "cat:silvertabby",   // public/pets/cat_silvertabby/
  "bubu",              // public/pets/bubu/
  "jelly",             // public/pets/jelly/
  "money",             // public/pets/money/
  "hana2",             // public/pets/hana2/
  "hana3",             // public/pets/hana3/
  "choco",             // public/pets/choco/
]);
// 圖片資產版本：圖檔內容更新（如重新去背）但檔名不變時，bump 這個數字就能讓所有人強制重抓新圖（破快取）。
const ASSETV="150";
function petArtUrl(species,breed,stage){
  if(breed && PET_ART_KEYS.has(species+":"+breed)) return "pets/"+species+"_"+breed+"/"+stage+".png?v="+ASSETV;
  if(PET_ART_KEYS.has(species)) return "pets/"+species+"/"+stage+".png?v="+ASSETV;
  return null;
}
function petFacial(species,P){
  const m=P.markings;
  if(m==="tabby") return `<ellipse cx="50" cy="56" rx="13" ry="9" fill="${P.belly}"/>`+
    `<g stroke="${P.stripe}" stroke-width="2" stroke-linecap="round"><path d="M44,30 L43,38"/><path d="M50,28 L50,37"/><path d="M56,30 L57,38"/></g>`;
  if(m==="tuxedo") return `<ellipse cx="50" cy="58" rx="14" ry="12" fill="#fff"/>`;
  if(m==="calico") return `<ellipse cx="34" cy="36" rx="14" ry="14" fill="${P.patchA}"/><ellipse cx="68" cy="34" rx="12" ry="12" fill="${P.patchB}"/><ellipse cx="50" cy="57" rx="12" ry="9" fill="#fff"/>`;
  if(m==="shiba") return `<ellipse cx="50" cy="56" rx="15" ry="11" fill="${P.white}"/><ellipse cx="33" cy="50" rx="7" ry="8" fill="${P.white}"/><ellipse cx="67" cy="50" rx="7" ry="8" fill="${P.white}"/><ellipse cx="40" cy="36" rx="2.4" ry="2" fill="#e8c79a"/><ellipse cx="60" cy="36" rx="2.4" ry="2" fill="#e8c79a"/>`;
  if(m==="frenchie") return `<ellipse cx="50" cy="56" rx="13" ry="10" fill="${P.white}"/><ellipse cx="50" cy="40" rx="4" ry="12" fill="${P.white}"/>`;
  if(m==="collie") return `<ellipse cx="50" cy="44" rx="6" ry="20" fill="${P.white}"/><ellipse cx="50" cy="58" rx="12" ry="9" fill="${P.white}"/>`;
  if(m==="dachshund") return `<ellipse cx="50" cy="58" rx="10" ry="8" fill="${P.white}"/><ellipse cx="50" cy="40" rx="9" ry="11" fill="${P.body2}" opacity=".35"/>`;   // 淺色口鼻＋額頭深紅
  return `<ellipse cx="50" cy="55" rx="11" ry="8" fill="${P.body2}" opacity=".45"/>`;   // solid：淺色口鼻
}
// 產生寵物 SVG；species 不是貓/狗回 null（呼叫端 fallback emoji）
function petSVG(species,breed,stage,px){
  const P=petBreedOf(species,breed); if(!P) return null;
  const size=px||100, uid=(species+(breed||"")+stage+"_"+Math.floor(Math.random()*1e5));
  if(stage===0){
    return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">`+
      `<ellipse cx="50" cy="56" rx="27" ry="33" fill="#f4ede1" stroke="#e6dccb" stroke-width="1.5"/>`+
      `<circle cx="42" cy="46" r="3.2" fill="${P.body}" opacity=".5"/><circle cx="58" cy="58" r="4" fill="${P.body}" opacity=".45"/><circle cx="50" cy="40" r="2.6" fill="${P.body2}" opacity=".5"/>`+
      `<ellipse cx="41" cy="62" rx="3.5" ry="2.2" fill="#ffb0b6" opacity=".5"/><ellipse cx="59" cy="62" rx="3.5" ry="2.2" fill="#ffb0b6" opacity=".5"/>`+
      `<circle cx="44" cy="54" r="2.4" fill="#2b2b2b"/><circle cx="56" cy="54" r="2.4" fill="#2b2b2b"/>`+
      `<path d="M46,60 q4,3 8,0" fill="none" stroke="#2b2b2b" stroke-width="1.4" stroke-linecap="round"/></svg>`;
  }
  const sc=[0,.8,.9,.97,1.04][stage]||1;
  const body=P.body, body2=P.body2||P.body, inner=P.inner||"#f0c0a0";
  // 每階段不同體型：幼體大頭小身、成體勻稱、進化體較壯（頭固定以對齊五官）
  const bp=({1:[12,10,78],2:[16,14,78],3:[20,17,76],4:[21,18,75]})[stage]||[20,17,76];
  const bRx=bp[0], bRy=bp[1], bCy=bp[2], pawY=bCy+bRy-2;
  const eyeR=stage===1?5.2:4.2;   // 幼體大眼
  let ears="";
  if(P.ear==="up") ears=`<path d="M32,28 L24,8 L46,24 Z" fill="${body}"/><path d="M68,28 L76,8 L54,24 Z" fill="${body}"/><path d="M33,26 L28,13 L43,24 Z" fill="${inner}"/><path d="M67,26 L72,13 L57,24 Z" fill="${inner}"/>`;
  else if(P.ear==="bat") ears=`<ellipse cx="30" cy="20" rx="9" ry="15" fill="${body}" transform="rotate(-10 30 20)"/><ellipse cx="70" cy="20" rx="9" ry="15" fill="${body}" transform="rotate(10 70 20)"/><ellipse cx="30" cy="21" rx="4.5" ry="9" fill="${inner}" transform="rotate(-10 30 21)"/><ellipse cx="70" cy="21" rx="4.5" ry="9" fill="${inner}" transform="rotate(10 70 21)"/>`;
  else if(P.ear==="longflop") ears=`<path d="M33,30 Q12,40 17,66 Q24,74 33,60 Q31,42 39,33 Z" fill="${body2}"/><path d="M67,30 Q88,40 83,66 Q76,74 67,60 Q69,42 61,33 Z" fill="${body2}"/>`;   // 長毛臘腸的長垂耳
  else ears=`<ellipse cx="26" cy="46" rx="9" ry="16" fill="${body2}"/><ellipse cx="74" cy="46" rx="9" ry="16" fill="${body2}"/>`;
  const noseCol=species==="cat"?"#c8697e":"#3a3033";
  let s=`<g transform="translate(50,54) scale(${sc}) translate(-50,-54)">`;
  if(stage>=4) s+=`<g fill="#fdf2d0" stroke="#ecce86" stroke-width="1"><path d="M34,70 Q12,50 6,68 Q10,82 34,78 Z"/><path d="M66,70 Q88,50 94,68 Q90,82 66,78 Z"/></g>`;   // 進化體：翅膀
  s+=`<path d="M70,78 q22,-2 16,-20" fill="none" stroke="${body}" stroke-width="7" stroke-linecap="round"/>`;
  s+=ears;
  s+=`<ellipse cx="50" cy="${bCy}" rx="${bRx}" ry="${bRy}" fill="${body}"/>`;
  s+=`<ellipse cx="50" cy="${bCy+3}" rx="${Math.max(8,bRx-7)}" ry="${Math.max(7,bRy-6)}" fill="${P.belly}"/>`;
  s+=`<ellipse cx="43" cy="${pawY}" rx="5" ry="4" fill="${P.belly}"/><ellipse cx="57" cy="${pawY}" rx="5" ry="4" fill="${P.belly}"/>`;
  if(stage===1) s+=`<path d="M30,76 Q50,92 70,76 Q68,92 62,95 Q50,99 38,95 Q32,92 30,76 Z" fill="#f6efe3" stroke="#e2d8c6" stroke-width="1.2"/><path d="M30,76 l5,5 6,-6 5,6 6,-6 5,6 6,-6 5,5" fill="none" stroke="#e2d8c6" stroke-width="1.2" stroke-linejoin="round"/>`;   // 幼體：剛孵化的蛋殼
  s+=`<circle cx="50" cy="46" r="23" fill="${body}"/>`;
  s+=`<clipPath id="h${uid}"><circle cx="50" cy="46" r="23"/></clipPath>`;
  s+=`<g clip-path="url(#h${uid})">${petFacial(species,P)}</g>`;
  s+=`<ellipse cx="35" cy="52" rx="3.6" ry="2.3" fill="#ff9aa0" opacity=".5"/><ellipse cx="65" cy="52" rx="3.6" ry="2.3" fill="#ff9aa0" opacity=".5"/>`;
  s+=`<circle cx="42" cy="45" r="${eyeR}" fill="#2b2b2b"/><circle cx="58" cy="45" r="${eyeR}" fill="#2b2b2b"/>`;
  s+=`<circle cx="${43.4-(eyeR-4.2)}" cy="${43.4-(eyeR-4.2)}" r="${eyeR*0.34}" fill="#fff"/><circle cx="${59.4-(eyeR-4.2)}" cy="${43.4-(eyeR-4.2)}" r="${eyeR*0.34}" fill="#fff"/>`;
  s+=`<ellipse cx="50" cy="52" rx="2.4" ry="1.7" fill="${noseCol}"/>`;
  s+=`<path d="M50,53.5 q-3,3.5 -6,1.5 M50,53.5 q3,3.5 6,1.5" fill="none" stroke="#5a4a4a" stroke-width="1.2" stroke-linecap="round"/>`;
  if(species==="cat") s+=`<g stroke="#999" stroke-width=".8" opacity=".55" stroke-linecap="round"><path d="M33,50 L20,48"/><path d="M33,53 L20,55"/><path d="M67,50 L80,48"/><path d="M67,53 L80,55"/></g>`;
  if(stage>=4) s+=`<path d="M40,25 L38,11 L45,18 L50,7 L55,18 L62,11 L60,25 Z" fill="#ffd24a" stroke="#e0a92a" stroke-width="1" stroke-linejoin="round"/><circle cx="50" cy="12" r="1.7" fill="#ff6f91"/>`;   // 進化體：皇冠
  s+=`</g>`;
  let extra="";
  if(stage>=4) extra=`<g fill="#ffd24a"><path d="M16,24 l1.6,4 4,1.6 -4,1.6 -1.6,4 -1.6,-4 -4,-1.6 4,-1.6 z"/><path d="M84,30 l1.2,3 3,1.2 -3,1.2 -1.2,3 -1.2,-3 -3,-1.2 3,-1.2 z"/><path d="M80,70 l1,2.6 2.6,1 -2.6,1 -1,2.6 -1,-2.6 -2.6,-1 2.6,-1 z"/></g>`;
  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">${s}${extra}</svg>`;
}
// 取寵物圖示：優先用使用者插圖(<img>)，否則貓/狗 SVG，再否則 emoji
function petGlyph(pet,size){
  if(!pet) return "";
  const art=petArtUrl(pet.species,pet.breed,pet.stageIdx);
  if(art){ const fb=(petSVG(pet.species,pet.breed,pet.stageIdx,size)||`<span style='font-size:${Math.round((size||40)*0.6)}px'>${pet.emoji||"🐾"}</span>`).replace(/"/g,"&quot;");
    return `<img src="${art}" width="${size}" height="${size}" style="object-fit:contain;display:block;" onerror="this.outerHTML='${fb}'">`; }
  const svg=petSVG(pet.species,pet.breed,pet.stageIdx,size);
  return svg||`<span style="font-size:${Math.round((size||40)*0.6)}px;">${pet.emoji||"🐾"}</span>`;
}
async function loadPet(){
  try{ const r=await api("/api/pet"); petData=r.pet; petMeta={species:r.species,rareKeys:r.rareKeys||[],stageNames:r.stageNames,stageExp:r.stageExp,shop:r.shop,feed:r.feed,gacha:r.gacha,shieldCost:r.shieldCost,racerArts:r.racerArts||{}};
    if(Array.isArray(r.artKeys)) r.artKeys.forEach(k=>PET_ART_KEYS.add(k));   // 伺服器回傳的插圖清單（含自訂寵物）自動啟用，前端免手改 }
  }
  catch(e){ petData=null; }
  renderPet(); renderDailyTasks();
  loadCalorieGame(); loadQuizGame(); loadBingoGame(); loadBossGame(); loadSpinGame(); loadMemoryGame();
}
/* ---------- 小遊戲：熱量猜謎（每日一題） ---------- */
let calorieLoaded=false, quizLoaded=false;   // 載入一次就好，避免背景重繪洗掉作答中的內容
async function loadCalorieGame(){
  const card=document.getElementById("gameCard"); if(!card) return;
  if(calorieLoaded) return;                  // 已載入過就不重畫
  try{ const g=await api("/api/game/calorie"); renderCalorieGame(g); calorieLoaded=true; }
  catch(e){ card.style.display="none"; }   // 沒寵物等情況：隱藏整張卡
}
function renderCalorieGame(g){
  const card=document.getElementById("gameCard"), box=document.getElementById("gameBox");
  if(!card||!box) return;
  card.style.display="";
  if(g.played && g.result){
    const r=g.result;
    box.innerHTML=`<div style="font-weight:600;">${g.emoji||"🍽️"} ${g.name}</div>`+
      `<div class="hint" style="margin-top:6px;">你猜 <b>${r.guess}</b> kcal｜正解 <b>${r.answer}</b> kcal</div>`+
      `<div style="margin-top:4px;font-weight:700;color:var(--green)">${r.rank}　+🦴${r.coins}</div>`+
      `<div class="hint tip" style="margin-top:6px;">明天再來挑戰新題目 🎯</div>`;
    return;
  }
  box.innerHTML=`<div style="font-weight:600;">${g.emoji||"🍽️"} ${g.name}</div>`+
    `<div class="hint" style="margin:6px 0;">猜猜這份大約多少大卡？越接近、骨頭幣越多（一天一次）。</div>`+
    `<div class="row" style="gap:8px;align-items:flex-end;">`+
      `<div style="flex:1;"><input id="calGuess" type="number" inputmode="numeric" placeholder="例如 500"></div>`+
      `<button onclick="playCalorieGame()" style="flex:0 0 auto;width:auto;padding:13px 18px;white-space:nowrap;">猜！</button>`+
    `</div>`;
}
async function playCalorieGame(){
  const el=document.getElementById("calGuess"); if(!el) return;
  const v=el.value; if(v===""){ alert("先輸入一個數字"); return; }
  try{
    const r=await api("/api/game/calorie",{method:"POST",body:JSON.stringify({guess:+v})});
    if(r.pet) petData=r.pet;
    const box=document.getElementById("gameBox");
    if(box) box.innerHTML=`<div style="font-weight:600;">${r.name}</div>`+
      `<div class="hint" style="margin-top:6px;">你猜 <b>${r.guess}</b> kcal｜正解 <b>${r.answer}</b> kcal</div>`+
      `<div style="margin-top:6px;font-size:18px;font-weight:800;color:var(--green)">${r.rank}　+🦴${r.coins}</div>`+
      `<div class="hint tip" style="margin-top:6px;">明天再來挑戰新題目 🎯</div>`;
    if(typeof renderPet==="function") renderPet();   // 更新骨頭幣顯示
  }catch(e){ alert(e.message); }
}
/* ---------- 小遊戲：健康知識測驗（每日一題） ---------- */
async function loadQuizGame(){
  const card=document.getElementById("quizCard"); if(!card) return;
  if(quizLoaded) return;
  try{ const g=await api("/api/game/quiz"); renderQuizGame(g); quizLoaded=true; }
  catch(e){ card.style.display="none"; }
}
function renderQuizGame(g){
  const card=document.getElementById("quizCard"), box=document.getElementById("quizBox");
  if(!card||!box) return;
  card.style.display="";
  if(g.played && g.result){
    const r=g.result;
    box.innerHTML=`<div style="font-weight:600;">${g.q}</div>`+
      `<div style="margin-top:6px;font-weight:700;color:${r.correct?'var(--green)':'#b5564e'}">${r.correct?'答對了 ✅':'答錯了 ❌'}　+🦴${r.coins}</div>`+
      `<div class="hint" style="margin-top:4px;">正解：${g.options?g.options[r.answer]:""}</div>`+
      `<div class="hint tip" style="margin-top:6px;">明天再來一題 🧠</div>`;
    return;
  }
  box.innerHTML=`<div style="font-weight:600;margin-bottom:8px;">${g.q}</div>`+
    g.options.map((o,i)=>`<button class="ghost" style="display:block;width:100%;text-align:left;margin:6px 0;" onclick="playQuizGame(${i})">${String.fromCharCode(65+i)}. ${o}</button>`).join("");
}
async function playQuizGame(choice){
  try{
    const r=await api("/api/game/quiz",{method:"POST",body:JSON.stringify({choice})});
    if(r.pet) petData=r.pet;
    const box=document.getElementById("quizBox");
    if(box) box.innerHTML=`<div style="font-size:18px;font-weight:800;color:${r.correct?'var(--green)':'#b5564e'}">${r.correct?'答對了 ✅':'答錯了 ❌'}　+🦴${r.coins}</div>`+
      `<div class="hint" style="margin-top:6px;">正解：${r.options[r.answer]}</div>`+
      `<div class="hint" style="color:var(--ink);line-height:1.6;margin-top:4px;">${r.why}</div>`+
      `<div class="hint tip" style="margin-top:6px;">明天再來一題 🧠</div>`;
    if(typeof renderPet==="function") renderPet();
  }catch(e){ alert(e.message); }
}
/* ---------- 小遊戲：健康賓果（每週 3x3，完成連線領幣） ---------- */
async function loadBingoGame(){
  const card=document.getElementById("bingoCard"); if(!card) return;
  try{ const g=await api("/api/game/bingo"); renderBingoGame(g); }
  catch(e){ card.style.display="none"; }
}
function renderBingoGame(g){
  const card=document.getElementById("bingoCard"), box=document.getElementById("bingoBox");
  if(!card||!box) return;
  card.style.display="";
  const inLine=new Set(); g.completedLines.forEach(i=>g.lines[i].forEach(idx=>inLine.add(idx)));
  const cells=g.cells.map((c,i)=>{
    const done=c.done, line=inLine.has(i);
    const bg=done?(line?"var(--green)":"var(--soft)"):"#fff";
    const col=done&&line?"#fff":(done?"var(--green)":"var(--sub)");
    return `<div style="aspect-ratio:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;border:1px solid ${done?'var(--green)':'var(--line)'};border-radius:10px;background:${bg};color:${col};padding:4px;font-size:11px;line-height:1.25;">`+
      `<div style="font-size:15px;margin-bottom:2px;">${done?'✅':'⬜'}</div>${c.label}</div>`;
  }).join("");
  let html=`<div class="hint" style="margin-bottom:8px;">本週完成健康行為連成一線就能領骨頭幣（每週一重置）。</div>`+
    `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;">${cells}</div>`;
  html+=`<div style="margin-top:10px;font-size:13px;">已連線 <b>${g.completedLines.length}</b> 條　·　已領 ${g.claimedLines.length} 條${g.fullClaimed?"　·　全滿獎已領 🏅":""}</div>`;
  if(g.claimable>0){
    html+=`<button onclick="claimBingo()" style="margin-top:8px;">🦴 領取連線獎勵 +${g.claimable}</button>`;
  }else{
    html+=`<div class="hint tip" style="margin-top:8px;">完成更多行為連成新線就能領獎；集滿 9 格再加碼 +🦴36。</div>`;
  }
  box.innerHTML=html;
}
async function claimBingo(){
  try{
    const r=await api("/api/game/bingo/claim",{method:"POST",body:JSON.stringify({})});
    if(r.pet) petData=r.pet;
    await loadBingoGame();
    if(typeof renderPet==="function") renderPet();
    alert(`領到 🦴${r.coins}！${r.full?"(含集滿全卡加碼)":""}`);
  }catch(e){ alert(e.message); }
}
/* ---------- 小遊戲：團隊魔王戰（每週，群組合作） ---------- */
async function loadBossGame(){
  const card=document.getElementById("bossCard"); if(!card) return;
  try{ const g=await api("/api/game/boss"); renderBossGame(g.bosses||[]); }
  catch(e){ card.style.display="none"; }
}
function renderBossGame(bosses){
  const card=document.getElementById("bossCard"), box=document.getElementById("bossBox");
  if(!card||!box) return;
  if(!bosses.length){ card.style.display="none"; return; }   // 沒加入任何競賽群組就不顯示
  card.style.display="";
  box.innerHTML=`<div class="hint" style="margin-bottom:8px;">全隊本週的健康行為會累積成傷害打魔王，打倒後每人各領一次 🦴${bosses[0].reward}（每週一重置）。</div>`+
    bosses.map(b=>{
      const pct=Math.min(100,Math.round(b.damage/b.hp*100));
      const hpLeft=Math.max(0,b.hp-b.damage);
      let action;
      if(b.defeated && !b.claimed) action=`<button onclick="claimBoss(${b.groupId})" style="margin-top:6px;">🏆 領取討伐獎勵 +🦴${b.reward}</button>`;
      else if(b.defeated && b.claimed) action=`<div class="hint" style="margin-top:4px;color:var(--green)">✅ 已討伐並領獎，下週再戰！</div>`;
      else action=`<div class="hint" style="margin-top:4px;">剩餘血量 <b>${hpLeft}</b>／${b.hp}，全隊一起完成健康行為來補刀！</div>`;
      return `<div style="border:1px solid var(--line);border-radius:12px;padding:10px 12px;margin-bottom:8px;">`+
        `<div style="display:flex;justify-content:space-between;align-items:baseline;">`+
          `<span style="font-weight:700;">${b.bossName}</span>`+
          `<span class="hint">${b.name}・${b.members}人</span></div>`+
        `<div style="font-size:12px;color:var(--sub);margin:4px 0 2px;">傷害 ${b.damage}／${b.hp}　${b.defeated?'<b style="color:var(--green)">已討伐 🎉</b>':''}</div>`+
        `<div class="prog"><i style="width:${pct}%;${b.defeated?'background:var(--green);':''}"></i></div>`+
        action+`</div>`;
    }).join("");
}
async function claimBoss(groupId){
  try{
    const r=await api("/api/game/boss/claim",{method:"POST",body:JSON.stringify({groupId})});
    if(r.pet) petData=r.pet;
    await loadBossGame();
    if(typeof renderPet==="function") renderPet();
    alert(`討伐成功！領到 🦴${r.reward} 🏆`);
  }catch(e){ alert(e.message); }
}
/* ---------- 小遊戲：每日免費轉盤 ---------- */
let spinSeg=[];
async function loadSpinGame(){
  const card=document.getElementById("spinCard"); if(!card) return;
  try{ const g=await api("/api/game/spin"); renderSpinGame(g); }
  catch(e){ card.style.display="none"; }
}
function spinWheelSvg(segments, rotation){
  const cx=110,cy=110,r=100,n=segments.length,step=360/n;
  const colors=["#f4c95d","#e8825e","#7fb08a","#5b8aa6","#c98b5e","#9b7cb6","#8aa6c9","#d08bb0"];
  let paths="";
  for(let i=0;i<n;i++){
    const a0=(i*step-90)*Math.PI/180,a1=((i+1)*step-90)*Math.PI/180;
    const x0=(cx+r*Math.cos(a0)).toFixed(1),y0=(cy+r*Math.sin(a0)).toFixed(1),x1=(cx+r*Math.cos(a1)).toFixed(1),y1=(cy+r*Math.sin(a1)).toFixed(1);
    paths+=`<path d="M${cx},${cy} L${x0},${y0} A${r},${r} 0 0 1 ${x1},${y1} Z" fill="${colors[i%colors.length]}" stroke="#fff" stroke-width="2"/>`;
    const am=((i+0.5)*step-90)*Math.PI/180,tx=(cx+r*0.64*Math.cos(am)).toFixed(1),ty=(cy+r*0.64*Math.sin(am)).toFixed(1);
    paths+=`<text x="${tx}" y="${ty}" font-size="15" font-weight="800" fill="#3a2f25" text-anchor="middle" dominant-baseline="middle">${segments[i].jackpot?'★'+segments[i].coins:segments[i].coins}</text>`;
  }
  return `<svg viewBox="0 0 220 226" style="max-width:240px;display:block;margin:0 auto;">`+
    `<g id="wheelG" style="transform-origin:110px 110px;transform:rotate(${rotation}deg);transition:transform 3.4s cubic-bezier(.16,.7,.18,1);">${paths}</g>`+
    `<circle cx="110" cy="110" r="13" fill="#fff" stroke="#ddd" stroke-width="2"/>`+
    `<polygon points="110,4 102,22 118,22" fill="#b5564e"/>`+
    `</svg>`;
}
function segRotation(i,n){ const step=360/n; return 360*6 - (i*step + step/2); }
function renderSpinGame(g){
  const card=document.getElementById("spinCard"), box=document.getElementById("spinBox");
  if(!card||!box) return;
  card.style.display=""; spinSeg=g.segments;
  if(g.played && g.result){
    box.innerHTML=spinWheelSvg(g.segments, segRotation(g.result.index,g.segments.length))+
      `<div style="text-align:center;margin-top:8px;font-weight:700;color:var(--green)">今天轉到 +🦴${g.result.coins}${g.result.jackpot?' ★大獎!':''}</div>`+
      `<div class="hint tip" style="text-align:center;margin-top:4px;">明天再免費轉一次 🎡</div>`;
    return;
  }
  box.innerHTML=spinWheelSvg(g.segments, 0)+
    `<div style="text-align:center;margin-top:10px;"><button onclick="spinWheel()" id="spinBtn" style="width:auto;padding:12px 28px;">🎡 免費轉一次</button></div>`+
    `<div id="spinResult" style="text-align:center;margin-top:8px;font-weight:700;"></div>`;
}
async function spinWheel(){
  const btn=document.getElementById("spinBtn"); if(btn){ btn.disabled=true; btn.style.opacity=".5"; }
  try{
    const r=await api("/api/game/spin",{method:"POST",body:JSON.stringify({})});
    if(r.pet) petData=r.pet;
    const wg=document.getElementById("wheelG");
    if(wg) wg.style.transform="rotate("+segRotation(r.index,spinSeg.length)+"deg)";
    setTimeout(()=>{
      const res=document.getElementById("spinResult");
      if(res) res.innerHTML=`🎉 轉到 +🦴${r.coins}${r.jackpot?' ★大獎!🏆':''}！<div class="hint tip" style="margin-top:4px;">明天再免費轉一次</div>`;
      if(btn) btn.style.display="none";
      if(typeof renderPet==="function") renderPet();
    },3500);
  }catch(e){ if(btn){ btn.disabled=false; btn.style.opacity="1"; } alert(e.message); }
}
/* ---------- 小遊戲：記憶翻牌配對 ---------- */
let memState=null;
async function loadMemoryGame(){
  const card=document.getElementById("memCard"); if(!card) return;
  try{ const g=await api("/api/game/memory"); renderMemoryGame(g); }
  catch(e){ card.style.display="none"; }
}
function renderMemoryGame(g){
  const card=document.getElementById("memCard"), box=document.getElementById("memBox");
  if(!card||!box) return; card.style.display="";
  const last=(g.played&&g.result)?`<div class="hint" style="text-align:center;">今天已完成：${g.result.moves} 步、得 🦴${g.result.coins}（可再玩，但今天獎勵已領）</div>`
    :`<div class="hint" style="text-align:center;">翻牌找一對，步數越少獎越多（每天首次完成發幣）。</div>`;
  box.innerHTML=last+`<div style="text-align:center;margin-top:8px;"><button onclick="startMemory()" style="width:auto;padding:12px 24px;">🃏 開始遊戲</button></div>`;
}
function memShuffle(a){ a=a.slice(); for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
function startMemory(){
  const pool=["🍎","🍌","🍗","🥚","🍚","🥦","🍓","🐱","🐶","🐰","🐻","🦊","🐯","🐸","🍕","🍩"];
  const picks=memShuffle(pool).slice(0,8);
  const cards=memShuffle(picks.concat(picks)).map(e=>({e,open:false,done:false}));
  memState={cards,flipped:[],moves:0,matched:0,busy:false};
  drawMemory();
}
function drawMemory(){
  const box=document.getElementById("memBox"); if(!box||!memState) return;
  const grid=memState.cards.map((c,i)=>{
    const show=c.open||c.done;
    return `<div onclick="flipMemory(${i})" style="aspect-ratio:1;display:flex;align-items:center;justify-content:center;font-size:26px;border-radius:10px;cursor:pointer;user-select:none;background:${show?'#fff':'var(--accent)'};border:1px solid var(--line);${c.done?'opacity:.45;':''}">${show?c.e:''}</div>`;
  }).join("");
  box.innerHTML=`<div style="text-align:center;font-size:13px;margin-bottom:6px;">步數 ${memState.moves}　配對 ${memState.matched}/8</div>`+
    `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;max-width:300px;margin:0 auto;">${grid}</div>`;
}
function flipMemory(i){
  if(!memState||memState.busy) return;
  const c=memState.cards[i]; if(!c||c.open||c.done) return;
  c.open=true; memState.flipped.push(i); drawMemory();
  if(memState.flipped.length===2){
    memState.moves++; memState.busy=true;
    const [a,b]=memState.flipped;
    if(memState.cards[a].e===memState.cards[b].e){
      memState.cards[a].done=memState.cards[b].done=true; memState.matched++; memState.flipped=[]; memState.busy=false; drawMemory();
      if(memState.matched===8) finishMemory();
    }else{
      setTimeout(()=>{ if(!memState) return; memState.cards[a].open=memState.cards[b].open=false; memState.flipped=[]; memState.busy=false; drawMemory(); },800);
    }
  }
}
async function finishMemory(){
  const moves=memState.moves;
  try{
    const r=await api("/api/game/memory",{method:"POST",body:JSON.stringify({moves})});
    if(r.pet) petData=r.pet;
    const box=document.getElementById("memBox");
    if(box) box.innerHTML+=`<div style="text-align:center;margin-top:10px;font-weight:800;color:var(--green)">🎉 完成！${moves} 步${r.already?'（今天獎勵已領，純練習）':' +🦴'+r.coins}</div>`+
      `<div style="text-align:center;margin-top:8px;"><button onclick="startMemory()" style="width:auto;padding:10px 22px;">再玩一次</button></div>`;
    if(typeof renderPet==="function") renderPet();
  }catch(e){ alert(e.message); }
}
// 今日任務（前端依本機資料即時判定；幣由伺服器依達標自動入帳，這裡只做顯示/激勵）
function petDailyTasks(){
  const td=(typeof todayStr==="function")?todayStr():new Date().toISOString().slice(0,10);
  const recT=((typeof store!=="undefined"&&store.records)||[]).find(r=>r.date.slice(0,10)===td)||{};
  const exT=((typeof store!=="undefined"&&store.exercises)||[]).some(e=>e.date.slice(0,10)===td);
  const nutK=(typeof dayNutrition==="function")?(dayNutrition(td).k||0):0;
  const w=((typeof store!=="undefined"&&store.profile&&+store.profile.weight))||60;
  const goal=Math.round(w*45/50)*50;
  const water=(typeof waterFor==="function")?waterFor(td):(+recT.water_ml||0);
  return [
    {ok:nutK>0, name:"記錄飲食", coin:5},
    {ok:water>0, name:"有喝水", coin:2},
    {ok:exT, name:"運動", coin:3},
    {ok:(+recT.poop||0)>0, name:"嗯嗯", coin:1},
    {ok:recT.weight!=null, name:"量體重", coin:2},
  ];
}
// 概覽頁的「今日任務」卡（連結寵物成長＋競賽自律分）
function renderDailyTasks(){
  const box=document.getElementById("taskBox"); if(!box) return;
  const tasks=petDailyTasks(), doneN=tasks.filter(t=>t.ok).length;
  const pill=document.getElementById("taskPill"); if(pill) pill.textContent=doneN+"/"+tasks.length;
  const rows=tasks.map(t=>`<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--line);${t.ok?'':'opacity:.6;'}">`+
    `<span style="font-size:16px;">${t.ok?'✅':'⬜'}</span>`+
    `<span style="flex:1;font-size:14px;">${t.name}</span>`+
    `<span style="font-size:12px;color:#a5701a;">+${t.coin}🦴</span></div>`).join("");
  const hasPet=petData&&petData.chosen;
  const allDone=doneN>=tasks.length;
  const bonus=(hasPet&&petData.allClearClaimed)
    ? `<div style="margin-top:8px;padding:6px 10px;border-radius:8px;background:#fff4e0;color:#a5701a;font-size:13px;font-weight:600;text-align:center;">🎉 今日任務全清！已獲得 +15🦴</div>`
    : allDone
      ? `<div class="hint" style="margin-top:8px;text-align:center;">🎉 全部完成！+15🦴 獎勵即將入帳…</div>`
      : `<div class="hint" style="margin-top:8px;text-align:center;">全部完成可得 <b>+15🦴</b> 全清獎勵</div>`;
  const sCost=(petMeta&&petMeta.shieldCost)||120;
  const shieldRow=hasPet
    ? `<div style="display:flex;align-items:center;gap:8px;margin-top:8px;font-size:13px;">`+
      `<span>🧊 連續保護卡 ×${petData.shields||0}</span>`+
      `<span class="hint" style="flex:1;">漏記一天簽到自動接住連續</span>`+
      `<button class="ghost sm" ${petData.coins>=sCost?'':'disabled'} style="${petData.coins>=sCost?'':'opacity:.45;'}" onclick="buyShield()">買 🦴${sCost}</button></div>`
    : "";
  const checkin=hasPet
    ? (petData.canCheckin
        ? `<button class="sm" style="width:100%;margin-top:10px;" onclick="petCheckin()">🎁 每日簽到（已連 ${petData.checkinStreak} 天）</button>`+shieldRow
        : `<div class="hint" style="margin-top:10px;text-align:center;">✅ 今天已簽到 · 連續 ${petData.checkinStreak} 天</div>`+shieldRow)
    : `<div class="hint" style="margin-top:10px;">到「紀錄 → 🐣 我的寵物」領養一隻，完成任務就能賺 🦴 骨頭幣＋每日簽到拿獎勵。</div>`;
  box.innerHTML=
    `<div class="hint" style="margin-bottom:8px;">完成今日任務 → <b>養大寵物</b> 🐾 ＋ 累積 <b>競賽自律分</b> 🏆</div>`+
    rows+bonus+checkin;
}
// 每日簽到（連續天數越多獎勵越大）
async function petCheckin(){
  try{ const r=await api("/api/pet/checkin",{method:"POST",body:JSON.stringify({})}); petData=r.pet; renderPet(); renderDailyTasks();
    petToast(`${r.big?"🎉 第7天大獎！":"✅ 簽到成功"} 連續 ${r.streak} 天，獲得 🦴${r.reward}${r.usedShield?"（🧊 用掉 1 張保護卡接住連續）":""}`); }
  catch(e){ alert(e.message); }
}
async function buyShield(){
  const cost=(petMeta&&petMeta.shieldCost)||120;
  if(!confirm(`花 🦴${cost} 買 1 張連續保護卡？漏記一天簽到時自動使用，連續不中斷。`)) return;
  try{ const r=await api("/api/pet/shield",{method:"POST",body:JSON.stringify({})}); petData=r.pet; renderDailyTasks(); petToast("🧊 連續保護卡 +1"); }
  catch(e){ alert(e.message); }
}
// 扭蛋（單抽/十連）
async function petGacha(count){
  const cost=count===10?(petMeta&&petMeta.gacha&&petMeta.gacha.tenCost):(petMeta&&petMeta.gacha&&petMeta.gacha.cost);
  if(!confirm(`花 🦴${cost} 抽 ${count} 發？`)) return;
  try{
    const r=await api("/api/pet/gacha",{method:"POST",body:JSON.stringify({count})}); petData=r.pet;
    showGachaResults(r.results);   // 結果畫面停留到使用者按「關閉」(內含 renderPet 回主畫面)；別在這再 renderPet 否則會立刻蓋掉結果
  }catch(e){ alert(e.message); }
}
function showGachaResults(results){
  const box=document.getElementById("petBox"); if(!box) return;
  const cell=(x)=>{
    const big=x.rare?'box-shadow:0 0 0 2px #ffd24a;':'';
    let glyph=`<span style="font-size:24px;">${x.label}</span>`, sub="";
    if(x.type==="coin"){ glyph=`<span style="font-size:24px;">🦴</span>`; sub="+"+x.amount; }
    else if(x.type==="dup"){ sub="重複 +🦴"+x.amount; }
    else if(x.type==="pet"){ glyph=petGlyph({species:x.species,breed:x.breed,stageIdx:2,emoji:x.label},30); sub=(x.illus?"✨稀有！":"新寵物🎉 ")+x.label; }
    else if(x.type==="petdup"){ glyph=petGlyph({species:x.species,breed:x.breed,stageIdx:2,emoji:x.label},30); sub="已擁有 "+x.label+(x.amount?" +🦴"+x.amount:""); }
    else if(x.type==="racer"){ glyph=`<img src="racers/${x.key}.png?v=${ASSETV}" style="width:28px;height:28px;object-fit:contain;display:block;">`; sub="新賽道角色🏁 "+x.label; }
    else if(x.type==="racerdup"){ glyph=`<img src="racers/${x.key}.png?v=${ASSETV}" style="width:28px;height:28px;object-fit:contain;display:block;">`; sub="已擁有 "+x.label+(x.amount?" +🦴"+x.amount:""); }
    else sub="飾品";
    return `<div style="border:1px solid var(--line);border-radius:10px;padding:8px 4px;text-align:center;flex:0 0 auto;width:62px;${big}">`+
      `<div style="height:30px;display:flex;align-items:center;justify-content:center;line-height:1.1;">${glyph}</div><div style="font-size:10px;color:var(--sub);margin-top:2px;">${sub}</div></div>`;
  };
  box.innerHTML=`<div style="text-align:center;font-size:15px;font-weight:600;margin-bottom:8px;">🥚 扭蛋結果</div>`+
    `<div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center;">${results.map(cell).join("")}</div>`+
    (results.some(x=>x.type==="pet")?`<div class="hint" style="text-align:center;margin-top:8px;">解鎖新寵物！到「換寵物」就能領養出戰 🎉</div>`:"")+
    `<div class="chipbar" style="margin-top:12px;justify-content:center;"><button class="ghost sm" onclick="renderPet()">關閉</button></div>`;
}
async function choosePet(sp,breed){
  try{ const r=await api("/api/pet/choose",{method:"POST",body:JSON.stringify({species:sp,breed:breed||null})}); petData=r.pet; renderPet(); }
  catch(e){ alert(e.message); }
}
async function equipPet(item){
  try{ const r=await api("/api/pet",{method:"PUT",body:JSON.stringify({equipped:item})}); petData=r.pet; renderPet(); }
  catch(e){ alert(e.message); }
}
async function renamePet(){
  const cur=petData&&petData.name||"";
  const nv=(prompt("幫寵物取個名字（最多 16 字）：",cur)||"").trim();
  if(nv===cur) return;
  try{ const r=await api("/api/pet",{method:"PUT",body:JSON.stringify({name:nv})}); petData=r.pet; renderPet(); }
  catch(e){ alert(e.message); }
}
function renderPet(){
  const box=document.getElementById("petBox"); if(!box) return;
  const pill=document.getElementById("petPill");
  if(!petData){ box.innerHTML='<div class="hint">載入中…</div>'; return; }
  // 還沒領養 → 選一隻
  if(!petData.chosen){
    if(pill) pill.textContent="";
    box.innerHTML=`<div class="hint" style="margin-bottom:8px;">挑一隻<b>基本款</b>當<b>起手夥伴</b>（免費）！插圖／特殊寵物要到<b>扭蛋</b>抽到才能領養。牠會跟著你的健康習慣一起長大。</div>`+petChooserHtml(null,false,true);
    return;
  }
  const p=petData;
  if(pill) pill.textContent=p.stageName;
  const next=p.nextExp;
  const base=(petMeta&&petMeta.stageExp&&petMeta.stageExp[p.stageIdx])||0;
  const pct=next?Math.min(100,Math.round((p.exp-base)/((next-base)||1)*100)):100;
  const moodColor=p.mood>=70?"#3a9":p.mood>=40?"#b93":"#a66";
  // 可裝備（免費解鎖 ∪ 已購買）
  const items=p.equippable||p.unlocked||[];
  const itemBtns=items.length?items.map(it=>`<button class="ghost sm" style="${p.equipped===it?'background:var(--soft);border-color:var(--accent);':''}" onclick="equipPet('${p.equipped===it?'':it}')">${it}</button>`).join("")
    :`<span class="hint">還沒有飾品～連續記錄、競賽奪牌就能解鎖，或到下面商店用 🦴 骨頭幣買。</span>`;
  // 🦴 商店：尚未擁有的品項
  const owned=new Set([...(p.owned||[]),...(p.unlocked||[])]);
  const shop=(petMeta&&petMeta.shop)||[];
  const shopHtml=shop.filter(s=>!owned.has(s.it)).map(s=>{
    const afford=p.coins>=s.price;
    return `<button class="ghost sm" ${afford?"":"disabled"} style="${afford?"":"opacity:.45;"}" title="${s.name}" onclick="buyPet('${s.it}',${s.price})">${s.it} 🦴${s.price}</button>`;
  }).join("")||`<span class="hint">商店飾品都收集完了，太強了！🎉</span>`;
  // 🍖 餵食：花幣直接加 EXP（所有寵物適用）
  const feed=(petMeta&&petMeta.feed)||[];
  const feedHtml=feed.map(s=>{
    const afford=p.coins>=s.price;
    return `<button class="ghost sm" ${afford?"":"disabled"} style="${afford?"":"opacity:.45;"}" title="${s.name} +${s.exp}EXP" onclick="feedPet('${s.it}',${s.price},${s.exp})">${s.it} +${s.exp}exp 🦴${s.price}</button>`;
  }).join("");
  const dexHtml=(p.dex||[]).map(d=>{ const s=(petMeta&&petMeta.species&&petMeta.species[d.species]); if(!s)return""; return `<span title="${s.label} 最高${(petMeta.stageNames||[])[d.maxStage]||''}" style="font-size:20px;">${s.stages[d.maxStage]}</span>`; }).join("");
  // 我的寵物收藏（每隻各自 EXP；點一下就換成出戰）
  const coll=p.collection||[];
  const collHtml=coll.map(c=>{
    const sn=(petMeta&&petMeta.stageNames&&petMeta.stageNames[c.stageIdx])||"";
    const on=c.active;
    return `<div onclick="choosePet('${c.species}',${c.breed?`'${c.breed}'`:"null"})" title="${escapeHtml(c.name)}・${sn}・EXP ${c.exp}" `+
      `style="cursor:pointer;border:1px solid ${on?'var(--accent)':'var(--line)'};border-radius:10px;padding:5px 4px 3px;text-align:center;flex:0 0 auto;width:60px;${on?'background:var(--soft);':''}">`+
      `<div style="height:40px;display:flex;align-items:center;justify-content:center;line-height:0;">${petGlyph(c,36)}</div>`+
      `<div style="font-size:10.5px;color:var(--sub);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">EXP ${c.exp}</div></div>`;
  }).join("");
  const isArt=!!petArtUrl(p.species,p.breed,p.stageIdx);
  const avSize=isArt?96:64, avBox=isArt?108:74;
  // 🥚 扭蛋
  const gc=(petMeta&&petMeta.gacha)||{cost:60,tenCost:540};
  const od=gc.odds;
  const oddsHtml=od?`<details style="margin-top:6px;"><summary style="cursor:pointer;font-size:12px;color:var(--sub);">ℹ️ 機率說明</summary>`+
    `<div style="font-size:12px;color:var(--sub);line-height:1.7;margin-top:4px;border:1px solid var(--line);border-radius:8px;padding:8px;">`+
    `每抽結果：🎀 飾品 <b>${od.acc}%</b>　🐾 寵物 <b>${od.pet}%</b>`+
    `<div style="margin-top:4px;">抽到寵物時，再依稀有度抽一隻：</div>`+
    `<div>・一般（${od.basicCount} 隻）：總機率 <b>${od.petBasic}%</b></div>`+
    `<div>・特殊 emoji（${od.specialCount} 隻）：總機率 <b>${od.petSpecial}%</b></div>`+
    `<div>・✨ 專屬插圖（${od.illusCount} 隻，最稀有）：總機率 <b>${od.petIllus}%</b>，每隻約 ${od.illusEach}%</div>`+
    `<div style="margin-top:4px;">已擁有的寵物會「稍微降低」抽中機率（仍抽得到）；抽到重複寵物退 🦴${gc.petDupRefund||20}，重複飾品退 🦴${gc.dupRefund||20}。</div>`+
    `<div style="color:var(--sub);">※上表為「未擁有」時的基準機率，實際會因你已擁有的而略有調整。</div>`+
    `</div></details>`:"";
  const gachaBlock=`<div style="margin-top:10px;font-size:13px;font-weight:600;">🥚 扭蛋 <span class="hint" style="font-weight:400;">（飾品／寵物）</span></div>`+
    `<div class="chipbar" style="margin-top:4px;">`+
    `<button class="ghost sm" ${p.coins>=gc.cost?'':'disabled'} style="${p.coins>=gc.cost?'':'opacity:.45;'}" onclick="petGacha(1)">單抽 🦴${gc.cost}</button>`+
    `<button class="ghost sm" ${p.coins>=gc.tenCost?'':'disabled'} style="${p.coins>=gc.tenCost?'':'opacity:.45;'}" onclick="petGacha(10)">十連 🦴${gc.tenCost}</button>`+
    `</div>`+oddsHtml;
  box.innerHTML=
    `<div style="display:flex;align-items:center;gap:14px;">`+
      `<div style="position:relative;width:${avBox}px;height:${avBox}px;display:flex;align-items:center;justify-content:center;background:var(--soft);border-radius:16px;flex:0 0 auto;">`+
        (p.equipped&&!isArt?`<span style="position:absolute;top:-2px;left:50%;transform:translateX(-50%);font-size:22px;z-index:2;">${p.equipped}</span>`:"")+
        `<span id="petEmoji" style="display:inline-flex;align-items:center;justify-content:center;line-height:0;">${petGlyph(p,avSize)}</span></div>`+
      `<div style="flex:1 1 auto;min-width:0;">`+
        `<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;"><b style="font-size:16px;">${escapeHtml(p.name)}</b>`+
          `<span style="cursor:pointer;color:var(--sub);font-size:13px;" onclick="renamePet()">✎</span>`+
          `<span style="cursor:pointer;color:var(--sub);font-size:12px;" onclick="switchPet()">換寵物</span>`+
          `<span class="pill" style="margin-left:auto;background:#fff4e0;color:#a5701a;">🦴 ${p.coins}</span></div>`+
        `<div style="font-size:13px;color:${moodColor};margin:3px 0 2px;">${p.moodFace} 心情 ${p.moodLabel}`+(p.daysSince>1?`（${p.daysSince} 天沒記錄了，回來餵餵牠吧）`:"")+`</div>`+
        `<div class="prog"><i style="width:${pct}%"></i></div>`+
        `<div class="hint">EXP ${p.exp}${next?` / ${next}（再 ${Math.max(0,next-p.exp)} 進化）`:"（已滿級 🌟）"}${p.trophies?`　·　🏆×${p.trophies}`:""}</div>`+
      `</div>`+
    `</div>`+
    (coll.length>1?`<div style="margin-top:10px;font-size:13px;font-weight:600;">🐾 我的寵物 <span class="hint" style="font-weight:400;">（各養各的 EXP，點一下換出戰）</span></div>`+
      `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px;">${collHtml}</div>`:"")+
    `<div style="margin-top:10px;font-size:13px;font-weight:600;">🎀 我的飾品</div>`+
    `<div class="chipbar" style="margin-top:4px;">${itemBtns}${p.equipped?`<button class="ghost sm" onclick="equipPet('')">脫下</button>`:""}</div>`+
    `<div style="margin-top:10px;font-size:13px;font-weight:600;">🍖 餵食 <span class="hint" style="font-weight:400;">（花幣幫牠加 EXP，插圖寵物也適用）</span></div>`+
    `<div class="chipbar" style="margin-top:4px;">${feedHtml}</div>`+
    `<div style="margin-top:10px;font-size:13px;font-weight:600;">🎩 飾品商店 <span class="hint" style="font-weight:400;">（${isArt?"插圖寵物暫不顯示帽子":"記錄/達標賺幣"}）</span></div>`+
    `<div class="chipbar" style="margin-top:4px;">${shopHtml}</div>`+
    gachaBlock+
    (dexHtml?`<div style="margin-top:10px;font-size:13px;font-weight:600;">📖 圖鑑</div><div style="margin-top:4px;">${dexHtml}</div>`:"")+
    `<div class="hint tip" style="margin-top:8px;">記錄飲食/喝水/運動/體重會餵養<b>目前出戰</b>的這隻，連續達標長更快。換寵物時其他隻的 EXP 會凍結保留，可以同時收集養很多種！漏記只會讓牠想睡（不會生病或消失）。</div>`;
  // 進化動畫：偵測到階段提升就慶祝一下
  maybeEvolveFx(p);
}
// 偵測階段提升 → 動畫＋祝賀（用 localStorage 記住上次看到的階段）
function maybeEvolveFx(p){
  const key="petStage:"+p.species;   // 每隻寵物各自記階段，避免換寵物誤觸進化動畫
  const prev=localStorage.getItem(key);
  const cur=p.stageIdx;
  if(prev!==null && +prev<cur){
    const el=document.getElementById("petEmoji");
    if(el){ el.classList.remove("evolve"); void el.offsetWidth; el.classList.add("evolve"); }
    petToast(`🎉 你的寵物進化成「${p.stageName}」了！${p.emoji}`);
  }
  localStorage.setItem(key,String(cur));
}
function petToast(msg){
  let t=document.getElementById("petToast");
  if(!t){ t=document.createElement("div"); t.id="petToast"; document.body.appendChild(t); }
  t.textContent=msg; t.className="show";
  clearTimeout(t._tm); t._tm=setTimeout(()=>{ t.className=""; },3600);
}
// 選寵物的卡片牆。cur=目前物種(標示)；lock=true 時未解鎖的會上鎖(要扭蛋)；
//   starterOnly=true 時(起手領養)只開放「基本款」，插圖/特殊寵物上鎖(要扭蛋)
function petChooserHtml(cur, lock, starterOnly){
  const unlocked=new Set((petData&&petData.unlockedPets)||[]);
  const rare=new Set((petMeta&&petMeta.rareKeys)||[]);   // 非基本款(插圖/特殊)：起手不可選
  const ukey=(sp,b)=>(PET_BREEDS[sp]&&b)?sp+":"+b:sp;
  const isLocked=(key)=>(lock&&!unlocked.has(key))||(starterOnly&&rare.has(key));
  const lockMsg=starterOnly?'🔒 起手只能選基本寵物，這隻要扭蛋抽到才能用！':'🔒 還沒解鎖，去扭蛋抽抽看！';
  const card=(inner,label,onclick,on,locked)=>`<div onclick="${locked?`petToast('${lockMsg}')`:onclick}" style="cursor:pointer;position:relative;border:1px solid ${on?'var(--accent)':'var(--line)'};border-radius:12px;padding:8px 6px;text-align:center;flex:1 1 28%;min-width:84px;${on?'background:var(--soft);':''}${locked?'opacity:.45;':''}">`+
    (locked?`<div style="position:absolute;top:3px;right:5px;font-size:13px;">🔒</div>`:"")+
    `<div style="height:56px;display:flex;align-items:center;justify-content:center;">${inner}</div>`+
    `<div style="font-size:12.5px;font-weight:600;margin-top:2px;">${label}</div></div>`;
  const breedCards=(species)=>Object.keys(PET_BREEDS[species]).map(b=>{
    const P=PET_BREEDS[species][b], locked=isLocked(ukey(species,b));
    return card(petSVG(species,b,3,52),P.label,`choosePet('${species}','${b}')`,cur===species&&petData&&petData.breed===b,locked);
  }).join("");
  const sp=(petMeta&&petMeta.species)||{};
  const others=Object.keys(sp).filter(k=>!PET_BREEDS[k]).map(k=>{
    const locked=isLocked(k);
    return card(`<span style="font-size:34px;">${sp[k].stages[2]||sp[k].stages[1]}</span>`,sp[k].label,`choosePet('${k}')`,cur===k,locked);
  }).join("");
  return `<div style="font-size:13px;font-weight:600;margin:4px 0;">🐱 貓</div><div style="display:flex;flex-wrap:wrap;gap:8px;">${breedCards("cat")}</div>`+
    `<div style="font-size:13px;font-weight:600;margin:10px 0 4px;">🐶 狗</div><div style="display:flex;flex-wrap:wrap;gap:8px;">${breedCards("dog")}</div>`+
    `<div style="font-size:13px;font-weight:600;margin:10px 0 4px;">✨ 其他</div><div style="display:flex;flex-wrap:wrap;gap:8px;">${others}</div>`;
}
// 換出戰寵物（只能換成「已解鎖」的；其餘上鎖要扭蛋）
function switchPet(){
  const box=document.getElementById("petBox"); if(!box||!petData) return;
  const n=(petData.unlockedPets||[]).length;
  box.innerHTML=`<div class="hint" style="margin-bottom:8px;">換一隻出戰吧！只能換成<b>已解鎖</b>的寵物（共 ${n} 隻），🔒 的要到<b>扭蛋</b>抽到才能領養。每隻各自累積 EXP、不會損失。</div>`+
    petChooserHtml(petData.species, true)+
    `<div class="chipbar" style="margin-top:10px;"><button class="ghost sm" onclick="renderPet()">取消</button></div>`;
}
async function buyPet(item,price){
  if(!confirm(`用 🦴 ${price} 骨頭幣購買 ${item}？`)) return;
  try{ const r=await api("/api/pet/buy",{method:"POST",body:JSON.stringify({item})}); petData=r.pet; renderPet(); petToast(`已購買 ${item}！到「我的飾品」就能幫牠戴上。`); }
  catch(e){ alert(e.message); }
}
async function feedPet(item,price,exp){
  if(!confirm(`用 🦴 ${price} 餵 ${item}？寵物 +${exp} EXP`)) return;
  try{ const r=await api("/api/pet/feed",{method:"POST",body:JSON.stringify({item})}); petData=r.pet; renderPet();
    petToast(`${item} 吃光光！EXP +${r.gainedExp} 😋`); }
  catch(e){ alert(e.message); }
}
