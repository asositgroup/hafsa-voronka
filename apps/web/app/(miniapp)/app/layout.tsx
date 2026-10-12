import { MiniAppProvider } from "@/components/miniapp/MiniAppProvider";

export default function AppLayout({ children }: LayoutProps<"/app">) {
  return <MiniAppProvider>{children}</MiniAppProvider>;
}
