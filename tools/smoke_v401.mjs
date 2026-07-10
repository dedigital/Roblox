import fs from 'node:fs';
import assert from 'node:assert/strict';
import {JSDOM, VirtualConsole} from 'jsdom';

const html=fs.readFileSync('index-v4.html','utf8');

function canvasContext(){
  const gradient={addColorStop(){}};
  const base={
    measureText(text){return {width:String(text??'').length*7.5};},
    createLinearGradient(){return gradient;}, createRadialGradient(){return gradient;},
    getTransform(){return {a:1,b:0,c:0,d:1,e:0,f:0};},
    isPointInPath(){return false;}, canvas:null
  };
  return new Proxy(base,{get(target,key){if(key in target)return target[key];return ()=>{};},set(target,key,value){target[key]=value;return true;}});
}

class AudioStub{
  constructor(){this.currentTime=0;this.state='running';this.destination={};}
  resume(){this.state='running';return Promise.resolve();}
  createOscillator(){return {type:'sine',frequency:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},start(){},stop(){}};}
  createGain(){return {gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}};}
}

async function boot({url='https://game.test/?debug=1',saves={}}={}){
  const raf=[]; const errors=[];
  const virtualConsole=new VirtualConsole();
  virtualConsole.on('jsdomError',error=>errors.push(error));
  virtualConsole.on('error',(...args)=>errors.push(new Error(args.join(' '))));
  const ctx=canvasContext();
  const dom=new JSDOM(html,{
    url,runScripts:'dangerously',pretendToBeVisual:true,virtualConsole,
    beforeParse(window){
      window.requestAnimationFrame=cb=>{raf.push(cb);return raf.length;};
      window.cancelAnimationFrame=()=>{};
      window.scrollTo=()=>{};
      window.matchMedia=query=>({matches:false,media:query,onchange:null,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){},dispatchEvent(){return false;}});
      window.AudioContext=AudioStub; window.webkitAudioContext=AudioStub;
      window.navigator.vibrate=()=>true;
      window.prompt=(_message,defaultValue='')=>defaultValue;
      window.alert=()=>{};
      window.TextEncoder=globalThis.TextEncoder; window.TextDecoder=globalThis.TextDecoder;
      Object.defineProperty(window.HTMLCanvasElement.prototype,'getContext',{configurable:true,value(){ctx.canvas=this;return ctx;}});
      for(const [key,value] of Object.entries(saves)) window.localStorage.setItem(key,typeof value==='string'?value:JSON.stringify(value));
    }
  });
  await new Promise(resolve=>setTimeout(resolve,30));
  return {
    dom,window:dom.window,raf,errors,
    runFirstFrame(){const cb=raf.shift();assert.equal(typeof cb,'function','initial RAF missing');cb(dom.window.performance.now()+16);}
  };
}

function pet(id='pet1',extra={}){
  return {id,name:'Test Pet',rarity:'Nadir',rarityKey:'rare',tier:2,mutation:'Normal',ability:'none',icon:'🧠',color:'#7ef0c1',price:1000,income:10,locked:false,slotIndex:0,...extra};
}

{
  const app=await boot();
  const {window}=app; assert.ok(window.__BRV4,'debug API should exist only with ?debug=1');
  app.runFirstFrame();
  const state=window.__BRV4.state;

  state.player.cash=0; state.player.gems=0; state.hardcore.cores=0; state.hardcore.raidRep=0;
  const essenceBefore=Number(state.v27?.essence||0), bufBefore=Number(state.v31?.buf||0), cratesBefore=Number(state.stats.crates||0);
  window.__BRV4.open('crates');
  const impossible=window.document.querySelector('[data-cmd="crate"][data-kind="impossible"]');
  assert.ok(impossible,'impossible crate button missing'); impossible.click();
  assert.equal(Number(state.stats.crates||0),cratesBefore,'failed crate changed crate count');
  assert.equal(Number(state.v27?.essence||0),essenceBefore,'failed crate granted essence');
  assert.equal(Number(state.v31?.buf||0),bufBefore,'failed crate changed essence buffer');

  state.player.carrying=pet('carry-metro');
  const oldX=state.player.x, oldY=state.player.y;
  window.__BRV4.open('districtMap');
  const metro=window.document.querySelector('[data-cmd="travel"][data-zone="neon"]');
  assert.ok(metro,'metro button missing'); metro.click();
  assert.equal(state.player.carrying?.id,'carry-metro','metro deleted carried pet');
  assert.equal(state.player.x,oldX,'metro moved while carrying'); assert.equal(state.player.y,oldY,'metro moved while carrying');

  state.inventory=Array.from({length:200},(_,i)=>pet(`inv-${i}`,{slotIndex:i}));
  state.v4.heist.active={id:'jewel',stage:'go',crack:1,timer:99,heatAcc:.2};
  state.v4.mTimers={sniper:11,junk:12,turret:13};
  state.v4.trade.timer=22;
  state.v4.trade.offer={id:'offer-1',bot:'Bot',wantId:'inv-0',wantScope:'inventory',wantName:'Test Pet',wantVal:1000,give:{pet:pet('trade-pet'),cash:500},fair:1,expires:44};
  window.dispatchEvent(new window.Event('pagehide'));
  const saved=JSON.parse(window.localStorage.getItem('brainrot-heist-save'));
  assert.equal(saved.inventory.length,200,'save silently truncated inventory');
  assert.equal(state.inventory.length,200,'serializer mutated live inventory');
  assert.equal(saved.playerState.carrying.id,'carry-metro','carried pet not saved');
  assert.equal(saved.v4.heist.active.id,'jewel','active Grand Heist not saved');
  assert.equal(saved.v4.mTimers.sniper,11,'manager timer not saved');
  assert.equal(saved.v4.trade.offer.id,'offer-1','trade offer not saved');

  window.document.querySelector('#panelClose')?.click();
  window.document.querySelector('#btnReset').click();
  const input=window.document.querySelector('#resetPhrase'); input.focus();
  input.dispatchEvent(new window.KeyboardEvent('keydown',{key:'i',bubbles:true,cancelable:true}));
  assert.ok(window.document.querySelector('#panel').classList.contains('hidden'),'typing in reset input triggered inventory shortcut');
  window.document.querySelector('#btnCancelReset').click();

  window.document.dispatchEvent(new window.KeyboardEvent('keydown',{key:'j',bubbles:true,cancelable:true}));
  assert.match(window.document.querySelector('#panelTitle').textContent,/V4\.0 Grand Heist/i,'J did not route exclusively to V4');
  window.__BRV4.open('v4trade');
  assert.equal(window.document.querySelector('[data-v4="tradeForce"]'),null,'production trade reroll button still present');

  assert.equal(app.errors.length,0,`runtime errors: ${app.errors.map(e=>e.message).join(' | ')}`);
  app.dom.window.close();
}

{
  const now=Date.now();
  const malicious=pet('x" onclick="window.__xss=1',{name:'<img src=x onerror=window.__xss=1>',color:'red" onmouseover="window.__xss=1'});
  const current={
    version:400,savedAt:now-5000,cash:1234,highCash:1234,gems:20,level:5,settings:{mode:'easy'},
    activeSlots:[pet('active-1')],inventory:[malicious],hardcore:{rank:0,worldTier:1,cores:0,raidRep:0},
    playerState:{x:500,y:800,carrying:pet('saved-carry')},
    v34:{crew:0,shards:0,spins:0,jackpots:0,lastBossKills:0,bestRank:99,businesses:{pizza:10},perks:{},rivals:[],lastSeen:now-3600_000,stats:{}},
    v4:{heist:{active:{id:'jewel',stage:'escape',crack:16,timer:88,heatAcc:0},cooldowns:{}},trade:{timer:31,offer:null},mTimers:{sniper:9,junk:8,turret:7},chatTimer:6}
  };
  const legacy={...current,cash:999999999999,highCash:999999999999,savedAt:now};
  const app=await boot({saves:{'brainrot-heist-save':current,'brainrot-heist-v13-save':legacy}});
  const state=app.window.__BRV4.state;
  assert.equal(state.player.cash,1234,'legacy high-score save overrode canonical current save');
  assert.match(state.inventory[0].id,/^[A-Za-z0-9_-]+$/,'malicious pet id was not sanitized');
  assert.match(state.inventory[0].color,/^#[0-9a-fA-F]{3,8}$/,'malicious color was not sanitized');
  assert.equal(state.player.carrying.id,'saved-carry','carried pet did not restore');
  assert.equal(state.v4.heist.active.stage,'escape','active Grand Heist did not restore');
  assert.equal(state.v4.mTimers.turret,7,'manager timer did not restore');
  app.window.__BRV4.open('inventory');
  assert.equal(app.window.document.querySelector('#panelBody img'),null,'malicious pet name created HTML element');
  assert.equal(app.window.__xss,undefined,'save import executed script');
  const cashBefore=state.player.cash;
  app.runFirstFrame();
  assert.ok(state.player.cash>cashBefore,'Syndicate offline income was lost before first frame');
  assert.equal(app.errors.length,0,`runtime errors on restored save: ${app.errors.map(e=>e.message).join(' | ')}`);
  app.dom.window.close();
}

{
  const app=await boot({url:'https://game.test/'});
  assert.equal(app.window.__BRV4,undefined,'debug API exposed in production URL');
  app.dom.window.close();
}

console.log('V4.0.1 smoke tests passed');
