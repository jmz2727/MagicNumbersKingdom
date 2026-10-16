'use strict';
// Bump VERSION whenever any application asset changes. Cache curriculum only.
const VERSION='magic-numbers-v1.5.0';
const BASE=self.registration.scope;
const SCOPE=new URL(BASE);
const CACHE=VERSION+'-'+SCOPE.pathname;
const FILES=['./','style.css','core.js','interaction.js','app.js','mascot.svg','star.svg','sheep.svg','farm-scene.svg','icon.svg','icon-192.png','icon-512.png','icon-maskable-512.png','manifest.webmanifest','audio/index.json',...Array.from({length:100},(_,i)=>`audio/${i+1}.mp3`)];
const urls=FILES.map(p=>new URL(p,BASE).href);
const ASSETS=new Set(urls);
const HOME=new Set([BASE,new URL('index.html',BASE).href]);
async function broadcast(data){for(const client of await self.clients.matchAll({includeUncontrolled:true,type:'window'}))if(isHome(client.url))client.postMessage(data);}
function isHome(address){try{const u=new URL(address);return u.origin===SCOPE.origin&&HOME.has(u.origin+u.pathname);}catch{return false;}}
function validType(url,response){
 const type=(response.headers.get('Content-Type')||'').split(';')[0].trim().toLowerCase();
 const pathname=new URL(url).pathname;
 if(pathname.endsWith('.mp3'))return ['audio/mpeg','audio/mp3'].includes(type);
 if(pathname.endsWith('.js'))return ['text/javascript','application/javascript'].includes(type);
 if(pathname.endsWith('.css'))return type==='text/css';
 if(pathname.endsWith('.png'))return type==='image/png';
 if(pathname.endsWith('.svg'))return type==='image/svg+xml';
 if(pathname.endsWith('.json')||pathname.endsWith('.webmanifest'))return ['application/json','application/manifest+json'].includes(type);
 return type==='text/html';
}
function errorDetails(error,url){
 let code=error.code||'NETWORK';
 if(error.name==='QuotaExceededError')code='STORAGE_FULL';
 if(error.name==='AbortError')code='TIMEOUT';
 return {type:'CACHE_ERROR',code,file:new URL(url||BASE).pathname.split('/').filter(Boolean).slice(-2).join('/')||'الصفحة الرئيسية',version:VERSION};
}
async function downloadAsset(url){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
 try{
  const response=await fetch(new Request(url,{cache:'reload',credentials:'same-origin',redirect:'error',signal:controller.signal}));
  if(response.status!==200){const e=Error('http');e.code=response.status===401||response.status===403?'AUTH_REQUIRED':'HTTP_'+response.status;throw e;}
  if(response.redirected||!validType(url,response)){const e=Error('content');e.code='INVALID_CONTENT';throw e;}
  if(HOME.has(url)&&!(await response.clone().text()).includes('<title>مملكة الأعداد السحرية</title>')){const e=Error('document');e.code='AUTH_REQUIRED';throw e;}
  const bytes=await response.arrayBuffer();
  return new Response(bytes,{status:200,headers:response.headers});
 }finally{clearTimeout(timer);}
}
async function install(){
 let cache,cursor=0,done=0,failure=null;
 try{
  cache=await caches.open(CACHE);
  const results=await Promise.allSettled(Array.from({length:3},async()=>{
   while(cursor<urls.length){
    const url=urls[cursor++];
    try{
     // Preserve and reuse verified files if a previous attempt was interrupted.
     const existing=await cache.match(url);
     if(!existing||!validType(url,existing)){
      let response;
      for(let attempt=0;attempt<2;attempt++){
       try{response=await downloadAsset(url);break;}
       catch(e){if(attempt===1||!['AbortError','TypeError'].includes(e.name))throw e;}
      }
      await cache.put(url,response);
     }
     done++;
     if(done%3===0||done===urls.length)await broadcast({type:'CACHE_PROGRESS',done,total:urls.length,percent:Math.round(done/urls.length*100),version:VERSION});
    }catch(e){if(!failure)failure=errorDetails(e,url);throw e;}
   }
  }));
  if(results.some(r=>r.status==='rejected'))throw Error('incomplete-cache');
  await self.skipWaiting();
 }catch(e){
  // Leave this version's good files available for the next install attempt.
  // Do not activate it or delete the previous working version.
  await broadcast({...failure||errorDetails(e),done,total:urls.length});throw e;
 }
}
self.addEventListener('install',event=>event.waitUntil(install()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 for(const key of await caches.keys())if(key.startsWith('magic-numbers-')&&key.endsWith('-'+SCOPE.pathname)&&key!==CACHE)await caches.delete(key);
 await self.clients.claim();await broadcast({type:'OFFLINE_READY',version:VERSION});
})()));
self.addEventListener('message',event=>{
 if(event.data?.type!=='CHECK_READY'||!event.source?.id)return;
 event.waitUntil((async()=>{
  const client=await self.clients.get(event.source.id);
  if(!client||!isHome(client.url))return;
  const cache=await caches.open(CACHE),present=new Set((await cache.keys()).map(k=>k.url));
  client.postMessage({type:urls.every(u=>present.has(u))?'OFFLINE_READY':'CACHE_ERROR',code:'INCOMPLETE',done:urls.filter(u=>present.has(u)).length,total:urls.length,version:VERSION});
 })());
});
self.addEventListener('fetch',event=>{
 const req=event.request,url=new URL(req.url);
 if(req.method!=='GET'||url.origin!==SCOPE.origin)return;
 const canonical=url.origin+url.pathname;
 // Leave authentication, logout, API and all unknown URLs to the hosting gateway.
 if(req.mode==='navigate'&&!HOME.has(canonical))return;
 if(req.mode!=='navigate'&&!ASSETS.has(canonical))return;
 // Only cache-busting parameters are harmless. Auth tokens must never hit cache.
 if([...url.searchParams.keys()].some(key=>!['v','cache-bust'].includes(key)))return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  const saved=await cache.match(req.mode==='navigate'?BASE:canonical);
  if(saved){const range=req.headers?.get('Range');if(range&&canonical.endsWith('.mp3'))return rangedAudio(saved,range);return saved;}
  try{return await fetch(req);}catch{return new Response('التنزيل غير مكتمل. اتصل بالإنترنت وافتح الصفحة الرئيسية.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}});}
 })());
});

async function rangedAudio(response,range){
 const data=await response.arrayBuffer(),size=data.byteLength;
 const match=/^bytes=(\d*)-(\d*)$/.exec(range);
 if(!match||(!match[1]&&!match[2]))return new Response(null,{status:416,headers:{'Content-Range':`bytes */${size}`}});
 let start=match[1]?Number(match[1]):Math.max(0,size-Number(match[2]));
 let end=match[1]?(match[2]?Math.min(Number(match[2]),size-1):size-1):size-1;
 if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=size)return new Response(null,{status:416,headers:{'Content-Range':`bytes */${size}`}});
 const headers=new Headers(response.headers);headers.set('Content-Range',`bytes ${start}-${end}/${size}`);headers.set('Content-Length',String(end-start+1));headers.set('Accept-Ranges','bytes');
 return new Response(data.slice(start,end+1),{status:206,statusText:'Partial Content',headers});
}
