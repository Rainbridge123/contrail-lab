export function createPlaybackControls(aircraft,onChange){
 const settings={fleet:{space:true,hotspots:true,aircraft:true,levels:[],routes:[],routePlanes:false,paths:'none'},compare:{space:true,hotspots:true,aircraft:true,levels:[],routes:[],routePlanes:false,paths:'all'}};
 const host=document.createElement('div');host.className='playback-layers';document.querySelector('.settings-body').prepend(host);
 const levels=[33000,35000,37000];
 function render(view){
  host.hidden=view==='setup';if(host.hidden)return;
  const state=settings[view],en=document.documentElement.lang.startsWith('en'),t=(a,b)=>en?b:a;
  const checks=(key,values,unit)=>values.map(v=>`<label><input type="checkbox" data-playback="${key}" value="${v}" ${state[key].includes(v)?'checked':''}>${v.toLocaleString()}${unit}</label>`).join('');
  host.innerHTML=`<div class="environment-layer-switches">${[['space',t('航路与坐标','Routes & axes')],['aircraft',t('飞机','Aircraft')],['hotspots',t('热点','Hotspots')]].map(([key,name])=>`<label><input type="checkbox" data-visibility="${key}" ${state[key]?'checked':''}>${name}</label>`).join('')}</div><fieldset><legend>${t('初始参考高度面','Initial reference altitude planes')}</legend><div>${checks('levels',levels,' ft')}</div></fieldset><fieldset><legend>${t('竖向航路面','Vertical route planes')}</legend><div>${checks('routes',[0,45,90,135],'°')}</div></fieldset><label class="playback-paths">${t('完整轨迹','Full trajectories')}<select id="playback-paths">${(view==='fleet'?[['none',t('隐藏','Hidden')],['selected',t('所选飞机','Selected aircraft')],['all',t('全部飞机','All aircraft')]]:[['none',t('隐藏','Hidden')],['all',t('所选飞机 · 全部对照方案','Selected aircraft · All compared plans')]]).map(([v,n])=>`<option value="${v}" ${state.paths===v?'selected':''}>${n}</option>`).join('')}</select></label>`;
  host.querySelectorAll('[data-playback]').forEach(el=>el.onchange=()=>{const key=el.dataset.playback,value=Number(el.value);state[key]=el.checked?[...state[key],value]:state[key].filter(v=>v!==value);state.routePlanes=state.routes.length>0;onChange();});
  host.querySelectorAll('[data-visibility]').forEach(el=>el.onchange=()=>{state[el.dataset.visibility]=el.checked;onChange();});
  host.querySelector('select').onchange=e=>{state.paths=e.target.value;onChange();};
 }
 return {settings,render};
}
