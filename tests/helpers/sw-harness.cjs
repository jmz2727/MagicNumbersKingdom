const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve('dist');
async function harness(scope='https://test.example/app/',fault={}){
 const handlers={},stores=new Map(),messages=[],deleted=[];let online=true,fetches=0,claimed=false;const requests=[];
 const client={id:'owner-client',url:scope,postMessage:m=>messages.push(m)};
 const cache={async put(url,response){stores.set(String(url),response.clone());},async match(req,opts){let u=typeof req==='string'?req:req.url;if(opts?.ignoreSearch)u=u.split('?')[0];return stores.get(u)?.clone();},async keys(){return [...stores.keys()].map(url=>({url}));}};
 function type(file){return file.endsWith('.mp3')?'audio/mpeg':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.png')?'image/png':file.endsWith('.json')?'application/json':file.endsWith('.webmanifest')?'application/manifest+json':'text/html';}
 const context={URL,Request,Response,Headers,AbortController,setTimeout,clearTimeout,Set,console,caches:{open:async()=>cache,keys:async()=>fault.cacheKeys||[],delete:async key=>{deleted.push(key);return true;}},fetch:async req=>{fetches++;if(!online)throw Error('offline');const u=new URL(typeof req==='string'?req:req.url);const route=u.pathname.slice(new URL(scope).pathname.length);requests.push(route);const relative=route||'index.html';if(fault.path===route){if(fault.throw)throw Error('network');return new Response(fault.body||'<title>Sign in</title>',{status:fault.status||200,headers:{'Content-Type':fault.type||'text/html'}});}const file=path.join(root,relative);return fs.existsSync(file)?new Response(fs.readFileSync(file),{status:200,headers:{'Content-Type':type(relative)}}):new Response('missing',{status:404});},self:{registration:{scope},skipWaiting:async()=>{},clients:{matchAll:async()=>[client],get:async id=>id===client.id?client:null,claim:async()=>{claimed=true;}},addEventListener:(name,fn)=>handlers[name]=fn}};
 vm.createContext(context);vm.runInContext(fs.readFileSync('dist/sw.js','utf8'),context);
 async function event(name,extra={}){let work;handlers[name]({...extra,waitUntil:p=>work=p});if(work)await work;}
 async function response(url,mode,extra={}){let work;handlers.fetch({request:{method:'GET',url:new URL(url,scope).href,mode,...extra},respondWith:p=>work=p});return await work;}
 return {event,response,messages,stores,deleted,client,requests,offline(){online=false;},get fetches(){return fetches;},get claimed(){return claimed;}};
}
module.exports={harness};
