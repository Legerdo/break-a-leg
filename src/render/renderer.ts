import { DEATH, PLAYER, TILE, VIEW_H, VIEW_W } from '../game/config';
import { isSolidTile, isSpike, Tl } from '../game/level';
import { Bag, Cutout, type Deco, type World } from '../game/world';
import { drawText, textWidth } from './font';
import { BAG, BEAR, CLOUD, flipSprite, KNIGHT, KNIGHT_FLAT, makeSprite, PAL, PIP_FRAMES, tintSprite, type Sprite } from './sprites';
import { catwalk, crate, deckTop, facade, hash, panel, spikes, tapeX, wall } from './tiles';

type Ctx = CanvasRenderingContext2D;

interface Head {
  x: number;
  pop: number; // px above the bottom edge
  v: number;
  shade: string;
  mark: number; // >0 gasp timer, <0 cheer timer
  kind: number;
}

export class Renderer {
  readonly low: HTMLCanvasElement;
  readonly g: Ctx;
  private out: Ctx;
  scale = 3;

  private pip: Record<string, [Sprite, Sprite]> = {};
  private pipWhite!: Sprite;
  private knight!: [Sprite, Sprite];
  private knightFlat!: Sprite;
  private cloud!: Sprite;
  private bear!: [Sprite, Sprite];
  private bag!: Sprite;
  private bgFar!: HTMLCanvasElement;
  private staticLayer: HTMLCanvasElement | null = null;
  private staticFor: World | null = null;
  private heads: Head[] = [];
  private vignette!: HTMLCanvasElement;

  constructor(private canvas: HTMLCanvasElement) {
    this.low = document.createElement('canvas');
    this.low.width = VIEW_W;
    this.low.height = VIEW_H;
    this.g = this.low.getContext('2d')!;
    this.g.imageSmoothingEnabled = false;
    this.out = canvas.getContext('2d')!;
    this.buildSprites();
    this.buildBackground();
    for (let i = 0; i < 26; i++) {
      this.heads.push({ x: i * 13 + (hash(i, 7) % 5), pop: 0, v: 0, shade: i % 3 === 0 ? '#0d0914' : i % 3 === 1 ? '#120c1b' : '#0a0710', mark: 0, kind: hash(i, 3) % 3 });
    }
    this.resize();
  }

  // -- setup ----------------------------------------------------------------

  private buildSprites() {
    for (const [k, rows] of Object.entries(PIP_FRAMES)) {
      const s = makeSprite(rows);
      this.pip[k] = [s, flipSprite(s)];
    }
    this.pipWhite = tintSprite(this.pip.idle0[0], '#ffffff');
    const kn = makeSprite(KNIGHT);
    this.knight = [kn, flipSprite(kn)];
    this.knightFlat = makeSprite(KNIGHT_FLAT);
    this.cloud = makeSprite(CLOUD);
    const br = makeSprite(BEAR);
    this.bear = [br, flipSprite(br)];
    this.bag = makeSprite(BAG);
  }

  private buildBackground() {
    // tileable backstage brick wall, 64x64
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    const g = c.getContext('2d')!;
    g.fillStyle = '#0d0a14';
    g.fillRect(0, 0, 64, 64);
    for (let r = 0; r < 8; r++) {
      const off = r & 1 ? 8 : 0;
      for (let b = -1; b < 5; b++) {
        const x = off + b * 16;
        const h = hash(b + 10, r + 3);
        g.fillStyle = h % 4 === 0 ? '#16111f' : h % 4 === 1 ? '#130f1b' : '#110d19';
        g.fillRect(x + 1, r * 8 + 1, 14, 6);
      }
    }
    this.bgFar = c;
    const v = document.createElement('canvas');
    v.width = VIEW_W;
    v.height = VIEW_H;
    const vg = v.getContext('2d')!;
    const grad = vg.createRadialGradient(VIEW_W / 2, VIEW_H * 0.55, 60, VIEW_W / 2, VIEW_H * 0.55, 230);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(5,2,10,0.55)');
    vg.fillStyle = grad;
    vg.fillRect(0, 0, VIEW_W, VIEW_H);
    this.vignette = v;
  }

  resize() {
    const s = Math.max(1, Math.floor(Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H)));
    this.scale = s;
    this.canvas.width = VIEW_W * s;
    this.canvas.height = VIEW_H * s;
    this.canvas.style.width = `${VIEW_W * s}px`;
    this.canvas.style.height = `${VIEW_H * s}px`;
    this.out.imageSmoothingEnabled = false;
  }

  present() {
    this.out.imageSmoothingEnabled = false;
    this.out.drawImage(this.low, 0, 0, this.canvas.width, this.canvas.height);
  }

  // -- static tile layer ------------------------------------------------------

  private bakeStatic(w: World) {
    const L = w.level;
    const c = document.createElement('canvas');
    c.width = w.pw;
    c.height = w.ph;
    const g = c.getContext('2d')!;
    const trapCells = new Set<number>();
    const liftCells = new Set<number>();
    for (const gr of L.groups) for (let x = gr.x; x < gr.x + gr.w; x++) (gr.kind === 'trap' ? trapCells : liftCells).add(gr.y * L.w + x);
    // Cells hidden under closed trapdoors / covers count as solid for edge shading,
    // otherwise neighbouring tiles would outline the hidden pit and give the trap away.
    const hidden = new Set<number>();
    for (const td of w.traps) for (const c of td.cover) for (let y = c.y0; y < c.y1; y++) hidden.add(y * L.w + c.x);
    for (const c of w.covers) {
      for (let y = c.box.y / TILE; y < (c.box.y + c.box.h) / TILE; y++) for (let x = c.box.x / TILE; x < (c.box.x + c.box.w) / TILE; x++) hidden.add(y * L.w + x);
    }
    const T = (x: number, y: number) => {
      if (x < 0 || x >= L.w) return Tl.WALL;
      if (y < 0) return Tl.AIR;
      if (y >= L.h) return Tl.DECK;
      const i = y * L.w + x;
      return hidden.has(i) || trapCells.has(i) || liftCells.has(i) ? Tl.DECK : L.tiles[i];
    };
    const open = (t: number) => !isSolidTile(t);

    for (let y = 0; y < L.h; y++) {
      for (let x = 0; x < L.w; x++) {
        const i = y * L.w + x;
        const t = L.tiles[i];
        const X = x * TILE;
        const Y = y * TILE;
        if (trapCells.has(i) || liftCells.has(i)) continue; // drawn dynamically
        // voids below the deck line read as a dark pit
        if (!isSolidTile(t) && y >= 9) {
          const d = y - 8;
          g.fillStyle = d === 1 ? '#0c0810' : '#07050a';
          g.fillRect(X, Y, TILE, TILE);
        }
        if (t === Tl.DECK) {
          const above = T(x, y - 1);
          const exposed = open(above) && !trapCells.has((y - 1) * L.w + x) && !liftCells.has((y - 1) * L.w + x);
          if (exposed && y <= 9) deckTop(g, X, Y, x, y);
          else {
            facade(g, X, Y, x, y);
            // pit floors stay dark so nothing under a closed trapdoor can give it away
            if (exposed) {
              g.fillStyle = '#3a2418';
              g.fillRect(X, Y, TILE, 1);
            }
          }
          if (open(T(x - 1, y)) && y > 0) {
            g.fillStyle = '#3a2418';
            g.fillRect(X, Y + (open(above) ? 5 : 0), 1, TILE);
          }
          if (open(T(x + 1, y))) {
            g.fillStyle = '#120a07';
            g.fillRect(X + 15, Y + (open(above) ? 5 : 0), 1, TILE);
          }
          if (L.tape.has(i)) tapeX(g, X, Y);
        } else if (t === Tl.WALL) {
          wall(g, X, Y, x, y, open(T(x, y - 1)), open(T(x - 1, y)), open(T(x + 1, y)), open(T(x, y + 1)));
        } else if (t === Tl.CRATE) {
          crate(g, X, Y, x, y);
        } else if (t === Tl.CAT) {
          catwalk(g, X, Y);
        }
      }
    }
    this.staticLayer = c;
    this.staticFor = w;
  }

  // -- main world draw --------------------------------------------------------

  drawWorld(w: World, time: number) {
    if (this.staticFor !== w || !this.staticLayer) this.bakeStatic(w);
    const g = this.g;
    let sx = 0;
    let sy = 0;
    if (w.shake > 0.2) {
      sx = Math.round((hash(w.frame, 1) % 3) - 1) * Math.min(2, Math.ceil(w.shake / 2));
      sy = Math.round((hash(w.frame, 2) % 3) - 1) * Math.min(2, Math.ceil(w.shake / 2));
    }
    const cx = Math.round(w.cam.x) - sx;
    const cy = Math.round(w.cam.y) - sy;

    this.drawBackdrop(cx, time);

    g.save();
    g.translate(-cx, -cy);
    this.drawDecos(w, cx, time);
    this.drawRails(w);
    g.drawImage(this.staticLayer!, cx, 0, VIEW_W + 4, VIEW_H, cx, 0, VIEW_W + 4, VIEW_H);
    this.drawCoveredSpikesAndDynamicSpikes(w, cx);
    this.drawSpots(w, time, cx, false);
    this.drawTraps(w);
    this.drawLifts(w);
    this.drawMovers(w);
    this.drawSigns(w, time, cx);
    this.drawGhosts(w, time);
    this.drawDoors(w, time);
    this.drawBags(w, time);
    this.drawCutouts(w, time);
    this.drawArches(w);
    this.drawCovers(w);
    this.drawPlayer(w, time);
    this.drawFx(w, false);
    this.drawSpots(w, time, cx, true);
    this.drawFx(w, true);
    this.drawSignBubbles(w, cx);
    g.restore();

    g.drawImage(this.vignette, 0, 0);
    this.drawAudience(time);
    this.drawValance(time);
    this.drawBearIndicator(w, cx);
  }

  private drawBackdrop(cx: number, time: number) {
    const g = this.g;
    // far brick wall
    const ox = -Math.floor(cx * 0.3) % 64;
    for (let x = ox - 64; x < VIEW_W + 64; x += 64) for (let y = 0; y < VIEW_H; y += 64) g.drawImage(this.bgFar, x, y);
    // fly-space darkness at the top
    const grad = g.createLinearGradient(0, 0, 0, 90);
    grad.addColorStop(0, 'rgba(6,3,10,0.85)');
    grad.addColorStop(1, 'rgba(6,3,10,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, VIEW_W, 90);
    // rigging: battens with dim lamps, ropes (parallax 0.55)
    const p2 = cx * 0.55;
    const step = 96;
    const first = Math.floor(p2 / step) - 1;
    for (let i = first; i < first + VIEW_W / step + 3; i++) {
      const x = Math.round(i * step - p2);
      const h = hash(i, 11);
      // rope lines
      g.fillStyle = '#2a1c18';
      g.fillRect(x + 10, 0, 1, 40 + (h % 50));
      g.fillRect(x + 60, 0, 1, 20 + ((h >> 5) % 40));
      // batten
      const by = 22 + (h % 3) * 6;
      g.fillStyle = '#231d30';
      g.fillRect(x - 4, by, 70, 2);
      for (let l = 0; l < 3; l++) {
        const lx = x + 6 + l * 22;
        g.fillStyle = '#1a1424';
        g.fillRect(lx, by + 2, 6, 5);
        const flick = (h >> l) & 1 ? 0.35 + 0.1 * Math.sin(time * 3 + l) : 0.2;
        g.fillStyle = `rgba(255,190,90,${flick.toFixed(2)})`;
        g.fillRect(lx + 1, by + 6, 4, 1);
      }
    }
    // curtain legs (parallax 0.78)
    const p3 = cx * 0.78;
    const step3 = 240;
    const f3 = Math.floor(p3 / step3) - 1;
    for (let i = f3; i < f3 + VIEW_W / step3 + 3; i++) {
      const x = Math.round(i * step3 - p3 + 150);
      for (let k = 0; k < 22; k++) {
        const fold = k % 6;
        g.fillStyle = fold === 0 ? '#1d0810' : fold < 3 ? '#2c0c17' : '#3a111e';
        g.fillRect(x + k, 0, 1, 150 + ((k * 7) % 5));
      }
      g.fillStyle = '#1d0810';
      g.fillRect(x - 1, 0, 1, 150);
    }
  }

  private drawDecos(w: World, cx: number, time: number) {
    const g = this.g;
    for (const d of w.decos) {
      if (d.x > cx + VIEW_W + 32 || d.x + d.w < cx - 32) continue;
      this.drawDeco(g, d, time);
    }
  }

  private drawDeco(g: Ctx, d: Deco, time: number) {
    const P = PAL;
    const x = d.x;
    const y = d.y;
    switch (d.kind) {
      case 'rope': {
        const len = d.h;
        const sway = Math.round(Math.sin(time * 1.3 + x) * 1);
        g.fillStyle = '#6b4a2c';
        g.fillRect(x + 8, y, 1, len - 4);
        g.fillRect(x + 8 + sway, y + len - 4, 1, 4);
        g.fillStyle = '#8e6a3e';
        g.fillRect(x + 7 + sway, y + len - 2, 3, 2);
        break;
      }
      case 'lamp': {
        g.fillStyle = '#2b2436';
        g.fillRect(x + 7, 0, 1, y + 6);
        g.fillStyle = P.g;
        g.fillRect(x + 3, y + 6, 10, 6);
        g.fillStyle = P.G;
        g.fillRect(x + 4, y + 7, 8, 1);
        g.fillStyle = 'rgba(255,210,120,0.8)';
        g.fillRect(x + 5, y + 12, 6, 1);
        g.fillStyle = 'rgba(255,210,120,0.07)';
        g.beginPath();
        g.moveTo(x + 4, y + 12);
        g.lineTo(x + 12, y + 12);
        g.lineTo(x + 26, y + 60);
        g.lineTo(x - 10, y + 60);
        g.closePath();
        g.fill();
        break;
      }
      case 'bucket': {
        const b = y + 16;
        g.fillStyle = P.k;
        g.fillRect(x + 3, b - 9, 10, 9);
        g.fillStyle = P.G;
        g.fillRect(x + 4, b - 8, 8, 7);
        g.fillStyle = P.s;
        g.fillRect(x + 4, b - 8, 8, 1);
        g.fillStyle = P.g;
        g.fillRect(x + 4, b - 4, 8, 1);
        g.fillStyle = P.k;
        g.fillRect(x + 5, b - 12, 6, 1);
        g.fillRect(x + 4, b - 11, 1, 2);
        g.fillRect(x + 11, b - 11, 1, 2);
        break;
      }
      case 'chair': {
        const b = y + 16;
        g.fillStyle = P.o;
        g.fillRect(x + 3, b - 16, 2, 16);
        g.fillRect(x + 3, b - 8, 10, 2);
        g.fillRect(x + 11, b - 8, 2, 8);
        g.fillStyle = P.O;
        g.fillRect(x + 3, b - 16, 2, 1);
        g.fillRect(x + 3, b - 8, 10, 1);
        g.fillStyle = P.e;
        g.fillRect(x + 5, b - 14, 1, 5);
        break;
      }
      case 'poster': {
        const tw = d.text ? textWidth(d.text) + 6 : d.w;
        const px0 = Math.round(x + d.w / 2 - tw / 2);
        g.fillStyle = P.k;
        g.fillRect(px0 - 1, y + 3, tw + 2, 11);
        g.fillStyle = '#3a2a1e';
        g.fillRect(px0, y + 4, tw, 9);
        g.fillStyle = '#5a412c';
        g.fillRect(px0, y + 4, tw, 1);
        if (d.text) drawText(g, d.text, px0 + 3, y + 5, '#e8c890');
        break;
      }
      case 'rack': {
        const b = y + d.h;
        g.fillStyle = P.G;
        g.fillRect(x + 1, b - 30, 1, 30);
        g.fillRect(x + d.w - 2, b - 30, 1, 30);
        g.fillRect(x + 1, b - 30, d.w - 2, 1);
        const cols = [P.R, P.U, P.x, P.y];
        for (let i = 0; i < 4; i++) {
          g.fillStyle = cols[i];
          const cx = x + 4 + i * 6;
          g.fillRect(cx, b - 28, 5, 14 + (i % 2) * 4);
          g.fillStyle = 'rgba(0,0,0,0.3)';
          g.fillRect(cx + 4, b - 28, 1, 14 + (i % 2) * 4);
        }
        break;
      }
      case 'ladder': {
        g.fillStyle = P.o;
        g.fillRect(x + 3, y, 1, d.h);
        g.fillRect(x + 12, y, 1, d.h);
        for (let yy = y + 3; yy < y + d.h; yy += 5) g.fillRect(x + 3, yy, 10, 1);
        break;
      }
      default:
        break;
    }
  }

  private drawRails(w: World) {
    const g = this.g;
    for (const c of w.cutouts) {
      if (c.kind === 'cloud') {
        const y = c.railY;
        g.fillStyle = PAL.g;
        g.fillRect(c.x0, y, c.x1 - c.x0, 2);
        g.fillStyle = PAL.G;
        g.fillRect(c.x0, y, c.x1 - c.x0, 1);
        this.bumper(c.x0 - 2, y, true);
        this.bumper(c.x1 - 1, y, true);
      } else {
        const y = c.railY - 2;
        g.fillStyle = PAL.k;
        g.fillRect(c.x0, y, c.x1 - c.x0, 2);
        g.fillStyle = PAL.G;
        g.fillRect(c.x0, y, c.x1 - c.x0, 1);
        for (let x = c.x0 + 4; x < c.x1; x += 8) {
          g.fillStyle = PAL.s;
          g.fillRect(x, y, 1, 1);
        }
        this.bumper(c.x0 - 3, c.railY - 6, false);
        this.bumper(c.x1, c.railY - 6, false);
      }
    }
  }

  private bumper(x: number, y: number, ceiling: boolean) {
    const g = this.g;
    g.fillStyle = PAL.k;
    g.fillRect(x, y, 3, ceiling ? 5 : 6);
    g.fillStyle = PAL.Y;
    g.fillRect(x + 1, y + (ceiling ? 1 : 1), 1, 1);
    g.fillRect(x + 1, y + 3, 1, 1);
    g.fillStyle = PAL.k;
    g.fillRect(x + 1, y + 2, 1, 1);
  }

  private drawCoveredSpikesAndDynamicSpikes(w: World, cx: number) {
    // spikes are drawn here (not baked) so bag-flattened tacks can change look
    const L = w.level;
    const g = this.g;
    const x0 = Math.max(0, Math.floor(cx / TILE) - 1);
    const x1 = Math.min(L.w - 1, Math.floor((cx + VIEW_W) / TILE) + 1);
    for (let y = 0; y < L.h; y++) {
      for (let x = x0; x <= x1; x++) {
        const t = w.tiles[y * L.w + x];
        if (!isSpike(t)) continue;
        const dir = t === Tl.SP_U ? 'u' : t === Tl.SP_D ? 'd' : t === Tl.SP_L ? 'l' : 'r';
        spikes(g, x * TILE, y * TILE, dir, w.covered.has(y * L.w + x));
      }
    }
  }

  private drawSpots(w: World, time: number, cx: number, glowPass: boolean) {
    const g = this.g;
    for (const s of w.spots) {
      if (Math.abs(s.tx - cx - VIEW_W / 2) > VIEW_W) continue;
      const top = -12;
      const fy = s.floorY;
      const src = s.sx;
      const bw = s.mode === 'follow' ? 20 : 17;
      g.save();
      g.globalCompositeOperation = 'lighter';
      if (!glowPass) {
        g.fillStyle = s.mode === 'follow' ? 'rgba(255,238,180,0.13)' : 'rgba(255,232,170,0.10)';
        g.beginPath();
        g.moveTo(src - 3, top);
        g.lineTo(src + 3, top);
        g.lineTo(s.tx + bw, fy);
        g.lineTo(s.tx - bw, fy);
        g.closePath();
        g.fill();
        // dust motes in the beam
        for (let i = 0; i < 7; i++) {
          const k = (time * 0.07 + i * 0.137 + hash(i, Math.round(src)) * 1e-9) % 1;
          const yy = top + (fy - top) * ((k + i * 0.13) % 1);
          const f = (yy - top) / (fy - top);
          const mx = src + (s.tx - src) * f + Math.sin(time + i * 2) * bw * f * 0.6;
          g.fillStyle = 'rgba(255,240,200,0.35)';
          g.fillRect(Math.round(mx), Math.round(yy), 1, 1);
        }
      } else {
        g.fillStyle = 'rgba(255,236,170,0.22)';
        g.beginPath();
        g.ellipse(Math.round(s.tx), fy, bw + 2, 4, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = 'rgba(255,245,210,0.18)';
        g.beginPath();
        g.ellipse(Math.round(s.tx), fy - 1, bw - 5, 2, 0, 0, Math.PI * 2);
        g.fill();
      }
      g.restore();
      if (!glowPass) {
        // the lamp itself, peeking down from the flies
        g.fillStyle = PAL.k;
        g.fillRect(src - 5, top + 10, 10, 6);
        g.fillStyle = PAL.G;
        g.fillRect(src - 4, top + 11, 8, 3);
        g.fillStyle = '#fff4c0';
        g.fillRect(src - 3, top + 15, 6, 1);
      }
    }
  }

  private drawTraps(w: World) {
    const g = this.g;
    for (const td of w.traps) {
      const gx = td.g.x * TILE;
      const gy = td.g.y * TILE;
      const W = td.g.w * TILE;
      if (td.state !== 'open') {
        let jig = 0;
        if (td.state === 'armed') jig = (Math.floor(td.t * 30) % 2) * (td.t > td.delay * 0.4 ? 1 : 0);
        // identical facade to the surrounding deck, then the seamed panel on top
        for (let i = 0; i < td.g.w; i++) facade(g, gx + i * TILE, gy, td.g.x + i, td.g.y);
        panel(g, gx + jig, gy, td.g.w, td.g.taped, td.g.x, td.g.y);
      } else {
        // pit interior + the panel swinging down from its hinge
        g.fillStyle = '#07050a';
        g.fillRect(gx, gy, W, TILE);
        const a = td.swing * (Math.PI / 2);
        g.save();
        g.translate(gx + 1, gy + 1);
        g.rotate(a);
        g.fillStyle = PAL.k;
        g.fillRect(-1, -1, W, 7);
        g.fillStyle = PAL.p;
        g.fillRect(0, 0, W - 2, 3);
        g.fillStyle = PAL.O;
        g.fillRect(0, 3, W - 2, 2);
        for (const t of td.g.taped) {
          g.fillStyle = PAL.Y;
          g.fillRect((t - td.g.x) * TILE + 5, 1, 6, 2);
        }
        g.restore();
      }
    }
  }

  private drawLifts(w: World) {
    const g = this.g;
    for (const l of w.lifts) {
      const W = l.w;
      // shaft hole left behind in the deck
      if (l.y < l.baseY) {
        g.fillStyle = '#07050a';
        g.fillRect(l.x, l.baseY, W, TILE);
        // scissor mechanism
        const h = l.baseY + TILE - (l.y + 6);
        const n = Math.max(1, Math.round(h / 12));
        g.fillStyle = PAL.G;
        for (let i = 0; i < n; i++) {
          const y0 = l.y + 6 + (i * h) / n;
          const y1 = l.y + 6 + ((i + 1) * h) / n;
          this.line(l.x + 4, y0, l.x + W - 5, y1, PAL.G);
          this.line(l.x + W - 5, y0, l.x + 4, y1, PAL.s);
        }
      }
      let jig = 0;
      if (l.state === 'shake') jig = Math.floor(l.t * 40) % 2;
      for (let i = 0; i < l.g.w; i++) facade(g, l.x + i * TILE, Math.round(l.y) + jig, l.g.x + i, l.g.y);
      panel(g, l.x, Math.round(l.y) + jig, l.g.w, l.g.taped, l.g.x, l.g.y);
      if (l.y < l.baseY) {
        g.fillStyle = PAL.g;
        g.fillRect(l.x, Math.round(l.y) + 15, W, 1);
      }
    }
  }

  private line(x0: number, y0: number, x1: number, y1: number, c: string) {
    const g = this.g;
    g.fillStyle = c;
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= n; i++) {
      const t = n ? i / n : 0;
      g.fillRect(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t), 1, 1);
    }
  }

  private drawMovers(w: World) {
    const g = this.g;
    for (const m of w.movers) {
      const x = Math.round(m.x);
      const y = Math.round(m.y);
      // ropes up into the flies
      g.fillStyle = '#8a6a44';
      g.fillRect(x + 3, 0, 1, y);
      g.fillRect(x + m.w - 4, 0, 1, y);
      g.fillStyle = '#5b4028';
      g.fillRect(x + 4, 0, 1, y);
      g.fillRect(x + m.w - 3, 0, 1, y);
      // deck
      g.fillStyle = PAL.k;
      g.fillRect(x, y, m.w, 8);
      g.fillStyle = PAL.P;
      g.fillRect(x + 1, y, m.w - 2, 1);
      g.fillStyle = PAL.p;
      g.fillRect(x + 1, y + 1, m.w - 2, 3);
      g.fillStyle = PAL.O;
      g.fillRect(x + 1, y + 4, m.w - 2, 2);
      for (let i = 16; i < m.w; i += 16) {
        g.fillStyle = PAL.o;
        g.fillRect(x + i, y + 1, 1, 5);
      }
      // iron under-frame
      g.fillStyle = PAL.g;
      g.fillRect(x + 2, y + 8, m.w - 4, 2);
      g.fillRect(x + 2, y + 10, 2, 4);
      g.fillRect(x + m.w - 4, y + 10, 2, 4);
      g.fillStyle = PAL.G;
      g.fillRect(x + 2, y + 8, m.w - 4, 1);
      g.fillStyle = PAL.s;
      g.fillRect(x + 3, y + 1, 1, 1);
      g.fillRect(x + m.w - 4, y + 1, 1, 1);
    }
  }

  private drawSigns(w: World, time: number, cx: number) {
    const g = this.g;
    for (const s of w.signs) {
      if (s.x < cx - 32 || s.x > cx + VIEW_W + 16) continue;
      if (this.hiddenByCover(w, s.x + 8, s.y - 4)) continue;
      const x = s.x;
      const b = s.y;
      g.fillStyle = PAL.k;
      g.fillRect(x + 7, b - 9, 3, 9);
      g.fillStyle = PAL.O;
      g.fillRect(x + 8, b - 9, 1, 9);
      g.fillStyle = PAL.k;
      g.fillRect(x + 1, b - 17, 15, 10);
      g.fillStyle = PAL.p;
      g.fillRect(x + 2, b - 16, 13, 8);
      g.fillStyle = PAL.P;
      g.fillRect(x + 2, b - 16, 13, 1);
      g.fillStyle = PAL.o;
      g.fillRect(x + 4, b - 13, 9, 1);
      g.fillRect(x + 4, b - 11, 6, 1);
      void time;
    }
  }

  private hiddenByCover(w: World, x: number, y: number) {
    for (const td of w.traps) {
      if (td.state === 'open') continue;
      for (const c of td.cover) if (x >= c.x * TILE && x < (c.x + 1) * TILE && y >= c.y0 * TILE && y < c.y1 * TILE) return true;
    }
    for (const c of w.covers) if (!c.shown && x >= c.box.x && x < c.box.x + c.box.w && y >= c.box.y && y < c.box.y + c.box.h) return true;
    return false;
  }

  private drawSignBubbles(w: World, cx: number) {
    const g = this.g;
    const p = w.player;
    for (const s of w.signs) {
      if (this.hiddenByCover(w, s.x + 8, s.y - 4)) continue;
      const d = Math.abs(p.cx - (s.x + 8));
      if (d > 34 || Math.abs(p.y + PLAYER.H - s.y) > 40) continue;
      const tw = textWidth(s.text);
      let bx = Math.round(s.x + 8 - tw / 2 - 4);
      bx = Math.max(cx + 2, Math.min(cx + VIEW_W - tw - 10, bx));
      const by = s.y - 34;
      g.fillStyle = PAL.k;
      g.fillRect(bx - 1, by - 1, tw + 10, 13);
      g.fillStyle = '#f3e6c8';
      g.fillRect(bx, by, tw + 8, 11);
      g.fillStyle = '#d4c09a';
      g.fillRect(bx, by + 10, tw + 8, 1);
      // tail
      const tx = Math.max(bx + 3, Math.min(bx + tw + 3, s.x + 7));
      g.fillStyle = PAL.k;
      g.fillRect(tx - 1, by + 12, 4, 1);
      g.fillRect(tx, by + 13, 2, 1);
      g.fillStyle = '#f3e6c8';
      g.fillRect(tx, by + 11, 2, 1);
      drawText(g, s.text, bx + 4, by + 2, '#2a1a12');
    }
  }

  private drawGhosts(w: World, time: number) {
    const g = this.g;
    for (const gh of w.ghosts) {
      const x = gh.x;
      const b = Math.round(gh.y + gh.drop);
      // tripod base
      g.fillStyle = PAL.k;
      g.fillRect(x + 3, b - 2, 11, 2);
      g.fillStyle = PAL.G;
      g.fillRect(x + 4, b - 2, 9, 1);
      g.fillStyle = PAL.g;
      g.fillRect(x + 8, b - 24, 1, 22);
      g.fillStyle = PAL.G;
      g.fillRect(x + 7, b - 24, 1, 22);
      // cage + bulb
      const lit = gh.lit;
      const fl = lit ? 0.85 + 0.15 * Math.sin(time * 9 + x) * Math.sin(time * 3.1) : 0;
      if (lit) {
        g.save();
        g.globalCompositeOperation = 'lighter';
        const rad = g.createRadialGradient(x + 8, b - 29, 1, x + 8, b - 29, 34);
        rad.addColorStop(0, `rgba(255,236,170,${(0.45 * fl).toFixed(3)})`);
        rad.addColorStop(1, 'rgba(255,236,170,0)');
        g.fillStyle = rad;
        g.fillRect(x - 28, b - 64, 72, 68);
        g.restore();
      }
      g.fillStyle = lit ? '#fff6cc' : '#5d566e';
      g.fillRect(x + 6, b - 32, 5, 6);
      g.fillStyle = lit ? PAL.Y : '#46405a';
      g.fillRect(x + 6, b - 27, 5, 1);
      g.fillStyle = PAL.k;
      g.fillRect(x + 5, b - 33, 7, 1);
      g.fillRect(x + 5, b - 26, 7, 1);
      g.fillRect(x + 5, b - 33, 1, 8);
      g.fillRect(x + 11, b - 33, 1, 8);
      g.fillRect(x + 8, b - 33, 1, 8);
      g.fillStyle = PAL.g;
      g.fillRect(x + 7, b - 35, 3, 2);
    }
  }

  private drawDoors(w: World, time: number) {
    const g = this.g;
    for (const d of w.doors) {
      const x = d.x;
      const b = d.y;
      const opening = w.exitDoor === d ? Math.min(1, w.stateT / 0.25) : 0;
      // frame
      g.fillStyle = PAL.k;
      g.fillRect(x + 1, b - 40, 30, 40);
      g.fillStyle = PAL.o;
      g.fillRect(x + 2, b - 39, 28, 39);
      g.fillStyle = PAL.O;
      g.fillRect(x + 2, b - 39, 28, 2);
      // doorway
      g.fillStyle = '#07050a';
      g.fillRect(x + 6, b - 34, 20, 34);
      // door leaf (swings open to the left)
      const leafW = Math.round(20 * (1 - opening * 0.85));
      if (leafW > 0) {
        g.fillStyle = PAL.w;
        g.fillRect(x + 6, b - 34, leafW, 34);
        g.fillStyle = PAL.o;
        if (leafW > 4) {
          g.fillRect(x + 8, b - 32, Math.max(1, leafW - 4), 13);
          g.fillRect(x + 8, b - 16, Math.max(1, leafW - 4), 14);
        }
        g.fillStyle = PAL.Y;
        if (leafW > 14) g.fillRect(x + 6 + leafW - 4, b - 18, 2, 2);
      }
      if (opening > 0) {
        g.fillStyle = 'rgba(255,220,150,0.25)';
        g.fillRect(x + 6 + leafW, b - 34, 20 - leafW, 34);
      }
      // EXIT sign
      const glow = 0.8 + 0.2 * Math.sin(time * 4);
      g.fillStyle = PAL.k;
      g.fillRect(x + 6, b - 50, 20, 9);
      g.fillStyle = '#123a22';
      g.fillRect(x + 7, b - 49, 18, 7);
      drawText(g, 'EXIT', x + 8, b - 49, `rgba(120,255,160,${glow.toFixed(2)})`);
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = `rgba(90,224,138,${(0.12 * glow).toFixed(3)})`;
      g.fillRect(x + 2, b - 54, 28, 16);
      g.restore();
    }
  }

  private drawBags(w: World, time: number) {
    const g = this.g;
    for (const b of w.bags) {
      if (b.state === 'gone') continue;
      let x = Math.round(b.x);
      const y = Math.round(b.y);
      if (b.state === 'hang' || b.state === 'wobble') {
        let sway = 0;
        if (b.state === 'wobble') sway = Math.round(Math.sin(b.t * 70) * 1.5);
        else sway = Math.round(Math.sin(time * 1.2 + b.x * 0.1) * 0.6);
        x += sway;
        if (y > b.ropeTop) {
          g.fillStyle = '#c9a66e';
          g.fillRect(Math.round(b.x) + 7, b.ropeTop, 1, y - b.ropeTop + 1);
          g.fillStyle = '#7a5a36';
          g.fillRect(Math.round(b.x) + 8, b.ropeTop, 1, y - b.ropeTop + 1);
        }
        if (b.state === 'wobble') {
          // fraying rope: a few fibres flick out
          g.fillStyle = '#e8d4a0';
          const fy = Math.max(b.ropeTop, y - 6);
          g.fillRect(Math.round(b.x) + 6 + (Math.floor(b.t * 40) % 3), fy, 1, 1);
        }
        g.drawImage(this.bag, x, y);
      } else if (b.state === 'fall') {
        // snapped rope end retracts
        if (b.ropeTop < y) {
          const len = Math.max(0, 8 - (y - b.ropeTop) * 0.05);
          g.fillStyle = '#c9a66e';
          g.fillRect(Math.round(b.x) + 7, b.ropeTop, 1, Math.round(len));
        }
        g.drawImage(this.bag, x, y - 1, 16, 17);
      } else {
        g.drawImage(this.bag, x, y);
      }
    }
  }

  private drawCutouts(w: World, time: number) {
    const g = this.g;
    for (const c of w.cutouts) {
      const x = Math.round(c.x);
      const y = Math.round(c.y);
      if (c.kind === 'knight') {
        if (c.flat) {
          g.drawImage(this.knightFlat, x - 5, c.railY - 3);
          continue;
        }
        const bob = c.moving && Math.floor(c.t * 10) % 2 ? 1 : 0;
        g.drawImage(this.knight[c.dir > 0 ? 0 : 1], x, y - bob);
        // spinning wheel glint
        if (c.moving) {
          g.fillStyle = PAL.s;
          g.fillRect(x + (Math.floor(c.t * 16) % 2 ? 3 : 10), y + 22, 1, 1);
        }
      } else if (c.kind === 'cloud') {
        // trolley + ropes from the ceiling rail
        g.fillStyle = PAL.k;
        g.fillRect(x + 5, c.railY, 22, 3);
        g.fillStyle = PAL.G;
        g.fillRect(x + 6, c.railY, 20, 1);
        g.fillStyle = '#8a6a44';
        g.fillRect(x + 8, c.railY + 3, 1, y - c.railY);
        g.fillRect(x + 23, c.railY + 3, 1, y - c.railY);
        g.drawImage(this.cloud, x, y);
        if (Math.floor(time * 12) % 5 === 0) {
          g.save();
          g.globalCompositeOperation = 'lighter';
          g.fillStyle = 'rgba(255,240,140,0.35)';
          g.fillRect(x + 8, y + 10, 10, 12);
          g.restore();
        }
      } else {
        const bob = c.moving && Math.floor(c.t * 8) % 2 ? 1 : 0;
        const shake = c.stun > 0 || c.blockT > 0 ? (Math.floor(c.t * 30) % 2) : 0;
        g.drawImage(this.bear[c.dir > 0 ? 0 : 1], x + shake, y - bob);
        if (c.stun > 0) {
          for (let i = 0; i < 3; i++) {
            const a = time * 6 + i * 2.1;
            g.fillStyle = PAL.Y;
            g.fillRect(Math.round(x + 15 + Math.cos(a) * 9), Math.round(y - 3 + Math.sin(a) * 2), 1, 1);
          }
        }
      }
    }
  }

  private drawArches(w: World) {
    const g = this.g;
    for (const a of w.arches) {
      g.fillStyle = 'rgba(5,3,8,0.93)';
      g.fillRect(a.x, a.y, a.w, a.h);
      g.fillStyle = PAL.k;
      g.fillRect(a.x, a.y, a.w, 2);
      g.fillStyle = '#3a2a4e';
      g.fillRect(a.x, a.y - 1, a.w, 1);
      g.fillStyle = 'rgba(5,3,8,0.93)';
      g.fillRect(a.x + 1, a.y - 3, a.w - 2, 2);
    }
  }

  private drawCovers(w: World) {
    const g = this.g;
    const cover = (x: number, y: number) => facade(g, x, y, x / TILE, y / TILE);
    for (const td of w.traps) {
      if (td.state === 'open') continue;
      for (const c of td.cover) for (let y = c.y0; y < c.y1; y++) cover(c.x * TILE, y * TILE);
    }
    for (const l of w.lifts) {
      if (l.y < l.baseY) continue;
      // understage below an idle lift reads like normal floor
    }
    for (const c of w.covers) {
      if (c.shown) continue;
      for (let y = c.box.y; y < c.box.y + c.box.h; y += TILE) for (let x = c.box.x; x < c.box.x + c.box.w; x += TILE) cover(x, y);
    }
  }

  private drawPlayer(w: World, time: number) {
    const g = this.g;
    const p = w.player;
    if (w.state === 'dying') {
      if (w.hitstop > 0) {
        const s = this.pipWhite;
        g.drawImage(s, Math.round(p.x - 1), Math.round(p.y + PLAYER.H - 16));
      }
      return;
    }
    let frame = 'idle0';
    if (p.grounded || w.state === 'exit') {
      if (Math.abs(p.vx) > 5 && w.state !== 'exit') frame = `run${Math.floor(p.runT * 9) % 4}`;
      else frame = time % 3.2 < 0.12 ? 'idle1' : 'idle0';
    } else frame = p.vy < -20 ? 'jump' : 'fall';
    const spr = this.pip[frame][p.face > 0 ? 0 : 1];
    const dw = Math.max(6, Math.round(12 * p.sx));
    const dh = Math.max(8, Math.round(16 * p.sy));
    const feet = Math.round(p.y + PLAYER.H);
    const dx = Math.round(p.cx - dw / 2);
    const dy = feet - dh;
    if (w.state === 'exit') g.globalAlpha = Math.max(0, 1 - w.stateT / 0.55);
    // the cut marionette string, trailing from the crown
    const sway = Math.max(-4, Math.min(4, -p.vx / 24 + (p.grounded ? Math.sin(time * 2) * 0.6 : p.vy / 90)));
    const sx0 = dx + Math.round((6 * dw) / 12) - (p.face > 0 ? 1 : 0);
    for (let i = 1; i <= 4; i++) {
      g.fillStyle = i === 4 ? 'rgba(235,225,200,0.7)' : 'rgba(200,196,215,0.45)';
      g.fillRect(Math.round(sx0 + (sway * i * i) / 16), dy - i + 1, 1, 1);
    }
    g.drawImage(spr, dx, dy, dw, dh);
    g.globalAlpha = 1;
    // respawn sparkle
    if (w.spawnT < 0.3 && w.state === 'play') {
      const k = w.spawnT / 0.3;
      const r = 4 + k * 14;
      g.fillStyle = `rgba(255,236,170,${(1 - k).toFixed(2)})`;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        g.fillRect(Math.round(p.cx + Math.cos(a) * r), Math.round(p.y + 7 + Math.sin(a) * r), 1, 1);
      }
    }
  }

  private drawFx(w: World, front: boolean) {
    const g = this.g;
    for (const f of w.fx) {
      if (!!f.front !== front) continue;
      const a = Math.min(1, f.life / (f.max * 0.5));
      g.globalAlpha = a;
      g.fillStyle = f.color;
      g.fillRect(Math.round(f.x), Math.round(f.y), f.size, f.size);
    }
    g.globalAlpha = 1;
  }

  // -- foreground & overlays -------------------------------------------------

  /** Audience silhouettes that pop up from below the screen to react. */
  audience(kind: 'gasp' | 'cheer' | 'applause', x01 = 0.5) {
    const n = kind === 'applause' ? 26 : kind === 'cheer' ? 9 : 5;
    const centre = x01 * VIEW_W;
    const sorted = [...this.heads].sort((a, b) => Math.abs(a.x - centre) - Math.abs(b.x - centre));
    for (let i = 0; i < n; i++) {
      const h = sorted[i];
      h.v = 60 + (hash(i, Math.round(centre)) % 50);
      h.mark = kind === 'gasp' ? 0.7 : kind === 'cheer' ? -1.1 : -3;
    }
  }

  updateAudience(dt: number) {
    for (const h of this.heads) {
      const target = h.mark !== 0 ? 9 : 0;
      h.v += (-(h.pop - target) * 160 - h.v * 9) * dt;
      h.pop += h.v * dt;
      if (h.pop < 0) {
        h.pop = 0;
        if (h.v < 0) h.v = 0;
      }
      if (h.mark > 0) h.mark = Math.max(0, h.mark - dt);
      else if (h.mark < 0) h.mark = Math.min(0, h.mark + dt);
    }
  }

  private drawAudience(time: number) {
    const g = this.g;
    for (const h of this.heads) {
      const lift = h.pop;
      if (lift < 0.5) continue;
      const top = VIEW_H + 1 - Math.round(lift * 1.3);
      g.fillStyle = h.shade;
      // head + shoulders
      g.fillRect(h.x + 2, top, 7, 7);
      g.fillRect(h.x + 1, top + 1, 9, 5);
      g.fillRect(h.x - 1, top + 7, 13, 10);
      if (h.kind === 1) g.fillRect(h.x + 1, top - 2, 9, 2); // hat
      if (h.mark > 0) drawText(g, '!', h.x + 5, top - 10, '#f3e6c8');
      if (h.mark < 0) {
        // raised hands clapping
        const k = Math.floor(time * 10) % 2;
        g.fillRect(h.x - 2 + k, top - 5, 2, 7);
        g.fillRect(h.x + 11 - k, top - 5, 2, 7);
      }
    }
  }

  private drawValance(time: number) {
    const g = this.g;
    g.fillStyle = '#3e0c18';
    g.fillRect(0, 0, VIEW_W, 5);
    for (let x = 0; x < VIEW_W; x += 16) {
      g.fillStyle = '#5a1222';
      g.fillRect(x, 0, 8, 6);
      g.fillStyle = '#3e0c18';
      g.fillRect(x + 1, 6, 14, 1);
      g.fillRect(x + 3, 7, 10, 1);
    }
    g.fillStyle = '#b8862e';
    g.fillRect(0, 5, VIEW_W, 1);
    for (let x = 4; x < VIEW_W; x += 8) {
      g.fillStyle = (x / 8 + Math.floor(time * 2)) % 2 ? '#e8b64a' : '#b8862e';
      g.fillRect(x, 6, 1, 2);
    }
  }

  private drawBearIndicator(w: World, cx: number) {
    const g = this.g;
    for (const c of w.cutouts) {
      if (c.kind !== 'bear' || !c.active || c.x + c.w > cx) continue;
      if (c.x < cx - 400) continue;
      const blink = Math.floor(w.time * 6) % 2;
      g.fillStyle = blink ? '#dc4d4f' : '#7c1a2c';
      g.fillRect(2, c.y + 8, 2, 8);
      g.fillRect(4, c.y + 10, 2, 4);
      g.fillRect(6, c.y + 11, 1, 2);
    }
  }

  /** Circle wipe; r in screen pixels (0 = fully closed). */
  iris(cx: number, cy: number, r: number) {
    const g = this.g;
    if (r > 400) return;
    g.save();
    g.fillStyle = '#07050b';
    g.beginPath();
    g.rect(0, 0, VIEW_W, VIEW_H);
    g.arc(cx, cy, Math.max(0, r), 0, Math.PI * 2, true);
    g.fill('evenodd');
    g.restore();
  }

  /** Big red house curtain. `open` 0 = closed, 1 = fully open. */
  curtain(open: number, time: number) {
    const g = this.g;
    const half = VIEW_W / 2;
    const off = Math.round(open * (half + 20));
    for (const side of [-1, 1]) {
      const x0 = side < 0 ? -off : half + off;
      for (let x = 0; x < half + 2; x++) {
        const fold = (x + (side < 0 ? 0 : 7)) % 20;
        const shade = fold < 3 ? '#4a0e1c' : fold < 9 ? '#7c1a2c' : fold < 14 ? '#962236' : '#6a1526';
        g.fillStyle = shade;
        const sway = Math.round(Math.sin(time * 1.5 + x * 0.05) * (open > 0 && open < 1 ? 2 : 0.5));
        g.fillRect(x0 + x, 0, 1, VIEW_H + sway);
      }
      // gold trim at the inner edge + tassels at the bottom
      const edge = side < 0 ? x0 + half + 1 : x0;
      g.fillStyle = '#b8862e';
      g.fillRect(edge, 0, 1, VIEW_H);
      for (let x = 0; x < half; x += 6) {
        g.fillStyle = '#b8862e';
        g.fillRect(x0 + x + 2, VIEW_H - 5, 2, 3);
      }
    }
    this.drawValance(time);
  }

  hudText(text: string, x: number, y: number, color = '#f3e6c8', align: 'left' | 'center' | 'right' = 'left', scale = 1) {
    drawText(this.g, text, x, y, color, { shadow: '#07050b', align, scale });
  }

  panelBox(x: number, y: number, w: number, h: number) {
    const g = this.g;
    g.fillStyle = '#07050b';
    g.fillRect(x - 1, y - 1, w + 2, h + 2);
    g.fillStyle = '#1e1428';
    g.fillRect(x, y, w, h);
    g.fillStyle = '#b8862e';
    g.fillRect(x, y, w, 1);
    g.fillRect(x, y + h - 1, w, 1);
  }

  /** Clapperboard icon (HUD). */
  clapper(x: number, y: number, snap: number) {
    const g = this.g;
    g.fillStyle = '#07050b';
    g.fillRect(x - 1, y + 2, 12, 9);
    g.fillStyle = '#e8e2d6';
    g.fillRect(x, y + 4, 10, 6);
    g.fillStyle = '#2a2230';
    g.fillRect(x + 1, y + 6, 8, 1);
    g.fillRect(x + 1, y + 8, 5, 1);
    // hinged stick
    const lift = Math.round(snap * 3);
    g.fillStyle = '#07050b';
    g.fillRect(x - 1, y + 1 - lift, 12, 3);
    for (let i = 0; i < 10; i += 2) {
      g.fillStyle = '#e8e2d6';
      g.fillRect(x + i, y + 2 - lift, 1, 1);
    }
  }

  /** Draw a sprite of the cast (curtain call). */
  castSprite(kind: 'pip' | 'pipBow' | 'knight' | 'cloud' | 'bear' | 'bag', x: number, y: number, flip = false) {
    const g = this.g;
    const pick = (a: [Sprite, Sprite]) => a[flip ? 1 : 0];
    const s =
      kind === 'pip' ? pick(this.pip.idle0) : kind === 'pipBow' ? pick(this.pip.bow) : kind === 'knight' ? pick(this.knight) : kind === 'bear' ? pick(this.bear) : kind === 'cloud' ? this.cloud : this.bag;
    g.drawImage(s, Math.round(x - s.width / 2), Math.round(y - s.height));
  }

  stageFloor(y: number) {
    const g = this.g;
    for (let x = 0; x < VIEW_W; x += TILE) deckTop(g, x, y, x / TILE, 0);
    for (let yy = y + TILE; yy < VIEW_H; yy += TILE) for (let x = 0; x < VIEW_W; x += TILE) facade(g, x, yy, x / TILE, yy / TILE);
  }

  backdrop(time: number) {
    this.drawBackdrop(0, time);
  }

  vignetteOverlay() {
    this.g.drawImage(this.vignette, 0, 0);
  }

  audienceLayer(time: number) {
    this.drawAudience(time);
  }

  dimAll(alpha: number) {
    this.g.fillStyle = `rgba(7,5,11,${alpha})`;
    this.g.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  /** Iris phase for death/respawn. Returns radius or Infinity. */
  static deathIris(w: World): number {
    if (w.state === 'dying') {
      const t0 = DEATH.HOLD - 0.22;
      if (w.stateT > t0) return Math.max(0, 260 * (1 - (w.stateT - t0) / 0.2));
    } else if (w.state === 'play' && w.spawnT < 0.22) {
      return 8 + 300 * (w.spawnT / 0.22);
    }
    return Infinity;
  }

  static isBag(o: unknown): o is Bag {
    return o instanceof Bag;
  }
  static isCut(o: unknown): o is Cutout {
    return o instanceof Cutout;
  }
}

