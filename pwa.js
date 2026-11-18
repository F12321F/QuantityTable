'use strict';
(()=>{
  const status=document.getElementById('pwaStatus'),installButton=document.getElementById('installApp'),updateButton=document.getElementById('updateApp');
  let ready=false,promptEvent=null,registration=null,reloadOnChange=false,installedThisSession=false;
  const installed=()=>installedThisSession||window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
  function paint(){
    status.textContent=ready?(navigator.onLine?(installed()?'已安裝 · 已可離線使用':'已可離線使用'):'離線模式 · 表單可繼續使用'):(navigator.onLine?'正在準備離線使用…':'目前離線，請先連線完成準備');
    status.dataset.ready=String(ready);installButton.hidden=installed();
  }
  function showUpdate(){if(registration?.waiting)updateButton.hidden=false;}
  document.getElementById('installHelp').addEventListener('click',()=>document.getElementById('installDialog').showModal());
  document.getElementById('closeInstall').addEventListener('click',()=>document.getElementById('installDialog').close());
  installButton.addEventListener('click',async()=>{
    if(!promptEvent){document.getElementById('installDialog').showModal();return;}
    try{await promptEvent.prompt();await promptEvent.userChoice;}catch{document.getElementById('installDialog').showModal();}
    finally{promptEvent=null;paint();}
  });
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();promptEvent=event;paint();});
  window.addEventListener('appinstalled',()=>{promptEvent=null;installedThisSession=true;paint();});
  updateButton.addEventListener('click',()=>{
    if(!registration?.waiting)return;
    reloadOnChange=true;updateButton.disabled=true;updateButton.textContent='正在更新…';registration.waiting.postMessage({type:'SKIP_WAITING'});
  });
  if(!('serviceWorker' in navigator)||!window.isSecureContext||!/^https?:$/.test(location.protocol)){
    status.textContent='請使用 HTTPS 網址安裝並準備離線使用';installButton.hidden=true;return;
  }
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(reloadOnChange)location.reload();});
  window.addEventListener('online',()=>{paint();registration?.update().catch(()=>{});});window.addEventListener('offline',paint);
  paint();
  (async()=>{
    try{
      const existing=await navigator.serviceWorker.getRegistration('./');
      registration=existing?.scope===new URL('./',location.href).href?existing:await navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'});
      showUpdate();registration.addEventListener('updatefound',()=>{const worker=registration.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed')setTimeout(showUpdate,0);});});
      await navigator.serviceWorker.ready;ready=true;paint();showUpdate();
      if(navigator.onLine)registration.update().catch(()=>{});
    }catch{
      status.textContent='離線準備未完成，請保持連線並重新開啟';status.dataset.ready='false';
    }
  })();
})();
