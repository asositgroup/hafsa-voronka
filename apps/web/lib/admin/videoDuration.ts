const TIMEOUT_MS = 20000;

export function readVideoDuration(src: File | string): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = typeof src === "string" ? src : URL.createObjectURL(src);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;

    const finish = (action: () => void) => {
      clearTimeout(timer);
      video.removeAttribute("src");
      video.load();
      if (typeof src !== "string") URL.revokeObjectURL(url);
      action();
    };

    const timer = setTimeout(() => finish(() => reject(new Error("duration_timeout"))), TIMEOUT_MS);

    video.onloadedmetadata = () => {
      const seconds = Math.round(video.duration);
      finish(() => (Number.isFinite(seconds) && seconds > 0 ? resolve(seconds) : reject(new Error("duration_invalid"))));
    };
    video.onerror = () => finish(() => reject(new Error("duration_unreadable")));
    video.src = url;
  });
}
