import { afterEach, describe, expect, test, vi } from "vitest";

process.env.MONGODB_URI = "mongodb://test";
process.env.TELEGRAM_BOT_TOKEN = "123:TEST";

afterEach(() => vi.unstubAllGlobals());

describe("sendPhoto", () => {
  test("uploads the PNG as multipart with caption and a web_app button", async () => {
    const calls: { url: string; body: FormData }[] = [];
    vi.stubGlobal("fetch", async (url: string, init: { body: FormData }) => {
      calls.push({ url, body: init.body });
      return { json: async () => ({ ok: true }) };
    });
    const { sendPhoto } = await import("../../src/services/telegram");
    await sendPhoto(7, Buffer.from([0x89, 0x50, 0x4e, 0x47]), "Hello", { text: "Open", url: "https://app.test/" });

    expect(calls[0]?.url).toBe("https://api.telegram.org/bot123:TEST/sendPhoto");
    const form = calls[0]!.body;
    expect(form.get("chat_id")).toBe("7");
    expect(form.get("caption")).toBe("Hello");
    const photo = form.get("photo") as File;
    expect(photo.type).toBe("image/png");
    expect(photo.size).toBe(4);
    expect(JSON.parse(form.get("reply_markup") as string)).toEqual({ inline_keyboard: [[{ text: "Open", web_app: { url: "https://app.test/" } }]] });
  });

  test("a Telegram error surfaces as a failure so the bot can fall back to text", async () => {
    vi.stubGlobal("fetch", async () => ({ json: async () => ({ ok: false, description: "chat not found" }) }));
    const { sendPhoto } = await import("../../src/services/telegram");
    await expect(sendPhoto(7, Buffer.from([1]))).rejects.toThrow("chat not found");
  });
});
