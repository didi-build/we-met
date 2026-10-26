import type { Metadata } from "next";
import localFont from "next/font/local";
import { THEME_STORAGE_KEY } from "@/lib/theme-storage-key";
import "./globals.css";

const figtree = localFont({
  src: [
    {
      path: "./fonts/figtree/Figtree-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/figtree/Figtree-Medium.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "./fonts/figtree/Figtree-SemiBold.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "./fonts/figtree/Figtree-Bold.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  display: "swap",
  variable: "--font-figtree",
});

export const metadata: Metadata = {
  title: "We Met",
  description: "Digital business cards",
};

const themeBootstrapScript = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var s=localStorage.getItem(k);var t=s==="light"||s==="dark"?s:(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");document.documentElement.setAttribute("data-theme",t);document.documentElement.setAttribute("data-palette","mono");}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-palette="mono" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body className={`${figtree.variable} min-h-dvh antialiased`}>{children}</body>
    </html>
  );
}
