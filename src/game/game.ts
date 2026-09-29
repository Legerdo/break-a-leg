import { Audio } from '../engine/audio';
import { InputManager, type MenuKey } from '../engine/input';
import { LEVELS } from '../levels';
import { Renderer } from '../render/renderer';
import { textWidth } from '../render/font';
import { DT, PLAYER, VIEW_H, VIEW_W } from './config';
import type { Input } from './types';
import { World, type GameEvent } from './world';

type State = 'title' | 'card' | 'play' | 'pause' | 'end';

interface Save {
  act: number; // furthest act reached (index)
  bestTime?: number;
  bestTakes?: number;
  muted?: boolean;
}

const SAVE_KEY = 'break-a-leg-save-v1';
const ACT_TEMPO = [118, 126, 134, 150];

function loadSave(): Save {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY) ?? 'null');
    if (s && typeof s.act === 'number') return s as Save;
  } catch {
    /* ignore corrupted saves */
  }
  return { act: 0 };
}

function fmtTime(t: number) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export class Game {
  private state: State = 'title';
  private world: World | null = null;
  private prevWorld: World | null = null; // finished act, shown behind the closing curtain
  private act = 0;
  private acc = 0;
  private time = 0;
  private last = 0;
  private menuIndex = 0;
  private cardT = 0;
  private cardFromPlay = false;
  private takesBefore = 0; // takes from completed acts
  private timeBefore = 0;
  private cuts: { x: number; y: number; t: number }[] = [];
  private takeBounce = 0;
  private endT = 0;
  private roses: { x: number; y: number; vy: number; vx: number; r: number }[] = [];
  private save: Save = loadSave();
  private hintT = 0;
  private newRecord = false;
  /** Dev/test hook: when set, supplies the input for every simulation step. */
  autopilot: ((w: World, act: number) => Input) | null = null;

  constructor(
    private r: Renderer,
    private input: InputManager,
    private audio: Audio,
  ) {
    this.audio.muted = !!this.save.muted;
    input.onFirstGesture = () => {
      this.audio.unlock();
      this.audio.setMuted(!!this.save.muted);
      this.audio.startMusic(ACT_TEMPO[0]);
    };
    // dev-only jump links (?act=N&cp=M&skipcard, ?end) used by the screenshot scripts
    const q = new URLSearchParams(import.meta.env.DEV ? location.search : '');
    if (q.has('act')) {
      const a = Math.max(0, Math.min(LEVELS.length - 1, Number(q.get('act')) - 1));
      this.startAct(a, false);
      const cp = Number(q.get('cp') ?? '-1');
      if (cp >= 0 && this.world) this.world.warpToCheckpoint(cp);
      if (q.has('skipcard')) this.state = 'play';
    }
    if (q.has('end')) {
      this.state = 'end';
      this.endT = 0;
    }
  }

  start() {
    const loop = (now: number) => {
      const dt = this.last ? Math.min(0.1, (now - this.last) / 1000) : DT;
      this.last = now;
      this.frame(dt);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    window.addEventListener('resize', () => this.r.resize());
  }

  private persist() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.save));
    } catch {
      /* storage unavailable */
    }
  }

  private get totalTakes() {
    return this.takesBefore + (this.world?.deaths ?? 0);
  }

  private startAct(i: number, fromPlay: boolean) {
    this.act = i;
    this.prevWorld = fromPlay ? this.world : null;
    this.world = new World(LEVELS[i]);
    this.state = 'card';
    this.cardT = 0;
    this.cardFromPlay = fromPlay;
    this.cuts = [];
    this.hintT = 0;
    this.input.clearJump();
    this.audio.setTempo(ACT_TEMPO[i] ?? 130);
    if (i > this.save.act) {
      this.save.act = i;
      this.persist();
    }
  }

  private toggleMute() {
    this.save.muted = !this.save.muted;
    this.audio.setMuted(this.save.muted);
    this.persist();
  }

  // -------------------------------------------------------------------------

  private frame(dt: number) {
    this.time += dt;
    this.input.pollPad();
    const keys = this.input.menu();
    if (keys.includes('mute')) this.toggleMute();
    this.r.updateAudience(dt);
    this.takeBounce = Math.max(0, this.takeBounce - dt * 3);
    for (const c of this.cuts) c.t += dt;
    this.cuts = this.cuts.filter((c) => c.t < 0.8);

    switch (this.state) {
      case 'title':
        this.updateTitle(keys);
        break;
      case 'card':
        this.updateCard(dt, keys);
        break;
      case 'play':
        this.updatePlay(dt, keys);
        break;
      case 'pause':
        this.updatePause(keys);
        break;
      case 'end':
        this.updateEnd(dt, keys);
        break;
    }
    this.render();
    this.r.present();
  }

  private titleItems() {
    const items: { label: string; act: () => void }[] = [];
    if (this.save.act > 0) {
      items.push({ label: `CONTINUE: ${LEVELS[this.save.act].title}`, act: () => this.newRun(this.save.act) });
    }
    items.push({ label: 'NEW PERFORMANCE', act: () => this.newRun(0) });
    items.push({ label: `SOUND: ${this.save.muted ? 'OFF' : 'ON'}`, act: () => this.toggleMute() });
    return items;
  }

  /** Start a fresh performance from the given act (used by the title menu and dev autoplay). */
  newRun(act: number) {
    this.takesBefore = 0;
    this.timeBefore = 0;
    this.startAct(act, false);
    this.audio.play('curtain');
  }

  private menuNav(keys: MenuKey[], n: number): boolean {
    let confirm = false;
    for (const k of keys) {
      if (k === 'up') {
        this.menuIndex = (this.menuIndex + n - 1) % n;
        this.audio.play('menu');
      } else if (k === 'down') {
        this.menuIndex = (this.menuIndex + 1) % n;
        this.audio.play('menu');
      } else if (k === 'confirm') confirm = true;
    }
    return confirm;
  }

  private updateTitle(keys: MenuKey[]) {
    const items = this.titleItems();
    this.menuIndex = Math.min(this.menuIndex, items.length - 1);
    if (this.menuNav(keys, items.length)) {
      this.audio.play('select');
      items[this.menuIndex].act();
    }
  }

  private updateCard(dt: number, keys: MenuKey[]) {
    this.cardT += dt;
    const closeT = this.cardFromPlay ? 0.45 : 0;
    const holdT = 1.35;
    // allow skipping the hold
    if (this.cardT > closeT + 0.3 && this.cardT < closeT + holdT && keys.includes('confirm')) this.cardT = closeT + holdT;
    if (this.cardT >= closeT + holdT) {
      this.state = 'play';
      this.hintT = 0;
      this.audio.play('curtain');
    }
  }

  private updatePlay(dt: number, keys: MenuKey[]) {
    const w = this.world!;
    if (keys.includes('back')) {
      this.state = 'pause';
      this.menuIndex = 0;
      this.audio.play('menu');
      return;
    }
    if (keys.includes('retry')) {
      w.retry();
      this.audio.play('retry');
    }
    this.hintT += dt;
    this.acc += dt;
    let steps = 0;
    while (this.acc >= DT && steps < 5) {
      w.step(this.autopilot ? this.autopilot(w, this.act) : this.input.sample());
      this.acc -= DT;
      steps++;
      this.handleEvents(w.events);
      w.events.length = 0;
      if (w.state === 'done') break;
    }
    if (steps >= 5) this.acc = 0;
    if (w.state === 'done') this.finishAct();
  }

  private handleEvents(evs: GameEvent[]) {
    const w = this.world!;
    for (const e of evs) {
      const sx = (e.x - w.cam.x) / VIEW_W;
      switch (e.type) {
        case 'die':
          this.audio.play('die');
          this.r.audience('gasp', sx);
          this.cuts.push({ x: e.x, y: e.y - 14, t: 0 });
          this.takeBounce = 1;
          break;
        case 'checkpoint':
          this.audio.play('checkpoint');
          this.r.audience('cheer', sx);
          break;
        case 'exit':
          this.audio.play('exit');
          this.r.audience('applause', sx);
          this.audio.play('applause');
          break;
        case 'spotCatch':
          this.audio.play('spotCatch');
          this.r.audience('cheer', sx);
          break;
        case 'knightCrush':
          this.audio.play('knightCrush');
          this.r.audience('cheer', sx);
          break;
        default:
          this.audio.play(e.type);
      }
    }
  }

  private finishAct() {
    const w = this.world!;
    this.takesBefore += w.deaths;
    this.timeBefore += w.time;
    if (this.act + 1 < LEVELS.length) {
      this.startAct(this.act + 1, true);
    } else {
      this.state = 'end';
      this.endT = 0;
      this.roses = [];
      const takes = this.takesBefore + 1;
      this.newRecord = this.save.bestTime === undefined || this.timeBefore < this.save.bestTime;
      if (this.newRecord) this.save.bestTime = this.timeBefore;
      if (this.save.bestTakes === undefined || takes < this.save.bestTakes) this.save.bestTakes = takes;
      this.save.act = 0;
      this.persist();
      this.audio.play('applause');
      this.audio.setTempo(160);
    }
  }

  private pauseItems() {
    return [
      { label: 'RESUME', act: () => (this.state = 'play') },
      {
        label: 'RETRY FROM GHOST LIGHT',
        act: () => {
          this.state = 'play';
          this.world!.retry();
        },
      },
      {
        label: 'RESTART ACT',
        act: () => {
          this.takesBefore += this.world!.deaths;
          this.startAct(this.act, false);
        },
      },
      { label: `SOUND: ${this.save.muted ? 'OFF' : 'ON'}`, act: () => this.toggleMute() },
      {
        label: 'QUIT TO TITLE',
        act: () => {
          this.state = 'title';
          this.menuIndex = 0;
        },
      },
    ];
  }

  private updatePause(keys: MenuKey[]) {
    const items = this.pauseItems();
    if (keys.includes('back')) {
      this.state = 'play';
      return;
    }
    if (keys.includes('retry')) {
      this.state = 'play';
      this.world!.retry();
      return;
    }
    if (this.menuNav(keys, items.length)) {
      this.audio.play('select');
      items[this.menuIndex].act();
    }
  }

  private updateEnd(dt: number, keys: MenuKey[]) {
    this.endT += dt;
    if (this.endT > 0.6 && Math.floor(this.endT * 5) !== Math.floor((this.endT - dt) * 5) && this.roses.length < 60) {
      for (let i = 0; i < 2; i++) {
        const seed = Math.sin(this.endT * 97 + i * 13) * 43758.5453;
        const f = seed - Math.floor(seed);
        this.roses.push({ x: 40 + f * 240, y: -8, vy: 30 + f * 30, vx: (f - 0.5) * 20, r: f * 6 });
      }
    }
    for (const r of this.roses) {
      if (r.y < 150) {
        r.y += r.vy * dt;
        r.x += r.vx * dt;
        r.r += dt * 5;
      }
    }
    if (Math.floor(this.endT / 2.2) !== Math.floor((this.endT - dt) / 2.2)) this.r.audience('applause', 0.5);
    if (this.endT > 2 && keys.includes('confirm')) {
      this.state = 'title';
      this.menuIndex = 0;
      this.world = null;
      this.audio.setTempo(ACT_TEMPO[0]);
    }
  }

  // -------------------------------------------------------------------------

  private render() {
    const r = this.r;
    switch (this.state) {
      case 'title':
        this.renderTitle();
        break;
      case 'card':
        this.renderCard();
        break;
      case 'play':
      case 'pause':
        this.renderPlay();
        if (this.state === 'pause') this.renderPause();
        break;
      case 'end':
        this.renderEnd();
        break;
    }
    void r;
  }

  private renderTitle() {
    const r = this.r;
    r.curtain(0, this.time);
    // spotlight pool on the curtain
    const g = r.g;
    g.save();
    g.globalCompositeOperation = 'lighter';
    const rad = g.createRadialGradient(VIEW_W / 2, 70, 10, VIEW_W / 2, 70, 150);
    rad.addColorStop(0, 'rgba(255,220,150,0.22)');
    rad.addColorStop(1, 'rgba(255,220,150,0)');
    g.fillStyle = rad;
    g.fillRect(0, 0, VIEW_W, VIEW_H);
    g.restore();
    r.hudText('BREAK A LEG', VIEW_W / 2, 30, '#ffd25a', 'center', 3);
    r.hudText('A SHORT, UNFAIR-LOOKING PLAY IN FOUR ACTS', VIEW_W / 2, 58, '#f3e6c8', 'center');
    const items = this.titleItems();
    const y0 = 88;
    r.panelBox(VIEW_W / 2 - 70, y0 - 6, 140, items.length * 12 + 10);
    items.forEach((it, i) => {
      const sel = i === this.menuIndex;
      r.hudText((sel ? '> ' : '  ') + it.label, VIEW_W / 2, y0 + i * 12, sel ? '#ffd25a' : '#b8a890', 'center');
    });
    r.castSprite('pip', VIEW_W / 2, 176 - Math.round(Math.abs(Math.sin(this.time * 2)) * 2));
    r.hudText('ARROWS/AD MOVE   SPACE/W JUMP   R RETRY   ESC PAUSE   M MUTE', VIEW_W / 2, 181, '#8a7a90', 'center');
    if (this.save.bestTime !== undefined) {
      r.hudText(`BEST: ${fmtTime(this.save.bestTime)}  /  ${this.save.bestTakes ?? '-'} TAKES`, VIEW_W / 2, 146, '#8a7a90', 'center');
    }
  }

  private renderCard() {
    const r = this.r;
    const closeT = this.cardFromPlay ? 0.45 : 0;
    const t = this.cardT;
    if (t < closeT) {
      // the finished act disappears behind the closing curtain
      if (this.prevWorld) r.drawWorld(this.prevWorld, this.time);
      else r.dimAll(1);
      r.curtain(1 - t / closeT, this.time);
    } else {
      this.prevWorld = null;
      r.curtain(0, this.time);
      const L = this.world!.level.def;
      const k = Math.min(1, (t - closeT) / 0.25);
      r.hudText(L.title, VIEW_W / 2, 66 - Math.round((1 - k) * 8), '#ffd25a', 'center', 3);
      r.hudText(L.subtitle, VIEW_W / 2, 98, '#f3e6c8', 'center');
      if (this.act === 0) r.hudText('THE STAGEHAND HAS PREPARED A FEW SURPRISES.', VIEW_W / 2, 120, '#b8a890', 'center');
      if (this.totalTakes > 0) r.hudText(`TAKES SO FAR: ${this.totalTakes}`, VIEW_W / 2, 140, '#8a7a90', 'center');
    }
  }

  private renderPlay() {
    const r = this.r;
    const w = this.world!;
    r.drawWorld(w, this.time);
    // curtain opening at the start of an act
    const openT = this.hintT;
    if (openT < 0.6) r.curtain(Math.min(1, openT / 0.6), this.time);
    // CUT! popups
    for (const c of this.cuts) {
      const x = Math.round(c.x - w.cam.x);
      const y = Math.round(c.y - w.cam.y - c.t * 14);
      if (c.t < 0.7) r.hudText('CUT!', x, y, c.t < 0.1 ? '#ffffff' : '#ffd25a', 'center');
    }
    // iris
    const ir = Renderer.deathIris(w);
    if (ir < Infinity) {
      const p = w.player;
      r.iris(Math.round(p.cx - w.cam.x), Math.round(p.y + PLAYER.H / 2 - w.cam.y), ir);
    }
    // HUD
    const bounce = Math.round(Math.sin(this.takeBounce * Math.PI) * 3);
    r.clapper(6, 10 - bounce, this.takeBounce);
    r.hudText(`TAKE ${this.totalTakes + 1}`, 20, 13 - bounce, this.takeBounce > 0.3 ? '#ffd25a' : '#f3e6c8');
    r.hudText(w.level.def.title, VIEW_W - 6, 13, '#b8a890', 'right');
    if (w.hintT === 0 && w.state === 'play' && Math.floor(this.time * 3) % 3 !== 0) {
      const msg = 'BOXED IN?  PRESS R';
      const tw = textWidth(msg) + 12;
      r.panelBox(Math.round(VIEW_W / 2 - tw / 2), 26, tw, 13);
      r.hudText(msg, VIEW_W / 2, 29, '#ffd25a', 'center');
    }
    if (this.act === 0 && w.time < 7 && w.cp <= 0 && this.totalTakes === 0) {
      const a = w.time < 6 ? 1 : 7 - w.time;
      r.g.globalAlpha = Math.max(0, a);
      r.hudText('ARROWS / A D  MOVE     SPACE / W  JUMP     R  RETRY', VIEW_W / 2, 30, '#f3e6c8', 'center');
      r.g.globalAlpha = 1;
    }
  }

  private renderPause() {
    const r = this.r;
    r.dimAll(0.6);
    const items = this.pauseItems();
    const h = items.length * 12 + 26;
    const y0 = Math.round(VIEW_H / 2 - h / 2);
    r.panelBox(VIEW_W / 2 - 80, y0, 160, h);
    r.hudText('INTERMISSION', VIEW_W / 2, y0 + 6, '#ffd25a', 'center');
    items.forEach((it, i) => {
      const sel = i === this.menuIndex;
      r.hudText((sel ? '> ' : '  ') + it.label, VIEW_W / 2, y0 + 20 + i * 12, sel ? '#ffd25a' : '#b8a890', 'center');
    });
  }

  private renderEnd() {
    const r = this.r;
    const g = r.g;
    const t = this.endT;
    r.backdrop(this.time);
    r.stageFloor(144);
    // footlights
    g.save();
    g.globalCompositeOperation = 'lighter';
    const rad = g.createRadialGradient(VIEW_W / 2, 150, 10, VIEW_W / 2, 150, 170);
    rad.addColorStop(0, 'rgba(255,220,150,0.28)');
    rad.addColorStop(1, 'rgba(255,220,150,0)');
    g.fillStyle = rad;
    g.fillRect(0, 0, VIEW_W, VIEW_H);
    g.restore();
    // cast line-up
    const bowing = Math.floor(t / 1.1) % 2 === 1;
    r.castSprite('knight', 52, 144, false);
    r.castSprite('bear', 96, 144, false);
    r.castSprite(bowing ? 'pipBow' : 'pip', VIEW_W / 2, 144);
    r.castSprite('bear', 224, 144, true);
    r.castSprite('knight', 268, 144, true);
    const cloudY = 112 + Math.round(Math.sin(this.time * 1.5) * 2);
    g.fillStyle = '#8a6a44';
    g.fillRect(VIEW_W / 2 - 8, 8, 1, cloudY - 22 - 8);
    g.fillRect(VIEW_W / 2 + 7, 8, 1, cloudY - 22 - 8);
    r.castSprite('cloud', VIEW_W / 2, cloudY);
    // roses
    for (const rs of this.roses) {
      g.fillStyle = '#dc4d4f';
      g.fillRect(Math.round(rs.x), Math.round(rs.y), 2, 2);
      g.fillStyle = '#2c7a4a';
      g.fillRect(Math.round(rs.x) + (Math.floor(rs.r) % 2), Math.round(rs.y) + 2, 1, 3);
    }
    r.vignetteOverlay();
    r.audienceLayer(this.time);
    // curtain opens on the curtain call
    if (t < 0.9) r.curtain(Math.min(1, t / 0.9), this.time);
    else r.curtain(1, this.time);
    if (t > 1.0) {
      r.hudText('BRAVO!', VIEW_W / 2, 18, '#ffd25a', 'center', 3);
      r.hudText('THE PLAY IS OVER. YOU OUTSMARTED THE STAGEHAND.', VIEW_W / 2, 44, '#f3e6c8', 'center');
      r.hudText(`TAKES: ${this.takesBefore + 1}      TIME: ${fmtTime(this.timeBefore)}`, VIEW_W / 2, 56, '#f3e6c8', 'center');
      if (this.newRecord) r.hudText('NEW BEST TIME', VIEW_W / 2, 68, '#5ce08a', 'center');
    }
    if (t > 2 && Math.floor(this.time * 2) % 2 === 0) r.hudText('PRESS SPACE FOR ANOTHER PERFORMANCE', VIEW_W / 2, 172, '#b8a890', 'center');
  }
}
