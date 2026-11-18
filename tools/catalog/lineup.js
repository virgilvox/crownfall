import * as THREE from 'three';
import { parseVRM, loadAnimJson } from '../../src/assets.js';
import { decodeAnimData } from '../../src/anims.js';
import { Actor } from '../../src/character.js';
const qs = new URLSearchParams(location.search);
const file = qs.get('file') || 'x-avatarsample-g';
const clips = (qs.get('clips') || 'Idle_Loop,Jog_Fwd_Loop,Sprint_Loop,Jump_Loop,NinjaJump_Idle_Loop,Shield_Dash,Roll,Hit_Knockback,Dance_Loop,Punch_Cross,Swim_Idle_Loop,Death01').split(',');
const renderer = new THREE.WebGLRenderer({ antialias: true, canvas: document.getElementById('c') });
renderer.setSize(1800, 700); renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x7d8fa6);
scene.add(new THREE.HemisphereLight(0xffffff, 0x667788, 0.95)); const dl = new THREE.DirectionalLight(0xffffff, 1.9); dl.position.set(1, 3, 4); scene.add(dl);
const data = decodeAnimData(await loadAnimJson());
const actors = [];
const vrmFile = file.endsWith('.vrm') ? file : file + '.vrm';
for (let i = 0; i < clips.length; i++) { const vrm = await parseVRM(vrmFile); const a = new Actor(vrm, data, { id: file }); a.root.position.x = (i - (clips.length - 1) / 2) * 1.5; scene.add(a.root); actors.push(a); a.fixedBase = clips[i]; }
const cam = new THREE.PerspectiveCamera(30, 1800 / 700, 0.1, 100); cam.position.set(0, 1.0, 12); cam.lookAt(0, 0.85, 0);
let t = 0;
function tick() { const dt = 1 / 60; t += dt; actors.forEach((a) => a.update(dt, { speed: 0, grounded: true })); renderer.render(scene, cam); if (t > 0.9) window.__ready = true; requestAnimationFrame(tick); } tick();
