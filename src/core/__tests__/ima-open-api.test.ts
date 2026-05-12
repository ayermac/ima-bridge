import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ImaOpenApi, inferMediaType } from "../ima-open-api";

describe("inferMediaType", () => {
  it("infers PDF", () => {
    expect(inferMediaType("report.PDF")).toEqual({ mediaType: 1, contentType: "application/pdf", ext: "pdf" });
  });

  it("infers Word docx", () => {
    expect(inferMediaType("doc.docx")).toEqual({ mediaType: 3, contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ext: "docx" });
  });

  it("infers PowerPoint pptx", () => {
    expect(inferMediaType("slides.pptx")).toEqual({ mediaType: 7, contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation", ext: "pptx" });
  });

  it("infers Excel xlsx", () => {
    expect(inferMediaType("sheet.xlsx")).toEqual({ mediaType: 15, contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ext: "xlsx" });
  });

  it("infers CSV", () => {
    expect(inferMediaType("data.csv")).toEqual({ mediaType: 15, contentType: "text/csv", ext: "csv" });
  });

  it("infers Markdown", () => {
    expect(inferMediaType("note.md")).toEqual({ mediaType: 3, contentType: "text/markdown", ext: "md" });
  });

  it("infers PNG image", () => {
    expect(inferMediaType("img.png")).toEqual({ mediaType: 4, contentType: "image/png", ext: "png" });
  });

  it("infers JPEG", () => {
    expect(inferMediaType("photo.jpg")).toEqual({ mediaType: 4, contentType: "image/jpeg", ext: "jpg" });
  });

  it("infers TXT", () => {
    expect(inferMediaType("readme.txt")).toEqual({ mediaType: 3, contentType: "text/plain", ext: "txt" });
  });

  it("infers MP3 audio", () => {
    expect(inferMediaType("song.mp3")).toEqual({ mediaType: 9, contentType: "audio/mpeg", ext: "mp3" });
  });

  it("defaults to octet-stream for unknown ext", () => {
    expect(inferMediaType("archive.7z")).toEqual({ mediaType: 1, contentType: "application/octet-stream", ext: "7z" });
  });

  it("defaults to bin for no extension", () => {
    expect(inferMediaType("noext")).toEqual({ mediaType: 1, contentType: "application/octet-stream", ext: "bin" });
  });
});

describe("ImaOpenApi.postJson error handling", () => {
  let api: ImaOpenApi;

  beforeEach(() => {
    api = new ImaOpenApi({ clientId: "test-client", apiKey: "test-key" });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("throws on code != 0", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      text: async () => JSON.stringify({ code: 1001, msg: "参数错误" }),
    } as Response);

    await expect(api.listAddableKnowledgeBases()).rejects.toThrow("参数错误");
  });

  it("throws generic message when msg is missing", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      text: async () => JSON.stringify({ code: 500 }),
    } as Response);

    await expect(api.listAddableKnowledgeBases()).rejects.toThrow(/业务错误 code=500/);
  });

  it("throws on non-JSON response", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      text: async () => "<html>error</html>",
    } as Response);

    await expect(api.listAddableKnowledgeBases()).rejects.toThrow(/返回非 JSON/);
  });

  it("throws on network error", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network failure"));

    await expect(api.listAddableKnowledgeBases()).rejects.toThrow("Network failure");
  });

  it("succeeds when code === 0", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      text: async () =>
        JSON.stringify({
          code: 0,
          data: { addable_knowledge_base_list: [{ id: "kb1", name: "Test" }], is_end: true },
        }),
    } as Response);

    const result = await api.listAddableKnowledgeBases();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("kb1");
  });

  it("does not include apiKey in error message", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      text: async () => JSON.stringify({ code: 403, msg: "鉴权失败" }),
    } as Response);

    try {
      await api.listAddableKnowledgeBases();
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg).not.toContain("test-key");
      expect(msg).not.toContain("test-client");
    }
  });
});
