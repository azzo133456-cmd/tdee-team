/* ---------- 記帳本（只有「肉」看得到，跟 zen 的買菜月結無關） ----------
   規則在伺服器（ledger_logic.js），分類和帳戶也由伺服器傳來。
   表單是 index.html 裡固定的輸入框，重畫時只換摘要、圖表、明細，打到一半的字不會不見。 */
let LED={month:null,entries:[],trend:[],budget:0,cats:null,accounts:[],type:"expense",cat:null,editId:null,filter:null,chat:[],saving:false,seq:0,loadError:""};
const ledMoney=(n)=>"$"+Number(n||0).toLocaleString();
function isLedgerUser(){ return ((session&&session.username)||"").trim()==="肉"; }
function applyLedgerVisibility(){
  const nav=document.querySelector('.bottomnav .nav[data-tab="ledger"]'); if(nav) nav.style.display=isLedgerUser()?"":"none";
}
function ledShiftMonth(month,n){
  const [y,m]=month.split("-").map(Number), d=new Date(Date.UTC(y,m-1+n,1));
  return d.toISOString().slice(0,7);
}
function ledPrefAccount(){ try{ const a=localStorage.getItem("ledgerAccount"); if(a&&LED.accounts.includes(a)) return a; }catch(e){} return LED.accounts[0]; }

async function renderLedger(){
  if(!LED.month) LED.month=todayStr().slice(0,7);
  await ledLoad();
}
// 快速切月份時，只有最後一次的回應算數
async function ledLoad(){
  const seq=++LED.seq;
  try{
    const r=await api("/api/ledger?month="+LED.month);
    if(seq!==LED.seq) return;
    const first=!LED.cats;
    Object.assign(LED,{entries:r.entries,trend:r.trend,budget:r.budget,cats:r.cats,accounts:r.accounts,loadError:""});
    if(first) ledInitForm();
  }catch(e){
    if(seq!==LED.seq) return;
    LED.loadError=e.message;
  }
  ledDraw();
}
function ledInitForm(){
  const sel=document.getElementById("ledAccount");
  if(sel) sel.innerHTML=LED.accounts.map(a=>`<option>${a}</option>`).join("");
  setv("ledAccount",ledPrefAccount());
  setv("ledDate",todayStr());
  setv("ledBudget",LED.budget||"");
  ledSetType("expense");
}
function ledMonth(n){ LED.month=ledShiftMonth(LED.month,n); LED.filter=null; return ledLoad(); }
function ledSetType(t){
  LED.type=t;
  if(!LED.cats) return;
  if(!LED.cats[t].some(([n])=>n===LED.cat)) LED.cat=LED.cats[t][0][0];
  ledDrawForm();
}
function ledSetCat(c){ LED.cat=c; ledDrawForm(); }
function ledDrawForm(){
  document.querySelectorAll(".ledtype").forEach(b=>b.classList.toggle("on",b.dataset.t===LED.type));
  const box=document.getElementById("ledCats"); if(!box||!LED.cats) return;
  box.innerHTML=LED.cats[LED.type].map(([n,e])=>`<button type="button" class="ledcat${n===LED.cat?" on":""}" onclick="ledSetCat('${n}')"><span>${e}</span>${n}</button>`).join("");
}
function ledFormData(){
  return {type:LED.type,amount:Math.round(+val("ledAmount")||0),date:val("ledDate"),category:LED.cat,account:val("ledAccount"),note:(val("ledNote")||"").trim()};
}
function ledResetForm(){
  LED.editId=null;
  setv("ledAmount",""); setv("ledNote",""); setv("ledDate",todayStr());
  set("ledFormTitle","＋ 記一筆"); set("ledSaveBtn","記下來");
  const c=document.getElementById("ledEditBtns"); if(c) c.style.display="none";
}
async function ledSave(){
  if(LED.saving) return;
  const e=ledFormData();
  if(!(e.amount>0)){ alert("請輸入金額"); return; }
  if(!e.date){ alert("請選日期"); return; }
  LED.saving=true;
  try{
    if(LED.editId) await api("/api/ledger/"+LED.editId,{method:"PUT",body:JSON.stringify(e)});
    else await api("/api/ledger",{method:"POST",body:JSON.stringify({entries:[e]})});
    try{ localStorage.setItem("ledgerAccount",e.account); }catch(x){}
    ledResetForm();
    LED.month=e.date.slice(0,7);       // 跳到這筆所在的月份，才看得到剛記的
    await ledLoad();
  }catch(x){ alert(x.message); }     // 失敗時表單內容留著，可以直接再按一次
  finally{ LED.saving=false; }
}
function ledEdit(id){
  const e=LED.entries.find(x=>x.id===id); if(!e) return;
  LED.editId=id; LED.type=e.type; LED.cat=e.category; ledDrawForm();
  setv("ledAmount",e.amount); setv("ledDate",e.date); setv("ledAccount",e.account); setv("ledNote",e.note||"");
  set("ledFormTitle","✏️ 修改這筆"); set("ledSaveBtn","儲存修改");
  const c=document.getElementById("ledEditBtns"); if(c) c.style.display="";
  const f=document.getElementById("ledFormCard"); if(f&&f.scrollIntoView) f.scrollIntoView({behavior:"smooth",block:"start"});
}
async function ledDelete(){
  if(!LED.editId||!confirm("確定刪除這筆？")) return;
  try{ await api("/api/ledger/"+LED.editId,{method:"DELETE"}); ledResetForm(); await ledLoad(); }
  catch(e){ alert(e.message); }
}
function ledFilter(c){ LED.filter=LED.filter===c?null:c; ledDraw(); }
async function ledSaveBudget(){
  const n=Math.round(+val("ledBudget")||0);
  try{ const r=await api("/api/ledger/budget",{method:"PUT",body:JSON.stringify({budget:n})}); LED.budget=r.budget; ledDraw(); }
  catch(e){ alert(e.message); }
}

/* ── 打一句話記帳：AI 拆好就存，記錯按復原 ── */
async function ledChatSend(){
  const text=(val("ledChatText")||"").trim(); if(!text||LED.saving) return;
  setv("ledChatText","");
  LED.chat.push({who:"me",html:escapeHtml(text)});
  const ai={who:"ai",html:"🤔 整理中…"}; LED.chat.push(ai); ledDrawChat();
  LED.saving=true;
  try{
    const p=await api("/api/ledger/parse",{method:"POST",body:JSON.stringify({text,account:ledPrefAccount()})});
    const miss=p.missing?`<div class="hint">⚠️ 沒記：${escapeHtml(p.missing)}</div>`:"";
    if(!p.entries.length) ai.html=miss||"🤷 這句看起來不是記帳，可以說「午餐 120、捷運 30」";
    else{
      const r=await api("/api/ledger",{method:"POST",body:JSON.stringify({entries:p.entries})});
      ai.ids=r.entries.map(x=>x.id);
      ai.html="✅ 記好了：<br>"+r.entries.map(x=>`${ledIcon(x)} ${x.date.slice(5).replace("-","/")} ${escapeHtml(x.note||x.category)}　${x.type==="income"?"+":""}${ledMoney(x.amount)}`).join("<br>")+miss;
      await ledLoad();
    }
  }catch(e){ ai.html="⚠️ "+escapeHtml(e.message)+`<div class="hint">剛剛那句沒有記到，內容還在輸入框。</div>`; if(!val("ledChatText")) setv("ledChatText",text); }
  finally{ LED.saving=false; ledDrawChat(); }
}
async function ledChatUndo(i){
  const m=LED.chat[i]; if(!m||!m.ids||m.undone) return;
  try{
    for(const id of m.ids) await api("/api/ledger/"+id,{method:"DELETE"});
    m.undone=true; await ledLoad();
  }catch(e){ alert(e.message); await ledLoad(); }
  ledDrawChat();
}
function ledDrawChat(){
  const box=document.getElementById("ledChatLog"); if(!box) return;
  const from=Math.max(0,LED.chat.length-8);
  box.innerHTML=LED.chat.slice(from).map((m,k)=>`<div class="gmsg ${m.who}${m.undone?" undone":""}">${m.html}`+
    (m.ids&&!m.undone?`<button class="ghost sm gundo" onclick="ledChatUndo(${from+k})">↩ 復原</button>`:"")+
    (m.undone?`<div class="hint">（已復原）</div>`:"")+`</div>`).join("");
  box.scrollTop=box.scrollHeight;
}

/* ── 統計（純計算） ── */
function ledTotals(entries){
  const t={expense:0,income:0,byCat:{},byAcc:{}};
  entries.forEach(e=>{
    t[e.type]+=e.amount;
    if(e.type==="expense"){ t.byCat[e.category]=(t.byCat[e.category]||0)+e.amount; t.byAcc[e.account]=(t.byAcc[e.account]||0)+e.amount; }
  });
  return t;
}
// 這個月還剩幾天（含今天）；不是這個月就不算「每天還能花」
function ledDaysLeft(month,today){
  if(today.slice(0,7)!==month) return 0;
  const [y,m]=month.split("-").map(Number), last=new Date(Date.UTC(y,m,0)).getUTCDate();
  return last-Number(today.slice(8,10))+1;
}
function ledIcon(e){
  const list=(LED.cats&&LED.cats[e.type])||[], hit=list.find(([n])=>n===e.category);
  return hit?hit[1]:"📦";
}

/* ── 畫面 ── */
function ledDraw(){
  const title=document.getElementById("ledMonthLabel");
  if(title&&LED.month){ const [y,m]=LED.month.split("-"); title.textContent=`${y} 年 ${Number(m)} 月`; }
  const sum=document.getElementById("ledSummary"); if(!sum) return;
  if(LED.loadError&&!LED.cats){ sum.innerHTML=`<div class="hint">載入失敗：${escapeHtml(LED.loadError)}</div>`; return; }
  const err=LED.loadError?`<div class="hint" style="color:#b5564e">更新失敗：${escapeHtml(LED.loadError)}，下面是上次的資料</div>`:"";
  const t=ledTotals(LED.entries), bal=t.income-t.expense;
  let bud="";
  if(LED.budget>0){
    const left=LED.budget-t.expense, pct=Math.min(100,t.expense/LED.budget*100), days=ledDaysLeft(LED.month,todayStr());
    bud=`<div class="ledbudget"><div class="ledbudget-top"><span>預算 ${ledMoney(LED.budget)}</span><b style="color:${left<0?"#b5564e":"var(--green)"}">${left<0?"超支 "+ledMoney(-left):"還剩 "+ledMoney(left)}</b></div>`+
      `<div class="ledbar"><i style="width:${pct}%;background:${left<0?"#b5564e":pct>80?"var(--warm)":"var(--green)"}"></i></div>`+
      (days&&left>0?`<div class="hint">接下來 ${days} 天，平均每天可以花 ${ledMoney(Math.floor(left/days))}</div>`:"")+`</div>`;
  }
  sum.innerHTML=err+`<div class="ledsum"><div><small>支出</small><b style="color:#b5564e">${ledMoney(t.expense)}</b></div><div><small>收入</small><b style="color:var(--green)">${ledMoney(t.income)}</b></div>`+
    `<div><small>結餘</small><b style="color:${bal<0?"#b5564e":"var(--ink)"}">${bal<0?"-":""}${ledMoney(Math.abs(bal))}</b></div></div>`+bud;
  ledDrawCats(t); ledDrawTrend(); ledDrawList();
}
function ledDrawCats(t){
  const box=document.getElementById("ledCatBox"); if(!box) return;
  const rows=Object.entries(t.byCat).sort((a,b)=>b[1]-a[1]);
  if(!rows.length){ box.innerHTML=`<div class="hint">這個月還沒有支出。</div>`; return; }
  const iconOf=(c)=>{ const h=LED.cats.expense.find(([n])=>n===c); return h?h[1]:"📦"; };
  const acc=Object.entries(t.byAcc).sort((a,b)=>b[1]-a[1]).map(([a,v])=>`${a} ${ledMoney(v)}`).join("　");
  box.innerHTML=rows.map(([c,v])=>{
    const pct=Math.round(v/t.expense*100);
    return `<div class="ledcatrow${LED.filter===c?" on":""}" onclick="ledFilter('${c}')"><div class="ledcatrow-top"><span>${iconOf(c)} ${c}</span><span>${ledMoney(v)}　<small>${pct}%</small></span></div><div class="ledbar"><i style="width:${pct}%"></i></div></div>`;
  }).join("")+`<div class="hint" style="margin-top:8px">點分類可以只看那一類的明細。<br>各帳戶支出：${acc}</div>`;
}
function ledDrawTrend(){
  const box=document.getElementById("ledTrend"); if(!box||!LED.month) return;
  const months=[]; for(let i=5;i>=0;i--) months.push(ledShiftMonth(LED.month,-i));
  const get=(m,t)=>{ const h=LED.trend.find(x=>x.month===m&&x.type===t); return h?h.total:0; };
  const max=Math.max(1,...months.map(m=>Math.max(get(m,"expense"),get(m,"income"))));
  box.innerHTML=`<div class="ledtrend">`+months.map(m=>{
    const ex=get(m,"expense"), inc=get(m,"income");
    return `<div class="ledtrend-col${m===LED.month?" on":""}" title="${m} 支出 ${ledMoney(ex)}、收入 ${ledMoney(inc)}"><div class="ledtrend-bars"><i class="in" style="height:${inc/max*100}%"></i><i class="ex" style="height:${ex/max*100}%"></i></div><small>${Number(m.slice(5))}月</small></div>`;
  }).join("")+`</div><div class="hint" style="text-align:center;margin-top:4px"><span style="color:var(--green)">■</span> 收入　<span style="color:#b5564e">■</span> 支出</div>`;
}
function ledDrawList(){
  const box=document.getElementById("ledList"); if(!box) return;
  const list=LED.filter?LED.entries.filter(e=>e.type==="expense"&&e.category===LED.filter):LED.entries;
  const head=LED.filter?`<div class="hint" style="margin-bottom:6px">只看「${LED.filter}」　<a href="#" onclick="ledFilter('${LED.filter}');return false">看全部</a></div>`:"";
  if(!list.length){ box.innerHTML=head+`<div class="hint">這個月還沒有紀錄。</div>`; return; }
  const WEEK=["日","一","二","三","四","五","六"], days={};
  list.forEach(e=>{ (days[e.date]=days[e.date]||[]).push(e); });
  box.innerHTML=head+Object.keys(days).sort((a,b)=>b.localeCompare(a)).map(d=>{
    const items=days[d], out=items.reduce((a,e)=>a+(e.type==="expense"?e.amount:0),0);
    return `<div class="ledday"><div class="ledday-h"><span>${Number(d.slice(5,7))}/${Number(d.slice(8))}（${WEEK[new Date(d+"T00:00:00Z").getUTCDay()]}）</span>${out?`<span>-${ledMoney(out)}</span>`:""}</div>`+
      items.map(e=>`<div class="ledrow" onclick="ledEdit(${e.id})"><span class="ledrow-e">${ledIcon(e)}</span><span class="ledrow-n"><b>${escapeHtml(e.note||e.category)}</b><small>${e.category}・${e.account}</small></span>`+
        `<span class="ledrow-a" style="color:${e.type==="income"?"var(--green)":"var(--ink)"}">${e.type==="income"?"+":"-"}${ledMoney(e.amount)}</span></div>`).join("")+`</div>`;
  }).join("");
}

/* ── 匯出 CSV（Excel 開得起來）。開頭是 = + - @ 的備註前面加 '，避免被 Excel 當成公式執行 ── */
function ledCsvCell(v){
  let s=String(v==null?"":v);
  if(/^[=+\-@]/.test(s)) s="'"+s;
  return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;
}
function ledCsv(entries){
  const rows=[["日期","類型","分類","帳戶","金額","備註"]].concat(entries.map(e=>[e.date,e.type==="income"?"收入":"支出",e.category,e.account,e.amount,e.note]));
  return "﻿"+rows.map(r=>r.map(ledCsvCell).join(",")).join("\r\n");
}
async function ledExport(){
  try{
    const r=await api("/api/ledger/all");
    if(!r.entries.length){ alert("還沒有紀錄可以匯出"); return; }
    const url=URL.createObjectURL(new Blob([ledCsv(r.entries)],{type:"text/csv;charset=utf-8"}));
    const a=document.createElement("a"); a.href=url; a.download=`記帳本_${todayStr()}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),5000);
  }catch(e){ alert("匯出失敗："+e.message); }
}
