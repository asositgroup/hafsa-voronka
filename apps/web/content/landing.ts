export type LearnStep = {
  numeral: string;
  title: string;
  description: string;
};

export type StudyPathItem = {
  uzbek: string;
  arabic: string;
};

export type HowToStep = {
  number: number;
  text: string;
};

export type LandingContent = {
  hero: {
    tag: string;
    arabicWord: string;
    arabicBare: string;
    title: string;
    lead: string;
    paragraph: string;
    buttonText: string;
    factText: string;
  };
  whatYouWillLearn: {
    title: string;
    items: LearnStep[];
    buttonText: string;
  };
  whoIsThisFor: {
    intro: string;
    title: string;
    leadIn: string;
    bullets: string[];
    closing: string;
  };
  teacher: {
    mark: string;
    name: string;
    title: string;
    intro: string;
    studyPath: StudyPathItem[];
    bioParagraphs: string[];
  };
  howToGet: {
    title: string;
    steps: HowToStep[];
    privacyText: string;
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
  hero: {
    tag: "Hafsa ustoza",
    arabicWord: "اِقْرَأْ",
    arabicBare: "اقرأ",
    title: "Arab tilini o‘rganmoqchisiz, ammo nimadan boshlashni bilmayapsizmi?",
    lead: "Hafsa ustozaning 12 yillik tajribasi asosida tayyorlangan bepul video darsda arab tilini o‘rganishdagi 5 ta muhim qadamni bilib oling.",
    paragraph: "To‘g‘ri ustoz va kitob tanlashdan arab harflarini o‘rganishgacha — arab tilini o‘rganish jarayonini tezlashtiring va vaqtingizni tejang.",
    buttonText: "Videoni Telegramda ko‘rish",
    factText: "Bepul video dars, 17 daqiqa. Telegram ichida ko‘rasiz.",
  },
  whatYouWillLearn: {
    title: "Videodarsda nimalarni bilib olasiz?",
    items: [
      {
        numeral: "١",
        title: "Arab tilini o‘rganishni nimadan boshlash kerakligini bilib olasiz",
        description: "To‘g‘ri ustoz va kitob tanlash, arab harflarini o‘rganish hamda ta’lim jarayonini to‘g‘ri yo‘lga qo‘yish haqida tushunchaga ega bo‘lasiz.",
      },
      {
        numeral: "٢",
        title: "O‘rganish jarayonini qiyinlashtiradigan xatolarni tushunasiz",
        description: "Noto‘g‘ri metod tanlash va tartibsiz o‘rganish qanday qiyinchiliklarga olib kelishini, bu muammolardan qanday saqlanish mumkinligini bilib olasiz.",
      },
      {
        numeral: "٣",
        title: "O‘zingiz uchun to‘g‘ri o‘rganish yo‘lini belgilaysiz",
        description: "Hafsa ustozaning tajribasi asosida arab tilini o‘rganishdagi dastlabki qadamlarni tushunib, o‘qishni qayerdan boshlash kerakligini aniqlashtirasiz.",
      },
    ],
    buttonText: "Videoni Telegramda ko‘rish",
  },
  whoIsThisFor: {
    intro: "Ushbu darslik arab tili va Qur’onni o‘qishni o‘rganishni istagan, ammo nimadan boshlashni bilmayotgan opa-singillarimiz uchun tayyorlangan.",
    title: "Bu bepul dars kimlar uchun?",
    leadIn: "Videodars ayniqsa quyidagilar uchun foydali bo‘ladi:",
    bullets: [
      "Arab tilini noldan o‘rganishni istayotganlar",
      "Qur’onni tajvid bilan o‘qishni istayotganlar",
      "Arab harflarini o‘rganmoqchi bo‘lgan, lekin qanday boshlashni bilmayotganlar",
      "Arab tilini o‘rganish uchun qaysi ustoz va kitobni tanlashga ikkilanayotganlar",
      "O‘rganishni boshlab, ammo to‘g‘ri yo‘nalish topa olmayotganlar",
    ],
    closing: "Agar siz ham arab tili va Qur’on o‘qishni o‘rganishni niyat qilgan bo‘lsangiz, ushbu bepul video darsni ko‘ring.",
  },
  teacher: {
    mark: "حفصة",
    name: "Hafsa ustoza",
    title: "IQRA Akademiyasi asoschisi, 12 yildan ortiq tajriba",
    intro: "Qur’on va arab tili ta’limi bilan 12 yildan ortiq shug‘ullanib kelaman. Arab tili va Qur’on ilmlarini chuqur o‘rganib, xalqaro darajadagi ustozlardan ta’lim olganman.",
    studyPath: [
      {
        uzbek: "O‘zbekiston: arab tili bo‘yicha tahsil",
        arabic: "أوزبكستان",
      },
      {
        uzbek: "Madina, Islom universiteti: tahsil",
        arabic: "المدينة المنورة",
      },
      {
        uzbek: "Misr, arab tili markazi: 10 darajali dastur, yuqori baho bilan",
        arabic: "مصر",
      },
      {
        uzbek: "Istanbul, “Darussalam” madrasasi: malaka oshirish",
        arabic: "إسطنبول",
      },
    ],
    bioParagraphs: [
      "Mujoza ustozlardan ta’lim olib, hozirda hofiza qizlarni ijozaga tayyorlab kelmoqdaman.",
      "2014-yili IQRA Akademiyasiga asos soldim. Akademiyamizda darslarni Dubay, Misr va Makka shaharlarida tahsil olgan, yuqori darajadagi ijoza va diplomlarga ega ustozalar olib boradi.",
    ],
  },
  howToGet: {
    title: "Videoni qanday olasiz",
    steps: [
      {
        number: 1,
        text: "Tugmani bosing, Telegramda bot ochiladi",
      },
      {
        number: 2,
        text: "Bitta tugma bilan raqamingizni yuboring",
      },
      {
        number: 3,
        text: "Darsni Telegram ichida ko‘ring",
      },
    ],
    privacyText: "Raqamingiz faqat dars va kanal haqida xabar berish uchun ishlatiladi.",
  },
  footer: {
    disclaimer: "Natijalar har bir o‘quvchining muntazam mehnatiga bog‘liq.",
    copyright: "© 2026 IQRA Akademiyasi",
  },
  stickyBar: {
    buttonText: "Videoni Telegramda ko‘rish",
  },
};
