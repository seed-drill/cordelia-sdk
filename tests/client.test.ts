import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Cordelia, CordeliaError } from "../src/index.js";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function ok(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as Response;
}

function err(status: number, code: string, message: string): Response {
  const body = { error: { code, message } };
  return {
    ok: false,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as Response;
}

describe("Cordelia", () => {
  let c: Cordelia;

  beforeEach(() => {
    c = new Cordelia({ token: "test-token", nodeUrl: "http://localhost:9473" });
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Subscribe ──────────────────────────────────────────────

  it("subscribe creates a channel", async () => {
    mockFetch.mockResolvedValueOnce(
      ok({
        channel: "research",
        channel_id: "abc123",
        is_new: true,
        role: "owner",
        mode: "realtime",
        access: "open",
        created_at: "2026-03-13T08:00:00Z",
      }),
    );

    const h = await c.subscribe("research");

    expect(h.channel).toBe("research");
    expect(h.channelId).toBe("abc123");
    expect(h.isNew).toBe(true);
    expect(h.role).toBe("owner");

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("http://localhost:9473/api/v1/channels/subscribe");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ channel: "research" });
    expect(init.headers.Authorization).toBe("Bearer test-token");
  });

  it("subscribe passes options", async () => {
    mockFetch.mockResolvedValueOnce(
      ok({
        channel: "alerts",
        channel_id: "def456",
        is_new: true,
        role: "owner",
        mode: "batch",
        access: "invite_only",
        created_at: "2026-03-13T08:00:00Z",
      }),
    );

    await c.subscribe("alerts", { mode: "batch", access: "invite_only" });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.mode).toBe("batch");
    expect(body.access).toBe("invite_only");
  });

  // ── Publish ────────────────────────────────────────────────

  it("publish sends content", async () => {
    mockFetch.mockResolvedValueOnce(
      ok({
        item_id: "ci_01TEST",
        channel: "research",
        published_at: "2026-03-13T08:01:00Z",
        author: "cordelia_pk1abc",
        item_type: "message",
      }),
    );

    const r = await c.publish("research", { text: "hello" });

    expect(r.itemId).toBe("ci_01TEST");
    expect(r.author).toBe("cordelia_pk1abc");

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.channel).toBe("research");
    expect(body.content).toEqual({ text: "hello" });
  });

  it("publish with options", async () => {
    mockFetch.mockResolvedValueOnce(
      ok({
        item_id: "ci_02TEST",
        channel: "research",
        published_at: "2026-03-13T08:02:00Z",
        author: "cordelia_pk1abc",
        item_type: "event",
      }),
    );

    await c.publish("research", { x: 1 }, {
      metadata: { tags: ["test"] },
      itemType: "event",
      parentId: "ci_01TEST",
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.metadata).toEqual({ tags: ["test"] });
    expect(body.item_type).toBe("event");
    expect(body.parent_id).toBe("ci_01TEST");
  });

  // ── Listen ─────────────────────────────────────────────────

  it("listen returns items with camelCase mapping", async () => {
    mockFetch.mockResolvedValueOnce(
      ok({
        channel: "research",
        items: [
          {
            item_id: "ci_01TEST",
            content: { text: "hello" },
            metadata: null,
            item_type: "message",
            parent_id: null,
            author: "cordelia_pk1abc",
            published_at: "2026-03-13T08:01:00Z",
            signature_valid: true,
          },
        ],
        cursor: "2026-03-13T08:01:00Z",
        has_more: false,
      }),
    );

    const r = await c.listen("research", { since: "2026-03-13T08:00:00Z" });

    expect(r.items).toHaveLength(1);
    expect(r.items[0].itemId).toBe("ci_01TEST");
    expect(r.items[0].signatureValid).toBe(true);
    expect(r.items[0].parentId).toBeUndefined();
    expect(r.cursor).toBe("2026-03-13T08:01:00Z");
    expect(r.hasMore).toBe(false);
  });

  // ── Channels ───────────────────────────────────────────────

  it("channels lists subscribed channels", async () => {
    mockFetch.mockResolvedValueOnce(
      ok({
        channels: [
          {
            channel: "research",
            channel_id: "abc123",
            role: "owner",
            mode: "realtime",
            access: "open",
            item_count: 42,
            last_activity: "2026-03-13T08:00:00Z",
            created_at: "2026-03-10T00:00:00Z",
          },
        ],
      }),
    );

    const r = await c.channels();

    expect(r).toHaveLength(1);
    expect(r[0].channelId).toBe("abc123");
    expect(r[0].itemCount).toBe(42);
  });

  // ── Info ───────────────────────────────────────────────────

  it("info returns channel existence", async () => {
    mockFetch.mockResolvedValueOnce(
      ok({
        channel: "research",
        channel_id: "abc123",
        exists: true,
        mode: "realtime",
        access: "open",
        owner: "cordelia_pk1abc",
        member_count: 3,
        created_at: "2026-03-10T00:00:00Z",
      }),
    );

    const r = await c.info("research");
    expect(r.exists).toBe(true);
    expect(r.memberCount).toBe(3);
  });

  // ── Unsubscribe ────────────────────────────────────────────

  it("unsubscribe", async () => {
    mockFetch.mockResolvedValueOnce(
      ok({ ok: true, channel: "research" }),
    );

    const r = await c.unsubscribe("research");
    expect(r.ok).toBe(true);
  });

  // ── DMs ────────────────────────────────────────────────────

  it("dm creates bilateral channel", async () => {
    mockFetch.mockResolvedValueOnce(
      ok({
        channel_id: "dm_abc123",
        is_new: true,
        peer_public_key: "cordelia_pk1peer",
        created_at: "2026-03-13T08:00:00Z",
      }),
    );

    const r = await c.dm("cordelia_pk1peer");
    expect(r.channelId).toBe("dm_abc123");
    expect(r.isNew).toBe(true);
    expect(r.peerPublicKey).toBe("cordelia_pk1peer");
  });

  it("dms lists DM channels", async () => {
    mockFetch.mockResolvedValueOnce(
      ok({
        dms: [
          {
            channel_id: "dm_abc123",
            peer_public_key: "cordelia_pk1peer",
            item_count: 5,
            last_activity: "2026-03-13T08:00:00Z",
            created_at: "2026-03-12T00:00:00Z",
          },
        ],
      }),
    );

    const r = await c.dms();
    expect(r).toHaveLength(1);
    expect(r[0].itemCount).toBe(5);
  });

  // ── Groups ─────────────────────────────────────────────────

  it("group create", async () => {
    mockFetch.mockResolvedValueOnce(
      ok({
        channel_id: "grp_uuid",
        mode: "realtime",
        created_at: "2026-03-13T08:00:00Z",
      }),
    );

    const r = await c.group();
    expect(r.channelId).toBe("grp_uuid");
  });

  it("groupInvite", async () => {
    mockFetch.mockResolvedValueOnce(
      ok({
        ok: true,
        channel_id: "grp_uuid",
        peer_public_key: "cordelia_pk1peer",
        member_count: 3,
      }),
    );

    const r = await c.groupInvite("grp_uuid", "cordelia_pk1peer");
    expect(r.ok).toBe(true);
    expect(r.memberCount).toBe(3);
  });

  it("groupRemove triggers key rotation", async () => {
    mockFetch.mockResolvedValueOnce(
      ok({
        ok: true,
        channel_id: "grp_uuid",
        peer_public_key: "cordelia_pk1peer",
        key_rotated: true,
        new_key_version: 2,
      }),
    );

    const r = await c.groupRemove("grp_uuid", "cordelia_pk1peer");
    expect(r.keyRotated).toBe(true);
    expect(r.newKeyVersion).toBe(2);
  });

  it("groups lists group channels", async () => {
    mockFetch.mockResolvedValueOnce(
      ok({
        groups: [
          {
            channel_id: "grp_uuid",
            role: "owner",
            mode: "realtime",
            member_count: 3,
            item_count: 10,
            last_activity: null,
            created_at: "2026-03-13T08:00:00Z",
          },
        ],
      }),
    );

    const r = await c.groups();
    expect(r).toHaveLength(1);
    expect(r[0].memberCount).toBe(3);
    expect(r[0].lastActivity).toBeUndefined();
  });

  // ── PSK Rotation ───────────────────────────────────────────

  it("rotatePsk", async () => {
    mockFetch.mockResolvedValueOnce(
      ok({ ok: true, channel: "research", new_key_version: 3 }),
    );

    const r = await c.rotatePsk("research");
    expect(r.newKeyVersion).toBe(3);
  });

  // ── Delete Item ────────────────────────────────────────────

  it("deleteItem", async () => {
    mockFetch.mockResolvedValueOnce(
      ok({ ok: true, item_id: "ci_01TEST" }),
    );

    const r = await c.deleteItem("research", "ci_01TEST");
    expect(r.ok).toBe(true);
    expect(r.itemId).toBe("ci_01TEST");
  });

  // ── Search ─────────────────────────────────────────────────

  it("search", async () => {
    mockFetch.mockResolvedValueOnce(
      ok({
        channel: "research",
        results: [
          {
            item_id: "ci_01TEST",
            content: { text: "found it" },
            metadata: null,
            item_type: "message",
            parent_id: null,
            author: "cordelia_pk1abc",
            published_at: "2026-03-13T08:01:00Z",
            signature_valid: true,
            score: 0.85,
          },
        ],
        total: 1,
        semantic_available: false,
      }),
    );

    const r = await c.search("research", "found", { limit: 10 });
    expect(r.results).toHaveLength(1);
    expect(r.results[0].score).toBe(0.85);
    expect(r.semanticAvailable).toBe(false);
  });

  // ── Identity ───────────────────────────────────────────────

  it("identity maps field names", async () => {
    mockFetch.mockResolvedValueOnce(
      ok({
        ed25519_public_key: "cordelia_pk1abc",
        x25519_public_key: "cordelia_xpk1def",
        node_id: "cordelia_pk1abc",
        channels_subscribed: 5,
      }),
    );

    const r = await c.identity();
    expect(r.publicKey).toBe("cordelia_pk1abc");
    expect(r.encryptionKey).toBe("cordelia_xpk1def");
    expect(r.channelsSubscribed).toBe(5);
  });

  // ── Error Handling ─────────────────────────────────────────

  it("throws CordeliaError on 401", async () => {
    mockFetch.mockResolvedValueOnce(err(401, "unauthorized", "Invalid token"));

    await expect(c.subscribe("test")).rejects.toThrow(CordeliaError);
    await expect(c.subscribe("test")).rejects.toThrow(); // fetch already consumed
    // Reset and test properly
    mockFetch.mockResolvedValueOnce(err(401, "unauthorized", "Invalid token"));
    try {
      await c.subscribe("test");
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(CordeliaError);
      const ce = e as CordeliaError;
      expect(ce.code).toBe("unauthorized");
      expect(ce.statusCode).toBe(401);
    }
  });

  it("throws CordeliaError on 404", async () => {
    mockFetch.mockResolvedValueOnce(
      err(404, "not_found", "Channel not found"),
    );

    try {
      await c.listen("nonexistent");
      expect.fail("should have thrown");
    } catch (e) {
      const ce = e as CordeliaError;
      expect(ce.code).toBe("not_found");
      expect(ce.statusCode).toBe(404);
    }
  });

  it("throws network_error on fetch failure", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Connection refused"));

    try {
      await c.identity();
      expect.fail("should have thrown");
    } catch (e) {
      const ce = e as CordeliaError;
      expect(ce.code).toBe("network_error");
      expect(ce.message).toContain("Connection refused");
    }
  });

  // ── Constructor ────────────────────────────────────────────

  it("strips trailing slash from nodeUrl", async () => {
    const c2 = new Cordelia({
      token: "t",
      nodeUrl: "http://example.com:9473/",
    });

    mockFetch.mockResolvedValueOnce(
      ok({
        ed25519_public_key: "pk",
        x25519_public_key: "xpk",
        node_id: "pk",
        channels_subscribed: 0,
      }),
    );

    await c2.identity();

    expect(mockFetch.mock.calls[0][0]).toBe(
      "http://example.com:9473/api/v1/channels/identity",
    );
  });
});
