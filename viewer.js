import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';

const FLOOR_FT = 26000;
const CEILING_FT = 42000;
const HEIGHT_PER_FT = 0.009;
const FLOOR_SIZE = 550;
const ROUTE_COLORS = [0x3677a8, 0x2a7e72, 0x8065aa, 0x5b72ae];
const AIRCRAFT_COLOR = new THREE.Color(0x526a80);
const EXPOSED_COLOR = new THREE.Color(0xbd483a);
const SELECTED_COLOR = new THREE.Color(0x0b669f);
const CHANGE_COLORS = new Map([
  ['none', AIRCRAFT_COLOR],
  ['altitude', new THREE.Color(0x2563b8)],
  ['speed', new THREE.Color(0x7c3ab1)],
  ['both', new THREE.Color(0x08745d)],
]);

function position(x, y, altitude = FLOOR_FT) {
  return new THREE.Vector3(x, (altitude - FLOOR_FT) * HEIGHT_PER_FT, -y);
}

function line(points, color, opacity = 1) {
  return new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({ color, opacity, transparent: opacity < 1 }),
  );
}

function lineLoop(points, color, opacity = 1) {
  const ring = line(points, color, opacity);
  return new THREE.LineLoop(ring.geometry, ring.material);
}

function circlePoints(radius, y = 0) {
  return Array.from({ length: 64 }, (_, i) => {
    const a = (i / 64) * Math.PI * 2;
    return new THREE.Vector3(radius * Math.cos(a), y, radius * Math.sin(a));
  });
}

function label(text, color, width = 56) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.font = '600 38px ui-monospace, monospace';
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 35);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map, transparent: true, depthWrite: false, depthTest: false,
  }));
  sprite.scale.set(width, width / 4, 1);
  sprite.renderOrder = 5;
  return sprite;
}

function buildGrid(scene) {
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(FLOOR_SIZE, FLOOR_SIZE),
    new THREE.MeshBasicMaterial({ color: 0xf2f7fb, side: THREE.DoubleSide }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.6;
  scene.add(floor);

  const major = [];
  const minor = [];
  const half = FLOOR_SIZE / 2;
  for (let coordinate = -half; coordinate <= half; coordinate += 25) {
    const points = coordinate % 50 === 0 ? major : minor;
    points.push(position(-half, coordinate), position(half, coordinate));
    points.push(position(coordinate, -half), position(coordinate, half));
  }
  for (const [points, color] of [[minor, 0xdfe9f1], [major, 0xcad9e7]]) {
    scene.add(new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({ color }),
    ));
  }

  const corners = [[-half, -half], [half, -half], [half, half], [-half, half]];
  const bottom = corners.map(([x, y]) => position(x, y, FLOOR_FT + 20)); // Clear the floor grid.
  const top = corners.map(([x, y]) => position(x, y, CEILING_FT));
  scene.add(lineLoop(bottom, 0x526f89, 0.98), lineLoop(top, 0x597892, 0.94));
  scene.add(new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(bottom.flatMap((point, i) => [point, top[i]])),
    new THREE.LineBasicMaterial({ color: 0x597892, opacity: 0.94, transparent: true }),
  ));

  const axes = new THREE.Group();
  const [axisX, axisY] = [-236, -156];
  const axisBase = position(axisX, axisY);
  axes.add(line([axisBase, position(axisX, axisY, CEILING_FT)], 0x819aae));
  for (const flightLevel of [FLOOR_FT / 100, 280, 320, 360, 400, CEILING_FT / 100]) {
    const altitude = flightLevel * 100;
    axes.add(line([position(axisX, axisY, altitude), position(axisX + 13, axisY, altitude)], 0x819aae));
    const tick = label(`FL${flightLevel}`, '#476178', 42);
    tick.position.copy(position(axisX - 21, axisY, altitude));
    axes.add(tick);
  }
  scene.add(axes);

  const north = label('N ↑', '#476178', 40);
  north.position.copy(position(0, half + 15));
  scene.add(north);
  return { axes, north, volumeCorners: [...bottom, ...top] };
}

function addRoutes(scene, routes) {
  const labels = new THREE.Group();
  routes.forEach(({ start, end, heading }, index) => {
    const color = ROUTE_COLORS[index % ROUTE_COLORS.length];
    const a = position(start[0], start[1]);
    const b = position(end[0], end[1]);
    const delta = b.clone().sub(a);
    const material = new THREE.MeshBasicMaterial({ color });
    const route = new THREE.Mesh(new THREE.PlaneGeometry(delta.length(), 1.35), material);
    route.position.copy(a).lerp(b, 0.5);
    route.position.y = 0.5;
    route.rotation.order = 'YXZ';
    route.rotation.x = -Math.PI / 2;
    route.rotation.y = -Math.atan2(delta.z, delta.x);
    scene.add(route);

    const head = label(`${Math.round(heading)}°`, '#405970', 42);
    head.position.copy(b).add(delta.normalize().multiplyScalar(13));
    head.position.y += 2.5;
    labels.add(head);
  });
  scene.add(labels);
  return labels;
}

function addHotspots(scene, hotspots) {
  const geometry = new THREE.SphereGeometry(1, 32, 16);
  const material = new THREE.MeshBasicMaterial({
    color: 0xe88473, opacity: 0.30, transparent: true, depthWrite: false,
  });
  for (const { id, x, y, z, r, rz } of hotspots) {
    const centre = position(x, y, z);
    const surface = new THREE.Mesh(geometry, material);
    surface.position.copy(centre);
    surface.scale.set(r, rz * HEIGHT_PER_FT, r);
    surface.renderOrder = 2;
    scene.add(surface);

    const rim = lineLoop(circlePoints(r), EXPOSED_COLOR, 0.85);
    rim.position.copy(centre);
    rim.renderOrder = 3;
    scene.add(rim);
    const meridian = lineLoop(circlePoints(1).map((p) =>
      new THREE.Vector3(p.x * r, p.z * rz * HEIGHT_PER_FT, 0)), EXPOSED_COLOR, 0.42);
    meridian.position.copy(centre);
    meridian.renderOrder = 3;
    scene.add(meridian);
    const name = label("H" + (id + 1), '#a7382d', 39);
    name.position.copy(centre);
    name.position.y += rz * HEIGHT_PER_FT + 8;
    scene.add(name);
  }
}

function surface(points, depth) {
  const shape = new THREE.Shape();
  points.forEach(([x, y], i) => i ? shape.lineTo(x, y) : shape.moveTo(x, y));
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
}

function aircraftGeometry() {
  // Model forward is -Z. Wings and tailplane are swept toward +Z.
  const fuselage = new THREE.CylinderGeometry(0.56, 0.43, 8.5, 10);
  fuselage.rotateX(-Math.PI / 2);
  const nose = new THREE.ConeGeometry(0.56, 2.3, 10);
  nose.rotateX(-Math.PI / 2).translate(0, 0, -5.4);

  const wings = surface([
    [0, 2.1], [1.1, 1.6], [5.5, -1.3], [5.7, -2.1], [1.1, -0.7],
    [0, -0.5], [-1.1, -0.7], [-5.7, -2.1], [-5.5, -1.3], [-1.1, 1.6],
  ], 0.2).rotateX(-Math.PI / 2);
  const tailplane = surface([
    [0, -2.5], [2.25, -4.0], [2.35, -4.6], [0, -4.0], [-2.35, -4.6], [-2.25, -4.0],
  ], 0.2).rotateX(-Math.PI / 2);
  const fin = surface([[-2.8, 0.25], [-4.15, 1.8], [-4.65, 1.8], [-4.3, 0.25]], 0.2)
    .rotateY(Math.PI / 2).translate(-0.1, 0, 0);

  const portEngine = new THREE.CylinderGeometry(0.34, 0.24, 1.5, 8)
    .rotateX(-Math.PI / 2).translate(-2.15, -0.2, -0.2);
  const starboardEngine = portEngine.clone().translate(4.3, 0, 0);

  const positions = [];
  const normals = [];
  for (const part of [fuselage, nose, wings, tailplane, fin, portEngine, starboardEngine]) {
    const flat = part.index ? part.toNonIndexed() : part;
    for (const v of flat.attributes.position.array) positions.push(v);
    for (const v of flat.attributes.normal.array) normals.push(v);
    if (flat !== part) flat.dispose();
    part.dispose();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.computeBoundingSphere();
  return geometry;
}

export function createViewer(container, data, onSelect) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xffffff);
  scene.add(new THREE.HemisphereLight(0xf4f9ff, 0x9cb0c3, 2.0));
  const sun = new THREE.DirectionalLight(0xfffbf4, 1.25);
  sun.position.set(100, 400, -300);
  scene.add(sun);

  const { axes, north, volumeCorners } = buildGrid(scene);
  const routeLabels = addRoutes(scene, data.routes);
  addHotspots(scene, data.hotspots);

  const capacity = Math.max(96, data.aircraft?.length ?? 0);
  const aircraft = new THREE.InstancedMesh(aircraftGeometry(), new THREE.MeshLambertMaterial({ color: 0xffffff }), capacity);
  aircraft.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  aircraft.count = 0;
  aircraft.frustumCulled = false;
  scene.add(aircraft);

  const exposureMarkers = new THREE.InstancedMesh(
    new THREE.OctahedronGeometry(2.4),
    new THREE.MeshBasicMaterial({ color: EXPOSED_COLOR }),
    capacity,
  );
  exposureMarkers.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  exposureMarkers.count = 0;
  exposureMarkers.frustumCulled = false;
  scene.add(exposureMarkers);

  const selection = new THREE.Group();
  const halo = lineLoop(circlePoints(11.3), SELECTED_COLOR, 0.98);
  halo.renderOrder = 4;
  selection.add(halo);
  const foot = lineLoop(circlePoints(4), SELECTED_COLOR, 0.63);
  selection.add(foot);
  const drop = line([new THREE.Vector3(), new THREE.Vector3()], SELECTED_COLOR, 0.65);
  drop.frustumCulled = false;
  selection.add(drop);
  selection.visible = false;
  let selectedLabel = null;
  let labelKey = null;
  scene.add(selection);

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;';
  container.appendChild(renderer.domElement);

  const camera = new THREE.OrthographicCamera(-300, 300, 300, -300, 1, 4000);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.minZoom = 0.55;
  controls.maxZoom = 6;
  controls.maxPolarAngle = Math.PI * 0.51;
  controls.zoomSpeed = 0.78;

  const marker = new THREE.Object3D();
  let active = [];
  let fitWidth = 305;
  let fitHeight = 285;
  let raf = 0;
  let disposed = false;
  let pointer = null;
  const project = new THREE.Vector3();
  const raycaster = new THREE.Raycaster();
  const screen = new THREE.Vector2();

  function redraw() {
    if (!disposed && !raf) {
      raf = requestAnimationFrame(() => {
        raf = 0;
        renderer.render(scene, camera);
      });
    }
  }

  function resize() {
    const { clientWidth: width, clientHeight: height } = container;
    if (!width || !height) return;
    const aspect = width / height;
    const halfHeight = Math.max(fitHeight, fitWidth / aspect);
    camera.left = -halfHeight * aspect;
    camera.right = halfHeight * aspect;
    camera.top = halfHeight;
    camera.bottom = -halfHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    redraw();
  }

  function setView(name) {
    if (!['orbit', 'top', 'profile'].includes(name)) return;
    camera.zoom = 1;
    controls.enableRotate = name === 'orbit';
    axes.visible = name !== 'top';
    routeLabels.visible = north.visible = name !== 'profile';
    if (name === 'top') {
      controls.target.set(0, 46, 0);
      camera.position.set(0, 746, 0.01);
    } else if (name === 'profile') {
      controls.target.set(0, 60, 0);
      camera.position.set(0, 60, 700);
    } else {
      controls.target.set(0, 42, 0);
      camera.position.set(364, 416, 521);
    }
    controls.update();
    camera.updateMatrixWorld();
    fitWidth = 305;
    fitHeight = name === 'profile' ? 225 : 285;
    for (const corner of volumeCorners) {
      project.copy(corner).applyMatrix4(camera.matrixWorldInverse);
      fitWidth = Math.max(fitWidth, Math.abs(project.x) + 28);
      fitHeight = Math.max(fitHeight, Math.abs(project.y) + 30);
    }
    resize();
    redraw();
  }

  function update(frames, selectedId) {
    const selectedKey = selectedId == null ? null : String(selectedId);
    if (selectedKey !== labelKey) {
      if (selectedLabel) {
        selection.remove(selectedLabel);
        selectedLabel.material.map.dispose();
        selectedLabel.material.dispose();
      }
      selectedLabel = selectedKey === null ? null : label("#" + selectedKey, '#0b669f', 49);
      if (selectedLabel) selection.add(selectedLabel);
      labelKey = selectedKey;
    }
    active = frames.slice(0, capacity).map((frame) => ({
      ...frame, point: position(frame.x, frame.y, frame.z),
    }));
    aircraft.count = active.length;
    let exposureCount = 0;
    selection.visible = false;
    for (const [i, frame] of active.entries()) {
      const selected = String(frame.id) === selectedKey;
      marker.position.copy(frame.point);
      marker.rotation.y = -THREE.MathUtils.degToRad(frame.heading);
      marker.scale.setScalar(selected ? 1.43 : 1.12);
      marker.updateMatrix();
      aircraft.setMatrixAt(i, marker.matrix);
      const changeColor = CHANGE_COLORS.get(frame.change);
      const legacyColor = selected ? SELECTED_COLOR : (frame.exposed ? EXPOSED_COLOR : AIRCRAFT_COLOR);
      aircraft.setColorAt(i, changeColor ?? legacyColor);
      if (changeColor && frame.exposed) {
        marker.position.set(frame.point.x + 7, frame.point.y + 5, frame.point.z + 6);
        marker.scale.setScalar(1);
        marker.updateMatrix();
        exposureMarkers.setMatrixAt(exposureCount++, marker.matrix);
      }
      if (!selected) continue;
      selection.visible = true;
      halo.position.copy(frame.point);
      halo.position.y += 0.25;
      if (selectedLabel) {
        selectedLabel.position.copy(frame.point);
        selectedLabel.position.y += 13;
      }
      foot.position.copy(frame.point);
      foot.position.y = 0.75;
      const endpoints = drop.geometry.attributes.position;
      endpoints.setXYZ(0, frame.point.x, frame.point.y, frame.point.z);
      endpoints.setXYZ(1, frame.point.x, foot.position.y, frame.point.z);
      endpoints.needsUpdate = true;
    }
    aircraft.instanceMatrix.needsUpdate = true;
    if (aircraft.instanceColor) aircraft.instanceColor.needsUpdate = true;
    exposureMarkers.count = exposureCount;
    if (exposureCount) exposureMarkers.instanceMatrix.needsUpdate = true;
    redraw();
  }

  function startPointer(event) {
    if (pointer || !event.isPrimary || event.button !== 0) {
      pointer = null;
      return;
    }
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
  }

  function trackPointer(event) {
    if (pointer?.id === event.pointerId && Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 6) {
      pointer = null;
    }
  }

  function pickPointer(event) {
    trackPointer(event);
    if (pointer?.id !== event.pointerId) return;
    pointer = null;
    const { left, top, width, height } = renderer.domElement.getBoundingClientRect();
    camera.updateMatrixWorld();
    screen.set((event.clientX - left) * 2 / width - 1, 1 - (event.clientY - top) * 2 / height);
    raycaster.setFromCamera(screen, camera);
    aircraft.computeBoundingSphere();
    const hit = raycaster.intersectObject(aircraft, false)[0];
    if (hit) {
      onSelect?.(active[hit.instanceId].id);
      return;
    }
    let closest = null;
    let bestDistance = 13;
    for (const { id, point } of active) {
      project.copy(point).project(camera);
      if (Math.abs(project.z) > 1) continue;
      const x = left + (project.x + 1) * width / 2;
      const y = top + (1 - project.y) * height / 2;
      const d = Math.hypot(event.clientX - x, event.clientY - y);
      if (d < bestDistance) {
        bestDistance = d;
        closest = id;
      }
    }
    if (closest !== null) onSelect?.(closest);
  }

  function cancelPointer() {
    pointer = null;
  }

  const canvas = renderer.domElement;
  const pointerEvents = {
    pointerdown: startPointer,
    pointermove: trackPointer,
    pointerup: pickPointer,
    pointercancel: cancelPointer,
  };
  Object.entries(pointerEvents).forEach(([name, handler]) => canvas.addEventListener(name, handler));
  controls.addEventListener('change', redraw);
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  setView('orbit');

  function dispose() {
    disposed = true;
    if (raf) cancelAnimationFrame(raf);
    observer.disconnect();
    Object.entries(pointerEvents).forEach(([name, handler]) => canvas.removeEventListener(name, handler));
    controls.removeEventListener('change', redraw);
    controls.dispose();
    const resources = new Set();
    scene.traverse(({ geometry, material }) => {
      if (geometry) resources.add(geometry);
      if (material) resources.add(material);
      if (material?.map) resources.add(material.map);
    });
    resources.forEach((resource) => resource.dispose());
    aircraft.dispose();
    exposureMarkers.dispose();
    renderer.dispose();
    canvas.remove();
  }

  function setAccessibleLabel(text) {
    renderer.domElement.setAttribute('aria-label', text);
  }

  return { update, setView, setAccessibleLabel, dispose };
}
