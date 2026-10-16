const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
require('../dist/core.js');const K=global.Kingdom;
const {boot}=require('./helpers/ui-harness.cjs');
test('DRAG ONLY: tapping answer tiles cannot submit, score or change the question',async()=>{
 const ui=boot();await ui.click('study',{level:'1'});for(let n=1;n<=5;n++)await ui.click('number',{number:String(n)});await ui.click('start-quiz');
 const before=ui.stored(),q=K.current(JSON.parse(before).session);
 assert.ok(!ui.view().includes('data-act="answer"'));assert.ok(!/<button class="choice/.test(ui.view()));assert.equal((ui.view().match(/data-drag-kind="answer"/g)||[]).length,3);
 await ui.click('answer',{option:String(q.options.indexOf(q.answer))});assert.equal(ui.stored(),before);assert.equal(ui.element('feedback').innerHTML,'');
 const s=JSON.parse(before).session;ui.context.KingdomView.receiveDrop({kind:'answer',value:q.options.indexOf(q.answer),context:`${s.seed}:${s.phase}:${s.index}`},'answer');
 assert.match(ui.element('feedback').innerHTML,/أحسنت/);
});
test('SHEEP: every level has a sheep exercise and all answers/options are valid',()=>{
 for(let l=1;l<=20;l++)for(let seed=0;seed<20;seed++){
  const questions=K.questions(l,seed),sheep=questions.filter(q=>q.kind==='sheep');assert.equal(sheep.length,1);
  assert.equal(sheep[0].n,l*5);assert.equal(sheep[0].answer,l*5);assert.ok(sheep[0].options.includes(l*5));assert.equal(new Set(sheep[0].options).size,3);
 }
});
test('SHEEP: 1..100 drawings have exactly N sheep and ten slots in every paddock',()=>{
 const render=boot().context.KingdomView.sheepGarden;
 for(let n=1;n<=100;n++){
  const html=render(n);assert.equal((html.match(/data-sheep="/g)||[]).length,n);
  const frames=(html.match(/data-sheep-count="/g)||[]).length;assert.equal(frames,Math.ceil(n/10));assert.equal((html.match(/class="sheep-empty"/g)||[]).length,frames*10-n);
  assert.ok(html.includes('farm-scene.svg'));assert.ok(html.includes('sheep.svg'));
 }
 assert.equal(render(0),'');assert.equal(render(101),'');
});
test('SHEEP: saved ongoing legacy quiz keeps question order, options, score and review entries',()=>{
 const fixture=JSON.parse(fs.readFileSync('tests/fixtures/legacy-level10.json','utf8')),state=K.empty();
 for(let l=1;l<10;l++)state.completed[l]={stars:2,errors:1,date:'2026-10-16T00:00:00.000Z'};
 state.session={level:10,seed:fixture.seed,phase:'quiz',index:4,pending:[1],errors:1};state.seen[10]=[46,47,48,49,50];
 const restored=K.importProgress(JSON.stringify(state));assert.deepEqual(restored.session,state.session);assert.deepEqual(restored.completed,state.completed);
 const now=K.questions(10,fixture.seed).slice(0,fixture.questions.length).map(q=>({n:q.n,answer:q.answer,options:q.options}));assert.deepEqual(now,fixture.questions);
 assert.equal(K.current(restored.session).kind,'sheep');assert.equal(K.current(restored.session).n,50);
});
test('SHEEP: assets are local vector drawings with no scripts, external images or embedded raster data',()=>{
 for(const file of ['dist/sheep.svg','dist/farm-scene.svg']){const text=fs.readFileSync(file,'utf8');assert.match(text,/<svg/);assert.ok(!/<script|<image|onload=|data:image|href=/i.test(text));}
});
