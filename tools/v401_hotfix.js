/* ===================== V4.0.1 FULL AUDIT HOTFIX =====================
   Save/import hardening, data-loss guards, economy exploit fixes,
   persistent V4 runtime state, keyboard routing, offline-income ordering,
   in-place V25 state, inventory preservation and steady-loop cleanup. */
(function v401AuditHotfix(){
  const AUDIT_LABEL='V4.0.1 Audit Hotfix';
  const AUDIT_ECON_MAX=(typeof V271_ECON_MAX==='number'&&Number.isFinite(V271_ECON_MAX))?V271_ECON_MAX:1e300;
  const AUDIT_INVENTORY_CAP=500;
  const AUDIT_TARGETS=new Set(['jewel','train','casino','penthouse','cryptoX']);
  const AUDIT_STAGES=new Set(['go','crack','escape']);
  let auditOfflineConsumed=false;
  let auditLoadedV34Seen=0;

  const auditNum=(value,fallback=0,min=0,max=AUDIT_ECON_MAX)=>{
    const n=Number(value);
    return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;
  };
  const auditInt=(value,fallback=0,min=0,max=999999)=>Math.round(auditNum(value,fallback,min,max));
  const auditText=(value,max=160)=>String(value??'').replace(/[\u0000-\u001f\u007f]/g,'').slice(0,max);
  const auditId=value=>{
    const id=auditText(value,96);
    return /^[A-Za-z0-9_-]{1,96}$/.test(id)?id:uid();
  };
  const auditColor=(value,fallback='#9fb1d7')=>{
    const color=auditText(value,16);
    return /^#[0-9a-fA-F]{3,8}$/.test(color)?color:fallback;
  };
  function auditClone(value,depth=0){
    if(depth>14) return null;
    if(value===null||typeof value==='boolean') return value;
    if(typeof value==='number') return Number.isFinite(value)?Math.max(-AUDIT_ECON_MAX,Math.min(AUDIT_ECON_MAX,value)):0;
    if(typeof value==='string') return value.slice(0,4000);
    if(Array.isArray(value)) return value.slice(0,1000).map(v=>auditClone(v,depth+1));
    if(value&&typeof value==='object'){
      const out={};
      for(const [key,val] of Object.entries(value)){
        if(key==='__proto__'||key==='prototype'||key==='constructor') continue;
        out[auditText(key,96)]=auditClone(val,depth+1);
      }
      return out;
    }
    return null;
  }
  function auditPetInput(item={},idx=0){
    const raw=(item&&typeof item==='object')?item:{};
    const rarity=resolveRarity(raw);
    const income=auditNum(raw.income??raw.value,1,0,AUDIT_ECON_MAX);
    const fallbackPrice=Math.max(5,Math.round(income*15/5)*5);
    const ability=raw.ability&&PET_ABILITIES[raw.ability]?raw.ability:defaultPetAbility({...raw,rarityKey:rarity.key,tier:rarity.tier});
    return {
      ...raw,
      id:auditId(raw.id),
      name:auditText(raw.name||'Bilinmeyen Brainrot',64)||'Bilinmeyen Brainrot',
      rarity:rarity.name,
      rarityKey:rarity.key,
      tier:rarity.tier,
      mutation:auditText(raw.mutation||'Normal',32)||'Normal',
      ability,
      icon:auditText(raw.icon||'🧠',12)||'🧠',
      color:auditColor(raw.color,rarity.color),
      price:auditNum(raw.price,fallbackPrice,0,AUDIT_ECON_MAX),
      income,
      mood:auditNum(raw.mood,0,-Math.PI*2,Math.PI*2),
      scale:auditNum(raw.scale,1,.5,2),
      locked:Boolean(raw.locked||raw.favorite),
      slotIndex:auditInt(raw.slotIndex,idx,0,255),
      source:auditText(raw.source||'',32),
      evo:auditInt(raw.evo,0,0,10)
    };
  }

  const auditBaseCleanBrainrot=cleanBrainrot;
  cleanBrainrot=function(item={},idx=0){
    const safe=auditPetInput(item,idx);
    let out;
    try{ out=auditBaseCleanBrainrot(safe,idx); }
    catch(_){ out=safe; }
    return {
      ...out,
      id:safe.id,name:safe.name,rarity:safe.rarity,rarityKey:safe.rarityKey,tier:safe.tier,
      mutation:safe.mutation,ability:safe.ability,icon:safe.icon,color:safe.color,
      price:safe.price,income:+safe.income.toFixed(1),mood:safe.mood,scale:safe.scale,
      locked:safe.locked,slotIndex:safe.slotIndex,source:safe.source,evo:safe.evo
    };
  };
  function auditNormalizePets(list,limit,seen=new Set(),active=false){
    const out=[];
    for(const raw of (Array.isArray(list)?list:[]).filter(Boolean).slice(0,limit)){
      let pet=cleanBrainrot(raw,out.length);
      if(seen.has(pet.id)) pet={...pet,id:uid()};
      seen.add(pet.id);
      if(active) pet.slotIndex=out.length;
      out.push(pet);
    }
    return out;
  }

  /* V25 used to replace state.v25 on every ensure call, orphaning references. */
  ensureV25Fields=function(){
    ensureV23Fields(); ensureV22Fields();
    const v=(state.v25&&typeof state.v25==='object')?state.v25:(state.v25={});
    v.version=25;
    v.bank=auditNum(v.bank,0); v.bankLevel=auditInt(v.bankLevel,0); v.bankInterest=auditNum(v.bankInterest,0);
    v.vehiclesOwned={scooter:true,...((v.vehiclesOwned&&typeof v.vehiclesOwned==='object')?v.vehiclesOwned:{})};
    v.selectedVehicle=auditText(v.selectedVehicle||'scooter',32)||'scooter';
    v.vehicleUpgrades={speed:0,handling:0,nitro:0,armor:0,...((v.vehicleUpgrades&&typeof v.vehicleUpgrades==='object')?v.vehicleUpgrades:{})};
    for(const key of ['speed','handling','nitro','armor']) v.vehicleUpgrades[key]=auditInt(v.vehicleUpgrades[key],0,0,20);
    v.nitro=auditNum(v.nitro,100,0,100); v.fuel=auditNum(v.fuel,100,0,100); v.distanceDriven=auditNum(v.distanceDriven,0);
    v.gpsTarget=(v.gpsTarget&&typeof v.gpsTarget==='object')?v.gpsTarget:null;
    v.daily={last:auditText(v.daily?.last||'',16),streak:auditInt(v.daily?.streak,0,0,9999)};
    v.npcJobs=Array.isArray(v.npcJobs)&&v.npcJobs.length?v.npcJobs:makeNpcJobs();
    v.npcSeed=auditNum(v.npcSeed,Date.now(),0,Number.MAX_SAFE_INTEGER);
    v.jobRerollTimer=auditNum(v.jobRerollTimer,0,0,999999);
    v.bankRaid=(v.bankRaid&&typeof v.bankRaid==='object')?v.bankRaid:null;
    v.bankRaidTimer=auditNum(v.bankRaidTimer,rand(70,150),0,999999);
    v.chaseTimer=auditNum(v.chaseTimer,0,0,999999);
    v.lastPos=(v.lastPos&&Number.isFinite(Number(v.lastPos.x))&&Number.isFinite(Number(v.lastPos.y)))?v.lastPos:{x:state.player.x,y:state.player.y};
    v.statWatch=(v.statWatch&&typeof v.statWatch==='object')?v.statWatch:{};
    v.tutorialSeen=!!v.tutorialSeen; v.insuranceLevel=auditInt(v.insuranceLevel,0,0,10); v.repHelpClaimed=!!v.repHelpClaimed;
    if(!V25_VEHICLES.some(vehicle=>vehicle.id===v.selectedVehicle)) v.selectedVehicle='scooter';
    state.settings.vehicleOwned=true;
    return v;
  };

  const auditBaseAddToInventory=addToInventory;
  addToInventory=function(item,silent=false){
    if(!Array.isArray(state.inventory)) state.inventory=[];
    if(state.inventory.length>=AUDIT_INVENTORY_CAP){
      showMessage(`Envanter dolu (${AUDIT_INVENTORY_CAP}). Önce pet sat veya base'e koy.`,3);
      try{ beep('bad'); }catch(_){}
      return null;
    }
    return auditBaseAddToInventory(cleanBrainrot(item),silent);
  };

  /* The old stability sanitizer silently cut inventory to 180. Preserve and sanitize the full supported inventory. */
  if(typeof v271SanitizeRuntimeState==='function'){
    const auditBaseRuntimeSanitize=v271SanitizeRuntimeState;
    v271SanitizeRuntimeState=function(){
      const beforeInventory=auditNormalizePets(state.inventory,AUDIT_INVENTORY_CAP);
      const beforeCarrying=state.player?.carrying?cleanBrainrot(state.player.carrying):null;
      auditBaseRuntimeSanitize();
      state.inventory=beforeInventory;
      if(state.player) state.player.carrying=beforeCarrying;
    };
  }

  function auditSanitizeSave(input){
    const saved=auditClone(input)||{};
    for(const key of ['cash','highCash','gems','xp','skillPoints','rebirths','speedLevel','slotBonus','luckLevel','lockLevel','trapLevel','guardLevel','scannerLevel','vaultLevel']){
      if(key in saved) saved[key]=auditNum(saved[key],0,0,AUDIT_ECON_MAX);
    }
    saved.level=auditInt(saved.level??saved.player?.level,1,1,9999);
    saved.savedAt=auditNum(saved.savedAt,0,0,Number.MAX_SAFE_INTEGER);
    if(saved.player&&typeof saved.player==='object'){
      for(const key of ['cash','highCash','gems','xp','skillPoints','rebirths','speedLevel','slotBonus','luckLevel','lockLevel','trapLevel','guardLevel','scannerLevel','vaultLevel']){
        if(key in saved.player) saved.player[key]=auditNum(saved.player[key],0,0,AUDIT_ECON_MAX);
      }
      saved.player.level=auditInt(saved.player.level,1,1,9999);
    }
    saved.hardcore=(saved.hardcore&&typeof saved.hardcore==='object')?saved.hardcore:{};
    saved.hardcore.rank=auditInt(saved.hardcore.rank,0,0,9999);
    saved.hardcore.worldTier=auditInt(saved.hardcore.worldTier,1,1,999);
    saved.hardcore.cores=auditNum(saved.hardcore.cores,0);
    saved.hardcore.raidRep=auditNum(saved.hardcore.raidRep,0);
    saved.settings=(saved.settings&&typeof saved.settings==='object')?saved.settings:{};
    if(!GAME_MODES[saved.settings.mode]) saved.settings.mode='easy';
    const active=Array.isArray(saved.activeSlots)?saved.activeSlots:(Array.isArray(saved.playerSlots)?saved.playerSlots:[]);
    saved.activeSlots=active.slice(0,56).map(auditPetInput);
    saved.playerSlots=saved.activeSlots.map(p=>({...p}));
    saved.inventory=(Array.isArray(saved.inventory)?saved.inventory:[]).slice(0,AUDIT_INVENTORY_CAP).map(auditPetInput);
    if(saved.playerState&&typeof saved.playerState==='object'){
      saved.playerState.x=auditNum(saved.playerState.x,330,30,WORLD.w-30);
      saved.playerState.y=auditNum(saved.playerState.y,900,30,WORLD.h-30);
      if(saved.playerState.carrying) saved.playerState.carrying=auditPetInput(saved.playerState.carrying);
    }
    return saved;
  }

  function auditApplyV4Restore(saved){
    const source=saved?.v4;
    const v=state.v4;
    if(!source||typeof source!=='object'||!v) return;
    const active=source.heist?.active;
    if(active&&AUDIT_TARGETS.has(active.id)&&AUDIT_STAGES.has(active.stage)){
      v.heist.active={
        id:active.id,stage:active.stage,
        crack:auditNum(active.crack,0,0,3600),timer:auditNum(active.timer,0,0,7200),heatAcc:auditNum(active.heatAcc,0,0,10)
      };
    }else v.heist.active=null;
    v.mTimers={
      sniper:auditNum(source.mTimers?.sniper,source.mTimers?0:5,0,3600),
      junk:auditNum(source.mTimers?.junk,source.mTimers?0:6,0,3600),
      turret:auditNum(source.mTimers?.turret,source.mTimers?0:2.5,0,3600)
    };
    v.trade.timer=auditNum(source.trade?.timer,v.trade.timer,0,9999);
    const offer=source.trade?.offer;
    if(offer&&typeof offer==='object'){
      v.trade.offer={
        id:auditId(offer.id),bot:auditText(offer.bot||'Bot',48),wantId:auditId(offer.wantId),
        wantScope:offer.wantScope==='active'?'active':'inventory',wantName:auditText(offer.wantName||'Pet',64),
        wantVal:auditNum(offer.wantVal,1,0,AUDIT_ECON_MAX),
        give:{pet:cleanBrainrot(offer.give?.pet||{}),cash:auditNum(offer.give?.cash,0,0,AUDIT_ECON_MAX)},
        fair:auditNum(offer.fair,1,0,10),expires:auditNum(offer.expires,30,0,3600)
      };
    }else v.trade.offer=null;
    v.chat.timer=auditNum(source.chatTimer,v.chat.timer,0,3600);
    if(source.snap&&typeof source.snap==='object') v.snap={...v.snap,...source.snap};
  }

  const auditBaseRestoreSave=restoreSave;
  restoreSave=function(input){
    const saved=auditSanitizeSave(input);
    const activeRaw=Array.isArray(saved.activeSlots)?saved.activeSlots:[];
    const inventoryRaw=Array.isArray(saved.inventory)?saved.inventory:[];
    const carryingRaw=saved.playerState?.carrying||saved.player?.carrying||saved.carrying||null;
    const px=saved.playerState?.x??saved.player?.x;
    const py=saved.playerState?.y??saved.player?.y;
    auditLoadedV34Seen=auditNum(saved.v34?.lastSeen,0,0,Number.MAX_SAFE_INTEGER);
    const ok=auditBaseRestoreSave(saved);
    if(ok!==false){
      const seen=new Set();
      state.activeSlots=auditNormalizePets(activeRaw,getMaxSlots(),seen,true);
      state.inventory=auditNormalizePets(inventoryRaw,AUDIT_INVENTORY_CAP,seen,false);
      if(carryingRaw){
        let carrying=cleanBrainrot(carryingRaw);
        if(seen.has(carrying.id)) carrying={...carrying,id:uid()};
        state.player.carrying=carrying;
      }else state.player.carrying=null;
      state.player.x=auditNum(px,state.player.x,30,WORLD.w-30);
      state.player.y=auditNum(py,state.player.y,30,WORLD.h-30);
      if(auditLoadedV34Seen&&state.v34) state.v34.lastSeen=auditLoadedV34Seen;
      auditApplyV4Restore(saved);
    }
    return ok;
  };

  const auditBaseSerializeSave=serializeSave;
  serializeSave=function(){
    const seen=new Set();
    const fullActive=auditNormalizePets(state.activeSlots,getMaxSlots(),seen,true);
    const fullInventory=auditNormalizePets(state.inventory,AUDIT_INVENTORY_CAP,seen,false);
    let carrying=state.player?.carrying?cleanBrainrot(state.player.carrying):null;
    if(carrying&&seen.has(carrying.id)) carrying={...carrying,id:uid()};
    const previousV34Seen=auditNum(state.v34?.lastSeen,0,0,Number.MAX_SAFE_INTEGER);
    const data=auditBaseSerializeSave();
    state.activeSlots=fullActive; state.inventory=fullInventory; if(state.player) state.player.carrying=carrying;
    data.activeSlots=fullActive.map(p=>({...p}));
    data.playerSlots=fullActive.map(p=>({...p}));
    data.inventory=fullInventory.map(p=>({...p}));
    data.playerState={x:auditNum(state.player?.x,330,30,WORLD.w-30),y:auditNum(state.player?.y,900,30,WORLD.h-30),carrying:carrying?{...carrying}:null};
    data.savedAt=Date.now(); data.hotfix=AUDIT_LABEL;
    if(!auditOfflineConsumed&&previousV34Seen&&state.v34){
      state.v34.lastSeen=previousV34Seen;
      data.v34=data.v34||{}; data.v34.lastSeen=previousV34Seen;
    }
    if(state.v4){
      const v=state.v4; data.v4=data.v4||{};
      data.v4.heist={...(data.v4.heist||{}),active:v.heist?.active?auditClone(v.heist.active):null};
      data.v4.trade={...(data.v4.trade||{}),timer:auditNum(v.trade?.timer,0,0,9999),offer:v.trade?.offer?auditClone(v.trade.offer):null};
      data.v4.mTimers={sniper:auditNum(v.mTimers?.sniper,0,0,3600),junk:auditNum(v.mTimers?.junk,0,0,3600),turret:auditNum(v.mTimers?.turret,0,0,3600)};
      data.v4.chatTimer=auditNum(v.chat?.timer,0,0,3600);
      data.v4.snap=auditClone(v.snap||{});
    }
    return data;
  };

  /* Prefer the canonical current save. Legacy saves are migration fallback, ordered by freshness. */
  loadSave=function(){
    const tryRestore=(key,data,isLegacy=false)=>{
      try{
        if(data&&typeof data==='object'&&restoreSave(data)!==false){
          showMessage(isLegacy?'Eski kayıt bulundu ve güvenli şekilde taşındı.':'Kayıt V4.0.1 güvenlik düzeltmeleriyle yüklendi.',3);
          return true;
        }
      }catch(error){ console.warn('save candidate failed',key,error); state=defaultState(); }
      return false;
    };
    try{
      const currentRaw=localStorage.getItem(SAVE_KEY);
      if(currentRaw){
        try{ if(tryRestore(SAVE_KEY,JSON.parse(currentRaw),false)) return true; }
        catch(error){ console.warn('current save parse failed',error); state=defaultState(); }
      }
      const legacy=[];
      for(const key of LEGACY_SAVE_KEYS){
        if(key===SAVE_KEY) continue;
        try{
          const raw=localStorage.getItem(key); if(!raw) continue;
          const data=JSON.parse(raw); if(!data||typeof data!=='object') continue;
          const time=auditNum(data.savedAt??data.updatedAt??data.v341?.updatedAt,0,0,Number.MAX_SAFE_INTEGER);
          let score=0; try{ score=saveProgressScore(data); }catch(_){}
          legacy.push({key,data,time,score});
        }catch(_){}
      }
      legacy.sort((a,b)=>(b.time-a.time)||(b.score-a.score));
      for(const candidate of legacy) if(tryRestore(candidate.key,candidate.data,true)) return true;
    }catch(error){ console.warn('load save failed',error); }
    return false;
  };

  /* Validate crate affordability before older wrappers can grant progress/essence. */
  const auditBaseOpenCrate=openCrate;
  openCrate=function(kind){
    ensureV22Fields();
    const crate=CRATES[kind]||CRATES.basic, cfg=modeCfg();
    const cost={cash:Math.round((crate.cash||0)*cfg.crateCostMult),gems:crate.gems||0,cores:Math.max(0,Math.ceil((crate.cores||0)*cfg.coreReqMult)),rep:Math.max(0,Math.ceil((crate.rep||0)*cfg.coreReqMult))};
    const rankNeed=Math.max(0,(crate.minTier||1)-8);
    if(rankNeed>0&&state.hardcore.rank<rankNeed){ showMessage(`${crate.name} için Hardcore Rank ${rankNeed} lazım.`); beep('bad'); return false; }
    if(state.player.cash<cost.cash||state.player.gems<cost.gems||state.hardcore.cores<cost.cores||state.hardcore.raidRep<cost.rep){
      showMessage(`${crate.name} için ${cost.cash?'$'+shortNum(cost.cash):''}${cost.gems?' '+cost.gems+'💎':''}${cost.cores?' '+cost.cores+' core':''}${cost.rep?' '+cost.rep+' rep':''} lazım.`); beep('bad'); return false;
    }
    const before=Number(state.stats.crates)||0;
    auditBaseOpenCrate(kind);
    return (Number(state.stats.crates)||0)>before;
  };

  const auditBaseTravelToDistrict=travelToDistrict;
  travelToDistrict=function(id){
    if(state.player?.carrying){ showMessage('Pet taşırken metro kullanamazsın. Önce peti base’e bırak.',3); try{beep('bad');}catch(_){} return false; }
    return auditBaseTravelToDistrict(id);
  };

  /* Prevent game shortcuts from firing while typing and make J exclusively V4. */
  document.addEventListener('keydown',event=>{
    const target=event.target;
    const editable=target instanceof HTMLInputElement||target instanceof HTMLTextAreaElement||target?.isContentEditable;
    if(editable||!resetModalEl.classList.contains('hidden')){
      if(target===resetPhraseEl&&event.key==='Enter'){ event.preventDefault(); confirmReset(); }
      else if(target===resetPhraseEl&&event.key==='Escape'){ event.preventDefault(); closeResetModal(); }
      event.stopPropagation(); event.stopImmediatePropagation?.();
      return;
    }
    if(String(event.key||'').toLowerCase()==='j'){
      event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation?.(); openPanel('v4');
    }
  },true);

  try{
    const style=document.createElement('style'); style.id='v401AuditStyle';
    style.textContent='[data-v4="tradeForce"]{display:none!important}.v401-audit-badge{color:#7ef0c1;font-weight:1000}';
    document.head.appendChild(style);
  }catch(_){}
  function auditSetIdentity(){
    try{
      document.title='Brainrot Heist V4.0.1 Audit Hotfix';
      canvas?.setAttribute('aria-label','Brainrot Heist V4.0.1 Audit Hotfix oyun alanı');
      const eye=document.querySelector('.menuCard .eyebrow'); if(eye) eye.textContent=AUDIT_LABEL;
      const h=document.querySelector('.menuCard h1'); if(h) h.innerHTML='Brainrot Heist<br>V4.0.1';
    }catch(_){}
  }

  /* Run the legacy loop once so all one-time migrations/rewards fire, then remove per-frame DOM identity churn. */
  const auditLegacyLoop=loop;
  function auditSteadyLoop(now){
    const dt=clamp((now-lastFrame)/1000,0,.05); lastFrame=now; update(dt); draw(); requestAnimationFrame(auditSteadyLoop);
  }
  loop=function(now){
    loop=auditSteadyLoop;
    const out=auditLegacyLoop(now);
    auditOfflineConsumed=true;
    auditSetIdentity();
    setTimeout(auditSetIdentity,650);
    return out;
  };

  console.info('%cV4.0.1 AUDIT HOTFIX yüklendi','color:#7ef0c1;font-weight:bold');
})();
