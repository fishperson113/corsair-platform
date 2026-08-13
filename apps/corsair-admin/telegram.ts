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
