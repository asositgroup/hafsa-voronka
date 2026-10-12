export type StepItem = {
  step: number;
  title: string;
  description: string;
};

export type LearnPoint = {
  number: number;
  title: string;
  description?: string;
};

export type ResultCard = {
  tag: string;
  title: string;
  description: string;
};

export type ExpertStat = {
  value: string;
  label: string;
};

export type LandingContent = {
  hero: {
    badge: string;
    title: string;
    subtitle: string;
    featureTag: string;
    featureDesc: string;
    coverImage: string | null;
    ctaText: string;
    priceNote: string;
  };
  features: Array<{
    title: string;
  }>;
  whatYouWillLearn: {
    title: string;
    items: LearnPoint[];
    ctaText: string;
    priceNote: string;
  };
  whoIsThisFor: {
    title: string;
    items: string[];
  };
  results: {
    title: string;
    subtitle: string;
    items: ResultCard[];
  };
  stepsToVideo: {
    title: string;
    items: StepItem[];
    ctaText: string;
    priceNote: string;
  };
  expert: {
    name: string;
    title: string;
    image: string | null;
    bio: string[];
    stats: ExpertStat[];
  };
  footer: {
    disclaimer: string;
    copyright: string;
  };
};

export const landingContent: LandingContent = {
  hero: {
    badge: "Eksklyuziv Onlayn Dars",
    title: "DAROMADNI OSHIRISHNING AMALIY USULLARI",
    subtitle: "Mijozlar oqimini jalb qiling va sotuv hajmini 2x dan 5x gacha oshiring",
    featureTag: "AMALIY BOSQICHLAR · REAL TAJRIBA",
    featureDesc: "Mualliflik video master-klassi",
    coverImage: null,
    ctaText: "VIDEONI BEPUL KO'RISH →",
    priceNote: "Narxi: 0 so'm · Cheklangan vaqt davomida ochiq",
  },
  features: [
    { title: "Yopiq Efir" },
    { title: "Real Tajriba" },
    { title: "Amaliy Tizim" },
  ],
  whatYouWillLearn: {
    title: "Videodarsda nimalarni bilib olasiz",
    items: [
      {
        number: 1,
        title: "Nega mijozlar narxni so'rab yo'qolib qoladi va ularni qanday ushlab qolish mumkin?",
      },
      {
        number: 2,
        title: "Sotuv voronkasini to'g'ri qurish va konversiyani bir necha barobar oshirish usullari",
      },
      {
        number: 3,
        title: "Mahsulot yoki xizmat qadrini oshirib, yuqori chekda sotishning 3 ta asosiy siri",
      },
    ],
    ctaText: "VIDEONI BEPUL KO'RISH →",
    priceNote: "Narxi: 0 so'm",
  },
  whoIsThisFor: {
    title: "Ushbu bepul darslik kimlar uchun:",
    items: [
      "Mahsulot yoki xizmatlarini yuqori chekda sotishni xohlagan tadbirkorlar",
      "Onlayn va offlayn biznesda sotuvlarini 2x dan 10x gacha oshirmoqchi bo'lganlar",
      "Sotuv tizimini noldan to'g'ri yo'lga qo'yishni rejalashtirgan mutaxassislar",
    ],
  },
  results: {
    title: "O'quvchilarim natijalari",
    subtitle: "Quruq nazariya emas, real amaliyot va erishilgan haqiqiy natijalar:",
    items: [
      {
        tag: "Onlayn Savdo",
        title: "Sotuvlar hajmi 3 barobar o'sdi",
        description: "Yangi sotuv voronkasi orqali 2 oy ichida oylik aylanma 20 mln so'mdan 65 mln so'mga ko'tarildi.",
      },
      {
        tag: "Xizmat Ko'rsatish",
        title: "Yuqori narxlarda barqaror mijozlar",
        description: "Xizmatlar paketlashtirildi va birinchi oyda 5 ta yirik korporativ shartnoma imzolandi.",
      },
      {
        tag: "Ishlab Chiqarish",
        title: "Viloyatlararo yangi bozorlar",
        description: "B2B mijozlar bilan ishlash strategiyasi yangilanib, 3 ta yangi hududga distribyutsiya yo'lga qo'yildi.",
      },
    ],
  },
  stepsToVideo: {
    title: "Videoni ochish — 3 ta qadam",
    items: [
      {
        step: 1,
        title: "Saytdan botga o'ting",
        description: "Quyidagi tugmani bosish orqali Telegram bot ochiladi",
      },
      {
        step: 2,
        title: "Botda ro'yxatdan o'ting",
        description: "Ismingiz va raqamingizni tasdiqlang — 10 soniya",
      },
      {
        step: 3,
        title: "Videoni tomosha qiling",
        description: "Bot dars havolasini darhol taqdim etadi",
      },
    ],
    ctaText: "VIDEONI BEPUL KO'RISH →",
    priceNote: "Narxi: 0 so'm",
  },
  expert: {
    name: "Javohir Rustamov",
    title: "Biznes-maslahatchi, marketing va sotuv tizimlari bo'yicha ekspert",
    image: null,
    bio: [
      "12 yillik tajribaga ega amaliyotchi marketolog va biznes konsultant.",
      "O'zbekistonda 100 dan ortiq yirik va o'rta biznes loyihalarida sotuv tizimini noldan yo'lga qo'ygan.",
      "Kompaniyalar va tadbirkorlar uchun amaliy sotuv voronkalari yaratish bo'yicha yetakchi mutaxassis.",
      "5000 dan ortiq shogirdlarga marketing va zamonaviy sotuv texnologiyalaridan dars bergan.",
    ],
    stats: [
      { value: "12 YILLIK", label: "Tajriba" },
      { value: "5000+", label: "O'quvchilar" },
      { value: "100+", label: "Muvaffaqiyatli Keys" },
    ],
  },
  footer: {
    disclaimer: "Natija shaxsiy mehnat va sarflangan vaqtga bog'liq. Kafolat berilmaydi.",
    copyright: "© 2026 Barcha huquqlar himoyalangan.",
  },
};
