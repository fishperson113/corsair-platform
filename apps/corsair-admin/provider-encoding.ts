// Pure provider request-encoding helpers with no Encore/runtime dependencies,
// so they are unit-testable under plain `vitest run`.
import { randomBytes } from "node:crypto";

/** Build a Google Drive `uploadType=multipart` request body. */
export function buildDriveMultipart(metadata: Record<string, unknown>, contentBase64: string, mimeType: string): { body: Buffer; contentType: string } {
  const boundary = `corsair-${randomBytes(12).toString("hex")}`;
  const head = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\nContent-Transfer-Encoding: base64\r\n\r\n`;
  const tail = `\r\n--${boundary}--`;
  const body = Buffer.concat([Buffer.from(head, "utf8"), Buffer.from(contentBase64, "utf8"), Buffer.from(tail, "utf8")]);
  return { body, contentType: `multipart/related; boundary=${boundary}` };
}
