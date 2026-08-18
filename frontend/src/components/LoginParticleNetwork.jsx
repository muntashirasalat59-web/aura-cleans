import { useEffect, useRef } from 'react';

const BLUE = { r: 37, g: 99, b: 235 };
const PURPLE = { r: 124, g: 58, b: 237 };
const LINK_DIST = 155;
const LINK_DIST_SQ = LINK_DIST * LINK_DIST;

/** ~3 blinks every 3s, never many at once — staggered + spatially spread. */
const BLINK_GAP_MS_MIN = 900;
const BLINK_GAP_MS_MAX = 1100;
const BLINK_DURATION_MIN = 420;
const BLINK_DURATION_MAX = 560;
const BLINK_SPREAD_PX = 180;
const BLINK_SPREAD_SQ = BLINK_SPREAD_PX * BLINK_SPREAD_PX;
const RECENT_BLINK_KEEP = 3;

/** Wave flow field — makes every particle drift together instead of bouncing independently. */
const FLOW_STRENGTH = 0.34;
const FLOW_SCALE = 0.0032;
const FLOW_TIME_SPEED = 0.00028;

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function particleCount() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 0;
  if (window.matchMedia('(max-width: 900px)').matches) return 24;
  return 58;
}

function spawn(count, width, height) {
  const list = [];
  for (let i = 0; i < count; i += 1) {
    const purple = Math.random() > 0.62;
    list.push({
      x: Math.random() * width,
      y: Math.random() * height,
      /* small personal drift, layered under the shared wave field */
      vx: (Math.random() - 0.5) * 0.08,
      vy: (Math.random() - 0.5) * 0.08,
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

  const pool = candidates.length
    ? candidates
    : particles.map((_, i) => i).filter((i) => !particles[i].blinkStart);
  if (!pool.length) return -1;
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Subtle particle-network canvas for the login background.
 * Particles drift together in a shared wave flow field (not independent bouncing),
 * with occasional soft blink pulses and glowing connective links.
 * Pauses when the tab is hidden; cleans up rAF + listeners on unmount.
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
    let startTime = performance.now();
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

    function stopLoop() {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
    }

    function startLoop() {
      if (!running || document.hidden || !particles.length || rafId) return;
      rafId = requestAnimationFrame(tick);
    }

    function tick() {
      rafId = 0;
      if (!running || document.hidden) return;

      ctx.clearRect(0, 0, width, height);

      const n = particles.length;
      const now = performance.now();
      const t = (now - startTime) * FLOW_TIME_SPEED;
      let activeBlinks = 0;

      for (let i = 0; i < n; i += 1) {
        const p = particles[i];

        /* Shared wave flow field — every particle reads the same underlying
           current at its position, so motion looks coordinated instead of
           each dot wandering on its own. */
        const flowX = Math.sin(p.y * FLOW_SCALE + t) * FLOW_STRENGTH;
        const flowY = Math.cos(p.x * FLOW_SCALE + t * 1.15) * FLOW_STRENGTH;

        p.x += p.vx + flowX;
        p.y += p.vy + flowY;

        /* Wrap around edges instead of bouncing — keeps the wave flowing
           in one continuous direction rather than reflecting awkwardly. */
        const margin = 20;
        if (p.x < -margin) p.x = width + margin;
        if (p.x > width + margin) p.x = -margin;
        if (p.y < -margin) p.y = height + margin;
        if (p.y > height + margin) p.y = -margin;

        if (p.blinkStart) {
          if (now - p.blinkStart >= p.blinkMs) {
            p.blinkStart = 0;
          } else {
            activeBlinks += 1;
          }
        }
      }

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

      ctx.lineWidth = 0.85;
      for (let i = 0; i < n; i += 1) {
        const a = particles[i];
        for (let j = i + 1; j < n; j += 1) {
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const distSq = dx * dx + dy * dy;
          if (distSq > LINK_DIST_SQ) continue;
          const dist = Math.sqrt(distSq);
          const alpha = (1 - dist / LINK_DIST) * 0.4;
          const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
          grad.addColorStop(0, rgba(a.color, alpha));
          grad.addColorStop(1, rgba(b.color, alpha));
          ctx.strokeStyle = grad;
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
          const bt = Math.min((now - p.blinkStart) / p.blinkMs, 1);
          pulse = Math.sin(bt * Math.PI) * p.blinkStrength;
        }

        if (pulse > 0.05) {
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
        } else {
          /* Idle dots: soft glow ring + core — richer look without per-frame cost blowing up */
          ctx.fillStyle = rgba(p.color, 0.16);
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * 2.4, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = rgba(p.color, 0.78);
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      rafId = requestAnimationFrame(tick);
    }

    function onVisibility() {
      if (document.hidden) {
        stopLoop();
      } else {
        startLoop();
      }
    }

    resize();
    startLoop();

    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', onVisibility);
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onMotion = () => {
      resize();
      stopLoop();
      startLoop();
    };
    motion.addEventListener?.('change', onMotion);

    return () => {
      running = false;
      stopLoop();
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
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