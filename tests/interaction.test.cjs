const {test}=require('node:test'),assert=require('node:assert/strict');
require('../dist/interaction.js');const I=global.KingdomInteract;
const {boot}=require('./helpers/ui-harness.cjs');
test('BUILD: all 100 targets can be formed exactly from tens and ones; undo is reversible',()=>{
 for(let n=1;n<=100;n++){
  const m=I.newBuild(n);for(let i=0;i<Math.floor(n/10);i++)assert.equal(I.placeBuild(m,10,'tens').accepted,true);
  for(let i=0;i<n%10;i++)assert.equal(I.placeBuild(m,1,'ones').accepted,true);
  assert.equal(m.total,n);assert.equal(I.placeBuild(m,1,'ones').reason,'overshoot');assert.equal(m.total,n);
  while(m.history.length)I.undoBuild(m);assert.equal(m.total,0);
 }
});
test('BUILD: ten single apples regroup into one ten; wrong house and invalid drops never add quantities',()=>{
 const m=I.newBuild(25);for(let i=0;i<9;i++)I.placeBuild(m,1,'ones');const result=I.placeBuild(m,1,'ones');assert.equal(result.grouped,true);assert.equal(m.total,10);
 for(const [value,zone]of [[10,'ones'],[1,'tens'],[2,'ones'],[-1,'tens'],[1,'bad']]){assert.equal(I.placeBuild(m,value,zone).accepted,false);assert.equal(m.total,10);}
 assert.throws(()=>I.newBuild(0));assert.throws(()=>I.newBuild(101));
});
test('RTL: chevrons open toward larger side for all operand pairs in the 20-level curriculum',()=>{
 for(let first=1;first<=100;first++)for(let second=1;second<=100;second++){
  const word=first>second?'أكبر من':first<second?'أصغر من':'يساوي',path=I.relationPath(word);
  assert.equal(path,first>second?'M52 8 L12 32 L52 56':first<second?'M12 8 L52 32 L12 56':'M12 23 H52 M12 41 H52');
 }
});
test('UI: practice drops build quantity, reject wrong house, and keep progress independent',async()=>{
 const ui=boot();await ui.click('study',{level:'1'});const before=ui.stored();
 ui.context.KingdomView.receiveDrop({kind:'build',value:1,context:'1'},'build-tens');assert.match(ui.element('build-status').textContent,/بيت الآحاد/);assert.equal(ui.stored(),before);
 ui.context.KingdomView.receiveDrop({kind:'build',value:1,context:'1'},'build-ones');assert.match(ui.element('builder').innerHTML,/كوّنت العدد ١ تمامًا/);assert.equal(ui.stored(),before);
 ui.context.KingdomView.receiveDrop({kind:'build',value:1,context:'2'},'build-ones');assert.equal(ui.stored(),before);
 await ui.click('reset-build');assert.match(ui.element('builder').innerHTML,/سلتك فارغة/);
 await ui.click('pick-build',{value:'1'});await ui.click('drop-build',{zone:'ones'});assert.match(ui.element('builder').innerHTML,/كوّنت العدد ١ تمامًا/);
 await ui.click('undo-build');assert.match(ui.element('builder').innerHTML,/سلتك فارغة/);
});
test('UI: drag answers complete all 20 levels with the same correction/review rules and reject stale drops',async()=>{
 const ui=boot(),K=ui.context.Kingdom;
 for(let l=1;l<=20;l++){
  await ui.click('study',{level:String(l)});for(const n of K.numbers(l))await ui.click('number',{number:String(n)});await ui.click('start-quiz');
  let s=JSON.parse(ui.stored()).session,q=K.current(s);const context=()=>`${s.seed}:${s.phase}:${s.index}`;
  const wrong=q.options.findIndex(v=>v!==q.answer);
  ui.context.KingdomView.receiveDrop({kind:'answer',value:wrong,context:'stale'},'answer');assert.equal(JSON.parse(ui.stored()).session.errors,0);
  ui.context.KingdomView.receiveDrop({kind:'answer',value:wrong,context:context()},'answer');ui.context.KingdomView.receiveDrop({kind:'answer',value:wrong,context:context()},'answer');assert.equal(JSON.parse(ui.stored()).session.errors,1);
  await ui.click('retry-answer');let guard=0;
  while((s=JSON.parse(ui.stored()).session)){
   assert.ok(guard++<30);q=K.current(s);
   ui.context.KingdomView.receiveDrop({kind:'answer',value:q.options.indexOf(q.answer),context:context()},'answer');await ui.click('advance');
  }
  assert.equal(JSON.parse(ui.stored()).completed[l].stars,2);
 }
});
test('EFFECTS: settings persist under a separate key and never alter child progress',async()=>{
 const ui=boot();await ui.click('study',{level:'1'});const before=ui.stored();await ui.click('effect-sound');await ui.click('effect-motion');
 assert.deepEqual(JSON.parse(ui.settings.get(I.PREF_KEY)),{sound:false,motion:false});assert.equal(ui.stored(),before);
 assert.deepEqual(I.preferences({getItem:()=>'{bad'}),{sound:true,motion:true});assert.equal(I.savePreferences({setItem(){throw Error()}},{sound:false,motion:false}),false);
});
function dragHarness(){
 let clock=0,hit=true;const handlers={},drops=[],ghosts=[],body={appendChild:g=>ghosts.push(g)};
 function element(dataset={}){const classes=new Set();return {dataset,disabled:false,style:{},classList:{add:c=>classes.add(c),remove:c=>classes.delete(c),contains:c=>classes.has(c)},setPointerCapture(){},hasPointerCapture:()=>true,releasePointerCapture(){},removeAttribute(){},setAttribute(){},remove(){this.removed=true;},cloneNode(){return element({...dataset});},closest(selector){return selector==='[data-drag-kind]'&&dataset.dragKind?this:null;}};}
 const token=element({dragKind:'answer',dragValue:'1',dragContext:'42:quiz:0'}),drop=element({dropTarget:'answer'});drop.closest=()=>drop;
 const host={contains:x=>x===drop,addEventListener:(name,fn,capture=false)=>{(handlers[name]??=[]).push({fn,capture});}};
 const doc={body,elementFromPoint:()=>hit?drop:null};const win={performance:{now:()=>clock},addEventListener:(name,fn)=>handlers['window-'+name]=[{fn}]};
 const api=I.attachDrag(host,{document:doc,window:win,onDrop:(p,t)=>drops.push({p,t})});
 function fire(type,extra={}){let stopped=false;const event={pointerId:1,isPrimary:true,button:0,clientX:0,clientY:0,target:token,preventDefault(){this.prevented=true;},stopImmediatePropagation(){stopped=true;},...extra};for(const {fn}of [...handlers[type]||[]].sort((a,b)=>Number(b.capture)-Number(a.capture))){if(stopped)break;fn(event);}return event;}
 return {api,fire,token,drops,ghosts,setHit:v=>hit=v,tick:()=>clock+=600};
}
test('POINTER: touch/mouse drag drops once, cleans ghost, and suppresses synthetic click',()=>{
 const h=dragHarness();h.fire('pointerdown');h.fire('pointermove',{clientX:30,clientY:40});assert.equal(h.ghosts.length,1);assert.equal(h.token.classList.contains('is-dragging'),true);
 h.fire('pointerup',{clientX:30,clientY:40});assert.equal(h.drops.length,1);assert.equal(h.drops[0].t,'answer');assert.equal(h.drops[0].p.value,1);assert.equal(h.ghosts[0].removed,true);
 assert.equal(h.fire('click').prevented,true);h.tick();assert.equal(h.fire('click').prevented,undefined);
});
test('POINTER: outside target, cancel, wrong pointer and multi-touch never grade',()=>{
 for(const mode of ['outside','cancel','lost','rerender']){
  const h=dragHarness();h.fire('pointerdown');h.fire('pointermove',{clientX:20,clientY:30});
  if(mode==='outside'){h.setHit(false);h.fire('pointerup');}else if(mode==='cancel')h.fire('pointercancel');else if(mode==='lost')h.fire('lostpointercapture');else h.api.cancel();
  h.fire('pointerup');assert.equal(h.drops.length,0);assert.equal(h.ghosts[0].removed,true);
 }
 const h=dragHarness();h.fire('pointerdown',{isPrimary:false});h.fire('pointermove',{clientX:40,clientY:40});h.fire('pointerup');assert.equal(h.drops.length,0);assert.equal(h.ghosts.length,0);
 h.fire('pointerdown');h.fire('pointerup',{pointerId:2});assert.equal(h.drops.length,0);h.api.cancel();
});
test('POINTER: small movement stays a normal tap and does not suppress keyboard/tap fallback',()=>{
 const h=dragHarness();h.fire('pointerdown');h.fire('pointermove',{clientX:2,clientY:3});h.fire('pointerup');assert.equal(h.drops.length,0);assert.equal(h.ghosts.length,0);assert.equal(h.fire('click').prevented,undefined);
});
test('EFFECTS: mute avoids audio, reduced-motion avoids particles, and failures stay nonfatal',()=>{
 let audio=0,nodes=0;const win={AudioContext:function(){audio++;throw Error('blocked')},matchMedia:()=>({matches:true}),setTimeout(){}};const doc={createElement(){nodes++;throw Error('no DOM')}};
 const prefs={sound:false,motion:true},fx=I.createEffects(win,doc,prefs);assert.doesNotThrow(()=>fx.run('complete'));assert.equal(audio,0);assert.equal(nodes,0);
 prefs.sound=true;assert.doesNotThrow(()=>fx.run('correct'));assert.equal(audio,1);assert.equal(nodes,0);
});
