# Publishing Yaps MCP

Keep this project at the root of the public `richawo/yaps-mcp` repository. The bundle points to that repository for source, documentation, support context, release artifacts, and official MCP Registry ownership.

## Release checklist

1. Update `version` in `package.json` and `bundle/manifest.json`.
2. Confirm the native `yaps_mcp` tool inventory still matches the 28 tools declared in the bundle manifest.
3. Run `bun install --frozen-lockfile` and `bun run package`.
4. Run the native protocol/security/vault smoke commands listed below against the current production Yaps binary.
5. Install `dist/<version>/yaps-mcp-<version>.mcpb` in a clean MCPB-compatible desktop client on macOS and Windows.
6. Test the missing-Yaps diagnostic, installed-but-unauthorised denial, read-only success, write denial, and explicitly enabled write success.
7. Create GitHub release tag `v<version>` and attach the `.mcpb` plus `checksums-sha256.txt`.
8. Confirm the public release URL in generated `server.json` downloads that exact artifact and its SHA-256 matches `fileSha256`.
9. Authenticate `mcp-publisher` with the `richawo` GitHub account, validate `server.json`, and publish it.
10. Query the official registry for `io.github.richawo/yaps` and inspect the resulting installation metadata before announcing the release.

## Native smoke commands

```bash
src-tauri/tests/mcp_vault_smoke.sh --no-build --binary /Applications/Yaps.app/Contents/MacOS/yaps_mcp
YAPS_MCP_BINARY=/Applications/Yaps.app/Contents/MacOS/yaps_mcp \
  python3 src-tauri/tests/mcp_security_smoke.py
src-tauri/tests/mcp_phase1_smoke.sh --no-build --binary /Applications/Yaps.app/Contents/MacOS/yaps_mcp
```

All smoke fixtures use temporary settings and vault roots. Never run mutating protocol probes without both overrides.

## Registry commands

Use the current official publisher build and review its output before publication:

```bash
mcp-publisher login github
mcp-publisher validate dist/<version>/server.json
mcp-publisher publish dist/<version>/server.json
curl 'https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.richawo/yaps'
```

Registry publication and GitHub release creation are external public actions. They must be performed only after final product approval and after the release artifact exists at the URL embedded in `server.json`.
