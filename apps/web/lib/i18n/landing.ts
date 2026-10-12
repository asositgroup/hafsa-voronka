export const landingI18n = {
  steps: {
    site: "Sayt",
    bot: "Bot",
    video: "Video",
  },
  badges: {
    free: "100% BEPUL",
    exclusive: "Eksklyuziv Onlayn Dars",
  },
  price: {
    label: "Narxi:",
    value: "0 so‘m",
  },
  cta: {
    defaultText: "VIDEONI BEPUL KO‘RISH",
  },
  video: {
    playAria: "Videoni bepul ko‘rish",
  },
  footer: {
    disclaimer: "Natijalar har bir o‘quvchining muntazam mehnatiga bog‘liq.",
    copyright: "© 2026 IQRA Akademiyasi",
  },
};

export const leadFormUz = {
  title: "Bepul darsni oling",
  subtitle: "Ism va raqamingizni qoldiring, dars Telegramda ochiladi.",
  nameLabel: "Ismingiz",
  namePlaceholder: "Masalan, Aziza",
  phoneLabel: "Telefon raqamingiz",
  phonePlaceholder: "90 123 45 67",
  submit: "Davom etish",
  submitting: "Yuborilmoqda...",
  privacy: "Ma’lumotlaringiz maxfiy saqlanadi va faqat dars haqida xabar berish uchun ishlatiladi.",
  close: "Yopish",
  successTitle: (name: string) => (name ? `Rahmat, ${name}!` : "Rahmat!"),
  successText: "Telegram ochilmoqda. Botda «Raqamni yuborish» tugmasini bosing va dars ochiladi.",
  openTelegram: "Telegramni ochish",
  errors: {
    name: "Ismingizni kiriting (2-60 ta belgi)",
    phone: "Telefon raqamingizni to‘g‘ri kiriting: 90 123 45 67",
    generic: "Xatolik yuz berdi. Qayta urinib ko‘ring.",
  },
};
