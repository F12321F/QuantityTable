const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const http=require('node:http');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..'),results=path.join(root,'test-results');fs.mkdirSync(results,{recursive:true});
const testPassword='Fixture-only-password-2026';
let verifier=null;const requests=[];
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{
  requests.push({url:req.url,method:req.method});
  const pathname=new URL(req.url,'http://localhost').pathname;
  const broken=pathname.startsWith('/Broken/'),prefix=broken?'/Broken/':'/QuantityTable/';
  if(!pathname.startsWith(prefix)){res.writeHead(404);res.end();return;}
  const relative=decodeURIComponent(pathname.slice(prefix.length))||'index.html',file=path.resolve(root,relative);
  if(relative==='password-config.json'){
    res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(broken?{version:1,enabled:true}:verifier||{version:1,enabled:false}));return;
  }
  if(relative==='standalone-test.html'){
    const html=fs.readFileSync(path.join(root,'downloads/quantity-table.html'),'utf8').replace(/(<script id="embeddedPasswordConfig" type="application\/json">)[\s\S]*?(<\/script>)/,(_,start,end)=>start+JSON.stringify(verifier)+end);
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(html);return;
  }
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(fs.readFileSync(file));
});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${server.address().port}`,base=origin+'/QuantityTable/';
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:process.platform==='win32'?[]:['--no-sandbox']});
  try{
    const context=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});let page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'password-setup.html');
    await page.locator('#newPassword').fill(testPassword);await page.locator('#confirmPassword').fill('different-fixture-password');await page.locator('#generatePasswordConfig').click();assert.match(await page.locator('#setupError').textContent(),/不同/);
    await page.locator('#confirmPassword').fill(testPassword);const download=page.waitForEvent('download');await page.locator('#generatePasswordConfig').click();const target=path.join(results,'password-config-fixture.json');await(await download).saveAs(target);
    verifier=JSON.parse(fs.readFileSync(target,'utf8'));assert.equal(verifier.enabled,true);assert.equal(verifier.algorithm,'PBKDF2-SHA-256');assert.equal(verifier.digest,crypto.pbkdf2Sync(testPassword,Buffer.from(verifier.salt,'hex'),verifier.iterations,32,'sha256').toString('hex'));
    assert.deepEqual(Object.keys(verifier).sort(),['algorithm','digest','enabled','iterations','salt','version']);assert.ok(!fs.readFileSync(target,'utf8').includes(testPassword));assert.equal(await page.locator('#newPassword').inputValue(),'');
    await page.goto(base);await page.waitForFunction(()=>!document.getElementById('unlockButton').disabled);
    assert.equal(await page.locator('main').isVisible(),false);assert.equal(await page.locator('#authGate').isVisible(),true);
    await page.locator('#openingPassword').fill('incorrect-fixture-password');await page.locator('#unlockButton').click();await page.waitForFunction(()=>document.getElementById('unlockError').textContent.includes('不正確'));assert.equal(await page.locator('main').isVisible(),false);
    await page.evaluate(()=>window.dispatchEvent(new Event('beforeprint')));assert.ok(!(await page.locator('#printArea').textContent()).includes('客戶名稱：'));
    async function unlock(){await page.locator('#openingPassword').fill(testPassword);await page.locator('#unlockButton').click();await page.waitForFunction(()=>document.documentElement.dataset.locked==='false');}
    await unlock();await page.locator('#customer').fill('密碼測試客戶');await page.locator('#rows tr').first().locator('[data-field=quantity]').fill('2');await page.locator('#rows tr').first().locator('[data-field=weight]').fill('1.25');
    await page.locator('#lockWorksheet').click();assert.equal(await page.locator('main').isVisible(),false);assert.equal(await page.locator('#openingPassword').inputValue(),'');await unlock();assert.equal(await page.locator('#customer').inputValue(),'密碼測試客戶');
    await page.waitForFunction(()=>navigator.serviceWorker.controller&&document.getElementById('pwaStatus').dataset.ready==='true');
    const saved=await page.evaluate(()=>JSON.stringify({...localStorage}));assert.ok(!saved.includes(testPassword));
    await context.setOffline(true);await page.close();page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>!document.getElementById('unlockButton').disabled);assert.equal(await page.locator('main').isVisible(),false);await unlock();assert.equal(await page.locator('#customer').inputValue(),'密碼測試客戶');assert.match(await page.locator('#tableWeight').textContent(),/2\.500/);
    await page.locator('#preview').click();await page.waitForFunction(()=>!document.getElementById('previewDownload').disabled);const pdf=page.waitForEvent('download');await page.locator('#previewDownload').click();await(await pdf).saveAs(path.join(results,'password-offline.pdf'));await page.locator('#backToEdit').click();
    await page.locator('#lockWorksheet').click();await page.screenshot({path:path.join(results,'password-mobile.png')});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await context.setOffline(false);
    const bad=await context.newPage();await bad.goto(origin+'/Broken/');await bad.waitForFunction(()=>document.getElementById('accessStatus').textContent.includes('無法載入'));assert.equal(await bad.locator('main').isVisible(),false);assert.equal(await bad.locator('#unlockButton').isDisabled(),true);await bad.close();
    // A generated standalone file carries the same verifier and needs no config fetch.
    const standalone=await context.newPage();await standalone.goto(base+'standalone-test.html');await standalone.waitForFunction(()=>!document.getElementById('unlockButton').disabled);assert.equal(await standalone.locator('main').isVisible(),false);await standalone.locator('#openingPassword').fill(testPassword);await standalone.locator('#unlockButton').click();await standalone.waitForFunction(()=>document.documentElement.dataset.locked==='false');
    assert.ok(requests.every(r=>r.method==='GET'));assert.ok(requests.every(r=>!r.url.includes(testPassword)));assert.deepEqual(errors,[]);
    console.log('PASS: local password generator and no plaintext export; wrong/correct password; manual relock; no password storage/upload; print guard; offline cold reopen/unlock/PDF; malformed config stays locked; standalone verifier; mobile layout.');
  }finally{await browser.close();await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});}
})().catch(error=>{console.error(error);server.closeAllConnections();server.close();process.exitCode=1;});
