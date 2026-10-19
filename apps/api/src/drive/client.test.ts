import { afterEach, describe, expect, it, vi } from "vitest";
import { VIDEO_MAX_BYTES } from "@funnel/shared";
import { DriveError, downloadDriveFile, getDriveVideo, parseDriveLink } from "./client";

vi.mock("@/sheets", () => ({
  googleAuthHeaders: async () => new Headers({ authorization: "Bearer drive-token" }),
}));

const ID = "1AbC_dEf-GhIjKlMnOpQrStUvWxYz0123456";

describe("parseDriveLink", () => {
  it.each([
    [`https://drive.google.com/file/d/${ID}/view?usp=sharing`, { fileId: ID }],
    [`https://drive.google.com/file/d/${ID}/view?resourcekey=0-abc_DEF`, { fileId: ID, resourceKey: "0-abc_DEF" }],
    [`https://drive.google.com/open?id=${ID}`, { fileId: ID }],
    [`https://drive.google.com/uc?export=download&id=${ID}`, { fileId: ID }],
    [`https://docs.google.com/file/d/${ID}/edit`, { fileId: ID }],
    [`  https://drive.google.com/file/d/${ID}/view  `, { fileId: ID }],
    [`https://drive.google.com/drive/folders/${ID}`, null],
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", null],
    [`https://evil.example.com/file/d/${ID}`, null],
    ["https://drive.google.com/file/d/short/view", null],
    ["not a url", null],
    ["", null],
  ])("parses %s", (input, expected) => {
    expect(parseDriveLink(input)).toEqual(expected);
  });
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const mp4 = {
  id: ID,
  name: "lesson.mp4",
  mimeType: "video/mp4",
  size: "1048576",
  videoMediaMetadata: { durationMillis: "600500" },
};

describe("getDriveVideo", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("requests metadata with the service account token and returns the video", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(mp4));
    vi.stubGlobal("fetch", fetchMock);

    const video = await getDriveVideo({ fileId: ID });

    expect(video).toEqual({ fileId: ID, name: "lesson.mp4", mimeType: "video/mp4", size: 1048576, durationSec: 601 });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe(`https://www.googleapis.com/drive/v3/files/${ID}`);
    expect(parsed.searchParams.get("fields")).toBe("id,name,mimeType,size,videoMediaMetadata(durationMillis)");
    expect(parsed.searchParams.get("supportsAllDrives")).toBe("true");
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer drive-token");
  });

  it("sends the resource key header for link-shared files", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(mp4));
    vi.stubGlobal("fetch", fetchMock);

    await getDriveVideo({ fileId: ID, resourceKey: "0-key" });

    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(new Headers(init.headers).get("x-goog-drive-resource-keys")).toBe(`${ID}/0-key`);
  });

  it.each([403, 404])("reports %s as not shared", async (status) => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: { message: "nope" } }, status)));
    await expect(getDriveVideo({ fileId: ID })).rejects.toMatchObject({ code: "not_shared" });
  });

  it("reports other failures as drive unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({}, 500)));
    await expect(getDriveVideo({ fileId: ID })).rejects.toMatchObject({ code: "drive_unavailable" });
  });

  it("rejects files that are not mp4", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ ...mp4, mimeType: "video/quicktime" })));
    await expect(getDriveVideo({ fileId: ID })).rejects.toMatchObject({ code: "not_mp4" });
  });

  it("rejects files above the size limit", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ ...mp4, size: String(VIDEO_MAX_BYTES + 1) })));
    await expect(getDriveVideo({ fileId: ID })).rejects.toMatchObject({ code: "too_large" });
  });

  it("rejects files without a size such as Google Docs", async () => {
    const { size: _size, ...withoutSize } = mp4;
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(withoutSize)));
    await expect(getDriveVideo({ fileId: ID })).rejects.toMatchObject({ code: "not_mp4" });
  });

  it("rejects videos whose duration Drive has not processed yet", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ ...mp4, videoMediaMetadata: {} })));
    await expect(getDriveVideo({ fileId: ID })).rejects.toMatchObject({ code: "no_duration" });
  });

  it("throws DriveError instances", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({}, 404)));
    await expect(getDriveVideo({ fileId: ID })).rejects.toBeInstanceOf(DriveError);
  });
});

describe("downloadDriveFile", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("streams alt=media with the token and returns the body", async () => {
    const fetchMock = vi.fn(async () => new Response("bytes", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const body = await downloadDriveFile({ fileId: ID, resourceKey: "0-key" });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe(`https://www.googleapis.com/drive/v3/files/${ID}`);
    expect(parsed.searchParams.get("alt")).toBe("media");
    expect(parsed.searchParams.get("supportsAllDrives")).toBe("true");
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer drive-token");
    expect(new Headers(init.headers).get("x-goog-drive-resource-keys")).toBe(`${ID}/0-key`);
    expect(await new Response(body).text()).toBe("bytes");
  });

  it("fails with download_failed when Drive refuses the download", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("denied", { status: 403 })));
    await expect(downloadDriveFile({ fileId: ID })).rejects.toMatchObject({ code: "download_failed" });
  });
});
