'use strict';
// Client-side opening barrier only. This does not encrypt worksheet data or
// replace server-side authorization. Never include a plaintext password here.
window.WorksheetPassword=(()=>{
  const hex=bytes=>[...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('');
  function validate(config){
    if(!config||config.version!==1||typeof config.enabled!=='boolean')throw new Error('密碼設定格式不正確');
    if(!config.enabled)return {version:1,enabled:false};
    if(config.algorithm!=='PBKDF2-SHA-256'||!Number.isInteger(config.iterations)||config.iterations<100000||config.iterations>2000000||!/^[a-f0-9]{32}$/.test(config.salt)||!/^[a-f0-9]{64}$/.test(config.digest))throw new Error('密碼驗證設定不正確');
    return {version:1,enabled:true,algorithm:config.algorithm,iterations:config.iterations,salt:config.salt,digest:config.digest};
  }
  async function derive(password,salt,iterations){
    if(!globalThis.crypto?.subtle)throw new Error('此瀏覽器無法進行密碼驗證，請使用 HTTPS 網站版');
    const bytes=Uint8Array.from(salt.match(/../g),pair=>parseInt(pair,16));
    const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
    return hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:bytes,iterations},key,256));
  }
  async function create(password){
    if(password.length<8||password.length>128)throw new Error('密碼長度需為 8–128 個字元');
    const salt=hex(crypto.getRandomValues(new Uint8Array(16))),iterations=310000;
    return {version:1,enabled:true,algorithm:'PBKDF2-SHA-256',iterations,salt,digest:await derive(password,salt,iterations)};
  }
  async function verify(password,config){
    const expected=validate(config);if(!expected.enabled)return true;
    const actual=await derive(password,expected.salt,expected.iterations);let difference=0;
    for(let i=0;i<actual.length;i++)difference|=actual.charCodeAt(i)^expected.digest.charCodeAt(i);
    return difference===0;
  }
  return Object.freeze({validate,create,verify});
})();
