const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
require('../dist/core.js');const K=global.Kingdom;
const {harness}=require('./helpers/sw-harness.cjs');
const {boot}=require('./helpers/ui-harness.cjs');
const raw=s=>JSON.stringify(s);
function sample(){const s=K.empty();s.seen[1]=[1,2,3,4,5];s.session=K.createSession(1,42);return s;}
test('SEC: strict import rejects oversized, foreign keys, prototype payloads, arrays and invalid scores',()=>{
 assert.throws(()=>K.importProgress(' '.repeat(K.MAX_PROGRESS_BYTES+1)));
 for(const mutate of [s=>s.completed=[],s=>s.seen=[],s=>s.name={},s=>s.name='x'.repeat(41),s=>s.token='secret',s=>s.completed[1]={stars:3,errors:'Infinity',date:''},s=>s.completed[21]={stars:1,errors:0,date:''},s=>s.completed[2]={stars:3,errors:0,date:''},s=>s.seen[1]=Array(100).fill(1),s=>s.seen[1]=[101],s=>s.seen[1]=[1,1]]){const s=sample();mutate(s);assert.throws(()=>K.importProgress(raw(s)));}
 assert.throws(()=>K.importProgress('{"version":1,"name":"","completed":{},"seen":{},"session":null,"__proto__":{"polluted":true}}'));
 assert.equal({}.polluted,undefined);
});
test('SEC: invalid session cannot stall or inflate restored quiz; allowed fields only',()=>{
 for(const mutate of [s=>s.session.index=12,s=>s.session.pending=[0,0],s=>s.session.pending=Array(500).fill(0),s=>s.session.pending=[13],s=>s.session.seed=-1,s=>s.session.seed=2**40,s=>s.session.errors=-1,s=>s.session.errors=1e20,s=>s.session.phase='review',s=>s.session.other={payload:'x'},s=>s.session.level=20]){const s=sample();mutate(s);assert.throws(()=>K.importProgress(raw(s)));assert.equal(K.load({getItem:()=>raw(s)}).state.session,null);}
 const s=sample();K.answer(s.session,-1);const restored=K.importProgress(raw(s));assert.equal(restored.session.errors,1);assert.deepEqual(restored.session.pending,[0]);
});
test('SEC: old valid backups and escaped names still work; control characters removed',()=>{
 const s=sample();s.name='علي\u202e\u0000';const good=K.importProgress(raw(s));assert.equal(good.name,'علي');
 const payload='\"><img src=x onerror=alert(1)>';
 s.name=payload;const ui=boot(raw(s));assert.ok(!ui.html.includes(payload));assert.ok(ui.html.includes('&lt;img'));assert.ok(ui.html.includes('&quot;'));
 assert.equal(K.unlocked(K.empty(),0),false);assert.equal(K.unlocked(K.empty(),21),false);
});
test('SEC: SW bypasses auth/logout/API, tokens, cross-origin, unknown URLs and writes',async()=>{
 const h=await harness();await h.event('install');h.offline();const before=h.fetches;
 for(const [url,mode,extra]of [['logout','navigate'],['auth/callback?code=secret','navigate'],['api/profile','cors'],['unknown.js','cors'],['./?token=secret','navigate'],['https://evil.example/app.js','cors'],['app.js','cors',{method:'POST'}]])assert.equal(await h.response(url,mode,extra),undefined,url);
 assert.equal(h.fetches,before);assert.equal((await h.response('./?v=1','navigate')).status,200);
});
test('SEC: SW rejects 200 sign-in HTML and wrong MIME; preserves verified partial download',async()=>{
 for(const fault of [{path:'',body:'<html>Sign in</html>',type:'text/html'},{path:'audio/1.mp3',type:'text/html'},{path:'app.js',type:'text/html'},{path:'style.css',throw:true}]){const h=await harness(undefined,fault);await assert.rejects(()=>h.event('install'));assert.ok(h.messages.some(m=>m.type==='CACHE_ERROR'));assert.ok(!h.messages.some(m=>m.type==='OFFLINE_READY'));assert.equal(h.deleted.length,0);assert.ok(h.stores.size>0);}
});
test('SEC: SW accepts readiness messages only from owned app clients',async()=>{
 const h=await harness();await h.event('install');const n=h.messages.length;
 await h.event('message',{data:{type:'CHECK_READY'},source:{id:'foreign-client'}});assert.equal(h.messages.length,n);
 h.client.url='https://evil.example/';await h.event('message',{data:{type:'CHECK_READY'},source:h.client});assert.equal(h.messages.length,n);
});
test('SEC: CSP has no unsafe allowances, HTML has no inline JS/styles or external runtime',()=>{
 const html=fs.readFileSync('dist/index.html','utf8'),app=fs.readFileSync('dist/app.js','utf8');
 const csp=html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];
 for(const directive of ["default-src 'none'","script-src 'self'","style-src 'self'","base-uri 'none'","object-src 'none'","form-action 'none'"])assert.ok(csp.includes(directive));
 assert.ok(!/unsafe-inline|unsafe-eval|https?:|data:/.test(csp));assert.ok(!/<script(?![^>]*\bsrc=)[^>]*>/i.test(html));assert.ok(!/\bstyle=|\bon\w+=/i.test(html));assert.ok(!/\bstyle=/.test(app));
 for(const file of ['dist/app.js','dist/core.js','dist/interaction.js','dist/style.css']){const code=fs.readFileSync(file,'utf8');assert.ok(!/https?:\/\/|eval\s*\(|new Function\s*\(/.test(code),file);}
 assert.ok(fs.readFileSync('dist/_headers','utf8').includes("frame-ancestors 'self'"));
 assert.equal(Object.keys(JSON.parse(fs.readFileSync('package.json')).dependencies||{}).length,0);
});

test('FIX: hosting redirects index.html to / with 307; installer uses canonical root only',async()=>{
 const h=await harness(undefined,{path:'index.html',status:307,type:'text/html'});
 await h.event('install');await h.event('activate');
 assert.equal(h.requests.includes('index.html'),false);assert.equal(h.stores.size,115);
 h.offline();const alias=await h.response('index.html','navigate');assert.equal(alias.status,200);assert.match(await alias.text(),/مملكة الأعداد السحرية/);
});
test('FIX: interrupted downloads resume without refetching valid files; readiness waits for all audio',async()=>{
 const fault={path:'audio/25.mp3',throw:true};const h=await harness(undefined,fault);
 await assert.rejects(()=>h.event('install'));assert.equal(h.claimed,false);
 const before=new Set(h.stores.keys()),index=h.requests.length;assert.ok(before.size>0&&before.size<115);
 fault.path='';fault.throw=false; // next attempt succeeds for every remaining asset
 await h.event('install');await h.event('activate');assert.equal(h.stores.size,115);
 for(const request of h.requests.slice(index))assert.ok(!before.has(new URL(request,'https://test.example/app/').href),request);
 assert.ok(h.messages.some(m=>m.type==='CACHE_ERROR'&&m.file==='audio/25.mp3'));
 assert.equal(h.messages.at(-1).type,'OFFLINE_READY');
});
test('FIX: Android offline audio Range requests return correct bytes and reject bad ranges',async()=>{
 const h=await harness();await h.event('install');h.offline();const all=new Uint8Array(await (await h.response('audio/25.mp3','cors')).arrayBuffer());
 const partial=await h.response('audio/25.mp3','cors',{headers:new Headers({Range:'bytes=0-99'})});assert.equal(partial.status,206);assert.equal(partial.headers.get('Content-Range'),`bytes 0-99/${all.length}`);assert.deepEqual(new Uint8Array(await partial.arrayBuffer()),all.slice(0,100));
 const tail=await h.response('audio/25.mp3','cors',{headers:new Headers({Range:'bytes=-20'})});assert.deepEqual(new Uint8Array(await tail.arrayBuffer()),all.slice(-20));
 const invalid=await h.response('audio/25.mp3','cors',{headers:new Headers({Range:'bytes=999999-'})});assert.equal(invalid.status,416);
});
