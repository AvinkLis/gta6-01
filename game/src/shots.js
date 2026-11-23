// Screenshot staging for ?shot=start|play|end&seed=N. Each scene resets the world with the
// seed, then advances the real simulation with a simple autopilot: get in the starter car,
// steer toward the current mission target, brake for corners. Deterministic per seed.
import { STEP } from './config.js';
import { nearestRoad } from './city.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

/** Next road-network waypoint toward the target: align onto a road, travel along it,
 *  turn at the target's cross street, then home in. Keeps the pilot off the buildings. */
function waypoint(pos, target) {
  const roadX = nearestRoad(pos.x), roadY = nearestRoad(pos.y);
  const targetRoadX = nearestRoad(target.x), targetRoadY = nearestRoad(target.y);
  const onVerticalRoad = Math.abs(pos.x - roadX) < 42;
  const onHorizontalRoad = Math.abs(pos.y - roadY) < 42;
  if (Math.abs(pos.x - targetRoadX) > 34) {
    if (!onHorizontalRoad) return { x: pos.x, y: roadY }; // reach a horizontal road first
    return { x: targetRoadX, y: roadY };
  }
  if (Math.abs(pos.y - targetRoadY) > 34) {
    if (!onVerticalRoad) return { x: roadX, y: pos.y }; // reach a vertical road first
    return { x: roadX, y: targetRoadY };
  }
  return target;
}

function autopilotInput(state) {
  const p = state.player;
  const input = { moveX: 0, moveY: 0, run: true, accel: 0, steer: 0, brake: false, interact: false };
  const target = state.mission && state.mission.target ? state.mission.target : { x: 1200, y: 1200 };
  if (!p.inCar) {
    // Walk to the nearest drivable car and get in.
    let best = null, bd = Infinity;
    for (const car of state.cars) {
      if (car.hp <= 0 || car.kind === 'police') continue;
      const d = Math.hypot(car.x - p.x, car.y - p.y);
      if (d < bd) { bd = d; best = car; }
    }
    if (!best) return input;
    if (bd < 44) { input.interact = true; return input; }
    input.moveX = Math.sign(best.x - p.x); input.moveY = Math.sign(best.y - p.y);
    return input;
  }
  const car = p.inCar;
  const wp = waypoint(car, target);
  const want = Math.atan2(wp.y - car.y, wp.x - car.x);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  input.steer = Math.max(-1, Math.min(1, diff * 2.2));
  input.accel = Math.abs(diff) > 2.2 ? -0.4 : 1;
  if (Math.abs(car.speed) > 165) { input.accel = 0; if (Math.abs(diff) > 0.4) input.brake = true; }
  return input;
}

export function stageShot(name, world) {
  world.reset();
  const state = world.state;
  if (name !== 'play' && name !== 'end') {
    for (let i = 0; i < 4 / STEP; i++) world.step(STEP, { moveX: 0, moveY: 0, run: false, accel: 0, steer: 0, brake: false, interact: false });
    return { screen: SCREEN_TITLE, best: 0 };
  }
  const seconds = name === 'play' ? 16 : 34;
  for (let i = 0; i < seconds / STEP; i++) {
    if (state.over) break;
    world.step(STEP, autopilotInput(state));
  }
  if (name === 'end' && !state.over) {
    // Stage the game-over frame deterministically: the run is played for real above,
    // then the player is caught — the end screen shows the run's actual cash and jobs.
    state.over = 'BUSTED';
    state.bustMeter = 1.6;
  }
  return { screen: state.over ? SCREEN_OVER : SCREEN_PLAY, best: state.cash };
}
