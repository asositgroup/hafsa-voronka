import Script from "next/script";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Script
        src="https://telegram.org/js/telegram-web-app.js"
        strategy="beforeInteractive"
      />
      <div className="flex min-h-dvh flex-col bg-[#09090B] text-zinc-100">
        {children}
      </div>
    </>
  );
}
