export type LessonCard = {
  numeral: string;
  title: string;
  description: string;
};

export type StudyPathItem = {
  place: string;
  detail: string;
  arabic: string;
};

export type HowToStep = {
  number: number;
  title: string;
  description: string;
};

export type LandingContent = {
  header: {
    brand: string;
    buttonText: string;
  };
  hero: {
    fact: string;
    title: string;
    lead: string;
    paragraph: string;
    buttonText: string;
    telegramNote: string;
    telegramSubnote: string;
    posterLabel: string;
    duration: string;
    badgeValue: string;
    badgeLabel: string;
  };
  lesson: {
    title: string;
    intro: string;
    cards: LessonCard[];
    buttonText: string;
  };
  audience: {
    title: string;
    intro: string;
    leadIn: string;
    items: string[];
    closing: string;
    buttonText: string;
  };
  teacher: {
    archLabel: string;
    archYear: string;
    name: string;
    credential: string;
    lead: string;
    studyPath: StudyPathItem[];
    ijaza: string;
    foundedYear: string;
    foundedText: string;
  };
  steps: {
    title: string;
    items: HowToStep[];
    finalTitle: string;
    finalSubline: string;
    finalButtonText: string;
    privacy: string;
  };
  footer: {
    disclaimer: string;
    copyright: string;
  };
  stickyBar: {
    buttonText: string;
  };
};

export const landingContent: LandingContent = {
  header: {
    brand: "Hafsa ustoza",
    buttonText: "Bepul olish",
  },
  hero: {
    fact: "17 daqiqalik bepul videodars",
    title: "Arab tilini to‘g‘ri o‘rganishni nimadan boshlash kerak?",
    lead: "Hafsa ustozaning 12 yillik tajribasi asosida arab tilini o‘rganishdagi 5 ta muhim qadamni bilib oling.",
    paragraph: "To‘g‘ri ustoz va kitob tanlashdan arab harflarini o‘rganishgacha — jarayonni tezlashtiring va vaqtingizni tejang.",
    buttonText: "Bepul darsni ko‘rish",
    telegramNote: "Telegram ichida ochiladi",
    telegramSubnote: "Bir necha soniyada",
    posterLabel: "Videoni Telegramda ko‘rish",
    duration: "17:29",
    badgeValue: "12+",
    badgeLabel: "yillik ta’lim tajribasi",
  },
  lesson: {
    title: "Videodarsda nimalarni bilib olasiz?",
    intro: "Darsda arab tilini o‘rganishni boshlash uchun kerak bo‘ladigan uchta asosiy mavzu bor.",
    cards: [
      {
        numeral: "١",
        title: "Qayerdan boshlashni bilib olasiz",
        description: "To‘g‘ri ustoz va kitob tanlash, arab harflarini o‘rganish hamda ta’lim jarayonini to‘g‘ri yo‘lga qo‘yish haqida tushunchaga ega bo‘lasiz.",
      },
      {
        numeral: "٢",
        title: "Xatolarni oldindan tushunasiz",
        description: "Noto‘g‘ri metod va tartibsiz o‘rganish qanday qiyinchiliklarga olib kelishini, bu muammolardan qanday saqlanishni bilib olasiz.",
      },
      {
        numeral: "٣",
        title: "O‘z yo‘lingizni belgilaysiz",
        description: "Hafsa ustozaning tajribasi asosida dastlabki qadamlarni tushunib, o‘qishni aynan qayerdan boshlash kerakligini aniqlashtirasiz.",
      },
    ],
    buttonText: "Bepul darsni ko‘rish",
  },
  audience: {
    title: "Bu bepul dars kimlar uchun?",
    intro: "Arab tili va Qur’onni o‘qishni o‘rganishni istagan, ammo nimadan boshlashni bilmayotgan opa-singillarimiz uchun tayyorlangan.",
    leadIn: "Videodars ayniqsa quyidagilar uchun foydali:",
    items: [
      "Arab tilini noldan o‘rganishni istayotganlar",
      "Qur’onni tajvid bilan o‘qishni istayotganlar",
      "Arab harflarini o‘rganmoqchi bo‘lganlar",
      "Ustoz va kitob tanlashga ikkilanayotganlar",
      "Boshlagan, ammo to‘g‘ri yo‘nalish topa olmayotganlar",
    ],
    closing: "Siz ham arab tili va Qur’on o‘qishni o‘rganishni niyat qilgan bo‘lsangiz, bu dars siz uchun.",
    buttonText: "Bepul darsni ko‘rish",
  },
  teacher: {
    archLabel: "IQRA Akademiyasi asoschisi",
    archYear: "2014",
    name: "Hafsa ustoza",
    credential: "12 yildan ortiq Qur’on va arab tili ta’limi tajribasi",
    lead: "Qur’on va arab tili ta’limi bilan 12 yildan ortiq shug‘ullanib kelaman. Arab tili va Qur’on ilmlarini chuqur o‘rganib, xalqaro darajadagi ustozlardan ta’lim olganman.",
    studyPath: [
      {
        place: "O‘zbekiston",
        detail: "Arab tili bo‘yicha tahsil",
        arabic: "أوزبكستان",
      },
      {
        place: "Madina",
        detail: "Islom universitetida tahsil",
        arabic: "المدينة المنورة",
      },
      {
        place: "Misr",
        detail: "Arab tili markazida 10 darajali dastur, yuqori baho bilan",
        arabic: "مصر",
      },
      {
        place: "Istanbul",
        detail: "“Darussalam” madrasasida malaka oshirish",
        arabic: "إسطنبول",
      },
    ],
    ijaza: "Mujoza ustozlardan ta’lim olib, hozirda hofiza qizlarni ijozaga tayyorlab kelmoqdaman.",
    foundedYear: "2014",
    foundedText: "IQRA Akademiyasiga asos soldim. Akademiyamizda darslarni Dubay, Misr va Makkada tahsil olgan, yuqori darajadagi ijoza va diplomlarga ega ustozalar olib boradi.",
  },
  steps: {
    title: "Videoni qanday olasiz?",
    items: [
      {
        number: 1,
        title: "Ism va raqamingizni qoldiring",
        description: "Shundan so‘ng Telegramda bot ochiladi",
      },
      {
        number: 2,
        title: "Botda raqamingizni tasdiqlang",
        description: "«Raqamni yuborish» tugmasini bosing",
      },
      {
        number: 3,
        title: "Darsni ko‘ring",
        description: "Telegram ichida, o‘zingizga qulay vaqtda",
      },
    ],
    finalTitle: "Birinchi qadamni bugun qo‘ying.",
    finalSubline: "17 daqiqalik videodarsni bepul oling.",
    finalButtonText: "Telegramda ko‘rish",
    privacy: "Raqamingiz faqat dars va kanal haqida xabar berish uchun ishlatiladi.",
  },
  footer: {
    disclaimer: "Natijalar har bir o‘quvchining muntazam mehnatiga bog‘liq.",
    copyright: "© 2026 IQRA Akademiyasi",
  },
  stickyBar: {
    buttonText: "Bepul darsni ko‘rish",
  },
};
