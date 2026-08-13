import { describe, expect, it } from "vitest";
import { CorsairClient, CorsairClientError } from "./index.js";

interface Captured {
  url: string;
  method?: string;
  headers: Record<string, string>;
  body?: unknown;
}

function fakeFetch(status: number, payload: unknown): { fetch: typeof globalThis.fetch; calls: Captured[] } {
  const calls: Captured[] = [];
  const fetch = (async (input: any, init?: any) => {
    calls.push({
      url: String(input),
      method: init?.method,
      headers: (init?.headers as Record<string, string>) ?? {},
      body: init?.body ? JSON.parse(init.body as string) : undefined,
    });
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => payload,
      text: async () => (typeof payload === "string" ? payload : JSON.stringify(payload)),
    } as Response;
  }) as unknown as typeof globalThis.fetch;
  return { fetch, calls };
}

function client(fetch: typeof globalThis.fetch): CorsairClient {
  return new CorsairClient({ baseUrl: "https://corsair.example/", apiKey: "test-key", fetch });
}

describe("CorsairClient provider methods", () => {
  it("sends a Telegram message with Bearer auth and JSON body", async () => {
    const { fetch, calls } = fakeFetch(200, { messageId: 42, chatId: 5083029113, date: 1 });
    const result = await client(fetch).sendTelegramMessage({ connectionId: "telegram-bot-1", chatId: 5083029113, text: "done" });

    expect(result.messageId).toBe(42);
    expect(calls[0]!.url).toBe("https://corsair.example/api/telegram/send");
    expect(calls[0]!.method).toBe("POST");
    expect(calls[0]!.headers.authorization).toBe("Bearer test-key");
    expect(calls[0]!.body).toMatchObject({ connectionId: "telegram-bot-1", chatId: 5083029113, text: "done" });
  });

  it("unwraps the updates array", async () => {
    const { fetch } = fakeFetch(200, { updates: [{ updateId: 7, message: { messageId: 1, date: 1, text: "hi", chat: { id: 9, type: "private" } } }] });
    const updates = await client(fetch).getTelegramUpdates({ connectionId: "telegram-bot-1", offset: 5 });
    expect(updates).toHaveLength(1);
    expect(updates[0]!.message?.text).toBe("hi");
  });

  it("uploads a Drive file to the right path", async () => {
    const { fetch, calls } = fakeFetch(200, { id: "file1", name: "cv.pdf", webViewLink: "https://drive/x" });
    const file = await client(fetch).uploadDriveFile({ connectionId: "google-personal", name: "cv.pdf", mimeType: "application/pdf", contentBase64: "eA==" });
    expect(file.id).toBe("file1");
    expect(calls[0]!.url).toBe("https://corsair.example/api/google/drive/upload");
  });

  it("appends sheet rows", async () => {
    const { fetch, calls } = fakeFetch(200, { updatedRange: "Sheet1!A2:C2", updatedRows: 1 });
    const res = await client(fetch).appendSheetRows({ connectionId: "google-personal", spreadsheetId: "sheet1", range: "Sheet1!A1", values: [["a", 1, true]] });
    expect(res.updatedRows).toBe(1);
    expect(calls[0]!.body).toMatchObject({ spreadsheetId: "sheet1", range: "Sheet1!A1" });
  });

  it("throws CorsairClientError on non-2xx", async () => {
    const { fetch } = fakeFetch(502, { error: "provider call failed" });
    await expect(client(fetch).sendTelegramMessage({ connectionId: "x", chatId: 1, text: "y" })).rejects.toBeInstanceOf(CorsairClientError);
  });

  it("strips a trailing slash from baseUrl", async () => {
    const { fetch, calls } = fakeFetch(200, { status: "ok", system: "corsair-platform", version: "0.1.0" });
    await client(fetch).health();
    expect(calls[0]!.url).toBe("https://corsair.example/health");
  });
});
