import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';

// Procedural A320-family visual reference, in metres; not an engineering model.
// Overall proportions: Airbus A320 characteristics, length 37.57 m / sharklet span 35.80 m.
// https://www.aircraft.airbus.com/en/aircraft/a320-family/a320neo
function combine(geometries) {
  const positions = [], normals = [];
  for (const geometry of geometries) {
    const flat = geometry.index ? geometry.toNonIndexed() : geometry;
    positions.push(...flat.attributes.position.array);
    normals.push(...flat.attributes.normal.array);
    if (flat !== geometry) flat.dispose();
    geometry.dispose();
  }
  const result = new THREE.BufferGeometry();
  result.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  result.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  result.computeBoundingSphere();
  return result;
}

function hull(profile, segments = 32) {
  const curve = new THREE.CatmullRomCurve3(profile.map(([r, z]) => new THREE.Vector3(r, -z, 0)));
  const points = curve.getPoints(64).map(p => new THREE.Vector2(Math.max(.005, p.x), p.y));
  return new THREE.LatheGeometry(points, segments).rotateX(-Math.PI / 2);
}

function wing(outline, thickness, base, dihedral = 0) {
  const shape = new THREE.Shape();
  outline.forEach(([x, z], i) => i ? shape.lineTo(x, -z) : shape.moveTo(x, -z));
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
  geometry.rotateX(-Math.PI / 2).translate(0, base, 0);
  const points = geometry.attributes.position;
  for (let i = 0; i < points.count; i++) points.setY(i, points.getY(i) + Math.abs(points.getX(i)) * dihedral);
  geometry.computeVertexNormals();
  return geometry;
}

function patch(vertices) {
  const geometry = new THREE.BufferGeometry();
  const triangles = [];
  for (let i = 1; i < vertices.length - 1; i++) triangles.push(...vertices[0], ...vertices[i], ...vertices[i + 1]);
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(triangles, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export function createAircraftParts() {
  const white = [], wings = [], trim = [], dark = [], metal = [], accents = [];
  white.push(hull([
    [.015, 18.785], [.34, 17.4], [.85, 15.5], [1.55, 13], [1.94, 10.8],
    [1.975, 6], [1.975, -7], [1.95, -11.5], [1.72, -14], [1.2, -16.2],
    [.60, -17.8], [.015, -18.785],
  ]));
  for (const side of [-1, 1]) {
    const mirror = points => points.map(([x, z]) => [x * side, z]);
    wings.push(wing(mirror([[1.4, -5.1], [5.5, -3.6], [17.15, 3.7], [17.15, 5.1], [5.5, 3.9], [1.4, 4.1]]), .16, -.65, .045));
    wings.push(wing(mirror([[.7, 11.7], [2.1, 12.4], [6.2, 16.4], [6.2, 17.3], [.7, 15.3]]), .12, .6, .06));
    accents.push(patch([[side * 17.1, .2, 3.7], [side * 17.9, 2.7, 4.6], [side * 17.9, 2.7, 5.3], [side * 17.1, .2, 5.1]]));

    const engine = hull([[.68, 1.65], [.83, 1.15], [1.05, -.6], [1.02, -1.5], [.87, -1.82]], 24);
    white.push(engine.translate(side * 5.65, -1.65, -3.6));
    metal.push(new THREE.TorusGeometry(.87, .10, 8, 28).translate(side * 5.65, -1.65, -5.42));
    dark.push(new THREE.CircleGeometry(.80, 28).rotateY(Math.PI).translate(side * 5.65, -1.65, -5.32));
    metal.push(new THREE.ConeGeometry(.23, .42, 16).rotateX(-Math.PI / 2).translate(side * 5.65, -1.65, -5.38));
    for (let blade = 0; blade < 12; blade++) {
      const a = blade * Math.PI / 6;
      const b = a + .24;
      metal.push(patch([
        [side * 5.65 + Math.cos(a) * .25, -1.65 + Math.sin(a) * .25, -5.34],
        [side * 5.65 + Math.cos(b) * .73, -1.65 + Math.sin(b) * .73, -5.34],
        [side * 5.65 + Math.cos(b + .08) * .73, -1.65 + Math.sin(b + .08) * .73, -5.34],
      ]));
    }
    wings.push(new THREE.BoxGeometry(.36, .95, 2.0).translate(side * 5.65, -.75, -2.7));
    for (let z = -10.8; z < 10.5; z += .56) {
      dark.push(new THREE.CircleGeometry(.14, 8).scale(1, 1.22, 1)
        .rotateY(side * Math.PI / 2).translate(side * 1.912, .52, z));
    }
    for (const [lo, hi] of [[.06, .43], [.47, .88]]) {
      const coords = [[lo, 1.40, -15.45], [hi, 1.40, -15.45], [hi, 1.08, -16.6], [lo, 1.08, -16.6]];
      dark.push(patch(coords.map(([a, r, z]) => [side * Math.sin(a) * r, Math.cos(a) * r, z])));
    }
  }
  const fin = new THREE.Shape();
  [[-11.6, 1.3], [-15.2, 6.2], [-17.5, 6.5], [-16.5, 1.2]].forEach(([x, y], i) => i ? fin.lineTo(x, y) : fin.moveTo(x, y));
  fin.closePath();
  trim.push(new THREE.ExtrudeGeometry(fin, {depth: .18, bevelEnabled: false}).rotateY(Math.PI / 2).translate(-.09, 0, 0));
  // Restrained presentation livery: navy tail, orange winglets and lower stripe.
  accents.push(patch([[-1.67, -1.05, -9], [-1.67, -1.05, 9], [-1.57, -1.2, 9], [-1.57, -1.2, -9]]));
  accents.push(patch([[1.67, -1.05, -9], [1.57, -1.2, -9], [1.57, -1.2, 9], [1.67, -1.05, 9]]));
  return [
    { name: 'body', geometry: combine(white), color: 0xf7f9fc, roughness: .65, metalness: .04 },
    { name: 'wings', geometry: combine(wings), color: 0xc5d1df, roughness: .65, metalness: .06 },
    { name: 'trim', geometry: combine(trim), color: 0xffffff, roughness: .35, metalness: .1, tinted: true },
    { name: 'glass', geometry: combine(dark), color: 0x172c42, roughness: .23, metalness: .35 },
    { name: 'metal', geometry: combine(metal), color: 0x6f8091, roughness: .3, metalness: .6 },
    { name: 'accent', geometry: combine(accents), color: 0xEF7C00, roughness: .65, metalness: .04 },
  ];
}

export function aircraftMaterial(part) {
  return new THREE.MeshStandardMaterial({ color: part.color, roughness: part.roughness, metalness: part.metalness, side: THREE.DoubleSide });
}

export function createAircraftPreview(container) {
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xeaf5ff, 0x4a5e70, 2.5));
  const key = new THREE.DirectionalLight(0xfff6e8, 3.2);
  key.position.set(-25, 45, -30);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xabcfff, 2);
  rim.position.set(30, 15, 25);
  scene.add(rim);
  const parts = createAircraftParts();
  const meshes = parts.map(part => new THREE.Mesh(part.geometry, aircraftMaterial(part)));
  meshes.forEach(mesh => scene.add(mesh));
  const tint = meshes[parts.findIndex(part => part.tinted)].material;
  tint.color.set(0x003D7C);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.domElement.tabIndex = 0;
  container.appendChild(renderer.domElement);
  const camera = new THREE.OrthographicCamera(-30, 30, 18, -18, .1, 300);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = controls.enableZoom = false;
  controls.minPolarAngle = .2;
  controls.maxPolarAngle = Math.PI * .85;
  let disposed = false, frame = 0;
  function draw() {
    if (!disposed && !frame) frame = requestAnimationFrame(() => { frame = 0; renderer.render(scene, camera); });
  }
  function reset() {
    camera.position.set(36, 25, -43);
    controls.target.set(0, .8, 0);
    controls.update();
    draw();
  }
  function resize() {
    const width = container.clientWidth, height = container.clientHeight;
    if (!width || !height) return;
    const half = Math.max(17, 25 * height / width);
    camera.left = -half * width / height;
    camera.right = half * width / height;
    camera.top = half; camera.bottom = -half;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    draw();
  }
  function keydown(event) {
    const delta = {ArrowLeft: -.18, ArrowRight: .18}[event.key];
    if (delta !== undefined) {
      event.preventDefault();
      camera.position.sub(controls.target).applyAxisAngle(new THREE.Vector3(0, 1, 0), delta).add(controls.target);
      controls.update(); draw();
    } else if (event.key === 'Home') { event.preventDefault(); reset(); }
  }
  renderer.domElement.addEventListener('keydown', keydown);
  controls.addEventListener('change', draw);
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  reset(); resize();
  return {
    setColor(color) { if (tint.color.getHex() !== color) { tint.color.setHex(color); draw(); } },
    setAccessibleLabel(text) { renderer.domElement.setAttribute('aria-label', text); },
    reset,
    dispose() {
      disposed = true; if (frame) cancelAnimationFrame(frame);
      observer.disconnect(); controls.dispose();
      renderer.domElement.removeEventListener('keydown', keydown);
      meshes.forEach(mesh => { mesh.geometry.dispose(); mesh.material.dispose(); });
      renderer.dispose(); renderer.domElement.remove();
    },
  };
}
