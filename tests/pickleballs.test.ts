// @vitest-environment jsdom
import { expect, test } from 'vitest';
import {
  type Ball,
  ballCountFor,
  createBalls,
  flickAt,
  isInteractiveTarget,
  needsRealloc,
  stepBalls,
} from '@/lib/pickleballs';

function seeded(seed = 42) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function ball(x: number, y: number, over: Partial<Ball> = {}): Ball {
  return { x, y, vx: 0, vy: 0, r: 20, angle: 0, spin: 0, alpha: 0.5, ...over };
}

test('createBalls respects count, radius and alpha ranges', () => {
  const balls = createBalls(8, 390, 844, seeded());
  expect(balls).toHaveLength(8);
  for (const b of balls) {
    expect(b.r).toBeGreaterThanOrEqual(12);
    expect(b.r).toBeLessThanOrEqual(24);
    expect(b.alpha).toBeGreaterThanOrEqual(0.8);
    expect(b.alpha).toBeLessThanOrEqual(0.95);
    const speed = Math.hypot(b.vx, b.vy);
    expect(speed).toBeGreaterThanOrEqual(8 - 1e-6);
    expect(speed).toBeLessThanOrEqual(20 + 1e-6);
    expect(b.x).toBeGreaterThanOrEqual(b.r);
    expect(b.x).toBeLessThanOrEqual(390 - b.r);
    expect(b.y).toBeGreaterThanOrEqual(b.r);
    expect(b.y).toBeLessThanOrEqual(844 - b.r);
  }
});

test('stepBalls keeps balls inside bounds', () => {
  const balls = createBalls(8, 390, 844, seeded(7));
  balls[0].vx = 900;
  balls[1].vy = -900;
  for (let i = 0; i < 500; i++) stepBalls(balls, 1 / 60, 390, 844);
  for (const b of balls) {
    expect(b.x).toBeGreaterThanOrEqual(b.r);
    expect(b.x).toBeLessThanOrEqual(390 - b.r);
    expect(b.y).toBeGreaterThanOrEqual(b.r);
    expect(b.y).toBeLessThanOrEqual(844 - b.r);
  }
});

test('flick moves nearest ball away and decays back to drift', () => {
  const balls = [ball(100, 100, { vx: 10 })];
  expect(flickAt(balls, 90, 100)).toBe(true);
  expect(balls[0].vx).toBeGreaterThan(500);
  for (let i = 0; i < 180; i++) stepBalls(balls, 1 / 60, 390, 844);
  expect(Math.hypot(balls[0].vx, balls[0].vy)).toBeLessThanOrEqual(25);
});

test('flick ignores taps farther than 120px', () => {
  const balls = [ball(100, 100, { vx: 5, vy: 6 })];
  expect(flickAt(balls, 300, 100)).toBe(false);
  expect(balls[0].vx).toBe(5);
  expect(balls[0].vy).toBe(6);
});

test('flick nudges neighbours within 80px', () => {
  const balls = [ball(100, 100), ball(160, 100), ball(300, 300)];
  expect(flickAt(balls, 90, 100)).toBe(true);
  expect(balls[1].vx).toBeGreaterThan(100);
  expect(balls[2].vx).toBe(0);
  expect(balls[2].vy).toBe(0);
});

test('flick on exact centre pushes upward', () => {
  const balls = [ball(100, 100)];
  expect(flickAt(balls, 100, 100)).toBe(true);
  expect(balls[0].vy).toBeLessThan(-500);
});

test('needsRealloc: any growth or width change reallocates; small shrinks do not', () => {
  expect(needsRealloc(390, 844, 390, 844)).toBe(false);
  expect(needsRealloc(390, 844, 390, 790)).toBe(false);
  expect(needsRealloc(390, 844, 390, 844 - 119)).toBe(false);
  expect(needsRealloc(390, 844, 390, 844 - 120)).toBe(true);
  expect(needsRealloc(390, 844, 390, 845)).toBe(true);
  expect(needsRealloc(390, 844, 390, 900)).toBe(true);
  expect(needsRealloc(390, 844, 844, 390)).toBe(true);
  expect(needsRealloc(390, 844, 391, 844)).toBe(true);
});

test('ballCountFor', () => {
  expect(ballCountFor(2)).toBe(5);
  expect(ballCountFor(4)).toBe(5);
  expect(ballCountFor(8)).toBe(8);
  expect(ballCountFor(undefined)).toBe(8);
});

test('isInteractiveTarget', () => {
  document.body.innerHTML = `
    <main id="m"><p id="p">x</p></main>
    <button id="b"><span id="bs">y</span></button>
    <div role="radio" id="r"></div>
    <div role="dialog"><i id="d"></i></div>`;
  const g = (id: string) => document.getElementById(id);
  expect(isInteractiveTarget(g('b'))).toBe(true);
  expect(isInteractiveTarget(g('bs'))).toBe(true);
  expect(isInteractiveTarget(g('r'))).toBe(true);
  expect(isInteractiveTarget(g('d'))).toBe(true);
  expect(isInteractiveTarget(g('m'))).toBe(false);
  expect(isInteractiveTarget(g('p'))).toBe(false);
  expect(isInteractiveTarget(document.body)).toBe(false);
  expect(isInteractiveTarget(null)).toBe(false);
});
