import { useEffect, useRef, useState } from 'react';

const FLAT_QUERY = '(max-width: 900px), (prefers-reduced-motion: reduce)';

/**
 * Subtle mouse-follow tilt for the auth 3D scene (login + signup).
 * Disabled on small screens and reduced-motion.
 */
export default function useAuthSceneTilt() {
  const stageRef = useRef(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return undefined;

    const mq = window.matchMedia(FLAT_QUERY);

    function onMove(e) {
      if (mq.matches) return;
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      setTilt({ x: py * -5, y: px * 7 });
    }

    function onLeave() {
      setTilt({ x: 0, y: 0 });
    }

    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    return () => {
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  const stackStyle = {
    '--tilt-x': `${tilt.x}deg`,
    '--tilt-y': `${tilt.y}deg`,
  };
  const copyStyle = {
    '--copy-tilt-x': `${tilt.x * 0.35}deg`,
    '--copy-tilt-y': `${tilt.y * 0.35}deg`,
  };

  return { stageRef, stackStyle, copyStyle };
}
