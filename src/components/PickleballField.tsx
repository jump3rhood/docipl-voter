"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  type Ball,
  ballCountFor,
  createBalls,
  flickAt,
  isInteractiveTarget,
  needsRealloc,
  stepBalls,
} from "@/lib/pickleballs";

const SPRITE_SIZE = 128;
/** Max pointer travel (px) between down and up that still counts as a tap. */
const TAP_SLOP = 10;

function makeSprite(): HTMLCanvasElement | null {
  const c = document.createElement("canvas");
  c.width = SPRITE_SIZE;
  c.height = SPRITE_SIZE;
  const g = c.getContext("2d");
  if (!g) return null;
  const mid = SPRITE_SIZE / 2;
  const rad = mid - 2;
  const fill = g.createRadialGradient(
    SPRITE_SIZE * 0.35,
    SPRITE_SIZE * 0.3,
    0,
    mid,
    mid,
    rad,
  );
  fill.addColorStop(0, "#F2FF9E");
  fill.addColorStop(0.55, "#D4F23A");
  fill.addColorStop(1, "#A9C81E");
  g.fillStyle = fill;
  g.beginPath();
  g.arc(mid, mid, rad, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = 4;
  g.strokeStyle = "#9DB81A";
  g.stroke();
  g.fillStyle = "rgba(7,28,61,0.55)";
  // Hole 0 is the centre; holes 1..6 form a ring.
  for (let i = 0; i < 7; i++) {
    const a = ((i - 1) / 6) * Math.PI * 2;
    const d = i === 0 ? 0 : rad * 0.55;
    g.beginPath();
    g.arc(mid + Math.cos(a) * d, mid + Math.sin(a) * d, rad * 0.14, 0, Math.PI * 2);
    g.fill();
  }
  return c;
}

export function PickleballField() {
  const pathname = usePathname();
  const hidden = pathname?.startsWith("/admin") ?? false;
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (hidden) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const sprite = makeSprite();
    if (!sprite) return;

    const reduced =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    // Backing store size (CSS px) and the bounds balls are clamped to.
    let allocWidth = 0;
    let allocHeight = 0;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let balls: Ball[] = [];

    const resize = () => {
      const nextDpr = Math.min(window.devicePixelRatio || 1, 2);
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      if (nextDpr !== dpr || !allocWidth || needsRealloc(allocWidth, allocHeight, vw, vh)) {
        dpr = nextDpr;
        allocWidth = vw;
        allocHeight = vh;
        canvas.width = Math.round(vw * dpr);
        canvas.height = Math.round(vh * dpr);
        // Pin the CSS size to the backing store so small viewport changes don't stretch it.
        canvas.style.width = `${vw}px`;
        canvas.style.height = `${vh}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      width = Math.min(vw, allocWidth);
      height = Math.min(vh, allocHeight);
    };

    const draw = () => {
      ctx.clearRect(0, 0, allocWidth, allocHeight);
      for (let i = 0; i < balls.length; i++) {
        const b = balls[i];
        const cos = dpr * Math.cos(b.angle);
        const sin = dpr * Math.sin(b.angle);
        ctx.globalAlpha = b.alpha;
        ctx.setTransform(cos, sin, -sin, cos, dpr * b.x, dpr * b.y);
        ctx.drawImage(sprite, -b.r, -b.r, b.r * 2, b.r * 2);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalAlpha = 1;
    };

    resize();
    balls = createBalls(ballCountFor(navigator.hardwareConcurrency), width, height);

    // Mobile URL-bar collapse fires resize repeatedly: handle at most once per frame.
    let resizeRaf = 0;
    const applyResize = () => {
      resizeRaf = 0;
      resize();
      stepBalls(balls, 0, width, height);
      draw();
    };
    const onResize = () => {
      if (!resizeRaf) resizeRaf = requestAnimationFrame(applyResize);
    };
    window.addEventListener("resize", onResize);

    if (reduced) {
      draw();
      return () => {
        if (resizeRaf) cancelAnimationFrame(resizeRaf);
        window.removeEventListener("resize", onResize);
      };
    }

    let raf = 0;
    let startTimer: number | undefined;
    let idleHandle: number | undefined;
    let last = 0;
    let running = false;

    const frame = (t: number) => {
      raf = 0;
      if (document.hidden) {
        running = false;
        return;
      }
      const dt = last ? Math.min((t - last) / 1000, 0.05) : 0;
      last = t;
      stepBalls(balls, dt, width, height);
      draw();
      raf = requestAnimationFrame(frame);
    };

    const start = () => {
      if (running || document.hidden) return;
      running = true;
      last = 0;
      raf = requestAnimationFrame(frame);
    };

    const onVisibility = () => {
      if (!document.hidden) start();
    };

    // Flick only on a tap: pointerup within TAP_SLOP of its pointerdown, so scrolls
    // and drags don't move balls.
    const downs = new Map<number, { x: number; y: number }>();
    const onPointerDown = (e: PointerEvent) => {
      if (isInteractiveTarget(e.target as Element | null)) return;
      downs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    };
    const onPointerUp = (e: PointerEvent) => {
      const down = downs.get(e.pointerId);
      if (!down) return;
      downs.delete(e.pointerId);
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) >= TAP_SLOP) return;
      flickAt(balls, e.clientX, e.clientY);
    };
    const onPointerCancel = (e: PointerEvent) => {
      downs.delete(e.pointerId);
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("pointerup", onPointerUp, { passive: true });
    window.addEventListener("pointercancel", onPointerCancel, { passive: true });

    if (typeof window.requestIdleCallback === "function") {
      idleHandle = window.requestIdleCallback(start);
    } else {
      startTimer = window.setTimeout(start, 200);
    }
    draw();

    return () => {
      if (raf) cancelAnimationFrame(raf);
      if (resizeRaf) cancelAnimationFrame(resizeRaf);
      if (idleHandle !== undefined) window.cancelIdleCallback(idleHandle);
      if (startTimer !== undefined) window.clearTimeout(startTimer);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [hidden]);

  if (hidden) return null;
  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 h-full w-full"
    />
  );
}
