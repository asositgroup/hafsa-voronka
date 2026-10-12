export async function attachVideoSource(
  video: HTMLVideoElement,
  url: string,
): Promise<(() => void) | undefined> {
  const isHls = url.split("?")[0].endsWith(".m3u8") || url.includes(".m3u8");
  const canPlayNative = Boolean(video.canPlayType("application/vnd.apple.mpegurl"));

  if (isHls && !canPlayNative) {
    const { default: Hls } = await import("hls.js");
    if (Hls.isSupported()) {
      const hls = new Hls({
        capLevelToPlayerSize: true,
      });
      hls.loadSource(url);
      hls.attachMedia(video);
      return () => {
        hls.destroy();
      };
    }
  }

  video.src = url;
  return undefined;
}
