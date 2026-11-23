// Game rules and state: player on foot / in a car, traffic, pedestrians, police AI,
// the wanted system, health, and the three-mission chain. No drawing, no browser APIs.
import { CAR_MAX_HP, CAR_RADIUS, PLAYER_MAX_HP, PLAYER_RADIUS, PLAYER_RUN, PLAYER_WALK, WORLD_SIZE } from './config.js';
import { collideBuildings, generateCity, nearestRoad } from './city.js';
import { randRange, randPick } from './random.js';

export const EVENT_CRIME = 1;
export const EVENT_MISSION = 2;
export const EVENT_OVER = 4;

const PED_COLORS = ['#e67e22', '#ecf0f1', '#3498db', '#e74c3c', '#2ecc71', '#f1c40f', '#fd79a8'];
const MISSION_SPOTS = [
  { pickup: { x: 630, y: 210 }, drop: { x: 1890, y: 630 } },
  { start: { x: 1050, y: 1470 } },
  { start: { x: 210, y: 210 } },
];

function dist(a, b) { const dx = a.x - b.x, dy = a.y - b.y; return Math.hypot(dx, dy); }
function angleTo(a, b) { return Math.atan2(b.y - a.y, b.x - a.x); }
function wrapAngle(a) { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; }

export function createWorld(rng) {
  const state = {
    time: 0, cash: 0, best: 0, wanted: 0, hideTime: 0, crimeHeat: 0,
    over: '', bustMeter: 0, message: '', messageTime: 0, shake: 0,
    player: null, cars: [], peds: [], buildings: [], blocks: [],
    mission: null, missionsDone: 0, freeRoam: false,
  };
  let nextPedId = 1;

  function spawnPed(x, y) {
    state.peds.push({
      id: nextPedId++, x, y, angle: rng() * Math.PI * 2, speed: randRange(rng, 26, 44),
      color: randPick(rng, PED_COLORS), state: 'walk', timer: randRange(rng, 2, 6), down: 0,
      tx: x, ty: y,
    });
  }

  function startMission(index) {
    if (index >= 3) {
      state.mission = null; state.freeRoam = true;
      setMessage('All jobs done. Free roam — the city is yours.');
      return;
    }
    const spot = MISSION_SPOTS[index];
    if (index === 0) state.mission = { index, phase: 'pickup', target: { ...spot.pickup }, drop: { ...spot.drop }, timer: 120, title: 'Job 1: Pick up the package', reward: 500 };
    else if (index === 1) {
      // Target car cruises near the start intersection.
      const car = { id: 900 + index, kind: 'target', x: spot.start.x, y: spot.start.y, angle: 0, speed: 70, hp: 60, color: '#8e44ad', parked: false, driver: 'ai', damageCooldown: 0 };
      state.cars.push(car);
      state.mission = { index, phase: 'ram', target: { x: car.x, y: car.y }, targetCarId: car.id, timer: 150, title: 'Job 2: Wreck the purple rival car', reward: 750 };
    } else {
      state.mission = { index, phase: 'escape', target: null, timer: 180, title: 'Job 3: Lose the cops (reach 0 stars)', reward: 1000 };
      addWanted(3, true);
    }
    setMessage(state.mission.title);
  }

  function setMessage(text) { state.message = text; state.messageTime = 4; }
  function addWanted(n, force) {
    const before = state.wanted;
    state.wanted = Math.max(force ? n : 0, Math.min(5, state.wanted + (force ? 0 : n)));
    if (force) state.wanted = Math.min(5, Math.max(state.wanted, n));
    state.hideTime = 0;
    if (state.wanted > before) state.crimeHeat = 1;
  }
  function completeMission() {
    const m = state.mission;
    state.cash += m.reward;
    state.missionsDone += 1;
    setMessage(`Job done! +$${m.reward}`);
    startMission(m.index + 1);
    return EVENT_MISSION;
  }

  function reset() {
    const city = generateCity(rng);
    state.buildings = city.buildings; state.blocks = city.blocks; state.cars = city.cars;
    state.peds = []; nextPedId = 1;
    for (let i = 0; i < 26; i++) {
      // Pedestrians stroll on sidewalks: just inside block edges or along road verges.
      const bx = randRange(rng, 60, WORLD_SIZE - 60), by = randRange(rng, 60, WORLD_SIZE - 60);
      spawnPed(nearestRoad(bx) + randRange(rng, -44, 44), by);
    }
    state.time = 0; state.cash = 0; state.wanted = 0; state.hideTime = 0; state.crimeHeat = 0;
    state.over = ''; state.bustMeter = 0; state.missionsDone = 0; state.freeRoam = false; state.shake = 0;
    state.player = { x: 210, y: 258, angle: 0, hp: PLAYER_MAX_HP, inCar: null, speed: 0, interactCooldown: 0 };
    startMission(0);
  }

  function playerPos() {
    const p = state.player;
    return p.inCar ? p.inCar : p;
  }

  function damagePlayer(n) {
    const p = state.player;
    p.hp -= n;
    if (p.hp <= 0 && !state.over) { p.hp = 0; state.over = 'WASTED'; }
  }

  function step(dt, input) {
    if (state.over) return EVENT_OVER;
    let events = 0;
    state.time += dt;
    if (state.messageTime > 0) state.messageTime -= dt;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 2.4);
    const p = state.player;
    if (p.interactCooldown > 0) p.interactCooldown -= dt;

    // ---- enter / exit car ----
    if (input.interact && p.interactCooldown <= 0) {
      p.interactCooldown = 0.45;
      if (p.inCar) {
        const car = p.inCar;
        p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 26;
        p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 26;
        car.driver = 'none'; car.parked = true; car.speed = 0;
        p.inCar = null;
        collideBuildings(state.buildings, p, PLAYER_RADIUS);
      } else {
        let best = null, bd = 52;
        for (const car of state.cars) { const d = dist(p, car); if (d < bd && car.hp > 0) { bd = d; best = car; } }
        if (best) {
          p.inCar = best; best.driver = 'player'; best.parked = false;
          if (best.kind === 'traffic') { addWanted(1); events |= EVENT_CRIME; setMessage('Car jacked! The cops noticed.'); }
        }
      }
    }

    // ---- player movement ----
    if (p.inCar) {
      const car = p.inCar;
      const accel = input.accel || 0;
      const maxSpeed = 305 * (0.45 + 0.55 * (car.hp / CAR_MAX_HP));
      if (accel > 0) car.speed = Math.min(maxSpeed, car.speed + 190 * dt);
      else if (accel < 0) car.speed = Math.max(-110, car.speed - 220 * dt);
      else car.speed *= Math.max(0, 1 - 1.6 * dt);
      if (input.brake) car.speed *= Math.max(0, 1 - 5 * dt);
      car.angle += (input.steer || 0) * 1.9 * dt * (car.speed >= 0 ? 1 : -1) * Math.min(1, Math.abs(car.speed) / 90 + 0.15);
      const px = car.x, py = car.y;
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      const speedBefore = Math.abs(car.speed);
      if (collideBuildings(state.buildings, car, CAR_RADIUS) && speedBefore > 60) {
        const dmg = (speedBefore - 50) / 14;
        car.hp -= dmg; damagePlayer(dmg * 0.35); state.shake = Math.min(1, dmg / 12);
        car.speed *= -0.25;
        if (car.hp <= 0) { car.hp = 0; setMessage('Your ride is wrecked! Get out (E).'); }
      } else if (Math.abs(car.x - px) + Math.abs(car.y - py) < 0.01 && speedBefore > 40) car.speed *= 0.6;
      p.x = car.x; p.y = car.y; p.angle = car.angle; p.speed = car.speed;
    } else {
      const sp = input.run ? PLAYER_RUN : PLAYER_WALK;
      const mx = input.moveX || 0, my = input.moveY || 0;
      const len = Math.hypot(mx, my) || 1;
      if (mx || my) { p.x += (mx / len) * sp * dt; p.y += (my / len) * sp * dt; p.angle = Math.atan2(my, mx); p.speed = sp; }
      else p.speed = 0;
      collideBuildings(state.buildings, p, PLAYER_RADIUS);
    }

    stepTraffic(dt);
    stepPeds(dt);
    events |= stepCarHits(dt);
    stepPolice(dt, events);
    events |= stepMission(dt);
    stepWanted(dt);

    if (state.over) events |= EVENT_OVER;
    return events;
  }

  function stepTraffic(dt) {
    for (const car of state.cars) {
      if (car.driver !== 'ai' || car.hp <= 0) continue;
      if (car.kind === 'target' && state.mission && state.mission.targetCarId === car.id) {
        // Rival driver flees the player, sticking roughly to roads.
        const pp = playerPos();
        if (dist(car, pp) < 320) {
          const away = angleTo(pp, car);
          car.angle += Math.max(-2.2 * dt, Math.min(2.2 * dt, wrapAngle(away - car.angle)));
          car.speed = Math.min(215, car.speed + 120 * dt);
        } else car.speed += (70 - car.speed) * dt;
      }
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      if (collideBuildings(state.buildings, car, CAR_RADIUS)) {
        car.angle += Math.PI * 0.9; car.speed *= 0.4;
      }
      // Turn along roads at the world edge.
      if (car.x < 70 || car.x > WORLD_SIZE - 70 || car.y < 70 || car.y > WORLD_SIZE - 70) car.angle += Math.PI * dt * 2;
      if (car.damageCooldown > 0) car.damageCooldown -= dt;
    }
  }

  function stepPeds(dt) {
    const pp = playerPos();
    const danger = state.player.inCar && Math.abs(state.player.speed) > 60;
    for (const ped of state.peds) {
      if (ped.down > 0) { ped.down -= dt; continue; }
      const d = dist(ped, pp);
      if (danger && d < 95) { ped.state = 'flee'; ped.timer = 1.2; }
      if (ped.state === 'flee') {
        const a = angleTo(pp, ped);
        ped.x += Math.cos(a) * 118 * dt; ped.y += Math.sin(a) * 118 * dt;
        ped.timer -= dt; if (ped.timer <= 0) ped.state = 'walk';
      } else {
        ped.timer -= dt;
        if (ped.timer <= 0) {
          ped.timer = randRange(rng, 2.5, 6);
          ped.tx = nearestRoad(ped.x) + randRange(rng, -46, 46);
          ped.ty = Math.max(30, Math.min(WORLD_SIZE - 30, ped.y + randRange(rng, -260, 260)));
          if (rng() < 0.4) { ped.ty = nearestRoad(ped.y) + randRange(rng, -46, 46); ped.tx = Math.max(30, Math.min(WORLD_SIZE - 30, ped.x + randRange(rng, -260, 260))); }
        }
        const a = angleTo(ped, { x: ped.tx, y: ped.ty });
        if (dist(ped, { x: ped.tx, y: ped.ty }) > 8) { ped.x += Math.cos(a) * ped.speed * dt; ped.y += Math.sin(a) * ped.speed * dt; ped.angle = a; }
      }
      collideBuildings(state.buildings, ped, 9);
    }
  }

  function stepCarHits(dt) {
    let events = 0;
    const p = state.player;
    if (!p.inCar) {
      // On foot, a moving traffic/police car can run the player down.
      for (const car of state.cars) {
        if (car.driver === 'player' || car.hp <= 0) continue;
        if (Math.abs(car.speed) > 70 && dist(p, car) < CAR_RADIUS + PLAYER_RADIUS - 2) { damagePlayer(16 * dt * 4); state.shake = 0.6; }
      }
      return events;
    }
    const mine = p.inCar;
    if (mine.damageCooldown === undefined) mine.damageCooldown = 0;
    if (mine.damageCooldown > 0) mine.damageCooldown -= dt;
    for (const car of state.cars) {
      if (car === mine || car.hp <= 0) continue;
      if (dist(mine, car) < CAR_RADIUS * 2 - 2 && Math.abs(mine.speed) > 45) {
        const impact = Math.abs(mine.speed);
        car.hp -= impact / 9; mine.hp -= impact / 22; damagePlayer(impact / 60);
        state.shake = Math.min(1, impact / 260);
        car.speed = mine.speed * 0.4;
        if (mine.damageCooldown <= 0) {
          mine.damageCooldown = 1.4;
          addWanted(1); events |= EVENT_CRIME;
          if (car.kind === 'target') setMessage(`Hit! Rival car at ${Math.max(0, Math.ceil(car.hp))} HP`);
          else setMessage('Crash! Wanted level up.');
        }
        mine.speed *= 0.55;
        if (car.hp <= 0 && car.kind !== 'target') car.speed = 0;
      }
    }
    // Running down a pedestrian is a serious crime.
    for (const ped of state.peds) {
      if (ped.down > 0) continue;
      if (Math.abs(mine.speed) > 55 && dist(mine, ped) < CAR_RADIUS + 8) {
        ped.down = 6; addWanted(1); events |= EVENT_CRIME;
        damagePlayer(0); state.shake = 0.8;
        setMessage('You ran someone down! Wanted up.');
        mine.speed *= 0.8;
      }
    }
    if (mine.hp <= 0) mine.speed = 0;
    return events;
  }

  function stepPolice(dt) {
    const p = state.player;
    const pp = playerPos();
    const wanted = state.wanted;
    const police = state.cars.filter(c => c.kind === 'police');
    const desired = wanted === 0 ? 0 : Math.min(4, wanted);
    // Spawn / retire patrol cars to match the wanted level.
    if (police.length < desired) {
      const a = rng() * Math.PI * 2, d = 520;
      const car = { id: 5000 + Math.floor(rng() * 900) + police.length, kind: 'police', x: Math.max(40, Math.min(WORLD_SIZE - 40, pp.x + Math.cos(a) * d)), y: Math.max(40, Math.min(WORLD_SIZE - 40, pp.y + Math.sin(a) * d)), angle: 0, speed: 0, hp: 130, color: '#ecf0f1', parked: false, driver: 'police', damageCooldown: 0 };
      state.cars.push(car); police.push(car);
    }
    let nearest = Infinity;
    for (const car of police) {
      if (car.hp <= 0) continue;
      const d = dist(car, pp);
      nearest = Math.min(nearest, d);
      if (wanted === 0) {
        car.speed *= Math.max(0, 1 - 2 * dt);
        car.x += Math.cos(car.angle) * car.speed * dt; car.y += Math.sin(car.angle) * car.speed * dt;
        continue;
      }
      const want = angleTo(car, pp);
      car.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, wrapAngle(want - car.angle)));
      const top = p.inCar ? 285 : 165;
      car.speed = Math.min(top, car.speed + 170 * dt);
      if (d < 46) car.speed = Math.min(car.speed, 30);
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      if (collideBuildings(state.buildings, car, CAR_RADIUS)) car.speed *= 0.3;
      // Ramming the player hurts a bit.
      if (p.inCar && d < CAR_RADIUS * 2 && car.speed > 90 && car.damageCooldown <= 0) {
        car.damageCooldown = 0.8; p.inCar.hp -= 6; damagePlayer(1.5); state.shake = 0.7;
      }
    }
    // Retire far-away police when clean.
    if (wanted === 0) state.cars = state.cars.filter(c => c.kind !== 'police' || dist(c, pp) < 700);
    // Busted: a cop stays close while you are slow / on foot.
    const playerSpeed = Math.abs(p.speed);
    if (wanted >= 1 && nearest < 58 && playerSpeed < 55) {
      state.bustMeter += dt;
      if (state.bustMeter > 1.6 && !state.over) { state.over = 'BUSTED'; }
    } else state.bustMeter = Math.max(0, state.bustMeter - dt * 1.5);
    // Police contact slowly hurts an on-foot player who resists.
    if (!p.inCar && wanted >= 2 && nearest < 30) damagePlayer(6 * dt);
  }

  function stepWanted(dt) {
    const pp = playerPos();
    let seen = false;
    for (const car of state.cars) if (car.kind === 'police' && car.hp > 0 && dist(car, pp) < 330) seen = true;
    if (state.wanted > 0 && !seen && state.crimeHeat <= 0) {
      state.hideTime += dt;
      const need = state.mission && state.mission.phase === 'escape' ? 5 : 8;
      if (state.hideTime >= need) { state.wanted -= 1; state.hideTime = 0; if (state.wanted > 0) setMessage(`Heat fading... ${state.wanted} star(s) left.`); }
    } else state.hideTime = 0;
    if (state.crimeHeat > 0) state.crimeHeat -= dt;
  }

  function stepMission(dt) {
    const m = state.mission;
    if (!m) return 0;
    m.timer -= dt;
    const pp = playerPos();
    if (m.phase === 'ram') {
      const car = state.cars.find(c => c.id === m.targetCarId);
      if (car) { m.target = { x: car.x, y: car.y }; if (car.hp <= 0) { car.speed = 0; return completeMission(); } }
    }
    if (m.phase === 'escape') {
      if (state.wanted === 0) return completeMission();
    }
    if ((m.phase === 'pickup' || m.phase === 'drop') && dist(pp, m.target) < 34) {
      if (m.phase === 'pickup') {
        m.phase = 'drop'; m.target = { ...m.drop }; m.timer = 110;
        addWanted(1); setMessage('Package grabbed! The cops are on you — deliver it!');
        return EVENT_CRIME;
      }
      return completeMission();
    }
    if (m.timer <= 0) {
      // Fail softly: restart the same job with a fresh timer, no cash.
      setMessage('Out of time! The job restarts.');
      const idx = m.index;
      if (idx === 1) state.cars = state.cars.filter(c => c.id !== m.targetCarId);
      startMission(idx);
    }
    return 0;
  }

  reset();
  return { state, reset, step, playerPos };
}
