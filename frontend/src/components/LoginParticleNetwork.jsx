import { useEffect, useRef } from 'react';

const BLUE = { r: 37, g: 99, b: 235 };
const PURPLE = { r: 124, g: 58, b: 237 };
const LINK_DIST = 140;
const LINK_DIST_SQ = LINK_DIST * LINK_DIST;

/** ~3 blinks every 3s, never many at once — staggered + spatially spread. */
const BLINK_GAP_MS_MIN = 900;
const BLINK_GAP_MS_MAX = 1100;
const BLINK_DURATION_MIN = 420;
const BLINK_DURATION_MAX = 560;
const BLINK_SPREAD_PX = 180;
const BLINK_SPREAD_SQ = BLINK_SPREAD_PX * BLINK_SPREAD_PX;
const RECENT_BLINK_KEEP = 3;

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function particleCount() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 0;
  if (window.matchMedia('(max-width: 900px)').matches) return 22;
  return 52;
}

function spawn(count, width, height) {
  const list = [];
  for (let i = 0; i < count; i += 1) {
    const purple = Math.random() > 0.62;
    list.push({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.32,
      vy: (Math.random() - 0.5) * 0.32,
      r: 1.15 + Math.random() * 1.45,
      color: purple ? PURPLE : BLUE,
      blinkStart: 0,
      blinkMs: 0,
      blinkStrength: 0,
    });
  }
  return list;
}

function rgba(color, alpha) {
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
}

function pickBlinkTarget(particles, recent) {
  const n = particles.length;
  if (!n) return -1;

  const candidates = [];
  for (let i = 0; i < n; i += 1) {
    const p = particles[i];
    if (p.blinkStart) continue;

    let farEnough = true;
    for (let r = 0; r < recent.length; r += 1) {
      const spot = recent[r];
      const dx = p.x - spot.x;
      const dy = p.y - spot.y;
      if (dx * dx + dy * dy < BLINK_SPREAD_SQ) {
        farEnough = false;
        break;
      }
    }
    if (farEnough) candidates.push(i);
  }

  const pool = candidates.length ? candidates : particles.map((_, i) => i).filter((i) => !particles[i].blinkStart);
  if (!pool.length) return -1;
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Subtle particle-network canvas for the login background.
 * Vanilla 2D canvas + rAF — no external animation library.
 */
export default function LoginParticleNetwork() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return undefined;

    let rafId = 0;
    let particles = [];
    let width = 0;
    let height = 0;
    let dpr = 1;
    let running = true;
    let nextBlinkAt = 0;
    const recentBlinks = [];

    function resize() {
      const parent = canvas.parentElement;
      width = parent?.clientWidth || window.innerWidth;
      height = parent?.clientHeight || window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = particleCount();
      if (count === 0) {
        particles = [];
        ctx.clearRect(0, 0, width, height);
        return;
      }
      if (particles.length !== count) {
        particles = spawn(count, width, height);
        recentBlinks.length = 0;
        nextBlinkAt = performance.now() + rand(400, 900);
      } else {
        for (const p of particles) {
          p.x = Math.min(Math.max(p.x, 0), width);
          p.y = Math.min(Math.max(p.y, 0), height);
        }
      }
    }

    function tick() {
      if (!running) return;
      ctx.clearRect(0, 0, width, height);

      const n = particles.length;
      const now = performance.now();
      let activeBlinks = 0;

      for (let i = 0; i < n; i += 1) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        if (p.x <= 0 || p.x >= width) {
          p.vx *= -1;
          p.x = Math.min(Math.max(p.x, 0), width);
        }
        if (p.y <= 0 || p.y >= height) {
          p.vy *= -1;
          p.y = Math.min(Math.max(p.y, 0), height);
        }

        if (p.blinkStart) {
          if (now - p.blinkStart >= p.blinkMs) {
            p.blinkStart = 0;
          } else {
            activeBlinks += 1;
          }
        }
      }

      /* At most one bright flare at a time; ~3 spaced blinks every ~3s */
      if (activeBlinks === 0 && now >= nextBlinkAt && n > 0) {
        const idx = pickBlinkTarget(particles, recentBlinks);
        if (idx >= 0) {
          const p = particles[idx];
          p.blinkStart = now;
          p.blinkMs = rand(BLINK_DURATION_MIN, BLINK_DURATION_MAX);
          p.blinkStrength = rand(0.75, 1);
          recentBlinks.push({ x: p.x, y: p.y });
          if (recentBlinks.length > RECENT_BLINK_KEEP) recentBlinks.shift();
          nextBlinkAt = now + p.blinkMs + rand(BLINK_GAP_MS_MIN, BLINK_GAP_MS_MAX);
        } else {
          nextBlinkAt = now + rand(BLINK_GAP_MS_MIN, BLINK_GAP_MS_MAX);
        }
      }

      ctx.lineWidth = 0.7;
      for (let i = 0; i < n; i += 1) {
        const a = particles[i];
        for (let j = i + 1; j < n; j += 1) {
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const distSq = dx * dx + dy * dy;
          if (distSq > LINK_DIST_SQ) continue;
          const dist = Math.sqrt(distSq);
          const alpha = (1 - dist / LINK_DIST) * 0.32;
          ctx.strokeStyle = `rgba(96, 165, 250, ${alpha})`;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      for (let i = 0; i < n; i += 1) {
        const p = particles[i];
        let pulse = 0;
        if (p.blinkStart) {
          const t = Math.min((now - p.blinkStart) / p.blinkMs, 1);
          pulse = Math.sin(t * Math.PI) * p.blinkStrength;
        }
        const radius = p.r * (1 + pulse * 1.45);
        const glowR = radius * (5.5 + pulse * 2.8);
        const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowR);
        glow.addColorStop(0, rgba(p.color, 0.55 + pulse * 0.38));
        glow.addColorStop(0.4, rgba(p.color, 0.16 + pulse * 0.2));
        glow.addColorStop(1, rgba(p.color, 0));
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(p.x, p.y, glowR, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = rgba(p.color, 0.95);
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fill();

        if (pulse > 0.4) {
          ctx.fillStyle = `rgba(248, 250, 252, ${0.12 + pulse * 0.32})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, radius * 0.42, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      rafId = requestAnimationFrame(tick);
    }

    resize();
    if (particles.length > 0) {
      rafId = requestAnimationFrame(tick);
    }

    window.addEventListener('resize', resize);
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onMotion = () => resize();
    motion.addEventListener?.('change', onMotion);

    return () => {
      running = false;
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      motion.removeEventListener?.('change', onMotion);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="login-3d-particles"
      aria-hidden="true"
    />
  );
}
