// Dev-only: drives the real browser game with the same informed routes the headless
// suite uses, from ACT I to the curtain call. Enabled with ?autoplay in `npm run dev`.
import type { Input } from '../src/game/types';
import type { World } from '../src/game/world';
import { Bot, I, type Script } from './bot';
import { ROUTES } from './routes';

export function makeAutopilot() {
  let world: World | null = null;
  let script: Script | null = null;
  return (w: World, act: number): Input => {
    if (w !== world) {
      world = w;
      script = ROUTES[act](new Bot(w));
    }
    const r = script!.next();
    return r.done ? I(0) : r.value;
  };
}
