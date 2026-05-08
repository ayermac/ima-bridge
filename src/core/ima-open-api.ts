import type { KnowledgeBase, UploadResult } from "./types";

const BASE_URL = "https://ima.qq.com";

export type OpenApiCredentials = {
  clientId: string;
  apiKey: string;
};

export type CosCredential = {
  token: string;
  secret_id: string;
  secret_key: string;
  start_time: string;
  expired_time: string;
  appid: string;
  bucket_name: string;
  region: string;
  custom_domain: string;
  cos_key: string;
};

export type CreateMediaResult = {
  media_id: string;
  cos_credential: CosCredential;
};

export type CheckRepeatedResult = {
  name: string;
  is_repeated: boolean;
};

export class ImaOpenApi {
  private credentials: OpenApiCredentials;
  private version: string;

  constructor(credentials: OpenApiCredentials, version = "0.2.0") {
    this.credentials = credentials;
    this.version = version;
  }

  private headers(): Record<string, string> {
    return {
      "ima-openapi-clientid": this.credentials.clientId,
      "ima-openapi-apikey": this.credentials.apiKey,
      "ima-openapi-ctx": `skill_version=${this.version}`,
      "Content-Type": "application/json",
    };
  }

  private async postJson<T = unknown>(apiPath: string, body: unknown): Promise<T> {
    const url = `${BASE_URL}/${apiPath}`;
    const response = await fetch(url, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });

    const text = await response.text();
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new Error(`OpenAPI 返回非 JSON: ${text.slice(0, 200)}`);
    }

    if (data.code !== 0) {
      throw new Error(String(data.msg || `OpenAPI 业务错误 code=${data.code}`));
    }

    return (data.data ?? {}) as T;
  }

  async listAddableKnowledgeBases(cursor = "", limit = 50): Promise<KnowledgeBase[]> {
    const data = await this.postJson<{
      addable_knowledge_base_list?: Array<{ id: string; name: string }>;
      next_cursor?: string;
      is_end?: boolean;
    }>("openapi/wiki/v1/get_addable_knowledge_base_list", { cursor, limit });

    const list = data.addable_knowledge_base_list || [];
    return list.map((item) => ({
      id: item.id,
      name: item.name,
      type: 0,
      member_count: 0,
      cover_url: "",
      size: "0",
      description: "",
      update_time: "",
      status_toast: "",
      access_status: 2,
      creator_name: "",
      creator_avatar: "",
      file_count: 0,
    }));
  }

  async checkRepeatedNames(
    knowledgeBaseId: string,
    params: Array<{ name: string; media_type: number }>,
    folderId?: string
  ): Promise<CheckRepeatedResult[]> {
    const body: Record<string, unknown> = {
      params,
      knowledge_base_id: knowledgeBaseId,
    };
    if (folderId) body.folder_id = folderId;

    const data = await this.postJson<{
      results?: CheckRepeatedResult[];
    }>("openapi/wiki/v1/check_repeated_names", body);

    return data.results || [];
  }

  async createMedia(params: {
    file_name: string;
    file_size: number;
    content_type: string;
    knowledge_base_id: string;
    file_ext: string;
  }): Promise<CreateMediaResult> {
    return this.postJson<CreateMediaResult>("openapi/wiki/v1/create_media", params);
  }

  async addKnowledge(params: {
    media_type: number;
    media_id: string;
    title: string;
    knowledge_base_id: string;
    folder_id?: string;
    file_info: {
      cos_key: string;
      file_size: number;
      file_name: string;
    };
  }): Promise<{ media_id: string }> {
    return this.postJson<{ media_id: string }>("openapi/wiki/v1/add_knowledge", params);
  }

  async importUrls(params: {
    urls: string[];
    knowledge_base_id: string;
  }): Promise<{ results?: Array<{ url: string; success: boolean; media_id?: string; msg?: string }> }> {
    return this.postJson<{ results?: Array<{ url: string; success: boolean; media_id?: string; msg?: string }> }>("openapi/wiki/v1/import_urls", params);
  }
}

// Helpers for file type inference (used by main process IPC)
export function inferMediaType(fileName: string): { mediaType: number; contentType: string; ext: string } {
  const lower = fileName.toLowerCase();
  const extMatch = lower.match(/\.([a-z0-9]+)$/);
  const ext = extMatch ? extMatch[1] : "";

  switch (ext) {
    case "pdf":
      return { mediaType: 1, contentType: "application/pdf", ext: "pdf" };
    case "doc":
    case "docx":
      return {
        mediaType: 3,
        contentType: ext === "docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "application/msword",
        ext,
      };
    case "ppt":
    case "pptx":
      return {
        mediaType: 4,
        contentType: ext === "pptx" ? "application/vnd.openxmlformats-officedocument.presentationml.presentation" : "application/vnd.ms-powerpoint",
        ext,
      };
    case "xls":
    case "xlsx":
    case "csv":
      return {
        mediaType: 5,
        contentType: ext === "csv" ? "text/csv" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ext,
      };
    case "md":
    case "markdown":
      return { mediaType: 7, contentType: "text/markdown", ext };
    case "png":
      return { mediaType: 9, contentType: "image/png", ext };
    case "jpg":
    case "jpeg":
      return { mediaType: 9, contentType: "image/jpeg", ext };
    case "webp":
      return { mediaType: 9, contentType: "image/webp", ext };
    case "txt":
      return { mediaType: 13, contentType: "text/plain", ext };
    case "xmind":
      return { mediaType: 14, contentType: "application/vnd.xmind.workbook", ext };
    case "mp3":
      return { mediaType: 15, contentType: "audio/mpeg", ext };
    case "m4a":
      return { mediaType: 15, contentType: "audio/x-m4a", ext };
    case "wav":
      return { mediaType: 15, contentType: "audio/wav", ext };
    case "aac":
      return { mediaType: 15, contentType: "audio/aac", ext };
    default:
      return { mediaType: 1, contentType: "application/octet-stream", ext: ext || "bin" };
  }
}
