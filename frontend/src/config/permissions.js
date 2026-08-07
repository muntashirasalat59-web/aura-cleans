export const ROLES = {
  ADMIN: 'admin',
  STAFF: 'staff',
  SUPER_ADMIN: 'super_admin',
};

/** Route paths staff may open (Parties API still used by Sales form). */
export const STAFF_ALLOWED_PATHS = ['/', '/products', '/sales'];

export function isPathAllowed(role, pathname) {
  if (role === ROLES.ADMIN || role === ROLES.SUPER_ADMIN) return true;
  if (role === ROLES.STAFF) {
    return STAFF_ALLOWED_PATHS.includes(pathname);
  }
  return false;
}

export function defaultHomeForRole(role) {
  return '/';
}

export function roleLabel(role) {
  if (role === ROLES.SUPER_ADMIN) return 'Super Admin';
  if (role === ROLES.ADMIN) return 'Admin';
  if (role === ROLES.STAFF) return 'Staff';
  return role;
}