import { describe, expect, it } from "vitest";
import { buildDriveMultipart } from "./provider-encoding.js";

describe("buildDriveMultipart", () => {
  it("frames metadata and base64 content with a matching boundary", () => {
    const content = Buffer.from("hello pdf bytes").toString("base64");
    const { body, contentType } = buildDriveMultipart({ name: "cv.pdf", parents: ["folder1"] }, content, "application/pdf");
    const boundary = contentType.replace("multipart/related; boundary=", "");
    const text = body.toString("utf8");

    expect(contentType.startsWith("multipart/related; boundary=corsair-")).toBe(true);
    expect(text).toContain(`--${boundary}\r\n`);
    expect(text.endsWith(`\r\n--${boundary}--`)).toBe(true);
    expect(text).toContain('{"name":"cv.pdf","parents":["folder1"]}');
    expect(text).toContain("Content-Type: application/pdf");
    expect(text).toContain(content);
  });

  it("uses a fresh boundary each call", () => {
    const a = buildDriveMultipart({ name: "a" }, "eA==", "text/plain").contentType;
    const b = buildDriveMultipart({ name: "b" }, "eA==", "text/plain").contentType;
    expect(a).not.toBe(b);
  });
});
