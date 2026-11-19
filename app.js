'use strict';
const $=id=>document.getElementById(id);
const STORE='ringlock-quantity-v1';
const catalog=window.SUCOOT_CATALOG;
const catalogById=new Map(catalog.items.map(item=>[item.id,item]));
const retiredIds=new Set(catalog.retiredIds);
const id=()=>globalThis.crypto?.randomUUID?.()||`r${Date.now()}${Math.random().toString(36).slice(2)}`;
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=(n,digits=3)=>new Intl.NumberFormat('en-US',{minimumFractionDigits:digits,maximumFractionDigits:digits}).format(n);
const validQuantity=value=>/^\d+$/.test(value)&&Number(value)<=999999;
const validWeight=value=>/^(?:\d+(?:\.\d{1,3})?|\.\d{1,3})$/.test(value)&&Number(value)<=999999.999;
const rowWeight=row=>row.weight===''?null:Math.round(Number(row.weight)*1000)*Number(row.quantity)/1000;
const catalogRow=item=>({id:id(),catalogId:item.id,code:item.code,name:item.name,spec:item.spec,weight:item.weight,quantity:'0',extra:{}});
let state={customer:'',project:'',date:today(),salesperson:'',author:'',notes:'',catalogVersion:'',columns:[],archivedRows:[],rows:[]};
// Keep the PDF's row sequence, independent of code or saved browser order.
const catalogOrder=new Map(catalog.items.map((item,index)=>[item.id,index]));
let rowElements=new Map();
function sortRowsByPdf(){state.rows.sort((a,b)=>(catalogOrder.get(a.catalogId)??Number.MAX_SAFE_INTEGER)-(catalogOrder.get(b.catalogId)??Number.MAX_SAFE_INTEGER));}
function materialKey(value){return String(value||'').normalize('NFKC').toLowerCase().replace(/[∅φø]/g,'ø').replace(/樑/g,'梁').replace(/[\s:：;；,，]/g,'');}
function adoptExistingPdfRows(){
 for(const row of state.rows){
  if(row.catalogId)continue;
  const matches=catalog.items.filter(item=>item.pdfNo&&materialKey(row.name)===materialKey(item.name)&&materialKey(row.spec)===materialKey(item.spec)&&row.code===item.code);
  if(matches.length===1)row.catalogId=matches[0].id;
 }
}
function migratePdfFields(){
 state.pdfHistory||={};
 for(const row of state.rows){
  const source=catalogById.get(row.catalogId);if(!source?.pdfNo)continue;
  const rule=catalog.pdfRules?.[row.catalogId],before=rule?.before;
  const changes={};
  for(const key of ['name','spec']){
   const desired=source[key];
   if(desired&&row[key]!==desired&&(!row[key]||(before&&row[key]===before[key]))){changes[key]=row[key];row[key]=desired;}
  }
  // Explicit user rule: use the PDF's real code. Its blank code does not
  // invalidate a manually supplied code; old form-only placeholders clear.
  if(row.code!==source.code&&(source.code!==''||row.code===''||(before&&row.code===before.code))){changes.code=row.code;row.code=source.code;}
  if(row.weight===''&&source.pdfWeight!==''){changes.weight='';row.weight=source.pdfWeight;}
  if(Object.keys(changes).length)state.pdfHistory[row.catalogId]={...(state.pdfHistory[row.catalogId]||{}),...changes};
 }
}
function reviewMessages(row){
 const source=catalogById.get(row.catalogId),messages=[...(source?.reviewNotes||[])];
 if(source?.pdfNo){
  for(const [field,label] of [['name','品名'],['spec','規格'],['code','編號']])if(row[field]!==source[field])messages.push(label+'與PDF不同，保留目前值供核對。');
  if(row.weight!==''&&source.pdfWeight!==''&&Number(row.weight)!==Number(source.pdfWeight))messages.push('單重與PDF不同：目前 '+row.weight+' kg／PDF '+source.pdfWeight+' kg；原值保留。');
 }
 return messages;
}
function rowCaption(row,source){
 if(!source)return '自訂品項';
 const version=source.pdfCodeLabel&&/版/.test(source.pdfCodeLabel)?' · '+source.pdfCodeLabel:'';
 if(source.pdfNo)return `重量表 P.${source.pdfPage} / No.${source.pdfNo}${version} · ${row.weight===''?'單重待補':'PDF單重參考'}${!row.code?' · 編號未載':''}`;
 return `${source.page?'型錄 P.'+source.page:'原有品項'} · PDF未列，保留原資料`;
}
function updateSourceLabels(){
 document.getElementById('catalogSummary').textContent=`依PDF列次排列 ${catalog.items.filter(p=>p.pdfNo).length} 項，另保留 ${catalog.items.filter(p=>!p.pdfNo).length} 項既有資料`;
}
function csvAudit(){
 const lines=[['PDF頁','PDF項次','PDF編號原文','產品編號','品名','規格','單重kg','處理','既有編號','既有品名','既有規格','既有單重','差異與備註']];
 for(const r of catalog.weightPdf.audit){const old=r.before||{};lines.push([r.page,r.no,r.rawCode,r.code,r.name,r.spec,r.weight,r.action,old.code||'',old.name||'',old.spec||'',old.weight||'',r.notes.join('；')]);}
 const cell=value=>'"'+String(value??'').replace(/"/g,'""')+'"';
 download(new Blob(['\ufeff'+lines.map(r=>r.map(cell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}),'PDF品項逐列核對.csv');
}
function renderAudit(){
 const selected=$('auditFilter').value;
 const rows=catalog.weightPdf.audit.filter(r=>!selected||(selected==='added'&&r.action==='新增')||(selected==='duplicate'&&r.before)||(selected==='missing'&&(!r.code||r.weight===''||!r.name))||(selected==='review'&&catalogById.get(r.targetId)?.reviewNotes?.length));
 const rowHtml=r=>{const before=r.before||{},red=catalogById.get(r.targetId)?.reviewNotes?.length;return `<tr class="${red?'needs-review':''}">${[r.page+' / '+r.no,r.rawCode,r.name,r.spec,r.weight,r.action,[before.code,before.name,before.spec,before.weight].filter(v=>v!==undefined).join('／'),r.notes.join('；')].map(v=>'<td>'+esc(v)+'</td>').join('')}</tr>`;};
 $('auditRows').innerHTML=rows.map(rowHtml).join('');
 const local=state.rows.filter(r=>reviewMessages(r).length);
 $('auditLocal').innerHTML=local.map(r=>`<tr class="needs-review"><td>${esc(r.code)}</td><td>${esc(r.name)}</td><td>${esc(r.spec)}</td><td>${esc(r.weight)}</td><td>${esc(reviewMessages(r).join('；'))}</td></tr>`).join('');
 const stats=catalog.weightPdf.summary;
 $('auditSummary').textContent=`PDF 16頁334列：新增 ${stats.new} 項、合併 ${stats.merged} 列，共 ${stats.total} 項。第300列沒有品名，不虛構產品。紅字保留供手動刪除；編號以PDF為準，非空白單重差異保留原值。`;
}

let storageAvailable=true,previewBusy=false;
try{
  const data=JSON.parse(localStorage.getItem(STORE));
  if(data&&Array.isArray(data.rows)){
    for(const key of ['customer','project','date','salesperson','author','notes'])if(typeof data[key]==='string')state[key]=data[key];
    state.catalogVersion=typeof data.catalogVersion==='string'?data.catalogVersion:'';
    state.columns=Array.isArray(data.columns)?data.columns.filter((c,i,a)=>c&&typeof c.id==='string'&&/^col_[a-z0-9-]+$/.test(c.id)&&typeof c.name==='string'&&c.name.trim()&&a.findIndex(x=>x?.id===c.id)===i).slice(0,6).map(c=>({id:c.id,name:c.name.trim().slice(0,20)})):[];
    state.archivedRows=Array.isArray(data.archivedRows)?data.archivedRows:[];state.pdfHistory=data.pdfHistory&&typeof data.pdfHistory==='object'?data.pdfHistory:{};state.pdfAppliedVersion=typeof data.pdfAppliedVersion==='string'?data.pdfAppliedVersion:'';
    state.rows=data.rows.filter(r=>r&&['code','name','quantity','weight'].every(key=>typeof r[key]==='string')).map(r=>({id:id(),catalogId:catalogById.has(r.catalogId)||retiredIds.has(r.catalogId)?r.catalogId:null,code:r.code.slice(0,30),name:r.name.slice(0,80),spec:typeof r.spec==='string'?r.spec.slice(0,80):'',quantity:r.quantity,weight:r.weight,extra:Object.fromEntries(state.columns.map(c=>[c.id,typeof r.extra?.[c.id]==='string'?r.extra[c.id].slice(0,80):'']))}));
  }
}catch{storageAvailable=false;}
state.rows=state.rows.filter(row=>{if(retiredIds.has(row.catalogId)){state.archivedRows.push(row);return false;}return true;});
adoptExistingPdfRows();
function restoreCatalog(){const present=new Set(state.rows.map(r=>r.catalogId));const missing=catalog.items.filter(item=>!present.has(item.id));state.rows.push(...missing.map(catalogRow));state.catalogVersion=catalog.version;return missing.length;}
if(state.catalogVersion!==catalog.version){
  const previous=catalog.previousDefaults;let detachedFlat=false;
  for(const row of state.rows){
    const before=previous[row.catalogId],after=catalogById.get(row.catalogId);if(!before||!after)continue;
    if(after.name==='平主架'&&row.spec===before.spec&&before.spec!==after.spec){
      if(row.quantity!=='0'||row.weight!==''){row.catalogId=null;detachedFlat=true;continue;}
      row.spec=after.spec;
    }
    if(row.code===before.code)row.code=after.code;
  }
  if(catalog.previousVersions.includes(state.catalogVersion)){
    const present=new Set(state.rows.map(r=>r.catalogId)),prior=new Set(catalog.previousItemIds[state.catalogVersion]);
    state.rows.push(...catalog.items.filter(item=>!present.has(item.id)&&(!prior.has(item.id)||(detachedFlat&&item.name==='平主架'))).map(catalogRow));state.catalogVersion=catalog.version;
  }else restoreCatalog();
  try{localStorage.setItem(STORE,JSON.stringify(state));}catch{storageAvailable=false;}
}
if(state.pdfAppliedVersion!==catalog.version){migratePdfFields();state.pdfAppliedVersion=catalog.version;}
sortRowsByPdf();
const activeRows=()=>state.rows.filter(r=>validQuantity(r.quantity)&&Number(r.quantity)>0);
const invalidRow=r=>!r.name.trim()||!validQuantity(r.quantity)||(r.weight!==''&&!validWeight(r.weight));
function totals(){return activeRows().reduce((sum,row)=>{sum.quantity+=Number(row.quantity);if(row.weight==='')sum.pending++;else if(validWeight(row.weight))sum.grams+=Math.round(Number(row.weight)*1000)*Number(row.quantity);return sum;},{quantity:0,grams:0,pending:0});}
function save(){try{localStorage.setItem(STORE,JSON.stringify(state));storageAvailable=true;}catch{storageAvailable=false;}$('saveState').textContent=storageAvailable?'已自動儲存於此瀏覽器':'無法自動儲存，離開前請先下載 PDF';}
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').hidden=true,4500);}
function showUndo(message,action){
  $('toast').replaceChildren(document.createTextNode(message+' '));const button=document.createElement('button');button.type='button';button.textContent='復原';button.addEventListener('click',()=>{if(action()!==false){renderRows();save();$('toast').hidden=true;}});$('toast').append(button);$('toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').hidden=true,10000);
}
function renderRows(){
  sortRowsByPdf();
  $('columnManager').hidden=state.columns.length===0;
  $('columnList').innerHTML=state.columns.map(c=>`<div class="column-chip"><span>${esc(c.name)}</span><button type="button" data-remove-column="${c.id}" aria-label="刪除${esc(c.name)}欄位">刪除欄位</button></div>`).join('');
  const head=$('rows').closest('table').tHead.rows[0];head.querySelectorAll('[data-custom-head]').forEach(th=>th.remove());
  for(const column of state.columns){const th=document.createElement('th');th.scope='col';th.dataset.customHead=column.id;th.innerHTML=`${esc(column.name)} <button class="remove-column" data-remove-column="${column.id}" aria-label="刪除${esc(column.name)}欄位">刪除</button>`;head.insertBefore(th,head.lastElementChild);}
  const widths=[165,215,190,90,110,120,...state.columns.map(()=>150),74];[...head.cells].forEach((th,i)=>th.style.width=widths[i]+'px');$('rows').closest('table').style.minWidth=widths.reduce((s,w)=>s+w,0)+'px';
  $('rows').innerHTML=state.rows.map(row=>{
    const source=catalogById.get(row.catalogId),warnings=reviewMessages(row),caption=rowCaption(row,source);
    return `<tr data-id="${row.id}" class="${warnings.length?'needs-review':''}"><td><input data-field="code" aria-label="品項編號" maxlength="30" placeholder="未載編號可留白" value="${esc(row.code)}"></td><td><input data-field="name" aria-label="品項名稱" maxlength="80" placeholder="輸入品項名稱" value="${esc(row.name)}"><small class="row-source" title="${esc(source?.note||'')}">${esc(caption)}</small>${warnings.length?'<small class="row-review">'+esc(warnings.join('；'))+'</small>':''}</td><td><input data-field="spec" aria-label="規格" maxlength="80" placeholder="例如：長度、尺寸" value="${esc(row.spec)}"></td><td><input data-field="quantity" aria-label="數量" type="number" min="0" max="999999" step="1" value="${esc(row.quantity)}"></td><td><input data-field="weight" aria-label="單重（公斤）" type="number" min="0" max="999999.999" step="0.001" placeholder="自行填入" value="${esc(row.weight)}"></td><td class="number row-weight"></td>${state.columns.map(c=>`<td><input data-column="${c.id}" aria-label="${esc(c.name)}" maxlength="80" placeholder="填寫${esc(c.name)}" value="${esc(row.extra?.[c.id]||'')}"></td>`).join('')}<td><button class="delete" aria-label="刪除此品項">刪除</button></td></tr>`;
  }).join('');
  rowElements=new Map([...$('rows').children].map(tr=>[tr.dataset.id,tr]));
  $('empty').hidden=state.rows.length>0;$('rowCount').textContent=state.rows.length+' 項';update();
}
function applyFilter(){
  const query=$('search').value.trim().toLocaleLowerCase(),category=$('category').value;let visible=0;
  for(const row of state.rows){const source=catalogById.get(row.catalogId);const matches=(!query||[row.code,row.name,row.spec,source?.category||''].join(' ').toLocaleLowerCase().includes(query))&&(!category||(source?.category||'自訂品項')===category)&&(!$('onlySelected').checked||Number(row.quantity)>0)&&(!$('onlyReview').checked||reviewMessages(row).length>0);rowElements.get(row.id).hidden=!matches;if(matches)visible++;}
  $('filterCount').textContent=`顯示 ${visible} / ${state.rows.length} 項`;$('noResults').hidden=visible>0||state.rows.length===0;
}
function update(){
  for(const row of state.rows){
    const tr=rowElements.get(row.id);tr.classList.toggle('needs-review',reviewMessages(row).length>0);const value=validQuantity(row.quantity)&&(row.weight===''||validWeight(row.weight))?rowWeight(row):NaN;
    tr.querySelector('.row-weight').innerHTML=Number.isNaN(value)?'<span class="pending">請檢查輸入</span>':value===null?'<span class="pending">待填單重</span>':fmt(value);
    for(const field of ['quantity','weight'])tr.querySelector(`[data-field="${field}"]`).setAttribute('aria-invalid',field==='quantity'?!validQuantity(row.quantity):(row.weight!==''&&!validWeight(row.weight)));
  }
  const sum=totals(),invalid=state.rows.some(invalidRow),hasRows=activeRows().length>0;
  $('tableWeight').textContent=fmt(sum.grams/1000)+' kg';$('weightStatus').textContent=sum.pending?`另有 ${sum.pending} 項缺少單重，重量尚未完整`:(hasRows?'所有已填數量的品項均已計重':'新增品項後，自動計算重量');
  $('validation').hidden=!invalid;$('validation').textContent='請填妥品項名稱及數量（0–999,999 整數）；PDF未載編號可留白；單重可留白，或填入 0–999,999.999 kg，最多 3 位小數。';
  $('pdf').disabled=$('print').disabled=invalid||!hasRows;$('preview').disabled=invalid||!hasRows||previewBusy;
  $('exportHint').textContent=`A4 ${state.columns.length?'橫':'直'}式 · 自動分頁 · 每頁重複抬頭 · 缺少單重標示「待填」`;applyFilter();
}
function addRow(){$('search').value='';$('category').value='';$('onlySelected').checked=false;state.rows.push({id:id(),catalogId:null,code:'',name:'',spec:'',quantity:'0',weight:'',extra:{}});renderRows();save();$('rows').lastElementChild.querySelector('input').focus();}
for(const key of ['addRow','emptyAdd'])$(key).addEventListener('click',addRow);
$('search').addEventListener('input',applyFilter);$('category').addEventListener('change',applyFilter);$('onlySelected').addEventListener('change',applyFilter);$('onlyReview').addEventListener('change',applyFilter);
for(const category of [...new Set(catalog.items.map(item=>item.category)),'自訂品項']){const option=document.createElement('option');option.value=option.textContent=category;$('category').append(option);}
$('restoreCatalog').addEventListener('click',()=>{const count=restoreCatalog();renderRows();save();toast(count?`已補回 ${count} 個預設品項，原有內容保留。`:'預設品項已完整列出。');});
$('rows').addEventListener('input',event=>{
  const field=event.target.dataset.field,column=event.target.dataset.column;if(!field&&!column)return;const row=state.rows.find(r=>r.id===event.target.closest('tr').dataset.id);
  if(column){row.extra||={};row.extra[column]=event.target.value;}else{row[field]=event.target.validity.badInput?'invalid':event.target.value;update();}save();
});
$('rows').addEventListener('click',event=>{
  if(!event.target.closest('.delete'))return;const index=state.rows.findIndex(r=>r.id===event.target.closest('tr').dataset.id);if(index<0)return;
  const row=state.rows[index];state.rows.splice(index,1);renderRows();save();showUndo(`已刪除品項「${row.name||row.code||'未命名'}」`,()=>{if(!state.rows.some(r=>r.id===row.id))state.rows.splice(Math.min(index,state.rows.length),0,row);});
});
for(const key of ['customer','project','date','salesperson','author','notes']){$(key).value=state[key];$(key).addEventListener('input',()=>{state[key]=$(key).value;save();});}
$('addColumn').addEventListener('click',()=>{if(state.columns.length>=6){toast('最多新增 6 個文字欄位。');return;}$('columnError').textContent='';$('columnName').value='';$('columnDialog').showModal();$('columnName').focus();});
$('cancelColumn').addEventListener('click',()=>$('columnDialog').close());
$('columnForm').addEventListener('submit',event=>{
  event.preventDefault();const name=$('columnName').value.trim();if(!name){$('columnError').textContent='請輸入欄位名稱。';return;}
  if(['品項編號','品項名稱','規格','數量','單重','總重量',...state.columns.map(c=>c.name)].includes(name)){$('columnError').textContent='欄位名稱已存在，請使用不同名稱。';return;}
  state.columns.push({id:'col_'+id().toLowerCase(),name});renderRows();save();$('columnDialog').close();toast(`已新增「${name}」欄位，可向右捲動填寫。`);
});
function removeColumn(event){
  const key=event.target.closest('[data-remove-column]')?.dataset.removeColumn;if(!key)return;const index=state.columns.findIndex(c=>c.id===key);if(index<0)return;
  const column=state.columns[index],values=new Map(state.rows.map(row=>[row.id,row.extra?.[key]||'']));state.columns.splice(index,1);for(const row of state.rows)if(row.extra)delete row.extra[key];renderRows();save();
  showUndo(`已刪除「${column.name}」欄位及內容`,()=>{if(state.columns.length>=6){toast('已有 6 個欄位，請先移除一欄再復原。');return false;}state.columns.splice(Math.min(index,state.columns.length),0,column);for(const row of state.rows){row.extra||={};row.extra[key]=values.get(row.id)||'';}});
}
$('columnList').addEventListener('click',removeColumn);$('rows').closest('table').tHead.addEventListener('click',removeColumn);
function download(blob,filename){const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=filename;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
$('backup').addEventListener('click',()=>download(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),'支撐架數量表備份.json'));
function reportData(){if(window.worksheetAccess?.locked)throw new Error('請先輸入開啟密碼');if(state.rows.some(invalidRow)||!activeRows().length)throw new Error('請先填妥品項資料，並至少填入一項大於 0 的數量。');return {...state,rows:activeRows().map(r=>{const source=catalogById.get(r.catalogId);return {...r,name:r.name+(source?.pdfCodeLabel&&/版/.test(source.pdfCodeLabel)?' '+source.pdfCodeLabel:''),review:reviewMessages(r)}}),sum:totals()};}
function pdfFilename(data){return `${(data.project||'圓盤系統支撐架數量表').replace(/[\\/:*?"<>|\u0000-\u001f]/g,'_')}_${data.date||today()}.pdf`;}
const reportCaption='品項依重量計算表20221013（增新超重支撐模組）列次排列，PDF未列的原型錄品項保留於後方。紅字為不同或相似不確定項目，請人工核對或刪除；PDF未載編號、單重不推估，缺單重不計入總重。';
function renderPrint(data){
  $('printPageStyle').textContent=`@page{size:A4 ${data.columns.length?'landscape':'portrait'};margin:15mm 12mm}`;
  const colspan=6+data.columns.length;
  const title=`<img class="report-logo" src="${esc($('companyLogo').src)}" alt="SUCOOT 實固股份有限公司"><h1 class="print-heading">圓盤系統支撐架產品數量表</h1>`;
  const meta=`<div class="print-meta"><span>客戶名稱：${esc(data.customer||'—')}</span><span>日期：${esc(data.date||'—')}</span><span>工程名稱：${esc(data.project||'—')}</span><span>負責業務：${esc(data.salesperson||'—')}</span><span class="author-meta">製表人：${esc(data.author||'—')}</span></div>`;
  const headers=['品項編號','品項名稱','規格','數量（件）','單重（kg）','總重量（kg）',...data.columns.map(c=>c.name)].map((name,i)=>`<th${i>=3&&i<=5?' class="number"':''}>${esc(name)}</th>`).join('');
  const body=data.rows.map(r=>`<tr class="${r.review?.length?'needs-review':''}"><td>${esc(r.code)}</td><td>${esc(r.name)}</td><td>${esc(r.spec||'—')}</td><td class="number">${fmt(Number(r.quantity),0)}</td><td class="number">${r.weight===''?'待填':fmt(Number(r.weight))}</td><td class="number">${r.weight===''?'待填':fmt(rowWeight(r))}</td>${data.columns.map(c=>`<td>${esc(r.extra?.[c.id]||'—')}</td>`).join('')}</tr>`).join('');
  const summary=`<div class="print-summary"><strong>已知總重量：${fmt(data.sum.grams/1000)} kg</strong>${data.sum.pending?`<br>注意：${data.sum.pending} 項缺少單重，未計入總重量。`:''}</div>${data.notes?`<div class="print-notes">備註：${esc(data.notes)}</div>`:''}<p class="print-caption">${reportCaption}</p>`;
  $('printArea').innerHTML=`${title}<table class="print-table${data.columns.length?' with-custom-columns':''}"><thead><tr class="print-report-header"><td colspan="${colspan}">${meta}</td></tr><tr>${headers}</tr></thead><tbody>${body}</tbody><tfoot class="print-end"><tr><td colspan="${colspan}">${summary}</td></tr></tfoot></table>`;
}
window.addEventListener('beforeprint',()=>{try{renderPrint(reportData());}catch{$('printArea').textContent='尚無可列印的完整品項，請先填妥表單。';}});
$('print').addEventListener('click',()=>{try{renderPrint(reportData());window.print();}catch(error){toast(error.message);}});
$('pdf').addEventListener('click',async()=>{const button=$('pdf');button.disabled=true;button.textContent='正在製作 PDF…';try{const data=JSON.parse(JSON.stringify(reportData()));await document.fonts.ready;download(await window.createQuantityPDF(data,{fmt,rowWeight,caption:reportCaption}),pdfFilename(data));toast('PDF 已製作完成，請查看下載項目。');}catch(error){toast(`無法產生 PDF：${error.message}`);}finally{button.textContent='下載 PDF ↓';update();}});
let previewGeneration=0,previewResult=null;
$('preview').addEventListener('click',async()=>{
  let data;try{data=JSON.parse(JSON.stringify(reportData()));}catch(error){toast(error.message);return;}
  const generation=++previewGeneration;previewBusy=true;previewResult=null;update();$('previewStatus').textContent='正在產生預覽…';$('previewDownload').disabled=true;$('previewZoom').value='fit';$('previewPages').dataset.zoom='fit';$('previewPages').textContent='正在產生 PDF 頁面，請稍候…';$('previewPages').setAttribute('aria-busy','true');$('pdfPreview').showModal();
  try{
    await document.fonts.ready;const result=await window.createQuantityPDF(data,{fmt,rowWeight,caption:reportCaption},{preview:true});if(generation!==previewGeneration||!$('pdfPreview').open)return;
    previewResult={...result,filename:pdfFilename(data)};$('previewPages').replaceChildren();$('previewPages').style.setProperty('--page-width',result.width+'px');
    result.pages.forEach((src,i)=>{const figure=document.createElement('figure');figure.className='preview-page';const image=document.createElement('img');image.src=src;image.alt=`PDF 第 ${i+1} 頁，共 ${result.pages.length} 頁`;const caption=document.createElement('figcaption');caption.textContent=`第 ${i+1} / ${result.pages.length} 頁`;figure.append(image,caption);$('previewPages').append(figure);});
    $('previewStatus').textContent=`共 ${result.pages.length} 頁 · A4 ${result.width>result.height?'橫':'直'}式 · 客戶及工程抬頭逐頁呈現`;$('previewDownload').disabled=false;
  }catch(error){if(generation===previewGeneration){$('previewStatus').textContent='無法產生預覽';$('previewPages').textContent=error.message;}}
  finally{if(generation===previewGeneration){previewBusy=false;$('previewPages').setAttribute('aria-busy','false');update();}}
});
$('previewZoom').addEventListener('change',()=>$('previewPages').dataset.zoom=$('previewZoom').value);
for(const key of ['closePreview','backToEdit'])$(key).addEventListener('click',()=>$('pdfPreview').close());
$('pdfPreview').addEventListener('close',()=>{previewGeneration++;previewBusy=false;previewResult=null;$('previewPages').replaceChildren();$('previewDownload').disabled=true;update();});
$('previewDownload').addEventListener('click',()=>{if(previewResult)download(previewResult.blob,previewResult.filename);});
updateSourceLabels();
$('auditPdf').addEventListener('click',()=>{renderAudit();$('pdfAudit').showModal();});
$('closeAudit').addEventListener('click',()=>$('pdfAudit').close());
$('auditFilter').addEventListener('change',renderAudit);
$('auditCsv').addEventListener('click',csvAudit);
renderRows();
if(storageAvailable)save();
if(!storageAvailable)$('saveState').textContent='無法使用儲存空間，離開前請先下載 PDF';
