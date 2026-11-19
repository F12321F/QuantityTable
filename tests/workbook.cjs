const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const results=path.resolve(__dirname,'../test-results');fs.mkdirSync(results,{recursive:true});
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:process.platform==='win32'?[]:['--no-sandbox']});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1100},acceptDownloads:true});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.addInitScript(()=>{window.confirm=()=>{throw new Error('Deletion must not depend on confirm');};});
    await page.goto(process.env.APP_URL||'http://localhost:3000');
    assert.equal(await page.locator('#rows tr').count(),356);assert.equal(await page.locator('#preview').isDisabled(),true);
    const catalog=await page.evaluate(()=>window.SUCOOT_CATALOG);
    assert.deepEqual(catalog.items.filter(r=>r.pdfNo).map(r=>r.pdfNo),Array.from({length:334},(_,i)=>i+1).filter(n=>n!==300));
    assert.deepEqual(catalog.items.slice(0,11).map(r=>r.code),['V60100','V60150','V60200','V60300','V61100','V61150','V61200','V61300','V62020','V62025','V62050']);
    assert.equal(new Set(catalog.items.map(r=>r.id)).size,356);
    for(const field of ['customer','project','salesperson','author'])assert.equal(await page.locator('#'+field).inputValue(),'');
    assert.deepEqual(catalog.items.filter(r=>r.code==='DB100812').map(r=>[r.spec,r.weight]),[['100×80 mm L=1.2m','8.74'],['100×80 mm L=1.5m','10.75']]);
    for(const code of ['J48601','U48601','J48600S','U48600S','V62020','V62025','V62050'])assert.equal(catalog.items.filter(r=>r.code===code).length,1);
    assert.equal(catalog.items.find(r=>r.pdfNo===117).weight,'0.00');assert.equal(catalog.items.find(r=>r.pdfNo===99).weight,'');
    assert.equal(catalog.items.find(r=>r.pdfNo===39).code,'');
    assert.ok(await page.locator('#rows .needs-review').count()>0);
    await page.locator('#search').fill('C50500');assert.equal(await page.locator('#rows tr:visible').count(),1);
    await page.locator('#search').fill('');await page.locator('#category').selectOption('腳踏板與蓋板');assert.equal(await page.locator('#rows tr:visible').count(),11);
    await page.locator('#category').selectOption('');
    // Old saved rows are migrated without losing user edits; retired entries are archived.
    await page.evaluate(()=>localStorage.setItem('ringlock-quantity-v1',JSON.stringify({catalogVersion:'sucoot-7527-2025-11-v2',rows:[
      {catalogId:'sucoot-202511-032',code:'自編-032',name:'定位桿',spec:'1.8 m × 1.5 m',quantity:'3',weight:'5'},
      {catalogId:'sucoot-202511-040',code:'自編-040',name:'組合插銷',spec:'舊資料',quantity:'8',weight:'1'},
      {code:'CUSTOM-OLD',name:'舊自訂品項',spec:'保留',quantity:'2',weight:'3'}
    ]})));
    await page.reload();let saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('ringlock-quantity-v1')));
    assert.equal(saved.rows.find(r=>r.catalogId==='sucoot-202511-032').code,'L61815');assert.equal(saved.rows.find(r=>r.catalogId==='sucoot-202511-032').weight,'5');assert.equal(saved.rows.length,292);assert.equal(saved.archivedRows.length,1);
    assert.match(await page.locator('#tableWeight').textContent(),/21\.000/);
    await page.locator('#restoreCatalog').click();assert.equal(await page.locator('#rows tr').count(),357);
    await page.locator('#restoreCatalog').click();assert.equal(await page.locator('#rows tr').count(),357);
    // Isolated manual-entry fixture.
    await page.evaluate(()=>localStorage.setItem('ringlock-quantity-v1',JSON.stringify({catalogVersion:window.SUCOOT_CATALOG.version,rows:[]})));
    await page.reload();
    await page.locator('#customer').fill('測試客戶股份有限公司');await page.locator('#project').fill('跨頁測試工程');await page.locator('#salesperson').fill('測試業務');await page.locator('#author').fill('測試製表人');await page.locator('#date').fill('2026-11-18');
    const info=await page.evaluate(()=>Object.fromEntries(['customer','date','project','salesperson','author'].map(id=>{const r=document.getElementById(id).getBoundingClientRect();return[id,{x:r.x,y:r.y}];})));
    assert.equal(info.customer.x,info.project.x);assert.equal(info.date.x,info.author.x);assert.equal(info.customer.y,info.date.y);assert.equal(info.project.y,info.salesperson.y);assert.equal(info.date.x,info.salesperson.x);assert.equal(info.date.x,info.author.x);assert.ok(info.date.y<info.salesperson.y);assert.ok(info.salesperson.y<info.author.y);assert.ok(info.customer.x<info.date.x);
    assert.equal(await page.locator('.stats').count(),0);
    async function add(code,quantity,weight){
      await page.locator('#addRow').click();const row=page.locator('#rows tr').last();
      await row.locator('[data-field=code]').fill(code);await row.locator('[data-field=name]').fill('測試品項 '+code);await row.locator('[data-field=spec]').fill('測試規格 Φ60.2 × 3.2 mm');await row.locator('[data-field=quantity]').fill(quantity);if(weight!==undefined)await row.locator('[data-field=weight]').fill(weight);
    }
    await add('TEST-A','3','10.125');await add('TEST-B','2');assert.match(await page.locator('#tableWeight').textContent(),/30\.375/);
    assert.match(await page.locator('#weightStatus').textContent(),/1 項缺少/);assert.equal(await page.locator('#pdf').isDisabled(),false);
    const weight=page.locator('#rows tr').last().locator('[data-field=weight]');await weight.fill('-1');assert.equal(await page.locator('#pdf').isDisabled(),true);
    await weight.fill('0.1234');assert.equal(await page.locator('#pdf').isDisabled(),true);await weight.fill('0');assert.match(await page.locator('#rows tr').last().locator('.row-weight').textContent(),/0\.000/);
    await weight.fill('2.5');assert.match(await page.locator('#tableWeight').textContent(),/35\.375/);
    await page.reload();assert.equal(await page.locator('#customer').inputValue(),'測試客戶股份有限公司');assert.equal(await page.locator('#salesperson').inputValue(),'測試業務');assert.match(await page.locator('#tableWeight').textContent(),/35\.375/);
    await page.setViewportSize({width:390,height:844});
    assert.ok(await page.locator('#rows .delete').last().evaluate(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;}));
    await page.locator('#rows .delete').last().click();assert.equal(await page.locator('#rows tr').count(),1);
    await page.getByRole('button',{name:'復原',exact:true}).click();assert.equal(await page.locator('#rows tr').count(),2);assert.match(await page.locator('#tableWeight').textContent(),/35\.375/);
    await page.locator('#rows .delete').last().click();await page.reload();assert.equal(await page.locator('#rows tr').count(),1);
    async function column(name){await page.locator('#addColumn').click();await page.locator('#columnName').fill(name);await page.locator('#columnForm button[type=submit]').click();}
    await column('使用位置');await page.locator('#rows [data-column]').fill('A區 <北側> & 第一跨');
    await column('使用位置');assert.match(await page.locator('#columnError').textContent(),/已存在/);await page.locator('#cancelColumn').click();
    await page.locator('#columnList [data-remove-column]').click();assert.equal(await page.locator('[data-custom-head]').count(),0);
    await page.getByRole('button',{name:'復原',exact:true}).click();assert.equal(await page.locator('#rows [data-column]').inputValue(),'A區 <北側> & 第一跨');
    await page.locator('#columnList [data-remove-column]').click();await page.reload();assert.equal(await page.locator('[data-custom-head]').count(),0);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.setViewportSize({width:1440,height:1100});await page.screenshot({path:path.join(results,'worksheet.png'),fullPage:true});
    // Every default row is used to exercise real multi-page reports.
    await page.locator('#restoreCatalog').click();await page.evaluate(()=>{const data=JSON.parse(localStorage.getItem('ringlock-quantity-v1'));data.rows=data.rows.filter(r=>r.catalogId);data.rows.forEach(r=>r.quantity='1');data.notes='跨頁備註測試。'.repeat(50);localStorage.setItem('ringlock-quantity-v1',JSON.stringify(data));});await page.reload();
    await page.evaluate(()=>{window.headerCalls=[];const original=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(value,...args){if(String(value).startsWith('客戶名稱：')||String(value).startsWith('工程名稱：')||String(value).startsWith('負責業務：'))window.headerCalls.push(value);return original.call(this,value,...args);};});
    async function preview(mode){
      await page.evaluate(()=>window.headerCalls=[]);await page.locator('#preview').click();await page.waitForFunction(()=>!document.getElementById('previewDownload').disabled);
      const count=await page.locator('.preview-page').count();assert.ok(count>1);const calls=await page.evaluate(()=>window.headerCalls);
      assert.equal(calls.filter(s=>s==='客戶名稱：測試客戶股份有限公司').length,count);assert.equal(calls.filter(s=>s==='工程名稱：跨頁測試工程').length,count);assert.equal(calls.filter(s=>s==='負責業務：測試業務').length,count);
      const images=await page.locator('.preview-page img').evaluateAll(imgs=>imgs.map(i=>i.src));
      await page.locator('#previewZoom').selectOption('150');assert.equal(await page.locator('#previewPages').getAttribute('data-zoom'),'150');await page.locator('#previewZoom').selectOption('fit');
      const download=page.waitForEvent('download');await page.locator('#previewDownload').click();const target=path.join(results,`preview-${mode}.pdf`);await(await download).saveAs(target);
      const pdf=fs.readFileSync(target);assert.equal(Number(pdf.toString('latin1').match(/\/Type \/Pages \/Count (\d+)/)[1]),count);for(const src of images)assert.ok(pdf.indexOf(Buffer.from(src.split(',')[1],'base64'))>=0);
      await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:path.join(results,`preview-${mode}.png`)});
      await page.locator('#backToEdit').click();assert.equal(await page.locator('.preview-page').count(),0);await page.setViewportSize({width:1440,height:1100});
      await page.emulateMedia({media:'print'});await page.pdf({path:path.join(results,`print-${mode}.pdf`),preferCSSPageSize:true,printBackground:true});await page.emulateMedia({media:'screen'});
      return count;
    }
    const portrait=await preview('portrait');await column('使用位置');const landscape=await preview('landscape');
    for(const name of ['備註','批號','區段','倉別','驗收日期'])await column(name);assert.equal(await page.locator('[data-custom-head]').count(),6);
    await page.locator('#addColumn').click();assert.equal(await page.locator('#columnDialog').isVisible(),false);
    assert.deepEqual(errors,[]);
    console.log(`PASS: 356 items in PDF order, blank metadata/codes and red reviews; filtering; legacy preservation/archive; metadata layout/save; weight/missing/zero/invalid inputs; visible mobile deletion and undo; custom column add/delete/undo/save; exact PDF preview pages (${portrait} portrait/${landscape} landscape); repeated PDF metadata; zoom; print; six-column limit; no JavaScript errors.`);
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
