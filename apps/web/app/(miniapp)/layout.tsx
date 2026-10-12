import type { Metadata, Viewport } from "next";
import { Amiri, Golos_Text } from "next/font/google";
import Script from "next/script";
import "../globals.css";

const golos = Golos_Text({
  subsets: ["latin", "latin-ext", "cyrillic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

const amiri = Amiri({
  subsets: ["arabic", "latin"],
  weight: ["400", "700"],
  variable: "--font-arabic",
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
      className={`${golos.variable} ${amiri.variable} h-full antialiased font-sans`}
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
