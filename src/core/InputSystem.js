export function setupInput(ctx, handlers = {}) {
  const { input, canvas, mouse } = ctx;

  function keyCode(event) {
    if (event.code) return event.code;
    const key = event.key?.toLowerCase();
    if (key === ' ') return 'Space';
    if (key?.length === 1) return `Key${key.toUpperCase()}`;
    return event.key;
  }

  window.addEventListener('keydown', (event) => {
    const editingText = ['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target?.tagName);
    if (editingText) return;
    const code = keyCode(event);
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'KeyQ', 'KeyE', 'KeyX', 'KeyT', 'KeyV', 'KeyB'].includes(code)) event.preventDefault();
    input.keys.add(code);
    if (code === 'KeyH' && !event.repeat) {
      input.hudFull = !input.hudFull;
      handlers.onHudToggle?.(input.hudFull);
    }
    handlers.onKeyDown?.(code, event.repeat);
    canvas.focus();
  }, { capture: true });

  window.addEventListener('keyup', (event) => {
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target?.tagName)) return;
    const code = keyCode(event);
    input.keys.delete(code);
    handlers.onKeyUp?.(code);
  }, { capture: true });

  window.addEventListener('blur', () => {
    input.keys.clear();
    input.mouseDown = false;
    input.lockHeld = false;
  });

  window.addEventListener('mousemove', (event) => {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  });

  window.addEventListener('mousedown', (event) => {
    if (event.button === 0) input.mouseDown = true;
    if (event.button === 2) {
      event.preventDefault();
      input.lockHeld = true;
    }
    canvas.focus();
  });

  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) input.mouseDown = false;
    if (event.button === 2) {
      event.preventDefault();
      input.lockHeld = false;
    }
  });

  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  canvas.addEventListener('pointerdown', () => canvas.focus());
}
