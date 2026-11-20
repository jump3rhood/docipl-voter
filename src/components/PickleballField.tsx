"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  type Ball,
  ballCountFor,
  createBalls,
  flickAt,
  isInteractiveTarget,
  stepBalls,
} from "@/lib/pickleballs";

const SPRITE_SIZE = 64;

function makeSprite(): HTMLCanvasElement | null {
  const c = document.createElement("canvas");
  c.width = SPRITE_SIZE;
  c.height = SPRITE_SIZE;
  const g = c.getContext("2d");
  if (!g) return null;
  const mid = SPRITE_SIZE / 2;
  const rad = mid - 2;
  g.fillStyle = "#FFD21F";
  g.beginPath();
  g.arc(mid, mid, rad, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = 3;
  g.strokeStyle = "#D9AE00";
  g.stroke();
  g.fillStyle = "#B88F00";
  const holes = 7;
  for (let i = 0; i < holes; i++) {
    const a = (i / holes) * Math.PI * 2;
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
    let width = window.innerWidth;
    let height = window.innerHeight;
    let balls: Ball[] = [];

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      for (let i = 0; i < balls.length; i++) {
        const b = balls[i];
        ctx.save();
        ctx.globalAlpha = b.alpha;
        ctx.translate(b.x, b.y);
        ctx.rotate(b.angle);
        ctx.drawImage(sprite, -b.r, -b.r, b.r * 2, b.r * 2);
        ctx.restore();
      }
    };

    resize();
    balls = createBalls(ballCountFor(navigator.hardwareConcurrency), width, height);

    const onResize = () => {
      resize();
      stepBalls(balls, 0, width, height);
      draw();
    };
    window.addEventListener("resize", onResize);

    if (reduced) {
      draw();
      return () => window.removeEventListener("resize", onResize);
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

    const onPointerDown = (e: PointerEvent) => {
      if (isInteractiveTarget(e.target as Element | null)) return;
      flickAt(balls, e.clientX, e.clientY);
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pointerdown", onPointerDown, { passive: true });

    if (typeof window.requestIdleCallback === "function") {
      idleHandle = window.requestIdleCallback(start);
    } else {
      startTimer = window.setTimeout(start, 200);
    }
    draw();

    return () => {
      if (raf) cancelAnimationFrame(raf);
      if (idleHandle !== undefined) window.cancelIdleCallback(idleHandle);
      if (startTimer !== undefined) window.clearTimeout(startTimer);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [hidden]);

  if (hidden) return null;
  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10"
    />
  );
}
