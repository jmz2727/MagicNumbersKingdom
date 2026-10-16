const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
require('../dist/core.js');const K=global.Kingdom;
const {boot}=require('./helpers/ui-harness.cjs');
function saved(level,index,phase='quiz',pending=[]){const s=K.empty();for(let l=1;l<level;l++)s.completed[l]={stars:3,errors:0,date:''};s.seen[level]=K.numbers(level);s.session={level,seed:12345,index,phase,pending,errors:pending.length};return JSON.stringify(s);}
function tiles(html){return [...html.matchAll(/<span class="seq-num ([^"]*)"([^>]*)>([^<]*)<\/span>/g)].map(m=>({missing:m[1].includes('missing'),target:m[2].includes('data-drop-target="answer"'),value:m[3]}));}
test('RTL sequences: displayed order and titles agree when read from the right in every level',()=>{
 const V=boot().context.KingdomView;
 for(let l=1;l<=20;l++)for(const q of K.questions(l,17).filter(q=>['sequence','descending'].includes(q.kind))){
  const html=V.visual(q),numbers=tiles(html);assert.match(html,/class="sequence" dir="rtl"/);
  const ascending=q.kind==='sequence';assert.equal(numbers[0].value,K.ar(q.n+(ascending?-1:1)));assert.equal(numbers[2].value,K.ar(q.n+(ascending?1:-1)));assert.equal(numbers[1].value,'؟');assert.equal(numbers[1].target,true);assert.match(V.title(q),ascending?/من الأصغر إلى الأكبر/:/من الأكبر إلى الأصغر/);
 }
 assert.match(fs.readFileSync('dist/style.css','utf8'),/\.sequence\{display:flex;direction:rtl;/);
});
test('inline quiz targets: exactly one drop area and no redundant rectangle in all 20 levels',async()=>{
 for(let l=1;l<=20;l++)for(const [index,q]of K.questions(l,12345).entries()){
  const ui=boot(saved(l,index));await ui.click('resume');const html=ui.view();
  assert.equal((html.match(/data-drop-target="answer"/g)||[]).length,1,`${l}:${q.kind}`);
  if(['sequence','descending','before','after','place','tens'].includes(q.kind))assert.ok(!html.includes('class="answer-drop"'),q.kind);
  assert.equal((html.match(/data-drag-kind="answer"/g)||[]).length,3);assert.ok(!html.includes('data-act="answer"'));
 }
});
test('before and after: blank is the correct neighbor in the RTL row, including boundary numbers',()=>{
 const V=boot().context.KingdomView;
 for(const n of [2,54,99])for(const kind of ['before','after']){
  const t=tiles(V.visual({kind,n}));assert.equal(t.length,3);assert.equal(t[1].value,K.ar(n));assert.equal(t[kind==='before'?0:2].target,true);assert.equal(t[kind==='before'?2:0].value,K.ar(n+(kind==='before'?1:-1)));
 }
});
test('tens and ones: both are assessed separately in every level, zero ones and ten tens are valid',()=>{
 const V=boot().context.KingdomView;
 for(let l=1;l<=20;l++){
  const qs=K.questions(l,77);for(const kind of ['place','tens']){
   const q=qs.find(q=>q.kind===kind),html=V.visual(q);assert.ok(q);assert.equal(q.answer,kind==='place'?q.n%10:Math.floor(q.n/10));assert.equal(new Set(q.options).size,3);assert.ok(q.options.includes(q.answer));assert.match(html,/quiz-place" dir="ltr"/);
   const boxes=[...html.matchAll(/<div class="place-box[^>]*>(.*?)<\/div>/g)].map(m=>m[0]);assert.equal(boxes.length,2);assert.match(boxes[0],/عشرات/);assert.match(boxes[1],/آحاد/);assert.match(boxes[kind==='tens'?0:1],/data-drop-target="answer"/);assert.match(V.title(q),kind==='tens'?/ما عدد العشرات/:/ما عدد الآحاد/);
   assert.equal((html.match(/class="fruit"/g)||[]).length,q.n);
  }
 }
 assert.equal(K.questions(20).find(q=>q.kind==='tens').answer,10);assert.equal(K.questions(20).find(q=>q.kind==='place').answer,0);
});
test('drop writes into the missing tile or nested value and retains place-value labels',async()=>{
 for(const kind of ['sequence','descending','before','after','place','tens']){
  const index=K.questions(10,12345).findIndex(q=>q.kind===kind),ui=boot(saved(10,index));await ui.click('resume');const s=JSON.parse(ui.stored()).session,q=K.current(s),nested={innerHTML:'؟'},classes=[];
  const zone={innerHTML:kind==='place'||kind==='tens'?'<b>؟</b><span>label</span>':'؟',querySelector:()=>['place','tens'].includes(kind)?nested:null,classList:{add:c=>classes.push(c)}};
  ui.element('app').querySelectorAll=selector=>selector==='[data-drop-target="answer"]'?[zone]:[];
  ui.context.KingdomView.receiveDrop({kind:'answer',value:q.options.indexOf(q.answer),context:`${s.seed}:${s.phase}:${s.index}`},'answer');
  assert.equal(['place','tens'].includes(kind)?nested.innerHTML:zone.innerHTML,K.ar(q.answer));if(['place','tens'].includes(kind))assert.match(zone.innerHTML,/label/);assert.deepEqual(classes,['drop-correct']);assert.match(ui.element('feedback').innerHTML,/أحسنت/);
 }
});
test('saved quizzes and review queues keep legacy question indices and receive appended tens question',()=>{
 const fixture=JSON.parse(fs.readFileSync('tests/fixtures/legacy-level10.json','utf8')),qs=K.questions(10,fixture.seed);
 assert.deepEqual(qs.slice(0,fixture.questions.length).map(({n,answer,options})=>({n,answer,options})),fixture.questions);assert.equal(qs.at(-1).kind,'tens');
 for(let l=1;l<=20;l++)for(const phase of ['quiz','review']){
  const oldLast=(l%4===0?14:11)-1,raw=saved(l,phase==='quiz'?oldLast:0,phase,[oldLast]);const restored=K.importProgress(raw);assert.deepEqual(restored.session,JSON.parse(raw).session);assert.deepEqual(restored.completed,JSON.parse(raw).completed);
  if(phase==='quiz'){assert.equal(K.advance(restored.session),'question');assert.equal(K.current(restored.session).kind,'tens');}
 }
});
test('new tens mistakes require correction and independent review before unlocking',()=>{
 for(let l=1;l<=20;l++){
  const s=K.createSession(l,9);s.index=K.questions(l,9).length-1;assert.equal(K.current(s).kind,'tens');K.answer(s,-1);assert.equal(K.answer(s,K.current(s).answer).correct,true);assert.equal(K.advance(s),'review');const state=K.empty();for(let j=1;j<l;j++)state.completed[j]={stars:3,errors:0,date:''};state.session=s;
  const loaded=K.importProgress(JSON.stringify(state));assert.equal(K.current(loaded.session).kind,'tens');assert.equal(K.unlocked(loaded,l+1),false);K.answer(loaded.session,K.current(loaded.session).answer);assert.equal(K.advance(loaded.session),'done');K.finish(loaded,loaded.session);if(l<20)assert.equal(K.unlocked(loaded,l+1),true);
 }
});
