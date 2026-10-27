import { and, count, eq, isNull } from "drizzle-orm";
import {
  type FunnelSegment,
  type FunnelStatus,
  type MessageTemplateInput,
  type TemplateButton,
  type TemplateKind,
} from "@funnel/shared";
import { db } from "@/db";
import { messageTemplates } from "@/db/schema";

type SeedTemplate = {
  day: number;
  minute: number;
  kind?: TemplateKind;
  text: string;
  buttons: TemplateButton[];
  statuses?: FunnelStatus[];
};

const MINUTES_PER_HOUR = 60;

const watchButton: TemplateButton = { kind: "resume", text: "▶ Videoni ko‘rish" };
const continueButton: TemplateButton = { kind: "resume", text: "▶ Davom ettirish" };
const courseOnlyButton: TemplateButton = { kind: "offer", text: "Faqat kurs haqidagi qism" };
const priceButton: TemplateButton = { kind: "offer", text: "Narx va shartlarni ko‘rish" };
const reopenButton: TemplateButton = { kind: "again", text: "✅ Ha, bugun ko‘raman" };
const adminButton: TemplateButton = { kind: "admin", text: "✍️ Adminga yozish", prefill: "Bonus darsni ko‘rdim" };

const segmentA: SeedTemplate[] = [
  {
    day: 1,
    minute: 60,
    text: "Assalomu alaykum, {ism}! 👋\n\n<b>Bonus dars</b> sizni kutyapti. Dars yana {qolgan_vaqt} ochiq turadi, qulay payt topib ko‘rib oling 👇",
    buttons: [watchButton],
  },
  {
    day: 1,
    minute: 180,
    text: "{ism}, bu darsda arab tilini <b>qayerdan va qanday boshlashni</b> aniq bilib olasiz. Qisqa dars, lekin keyin yo‘lingiz ancha tushunarli bo‘ladi. Qolgan vaqt: {qolgan_vaqt}.",
    buttons: [watchButton],
  },
  {
    day: 1,
    minute: 300,
    text: "Savol: arab tilini o‘rganishda sizga <b>eng qiyin narsa nima</b>? 🤔\n\nTalaffuzmi, grammatikami yoki qayerdan boshlashni bilmaslikmi? Dars aynan shu savollarga javob beradi. Ochiq qolgan vaqt: {qolgan_vaqt}.",
    buttons: [watchButton],
  },
  {
    day: 1,
    minute: 420,
    text: "Darsni ko‘rgan o‘quvchilarimizning ko‘pchiligi: «Nega buni avvalroq bilmadim?» deb yozadi 😊\n\nSiz ham ko‘rib, o‘zingiz baho bering. Dars {qolgan_vaqt}dan keyin yopiladi.",
    buttons: [watchButton],
  },
  {
    day: 1,
    minute: 540,
    text: "{ism}, bonus dars hali ochiq 🌿 Vaqtingiz bo‘lganda bir ko‘rib qo‘ying, {qolgan_vaqt} vaqtingiz bor.",
    buttons: [watchButton],
  },
  {
    day: 1,
    minute: 840,
    text: "Bu darsdan olgan bilimingiz keyingi o‘rganishingizni <b>tezlashtiradi</b>, vaqt va kuchingizni tejaydi. Ko‘p vaqt olmaydi, {qolgan_vaqt} ichida ko‘rib oling 👇",
    buttons: [watchButton],
  },
  {
    day: 1,
    minute: 1140,
    text: "⏳ {ism}, muddat yaqinlashmoqda: dars <b>{qolgan_vaqt}</b>dan keyin o‘chadi. Hoziroq ko‘rib oling 👇",
    buttons: [watchButton],
  },
  {
    day: 1,
    minute: 1200,
    text: "⏳ Dars {qolgan_vaqt}dan keyin o‘chadi. Ko‘rishga ulguring!",
    buttons: [watchButton],
  },
  {
    day: 1,
    minute: 1260,
    text: "⚠️ Atigi <b>{qolgan_vaqt}</b> qoldi. Darsni hozir oching 👇",
    buttons: [watchButton],
  },
  {
    day: 1,
    minute: 1320,
    text: "🔥 {ism}, <b>{qolgan_vaqt}</b> qoldi! Biroz vaqt topsangiz, ulgurasiz.",
    buttons: [watchButton],
  },
  {
    day: 1,
    minute: 1380,
    text: "🚨 <b>Oxirgi chaqiriq!</b> Dars {qolgan_vaqt}dan keyin o‘chadi va qaytib ochilmasligi mumkin. Hoziroq ko‘ring 👇",
    buttons: [watchButton],
  },
];

const segmentB: SeedTemplate[] = [
  {
    day: 1,
    minute: 30,
    statuses: ["korishni_boshladi"],
    text: "Siz darsni boshladingiz, lekin yakunlamadingiz. Eng foydali joylari <b>oldinda</b>. Dars {qolgan_vaqt}dan keyin o'chadi.",
    buttons: [continueButton],
  },
  {
    day: 1,
    minute: 30,
    statuses: ["dars_yarmida"],
    text: "Dars yarmidan oshdi. Eng foydali joylari <b>oldinda</b>. Dars {qolgan_vaqt}dan keyin o'chadi.",
    buttons: [{ kind: "resume", text: "Qolgan qismini ko‘rish" }, courseOnlyButton],
  },
  {
    day: 1,
    minute: 30,
    statuses: ["sotuvda_toxtadi"],
    text: "Eng muhim joyiga yetdingiz, lekin <b>narx va shartlarni</b> eshitmay qoldingiz. Shu qismni 3–4 daqiqada ko'rishingiz mumkin.",
    buttons: [priceButton],
  },
  {
    day: 1,
    minute: 180,
    text: "Dars {qolgan_vaqt}dan keyin o'chadi. Davom ettiring 👇",
    buttons: [continueButton],
  },
  {
    day: 1,
    minute: 360,
    text: "{ism}, darsning oxirgi qismida <b>kurs sizga nima berishi</b> va kimlar uchun mos ekani aytiladi. Aynan shu joy ko‘pchilikning savollariga javob beradi 👇",
    buttons: [courseOnlyButton],
  },
  {
    day: 2,
    minute: 10 * MINUTES_PER_HOUR,
    kind: "trigger",
    text: "Kecha <b>{toxtagan_joy}</b> da to'xtagan edingiz va 24 soatlik ruxsat yopildi 🔒. Darsni yana 24 soatga ochib beraylikmi?",
    buttons: [reopenButton],
  },
  {
    day: 1,
    minute: 1140,
    text: "⏳ Dars <b>{qolgan_vaqt}</b>dan keyin o'chadi. Qolgan qismini ko‘rib oling 👇",
    buttons: [continueButton, courseOnlyButton],
  },
  {
    day: 1,
    minute: 1260,
    text: "⚠️ Shoshiling: atigi <b>{qolgan_vaqt}</b> qoldi. Narx va shartlar aytiladigan qismni ko‘rib oling 👇",
    buttons: [priceButton],
  },
  {
    day: 1,
    minute: 1380,
    text: "🚨 <b>Oxirgi chaqiriq!</b> Dars {qolgan_vaqt}dan keyin o‘chadi. Narx va shartlarni hoziroq ko‘ring 👇",
    buttons: [priceButton],
  },
];

const segmentC: SeedTemplate[] = [
  {
    day: 1,
    minute: 15,
    text: "Dars qanday bo‘ldi? 😊 Savollaringiz bo‘lsa, admin <b>javob beradi</b>.",
    buttons: [adminButton],
  },
  {
    day: 1,
    minute: 180,
    text: "{ism}, darsni ko‘rganlarning ko‘pchiligi keyingi qadamni shu yerda hal qiladi: kursga o‘z darajangizga mos joy bor-yo‘qligini adminga yozib so‘rang 👇",
    buttons: [adminButton],
  },
  {
    day: 2,
    minute: 10 * MINUTES_PER_HOUR,
    text: "Dars sizga foydali bo‘ldimi? 🌿 <b>Joylar cheklangan</b>, savollaringiz bo‘lsa adminga yozing.",
    buttons: [adminButton],
  },
  {
    day: 3,
    minute: 10 * MINUTES_PER_HOUR,
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
    minute: template.minute,
    buttons: template.buttons,
    isActive: true,
    statuses: template.statuses ?? null,
    kind: template.kind ?? "reminder",
    atExpiry: false,
    isPermanent: false,
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
        timingValue: input.minute,
        buttons: input.buttons,
        isActive: input.isActive,
        statuses: input.statuses,
        kind: input.kind,
      };
    });
    await tx.insert(messageTemplates).values(rows);
    return rows.length;
  });
}

export async function seedStartingTemplates(): Promise<Record<FunnelSegment, number>> {
  return { A: await seedSegment("A"), B: await seedSegment("B"), C: await seedSegment("C") };
}
