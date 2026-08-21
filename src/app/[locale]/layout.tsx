import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import * as React from "react";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { Providers } from "@/components/layout/providers";
import { TabBar } from "@/components/layout/tabbar";
import { localeDir, routing, type Locale } from "@/i18n/routing";
import { appOrigin } from "@/lib/app-url";
import { getSessionProfile, isSupabaseConfigured } from "@/lib/supabase/server";
import "@/styles/globals.css";

const vazirmatn = localFont({
  src: "../../fonts/Vazirmatn-Variable.woff2",
  variable: "--font-vazirmatn",
  weight: "100 900",
  display: "swap",
});

const inter = localFont({
  src: "../../fonts/Inter-Variable.woff2",
  variable: "--font-inter",
  weight: "100 900",
  display: "swap",
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });

  return {
    metadataBase: new URL(appOrigin()),
    title: {
      default: t("title"),
      template: `%s · ${t("brand")}`,
    },
    description: t("description"),
    applicationName: t("brand"),
    manifest: "/manifest.webmanifest",
    icons: {
      icon: [
        { url: "/brand/favicon.svg", type: "image/svg+xml" },
        { url: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      ],
      apple: "/brand/apple-touch-icon.png",
    },
    openGraph: {
      title: t("title"),
      description: t("description"),
      type: "website",
      locale: locale === "fa" ? "fa_IR" : "en_US",
      images: [
        {
          url: locale === "fa" ? "/brand/og-image-fa.png" : "/brand/og-image-en.png",
          width: 1200,
          height: 630,
        },
      ],
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: t("brand"),
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f8f9" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0e11" },
  ],
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  const dir = localeDir[locale as Locale];
  const session = isSupabaseConfigured() ? await getSessionProfile() : null;

  return (
    <html
      lang={locale}
      dir={dir}
      className={`${vazirmatn.variable} ${inter.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-dvh antialiased">
        <NextIntlClientProvider>
          <Providers>
            <Header signedIn={Boolean(session?.user)} />
            <main className="mx-auto w-full max-w-6xl px-4 pt-6 pb-24 sm:px-6 md:pb-10">
              {children}
            </main>
            <Footer />
            <TabBar />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
