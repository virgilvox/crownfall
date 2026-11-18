// Model kits: token prefix -> [folder, extension]. A model is referenced in code as a string token 'kit:name'
// (for example 'hall:crypt'). tools/build.mjs scans the source for these tokens to decide which files ship.
export const KITS = {
  plat: ['assets/env/kenney-platformer', '.glb'],
  fps: ['assets/env/kenney-fps', '.glb'],
  hex: ['assets/env/kenney-hex', '.gltf.glb'],
  kcity: ['assets/env/kenney-city', '.glb'],
  race: ['assets/env/kenney-racing', '.glb'],
  arena: ['assets/env/kenney-arena', '.glb'],
  proto: ['assets/env/kaykit-prototype', '.gltf'],
  space: ['assets/env/kaykit-space-base', '.gltf'],
  hall: ['assets/env/kaykit-halloween', '.gltf'],
  cityb: ['assets/env/kaykit-city-builder', '.gltf'],
  rest: ['assets/env/kaykit-restaurant', '.gltf'],
};
export function modelUrl(token) {
  const i = token.indexOf(':');
  const k = KITS[token.slice(0, i)];
  if (!k) throw new Error('bad model token ' + token);
  return `${k[0]}/${token.slice(i + 1)}${k[1]}`;
}
