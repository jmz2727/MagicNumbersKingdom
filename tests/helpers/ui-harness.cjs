const vm=require('node:vm'),fs=require('node:fs');
function boot(saved,options={}){
 const classes={toggle(){},add(){},remove(){}},elements=new Map(),listeners={},swListeners={};let raw=saved,reloads=0,registrations=0,updates=0;const windowEvents={},nativeCalls=[];
 const el=id=>{
  if(!elements.has(id))elements.set(id,{innerHTML:'',textContent:'',hidden:true,dataset:{},events:{},classList:classes,
   addEventListener(name,fn,capture=false){(this.events[name]??=[]).push({fn,capture});if(id==='app')(listeners[name]??=[]).push({fn,capture});},
   closest(){return {addEventListener(){}};},querySelectorAll(){return []},querySelector(){return null},focus(){},setAttribute(){}});
  return elements.get(id);
 };
 const worker={state:'activated',addEventListener(){},postMessage(){}};
 const registration={active:worker,installing:null,waiting:null,addEventListener(){},update:async()=>{updates++;}};
 const serviceWorker={controller:worker,register:async()=>{registrations++;return registration;},addEventListener:(name,fn)=>swListeners[name]=fn};
 const context={console,setTimeout,clearTimeout,URL,Blob,Date,Math,Set,location:{hash:'#home',reload(){reloads++;}},history:{replaceState(){}},navigator:options.serviceWorker?{serviceWorker}:{},Audio:function(){this.play=()=>Promise.resolve();this.pause=()=>{};},document:{baseURI:'https://example.test/',getElementById:el,querySelectorAll:()=>[]},window:null};
 context.window=context;if(options.native)context.KingdomAndroid={saveProgress:raw=>nativeCalls.push({kind:'export',raw}),chooseProgressFile:()=>nativeCalls.push({kind:'import'}),printCertificate:()=>nativeCalls.push({kind:'print'})};context.confirm=()=>options.confirm!==false;const settings=new Map();context.localStorage={getItem:k=>k==='magic-numbers-v1'?raw:settings.get(k),setItem:(k,s)=>{if(k==='magic-numbers-v1')raw=s;else settings.set(k,s);}};context.addEventListener=(name,fn)=>{(windowEvents[name]??=[]).push(fn);};context.scrollTo=()=>{};vm.createContext(context);
 const assetRoot=options.native?'app/src/main/assets/www/':'dist/';for(const file of options.native?['core.js','interaction.js','native.js','app.js']:['core.js','interaction.js','app.js'])vm.runInContext(fs.readFileSync(assetRoot+file,'utf8'),context);
 return {nativeCalls,dispatch(name,detail){for(const fn of windowEvents[name]||[])fn({detail});},context,html:el('app').innerHTML,stored:()=>raw,element:el,settings,view:()=>el('app').innerHTML,
  get reloads(){return reloads;},get registrations(){return registrations;},get updates(){return updates;},
  async ready(){await Promise.resolve();await Promise.resolve();},
  message(data){swListeners.message?.({source:worker,data});},
  async offlineClick(){for(const {fn}of el('offline-retry').events.click||[])await fn();await Promise.resolve();},
  async click(act,data={}){const button={dataset:{act,...data},disabled:false};let stopped=false;const event={target:{closest:selector=>selector==='[data-act]'?button:null},preventDefault(){},stopImmediatePropagation(){stopped=true;}};for(const listener of [...listeners.click].sort((a,b)=>Number(b.capture)-Number(a.capture))){if(stopped)break;await listener.fn(event);}}
 };
}
module.exports={boot};
