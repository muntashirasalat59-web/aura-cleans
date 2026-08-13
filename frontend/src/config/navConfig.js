import { ROLES } from './permissions';

/** Sidebar navigation with role visibility. */
export const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', key: 'dashboard', roles: [ROLES.ADMIN, ROLES.STAFF] },
  { path: '/products', label: 'Products', key: 'products', roles: [ROLES.ADMIN, ROLES.STAFF] },
  { path: '/parties', label: 'Parties', key: 'parties', roles: [ROLES.ADMIN] },
  { path: '/purchases', label: 'Purchases', key: 'purchases', roles: [ROLES.ADMIN] },
  { path: '/sales', label: 'Sales & Invoices', key: 'sales', roles: [ROLES.ADMIN, ROLES.STAFF] },
  { path: '/expenses', label: 'Expenses', key: 'expenses', roles: [ROLES.ADMIN] },
  { path: '/employees', label: 'Employees', key: 'employees', roles: [ROLES.ADMIN] },
  { path: '/reports', label: 'Reports', key: 'reports', roles: [ROLES.ADMIN] },
  {
    path: '/pricing-calculator',
    label: 'Pricing & Margin Calculator',
    key: 'pricing_calculator',
    roles: [ROLES.ADMIN],
  },
  { path: '/users', label: 'Users', key: 'users', roles: [ROLES.ADMIN] },
];

export function navItemsForRole(role) {
  if (!role) return [];
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}

export const PAGE_TITLES = Object.fromEntries(NAV_ITEMS.map((item) => [item.path, item.label]));
