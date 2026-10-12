export function getTelegramWebApp() {
  if (typeof window === "undefined") return undefined;
  return window.Telegram?.WebApp;
}

export function initTelegramWebApp() {
  const tg = getTelegramWebApp();
  if (!tg) return null;

  tg.ready();
  tg.expand();

  if (typeof tg.disableVerticalSwipes === "function") {
    tg.disableVerticalSwipes();
  }

  if (typeof tg.setHeaderColor === "function") {
    tg.setHeaderColor("#09090B");
  }

  if (typeof tg.setBackgroundColor === "function") {
    tg.setBackgroundColor("#09090B");
  }

  return tg;
}

export function getInitData(): string {
  return getTelegramWebApp()?.initData ?? "";
}

export function getTelegramUser() {
  return getTelegramWebApp()?.initDataUnsafe?.user;
}

export function hapticSuccess() {
  getTelegramWebApp()?.HapticFeedback?.notificationOccurred("success");
}
