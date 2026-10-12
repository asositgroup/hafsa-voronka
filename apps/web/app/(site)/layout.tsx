import type { Metadata } from "next";
import { Amiri, Golos_Text } from "next/font/google";
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
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  title: "Arab tilini nimadan boshlash kerak? Bepul video dars | Hafsa ustoza",
  description:
    "Hafsa ustozaning 12 yillik tajribasi asosida: arab tilini o‘rganishdagi 5 ta muhim qadam. Bepul video dars, Telegramda.",
  openGraph: {
    title: "Arab tilini nimadan boshlash kerak? Bepul video dars | Hafsa ustoza",
    description:
      "Hafsa ustozaning 12 yillik tajribasi asosida: arab tilini o‘rganishdagi 5 ta muhim qadam. Bepul video dars, Telegramda.",
    images: [
      {
        url: "/og.jpg",
        width: 1200,
        height: 630,
        alt: "Arab tilini o‘rganishdagi 5 muhim qadam",
      },
    ],
  },
};

export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="uz"
      className={`${golos.variable} ${amiri.variable} h-full antialiased font-sans`}
    >
      <body className="flex min-h-full flex-col bg-varaq text-siyoh font-sans">
        {children}
      </body>
    </html>
  );
}
