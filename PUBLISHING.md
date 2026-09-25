# Publishing Yaps MCP

Keep this project at the root of the public `richawo/yaps-mcp` repository. The bundle points to that repository for source, documentation, support context, release artifacts, and official MCP Registry ownership.

## Release checklist

1. Update `version` in `package.json` and `bundle/manifest.json`.
2. Confirm the aggregate server still exposes the 16 tools declared in the bundle manifest: eight curated native Memory tools and eight local CLI tools.
3. Run `bun install --frozen-lockfile` and `bun run package`.
4. Run the native protocol/security/vault smoke commands listed below against the current production Yaps binary.
5. Exercise every one of the 16 aggregate tools through MCP Inspector. Use temporary source files and a temporary vault for all write tools.
6. Install `dist/<version>/yaps-mcp-<version>.mcpb` in a clean Claude Desktop profile on macOS and Windows.
7. Test the missing-Yaps diagnostic, inactive-account guidance, installed-but-unauthorised Memory denial, read-only Memory success, write denial, explicitly enabled Memory write success, and no-overwrite behavior for every file-producing tool.
8. Confirm every tool succeeds in Claude Desktop with valid inputs and returns an actionable error for invalid inputs.
9. Create GitHub release tag `v<version>` and attach the `.mcpb` plus `checksums-sha256.txt`.
10. Confirm the public release URL in generated `server.json` downloads that exact artifact and its SHA-256 matches `fileSha256`.
11. Authenticate `mcp-publisher` with the `richawo` GitHub account, validate `server.json`, and publish it.
12. Query the official registry for `io.github.richawo/yaps`, inspect the installation metadata, then submit the MCPB to Anthropic's Desktop Extension form.

## Native smoke commands

```bash
src-tauri/tests/mcp_vault_smoke.sh --no-build --binary /Applications/Yaps.app/Contents/MacOS/yaps_mcp
YAPS_MCP_BINARY=/Applications/Yaps.app/Contents/MacOS/yaps_mcp \
  python3 src-tauri/tests/mcp_security_smoke.py
```

Both commands isolate settings, Agent Access policy, and the vault. They remove
inherited first-party auto-authorization so a plugin environment cannot redirect
the probe to the installed app's settings. Never run mutating protocol probes
without these overrides.

The security command tests permissions and mutations against the production
binary. Synthetic entitlement transitions use a debug-only settings override
that production builds intentionally ignore. Run that separate development gate
only against a freshly built debug binary:

```bash
YAPS_MCP_BINARY=target/debug/yaps_mcp \
  python3 src-tauri/tests/mcp_security_smoke.py --debug-entitlement
```

The retired `mcp_phase1_smoke.sh` exits without testing anything and is not a
release gate. Native protocol checks do not replace the packaged connector's
16-tool checks or clean Claude Desktop testing on macOS and Windows.

## Registry commands

Use the current official publisher build and review its output before publication:

```bash
mcp-publisher login github
mcp-publisher validate dist/<version>/server.json
mcp-publisher publish dist/<version>/server.json
curl 'https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.richawo/yaps'
```

Registry publication and GitHub release creation are external public actions. They must be performed only after final product approval and after the release artifact exists at the URL embedded in `server.json`.
