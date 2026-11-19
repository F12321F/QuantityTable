const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:process.platform==='win32'?[]:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1100}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.APP_URL||'http://localhost:3000');
  const source=await page.evaluate(()=>window.SUCOOT_CATALOG);
  const pdfRows=source.items.filter(r=>r.pdfNo);
  assert.equal(pdfRows.length,333);assert.equal(source.items.length,356);
  assert.deepEqual(await page.locator('#rows tr').evaluateAll(rows=>rows.map(r=>r.querySelector('[data-field=code]').value)),source.items.map(r=>r.code));
  // Simulate the live v3 worksheet, out of order, with actual user input.
  const old=JSON.parse(fs.readFileSync(path.resolve(__dirname,'fixtures/catalog-v3.json'),'utf8'));
  const fixture={catalogVersion:old.version,customer:'自行填寫客戶',project:'自行填寫工程',salesperson:'自行填寫業務',author:'自行填寫製表',
   columns:[{id:'col_test-1',name:'使用位置'}],rows:old.items.map((r,i)=>({id:'old'+i,catalogId:r.id,code:r.code,name:r.name,spec:r.spec,weight:r.weight,quantity:'0',extra:{'col_test-1':'保留欄位'}})).reverse()};
  fixture.rows.find(r=>r.code==='V60100').quantity='7';fixture.rows.find(r=>r.code==='V60100').weight='99';
  fixture.rows.find(r=>r.code==='J48601S').quantity='4';
  fixture.rows.push({code:'CUSTOM-KEEP',name:'自訂資料',spec:'自訂規格',quantity:'2',weight:'3.5',extra:{'col_test-1':'自訂保留'}});
  await page.evaluate(data=>localStorage.setItem('ringlock-quantity-v1',JSON.stringify(data)),fixture);await page.reload();
  let saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('ringlock-quantity-v1')));
  assert.equal(saved.rows.length,357);
  assert.equal(saved.rows[0].code,'V60100');assert.equal(saved.rows[0].quantity,'7');assert.equal(saved.rows[0].weight,'99');
  assert.equal(saved.rows[0].extra['col_test-1'],'保留欄位');
  const active=saved.rows.find(r=>r.catalogId==='user-J48601S');assert.equal(active.code,'J48600S');assert.equal(active.quantity,'4');assert.equal(active.weight,'6.72');
  for(const field of ['customer','project','salesperson','author'])assert.equal(saved[field],fixture[field]);
  assert.equal(saved.rows.at(-1).code,'CUSTOM-KEEP');assert.equal(saved.rows.at(-1).extra['col_test-1'],'自訂保留');
  const row=page.locator('#rows tr').first();assert.equal(await row.evaluate(e=>e.classList.contains('needs-review')),true);
  // Later manual input survives reload and stays visibly marked for review.
  await row.locator('[data-field=code]').fill('MANUAL-CHECK');await page.reload();assert.equal(await page.locator('#rows tr').first().locator('[data-field=code]').inputValue(),'MANUAL-CHECK');
  await page.locator('#onlyReview').check();const visible=await page.locator('#rows tr:visible').count();assert.ok(visible>0&&visible<357);
  const removeId=await page.locator('#rows tr:visible').first().getAttribute('data-id');await page.locator('#rows tr[data-id="'+removeId+'"]').locator('.delete').click();
  assert.equal(await page.locator('#rows tr').count(),356);await page.reload();assert.equal(await page.locator('#rows tr').count(),356);
  // No silent restoration of a manually deleted uncertain item.
  assert.equal(await page.locator('#rows [data-field=code]').evaluateAll(inputs=>inputs.filter(i=>i.value==='MANUAL-CHECK').length),0);
  await page.locator('#onlyReview').uncheck();await page.locator('#auditPdf').click();assert.match(await page.locator('#auditSummary').textContent(),/356/);
  await page.locator('#auditFilter').selectOption('');assert.equal(await page.locator('#auditRows tr').count(),334);await page.locator('#closeAudit').click();
  assert.deepEqual(errors,[]);console.log('PASS: PDF sequence, blank codes/defaults, v3 migration, PDF code precedence, manual weights/metadata/custom columns, red filter and persistent manual deletion');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
