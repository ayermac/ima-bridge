import { describe, it, expect } from "vitest";
import { parseEnv, previewCredential, resolveCredentialsFromSources } from "../env";

describe("parseEnv", () => {
  it("parses simple key=value", () => {
    const result = parseEnv("KEY=val");
    expect(result.KEY).toBe("val");
  });

  it("ignores comments", () => {
    const result = parseEnv("# comment\nKEY=val");
    expect(result.KEY).toBe("val");
    expect(result["# comment"]).toBeUndefined();
  });

  it("ignores empty lines", () => {
    const result = parseEnv("KEY1=v1\n\nKEY2=v2");
    expect(result.KEY1).toBe("v1");
    expect(result.KEY2).toBe("v2");
  });

  it("strips double quotes", () => {
    const result = parseEnv('KEY="quoted value"');
    expect(result.KEY).toBe("quoted value");
  });

  it("strips single quotes", () => {
    const result = parseEnv("KEY='quoted value'");
    expect(result.KEY).toBe("quoted value");
  });

  it("preserves unquoted values with spaces", () => {
    const result = parseEnv("KEY=unquoted value");
    expect(result.KEY).toBe("unquoted value");
  });

  it("handles values with equals sign", () => {
    const result = parseEnv("KEY=val=ue=here");
    expect(result.KEY).toBe("val=ue=here");
  });

  it("skips lines without equals sign", () => {
    const result = parseEnv("NOEQUALS\nKEY=val");
    expect(result.NOEQUALS).toBeUndefined();
    expect(result.KEY).toBe("val");
  });

  it("skips lines starting with equals", () => {
    const result = parseEnv("=value\nKEY=val");
    expect(result[""]).toBeUndefined();
    expect(result.KEY).toBe("val");
  });
});

describe("previewCredential", () => {
  it("masks short value with 2+3 pattern", () => {
    expect(previewCredential("abcd")).toBe("ab***cd");
  });

  it("masks long value with 4+4 pattern", () => {
    expect(previewCredential("abcdefghijklmnop")).toBe("abcd****mnop");
  });

  it("handles 12-char value with 2+3 pattern", () => {
    expect(previewCredential("123456789012")).toBe("12***12");
  });

  it("handles 13-char value with 4+4 pattern", () => {
    expect(previewCredential("1234567890123")).toBe("1234****0123");
  });

  it("does not leak full key", () => {
    const key = "supersecretapikey123";
    const preview = previewCredential(key);
    expect(preview).not.toBe(key);
    expect(preview.includes("secret")).toBe(false);
  });
});

describe("resolveCredentialsFromSources", () => {
  it("prefers settings over env", () => {
    const creds = resolveCredentialsFromSources(
      { imaOpenApiClientId: "s-id", imaOpenApiApiKey: "s-key" },
      { IMA_OPENAPI_CLIENTID: "e-id", IMA_OPENAPI_APIKEY: "e-key" }
    );
    expect(creds).toEqual({ clientId: "s-id", apiKey: "s-key" });
  });

  it("falls back to env when settings incomplete", () => {
    const creds = resolveCredentialsFromSources(
      { imaOpenApiClientId: "s-id" },
      { IMA_OPENAPI_CLIENTID: "e-id", IMA_OPENAPI_APIKEY: "e-key" }
    );
    expect(creds).toEqual({ clientId: "e-id", apiKey: "e-key" });
  });

  it("falls back to env when settings null", () => {
    const creds = resolveCredentialsFromSources(null, {
      IMA_OPENAPI_CLIENTID: "e-id",
      IMA_OPENAPI_APIKEY: "e-key",
    });
    expect(creds).toEqual({ clientId: "e-id", apiKey: "e-key" });
  });

  it("returns null when both missing", () => {
    const creds = resolveCredentialsFromSources(null, {});
    expect(creds).toBeNull();
  });

  it("trims whitespace", () => {
    const creds = resolveCredentialsFromSources(null, {
      IMA_OPENAPI_CLIENTID: "  id  ",
      IMA_OPENAPI_APIKEY: "  key  ",
    });
    expect(creds).toEqual({ clientId: "id", apiKey: "key" });
  });

  it("rejects empty strings after trim", () => {
    const creds = resolveCredentialsFromSources(null, {
      IMA_OPENAPI_CLIENTID: "   ",
      IMA_OPENAPI_APIKEY: "key",
    });
    expect(creds).toBeNull();
  });
});
