'use strict';
document.getElementById('setupPasswordForm').addEventListener('submit',async event=>{
  event.preventDefault();const password=document.getElementById('newPassword'),confirmation=document.getElementById('confirmPassword'),error=document.getElementById('setupError'),status=document.getElementById('setupStatus'),button=document.getElementById('generatePasswordConfig');
  error.textContent='';status.textContent='';if(password.value!==confirmation.value){error.textContent='兩次輸入的密碼不同。';return;}
  button.disabled=true;button.textContent='正在產生驗證設定…';
  try{
    const config=await WorksheetPassword.create(password.value);
    const url=URL.createObjectURL(new Blob([JSON.stringify(config,null,2)+'\n'],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='password-config.json';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
    password.value='';confirmation.value='';status.textContent='驗證設定檔已下載。請傳給助手套用；目前尚未更改網站的開啟密碼。';
  }catch(reason){error.textContent=reason.message;}finally{button.disabled=false;button.textContent='產生並下載驗證設定檔';}
});
