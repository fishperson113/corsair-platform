import { googleClientConfig } from "./auth.js";

export async function googleAuthorizationUrl(params: {
  state: string;
  redirectUri: string;
  scopes: readonly string[];
  accessType?: "offline" | "online";
  prompt?: "consent" | "select_account";
}): Promise<string> {
  const config = googleClientConfig();
  if (!config.clientId || !config.clientSecret) throw new Error("Google OAuth is not configured: set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET");
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: params.redirectUri,
    response_type: "code",
    scope: params.scopes.join(" "),
    state: params.state,
    access_type: params.accessType || "offline",
    prompt: params.prompt || "consent",
  }).toString();
  return url.toString();
}

export async function exchangeCode(code: string, redirectUri: string): Promise<{ access_token: string; refresh_token?: string; expires_in?: number; scope?: string }> {
  const config = googleClientConfig();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!response.ok) throw new Error(`Google token exchange failed: ${response.status}`);
  return (await response.json()) as { access_token: string; refresh_token?: string; expires_in?: number; scope?: string };
}

export async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in?: number; scope?: string }> {
  const config = googleClientConfig();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!response.ok) throw new Error(`Google token refresh failed: ${response.status}`);
  return (await response.json()) as { access_token: string; expires_in?: number; scope?: string };
}

export async function googleProfile(accessToken: string): Promise<{ sub: string; email: string }> {
  const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error(`Google profile lookup failed: ${response.status}`);
  return (await response.json()) as { sub: string; email: string };
}
