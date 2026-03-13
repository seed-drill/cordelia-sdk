/** Options for constructing a Cordelia client. */
export interface CordeliaOptions {
  /** Node URL. Default: http://localhost:9473 */
  nodeUrl?: string;
  /** Bearer token. Default: read from ~/.cordelia/node-token */
  token?: string;
  /** Realtime poll interval in ms. Default: 2000 */
  realtimePollMs?: number;
  /** Batch poll interval in ms. Default: 30000 */
  batchPollMs?: number;
}

// ── Channels ─────────────────────────────────────────────────────

export interface SubscribeOptions {
  /** Channel delivery mode. Default: "realtime" */
  mode?: "realtime" | "batch";
  /** Channel access policy. Default: "open" */
  access?: "open" | "invite_only";
}

export interface ChannelHandle {
  channel: string;
  channelId: string;
  isNew: boolean;
  role: string;
  mode: string;
  access: string;
  createdAt: string;
  joinedAt?: string;
}

export interface ChannelInfo {
  channel: string;
  channelId: string;
  exists: boolean;
  mode?: string;
  access?: string;
  owner?: string;
  memberCount?: number;
  createdAt?: string;
}

export interface ChannelDetails {
  channel: string;
  channelId: string;
  role: string;
  mode: string;
  access: string;
  itemCount: number;
  lastActivity?: string;
  createdAt: string;
}

// ── Pub/Sub ──────────────────────────────────────────────────────

export interface PublishOptions {
  /** Optional metadata object. */
  metadata?: Record<string, unknown>;
  /** Item type hint. Default: "message" */
  itemType?: string;
  /** Parent item ID for threading. */
  parentId?: string;
}

export interface PublishResult {
  itemId: string;
  channel: string;
  publishedAt: string;
  author: string;
  itemType: string;
}

export interface ListenOptions {
  /** Cursor: return items after this ISO timestamp. */
  since?: string;
  /** Max items to return (1-500). Default: 50 */
  limit?: number;
}

export interface ListenResult {
  channel: string;
  items: Item[];
  cursor: string;
  hasMore: boolean;
}

export interface Item {
  itemId: string;
  content: unknown;
  metadata?: Record<string, unknown>;
  itemType: string;
  parentId?: string;
  author: string;
  publishedAt: string;
  signatureValid: boolean;
}

// ── DMs ──────────────────────────────────────────────────────────

export interface DMHandle {
  channelId: string;
  isNew: boolean;
  peerPublicKey: string;
  createdAt: string;
}

export interface DMInfo {
  channelId: string;
  peerPublicKey: string;
  itemCount: number;
  lastActivity?: string;
  createdAt: string;
}

// ── Groups ───────────────────────────────────────────────────────

export interface GroupHandle {
  channelId: string;
  mode: string;
  createdAt: string;
}

export interface GroupOptions {
  /** Channel delivery mode. Default: "realtime" */
  mode?: "realtime" | "batch";
}

export interface GroupInfo {
  channelId: string;
  role: string;
  mode: string;
  memberCount: number;
  itemCount: number;
  lastActivity?: string;
  createdAt: string;
}

export interface InviteResult {
  ok: boolean;
  channelId: string;
  peerPublicKey: string;
  memberCount: number;
}

export interface RemoveResult {
  ok: boolean;
  channelId: string;
  peerPublicKey: string;
  keyRotated: boolean;
  newKeyVersion: number;
}

// ── PSK Rotation ─────────────────────────────────────────────────

export interface RotateResult {
  ok: boolean;
  channel: string;
  newKeyVersion: number;
}

// ── Delete ───────────────────────────────────────────────────────

export interface DeleteResult {
  ok: boolean;
  itemId: string;
}

// ── Search ───────────────────────────────────────────────────────

export interface SearchOptions {
  /** Max results (1-100). Default: 20 */
  limit?: number;
  /** Filter by item types. */
  types?: string[];
  /** Only items after this date. */
  since?: string;
}

export interface SearchResult {
  channel: string;
  results: SearchHit[];
  total: number;
  semanticAvailable: boolean;
}

export interface SearchHit extends Item {
  score: number;
}

// ── Identity ─────────────────────────────────────────────────────

export interface Identity {
  publicKey: string;
  encryptionKey: string;
  nodeId: string;
  channelsSubscribed: number;
}
