const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const http=require('node:http');
const os=require('node:os');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..'),results=path.join(root,'test-results');fs.mkdirSync(results,{recursive:true});
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.png':'image/png','.webmanifest':'application/manifest+json'};
let revision=1;
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(!url.pathname.startsWith('/QuantityTable/')){res.writeHead(404);res.end();return;}
  const relative=decodeURIComponent(url.pathname.slice('/QuantityTable/'.length))||'index.html';
  const file=path.resolve(root,relative);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
  let body=fs.readFileSync(file);
  if(relative==='sw.js'&&revision===2)body=Buffer.from(body.toString().replace(/(const CACHE_NAME=CACHE_PREFIX\+')[^']+(';)/,'$1test-revision-two$2'));
  res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(body);
});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}/QuantityTable/`;
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'quantity-pwa-'));
  const context=await chromium.launchPersistentContext(profile,{executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:process.platform==='win32'?[]:['--no-sandbox'],viewport:{width:390,height:844},acceptDownloads:true});
  try{
    let page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base);
    await page.waitForFunction(()=>navigator.serviceWorker.controller&&document.getElementById('pwaStatus').dataset.ready==='true');
    assert.match(await page.locator('#pwaStatus').textContent(),/已可離線使用/);
    const manifest=JSON.parse(await(await page.request.get(base+'manifest.webmanifest')).text());
    assert.equal(manifest.display,'standalone');assert.equal(new URL(manifest.start_url,base).href,base);assert.equal(new URL(manifest.scope,base).href,base);
    const cdp=await context.newCDPSession(page);const observed=await cdp.send('Page.getAppManifest');assert.deepEqual(observed.errors,[]);assert.equal(JSON.parse(observed.data).name,manifest.name);const eligibility=await cdp.send('Page.getInstallabilityErrors');assert.deepEqual(eligibility.installabilityErrors,[]);await cdp.detach();
    const scope=await page.evaluate(async()=>{const reg=await navigator.serviceWorker.getRegistration();return reg.scope;});assert.equal(scope,base);
    await page.locator('#installHelp').click();assert.ok((await page.locator('#installDialog').textContent()).includes('iPhone'));await page.locator('#closeInstall').click();
    await page.locator('#customer').fill('離線測試客戶');await page.locator('#project').fill('離線測試工程');await page.locator('#salesperson').fill('測試業務');
    await page.locator('#rows tr').first().locator('[data-field=quantity]').fill('2');await page.locator('#rows tr').first().locator('[data-field=weight]').fill('1.25');
    await page.evaluate(async()=>{const cache=await caches.open('travel-split-v2');await cache.put('/other-app-test',new Response('preserve'));});
    await context.setOffline(true);await page.reload({waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>document.getElementById('pwaStatus').dataset.ready==='true');
    assert.match(await page.locator('#pwaStatus').textContent(),/離線模式/);assert.equal(await page.locator('#customer').inputValue(),'離線測試客戶');assert.match(await page.locator('#tableWeight').textContent(),/2\.500/);
    await page.locator('#addRow').click();let row=page.locator('#rows tr').last();await row.locator('[data-field=code]').fill('OFFLINE-1');await row.locator('[data-field=name]').fill('離線新增品項');await row.locator('[data-field=spec]').fill('自訂尺寸');await row.locator('[data-field=quantity]').fill('3');await row.locator('[data-field=weight]').fill('0.5');
    await page.locator('#addColumn').click();await page.locator('#columnName').fill('使用位置');await page.locator('#columnForm button[type=submit]').click();await page.locator('#rows tr').last().locator('[data-column]').fill('離線 A 區');assert.match(await page.locator('#tableWeight').textContent(),/4\.000/);
    // Close the document, then start a new document with the network still off.
    await page.close();page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'?offline-reopen=1',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>document.getElementById('pwaStatus').dataset.ready==='true');
    assert.equal(await page.locator('#rows tr').count(),357);assert.equal(await page.locator('#rows tr').last().locator('[data-column]').inputValue(),'離線 A 區');assert.match(await page.locator('#tableWeight').textContent(),/4\.000/);
    await page.locator('#preview').click();await page.waitForFunction(()=>!document.getElementById('previewDownload').disabled);
    const download=page.waitForEvent('download');await page.locator('#previewDownload').click();await(await download).saveAs(path.join(results,'pwa-offline.pdf'));
    assert.equal(fs.readFileSync(path.join(results,'pwa-offline.pdf')).subarray(0,8).toString(),'%PDF-1.4');await page.locator('#backToEdit').click();
    await page.screenshot({path:path.join(results,'pwa-offline-mobile.png'),fullPage:true});
    // An update installs beside the old worker, and only activates on user action.
    await context.setOffline(false);revision=2;
    await page.evaluate(async()=>{const reg=await navigator.serviceWorker.getRegistration();await reg.update();});
    await page.waitForFunction(()=>!document.getElementById('updateApp').hidden);
    assert.equal(await page.locator('#customer').inputValue(),'離線測試客戶');await page.locator('#updateApp').click();
    await page.waitForFunction(async()=>{const names=await caches.keys();return names.some(n=>n.endsWith('test-revision-two'))&&document.getElementById('pwaStatus')?.dataset.ready==='true';});
    assert.equal(await page.locator('#customer').inputValue(),'離線測試客戶');assert.equal(await page.locator('#rows tr').count(),357);assert.match(await page.locator('#tableWeight').textContent(),/4\.000/);
    const cachesAfter=await page.evaluate(()=>caches.keys());assert.ok(cachesAfter.includes('travel-split-v2'));assert.equal(cachesAfter.filter(n=>n.startsWith('quantity-table:'+base+':')).length,1);
    await context.setOffline(true);await page.reload({waitUntil:'domcontentloaded'});assert.equal(await page.locator('#rows tr').last().locator('[data-column]').inputValue(),'離線 A 區');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[]);
    console.log('PASS: installable manifest/icons and project subpath; complete offline shell; cold offline reopen; saved customer/salesperson/custom rows/columns; offline calculation and PDF preview/download; opt-in worker update preserves data and other app caches; mobile layout; no JS errors.');
  }finally{await context.close();fs.rmSync(profile,{recursive:true,force:true});await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});}
})().catch(error=>{console.error(error);server.closeAllConnections();server.close();process.exitCode=1;});
