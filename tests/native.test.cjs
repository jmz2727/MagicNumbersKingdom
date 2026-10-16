const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const {boot}=require('./helpers/ui-harness.cjs');
const root='app/src/main/assets/www/';
test('ANDROID: first launch is ready offline without registering a service worker or account',async()=>{
 const ui=boot(undefined,{native:true,serviceWorker:true});await ui.ready();
 assert.equal(ui.registrations,0);assert.equal(ui.element('offline-status').textContent,'الدروس والأصوات جاهزة دون إنترنت ✓');assert.equal(ui.element('offline-detail').hidden,true);assert.match(ui.view(),/لنبدأ المغامرة/);
 await ui.click('study',{level:'1'});await ui.click('number',{number:'5'});assert.ok(JSON.parse(ui.stored()).seen[1].includes(5));
 const restored=boot(ui.stored(),{native:true});assert.equal(JSON.parse(restored.stored()).seen[1].includes(5),true);
});
test('ANDROID: native export/import uses the phone file picker and validates backups before replacing progress',async()=>{
 const ui=boot(undefined,{native:true});await ui.click('export');assert.equal(ui.nativeCalls[0].kind,'export');const backup=JSON.parse(ui.nativeCalls[0].raw);assert.equal(backup.version,1);
 await ui.click('native-import');assert.equal(ui.nativeCalls[1].kind,'import');
 const raw=ui.stored();ui.dispatch('kingdom-native-import','{broken');assert.equal(ui.stored(),raw);
 backup.name='بطل جديد';backup.completed[1]={stars:3,errors:0,date:''};ui.dispatch('kingdom-native-import',JSON.stringify(backup));assert.equal(JSON.parse(ui.stored()).name,'بطل جديد');assert.equal(JSON.parse(ui.stored()).completed[1].stars,3);
 await ui.click('print');assert.equal(ui.nativeCalls.at(-1).kind,'print');
});
test('ANDROID: cancelling restoration preserves existing progress',()=>{
 const ui=boot(undefined,{native:true,confirm:false}),raw=ui.stored();const backup=ui.context.Kingdom.empty();backup.name='discarded';ui.dispatch('kingdom-native-import',JSON.stringify(backup));assert.equal(ui.stored(),raw);
});
test('ANDROID: independent bundled UI completes all 20 levels by drops and restores mistakes',async()=>{
 const ui=boot(undefined,{native:true}),K=ui.context.Kingdom;
 for(let l=1;l<=20;l++){
  await ui.click('study',{level:String(l)});for(const n of K.numbers(l))await ui.click('number',{number:String(n)});await ui.click('start-quiz');let guard=0,wrong=false;
  while(JSON.parse(ui.stored()).session){
   assert.ok(guard++<32);const s=JSON.parse(ui.stored()).session,q=K.current(s),context=`${s.seed}:${s.phase}:${s.index}`;
   if(!wrong&&q.kind==='tens'){
    wrong=true;ui.context.KingdomView.receiveDrop({kind:'answer',value:q.options.findIndex(v=>v!==q.answer),context},'answer');await ui.click('retry-answer');
   }
   ui.context.KingdomView.receiveDrop({kind:'answer',value:q.options.indexOf(q.answer),context},'answer');await ui.click('advance');
  }
  assert.equal(JSON.parse(ui.stored()).completed[l].stars,2);
 }
 assert.equal(Object.keys(JSON.parse(ui.stored()).completed).length,20);
});
test('ANDROID: all assets are hashed, all 100 MP3s match the tested web snapshot, and no runtime permissions are requested',()=>{
 const inventory=JSON.parse(fs.readFileSync('app/src/main/assets/bundle.json','utf8'));
 for(const [path,meta]of Object.entries(inventory.files)){const body=fs.readFileSync(root+path);assert.equal(body.length,meta.bytes);assert.equal(crypto.createHash('sha256').update(body).digest('hex'),meta.sha256);}
 for(let n=1;n<=100;n++)assert.deepEqual(fs.readFileSync(root+`audio/${n}.mp3`),fs.readFileSync(`dist/audio/${n}.mp3`));
 const manifest=fs.readFileSync('app/src/main/AndroidManifest.xml','utf8');assert.ok(!/<uses-permission\b/.test(manifest));assert.match(manifest,/android:allowBackup="false"/);
 assert.ok(!fs.existsSync(root+'sw.js'));assert.ok(!fs.existsSync(root+'manifest.webmanifest'));
 const html=fs.readFileSync(root+'index.html','utf8');assert.ok(!html.includes('manifest.webmanifest'));assert.match(html,/native.js/);
 const java=fs.readFileSync('app/src/main/java/com/jameel/magicnumbers/MainActivity.java','utf8');assert.match(java,/setAllowFileAccess\(false\)/);assert.match(java,/setAllowContentAccess\(false\)/);assert.match(java,/MIXED_CONTENT_NEVER_ALLOW/);assert.match(java,/setWebContentsDebuggingEnabled\(false\)/);
});

test('ANDROID: parent guide describes the independent APK and removes browser/account installation steps',()=>{
 const ui=boot(undefined,{native:true});ui.context.location.hash='#guide';ui.dispatch('hashchange');const html=ui.view();assert.match(html,/تطبيق مستقل دون إنترنت/);assert.ok(!html.includes('data-act="install"'));assert.ok(!html.includes('تخزين Chrome'));assert.ok(!html.includes('حساب مالك الموقع'));
});
