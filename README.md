# Yaps connector

Turn recordings into transcripts and subtitles. Translate text and files, extract
audio from video, and use optional private Markdown memory from Claude Desktop
and other MCPB-compatible clients.

[Download Yaps](https://yaps.ai/download) · [Yaps website](https://yaps.ai)

<!-- mcp-name: io.github.richawo/yaps -->

**Release status:** this source prepares connector 2.0.3. The latest published
MCPB and Registry entry are still 2.0.1. Version 2.0.3 needs the remaining Claude
Desktop and Windows checks before release; see [PUBLISHING.md](PUBLISHING.md).

## What it does

- **Transcription:** turn local audio or video into a new plain-text transcript.
- **Meetings:** create speaker-labelled meeting transcripts from audio or video.
- **Subtitles:** generate a new timestamped SRT file.
- **Translation:** translate text, Markdown, plain text, or SRT files with a local Yaps model.
- **Video to audio:** make an MP3, WAV, or M4A copy through deterministic local conversion.
- **Memory:** search, read, create, update, and safely delete private Markdown notes through Yaps Agent Access.

Try: "Transcribe this product demo and save a separate text file."

This connector contains 16 tools for the workflows above. Yaps also offers
speech, audio cleanup, image tools, rendered captions, and Auto Cut through its
[plugin marketplace](https://github.com/richawo/yaps-plugins). Directory review
and approval are separate from package availability.

## Install

1. [Download and open Yaps](https://yaps.ai/download).
2. Sign in to Yaps. New users need a Yaps account; gated features require an active free trial or Yaps Pro. The connector is free.
3. Download [the published connector 2.0.1](https://github.com/richawo/yaps-mcp/releases/download/v2.0.1/yaps-mcp-2.0.1.mcpb). Open the `.mcpb` in Claude Desktop, or install it from **Settings → Extensions → Advanced settings**. The prepared 2.0.3 source is not yet released.
4. For Memory, open **Yaps → Settings → Agent Access** and allow Claude Desktop. Reads can be enabled separately from writes.

The connector uses the same discovery contract as the Yaps plugins: explicit override, `PATH`, then verified installed-app locations. It validates `yaps_cli` with a bounded, read-only `status` call and diagnoses a missing private-vault connector separately from a missing or invalid CLI. Yaps 2.3.124 or newer is required for the safe automatic account handoff; the connector then reuses the desktop sign-in and recognises either an active free trial or Yaps Pro. Users do not need Rust, Python, an API key, a PATH shim, manual JSON configuration, or a separate connector login.

Memory's existing **Agent Access** permission remains an intentional desktop security control. Claude Desktop must be enabled there once before it can read private notes; the connector does not impersonate another trusted client or bypass that setting.

Approve any required model download before it starts. Requested results can
enter Claude's context. A remote session cannot reach Yaps on another computer
through this local connector.

## Safety

- Every operation stays on the user's computer.
- Memory uses the native Yaps Agent Access allowlist and write controls.
- Every tool refreshes and checks the sanitized desktop account state before processing; signed-out, expired, and mobile-only access fails with specific recovery guidance.
- Note updates can reject stale overwrites; note deletion requires confirmation.
- File-producing tools refuse to replace an existing file.
- Read-only and write tools are separate, titled, and annotated for Claude's permission UI.
- The launcher invokes only fixed Yaps commands without a shell.

## Capabilities

The connector exposes 16 focused tools:

- five read-only Memory tools;
- three explicitly permissioned Memory write tools;
- connector and feature readiness checks;
- plain transcription, speaker-labelled meeting transcription, SRT generation, text translation, file translation, and deterministic video-to-audio conversion.

See [TOOL_REFERENCE.md](TOOL_REFERENCE.md) for the complete inventory.

## Development

```bash
bun install --frozen-lockfile
bun run package
```

`bun run package` runs the unit suite, validates the MCPB manifest with Anthropic's official toolchain, installs production-only runtime dependencies inside the bundle, creates the `.mcpb`, inspects it, calculates its SHA-256 digest, and generates matching MCP Registry metadata under `dist/<version>/`.

The connector proxies the native Memory tools from `yaps_mcp` and uses the first-party `yaps_cli` for the other local workflows. See [PUBLISHING.md](PUBLISHING.md) for the release and directory-review gates.

## Privacy Policy

Yaps' public privacy policy is at [yaps.ai/privacy](https://www.yaps.ai/privacy).

- **Data collection:** the connector does not collect prompts, conversation history, note contents, source media, or generated files. It reads only the local paths or Yaps notes needed for the tool call the user requested.
- **Usage and storage:** notes, source files, models, transcripts, subtitles, translations, and converted audio stay on the user's computer. The connector has no hosted proxy or analytics client.
- **Third-party sharing:** the connector does not send tool inputs or outputs to Yaps or another third party. Claude receives the tool result required to complete the user's request.
- **Retention:** Yaps Memory notes and generated output files remain until the user deletes them. Temporary audio created while transcribing a video meeting is deleted immediately after that tool call.
- **Contact:** privacy and product questions can be sent to [support@yaps.ai](mailto:support@yaps.ai).

## Support and security

Use [Yaps support](https://www.yaps.ai/support) for product help. Follow [SECURITY.md](SECURITY.md) for vulnerability reports, and never attach private notes, media, transcripts, credentials, or raw Agent Access logs to a public issue.

## License

The connector source is [MIT licensed](LICENSE). The same notice is included
inside the MCPB bundle. The Yaps desktop app is a separate product with its own
account and plan requirements.
