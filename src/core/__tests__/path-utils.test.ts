import { describe, it, expect } from "vitest";
import { cleanPathPart, pathParts, filenameFor } from "../path-utils";
import type { DocumentItem } from "../types";

describe("cleanPathPart", () => {
  it("replaces Windows illegal characters with underscore", () => {
    expect(cleanPathPart("a/b:c*d?e\"f<g>h|i")).toBe("a_b_c_d_e_f_g_h_i");
  });

  it("collapses multiple spaces", () => {
    expect(cleanPathPart("hello    world")).toBe("hello world");
  });

  it("trims leading/trailing spaces", () => {
    expect(cleanPathPart("  spaced  ")).toBe("spaced");
  });

  it("strips trailing dots", () => {
    expect(cleanPathPart("file.name.")).toBe("file.name");
    expect(cleanPathPart("dots...")).toBe("dots");
  });

  it("strips trailing spaces", () => {
    expect(cleanPathPart("name ")).toBe("name");
  });

  it("handles Windows reserved names", () => {
    expect(cleanPathPart("CON")).toBe("CON_");
    expect(cleanPathPart("PRN")).toBe("PRN_");
    expect(cleanPathPart("AUX")).toBe("AUX_");
    expect(cleanPathPart("NUL")).toBe("NUL_");
    expect(cleanPathPart("COM1")).toBe("COM1_");
    expect(cleanPathPart("LPT1")).toBe("LPT1_");
  });

  it("handles reserved names with extensions", () => {
    expect(cleanPathPart("CON.txt")).toBe("CON.txt_");
  });

  it("is case-insensitive for reserved names", () => {
    expect(cleanPathPart("con")).toBe("con_");
    expect(cleanPathPart("lpt9")).toBe("lpt9_");
  });

  it("truncates to 120 chars", () => {
    const long = "a".repeat(200);
    expect(cleanPathPart(long).length).toBe(120);
  });

  it("strips trailing dots after truncation", () => {
    const long = "a".repeat(118) + "..";
    const result = cleanPathPart(long);
    expect(result.length).toBeLessThanOrEqual(120);
    expect(result.endsWith(".")).toBe(false);
  });

  it("falls back to 未命名 for empty string", () => {
    expect(cleanPathPart("")).toBe("未命名");
    expect(cleanPathPart("   ")).toBe("未命名");
    expect(cleanPathPart("...")).toBe("未命名");
  });

  it("preserves CJK and removes emoji-like symbols", () => {
    expect(cleanPathPart("中文文件名")).toBe("中文文件名");
    expect(cleanPathPart("Emoji_🎉")).toBe("Emoji_");
  });

  it("removes invisible unicode controls", () => {
    expect(cleanPathPart("a\u200bb\ufeffc")).toBe("abc");
  });
});

describe("pathParts", () => {
  it("splits and cleans path segments", () => {
    expect(pathParts("folder1/folder2/file")).toEqual(["folder1", "folder2", "file"]);
  });

  it("filters empty segments", () => {
    expect(pathParts("//a//b//")).toEqual(["a", "b"]);
  });

  it("handles empty string", () => {
    expect(pathParts("")).toEqual([]);
  });
});

describe("filenameFor", () => {
  it("builds filename with extension from media source_path", () => {
    const doc: DocumentItem = {
      title: "doc",
      media_id: "m1",
      media_type: 1,
      file_size: "0",
      create_time: "",
      update_time: "",
      parent_folder_id: "",
      folder_info: {},
      access_status: 0,
      _path: "a/b",
    };
    const media = { source_path: "https://example.com/file.pdf" };
    expect(filenameFor(doc, media)).toBe("a/b/doc.pdf");
  });

  it("avoids duplicate extension", () => {
    const doc: DocumentItem = {
      title: "report.pdf",
      media_id: "m1",
      media_type: 1,
      file_size: "0",
      create_time: "",
      update_time: "",
      parent_folder_id: "",
      folder_info: {},
      access_status: 0,
      _path: "",
    };
    const media = { source_path: "https://example.com/file.pdf" };
    expect(filenameFor(doc, media)).toBe("report.pdf");
  });

  it("falls back to ima-file when no title", () => {
    const doc: DocumentItem = {
      title: "",
      media_id: "m1",
      media_type: 1,
      file_size: "0",
      create_time: "",
      update_time: "",
      parent_folder_id: "",
      folder_info: {},
      access_status: 0,
      _path: "",
    };
    expect(filenameFor(doc, {})).toBe("ima-file");
  });
});
