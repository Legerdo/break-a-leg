import type { Input } from '../game/types';

// Keyboard (+ optional gamepad). Jump presses are latched so a tap shorter than one
// simulation step is never lost.

const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const JUMP = new Set(['Space', 'KeyW', 'ArrowUp', 'KeyZ', 'KeyK']);
const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const BLOCK_DEFAULT = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space']);

export type MenuKey = 'up' | 'down' | 'left' | 'right' | 'confirm' | 'back' | 'retry' | 'mute' | 'any';

export class InputManager {
  private down = new Set<string>();
  private jumpLatch = false;
  private menuQueue: MenuKey[] = [];
  private padPrev: boolean[] = [];
  private padJumpHeld = false;
  private padX = 0;
  onFirstGesture: (() => void) | null = null;

  constructor(target: Window) {
    target.addEventListener('keydown', (e) => {
      if (BLOCK_DEFAULT.has(e.code)) e.preventDefault();
      this.gesture();
      if (e.repeat) return;
      this.down.add(e.code);
      if (JUMP.has(e.code)) this.jumpLatch = true;
      if (UP.has(e.code)) this.menuQueue.push('up');
      if (DOWN.has(e.code)) this.menuQueue.push('down');
      if (LEFT.has(e.code)) this.menuQueue.push('left');
      if (RIGHT.has(e.code)) this.menuQueue.push('right');
      if (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyZ') this.menuQueue.push('confirm');
      if (e.code === 'Escape' || e.code === 'KeyP') this.menuQueue.push('back');
      if (e.code === 'KeyR') this.menuQueue.push('retry');
      if (e.code === 'KeyM') this.menuQueue.push('mute');
      this.menuQueue.push('any');
    });
    target.addEventListener('keyup', (e) => {
      this.down.delete(e.code);
    });
    target.addEventListener('blur', () => this.down.clear());
    target.addEventListener('pointerdown', () => this.gesture());
  }

  private gesture() {
    if (this.onFirstGesture) {
      const f = this.onFirstGesture;
      this.onFirstGesture = null;
      f();
    }
  }

  private any(set: Set<string>) {
    for (const k of set) if (this.down.has(k)) return true;
    return false;
  }

  /** Poll gamepads once per animation frame. */
  pollPad() {
    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    const p = pads && Array.from(pads).find((q) => q && q.connected);
    if (!p) {
      this.padJumpHeld = false;
      this.padX = 0;
      return;
    }
    const btn = (i: number) => !!p.buttons[i]?.pressed;
    const ax = p.axes[0] ?? 0;
    this.padX = btn(14) ? -1 : btn(15) ? 1 : Math.abs(ax) > 0.35 ? Math.sign(ax) : 0;
    const now = [btn(0), btn(1), btn(9), btn(2) || btn(3), btn(12), btn(13), btn(14), btn(15), btn(8)];
    const edge = (i: number) => now[i] && !this.padPrev[i];
    if (edge(0) || edge(1)) {
      this.jumpLatch = true;
      this.menuQueue.push('confirm', 'any');
      this.gesture();
    }
    if (edge(2)) this.menuQueue.push('back', 'any');
    if (edge(3)) this.menuQueue.push('retry', 'any');
    if (edge(4)) this.menuQueue.push('up');
    if (edge(5)) this.menuQueue.push('down');
    if (edge(6)) this.menuQueue.push('left');
    if (edge(7)) this.menuQueue.push('right');
    if (edge(8)) this.menuQueue.push('back');
    this.padJumpHeld = btn(0) || btn(1);
    this.padPrev = now;
  }

  /** Input for one simulation step; consumes the latched jump press. */
  sample(): Input {
    const left = this.any(LEFT) || this.padX < 0;
    const right = this.any(RIGHT) || this.padX > 0;
    const jump = this.any(JUMP) || this.padJumpHeld;
    const jumpPressed = this.jumpLatch;
    this.jumpLatch = false;
    return { left, right, jump, jumpPressed };
  }

  clearJump() {
    this.jumpLatch = false;
  }

  menu(): MenuKey[] {
    const q = this.menuQueue;
    this.menuQueue = [];
    return q;
  }
}
