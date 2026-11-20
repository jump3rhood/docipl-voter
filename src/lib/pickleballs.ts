export type Ball = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  angle: number;
  spin: number;
  alpha: number;
};

const MIN_DRIFT = 8;
const MAX_DRIFT = 20;
const REST_SPEED = 14;
const BASE_SPIN = 0.3;
const DECAY_TAU = 0.6;
const FLICK_RADIUS = 120;
const FLICK_SPEED = 600;
const FLICK_SPIN = 6;
const NEIGHBOUR_RADIUS = 80;
const NEIGHBOUR_SPEED = 250;

export function createBalls(
  count: number,
  width: number,
  height: number,
  rand: () => number = Math.random,
): Ball[] {
  const balls: Ball[] = [];
  for (let i = 0; i < count; i++) {
    const r = 12 + rand() * 12;
    const dir = rand() * Math.PI * 2;
    const speed = MIN_DRIFT + rand() * (MAX_DRIFT - MIN_DRIFT);
    balls.push({
      x: r + rand() * Math.max(0, width - 2 * r),
      y: r + rand() * Math.max(0, height - 2 * r),
      vx: Math.cos(dir) * speed,
      vy: Math.sin(dir) * speed,
      r,
      angle: rand() * Math.PI * 2,
      spin: (rand() < 0.5 ? -1 : 1) * BASE_SPIN,
      alpha: 0.8 + rand() * 0.15,
    });
  }
  return balls;
}

export function stepBalls(
  balls: Ball[],
  dtSeconds: number,
  width: number,
  height: number,
): void {
  const decay = Math.exp(-dtSeconds / DECAY_TAU);
  for (let i = 0; i < balls.length; i++) {
    const b = balls[i];

    const speed = Math.hypot(b.vx, b.vy);
    if (speed > REST_SPEED) {
      const k = (REST_SPEED + (speed - REST_SPEED) * decay) / speed;
      b.vx *= k;
      b.vy *= k;
    } else if (speed < MIN_DRIFT) {
      if (speed < 1e-6) {
        b.vx = MIN_DRIFT * Math.cos(b.angle);
        b.vy = MIN_DRIFT * Math.sin(b.angle);
      } else {
        const k = MIN_DRIFT / speed;
        b.vx *= k;
        b.vy *= k;
      }
    }

    const base = b.spin < 0 ? -BASE_SPIN : BASE_SPIN;
    b.spin = base + (b.spin - base) * decay;

    b.x += b.vx * dtSeconds;
    b.y += b.vy * dtSeconds;
    b.angle += b.spin * dtSeconds;

    const maxX = Math.max(b.r, width - b.r);
    const maxY = Math.max(b.r, height - b.r);
    if (b.x < b.r) {
      b.x = b.r;
      b.vx = Math.abs(b.vx);
    } else if (b.x > maxX) {
      b.x = maxX;
      b.vx = -Math.abs(b.vx);
    }
    if (b.y < b.r) {
      b.y = b.r;
      b.vy = Math.abs(b.vy);
    } else if (b.y > maxY) {
      b.y = maxY;
      b.vy = -Math.abs(b.vy);
    }
  }
}

export function flickAt(balls: Ball[], x: number, y: number): boolean {
  let nearest = -1;
  let best = FLICK_RADIUS;
  for (let i = 0; i < balls.length; i++) {
    const d = Math.hypot(balls[i].x - x, balls[i].y - y);
    if (d <= best) {
      best = d;
      nearest = i;
    }
  }
  if (nearest < 0) return false;

  const hit = balls[nearest];
  let dx = hit.x - x;
  let dy = hit.y - y;
  let len = Math.hypot(dx, dy);
  if (len < 1e-6) {
    dx = 0;
    dy = -1;
    len = 1;
  }
  hit.vx += (dx / len) * FLICK_SPEED;
  hit.vy += (dy / len) * FLICK_SPEED;
  hit.spin += (Math.random() < 0.5 ? -1 : 1) * FLICK_SPIN;

  for (let i = 0; i < balls.length; i++) {
    if (i === nearest) continue;
    const o = balls[i];
    const ox = o.x - hit.x;
    const oy = o.y - hit.y;
    const od = Math.hypot(ox, oy);
    if (od <= NEIGHBOUR_RADIUS && od > 1e-6) {
      o.vx += (ox / od) * NEIGHBOUR_SPEED;
      o.vy += (oy / od) * NEIGHBOUR_SPEED;
    }
  }
  return true;
}

/** Height-only changes below this are mobile URL-bar collapse/expand; no realloc. */
const REALLOC_HEIGHT_DELTA = 120;

export function needsRealloc(
  prevWidth: number,
  prevHeight: number,
  width: number,
  height: number,
): boolean {
  return width !== prevWidth || Math.abs(height - prevHeight) >= REALLOC_HEIGHT_DELTA;
}

export function ballCountFor(hardwareConcurrency: number | undefined): number {
  return hardwareConcurrency !== undefined && hardwareConcurrency <= 4 ? 5 : 8;
}

const INTERACTIVE =
  "button, a, input, select, textarea, label, [role=radio], [role=dialog], [role=button]";

export function isInteractiveTarget(el: Element | null): boolean {
  return !!el && typeof el.closest === "function" && el.closest(INTERACTIVE) !== null;
}
