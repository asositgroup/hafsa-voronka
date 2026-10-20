import { startModes, type StartMode } from "@funnel/shared";

let capturedStartMode: StartMode | undefined;
let capturedMessageRef: number | undefined;

export function getTelegramWebApp() {
  if (typeof window === "undefined") return undefined;
  return window.Telegram?.WebApp;
}

export function waitForTelegramWebApp(timeoutMs = 3000) {
  return new Promise<ReturnType<typeof getTelegramWebApp>>((resolve) => {
    const startedAt = Date.now();
    const check = () => {
      const webApp = getTelegramWebApp();
      if (webApp || Date.now() - startedAt >= timeoutMs) {
        resolve(webApp);
        return;
      }
      setTimeout(check, 50);
    };
    check();
  });
}

export function initTelegramWebApp(tg: NonNullable<ReturnType<typeof getTelegramWebApp>>) {
  tg.ready();
  tg.expand();

  if (typeof tg.disableVerticalSwipes === "function") {
    tg.disableVerticalSwipes();
  }

  if (typeof tg.setHeaderColor === "function") {
    tg.setHeaderColor("#123B33");
  }

  if (typeof tg.setBackgroundColor === "function") {
    tg.setBackgroundColor("#123B33");
  }
}

export function hapticSuccess() {
  getTelegramWebApp()?.HapticFeedback?.notificationOccurred("success");
}

function parseStartMode(value: string | null | undefined) {
  return startModes.find((mode) => mode === value);
}

export function readStartMode(): StartMode | undefined {
  if (typeof window === "undefined") return capturedStartMode;
  capturedStartMode ??=
    parseStartMode(new URLSearchParams(window.location.search).get("start")) ??
    parseStartMode(getTelegramWebApp()?.initDataUnsafe?.start_param);
  return capturedStartMode;
}

export function readMessageRef(): number | undefined {
  if (typeof window === "undefined") return capturedMessageRef;
  if (capturedMessageRef === undefined) {
    const value = Number(new URLSearchParams(window.location.search).get("m"));
    if (Number.isInteger(value) && value > 0) capturedMessageRef = value;
  }
  return capturedMessageRef;
}
