import * as THREE from 'three';
export function createSetupLayer(data, {position,line,label}) {
 const object=new THREE.Group(), profiles=new THREE.Group(), candidates=new THREE.Group(), entries=new THREE.Group();object.add(profiles,candidates,entries);
 const levels=new THREE.Group(),walls=new THREE.Group();object.add(levels,walls);
 function surface(points,color,opacity){
  const vertices=[];
  for(let i=0;i<points.length-2;i++)vertices.push(...points[0].toArray(),...points[i+1].toArray(),...points[i+2].toArray());
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.computeVertexNormals();
  const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color,opacity,transparent:true,side:THREE.DoubleSide,depthWrite:false,toneMapped:false}));mesh.renderOrder=1;return mesh;
 }
 function ribbon(points,direction,color,opacity=.14){
  const group=new THREE.Group();const side=new THREE.Vector3(-direction.z,0,direction.x).normalize().multiplyScalar(7);
  for(let i=0;i<points.length-1;i++)group.add(surface([points[i].clone().add(side),points[i+1].clone().add(side),points[i+1].clone().sub(side),points[i].clone().sub(side)],color,opacity));
  group.add(line(points,color,.55));return group;
 }
 const p0Levels=[...new Set(data.aircraft.flatMap(a=>{const p=a.candidates.find(c=>c.i===a.p0);return [p.points[0][2],p.points.at(-1)[2]];}))].sort((a,b)=>a-b);
 for(const [i,h] of [...new Set([...p0Levels,33000,35000,37000,...data.aircraft.flatMap(a=>a.candidates.flatMap(c=>[c.points[0][2],c.points.at(-1)[2]]))])].sort((a,b)=>a-b).entries()){
  const layer=new THREE.Group();layer.userData.altitude=h;
  const color=['#548ebd','#478f9a','#7c78ae','#a287b4'][i%4];
  const corners=[[-250,-250],[250,-250],[250,250],[-250,250]].map(([x,y])=>position(x,y,h));
  layer.add(surface(corners,color,.095),line([...corners,corners[0]],color,.28));
  const name=label((h/1000)+'k ft',color,46);name.position.copy(position(-258,-238,h));layer.add(name);levels.add(layer);
 }
 function stroke(points,color){
  const curve=new THREE.CurvePath();for(let i=1;i<points.length;i++){if(points[i].distanceToSquared(points[i-1])>0)curve.add(new THREE.LineCurve3(points[i-1],points[i]));}
  const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,Math.max(80,points.length*2),.65,5,false),new THREE.MeshBasicMaterial({color,toneMapped:false}));return mesh;
 }
 const phaseColors={cruise:'#2864a5',climb:'#168478',descent:'#8063ad'};
 for(const route of data.routes){
  const at=(s,h)=>position(route.start[0]+(route.end[0]-route.start[0])*s/500,route.start[1]+(route.end[1]-route.start[1])*s/500,h);
  const wall=new THREE.Group();wall.userData.heading=route.heading;const corners=[at(0,28000),at(500,28000),at(500,41000),at(0,41000)];wall.add(surface(corners,'#548ebd',.08),line([...corners,corners[0]],'#548ebd',.38));for(const h of [33000,35000,37000])wall.add(line([at(0,h),at(500,h)],'#548ebd',.23));walls.add(wall);
  for(const [phase,start] of [['cruise',35000],['climb',33000],['descent',37000]])profiles.add(ribbon([at(0,start),at(240,start),at(260,35000),at(500,35000)],at(500,start).sub(at(0,start)),phaseColors[phase]));
  const sign=label('24 A320', '#284f70',58);sign.position.copy(at(30,41000));profiles.add(sign);
  const gate=label('0–3600 s','#284f70',65);gate.position.copy(at(0,39000));entries.add(gate);
  entries.add(line([at(0,28000),at(0,40000)],'#2864a5',.8));
 }
 let key='';
 function clear(){candidates.traverse(o=>{if(!o.isSprite)o.geometry?.dispose();o.material?.map?.dispose();o.material?.dispose();});candidates.clear();}
 return {object,configure(options,flight){levels.visible=options.aircraft;levels.children.forEach(layer=>{layer.visible=options.levels.includes(layer.userData.altitude);});walls.visible=options.space&&options.routePlanes;walls.children.forEach(w=>w.visible=options.routes.includes(w.userData.heading));profiles.visible=options.referenceProfiles!==false&&options.aircraft;entries.visible=options.time;candidates.visible=options.candidates;
  const next=flight.id+':'+options.altitude+':'+options.candidateLevels.join(',')+':'+(options.demo?options.demoPhase+options.demoMach:'');
  if(next===key)return;key=next;clear();
  const p=flight.plans.B0;
  for(const dh of options.candidateLevels){
   const pts=p.points.map(([,s,h])=>position(flight.x+flight.dx*s/500,flight.y+flight.dy*s/500,h+dh));
   const c=({'0':'#2864a5','-2000':'#168478','-4000':'#8063ad'})[dh];const curve=ribbon(pts,pts.at(-1).clone().sub(pts[0]),c,dh===options.altitude?.20:.07);curve.add(stroke(pts,c));candidates.add(curve);
   const name=label(options.demo?(p.points[0][2]/1000)+'k → 35k ft':'Δh '+dh+' ft',c,76);name.position.copy(pts[Math.floor(pts.length*.76)]);name.position.y+=9;candidates.add(name);
  }
 },dispose(){clear();object.traverse(o=>{if(!o.isSprite)o.geometry?.dispose();o.material?.map?.dispose();o.material?.dispose();});object.removeFromParent();}};
}
