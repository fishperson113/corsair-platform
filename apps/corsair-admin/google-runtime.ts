import { db } from "./database.js";
import { audit, decrypt } from "./auth.js";
import { refreshAccessToken } from "./google.js";
import { buildDriveMultipart } from "./provider-encoding.js";

interface StoredGoogleCredential {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
}

/**
 * Resolve a short-lived Google access token for a stored connection. The raw
 * refresh token never leaves the server. On refresh failure the connection is
 * flipped to needs_reauth so the UI can prompt a reconnect.
 */
export async function accessTokenFor(connectionId: string): Promise<string> {
  const row = await db.queryRow<{ provider: string; status: string; credential_ciphertext: string; credential_iv: string; credential_tag: string }>`
    SELECT provider, status, credential_ciphertext, credential_iv, credential_tag FROM connections WHERE id = ${connectionId}`;
  if (!row) throw new Error(`Unknown connection: ${connectionId}`);
  if (row.provider !== "google") throw new Error(`Connection ${connectionId} is not a Google connection`);
  if (row.status === "disconnected") throw new Error(`Connection ${connectionId} is disconnected`);
  const credential = JSON.parse(decrypt({ ciphertext: row.credential_ciphertext, iv: row.credential_iv, tag: row.credential_tag })) as StoredGoogleCredential;
  if (!credential.refresh_token) throw new Error(`Connection ${connectionId} has no refresh token; reconnect Google`);
  try {
    const refreshed = await refreshAccessToken(credential.refresh_token);
    if (row.status !== "healthy") await db.exec`UPDATE connections SET status = 'healthy', updated_at = now() WHERE id = ${connectionId}`;
    return refreshed.access_token;
  } catch (error) {
    await db.exec`UPDATE connections SET status = 'needs_reauth', updated_at = now() WHERE id = ${connectionId}`;
    throw error;
  }
}

export interface DriveUploadInput {
  name: string;
  mimeType: string;
  contentBase64: string;
  parents?: string[];
}

export interface DriveFile {
  id: string;
  name: string;
  webViewLink?: string;
  webContentLink?: string;
}

export async function driveUpload(connectionId: string, input: DriveUploadInput): Promise<DriveFile> {
  if (!input.name?.trim()) throw new Error("File name is required");
  if (!input.contentBase64) throw new Error("File content is required");
  const token = await accessTokenFor(connectionId);
  const metadata: Record<string, unknown> = { name: input.name };
  if (input.parents?.length) metadata.parents = input.parents;
  const { body, contentType } = buildDriveMultipart(metadata, input.contentBase64, input.mimeType || "application/octet-stream");
  const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": contentType },
    body,
  });
  if (!response.ok) throw new Error(`Drive upload failed: ${response.status} ${await response.text()}`);
  const file = (await response.json()) as DriveFile;
  await audit("google.drive.uploaded", connectionId, connectionId, { fileId: file.id, name: file.name });
  return file;
}

export async function sheetsAppend(connectionId: string, spreadsheetId: string, range: string, values: (string | number | boolean | null)[][]): Promise<{ updatedRange?: string; updatedRows?: number }> {
  const token = await accessTokenFor(connectionId);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  const response = await fetch(url, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ values }),
  });
  if (!response.ok) throw new Error(`Sheets append failed: ${response.status} ${await response.text()}`);
  const body = (await response.json()) as { updates?: { updatedRange?: string; updatedRows?: number } };
  await audit("google.sheets.appended", connectionId, connectionId, { spreadsheetId, range, rows: values.length });
  return { updatedRange: body.updates?.updatedRange, updatedRows: body.updates?.updatedRows };
}

export async function sheetsGet(connectionId: string, spreadsheetId: string, range: string): Promise<{ range?: string; values: (string | number | boolean | null)[][] }> {
  const token = await accessTokenFor(connectionId);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`;
  const response = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`Sheets get failed: ${response.status} ${await response.text()}`);
  const body = (await response.json()) as { range?: string; values?: (string | number | boolean | null)[][] };
  return { range: body.range, values: body.values ?? [] };
}
