import { Audio } from './engine/audio';
import { InputManager } from './engine/input';
import { Game } from './game/game';
import { Renderer } from './render/renderer';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const renderer = new Renderer(canvas);
const input = new InputManager(window);
const audio = new Audio();
const game = new Game(renderer, input, audio);
game.start();
canvas.focus();

// Dev-only autoplay: the headless test routes drive the real game from ACT I to the curtain call.
if (import.meta.env.DEV && new URLSearchParams(location.search).has('autoplay')) {
  void import('../tests/autoplay').then(({ makeAutopilot }) => {
    game.autopilot = makeAutopilot();
    game.newRun(0);
  });
}

// exposed for automated browser playtests
(window as unknown as { __game: Game }).__game = game;
