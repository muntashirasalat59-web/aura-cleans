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
  /** Invoice letterhead — contained in a 200×100 slot; CSS scales the original file down */
  invoice: { height: 100, maxWidth: 200 },
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
  const invoice = variant === 'invoice';

  const style = invoice
    ? {
        width: 'auto',
        height: 'auto',
        maxWidth: `${cfg.maxWidth}px`,
        maxHeight: `${cfg.height}px`,
        objectFit: 'contain',
        objectPosition: 'left center',
      }
    : {
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
        width={invoice ? LOGO_NATURAL.width : displayWidth(cfg.height)}
        height={invoice ? LOGO_NATURAL.height : cfg.height}
        className={`brand-logo brand-logo--${variant}`}
        style={style}
        decoding="async"
        fetchPriority={variant === 'login-hero' ? 'high' : undefined}
      />
      {variant === 'sidebar' && (
        <p className="hidden truncate text-[length:var(--aura-type-caption)] leading-tight text-[color:var(--aura-shell-sidebar-nav)] sm:block">
          {AURA.tagline}
        </p>
      )}
    </div>
  );
}

export { LOGO_SRC };
