from __future__ import annotations

from pathlib import Path

HTML = Path('index-v4.html')
HOTFIX = Path('tools/v401_hotfix.js')

html = HTML.read_text(encoding='utf-8')
hotfix = HOTFIX.read_text(encoding='utf-8').rstrip() + '\n\n'

if 'V4.0.1 FULL AUDIT HOTFIX' in html:
    raise SystemExit('hotfix already present')

replacements: list[tuple[str, str, str]] = [
    (
        "const bonusTier = i>slotCount-4?1:i>slotCount-2?2:0;",
        "const bonusTier = i>slotCount-2?2:i>slotCount-4?1:0;",
        'rival bonus-tier ordering',
    ),
    (
        "try{ grandTick(step); tradeTick(step); managerTick(step); chatTick(step); }\n    catch(e){ console.warn('V4 tick warn',e); }",
        "for(const [name,fn] of [['grand',grandTick],['trade',tradeTick],['manager',managerTick],['chat',chatTick]]){ try{ fn(step); }catch(e){ console.warn(`V4 ${name} tick warn`,e); } }",
        'V4 system error isolation',
    ),
    (
        "const arr=o.wantScope==='active'?state.activeSlots:state.inventory;\n    const mine=removeFromArray(arr,o.wantId);\n    if(!mine){ v.trade.offer=null; v.trade.timer=rand(30,55); showMessage('Teklifteki pet artık sende değil, trade iptal.'); return; }",
        "const arr=o.wantScope==='active'?state.activeSlots:state.inventory;\n    const candidate=arr.find(p=>p.id===o.wantId);\n    if(!candidate||candidate.locked){ v.trade.offer=null; v.trade.timer=rand(30,55); showMessage(candidate?.locked?'Kilitli pet trade edilemez; teklif iptal.':'Teklifteki pet artık sende değil, trade iptal.'); return; }\n    const mine=removeFromArray(arr,o.wantId);\n    if(!mine){ v.trade.offer=null; v.trade.timer=rand(30,55); showMessage('Trade doğrulaması başarısız, teklif iptal.'); return; }",
        'trade ownership/lock revalidation',
    ),
    (
        "const total=petValue(o.give.pet)+o.give.cash;\n    if(o.fair<.7){",
        "const total=petValue(o.give.pet)+o.give.cash; const actualRatio=total/Math.max(1,o.wantVal);\n    if(actualRatio<.7){",
        'trade actual-value scam classification',
    ),
    (
        "v.trade.declined++; if(o.fair<.7){",
        "const actualRatio=(petValue(o.give.pet)+o.give.cash)/Math.max(1,o.wantVal);\n    v.trade.declined++; if(actualRatio<.7){",
        'trade decline actual-value classification',
    ),
    (
        '<button class="small good" data-v4="tradeForce">🔁 Teklif İste (test)</button>',
        '',
        'remove production trade reroll test button',
    ),
    (
        "try{ window.__BRV4={version:V4_VERSION,get state(){return state;},v4,startGrand,finishGrand,makeTradeOffer,acceptTrade,declineTrade,buyManager,tick:s=>{try{grandTick(s);tradeTick(s);managerTick(s);chatTick(s);}catch(e){console.warn(e);}},open:k=>openPanel(k)}; }catch(_){}",
        "try{ if(location.hostname==='localhost'||new URLSearchParams(location.search).has('debug')) window.__BRV4={version:V4_VERSION,get state(){return state;},v4,startGrand,finishGrand,makeTradeOffer,acceptTrade,declineTrade,buyManager,tick:s=>{try{grandTick(s);tradeTick(s);managerTick(s);chatTick(s);}catch(e){console.warn(e);}},open:k=>openPanel(k)}; }catch(_){}",
        'gate debug API',
    ),
    (
        "btnAch.title='Başarım & Günlük (J)'",
        "btnAch.title='Başarım & Günlük (A)'",
        'achievement shortcut title',
    ),
    (
        "if(e.key.toLowerCase()!=='j') return;",
        "if(e.key.toLowerCase()!=='a') return;",
        'achievement shortcut collision',
    ),
    (
        'Klavyede <b>J</b> ile bu paneli açabilirsin.',
        'Klavyede <b>A</b> ile bu paneli açabilirsin.',
        'achievement shortcut help',
    ),
]

for old, new, label in replacements:
    count = html.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly 1 match, found {count}')
    html = html.replace(old, new, 1)

init_marker = "const loaded=loadSave(); ensureTransientWorld(); ensureV25Fields(); v25PostLoadFix(); ensureV26MobileFields(); ensureV27Fields(); applyMobileComfortLayout(); refreshModeButtons(); if(!loaded) showMessage('V4.0 GRAND HEIST hazır! J ile V4 paneli. Save key sabit.',3); saveGame(); requestAnimationFrame(loop);"
if html.count(init_marker) != 1:
    raise SystemExit(f'initialization marker: expected 1 match, found {html.count(init_marker)}')
html = html.replace(init_marker, hotfix + init_marker, 1)

HTML.write_text(html, encoding='utf-8')
print(f'patched {HTML}: {len(html):,} chars')
