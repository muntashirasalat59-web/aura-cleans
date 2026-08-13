import { useEffect, useRef } from 'react';

const FLAT_QUERY = '(max-width: 900px), (prefers-reduced-motion: reduce)';

/**
 * Subtle mouse-follow tilt for the auth 3D scene (login + signup).
 * Writes CSS vars on the DOM — no React state on every mousemove (avoids re-render storms).
 */
export default function useAuthSceneTilt() {
  const stageRef = useRef(null);
  const copyRef = useRef(null);
  const stackRef = useRef(null);
  const rafRef = useRef(0);
  const pendingRef = useRef(null);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return undefined;

    const mq = window.matchMedia(FLAT_QUERY);

    function applyTilt(x, y) {
      const copy = copyRef.current;
      const stack = stackRef.current;
      if (stack) {
        stack.style.setProperty('--tilt-x', `${x}deg`);
        stack.style.setProperty('--tilt-y', `${y}deg`);
      }
      if (copy) {
        copy.style.setProperty('--copy-tilt-x', `${x * 0.35}deg`);
        copy.style.setProperty('--copy-tilt-y', `${y * 0.35}deg`);
      }
    }

    function onMove(e) {
      if (mq.matches) return;
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      pendingRef.current = { x: py * -5, y: px * 7 };
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0;
        const next = pendingRef.current;
        if (next) applyTilt(next.x, next.y);
      });
    }

    function onLeave() {
      pendingRef.current = { x: 0, y: 0 };
      applyTilt(0, 0);
    }

    el.addEventListener('mousemove', onMove, { passive: true });
    el.addEventListener('mouseleave', onLeave);
    return () => {
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', onLeave);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return { stageRef, copyRef, stackRef };
}
