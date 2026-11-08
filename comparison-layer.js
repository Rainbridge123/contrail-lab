import * as THREE from 'three';
import { groupSpatialPlans } from './comparison-data.js?v=spatial1';

export function createComparisonLayer(flight, groups, hotspots, helpers) {
  const { position, line, label } = helpers;
  function compactLabel(text, color) {
    const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
    const scale = 3, font = '600 13px system-ui, sans-serif';
    ctx.font = font;
    const width = Math.ceil(ctx.measureText(text).width) + 26, height = 26;
    canvas.width = width * scale; canvas.height = height * scale;
    ctx.scale(scale, scale);
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#c8d4df'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(.5,.5,width-1,height-1,5); ctx.fill(); ctx.stroke();
    ctx.fillStyle = color; ctx.fillRect(7,8,3,10);
    ctx.font = font; ctx.fillStyle = '#15334c'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(text,16,height/2);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
    map.generateMipmaps = false; map.minFilter = THREE.LinearFilter;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({map, transparent:true, depthTest:false, depthWrite:false, toneMapped:false}));
    sprite.userData.pixelSize = [width,height]; sprite.renderOrder = 6;
    return sprite;
  }
  const annotationSprites = [];
  const object = new THREE.Group(), guides = new THREE.Group(), labels = new Map(), markers = new Map();
  const direction = new THREE.Vector3(flight.dx, 0, -flight.dy).normalize();
  const at = (s, altitude) => position(flight.x + flight.dx * s / flight.length, flight.y + flight.dy * s / flight.length, altitude);
  const heights = groups.flatMap(group => group.plan.points.map(point => point[2]));
  const bottomFt = Math.floor((Math.min(...heights) - 1000) / 2000) * 2000;
  const topFt = Math.ceil((Math.max(...heights) + 1000) / 2000) * 2000;
  const centre = at(flight.length / 2, (bottomFt + topFt) / 2);
  const fitPoints = [-48, flight.length + 40].flatMap(s => [at(s, bottomFt - 1300), at(s, topFt + 800)]);
  object.add(guides);
  const spatialGroups = groupSpatialPlans(groups);
  for (const group of spatialGroups) {
    const points = group.plan.points.map(([, s, altitude]) => at(s, altitude));
    const path = new THREE.Group();
    const curve = new THREE.CurvePath();
    for (let i = 1; i < points.length; i++) {
      if (points[i].distanceToSquared(points[i - 1]) > 0)
        curve.add(new THREE.LineCurve3(points[i - 1], points[i]));
    }
    // A narrow translucent ribbon clarifies the path from above; the tube
    // stays legible edge-on. Both follow recorded coordinates without offsets.
    const side = new THREE.Vector3(-direction.z, 0, direction.x).multiplyScalar(5);
    const vertices = [];
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1].clone().add(side), b = points[i].clone().add(side);
      const c = points[i].clone().sub(side), d = points[i - 1].clone().sub(side);
      vertices.push(...a.toArray(), ...b.toArray(), ...c.toArray(), ...a.toArray(), ...c.toArray(), ...d.toArray());
    }
    const ribbonGeometry = new THREE.BufferGeometry();
    ribbonGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    path.add(new THREE.Mesh(ribbonGeometry, new THREE.MeshBasicMaterial({
      color: group.color, transparent: true, opacity: .15,
      side: THREE.DoubleSide, depthWrite: false, toneMapped: false,
    })));
    const strokeMaterial = new THREE.MeshBasicMaterial({color: group.color, toneMapped: false});
    if (group.keys.includes('B0')) {
      const length = curve.getLength();
      for (let distance = 0; distance < length; distance += 8) {
        const segment = new THREE.LineCurve3(curve.getPoint(distance / length), curve.getPoint(Math.min(distance + 5, length) / length));
        const dash = new THREE.Mesh(new THREE.TubeGeometry(segment, 2, .7, 6, false), strokeMaterial);
        dash.renderOrder = 3; path.add(dash);
      }
    } else {
      const stroke = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(100, points.length * 2), .7, 6, false), strokeMaterial);
      stroke.renderOrder = 3; path.add(stroke);
    }
    path.userData.fullTrajectory = true; object.add(path);
  }
  for (const group of groups) {
    const name = compactLabel(group.label, group.color);
    name.visible = false;
    const connector = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]),
      new THREE.LineBasicMaterial({color:group.color, transparent:true, opacity:.65, depthTest:false, depthWrite:false}));
    connector.renderOrder = 5; connector.visible = false; connector.userData.annotation = true;
    object.add(connector); name.userData.connector = connector;
    object.add(name); labels.set(group.id, name); annotationSprites.push(name);
    const marker = new THREE.Mesh(new THREE.SphereGeometry(1.65, 12, 8), new THREE.MeshBasicMaterial({color: group.color, toneMapped: false, depthTest: false}));
    marker.renderOrder = 4; marker.visible = false; marker.userData.annotation = true;
    object.add(marker); markers.set(group.id, marker);
  }
  for (let altitude = bottomFt; altitude <= topFt; altitude += 2000) {
    guides.add(line([at(0, altitude), at(flight.length, altitude)], 0xdde6ee, .8));
    const name = label((altitude / 1000) + 'k ft', '#526b81', 53);
    name.position.copy(at(-25, altitude)); guides.add(name);
  }
  for (let s = 0; s <= flight.length; s += 100) {
    guides.add(line([at(s, bottomFt), at(s, topFt)], 0xe5edf3, .7));
    const name = label(s + ' NM', '#526b81', 52);
    name.position.copy(at(s, bottomFt - 750)); guides.add(name);
  }
  // Side view shows the ellipsoid's actual intersection with this route's
  // vertical plane, not a projection of off-route hotspots onto the aircraft.
  for (const hotspot of hotspots) {
    const ux = flight.dx / flight.length, uy = flight.dy / flight.length;
    const dx = hotspot.x - flight.x, dy = hotspot.y - flight.y;
    const along = dx * ux + dy * uy, perpendicular = dx * -uy + dy * ux;
    if (Math.abs(perpendicular) >= hotspot.r) continue;
    const factor = Math.sqrt(1 - (perpendicular / hotspot.r) ** 2);
    const edge = Array.from({ length: 65 }, (_, i) => {
      const angle = i / 64 * Math.PI * 2;
      return at(along + Math.cos(angle) * hotspot.r * factor, hotspot.z + Math.sin(angle) * hotspot.rz * factor);
    });
    const centrePoint = at(along, hotspot.z);
    const triangles = [];
    for (let i = 0; i < edge.length - 1; i++) triangles.push(...centrePoint.toArray(), ...edge[i].toArray(), ...edge[i + 1].toArray());
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(triangles, 3));
    const fill = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({color: 0xe88473, transparent: true, opacity: .16, side: THREE.DoubleSide, depthWrite: false, toneMapped: false}));
    const outline=line(edge, 0xbd483a, .65);fill.userData.hotspot=outline.userData.hotspot=true;fill.renderOrder = 1; guides.add(fill, outline);
    const name = label('H' + (hotspot.id + 1), '#a7382d', 35);
    name.userData.hotspot=true;name.position.copy(at(along, hotspot.z + hotspot.rz * factor + 650)); guides.add(name);
  }
  let verticalScale = 1;
  return {
    object, guides, fitPoints, centre, direction,
    get verticalScale() { return verticalScale; },
    setProfile(profile) {
      const next = profile ? 1.5 : 1, ratio = next / verticalScale;
      if (ratio === 1) return;
      for (const sprite of annotationSprites) {
        if (sprite.userData.labelShift) sprite.position.sub(sprite.userData.labelShift);
        sprite.userData.labelShift = null;
      }
      object.traverse(child => {
        child.position.y *= ratio;
        if (child.isSprite || child.userData.annotation) return;
        const points = child.geometry?.attributes.position;
        if (points) {
          for (let i = 0; i < points.count; i++) points.setY(i, points.getY(i) * ratio);
          points.needsUpdate = true;
          child.geometry.computeBoundingSphere();
          if (child.material?.isLineDashedMaterial) child.computeLineDistances();
        }
      });
      centre.y *= ratio; fitPoints.forEach(point => { point.y *= ratio; });
      verticalScale = next;
    },
    setHotspotsVisible(visible){guides.children.forEach(child=>{if(child.userData.hotspot)child.visible=visible;});},
    setPathsVisible(visible) { object.children.forEach(child=>{if(child.userData.fullTrajectory)child.visible=visible;}); },
    layoutLabels(camera, width, height) {
      if (!width || !height) return;
      camera.updateMatrixWorld();
      const occupied = [];
      for (const sprite of annotationSprites) {
        // Restore the genuine anchor before each screen-space layout pass.
        if (sprite.userData.labelShift) sprite.position.sub(sprite.userData.labelShift);
        sprite.userData.labelShift = null;
        sprite.userData.connector.visible = false;
        if (!sprite.visible) continue;
        const anchor = sprite.position.clone();
        const projected = anchor.clone().project(camera);
        if (projected.z < -1 || projected.z > 1) continue;
        const [pixelW,pixelH] = sprite.userData.pixelSize;
        const halfW = pixelW / 2 + 4, halfH = pixelH / 2 + 4;
        const anchorX = (projected.x + 1) * width / 2, anchorY = (1-projected.y)*height/2;
        let x = Math.max(halfW+4,Math.min(width-halfW-4,anchorX+halfW+16));
        let y = Math.max(halfH+4,Math.min(height-halfH-4,anchorY-24));
        for (let attempt=0; attempt<24; attempt++) {
          if (!occupied.some(r => Math.abs(r.x-x)<r.w+halfW && Math.abs(r.y-y)<r.h+halfH)) break;
          const offset = (Math.floor(attempt/2)+1)*(halfH*2+4)*(attempt%2 ? 1:-1);
          y = Math.max(halfH+4,Math.min(height-halfH-4,anchorY-24+offset));
        }
        const adjusted = new THREE.Vector3(x*2/width-1, 1-y*2/height, projected.z).unproject(camera);
        const edgeX = new THREE.Vector3((x+pixelW/2)*2/width-1,1-y*2/height,projected.z).unproject(camera);
        const edgeY = new THREE.Vector3(x*2/width-1,1-(y+pixelH/2)*2/height,projected.z).unproject(camera);
        sprite.scale.set(adjusted.distanceTo(edgeX)*2,adjusted.distanceTo(edgeY)*2,1);
        sprite.userData.labelShift = adjusted.clone().sub(anchor);
        sprite.position.copy(adjusted);
        const targetX = Math.max(x-pixelW/2,Math.min(x+pixelW/2,anchorX));
        const targetY = Math.max(y-pixelH/2,Math.min(y+pixelH/2,anchorY));
        const target = new THREE.Vector3(targetX*2/width-1,1-targetY*2/height,projected.z).unproject(camera);
        const connector = sprite.userData.connector, attr = connector.geometry.attributes.position;
        attr.setXYZ(0,anchor.x,anchor.y,anchor.z); attr.setXYZ(1,target.x,target.y,target.z);
        attr.needsUpdate = true; connector.geometry.computeBoundingSphere(); connector.visible = true;
        occupied.push({x,y,w:halfW,h:halfH});
      }
    },
    updateLabels(frames, trueScale) {

      const byId = new Map(frames.map(frame => [frame.id, frame]));
      for (const [id, sprite] of labels) {
        const frame = byId.get(id);
        const marker = markers.get(id);
        marker.visible = Boolean(frame) && guides.visible;
        sprite.visible = Boolean(frame);
        if (frame) {
          sprite.userData.labelShift = null;
          sprite.position.copy(position(frame.x, frame.y, frame.z));
          sprite.position.y *= verticalScale;
          marker.position.copy(sprite.position);


        }
      }
    },
    dispose() {
      object.traverse(child => {
        if (!child.isSprite) child.geometry?.dispose();
        child.material?.map?.dispose(); child.material?.dispose();
      });
      object.removeFromParent();
    },
  };
}
