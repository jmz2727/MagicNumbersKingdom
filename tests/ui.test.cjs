const {test}=require('node:test'),assert=require('node:assert/strict');
const {boot}=require('./helpers/ui-harness.cjs');
test('first playable shell and semantic quantities render without external runtime',()=>{const {context:c,html}=boot();assert.match(html,/لنبدأ المغامرة/);assert.match(html,/المستوى ١/);for(let n=1;n<=5;n++){const html=c.KingdomView.quantity(n,true);assert.equal((html.match(/data-fruit=/g)||[]).length,n);assert.equal((html.match(/class="empty-slot"/g)||[]).length,10-n);}});

test('all 100 quantities draw exactly N fruits, with 10 slots per frame',()=>{const {context:c}=boot();for(let n=1;n<=100;n++){for(const interactive of [false,true]){const html=c.KingdomView.quantity(n,interactive);assert.equal((html.match(interactive?/data-fruit=/g:/class="fruit"/g)||[]).length,n,`n=${n}`);assert.equal((html.match(/class="empty-slot"/g)||[]).length,Math.ceil(n/10)*10-n);assert.equal((html.match(/data-count=/g)||[]).length,Math.ceil(n/10));assert.equal((html.match(/ten-frame complete/g)||[]).length,Math.floor(n/10));}}});
test('home renders all 20 levels and safely escapes child names',()=>{const s={version:1,name:'<img src=x onerror=alert(1)>',completed:{},seen:{},session:null};const {html}=boot(JSON.stringify(s));assert.equal((html.match(/class="level-card/g)||[]).length,20);assert.equal((html.match(/class="level-card[^>]*disabled/g)||[]).length,19);assert.ok(!html.includes('<img src=x'));assert.ok(html.includes('&lt;img'));});

test('UI controller completes 20 levels by drops: study gate, answer lock, review and certificate',async()=>{
 const ui=boot(),K=ui.context.Kingdom;
 await ui.click('study',{level:'2'});assert.match(ui.view(),/خريطة المغامرة/);
 for(let level=1;level<=20;level++){
  await ui.click('study',{level:String(level)});assert.match(ui.view(),new RegExp('المستوى '+K.ar(level)));
  await ui.click('start-quiz');assert.equal(JSON.parse(ui.stored()).session,null);
  for(const number of K.numbers(level))await ui.click('number',{number:String(number)});
  await ui.click('start-quiz');let s=JSON.parse(ui.stored()).session;
  assert.equal(s.level,level);
  const first=K.current(s);const wrong=first.options.findIndex(v=>v!==first.answer);
  const drop=index=>{const current=JSON.parse(ui.stored()).session;ui.context.KingdomView.receiveDrop({kind:'answer',value:index,context:`${current.seed}:${current.phase}:${current.index}`},'answer');};drop(wrong);drop(wrong);
  s=JSON.parse(ui.stored()).session;assert.equal(s.errors,1);assert.equal(s.index,0);
  await ui.click('advance');assert.equal(JSON.parse(ui.stored()).session.index,0);
  await ui.click('retry-answer');let guard=0,reviewSeen=false;
  while((s=JSON.parse(ui.stored()).session)){
   assert.ok(guard++<30);if(s.phase==='review')reviewSeen=true;
   const q=K.current(s);drop(q.options.indexOf(q.answer));await ui.click('advance');
  }
  assert.equal(reviewSeen,true);assert.equal(JSON.parse(ui.stored()).completed[level].stars,2);
  assert.match(ui.view(),/أحسنت/);
  await ui.click('certificate',{level:String(level)});assert.match(ui.view(),level===20?/شهادة بطل المائة/:/شهادة إنجاز/);
 }
 assert.equal(Object.keys(JSON.parse(ui.stored()).completed).length,20);
});

test('FIX: place values explicitly position tens left and ones right in RTL page',async()=>{
 const ui=boot();await ui.click('study',{level:'1'});const html=ui.view();
 assert.match(html,/<div class="place-row" dir="ltr"/);
 const row=html.slice(html.indexOf('class="place-row"'),html.indexOf('<p class="helper">',html.indexOf('class="place-row"')));
 assert.ok(row.indexOf('عشرات')<row.indexOf('آحاد</span>'));assert.equal((row.match(/dir="rtl"/g)||[]).length,2);
});
test('RTL: comparison SVG opens toward the first operand on the right when it is greater',()=>{
 const ui=boot(),label=ui.context.KingdomView.choiceLabel;
 for(const [word,path]of [['أكبر من','M52 8 L12 32 L52 56'],['أصغر من','M12 8 L52 32 L12 56'],['يساوي','M12 23 H52 M12 41 H52']]){
  const html=label(word);assert.match(html,/<svg viewBox="0 0 64 64"/);assert.ok(html.includes(path));assert.ok(html.includes(word));
 }
});
