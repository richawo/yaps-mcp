# Yaps MCP server

Give Claude Desktop, Claude Code, Cursor, Codex, and other MCP clients controlled access to your private local Yaps Markdown vault.

[Download Yaps](https://yaps.ai/download) · [Yaps website](https://yaps.ai)

<!-- mcp-name: io.github.richawo/yaps -->

## Why Yaps MCP

- **Local memory, useful everywhere:** search, read, organise, and connect ordinary Markdown notes from an AI client.
- **Read-only by default:** connecting a supported client grants reads only. Writes require a separate, explicit switch inside Yaps.
- **Safer writes:** stale timestamps reject overwrites; confirmed deletes and traversal guards protect the vault; Vault Versioning can checkpoint write batches before they land.
- **Broad client reach:** Yaps already configures Codex, Claude Desktop, and Cursor without replacing unrelated servers. The MCP Bundle adds one-click installation and official-registry discovery for clients that implement MCPB.
- **A direct product path:** the bundle uses the server already shipped and updated with Yaps, so users get the desktop app, local vault, system-wide dictation, account, and subscription experience—not a disconnected fork.

The bundle is intentionally small. It locates the signed `yaps_mcp` binary inside the installed Yaps desktop app and forwards stdio directly, without a shell or network proxy.

## Install

### Fastest: from Yaps

1. [Download and open Yaps](https://yaps.ai/download).
2. In Yaps, open **Settings → General → Local AI integrations**.
3. Choose **Connect Codex**, **Connect Claude Desktop**, or **Connect Cursor**.
4. Restart that client.

Yaps preserves every other configured MCP server and grants the selected client read-only access.

### MCP Bundle

Download the `.mcpb` asset from a release and open it in an MCPB-compatible desktop client. Install Yaps first, then use **Local AI integrations** inside Yaps to connect/authorise the client. This explicit Yaps step is required because the server fails closed and a bundle is not allowed to grant itself access to a private vault.

### Manual configuration

Use the production binary shipped with the app and give each custom host a distinct client identity:

```json
{
  "mcpServers": {
    "yaps": {
      "command": "/Applications/Yaps.app/Contents/MacOS/yaps_mcp",
      "env": {
        "YAPS_MCP_CLIENT_ID": "my-local-client"
      }
    }
  }
}
```

Custom identities must also be authorised in the Yaps Agent Access policy. Prefer the one-click connectors unless you specifically need a custom host.

## Capabilities

The native server exposes 28 tools covering:

- vault status, filtered note lists, reads, create/update/delete, move, rename, pinning, and daily notes;
- exact, semantic, and hybrid local search;
- templates, snapshot history, and restore;
- folders, tags, mentions, wikilink terms, backlinks, and unlinked mentions;
- local Yaps status, activity history, and usage statistics.

Every tool returns structured MCP content and declares read-only/destructive/open-world annotations. `openWorldHint` is false for every tool.

## Permissions model

Agent Access fails closed:

1. A supported one-click connection enables **read-only** access for that client identity.
2. Yaps rejects any client identity not on the local allowlist.
3. Writes stay off until enabled inside Yaps.
4. Updates can include `expected_updated_at` from the most recent read; a mismatch rejects the write.
5. Delete requires `confirm=true` and title confirmation support.
6. When enabled, Vault Versioning checkpoints an agent write batch before applying it.

For the complete public inventory and common safety arguments, see [TOOL_REFERENCE.md](TOOL_REFERENCE.md).

## Development

```bash
bun install --frozen-lockfile
bun run package
```

`bun run package` tests the cross-platform launcher, validates the MCPB manifest with the official toolchain, creates the `.mcpb`, inspects it, calculates its SHA-256 digest, and generates a matching official-registry `server.json` under `dist/<version>/`.

The native Rust server lives in the main Yaps repository and has separate protocol, permission, and full-vault smoke suites. See [PUBLISHING.md](PUBLISHING.md) for the release gate.

## Support and security

Use [Yaps support](https://www.yaps.ai/support) for product help. Please follow [SECURITY.md](SECURITY.md) for vulnerability reports and never attach private vault contents or raw dictation audio to a public issue.

## License

MIT
