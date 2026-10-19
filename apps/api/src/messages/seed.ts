import { and, count, eq, isNull } from "drizzle-orm";
import {
  type FunnelSegment,
  type FunnelStatus,
  type MessageTemplateInput,
  type TemplateButton,
  type TemplateTiming,
} from "@funnel/shared";
import { db } from "@/db";
import { messageTemplates } from "@/db/schema";

type SeedTemplate = {
  day: number;
  timing: TemplateTiming;
  text: string;
  buttons: TemplateButton[];
  statuses?: FunnelStatus[];
};

const MINUTES_PER_HOUR = 60;

function hoursBeforeExpiry(hours: number): TemplateTiming {
  return { type: "before_expiry", value: hours * MINUTES_PER_HOUR };
}

function afterEntry(minutes: number): TemplateTiming {
  return { type: "after_entry", value: minutes };
}

function dayAt(hour: number): TemplateTiming {
  return { type: "day_time", value: hour * MINUTES_PER_HOUR };
}

const NIGHT_NOTICE: TemplateTiming = { type: "night_notice", value: 0 };

const watchButton: TemplateButton = { kind: "resume", text: "▶ Videoni ko‘rish" };
const continueButton: TemplateButton = { kind: "resume", text: "▶ Davom ettirish" };
const courseOnlyButton: TemplateButton = { kind: "offer", text: "Faqat kurs haqidagi qism" };
const priceButton: TemplateButton = { kind: "offer", text: "Narx va shartlarni ko‘rish" };
const adminButton: TemplateButton = { kind: "admin", text: "✍️ Adminga yozish", prefill: "Bonus darsni ko‘rdim" };

const nightNoticeText =
  "🌙 Bugun ulgurmasangiz, hech narsa yo‘qolmaydi: ertaga soat <b>{link_tugash_soati}</b> gacha vaqtingiz bor. Bonus dars sizni kutadi 👇";

const segmentA: SeedTemplate[] = [
  {
    day: 1,
    timing: hoursBeforeExpiry(23),
    text: "Assalomu alaykum, {ism}! 👋\n\n<b>Bonus dars</b> sizni kutyapti. Dars yana {qolgan_vaqt} ochiq turadi, qulay payt topib ko‘rib oling 👇",
    buttons: [watchButton],
  },
  {
    day: 1,
    timing: hoursBeforeExpiry(21),
    text: "{ism}, bu darsda arab tilini <b>qayerdan va qanday boshlashni</b> aniq bilib olasiz. Atigi 17 daqiqa, keyin yo‘lingiz ancha tushunarli bo‘ladi. Qolgan vaqt: {qolgan_vaqt}.",
    buttons: [watchButton],
  },
  {
    day: 1,
    timing: hoursBeforeExpiry(19),
    text: "Savol: arab tilini o‘rganishda sizga <b>eng qiyin narsa nima</b>? 🤔\n\nTalaffuzmi, grammatikami yoki qayerdan boshlashni bilmaslikmi? Dars aynan shu savollarga javob beradi. Ochiq qolgan vaqt: {qolgan_vaqt}.",
    buttons: [watchButton],
  },
  {
    day: 1,
    timing: hoursBeforeExpiry(17),
    text: "Darsni ko‘rgan o‘quvchilarimizning ko‘pchiligi: «Nega buni avvalroq bilmadim?» deb yozadi 😊\n\nSiz ham ko‘rib, o‘zingiz baho bering. Dars {qolgan_vaqt}dan keyin yopiladi.",
    buttons: [watchButton],
  },
  {
    day: 1,
    timing: hoursBeforeExpiry(15),
    text: "{ism}, bonus dars hali ochiq 🌿 Vaqtingiz bo‘lganda bir ko‘rib qo‘ying, {qolgan_vaqt} vaqtingiz bor.",
    buttons: [watchButton],
  },
  {
    day: 1,
    timing: hoursBeforeExpiry(10),
    text: "Bu darsdan olgan bilimingiz keyingi o‘rganishingizni <b>tezlashtiradi</b>, vaqt va kuchingizni tejaydi. Atigi 17 daqiqa, {qolgan_vaqt} ichida ko‘rib oling 👇",
    buttons: [watchButton],
  },
  {
    day: 1,
    timing: hoursBeforeExpiry(5),
    text: "⏳ {ism}, muddat yaqinlashmoqda: dars <b>{qolgan_vaqt}</b>dan keyin o‘chadi. Hoziroq ko‘rib oling 👇",
    buttons: [watchButton],
  },
  {
    day: 1,
    timing: hoursBeforeExpiry(4),
    text: "⏳ Dars {qolgan_vaqt}dan keyin o‘chadi. Ko‘rishga ulguring!",
    buttons: [watchButton],
  },
  {
    day: 1,
    timing: hoursBeforeExpiry(3),
    text: "⚠️ Atigi <b>{qolgan_vaqt}</b> qoldi. Darsni hozir oching 👇",
    buttons: [watchButton],
  },
  {
    day: 1,
    timing: hoursBeforeExpiry(2),
    text: "🔥 {ism}, <b>{qolgan_vaqt}</b> qoldi! 17 daqiqa topsangiz, ulguradi.",
    buttons: [watchButton],
  },
  {
    day: 1,
    timing: hoursBeforeExpiry(1),
    text: "🚨 <b>Oxirgi chaqiriq!</b> Dars {qolgan_vaqt}dan keyin o‘chadi va qaytib ochilmasligi mumkin. Hoziroq ko‘ring 👇",
    buttons: [watchButton],
  },
  { day: 1, timing: NIGHT_NOTICE, text: nightNoticeText, buttons: [watchButton] },
];

const segmentB: SeedTemplate[] = [
  {
    day: 1,
    timing: afterEntry(30),
    statuses: ["korishni_boshladi"],
    text: "Siz darsni boshladingiz, lekin yakunlamadingiz. Eng foydali joylari <b>oldinda</b>. Dars {qolgan_vaqt}dan keyin o'chadi.",
    buttons: [continueButton],
  },
  {
    day: 1,
    timing: afterEntry(30),
    statuses: ["dars_yarmida"],
    text: "Dars yarmidan oshdi. Eng foydali joylari <b>oldinda</b>. Dars {qolgan_vaqt}dan keyin o'chadi.",
    buttons: [{ kind: "resume", text: "Qolgan qismini ko‘rish" }, courseOnlyButton],
  },
  {
    day: 1,
    timing: afterEntry(30),
    statuses: ["sotuvda_toxtadi"],
    text: "Eng muhim joyiga yetdingiz, lekin <b>narx va shartlarni</b> eshitmay qoldingiz. Shu qismni 3–4 daqiqada ko'rishingiz mumkin.",
    buttons: [priceButton],
  },
  {
    day: 1,
    timing: afterEntry(180),
    text: "Dars {qolgan_vaqt}dan keyin o'chadi. Davom ettiring 👇",
    buttons: [continueButton],
  },
  {
    day: 1,
    timing: afterEntry(360),
    text: "{ism}, darsning oxirgi qismida <b>kurs sizga nima berishi</b> va kimlar uchun mos ekani aytiladi. Aynan shu joy ko‘pchilikning savollariga javob beradi 👇",
    buttons: [courseOnlyButton],
  },
  {
    day: 2,
    timing: dayAt(8),
    text: "Kecha <b>{toxtagan_joy}</b> da to'xtagan edingiz, qolgani atigi <b>{qolgan_daqiqa} daqiqa</b>. Davom ettiring 👇",
    buttons: [continueButton],
  },
  {
    day: 1,
    timing: hoursBeforeExpiry(5),
    text: "⏳ Dars <b>{qolgan_vaqt}</b>dan keyin o'chadi. Qolgan qismini ko‘rib oling 👇",
    buttons: [continueButton, courseOnlyButton],
  },
  {
    day: 1,
    timing: hoursBeforeExpiry(3),
    text: "⚠️ Shoshiling: atigi <b>{qolgan_vaqt}</b> qoldi. Narx va shartlar aytiladigan qismni ko‘rib oling 👇",
    buttons: [priceButton],
  },
  {
    day: 1,
    timing: hoursBeforeExpiry(1),
    text: "🚨 <b>Oxirgi chaqiriq!</b> Dars {qolgan_vaqt}dan keyin o‘chadi. Narx va shartlarni hoziroq ko‘ring 👇",
    buttons: [priceButton],
  },
  { day: 1, timing: NIGHT_NOTICE, text: nightNoticeText, buttons: [continueButton] },
];

const segmentC: SeedTemplate[] = [
  {
    day: 1,
    timing: afterEntry(15),
    text: "Dars qanday bo‘ldi? 😊 Savollaringiz bo‘lsa, admin <b>javob beradi</b>.",
    buttons: [adminButton],
  },
  {
    day: 1,
    timing: afterEntry(180),
    text: "{ism}, darsni ko‘rganlarning ko‘pchiligi keyingi qadamni shu yerda hal qiladi: kursga o‘z darajangizga mos joy bor-yo‘qligini adminga yozib so‘rang 👇",
    buttons: [adminButton],
  },
  {
    day: 2,
    timing: dayAt(10),
    text: "Dars sizga foydali bo‘ldimi? 🌿 <b>Joylar cheklangan</b>, savollaringiz bo‘lsa adminga yozing.",
    buttons: [adminButton],
  },
  {
    day: 3,
    timing: dayAt(10),
    text: "{ism}, oxirgi taklif: adminga yozing va <b>bepul konsultatsiya</b> oling. Sizga mos yo‘lni birga topamiz 🤝",
    buttons: [adminButton],
  },
];

export const seedTemplates: Record<FunnelSegment, SeedTemplate[]> = {
  A: segmentA,
  B: segmentB,
  C: segmentC,
};

export function seedInputs(segment: FunnelSegment): MessageTemplateInput[] {
  return seedTemplates[segment].map((template) => ({
    segment,
    day: template.day,
    text: template.text,
    media: null,
    timing: template.timing,
    buttons: template.buttons,
    isActive: true,
    statuses: template.statuses ?? null,
  }));
}

async function seedSegment(segment: FunnelSegment) {
  return db().transaction(async (tx) => {
    const [existing] = await tx
      .select({ total: count() })
      .from(messageTemplates)
      .where(and(eq(messageTemplates.segment, segment), isNull(messageTemplates.deletedAt)));
    if (existing.total > 0) return 0;
    const nextPositionByDay = new Map<number, number>();
    const rows = seedInputs(segment).map((input) => {
      const position = nextPositionByDay.get(input.day) ?? 0;
      nextPositionByDay.set(input.day, position + 1);
      return {
        segment,
        day: input.day,
        position,
        text: input.text,
        timingType: input.timing.type,
        timingValue: input.timing.value,
        buttons: input.buttons,
        isActive: input.isActive,
        statuses: input.statuses,
      };
    });
    await tx.insert(messageTemplates).values(rows);
    return rows.length;
  });
}

export async function seedStartingTemplates(): Promise<Record<FunnelSegment, number>> {
  return { A: await seedSegment("A"), B: await seedSegment("B"), C: await seedSegment("C") };
}
