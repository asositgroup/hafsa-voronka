const API_URL = __API_URL__;
const BOT_USERNAME = __BOT_USERNAME__;
const CLARITY_ID = __CLARITY_ID__;
const TIMER_MS = 60 * 60 * 1000;
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";

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

function pixel(...args) {
  try {
    window.fbq?.(...args);
  } catch {}
}

function clarity(...args) {
  try {
    window.clarity?.(...args);
  } catch {}
}

function loadClarity() {
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.clarity.ms/tag/${CLARITY_ID}`;
  document.head.appendChild(script);
}

function afterLoad(callback) {
  const idle = () => (window.requestIdleCallback ?? setTimeout)(callback);
  if (document.readyState === "complete") idle();
  else window.addEventListener("load", idle, { once: true });
}

function track(data) {
  const url = `${API_URL}/track`;
  const body = JSON.stringify(data);
  try {
    if (navigator.sendBeacon?.(url, new Blob([body], { type: "text/plain" }))) return;
  } catch {}
  fetch(url, { method: "POST", headers: { "Content-Type": "text/plain" }, body, keepalive: true }).catch(() => {});
}

function startTimer() {
  const el = document.getElementById("timer");
  const key = "video_deadline";
  let deadline;
  try {
    deadline = Number(localStorage.getItem(key));
    if (!deadline) {
      deadline = Date.now() + TIMER_MS;
      localStorage.setItem(key, String(deadline));
    }
  } catch {
    deadline = Date.now() + TIMER_MS;
  }
  const pad = (n) => String(n).padStart(2, "0");
  const tick = () => {
    const left = Math.max(0, Math.round((deadline - Date.now()) / 1000));
    el.textContent = `${pad(Math.floor(left / 3600))}:${pad(Math.floor((left % 3600) / 60))}:${pad(left % 60)}`;
    if (left > 0) setTimeout(tick, 1000 - (Date.now() % 1000));
  };
  tick();
}

function showVideoDuration() {
  fetch(`${API_URL}/landing/video`)
    .then((res) => (res.ok ? res.json() : null))
    .then((video) => {
      const seconds = Math.round(Number(video?.duration));
      if (!(seconds > 0)) return;
      const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
      const minutes = String(Math.max(1, Math.round(seconds / 60)));
      for (const el of document.querySelectorAll("[data-duration]")) el.textContent = clock;
      for (const el of document.querySelectorAll("[data-duration-minutes]")) el.textContent = minutes;
      for (const el of document.querySelectorAll("[data-duration-label]")) {
        el.setAttribute("aria-label", el.getAttribute("aria-label").replace(/\d+:\d{2}$/, clock));
      }
    })
    .catch(() => {});
}

startTimer();
showVideoDuration();

const vid = visitorId();

track({ visitor_id: vid, type: "landing_view", ...utmParams(), referrer: document.referrer.slice(0, 500) || undefined });

if (CLARITY_ID) {
  window.clarity ??= function (...args) {
    (window.clarity.q ??= []).push(args);
  };
  clarity("set", "vid", vid);
  afterLoad(loadClarity);
}

const botUrl = botLink(vid);
for (const cta of document.querySelectorAll("[data-cta]")) cta.href = botUrl;

document.addEventListener("click", (event) => {
  if (!event.target.closest("[data-cta]")) return;
  track({ visitor_id: vid, type: "cta_click" });
  pixel("trackCustom", "CTAClick");
  pixel("track", "CompleteRegistration");
  clarity("event", "cta_click");
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
