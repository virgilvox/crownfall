import { build as garden } from './garden.js';
import { build as rooftops } from './rooftops.js';
import { build as hollow } from './hollow.js';
import { build as orbit } from './orbit.js';
import { build as kitchen } from './kitchen.js';

export const ARENAS = [
  { id: 'garden', name: 'SKY GARDEN', tagline: 'Mind the crumbling tiles', hazard: 'CRUMBLING PLATFORMS', color: '#5ecbff', build: garden },
  { id: 'rooftops', name: 'NEON ROOFTOPS', tagline: 'Hold on when the wind kicks up', hazard: 'WIND GUSTS', color: '#ff4fd8', build: rooftops },
  { id: 'hollow', name: 'PUMPKIN HOLLOW', tagline: 'Giant jack-o-lanterns on the loose', hazard: 'ROLLING PUMPKINS', color: '#ff9a2e', build: hollow },
  { id: 'orbit', name: 'ORBIT STATION', tagline: 'Low gravity, falling rocks', hazard: 'METEOR SHOWERS', color: '#7aa8ff', build: orbit },
  { id: 'kitchen', name: 'KITCHEN CHAOS', tagline: 'The stoves are heating up', hazard: 'HOT STOVES', color: '#ffb23a', build: kitchen },
];
const cache = new Map();
export async function loadArena(id, ctx) {
  if (!cache.has(id)) { const def = ARENAS.find((a) => a.id === id); cache.set(id, def.build(ctx)); }
  return cache.get(id);
}
