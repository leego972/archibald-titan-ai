export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Login URL points to the local email/password login page.
// Social login (Google, GitHub) is available on the login page via direct OAuth.
export const getLoginUrl = (returnPath?: string) => {
  const base = "/login";
  if (returnPath) {
    return `${base}?returnTo=${encodeURIComponent(returnPath)}`;
  }
  return base;
};
