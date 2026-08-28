import type { MetadataRoute } from "next";

/** PWA manifest (§14): installable, maskable icons, app shortcuts. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "صرافی آسا — Asaex",
    short_name: "آسا",
    description: "ارز، به سادگی آسا — بازارگاه حواله میان صرافی‌های دارای مجوز.",
    lang: "fa",
    dir: "rtl",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f6f8f9",
    theme_color: "#0b6e4f",
    categories: ["finance", "business"],
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/brand/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      {
        name: "حواله جدید",
        url: "/transfer/new",
        icons: [{ src: "/brand/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "نرخ‌ها",
        url: "/rates",
        icons: [{ src: "/brand/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "سفارش‌ها",
        url: "/orders",
        icons: [{ src: "/brand/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
