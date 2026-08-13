import { db } from "./database.js";
import { audit, encrypt, decrypt } from "./auth.js";

export const telegramOwner = {
  id: "5083029113",
  username: "FishPerson123",
  firstName: "Dương",
  lastName: "Phạm",
  language: "en",
} as const;

interface TelegramGetMeResponse {
  ok: boolean;
  result?: { id: number; is_bot: boolean; first_name: string; username?: string };
  description?: string;
}

export async function getTelegramBot(token: string): Promise<NonNullable<TelegramGetMeResponse["result"]>> {
  const response = await fetch(`https://api.telegram.org/bot${encodeURIComponent(token)}/getMe`);
  const body = (await response.json()) as TelegramGetMeResponse;
  if (!response.ok || !body.ok || !body.result?.is_bot) throw new Error(body.description || "Telegram bot token is invalid");
  return body.result;
}

export async function addTelegramBot(token: string, displayName: string): Promise<void> {
  const cleanToken = token.trim();
  if (!cleanToken) throw new Error("Bot token is required");
  const bot = await getTelegramBot(cleanToken);
  const username = bot.username || `bot-${bot.id}`;
  const id = `telegram-bot-${bot.id}`;
  const encrypted = encrypt(cleanToken);
  await db.exec`INSERT INTO telegram_bots (id, telegram_bot_id, username, display_name, status, token_ciphertext, token_iv, token_tag)
    VALUES (${id}, ${String(bot.id)}, ${username}, ${displayName.trim() || username}, 'healthy', ${encrypted.ciphertext}, ${encrypted.iv}, ${encrypted.tag})
    ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username, display_name = EXCLUDED.display_name, status = 'healthy', token_ciphertext = EXCLUDED.token_ciphertext, token_iv = EXCLUDED.token_iv, token_tag = EXCLUDED.token_tag, updated_at = now()`;
  await audit("telegram.bot.connected", telegramOwner.username, id, { botId: String(bot.id), username });
}

export async function disconnectTelegramBot(id: string): Promise<void> {
  await db.exec`UPDATE telegram_bots SET status = 'disconnected', updated_at = now() WHERE id = ${id}`;
  await audit("telegram.bot.disconnected", telegramOwner.username, id);
}

async function botToken(connectionId: string): Promise<string> {
  const row = await db.queryRow<{ token_ciphertext: string; token_iv: string; token_tag: string; status: string }>`SELECT token_ciphertext, token_iv, token_tag, status FROM telegram_bots WHERE id = ${connectionId}`;
  if (!row) throw new Error(`Unknown Telegram connection: ${connectionId}`);
  if (row.status === "disconnected") throw new Error(`Telegram connection is disconnected: ${connectionId}`);
  return decrypt({ ciphertext: row.token_ciphertext, iv: row.token_iv, tag: row.token_tag });
}

async function callBotApi<T>(token: string, method: string, payload: Record<string, unknown>): Promise<T> {
  const response = await fetch(`https://api.telegram.org/bot${encodeURIComponent(token)}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = (await response.json()) as { ok: boolean; result?: T; description?: string };
  if (!response.ok || !body.ok) throw new Error(body.description || `Telegram ${method} failed`);
  return body.result as T;
}

export interface SendMessageInput {
  chatId: string | number;
  text: string;
  parseMode?: "Markdown" | "MarkdownV2" | "HTML";
  disableWebPagePreview?: boolean;
  disableNotification?: boolean;
  replyToMessageId?: number;
}

export async function sendTelegramMessage(connectionId: string, input: SendMessageInput): Promise<{ messageId: number; chatId: number; date: number }> {
  if (!input.text?.trim()) throw new Error("Message text is required");
  const token = await botToken(connectionId);
  const result = await callBotApi<{ message_id: number; chat: { id: number }; date: number }>(token, "sendMessage", {
    chat_id: input.chatId,
    text: input.text,
    parse_mode: input.parseMode,
    disable_web_page_preview: input.disableWebPagePreview,
    disable_notification: input.disableNotification,
    reply_to_message_id: input.replyToMessageId,
  });
  await audit("telegram.message.sent", connectionId, connectionId, { chatId: String(result.chat.id), messageId: result.message_id });
  return { messageId: result.message_id, chatId: result.chat.id, date: result.date };
}

export interface TelegramUpdate {
  updateId: number;
  message?: {
    messageId: number;
    date: number;
    text?: string;
    chat: { id: number; type: string; username?: string; title?: string };
    from?: { id: number; username?: string; firstName?: string };
  };
}

export async function getTelegramUpdates(connectionId: string, params: { offset?: number; limit?: number; timeout?: number } = {}): Promise<TelegramUpdate[]> {
  const token = await botToken(connectionId);
  const raw = await callBotApi<Array<Record<string, any>>>(token, "getUpdates", {
    offset: params.offset,
    limit: params.limit,
    timeout: params.timeout ?? 0,
    allowed_updates: ["message"],
  });
  return raw.map((u) => ({
    updateId: u.update_id,
    message: u.message && {
      messageId: u.message.message_id,
      date: u.message.date,
      text: u.message.text,
      chat: { id: u.message.chat.id, type: u.message.chat.type, username: u.message.chat.username, title: u.message.chat.title },
      from: u.message.from && { id: u.message.from.id, username: u.message.from.username, firstName: u.message.from.first_name },
    },
  }));
}

export async function testTelegramBot(id: string): Promise<boolean> {
  const row = await db.queryRow<{ token_ciphertext: string; token_iv: string; token_tag: string }>`SELECT token_ciphertext, token_iv, token_tag FROM telegram_bots WHERE id = ${id}`;
  if (!row) return false;
  try {
    await getTelegramBot(decrypt({ ciphertext: row.token_ciphertext, iv: row.token_iv, tag: row.token_tag }));
    await db.exec`UPDATE telegram_bots SET status = 'healthy', updated_at = now() WHERE id = ${id}`;
    return true;
  } catch {
    await db.exec`UPDATE telegram_bots SET status = 'needs_reauth', updated_at = now() WHERE id = ${id}`;
    return false;
  }
}
