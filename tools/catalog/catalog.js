// Dev-only model contact sheet: ?kit=hall&names=a,b,c (or all models of the kit when names omitted)
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
const qs = new URLSearchParams(location.search);
const kit = qs.get('kit');
const KITS = JSON.parse(decodeURIComponent(qs.get('kits')));
const [dir, ext] = KITS[kit];
const names = qs.get('names').split(',');
const cols = Number(qs.get('cols')) || 8;
const cell = 3;
const renderer = new THREE.WebGLRenderer({ antialias: true, canvas: document.getElementById('c') });
renderer.setSize(1600, 1000); renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x8aa0b8);
scene.add(new THREE.HemisphereLight(0xffffff, 0x556677, 1.6));
const dl = new THREE.DirectionalLight(0xffffff, 2); dl.position.set(3, 6, 4); scene.add(dl);
const loader = new GLTFLoader();
const rows = Math.ceil(names.length / cols);
const labels = document.getElementById('labels');
let done = 0;
names.forEach((n, i) => {
  loader.load(`/${dir}/${n}${ext}`, (g) => {
    const o = g.scene; if (qs.get('basic')) o.traverse((m) => { if (m.isMesh) m.material = new THREE.MeshBasicMaterial({ map: m.material.map, side: THREE.DoubleSide }); }); const b = new THREE.Box3().setFromObject(o); const s = b.getSize(new THREE.Vector3());
    const k = 2.4 / Math.max(s.x, s.y, s.z);
    const wrap = new THREE.Group(); wrap.add(o); o.scale.setScalar(k); o.position.sub(b.getCenter(new THREE.Vector3()).multiplyScalar(k));
    wrap.position.set((i % cols) * cell, -Math.floor(i / cols) * cell, 0); wrap.rotation.y = 0.6; wrap.rotation.x = Number(qs.get('tilt')||0);
    scene.add(wrap); if (++done === names.length) window.__done = true;
  }, undefined, () => { console.error('fail ' + n); if (++done === names.length) window.__done = true; });
  const d = document.createElement('div'); d.textContent = n; d.style.cssText = `position:absolute;left:${(i % cols) / cols * 100 + 0.3}%;top:${Math.floor(i / cols) / rows * 100 + 0.3}%;font:12px monospace;color:#000;background:#fff8`; labels.appendChild(d);
});
const cam = new THREE.OrthographicCamera(-cell / 2, cols * cell - cell / 2, cell / 2, -(rows - 1) * cell - cell / 2, 0.1, 100);
cam.position.set(0, 2, 10); cam.lookAt(0, 0, 0); cam.position.set(0, 0, 10); cam.lookAt(0, 0, 0);
// slight top-down tilt
const tick = () => { renderer.render(scene, cam); requestAnimationFrame(tick); }; tick();
