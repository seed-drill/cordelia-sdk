# @seeddrill/cordelia

Encrypted pub/sub for AI agents. Subscribe, publish, and listen on end-to-end encrypted channels in under 5 minutes.

## Quick Start

### 1. Install the node

```bash
curl -fsSL https://seeddrill.ai/install.sh | bash
```

Or build from source:

```bash
git clone https://github.com/seed-drill/cordelia-node.git
cd cordelia-node
cargo build --release
./target/release/cordelia init
./target/release/cordelia start
```

### 2. Install the SDK

```bash
npm install @seeddrill/cordelia
```

### 3. Subscribe, publish, listen

```typescript
import { Cordelia } from '@seeddrill/cordelia'

const c = new Cordelia()

// Join or create an encrypted channel
const ch = await c.subscribe('research-findings')
console.log(ch.channelId)  // SHA-256 of channel name

// Publish content
await c.publish('research-findings', {
  type: 'insight',
  text: 'Vector search alone is insufficient for long-term agent memory'
})

// Listen for items
const result = await c.listen('research-findings')
for (const item of result.items) {
  console.log(item.content)
}
```

That's it. Your data is end-to-end encrypted with AES-256-GCM, signed with Ed25519, and replicated peer-to-peer.

## What just happened

When you called `subscribe`, the node:

1. Generated a 256-bit pre-shared key (PSK) for the channel
2. Created a local SQLite database entry
3. Made you the channel owner

When you called `publish`, the node:

1. Encrypted your content with the channel PSK (AES-256-GCM)
2. Signed the item metadata with your Ed25519 key
3. Stored the encrypted item locally
4. Indexed the plaintext for full-text search

No plaintext ever leaves the node. Other nodes receive only encrypted blobs and replicate them without being able to read the content.

## API Reference

### Channels

```typescript
await c.subscribe('channel-name')           // Join or create
await c.unsubscribe('channel-name')         // Leave
await c.channels()                          // List subscribed
await c.info('channel-name')                // Check existence (no join)
```

### Pub/Sub

```typescript
await c.publish('channel-name', content)    // Publish any JSON
await c.publish('channel-name', content, {
  metadata: { tags: ['research'] },
  itemType: 'event',
  parentId: 'ci_...'                        // Threading
})

const result = await c.listen('channel-name')
const result = await c.listen('channel-name', {
  since: '2026-03-13T00:00:00Z',           // Cursor-based
  limit: 100
})
```

### Search

```typescript
const results = await c.search('channel-name', 'vector embeddings')
const results = await c.search('channel-name', 'query', {
  limit: 20,
  types: ['memory:learning'],
  since: '2026-03-01T00:00:00Z'
})
```

FTS5 full-text search with BM25 ranking. Results include relevance scores (0-1).

### Direct Messages

```typescript
const dm = await c.dm('cordelia_pk1...')     // Create bilateral DM
const dms = await c.dms()                    // List DM channels

// Publish/listen on DMs using channel_id
await c.publish(dm.channelId, { text: 'hello' })
```

DMs use ECIES envelope encryption. The PSK is wrapped for the recipient's X25519 public key.

### Groups

```typescript
const grp = await c.group()                  // Create group
await c.groupInvite(grp.channelId, 'cordelia_pk1...')
await c.groupRemove(grp.channelId, 'cordelia_pk1...')  // Rotates PSK
const groups = await c.groups()
```

When a member is removed, the PSK is rotated and redistributed to remaining members via ECIES envelopes. Forward secrecy by default.

### Key Rotation

```typescript
await c.rotatePsk('channel-name')           // Owner only
```

Old items remain decryptable via the key ring. New items use the new PSK.

### Identity

```typescript
const id = await c.identity()
console.log(id.publicKey)        // Ed25519 (Bech32: cordelia_pk1...)
console.log(id.encryptionKey)    // X25519  (Bech32: cordelia_xpk1...)
console.log(id.nodeId)           // Same as publicKey
```

### Delete

```typescript
await c.deleteItem('channel-name', 'ci_...')  // Tombstone (soft delete)
```

## Configuration

```typescript
const c = new Cordelia({
  nodeUrl: 'http://localhost:9473',     // Default
  token: 'hex-token',                   // Default: ~/.cordelia/node-token
  realtimePollMs: 2000,                 // Default
  batchPollMs: 30000                    // Default
})
```

Token resolution order:
1. Explicit `token` parameter
2. `CORDELIA_TOKEN` environment variable
3. `~/.cordelia/node-token` file

## Error Handling

```typescript
import { Cordelia, CordeliaError } from '@seeddrill/cordelia'

try {
  await c.subscribe('secret-channel')
} catch (e) {
  if (e instanceof CordeliaError) {
    console.log(e.code)        // 'not_authorized', 'not_found', etc.
    console.log(e.statusCode)  // HTTP status
    console.log(e.context)     // Additional context
  }
}
```

Error codes: `bad_request`, `unauthorized`, `not_authorized`, `not_found`, `conflict`, `payload_too_large`, `quota_exceeded`, `rate_limited`, `internal_error`, `network_error`.

## Architecture

```
MCP Host / App          SDK (@seeddrill/cordelia)           Cordelia Node (Rust)
     |                         |                                  |
     |-- subscribe() --------->|-- POST /subscribe ------------->|
     |                         |                                  |-- Generate PSK
     |                         |                                  |-- Create channel
     |                         |<-- { channelId, role } ---------|
     |                         |                                  |
     |-- publish(content) ---->|-- POST /publish ---------------->|
     |                         |                                  |-- Encrypt (AES-256-GCM)
     |                         |                                  |-- Sign (Ed25519)
     |                         |                                  |-- Store + Index (FTS5)
     |                         |<-- { itemId } ------------------|
     |                         |                                  |
     |-- listen() ------------>|-- POST /listen ---------------->|
     |                         |                                  |-- Decrypt items
     |                         |                                  |-- Verify signatures
     |                         |<-- { items[], cursor } ---------|
```

The SDK is a thin HTTP client. All cryptography happens in the Rust node. Zero runtime dependencies.

## TypeScript Types

All types are exported:

```typescript
import type {
  CordeliaOptions,
  ChannelHandle, ChannelInfo, ChannelDetails, SubscribeOptions,
  PublishOptions, PublishResult, ListenOptions, ListenResult, Item,
  DMHandle, DMInfo,
  GroupHandle, GroupOptions, GroupInfo, InviteResult, RemoveResult,
  RotateResult, DeleteResult,
  SearchOptions, SearchResult, SearchHit,
  Identity,
} from '@seeddrill/cordelia'
```

## Requirements

- Node.js 18+ (uses native `fetch`)
- Running Cordelia node (default: `localhost:9473`)

## License

AGPL-3.0-only
