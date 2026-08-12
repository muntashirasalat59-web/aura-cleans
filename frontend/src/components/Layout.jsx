import { useEffect, useMemo, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  Building2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Package,
  PanelLeftClose,
  PanelLeft,
  Search,
  Settings,
  ShoppingBag,
  Sun,
  TrendingUp,
  UserCircle,
  Users,
  Wallet,
  X,
  Zap,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { erpNavForRole, PAGE_TITLES } from '../config/erpNav';
import { roleLabel } from '../config/permissions';
import { AURA } from '../config/auraBrand';
import AuraBrandLogo from './AuraBrandLogo';
import GlobalSearch from './erp/GlobalSearch';
import HeaderLiveClock from './erp/HeaderLiveClock';
import { useLiveWeather } from '../hooks/useLiveWeather';
import { LiveWeatherProvider } from '../context/LiveWeatherContext';

const QUICK_ACTIONS = [
  { label: 'New invoice', path: '/sales' },
  { label: 'New purchase', path: '/purchases' },
  { label: 'Add product', path: '/products' },
  { label: 'Add party', path: '/parties' },
];

/** Presentation-only icons for existing nav paths (no nav data changes). */
const NAV_ICONS = {
  '/': LayoutDashboard,
  '/products': Package,
  '/parties': Users,
  '/purchases': ShoppingBag,
  '/sales': TrendingUp,
  '/expenses': Wallet,
  '/reports': ClipboardList,
  '/employees': Users,
  '/users': UserCircle,
  '/activity-log': Activity,
  '/settings/business': Settings,
};

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, role, signOut } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [companyOpen, setCompanyOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [companyId, setCompanyId] = useState(AURA.companies[0].id);
  const [collapsed, setCollapsed] = useState({});
  const [railCollapsed, setRailCollapsed] = useState(() => {
    try {
      return localStorage.getItem('aura-sidebar-rail') === '1';
    } catch {
      return false;
    }
  });

  function toggleRailCollapsed() {
    setRailCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('aura-sidebar-rail', next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  const sections = erpNavForRole(role);
  const currentTitle = PAGE_TITLES[location.pathname] || 'AURA CLEAN';
  const company = AURA.companies.find((c) => c.id === companyId) || AURA.companies[0];
  const {
    weather: liveWeather,
    loading: weatherLoading,
    error: weatherError,
  } = useLiveWeather(company.lat, company.lon, company.city);
  const liveWeatherValue = useMemo(
    () => ({
      weather: liveWeather,
      loading: weatherLoading,
      error: weatherError,
      city: company.city,
      lat: company.lat,
      lon: company.lon,
    }),
    [liveWeather, weatherLoading, weatherError, company.city, company.lat, company.lon]
  );

  const trialDaysLeft = profile?.trial_ends_at
    ? Math.ceil((new Date(profile.trial_ends_at) - new Date()) / (1000 * 60 * 60 * 24))
    : null;
  const isOnTrial = profile?.payment_status !== 'paid' && trialDaysLeft !== null;

  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const activeSectionId = useMemo(() => {
    for (const section of sections) {
      if (section.items.some((item) => item.path === location.pathname)) return section.id;
    }
    return null;
  }, [location.pathname, sections]);

  function toggleSection(id) {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function closeSidebar() {
    setSidebarOpen(false);
  }

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    setUserMenuOpen(false);
    setSidebarOpen(false);
    try {
      await signOut();
      navigate('/login', { replace: true });
    } finally {
      setLoggingOut(false);
    }
  }

  function isActive(path) {
    if (path === '/') return location.pathname === '/';
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  }

  return (
    <LiveWeatherProvider value={liveWeatherValue}>
    <div className="app-shell min-h-screen bg-aura-bg transition-colors duration-200">
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />

      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-[color-mix(in_srgb,var(--aura-shell-sidebar-from)_70%,transparent)] backdrop-blur-sm lg:hidden"
          onClick={closeSidebar}
        />
      )}

      <aside
        className={`app-shell-sidebar no-print fixed inset-y-0 left-0 z-50 flex w-72 flex-col transition-[width,transform] duration-200 ease-out lg:translate-x-0 ${
          railCollapsed ? 'lg:w-[72px]' : 'lg:w-72'
        } ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex h-[72px] items-center justify-between border-b border-[color:var(--aura-shell-sidebar-border)] px-3 lg:hidden">
          <AuraBrandLogo variant="sidebar" className="min-w-0 flex-1" />
          <button
            type="button"
            className="btn-icon text-[color:var(--aura-shell-sidebar-nav)] hover:bg-white/10 hover:text-white"
            onClick={closeSidebar}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div
          className={`hidden border-b border-[color:var(--aura-shell-sidebar-border)] lg:flex lg:items-center ${
            railCollapsed ? 'justify-center px-2 py-4' : 'justify-between gap-2 px-4 py-5'
          }`}
        >
          {!railCollapsed && <AuraBrandLogo variant="sidebar" className="min-w-0 flex-1" />}
          <button
            type="button"
            onClick={toggleRailCollapsed}
            className="btn-icon shrink-0 text-[color:var(--aura-shell-sidebar-nav)] hover:bg-white/10 hover:text-white"
            aria-label={railCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={railCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {railCollapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>

        <nav className={`flex-1 space-y-4 overflow-y-auto p-3 ${railCollapsed ? 'lg:space-y-2 lg:px-1.5 lg:py-2' : ''}`}>
          {sections.map((section) => {
            const isOpen =
              railCollapsed ||
              collapsed[section.id] === false ||
              activeSectionId === section.id ||
              collapsed[section.id] === undefined;
            return (
              <div key={section.id}>
                <button
                  type="button"
                  onClick={() => toggleSection(section.id)}
                  className={`app-nav-section-label flex w-full items-center justify-between px-2 py-2 hover:text-[color:var(--aura-shell-sidebar-nav-hover)] ${
                    railCollapsed ? 'lg:hidden' : ''
                  }`}
                >
                  {section.label}
                  {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                </button>
                {isOpen && (
                  <ul className={`mt-1 space-y-1 ${railCollapsed ? 'lg:mt-0' : ''}`}>
                    {section.items.map((item) => {
                      const active = isActive(item.path);
                      const Icon = NAV_ICONS[item.path] || LayoutDashboard;
                      return (
                        <li key={item.path} className="relative">
                          <Link
                            to={item.path}
                            onClick={closeSidebar}
                            title={railCollapsed ? item.label : undefined}
                            className={`app-nav-link group relative flex items-center gap-2.5 rounded-[var(--aura-radius-button)] px-3 py-2 font-medium transition-all duration-200 ${
                              railCollapsed ? 'lg:justify-center lg:gap-0 lg:px-2 lg:py-2.5' : ''
                            } ${
                              active
                                ? 'bg-[color:var(--aura-shell-sidebar-active)] text-white shadow-soft'
                                : 'text-[color:var(--aura-shell-sidebar-nav)] hover:bg-white/5 hover:text-[color:var(--aura-shell-sidebar-nav-hover)]'
                            }`}
                          >
                            <span
                              className={`absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full transition-opacity duration-200 ${
                                active
                                  ? 'bg-white opacity-100'
                                  : 'bg-[color:var(--aura-shell-sidebar-active)] opacity-0 group-hover:opacity-40'
                              }`}
                              aria-hidden
                            />
                            <Icon className={`h-3.5 w-3.5 shrink-0 ${active ? 'text-white' : ''}`} />
                            <span className={`truncate ${railCollapsed ? 'lg:hidden' : ''}`}>{item.label}</span>
                            {railCollapsed && (
                              <span
                                role="tooltip"
                                className="pointer-events-none absolute left-full top-1/2 z-[60] ml-2 hidden -translate-y-1/2 whitespace-nowrap rounded-md border border-[color:var(--aura-shell-sidebar-border)] bg-[color:var(--aura-shell-sidebar-to)] px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-floating transition-opacity duration-150 lg:block lg:group-hover:opacity-100"
                              >
                                {item.label}
                              </span>
                            )}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </nav>

        <div className={`space-y-3 border-t border-[color:var(--aura-shell-sidebar-border)] p-4 ${railCollapsed ? 'lg:p-2' : ''}`}>
          {isOnTrial && (
            <div
              className={`rounded-[var(--aura-radius-button)] px-4 py-3 text-[length:var(--aura-type-body)] font-medium ${
                railCollapsed ? 'lg:hidden' : ''
              } ${
                trialDaysLeft > 0
                  ? 'bg-[color-mix(in_srgb,var(--aura-warning)_18%,transparent)] text-[color:var(--aura-warning)]'
                  : 'bg-[color-mix(in_srgb,var(--aura-danger)_18%,transparent)] text-[color:var(--aura-danger)]'
              }`}
            >
              {trialDaysLeft > 0
                ? `Trial: ${trialDaysLeft} day${trialDaysLeft === 1 ? '' : 's'} left`
                : 'Trial expired'}
            </div>
          )}
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            title={railCollapsed ? (loggingOut ? 'Signing out…' : 'Sign out') : undefined}
            className={`sidebar-logout-btn group relative flex w-full items-center justify-center gap-2 rounded-full bg-[color:var(--aura-shell-logout-bg)] px-4 py-3 text-[length:var(--aura-type-body)] font-semibold text-[color:var(--aura-shell-logout-text)] shadow-soft transition-transform duration-200 hover:scale-[1.02] disabled:opacity-50 ${
              railCollapsed ? 'lg:px-2 lg:py-2.5' : ''
            }`}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span className={railCollapsed ? 'lg:hidden' : ''}>
              {loggingOut ? 'Signing out…' : 'Sign out'}
            </span>
            {railCollapsed && (
              <span
                role="tooltip"
                className="pointer-events-none absolute left-full top-1/2 z-[60] ml-2 hidden -translate-y-1/2 whitespace-nowrap rounded-md border border-[color:var(--aura-shell-sidebar-border)] bg-[color:var(--aura-shell-sidebar-to)] px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-floating transition-opacity duration-150 lg:block lg:group-hover:opacity-100"
              >
                {loggingOut ? 'Signing out…' : 'Sign out'}
              </span>
            )}
          </button>
        </div>
      </aside>

      <div className={`transition-[padding] duration-200 ease-out ${railCollapsed ? 'lg:pl-[72px]' : 'lg:pl-72'}`}>
        <header className="app-header no-print sticky top-0 z-30 flex h-14 min-h-14 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-aura-border bg-aura-card/90 px-4 shadow-soft backdrop-blur-[12px] sm:px-6 lg:h-[64px] lg:min-h-[64px] lg:flex-nowrap transition-colors duration-200">
          <div className="app-header-left flex max-w-[min(100%,220px)] min-w-0 shrink-0 items-center gap-3 xl:max-w-[280px]">
            <button type="button" className="btn-icon shrink-0 lg:hidden" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <p className="truncate text-[10px] font-medium uppercase tracking-wider text-aura-muted">
                {company.name}
              </p>
              <h2 className="truncate text-[15px] font-semibold tracking-tight text-aura-text">
                {currentTitle}
              </h2>
            </div>
          </div>

          <div className="app-header-center hidden min-w-0 flex-1 md:flex md:justify-center lg:max-w-sm xl:max-w-md">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="app-header-search flex w-full min-w-0 max-w-[320px] items-center gap-2 rounded-[var(--aura-radius-input)] border border-aura-border bg-aura-bg px-3 py-2.5 text-[length:var(--aura-type-body)] text-aura-muted transition-colors duration-200 hover:border-aura-primary"
            >
              <Search className="h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate text-left">Search…</span>
              <kbd className="hidden shrink-0 rounded-[var(--aura-radius-dropdown)] border border-aura-border bg-aura-card px-2 py-1 text-[length:var(--aura-type-caption)] text-aura-muted xl:inline">
                ⌘K
              </kbd>
            </button>
          </div>

          <div className="app-header-right ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2">
            <div className="hidden shrink-0 md:block">
              <HeaderLiveClock />
            </div>

            <div className="relative hidden shrink-0 lg:block">
              <button
                type="button"
                className="inline-flex h-11 max-w-[200px] items-center gap-2 rounded-[var(--aura-radius-button)] bg-[color:var(--aura-shell-quick-add)] px-3 text-[length:var(--aura-type-body)] font-semibold text-white shadow-soft transition-all duration-200 hover:scale-[1.02] hover:bg-[color:var(--aura-shell-quick-add-hover)]"
                onClick={() => setCompanyOpen((o) => !o)}
              >
                <Building2 className="h-4 w-4 shrink-0" />
                <span className="truncate">{company.city}</span>
                {!weatherLoading && liveWeather && (
                  <span className="hidden shrink-0 text-[length:var(--aura-type-caption)] font-semibold tabular-nums text-white/90 xl:inline">
                    {liveWeather.temp}°C
                  </span>
                )}
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-white/80" />
              </button>
              {companyOpen && (
                <>
                  <button type="button" className="fixed inset-0 z-40" aria-label="Close company menu" onClick={() => setCompanyOpen(false)} />
                  <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-[var(--aura-radius-dropdown)] border border-aura-border bg-aura-card py-1 shadow-floating">
                    {AURA.companies.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setCompanyId(c.id);
                          setCompanyOpen(false);
                        }}
                        className={`w-full px-4 py-2 text-left text-[length:var(--aura-type-body)] text-aura-text hover:bg-aura-bg ${c.id === companyId ? 'font-semibold text-aura-primary' : ''}`}
                      >
                        {c.name}
                        <span className="block text-[length:var(--aura-type-caption)] text-aura-muted">{c.city}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="relative shrink-0">
              <button
                type="button"
                className="inline-flex h-11 items-center gap-2 rounded-[var(--aura-radius-button)] bg-[color:var(--aura-shell-quick-add)] px-4 text-[length:var(--aura-type-body)] font-semibold text-white shadow-soft transition-all duration-200 hover:scale-[1.02] hover:bg-[color:var(--aura-shell-quick-add-hover)] sm:inline-flex"
                onClick={() => setQuickOpen((o) => !o)}
              >
                <Zap className="h-4 w-4" />
                <span className="hidden lg:inline">Quick Add</span>
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              {quickOpen && (
                <>
                  <button type="button" className="fixed inset-0 z-40" aria-label="Close quick actions" onClick={() => setQuickOpen(false)} />
                  <div className="absolute right-0 top-full z-50 mt-2 w-48 rounded-[var(--aura-radius-dropdown)] border border-aura-border bg-aura-card py-1 shadow-floating">
                    {QUICK_ACTIONS.map((a) => (
                      <Link
                        key={a.path}
                        to={a.path}
                        onClick={() => setQuickOpen(false)}
                        className="block px-4 py-2 text-[length:var(--aura-type-body)] text-aura-text hover:bg-aura-bg"
                      >
                        {a.label}
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={toggleTheme}
              className="header-icon-btn flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--aura-radius-button)] bg-[color:var(--aura-shell-quick-add)] text-white shadow-soft transition-all duration-200 hover:scale-[1.02] hover:bg-[color:var(--aura-shell-quick-add-hover)]"
              aria-label="Toggle theme"
            >
              {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>

            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setUserMenuOpen((open) => !open)}
                className="flex h-11 items-center gap-2 rounded-[var(--aura-radius-button)] border border-transparent bg-[color:var(--aura-shell-quick-add)] py-1 pl-1 pr-2 text-white shadow-soft transition-all duration-200 hover:scale-[1.02] hover:bg-[color:var(--aura-shell-quick-add-hover)] xl:pr-3"
                aria-expanded={userMenuOpen}
                aria-haspopup="menu"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-white/20 text-white">
                  <UserCircle className="h-5 w-5" />
                </div>
                <div className="hidden max-w-[120px] text-left xl:block">
                  <p className="truncate text-[length:var(--aura-type-caption)] font-bold leading-tight text-white">
                    {profile?.full_name}
                  </p>
                  <p className="truncate text-[length:var(--aura-type-caption)] capitalize text-white/80">
                    {roleLabel(role)}
                  </p>
                </div>
                <ChevronDown className="hidden h-3.5 w-3.5 text-white/80 xl:block" />
              </button>
              {userMenuOpen && (
                <>
                  <button
                    type="button"
                    className="fixed inset-0 z-40"
                    aria-label="Close account menu"
                    onClick={() => setUserMenuOpen(false)}
                  />
                  <div
                    role="menu"
                    className="absolute right-0 top-full z-50 mt-2 w-56 rounded-[var(--aura-radius-dropdown)] border border-aura-border bg-aura-card py-1 shadow-floating"
                  >
                    <div className="border-b border-aura-border px-4 py-3">
                      <p className="truncate text-[length:var(--aura-type-body)] font-semibold text-aura-text">
                        {profile?.full_name}
                      </p>
                      <p className="text-[length:var(--aura-type-caption)] capitalize text-aura-muted">
                        {roleLabel(role)}
                      </p>
                    </div>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleLogout}
                      disabled={loggingOut}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-[length:var(--aura-type-body)] text-aura-danger hover:bg-[color-mix(in_srgb,var(--aura-danger)_8%,transparent)] disabled:opacity-50"
                    >
                      <LogOut className="h-4 w-4 shrink-0" />
                      {loggingOut ? 'Signing out…' : 'Sign out'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1600px] px-5 py-5 transition-colors duration-200 sm:px-6 sm:py-6">
          <Outlet />
        </main>
      </div>
    </div>
    </LiveWeatherProvider>
  );
}