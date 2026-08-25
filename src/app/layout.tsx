import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ClientProviders } from "@/components/shared/client-providers";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://asameet.vercel.app"),
  title: "آسامیت | Asameet — بستر هوشمند گفت‌وگو",
  description:
    "آسامیت؛ پیام‌رسانی، تماس صوتی و تصویری، جلسات آنلاین، کلاس مجازی و دستیار هوش مصنوعی — همه در یک بستر امن و روان.",
  applicationName: "Asameet",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "آسامیت",
  },
  openGraph: {
    title: "آسامیت | Asameet — بستر هوشمند گفت‌وگو",
    description: "پیام‌رسانی، جلسات آنلاین، کلاس مجازی و دستیار هوش مصنوعی در یک بستر.",
    images: ["/og-image.png"],
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0d9488" },
    { media: "(prefers-color-scheme: dark)", color: "#134e4a" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
