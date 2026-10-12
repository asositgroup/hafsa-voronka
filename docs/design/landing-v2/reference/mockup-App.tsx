const lessonPoints = [
  {
    number: "01",
    title: "Qayerdan boshlashni bilib olasiz",
    text: "To‘g‘ri ustoz va kitob tanlash, arab harflarini o‘rganish hamda ta’lim jarayonini to‘g‘ri yo‘lga qo‘yish haqida tushunchaga ega bo‘lasiz.",
  },
  {
    number: "02",
    title: "Xatolarni oldindan tushunasiz",
    text: "Noto‘g‘ri metod va tartibsiz o‘rganish qanday qiyinchiliklarga olib kelishini, bu muammolardan qanday saqlanishni bilib olasiz.",
  },
  {
    number: "03",
    title: "O‘z yo‘lingizni belgilaysiz",
    text: "Hafsa ustozaning tajribasi asosida dastlabki qadamlarni tushunib, o‘qishni aynan qayerdan boshlash kerakligini aniqlashtirasiz.",
  },
];

const audience = [
  "Arab tilini noldan o‘rganishni istayotganlar",
  "Qur’onni tajvid bilan o‘qishni istayotganlar",
  "Arab harflarini o‘rganmoqchi bo‘lganlar",
  "Ustoz va kitob tanlashga ikkilanayotganlar",
  "Boshlagan, ammo to‘g‘ri yo‘nalish topa olmayotganlar",
];

const education = [
  ["O‘zbekiston", "Arab tili bo‘yicha tahsil"],
  ["Madina", "Islom universitetida tahsil"],
  ["Misr", "Arab tili markazida 10 darajali dastur, yuqori baho bilan"],
  ["Istanbul", "“Darussalam” madrasasida malaka oshirish"],
];

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m5 12 4 4L19 6" />
    </svg>
  );
}

function TelegramIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M21.5 3.2 18.4 20c-.2 1.2-.9 1.5-1.9.9l-4.7-3.5-2.3 2.2c-.3.3-.5.5-1 .5l.3-4.8 8.8-8c.4-.3-.1-.5-.6-.2L6.1 14l-4.7-1.5c-1-.3-1-1 .2-1.5l18.3-7.1c.8-.3 1.6.2 1.3 1.3Z" />
    </svg>
  );
}

function Brand() {
  return (
    <div className="brand" aria-label="Hafsa ustoza">
      <span className="brand-mark">ح</span>
      <span className="brand-copy">
        <strong>Hafsa</strong>
        <small>USTOZA</small>
      </span>
    </div>
  );
}

function Cta({ label = "Bepul darsni ko‘rish" }: { label?: string }) {
  return (
    <a className="cta" href="#qanday-olish">
      <span>{label}</span>
      <span className="cta-icon">
        <ArrowIcon />
      </span>
    </a>
  );
}

function SectionTitle({
  eyebrow,
  children,
  light = false,
}: {
  eyebrow: string;
  children: React.ReactNode;
  light?: boolean;
}) {
  return (
    <div className={`section-title ${light ? "section-title-light" : ""}`}>
      <div className="eyebrow">{eyebrow}</div>
      <div className="heading" role="heading" aria-level={2}>
        {children}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <main>
      <header className="site-header">
        <div className="shell nav-inner">
          <Brand />
          <a className="nav-link" href="#dars-haqida">
            Dars haqida
          </a>
          <Cta label="Bepul olish" />
        </div>
      </header>

      <section className="hero">
        <div className="hero-ornament hero-ornament-one">ع</div>
        <div className="hero-ornament hero-ornament-two">ض</div>
        <div className="shell hero-grid">
          <div className="hero-copy">
            <div className="pill">
              <span className="pill-dot" />
              17 daqiqalik bepul videodars
            </div>
            <div className="hero-title" role="heading" aria-level={1}>
              Arab tilini <em>to‘g‘ri</em> o‘rganishni nimadan boshlash kerak?
            </div>
            <p className="hero-lead">
              Hafsa ustozaning 12 yillik tajribasi asosida arab tilini
              o‘rganishdagi 5 ta muhim qadamni bilib oling.
            </p>
            <p className="hero-text">
              To‘g‘ri ustoz va kitob tanlashdan arab harflarini
              o‘rganishgacha — jarayonni tezlashtiring va vaqtingizni tejang.
            </p>
            <div className="hero-actions">
              <Cta />
              <div className="telegram-note">
                <TelegramIcon />
                <span>
                  <strong>Telegram ichida</strong>
                  <small>Darhol ko‘rasiz</small>
                </span>
              </div>
            </div>
          </div>

          <div className="hero-visual">
            <div className="image-frame">
              <img
                src="https://images.unsplash.com/photo-1629637980312-17ca9ed52f29?crop=faces&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=1000&h=1200"
                alt="Kitob o‘qiyotgan hijobli talaba"
              />
              <div className="arabic-stamp">
                <span>اِقْرَأْ</span>
                <small>O‘QI</small>
              </div>
            </div>
            <div className="experience-card">
              <strong>12+</strong>
              <span>yillik ta’lim tajribasi</span>
            </div>
            <div className="visual-caption">
              <span>IQRA AKADEMIYASI</span>
              <span>2014-YILDAN</span>
            </div>
          </div>
        </div>
        <div className="hero-footer shell">
          <span>Bepul video dars</span>
          <span className="hero-footer-line" />
          <span>5 muhim qadam</span>
          <span className="hero-footer-line" />
          <span>17 daqiqa</span>
        </div>
      </section>

      <section className="lesson section-pad" id="dars-haqida">
        <div className="shell">
          <SectionTitle eyebrow="DARS ICHIDAGI ASOSIY MAVZULAR">
            Videodarsda nimalarni <em>bilib olasiz?</em>
          </SectionTitle>
          <div className="lesson-grid">
            {lessonPoints.map((point) => (
              <article className="lesson-card" key={point.number}>
                <div className="lesson-number">{point.number}</div>
                <div className="lesson-icon">
                  <CheckIcon />
                </div>
                <div className="card-title" role="heading" aria-level={3}>
                  {point.title}
                </div>
                <p>{point.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="audience section-pad">
        <div className="shell audience-grid">
          <div className="audience-intro">
            <SectionTitle eyebrow="SIZ UCHUN TAYYORLANGAN">
              Bu bepul dars <em>kimlar uchun?</em>
            </SectionTitle>
            <p>
              Arab tili va Qur’onni o‘qishni o‘rganishni istagan, ammo nimadan
              boshlashni bilmayotgan opa-singillarimiz uchun tayyorlangan.
            </p>
            <div className="arabic-quote">طَلَبُ الْعِلْمِ</div>
            <small>Ilm talab qilish — sharafli yo‘l</small>
          </div>
          <div className="audience-list">
            {audience.map((item, index) => (
              <div className="audience-item" key={item}>
                <span className="audience-check">
                  <CheckIcon />
                </span>
                <span>{item}</span>
                <small>0{index + 1}</small>
              </div>
            ))}
          </div>
        </div>
        <div className="shell audience-cta">
          <p>
            Siz ham arab tili va Qur’on o‘qishni o‘rganishni niyat qilgan
            bo‘lsangiz, bu dars siz uchun.
          </p>
          <Cta />
        </div>
      </section>

      <section className="teacher section-pad">
        <div className="shell teacher-grid">
          <div className="teacher-intro">
            <div className="portrait">
              <div className="portrait-pattern" />
              <div className="portrait-monogram">H</div>
              <div className="portrait-label">
                <span>ASOSCHI</span>
                <strong>IQRA</strong>
              </div>
            </div>
            <div className="teacher-name">
              <div className="eyebrow">USTOZINGIZ BILAN TANISHING</div>
              <div role="heading" aria-level={2}>
                Hafsa <em>ustoza</em>
              </div>
              <p>IQRA Akademiyasi asoschisi</p>
            </div>
          </div>

          <div className="teacher-content">
            <p className="teacher-lead">
              Qur’on va arab tili ta’limi bilan 12 yildan ortiq shug‘ullanib
              kelaman. Arab tili va Qur’on ilmlarini chuqur o‘rganib, xalqaro
              darajadagi ustozlardan ta’lim olganman.
            </p>
            <div className="education-list">
              {education.map(([place, detail]) => (
                <div className="education-row" key={place}>
                  <strong>{place}</strong>
                  <span>{detail}</span>
                </div>
              ))}
            </div>
            <p>
              Mujoza ustozlardan ta’lim olib, hozirda hofiza qizlarni ijozaga
              tayyorlab kelmoqdaman.
            </p>
            <div className="academy-note">
              <strong>2014</strong>
              <p>
                IQRA Akademiyasiga asos soldim. Akademiyamizda darslarni
                Dubay, Misr va Makkada tahsil olgan, yuqori darajadagi ijoza va
                diplomlarga ega ustozalar olib boradi.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="steps section-pad" id="qanday-olish">
        <div className="shell">
          <SectionTitle eyebrow="UCHTA OSON QADAM" light>
            Videoni qanday <em>olasiz?</em>
          </SectionTitle>
          <div className="steps-grid">
            <div className="step">
              <span>1</span>
              <div>
                <strong>Tugmani bosing</strong>
                <p>Telegramda bot ochiladi</p>
              </div>
            </div>
            <div className="step-line" />
            <div className="step">
              <span>2</span>
              <div>
                <strong>Raqamingizni yuboring</strong>
                <p>Buning uchun bitta tugma yetarli</p>
              </div>
            </div>
            <div className="step-line" />
            <div className="step">
              <span>3</span>
              <div>
                <strong>Darsni ko‘ring</strong>
                <p>Telegram ichida, o‘zingizga qulay vaqtda</p>
              </div>
            </div>
          </div>

          <div className="final-cta">
            <div>
              <div className="final-title" role="heading" aria-level={2}>
                Birinchi qadamni <em>bugun qo‘ying.</em>
              </div>
              <p>17 daqiqalik videodarsni bepul oling.</p>
            </div>
            <a className="cta cta-light" href="#telegram">
              <TelegramIcon />
              <span>Telegramda olish</span>
              <span className="cta-icon">
                <ArrowIcon />
              </span>
            </a>
          </div>
          <p className="privacy" id="telegram">
            Raqamingiz faqat dars va kanal haqida xabar berish uchun
            ishlatiladi.
          </p>
        </div>
      </section>

      <footer>
        <div className="shell footer-inner">
          <Brand />
          <p>Natijalar har bir o‘quvchining muntazam mehnatiga bog‘liq.</p>
          <span>© 2026 IQRA Akademiyasi</span>
        </div>
      </footer>
    </main>
  );
}
