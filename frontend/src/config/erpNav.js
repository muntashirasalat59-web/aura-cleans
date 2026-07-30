import { ROLES } from './permissions';



/** Sidebar — live modules only */

export const ERP_NAV_SECTIONS = [

  {

    id: 'main',

    label: 'Main',

    items: [{ path: '/', label: 'Dashboard', key: 'dashboard', roles: [ROLES.ADMIN, ROLES.STAFF] }],

  },

  {

    id: 'business',

    label: 'Business',

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

    ],

  },

  {

    id: 'admin',

    label: 'Administration',

    items: [

      { path: '/employees', label: 'Employees', key: 'employees', roles: [ROLES.ADMIN] },

      { path: '/users', label: 'Users', key: 'users', roles: [ROLES.ADMIN] },

    ],

  },

];



export function erpNavForRole(role) {

  if (!role) return [];

  return ERP_NAV_SECTIONS.map((section) => ({

    ...section,

    items: section.items.filter((item) => item.roles.includes(role)),

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


