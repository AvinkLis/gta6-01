// Keyboard + pointer input. Held keys are sampled per fixed step; one-shot presses
// (confirm, pause, interact) are queued so a press between frames is never lost.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let interactQueued = false;

  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
    if (e.repeat) return;
    keys.add(k);
    if (k === 'enter' || k === ' ') actions |= ACTION_CONFIRM;
    if (k === 'p' || k === 'escape') actions |= ACTION_PAUSE;
    if (k === 'e' || k === 'f') interactQueued = true;
    if (k === 'r') actions |= ACTION_CONFIRM;
  });
  window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  canvas.addEventListener('pointerdown', () => { actions |= ACTION_CONFIRM; });

  function held(...names) { return names.some(n => keys.has(n)); }
  return {
    takeActions() { const a = actions; actions = 0; return a; },
    sample() {
      const out = {
        moveX: (held('d', 'arrowright') ? 1 : 0) - (held('a', 'arrowleft') ? 1 : 0),
        moveY: (held('s', 'arrowdown') ? 1 : 0) - (held('w', 'arrowup') ? 1 : 0),
        run: held('shift'),
        accel: (held('w', 'arrowup') ? 1 : 0) - (held('s', 'arrowdown') ? 1 : 0),
        steer: (held('d', 'arrowright') ? 1 : 0) - (held('a', 'arrowleft') ? 1 : 0),
        brake: held(' '),
        interact: interactQueued,
      };
      interactQueued = false;
      return out;
    },
  };
}
export const EMPTY_INPUT = { moveX: 0, moveY: 0, run: false, accel: 0, steer: 0, brake: false, interact: false };
