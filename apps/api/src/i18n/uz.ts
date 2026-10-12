export const uz = {
  bot: {
    welcome: (name: string) =>
      `Assalomu alaykum, ${name}! 👋\n\nBepul video darsni ko'rish uchun quyidagi tugmani bosing.`,
    welcomeBack: (name: string) =>
      `Yana xush kelibsiz, ${name}! Darsni qayta ko'rishingiz yoki kanalga o'tishingiz mumkin.`,
    fallback: "Video darsni ko'rish uchun quyidagi tugmani bosing.",
    askContact: (name: string) =>
      `Assalomu alaykum, ${name}! 👋\n\nBepul video darsni olish uchun telefon raqamingizni yuboring: pastdagi «📱 Raqamni yuborish» tugmasini bosing.\n\nYoki raqamingizni yozib yuboring, masalan: +998 90 123 45 67`,
    askContactShort:
      "Video darsni olish uchun avval telefon raqamingizni yuboring: pastdagi «📱 Raqamni yuborish» tugmasini bosing.",
    shareContactButton: "📱 Raqamni yuborish",
    invalidPhone:
      "Raqam noto'g'ri ko'rinishda. Pastdagi tugma orqali yuboring yoki shunday yozing: +998 90 123 45 67",
    registered: "Rahmat, ro'yxatdan o'tdingiz! ✅",
    watchPrompt: "Bepul video dars tayyor. Ko'rish uchun quyidagi tugmani bosing 👇",
    defaultName: "Foydalanuvchi",
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
