const API_URL = __API_URL__;
const BOT_USERNAME = __BOT_USERNAME__;
const STORAGE_KEY = "lead_form";
const REDIRECT_DELAY_MS = 900;
const UZ_OPERATORS = ["90", "91", "93", "94", "95", "97", "98", "99", "33", "50", "55", "77", "88"];
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";
const GENERIC_ERROR = "Xatolik yuz berdi. Qayta urinib ko‘ring.";

function visitorId() {
  const match = document.cookie.match(/(?:^|;\s*)vid=([A-Za-z0-9_-]{10})(?:;|$)/);
  if (match) return match[1];
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  let id = "";
  for (const byte of bytes) id += ALPHABET[byte & 63];
  document.cookie = `vid=${id}; Max-Age=${30 * 24 * 60 * 60}; Path=/; SameSite=Lax`;
  return id;
}

function botLink(vid) {
  return `https://t.me/${BOT_USERNAME}?start=v_${vid}`;
}

function utmParams() {
  const params = new URLSearchParams(location.search);
  const pick = (key, max) => params.get(key)?.slice(0, max) || undefined;
  return {
    utm_source: pick("utm_source", 200),
    utm_campaign: pick("utm_campaign", 200),
    utm_content: pick("utm_content", 200),
    fbclid: pick("fbclid", 500),
  };
}

function fbq(...args) {
  try {
    window.fbq?.(...args);
  } catch {}
}

function track(data) {
  const url = `${API_URL}/track`;
  const body = JSON.stringify(data);
  try {
    if (navigator.sendBeacon?.(url, new Blob([body], { type: "text/plain" }))) return;
  } catch {}
  fetch(url, { method: "POST", headers: { "Content-Type": "text/plain" }, body, keepalive: true }).catch(() => {});
}

function normalizePhone(digits) {
  return digits.length === 9 && UZ_OPERATORS.includes(digits.slice(0, 2)) ? `+998${digits}` : null;
}

function formatPhone(digits) {
  return [digits.slice(0, 2), digits.slice(2, 5), digits.slice(5, 7), digits.slice(7, 9)].filter(Boolean).join(" ");
}

function phoneDigits(value) {
  let digits = value.replace(/\D/g, "");
  if (digits.length > 9 && digits.startsWith("998")) digits = digits.slice(3);
  return digits.slice(0, 9);
}

function loadSaved() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    return {
      name: typeof saved.name === "string" ? saved.name : "",
      phone: typeof saved.phone === "string" ? phoneDigits(saved.phone) : "",
    };
  } catch {
    return { name: "", phone: "" };
  }
}

function save(name, phone) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ name, phone }));
  } catch {}
}

const vid = visitorId();

track({ visitor_id: vid, type: "landing_view", ...utmParams(), referrer: document.referrer.slice(0, 500) || undefined });

const dialog = document.getElementById("lead");
const form = document.getElementById("lead-form");
const nameInput = document.getElementById("lead-name");
const phoneInput = document.getElementById("lead-phone");
const submitButton = form.querySelector("[type=submit]");
const submitLabel = submitButton.querySelector("span");
const done = document.getElementById("lead-done");
const doneTitle = document.getElementById("lead-done-title");
const openLink = document.getElementById("lead-open");
const errors = {
  name: document.getElementById("lead-name-err"),
  phone: document.getElementById("lead-phone-err"),
  general: document.getElementById("lead-err"),
};
const fieldMessages = { name: errors.name.textContent, phone: errors.phone.textContent };
let redirectTimer;
let submitting = false;

function setError(field, message) {
  const el = errors[field];
  el.hidden = !message;
  if (message) el.textContent = message;
  if (field !== "general") (field === "name" ? nameInput : phoneInput).setAttribute("aria-invalid", String(Boolean(message)));
}

function clearErrors() {
  setError("name", "");
  setError("phone", "");
  setError("general", "");
}

function openModal() {
  if (dialog.open) return;
  const saved = loadSaved();
  if (!nameInput.value) nameInput.value = saved.name;
  if (!phoneInput.value) phoneInput.value = formatPhone(saved.phone);
  form.hidden = false;
  done.hidden = true;
  dialog.setAttribute("aria-labelledby", "lead-title");
  clearErrors();
  dialog.showModal();
  document.documentElement.classList.add("is-locked");
  nameInput.focus();
}

document.addEventListener("click", (event) => {
  const cta = event.target.closest("[data-cta]");
  if (!cta) return;
  event.preventDefault();
  track({ visitor_id: vid, type: "cta_click" });
  fbq("trackCustom", "CTAClick");
  if (typeof dialog.showModal === "function") openModal();
  else location.href = botLink(vid);
});

dialog.addEventListener("click", (event) => {
  if (event.target === dialog || event.target.closest("[data-close]")) dialog.close();
});

dialog.addEventListener("close", () => {
  clearTimeout(redirectTimer);
  document.documentElement.classList.remove("is-locked");
});

nameInput.addEventListener("input", () => setError("name", ""));

phoneInput.parentElement.addEventListener("click", () => phoneInput.focus());

phoneInput.addEventListener("input", () => {
  phoneInput.value = formatPhone(phoneDigits(phoneInput.value));
  setError("phone", "");
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (submitting) return;

  const name = nameInput.value.trim();
  const digits = phoneDigits(phoneInput.value);
  const nameValid = name.length >= 2 && name.length <= 60;
  const phone = normalizePhone(digits);
  setError("name", nameValid ? "" : fieldMessages.name);
  setError("phone", phone ? "" : fieldMessages.phone);
  setError("general", "");
  if (!nameValid || !phone) return;

  submitting = true;
  submitButton.disabled = true;
  submitLabel.textContent = "Yuborilmoqda...";

  try {
    const response = await fetch(`${API_URL}/leads`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        visitor_id: vid,
        name,
        phone,
        website: form.elements.website.value || undefined,
        page_url: location.href.slice(0, 500),
        ...utmParams(),
      }),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result.ok) {
      const invalid = response.status === 422;
      const field = invalid && (result.field === "name" || result.field === "phone") ? result.field : "general";
      setError(field, (invalid && result.message) || (field === "general" ? GENERIC_ERROR : fieldMessages[field]));
      return;
    }

    save(name, digits);
    fbq("track", "Lead", {}, { eventID: result.event_id });
    const url = botLink(vid);
    const firstName = name.split(" ")[0];
    doneTitle.textContent = firstName ? `Rahmat, ${firstName}!` : "Rahmat!";
    openLink.href = url;
    form.hidden = true;
    done.hidden = false;
    dialog.setAttribute("aria-labelledby", "lead-done-title");
    redirectTimer = setTimeout(() => {
      location.href = url;
    }, REDIRECT_DELAY_MS);
  } catch {
    setError("general", GENERIC_ERROR);
  } finally {
    submitting = false;
    submitButton.disabled = false;
    submitLabel.textContent = "Davom etish";
  }
});

const sticky = document.getElementById("sticky");
const heroCta = document.getElementById("hero-cta");

if ("IntersectionObserver" in window) {
  sticky.hidden = false;
  sticky.inert = true;
  new IntersectionObserver(([entry]) => {
    const visible = !entry.isIntersecting && entry.boundingClientRect.top < 0;
    sticky.classList.toggle("is-on", visible);
    sticky.inert = !visible;
  }).observe(heroCta);
}
