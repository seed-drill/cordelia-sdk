import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { CordeliaError, codeFromStatus } from "./error.js";
import type {
  CordeliaOptions,
  ChannelHandle,
  ChannelInfo,
  ChannelDetails,
  SubscribeOptions,
  PublishOptions,
  PublishResult,
  ListenOptions,
  ListenResult,
  DMHandle,
  DMInfo,
  GroupHandle,
  GroupOptions,
  GroupInfo,
  InviteResult,
  RemoveResult,
  RotateResult,
  DeleteResult,
  SearchOptions,
  SearchResult,
  Identity,
} from "./types.js";

const DEFAULT_URL = "http://localhost:9473";
const TOKEN_PATH = ".cordelia/node-token";

/** Cordelia encrypted pub/sub client. */
export class Cordelia {
  private readonly baseUrl: string;
  private readonly token: string;
  readonly realtimePollMs: number;
  readonly batchPollMs: number;

  constructor(opts?: CordeliaOptions) {
    this.baseUrl = (opts?.nodeUrl ?? DEFAULT_URL).replace(/\/+$/, "");
    this.token = opts?.token ?? resolveToken();
    this.realtimePollMs = opts?.realtimePollMs ?? 2000;
    this.batchPollMs = opts?.batchPollMs ?? 30000;
  }

  // ── Channels ─────────────────────────────────────────────────

  /** Subscribe to (or create) a named channel. */
  async subscribe(
    channel: string,
    opts?: SubscribeOptions,
  ): Promise<ChannelHandle> {
    const body: Record<string, unknown> = { channel };
    if (opts?.mode) body.mode = opts.mode;
    if (opts?.access) body.access = opts.access;
    const r = await this.post("/subscribe", body);
    return {
      channel: r.channel,
      channelId: r.channel_id,
      isNew: r.is_new,
      role: r.role,
      mode: r.mode,
      access: r.access,
      createdAt: r.created_at,
      joinedAt: r.joined_at ?? undefined,
    };
  }

  /** Unsubscribe from a channel. */
  async unsubscribe(channel: string): Promise<{ ok: boolean }> {
    const r = await this.post("/unsubscribe", { channel });
    return { ok: r.ok };
  }

  /** List subscribed channels. */
  async channels(): Promise<ChannelDetails[]> {
    const r = await this.post("/list", {});
    return r.channels.map(mapChannelDetails);
  }

  /** Check whether a channel exists (does not subscribe). */
  async info(channel: string): Promise<ChannelInfo> {
    const r = await this.post("/info", { channel });
    return {
      channel: r.channel,
      channelId: r.channel_id,
      exists: r.exists,
      mode: r.mode ?? undefined,
      access: r.access ?? undefined,
      owner: r.owner ?? undefined,
      memberCount: r.member_count ?? undefined,
      createdAt: r.created_at ?? undefined,
    };
  }

  // ── Pub/Sub ──────────────────────────────────────────────────

  /** Publish content to a channel. */
  async publish(
    channel: string,
    content: unknown,
    opts?: PublishOptions,
  ): Promise<PublishResult> {
    const body: Record<string, unknown> = { channel, content };
    if (opts?.metadata) body.metadata = opts.metadata;
    if (opts?.itemType) body.item_type = opts.itemType;
    if (opts?.parentId) body.parent_id = opts.parentId;
    const r = await this.post("/publish", body);
    return {
      itemId: r.item_id,
      channel: r.channel,
      publishedAt: r.published_at,
      author: r.author,
      itemType: r.item_type,
    };
  }

  /** Listen for items on a channel (cursor-based polling). */
  async listen(
    channel: string,
    opts?: ListenOptions,
  ): Promise<ListenResult> {
    const body: Record<string, unknown> = { channel };
    if (opts?.since) body.since = opts.since;
    if (opts?.limit !== undefined) body.limit = opts.limit;
    const r = await this.post("/listen", body);
    return {
      channel: r.channel,
      items: r.items.map(mapItem),
      cursor: r.cursor,
      hasMore: r.has_more,
    };
  }

  /** Delete (tombstone) an item. */
  async deleteItem(
    channel: string,
    itemId: string,
  ): Promise<DeleteResult> {
    const r = await this.post("/delete-item", {
      channel,
      item_id: itemId,
    });
    return { ok: r.ok, itemId: r.item_id };
  }

  // ── DMs ──────────────────────────────────────────────────────

  /** Create or connect a bilateral DM channel. */
  async dm(peerPublicKey: string): Promise<DMHandle> {
    const r = await this.post("/dm", { peer_public_key: peerPublicKey });
    return {
      channelId: r.channel_id,
      isNew: r.is_new,
      peerPublicKey: r.peer_public_key,
      createdAt: r.created_at,
    };
  }

  /** List active DM channels. */
  async dms(): Promise<DMInfo[]> {
    const r = await this.post("/list-dms", {});
    return r.dms.map((d: Record<string, unknown>) => ({
      channelId: d.channel_id,
      peerPublicKey: d.peer_public_key,
      itemCount: d.item_count,
      lastActivity: d.last_activity ?? undefined,
      createdAt: d.created_at,
    }));
  }

  // ── Groups ───────────────────────────────────────────────────

  /** Create a group channel. */
  async group(opts?: GroupOptions): Promise<GroupHandle> {
    const body: Record<string, unknown> = {};
    if (opts?.mode) body.mode = opts.mode;
    const r = await this.post("/group", body);
    return {
      channelId: r.channel_id,
      mode: r.mode,
      createdAt: r.created_at,
    };
  }

  /** Invite a member to a group. */
  async groupInvite(
    channelId: string,
    peerPublicKey: string,
  ): Promise<InviteResult> {
    const r = await this.post("/group/invite", {
      channel_id: channelId,
      peer_public_key: peerPublicKey,
    });
    return {
      ok: r.ok,
      channelId: r.channel_id,
      peerPublicKey: r.peer_public_key,
      memberCount: r.member_count,
    };
  }

  /** Remove a member from a group (triggers PSK rotation). */
  async groupRemove(
    channelId: string,
    peerPublicKey: string,
  ): Promise<RemoveResult> {
    const r = await this.post("/group/remove", {
      channel_id: channelId,
      peer_public_key: peerPublicKey,
    });
    return {
      ok: r.ok,
      channelId: r.channel_id,
      peerPublicKey: r.peer_public_key,
      keyRotated: r.key_rotated,
      newKeyVersion: r.new_key_version,
    };
  }

  /** List group channels. */
  async groups(): Promise<GroupInfo[]> {
    const r = await this.post("/list-groups", {});
    return r.groups.map((g: Record<string, unknown>) => ({
      channelId: g.channel_id,
      role: g.role,
      mode: g.mode,
      memberCount: g.member_count,
      itemCount: g.item_count,
      lastActivity: g.last_activity ?? undefined,
      createdAt: g.created_at,
    }));
  }

  // ── PSK Rotation ─────────────────────────────────────────────

  /** Rotate the pre-shared key for a channel. Owner only. */
  async rotatePsk(channel: string): Promise<RotateResult> {
    const r = await this.post("/rotate-psk", { channel });
    return {
      ok: r.ok,
      channel: r.channel,
      newKeyVersion: r.new_key_version,
    };
  }

  // ── Search ───────────────────────────────────────────────────

  /** Full-text search within a channel. */
  async search(
    channel: string,
    query: string,
    opts?: SearchOptions,
  ): Promise<SearchResult> {
    const body: Record<string, unknown> = { channel, query };
    if (opts?.limit !== undefined) body.limit = opts.limit;
    if (opts?.types) body.types = opts.types;
    if (opts?.since) body.since = opts.since;
    const r = await this.post("/search", body);
    return {
      channel: r.channel,
      results: r.results.map((h: Record<string, unknown>) => ({
        ...mapItem(h),
        score: h.score,
      })),
      total: r.total,
      semanticAvailable: r.semantic_available,
    };
  }

  // ── Identity ─────────────────────────────────────────────────

  /** Get this node's identity. */
  async identity(): Promise<Identity> {
    const r = await this.post("/identity", {});
    return {
      publicKey: r.ed25519_public_key,
      encryptionKey: r.x25519_public_key,
      nodeId: r.node_id,
      channelsSubscribed: r.channels_subscribed,
    };
  }

  // ── Internal ─────────────────────────────────────────────────

  /** POST to the node API and return parsed JSON. */
  private async post(
    path: string,
    body: Record<string, unknown>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<any> {
    const url = `${this.baseUrl}/api/v1/channels${path}`;
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      throw new CordeliaError(
        "network_error",
        `Failed to connect to Cordelia node at ${this.baseUrl}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    if (!res.ok) {
      const text = await res.text();
      let message = text;
      let context: string | undefined;
      try {
        const parsed = JSON.parse(text);
        if (parsed.error) {
          message = parsed.error.message ?? text;
          context = parsed.error.context;
        }
      } catch {
        // use raw text
      }
      throw new CordeliaError(
        codeFromStatus(res.status),
        message,
        res.status,
        context,
      );
    }

    return res.json();
  }
}

// ── Helpers ──────────────────────────────────────────────────────

function resolveToken(): string {
  const envToken = process.env.CORDELIA_TOKEN;
  if (envToken) return envToken;
  try {
    return readFileSync(join(homedir(), TOKEN_PATH), "utf-8").trim();
  } catch {
    throw new CordeliaError(
      "unauthorized",
      "No token provided. Set CORDELIA_TOKEN or create ~/.cordelia/node-token",
    );
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapItem(r: any) {
  return {
    itemId: r.item_id,
    content: r.content,
    metadata: r.metadata ?? undefined,
    itemType: r.item_type,
    parentId: r.parent_id ?? undefined,
    author: r.author,
    publishedAt: r.published_at,
    signatureValid: r.signature_valid,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapChannelDetails(r: any): ChannelDetails {
  return {
    channel: r.channel,
    channelId: r.channel_id,
    role: r.role,
    mode: r.mode,
    access: r.access,
    itemCount: r.item_count,
    lastActivity: r.last_activity ?? undefined,
    createdAt: r.created_at,
  };
}
