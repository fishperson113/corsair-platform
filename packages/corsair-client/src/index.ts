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

export class CorsairClient {
  private readonly request: typeof globalThis.fetch;

  constructor(private readonly options: CorsairClientOptions) {
    this.request = options.fetch || globalThis.fetch;
  }

  get baseUrl(): string {
    return this.options.baseUrl.replace(/\/$/, "");
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
