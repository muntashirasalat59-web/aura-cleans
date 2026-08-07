import { useEffect, useMemo, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Building2,
  ChevronDown,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Search,
  Sun,
  UserCircle,
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
    <div className="min-h-screen bg-[#F7F8FA] dark:bg-slate-950 transition-colors duration-200">
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />

      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm lg:hidden"
          onClick={closeSidebar}
        />
      )}

      <aside
        className={`no-print fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-sidebar dark:bg-slate-950 text-slate-200 border-r border-sidebar-border dark:border-slate-800 transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-5 lg:hidden">
          <AuraBrandLogo variant="sidebar" className="flex-1 min-w-0" />
          <button type="button" className="btn-icon text-slate-400 hover:text-white hover:bg-sidebar-hover" onClick={closeSidebar}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="hidden lg:block border-b border-sidebar-border px-5 py-5">
          <AuraBrandLogo variant="sidebar" />
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-4">
          {sections.map((section) => {
            const isOpen = collapsed[section.id] === false || activeSectionId === section.id || collapsed[section.id] === undefined;
            return (
              <div key={section.id}>
                <button
                  type="button"
                  onClick={() => toggleSection(section.id)}
                  className="app-nav-section-label flex w-full items-center justify-between px-2 py-1.5 hover:text-slate-200"
                >
                  {section.label}
                  {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                </button>
                {isOpen && (
                  <ul className="mt-1 space-y-1">
                    {section.items.map((item) => {
                      const active = isActive(item.path);
                      return (
                        <li key={item.path}>
                          <Link
                            to={item.path}
                            onClick={closeSidebar}
                            className={`app-nav-link flex items-center gap-3 rounded-xl px-3 py-2.5 font-medium transition-all ${
                              active
                                ? 'bg-sidebar-active text-white shadow-inner ring-1 ring-brand-500/40'
                                : 'text-slate-300 hover:bg-sidebar-hover hover:text-white'
                            }`}
                          >
                            <LayoutDashboard className={`h-4 w-4 shrink-0 ${active ? 'text-emerald-400' : 'text-slate-300 opacity-90'}`} />
                            <span className="truncate">{item.label}</span>
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

        <div className="border-t border-sidebar-border p-4 space-y-3">
          <div className="rounded-xl bg-sidebar-hover/80 px-4 py-3">
            <p className="text-xs font-medium text-slate-400">Signed in as</p>
            <p className="mt-0.5 truncate text-sm font-semibold text-slate-100">{profile?.full_name || 'User'}</p>
            <p className="text-[11px] text-slate-400 capitalize">{roleLabel(role)}</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="sidebar-logout-btn flex w-full items-center justify-center gap-2 rounded-xl border border-slate-600/80 bg-slate-800/60 px-4 py-2.5 text-sm font-semibold text-slate-100 transition-colors hover:border-red-500/60 hover:bg-red-950/40 hover:text-red-100 disabled:opacity-60"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {loggingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="app-header no-print sticky top-0 z-30 flex min-h-16 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-slate-900/[0.08] dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 px-4 py-2 shadow-header backdrop-blur-md sm:px-6 lg:flex-nowrap lg:py-0 transition-colors duration-200">
          {/* Left: page title */}
          <div className="app-header-left flex min-w-0 items-center gap-3 shrink-0 max-w-[min(100%,220px)] xl:max-w-[280px]">
            <button type="button" className="btn-icon lg:hidden shrink-0" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {company.name}
              </p>
              <h2 className="truncate type-widget-title text-slate-900 dark:text-slate-100">{currentTitle}</h2>
            </div>
          </div>

          {/* Center: search (capped width so it never crowds utilities) */}
          <div className="app-header-center hidden min-w-0 flex-1 md:flex md:justify-center lg:max-w-sm xl:max-w-md">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="app-header-search flex w-full min-w-0 max-w-[320px] items-center gap-2 rounded-xl border border-slate-900/10 dark:border-slate-700 bg-[#F7F8FA] dark:bg-slate-800/80 px-3 py-2 text-sm text-slate-500 hover:border-[#1e3a5f]/40 dark:hover:border-brand-300 transition-colors"
            >
              <Search className="h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate text-left">Search…</span>
              <kbd className="hidden xl:inline text-[10px] rounded border border-slate-200 dark:border-slate-600 px-1.5 py-0.5 shrink-0">
                ⌘K
              </kbd>
            </button>
          </div>

          {/* Right: utilities — never shrink below content; wrap on narrow widths */}
          <div className="app-header-right flex flex-wrap items-center justify-end gap-2 shrink-0 ml-auto">
            <div className="hidden md:block shrink-0">
              <HeaderLiveClock />
            </div>

            <div className="relative shrink-0">
              <button
                type="button"
                className="btn btn-secondary text-sm py-2 hidden sm:inline-flex shrink-0"
                onClick={() => setQuickOpen((o) => !o)}
              >
                <Zap className="h-4 w-4 text-orange-500" />
                <span className="hidden lg:inline">Quick</span>
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              {quickOpen && (
                <>
                  <button type="button" className="fixed inset-0 z-40" aria-label="Close quick actions" onClick={() => setQuickOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 z-50 w-48 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl py-1">
                    {QUICK_ACTIONS.map((a) => (
                      <Link
                        key={a.path}
                        to={a.path}
                        onClick={() => setQuickOpen(false)}
                        className="block px-4 py-2 text-sm text-slate-800 dark:text-slate-100 hover:bg-brand-50 dark:hover:bg-brand-950/50"
                      >
                        {a.label}
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="relative hidden lg:block shrink-0">
              <button
                type="button"
                className="btn btn-secondary text-sm py-2 max-w-[160px] xl:max-w-[200px] shrink-0"
                onClick={() => setCompanyOpen((o) => !o)}
              >
                <Building2 className="h-4 w-4 shrink-0" />
                <span className="truncate">{company.city}</span>
                {!weatherLoading && liveWeather && (
                  <span className="hidden xl:inline text-xs font-semibold text-brand-700 dark:text-brand-300 tabular-nums shrink-0">
                    {liveWeather.temp}°C
                  </span>
                )}
                <ChevronDown className="h-3.5 w-3.5 shrink-0" />
              </button>
              {companyOpen && (
                <>
                  <button type="button" className="fixed inset-0 z-40" aria-label="Close company menu" onClick={() => setCompanyOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 z-50 w-56 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl py-1">
                    {AURA.companies.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setCompanyId(c.id);
                          setCompanyOpen(false);
                        }}
                        className={`w-full text-left px-4 py-2 text-sm text-slate-800 dark:text-slate-100 hover:bg-brand-50 dark:hover:bg-brand-950/50 ${c.id === companyId ? 'font-semibold text-brand-700 dark:text-brand-300' : ''}`}
                      >
                        {c.name}
                        <span className="block text-xs text-slate-500">{c.city}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <button type="button" onClick={toggleTheme} className="btn-icon shrink-0" aria-label="Toggle theme">
              {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>

            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              title="Sign out"
              aria-label="Sign out"
              className="btn btn-secondary text-sm shrink-0 px-2.5 xl:px-3"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              <span className="hidden xl:inline">{loggingOut ? 'Signing out…' : 'Sign out'}</span>
            </button>

            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setUserMenuOpen((open) => !open)}
                className="flex items-center gap-2 rounded-xl border border-slate-900/10 dark:border-slate-700 bg-[#F7F8FA] dark:bg-slate-800 pl-1 pr-2 xl:pr-3 py-1 hover:border-[#1e3a5f]/40 dark:hover:border-brand-600 transition-colors shrink-0"
                aria-expanded={userMenuOpen}
                aria-haspopup="menu"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1e3a5f]/10 dark:bg-brand-900 text-[#1e3a5f] dark:text-brand-200">
                  <UserCircle className="h-5 w-5" />
                </div>
                <div className="hidden xl:block text-left max-w-[120px]">
                  <p className="text-xs font-medium text-slate-900 dark:text-white leading-tight truncate">{profile?.full_name}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 capitalize">{roleLabel(role)}</p>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400 hidden xl:block" />
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
                    className="absolute right-0 top-full mt-2 z-50 w-56 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl py-1"
                  >
                    <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{profile?.full_name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{roleLabel(role)}</p>
                    </div>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleLogout}
                      disabled={loggingOut}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-60"
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

        <main className="px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10 max-w-[1600px] mx-auto w-full transition-colors duration-200">
          <Outlet />
        </main>
      </div>
    </div>
    </LiveWeatherProvider>
  );
}
