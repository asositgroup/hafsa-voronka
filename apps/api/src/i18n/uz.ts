export const uz = {
  bot: {
    welcome: (name: string) =>
      `Assalomu alaykum, ${name}! 👋\n\nBepul video darsni ko'rish uchun quyidagi tugmani bosing.`,
    welcomeBack: (name: string) =>
      `Yana xush kelibsiz, ${name}! Darsni qayta ko'rishingiz yoki kanalga o'tishingiz mumkin.`,
    fallback: "Video darsni ko'rish uchun quyidagi tugmani bosing.",
    watchButton: "▶️ Videoni ko'rish",
    channelButton: "Kanalga o'tish →",
    contactConfirmed: "Raqamingiz qabul qilindi! ✅ Mini ilovada davom etishingiz mumkin.",
    contactMismatch: "Iltimos, faqat o'z telefon raqamingizni yuboring.",
    completion:
      "Tabriklaymiz! Siz darsni muvaffaqiyatli yakunladingiz. 🎉\n\nKanalimizga a'zo bo'lish uchun quyidagi tugmani bosing:",
  },
  validation: {
    nameRequired: "Ismingizni kiriting (2-60 ta belgi)",
    phoneRequired: "Telefon raqamingizni to'g'ri kiriting (+998XXXXXXXXX)",
  },
};
