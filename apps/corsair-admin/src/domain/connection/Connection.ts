export interface Account {
  readonly id: string;
  readonly externalAccountId: string;
  readonly displayName: string;
}

export interface Connection {
  readonly id: string;
  readonly tenantId: string;
  readonly integrationId: string;
  readonly account: Account;
  readonly credentialId: string;
  readonly status: "healthy" | "needs_reauth" | "disconnected";
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
