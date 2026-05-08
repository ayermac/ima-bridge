import { describe, it, expect } from "vitest";
import { sanitizeQueueForRestore } from "../queue-store";
import type { QueueItem } from "../../core/types";

function makeItem(status: QueueItem["status"], overrides?: Partial<QueueItem>): QueueItem {
  return {
    id: "q1",
    sourceKnowledgeBaseId: "kb1",
    sourceKnowledgeBaseName: "KB",
    mediaId: "m1",
    mediaType: 1,
    title: "doc",
    sourcePath: "p1",
    status,
    createdAt: 1,
    updatedAt: 1,
    error: overrides?.error || "some error",
    ...overrides,
  };
}

describe("sanitizeQueueForRestore", () => {
  it("keeps pending as pending", () => {
    const input = [makeItem("pending")];
    const result = sanitizeQueueForRestore(input);
    expect(result[0].status).toBe("pending");
  });

  it("resolves resolving to pending", () => {
    const input = [makeItem("resolving")];
    const result = sanitizeQueueForRestore(input);
    expect(result[0].status).toBe("pending");
    expect(result[0].error).toBeUndefined();
  });

  it("resolves downloading to pending", () => {
    const input = [makeItem("downloading")];
    const result = sanitizeQueueForRestore(input);
    expect(result[0].status).toBe("pending");
  });

  it("resolves exporting to pending", () => {
    const input = [makeItem("exporting")];
    const result = sanitizeQueueForRestore(input);
    expect(result[0].status).toBe("pending");
  });

  it("resolves preparing to pending", () => {
    const input = [makeItem("preparing")];
    const result = sanitizeQueueForRestore(input);
    expect(result[0].status).toBe("pending");
  });

  it("resolves uploading to pending", () => {
    const input = [makeItem("uploading")];
    const result = sanitizeQueueForRestore(input);
    expect(result[0].status).toBe("pending");
  });

  it("keeps done", () => {
    const input = [makeItem("done")];
    const result = sanitizeQueueForRestore(input);
    expect(result[0].status).toBe("done");
  });

  it("keeps synced", () => {
    const input = [makeItem("synced")];
    const result = sanitizeQueueForRestore(input);
    expect(result[0].status).toBe("synced");
  });

  it("keeps failed", () => {
    const input = [makeItem("failed")];
    const result = sanitizeQueueForRestore(input);
    expect(result[0].status).toBe("failed");
  });

  it("keeps sync_failed", () => {
    const input = [makeItem("sync_failed")];
    const result = sanitizeQueueForRestore(input);
    expect(result[0].status).toBe("sync_failed");
  });

  it("keeps skipped", () => {
    const input = [makeItem("skipped")];
    const result = sanitizeQueueForRestore(input);
    expect(result[0].status).toBe("skipped");
  });

  it("clears error on resettable statuses", () => {
    const input = [makeItem("downloading", { error: "timeout" })];
    const result = sanitizeQueueForRestore(input);
    expect(result[0].error).toBeUndefined();
  });

  it("preserves error on terminal statuses", () => {
    const input = [makeItem("failed", { error: "network error" })];
    const result = sanitizeQueueForRestore(input);
    expect(result[0].error).toBe("network error");
  });

  it("does not mutate original array", () => {
    const original = [makeItem("downloading")];
    const result = sanitizeQueueForRestore(original);
    expect(original[0].status).toBe("downloading");
    expect(result[0].status).toBe("pending");
  });
});
