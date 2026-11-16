// Keyboard and mouse state, read fresh every frame. Held keys give a move vector and a
// digging hold; one-shot presses (start, pause, water, upgrade picks) are queued as bit
// flags and taken once by the loop, so a press between two frames is never lost and
// never counted twice. Clicks give a field position for dropping water or pressing
// a button.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;
export const ACTION_WATER = 8;
export const ACTION_NEXT = 16;
export const ACTION_PICK_1 = 32;
export const ACTION_PICK_2 = 64;
export const ACTION_PICK_3 = 128;
export const ACTION_CLICK = 256;

const PICK_ACTIONS = [ACTION_PICK_1, ACTION_PICK_2, ACTION_PICK_3];

export function createInput(canvas, toField) {
  const keys = new Set();
  let actions = 0;
  let clickX = 640;
  let clickY = 360;

  function press(action) {
    actions |= action;
  }

  function onKeyDown(event) {
    const key = event.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) event.preventDefault();
    if (event.repeat) return;
    keys.add(key);
    if (key === ' ' || key === 'enter') press(ACTION_CONFIRM);
    else if (key === 'p' || key === 'escape') press(ACTION_PAUSE);
    else if (key === 'm') press(ACTION_MUTE);
    else if (key === 'k') press(ACTION_WATER);
    else if (key === 'n') press(ACTION_NEXT);
    else if (key === '1' || key === '2' || key === '3') press(PICK_ACTIONS[Number(key) - 1]);
  }

  function onKeyUp(event) {
    keys.delete(event.key.toLowerCase());
  }

  function onPointerDown(event) {
    const rect = canvas.getBoundingClientRect();
    const point = toField(event.clientX - rect.left, event.clientY - rect.top);
    clickX = point.x;
    clickY = point.y;
    press(ACTION_CLICK);
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  // A key released while the tab is hidden never sends keyup: let go on blur.
  window.addEventListener('blur', () => keys.clear());
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    /** Normalised move vector from WASD or the arrow keys. */
    direction() {
      let x = 0;
      let y = 0;
      if (keys.has('a') || keys.has('arrowleft')) x -= 1;
      if (keys.has('d') || keys.has('arrowright')) x += 1;
      if (keys.has('w') || keys.has('arrowup')) y -= 1;
      if (keys.has('s') || keys.has('arrowdown')) y += 1;
      if (x !== 0 && y !== 0) {
        x *= Math.SQRT1_2;
        y *= Math.SQRT1_2;
      }
      return { x, y };
    },
    /** Is Space held: the spade is down, digging the cell underfoot. */
    digging() {
      return keys.has(' ');
    },
    /** Where the last click landed, in logical field coordinates. */
    clickPoint() {
      return { x: clickX, y: clickY };
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
