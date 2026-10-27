TEXNIK TOPSHIRIQ (TZ)
Telegram Botda 7 Kunlik Voronka, 24 Soatlik Ruxsat Taymeri va Eslatmalarni Boshqarish Algoritmi

1. Loyiha Maqsadi va Hozirgi Muammolar Tahlili
Ushbu hujjat foydalanuvchilarni bepul dars (video) orqali sotuv voronkasidan o'tkazuvchi Telegram botning eslatmalar (followup) mexanizmini to'g'ri tashkil etish uchun ishlab chiqilgan.
Hozirgi tizimdagi hal qilinishi kerak bo'lgan 3 ta asosiy muammo:
Voronka kunlari (1–7-kun) va 24 soatlik video ruxsati o'rtasidagi mantiqiy ziddiyat:
Hozirgi holatda foydalanuvchi 1-kuni videoni ko'rib ulgurmasa va 24 soatdan so'ng video yopilsa, 2-kuni unga "Darsni qayta ochamizmi? -> [Ha, ko'raman]" taklifi boradi. Foydalanuvchi tugmani bosganda tizim uni 2-kun eslatmalar zanjiriga emas, yana qayta 1-kun eslatmalar zanjiriga tushirib yubormoqda. Natijada 2–7-kunlar uchun yozilgan eslatmalar zanjiri ishlamay qolmoqda.
Har bir kun (2–7-kunlar) uchun alohida "Qayta ochish taklifi" (Trigger xabar)ni admin paneldan to'liq tahrirlay olmaslik:
Video 24 soatda yopilgach, 2-kundan 7-kungacha har kuni foydalanuvchiga "darsingiz o'chib ketdi, qayta ochib beraylikmi?" mazmunidagi taklif xabari borishi kerak. Bu xabar har bir kun uchun 7 xil (2–7-kunlarda turlicha psixologik yondashuv bilan) yozilishi va admin panel orqali uning matni, mediasi, yuborilish vaqti hamda tugma yozuvlarigacha qo'lda erkin tahrirlanishi shart.
Xabarlarni o'chirib-yozish (Overwrite) mexanizmidagi cheklov:
Soatbay eslatmalar borganda chat toza turishi uchun eski eslatma o'chirilib, yangisi yuboriladi. Biroq, ba'zi muhim xabarlar (masalan, ustozning qiroatlari, o'quvchilarning video otzivlari, natijalar) keyingi soatdagi eslatma kelganda o'chib ketmasligi, chatda doimiy qolishi talab etiladi.

2. Arxitektura Yechimi: Ma'lumotlar Bazasi (Database) Strukturasi
Tizimni to'g'ri ishlashi uchun "Voronka kuni" (current_day) va "Videoga ruxsat holati" (access_status) bir-biridan mustaqil ikkita alohida parametr sifatida boshqarilishi shart (State Machine arxitekturasi).

2.1. users jadvali
- stage ENUM('A','B','C','DONE') — A: havolani oldi, videoni ochmadi. B: videoni ochib, qisman ko'rdi (narxgacha yetmadi). C: narx va taklif qismini ko'rdi. DONE: adminga yozdi (voronka to'xtatiladi).
- current_day INT (1..7) — «Ha, ko'raman» bosilganda hech qachon 1 ga qaytmaydi, faqat o'sadi.
- access_status ENUM('ACTIVE','EXPIRED_WAIT_OPTIN') — ACTIVE: 24 soatlik ruxsat faol, soatbay eslatmalar boradi. EXPIRED_WAIT_OPTIN: ruxsat tugagan, «Ha, ko'raman» kutilmoqda.
- access_expires_at TIMESTAMP — NOW() + 24 hours.
- stage_timer_base TIMESTAMP — nisbiy eslatmalar (+15m, +1h, +2h) uchun tayanch vaqt.
- last_replaceable_msg_id BIGINT NULL — o'chirilishi kerak bo'lgan oxirgi vaqtinchalik eslatma message_id.
- last_trigger_sent_day INT (1..7) — oxirgi yuborilgan TRIGGER_OPTIN kuni.

2.2. messages jadvali (har bir kun 1–7 va bosqich A, B, C uchun; hardcode qilinmaydi)
- stage ENUM('A','B','C')
- day INT (1..7)
- message_type ENUM('TRIGGER_OPTIN','HOURLY_REMINDER') — TRIGGER_OPTIN: 2–7-kunlarda video yopilgach qayta ochishni taklif qiluvchi kunlik xabar. HOURLY_REMINDER: bosqich ichidagi soatbay eslatmalar.
- trigger_send_time TIME NULL — faqat TRIGGER_OPTIN: yuboriladigan soat (masalan 10:00) yoki 24 soat to'lishi bilan yuborish rejimi.
- delay_minutes INT — faqat HOURLY_REMINDER: stage_timer_base ga nisbatan (+15, +60, +120...).
- is_permanent BOOLEAN default false — false: keyingisi kelganda o'chiriladi. true: chatda qoladi.
- text TEXT — HTML/Markdown, {first_name}.
- media_file_id / media_type VARCHAR NULL — rasm, video, audio qiroat, golosovoy.
- buttons_json JSONB — button_text + action (REOPEN_LESSON, OPEN_VIDEO_URL, CONTACT_ADMIN_URL, DISMISS), admin paneldan tahrirlanadi.
- is_active BOOLEAN default true.

3. Algoritm
3.1. 1-kun: /start → stage='A', current_day=1, access_status='ACTIVE', access_expires_at=NOW()+24h, stage_timer_base=NOW(). stage A, day 1 HOURLY_REMINDER lar (+15 daq, +1 soat, +2 soat...) stage_timer_base ga nisbatan yuboriladi.

3.2. Bosqich o'zgarishi
- A → B: videoni ochdi, narxgacha yetmay yopdi. stage='B', stage_timer_base=NOW() (to'xtatgan vaqt). current_day o'zgarmaydi! current_day va B eslatmalari boshlanadi.
- B → C: narx qismiga yetdi. stage='C', stage_timer_base=NOW(). current_day va C eslatmalari.
- C → DONE: adminga murojaat qildi. Barcha eslatmalar to'xtaydi.

3.3. 24 soat tugashi va 2–7-kunlar TRIGGER_OPTIN
Holat 1: A yoki B bosqich. NOW() >= access_expires_at bo'lganda:
- Pleyerda video bloklanadi. access_status='EXPIRED_WAIT_OPTIN' (soatbay eslatmalar to'xtaydi). current_day = current_day + 1 (agar > 7 bo'lsa voronka yakunlanadi).
- messages dan stage (A yoki B) va day=current_day uchun TRIGGER_OPTIN olinadi va yuboriladi. Har kunda har xil matn va tugma.
  Misol (2-kun): "Aziza, kecha darsni ko'rishga ulgurmadingiz va 24 soatlik ruxsat yopildi 🔒. Agar siz uchun istisno tariqasida darsni yana 24 soatga ochib bersak, bugun ko'rasizmi?" -> [ ✅ Ha, bugun ko'raman ]
  Misol (3-kun): "Ko'pchilik kundalik ishlar bilan bo'lib Qur'on o'rganishni orqaga suradi. Darsingiz yana yopilib qoldi. Sizga yana bir imkoniyat beraylikmi?" -> [ 🔓 Darsni qayta ochish ]
- action = REOPEN_LESSON tugma bosilganda (yozuvi har xil bo'lsa ham callback_data yagona reopen_lesson):
  access_status='ACTIVE', access_expires_at=NOW()+24h, stage_timer_base=NOW().
  ENG MUHIM QOIDA: current_day 1 ga qaytarilmaydi! Aynan o'sha kunning (current_day) va bosqichning (A yoki B) HOURLY_REMINDER (+30 daq, +1 soat, +2 soat...) zanjiri ishga tushadi.
- Tugmani bosmasa (yoki bosib, 24 soat ichida oxirigacha ko'rmasa): shu kuni boshqa soatbay eslatma bormaydi. Keyingi sutkada current_day+1 va navbatdagi kunning TRIGGER_OPTIN xabari. 7-kungacha davom etadi.
Holat 2: C bosqich (narxni ko'rgan, yozmagan): har yangi sutkada current_day+1. Tegishli kun (2..7) uchun stage C sotuv eslatmalari (qiroatlar, otzivlar, chegirma muddatlari, adminga yozish tugmalari) jadval bo'yicha. (Ixtiyoriy: admin C ning 2–7-kunlariga kirish xabari qo'sha oladi.)

4. O'chadigan va doimiy xabarlar
sendReminderMessage(user, template):
1. user.last_replaceable_msg_id bo'lsa deleteMessage (xatoni e'tiborsiz qoldirish, 48 soatdan oshgan bo'lishi mumkin), keyin NULL.
2. buttons_json dan inline klaviatura (REOPEN_LESSON → callback_data doim "reopen_lesson").
3. Yangi xabarni yuborish (matn, media, tugmalar).
4. is_permanent true → last_replaceable_msg_id = NULL (keyingilar o'chira olmaydi). false → last_replaceable_msg_id = sent.message_id.
Misol: +1h matn (ID 101, saqlanadi). +2h qiroat permanent: 101 o'chadi, 102 yuboriladi, NULL. +3h eslatma: 102 o'chmaydi, 103 yuboriladi va saqlanadi. +4h: faqat 103 o'chadi, 102 qoladi.

5. Admin panel o'zgarishlari
- A va B bosqichlarning 2–7-kun sahifalarining eng tepasida "🔒 Video yopilganda boradigan taklif xabari (Kunni boshlovchi xabar)" kartochkasi. Har kun uchun alohida: yuborilish vaqti (masalan 10:00 da yoki 24 soat tugashi bilan); matn (7 kunga 7 xil) va media (rasm/video/audio); tugma yozuvlari (1-tugma: "✅ Ha, bugun ko'raman" → darsni 24 soatga qayta ochish; 2-tugma ixtiyoriy: "Keyinroq" va h.k.).
- Kartochka ostida o'sha kunning HOURLY_REMINDER ro'yxati (+30 daq, +1 soat, +2 soat...). Taklifdagi tugma bosilishi bilan aynan shu ro'yxat ishga tushadi.
- Barcha xabarlarda matn, media, tugma yozuvlari/havolalari to'liq tahrirlanadi.
- 1-kunga qaytarish mantiqi bekor qilinsin: reopen_lesson bosilganda current_day=1 qiluvchi mantiq olib tashlansin. Nolga tushirish faqat qayta /start yoki admin paneldan majburiy bajarilganda.
- Har bir xabar formasida 📌 "Xabar o'chirilmasin (Chatda doimiy qolsin)" (is_permanent) kommutatori.
