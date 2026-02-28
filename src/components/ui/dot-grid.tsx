"use client";

import { useRef, useEffect, useCallback, useMemo } from "react";
import { useTheme } from "next-themes";

// ─── helpers ────────────────────────────────────────────────────────────────

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!m) return { r: 0, g: 0, b: 0 };
  return {
    r: parseInt(m[1], 16),
    g: parseInt(m[2], 16),
    b: parseInt(m[3], 16),
  };
}

function throttle<T extends (...args: Parameters<T>) => void>(
  func: T,
  limit: number,
): T {
  let lastCall = 0;
  return function (this: unknown, ...args: Parameters<T>) {
    const now = performance.now();
    if (now - lastCall >= limit) {
      lastCall = now;
      func.apply(this, args);
    }
  } as T;
}

// ─── Spring physics ──────────────────────────────────────────────────────────
//
// Each dot is a simple damped harmonic oscillator:
//   a = -stiffness * displacement - damping * velocity
//
// We integrate with a fixed timestep (dt = 16 ms) so the simulation is
// frame-rate independent and requires no external animation library.

const SPRING_STIFFNESS = 180; // "spring constant" — how quickly it snaps back
const SPRING_DAMPING = 22; // friction — prevents ringing
const FIXED_DT = 0.016; // seconds per integration step (≈ 60 fps)
const REST_THRESHOLD = 0.01; // px — treat as at-rest below this magnitude

// ─── types ───────────────────────────────────────────────────────────────────

interface Dot {
  /** Grid centre (never changes after build) */
  cx: number;
  cy: number;
  /** Current displacement from centre */
  xOffset: number;
  yOffset: number;
  /** Current velocity (px / s) */
  vx: number;
  vy: number;
  /** True while the spring is still moving */
  active: boolean;
}

interface PointerState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  speed: number;
  lastTime: number;
  lastX: number;
  lastY: number;
}

export interface DotGridProps {
  dotSize?: number;
  gap?: number;
  /** Base (idle) dot colour — overridden by theme when useThemeColors is true */
  baseColor?: string;
  /** Active (hover) dot colour — overridden by theme when useThemeColors is true */
  activeColor?: string;
  /** When true the component reads the current next-themes theme and picks
   *  sensible defaults for light/dark automatically. */
  useThemeColors?: boolean;
  proximity?: number;
  speedTrigger?: number;
  shockRadius?: number;
  shockStrength?: number;
  maxSpeed?: number;
  /** Not used for physics any more, kept for API compatibility */
  resistance?: number;
  returnDuration?: number;
  className?: string;
  style?: React.CSSProperties;
}

// ─── component ───────────────────────────────────────────────────────────────

export function DotGrid({
  dotSize = 16,
  gap = 32,
  baseColor,
  activeColor,
  useThemeColors = true,
  proximity = 150,
  speedTrigger = 100,
  shockRadius = 250,
  shockStrength = 5,
  maxSpeed = 5000,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  resistance: _resistance = 750,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  returnDuration: _returnDuration = 1.5,
  className = "",
  style,
}: DotGridProps) {
  const { resolvedTheme } = useTheme();

  // Resolve colours based on theme when useThemeColors is set
  const resolvedBase = useMemo(() => {
    if (!useThemeColors) return baseColor ?? "#5227FF";
    return resolvedTheme === "dark" ? "#3b3b3b" : "#d4d4d8";
  }, [useThemeColors, baseColor, resolvedTheme]);

  const resolvedActive = useMemo(() => {
    if (!useThemeColors) return activeColor ?? "#5227FF";
    return resolvedTheme === "dark" ? "#a1a1aa" : "#71717a";
  }, [useThemeColors, activeColor, resolvedTheme]);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dotsRef = useRef<Dot[]>([]);
  const pointerRef = useRef<PointerState>({
    x: -9999,
    y: -9999,
    vx: 0,
    vy: 0,
    speed: 0,
    lastTime: 0,
    lastX: 0,
    lastY: 0,
  });

  const baseRgb = useMemo(() => hexToRgb(resolvedBase), [resolvedBase]);
  const activeRgb = useMemo(() => hexToRgb(resolvedActive), [resolvedActive]);

  const circlePath = useMemo(() => {
    if (typeof window === "undefined" || !window.Path2D) return null;
    const p = new window.Path2D();
    p.arc(0, 0, dotSize / 2, 0, Math.PI * 2);
    return p;
  }, [dotSize]);

  // ── Build grid ────────────────────────────────────────────────────────────

  const buildGrid = useCallback(() => {
    const wrap = wrapperRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const { width, height } = wrap.getBoundingClientRect();
    if (width === 0 || height === 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    if (ctx) ctx.scale(dpr, dpr);

    const cell = dotSize + gap;
    const cols = Math.floor((width + gap) / cell);
    const rows = Math.floor((height + gap) / cell);

    const gridW = cell * cols - gap;
    const gridH = cell * rows - gap;

    const startX = (width - gridW) / 2 + dotSize / 2;
    const startY = (height - gridH) / 2 + dotSize / 2;

    const dots: Dot[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        dots.push({
          cx: startX + c * cell,
          cy: startY + r * cell,
          xOffset: 0,
          yOffset: 0,
          vx: 0,
          vy: 0,
          active: false,
        });
      }
    }
    dotsRef.current = dots;
  }, [dotSize, gap]);

  // ── Spring integration ────────────────────────────────────────────────────
  //
  // Called once per animation frame for every "active" dot.
  // Returns true if the dot is still in motion after the step.

  const stepSpring = useCallback((dot: Dot): boolean => {
    // F = -k*x - c*v  (Hooke's law + damping)
    const ax = -SPRING_STIFFNESS * dot.xOffset - SPRING_DAMPING * dot.vx;
    const ay = -SPRING_STIFFNESS * dot.yOffset - SPRING_DAMPING * dot.vy;

    dot.vx += ax * FIXED_DT;
    dot.vy += ay * FIXED_DT;
    dot.xOffset += dot.vx * FIXED_DT;
    dot.yOffset += dot.vy * FIXED_DT;

    const moving =
      Math.abs(dot.xOffset) > REST_THRESHOLD ||
      Math.abs(dot.yOffset) > REST_THRESHOLD ||
      Math.abs(dot.vx) > REST_THRESHOLD ||
      Math.abs(dot.vy) > REST_THRESHOLD;

    if (!moving) {
      dot.xOffset = 0;
      dot.yOffset = 0;
      dot.vx = 0;
      dot.vy = 0;
    }
    return moving;
  }, []);

  // ── Draw + physics loop ───────────────────────────────────────────────────

  useEffect(() => {
    if (!circlePath) return;

    let rafId: number;
    const proxSq = proximity * proximity;

    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const { x: px, y: py } = pointerRef.current;

      for (const dot of dotsRef.current) {
        // Advance spring physics for active dots
        if (dot.active) {
          dot.active = stepSpring(dot);
        }

        const ox = dot.cx + dot.xOffset;
        const oy = dot.cy + dot.yOffset;
        const dx = dot.cx - px;
        const dy = dot.cy - py;
        const dsq = dx * dx + dy * dy;

        let fillStyle: string;
        if (dsq <= proxSq) {
          const dist = Math.sqrt(dsq);
          const t = 1 - dist / proximity;
          const r = Math.round(baseRgb.r + (activeRgb.r - baseRgb.r) * t);
          const g = Math.round(baseRgb.g + (activeRgb.g - baseRgb.g) * t);
          const b = Math.round(baseRgb.b + (activeRgb.b - baseRgb.b) * t);
          fillStyle = `rgb(${r},${g},${b})`;
        } else {
          fillStyle = resolvedBase;
        }

        ctx.save();
        ctx.translate(ox, oy);
        ctx.fillStyle = fillStyle;
        ctx.fill(circlePath);
        ctx.restore();
      }

      rafId = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(rafId);
  }, [proximity, resolvedBase, baseRgb, activeRgb, circlePath, stepSpring]);

  // ── Grid build + resize ───────────────────────────────────────────────────

  useEffect(() => {
    buildGrid();

    let ro: ResizeObserver | null = null;
    const wrap = wrapperRef.current;

    if ("ResizeObserver" in window && wrap) {
      ro = new ResizeObserver(buildGrid);
      ro.observe(wrap);
    } else {
      window.addEventListener("resize", buildGrid);
    }

    return () => {
      if (ro) ro.disconnect();
      else window.removeEventListener("resize", buildGrid);
    };
  }, [buildGrid]);

  // ── Pointer + click interactions ─────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Kick a dot: give it an initial velocity/displacement derived from the
    // pointer's velocity vector, then let the spring bring it back.
    const kickDot = (
      dot: Dot,
      pushX: number,
      pushY: number,
      impulseScale: number,
    ) => {
      // Clamp push magnitude to avoid extreme displacements
      const mag = Math.hypot(pushX, pushY);
      const maxPush = 60;
      const scale =
        mag > maxPush ? (maxPush / mag) * impulseScale : impulseScale;

      dot.xOffset += pushX * scale;
      dot.yOffset += pushY * scale;
      // Give it the pointer's velocity as initial spring velocity (dampened)
      dot.vx = pushX * scale * 4;
      dot.vy = pushY * scale * 4;
      dot.active = true;
    };

    const onMove = (e: MouseEvent) => {
      const now = performance.now();
      const pr = pointerRef.current;
      const dt = pr.lastTime ? now - pr.lastTime : 16;
      const dx = e.clientX - pr.lastX;
      const dy = e.clientY - pr.lastY;

      let vx = (dx / dt) * 1000;
      let vy = (dy / dt) * 1000;
      let speed = Math.hypot(vx, vy);

      if (speed > maxSpeed) {
        const s = maxSpeed / speed;
        vx *= s;
        vy *= s;
        speed = maxSpeed;
      }

      pr.lastTime = now;
      pr.lastX = e.clientX;
      pr.lastY = e.clientY;
      pr.vx = vx;
      pr.vy = vy;
      pr.speed = speed;

      const rect = canvas.getBoundingClientRect();
      pr.x = e.clientX - rect.left;
      pr.y = e.clientY - rect.top;

      if (speed <= speedTrigger) return;

      for (const dot of dotsRef.current) {
        const dist = Math.hypot(dot.cx - pr.x, dot.cy - pr.y);
        if (dist < proximity && !dot.active) {
          // Direction from pointer to dot + a small velocity nudge
          const nx = (dot.cx - pr.x) / (dist || 1);
          const ny = (dot.cy - pr.y) / (dist || 1);
          const pushX = nx + vx * 0.0004;
          const pushY = ny + vy * 0.0004;
          kickDot(dot, pushX, pushY, 0.4);
        }
      }
    };

    const onClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;

      for (const dot of dotsRef.current) {
        const dist = Math.hypot(dot.cx - cx, dot.cy - cy);
        if (dist < shockRadius) {
          const falloff = Math.max(0, 1 - dist / shockRadius);
          // Direction: radially away from click point
          const pushX = (dot.cx - cx) * shockStrength * falloff * 0.012;
          const pushY = (dot.cy - cy) * shockStrength * falloff * 0.012;
          kickDot(dot, pushX, pushY, 1);
        }
      }
    };

    const throttledMove = throttle(onMove, 50);

    window.addEventListener("mousemove", throttledMove, { passive: true });
    window.addEventListener("click", onClick);

    return () => {
      window.removeEventListener("mousemove", throttledMove);
      window.removeEventListener("click", onClick);
    };
  }, [maxSpeed, speedTrigger, proximity, shockRadius, shockStrength]);

  return (
    <div
      className={`dot-grid-root ${className}`}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        overflow: "hidden",
        ...style,
      }}
    >
      <div
        ref={wrapperRef}
        style={{ position: "relative", width: "100%", height: "100%" }}
      >
        <canvas
          ref={canvasRef}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
          }}
        />
      </div>
    </div>
  );
}
