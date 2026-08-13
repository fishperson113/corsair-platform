import { api } from "encore.dev/api";
import type { IncomingMessage, ServerResponse } from "node:http";
import { apiAuthorized } from "./auth.js";
import { SECURITY_HEADERS } from "./security.js";
import { getTelegramUpdates, sendTelegramMessage } from "./telegram.js";
import { driveUpload, sheetsAppend, sheetsGet } from "./google-runtime.js";

function harden(res: ServerResponse): void {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) res.setHeader(name, value);
}

async function readJson<T>(req: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw.trim()) return {} as T;
  return JSON.parse(raw) as T;
}

function send(res: ServerResponse, status: number, value: unknown): void {
  harden(res);
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(value));
}

/**
 * Wrap a workload endpoint: enforce the Bearer API key, parse the JSON body,
 * run the handler, and normalize errors to JSON. Keeps provider tokens and SDK
 * internals off the wire — callers only ever pass a connectionId plus params.
 */
function workload<TBody>(handler: (body: TBody) => Promise<unknown>) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    if (!apiAuthorized(req.headers.authorization)) return send(res, 401, { error: "unauthorized" });
    let body: TBody;
    try {
      body = await readJson<TBody>(req);
    } catch {
      return send(res, 400, { error: "invalid JSON body" });
    }
    try {
      send(res, 200, await handler(body));
    } catch (error) {
      send(res, 502, { error: error instanceof Error ? error.message : "provider call failed" });
    }
  };
}

interface SendBody { connectionId: string; chatId: string | number; text: string; parseMode?: "Markdown" | "MarkdownV2" | "HTML"; disableWebPagePreview?: boolean; disableNotification?: boolean; replyToMessageId?: number }
export const telegramSend = api.raw({ method: "POST", path: "/api/telegram/send", expose: true }, workload<SendBody>(async (b) => {
  if (!b.connectionId) throw new Error("connectionId is required");
  return sendTelegramMessage(b.connectionId, { chatId: b.chatId, text: b.text, parseMode: b.parseMode, disableWebPagePreview: b.disableWebPagePreview, disableNotification: b.disableNotification, replyToMessageId: b.replyToMessageId });
}));

interface UpdatesBody { connectionId: string; offset?: number; limit?: number; timeout?: number }
export const telegramUpdates = api.raw({ method: "POST", path: "/api/telegram/updates", expose: true }, workload<UpdatesBody>(async (b) => {
  if (!b.connectionId) throw new Error("connectionId is required");
  return { updates: await getTelegramUpdates(b.connectionId, { offset: b.offset, limit: b.limit, timeout: b.timeout }) };
}));

interface DriveBody { connectionId: string; name: string; mimeType: string; contentBase64: string; parents?: string[] }
export const googleDriveUpload = api.raw({ method: "POST", path: "/api/google/drive/upload", expose: true }, workload<DriveBody>(async (b) => {
  if (!b.connectionId) throw new Error("connectionId is required");
  return driveUpload(b.connectionId, { name: b.name, mimeType: b.mimeType, contentBase64: b.contentBase64, parents: b.parents });
}));

interface SheetsAppendBody { connectionId: string; spreadsheetId: string; range: string; values: (string | number | boolean | null)[][] }
export const googleSheetsAppend = api.raw({ method: "POST", path: "/api/google/sheets/append", expose: true }, workload<SheetsAppendBody>(async (b) => {
  if (!b.connectionId || !b.spreadsheetId || !b.range) throw new Error("connectionId, spreadsheetId and range are required");
  return sheetsAppend(b.connectionId, b.spreadsheetId, b.range, b.values ?? []);
}));

interface SheetsGetBody { connectionId: string; spreadsheetId: string; range: string }
export const googleSheetsGet = api.raw({ method: "POST", path: "/api/google/sheets/get", expose: true }, workload<SheetsGetBody>(async (b) => {
  if (!b.connectionId || !b.spreadsheetId || !b.range) throw new Error("connectionId, spreadsheetId and range are required");
  return sheetsGet(b.connectionId, b.spreadsheetId, b.range);
}));
