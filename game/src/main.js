// Boot and the main loop: fixed 1/60 s steps, screens title -> play <-> paused -> over.
// ?seed=N fixes the city; ?shot=start|play|end&seed=N stages a deterministic scene,
// paints it twice and sets window.__shotReady for the screenshot harness.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_MISSION, EVENT_OVER } from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, createInput, EMPTY_INPUT } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);

function readBest() { try { return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0; } catch { return 0; } }
function saveBest(v) { try { window.localStorage.setItem(BEST_KEY, String(v)); } catch { /* storage off: best lasts this visit */ } }

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  const announce = (msg) => { status.textContent = msg; };

  function startGame() {
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Job 1: pick up the package. Follow the gold marker.');
  }
  function endGame() {
    screen = SCREEN_OVER;
    if (world.state.cash > best) { best = world.state.cash; saveBest(best); }
    announce(`${world.state.over === 'BUSTED' ? 'Busted' : 'Wasted'}. Cash ${world.state.cash}. Press R to restart.`);
  }
  function handleActions() {
    const a = input.takeActions();
    if (a & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER)) startGame();
    else if (a & ACTION_PAUSE && screen === SCREEN_PLAY) { screen = SCREEN_PAUSED; announce('Paused.'); }
    else if (a & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) { screen = SCREEN_PLAY; announce('Playing.'); }
  }
  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        const events = world.step(STEP, input.sample());
        accumulator -= STEP;
        if (events & EVENT_OVER) { endGame(); break; }
        if (events & EVENT_MISSION) announce(`Job complete. Cash ${world.state.cash}.`);
      }
    } else if (screen === SCREEN_TITLE) {
      // The city idles behind the title: traffic and pedestrians keep moving.
      while (accumulator >= STEP) { world.step(STEP, EMPTY_INPUT); accumulator -= STEP; if (world.state.over) world.reset(); }
    } else accumulator = 0;
    renderer.draw(world.state, screen, best);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) { screen = SCREEN_PAUSED; announce('Paused.'); }
  });
  announce('Grand Theft Block City. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
