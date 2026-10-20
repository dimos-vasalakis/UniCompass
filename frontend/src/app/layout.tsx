import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { LocaleProvider } from "@/lib/i18n/client";
import { DICTIONARIES, getLocale } from "@/lib/i18n/server";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const d = DICTIONARIES[await getLocale()];
  return { title: "UniCompass", description: d.meta.siteDescription };
}

// Every visit starts in the light theme; a choice made with the toggle lasts for the browser session (reloads keep it).
const THEME_SCRIPT = `try{localStorage.removeItem("theme");var t=sessionStorage.getItem("theme");document.documentElement.dataset.theme=t==="dark"?"dark":"light";var m=document.cookie.match(/(?:^|; )locale=(en|el)/);if(m)document.documentElement.lang=m[1]}catch(e){}`;

// The language comes from a cookie, so everything below it renders per request.
async function LocaleShell({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <LocaleProvider locale={locale} dicts={DICTIONARIES}>
      <SiteHeader />
      {children}
    </LocaleProvider>
  );
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <Suspense>
          <LocaleShell>{children}</LocaleShell>
        </Suspense>
      </body>
    </html>
  );
}
