export function createSetupControls(aircraft,onChange){
 const state={space:true,time:true,aircraft:true,hotspots:true,candidates:false,altitude:0,mach:0,id:53,levels:[33000,35000,37000],candidateLevels:[0,-2000,-4000],referenceProfiles:true,routePlanes:false,routes:[0,45,90,135],demo:false,demoPhase:"climb",demoMach:.78,demoSeconds:0,demoPlaying:false,demoDuration:5000,demoRate:60,demoCandidate:null};
 if(!aircraft.some(a=>a.id===state.id))state.id=aircraft[0].id;
 const host=document.createElement('section');host.id='setup-controls';host.hidden=true;document.querySelector('#workbench-context').append(host);
 const sidebar=document.createElement('div');sidebar.id='environment-sidebar';document.querySelector('.stage').append(sidebar);
 const panel=document.createElement('aside');panel.id='setup-parameters';sidebar.append(panel);
 const layerBox=document.createElement('aside');layerBox.id='environment-layer-box';sidebar.append(layerBox);
 const layerTitle=document.createElement('header');layerBox.append(layerTitle);
 const layerPanel=document.createElement('div');layerPanel.id='setup-layer-controls';layerBox.append(layerPanel);
 const en=()=>document.documentElement.lang.startsWith('en');const t=(a,b)=>en()?b:a;
 const popup=document.createElement('aside');popup.id='action-detail-popover';popup.className='action-detail-popover';popup.setAttribute('popover','auto');popup.setAttribute('role','dialog');document.body.append(popup);
 let popupPinned=false,popupAnchor=null;
 popup.addEventListener('toggle',e=>{if(e.newState==='closed')popupPinned=false;});
 popup.addEventListener('mouseleave',()=>{if(!popupPinned)popup.hidePopover();});
 function showPopup(anchor,title,content,pin=false){
  popupAnchor=anchor;popupPinned=pin;
  popup.setAttribute('aria-label',title);
  popup.innerHTML=`<header><strong>${title}</strong><button type="button" aria-label="${t('关闭','Close')}">×</button></header><div class="action-detail-content">${content}</div>`;
  popup.querySelector('button').onclick=()=>{popupPinned=true;popupAnchor?.focus();popup.hidePopover();};
  popup.showPopover();
  const r=panel.getBoundingClientRect(),width=popup.offsetWidth,height=popup.offsetHeight;
  popup.style.left=Math.max(10,r.left-width-14)+'px';
  popup.style.top=Math.max(10,Math.min(anchor.getBoundingClientRect().top,window.innerHeight-height-10))+'px';
 }
 let matrixChoice=0;
 let active='space',demoRaf=0,demoLast=null, demoOpen=false;
 function applySectionLayers(section){
  Object.assign(state,{space:true,aircraft:false,time:false,hotspots:false,candidates:false,referenceProfiles:true,routePlanes:false,routes:[0,45,90,135],levels:[33000,35000,37000],demo:false,demoCandidate:null});
  if(section==='space')state.routePlanes=true;
  if(section==='aircraft')state.aircraft=true;
  if(section==='time')Object.assign(state,{aircraft:true,time:true,referenceProfiles:false});
  if(section==='hotspots')Object.assign(state,{aircraft:true,hotspots:true});
  if(section==='candidates')Object.assign(state,{aircraft:true,demo:true,demoSeconds:0,demoCandidate:0});
 }
 applySectionLayers(active);
 function pauseDemo(){state.demoPlaying=false;cancelAnimationFrame(demoRaf);demoLast=null;}
 function animateDemo(now){if(!state.demoPlaying)return;if(demoLast!==null)state.demoSeconds=Math.min(state.demoDuration,state.demoSeconds+Math.min((now-demoLast)/1000,.1)*state.demoRate);demoLast=now;onChange(state);if(state.demoSeconds>=state.demoDuration){pauseDemo();render();onChange(state);}else demoRaf=requestAnimationFrame(animateDemo);}

 const checks=(key,values,format)=>`<div class="setup-options">${values.map(v=>`<label><input type="checkbox" data-option="${key}" value="${v}" ${state[key].includes(v)?'checked':''}>${format(v)}</label>`).join('')}</div>`;
 const row=(label,value)=>`<tr><th scope="row">${label}</th><td>${value}</td></tr>`;
 function render(){
  popup.hidePopover();
  const layerScroll=layerPanel.scrollTop;
  layerTitle.textContent=t('图层显示','Scene layers');
  const rulesScroll=panel.querySelector(".environment-content")?.scrollTop??0,toolsScroll=panel.querySelector(".environment-control-region")?.scrollTop??0;
  const names={space:t('空间','Space'),aircraft:t('飞机','Aircraft'),time:t('时间','Time'),hotspots:t('热点','Hotspots'),candidates:t('决策空间','Actions')};
  host.innerHTML=`<nav class="environment-steps" aria-label="${t('环境讲解顺序','Environment walkthrough')}">${Object.entries(names).map(([k,v],i)=>`<button type="button" data-section="${k}" aria-pressed="${active===k}"><small>0${i+1}</small>${v}</button>`).join('')}</nav>`;
  const tables={
   space:[row(t('竖向航路面','Vertical route planes'),`<label class="setup-option"><input id="setup-route-planes" type="checkbox" ${state.routePlanes?'checked':''}>${t('显示','Show')}</label>`),row(t('选择航路','Routes to show'),checks('routes',[0,45,90,135],v=>v+'°')),row(t('航路数量','Routes'),'4'),row(t('单条长度','Route length'),'500 NM'),row(t('航向','Headings'),'0° · 45° · 90° · 135°'),row(t('交叉位置','Intersection'),t('共同中点','Shared midpoint')),row(t('延伸范围','Extent'),t('交叉点前后各 250 NM','250 NM on either side')),row(t('航路几何','Route geometry'),t('固定','Fixed'))],
   time:[row(t('入场窗口','Entry window'),'0–3,600 s'),row(t('生成规则','Sampling'),t('均匀随机 U[0, 3600)','Uniform U[0, 3600)')),row(t('方案间入场时刻','Entry across plans'),t('同一架飞机固定','Fixed per aircraft')),row(t('飞行时刻','Flight timing'),t('按空速逐段累计','Integrated from airspeed')),row(t('当前在空中','Currently airborne'),'<span id="setup-airborne">—</span>'),row(t('时间回放','Replay'),t('原始参考剖面','Original reference profiles'))],
   aircraft:[row(t('单机演示','Demo aircraft'),`<label class="setup-option"><input id="demo-enabled" type="checkbox" ${state.demo?'checked':''}>${t('启用','Enable')}</label>`),...(state.demo?[row(t('飞行剖面','Flight profile'),`<select id="demo-phase">${[['cruise',t('巡航','Cruise')],['climb',t('爬升','Climb')],['descent',t('下降','Descent')]].map(([v,n])=>`<option value="${v}" ${state.demoPhase===v?'selected':''}>${n}</option>`).join('')}</select>`),row('Mach',`<select id="demo-mach">${[.76,.78,.80].map(m=>`<option value="${m}" ${state.demoMach===m?'selected':''}>${m.toFixed(2)}</option>`).join('')}</select>`),row(t('演示进度','Demo progress'),`<button id="demo-play" type="button">${state.demoPlaying?t('暂停','Pause'):t('播放','Play')}</button> <button id="demo-reset" type="button">↺</button><input aria-label="${t('单机演示时间','Demo time')}" id="demo-progress" type="range" min="0" max="${state.demoDuration}" value="${state.demoSeconds}" step="1"><small>60× · <span id="demo-time">—</span></small>`),row(t('当前高度','Altitude'),'<span id="demo-height">—</span>'),row(t('真空速','True airspeed'),'<span id="demo-speed">—</span>'),row(t('已飞距离','Distance'),'<span id="demo-distance">—</span>')]:[]),row(t('高度参考面','Altitude planes'),checks('levels',[33000,35000,37000],v=>v.toLocaleString()+' ft')),row(t('机队','Fleet'),'96 × A320'),row(t('入场重量','Entry mass'),'60 t'),row(t('每条航路','Per route'),t('24 架 · 12 巡航 / 8 爬升 / 4 下降','24 · 12 cruise / 8 climb / 4 descent')),row(t('参考高度 · ft','Reference altitude · ft'),'35,000 → 35,000<br>33,000 → 35,000<br>37,000 → 35,000'),row(t('变高区间','Altitude transition'),'240–260 NM'),row(t('参考 Mach','Reference Mach'),'0.76 / 0.78 / 0.80'),row(t('随机项','Randomized'),t('类别顺序打乱；Mach 等概率抽取','Shuffled phase order; equal-probability Mach'))],
   hotspots:[row(t('数量 / 形状','Count / shape'),t('4 个静态椭球','4 static ellipsoids')),row(t('水平半轴','Horizontal radius'),'20 NM'),row(t('垂直半轴','Vertical radius'),'500 ft'),row(t('水平位置','Horizontal position'),t('x、y 各自均匀抽取 ±100 NM','x, y independently uniform ±100 NM')),row(t('基准高度','Anchor altitude'),t('随机飞机的 P₀ 起始或结束高度','Random aircraft’s P₀ start or end altitude')),row(t('高度偏移概率','Altitude offset probability'),'0 ft <b>50%</b><br>+1,000 ft <b>25%</b><br>−1,000 ft <b>25%</b>')],
   candidates:[row(t('飞机','Aircraft'),`<select id="setup-aircraft" aria-label="${t('候选飞机','Candidate aircraft')}">${aircraft.map(a=>`<option value="${a.id}" ${a.id===state.id?'selected':''}>#${a.id} · ${a.route.heading}°</option>`).join('')}</select>`),row(t('显示轨迹 Δh','Visible paths Δh'),checks('candidateLevels',[0,-2000,-4000],v=>v.toLocaleString()+' ft')),row(t('P₀ 搜索','P₀ search'),t('7 档 Mach × 7 档高度；仅取物理可行解','7 Mach × 7 altitude offsets; physically feasible only')),row(t('最小化目标','Minimize'),'0.51 × '+t('燃油 kg','fuel kg')+'<br>+ 0.75 × '+t('时间 s','time s')),row(t('候选组合','Candidates'),'3 Mach × 3 '+t('高度 = 9 条','altitudes = 9')),row('Δh',`<select aria-label="${t('高度偏移','Altitude offset')}" id="setup-altitude">${[0,-2000,-4000].map(h=>`<option value="${h}" ${h===state.altitude?'selected':''}>${h.toLocaleString()} ft</option>`).join('')}</select>`),row('ΔMach',`<select aria-label="Mach offset" id="setup-mach">${[0,-.03,-.06].map(m=>`<option value="${m}" ${m===state.mach?'selected':''}>${m.toFixed(2)}</option>`).join('')}</select>`),row(t('所选 Mach','Selected Mach'),'<span id="setup-selected-mach">—</span>'),row(t('所选高度 · ft','Selected altitude · ft'),'<span id="setup-selected-altitude">—</span>'),row(t('性能环境','Performance'),'OpenAP · ISA · '+t('无风','No wind'))]
  };
  const demoRows=tables.aircraft.slice(0,1+(state.demo?6:0));
  const layerRows={space:tables.space.slice(0,2),aircraft:[tables.aircraft[1+(state.demo?6:0)]],time:[tables.time[4],tables.time[5]],hotspots:[],candidates:[tables.candidates[0],tables.candidates[1],...tables.candidates.slice(5,9)]};
  tables.space=tables.space.slice(2);
  tables.aircraft=tables.aircraft.slice(2+(state.demo?6:0));
  tables.aircraft[3]=row(t('三种参考剖面','Reference profiles'),t('巡航','Cruise')+' · 35k → 35k ft<br>'+t('爬升','Climb')+' · 33k → 35k ft<br>'+t('下降','Descent')+' · 37k → 35k ft');
  tables.time=[...tables.time.slice(0,4),row(t('结束时间','Exit time'),t('可超过 3,600 s 入场窗口','May extend beyond the 3,600 s entry window'))];
  tables.hotspots.splice(3,0,row(t('总厚度','Total thickness'),'1,000 ft'));
  tables.candidates=[row(t('保持固定','Held fixed'),t('横向航路、入场时刻','Lateral route and entry time')),tables.candidates[2],tables.candidates[3],row(t('高度偏移 Δh','Altitude offsets'),'0 / −2,000 / −4,000 ft'),row(t('Mach 偏移','Mach offsets'),'0 / −0.03 / −0.06'),tables.candidates[4],tables.candidates[9]];
  const questions={space:t('飞机在哪里飞？','Where do aircraft fly?'),aircraft:t('空域里有什么交通？','What traffic occupies the airspace?'),time:t('飞机什么时候进入？','When do aircraft enter?'),hotspots:t('飞机需要避开什么？','What should aircraft avoid?'),candidates:t('飞机能够怎样调整？','What can aircraft change?')};
  const notes={space:t('四条航路共用一个交叉点','Four routes share one intersection'),aircraft:t('参考高度 ≠ P₀ 或候选的全部高度','Reference levels ≠ all P₀ or candidate altitudes'),time:t('原始参考剖面 · 参考 Mach · ISA / 无风','Original reference profiles · Reference Mach · ISA / No wind'),hotspots:t('先计算 P₀，再抽取热点中心高度','P₀ is computed before hotspot altitude sampling'),candidates:t('同高度的 Mach 候选空间重合，差异在飞行时间','Mach variants at one altitude share a path but differ in timing')};
  const layerNames={space:t('航路与坐标','Routes & axes'),aircraft:t('飞机与高度面','Aircraft & planes'),time:t('入场时间回放','Entry-time replay'),hotspots:t('热点','Hotspots')};
  panel.innerHTML=`<header><span>${active==='candidates'?t('决策空间','ACTION SPACE'):t('标准环境设置','ENVIRONMENT SETTINGS')}</span><small>${questions[active]}</small></header><div class="setup-table-wrap environment-content"><section class="environment-rules"><h3>${active==='candidates'?t('参考方案与候选生成','Reference plan & candidate generation'):t('固定设定与生成规则','Settings & generation rules')}</h3><table><tbody>${tables[active].join('')}</tbody></table><p class="environment-note">${notes[active]}</p></section></div><div class="environment-control-region">${active==='aircraft'?`<details class="environment-tools" id="environment-demo" ${demoOpen||state.demo?'open':''}><summary>${t('单机演示','Demo aircraft')}</summary><table><tbody>${demoRows.join('')}</tbody></table><p class="environment-note">${t('参考剖面 · ISA / 无风 · 60× 播放','Reference profile · ISA / No wind · 60× playback')}</p></details>`:''}</div><footer>${t('01 空域 → 02 机队 → 03 入场 → 04 热点 → 05 动作','01 Airspace → 02 Fleet → 03 Entry → 04 Hotspots → 05 Actions')}</footer>`;
  sidebar.dataset.section=active;
  if(active==='candidates') {
    const rules=panel.querySelector('.environment-rules');
    const selectedFlight=aircraft.find(a=>a.id===state.id);
    const candidateFor=id=>selectedFlight.candidates.find(c=>c.i===8-id&&c.valid!==false);
    if(state.demoCandidate!==null&&!candidateFor(state.demoCandidate))state.demoCandidate=0;
    matrixChoice=state.demoCandidate??matrixChoice;
    // Presentation P0..P8 labels encode offsets, not the generator's raw indices.
    const columns=[{dm:-.06,base:6},{dm:-.03,base:3},{dm:0,base:0}];
    const matrix=`<section class="action-matrix" aria-label="${t('相对 P₀ 的候选组合','Candidate combinations relative to P₀')}">
      <div class="matrix-heading">${t('9 种候选组合','9 candidate combinations')}<button type="button" class="matrix-info" aria-label="${t('生成规则与说明','Generation rules and notes')}">ⓘ</button></div>
      <div class="matrix-grid"><span></span>${columns.map(c=>`<span class="matrix-axis">${c.dm===0?'0':c.dm.toFixed(2).replace('-','−')}</span>`).join('')}
      ${[0,-2000,-4000].map((dh,rowIndex)=>`<span class="matrix-axis">${dh===0?'0 ft':dh.toLocaleString().replace('-','−')+' ft'}</span>${columns.map(c=>{const id=c.base+rowIndex;return `<button type="button" class="matrix-cell ${id===0?'matrix-origin':''}" data-candidate="${id}" ${!candidateFor(id)?`disabled title="${t('不可行候选','Infeasible candidate')}"`:""} aria-pressed="${id===matrixChoice}" aria-label="P${id}: Δh ${dh} ft, ΔMach ${c.dm}">P${id}${id===0?`<small>${t('起始方案','Start plan')}</small>`:''}</button>`;}).join('')}`).join('')}</div>
      <div class="matrix-axis-caption">${t('横轴 ΔMach · 纵轴 Δh（相对 P₀）','Columns: ΔMach · Rows: Δh from P₀')}</div>
    </section>`;
    rules.querySelector('h3').remove();
    rules.insertAdjacentHTML('afterbegin',matrix);
    const table=rules.querySelector('table');
    const rulesHTML=table.outerHTML+`<p>${t('组合示意；候选需通过性能可行性检查。','Combination diagram; candidates must pass performance feasibility checks.')}</p><p>${notes.candidates}</p>`;
    table.remove();rules.querySelector('.environment-note').remove();
    const info=rules.querySelector('.matrix-info');
    info.onclick=()=>showPopup(info,t('生成规则','Generation rules'),rulesHTML,true);
    function candidateDetails(button,pin){
      const id=Number(button.dataset.candidate),row=id%3,dm=-Math.floor(id/3)*.03,dh=-row*2000;
      if(id===0){
        showPopup(button,t('P₀ · 起始方案如何生成','P₀ · How the start plan is chosen'),`<ol class="p0-steps"><li>${t('以该飞机的参考 Mach 和高度剖面为起点。','Start from the aircraft’s reference Mach and altitude profile.')}</li><li>${t('搜索 7 档 Mach × 7 档高度偏移，保留物理可行组合。','Search 7 Mach settings × 7 altitude offsets; retain physically feasible combinations.')}</li><li>${t('选择燃油与时间加权成本最低的方案。','Choose the plan with the lowest weighted fuel and time cost.')}</li></ol><div class="p0-objective">min (0.51 × ${t('燃油 kg','fuel kg')}<br>+ 0.75 × ${t('时间 s','time s')})</div><p>${t('横向航路、入场时刻固定。再相对 P₀ 生成矩阵中的 9 种组合。','Lateral route and entry time stay fixed. The 9 matrix combinations are then defined relative to P₀.')}</p>`,pin);return;
      }
      showPopup(button,`P${id}`,`<dl><dt>${t('高度偏移','Altitude offset')}</dt><dd>${dh.toLocaleString()} ft</dd><dt>${t('Mach 偏移','Mach offset')}</dt><dd>${dm.toFixed(2)}</dd></dl><p>${t('相对 P₀ · 横向航路与入场时刻固定','Relative to P₀ · Lateral route and entry time fixed')}</p>`,pin);
    }
    rules.querySelectorAll('[data-candidate]').forEach(button=>{
      button.onmouseenter=()=>{if(!popupPinned)candidateDetails(button,false);};
      button.onfocus=()=>{if(!popupPinned)candidateDetails(button,false);};
      button.onmouseleave=e=>{if(!popupPinned&&!popup.contains(e.relatedTarget))popup.hidePopover();};
      button.onblur=e=>{if(!popupPinned&&!popup.contains(e.relatedTarget))popup.hidePopover();};
      button.onclick=()=>{
        pauseDemo();matrixChoice=Number(button.dataset.candidate);state.demoCandidate=matrixChoice;
        state.demo=true;state.aircraft=true;state.referenceProfiles=true;state.time=false;state.demoSeconds=0;
        render();onChange(state);state.demoPlaying=true;demoLast=null;demoRaf=requestAnimationFrame(animateDemo);render();
      };
    });

  }
  const children={space:`<table><tbody>${[layerRows.space[0],...(state.routePlanes?[layerRows.space[1]]:[])].join('')}</tbody></table>`,aircraft:`<label class="profile-path-toggle"><input id="setup-reference-paths" type="checkbox" ${state.referenceProfiles?'checked':''}>${state.demo?(state.demoCandidate!==null?t('完整候选轨迹','Full candidate trajectory'):t('完整参考轨迹','Full reference trajectory')):t('参考轨迹带','Reference trajectory ribbons')}</label><div class="layer-child-caption">${t('初始高度面','Initial altitude planes')}</div>${checks('levels',[33000,35000,37000],v=>v.toLocaleString()+' ft')}`,candidates:`<table><tbody>${layerRows.candidates.join('')}</tbody></table>`};
  layerPanel.innerHTML=Object.entries(layerNames).map(([k,v])=>`<section class="layer-group"><label class="layer-parent"><input type="checkbox" data-layer="${k}" ${state[k]?'checked':''}>${v}</label>${children[k]&&state[k]?`<div class="layer-children">${children[k]}</div>`:''}</section>`).join('');
  layerPanel.scrollTop=layerScroll;
  panel.querySelector('.environment-control-region').replaceChildren();
  host.insertAdjacentHTML('afterbegin',`<div class="demo-launchbar"><div class="demo-mode-switch"><button data-demo-mode="overview" aria-pressed="${!state.demo}">${t('整体场景','Scene overview')}</button><button data-demo-mode="single" aria-pressed="${state.demo}">${t('单机演示','Single-aircraft demo')}</button></div>${state.demo?`<label>${t('剖面','Profile')} <select id="demo-phase">${[['cruise',t('巡航','Cruise')],['climb',t('爬升','Climb')],['descent',t('下降','Descent')]].map(([v,n])=>`<option value="${v}" ${state.demoPhase===v?'selected':''}>${n}</option>`).join('')}</select></label><label>Mach <select id="demo-mach">${[.76,.78,.80].map(m=>`<option value="${m}" ${state.demoMach===m?'selected':''}>${m.toFixed(2)}</option>`).join('')}</select></label><button id="demo-play">${state.demoPlaying?t('暂停','Pause'):t('播放','Play')}</button><button id="demo-reset">${t('重播','Restart')}</button><div class="demo-live-values"><span id="demo-height">—</span><span id="demo-speed">—</span><span id="demo-distance">—</span></div><label class="demo-scrubber"><span id="demo-time">—</span><input aria-label="${t('单机演示时间','Demo time')}" id="demo-progress" type="range" min="0" max="${state.demoDuration}" value="${state.demoSeconds}" step="1"><select id="demo-rate" aria-label="${t('播放倍率','Playback speed')}">${[1,10,30,60,120,300].map(rate=>`<option value="${rate}" ${rate===state.demoRate?'selected':''}>${rate}×</option>`).join('')}</select></label>`:''}</div>`);
  if(state.demo&&state.demoCandidate!==null){
    const flight=aircraft.find(a=>a.id===state.id),candidate=flight.candidates.find(c=>c.i===8-state.demoCandidate);
    host.querySelector('#demo-phase')?.closest('label').remove();host.querySelector('#demo-mach')?.closest('label').remove();
    const badge=document.createElement('span');badge.className='action-demo-badge';badge.textContent=`P${state.demoCandidate} · Mach ${candidate.mach.toFixed(2)} · ${t('相对 P₀','from P₀')}`;
    host.querySelector('#demo-play').before(badge);
  }
  host.querySelectorAll('[data-demo-mode]').forEach(button=>button.onclick=()=>{pauseDemo();if(button.dataset.demoMode==='single'){active='aircraft';applySectionLayers(active);state.demo=true;state.demoSeconds=0;}else{applySectionLayers(active);state.demo=false;}render();onChange(state);});
  panel.querySelector('.environment-content').scrollTop=rulesScroll;panel.querySelector('.environment-control-region').scrollTop=toolsScroll;
  const demoToggle=host.querySelector('#demo-enabled');if(demoToggle)demoToggle.onchange=()=>{pauseDemo();state.demo=demoToggle.checked;state.demoSeconds=0;render();onChange(state);};
  for(const [id,key] of [['demo-phase','demoPhase'],['demo-mach','demoMach']]){const el=host.querySelector('#'+id);if(el)el.onchange=()=>{pauseDemo();state[key]=key==='demoMach'?Number(el.value):el.value;state.demoSeconds=0;render();onChange(state);};}
  const rate=host.querySelector('#demo-rate');if(rate)rate.onchange=()=>{state.demoRate=Number(rate.value);};
  const play=host.querySelector('#demo-play');if(play)play.onclick=()=>{if(state.demoPlaying)pauseDemo();else {if(state.demoSeconds>=state.demoDuration)state.demoSeconds=0;state.demoPlaying=true;demoLast=null;demoRaf=requestAnimationFrame(animateDemo);}render();onChange(state);};
  const reset=host.querySelector('#demo-reset');if(reset)reset.onclick=()=>{pauseDemo();state.demoSeconds=0;render();onChange(state);};
  const progress=host.querySelector('#demo-progress');if(progress)progress.oninput=()=>{pauseDemo();state.demoSeconds=Number(progress.value);host.querySelector('#demo-play').textContent=t('播放','Play');onChange(state);};
  layerPanel.querySelectorAll('[data-option]').forEach(el=>el.onchange=()=>{const key=el.dataset.option,value=Number(el.value);state[key]=el.checked?[...state[key],value]:state[key].filter(v=>v!==value);onChange(state);});
  const referencePaths=layerPanel.querySelector('#setup-reference-paths');if(referencePaths)referencePaths.onchange=()=>{state.referenceProfiles=referencePaths.checked;onChange(state);};
  const wall=layerPanel.querySelector('#setup-route-planes');if(wall)wall.onchange=()=>{state.routePlanes=wall.checked;render();onChange(state);};
  host.querySelectorAll('[data-section]').forEach(el=>el.onclick=()=>{pauseDemo();panel.querySelector('.environment-content').scrollTop=0;panel.querySelector('.environment-control-region').scrollTop=0;active=el.dataset.section;applySectionLayers(active);render();onChange(state);});
  layerPanel.querySelectorAll('[data-layer]').forEach(el=>el.onchange=()=>{state[el.dataset.layer]=el.checked;if((el.dataset.layer==='candidates'&&el.checked)||(el.dataset.layer==='aircraft'&&!el.checked)){pauseDemo();state.demo=false;}if(el.dataset.layer==='time'&&el.checked)state.aircraft=true;if(el.dataset.layer==='aircraft'&&!el.checked)state.time=false;render();onChange(state);});
  for(const [id,key] of [['setup-aircraft','id'],['setup-altitude','altitude'],['setup-mach','mach']]){const el=layerPanel.querySelector('#'+id);if(el)el.onchange=e=>{state[key]=Number(e.target.value);onChange(state);};}
 }
 render();return {state,host,render,pauseDemo};
}
