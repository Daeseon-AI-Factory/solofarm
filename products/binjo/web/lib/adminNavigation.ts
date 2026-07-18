export type AdminNavKey = "today" | "orders" | "products" | "site";

export interface AdminNavItem {
  key: AdminNavKey;
  href: string;
  label: string;
  mobileLabel: string;
}

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { key: "today", href: "/admin", label: "오늘", mobileLabel: "오늘" },
  { key: "orders", href: "/admin/orders", label: "주문", mobileLabel: "주문" },
  { key: "products", href: "/admin/products", label: "상품", mobileLabel: "상품" },
  { key: "site", href: "/admin/site", label: "홈페이지", mobileLabel: "홈페이지" },
];

const SITE_PATH_PREFIXES = [
  "/admin/site",
  "/admin/farm",
  "/admin/gallery",
  "/admin/reviews",
  "/admin/calendar",
  "/admin/layout-editor",
  "/admin/analytics",
];

export function adminNavKeyForPath(pathname: string): AdminNavKey {
  if (pathname === "/admin") return "today";
  if (pathname.startsWith("/admin/orders")) return "orders";
  if (pathname.startsWith("/admin/products")) return "products";
  if (SITE_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return "site";
  return "today";
}

