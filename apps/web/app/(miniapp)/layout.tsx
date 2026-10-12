import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "../globals.css";

export const metadata: Metadata = {
  title: "Video dars",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#09090B",
};

export default function MiniAppRootLayout({ children }: LayoutProps<"/app">) {
  return (
    <html lang="uz" className="h-full antialiased">
      <body className="flex min-h-dvh flex-col bg-[#09090B] text-zinc-100">
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
        {children}
      </body>
    </html>
  );
}
