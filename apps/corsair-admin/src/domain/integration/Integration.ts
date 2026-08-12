export type IntegrationAuthType = "oauth2" | "apiKey" | "none";

export interface IntegrationCapability {
  readonly resource: string;
  readonly action: "READ" | "WRITE" | "DELETE" | "SEND";
}

export interface IntegrationAuthConfig {
  readonly authType: IntegrationAuthType;
  readonly scopes: readonly string[];
}

export interface Integration {
  readonly id: string;
  readonly name: string;
  readonly provider: string;
  readonly plugin: string;
  readonly auth: IntegrationAuthConfig;
  readonly capabilities: readonly IntegrationCapability[];
  readonly enabled: boolean;
  readonly metadata: Record<string, unknown>;
}
