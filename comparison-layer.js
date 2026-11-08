import * as THREE from 'three';

export function createComparisonLayer(flight, groups, hotspots, helpers) {
  const { position, line, label } = helpers;
  function compactLabel(text, color) {
    const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
    ctx.font = '500 24px sans-serif';
    canvas.width = Math.ceil(ctx.measureText(text).width) + 20; canvas.height = 40;
    ctx.font = '500 24px sans-serif'; ctx.fillStyle = color;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, canvas.width / 2, 20);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({map, transparent:true, depthTest:false, depthWrite:false, toneMapped:false}));
    sprite.scale.set(canvas.width / canvas.height * 9, 9, 1); sprite.renderOrder = 5;
    return sprite;
  }
  const object = new THREE.Group(), guides = new THREE.Group(), labels = new Map(), markers = new Map();
  const direction = new THREE.Vector3(flight.dx, 0, -flight.dy).normalize();
  const at = (s, altitude) => position(flight.x + flight.dx * s / flight.length, flight.y + flight.dy * s / flight.length, altitude);
  const heights = groups.flatMap(group => group.plan.points.map(point => point[2]));
  const bottomFt = Math.floor((Math.min(...heights) - 1000) / 2000) * 2000;
  const topFt = Math.ceil((Math.max(...heights) + 1000) / 2000) * 2000;
  const centre = at(flight.length / 2, (bottomFt + topFt) / 2);
  const fitPoints = [-48, flight.length + 40].flatMap(s => [at(s, bottomFt - 1300), at(s, topFt + 800)]);
  object.add(guides);
  for (const group of groups) {
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
    const name = compactLabel(group.label, group.color);
    name.visible = false;
    object.add(name); labels.set(group.id, name);
    const marker = new THREE.Mesh(new THREE.SphereGeometry(1.65, 12, 8), new THREE.MeshBasicMaterial({color: group.color, toneMapped: false, depthTest: false}));
    marker.renderOrder = 4; marker.visible = false; marker.userData.annotation = true;
    object.add(marker); markers.set(group.id, marker);
  }
  // Merge only the static spatial label. Timing and aircraft markers remain
  // independent when different Mach choices share an altitude profile.
  const spatialLabels = new Map();
  for (const group of groups) {
    const key = JSON.stringify(group.plan.points.map(([, s, h]) => [s, h]));
    if (!spatialLabels.has(key)) spatialLabels.set(key, {group, names: []});
    spatialLabels.get(key).names.push(group.label);
  }
  for (const {group, names} of spatialLabels.values()) {
    const text = names.join(' / ');
    const endLabel = compactLabel(text, group.color);
    const [, s, h] = group.plan.points.at(-1);
    endLabel.position.copy(at(s - 35, h)); endLabel.position.y += 7;
    endLabel.userData.fullTrajectory = true; object.add(endLabel);
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
    updateLabels(frames, trueScale) {
      const byId = new Map(frames.map(frame => [frame.id, frame]));
      for (const [id, sprite] of labels) {
        const frame = byId.get(id);
        const marker = markers.get(id);
        marker.visible = Boolean(frame) && guides.visible;
        sprite.visible = Boolean(frame);
        if (frame) {
          sprite.position.copy(position(frame.x, frame.y, frame.z));
          sprite.position.y *= verticalScale;
          marker.position.copy(sprite.position);
          sprite.position.addScaledVector(direction, 14);
          sprite.position.y += trueScale ? 7 : 11;
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
