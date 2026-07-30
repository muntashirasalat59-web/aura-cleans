import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Building2,
  ChevronDown,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Search,
  Sparkles,
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
import GlobalSearch from './erp/GlobalSearch';

const QUICK_ACTIONS = [
  { label: 'New invoice', path: '/sales' },
  { label: 'New purchase', path: '/purchases' },
  { label: 'Add product', path: '/products' },
  { label: 'Add party', path: '/parties' },
];

export default function Layout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, role, signOut } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [companyOpen, setCompanyOpen] = useState(false);
  const [companyId, setCompanyId] = useState(AURA.companies[0].id);
  const [collapsed, setCollapsed] = useState({});

  const sections = erpNavForRole(role);
  const currentTitle = PAGE_TITLES[location.pathname] || 'AURA CLEAN';
  const company = AURA.companies.find((c) => c.id === companyId) || AURA.companies[0];

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
    await signOut();
    navigate('/login', { replace: true });
  }

  function isActive(path) {
    if (path === '/') return location.pathname === '/';
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors">
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
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-sidebar dark:bg-slate-950 text-slate-200 border-r border-sidebar-border dark:border-slate-800 transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-5 lg:hidden">
          <AuraLogo compact />
          <button type="button" className="btn-icon text-slate-400 hover:text-white hover:bg-sidebar-hover" onClick={closeSidebar}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="hidden lg:block border-b border-sidebar-border px-5 py-5">
          <AuraLogo />
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-4">
          {sections.map((section) => {
            const isOpen = collapsed[section.id] === false || activeSectionId === section.id || collapsed[section.id] === undefined;
            return (
              <div key={section.id}>
                <button
                  type="button"
                  onClick={() => toggleSection(section.id)}
                  className="flex w-full items-center justify-between px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-200"
                >
                  {section.label}
                  {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                </button>
                {isOpen && (
                  <ul className="mt-1 space-y-0.5">
                    {section.items.map((item) => {
                      const active = isActive(item.path);
                      return (
                        <li key={item.path}>
                          <Link
                            to={item.path}
                            onClick={closeSidebar}
                            className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all ${
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

        <div className="border-t border-sidebar-border p-4">
          <div className="rounded-xl bg-sidebar-hover/80 px-4 py-3">
            <p className="text-xs font-medium text-slate-400">Signed in as</p>
            <p className="mt-0.5 truncate text-sm font-semibold text-slate-100">{profile?.full_name || 'User'}</p>
            <p className="text-[11px] text-slate-400 capitalize">{roleLabel(role)}</p>
          </div>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 px-4 shadow-header backdrop-blur-md sm:px-6">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <button type="button" className="btn-icon lg:hidden" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0 flex-1 sm:flex-none">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{company.name}</p>
              <h2 className="truncate text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">{currentTitle}</h2>
            </div>
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="hidden md:flex items-center gap-2 flex-1 max-w-md ml-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3 py-2 text-sm text-slate-500 hover:border-brand-300 transition-colors"
            >
              <Search className="h-4 w-4 shrink-0" />
              <span className="flex-1 text-left">Search…</span>
              <kbd className="text-[10px] rounded border border-slate-200 dark:border-slate-600 px-1.5 py-0.5">⌘K</kbd>
            </button>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <div className="relative">
              <button
                type="button"
                className="btn btn-secondary text-sm py-2 hidden sm:inline-flex"
                onClick={() => setQuickOpen((o) => !o)}
              >
                <Zap className="h-4 w-4 text-orange-500" />
                Quick
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

            <div className="relative hidden md:block">
              <button
                type="button"
                className="btn btn-secondary text-sm py-2 max-w-[160px]"
                onClick={() => setCompanyOpen((o) => !o)}
              >
                <Building2 className="h-4 w-4 shrink-0" />
                <span className="truncate">{company.city}</span>
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

            <button type="button" onClick={toggleTheme} className="btn-icon" aria-label="Toggle theme">
              {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>

            <button type="button" onClick={handleLogout} className="btn btn-secondary text-sm hidden sm:inline-flex">
              <LogOut className="h-4 w-4" />
              Logout
            </button>

            <div className="ml-1 flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-1 pr-3 py-1">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-100 dark:bg-brand-900 text-brand-800 dark:text-brand-200">
                <UserCircle className="h-5 w-5" />
              </div>
              <div className="hidden sm:block text-left max-w-[100px]">
                <p className="text-xs font-medium text-slate-900 dark:text-white leading-tight truncate">{profile?.full_name}</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 capitalize">{roleLabel(role)}</p>
              </div>
            </div>
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10 max-w-[1600px] mx-auto w-full">{children}</main>
      </div>
    </div>
  );
}

function AuraLogo({ compact }) {
  return (
    <div className={`flex items-center gap-3 ${compact ? '' : ''}`}>
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-700 text-white shadow-lg shadow-brand-900/30 ring-1 ring-emerald-500/30">
        <Sparkles className="h-5 w-5" />
      </div>
      {!compact && (
        <div>
          <h1 className="text-base font-bold tracking-tight text-white">{AURA.name}</h1>
          <p className="text-[11px] text-emerald-400/90">{AURA.tagline}</p>
        </div>
      )}
      {compact && <span className="font-semibold text-white">{AURA.name}</span>}
    </div>
  );
}
