/* Touch, mouse and keyboard-friendly activities. No downloads or dependencies. */
(function(root){
'use strict';
const PREF_KEY='magic-numbers-effects-v1';
function preferences(storage){try{const raw=storage.getItem(PREF_KEY);if(!raw||raw.length>256)return {sound:true,motion:true};const v=JSON.parse(raw);return {sound:typeof v.sound==='boolean'?v.sound:true,motion:typeof v.motion==='boolean'?v.motion:true};}catch{return {sound:true,motion:true};}}
function savePreferences(storage,prefs){try{storage.setItem(PREF_KEY,JSON.stringify({sound:!!prefs.sound,motion:!!prefs.motion}));return true;}catch{return false;}}
function newBuild(target){if(!Number.isInteger(target)||target<1||target>100)throw Error('invalid target');return {target,total:0,history:[]};}
function placeBuild(model,value,zone){
 if(!model||![1,10].includes(value)||!['ones','tens'].includes(zone))return {accepted:false,reason:'invalid'};
 if((value===1&&zone!=='ones')||(value===10&&zone!=='tens'))return {accepted:false,reason:'zone'};
 if(model.total+value>model.target)return {accepted:false,reason:'overshoot'};
 const grouped=value===1&&model.total%10===9;model.total+=value;model.history.push(value);
 return {accepted:true,complete:model.total===model.target,grouped};
}
function undoBuild(model){if(model.history.length)model.total-=model.history.pop();return model.total;}
// The first operand is on the RIGHT. Open the chevron toward the larger operand.
function relationPath(word){return word==='أكبر من'?'M52 8 L12 32 L52 56':word==='أصغر من'?'M12 8 L52 32 L12 56':'M12 23 H52 M12 41 H52';}
function createEffects(win,doc,prefs){
 let context=null;
 function play(kind){
  if(!prefs.sound)return;
  try{
   const Context=win.AudioContext||win.webkitAudioContext;if(!Context)return;
   if(!context||context.state==='closed')context=new Context();
   if(context.state==='suspended'){const p=context.resume();if(p?.catch)p.catch(()=>{});}
   const notes=kind==='complete'?[523,659,784,1047]:kind==='correct'?[523,659,784]:kind==='retry'?[262,247]:[587];
   const start=context.currentTime;
   notes.forEach((frequency,i)=>{
    const oscillator=context.createOscillator(),gain=context.createGain(),time=start+i*.075;
    oscillator.type='sine';oscillator.frequency.setValueAtTime(frequency,time);
    gain.gain.setValueAtTime(.0001,time);gain.gain.exponentialRampToValueAtTime(.035,time+.012);gain.gain.exponentialRampToValueAtTime(.0001,time+.095);
    oscillator.connect(gain);gain.connect(context.destination);oscillator.start(time);oscillator.stop(time+.11);oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
   });
  }catch{/* Feedback must never interrupt grading or learning. */}
 }
 function run(kind,element){
  play(kind);
  if(!prefs.motion||win.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;
  try{
   if(element){element.classList.remove('fx-correct','fx-retry');element.classList.add(kind==='retry'?'fx-retry':'fx-correct');win.setTimeout(()=>element.classList.remove('fx-correct','fx-retry'),650);}
   if(kind==='complete'){
    const burst=doc.createElement('div');burst.className='celebration';burst.setAttribute('aria-hidden','true');
    for(let i=0;i<8;i++){const star=doc.createElement('span');star.className='celebration-star star-'+i;star.textContent=i%2?'✦':'★';burst.appendChild(star);}
    doc.body.appendChild(burst);win.setTimeout(()=>burst.remove(),950);
   }
  }catch{/* Animation is optional. */}
 }
 return {run,play};
}
function attachDrag(host,options){
 const doc=options.document,win=options.window;let gesture=null,ignoreClicksUntil=0;
 const now=()=>win.performance?.now()??Date.now();
 function targetAt(x,y){const target=doc.elementFromPoint(x,y)?.closest('[data-drop-target]');return target&&host.contains(target)?target:null;}
 function cancel(){
  if(!gesture)return;const g=gesture;gesture=null;
  g.element.classList.remove('is-dragging');g.ghost?.remove();g.over?.classList.remove('drop-hover');
  try{if(g.element.hasPointerCapture?.(g.id))g.element.releasePointerCapture(g.id);}catch{}
 }
 host.addEventListener('pointerdown',event=>{
  const element=event.target.closest('[data-drag-kind]');
  if(gesture||!element||element.disabled||element.dataset.dragDisabled==='true'||event.isPrimary===false||(event.button!==undefined&&event.button!==0))return;
  const payload={kind:element.dataset.dragKind,value:Number(element.dataset.dragValue),context:element.dataset.dragContext||''};
  if(!Number.isFinite(payload.value)||options.canStart?.(payload)===false)return;
  gesture={element,payload,id:event.pointerId,x:event.clientX,y:event.clientY,moved:false,ghost:null,over:null};
  try{element.setPointerCapture(event.pointerId);}catch{}
 });
 host.addEventListener('pointermove',event=>{
  const g=gesture;if(!g||event.pointerId!==g.id)return;
  if(!g.moved&&Math.hypot(event.clientX-g.x,event.clientY-g.y)<8)return;
  if(!g.moved){
   g.moved=true;g.element.classList.add('is-dragging');g.ghost=g.element.cloneNode(true);
   g.ghost.removeAttribute('id');g.ghost.removeAttribute('data-act');g.ghost.removeAttribute('data-drag-kind');g.ghost.setAttribute('aria-hidden','true');g.ghost.tabIndex=-1;g.ghost.classList.add('drag-ghost');doc.body.appendChild(g.ghost);
  }
  event.preventDefault();g.ghost.style.left=event.clientX+'px';g.ghost.style.top=event.clientY+'px';
  const target=targetAt(event.clientX,event.clientY);
  if(target!==g.over){g.over?.classList.remove('drop-hover');g.over=target;target?.classList.add('drop-hover');}
 });
 host.addEventListener('pointerup',event=>{
  const g=gesture;if(!g||event.pointerId!==g.id)return;
  const target=g.moved?targetAt(event.clientX,event.clientY):null;
  const payload=g.payload,moved=g.moved;
  if(moved){event.preventDefault();ignoreClicksUntil=now()+500;}
  cancel();
  if(moved&&target)options.onDrop(payload,target.dataset.dropTarget);
 });
 host.addEventListener('pointercancel',event=>{if(gesture?.id===event.pointerId){if(gesture.moved)ignoreClicksUntil=now()+500;cancel();}});
 host.addEventListener('lostpointercapture',event=>{if(gesture?.id===event.pointerId)cancel();});
 host.addEventListener('click',event=>{if(now()<ignoreClicksUntil){event.preventDefault();event.stopImmediatePropagation();}},true);
 host.addEventListener('dragstart',event=>{if(event.target.closest('[data-drag-kind]'))event.preventDefault();});
 win.addEventListener('blur',cancel);
 return {cancel};
}
root.KingdomInteract={PREF_KEY,preferences,savePreferences,newBuild,placeBuild,undoBuild,relationPath,createEffects,attachDrag};
})(typeof window==='undefined'?globalThis:window);
