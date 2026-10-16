/* Pure curriculum and assessment logic; no framework or network dependency. */
(function(root){
'use strict';
const DIGITS='٠١٢٣٤٥٦٧٨٩';
const units=['صفر','واحد','اثنان','ثلاثة','أربعة','خمسة','ستة','سبعة','ثمانية','تسعة'];
const teens=['عشرة','أحد عشر','اثنا عشر','ثلاثة عشر','أربعة عشر','خمسة عشر','ستة عشر','سبعة عشر','ثمانية عشر','تسعة عشر'];
const tens=['','','عشرون','ثلاثون','أربعون','خمسون','ستون','سبعون','ثمانون','تسعون'];
function ar(n){return String(n).replace(/\d/g,d=>DIGITS[d]);}
function word(n){if(n===100)return 'مائة';if(n<10)return units[n];if(n<20)return teens[n-10];return n%10?units[n%10]+' و'+tens[Math.floor(n/10)]:tens[n/10];}
function groups(n){return {tens:Math.floor(n/10),ones:n%10,frames:Array.from({length:Math.ceil(n/10)},(_,i)=>Math.min(10,n-i*10))};}
function numbers(level){return Array.from({length:5},(_,i)=>(level-1)*5+i+1);}
function rng(seed){let x=seed>>>0;return ()=>{x=(Math.imul(1664525,x)+1013904223)>>>0;return x/4294967296;};}
function shuffle(a,random){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function options(answer,random){const s=new Set([answer]);for(const x of shuffle([answer-1,answer+1,answer-2,answer+2,answer-5,answer+5,1,100],random)){if(x>=1&&x<=100)s.add(x);if(s.size===3)break;}return shuffle([...s],random);}
function questions(level,seed=1){const random=rng(seed),ns=numbers(level);const make=(kind,n,extra={})=>{let answer=n;if(kind==='before')answer=n-1;if(kind==='after')answer=n+1;if(kind==='place')answer=n%10;if(kind==='tens')answer=Math.floor(n/10);if(kind==='compare')answer=n===extra.other?'يساوي':n>extra.other?'أكبر من':'أصغر من';let opts=kind==='compare'?shuffle(['أكبر من','أصغر من','يساوي'],random):kind==='place'?shuffle([answer,(answer+1)%10,(answer+5)%10],random):kind==='tens'?shuffle([answer,(answer+1)%11,(answer+5)%11],random):options(answer,random);return {id:kind+'-'+n+'-'+(extra.other??''),kind,n,answer,options:opts,...extra};};
// Keep question positions/options stable so ongoing saved quizzes remain valid.
const q=ns.map((n,i)=>make(i===4?'sheep':'count',n));
q.push(make('descending',ns[2]));
q.push(make('before',Math.max(2,ns[3])));
q.push(make('after',Math.min(99,ns[1])));
const other=level%3===0?ns[2]:level%3===1?ns[1]:ns[4];q.push(make('compare',ns[2],{other}));
q.push(make('place',ns[4]));q.push(make('sequence',ns[2]));
if(level%4===0){for(const kind of ['count','before','after']){const n=2+Math.floor(random()*Math.max(1,ns[0]-3));q.push({...make(kind,n),review:true,id:'review-'+kind+'-'+n});}}
// Append only: saved question indices, choices and review entries stay valid.
q.push(make('tens',ns[4]));
return q;}
const KEY='magic-numbers-v1';
function empty(){return {version:1,name:'',completed:{},seen:{},session:null};}
const MAX_PROGRESS_BYTES=65536;
const MAX_ERRORS=1000000000;
const isRecord=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const int=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
const allowed=(o,keys)=>Object.keys(o).every(k=>keys.includes(k));
function cleanName(name){return String(name).replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g,'').trim().slice(0,40);}
function validSession(s){return isRecord(s)&&allowed(s,['level','seed','phase','index','pending','errors'])&&int(s.level,1,20)&&int(s.seed,0,4294967295)&&['quiz','review'].includes(s.phase)&&int(s.index,0,14)&&int(s.errors,0,MAX_ERRORS)&&Array.isArray(s.pending)&&s.pending.length<=15&&new Set(s.pending).size===s.pending.length&&s.pending.every(x=>int(x,0,14));}
function decode(raw,strict=false){
 if(typeof raw!=='string'||raw.length>MAX_PROGRESS_BYTES)throw Error('size');
 const s=JSON.parse(raw);
 if(!isRecord(s)||s.version!==1||!isRecord(s.completed)||!isRecord(s.seen))throw Error('schema');
 if(strict&&(!allowed(s,['version','name','completed','seen','session'])||typeof s.name!=='string'||s.name.length>40||!allowed(s.completed,Array.from({length:20},(_,i)=>String(i+1)))||!allowed(s.seen,Array.from({length:20},(_,i)=>String(i+1)))))throw Error('schema');
 const state=empty();state.name=cleanName(typeof s.name==='string'?s.name:'');
 for(let l=1;l<=20;l++){
  const c=s.completed[l];
  if(c!==undefined){
   const valid=isRecord(c)&&allowed(c,['stars','errors','date'])&&int(c.stars,1,3)&&int(c.errors,0,MAX_ERRORS)&&typeof c.date==='string'&&c.date.length<=30&&(c.date===''||Number.isFinite(Date.parse(c.date)))&&(l===1||!!state.completed[l-1]);
   if(valid)state.completed[l]={stars:c.stars,errors:c.errors,date:c.date};else if(strict)throw Error('completed');
  }
  const seen=s.seen[l];
  if(seen!==undefined&&(!Array.isArray(seen)||seen.length>5||!seen.every(n=>numbers(l).includes(n))||new Set(seen).size!==seen.length)){if(strict)throw Error('seen');state.seen[l]=[];}
  else state.seen[l]=Array.isArray(seen)?seen.slice():[];
 }
 if(s.session!==null&&s.session!==undefined){
  let valid=validSession(s.session);
  if(valid){const t=s.session,q=questions(t.level,t.seed),limit=t.phase==='quiz'?q.length:t.pending.length;valid=t.index<limit&&t.pending.every(i=>i<q.length)&&(t.phase!=='quiz'||t.pending.every(i=>i<=t.index))&&(t.level===1||!!state.completed[t.level-1])&&(t.pending.length===0||t.errors>=t.pending.length);}
  if(valid){const t=s.session;state.session={level:t.level,seed:t.seed,phase:t.phase,index:t.index,pending:t.pending.slice(),errors:t.errors};}
  else if(strict)throw Error('session');
 }
 return state;
}
function importProgress(raw){return decode(raw,true);}
function load(storage){try{const raw=storage.getItem(KEY);return {state:raw?decode(raw):empty(),error:null};}catch{return {state:empty(),error:'تعذّر قراءة التقدم المحفوظ. يمكنك البدء الآن؛ احتفظ بنسخة من تقدمك من لوحة التقدم.'};}}
function save(storage,state){try{storage.setItem(KEY,JSON.stringify(state));return true;}catch{return false;}}
function unlocked(state,l){return int(l,1,20)&&(l===1||!!state.completed[l-1]);}
function createSession(level,seed){return {level,seed,phase:'quiz',index:0,pending:[],errors:0};}
function current(s){const q=questions(s.level,s.seed);return s.phase==='quiz'?q[s.index]:q[s.pending[s.index]];}
/* Wrong answers never advance; the UI offers another attempt. Corrected items
   remain in pending until independently answered in the review phase. */
function answer(s,value){const q=current(s);if(!q)return {correct:false,done:true};const correct=q.answer===value;if(!correct){s.errors=Math.min(MAX_ERRORS,s.errors+1);if(s.phase==='quiz'&&!s.pending.includes(s.index))s.pending.push(s.index);return {correct:false,done:false};}return {correct:true,done:false};}
function advance(s){s.index++;if(s.phase==='quiz'&&s.index>=questions(s.level,s.seed).length){if(s.pending.length){s.phase='review';s.index=0;return 'review';}return 'done';}if(s.phase==='review'&&s.index>=s.pending.length)return 'done';return 'question';}
function finish(state,s){const stars=s.errors===0?3:s.errors<=3?2:1;const old=state.completed[s.level];if(!old||old.stars<stars)state.completed[s.level]={stars,errors:s.errors,date:new Date().toISOString()};state.session=null;return stars;}
root.Kingdom={ar,word,groups,numbers,questions,KEY,MAX_PROGRESS_BYTES,cleanName,empty,load,importProgress,save,unlocked,createSession,current,answer,advance,finish};
})(typeof window==='undefined'?globalThis:window);
