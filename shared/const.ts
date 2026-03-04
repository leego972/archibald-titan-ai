export const COOKIE_NAME = "app_session_id";
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
export const AXIOS_TIMEOUT_MS = 30_000;
export const UNAUTHED_ERR_MSG = 'Please login (10001)';
export const NOT_ADMIN_ERR_MSG = 'You do not have required permission (10002)';

/** Check if a role string has admin-level privileges (admin or head_admin) */
export function isAdminRole(role: string | null | undefined): boolean {
  return role === 'admin' || role === 'head_admin';
}

/** Check if a role string is the head admin specifically */
export function isHeadAdmin(role: string | null | undefined): boolean {
  return role === 'head_admin';
}
