// Procedural city generation: a grid of roads, city blocks split into buildings (solid),
// sidewalks around each block, parked cars on road edges and a few moving traffic cars.
// Everything is derived from the seeded RNG, so a seed always yields the same city.
import { BLOCK_PITCH, ROAD_HALF, WORLD_SIZE } from './config.js';
import { randRange, randPick } from './random.js';

const BUILDING_COLORS = ['#5b6b82', '#6e5a4e', '#4e6e5f', '#756a8a', '#7a5f63', '#54687a', '#68707c', '#5f7052'];
const CAR_COLORS = ['#c0392b', '#2471a3', '#b7950b', '#1e8449', '#7d3c98', '#ba4a00', '#616a6b', '#a93226'];

/** Road centreline coordinates along one axis. */
export function roadLines() {
  const lines = [];
  for (let c = BLOCK_PITCH / 2; c < WORLD_SIZE; c += BLOCK_PITCH) lines.push(c);
  return lines;
}
/** Nearest road centreline coordinate to v (roads run at those lines on both axes). */
export function nearestRoad(v) {
  const lines = roadLines();
  let best = lines[0], bd = Infinity;
  for (const l of lines) { const d = Math.abs(l - v); if (d < bd) { bd = d; best = l; } }
  return best;
}
export function isOnRoad(x, y) {
  const dx = Math.abs(x - nearestRoad(x));
  const dy = Math.abs(y - nearestRoad(y));
  return dx <= ROAD_HALF || dy <= ROAD_HALF;
}

export function generateCity(rng) {
  const buildings = [];
  const blocks = [];
  // City blocks are the land between neighbouring road lines (plus the strips at the
  // world edges); each block gets 1-4 buildings with sidewalk gaps between them.
  const lines0 = roadLines();
  const edges = [0, ...lines0.flatMap(l => [l - ROAD_HALF, l + ROAD_HALF]), WORLD_SIZE];
  const segments = [];
  for (let i = 0; i + 1 < edges.length; i += 2) segments.push([edges[i], edges[i + 1]]);
  for (const [sx, ex] of segments) {
    for (const [sy, ey] of segments) {
      const bw = ex - sx, bh = ey - sy;
      if (bw < 60 || bh < 60) continue;
      blocks.push({ x: sx + 6, y: sy + 6, w: bw - 12, h: bh - 12 });
      const x0 = sx + 14, y0 = sy + 14;
      const sizeW = bw - 28, sizeH = bh - 28;
      const splitX = sizeW > 200 && rng() < 0.7 ? 2 : 1;
      const splitY = sizeH > 200 && rng() < 0.7 ? 2 : 1;
      const cw = sizeW / splitX, ch = sizeH / splitY;
      for (let i = 0; i < splitX; i++) for (let j = 0; j < splitY; j++) {
        if (rng() < 0.12) continue; // an empty lot / plaza corner
        const pad = randRange(rng, 6, 14);
        buildings.push({
          x: x0 + i * cw + pad, y: y0 + j * ch + pad,
          w: cw - pad * 2, h: ch - pad * 2,
          color: randPick(rng, BUILDING_COLORS),
          roof: randRange(rng, 0.75, 1.0),
        });
      }
    }
  }
  const lines = roadLines();
  const cars = [];
  let id = 1;
  // Parked cars: along road edges at random spots.
  for (let i = 0; i < 42; i++) {
    const horiz = rng() < 0.5;
    const line = randPick(rng, lines);
    const along = randRange(rng, 80, WORLD_SIZE - 80);
    const off = (rng() < 0.5 ? -1 : 1) * (ROAD_HALF - 16);
    const x = horiz ? along : line + off;
    const y = horiz ? line + off : along;
    cars.push({ id: id++, kind: 'civil', x, y, angle: horiz ? 0 : Math.PI / 2, speed: 0, hp: 100, color: randPick(rng, CAR_COLORS), parked: true, driver: 'none', damageCooldown: 0 });
  }
  // Traffic cars: cruising along a road line in a lane, turning at intersections sometimes.
  for (let i = 0; i < 10; i++) {
    const horiz = rng() < 0.5;
    const line = randPick(rng, lines);
    const lane = (rng() < 0.5 ? -1 : 1) * 24;
    const along = randRange(rng, 100, WORLD_SIZE - 100);
    cars.push({
      id: id++, kind: 'traffic',
      x: horiz ? along : line + lane, y: horiz ? line + lane : along,
      angle: horiz ? (lane > 0 ? 0 : Math.PI) : (lane > 0 ? Math.PI / 2 : -Math.PI / 2),
      speed: randRange(rng, 55, 85), hp: 100, color: randPick(rng, CAR_COLORS), parked: false, driver: 'ai', damageCooldown: 0,
    });
  }
  // The player's handy starter car, parked near spawn.
  cars.push({ id: id++, kind: 'civil', x: 252, y: 168, angle: 0, speed: 0, hp: 100, color: '#d4ac0d', parked: true, driver: 'none', damageCooldown: 0 });
  return { buildings, blocks, cars, nextCarId: id };
}

/** Push a circle (x,y,r) out of every building rect; returns true if it hit anything. */
export function collideBuildings(buildings, obj, r) {
  let hit = false;
  for (const b of buildings) {
    const nx = Math.max(b.x, Math.min(obj.x, b.x + b.w));
    const ny = Math.max(b.y, Math.min(obj.y, b.y + b.h));
    const dx = obj.x - nx, dy = obj.y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      hit = true;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        obj.x = nx + (dx / d) * r; obj.y = ny + (dy / d) * r;
      } else {
        // Centre inside the rect: push out along the smallest penetration axis.
        const left = obj.x - b.x, right = b.x + b.w - obj.x, top = obj.y - b.y, bot = b.y + b.h - obj.y;
        const m = Math.min(left, right, top, bot);
        if (m === left) obj.x = b.x - r; else if (m === right) obj.x = b.x + b.w + r;
        else if (m === top) obj.y = b.y - r; else obj.y = b.y + b.h + r;
      }
    }
  }
  obj.x = Math.max(r, Math.min(WORLD_SIZE - r, obj.x));
  obj.y = Math.max(r, Math.min(WORLD_SIZE - r, obj.y));
  return hit;
}
