import { ROLES } from './permissions';

/** Sidebar — matches original AURA CLEAN reference (CORE / MASTERS / FINANCE / ADMIN) */
export const ERP_NAV_SECTIONS = [
  {
    id: 'core',
    label: 'Core',
    items: [{ path: '/', label: 'Executive Dashboard', key: 'dashboard', roles: [ROLES.ADMIN, ROLES.STAFF] }],
  },
  {
    id: 'masters',
    label: 'Masters',
    items: [
      { path: '/products', label: 'Products', key: 'products', roles: [ROLES.ADMIN, ROLES.STAFF] },
      { path: '/parties', label: 'Parties', key: 'parties', roles: [ROLES.ADMIN] },
      { path: '/purchases', label: 'Purchases', key: 'purchases', roles: [ROLES.ADMIN] },
      { path: '/sales', label: 'Sales & Invoices', key: 'sales', roles: [ROLES.ADMIN, ROLES.STAFF] },
    ],
  },
  {
    id: 'finance',
    label: 'Finance',
    items: [
      { path: '/expenses', label: 'Expenses', key: 'expenses', roles: [ROLES.ADMIN] },
      { path: '/reports', label: 'Reports', key: 'reports', roles: [ROLES.ADMIN] },
      {
        path: '/pricing-calculator',
        label: 'Pricing & Margin Calculator',
        key: 'pricing_calculator',
        roles: [ROLES.ADMIN],
      },
    ],
  },
  {
    id: 'admin',
    label: 'Administration',
    items: [
      { path: '/employees', label: 'Employees', key: 'employees', roles: [ROLES.ADMIN] },
      { path: '/users', label: 'Users', key: 'users', roles: [ROLES.ADMIN] },
      { path: '/activity-log', label: 'Activity Log', key: 'activity_log', roles: [ROLES.ADMIN] },
      {
        path: '/settings/business',
        label: 'Business Settings',
        key: 'business_settings',
        roles: [ROLES.ADMIN],
      },
    ],
  },
];
export function erpNavForRole(role) {
  if (!role) return [];
  const effectiveRole = role === ROLES.SUPER_ADMIN ? ROLES.ADMIN : role;
  return ERP_NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => item.roles.includes(effectiveRole)),
  })).filter((section) => section.items.length > 0);
}

export function flattenNavItems(sections = ERP_NAV_SECTIONS) {
  return sections.flatMap((s) => s.items);
}

export const PAGE_TITLES = Object.fromEntries(flattenNavItems().map((item) => [item.path, item.label]));

/** Global search index */
export function buildSearchIndex() {
  return flattenNavItems().map((item) => ({
    type: 'module',
    title: item.label,
    path: item.path,
    subtitle: 'Navigate',
  }));
}
