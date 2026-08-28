/**
 * Which routes are a staff panel rather than the shop.
 *
 * The customer chrome — the marketing nav, the tab bar, the site footer — is
 * wrong on a management console in a way that is easy to miss because each
 * piece is individually fine. Together they put six links to buy currency
 * across the top of the screen somebody uses to move other people's money, and
 * a copyright notice under it. A console should look like a tool.
 *
 * One list, imported by every piece of chrome, so a new panel route cannot pick
 * up the shop's header because somebody edited three files and not the fourth.
 */
export const PANEL_PREFIXES = ["/admin", "/office"] as const;

export function isPanelRoute(pathname: string): boolean {
  return PANEL_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
