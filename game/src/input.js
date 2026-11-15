// Keyboard and mouse state, read fresh every frame. Movement keys give a direction
// vector; the mouse gives an aim point in logical field coordinates; actions are
// edge-triggered bits the main loop consumes once.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;
export const ACTION_SHOP_1 = 8;
export const ACTION_SHOP_2 = 16;
export const ACTION_SHOP_3 = 32;
export const ACTION_SHOP_4 = 64;
export const ACTION_NEXT_WAVE = 128;

const SHOP_ACTIONS = [ACTION_SHOP_1, ACTION_SHOP_2, ACTION_SHOP_3, ACTION_SHOP_4];

export function createInput(canvas, toField) {
  const keys = new Set();
  let actions = 0;
  let mouseX = 640;
  let mouseY = 300;
  let mouseDown = false;

  function press(action) {
    actions |= action;
  }

  function onKeyDown(event) {
    const key = event.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) event.preventDefault();
    if (event.repeat) return;
    keys.add(key);
    if (key === ' ' || key === 'enter') press(ACTION_CONFIRM);
    if (key === 'p' || key === 'escape') press(ACTION_PAUSE);
    if (key === 'm') press(ACTION_MUTE);
    if (key === '1' || key === '2' || key === '3' || key === '4') press(SHOP_ACTIONS[Number(key) - 1]);
    if (key === 'n') press(ACTION_NEXT_WAVE);
  }

  function onKeyUp(event) {
    keys.delete(event.key.toLowerCase());
  }

  function onMouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    const point = toField(event.clientX - rect.left, event.clientY - rect.top);
    mouseX = point.x;
    mouseY = point.y;
  }

  function onMouseDown(event) {
    onMouseMove(event);
    mouseDown = true;
    if (event.button === 0) press(ACTION_CONFIRM);
  }

  function onMouseUp() {
    mouseDown = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
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
    aim() {
      return { x: mouseX, y: mouseY };
    },
    firing() {
      return mouseDown || keys.has(' ');
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
