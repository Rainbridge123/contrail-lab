const host = document.createElement('section'); host.id = 'scene-demo'; host.hidden = true;
document.querySelector('.intro').after(host);
const trigger = document.createElement('button'); trigger.id = 'demo-view'; trigger.type = 'button'; trigger.setAttribute('aria-pressed','false');
document.querySelector('.view-switch').append(trigger);
let data, step = 0, timer = null, offset = [0,0];
const en = () => document.documentElement.lang.startsWith('en');
const t = (zh,eng) => en() ? eng : zh;
const titles = () => t(['空间','时间','飞机','热点','候选轨迹'],['Space','Time','Aircraft','Hotspots','Candidates']);
const colors = ['#2864a5','#168478','#8063ad','#ad8246'];
const txt = (x,y,s,c='#526b81',size=13) => `<text x="${x}" y="${y}" fill="${c}" font-size="${size}">${s}</text>`;
const line = (x,y,X,Y,c='#dce5ed',w=1,dash='') => `<line x1="${x}" y1="${y}" x2="${X}" y2="${Y}" stroke="${c}" stroke-width="${w}" stroke-dasharray="${dash}"/>`;
const dot = (x,y,r,c) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`;
const tag = s => `<span class="detail-tag">${s}</span>`;
function map(hotspots=false) {
 let out='';
 for(let n=-250;n<=250;n+=50){out+=line(380+n*.75,40,380+n*.75,430)+line(170,235+n*.75,590,235+n*.75);}
 data.routes.forEach((r,i)=>{const [x,y]=r.start,[X,Y]=r.end;out+=line(380+x*.75,235-y*.75,380+X*.75,235-Y*.75,colors[i],2.4)+txt(390+X*.8,235-Y*.8,r.heading+'°',colors[i]);});
 out+=dot(380,235,5,'#193b59')+(hotspots?'':txt(390,253,'O (0, 0)'));
 if(hotspots){out+=`<rect x="305" y="160" width="150" height="150" fill="#bc6256" fill-opacity=".035" stroke="#bc6256" stroke-dasharray="4 5"/>`;data.hotspots.forEach(h=>{const x=380+h.x*.75,y=235-h.y*.75;out+=`<circle cx="${x}" cy="${y}" r="15" fill="#e88473" fill-opacity=".22" stroke="#bc6256"/>`+txt(x+19,y,`H${h.id+1}`,'#a34f43',12);});out+=txt(200,460,t('俯视 · 圆为椭球水平截面','Top view · Horizontal ellipsoid sections'));}
 else out+=txt(225,460,'250 NM ← O → 250 NM');
 return out;
}
function timeline(){let s='';data.routes.forEach((r,i)=>{let y=100+i*80;s+=txt(35,y+5,r.heading+'°',colors[i])+line(110,y,690,y);data.aircraft.filter(a=>a.route===r.id).forEach(a=>{s+=`<circle cx="${110+a.entry/3600*580}" cy="${y}" r="4" fill="${colors[i]}"><title>#${a.id} · ${a.entry.toFixed(1)} s</title></circle>`;});});s+=txt(100,420,'0 s')+txt(345,420,'1,800 s')+txt(635,420,'3,600 s');return s+txt(110,465,t('每个圆点是一架飞机的实际入场时刻','Each dot is a recorded aircraft entry time'));}
function profiles(){let s='';['cruise','climb','descent'].forEach((phase,i)=>{let y=110+i*120;const starts=[35000,33000,37000],delta=(starts[i]-35000)/2000*28;s+=txt(30,y,t(['巡航 · 12 / 航路','爬升 · 8 / 航路','下降 · 4 / 航路'][i],['Cruise · 12 / route','Climb · 8 / route','Descent · 4 / route'][i]),colors[i]);s+=`<path d="M220 ${y-delta} H450.4 L469.6 ${y} H700" fill="none" stroke="${colors[i]}" stroke-width="3"/>`+txt(225,y-delta-12,(starts[i]/1000)+'k ft')+txt(640,y-12,'35k ft');});return s+line(450.4,55,450.4,405,'#a9bac9',1,'4 4')+line(469.6,55,469.6,405,'#a9bac9',1,'4 4')+txt(392,450,'240–260 NM')+txt(220,480,t('参考高度剖面 · 尚未进行 P₀ 优化','Reference profiles · Before P₀ optimization'));}
function candidates(){const a=data.aircraft.find(a=>a.id===53), p=a.candidates.find(c=>c.i===a.p0);let s='';
 const y=h=>370-(h-27000)/1000*24;
 for(let h=28000;h<=36000;h+=2000)s+=line(100,y(h),690,y(h))+txt(22,y(h)+4,h/1000+'k ft');
 const path=dh=>`M100 ${y(p.points[0][2]+dh)} H383 L407 ${y(p.points.at(-1)[2]+dh)} H690`;
 s+=`<path d="${path(0)}" fill="none" stroke="#8997a6" stroke-width="2" stroke-dasharray="6 5"/><path d="${path(offset[1])}" fill="none" stroke="#2864a5" stroke-width="3"/>`;
 s+=txt(100,65,t('飞机 #53 · 高度剖面示意','Aircraft #53 · Altitude profile schematic'),'#193b59',17)+txt(100,435,`Mach ${(p.mach+offset[0]).toFixed(2)} · Δh ${offset[1].toLocaleString()} ft`,'#2864a5',18)+txt(100,472,t('横向航路与入场时刻保持固定','Lateral route and entry time stay fixed'));
 return s;
}
function copy(){return [
 [t('四条航路，一个交叉点','Four routes. One crossing.'),['4 × 500 NM','0° · 45° · 90° · 135°'],t('航路几何固定；更换 seed 不改变位置、长度或方向。','Route geometry stays fixed across seeds.'),t('共同中点 O；交叉点前后各 250 NM。','Shared midpoint O; 250 NM on either side.'),'scenario.py · _routes'],
 [t('先抽入场时刻，再计算飞行时序','Sample entry. Compute the journey.'),['U[0, 3,600) s',t('同机跨方案固定','Fixed across plans')],t('每架飞机独立均匀抽样；图中为 seed 10000 的 96 个实际入场时刻。','Independent uniform draws; these are the 96 recorded entries for seed 10000.'),t('Mach + 高度 → 真空速 → 逐段累计时间。离场可晚于 3,600 s。','Mach + altitude → true airspeed → segment times. Exit can be later than 3,600 s.'),'scenario.py · sample_scenario'],
 [t('固定机队组成，随机排列','Fixed fleet mix. Shuffled order.'),['96 × A320','60,000 kg',t('24 架 / 航路','24 / route')],t('每条航路：12 巡航 + 8 爬升 + 4 下降；类别排列随机打乱。','Per route: 12 cruise + 8 climb + 4 descent; phase order is shuffled.'),t('参考 Mach：0.76 / 0.78 / 0.80，等概率抽取。参考剖面在 240–260 NM 线性变高。','Reference Mach: 0.76 / 0.78 / 0.80, equally likely. Altitude ramps linearly over 240–260 NM.'),'scenario.py · sample_scenario'],
 [t('热点围绕 P₀ 高度生成','Hotspots follow P₀ altitude levels.'),[t('4 个静态椭球','4 static ellipsoids'),'rₕ 20 NM','rᵥ 500 ft'],t('x、y 独立抽取 U[−100, +100] NM。随机选飞机，再随机选其 P₀ 起始或结束高度。','x and y drawn independently from U[−100, +100] NM. Sample an aircraft, then its P₀ start or end altitude.'),t('50% 同高度 · 25% +1,000 ft · 25% −1,000 ft。三维相交或相切均计命中。','50% same level · 25% +1,000 ft · 25% −1,000 ft. 3D intersection or tangency counts as a hit.'),'hotspots.py · p0_level_hotspots'],
 [t('先求 P₀，再展开九条候选','Optimize P₀. Expand nine candidates.'),['7 × 7 → P₀ → 3 × 3','OpenAP · ISA',t('无风','No wind')],t('参考剖面上搜索 7 档 Mach × 7 档高度偏移，从可行组合选择 0.51 × 燃油 kg + 0.75 × 时间 s 最低者。','Search 7 Mach × 7 altitude offsets around the reference; minimize 0.51 × fuel kg + 0.75 × time s among feasible combinations.'),t('候选逐条评估燃油、用时、物理可行性与热点命中。点击网格查看高度与 Mach 组合。','Evaluate fuel, time, feasibility and hotspot exposure per candidate. Select a grid cell to inspect the combination.'),'centre.py · cost_optimal_centres / grid_offsets']
 ][step];}
function render(){if(document.body.dataset.demo==='true')document.querySelectorAll('button[data-view]').forEach(b=>b.setAttribute('aria-pressed','false'));trigger.textContent=t('场景构建','Scene setup');if(!data)return;const c=copy();
 host.innerHTML=`<div class="demo-top"><span class="demo-kicker">V5 / ${t('场景构建','SCENE SETUP')}</span><div><button id="demo-auto">${timer?t('暂停','Pause'):t('自动演示','Auto demo')}</button><button id="demo-prev" ${step===0?'disabled':''}>←</button><button id="demo-next" ${step===4?'disabled':''}>→</button></div></div><nav class="demo-steps" aria-label="${t('演示步骤','Demo steps')}">${titles().map((x,i)=>`<button data-step="${i}" aria-current="${step===i?'step':'false'}"><small>0${i+1}</small>${x}</button>`).join('')}</nav><div class="demo-layout"><div class="demo-figure"><svg viewBox="${step===0||step===3?'130 0 530 510':'0 0 760 510'}" role="img" aria-label="${c[0]}">${[()=>map(),timeline,profiles,()=>map(true),candidates][step]()}</svg>${step===3?`<div class="demo-hotspot-levels">${data.hotspots.map(h=>`<span>H${h.id+1} <b>${h.z.toLocaleString()} ft</b></span>`).join('')}</div>`:''}<div class="demo-figure-caption">${step===1||step===3?'SEED 10000 · '+t('实际场景数据','RECORDED SCENE'):t('生成规则示意','GENERATION RULE SCHEMATIC')}</div></div><aside class="demo-copy"><span class="demo-kicker">0${step+1} / 05</span><h2>${c[0]}</h2><div class="demo-tags">${c[1].map(tag).join('')}</div><h3>${t('固定与采样','Fixed & sampled')}</h3><p>${c[2]}</p><p>${c[3]}</p>${step===4?`<div class="demo-grid">${[-.06,-.03,0].flatMap(dm=>[-4000,-2000,0].map(dh=>`<button data-dm="${dm}" data-dh="${dh}" aria-pressed="${offset[0]===dm&&offset[1]===dh}"><b>${dm===0&&dh===0?'P₀':`ΔM ${dm.toFixed(2)}`}</b><small>${dh.toLocaleString()} ft</small></button>`)).join('')}</div><p class="demo-gate">${t('通过条件：P₀ 有效，且每机至少有一条有效无热点候选；否则重新采样，最多 200 次。','Acceptance: valid P₀ and at least one valid hotspot-free candidate per aircraft. Otherwise resample, up to 200 attempts.')}</p>`:''}<code>${c[4]}</code></aside></div>`;
 host.querySelectorAll('[data-step]').forEach(b=>b.onclick=()=>{stop();step=+b.dataset.step;render();});host.querySelector('#demo-prev').onclick=()=>{stop();step--;render();};host.querySelector('#demo-next').onclick=()=>{stop();step++;render();};host.querySelector('#demo-auto').onclick=()=>{if(timer){stop();render();}else{if(step===4)step=0;timer=setInterval(()=>{if(step<4)step++;else stop();render();},8000);render();}};
 host.querySelectorAll('[data-dm]').forEach(b=>b.onclick=()=>{offset=[+b.dataset.dm,+b.dataset.dh];render();});
}
function stop(){clearInterval(timer);timer=null;}
trigger.onclick=async()=>{document.querySelector('#play[aria-label="Pause"],#play[aria-label="暂停"]')?.click();document.body.dataset.demo='true';host.hidden=false;document.querySelectorAll('[data-view]').forEach(b=>{if(b.tagName==='BUTTON')b.setAttribute('aria-pressed','false');});trigger.setAttribute('aria-pressed','true');if(!data){host.textContent=t('载入场景…','Loading scene…');try{const response=await fetch('./scene-data.json');if(!response.ok)throw Error();data=await response.json();}catch{host.textContent=t('场景载入失败，请重新打开。','Could not load scene. Please reopen.');return;}}render();};
document.querySelectorAll('button[data-view]').forEach(b=>b.addEventListener('click',()=>{stop();delete document.body.dataset.demo;host.hidden=true;trigger.setAttribute('aria-pressed','false');},true));
new MutationObserver(()=>render()).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
document.addEventListener('visibilitychange',()=>{if(document.hidden){stop();render();}});render();
