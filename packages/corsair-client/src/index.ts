export interface CorsairClientOptions {
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly fetch?: typeof globalThis.fetch;
}

export interface ConnectionSummary {
  readonly id: string;
  readonly provider: string;
  readonly account: string;
  readonly status: string;
  readonly scopes: readonly string[];
}

export interface ConnectionScopedRequest {
  readonly connectionId: string;
  readonly idempotencyKey?: string;
}

export class CorsairClientError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = "CorsairClientError";
  }
}

export interface SendTelegramMessageInput {
  readonly connectionId: string;
  readonly chatId: string | number;
  readonly text: string;
  readonly parseMode?: "Markdown" | "MarkdownV2" | "HTML";
  readonly disableWebPagePreview?: boolean;
  readonly disableNotification?: boolean;
  readonly replyToMessageId?: number;
}

export interface SentTelegramMessage {
  readonly messageId: number;
  readonly chatId: number;
  readonly date: number;
}

export interface TelegramUpdate {
  readonly updateId: number;
  readonly message?: {
    readonly messageId: number;
    readonly date: number;
    readonly text?: string;
    readonly chat: { readonly id: number; readonly type: string; readonly username?: string; readonly title?: string };
    readonly from?: { readonly id: number; readonly username?: string; readonly firstName?: string };
  };
}

export interface DriveUploadInput {
  readonly connectionId: string;
  readonly name: string;
  readonly mimeType: string;
  readonly contentBase64: string;
  readonly parents?: readonly string[];
}

export interface DriveFile {
  readonly id: string;
  readonly name: string;
  readonly webViewLink?: string;
  readonly webContentLink?: string;
}

export type SheetValue = string | number | boolean | null;

export class CorsairClient {
  private readonly request: typeof globalThis.fetch;

  constructor(private readonly options: CorsairClientOptions) {
    this.request = options.fetch || globalThis.fetch;
  }

  get baseUrl(): string {
    return this.options.baseUrl.replace(/\/$/, "");
  }

  private async postJson<T>(path: string, body: unknown): Promise<T> {
    const response = await this.request(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: { authorization: `Bearer ${this.options.apiKey}`, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new CorsairClientError(response.status, await response.text());
    return (await response.json()) as T;
  }

  /** Send a Telegram message through a connected bot, addressed by connectionId. */
  async sendTelegramMessage(input: SendTelegramMessageInput): Promise<SentTelegramMessage> {
    return this.postJson<SentTelegramMessage>("/api/telegram/send", input);
  }

  /** Poll inbound Telegram updates for a connected bot (getUpdates proxy). */
  async getTelegramUpdates(input: { connectionId: string; offset?: number; limit?: number; timeout?: number }): Promise<readonly TelegramUpdate[]> {
    const body = await this.postJson<{ updates: TelegramUpdate[] }>("/api/telegram/updates", input);
    return body.updates;
  }

  /** Upload a file to Google Drive through a connection. Content is base64-encoded. */
  async uploadDriveFile(input: DriveUploadInput): Promise<DriveFile> {
    return this.postJson<DriveFile>("/api/google/drive/upload", input);
  }

  /** Append rows to a Google Sheet through a connection. */
  async appendSheetRows(input: { connectionId: string; spreadsheetId: string; range: string; values: readonly SheetValue[][] }): Promise<{ updatedRange?: string; updatedRows?: number }> {
    return this.postJson("/api/google/sheets/append", input);
  }

  /** Read a range of values from a Google Sheet through a connection. */
  async getSheetValues(input: { connectionId: string; spreadsheetId: string; range: string }): Promise<{ range?: string; values: SheetValue[][] }> {
    return this.postJson("/api/google/sheets/get", input);
  }

  async listConnections(): Promise<readonly ConnectionSummary[]> {
    const response = await this.request(`${this.baseUrl}/api/connections`, {
      headers: { authorization: `Bearer ${this.options.apiKey}`, accept: "application/json" },
    });
    if (!response.ok) throw new CorsairClientError(response.status, await response.text());
    const body = (await response.json()) as { connections: ConnectionSummary[] };
    return body.connections;
  }

  async health(): Promise<{ status: string; system: string; version: string }> {
    const response = await this.request(`${this.baseUrl}/health`, { headers: { accept: "application/json" } });
    if (!response.ok) throw new CorsairClientError(response.status, await response.text());
    return (await response.json()) as { status: string; system: string; version: string };
  }
}
