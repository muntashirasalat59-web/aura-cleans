import { useEffect, useRef } from 'react';

const BLUE = { r: 37, g: 99, b: 235 };
const PURPLE = { r: 124, g: 58, b: 237 };
const LINK_DIST = 140;
const LINK_DIST_SQ = LINK_DIST * LINK_DIST;
const SPARK_DIST = 52;
const SPARK_DIST_SQ = SPARK_DIST * SPARK_DIST;
const SPARK_MS = 420;
const SPARK_CHANCE = 0.26;
const SPARK_MAX = 2;
const SPARK_GAP_MS = 640;

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
      sparkStart: 0,
      cooldownUntil: 0,
    });
  }
  return list;
}

function rgba(color, alpha) {
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
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
    const closePairs = new Set();
    let lastSparkAt = 0;

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
        closePairs.clear();
        lastSparkAt = 0;
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
      let sparking = 0;
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
        if (p.sparkStart && now - p.sparkStart >= SPARK_MS) {
          p.sparkStart = 0;
        }
        if (p.sparkStart) sparking += 1;
      }

      ctx.lineWidth = 0.7;
      for (let i = 0; i < n; i += 1) {
        const a = particles[i];
        for (let j = i + 1; j < n; j += 1) {
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const distSq = dx * dx + dy * dy;
          if (distSq > LINK_DIST_SQ) {
            closePairs.delete(`${i}:${j}`);
            continue;
          }
          const dist = Math.sqrt(distSq);
          const alpha = (1 - dist / LINK_DIST) * 0.32;
          ctx.strokeStyle = `rgba(96, 165, 250, ${alpha})`;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();

          const pairKey = `${i}:${j}`;
          if (distSq <= SPARK_DIST_SQ) {
            if (!closePairs.has(pairKey)) {
              closePairs.add(pairKey);
              const canSpark =
                sparking < SPARK_MAX &&
                now - lastSparkAt > SPARK_GAP_MS &&
                a.cooldownUntil < now &&
                b.cooldownUntil < now &&
                Math.random() < SPARK_CHANCE;
              if (canSpark) {
                const target = Math.random() < 0.5 ? a : b;
                target.sparkStart = now;
                const rest = 2400 + Math.random() * 2200;
                a.cooldownUntil = now + rest;
                b.cooldownUntil = now + rest * 0.7;
                lastSparkAt = now;
                sparking += 1;
              }
            }
          } else {
            closePairs.delete(pairKey);
          }
        }
      }

      for (let i = 0; i < n; i += 1) {
        const p = particles[i];
        let pulse = 0;
        if (p.sparkStart) {
          const t = (now - p.sparkStart) / SPARK_MS;
          pulse = Math.sin(Math.min(t, 1) * Math.PI);
        }
        const radius = p.r * (1 + pulse * 1.7);
        const glowR = radius * (5.5 + pulse * 3.2);
        const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowR);
        glow.addColorStop(0, rgba(p.color, 0.55 + pulse * 0.4));
        glow.addColorStop(0.4, rgba(p.color, 0.16 + pulse * 0.22));
        glow.addColorStop(1, rgba(p.color, 0));
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(p.x, p.y, glowR, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = rgba(p.color, 0.95);
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fill();

        if (pulse > 0.35) {
          ctx.fillStyle = `rgba(248, 250, 252, ${0.18 + pulse * 0.35})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, radius * 0.45, 0, Math.PI * 2);
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
