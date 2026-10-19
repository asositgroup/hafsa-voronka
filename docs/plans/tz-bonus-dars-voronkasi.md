# Bonus dars voronkasi — texnik topshiriq (mijoz matni)

Mijozdan olingan asl matn. 1–6-bo'limlar keyin yuborilgan, 7–9-bo'limlar birinchi bo'lib kelgan.

Telegram bot uchun texnik topshiriq (qoralama)

## 1. Cheklangan vaqtli link (24 soat) va eslatmalar

Link berilgach ko'rishni boshlamasa

| Link berilganidan | Qolgan vaqt | Xabar ohangi |
|---|---|---|
| 1-soat | 23 soat | Salomlashish: «Bonus dars sizni kutyapti», link tugmasi |
| 3-soat | 21 soat | Qiziqish uyg'otish: darsda nima o'rganishini 1 jumlada aytish |
| 5-soat | 19 soat | Savol bilan: «Arab tilini o'rganishda eng qiyin narsa nima?» |
| 7-soat | 17 soat | Ijtimoiy isbot: boshqa o'quvchi fikri/skrinshot |
| 9-soat | 15 soat | Yumshoq eslatma |
| 14-soat | 10 soat | Foydani eslatish |
| 19-soat | 5 soat | Muddat yaqinlashmoqda |
| 20, 21, 22-soat | 4, 3, 2 soat | Qisqa va shoshilinch |
| 23-soat | 1 soat | Oxirgi chaqiriq |

Tungi vaqt: Tungi vaqtda (23:00–07:00) xabar yuborilmaydi. To'liq qoida va misollar pastda (1.1-band).
Foydalanuvchi videoni ko'rishi bilan qolgan barcha eslatmalar to'xtaydi.

### 1.1. Tungi vaqt qoidasi (23:00–07:00) — 24 soatlik muddat tunga to'g'ri kelsa

1-qoida: eslatmalar link berilgan vaqtdan emas, «link o'chish vaqti»dan orqaga hisoblanadi (jadvaldagi «Qolgan vaqt» ustuni). Muddat o'zgarsa, eslatmalar ham avtomatik qayta hisoblanadi.
2-qoida: link o'chish vaqti tunga (23:00–07:00) to'g'ri kelsa, muddat ertalab soat 09:00 gacha uzaytiriladi. Sabab: odam uxlab yotganida link o'chib qolsa, «oxirgi chaqiriq» xabarlari tunga tushadi va bekor ketadi.
3-qoida: tunga tushgan eslatmalar alohida-alohida yuborilmaydi. Ulardan faqat eng shoshilinchi (eng kam vaqt qolgani) ertalab 07:30 da 1 marta yuboriladi, matnidagi [X] soat esa yuborilayotgan paytdagi haqiqiy qolgan vaqt bilan to'ldiriladi.
4-qoida: agar ertalabki ko'chirilgan xabar bilan rejadagi boshqa eslatma orasida 1 soatdan kam bo'lsa, ko'chirilgani tashlab yuboriladi (ketma-ket 2 ta xabar bormasin).
5-qoida: tun 2 va undan ko'p eslatmani «yutib» yuborsa, soat 22:00 da bitta kechki xabar boradi: «Bugun ulgurmasangiz, ertaga soat [HH:MM] gacha vaqtingiz bor».
6-qoida: odam botga tunda kirsa (masalan 02:00 da), link darhol beriladi, lekin birinchi eslatma 07:30 dan oldin yuborilmaydi.
7-qoida: foydalanuvchi videoni ochishi bilan bu zanjir to'xtaydi (3-bo'lim zanjiri boshlanadi).

Misollar (dastur hisoblagan jadval):

| Link berildi | Link o'chadi | Eslatmalar qachon boradi |
|---|---|---|
| 10:00 | ertaga 10:00 | bugun 11:00 (23 soat qoldi); bugun 13:00 (21 soat qoldi); bugun 15:00 (19 soat qoldi); bugun 17:00 (17 soat qoldi); bugun 19:00 (15 soat qoldi); bugun 22:00 (kechki ogohlantirish); ertaga 07:00 (3 soat qoldi); ertaga 08:00 (2 soat qoldi); ertaga 09:00 (1 soat qoldi) |
| 22:30 | ertaga 22:30 | ertaga 07:30 (15 soat qoldi); ertaga 12:30 (10 soat qoldi); ertaga 17:30 (5 soat qoldi); ertaga 18:30 (4 soat qoldi); ertaga 19:30 (3 soat qoldi); ertaga 20:30 (2 soat qoldi); ertaga 21:30 (1 soat qoldi) |
| 02:00 | ertaga 09:00 (tunga to'g'ri kelgani uchun 09:00 gacha uzaytirildi) | bugun 10:00 (23 soat qoldi); bugun 12:00 (21 soat qoldi); bugun 14:00 (19 soat qoldi); bugun 16:00 (17 soat qoldi); bugun 18:00 (15 soat qoldi); bugun 22:00 (kechki ogohlantirish); ertaga 07:00 (2 soat qoldi); ertaga 08:00 (1 soat qoldi) |

## 2. Link o'chgandan keyin ("afsus" xabari)

"Afsus, bonus dars o'chib ketdi. Sizga yana bir imkon bersak, darsni ko'rgan bo'lar edingizmi?"
Tugmalar: Ha, ko'raman / Keyinroq, ko'raman

"Ha" bosilsa, link 1 marta, 24 soatga qayta ochiladi.

«Keyinroq, ko'raman» bosilsa, odamdan qachon ko'rishi so'raladi va o'sha vaqtga eslatma qo'yiladi:
Bot xabari: «Yaxshi! Qachon ko'rishingiz qulay? Shu vaqtda darsni siz uchun qayta ochib, eslatib qo'yaman.»
Tugmalar: Bugun kechqurun (20:00) / Ertaga ertalab (08:00) / Ertaga kechqurun (20:00) / Boshqa vaqt
«Boshqa vaqt» bosilsa — soat va kunni tugmalar bilan tanlaydi (kun: bugun/ertaga/indinga; soat: 07:00–22:00 oralig'ida har 1 soat). Tungi soat (23:00–07:00) tanlab bo'lmaydi.
Saqlash: bazaga tanlangan_vaqt saqlanadi, status: qayta_imkon_kutilmoqda.
Eslatma 1: tanlangan vaqtdan 1 soat oldin — «1 soatdan keyin bonus darsingiz ochiladi, choy tayyorlab qo'ying 🙂».
Eslatma 2: tanlangan vaqtda — yangi video/link yuboriladi (24 soatga) va 1-bo'limdagi eslatmalar zanjiri shu vaqtdan qaytadan boshlanadi (tungi qoida bilan).
Takror: agar tanlangan vaqtdan keyin ham ko'rmasa, link o'chgach yana «afsus» xabari boradi (yangi matn bilan). Bu 1 hafta ichida, kuniga ko'pi bilan 1 marta, jami 7 martagacha takrorlanadi. 7 kundan keyin bot bu odamga bonus taklif qilishni to'xtatadi.
Matnlar: har bir kun uchun alohida «afsus» matni (matnlar banki: 1-kun, 2-kun ... 7-kun). Bir xil matn ikki marta yuborilmaydi.
Qayta imkon faqat 1 hafta ichida har kuni beriladi, shunda bonus qiymatini yo'qotmaydi.

## 3. Videoni oxirigacha ko'rmaganlar (sotuv qismini ko'rmaganlar)

Maqsad: videoni boshlagan, lekin yarmida tashlab ketgan odamga sotuv qismini yetkazish.
Muammo: ko'pchilik 1–5 daqiqa ko'rib to'xtaydi va eng muhim joyga (dars kimlar uchun, kursda nima bor, narxi qancha) yetib bormaydi. Taklifni bilmagan odam adminga ham yozmaydi. Shuning uchun bu odamlarga alohida ishlanadi.

### 3.1. Videodagi muhim nuqtalar

| Daqiqa | Qism | Bot uchun ahamiyati |
|---|---|---|
| 0:00–15:00 | Foydali dars qismi | Odamni ushlab turadi, ishonch hosil qiladi |
| 15:00–18:22 | Sotuv qismi: dars kimlar uchun, kursda nimalar bor | Taklif bilan tanishtiradi |
| 18:22 | Kursning aniq narxi aytiladi | Eng muhim nuqta: narxni eshitgan odam adminga yozishga tayyor |
| 18:22 dan keyin | Narxdan keyingi qism va video yakuni | Ko'rgan deb hisoblanadi, 4-bo'limga (progrev) o'tadi |

### 3.2. Ko'rish darajasi (statuslar)

| Status | To'xtagan joy | Ma'nosi |
|---|---|---|
| ko'rishni_boshladi | 0:00–5:00 | Boshida tashlab ketgan |
| dars_yarmida | 5:00–15:00 | Foydali qismni ko'rgan, sotuvga yetmagan |
| sotuvda_toxtadi | 15:00–18:22 | Sotuv boshlangan, narxni eshitmagan |
| narxni_kurdi | 18:22 va keyin | Taklifni ko'rgan, 4-bo'lim bo'yicha ishlanadi |

Asosiy ko'rsatkich: narxni (18:22) eshitgan yoki eshitmagani. Faqat narxgacha yetmaganlarga shu bo'lim ishlaydi.

### 3.3. Qachon «tashlab ketdi» deb hisoblanadi

Videoni narx qismiga yetilmagan bo'lsa.

### 3.4. Xabarlar: to'xtagan joyiga qarab

| To'xtagan joy | Xabar matni | Tugma |
|---|---|---|
| 0:00–5:00 | "Siz darsni boshladingiz, lekin yakunlamadingiz. Eng foydali joylari oldinda. Dars [X] soatdan keyin o'chadi." | Davom ettirish (B variantda to'xtagan soniyadan) |
| 5:00–15:00 | "Dars yarmidan oshdi. Eng foydali joylari oldinda. Dars [X] soatdan keyin o'chadi." | Qolgan qismini ko'rish / Faqat kurs haqidagi qism |
| 15:00–18:22 | "Eng muhim joyiga yetdingiz, lekin narx va shartlarni eshitmay qoldingiz. Shu qismni 3–4 daqiqada ko'rishingiz mumkin." | Narx va shartlarni ko'rish |

### 3.6. Eslatma tartibi

| Qachon | Nima yuboriladi |
|---|---|
| To'xtaganidan 30 daqiqa keyin | 3.4 dagi xabar (to'xtagan joyiga mos), tugmasi to'xtagan joydan davom ettiradi |
| To'xtaganidan 3 soat keyin | Qisqa eslatma: «Dars [X] soatdan keyin o'chadi», tugma: Davom ettirish |
| To'xtaganidan 6 soat keyin | Foydani eslatish: narx qismida nima borligini 1 jumla bilan qiziqtirish (narxni aytmasdan) |
| Ertasi kuni ertalab 08:00–09:00 | «Kecha [MM:SS] da to'xtagan edingiz, qolgani [N] daqiqa». Tugma: Davom ettirish |
| Link o'chishidan 5 soat oldin | «Dars 5 soatdan keyin o'chadi». Tugma: Davom ettirish / Faqat kurs haqidagi qism |
| Link o'chishidan 3 soat oldin | Shoshilinch: «3 soat qoldi». Tugma: Narx va shartlarni ko'rish |
| Link o'chishidan 1 soat oldin | Oxirgi chaqiriq. Tugma: Narx va shartlarni ko'rish |

Bir odamga bir vaqtda bitta eslatma zanjiri ishlaydi: video ochilishi bilan 1-bo'limdagi «ko'rmaganlarga» eslatmalar to'xtaydi va shu zanjir boshlanadi.
Ko'pi bilan 7 ta xabar (1-bo'limda yuborilganlar bilan birga sanalmaydi, lekin kuniga 4 tadan oshmaydi), shunda odam zerikib botni bloklamaydi. Tungi xabarlar 1.1-banddagi qoida bo'yicha ko'chiriladi.
Tungi 23:00–07:00 oralig'ida xabar yuborilmaydi, ertalab 7:00–8:00 ga suriladi.
Quyidagi holatlarda zanjir to'xtaydi: narxni_kurdi, adminga_yozdi, bloklagan.

### 3.8. Link o'chgandan keyin (2-bo'lim bilan bog'liqligi)

Agar link o'chguncha odam narx qismiga yetmagan bo'lsa, 2-bo'limdagi «afsus» xabari unga boshqacha matn bilan boradi:
"Siz darsning eng muhim qismini, ya'ni kurs haqidagi qismni ko'rmay qoldingiz. Yana imkon bersak, ko'rarmidingiz?"
«Ha» bosilsa, to'liq video o'rniga avval qisqa «Kurs haqida» videosi ochiladi.

### 3.9. Natijani o'lchash

Nechta odam 5 daqiqagacha tashlab ketdi, nechtasi 15:00 ga yetdi, nechtasi 18:22 ga yetdi.
Eslatmadan keyin nechta odam narx qismini ko'rdi.
Narx qismini ko'rganlardan nechtasi adminga yozdi.
Bu raqamlar videoning aynan qaysi joyi odamlarni yo'qotayotganini ko'rsatadi.

## 4. Ko'rdi, lekin adminga yozmadi (progrev)

Maqsad: ko'rgan odamni adminga yozishga olib kelish.
Bu bo'lim narx qismini (18:22) ko'rganlarga ishlaydi. Narxgacha yetmaganlar 3-bo'limga tushadi.
Ko'rgandan 10–15 daqiqa keyin: "Dars qanday bo'ldi? Savollaringiz bo'lsa, admin javob beradi." Tugma: Adminga yozish.
3 soat keyin: natija yoki izoh (boshqa o'quvchining fikri).
Ertasi kuni: "Dars sizga foydali bo'ldimi? Joylar cheklangan."
2–3 kundan keyin: oxirgi taklif, masalan bepul konsultatsiya.
"Adminga yozish" tugmasi oldindan yozilgan matn bilan ochilsa (t.me/admin?text=Bonus darsni ko'rdim), yozish osonlashadi. Admin yozgan odamni ko'rishi va botga "yozdi" deb belgilashi kerak, shunda progrev o'chadi.

## 5. Bot holatlari (statuslar)

link_berildi → ko'rdi → adminga_yozdi
yoki: link_ochdi_kurmadi → link_ochdi → qayta_imkon → eslatma
Qisman ko'rganlar uchun (3-bo'lim): ko'rishni_boshladi → dars_yarmida → sotuvda_toxtadi → narxni_kurdi → adminga_yozdi
Har bir status uchun qaysi eslatma ketishi va qachon to'xtashi aniq belgilanadi.

Linkni 24 soatda o'chirish
Video botning o'zi orqali yuborilsa: send_video da protect_content=true, message_id bazaga saqlanadi, 24 soatdan keyin bot deleteMessage bilan o'chiradi (shaxsiy chatda bot o'z xabarini 48 soat ichida o'chira oladi).
Eski eslatmalarni o'chirish: link/video o'chirilganda shu linkga tegishli barcha eslatma xabarlari ham o'chiriladi. Buning uchun har bir yuborilgan eslatmaning message_id si bazaga yoziladi (jadval: eslatma_xabarlari: user_id, message_id, yuborilgan_vaqt, link_id).
Yangisini yuborishda: yangi eslatma yuborilishidan oldin oldingi eslatma o'chiriladi — chatda doim faqat 1 ta oxirgi eslatma turadi. 48 soatdan oshgan xabarni Telegram o'chirtirmaydi, shuning uchun o'chirish kechiktirilmaydi.
Har kuni boshqa matn: har kun uchun alohida matnlar banki (kamida 7 kunlik). Bot bir odamga yuborgan matn ID larini saqlaydi va takrorlamaydi.
Qayta imkon berilganda xuddi shu usulda yangi video/link yuboriladi

Eslatmalar uchun texnik qism
Har foydalanuvchi uchun bazada: link_berildi_vaqt, status, tanlangan_vaqt, video_message_id.
Rejalashtiruvchi (scheduler) har daqiqada tekshiradi: kimga qaysi eslatma vaqti kelgan.
Foydalanuvchi botni bloklagan bo'lsa (403 Forbidden), status "bloklagan" ga o'tadi va eslatmalar to'xtaydi.
Tungi 23:00–07:00 oralig'ida xabar yuborilmaydi, ertalabga suriladi.

## 6. Veb panelda videoni to'xtagan joydan davom ettirish (TZ)

Muammo: botdan veb panelga (Mini App, /app/watch) qayta kirilganda video boshidan boshlanib qolyapti. 5 daqiqa ko'rgan odam o'sha 5 daqiqani qayta ko'rishni istamaydi va chiqib ketadi.
Maqsad: (1) qayta kirganda video to'xtagan joydan davom etadi; (2) ko'rmagan qismiga oldinga sakrab bo'lmaydi — video etapma-etap ko'riladi; (3) ko'rib bo'lgan joyigacha bemalol orqaga/oldinga yurish mumkin.

### 6.1. Joriy holat (sayt kodi tekshirildi)

Mantiq aslida yozilgan: sahifa ochilganda serverdan progress.lastPosition va maxPosition olinadi va video lastPosition ga o'tkaziladi; har 10 soniyada /app/progress ga pozitsiya yuboriladi; oldinga sakrash maxPosition gacha cheklangan (seekLock).
Lekin amalda ishlamayapti — demak muammo shu zanjirning bir joyida uziladi. Dasturchi quyidagi 5 ta sababni tekshirishi kerak:
1) server lastPosition ni saqlamayapti yoki yangi link/sessiyada 0 ga tushiryapti. Tekshiruv: 3 daqiqa ko'rib yopish, so'ng /app/session javobida lastPosition qanchaligini ko'rish.
2) video serveri Range so'rovlarini (HTTP 206) qo'llamaydi — bunda brauzer videoni o'rtasidan boshlay olmaydi va 0:00 dan boshlaydi. Tekshiruv: curl -I -H "Range: bytes=1000-2000" <video_url> → 206 Partial Content va Accept-Ranges: bytes bo'lishi shart.
3) iPhone/Telegram WebView loadedmetadata paytida currentTime ni e'tiborsiz qoldiradi. Yechim: pozitsiyani loadedmetadata, canplay va birinchi play hodisasida qayta qo'yish, 0.5 soniyadan keyin tekshirish (agar currentTime < kerakli − 2 bo'lsa, yana qo'yish).
4) Mini App yopilganda (swipe/×) visibilitychange chiqmay qolishi mumkin va oxirgi 10 soniya yo'qoladi. Yechim: tick har 5 soniyada; qo'shimcha ravishda pagehide, Telegram.WebApp 'viewportChanged'/onEvent('close') da sendBeacon.
5) /app/session javobi keshlanib qolgan (eski 0 qiymat). Yechim: Cache-Control: no-store.

### 6.2. Talablar

Progress serverda: server har foydalanuvchi uchun saqlaydi: lastPosition (oxirgi to'xtagan joy), maxPosition (eng uzoq ko'rgan joy), updated_at, status (3.2-bo'lim). Yangi qayta imkon/link berilganda progress O'CHIRILMAYDI.
Aldovdan himoya: server faqat oldingi maxPosition + (o'tgan vaqt × 2.2) dan katta bo'lmagan qiymatni qabul qiladi (2× tezlik + zaxira). Shunda soxta so'rov bilan «narxni ko'rdi» statusini olish mumkin bo'lmaydi.
Zaxira nusxa: Telegram CloudStorage (yoki localStorage) ga ham har 5 soniyada pozitsiya yoziladi. Ochilganda server va lokal qiymatdan kattasi olinadi (lekin maxPosition dan oshmaydi).
Davom ettirish oynasi: ochilganda lastPosition > 30 soniya bo'lsa, ekranda: «Siz 5:12 da to'xtagan edingiz» + tugmalar «▶ Davom ettirish» (asosiy) / «↺ Boshidan». Davom ettirish 5 soniya orqadan boshlaydi (kontekst uchun).
Etapma-etap ko'rish (seekLock): maxPosition dan oldinga sakrab bo'lmaydi; maxPosition gacha erkin. Progress chizig'ida ko'rilgan qism boshqa rangda; yopiq qismga bosilsa «Bu qismni ko'rish uchun videoni davom ettiring» xabari chiqadi. Tezlik 1×, 1.25×, 1.5×, 2× ruxsat etiladi.
Ko'rib bo'lgandan keyin: video oxirigacha (yoki 18:22 narx nuqtasidan keyin) ko'rilgach seekLock o'chadi, video erkin bo'ladi.
Bot tugmalari: botdagi eslatma tugmalari Mini App ni parametr bilan ochadi: startapp=resume (to'xtagan joydan), startapp=offer (to'g'ridan 15:00 kurs haqidagi qismga — bu tugma faqat 3.4-bo'limdagi «Faqat kurs haqidagi qism» uchun; bu holatda seekLock shu qismga ruxsat beradi).
Statusga ulash: har 5 soniyalik tick bilan status (ko'rishni_boshladi / dars_yarmida / sotuvda_toxtadi / narxni_kurdi) serverda maxPosition bo'yicha yangilanadi va 3-bo'lim eslatmalari shunga qarab tanlanadi.

### 6.3. Qabul qilish testi (dasturchi topshirishdan oldin)

Test 1. Android Telegram: 3:00 gacha ko'rib Mini App ni yopish → botdagi tugma bilan qayta ochish → «2:55 dan davom etadi».
Test 2. iPhone Telegram va Telegram Desktop da xuddi shu test.
Test 3. 3:00 da to'xtagan odam progress chizig'ini 10:00 ga bosadi → 3:00 da qoladi va ogohlantirish chiqadi; 1:00 ga bosadi → bemalol o'tadi.
Test 4. internetni o'chirib-yoqish, ilovani majburan yopish: yo'qotilgan progress 5 soniyadan oshmasligi kerak.
Test 5. qayta imkon (2-bo'lim) berilganda progress saqlanib qolishi kerak.
Test 6. curl bilan video URL Range so'roviga 206 javob berishi.

## 7. Admin panel: 7 kunlik xabarlar konstruktori

Maqsad: xabar matnlari va vaqtlari kodga yozilmaydi — hammasi admin paneldan boshqariladi. Admin dasturchisiz matn qo'shadi, o'zgartiradi, o'chiradi.

### 7.1. Tuzilma

3 ta segment: A) link_berildi, video ochilmagan; B) video ochilgan, narx nuqtasiga yetmagan (ko'rishni_boshladi / dars_yarmida / sotuvda_toxtadi); C) narxni_kurdi, lekin adminga_yozdi emas.
Kunlar: har segmentda 7 ta kun sahifasi (1-kun … 7-kun). Kun = foydalanuvchi segmentga tushgan paytdan boshlab hisoblanadi.
Xabarlar: har kun sahifasida cheksiz xabar ("+ xabar qo'shish"), tartibini sudrab o'zgartirish mumkin.

### 7.2. Bitta xabar maydonlari

Kontent: matn (Telegram formatlash: qalin, kursiv, havola), ixtiyoriy media (rasm / video / ovozli xabar).
Yuborish vaqti: 3 turdan biri: (a) segmentga tushgandan +N daqiqa/soat; (b) kunning aniq soati (masalan 09:00); (c) link o'chishidan −N soat. Tungi vaqt (23:00–07:00) kiritib bo'lmaydi; (a)/(c) tunga tushsa 1.1-band qoidasi ishlaydi.
Tugmalar: 0–3 ta inline tugma. Har biriga: matn + amal (videoni ochish: resume / offer; adminga yozish: t.me/<admin>?text=...; «Qachon ko'rasiz?» menyusi; «Ha, ko'raman» / «Keyinroq»; tashqi havola).
O'zgaruvchilar: {ism}, {qolgan_vaqt}, {toxtagan_joy}, {qolgan_daqiqa}, {link_tugash_vaqti}. Noma'lum o'zgaruvchi saqlashda xato beradi.
Holat: yoqilgan/o'chirilgan (is_active). O'chirilgani yuborilmaydi, lekin saqlanib turadi.
Sinov: «Menga sinab yuborish» — xabarni o'zgaruvchilar to'ldirilgan holda adminning o'ziga yuboradi.

### 7.3. Yuborish qoidalari

Bo'sh kun: kunga xabar yozilmagan bo'lsa — o'sha kuni hech narsa yuborilmaydi (boshqa kun matni qayta ishlatilmaydi).
Segment almashinuvi: segment o'zgarsa (A→B, B→C, C→adminga_yozdi) eski segment navbati bekor qilinadi, yangi segment 1-kundan boshlanadi. Bir odamda bir vaqtda faqat bitta zanjir.
Eski xabarni o'chirish: yangi xabar yuborilishidan oldin shu odamga yuborilgan oldingi eslatma deleteMessage bilan o'chiriladi
Tahrir: matn tahrirlansa, hali yuborilmagan navbatdagilar yangi matnni oladi; yuborilganlari o'zgarmaydi.
Limitlar: kuniga 10 tadan ortiq xabar yuborilmaydi; to'xtash shartlari: adminga_yozdi, bloklagan (403).

### 7.4. Ma'lumotlar bazasi (taklif)

Jadval: message_templates(id, segment[A|B|C], day[1..7], order, text, media_file_id, media_type, timing_type, timing_value, buttons_json, is_active, updated_at).
Jadval: sent_messages(user_id, template_id, message_id, sent_at, deleted_at) — takrorlanmaslik va o'chirish uchun.

## 8. Videoni dasturchisiz almashtirish

Maqsad: sotuv videosi har oy yoki talabga qarab har hafta almashadi. Har safar dasturchiga murojaat qilmaslik uchun video admin tomonidan almashtiriladi. Barcha videolar bir xil tuzilishda: kirish → asosiy dars → kurs kimlar uchun → narx.

### 8.1. Admin paneldagi «Videolar» sahifasi

Yuklash: fayl yuklash mp4, yoki (Google drive, Yotube) havola. Server videoni HTTP Range (206) bilan beradigan joyga saqlaydi (6-bo'lim talabi).
Majburiy maydonlar: nomi; davomiyligi (avtomatik); bo'lim vaqtlari: kurs_haqida_boshlanishi (masalan 15:00), narx_nuqtasi (masalan 18:22); ixtiyoriy: asosiy_dars_boshlanishi. Narx nuqtasi kiritilmasa video faol qilinmaydi.
Qulaylik: pleer ichida «Shu joyni belgilash» tugmasi — joriy soniya tanlangan maydonga yoziladi.
Faollashtirish: «Faol qilish» tugmasi. Bir vaqtda faqat bitta faol video. Eskilari arxivda, istalgan vaqtda qayta faol qilinadi; o'chirish faqat tasdiq bilan.
Qo'shimcha: ixtiyoriy «Kurs haqida» qisqa videosi (3.8-band) shu video bilan birga yuklanadi.

### 8.2. Bot orqali almashtirish (telefondan)

Qadam 1: adminlar ro'yxatidagi (admin_ids) akkaunt botga video yuboradi → bot: «Shu videoni asosiy bonus dars qilaymi?» [Ha / Yo'q].
Qadam 2: bot ketma-ket so'raydi: «Kurs haqidagi qism nechanchi daqiqada?» → «Narx nechanchi daqiqada?» (format MM:SS, tekshiriladi: narx > kurs_haqida, ikkalasi < davomiylik).
Qadam 3: bot xulosani ko'rsatadi va «Faol qilish» tugmasi bilan tasdiqlaydi. Oddiy foydalanuvchi video yuborsa, bu menyu chiqmaydi.

### 8.3. Almashinuv qoidalari

Statuslar dinamik: statuslar (3.2-band) qat'iy 15:00 / 18:22 emas, har doim shu foydalanuvchi videosining kurs_haqida va narx_nuqtasi qiymatlaridan hisoblanadi. Kodda vaqt yozilmasligi shart.
Tugmalar: startapp=offer tugmasi videoning kurs_haqida vaqtiga ochiladi.
Jadval: videos(id, title, file_url, duration, course_start_sec, price_sec, intro_end_sec, short_offer_video_url, is_active, created_at); users.video_id.

## 9. Hisobot (admin panel)

Videolar kesimida: har bir video bo'yicha: berildi, ochdi, 5 daqiqagacha chiqdi, kurs qismiga yetdi, narxga yetdi, adminga yozdi (soni va %).
Xabarlar kesimida: har bir xabar bo'yicha: yuborildi, tugma bosildi, shundan keyin narxga yetdi / adminga yozdi. Shunda qaysi matn ishlayotgani ko'rinadi.
Filtr: sana oralig'i bo'yicha filtr, Excel ga yuklab olish.

### 9.1. Qabul qilish testi

Test 1. bot orqali admin akkauntdan video almashtirish ishlaydi; oddiy akkauntdan ishlamaydi.
