import type {
  ImaAccountInfo,
  KnowledgeBase,
  DocumentItem,
  KnowledgeFolderPage,
  KnowledgeCollection,
  ResolvedMedia,
  KnowledgeSource,
  ExportedContent,
} from "./types";
import { buildHeaders } from "./ima-web-auth";

const GET_MEDIA_URL = "https://ima.qq.com/cgi-bin/file_manager/get_media";
const HOME_PAGE_URL = "https://ima.qq.com/cgi-bin/knowledge_tab_reader/get_home_page_data";
const KB_LIST_URL = "https://ima.qq.com/cgi-bin/knowledge_tab_reader/get_knowledge_base_list";
const KNOWLEDGE_LIST_URL = "https://ima.qq.com/cgi-bin/knowledge_tab_reader/get_knowledge_list";
const NOTE_DOC_URL = "https://ima.qq.com/cgi-bin/notebook/logic/get_share_know_doc";

export class ImaWebApi implements KnowledgeSource {
  private account: ImaAccountInfo;
  private fetchImpl: typeof fetch;

  constructor(account: ImaAccountInfo, fetchImpl?: typeof fetch) {
    this.account = account;
    this.fetchImpl = fetchImpl || fetch;
  }

  private headers(): Record<string, string> {
    return buildHeaders(this.account);
  }

  private async postJson(url: string, body: unknown): Promise<Record<string, unknown>> {
    const response = await this.fetchImpl(url, {
      method: "POST",
      headers: this.headers(),
      credentials: "include",
      body: JSON.stringify(body),
    });

    const data = (await response.json()) as Record<string, unknown>;
    if (!response.ok) {
      throw new Error(String(data.toast_text || data.message || `HTTP ${response.status}`));
    }
    if (data.code === 600001) {
      throw new Error("IMA 登录已过期，请重新登录");
    }
    return data;
  }

  async getMedia(mediaId: string): Promise<ResolvedMedia> {
    if (!mediaId || typeof mediaId !== "string") {
      throw new Error("media_id 不能为空");
    }
    const data = await this.postJson(GET_MEDIA_URL, { media_id: mediaId.trim() });
    const url = String(data.jump_url || (data.jump_url_info as Record<string, string>)?.url || "");
    if (!url) {
      const deleted = (data.jump_url_info as Record<string, boolean>)?.has_deleted === true;
      throw new Error(deleted ? "文件可能已删除或权限已变化" : String(data.toast_text || "接口未返回下载链接"));
    }
    return { data, url };
  }

  async resolveMedia(mediaId: string): Promise<ResolvedMedia> {
    return this.getMedia(mediaId);
  }

  private normalizeKnowledgeBase(item: Record<string, unknown>, type: number): KnowledgeBase {
    const basicInfo = (item.basic_info as Record<string, unknown>) || {};
    const memberInfo = (item.member_info as Record<string, unknown>) || {};
    const permissionInfo = (item.permission_info as Record<string, unknown>) || {};
    const creator = (basicInfo.creator as Record<string, unknown>) || {};
    return {
      id: String(item.id || ""),
      name: String(basicInfo.name || ""),
      type,
      member_count: Number(memberInfo.member_count || 0),
      cover_url: String(basicInfo.cover_url || ""),
      size: String(basicInfo.size || "0"),
      description: String(basicInfo.description || ""),
      update_time: String(basicInfo.update_timestamp_sec || "0"),
      status_toast: String(item.knowledge_base_status_toast || ""),
      access_status: (permissionInfo.access_status as number) ?? 0,
      creator_name: String(creator.nickname || ""),
      creator_avatar: String(creator.avatar_url || ""),
      file_count: 0,
    };
  }

  private normalizeDocument(item: Record<string, unknown>, path: string): DocumentItem {
    const folderInfo = item.folder_info as Record<string, unknown> | null;
    const isFolder = !!folderInfo;
    return {
      title: String(item.title || ""),
      media_id: String(item.media_id || ""),
      media_type: Number(item.media_type || 0),
      file_size: String(item.file_size || "0"),
      create_time: String(item.create_time || ""),
      update_time: String(item.update_time || ""),
      parent_folder_id: String(item.parent_folder_id || ""),
      folder_info: folderInfo || null,
      access_status: (item.access_status as number) ?? 0,
      _path: path,
      is_folder: isFolder,
      folder_id: isFolder ? String(folderInfo?.folder_id || item.media_id || "") : undefined,
    };
  }

  async listKnowledgeBases(): Promise<KnowledgeBase[]> {
    const first = await this.postJson(HOME_PAGE_URL, {
      need_folder_number: true,
      knowledge_list_req: {
        knowledge_base_id: this.account.uid,
        need_default_cover: false,
        sort_type: 0,
        limit: 50,
        cursor: "",
      },
      knowledge_base_id: this.account.uid,
    });

    const bases: KnowledgeBase[] = [];
    const pending: { type: number; cursor: string }[] = [];

    for (const group of (first.results as Record<string, unknown>[]) || []) {
      const list = (group.knowledge_base_list as Record<string, unknown>[]) || [];
      for (const item of list) {
        bases.push(this.normalizeKnowledgeBase(item, Number(group.type)));
      }
      if (group.is_end === false) {
        pending.push({
          type: Number(group.type),
          cursor: String(group.next_cursor || String(list.length || 10)),
        });
      }
    }

    for (const page of pending) {
      let cursor = page.cursor;
      let done = false;
      while (!done) {
        const response = await this.postJson(KB_LIST_URL, {
          params: [{ type: page.type, cursor, limit: 10 }],
        });
        for (const group of (response.results as Record<string, unknown>[]) || []) {
          const list = (group.knowledge_base_list as Record<string, unknown>[]) || [];
          for (const item of list) {
            bases.push(this.normalizeKnowledgeBase(item, Number(group.type)));
          }
          done = group.is_end !== false;
          cursor = String(group.next_cursor || String(bases.filter((b) => b.type === page.type).length));
        }
        if (!(response.results as unknown[])?.length || !cursor) done = true;
      }
    }

    const seen = new Set<string>();
    const deduped = bases.filter((base) => {
      if (!base.id || seen.has(base.id)) return false;
      seen.add(base.id);
      return true;
    });

    for (let i = 0; i < deduped.length; i += 4) {
      const batch = deduped.slice(i, i + 4);
      await Promise.all(
        batch.map(async (base) => {
          try {
            const response = await this.postJson(KNOWLEDGE_LIST_URL, {
              knowledge_base_id: base.id,
              parent_folder_id: base.id,
              folder_id: base.id,
              need_default_cover: false,
              sort_type: 0,
              limit: 1,
              cursor: "",
              need_folder_number: true,
            });
            base.file_count = parseInt(String(response.total_size || "0"), 10) || 0;
          } catch {
            base.file_count = 0;
          }
        })
      );
    }

    return deduped;
  }

  private async fetchFolderPage(
    knowledgeBaseId: string,
    folderId: string,
    cursor = "",
    limit = 50
  ): Promise<{
    items: Record<string, unknown>[];
    nextCursor: string;
    isEnd: boolean;
    totalSize: number;
  }> {
    const response = await this.postJson(KNOWLEDGE_LIST_URL, {
      sort_type: 0,
      need_default_cover: true,
      knowledge_base_id: knowledgeBaseId,
      folder_id: folderId,
      parent_folder_id: folderId,
      cursor,
      limit,
      version: "",
      ext_info: {},
    });

    return {
      items: (response.knowledge_list as Record<string, unknown>[]) || [],
      nextCursor: String(response.next_cursor || ""),
      isEnd: response.is_end !== false,
      totalSize: parseInt(String(response.total_size || "0"), 10) || 0,
    };
  }

  async listFolder(
    knowledgeBaseId: string,
    folderId = knowledgeBaseId,
    path = "",
    cursor = "",
    limit = 50
  ): Promise<KnowledgeFolderPage> {
    if (!knowledgeBaseId) throw new Error("knowledgeBaseId 不能为空");
    const page = await this.fetchFolderPage(knowledgeBaseId, folderId, cursor, limit);
    const items = page.items.map((item) => this.normalizeDocument(item, path));
    const folders = items.filter((item) => item.is_folder);
    const documents = items.filter((item) => !item.is_folder);
    return {
      folderId,
      path,
      items,
      folders,
      documents,
      totalItems: items.length,
      nextCursor: page.nextCursor,
      isEnd: page.isEnd,
      totalSize: page.totalSize,
    };
  }

  async collectDocuments(knowledgeBaseId: string): Promise<KnowledgeCollection> {
    if (!knowledgeBaseId) throw new Error("knowledgeBaseId 不能为空");
    const folders: DocumentItem[] = [];
    const documents: DocumentItem[] = [];
    const queue: { folderId: string; path: string }[] = [{ folderId: knowledgeBaseId, path: "" }];

    while (queue.length > 0) {
      const current = queue.shift()!;
      let cursor = "";
      let done = false;
      while (!done) {
        const page = await this.fetchFolderPage(knowledgeBaseId, current.folderId, cursor);
        for (const item of page.items) {
          const isFolder = !!item.folder_info;
          const normalized = this.normalizeDocument(item, current.path);
          if (isFolder) {
            const folderId = String((item.folder_info as Record<string, string>)?.folder_id || item.media_id);
            const nextPath = current.path ? `${current.path}/${item.title}` : String(item.title);
            folders.push(normalized);
            if (folderId) queue.push({ folderId, path: nextPath });
          } else if (item.media_id) {
            documents.push(normalized);
          }
        }
        cursor = page.nextCursor;
        done = page.isEnd || !cursor;
      }
    }

    return {
      folders,
      documents,
      totalFolders: folders.length,
      totalDocuments: documents.length,
    };
  }

  async getNotebookDoc(mediaId: string): Promise<{
    title: string;
    rawContent: unknown;
    linkMap: Record<string, string>;
  }> {
    const media = await this.getMedia(mediaId);
    const url = new URL(media.url);
    const docid = url.searchParams.get("docid");
    const knowledgeId = url.searchParams.get("knowledgeId") || "";
    if (!docid) throw new Error("未从笔记链接解析到 docid");

    const doc = await this.postJson(NOTE_DOC_URL, {
      docid,
      knowledge_id: knowledgeId,
      op: {
        op_basic: true,
        op_content: true,
        op_resource: true,
        op_attach: true,
        disable_cover: false,
      },
    });

    const docInfo = (doc.doc_info as Record<string, unknown>) || {};
    const basicInfo = (docInfo.basic_info as Record<string, unknown>) || {};
    const contentInfo = (docInfo.content_info as Record<string, unknown>) || {};
    const title = String((basicInfo.basic_info as Record<string, string>)?.title || media.data.title || "笔记");
    const rawContent = (contentInfo.content_info as Record<string, unknown>)?.content;
    if (!rawContent) throw new Error("未获取到笔记内容");
    const linkMap = ((doc.doc_link as Record<string, unknown>)?.link_map as Record<string, string>) || {};

    return { title, rawContent, linkMap };
  }

  async exportNote(mediaId: string, format: "md" | "html"): Promise<ExportedContent> {
    const { title, rawContent, linkMap } = await this.getNotebookDoc(mediaId);
    const { notebookContentToHtml, notebookContentToMarkdown } = await import("./exporters/note-exporter");
    if (format === "html") {
      return {
        title,
        content: notebookContentToHtml(rawContent, title, linkMap),
        mimeType: "text/html",
        extension: "html",
      };
    }
    return {
      title,
      content: notebookContentToMarkdown(rawContent, title, linkMap),
      mimeType: "text/markdown",
      extension: "md",
    };
  }

  async exportWechat(mediaId: string): Promise<ExportedContent> {
    const media = await this.getMedia(mediaId);
    const url = media.url;
    const { buildWechatHtml } = await import("./exporters/wechat-exporter");
    const html = await buildWechatHtml(url, String(media.data.title || "微信文章"), this.fetchImpl);
    return {
      title: String(media.data.title || "微信文章"),
      content: html,
      mimeType: "text/html",
      extension: "html",
    };
  }
}
