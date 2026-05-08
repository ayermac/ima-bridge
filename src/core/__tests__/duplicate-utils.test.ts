import { describe, it, expect } from "vitest";
import { generateTimestampSuffix, renameWithTimestamp } from "../duplicate-utils";

describe("generateTimestampSuffix", () => {
  it("formats date correctly", () => {
    const now = new Date(2024, 0, 15, 9, 5, 3); // 2024-01-15 09:05:03
    expect(generateTimestampSuffix(now)).toBe("20240115_090503");
  });

  it("zero-pads month/day/hour/minute/second", () => {
    const now = new Date(2024, 5, 5, 3, 2, 1); // 2024-06-05 03:02:01
    expect(generateTimestampSuffix(now)).toBe("20240605_030201");
  });
});

describe("renameWithTimestamp", () => {
  it("inserts timestamp before extension", () => {
    const now = new Date(2024, 0, 15, 9, 5, 3);
    expect(renameWithTimestamp("report.pdf", now)).toBe("report_20240115_090503.pdf");
  });

  it("works without extension", () => {
    const now = new Date(2024, 0, 15, 9, 5, 3);
    expect(renameWithTimestamp("README", now)).toBe("README_20240115_090503");
  });

  it("preserves multi-dot extensions", () => {
    const now = new Date(2024, 0, 15, 9, 5, 3);
    expect(renameWithTimestamp("archive.tar.gz", now)).toBe("archive.tar_20240115_090503.gz");
  });

  it("preserves base name with dots", () => {
    const now = new Date(2024, 0, 15, 9, 5, 3);
    expect(renameWithTimestamp("v1.2.3.md", now)).toBe("v1.2.3_20240115_090503.md");
  });
});
