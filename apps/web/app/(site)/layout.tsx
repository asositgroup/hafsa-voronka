import type { Metadata } from "next";
import { Golos_Text, Scheherazade_New } from "next/font/google";
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
      className={`${golos.variable} ${scheherazade.variable} h-full antialiased font-sans`}
    >
      <body className="flex min-h-full flex-col bg-varaq text-siyoh font-sans">
        {children}
      </body>
    </html>
  );
}
