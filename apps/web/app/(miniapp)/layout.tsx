import type { Metadata, Viewport } from "next";
import { Golos_Text, Scheherazade_New } from "next/font/google";
import Script from "next/script";
import "../globals.css";

const golos = Golos_Text({
  subsets: ["latin"],
  variable: "--font-golos",
  display: "swap",
});

const scheherazade = Scheherazade_New({
  subsets: ["arabic"],
  weight: "400",
  variable: "--font-scheherazade",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Arab tilini o‘rganishdagi 5 muhim qadam",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function MiniAppRootLayout({ children }: LayoutProps<"/app">) {
  return (
    <html
      lang="uz"
      className={`${golos.variable} ${scheherazade.variable} h-full antialiased font-sans`}
    >
      <body className="flex min-h-dvh flex-col bg-siyoh text-varaq font-sans">
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />
        {children}
      </body>
    </html>
  );
}
