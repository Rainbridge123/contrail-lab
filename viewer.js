import { createSetupLayer } from './setup-layer.js?v=actionplay1';
import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';
import { createAircraftParts, aircraftMaterial } from './aircraft-model.js?v=pptaircraft1';
import { createComparisonLayer } from './comparison-layer.js?v=speed1';

const FLOOR_FT = 26000;
const CEILING_FT = 42000;
const HEIGHT_PER_FT = 0.009;
const METRES_PER_NM = 1852;
const DISPLAY_UNITS_PER_METRE = .18;
const FLOOR_SIZE = 550;
const ROUTE_COLORS = [0x3677a8, 0x2a7e72, 0x8065aa, 0x5b72ae];
const AIRCRAFT_COLOR = new THREE.Color(0x526a80);
const EXPOSED_COLOR = new THREE.Color(0xbd483a);
const SELECTED_COLOR = new THREE.Color(0x0b669f);
const WHITE = new THREE.Color(0xffffff);
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
    new THREE.LineBasicMaterial({ toneMapped: false, color, opacity, transparent: opacity < 1 }),
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
  ctx.fillText(text, 128, 35, 246);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ toneMapped: false,
    map, transparent: true, depthWrite: false, depthTest: false,
  }));
  sprite.scale.set(width, width / 4, 1);
  sprite.userData.labelWidth = width;
  sprite.renderOrder = 5;
  return sprite;
}

function buildGrid(scene) {
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(FLOOR_SIZE, FLOOR_SIZE),
    new THREE.MeshBasicMaterial({ toneMapped: false, color: 0xf5f8fb, side: THREE.DoubleSide }),
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
  for (const [points, color] of [[minor, 0xe5edf3], [major, 0xd3e1eb]]) {
    scene.add(new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({ toneMapped: false, color }),
    ));
  }

  const corners = [[-half, -half], [half, -half], [half, half], [-half, half]];
  const bottom = corners.map(([x, y]) => position(x, y, FLOOR_FT + 20)); // Clear the floor grid.
  const top = corners.map(([x, y]) => position(x, y, CEILING_FT));
  scene.add(lineLoop(bottom, 0x7c95aa, 0.6), lineLoop(top, 0x7c95aa, 0.55));
  scene.add(new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(bottom.flatMap((point, i) => [point, top[i]])),
    new THREE.LineBasicMaterial({ toneMapped: false, color: 0x7c95aa, opacity: 0.55, transparent: true }),
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
    const material = new THREE.MeshBasicMaterial({ toneMapped: false, color });
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
  const material = new THREE.MeshBasicMaterial({ toneMapped: false,
    color: 0xe88473, opacity: 0.20, transparent: true, depthWrite: false,
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

export function createViewer(container, data, onSelect) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xffffff);
  scene.add(new THREE.HemisphereLight(0xf4f9ff, 0x71859a, 2.2));
  const sun = new THREE.DirectionalLight(0xfffbf4, 2.4);
  sun.position.set(100, 400, -300);
  scene.add(sun);

  const environment = new THREE.Group(), hotspotLayer = new THREE.Group();
  scene.add(environment, hotspotLayer);
  const { axes, north, volumeCorners } = buildGrid(environment);
  const routeLabels = addRoutes(environment, data.routes);
  addHotspots(hotspotLayer, data.hotspots);

  const capacity = Math.max(96, data.aircraft?.length ?? 0) + 16;
  const modelParts = createAircraftParts();
  const aircraftMeshes = modelParts.map(part => {
    const mesh = new THREE.InstancedMesh(part.geometry, aircraftMaterial(part), capacity);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.count = 0;
    mesh.frustumCulled = false;
    scene.add(mesh);
    return mesh;
  });
  const tintColor = new THREE.Color();
  let aircraftScale = 1;
  let trueScale = false;
  let comparison = null, viewName = 'orbit';
  let lastFrames = [], lastSelected = null;
  let setup = null, setupOptions = null, setupFlight = null;

  const exposureMarkers = new THREE.InstancedMesh(
    new THREE.OctahedronGeometry(.95),
    new THREE.MeshBasicMaterial({ toneMapped: false, color: EXPOSED_COLOR }),
    capacity,
  );
  exposureMarkers.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  exposureMarkers.count = 0;
  exposureMarkers.frustumCulled = false;
  scene.add(exposureMarkers);

  const selection = new THREE.Group();
  const halo = lineLoop(circlePoints(5.2), SELECTED_COLOR, 0.98);
  halo.renderOrder = 4;
  selection.add(halo);
  const foot = lineLoop(circlePoints(2), SELECTED_COLOR, 0.63);
  selection.add(foot);
  const drop = line([new THREE.Vector3(), new THREE.Vector3()], SELECTED_COLOR, 0.65);
  drop.frustumCulled = false;
  selection.add(drop);
  selection.visible = false;
  let selectedLabel = null;
  let labelKey = null;
  scene.add(selection);

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;';
  container.appendChild(renderer.domElement);

  const camera = new THREE.OrthographicCamera(-300, 300, 300, -300, 1, 4000);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.minZoom = 0.55;
  controls.maxZoom = 12;
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

  let playbackLayer=null, playbackOptions=null, playbackKey='';
  const playbackPaths=new THREE.Group();scene.add(playbackPaths);
  function clearPlaybackPaths(){playbackPaths.children.forEach(o=>{o.geometry?.dispose();o.material?.dispose();});playbackPaths.clear();}
  function setPlaybackDisplay(options,flight,aircraft,mode,filter,view,scope){
    playbackOptions=options;
    if(!options){if(playbackLayer)playbackLayer.object.visible=false;playbackPaths.visible=false;return;}
    if(!playbackLayer){playbackLayer=createSetupLayer(data,{position,line,label});scene.add(playbackLayer.object);}
    playbackLayer.object.visible=true;
    playbackLayer.configure({...options,space:true,aircraft:true,time:false,candidates:false,referenceProfiles:false,candidateLevels:[],altitude:0},flight);
    comparison?.setHotspotsVisible(options.hotspots);
    comparison?.setPathsVisible(options.paths!=='none');
    playbackPaths.visible=view==='fleet'&&options.paths!=='none';
    const key=[view,mode,filter,scope,flight.id,options.paths].join(':');
    if(key!==playbackKey){playbackKey=key;clearPlaybackPaths();
      if(view==='fleet'&&options.paths!=='none')for(const a of aircraft){
        const plan=a.plans[mode];if(options.paths==='selected'&&a.id!==flight.id)continue;if(filter!=='all'&&plan.change!==filter)continue;
        const points=plan.points.map(([,s,h])=>position(a.x+a.dx*s/a.length,a.y+a.dy*s/a.length,h));
        playbackPaths.add(line(points,CHANGE_COLORS.get(plan.change)??AIRCRAFT_COLOR,options.paths==='selected'?.9:.24));
      }
    }
    redraw();
  }
  function redraw() {
    if(playbackLayer&&playbackOptions)playbackLayer.object.scale.y=comparison?.verticalScale??1;
    if(playbackOptions&&!setupOptions){environment.visible=playbackOptions.space&&(!comparison||viewName!=='profile');hotspotLayer.visible=playbackOptions.hotspots&&(!comparison||viewName!=='profile');}
    if(setupOptions){environment.visible=setupOptions.space;hotspotLayer.visible=setupOptions.hotspots;}
    if (!disposed && !raf) {
      raf = requestAnimationFrame(() => {
        raf = 0;
        scene.traverse(object => {
          if (object.isSprite && object.userData.labelWidth) {
            const width = object.userData.labelWidth / camera.zoom;
            object.scale.set(width, width / 4, 1);
          }
        });
        comparison?.layoutLabels(camera, container.clientWidth, container.clientHeight);
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
    viewName = name;
    camera.zoom = 1;
    controls.enableRotate = name === 'orbit';
    if (setupOptions && setupFlight && name === 'profile') {
      const direction=position(setupFlight.dx,setupFlight.dy,26000).normalize();
      const normal=new THREE.Vector3(-direction.z,0,direction.x);
      controls.target.copy(position(setupFlight.x+setupFlight.dx/2,setupFlight.y+setupFlight.dy/2,34500));
      camera.position.copy(controls.target).addScaledVector(normal,700);
      axes.visible=false;routeLabels.visible=north.visible=false;
      controls.update();camera.updateMatrixWorld();fitWidth=285;fitHeight=105;resize();redraw();return;
    }
    if (comparison) {
      comparison.setProfile(name === 'profile');
      environment.visible = hotspotLayer.visible = name !== 'profile';
      comparison.guides.visible = name === 'profile';
      const normal = new THREE.Vector3(-comparison.direction.z, 0, comparison.direction.x);
      controls.target.copy(comparison.centre);
      camera.position.copy(comparison.centre);
      if (name === 'top') camera.position.add(new THREE.Vector3(0, 700, .01));
      else camera.position.addScaledVector(normal, 700);
      if (name === 'orbit') camera.position.addScaledVector(comparison.direction, -220).y += 350;
      controls.update(); camera.updateMatrixWorld();
      fitWidth = 80; fitHeight = 65;
      for (const point of comparison.fitPoints) {
        project.copy(point).applyMatrix4(camera.matrixWorldInverse);
        fitWidth = Math.max(fitWidth, Math.abs(project.x) + 16);
        fitHeight = Math.max(fitHeight, Math.abs(project.y) + 18);
      }
      resize(); update(lastFrames, lastSelected);
      return;
    }
    environment.visible = hotspotLayer.visible = true;
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
    lastFrames = frames; lastSelected = selectedId;
    const selectedKey = selectedId == null ? null : String(selectedId);
    if (selectedKey !== labelKey) {
      if (selectedLabel) {
        selection.remove(selectedLabel);
        selectedLabel.material.map.dispose();
        selectedLabel.material.dispose();
      }
      selectedLabel = selectedKey === null ? null : label(selectedKey==='DEMO'?'DEMO':"#" + selectedKey, '#0b669f', selectedKey==='DEMO'?55:31);
      if (selectedLabel) selection.add(selectedLabel);
      labelKey = selectedKey;
    }
    active = frames.filter(()=>!playbackOptions||playbackOptions.aircraft).filter(frame => !comparison || viewName !== 'profile' || frame.comparison).slice(0, capacity).map(frame => {
      const point = position(frame.x, frame.y, frame.z);
      if (frame.comparison) point.y *= comparison?.verticalScale ?? 1;
      return { ...frame, point };
    });
    aircraftMeshes.forEach(mesh => { mesh.count = active.length; });
    let exposureCount = 0;
    selection.visible = false;
    for (const [i, frame] of active.entries()) {
      const selected = String(frame.id) === selectedKey;
      marker.position.copy(frame.point);
      marker.rotation.y = -THREE.MathUtils.degToRad(frame.heading);
      // Horizontal scene coordinates are NM; the model geometry is in metres.
      // At true scale, selection must not enlarge the aircraft.
      marker.scale.setScalar(trueScale ? 1 / METRES_PER_NM : DISPLAY_UNITS_PER_METRE * aircraftScale * (frame.demo ? 6 : frame.comparison ? 3 : selected ? 1.1 : 1));
      // At entry, timing variants can occupy exactly the same position.
      // Draw one airframe there; retain all plan frames for timing and labels.
      if (frame.comparison && active.slice(0,i).some(other => other.comparison && other.point.distanceToSquared(frame.point)<1e-10)) marker.scale.setScalar(0);
      marker.updateMatrix();
      aircraftMeshes.forEach(mesh => mesh.setMatrixAt(i, marker.matrix));
      const changeColor = CHANGE_COLORS.get(frame.change);
      const legacyColor = selected ? SELECTED_COLOR : (frame.exposed ? EXPOSED_COLOR : AIRCRAFT_COLOR);
      const color = frame.muted ? new THREE.Color(0xd5dfe7) : frame.color ? new THREE.Color(frame.color) : changeColor ?? legacyColor;
      aircraftMeshes[2].setColorAt(i, color);
      aircraftMeshes[0].setColorAt(i, tintColor.copy(color).lerp(WHITE, .92));
      aircraftMeshes[1].setColorAt(i, tintColor.copy(color).lerp(WHITE, .72));
      if (!trueScale && !frame.muted && changeColor && frame.exposed) {
        marker.position.set(frame.point.x + 2.4, frame.point.y + 2.2, frame.point.z + 2.4);
        marker.scale.setScalar(1);
        marker.updateMatrix();
        exposureMarkers.setMatrixAt(exposureCount++, marker.matrix);
      }
      if (!selected || trueScale) continue;
      selection.visible = true;
      halo.scale.setScalar(aircraftScale);
      halo.position.copy(frame.point);
      halo.position.y += 0.25;
      if (selectedLabel) {
        selectedLabel.position.copy(frame.point);
        selectedLabel.position.y += (frame.demo?22:7) * aircraftScale;
      }
      foot.position.copy(frame.point);
      foot.position.y = 0.75;
      const endpoints = drop.geometry.attributes.position;
      endpoints.setXYZ(0, frame.point.x, frame.point.y, frame.point.z);
      endpoints.setXYZ(1, frame.point.x, foot.position.y, frame.point.z);
      endpoints.needsUpdate = true;
    }
    aircraftMeshes.forEach(mesh => {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    });
    exposureMarkers.count = exposureCount;
    if (exposureCount) exposureMarkers.instanceMatrix.needsUpdate = true;
    comparison?.updateLabels(active.filter(frame => frame.comparison), trueScale);
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
    aircraftMeshes.forEach(mesh => mesh.computeBoundingSphere());
    const hit = raycaster.intersectObjects(aircraftMeshes, false)[0];
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
    comparison?.dispose();
    playbackLayer?.dispose();clearPlaybackPaths();
    setup?.dispose();
    const resources = new Set();
    scene.traverse(({ geometry, material }) => {
      if (geometry) resources.add(geometry);
      if (material) resources.add(material);
      if (material?.map) resources.add(material.map);
    });
    resources.forEach((resource) => resource.dispose());
    aircraftMeshes.forEach(mesh => mesh.dispose());
    exposureMarkers.dispose();
    renderer.dispose();
    canvas.remove();
  }

  function setAccessibleLabel(text) {
    renderer.domElement.setAttribute('aria-label', text);
  }

  function setAircraftScale(value) {
    if (!Number.isFinite(value)) return;
    aircraftScale = THREE.MathUtils.clamp(value, .5, 1.5);
    update(lastFrames, lastSelected);
  }

  function setTrueScale(value) {
    trueScale = Boolean(value);
    update(lastFrames, lastSelected);
  }

  function focusSelected() {
    const selected = active.find(frame => frame.id === lastSelected);
    if (!selected) return false;
    const delta = selected.point.clone().sub(controls.target);
    camera.position.add(delta);
    controls.target.copy(selected.point);
    camera.zoom = 4;
    camera.updateProjectionMatrix();
    controls.update(); redraw();
    return true;
  }

  function setComparison(flight, groups = []) {
    comparison?.dispose(); comparison = null;
    if (flight) {
      comparison = createComparisonLayer(flight, groups, data.hotspots, {position, line, label});
      scene.add(comparison.object);
      comparison.setProfile(viewName === 'profile');
      comparison.guides.visible = viewName === 'profile';
      environment.visible = hotspotLayer.visible = viewName !== 'profile';
    } else environment.visible = hotspotLayer.visible = true;
    // A mode switch changes layers, not the user's camera or zoom.
    redraw();
  }

  function setSetup(options, flight) {
    const changedFlight=setupFlight?.id!==flight?.id;
    setupOptions=options;setupFlight=options?flight:null;
    if(options){if(!setup){setup=createSetupLayer(data,{position,line,label});scene.add(setup.object);}setup.configure(options,flight);if(changedFlight&&viewName==='profile')setView('profile');}
    else {setup?.dispose();setup=null;environment.visible=hotspotLayer.visible=true;}
    redraw();
  }

  const altitudeExaggeration = () => HEIGHT_PER_FT * METRES_PER_NM / .3048 * (comparison?.verticalScale ?? 1);
  return { setPlaybackDisplay, getView: () => viewName, update, setSetup, setView, setAircraftScale, setTrueScale, setComparison, altitudeExaggeration, focusSelected, setAccessibleLabel, dispose };
}
