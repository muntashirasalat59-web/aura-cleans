import { AURA } from '../config/auraBrand';

const LOGO_SRC = '/logo.png';

/** Native pixel size of public/logo.png — keep in sync if the asset is replaced. */
export const LOGO_NATURAL = { width: 612, height: 408 };
const LOGO_ASPECT = LOGO_NATURAL.width / LOGO_NATURAL.height;

/**
 * Display sizes (CSS px, height-led). All are below native resolution — no upscaling.
 * @type {Record<string, { height: number, maxWidth: number, smHeight?: number }>}
 */
const VARIANTS = {
  sidebar: { height: 36, maxWidth: 168 },
  header: { height: 32, maxWidth: 140 },
  login: { height: 48, maxWidth: 180 },
  'login-hero': { height: 64, maxWidth: 200, smHeight: 72 },
  /** Invoice letterhead — ~56px keeps logo sharp vs 612×408 source */
  invoice: { height: 56, maxWidth: 280 },
};

function displayWidth(heightPx) {
  return Math.min(Math.round(heightPx * LOGO_ASPECT), LOGO_NATURAL.width);
}

/**
 * Aura Clean logo — sidebar, headers, invoice preview, login.
 * @param {'sidebar'|'header'|'login'|'login-hero'|'invoice'} variant
 */
export default function AuraBrandLogo({ variant = 'sidebar', className = '' }) {
  const cfg = VARIANTS[variant] || VARIANTS.sidebar;

  const style = {
    height: `${cfg.height}px`,
    maxHeight: `${cfg.height}px`,
    width: 'auto',
    maxWidth: `${cfg.maxWidth}px`,
  };

  return (
    <div className={`flex items-center gap-2.5 min-w-0 ${className}`}>
      <img
        src={LOGO_SRC}
        alt={AURA.name}
        width={displayWidth(cfg.height)}
        height={cfg.height}
        className={`brand-logo brand-logo--${variant}`}
        style={style}
        decoding="async"
        fetchPriority={variant === 'login-hero' ? 'high' : undefined}
      />
      {variant === 'sidebar' && (
        <p className="hidden sm:block text-[11px] text-emerald-400/90 truncate leading-tight">{AURA.tagline}</p>
      )}
    </div>
  );
}

export { LOGO_SRC };
