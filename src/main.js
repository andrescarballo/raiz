import * as THREE from 'three';
import { storage } from './core/storage.js';
import { initPWA, initOrientationLock } from './core/pwa.js';
import './styles.css';

initPWA();
initOrientationLock();

/* ==========================================================================
   RAÍZ — prototipo de supervivencia bushcraft
   Mundo infinito por chunks · ciclo día/noche · termorregulación · fuego
   ========================================================================== */

/* ---------- 1. ruido y azar determinista ---------- */
let SEED = 1337;
function hash2(x, y){
  const n = Math.sin(x * 127.1 + y * 311.7 + SEED * 0.017) * 43758.5453123;
  return n - Math.floor(n);
}
function vnoise(x, y){
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, oct){
  let s = 0, amp = 0.5, f = 1;
  for (let i = 0; i < (oct || 4); i++){ s += amp * vnoise(x * f, y * f); f *= 2; amp *= 0.5; }
  return s;
}
function mulberry32(a){
  return function(){
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const isTouch = matchMedia('(pointer:coarse)').matches;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;

/* ---------- 2. relieve del terreno ---------- */
const CHUNK = 96, SEG = 32, VIEW = isTouch ? 1 : 2, WATER = 0;
function heightAt(x, z){
  let h = fbm(x * 0.0035, z * 0.0035, 5) * 92 - 27;      // grandes formas
  h += fbm(x * 0.021 + 100, z * 0.021 - 50, 3) * 6 - 3;  // rugosidad
  const v = fbm(x * 0.0012 - 300, z * 0.0012 + 200, 3);  // cauces y hondonadas
  h -= Math.pow(Math.max(0, 1 - Math.abs(v - 0.5) * 6), 2) * 20;
  return h;
}
const moistAt = (x, z) => fbm(x * 0.004 + 900, z * 0.004 - 640, 3);
const treeNoise = (x, z) => fbm(x * 0.009 + 55, z * 0.009 + 20, 3);
const openNoise = (x, z) => fbm(x * 0.0021 + 310, z * 0.0021 - 120, 3);   // claros / espesura

function biomeAt(x, z, y, m){
  if (y === undefined) y = heightAt(x, z);
  if (m === undefined) m = moistAt(x, z);
  if (y > 36) return 'roquedo';
  if (y < WATER + 1.6) return 'ribera';
  const o = openNoise(x, z);
  if (o < 0.40) return 'claro';
  if (m > 0.545) return 'frondoso';
  if (m < 0.465) return 'pinar';
  return 'mixto';
}
const BIOME = {
  claro:    { dens: 0.10, sp: ['roble', 'abedul'],                    soil: [0.30, 0.40, 0.15], name: 'claro' },
  pinar:    { dens: 0.80, sp: ['pino', 'pino', 'abeto'],              soil: [0.26, 0.23, 0.14], name: 'pinar' },
  mixto:    { dens: 0.58, sp: ['pino', 'roble', 'abedul'],            soil: [0.24, 0.30, 0.15], name: 'bosque mixto' },
  frondoso: { dens: 1.00, sp: ['roble', 'roble', 'abedul', 'abeto'],  soil: [0.17, 0.25, 0.11], name: 'espesura' },
  ribera:   { dens: 0.42, sp: ['aliso', 'abedul'],                    soil: [0.38, 0.34, 0.22], name: 'ribera' },
  roquedo:  { dens: 0.10, sp: ['pino'],                               soil: [0.40, 0.39, 0.36], name: 'roquedo' }
};

/* ---------- 3. escena ---------- */
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, isTouch ? 1.25 : 1.8));
renderer.setSize(innerWidth, innerHeight);
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = !isTouch;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x9ab0bd, 0.0062);
const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.1, 900);

const hemi = new THREE.HemisphereLight(0xbfd4e6, 0x3d3a24, 0.45); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0d8, 1.1);
sun.castShadow = true;
sun.shadow.mapSize.set(isTouch ? 1024 : 2048, isTouch ? 1024 : 2048);
sun.shadow.camera.left = -55; sun.shadow.camera.right = 55;
sun.shadow.camera.top = 55; sun.shadow.camera.bottom = -55;
sun.shadow.normalBias = 0.04;
sun.shadow.camera.near = 1; sun.shadow.camera.far = 300;
sun.shadow.bias = -0.0012;
scene.add(sun); scene.add(sun.target);

const skyGeo = new THREE.SphereGeometry(600, 20, 14);
const skyMat = new THREE.ShaderMaterial({
  uniforms: { uTop: { value: new THREE.Color(0x3f6f9e) }, uHor: { value: new THREE.Color(0x9ab0bd) },
              uSun: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color(0xffe3b8) } },
  vertexShader: 'varying vec3 vW; void main(){ vW = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: [
    'varying vec3 vW; uniform vec3 uTop, uHor, uSunCol, uSun;',
    'void main(){',
    '  float h = clamp(vW.y * 1.5 + 0.12, 0.0, 1.0);',
    '  vec3 c = mix(uHor, uTop, pow(h, 0.7));',
    '  float d = max(dot(normalize(vW), normalize(uSun)), 0.0);',
    '  c += uSunCol * pow(d, 300.0) * 2.2;',
    '  c += uSunCol * pow(d, 6.0) * 0.30 * (1.0 - h * 0.55);',
    '  gl_FragColor = vec4(c, 1.0);',
    '}'].join('\n'),
  side: THREE.BackSide, depthWrite: false, fog: false });
const sky = new THREE.Mesh(skyGeo, skyMat); scene.add(sky);

// estrellas
(function(){
  const g = new THREE.BufferGeometry(), p = [];
  for (let i = 0; i < 700; i++){
    const th = Math.random() * Math.PI * 2, ph = Math.acos(Math.random() * 0.9 + 0.05), r = 560;
    p.push(r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph), r * Math.sin(ph) * Math.sin(th));
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  window.stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xdfe6ff, size: 1.7, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
  scene.add(window.stars);
})();

/* ---------- 4. texturas procedurales (sin assets externos) ---------- */
function canvasTex(w, h, draw, rep){
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (rep) t.repeat.set(rep, rep);
  t.encoding = THREE.sRGBEncoding;
  return t;
}
function canvasOf(w, h, draw){
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h); return c;
}
function texOf(c, rep){
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (rep) t.repeat.set(rep, rep);
  t.encoding = THREE.sRGBEncoding;
  t.anisotropy = maxAniso;
  return t;
}
/* normal map derivado de la luminancia: da relieve sin traer ficheros */
function normalOf(c, fuerza, rep){
  const w = c.width, h = c.height;
  const src = c.getContext('2d').getImageData(0, 0, w, h).data;
  const data = new Uint8Array(w * h * 3);
  const H = (x, y) => src[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++){
    const dx = (H(x + 1, y) - H(x - 1, y)) * fuerza;
    const dy = (H(x, y + 1) - H(x, y - 1)) * fuerza;
    const l = Math.sqrt(dx * dx + dy * dy + 1);
    const i = (y * w + x) * 3;
    data[i] = (-dx / l * 0.5 + 0.5) * 255;
    data[i + 1] = (-dy / l * 0.5 + 0.5) * 255;
    data[i + 2] = (1 / l * 0.5 + 0.5) * 255;
  }
  const t = new THREE.DataTexture(data, w, h, THREE.RGBFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (rep) t.repeat.set(rep, rep);
  t.anisotropy = maxAniso;
  t.needsUpdate = true;
  return t;
}

const cGround = canvasOf(512, 512, (g, w, h) => {
  g.fillStyle = '#8a8a74'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 26000; i++){                       // grano de tierra
    const l = 40 + Math.random() * 140;
    g.fillStyle = 'rgba(' + l + ',' + (l + 8) + ',' + (l - 12) + ',.5)';
    g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 1 + Math.random() * 3);
  }
  for (let i = 0; i < 260; i++){                         // guijarros y ramitas
    const x = Math.random() * w, y = Math.random() * h, r = 1.5 + Math.random() * 4.5;
    const l = 90 + Math.random() * 110;
    g.fillStyle = 'rgba(' + l + ',' + (l - 4) + ',' + (l - 16) + ',.85)';
    g.beginPath(); g.ellipse(x, y, r, r * (0.6 + Math.random() * 0.5), Math.random() * 3, 0, 6.3); g.fill();
  }
  for (let i = 0; i < 900; i++){                         // hojas y agujas caídas
    const x = Math.random() * w, y = Math.random() * h;
    g.strokeStyle = 'rgba(' + (70 + Math.random() * 60) + ',' + (55 + Math.random() * 45) + ',30,.5)';
    g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (Math.random() - 0.5) * 12, y + (Math.random() - 0.5) * 12); g.stroke();
  }
});
const cBark = canvasOf(256, 512, (g, w, h) => {
  g.fillStyle = '#5b4630'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 520; i++){                          // grietas verticales
    const x = Math.random() * w, l = 18 + Math.random() * 80;
    g.fillStyle = 'rgba(' + l + ',' + (l - 6) + ',' + (l - 16) + ',.6)';
    g.fillRect(x, Math.random() * h, 1 + Math.random() * 5, 40 + Math.random() * 300);
  }
  for (let i = 0; i < 90; i++){                           // nudos y placas
    const x = Math.random() * w, y = Math.random() * h;
    g.fillStyle = 'rgba(30,22,16,.5)';
    g.beginPath(); g.ellipse(x, y, 3 + Math.random() * 9, 10 + Math.random() * 26, 0, 0, 6.3); g.fill();
  }
});
const cBirch = canvasOf(256, 512, (g, w, h) => {
  g.fillStyle = '#d8d3c4'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 130; i++){
    g.fillStyle = 'rgba(38,34,30,' + (0.3 + Math.random() * 0.55) + ')';
    g.fillRect(Math.random() * w, Math.random() * h, 6 + Math.random() * 30, 2 + Math.random() * 5);
  }
  for (let i = 0; i < 700; i++){
    const l = 150 + Math.random() * 90;
    g.fillStyle = 'rgba(' + l + ',' + l + ',' + (l - 14) + ',.4)';
    g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
  }
});
const cLeaf = canvasOf(256, 256, (g, w, h) => {
  g.fillStyle = '#3d5226'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 5200; i++){                          // hojas sueltas
    const l = 28 + Math.random() * 95, x = Math.random() * w, y = Math.random() * h;
    g.fillStyle = 'rgba(' + (l * 0.58) + ',' + l + ',' + (l * 0.42) + ',.7)';
    g.beginPath(); g.ellipse(x, y, 2 + Math.random() * 4, 1 + Math.random() * 2.5, Math.random() * 3, 0, 6.3); g.fill();
  }
});
/* Racimo de hojas recortado sobre fondo transparente. La silueta irregular del
   alfa es lo que quita el aire de "bola de icosaedro": el volumen de la copa lo
   dan los huecos, no los polígonos. */
const cLeafCard = canvasOf(256, 256, (g, w, h) => {
  g.clearRect(0, 0, w, h);
  const rnd = mulberry32(4242);
  const cx = w * 0.5, cy = h * 0.5;
  for (let i = 0; i < 190; i++){
    // disco con más densidad al centro: los bordes quedan deshilachados
    const a = rnd() * 6.283, r = Math.pow(rnd(), 0.5) * w * 0.46;
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * 0.88;
    const largo = 11 + rnd() * 15, ancho = 4.5 + rnd() * 5;
    const v = 62 + rnd() * 96;
    g.save(); g.translate(x, y); g.rotate(rnd() * 6.283);
    g.fillStyle = 'rgb(' + (v * 0.50) + ',' + (v * 0.94) + ',' + (v * 0.38) + ')';
    g.beginPath(); g.ellipse(0, 0, ancho, largo * 0.5, 0, 0, 6.283); g.fill();
    g.restore();
  }
});
/* Ramilla de acículas: se ancla por la izquierda y barre hacia la punta.
   Tiene que llenar el alto del plano, no dejar un pelo en el centro: si el alfa
   solo cubre una banda fina, la conífera acaba pareciendo patas de araña. */
const cNeedle = canvasOf(256, 192, (g, w, h) => {
  g.clearRect(0, 0, w, h);
  const rnd = mulberry32(991);
  const y0 = h * 0.5;
  // ramillas secundarias que abren la mata a lo alto
  for (let b = 0; b < 7; b++){
    const bx = w * (0.06 + rnd() * 0.7);
    const by = y0 + (rnd() - 0.5) * h * 0.5;
    g.strokeStyle = 'rgb(58,46,32)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(bx, y0); g.lineTo(bx + w * 0.2, by); g.stroke();
  }
  g.strokeStyle = 'rgb(62,50,34)'; g.lineWidth = 4;
  g.beginPath(); g.moveTo(2, y0); g.lineTo(w * 0.9, y0); g.stroke();
  for (let i = 0; i < 900; i++){
    const t = Math.pow(rnd(), 0.85);
    const x = 5 + t * (w * 0.9);
    // la mata es un huso: estrecha en el arranque, ancha al medio, en punta al final
    const perfil = Math.sin(Math.min(1, t * 1.15) * Math.PI) * 0.55 + 0.32;
    const disp = (rnd() - 0.5) * 2 * perfil * h * 0.46;
    const largo = 13 + rnd() * 20;
    const lado = disp >= 0 ? 1 : -1;
    const v = 52 + rnd() * 92;
    g.strokeStyle = 'rgb(' + (v * 0.40) + ',' + (v * 0.86) + ',' + (v * 0.44) + ')';
    g.lineWidth = 1.5 + rnd() * 1.5;
    g.beginPath();
    g.moveTo(x, y0 + disp * 0.25);
    g.lineTo(x + largo * 0.55, y0 + disp + lado * largo * 0.3);
    g.stroke();
  }
});
const cRock = canvasOf(256, 256, (g, w, h) => {
  g.fillStyle = '#7b7770'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 9000; i++){
    const l = 60 + Math.random() * 95;
    g.fillStyle = 'rgba(' + l + ',' + l + ',' + (l - 6) + ',.5)';
    g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
  }
  for (let i = 0; i < 40; i++){                            // vetas
    g.strokeStyle = 'rgba(45,44,42,.45)'; g.lineWidth = 1 + Math.random() * 2.5;
    g.beginPath(); g.moveTo(Math.random() * w, Math.random() * h);
    g.lineTo(Math.random() * w, Math.random() * h); g.stroke();
  }
});
const cWater = canvasOf(256, 256, (g, w, h) => {
  g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 90; i++){                            // ondas suaves
    const x = Math.random() * w, y = Math.random() * h, r = 12 + Math.random() * 40;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, 'rgba(255,255,255,.16)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, 6.3); g.fill();
  }
});

const groundTex = texOf(cGround, 26), groundNrm = normalOf(cGround, 2.2, 26);
const barkTex = texOf(cBark, 1), barkNrm = normalOf(cBark, 3.0, 1);
const birchTex = texOf(cBirch, 1), birchNrm = normalOf(cBirch, 1.6, 1);
const leafTex = texOf(cLeaf, 2), leafNrm = normalOf(cLeaf, 1.4, 2);
/* Los planos de copa no tilan: si se repiten, el alfa se corta contra el borde */
function cardTex(c){
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.encoding = THREE.sRGBEncoding;
  t.anisotropy = maxAniso;
  return t;
}
const leafCardTex = cardTex(cLeafCard), needleTex = cardTex(cNeedle);
const rockTex = texOf(cRock, 1), rockNrm = normalOf(cRock, 2.6, 1);
const waterNrm = normalOf(cWater, 1.1, 34), waterNrm2 = normalOf(cWater, 0.8, 17);

/* ---------- 5. geometrías y materiales compartidos ---------- */
const trunkGeo = new THREE.CylinderGeometry(0.16, 0.34, 1, 6); trunkGeo.translate(0, 0.5, 0);
const pineGeo = new THREE.ConeGeometry(1, 1, 7); pineGeo.translate(0, 0.5, 0);
const oakGeo = new THREE.SphereGeometry(1, 7, 5); oakGeo.translate(0, 0.85, 0);
const barkMat = new THREE.MeshStandardMaterial({ map: barkTex, normalMap: barkNrm, roughness: 0.95 });
/* Copas: plano recortado, no sólido. alphaTest en vez de transparent para que
   sigan escribiendo profundidad y no haya que ordenarlas por distancia. */
const ALFA_COPA = 0.42;
const pineMat = new THREE.MeshStandardMaterial({ map: needleTex, color: 0x8fa476, roughness: 1,
  alphaTest: ALFA_COPA, side: THREE.DoubleSide });
const oakMat2 = new THREE.MeshStandardMaterial({ map: leafCardTex, color: 0xa9b571, roughness: 1,
  alphaTest: ALFA_COPA, side: THREE.DoubleSide });
const terrainMat = new THREE.MeshStandardMaterial({ map: groundTex, normalMap: groundNrm,
  normalScale: new THREE.Vector2(0.8, 0.8), vertexColors: true, roughness: 1 });
const rockMat = new THREE.MeshStandardMaterial({ map: rockTex, normalMap: rockNrm, roughness: 0.9 });
const woodMat = new THREE.MeshStandardMaterial({ map: barkTex, roughness: 1 });
const dryMat = new THREE.MeshStandardMaterial({ color: 0x8d7346, roughness: 1 });
const bushMat = new THREE.MeshStandardMaterial({ map: leafTex, color: 0x6d8442, roughness: 1 });
const fiberMat = new THREE.MeshStandardMaterial({ map: leafTex, color: 0x7d9b4a, roughness: 1 });

const birchMat = new THREE.MeshStandardMaterial({ map: birchTex, normalMap: birchNrm, roughness: 0.92 });
const abetoMat = new THREE.MeshStandardMaterial({ map: needleTex, color: 0x64795a, roughness: 1,
  alphaTest: ALFA_COPA, side: THREE.DoubleSide });
const alisoMat = new THREE.MeshStandardMaterial({ map: leafCardTex, color: 0x93ad63, roughness: 1,
  alphaTest: ALFA_COPA, side: THREE.DoubleSide });
const mossMat  = new THREE.MeshStandardMaterial({ map: leafTex, color: 0x6f8f4a, roughness: 1 });
const reedMat  = new THREE.MeshStandardMaterial({ map: leafTex, color: 0x9aa864, roughness: 1 });
const flintMat = new THREE.MeshStandardMaterial({ color: 0x4a4a52, roughness: 0.6, metalness: 0.15 });

/* fusiona geometrías para hacer un tronco con sus ramas en una sola malla */
function mergeGeos(parts){
  let count = 0;
  const gs = parts.map(({ geo, m }) => {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (m) g.applyMatrix4(m);
    count += g.attributes.position.count;
    return g;
  });
  const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3), uv = new Float32Array(count * 2);
  let o = 0, ou = 0;
  gs.forEach(g => {
    pos.set(g.attributes.position.array, o); nor.set(g.attributes.normal.array, o);
    uv.set(g.attributes.uv.array, ou);
    o += g.attributes.position.count * 3; ou += g.attributes.position.count * 2;
  });
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return out;
}

const REF_H = 10;

/* Tronco de referencia (10 m) con ramas reales; las instancias escalan en bloque.
   y1 es dónde acaba la banda de ramas y merma cuánto se acortan al subir. Las dos
   importan: la copa se estrecha con la altura, así que una rama de longitud fija
   acaba asomando por fuera del follaje como un pincho clavado. La rama tiene que
   seguir el mismo perfil que la copa que la tapa. */
function makeTrunk(rBase, rTop, nb, y0, len, ang, y1, merma){
  const base = new THREE.CylinderGeometry(rTop, rBase, REF_H, 7);
  base.translate(0, REF_H / 2, 0);
  const parts = [{ geo: base, m: null }];
  const alto = y1 === undefined ? 0.93 : y1;
  const k = merma === undefined ? 0.35 : merma;
  for (let i = 0; i < nb; i++){
    const t = nb === 1 ? 0 : i / (nb - 1);
    const y = (y0 + t * (alto - y0)) * REF_H;
    const l = len * (1 - t * k);
    const br = new THREE.CylinderGeometry(0.03, 0.08, l, 4);
    br.translate(0, l / 2, 0);
    const m = new THREE.Matrix4().makeRotationZ(ang);
    m.premultiply(new THREE.Matrix4().makeRotationY(i * 2.399));
    m.setPosition(0, y, 0);
    parts.push({ geo: br, m });
  }
  return mergeGeos(parts);
}

/* viento compartido: hierba y copas se mueven */
const windU = { value: 0 }, windAmp = { value: 1 };
/* fade: la mata encoge hacia el borde del césped cercano, así no se ve el corte */
function addSway(mat, amp, fade){
  mat.onBeforeCompile = sh => {
    sh.uniforms.uTime = windU; sh.uniforms.uWind = windAmp; sh.uniforms.uAmp = { value: amp };
    let corte = '';
    if (fade){
      sh.uniforms.uCen = cespedCen; sh.uniforms.uRad = cespedRad;
      corte = `
        #ifdef USE_INSTANCING
          transformed.y *= 1.0 - smoothstep(uRad * 0.66, uRad * 0.96, length(instanceMatrix[3].xz - uCen.xz));
        #endif`;
    }
    sh.vertexShader = 'uniform float uTime;\nuniform float uWind;\nuniform float uAmp;\n' +
      (fade ? 'uniform vec3 uCen;\nuniform float uRad;\n' : '') +
      sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>${corte}
        #ifdef USE_INSTANCING
          float ph = instanceMatrix[3].x * 0.6 + instanceMatrix[3].z * 0.45;
        #else
          float ph = 0.0;
        #endif
        float sway = (sin(uTime * 1.5 + ph) + 0.4 * sin(uTime * 3.1 + ph * 1.7)) * uAmp * uWind * max(transformed.y, 0.0);
        transformed.x += sway; transformed.z += sway * 0.55;`);
  };
  mat.customProgramCacheKey = () => 'sway' + amp + (fade ? 'f' : '');
}
[pineMat, oakMat2, abetoMat, alisoMat].forEach(m => addSway(m, 0.010));

/* hierba alta y hojarasca — la hoja es una cinta que se estrecha, no un trazo grueso:
   la silueta recortada es lo que quita el aire de "cartón verde" */
const grassTex = canvasTex(128, 128, (g, w, h) => {
  g.clearRect(0, 0, w, h);
  for (let i = 0; i < 28; i++){
    const x = 5 + Math.random() * (w - 10);
    const l = h * (0.42 + Math.random() * 0.56);
    const cur = (Math.random() - 0.5) * 38;              // cuánto se curva la hoja
    const an = 1.6 + Math.random() * 2.6;                // media anchura en la base
    // Casi neutra a propósito: el verde y el seco los pone el color por instancia,
    // así una sola textura da todo el rango de la pradera.
    const v = 150 + Math.random() * 95;
    const grd = g.createLinearGradient(0, h, 0, h - l);  // base en sombra, punta clara
    grd.addColorStop(0, 'rgb(' + (v * 0.56) + ',' + (v * 0.72) + ',' + (v * 0.44) + ')');
    grd.addColorStop(1, 'rgb(' + (v * 0.95) + ',' + v + ',' + (v * 0.72) + ')');
    g.fillStyle = grd;
    g.beginPath();
    g.moveTo(x - an, h);
    g.quadraticCurveTo(x + cur * 0.45 - an * 0.4, h - l * 0.58, x + cur, h - l);   // canto de ida
    g.quadraticCurveTo(x + cur * 0.45 + an * 0.4, h - l * 0.58, x + an, h);        // y de vuelta
    g.closePath(); g.fill();
  }
});
grassTex.repeat.set(1, 1);
grassTex.anisotropy = maxAniso;
// vertexColors es lo que hace que setColorAt sirva de algo: sin él, three calcula
// el color por instancia y el fragment shader lo ignora.
const grassMat = new THREE.MeshStandardMaterial({ map: grassTex, alphaTest: 0.42, transparent: false,
  side: THREE.DoubleSide, roughness: 1, color: 0xffffff, vertexColors: true });
addSway(grassMat, 0.075);
function crossPlanes(w, h){
  const a = new THREE.PlaneGeometry(w, h); a.translate(0, h / 2, 0);
  const b = a.clone(); b.rotateY(Math.PI / 2);
  return mergeGeos([{ geo: a, m: null }, { geo: b, m: null }]);
}
/* vertexColors sin atributo `color` en la geometría deja el atributo sin enlazar,
   y WebGL lo sirve como (0,0,0): todo se multiplica a negro. Hay que poner el
   blanco explícito para que el color por instancia tenga sobre qué multiplicar. */
function conColorBlanco(geo){
  const n = geo.attributes.position.count;
  const c = new Float32Array(n * 3).fill(1);
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return geo;
}
/* tres planos en estrella: de cerca la mata tiene volumen desde cualquier ángulo */
function starPlanes(n, w, h){
  const parts = [];
  for (let i = 0; i < n; i++){
    const p = new THREE.PlaneGeometry(w, h);
    p.translate(0, h / 2, 0); p.rotateY(i * Math.PI / n);
    parts.push({ geo: p, m: null });
  }
  return mergeGeos(parts);
}
const grassGeo = conColorBlanco(crossPlanes(0.55, 0.7));
/* capa lejana: rala a propósito, el suelo cercano lo cubre el césped de §5c */
const GRASS_DENS = { claro: 780, mixto: 420, frondoso: 320, pinar: 240, ribera: 560, roquedo: 45 };

/* Copas de planos recortados.
   Las normales reales de un montón de planos sueltos apuntan a cualquier parte y
   la copa se ilumina a manchas. Reorientarlas como si fueran una superficie lisa
   —esfera para frondosas, cilindro abierto para coníferas— es lo que hace que la
   masa de hojas lea como un volumen y no como un montón de cartulinas.
   El sesgo hacia arriba no es cosmético: sin él la mitad inferior de la copa
   apunta en contra del sol y se ve una masa negra desde debajo del árbol. La
   hoja real translúcida no hace eso, y este material no simula translucidez. */
function normalesDeVolumen(geo, cy, kY, sesgo){
  const pos = geo.attributes.position, nor = geo.attributes.normal;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++){
    v.set(pos.getX(i), (pos.getY(i) - cy) * kY, pos.getZ(i));
    if (v.lengthSq() < 1e-6) v.set(0, 1, 0);
    v.normalize();
    v.y += sesgo;
    v.normalize();
    nor.setXYZ(i, v.x, v.y, v.z);
  }
  nor.needsUpdate = true;
  return geo;
}

/* frondosa: racimos repartidos por una cáscara elipsoidal, cada uno con su giro */
function cardCrown(n, spread, alto, semilla){
  const parts = [], rnd = mulberry32(semilla);
  const E = new THREE.Euler(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S = new THREE.Vector3();
  for (let i = 0; i < n; i++){
    const a = i * 2.399, r = spread * Math.sqrt(rnd());
    const y = 0.24 + rnd() * alto;
    const s = 0.54 + rnd() * 0.40;
    E.set(rnd() * 6.283, rnd() * 6.283, rnd() * 6.283);
    Q.setFromEuler(E);
    V.set(Math.cos(a) * r, y, Math.sin(a) * r);
    S.set(s, s, s);
    parts.push({ geo: new THREE.PlaneGeometry(1, 1), m: new THREE.Matrix4().compose(V, Q, S) });
  }
  return normalesDeVolumen(mergeGeos(parts), 0.62, 1.15, 0.55);
}

/* conífera: pisos de ramillas que salen del eje y caen; la silueta dentada sale
   del alfa de la ramilla, no de un cono con más segmentos */
function cardConifer(pisos, porPiso, semilla){
  const parts = [], rnd = mulberry32(semilla);
  const EJE_Y = new THREE.Vector3(0, 1, 0), EJE_Z = new THREE.Vector3(0, 0, 1), EJE_X = new THREE.Vector3(1, 0, 0);
  const qy = new THREE.Quaternion(), qz = new THREE.Quaternion(), qx = new THREE.Quaternion();
  const V = new THREE.Vector3(), S = new THREE.Vector3();
  for (let i = 0; i < pisos; i++){
    const t = i / (pisos - 1);
    const r = 1 - t * 0.70;                       // el piso de arriba es el más corto
    const y = 0.04 + t * 0.88;
    for (let j = 0; j < porPiso; j++){
      const a = (j / porPiso) * 6.283 + i * 0.83 + rnd() * 0.25;
      const largo = r * (0.78 + rnd() * 0.24);
      const caida = -0.22 - rnd() * 0.24 - t * 0.1;
      // 1 × 0,75 y escala igual en x y z: la proporción del plano tiene que ser la
      // de la textura (256×192) o la ramilla sale estirada como un alambre
      const g = new THREE.PlaneGeometry(1, 0.75);
      g.rotateX(-Math.PI / 2);                    // tumbada
      g.translate(0.5, 0, 0);                     // anclada al tronco por un extremo
      qy.setFromAxisAngle(EJE_Y, a);
      qz.setFromAxisAngle(EJE_Z, caida);
      qx.setFromAxisAngle(EJE_X, (rnd() - 0.5) * 0.5);   // alabeo, que no queden planas
      V.set(0, y, 0);
      S.set(largo, 1, largo);
      parts.push({ geo: g, m: new THREE.Matrix4().compose(V, qy.clone().multiply(qz).multiply(qx), S) });
    }
  }
  return normalesDeVolumen(mergeGeos(parts), 0.5, 0.45, 0.5);
}

const N_HOJA = isTouch ? 9 : 17;
const N_PISO = isTouch ? 4 : 6, N_RAMA = isTouch ? 6 : 9;
const geoPino = cardConifer(N_PISO, N_RAMA, 5171), geoCopa = cardCrown(N_HOJA, 0.60, 0.46, 7331);

/* Las sombras necesitan su propio material: three r128 no traslada map ni
   alphaTest al paso de profundidad, así que sin esto los árboles proyectarían
   la sombra de los rectángulos enteros en vez de la de las hojas. */
function depthDeCopa(tex){
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking,
    map: tex, alphaTest: ALFA_COPA, side: THREE.DoubleSide });
  addSway(m, 0.010);                    // que la sombra se mueva con la copa
  return m;
}
const depthHoja = depthDeCopa(leafCardTex), depthAcicula = depthDeCopa(needleTex);

/* especies: alturas, copa y lo que dan al cortar */
const SPECIES = {
  pino:   { trunk: 'bark',  fol: 'pine',  folMat: pineMat,  hmin: 9,  hvar: 9, radK: 0.20, fy: 0.36, fh: 0.72, drop: 'resina',  lena: 5, dureza: 6, geo: makeTrunk(0.30, 0.13, 6, 0.42, 1.15, 1.62, 0.80, 0.62) },
  abeto:  { trunk: 'bark',  fol: 'pine',  folMat: abetoMat, hmin: 11, hvar: 8, radK: 0.17, fy: 0.30, fh: 0.78, drop: 'resina',  lena: 6, dureza: 7, geo: makeTrunk(0.28, 0.11, 7, 0.38, 1.00, 1.66, 0.78, 0.62) },
  roble:  { trunk: 'bark',  fol: 'oak',   folMat: oakMat2,  hmin: 6,  hvar: 6, radK: 0.40, fy: 0.50, fh: 0.55, drop: 'bellota', lena: 7, dureza: 9, geo: makeTrunk(0.42, 0.22, 5, 0.58, 2.00, 0.85, 0.88, 0.34) },
  abedul: { trunk: 'birch', fol: 'oak',   folMat: alisoMat, hmin: 6,  hvar: 5, radK: 0.26, fy: 0.55, fh: 0.48, drop: 'corteza', lena: 3, dureza: 4, geo: makeTrunk(0.20, 0.09, 4, 0.64, 1.20, 1.00, 0.88, 0.34) },
  aliso:  { trunk: 'bark',  fol: 'oak',   folMat: alisoMat, hmin: 5,  hvar: 5, radK: 0.32, fy: 0.52, fh: 0.50, drop: 'corteza', lena: 4, dureza: 5, geo: makeTrunk(0.24, 0.12, 5, 0.60, 1.55, 0.95, 0.88, 0.34) }
};

const gStick = new THREE.CylinderGeometry(0.045, 0.055, 1.1, 5); gStick.rotateZ(Math.PI / 2.2);
const gLog = new THREE.CylinderGeometry(0.11, 0.13, 1.3, 6); gLog.rotateZ(Math.PI / 2);
const gRock = new THREE.IcosahedronGeometry(0.34, 0);
const gBush = new THREE.SphereGeometry(0.62, 8, 6);
const gTuft = new THREE.ConeGeometry(0.34, 0.8, 5); gTuft.translate(0, 0.4, 0);
const gLeaf = new THREE.CylinderGeometry(0.5, 0.55, 0.08, 8);

/* agua */
const waterMat = new THREE.MeshStandardMaterial({ color: 0x24454b, transparent: true, opacity: 0.88,
  roughness: 0.07, metalness: 0.0, normalMap: waterNrm, normalScale: new THREE.Vector2(0.55, 0.55) });
const water = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), waterMat);
water.rotation.x = -Math.PI / 2; water.position.y = WATER; water.renderOrder = -1;
scene.add(water);

/* lluvia */
const rainCount = 1400;
const rainGeo = new THREE.BufferGeometry();
const rainPos = new Float32Array(rainCount * 3);
for (let i = 0; i < rainCount; i++){
  rainPos[i * 3] = (Math.random() - 0.5) * 46;
  rainPos[i * 3 + 1] = Math.random() * 24;
  rainPos[i * 3 + 2] = (Math.random() - 0.5) * 46;
}
rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
const rain = new THREE.Points(rainGeo, new THREE.PointsMaterial({ color: 0xa9c3d0, size: 0.08, transparent: true, opacity: 0.5 }));
rain.visible = false; scene.add(rain);

/* ---------- 5b. pasada de imagen ---------- */
let post = !isTouch;
const rt = new THREE.WebGLRenderTarget(1, 1, {
  minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat });
rt.texture.encoding = THREE.sRGBEncoding;
const postScene = new THREE.Scene();
const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const postMat = new THREE.ShaderMaterial({
  uniforms: { tDiffuse: { value: rt.texture }, uTime: { value: 0 }, uNoche: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
  fragmentShader: [
    'varying vec2 vUv; uniform sampler2D tDiffuse; uniform float uTime; uniform float uNoche;',
    'void main(){',
    '  vec3 col = texture2D(tDiffuse, vUv).rgb;',
    '  col = (col - 0.5) * 1.07 + 0.5;',                       // contraste
    '  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));',
    '  col = mix(vec3(lum), col, mix(1.14, 0.82, uNoche));',    // de noche desatura
    '  col *= mix(vec3(1.0), vec3(0.86, 0.94, 1.18), uNoche);', // y azulea
    '  vec2 d = vUv - 0.5;',
    '  col *= 1.0 - dot(d, d) * (0.55 + uNoche * 0.5);',        // viñeta
    '  float g = fract(sin(dot(vUv * (uTime + 1.0), vec2(12.9898, 78.233))) * 43758.5453);',
    '  col += (g - 0.5) * 0.020;',                              // grano
    '  gl_FragColor = vec4(col, 1.0);',
    '}'].join('\n')
});
postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMat));
function resizeRT(){
  rt.setSize(Math.floor(innerWidth * renderer.getPixelRatio()), Math.floor(innerHeight * renderer.getPixelRatio()));
}

let calidad = isTouch ? 'medio' : 'alto';
function setCalidad(v){
  calidad = v;
  renderer.setPixelRatio(Math.min(devicePixelRatio, v === 'alto' ? 1.8 : v === 'medio' ? 1.35 : 1));
  renderer.shadowMap.enabled = v !== 'bajo';
  post = v === 'alto';
  scene.traverse(o => { if (o.material && o.material.needsUpdate !== undefined) o.material.needsUpdate = true; });
  renderer.setSize(innerWidth, innerHeight);
  resizeRT();
  construirCesped();
  try{ storage.set('raiz:gfx', v); } catch(e){}
}
try{ storage.get('raiz:gfx').then(r => { if (r && r.value) setCalidad(r.value); }).catch(() => {}); } catch(e){}

/* ---------- 5c. césped cercano ----------
   Una alfombra densa que sigue al jugador. Rejilla toroidal: la ventana de celdas
   se mueve con él y solo se rellenan las que entran nuevas, así no hay tirón.
   La hierba del chunk (§5) sigue cubriendo lo lejano, mucho más rala. */
const cespedCen = { value: new THREE.Vector3() };
const cespedRad = { value: 1 };
const cespedMat = new THREE.MeshStandardMaterial({ map: grassTex, alphaTest: 0.4, transparent: false,
  side: THREE.DoubleSide, roughness: 1, vertexColors: true });
addSway(cespedMat, 0.075, true);
/* Matas anchas y solapadas: leen como pradera continua con muchas menos
   instancias que briznas finas separadas. */
const cespedGeo = conColorBlanco(starPlanes(3, 0.62, 0.58));

/* probabilidad de que una brizna prenda, por bioma: el claro es un prado,
   el pinar es agujas y el roquedo es piedra */
const CESPED_DENS = { claro: 1, ribera: 0.95, mixto: 0.85, frondoso: 0.7, pinar: 0.5, roquedo: 0.1 };
const CESPED_K = { alto: 150, medio: 78, bajo: 0 };      // matas por celda de 4×4 m
const CERO = new THREE.Matrix4().makeScale(0, 0, 0);
const cesped = { mesh: null, cells: 0, lado: 4, K: 0, slots: [],
  M: new THREE.Matrix4(), Q: new THREE.Quaternion(), E: new THREE.Euler(),
  V: new THREE.Vector3(), S: new THREE.Vector3(), C: new THREE.Color() };
let cespedFull = true;

function construirCesped(){
  if (cesped.mesh){ scene.remove(cesped.mesh); cesped.mesh.dispose(); cesped.mesh = null; }
  const K = Math.round((CESPED_K[calidad] || 0) * (isTouch ? 0.45 : 1));
  const cells = isTouch ? 10 : 16;
  cesped.K = K; cesped.cells = cells; cesped.slots = new Array(cells * cells).fill('');
  cespedRad.value = cells * cesped.lado * 0.5;
  cespedFull = true;
  if (!K) return;
  const im = new THREE.InstancedMesh(cespedGeo, cespedMat, cells * cells * K);
  im.receiveShadow = true;
  im.frustumCulled = false;                               // la ventana ya es el recorte
  im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  // setColorAt reserva el buffer a ceros, o sea a negro: hay que blanquearlo entero
  // o cualquier instancia sin color asignado saldría como una mancha oscura.
  cesped.C.setRGB(1, 1, 1);
  for (let i = 0; i < im.count; i++){ im.setMatrixAt(i, CERO); im.setColorAt(i, cesped.C); }
  scene.add(im);
  cesped.mesh = im;
}

/* El bioma y la pendiente se evalúan una vez por celda (4 esquinas) y se interpolan:
   por brizna solo queda un heightAt, que es lo que hace esto viable */
function llenarCelda(wi, wj, slot){
  const im = cesped.mesh, K = cesped.K, lado = cesped.lado;
  const x0 = wi * lado, z0 = wj * lado;
  const h = [], p = [];
  for (let e = 0; e < 4; e++){
    const ex = x0 + (e & 1) * lado, ez = z0 + (e >> 1) * lado;
    const y = heightAt(ex, ez);
    h.push(y);
    const b = biomeAt(ex, ez, y);
    // el dosel cerrado no deja prender la hierba, pero clarea, no arrasa
    p.push((CESPED_DENS[b] || 0.5) * (1 - 0.25 * clamp(BIOME[b].dens * (treeNoise(ex, ez) * 0.6 + 0.4) * 1.35, 0, 1)));
  }
  const dhx = ((h[1] + h[3]) - (h[0] + h[2])) * 0.5 / lado;
  const dhz = ((h[2] + h[3]) - (h[0] + h[1])) * 0.5 / lado;
  const kPend = clamp(1 - Math.sqrt(dhx * dhx + dhz * dhz) * 0.7, 0.25, 1);    // solo el talud fuerte pela
  const base = slot * K;
  const { M, Q, E, V, S, C } = cesped;
  const rng = mulberry32((wi * 374761393 ^ wj * 668265263 ^ SEED) >>> 0);
  for (let k = 0; k < K; k++){
    const u = rng(), v = rng(), r1 = rng(), r2 = rng(), r3 = rng();
    const x = x0 + u * lado, z = z0 + v * lado;
    const prob = lerp(lerp(p[0], p[1], u), lerp(p[2], p[3], u), v) * kPend;
    if (r1 >= prob){ im.setMatrixAt(base + k, CERO); continue; }
    const y = heightAt(x, z);
    if (y < WATER + 0.12 || y > 44){ im.setMatrixAt(base + k, CERO); continue; }
    const seco = r2;                                       // reparto verde/seco dentro de la mata
    const s = 0.7 + r2 * 0.85;
    E.set((r3 - 0.5) * 0.28, r3 * 6.28, (r1 / prob - 0.5) * 0.28);   // caída ligera, no todas rectas
    Q.setFromEuler(E);
    V.set(x, y - 0.05, z);
    S.set(s, s * (0.75 + r3 * 0.6), s);
    im.setMatrixAt(base + k, M.compose(V, Q, S));
    // multiplica la textura casi neutra: verde de sotobosque a paja seca.
    // Apagado a propósito, que el follaje de los árboles también lo está.
    if (seco > 0.8) C.setRGB(0.74, 0.66, 0.44);
    else C.setRGB(0.40 + seco * 0.24, 0.50 + seco * 0.18, 0.30 + seco * 0.12);
    im.setColorAt(base + k, C);
  }
}

function marcarRango(attr, desde, cuantas, itemSize, total, entero){
  attr.needsUpdate = true;
  if (entero || cuantas >= total){ attr.updateRange.offset = 0; attr.updateRange.count = -1; return; }
  attr.updateRange.offset = desde * itemSize;
  attr.updateRange.count = cuantas * itemSize;
}

function updateCesped(){
  const im = cesped.mesh;
  if (!im || !cesped.K) return;
  cespedCen.value.copy(player.pos);
  const cells = cesped.cells, lado = cesped.lado, half = cells >> 1;
  const ci = Math.floor(player.pos.x / lado) - half, cj = Math.floor(player.pos.z / lado) - half;
  let presu = cespedFull ? cells * cells : 3;              // al arrancar o al cargar, de golpe
  let lo = Infinity, hi = -1;
  for (let a = 0; a < cells && presu > 0; a++) for (let b = 0; b < cells && presu > 0; b++){
    const wi = ci + a, wj = cj + b;
    const id = wi + ',' + wj;
    const slot = (((wi % cells) + cells) % cells) * cells + (((wj % cells) + cells) % cells);
    if (cesped.slots[slot] === id) continue;
    cesped.slots[slot] = id;
    llenarCelda(wi, wj, slot);
    if (slot < lo) lo = slot;
    if (slot > hi) hi = slot;
    presu--;
  }
  if (hi >= 0){
    // Sin acotar el rango se resubirían las ~38 000 matrices enteras cada vez que
    // cruzas una celda, varias veces por segundo. Solo sube el tramo tocado.
    const K = cesped.K, total = cesped.slots.length * K;
    marcarRango(im.instanceMatrix, lo * K, (hi - lo + 1) * K, 16, total, cespedFull);
    if (im.instanceColor) marcarRango(im.instanceColor, lo * K, (hi - lo + 1) * K, 3, total, cespedFull);
  }
  cespedFull = false;
}
construirCesped();

/* ---------- 6. chunks ---------- */
const chunks = new Map();
const key = (i, j) => i + ',' + j;

/* El mundo se regenera del seed; lo único que se guarda es lo que TÚ has cambiado */
let worldDiff = {};
function diffFor(ci, cj){
  const k = key(ci, cj);
  return worldDiff[k] || (worldDiff[k] = { r: {}, t: {} });
}
function addStump(t, grp){
  const tocon = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.45, 7), woodMat);
  tocon.position.set(t.x, t.y + 0.2, t.z); tocon.castShadow = true;
  (grp || t.grp || scene).add(tocon);
}

function buildChunk(ci, cj){
  const grp = new THREE.Group();
  const ox = ci * CHUNK + CHUNK / 2, oz = cj * CHUNK + CHUNK / 2; // centro del chunk

  /* terreno */
  const geo = new THREE.PlaneGeometry(CHUNK, CHUNK, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, heightAt(pos.getX(i) + ox, pos.getZ(i) + oz));
  geo.computeVertexNormals();
  const nrm = geo.attributes.normal;
  const col = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++){
    const x = pos.getX(i) + ox, y = pos.getY(i), z = pos.getZ(i) + oz;
    const slope = nrm.getY(i);
    const m = moistAt(x, z);
    const soil = BIOME[biomeAt(x, z, y, m)].soil;
    if (y < WATER + 0.8) c.setRGB(0.42, 0.36, 0.24);               // arena y limo de orilla
    else c.setRGB(soil[0], soil[1], soil[2]);
    if (slope < 0.86 || y > 48){                                   // pedregal en pendiente
      const k = clamp((0.86 - slope) * 6 + (y - 48) * 0.1, 0, 1);
      c.lerp(new THREE.Color(0.44, 0.42, 0.39), k);
    }
    const humus = fbm(x * 0.035 + 12, z * 0.035 - 7, 2);           // manchas de humus y hojarasca
    c.lerp(new THREE.Color(0.33, 0.27, 0.16), clamp((humus - 0.55) * 1.6, 0, 0.5));
    const sombraDosel = 1 - 0.24 * clamp(BIOME[biomeAt(x, z, y, m)].dens * (treeNoise(x, z) * 0.6 + 0.4) * 1.35, 0, 1);
    const n = (fbm(x * 0.09, z * 0.09, 2) * 0.22 + 0.9) * sombraDosel;
    col[i * 3] = c.r * n; col[i * 3 + 1] = c.g * n; col[i * 3 + 2] = c.b * n;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const ground = new THREE.Mesh(geo, terrainMat);
  ground.receiveShadow = true;
  ground.position.set(ox, 0, oz);
  grp.add(ground);

  /* árboles */
  const M2 = new THREE.Matrix4(), Q2 = new THREE.Quaternion(), V2 = new THREE.Vector3(), S2 = new THREE.Vector3();
  const AXIS2 = new THREE.Vector3(0, 1, 0);
  const rng = mulberry32((ci * 73856093 ^ cj * 19349663 ^ SEED) >>> 0);
  const bySp = {}, trees = [];
  const N = 17;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++){
    const x = ci * CHUNK + (i + rng()) * CHUNK / N, z = cj * CHUNK + (j + rng()) * CHUNK / N;
    const y = heightAt(x, z);
    if (y < WATER + 1.0 || y > 46) continue;
    const slope = Math.abs(heightAt(x + 2, z) - y) + Math.abs(heightAt(x, z + 2) - y);
    if (slope > 3.4) continue;
    const m = moistAt(x, z);
    const b = BIOME[biomeAt(x, z, y, m)];
    const d = treeNoise(x, z) * 0.6 + 0.4;
    if (rng() > b.dens * d * 1.35) continue;
    const name = b.sp[Math.floor(rng() * b.sp.length)];
    const sp = SPECIES[name];
    const h = sp.hmin + rng() * sp.hvar;
    const t = { x, y, z, h, species: name, rad: h * sp.radK, rot: rng() * 6.28,
                r: 0.42 + h * 0.028, hp: sp.dureza, cool: 0, felled: false };
    (bySp[name] = bySp[name] || []).push(t);
    t.ci = ci; t.cj = cj; t.ti = trees.length; t.grp = grp;
    trees.push(t);
  }
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S = new THREE.Vector3();
  const AXIS = new THREE.Vector3(0, 1, 0);
  Object.keys(bySp).forEach(name => {
    const list = bySp[name], sp = SPECIES[name];
    const trunkIM = new THREE.InstancedMesh(sp.geo, sp.trunk === 'birch' ? birchMat : barkMat, list.length);
    const folIM = new THREE.InstancedMesh(sp.fol === 'pine' ? geoPino : geoCopa, sp.folMat, list.length);
    folIM.customDepthMaterial = sp.fol === 'pine' ? depthAcicula : depthHoja;
    trunkIM.castShadow = folIM.castShadow = true; trunkIM.receiveShadow = true;
    list.forEach((t, k) => {
      Q.setFromAxisAngle(AXIS, t.rot);
      V.set(t.x, t.y, t.z); S.setScalar(t.h / REF_H);
      trunkIM.setMatrixAt(k, M.compose(V, Q, S));
      V.set(t.x, t.y + t.h * sp.fy, t.z); S.set(t.rad, t.h * sp.fh, t.rad);
      folIM.setMatrixAt(k, M.compose(V, Q, S));
      t.idx = k; t.trunkIM = trunkIM; t.folIM = folIM;
    });
    trunkIM.instanceMatrix.needsUpdate = folIM.instanceMatrix.needsUpdate = true;
    grp.add(trunkIM); grp.add(folIM);
  });

  /* hierba alta y matas secas */
  const gd = Math.round((GRASS_DENS[biomeAt(ci * CHUNK + 48, cj * CHUNK + 48)] || 200) * (isTouch ? 0.45 : 1));
  if (gd > 0){
    const puestas = [];
    for (let n = 0; n < gd; n++){
      const x = ci * CHUNK + rng() * CHUNK, z = cj * CHUNK + rng() * CHUNK;
      const y = heightAt(x, z);
      if (y < WATER + 0.15 || y > 44) continue;
      puestas.push({ x, y, z, s: 0.7 + rng() * 0.9, r: rng() * 6.28, seco: rng() });
    }
    if (puestas.length){
      const gm = new THREE.InstancedMesh(grassGeo, grassMat, puestas.length);
      gm.receiveShadow = true;
      const cc = new THREE.Color();
      puestas.forEach((t, k) => {
        Q2.setFromAxisAngle(AXIS2, t.r);
        V2.set(t.x, t.y - 0.05, t.z); S2.set(t.s, t.s * (0.8 + t.seco * 0.9), t.s);
        gm.setMatrixAt(k, M2.compose(V2, Q2, S2));
        if (gm.setColorAt){
          const seco = t.seco > 0.72;
          cc.setRGB(seco ? 0.72 : 0.46 + t.seco * 0.2, seco ? 0.62 : 0.58, seco ? 0.36 : 0.30);
          gm.setColorAt(k, cc);
        }
      });
      gm.instanceMatrix.needsUpdate = true;
      if (gm.instanceColor) gm.instanceColor.needsUpdate = true;
      grp.add(gm);

      // capa baja: mata el suelo pelado a media distancia (de cerca ya lo hace el césped de §5c)
      const nb = Math.round(puestas.length * (isTouch ? 0.6 : 1.0));
      const bm = new THREE.InstancedMesh(grassGeo, grassMat, nb);
      const cb = new THREE.Color();
      for (let n = 0; n < nb; n++){
        const x = ci * CHUNK + rng() * CHUNK, z = cj * CHUNK + rng() * CHUNK;
        const y = heightAt(x, z);
        Q2.setFromAxisAngle(AXIS2, rng() * 6.28);
        const e = 0.34 + rng() * 0.3;
        V2.set(x, y - 0.04, z); S2.set(e * 1.5, e, e * 1.5);
        bm.setMatrixAt(n, M2.compose(V2, Q2, S2));
        if (bm.setColorAt){
          const sec = rng();
          cb.setRGB(0.40 + sec * 0.3, 0.46 + sec * 0.12, 0.24 + sec * 0.1);
          bm.setColorAt(n, cb);
        }
      }
      bm.instanceMatrix.needsUpdate = true;
      if (bm.instanceColor) bm.instanceColor.needsUpdate = true;
      grp.add(bm);
    }
  }

  /* maleza, troncos caídos, tocones huecos y pedruscos: hay que rebuscar */
  const bioma = biomeAt(ci * CHUNK + 48, cj * CHUNK + 48);
  const EXTRA = { maleza: bioma === 'claro' ? 7 : bioma === 'frondoso' ? 8 : 5,
                  troncoCaido: bioma === 'frondoso' || bioma === 'pinar' ? 3 : 1,
                  toconHueco: bioma === 'roquedo' ? 0 : 2,
                  rocaGrande: bioma === 'roquedo' ? 4 : bioma === 'claro' ? 1 : 1 };

  /* recursos recolectables */
  const res = [];
  for (let n = 0; n < 36; n++){
    const x = ci * CHUNK + rng() * CHUNK, z = cj * CHUNK + rng() * CHUNK;
    const y = heightAt(x, z);
    if (y < WATER + 0.5 || y > 46) continue;
    const pool = RESBIOME[biomeAt(x, z, y)];
    const kind = pool[Math.floor(rng() * pool.length)];
    const o = makeResource(kind, x, y, z, rng);
    o.mesh.position.set(x, y + o.yoff, z);
    grp.add(o.mesh);
    o.ci = ci; o.cj = cj; o.ri = res.length;
    res.push(o);
  }
  /* reaplicar lo que el jugador ya hizo aquí */
  const df = worldDiff[key(ci, cj)];
  if (df){
    Object.keys(df.r).forEach(i => {
      const r = res[i]; if (!r) return;
      r.cooldown = df.r[i];
      if (!PROPS[r.kind]) r.mesh.visible = false;
    });
    Object.keys(df.t).forEach(i => {
      const t = trees[i]; if (!t) return;
      const [hp, fol, felled, cool] = df.t[i];
      t.hp = hp; t.fol = fol; t.cool = cool || 0;
      if (felled){
        t.felled = true; t.r = 0;
        const M0 = new THREE.Matrix4().makeScale(0.001, 0.001, 0.001);
        t.trunkIM.setMatrixAt(t.idx, M0); t.folIM.setMatrixAt(t.idx, M0);
        t.trunkIM.instanceMatrix.needsUpdate = t.folIM.instanceMatrix.needsUpdate = true;
        addStump(t, grp);
      } else if (fol !== undefined && fol < 1) refreshFoliage(t);
    });
  }
  spawnFauna(ci, cj, rng);
  Object.keys(EXTRA).forEach(kind => {
    for (let n = 0; n < EXTRA[kind]; n++){
      const x = ci * CHUNK + rng() * CHUNK, z = cj * CHUNK + rng() * CHUNK;
      const y = heightAt(x, z);
      if (y < WATER + 0.5 || y > 46) continue;
      const o = makeResource(kind, x, y, z, rng);
      o.mesh.position.set(x, y + o.yoff, z);
      o.mesh.rotation.y = rng() * 6.28;
      grp.add(o.mesh);
      o.ci = ci; o.cj = cj; o.ri = res.length; o.usos = kind === 'troncoCaido' ? 4 : 3;
      res.push(o);
    }
  });
  spawnFauna(ci, cj, rng);
  scene.add(grp);
  return { grp, trees, res, ci, cj };
}

const RESBIOME = {
  claro:    ['fibra', 'fibra', 'bayas', 'piedra', 'yesca', 'musgo'],
  pinar:    ['yesca', 'agujas', 'agujas', 'piedra', 'musgo', 'palo', 'setas'],
  mixto:    ['yesca', 'fibra', 'bayas', 'piedra', 'musgo', 'palo'],
  frondoso: ['musgo', 'musgo', 'yesca', 'bayas', 'fibra', 'setas', 'palo'],
  ribera:   ['junco', 'junco', 'junco', 'piedra', 'musgo', 'fibra', 'bayas'],
  roquedo:  ['piedra', 'piedra', 'silex', 'silex', 'yesca', 'musgo']
};

function marcarArbol(t){
  if (t.ci === undefined) return;
  diffFor(t.ci, t.cj).t[t.ti] = [t.hp, t.fol === undefined ? 1 : t.fol, !!t.felled, t.cool];
}
function refreshFoliage(t){
  const sp = SPECIES[t.species];
  const f = t.fol === undefined ? 1 : t.fol;
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), t.rot);
  M.compose(new THREE.Vector3(t.x, t.y + t.h * sp.fy, t.z), Q,
            new THREE.Vector3(t.rad * f, t.h * sp.fh * f, t.rad * f));
  t.folIM.setMatrixAt(t.idx, M);
  t.folIM.instanceMatrix.needsUpdate = true;
}

const PROPS = { maleza: 1, troncoCaido: 1, toconHueco: 1, rocaGrande: 1 };
const BOTIN = {
  maleza: () => [['yesca', 2], ['fibra', 2], ['bayas', 3], ['larva', 1], ['setas', 1], ['palo', 2], ['musgo', 2]],
  toconHueco: () => [['larva', 2], ['yesca', 3], ['musgo', 2], ['setas', 2], ['carbon', 1]],
  rocaGrande: () => [['silex', 1], ['larva', 2], ['piedra', 2], ['musgo', 1]],
  troncoCaido: () => enMano === 'hacha'
    ? [['lena', 3], ['lena', 2], ['corteza', 2], ['larva', 2]]
    : [['corteza', 2], ['yesca', 2], ['larva', 1], ['musgo', 2]]
};

function makeResource(kind, x, y, z, rng){
  let mesh;
  if (kind === 'lena'){ mesh = new THREE.Mesh(gLog, woodMat); mesh.rotation.y = rng() * 6.28; }
  else if (kind === 'palo'){ mesh = new THREE.Mesh(gStick, woodMat); mesh.rotation.y = rng() * 6.28; }
  else if (kind === 'piedra'){ mesh = new THREE.Mesh(gRock, rockMat); mesh.scale.setScalar(0.7 + rng() * 0.8); }
  else if (kind === 'yesca'){ mesh = new THREE.Mesh(gLeaf, dryMat); mesh.scale.set(1 + rng(), 1, 1 + rng()); }
  else if (kind === 'fibra'){ mesh = new THREE.Mesh(gTuft, fiberMat); mesh.scale.setScalar(0.8 + rng() * 0.6); }
  else if (kind === 'junco'){ mesh = new THREE.Mesh(gTuft, reedMat); mesh.scale.set(0.7, 2.4 + rng(), 0.7); }
  else if (kind === 'musgo'){ mesh = new THREE.Mesh(gLeaf, mossMat); mesh.scale.set(1.2 + rng(), 0.6, 1.2 + rng()); }
  else if (kind === 'silex'){ mesh = new THREE.Mesh(gRock, flintMat); mesh.scale.setScalar(0.45 + rng() * 0.3); }
  else if (kind === 'setas'){ mesh = new THREE.Mesh(gTuft, dryMat); mesh.scale.set(0.5, 0.35, 0.5); }
  else if (kind === 'agujas'){ mesh = new THREE.Mesh(gLeaf, dryMat); mesh.scale.set(1.1 + rng(), 0.4, 1.1 + rng()); }
  else if (kind === 'maleza'){
    mesh = new THREE.Mesh(gBush, bushMat);
    mesh.scale.set(1.3 + rng() * 0.9, 0.85 + rng() * 0.5, 1.3 + rng() * 0.9);
  }
  else if (kind === 'troncoCaido'){
    mesh = new THREE.Mesh(gLog, woodMat);
    mesh.scale.set(2.6 + rng() * 2.2, 2.2 + rng(), 2.2 + rng());
  }
  else if (kind === 'toconHueco'){
    mesh = new THREE.Group();
    const fuera = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.62, 9, 1, true), woodMat);
    fuera.position.y = 0.31; mesh.add(fuera);
    const dentro = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.06, 9), dryMat);
    dentro.position.y = 0.18; mesh.add(dentro);
  }
  else if (kind === 'rocaGrande'){
    mesh = new THREE.Mesh(gRock, rockMat);
    mesh.scale.set(2.2 + rng() * 2.4, 1.6 + rng() * 1.6, 2.2 + rng() * 2.2);
  }
  else { mesh = new THREE.Mesh(gBush, bushMat); mesh.scale.setScalar(0.8 + rng() * 0.5); }
  if (mesh.isMesh) mesh.castShadow = true; else mesh.traverse(o => { if (o.isMesh) o.castShadow = true; });
  const off = { lena: 0.13, palo: 0.07, piedra: 0.2, yesca: 0.04, fibra: 0.02, bayas: 0.55,
                junco: 0.0, musgo: 0.03, silex: 0.12, setas: 0.02, agujas: 0.02,
                maleza: 0.25, troncoCaido: 0.28, toconHueco: 0.0, rocaGrande: 0.3 }[kind] || 0;
  return { kind, x, y, z, mesh, cooldown: 0, yoff: off };
}

function updateChunks(){
  const ci = Math.floor(player.pos.x / CHUNK), cj = Math.floor(player.pos.z / CHUNK);
  for (let i = ci - VIEW; i <= ci + VIEW; i++)
    for (let j = cj - VIEW; j <= cj + VIEW; j++)
      if (!chunks.has(key(i, j))) chunks.set(key(i, j), buildChunk(i, j));
  chunks.forEach((c, k) => {
    const [i, j] = k.split(',').map(Number);
    if (Math.abs(i - ci) > VIEW || Math.abs(j - cj) > VIEW){
      scene.remove(c.grp);
      quitarFauna(i, j);
      c.grp.traverse(o => { if (o.geometry && o.geometry.type === 'PlaneGeometry') o.geometry.dispose(); });
      chunks.delete(k);
    }
  });
}
function nearChunks(){
  const ci = Math.floor(player.pos.x / CHUNK), cj = Math.floor(player.pos.z / CHUNK);
  const out = [];
  for (let i = ci - 1; i <= ci + 1; i++) for (let j = cj - 1; j <= cj + 1; j++){
    const c = chunks.get(key(i, j)); if (c) out.push(c);
  }
  return out;
}

function findSpawn(){
  let best = { x: 0, z: 0, score: -1e9 };
  for (let i = 0; i < 400; i++){
    const x = (Math.random() - 0.5) * 900, z = (Math.random() - 0.5) * 900;
    const y = heightAt(x, z);
    if (y < WATER + 1.5 || y > 30) continue;
    let nearWater = 999;
    for (let a = 0; a < 8; a++){
      const d = 12 + a * 9, th = Math.random() * 6.28;
      if (heightAt(x + Math.cos(th) * d, z + Math.sin(th) * d) < WATER) nearWater = Math.min(nearWater, d);
    }
    const score = -Math.abs(y - 8) - nearWater * 0.25 + treeNoise(x, z) * 6;
    if (score > best.score) best = { x, z, score };
  }
  return best;
}

/* ---------- 6a. fauna ---------- */
const fauna = [];
const FAUNA = {
  conejo: { r: 0.22, vel: 5.2, huida: 16, carne: 1, piel: 1, tendon: 0, col: 0x8a7a63, biomas: ['claro', 'mixto', 'pinar'], cautela: 1.5 },
  corzo:  { r: 0.55, vel: 6.4, huida: 26, carne: 4, piel: 1, tendon: 1, col: 0x8d6b45, biomas: ['frondoso', 'mixto', 'ribera'], cautela: 1.0 }
};
function makeAnimal(tipo){
  const d = FAUNA[tipo], g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: d.col, roughness: 1 });
  const cuerpo = new THREE.Mesh(new THREE.SphereGeometry(d.r, 8, 6), mat);
  cuerpo.scale.set(1.5, 0.95, 1); cuerpo.position.y = d.r * (tipo === 'corzo' ? 2.1 : 1.4);
  cuerpo.castShadow = true; g.add(cuerpo);
  const cabeza = new THREE.Mesh(new THREE.SphereGeometry(d.r * 0.55, 7, 5), mat);
  cabeza.position.set(0, d.r * (tipo === 'corzo' ? 2.9 : 1.9), -d.r * 1.5); cabeza.castShadow = true;
  cabeza.name = 'cabeza'; g.add(cabeza);
  for (let i = 0; i < 4; i++){
    const p = new THREE.Mesh(new THREE.CylinderGeometry(d.r * 0.12, d.r * 0.1, d.r * (tipo === 'corzo' ? 2.0 : 1.1), 4), mat);
    p.position.set((i % 2 ? 1 : -1) * d.r * 0.55, d.r * (tipo === 'corzo' ? 1.0 : 0.55), (i < 2 ? 1 : -1) * d.r * 0.8);
    g.add(p);
  }
  if (tipo === 'conejo'){
    for (let i = 0; i < 2; i++){
      const o = new THREE.Mesh(new THREE.BoxGeometry(d.r * 0.16, d.r * 0.7, d.r * 0.1), mat);
      o.position.set((i ? 1 : -1) * d.r * 0.22, d.r * 2.4, -d.r * 1.5); g.add(o);
    }
  }
  return g;
}
function spawnFauna(ci, cj, rng){
  const b = biomeAt(ci * CHUNK + 48, cj * CHUNK + 48);
  Object.keys(FAUNA).forEach(tipo => {
    if (FAUNA[tipo].biomas.indexOf(b) < 0) return;
    const n = rng() < 0.55 ? 1 : 0;
    for (let k = 0; k < n; k++){
      const x = ci * CHUNK + rng() * CHUNK, z = cj * CHUNK + rng() * CHUNK;
      const y = heightAt(x, z);
      if (y < WATER + 0.8 || y > 42) continue;
      const g = makeAnimal(tipo);
      g.position.set(x, y, z);
      scene.add(g);
      fauna.push({ tipo, mesh: g, x, z, y, hx: x, hz: z, dir: rng() * 6.28, estado: 'pasta',
                   alerta: 0, t: 0, ci, cj, vivo: true });
    }
  });
}
function updateFauna(dt){
  for (let i = fauna.length - 1; i >= 0; i--){
    const a = fauna[i], d = FAUNA[a.tipo];
    const dx = player.pos.x - a.x, dz = player.pos.z - a.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 130){ a.mesh.visible = false; continue; }
    a.mesh.visible = true;

    if (!a.vivo){ continue; }

    // detección: ruido, cercanía, postura, y si vas con antorcha
    const percibe = (ruido / Math.max(4, dist)) * 2 +
                    (dist < 22 ? (crouch ? 0.25 : 0.9) * (1 - dist / 22) * d.cautela : 0) +
                    (player.torch ? 0.5 : 0);
    a.alerta = clamp(a.alerta + (percibe - 0.45) * dt * 1.8, 0, 3);

    a.t -= dt;
    if (a.alerta > 2.2){
      if (a.estado !== 'huye'){ a.estado = 'huye'; a.t = 6 + Math.random() * 4; a.dir = Math.atan2(-dz, -dx); }
    } else if (a.alerta > 1.1) a.estado = 'alerta';
    else if (a.estado !== 'huye') a.estado = 'pasta';

    let v = 0;
    if (a.estado === 'huye'){
      v = d.vel;
      if (a.t <= 0){ a.estado = 'pasta'; a.alerta = 0.8; }
    } else if (a.estado === 'pasta'){
      v = 0.7;
      if (a.t <= 0){ a.t = 2 + Math.random() * 5; a.dir += (Math.random() - 0.5) * 2.4; }
      const haciaCasa = Math.hypot(a.x - a.hx, a.z - a.hz);
      if (haciaCasa > 34) a.dir = Math.atan2(a.hz - a.z, a.hx - a.x);
    }
    if (v){
      const nx = a.x + Math.cos(a.dir) * v * dt, nz = a.z + Math.sin(a.dir) * v * dt;
      const ny = heightAt(nx, nz);
      if (ny > WATER + 0.3 && ny < 44){ a.x = nx; a.z = nz; a.y = ny; }
      else a.dir += 1.8;
    }
    a.mesh.position.set(a.x, a.y, a.z);
    a.mesh.rotation.y = -a.dir + Math.PI / 2;
    // la cabeza se levanta al estar en alerta
    const cab = a.mesh.getObjectByName('cabeza');
    if (cab) cab.position.y += ((a.estado === 'pasta' ? d.r * (a.tipo === 'corzo' ? 2.4 : 1.6)
                                                     : d.r * (a.tipo === 'corzo' ? 3.1 : 2.1)) - cab.position.y) * Math.min(1, dt * 4);
  }
}
function quitarFauna(ci, cj){
  for (let i = fauna.length - 1; i >= 0; i--)
    if (fauna[i].ci === ci && fauna[i].cj === cj){ scene.remove(fauna[i].mesh); fauna.splice(i, 1); }
}

/* ---------- 6b. lo que llevas en la mano ---------- */
scene.add(camera);
const handGroup = new THREE.Group();
handGroup.position.set(0.3, -0.26, -0.5);
camera.add(handGroup);
const metalMat = new THREE.MeshStandardMaterial({ color: 0x8c8f96, roughness: 0.35, metalness: 0.6 });
const silexMat = new THREE.MeshStandardMaterial({ color: 0x4a4a52, roughness: 0.55, metalness: 0.1 });
const cueroMat = new THREE.MeshStandardMaterial({ color: 0x4a3421, roughness: 0.95 });
const llamaMat = new THREE.MeshBasicMaterial({ color: 0xffa347 });

function makeTool(kind){
  const g = new THREE.Group();
  if (kind === 'cuchillo'){
    const hoja = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.035, 0.22), metalMat);
    hoja.position.z = -0.14; g.add(hoja);
    const mango = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.12, 6), cueroMat);
    mango.rotation.x = Math.PI / 2; g.add(mango);
  } else if (kind === 'hacha'){
    const mango = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.02, 0.42, 6), woodMat);
    mango.rotation.x = Math.PI / 2.6; g.add(mango);
    const cabeza = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.11, 0.13), silexMat);
    cabeza.position.set(0, 0.14, -0.13); cabeza.rotation.x = 0.35; g.add(cabeza);
    const atado = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.008, 4, 8), fiberMat);
    atado.position.set(0, 0.1, -0.1); atado.rotation.y = Math.PI / 2; g.add(atado);
  } else if (kind === 'antorcha'){
    const palo = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.021, 0.4, 6), woodMat);
    palo.rotation.x = Math.PI / 2.6; g.add(palo);
    const cabeza = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.03, 0.1, 7), dryMat);
    cabeza.position.set(0, 0.15, -0.12); g.add(cabeza);
    const fuego = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 6), llamaMat);
    fuego.position.set(0, 0.26, -0.12); fuego.name = 'llama'; g.add(fuego);
  } else if (kind === 'lanza'){
    const asta = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.018, 1.25, 6), woodMat);
    asta.rotation.x = Math.PI / 2; asta.position.z = -0.3; g.add(asta);
    const punta = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.14, 5), silexMat);
    punta.rotation.x = -Math.PI / 2; punta.position.z = -0.95; g.add(punta);
    const atado = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.006, 4, 8), fiberMat);
    atado.rotation.y = Math.PI / 2; atado.position.z = -0.87; g.add(atado);
  }
  g.visible = false;
  handGroup.add(g);
  return g;
}
const TOOLS = { cuchillo: makeTool('cuchillo'), hacha: makeTool('hacha'),
                antorcha: makeTool('antorcha'), lanza: makeTool('lanza') };
const ORDEN_MANO = ['cuchillo', 'hacha', 'antorcha', 'lanza'];
let enMano = 'cuchillo', swing = 0, bob = 0;

function equipar(k){
  if (k !== 'cuchillo' && !inv[k]){ log('No llevas ' + (ITEMS[k] || k).toLowerCase() + '.'); return; }
  enMano = enMano === k ? null : k;
  if (enMano !== 'antorcha' && player.torch){ player.torch = false; torchLight.intensity = 0; }
  ORDEN_MANO.forEach(t => TOOLS[t].visible = (t === enMano));
  drawHotbar();
}
function drawHotbar(){
  hotbarEl.innerHTML = ORDEN_MANO.map((k, i) => {
    const tiene = k === 'cuchillo' || inv[k] > 0;
    return `<button class="slot ${enMano === k ? 'sel' : ''} ${tiene ? '' : 'no'}" data-mano="${k}">
      <i>${i + 1}</i>${ITEMS[k] ? ITEMS[k].split(' ')[0] : 'Cuchillo'}</button>`;
  }).join('');
  hotbarEl.querySelectorAll('[data-mano]').forEach(b => b.onclick = () => equipar(b.dataset.mano));
}

/* ---------- 7. estado del jugador ---------- */
const player = {
  pos: new THREE.Vector3(0, 0, 0), vel: new THREE.Vector3(),
  yaw: 0, pitch: 0, onGround: true,
  salud: 100, energia: 88, agua: 85, vigor: 100, temp: 36.8, mojado: 0,
  torch: false, torchFuel: 300, eye: 1.68
};
const inv = { lena: 0, palo: 0, piedra: 0, yesca: 0, fibra: 0, bayas: 0, setas: 0, corteza: 0, resina: 0,
  bellota: 0, junco: 0, musgo: 0, silex: 0, cordel: 0, carne: 0, asado: 0, aguaSucia: 0, aguaLimpia: 0,
  agujas: 0, carbon: 0, vendaje: 0, infusion: 0, torta: 0, cecina: 0,
  piel: 0, tendon: 0, pez: 0, pezAsado: 0, larva: 0, lanza: 0,
  antorcha: 0, hacha: 0, capa: 0, zurron: 0, calzado: 0, sombrero: 0 };
const NOCARGA = { hacha: 1, capa: 1, zurron: 1, antorcha: 1, calzado: 1, sombrero: 1, lanza: 1 };   // el equipo no ocupa mochila
const carga = () => Object.keys(inv).reduce((a, k) => a + (NOCARGA[k] ? 0 : inv[k]), 0);
const capacidad = () => 75 + (inv.zurron ? 45 + (qual.zurron || 0.3) * 100 : 0);
const flags = {};           // conocimiento desbloqueado
let dayCount = 1, timeOfDay = 6.2, weather = 'despejado', weatherT = 120, ambT = 12, sensacion = 12, cobijo = '';
const DAY_LENGTH = 900;      // segundos reales por día completo
const structures = [];       // hogueras, refugios, trampas

const ITEMS = {
  lena: 'Leña', palo: 'Palo', piedra: 'Piedra', silex: 'Sílex', yesca: 'Yesca', fibra: 'Fibra de ortiga',
  junco: 'Junco', musgo: 'Musgo', corteza: 'Corteza', resina: 'Resina', bellota: 'Bellotas',
  bayas: 'Bayas', setas: 'Setas', cordel: 'Cordel', carne: 'Carne cruda', asado: 'Carne asada',
  aguaSucia: 'Agua sin tratar', aguaLimpia: 'Agua potable', antorcha: 'Antorcha',
  piel: 'Piel', tendon: 'Tendón', pez: 'Pescado crudo', pezAsado: 'Pescado asado',
  larva: 'Larvas (cebo)', lanza: 'Lanza',
  agujas: 'Agujas de pino', carbon: 'Carbón', vendaje: 'Vendaje de musgo',
  infusion: 'Infusión de agujas', torta: 'Torta de bellota', cecina: 'Cecina',
  hacha: 'Hacha de piedra', capa: 'Capa de corteza y musgo', zurron: 'Zurrón de corteza',
  calzado: 'Calzado envuelto', sombrero: 'Sombrero de juncos'
};

const RECIPES = [
  { id: 'cordel', name: 'Cordel de fibras', base: { fibra: 2 }, extra: {}, give: 'cordel', note: 'ortiga trenzada' },
  { id: 'hoguera', name: 'Hoguera', base: { palo: 4, yesca: 1 },
    extra: { lena: { max: 3, q: .30 }, piedra: { max: 4, q: .25 }, corteza: { max: 2, q: .10 }, resina: { max: 1, q: .10 } },
    place: 'fire', note: 'con leña y piedras dura toda la noche' },
  { id: 'refugio', name: 'Refugio', base: { palo: 5 },
    extra: { corteza: { max: 6, q: .30 }, junco: { max: 8, q: .15 }, musgo: { max: 6, q: .10 }, cordel: { max: 2, q: .10 } },
    place: 'shelter', req: 'fuego', note: 'la corteza es el techo' },
  { id: 'cama', name: 'Cama del suelo', base: { yesca: 3 },
    extra: { junco: { max: 8, q: .35 }, musgo: { max: 6, q: .30 } }, place: 'bed', req: 'refugio', note: 'aísla de la tierra fría' },
  { id: 'capa', name: 'Capa de abrigo', base: { corteza: 3, cordel: 1 },
    extra: { musgo: { max: 8, q: .35 }, junco: { max: 6, q: .20 } }, give: 'capa', req: 'cordel', note: 'cuanto más relleno, más abriga' },
  { id: 'zurron', name: 'Zurrón', base: { corteza: 3, cordel: 1 },
    extra: { junco: { max: 8, q: .45 } }, give: 'zurron', req: 'cordel', note: 'más carga' },
  { id: 'hacha', name: 'Hacha de mano', base: { piedra: 1, palo: 1, cordel: 1 },
    extra: { silex: { max: 1, q: .45 }, resina: { max: 1, q: .20 } }, give: 'hacha', req: 'cordel', note: 'con sílex tala el doble de rápido' },
  { id: 'antorcha', name: 'Antorcha', base: { palo: 1, fibra: 1 },
    extra: { resina: { max: 2, q: .45 }, corteza: { max: 2, q: .20 } }, give: 'antorcha', req: 'fuego' },
  { id: 'yescaResina', name: 'Yesca de resina', base: { resina: 1 },
    extra: { corteza: { max: 2, q: .5 } }, give: 'yesca', req: 'fuego', note: 'prende hasta mojada' },
  { id: 'trampa', name: 'Trampa de lazo', base: { palo: 2, cordel: 1 },
    extra: { fibra: { max: 3, q: .40 } }, place: 'trap', req: 'dia3' },
  { id: 'lanza', name: 'Lanza', base: { palo: 1, piedra: 1, cordel: 1 },
    extra: { silex: { max: 1, q: .45 }, resina: { max: 1, q: .20 } }, give: 'lanza', req: 'cordel', note: 'caza y pesca' },
  { id: 'cuerdaTendon', name: 'Cuerda de tendón', base: { tendon: 1 }, extra: {}, give: 'cordel', req: 'caza', note: 'más resistente que la fibra' },
  { id: 'capaPiel', name: 'Capa de piel', base: { piel: 2, cordel: 1 },
    extra: { piel: { max: 2, q: .40 }, musgo: { max: 4, q: .25 } }, give: 'capa', req: 'caza', note: 'el mejor abrigo' },
  { id: 'vendaje', name: 'Vendaje de musgo', base: { musgo: 2, fibra: 2 },
    extra: { corteza: { max: 1, q: .3 } }, give: 'vendaje', note: 'corta el sangrado' },
  { id: 'calzado', name: 'Calzado envuelto', base: { corteza: 2, fibra: 3 },
    extra: { musgo: { max: 4, q: .40 } }, give: 'calzado', req: 'cordel', note: 'pies secos, menos fatiga' },
  { id: 'sombrero', name: 'Sombrero de juncos', base: { junco: 5 },
    extra: { cordel: { max: 1, q: .30 }, corteza: { max: 2, q: .30 } }, give: 'sombrero', req: 'cordel', note: 'la lluvia resbala' },
  { id: 'recogedor', name: 'Recogedor de lluvia', base: { corteza: 4, palo: 3 },
    extra: { junco: { max: 6, q: .40 } }, place: 'catcher', req: 'agua', note: 'agua limpia sin hervir' },
  { id: 'filtro', name: 'Filtro de arena y carbón', base: { corteza: 3, piedra: 2, carbon: 2 },
    extra: { musgo: { max: 3, q: .35 } }, place: 'filtro', req: 'carbon', note: 'aclara el agua turbia' },
  { id: 'secadero', name: 'Secadero', base: { palo: 6, cordel: 1 },
    extra: { junco: { max: 6, q: .35 } }, place: 'secadero', req: 'fuego', note: 'carne que aguanta días' },
  { id: 'infusion', name: 'Infusión de agujas', base: { aguaLimpia: 1, agujas: 2 },
    extra: { bayas: { max: 2, q: .3 } }, give: 'infusion', req: 'fuego', note: 'calienta por dentro' },
  { id: 'torta', name: 'Torta de bellota', base: { bellota: 4, aguaLimpia: 1 },
    extra: { agujas: { max: 2, q: .2 } }, give: 'torta', req: 'agua', note: 'las bellotas hay que lavarlas' }
];
const qual = {};   // calidad del equipo fabricado
const stars = q => { const n = clamp(Math.round(q * 4), 1, 4); return '●'.repeat(n) + '○'.repeat(4 - n); };

const KNOW = [
  { id: 'fuego', t: 'Prender fuego', d: 'Yesca, astillas, leña — en ese orden.' },
  { id: 'cordel', t: 'Trenzar cordel', d: 'La ortiga seca da fibra resistente.' },
  { id: 'refugio', t: 'Levantar refugio', d: 'Primero techo, luego cama.' },
  { id: 'agua', t: 'Hervir agua', d: 'Un minuto de hervor mata lo que te tumba.' },
  { id: 'dia3', t: 'Tres días fuera', d: 'Sabes leer las trochas de los animales.' },
  { id: 'carbon', t: 'Sacar carbón', d: 'Brasa apagada a tiempo: filtra y marca.' },
  { id: 'caza', t: 'Cobrar una pieza', d: 'Acércate contra el viento y agachado; lanza de cerca.' },
  { id: 'pesca', t: 'Pescar a lanza', d: 'El agua engaña: apunta más abajo de lo que ves.' },
  { id: 'lluvia', t: 'Recoger la lluvia', d: 'El agua del cielo no necesita hervirse.' },
  { id: 'plantas', t: 'Conocer las setas', d: 'Ya distingues las que no matan.' },
  { id: 'conserva', t: 'Conservar carne', d: 'Secar al aire y al humo alarga la despensa.' },
  { id: 'abrigo', t: 'Vestirse del bosque', d: 'Corteza, musgo y juncos abrigan más que nada.' }
];

/* ---------- 8. HUD ---------- */
const $ = s => document.querySelector(s);
const vitalsEl = $('#vitals'), logEl = $('#log'), promptEl = $('#prompt'), promptBar = $('#promptbar');
const VIT = [
  { k: 'temp', label: 'Temp. corporal', fmt: v => v.toFixed(1) + '°', pct: v => clamp((v - 33) / 5, 0, 1) * 100, cls: v => v < 35.4 ? 'cold' : '' },
  { k: 'energia', label: 'Energía', fmt: v => Math.round(v) + '%', pct: v => v, cls: v => v < 22 ? 'warn' : '' },
  { k: 'agua', label: 'Hidratación', fmt: v => Math.round(v) + '%', pct: v => v, cls: v => v < 22 ? 'warn' : '' },
  { k: 'vigor', label: 'Vigor', fmt: v => Math.round(v) + '%', pct: v => v, cls: () => '' },
  { k: 'salud', label: 'Salud', fmt: v => Math.round(v) + '%', pct: v => v, cls: v => v < 40 ? 'bad' : '' }
];
vitalsEl.innerHTML = VIT.map(v => `<div class="vital"><div class="row"><span>${v.label}</span><b id="v_${v.k}">—</b></div>
  <div class="track"><div class="fill" id="f_${v.k}"></div></div></div>`).join('');
function drawVitals(){
  VIT.forEach(v => {
    const val = player[v.k];
    $('#v_' + v.k).textContent = v.fmt(val);
    const f = $('#f_' + v.k);
    f.style.width = clamp(v.pct(val), 0, 100) + '%';
    f.className = 'fill ' + v.cls(val);
  });
}
const hotbarEl = $('#hotbar');
const packEl = $('#pack');
packEl.classList.toggle('min', isTouch);
packEl.addEventListener('click', () => packEl.classList.toggle('min'));
addEventListener('keydown', e => { if (e.code === 'KeyI') packEl.classList.toggle('min'); });
function drawPack(){
  const rows = Object.keys(ITEMS).filter(k => inv[k] > 0);
  const list = rows.slice(0, 9).map(k =>
    `<div class="it"><span>${ITEMS[k]}</span><b>${inv[k]}</b></div>`).join('');
  packEl.innerHTML = `<h2><span>Mochila${packEl.classList.contains('min') ? '' : ''}</span><span>${carga()}/${capacidad()}</span></h2>` +
    (list || '<div class="empty">vacía</div>') +
    (rows.length > 9 ? `<div class="empty">+${rows.length - 9} más en la libreta</div>` : '');
}
function log(msg){
  const d = document.createElement('div'); d.textContent = msg;
  logEl.appendChild(d);
  setTimeout(() => d.remove(), 6000);
  while (logEl.children.length > 5) logEl.firstChild.remove();
}

/* libreta */
const book = $('#book'), pages = $('#pages');
let bookTab = 'inv', bookOpen = false;
document.querySelectorAll('#book header button').forEach(b => b.onclick = () => {
  bookTab = b.dataset.tab;
  document.querySelectorAll('#book header button').forEach(x => x.classList.toggle('sel', x === b));
  renderBook();
});
function canMake(r){ return Object.keys(r.base).every(k => inv[k] >= r.base[k]) && (!r.req || flags[r.req]); }
function extrasUsados(r){
  const u = {};
  Object.keys(r.extra || {}).forEach(k => { const n = Math.min(inv[k] || 0, r.extra[k].max); if (n > 0) u[k] = n; });
  return u;
}
function calidadDe(r){
  let q = 0.3;
  const u = extrasUsados(r);
  Object.keys(u).forEach(k => q += (u[k] / r.extra[k].max) * r.extra[k].q);
  return clamp(q, 0, 1);
}
function renderBook(){
  if (bookTab === 'inv'){
    const rows = Object.keys(ITEMS).filter(k => inv[k] > 0).map(k => {
      let btn = '';
      if (['bayas', 'bellota', 'setas', 'torta', 'cecina', 'pezAsado'].indexOf(k) >= 0) btn = `<button class="use" data-use="${k}">Comer</button>`;
      if (k === 'vendaje') btn = `<button class="use" data-use="vendaje">Curar</button>`;
      if (k === 'hacha' || k === 'antorcha' || k === 'lanza')
        btn = `<button class="use" data-mano2="${k}">${enMano === k ? 'Guardar' : 'Empuñar'}</button>`;
      if (k === 'capa' || k === 'calzado' || k === 'sombrero') btn = 'puesto';
      if (k === 'infusion') btn = `<button class="use" data-use="infusion">Beber caliente</button>`;
      if (k === 'asado') btn = `<button class="use" data-use="asado">Comer</button>`;
      if (k === 'aguaLimpia') btn = `<button class="use" data-use="aguaLimpia">Beber</button>`;
      if (k === 'aguaSucia') btn = `<button class="use" data-use="aguaSucia">Beber igual</button>`;
      const q = qual[k] !== undefined ? stars(qual[k]) + ' ' : '';
      return `<div class="entry"><span class="n">${inv[k]}</span><span>${ITEMS[k]}</span><span class="d">${q}${btn}</span></div>`;
    });
    pages.innerHTML = `<div class="entry"><span class="n">1</span><span>Cuchillo de monte</span><span class="d">siempre encima</span></div>
      <div class="entry"><span class="n">1</span><span>Ferrocerio</span><span class="d">chispa fiable</span></div>` +
      (rows.join('') || `<div class="hint">El zurrón está vacío. El suelo del bosque no lo está.</div>`);
    pages.querySelectorAll('[data-use]').forEach(b => b.onclick = () => { useItem(b.dataset.use); renderBook(); });
    pages.querySelectorAll('[data-mano2]').forEach(b => b.onclick = () => { equipar(b.dataset.mano2); renderBook(); });
  } else if (bookTab === 'craft'){
    pages.innerHTML = RECIPES.map(r => {
      const ok = canMake(r);
      const cost = Object.keys(r.base).map(k => r.base[k] + ' ' + ITEMS[k].toLowerCase()).join(' + ');
      const u = extrasUsados(r);
      const mej = Object.keys(r.extra || {}).map(k =>
        (u[k] ? '+' + u[k] + ' ' : '') + ITEMS[k].toLowerCase() + (u[k] ? '' : ' —')).join(', ');
      const lock = r.req && !flags[r.req] ? ' (sin descubrir)' : '';
      return `<button class="make" data-make="${r.id}" ${ok ? '' : 'disabled'}>
        <span class="tick">${ok ? '✓' : '·'}</span><span>${r.name}${lock}</span>
        <span class="cost">${cost}${mej ? ' · mejoras: ' + mej : ''} ${ok ? stars(calidadDe(r)) : ''}</span></button>`;
    }).join('');
    pages.querySelectorAll('[data-make]').forEach(b => b.onclick = () => craft(b.dataset.make));
  } else {
    pages.innerHTML = KNOW.map(k => `<div class="entry"><span class="n">${flags[k.id] ? '✓' : '—'}</span>
      <span>${flags[k.id] ? k.t : '· · · · ·'}</span><span class="d">${flags[k.id] ? k.d : 'por aprender'}</span></div>`).join('') +
      `<div class="entry"><span class="n">${dayCount}</span><span>días en el bosque</span><span class="d"></span></div>`;
  }
}
function toggleBook(force){
  bookOpen = force !== undefined ? force : !bookOpen;
  book.style.display = bookOpen ? 'block' : 'none';
  if (bookOpen){ renderBook(); if (document.pointerLockElement) document.exitPointerLock(); }
  else if (!isTouch && !paused) renderer.domElement.requestPointerLock();
}

/* ---------- 9. acciones ---------- */
function give(k, n){
  if (!NOCARGA[k]){
    const hueco = capacidad() - carga();
    if (hueco <= 0){ log('La mochila no da más de sí.'); return 0; }
    n = Math.min(n, hueco);
  }
  inv[k] = (inv[k] || 0) + n;
  return n;
}
function unlock(id){
  if (flags[id]) return;
  flags[id] = true;
  const k = KNOW.find(x => x.id === id);
  if (k) log('Aprendido: ' + k.t.toLowerCase() + '.');
}
function useItem(k){
  if (!inv[k]) return;
  if (k === 'bayas'){ inv.bayas--; player.energia = clamp(player.energia + 7, 0, 100); player.agua = clamp(player.agua + 3, 0, 100); log('Bayas ácidas. Poco, pero suma.'); }
  if (k === 'bellota'){ inv.bellota--; player.energia = clamp(player.energia + 5, 0, 100); log('Bellotas amargas, pero son calorías.'); }
  if (k === 'setas'){
    inv.setas--;
    if (Math.random() < (flags.plantas ? 0.06 : 0.25)){ player.salud -= 22; log('Esa no era comestible. Mala idea.'); }
    else { player.energia = clamp(player.energia + 14, 0, 100); unlock('plantas'); log('Setas. Esta vez has acertado.'); }
  }
  if (k === 'vendaje'){ inv.vendaje--; player.salud = clamp(player.salud + 18, 0, 100); log('Musgo y fibra sobre la herida.'); }
  if (k === 'infusion'){ inv.infusion--; player.agua = clamp(player.agua + 16, 0, 100);
    player.temp = Math.min(37.3, player.temp + 0.45); player.salud = clamp(player.salud + 4, 0, 100);
    log('Caliente y resinosa. Entra en calor.'); }
  if (k === 'torta'){ inv.torta--; player.energia = clamp(player.energia + 30, 0, 100); log('Torta de bellota. Densa y saciante.'); }
  if (k === 'cecina'){ inv.cecina--; player.energia = clamp(player.energia + 26, 0, 100); player.agua = clamp(player.agua - 4, 0, 100); log('Cecina. Salada, pero aguanta.'); }
  if (k === 'pezAsado'){ inv.pezAsado--; player.energia = clamp(player.energia + 24, 0, 100); log('Pescado a la brasa.'); }
  if (k === 'asado'){ inv.asado--; player.energia = clamp(player.energia + 42, 0, 100); log('Carne asada. Eso sí alimenta.'); }
  if (k === 'aguaLimpia'){ inv.aguaLimpia--; player.agua = clamp(player.agua + 45, 0, 100); log('Agua hervida, tibia y segura.'); }
  if (k === 'aguaSucia'){
    inv.aguaSucia--; player.agua = clamp(player.agua + 40, 0, 100);
    if (Math.random() < 0.35){ player.salud -= 18; log('Sabe a barro. Media hora después, el estómago pasa factura.'); }
    else log('Agua turbia. Esta vez no ha pasado nada.');
  }
  drawVitals();
}
function craft(id){
  const r = RECIPES.find(x => x.id === id);
  if (!r || !canMake(r)) return;
  const u = extrasUsados(r), q = calidadDe(r);
  Object.keys(r.base).forEach(k => inv[k] -= r.base[k]);
  Object.keys(u).forEach(k => inv[k] -= u[k]);
  if (r.give){
    const n = r.give === 'yesca' ? 3 + Math.round(q * 3) : r.id === 'cuerdaTendon' ? 2 : 1;
    give(r.give, n);
    qual[r.give] = Math.max(qual[r.give] || 0, q);
    if (r.give === 'antorcha') player.torchFuel = 140 + q * 420;
    log(r.name + ' — calidad ' + stars(q));
  }
  if (r.place){
    const fx = player.pos.x - Math.sin(player.yaw) * 1.7, fz = player.pos.z - Math.cos(player.yaw) * 1.7;
    placeStructure(r.place, fx, fz, { q });
    log(r.name + ' levantado — calidad ' + stars(q));
    toggleBook(false);
    save(true);
  }
  if (id === 'cordel') unlock('cordel');
  if (id === 'capa' || id === 'calzado' || id === 'sombrero') unlock('abrigo');
  if (id === 'secadero') unlock('conserva');
  renderBook();
}

function terrainNormal(x, z){
  const d = 1.3;
  return new THREE.Vector3(heightAt(x - d, z) - heightAt(x + d, z), 2 * d,
                           heightAt(x, z - d) - heightAt(x, z + d)).normalize();
}
function placeStructure(type, x, z, data){
  // altura media de la huella, no un solo punto: así no flota ni se hunde
  const y = (heightAt(x - 1.2, z) + heightAt(x + 1.2, z) + heightAt(x, z - 1.2) + heightAt(x, z + 1.2)) / 4;
  const g = new THREE.Group(); g.position.set(x, y, z);
  const rotY = data && data.rotY !== undefined ? data.rotY : player.yaw + Math.PI;
  const n = terrainNormal(x, z).lerp(new THREE.Vector3(0, 1, 0), 0.35).normalize();
  const qTilt = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
  const qYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
  g.quaternion.multiplyQuaternions(qTilt, qYaw);
  const st = { type, x, y, z, group: g, lit: false, fuel: 0, timer: 0, ready: false, q: 0.3, rotY };
  if (type === 'fire'){
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.14, 5, 9), rockMat);
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.1; g.add(ring);
    const logs = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.7, 5), woodMat);
    logs.position.y = 0.34; g.add(logs);
    st.flame = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.85, 6), new THREE.MeshBasicMaterial({ color: 0xff9b3d, transparent: true, opacity: 0.9 }));
    st.flame.position.y = 0.6; st.flame.visible = false; g.add(st.flame);
    st.light = new THREE.PointLight(0xff8a3a, 0, 16, 2); st.light.position.y = 0.9; g.add(st.light);
    st.fuel = 0;
  } else if (type === 'shelter'){
    const m = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.15, 2.2), woodMat);
    m.rotation.x = -0.7; m.position.set(0, 1.0, -0.5); m.castShadow = true; g.add(m);
    const b = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.12, 1.4), bushMat);
    b.rotation.x = -0.7; b.position.set(0, 1.12, -0.55); g.add(b);
    unlock('refugio');
  } else if (type === 'roof'){
    const m = new THREE.Mesh(new THREE.BoxGeometry(3, 0.2, 2.8), woodMat);
    m.rotation.x = -0.35; m.position.set(0, 1.9, 0); m.castShadow = true; g.add(m);
    for (let i = -1; i <= 1; i += 2){
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 2, 5), woodMat);
      post.position.set(i * 1.3, 1, 1.2); g.add(post);
    }
  } else if (type === 'catcher'){
    const emb = new THREE.Mesh(new THREE.ConeGeometry(0.85, 0.55, 10, 1, true), woodMat);
    emb.rotation.x = Math.PI; emb.position.y = 1.15; emb.castShadow = true; g.add(emb);
    for (let i = 0; i < 3; i++){
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.2, 5), woodMat);
      post.position.set(Math.cos(i * 2.1) * 0.55, 0.6, Math.sin(i * 2.1) * 0.55); g.add(post);
    }
    const vaso = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.24, 0.45, 9), woodMat);
    vaso.position.y = 0.22; g.add(vaso);
    st.store = 0;
  } else if (type === 'filtro'){
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.4, 1.0, 9), woodMat);
    col.position.y = 0.5; col.castShadow = true; g.add(col);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.12, 9), rockMat);
    cap.position.y = 1.05; g.add(cap);
  } else if (type === 'secadero'){
    for (let i = -1; i <= 1; i += 2){
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.6, 5), woodMat);
      post.position.set(i * 0.9, 0.8, 0); post.castShadow = true; g.add(post);
    }
    const barra = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2, 5), woodMat);
    barra.rotation.z = Math.PI / 2; barra.position.y = 1.55; g.add(barra);
    st.load = 0;
  } else if (type === 'bed'){
    const m = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.22, 1.1), dryMat); m.position.y = 0.11; g.add(m);
    const almohada = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 1), bushMat);
    almohada.position.set(-0.75, 0.28, 0); g.add(almohada);
  } else if (type === 'trap'){
    const m = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.03, 4, 8), dryMat);
    m.rotation.x = Math.PI / 2; m.position.y = 0.12; g.add(m);
    st.timer = 120 + Math.random() * 180;
  }
  if (data) Object.assign(st, data);
  scene.add(g);
  structures.push(st);
  return st;
}

/* --- interacción contextual --- */
let target = null, holdT = 0, sleeping = false, sleepQ = 0.3, sleptH = 0;
let crouch = false, ruido = 0, ruidoT = 0;
function findTarget(){
  const fwd = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
  let best = null, bestScore = 0;
  const consider = (obj, dist, dir, label, act, hold, prio) => {
    const dot = dir.dot(fwd);
    if (dot < 0.3) return;
    const score = (prio || 1) * dot / (1 + dist * 0.35);
    if (score > bestScore){ bestScore = score; best = { obj, label, act, hold }; }
  };
  const p = player.pos, d = new THREE.Vector3();
  nearChunks().forEach(c => c.res.forEach(r => {
    if (r.cooldown > 0) return;
    d.set(r.x - p.x, 0, r.z - p.z);
    const dist = d.length(); if (dist > 3.4) return;
    d.normalize();
    const names = { lena: 'Recoger leña', palo: 'Coger un palo', piedra: 'Coger una piedra',
      yesca: 'Recoger yesca', fibra: 'Arrancar ortigas', bayas: 'Recolectar bayas',
      maleza: 'Rebuscar entre la maleza', toconHueco: 'Rebuscar en el tocón',
      rocaGrande: 'Mirar bajo el pedrusco',
      troncoCaido: enMano === 'hacha' ? 'Trocear el tronco caído' : 'Arrancar corteza del tronco' };
    consider(r, dist, d, names[r.kind] || ('Recoger ' + ITEMS[r.kind].toLowerCase()), 'gather', 0, 1.9);
  }));
  nearChunks().forEach(c => c.trees.forEach(t => {
    if (t.felled || t.cool > 0) return;
    d.set(t.x - p.x, 0, t.z - p.z);
    const dist = d.length(); if (dist > 3.2) return;
    d.normalize();
    if (enMano !== 'cuchillo' && enMano !== 'hacha') return;
    const label = enMano === 'hacha'
      ? 'Talar ' + t.species + ' (' + Math.ceil(t.hp) + ')'
      : 'Cortar ramas de ' + t.species + ' (cuchillo)';
    consider(t, dist, d, label, 'chop', enMano === 'hacha' ? 1.0 : 0.7, 1);
  }));
  fauna.forEach(a => {
    d.set(a.x - p.x, 0, a.z - p.z);
    const dist = d.length();
    if (!a.vivo){
      if (dist < 3.2){
        d.normalize();
        if (enMano === 'cuchillo') consider(a, dist, d, 'Despiezar ' + a.tipo, 'despiece', 1.6, 2.6);
        else consider(a, dist, d, 'Necesitas el cuchillo para despiezar', 'nada', 0, 2.6);
      }
      return;
    }
    if (dist > 16 || enMano !== 'lanza') return;
    d.normalize();
    const prob = Math.round(clamp((1 - dist / 18) * (a.estado === 'huye' ? 0.35 : a.estado === 'alerta' ? 0.7 : 1)
      * (0.55 + (qual.lanza || 0.3) * 0.5), 0.05, 0.95) * 100);
    consider(a, dist, d, 'Lanzar a ' + a.tipo + ' · ' + prob + '%', 'lanzar', 0.5, 1.6);
  });
  structures.forEach(s => {
    d.set(s.x - p.x, 0, s.z - p.z);
    const dist = d.length(); if (dist > 3.4) return;
    d.normalize();
    if (s.type === 'fire'){
      if (!s.lit) consider(s, dist, d, 'Encender con el ferrocerio', 'ignite', 1.6, 2.2);
      else if (inv.aguaSucia > 0) consider(s, dist, d, 'Hervir agua', 'boil', 1.2, 2.2);
      else if (inv.carne > 0) consider(s, dist, d, 'Asar carne', 'cook', 1.2, 2.2);
      else if (inv.pez > 0) consider(s, dist, d, 'Asar pescado', 'cookfish', 1.2, 2.2);
      else if (inv.lena > 0 || inv.palo > 0) consider(s, dist, d, 'Alimentar el fuego', 'feed', 0, 2.2);
      if (s.lit && s.fuel > 70) consider(s, dist, d, 'Sacar carbón de la brasa', 'coal', 1.4, 1.9);
    }
    if (s.type === 'trap' && s.ready) consider(s, dist, d, 'Recoger la trampa', 'trap', 0, 2.2);
    if (s.type === 'catcher' && s.store >= 1)
      consider(s, dist, d, 'Recoger agua de lluvia (' + Math.floor(s.store) + ')', 'takewater', 0, 2.4);
    if (s.type === 'filtro' && inv.aguaSucia > 0 && (s.timer || 0) <= 0)
      consider(s, dist, d, 'Filtrar agua turbia', 'filter', 1.0, 2.4);
    if (s.type === 'secadero'){
      if (s.ready) consider(s, dist, d, 'Recoger la cecina', 'takedry', 0, 2.4);
      else if (inv.carne > 0 && !s.load) consider(s, dist, d, 'Poner carne a secar', 'dry', 0.8, 2.4);
    }
    if (s.type === 'bed'){
      const noche = timeOfDay > 20.2 || timeOfDay < 5.4;
      consider(s, dist, d, noche ? 'Dormir hasta el amanecer' : 'Echarse un rato (aún es de día)',
               noche ? 'sleep' : 'nap', 1.0, 2.4);
    }
  });
  // agua
  const ahead = new THREE.Vector3(p.x + fwd.x * 1.6, 0, p.z + fwd.z * 1.6);
  if (heightAt(ahead.x, ahead.z) < WATER - 0.15 && p.y < WATER + 3){
    consider({ water: true }, 1.4, fwd.clone(), inv.aguaSucia > 0 ? 'Beber del arroyo' : 'Llenar la cantimplora', 'water', 0, 1.4);
    if (enMano === 'lanza')
      consider({ pesca: true }, 1.3, fwd.clone(), 'Pescar a lanza' + (inv.larva ? ' (con cebo)' : ''), 'pescar', 2.0, 1.8);
  }
  return best;
}
function doAction(t){
  if (!t) return;
  if (t.act === 'gather'){
    const r = t.obj;
    if (PROPS[r.kind]){
      const botin = BOTIN[r.kind]();
      const cuantos = 1 + (Math.random() < 0.55 ? 1 : 0);
      let txt = [];
      for (let i = 0; i < cuantos; i++){
        const [k, n] = botin[Math.floor(Math.random() * botin.length)];
        if (give(k, n)) txt.push(n + ' ' + ITEMS[k].toLowerCase());
      }
      r.usos = (r.usos || 1) - 1;
      r.cooldown = r.usos > 0 ? 90 : 900;
      player.energia -= 0.5;
      swing = 1;
      golpe(r.kind === 'troncoCaido' ? 380 : 1600, 0.16, 0.16, r.kind === 'troncoCaido' ? 'lowpass' : 'bandpass');
      diffFor(r.ci, r.cj).r[r.ri] = r.cooldown;
      log(txt.length ? '+' + txt.join(', ') : 'Nada aprovechable ahí.');
      return;
    }
    const qty = { piedra: 2, silex: 1, bayas: 3, junco: 3, musgo: 2, fibra: 2, yesca: 2, palo: 2, setas: 2, agujas: 3 }[r.kind] || 1;
    give(r.kind, qty);
    log('+' + qty + ' ' + ITEMS[r.kind].toLowerCase());
    r.cooldown = r.kind === 'bayas' ? 240 : 120;
    r.mesh.visible = false;
    swing = 1;
    diffFor(r.ci, r.cj).r[r.ri] = r.cooldown;
    player.energia -= 0.35;
  } else if (t.act === 'chop'){
    const tr = t.obj, sp = SPECIES[tr.species];
    give('palo', 1);
    if (sp.drop === 'resina' && Math.random() < 0.45) give('resina', 1);
    if (sp.drop === 'corteza') give('corteza', 1 + (Math.random() < 0.4 ? 1 : 0));
    if (sp.drop === 'bellota' && Math.random() < 0.5) give('bellota', 2);
    if (Math.random() < 0.3) give('yesca', 1);
    player.energia -= enMano === 'hacha' ? 0.7 : 1.1;
    swing = 1; ruido = enMano === 'hacha' ? 70 : 30; ruidoT = 2.5;
    golpe(enMano === 'hacha' ? 320 : 900, 0.18, 0.22, 'lowpass');
    if (enMano === 'hacha'){
      tr.hp -= 1.2 + (qual.hacha || 0.3) * 2.4;
      if (tr.hp <= 0){
        tr.felled = true;
        give('lena', sp.lena); give('palo', 2); give('corteza', 2);
        const M0 = new THREE.Matrix4().makeScale(0.001, 0.001, 0.001);
        addStump(tr);
        tr.trunkIM.setMatrixAt(tr.idx, M0); tr.folIM.setMatrixAt(tr.idx, M0);
        tr.trunkIM.instanceMatrix.needsUpdate = tr.folIM.instanceMatrix.needsUpdate = true;
        tr.r = 0;
        log('Cae el ' + tr.species + '. ' + sp.lena + ' de leña.');
      } else log('Astillas y ramas. Al ' + tr.species + ' le queda poco.');
    } else {
      give('palo', 1);
      tr.fol = Math.max(0.35, (tr.fol === undefined ? 1 : tr.fol) - 0.18);
      refreshFoliage(tr);
      tr.cool = 100;   // sin hacha solo desramas: el árbol rebrota con el tiempo
      log('Ramas cortadas con el cuchillo.');
    }
    marcarArbol(tr);
  } else if (t.act === 'ignite'){
    const chance = 0.88 - player.mojado * 0.3 - (weather === 'lluvia' ? 0.2 : 0) + (inv.yesca > 2 ? 0.08 : 0);
    if (Math.random() < chance){
      t.obj.lit = true; t.obj.fuel = 150 + t.obj.q * 480; unlock('fuego'); unlock('agua');
      log('Prende. El humo primero, la llama después.');
    } else log('La chispa muere en la yesca húmeda. Otra vez.');
  } else if (t.act === 'feed'){
    if (inv.lena > 0){ inv.lena--; t.obj.fuel += 150; log('Un tronco más. El fuego aguanta.'); }
    else { inv.palo--; t.obj.fuel += 45; log('Palos: llama viva, poco rato.'); }
  }
  else if (t.act === 'boil'){ inv.aguaSucia--; give('aguaLimpia', 1); t.obj.fuel -= 15; log('Agua hervida.'); }
  else if (t.act === 'cook'){ inv.carne--; give('asado', 1); t.obj.fuel -= 20; log('Carne asada al rescoldo.'); }
  else if (t.act === 'cookfish'){ inv.pez--; give('pezAsado', 1); t.obj.fuel -= 15; log('Pescado hecho sobre las brasas.'); }
  else if (t.act === 'trap'){ t.obj.ready = false; t.obj.timer = 180 + Math.random() * 240; give('carne', 1); log('Un conejo en el lazo.'); }
  else if (t.act === 'nada'){ }
  else if (t.act === 'lanzar'){
    const a = t.obj, d = FAUNA[a.tipo];
    const dist = Math.hypot(a.x - player.pos.x, a.z - player.pos.z);
    const prob = clamp((1 - dist / 18) * (a.estado === 'huye' ? 0.35 : a.estado === 'alerta' ? 0.7 : 1)
      * (0.55 + (qual.lanza || 0.3) * 0.5), 0.05, 0.95);
    swing = 1; ruido = 45; ruidoT = 2; golpe(700, 0.2, 0.2, 'bandpass');
    player.energia -= 0.8;
    if (Math.random() < prob){
      a.vivo = false; a.estado = 'muerto';
      a.mesh.rotation.z = Math.PI / 2; a.mesh.position.y = a.y + 0.15;
      unlock('caza');
      log('Le has dado. Ahora hay que despiezarlo.');
    } else {
      a.alerta = 3; a.estado = 'huye'; a.t = 8; a.dir = Math.atan2(a.z - player.pos.z, a.x - player.pos.x);
      log('Fallas. Sale de estampida.');
    }
  }
  else if (t.act === 'despiece'){
    const a = t.obj, d = FAUNA[a.tipo];
    give('carne', d.carne); if (d.piel) give('piel', d.piel); if (d.tendon) give('tendon', d.tendon);
    if (Math.random() < 0.5) give('tendon', 1);
    log('Despiezado: ' + d.carne + ' de carne' + (d.piel ? ', piel' : '') + '.');
    scene.remove(a.mesh);
    const i = fauna.indexOf(a); if (i >= 0) fauna.splice(i, 1);
    player.energia -= 1.5;
  }
  else if (t.act === 'pescar'){
    const prob = 0.30 + (inv.larva ? 0.25 : 0) + (qual.lanza || 0.3) * 0.15;
    if (inv.larva && Math.random() < 0.5) inv.larva--;
    if (Math.random() < prob){ give('pez', 1); unlock('pesca'); log('¡Un pez ensartado!'); }
    else log('Solo agua y barro.');
    player.energia -= 0.4; golpe(1200, 0.25, 0.18, 'bandpass');
  }
  else if (t.act === 'takewater'){
    const n = Math.floor(t.obj.store); t.obj.store -= n; give('aguaLimpia', n);
    unlock('lluvia'); log(n + ' de agua limpia del recogedor.');
  }
  else if (t.act === 'filter'){
    inv.aguaSucia--; give('aguaLimpia', 1); t.obj.timer = 25; log('Pasa por arena y carbón: ya se puede beber.');
  }
  else if (t.act === 'dry'){ inv.carne--; t.obj.load = 1; t.obj.timer = 120 - t.obj.q * 50; log('Tiras de carne al aire.'); }
  else if (t.act === 'takedry'){ t.obj.ready = false; t.obj.load = 0; give('cecina', 2); unlock('conserva'); log('Cecina lista.'); }
  else if (t.act === 'coal'){
    t.obj.fuel -= 45; give('carbon', 2); unlock('carbon'); log('Brasas apagadas a tiempo: carbón.');
  }
  else if (t.act === 'sleep'){
    sleeping = true; sleepQ = t.obj.q; log('Te acurrucas sobre la cama. El bosque sigue sonando.');
  }
  else if (t.act === 'nap'){ log('Con el sol alto no pegas ojo. Vuelve al anochecer.'); }
  else if (t.act === 'water'){ give('aguaSucia', 1); log('Cantimplora llena. Sin hervir, es una apuesta.'); }
}

/* ---------- 10. controles ---------- */
const keys = {};
let paused = true, dead = false;
addEventListener('keydown', e => {
  keys[e.code] = true;
  if (e.repeat) return;
  if (e.code === 'Tab'){ e.preventDefault(); if (!sleeping) toggleBook(); }
  if (e.code === 'Escape' && sleeping){ sleeping = false; sleptH = 0; $('#dream').classList.remove('on'); }
  if (e.code === 'KeyF') toggleTorch();
  if (e.code === 'KeyC' || e.code === 'ControlLeft'){ crouch = !crouch; log(crouch ? 'Te agachas.' : 'Te levantas.'); }
  if (e.code.indexOf('Digit') === 0){
    const i = parseInt(e.code.slice(5), 10) - 1;
    if (ORDEN_MANO[i]) equipar(ORDEN_MANO[i]);
  }
  if (e.code === 'Escape' && bookOpen) toggleBook(false);
});
addEventListener('keyup', e => keys[e.code] = false);
renderer.domElement.addEventListener('click', () => {
  if (!paused && !isTouch && !bookOpen && !document.pointerLockElement) renderer.domElement.requestPointerLock();
});
addEventListener('mousemove', e => {
  if (document.pointerLockElement !== renderer.domElement) return;
  player.yaw -= e.movementX * 0.0022;
  player.pitch = clamp(player.pitch - e.movementY * 0.0022, -1.45, 1.45);
});
document.addEventListener('pointerlockchange', () => {
  if (!document.pointerLockElement && !bookOpen && !paused && !isTouch) showVeil('pausa');
});

/* táctil */
const stick = $('#stick'), knob = stick.querySelector('i');
let stickV = { x: 0, y: 0 }, stickId = null, lookId = null, lookLast = null;
if (isTouch){
  $('#touch').style.display = 'block';
  $('#veilkeys').innerHTML = 'Joystick para moverte · arrastra para mirar · toca la barra de abajo para empuñar<br>Acción · Saltar · Correr · Libreta';
  stick.addEventListener('touchstart', e => { stickId = e.changedTouches[0].identifier; e.preventDefault(); }, { passive: false });
  addEventListener('touchmove', e => {
    for (const t of e.changedTouches){
      if (t.identifier === stickId){
        const r = stick.getBoundingClientRect();
        let dx = (t.clientX - (r.left + r.width / 2)) / (r.width / 2);
        let dy = (t.clientY - (r.top + r.height / 2)) / (r.height / 2);
        const l = Math.hypot(dx, dy); if (l > 1){ dx /= l; dy /= l; }
        stickV = { x: dx, y: dy };
        knob.style.transform = `translate(${dx * 34}px,${dy * 34}px)`;
      } else if (t.identifier === lookId){
        if (lookLast){
          player.yaw -= (t.clientX - lookLast.x) * 0.005;
          player.pitch = clamp(player.pitch - (t.clientY - lookLast.y) * 0.005, -1.45, 1.45);
        }
        lookLast = { x: t.clientX, y: t.clientY };
      }
    }
  }, { passive: false });
  addEventListener('touchstart', e => {
    for (const t of e.changedTouches)
      if (lookId === null && stickId !== t.identifier && t.target === renderer.domElement){
        lookId = t.identifier; lookLast = { x: t.clientX, y: t.clientY };
      }
  });
  addEventListener('touchend', e => {
    for (const t of e.changedTouches){
      if (t.identifier === stickId){ stickId = null; stickV = { x: 0, y: 0 }; knob.style.transform = ''; }
      if (t.identifier === lookId){ lookId = null; lookLast = null; }
    }
  });
  const hold = (el, code) => {
    el.addEventListener('touchstart', e => { keys[code] = true; e.preventDefault(); }, { passive: false });
    el.addEventListener('touchend', e => { keys[code] = false; e.preventDefault(); }, { passive: false });
  };
  hold($('#tAct'), 'KeyE'); hold($('#tJump'), 'Space');
  $('#tRun').addEventListener('touchstart', e => { keys.ShiftLeft = !keys.ShiftLeft; e.preventDefault(); }, { passive: false });
  $('#tBook').addEventListener('touchstart', e => { toggleBook(); e.preventDefault(); }, { passive: false });
}

function toggleTorch(){
  if (player.torch){ player.torch = false; torchLight.intensity = 0; log('Antorcha apagada.'); return; }
  if (!inv.antorcha){ log('No llevas antorcha.'); return; }
  if (enMano !== 'antorcha'){ equipar('antorcha'); }
  if (player.torchFuel <= 0){ log('La antorcha está consumida.'); return; }
  player.torch = true; log('Antorcha encendida.');
}
const torchLight = new THREE.PointLight(0xffa04a, 0, 14, 2);
scene.add(torchLight);

/* ---------- 11. persistencia ---------- */
const SAVE_KEY = 'raiz:save';
let guardando = false, ultimoGuardado = 0;

function snapshot(){
  // se poda el diff: lo que ya volvió a crecer no hace falta guardarlo
  const w = {};
  Object.keys(worldDiff).forEach(k => {
    const d = worldDiff[k];
    const r = {}, t = {};
    Object.keys(d.r).forEach(i => { if (d.r[i] > 0) r[i] = Math.round(d.r[i]); });
    Object.keys(d.t).forEach(i => { const v = d.t[i]; if (v[2] || v[0] < SPECIES.roble.dureza || v[1] < 1) t[i] = v; });
    if (Object.keys(r).length || Object.keys(t).length) w[k] = { r, t };
  });
  return {
    v: 2, seed: SEED, dayCount, timeOfDay, weather, weatherT, inv, flags, qual, world: w,
    p: { x: player.pos.x, y: player.pos.y, z: player.pos.z, yaw: player.yaw, pitch: player.pitch,
         salud: player.salud, energia: player.energia, agua: player.agua, vigor: player.vigor,
         temp: player.temp, mojado: player.mojado, torch: player.torch, torchFuel: player.torchFuel },
    st: structures.map(s => ({ type: s.type, x: s.x, z: s.z, lit: s.lit, fuel: s.fuel,
         ready: s.ready, timer: s.timer, q: s.q, rotY: s.rotY, store: s.store, load: s.load })),
    ts: Date.now()
  };
}
async function save(silencioso){
  if (guardando) return;
  guardando = true;
  try{
    await storage.set(SAVE_KEY, JSON.stringify(snapshot()));
    ultimoGuardado = performance.now();
    if (!silencioso) log('Partida guardada.');
  } catch(e){ if (!silencioso) log('No se ha podido guardar.'); }
  guardando = false;
}
async function load(){
  try{
    const r = await storage.get(SAVE_KEY);
    return r ? JSON.parse(r.value) : null;
  } catch(e){ return null; }
}
async function borrarPartida(){
  try{ await storage.delete(SAVE_KEY); } catch(e){}
}
function limpiarMundo(){
  chunks.forEach(c => scene.remove(c.grp)); chunks.clear();
  structures.splice(0).forEach(s => scene.remove(s.group));
}
function applySave(d){
  SEED = d.seed; dayCount = d.dayCount; timeOfDay = d.timeOfDay;
  weather = d.weather || 'despejado'; weatherT = d.weatherT || 120;
  Object.keys(inv).forEach(k => inv[k] = 0);
  Object.keys(flags).forEach(k => delete flags[k]);
  Object.keys(qual).forEach(k => delete qual[k]);
  Object.assign(inv, d.inv); Object.assign(flags, d.flags); Object.assign(qual, d.qual || {});
  worldDiff = {};
  Object.keys(d.world || {}).forEach(k => { worldDiff[k] = { r: d.world[k].r || {}, t: d.world[k].t || {} }; });
  player.pos.set(d.p.x, d.p.y !== undefined ? d.p.y : 0, d.p.z);
  player.yaw = d.p.yaw || 0; player.pitch = d.p.pitch || 0;
  player.salud = d.p.salud; player.energia = d.p.energia; player.agua = d.p.agua;
  player.vigor = d.p.vigor === undefined ? 100 : d.p.vigor;
  player.temp = d.p.temp; player.mojado = d.p.mojado;
  player.torch = !!d.p.torch; player.torchFuel = d.p.torchFuel === undefined ? 300 : d.p.torchFuel;
  limpiarMundo();
  updateChunks();
  cespedFull = true; updateCesped();       // el jugador salta de sitio: rellena la alfombra entera
  if (d.p.y === undefined) player.pos.y = heightAt(d.p.x, d.p.z);
  (d.st || []).forEach(s => placeStructure(s.type, s.x, s.z, { lit: s.lit, fuel: s.fuel, ready: s.ready,
    timer: s.timer, q: s.q === undefined ? 0.4 : s.q, rotY: s.rotY, store: s.store, load: s.load }));
  drawPack(); drawVitals();
}

/* guardar también al salir o cambiar de pestaña */
addEventListener('visibilitychange', () => { if (document.hidden && !paused) save(true); });
addEventListener('pagehide', () => { if (!paused) save(true); });

/* ---------- 12. velo / menús ---------- */
const veil = $('#veil'), veilText = $('#veiltext'), veilBtns = $('#veilbtns');
function showVeil(mode){
  paused = true; veil.style.display = 'flex';
  if (mode === 'pausa'){
    veilText.textContent = 'El bosque espera. Nada se mueve mientras no estés.';
    veilBtns.innerHTML = '<button id="btnResume">Volver</button><button id="btnSave">Guardar ahora</button>' +
      '<button id="btnGfx">Gráficos: ' + calidad + '</button>';
    $('#btnResume').onclick = start;
    $('#btnGfx').onclick = () => {
      const orden = ['bajo', 'medio', 'alto'];
      setCalidad(orden[(orden.indexOf(calidad) + 1) % 3]);
      $('#btnGfx').textContent = 'Gráficos: ' + calidad;
    };
    $('#btnSave').onclick = async () => {
      const b = $('#btnSave'); b.textContent = 'Guardando…';
      await save(true); b.textContent = 'Guardado ✓';
    };
  } else if (mode === 'muerte'){
    veilText.textContent = `Te fallaron las fuerzas en el día ${dayCount}. Lo aprendido se queda contigo.`;
    veilBtns.innerHTML = '<button id="btnAgain">Volver a empezar</button>';
    $('#btnAgain').onclick = () => { respawn(); save(true); start(); };
  }
}
function start(){
  initAudio();
  paused = false; dead = false;
  veil.style.display = 'none';
  toggleBook(false);
  if (!isTouch) renderer.domElement.requestPointerLock();
}
function respawn(){
  player.salud = 100; player.energia = 80; player.agua = 80; player.temp = 36.8; player.mojado = 0; player.vigor = 100;
  Object.keys(inv).forEach(k => inv[k] = 0);
  timeOfDay = 7; dayCount++;
}
let hayPartida = false, confirmando = false;
$('#btnNew').onclick = async () => {
  const b = $('#btnNew');
  if (hayPartida && !confirmando){
    confirmando = true;
    b.textContent = '¿Seguro? se borra la anterior';
    setTimeout(() => { confirmando = false; b.textContent = 'Nueva partida'; }, 5000);
    return;
  }
  confirmando = false; b.textContent = 'Nueva partida';
  await borrarPartida();
  worldDiff = {};
  limpiarMundo();
  SEED = Math.floor(Math.random() * 99999);
  chunks.forEach(c => scene.remove(c.grp)); chunks.clear();
  structures.splice(0).forEach(s => scene.remove(s.group));
  Object.keys(inv).forEach(k => inv[k] = 0);
  Object.keys(flags).forEach(k => delete flags[k]);
  Object.keys(qual).forEach(k => delete qual[k]);
  dayCount = 1; timeOfDay = 6.2; weather = 'despejado';
  player.salud = 100; player.energia = 88; player.agua = 85; player.vigor = 100; player.temp = 36.8; player.mojado = 0;
  const sp = findSpawn();
  player.pos.set(sp.x, 0, sp.z);
  player.torch = false; player.torchFuel = 300;
  updateChunks();
  player.pos.y = heightAt(sp.x, sp.z);
  hayPartida = true;
  start(); save(true);
};
load().then(d => {
  if (!d) return;
  hayPartida = true;
  const b = $('#btnCont');
  const hh = String(Math.floor(d.timeOfDay)).padStart(2, '0');
  const mm = String(Math.floor((d.timeOfDay % 1) * 60)).padStart(2, '0');
  b.textContent = 'Continuar · día ' + d.dayCount + ' · ' + hh + ':' + mm;
  b.style.display = 'inline-block';
  b.onclick = () => { applySave(d); start(); };
  $('#veiltext').textContent = 'Tu campamento sigue donde lo dejaste: lo que talaste, lo que construiste y lo que recogiste se ha quedado así.';
});

/* ---------- 12b. sonido sintetizado (sin ficheros de audio) ---------- */
const SND = { on: false, pasoT: 0, grilloT: 0, aveT: 0, chispaT: 0, arroyoD: 999 };
function initAudio(){
  if (SND.ctx){ if (SND.ctx.state === 'suspended') SND.ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  const ctx = new AC(); SND.ctx = ctx;
  const master = ctx.createGain(); master.gain.value = 0.75; master.connect(ctx.destination);
  SND.master = master;
  const len = Math.floor(ctx.sampleRate * 2);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let ult = 0;
  for (let i = 0; i < len; i++){ const b = Math.random() * 2 - 1; d[i] = (ult + 0.02 * b) / 1.02; ult = d[i]; d[i] *= 3.5; }
  SND.noise = buf;
  function capa(freq, tipo, q){
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = tipo; f.frequency.value = freq; if (q) f.Q.value = q;
    const g = ctx.createGain(); g.gain.value = 0;
    src.connect(f); f.connect(g); g.connect(master); src.start();
    return { f, g };
  }
  SND.viento = capa(420, 'lowpass', 0.8);
  SND.lluvia = capa(1600, 'bandpass', 0.5);
  SND.fuego  = capa(520, 'lowpass', 1.0);
  SND.arroyo = capa(1000, 'bandpass', 0.9);
  SND.on = true;
}
function golpe(freq, dur, vol, tipo){          // ráfaga corta de ruido: pasos, crujidos, chispas
  if (!SND.on) return;
  const ctx = SND.ctx, src = ctx.createBufferSource();
  src.buffer = SND.noise; src.loop = true;
  const f = ctx.createBiquadFilter(); f.type = tipo || 'bandpass'; f.frequency.value = freq; f.Q.value = 1.2;
  const g = ctx.createGain();
  const t = ctx.currentTime;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(SND.master);
  src.start(t); src.stop(t + dur + 0.02);
}
function trino(f0, f1, dur, vol){               // aves e insectos
  if (!SND.on) return;
  const ctx = SND.ctx, o = ctx.createOscillator(), g = ctx.createGain();
  const t = ctx.currentTime;
  o.type = 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(SND.master); o.start(t); o.stop(t + dur + 0.02);
}
const SUELO_SND = { hojarasca: [2200, 0.09, 0.16], musgo: [700, 0.10, 0.06],
                    grava: [3200, 0.07, 0.14], agua: [900, 0.16, 0.22], tierra: [1400, 0.08, 0.10] };
function sonarPaso(){
  const b = biomeAt(player.pos.x, player.pos.z);
  const prof = WATER - heightAt(player.pos.x, player.pos.z);
  const sup = prof > 0 ? 'agua' : b === 'roquedo' ? 'grava' : b === 'frondoso' || b === 'pinar' ? 'hojarasca'
            : b === 'ribera' ? 'tierra' : 'musgo';
  const [f, d, v] = SUELO_SND[sup];
  golpe(f * (0.85 + Math.random() * 0.3), d, v * (crouch ? 0.35 : 1), 'bandpass');
  return sup;
}
function distanciaAgua(){                        // sondeo grueso para el sonido del arroyo
  let best = 999;
  for (let a = 0; a < 8; a++){
    const th = a / 8 * 6.283;
    for (let r = 6; r <= 54; r += 12){
      if (heightAt(player.pos.x + Math.cos(th) * r, player.pos.z + Math.sin(th) * r) < WATER){
        best = Math.min(best, r); break;
      }
    }
  }
  return best;
}
let arroyoT = 0;
function updateAudio(dt, env){
  if (!SND.on) return;
  const set = (nodo, val, freq) => {
    nodo.g.gain.value += (val - nodo.g.gain.value) * Math.min(1, dt * 2);
    if (freq) nodo.f.frequency.value += (freq - nodo.f.frequency.value) * Math.min(1, dt * 2);
  };
  // viento: más agudo y fuerte a la intemperie
  const expo = 1 - env.canopy * 0.6 - env.shelterQ * 0.3;
  set(SND.viento, 0.012 + windAmp.value * 0.055 * expo, 230 + windAmp.value * 380 * expo);
  // lluvia: distinta bajo dosel o bajo techo
  const lluvia = weather === 'lluvia' ? 0.075 * (1 - env.canopy * 0.45) * (1 - env.shelterQ * 0.6) : 0;
  set(SND.lluvia, lluvia, env.shelterQ > 0.3 ? 900 : env.canopy > 0.5 ? 1200 : 2000);
  // fuego cercano
  let df = 999;
  structures.forEach(s => { if (s.type === 'fire' && s.lit)
    df = Math.min(df, Math.hypot(s.x - player.pos.x, s.z - player.pos.z)); });
  const fuego = df < 12 ? 0.10 * (1 - df / 12) : 0;
  set(SND.fuego, fuego, 480);
  SND.chispaT -= dt;
  if (fuego > 0.01 && SND.chispaT <= 0){
    SND.chispaT = 0.12 + Math.random() * 0.5;
    golpe(1400 + Math.random() * 2200, 0.05, fuego * 1.6, 'bandpass');
  }
  // arroyo
  arroyoT -= dt;
  if (arroyoT <= 0){ arroyoT = 0.7; SND.arroyoD = distanciaAgua(); }
  set(SND.arroyo, SND.arroyoD < 60 ? 0.07 * (1 - SND.arroyoD / 60) : 0, 1000);
  // ambiente por hora
  const noche = timeOfDay > 21 || timeOfDay < 5.5;
  SND.aveT -= dt;
  if (!noche && SND.aveT <= 0){
    SND.aveT = 1.5 + Math.random() * 6;
    const alba = timeOfDay > 5.5 && timeOfDay < 10;
    if (Math.random() < (alba ? 0.95 : 0.5)){
      const f0 = 1800 + Math.random() * 2200;
      trino(f0, f0 * (0.6 + Math.random() * 0.9), 0.08 + Math.random() * 0.12, 0.05);
      if (Math.random() < 0.5) setTimeout(() => trino(f0 * 1.1, f0 * 0.7, 0.09, 0.04), 140);
    }
  }
  SND.grilloT -= dt;
  if (noche && SND.grilloT <= 0){
    SND.grilloT = 0.35 + Math.random() * 0.5;
    trino(4200, 4000, 0.035, 0.018);
    if (Math.random() < 0.04) trino(420, 300, 0.5, 0.05);     // cárabo lejano
  }
}

/* ---------- 13. bucle ---------- */
let last = performance.now(), saveT = 0;
function terrainY(x, z){ return heightAt(x, z); }

function updatePlayer(dt){
  const gy = terrainY(player.pos.x, player.pos.z);
  const prof = WATER - gy;                       // profundidad del agua bajo tus pies
  const nadando = prof > 1.55;
  const vadeo = prof > 0 && !nadando;
  const sobrecarga = Math.max(0, carga() / capacidad() - 0.55);

  let base = 3.9;
  if (crouch) base = 2.0;
  if (vadeo) base *= clamp(1 - prof * 0.42, 0.35, 1);
  if (nadando) base = 2.1 * (1 - sobrecarga * 0.9);
  const puedeCorrer = keys.ShiftLeft && player.vigor > 5 && !crouch && !nadando && prof < 0.5;
  const spd = puedeCorrer ? 7.4 : base;

  let ix = 0, iz = 0;
  if (keys.KeyW) iz -= 1; if (keys.KeyS) iz += 1;
  if (keys.KeyA) ix -= 1; if (keys.KeyD) ix += 1;
  if (isTouch){ ix += stickV.x; iz += stickV.y; }
  const l = Math.hypot(ix, iz); if (l > 1){ ix /= l; iz /= l; }
  const sin = Math.sin(player.yaw), cos = Math.cos(player.yaw);
  const dx = ix * cos + iz * sin, dz = -ix * sin + iz * cos;   // adelante = hacia donde miras
  const moving = l > 0.05;
  const sprinting = moving && puedeCorrer;

  const nx = player.pos.x + dx * spd * dt, nz = player.pos.z + dz * spd * dt;
  let blocked = false;
  nearChunks().forEach(c => c.trees.forEach(t => {
    if (blocked || t.felled) return;
    if ((nx - t.x) * (nx - t.x) + (nz - t.z) * (nz - t.z) < t.r * t.r) blocked = true;
  }));
  if (!blocked){ player.pos.x = nx; player.pos.z = nz; }

  if (nadando){
    player.pos.y += ((WATER - 0.55) - player.pos.y) * Math.min(1, dt * 4);
    player.vel.y = 0; player.onGround = false;
    player.vigor = clamp(player.vigor - dt * (5 + sobrecarga * 22 + (moving ? 3 : 0)), 0, 100);
    if (player.vigor <= 0){ player.salud -= dt * 5; if (Math.random() < dt) log('Tragas agua. Sal de ahí.'); }
  } else {
    if (keys.Space && player.onGround && !crouch){ player.vel.y = 4.6; player.onGround = false; }
    player.vel.y -= 14 * dt;
    player.pos.y += player.vel.y * dt;
    if (player.pos.y <= gy){ player.pos.y = gy; player.vel.y = 0; player.onGround = true; }
    player.vigor = clamp(player.vigor + (sprinting ? -9 : vadeo ? -2 : 11 * (inv.calzado ? 1.25 : 1)) * dt, 0, 100);
  }

  // altura de ojos: agachado, vadeando o nadando cambias de perfil
  const objetivo = nadando ? 0.45 : crouch ? 1.06 : 1.68;
  player.eye += (objetivo - player.eye) * Math.min(1, dt * 8);

  // pisadas y ruido propio
  if (moving && !nadando){
    bob += dt * spd * 1.5;
    SND.pasoT -= dt * spd * (crouch ? 0.55 : 1);
    if (SND.pasoT <= 0){
      SND.pasoT = 2.2;
      const sup = sonarPaso();
      ruido = (sup === 'hojarasca' ? 15 : sup === 'grava' ? 20 : sup === 'agua' ? 25 : 6)
              * (sprinting ? 2.2 : crouch ? 0.35 : 1);
      ruidoT = 1.2;
    }
  }
  ruidoT -= dt;
  if (ruidoT <= 0) ruido = Math.max(0, ruido - dt * 20);

  return { moving, sprinting, inWater: prof > 0.1, nadando, vadeo, prof };
}

function updateWorld(dt){
  timeOfDay += dt / DAY_LENGTH * 24;
  if (timeOfDay >= 24){ timeOfDay -= 24; dayCount++; if (dayCount >= 3) unlock('dia3'); log('Amanece el día ' + dayCount + '.'); }

  // meteorología
  weatherT -= dt;
  if (weatherT <= 0){
    const r = Math.random();
    weather = r < 0.55 ? 'despejado' : r < 0.82 ? 'nublado' : 'lluvia';
    weatherT = 120 + Math.random() * 240;
    if (weather === 'lluvia') log('Empieza a caer agua.');
  }
  windU.value += dt;
  windAmp.value += ((weather === 'lluvia' ? 2.4 : weather === 'nublado' ? 1.4 : 0.9) - windAmp.value) * dt * 0.3;
  rain.visible = weather === 'lluvia';
  if (rain.visible){
    const a = rainGeo.attributes.position.array;
    for (let i = 0; i < rainCount; i++){
      a[i * 3 + 1] -= 26 * dt;
      if (a[i * 3 + 1] < -2){ a[i * 3 + 1] = 22; a[i * 3] = (Math.random() - 0.5) * 46; a[i * 3 + 2] = (Math.random() - 0.5) * 46; }
    }
    rainGeo.attributes.position.needsUpdate = true;
    rain.position.set(player.pos.x, player.pos.y, player.pos.z);
  }

  // cielo y sol
  const ang = (timeOfDay / 24) * Math.PI * 2 - Math.PI / 2;
  const sd = new THREE.Vector3(Math.cos(ang), Math.sin(ang), 0.32).normalize();
  sun.position.set(player.pos.x + sd.x * 130, sd.y * 130, player.pos.z + sd.z * 130);
  sun.target.position.copy(player.pos);
  const day = clamp(sd.y * 3.2 + 0.22, 0, 1);
  const dusk = clamp(1 - Math.abs(sd.y) * 4.5, 0, 1);
  const cloudy = weather === 'despejado' ? 0 : weather === 'nublado' ? 0.45 : 0.75;
  const c = new THREE.Color(0x0a1018).lerp(new THREE.Color(0x8db2cc), day).lerp(new THREE.Color(0xc07a44), dusk * 0.75);
  c.lerp(new THREE.Color(0x6a7076), cloudy * day);
  skyMat.uniforms.uHor.value.copy(c);
  skyMat.uniforms.uTop.value.copy(c).lerp(new THREE.Color(0x2b5f96), 0.55 * day + 0.2).multiplyScalar(0.9);
  skyMat.uniforms.uSun.value.copy(sd);
  skyMat.uniforms.uSunCol.value.setHex(0xffdfae).lerp(new THREE.Color(0xff8a3c), dusk).multiplyScalar(clamp(day * 1.4, 0, 1));
  scene.fog.color.copy(c);
  scene.fog.density = 0.0055 + (1 - day) * 0.004 + cloudy * 0.003;
  sun.intensity = 1.25 * day * (1 - cloudy * 0.75);
  hemi.intensity = 0.16 + 0.42 * day;
  window.stars.material.opacity = clamp(1 - day * 2.4, 0, 0.9);
  window.stars.position.copy(player.pos);
  sky.position.copy(player.pos);
  water.position.set(player.pos.x, WATER, player.pos.z);
  waterNrm.offset.x += dt * 0.013; waterNrm.offset.y += dt * 0.009;
  waterNrm2.offset.x -= dt * 0.008; waterNrm2.offset.y += dt * 0.016;
  waterMat.normalScale.setScalar(0.35 + (weather === 'lluvia' ? 0.5 : 0.15));

  ambT = 11 + 8.5 * Math.sin((timeOfDay - 10) / 24 * Math.PI * 2) - cloudy * 3 - Math.max(0, player.pos.y) * 0.05;

  // estructuras
  let fireHeat = 0, sheltered = false, bedded = false, shelterQ = 0, bedQ = 0;
  structures.forEach(s => {
    if (s.type === 'fire'){
      if (s.lit){
        s.fuel -= dt;
        if (s.fuel <= 0 || (weather === 'lluvia' && !sheltered && Math.random() < dt * 0.05 * (1 - s.q))){
          s.lit = false; s.fuel = 0; log('El fuego se ha apagado.');
        }
        const f = 0.75 + Math.sin(performance.now() * 0.012) * 0.15;
        s.flame.visible = true; s.flame.scale.set(f, 0.8 + f * 0.4, f);
        s.light.intensity = 2.4 * f;
        const d = player.pos.distanceTo(new THREE.Vector3(s.x, s.y, s.z));
        const alc = 4 + s.q * 2.5;
        if (d < alc) fireHeat = Math.max(fireHeat, (1 - d / alc) * (0.05 + s.q * 0.07));
      } else { s.flame.visible = false; s.light.intensity = 0; }
    }
    if (s.type === 'catcher' && weather === 'lluvia')
      s.store = Math.min(4, (s.store || 0) + dt * (0.004 + s.q * 0.008));
    if (s.type === 'filtro' && s.timer > 0) s.timer -= dt;
    if (s.type === 'secadero' && s.load && !s.ready){
      s.timer -= dt;
      if (s.timer <= 0) s.ready = true;
    }
    if (s.type === 'trap' && !s.ready){
      s.timer -= dt;
      if (s.timer <= 0) s.ready = Math.random() < 0.7 ? true : (s.timer = 120, false);
    }
    if ((s.type === 'shelter' || s.type === 'roof') && player.pos.distanceTo(new THREE.Vector3(s.x, s.y, s.z)) < 3.4){
      sheltered = true; shelterQ = Math.max(shelterQ, s.q);
    }
    if (s.type === 'bed' && player.pos.distanceTo(new THREE.Vector3(s.x, s.y, s.z)) < 2.2){
      bedded = true; bedQ = Math.max(bedQ, s.q);
    }
  });
  // cobertura real: copas cercanas, ponderadas por tamaño y por lo desramadas que estén
  let cover = 0;
  nearChunks().forEach(c => c.trees.forEach(t => {
    if (t.felled) return;
    const dx = t.x - player.pos.x, dz = t.z - player.pos.z, d2 = dx * dx + dz * dz;
    if (d2 > 144) return;
    cover += (1 - d2 / 144) * (t.rad / 2.2) * (t.fol === undefined ? 1 : t.fol);
  }));
  const canopy = clamp(cover / 2.4, 0, 1);
  const vientoBase = weather === 'lluvia' ? 1 : weather === 'nublado' ? 0.6 : 0.32;
  const viento = clamp(vientoBase * (1 + Math.max(0, player.pos.y - 20) * 0.012) *
    (1 - canopy * 0.75) * (1 - shelterQ * 0.8), 0, 1.6);
  return { fireHeat, sheltered, bedded, shelterQ, bedQ, cloudy, canopy, viento };
}

function updateSurvival(dt, mv, env){
  // humedad corporal
  const dosel = env.canopy;                       // el bosque cerrado también protege
  const capa = (inv.capa ? 0.2 + (qual.capa || 0.3) * 0.35 : 0) +
               (inv.calzado ? 0.06 + (qual.calzado || 0.3) * 0.08 : 0);
  const sombrero = inv.sombrero ? 0.25 + (qual.sombrero || 0.3) * 0.3 : 0;
  if (weather === 'lluvia')
    player.mojado = clamp(player.mojado + dt * 0.014 * (1 - dosel * 0.75) * (1 - capa) *
      (1 - sombrero) * (1 - env.shelterQ), 0, 1);
  else if (env.fireHeat > 0.02) player.mojado = clamp(player.mojado - dt * 0.055, 0, 1);
  else player.mojado = clamp(player.mojado - dt * 0.014, 0, 1);
  if (mv.inWater) player.mojado = 1;

  // termorregulación: pérdidas lentas, recuperación clara junto al fuego
  const aisl = clamp(1 - capa - env.shelterQ * 0.25 - dosel * 0.1, 0.25, 1);
  let heat = 0.005;                                       // metabolismo basal
  heat += (ambT - 15) * 0.0009 * aisl;
  heat += env.fireHeat + env.shelterQ * 0.010 + env.bedQ * 0.014;
  heat += mv.moving ? 0.008 : 0;
  heat -= player.mojado * 0.005 * aisl;
  heat -= env.viento * 0.0045 * aisl;           // el viento en campo abierto enfría de verdad
  sensacion = ambT - env.viento * 5 - player.mojado * 4;
  player.temp += heat * dt;
  if (heat > 0 && player.temp > 37) player.temp = Math.min(player.temp, 37.4);
  player.temp = clamp(player.temp, 30, 39.5);

  player.agua = clamp(player.agua - dt * (0.042 + (mv.sprinting ? 0.05 : 0)), 0, 100);
  player.energia = clamp(player.energia - dt * (sleeping ? 0.016 : 0.028) *
    (1 + (mv.sprinting ? 1.4 : 0) + (player.temp < 36 ? 0.9 : 0)), 0, 100);

  let dmg = 0;
  if (player.temp < 35.2) dmg += (35.2 - player.temp) * 1.0;
  if (player.agua <= 0) dmg += 1.6;
  if (player.energia <= 0) dmg += 0.9;
  if (dmg > 0) player.salud -= dmg * dt;
  else if (player.energia > 30 && player.agua > 30 && player.temp > 36.2) player.salud = clamp(player.salud + dt * 0.5, 0, 100);

  if (player.torch){
    player.torchFuel -= dt;
    torchLight.position.set(player.pos.x, player.pos.y + 1.5, player.pos.z);
    torchLight.intensity = 1.8 + Math.sin(performance.now() * 0.01) * 0.25;
    player.mojado = clamp(player.mojado - dt * 0.01, 0, 1);
    if (player.torchFuel <= 0){ player.torch = false; torchLight.intensity = 0; inv.antorcha--; log('La antorcha se ha consumido.'); }
  }

  cobijo = env.shelterQ > 0.05 ? 'bajo refugio' :
           env.canopy > 0.55 ? 'bajo el dosel' :
           env.canopy > 0.25 ? 'entre árboles' : 'a la intemperie';

  if (player.salud <= 0 && !dead){ dead = true; showVeil('muerte'); }
}

function frame(now){
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, 0.06); last = now;
  if (!paused && !bookOpen){
    const simDt = sleeping ? dt * 45 : dt;
    const mv = sleeping ? { moving: false, sprinting: false, inWater: false } : updatePlayer(dt);
    updateChunks();
    updateCesped();
    const env = updateWorld(simDt);
    updateSurvival(simDt, mv, env);

    if (sleeping){
      sleptH += simDt / DAY_LENGTH * 24;
      player.vigor = clamp(player.vigor + simDt * 0.9, 0, 100);
      if (player.temp > 36.2) player.salud = clamp(player.salud + simDt * 0.35, 0, 100);
      $('#dream').classList.add('on');
      $('#dream').textContent = 'Duermes · ' + String(Math.floor(timeOfDay)).padStart(2, '0') + ':' +
        String(Math.floor((timeOfDay % 1) * 60)).padStart(2, '0');
      let motivo = '';
      if (player.temp < 35.6) motivo = 'Te despierta el frío. Necesitas fuego o mejor cama.';
      else if (player.agua < 8) motivo = 'La sed te saca del sueño.';
      else if (sleptH > 1 && timeOfDay > 6.3 && timeOfDay < 12) motivo = 'Amanece. Has descansado.';
      else if (sleptH > 14) motivo = 'Te desvelas.';
      if (motivo){
        sleeping = false; sleptH = 0;
        $('#dream').classList.remove('on');
        save(true);
        player.vigor = Math.max(player.vigor, 60 + sleepQ * 40);
        log(motivo);
      }
    }

    // recursos en reposo
    nearChunks().forEach(c => {
      c.res.forEach(r => {
        if (r.cooldown > 0){
          r.cooldown -= dt;
          if (r.cooldown <= 0){
            r.mesh.visible = true;
            if (PROPS[r.kind]) r.usos = r.kind === 'troncoCaido' ? 4 : 3;
            const df = worldDiff[key(r.ci, r.cj)]; if (df) delete df.r[r.ri];
          }
        }
      });
      c.trees.forEach(t => {
        if (t.cool > 0){
          t.cool -= dt;
          if (t.cool <= 0 && t.fol !== undefined && t.fol < 1 && !t.felled){
            t.fol = Math.min(1, t.fol + 0.18); refreshFoliage(t); marcarArbol(t);
          }
        }
      });
    });

    // interacción
    target = sleeping ? null : findTarget();
    if (target){
      promptEl.innerHTML = (isTouch ? '' : '<kbd>E</kbd>') + target.label + (target.hold ? ' (mantén)' : '');
      promptEl.classList.add('on');
      if (keys.KeyE){
        if (target.hold){
          holdT += dt;
          promptBar.style.display = 'block';
          promptBar.firstElementChild.style.width = (holdT / target.hold * 100) + '%';
          if (holdT >= target.hold){ doAction(target); holdT = 0; keys.KeyE = false; promptBar.style.display = 'none'; }
        } else { doAction(target); keys.KeyE = false; }
      } else { holdT = 0; promptBar.style.display = 'none'; }
    } else { promptEl.classList.remove('on'); promptBar.style.display = 'none'; holdT = 0; }

    updateFauna(dt);
    updateAudio(dt, env);

    // HUD
    const hh = Math.floor(timeOfDay), mm = Math.floor((timeOfDay % 1) * 60);
    $('#clock').textContent = String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
    $('#dayn').textContent = dayCount;
    $('#weather').textContent = weather + ' · ' + Math.round(ambT) + '° (sens. ' + Math.round(sensacion) + '°)' +
      (player.mojado > 0.35 ? ' · empapado' : '');
    $('#biome').textContent = BIOME[biomeAt(player.pos.x, player.pos.z)].name + ' · ' + cobijo;
    drawVitals(); drawPack();

    saveT += dt;
    if (saveT > 20 && !sleeping){ saveT = 0; save(true); }
  }
  camera.position.set(player.pos.x, player.pos.y + player.eye + Math.sin(bob * 2) * 0.035, player.pos.z);
  camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ');
  if (swing > 0) swing = Math.max(0, swing - dt * 3.2);
  handGroup.rotation.x = -swing * 1.5 + Math.sin(bob) * 0.03;
  handGroup.rotation.z = swing * 0.5;
  handGroup.position.y = -0.26 + Math.sin(bob * 2) * 0.012 - swing * 0.05;
  if (post){
    postMat.uniforms.uTime.value = now * 0.0002;
    postMat.uniforms.uNoche.value = clamp(1 - (sun.intensity / 0.9), 0, 1);
    renderer.setRenderTarget(rt);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(postScene, postCam);
  } else renderer.render(scene, camera);
}
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  resizeRT();
});
resizeRT();

/* arranque: genera un claro habitable antes de mostrar nada */
(function(){
  const sp = findSpawn();
  player.pos.set(sp.x, 0, sp.z);
  updateChunks();
  player.pos.y = heightAt(sp.x, sp.z);
  player.yaw = Math.random() * 6.28;
  updateCesped();
})();
drawVitals(); drawPack();
TOOLS.cuchillo.visible = true;
drawHotbar();
requestAnimationFrame(frame);


/* Solo en desarrollo: Vite lo elimina del build de producción. Permite mover la
   hora y mirar la escena sin tener que jugar hasta el mediodía. */
if (import.meta.env && import.meta.env.DEV){
  window.raizDev = {
    scene, renderer, camera, player, cesped, structures,
    // qué hay bajo un punto de pantalla, en coordenadas normalizadas (-1..1)
    queEsEso(nx, ny){
      const rc = new THREE.Raycaster();
      rc.setFromCamera({ x: nx, y: ny }, camera);
      return rc.intersectObjects(scene.children, true).slice(0, 4).map(h => ({
        dist: +h.distance.toFixed(1), tipo: h.object.type, geo: h.object.geometry?.type,
        mat: h.object.material?.type, color: h.object.material?.color?.getHexString?.(),
        instancia: h.instanceId, escala: h.object.scale.toArray().map(n => +n.toFixed(2))
      }));
    },
    // corre el bucle sin pointer lock: en pausa updateWorld no actualiza cielo ni sol
    correr(){ paused = false; const v = document.querySelector('#veil'); if (v) v.style.display = 'none'; },
    parar(){ paused = true; },
    get hora(){ return timeOfDay; },
    set hora(v){ timeOfDay = v; },
    get calidad(){ return calidad; },
    // teleporte con reconstrucción: el bucle no actualiza el mundo en pausa
    ir(x, z, yaw){
      player.pos.set(x, heightAt(x, z), z);
      if (yaw !== undefined) player.yaw = yaw;
      limpiarMundo(); updateChunks();
      cespedFull = true; updateCesped();
      player.pos.y = heightAt(x, z);
    },
    mirar(yaw, pitch){ player.yaw = yaw; if (pitch !== undefined) player.pitch = pitch; }
  };
}
