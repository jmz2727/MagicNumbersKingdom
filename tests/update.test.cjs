const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {boot}=require('./helpers/ui-harness.cjs');
test('UPDATE: completed newer cache exposes apply/reload action and preserves child progress',async()=>{
 const ui=boot(undefined,{serviceWorker:true});await ui.ready();await ui.click('study',{level:'1'});const before=ui.stored(),registrations=ui.registrations;
 ui.message({type:'OFFLINE_READY',version:'magic-numbers-future'});
 assert.equal(ui.element('offline-detail').hidden,false);assert.equal(ui.element('offline-retry').hidden,false);assert.match(ui.element('offline-retry').textContent,/تطبيق التحديث/);assert.equal(ui.element('offline-retry').dataset.offlineAction,'reload');
 await ui.offlineClick();assert.equal(ui.reloads,1);assert.equal(ui.registrations,registrations);assert.equal(ui.stored(),before);
});
test('UPDATE: in-progress button is hidden; incomplete cache retries download rather than reloading',async()=>{
 const ui=boot(undefined,{serviceWorker:true});await ui.ready();const before=ui.registrations;
 ui.message({type:'CACHE_PROGRESS',done:30,total:113,percent:27});assert.equal(ui.element('offline-retry').hidden,true);await ui.offlineClick();assert.equal(ui.registrations,before);
 ui.message({type:'CACHE_ERROR',code:'NETWORK',file:'audio/25.mp3'});assert.equal(ui.element('offline-retry').hidden,false);assert.match(ui.element('offline-retry').textContent,/استكمال التنزيل/);assert.equal(ui.element('offline-retry').dataset.offlineAction,'retry');
 await ui.offlineClick();await ui.ready();assert.equal(ui.registrations,before+1);assert.equal(ui.updates,1);assert.equal(ui.reloads,0);
});
test('UPDATE: current ready version hides panel; hidden overrides author button display styles',async()=>{
 const ui=boot(undefined,{serviceWorker:true});await ui.ready();const code=fs.readFileSync('dist/app.js','utf8'),version=code.match(/const APP_VERSION='([^']+)'/)[1];
 ui.message({type:'OFFLINE_READY',version});assert.equal(ui.element('offline-detail').hidden,true);
 assert.match(fs.readFileSync('dist/style.css','utf8'),/\[hidden\]\s*\{\s*display\s*:\s*none\s*!important\s*\}/);
});
