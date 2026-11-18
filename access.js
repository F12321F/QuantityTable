'use strict';
(()=>{
  let locked=true,config=null;
  const gate=document.getElementById('authGate'),form=document.getElementById('unlockForm'),input=document.getElementById('openingPassword'),error=document.getElementById('unlockError'),status=document.getElementById('accessStatus'),button=document.getElementById('unlockButton'),lockButton=document.getElementById('lockWorksheet');
  function showLock(value){
    locked=value;document.documentElement.dataset.locked=String(value);gate.hidden=!value;
    for(const element of document.querySelectorAll('body > header, body > main'))element.inert=value;
    if(value){for(const dialog of document.querySelectorAll('dialog[open]'))dialog.close();input.value='';error.textContent='';if(config?.enabled)input.focus();}
  }
  Object.defineProperty(window,'worksheetAccess',{value:Object.freeze({get locked(){return locked;},lock(){if(config?.enabled)showLock(true);}})});
  showLock(true);
  lockButton.addEventListener('click',()=>window.worksheetAccess.lock());
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(!config?.enabled)return;
    button.disabled=true;error.textContent='';
    try{
      if(await WorksheetPassword.verify(input.value,config)){input.value='';showLock(false);}
      else{error.textContent='密碼不正確，請重新輸入。';input.select();}
    }catch(reason){error.textContent=reason.message;}
    finally{button.disabled=false;}
  });
  (async()=>{
    try{
      const embedded=document.getElementById('embeddedPasswordConfig');
      let data;if(embedded)data=JSON.parse(embedded.textContent);else{const response=await fetch('./password-config.json',{cache:'no-cache'});if(!response.ok)throw new Error('無法載入密碼設定');data=await response.json();}
      config=WorksheetPassword.validate(data);document.documentElement.dataset.passwordEnabled=String(config.enabled);lockButton.hidden=!config.enabled;
      if(!config.enabled){showLock(false);return;}
      status.textContent='請輸入共用開啟密碼；離線時也可驗證。';input.disabled=false;button.disabled=false;input.focus();
    }catch{
      status.textContent='無法載入密碼設定，請先連線並重新開啟。';error.textContent='表單尚未解鎖，原有資料仍保留在本機。';
    }
  })();
})();
