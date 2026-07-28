# Yaps connector

Use local Yaps Memory, transcription, meeting transcripts, subtitles, translation, and media conversion from Claude Desktop and other MCPB-compatible clients.

[Download Yaps](https://yaps.ai/download) · [Yaps website](https://yaps.ai)

<!-- mcp-name: io.github.richawo/yaps -->

## What it does

- **Memory:** search, read, create, update, and safely delete private Markdown notes through Yaps Agent Access.
- **Transcription:** turn local audio or video into a new plain-text transcript.
- **Meetings:** create speaker-labelled meeting transcripts from audio or video.
- **Subtitles:** generate a new timestamped SRT file.
- **Translation:** translate text, Markdown, plain text, or SRT files with a local Yaps model.
- **Video to audio:** make an MP3, WAV, or M4A copy through deterministic local conversion.

The connector deliberately excludes Yaps workflows that Anthropic does not accept in the Connectors Directory: AI text-to-speech, audio cleanup, image background removal, and rendered video captions remain available through the Yaps plugins.

## Install

1. [Download and open Yaps](https://yaps.ai/download).
2. Sign in and activate an available free trial or Yaps Pro.
3. Open this `.mcpb` file in Claude Desktop, or install it from **Settings → Extensions → Advanced settings**.
4. For Memory, open **Yaps → Settings → Agent Access** and allow Claude Desktop. Reads can be enabled separately from writes.

The connector finds the signed `yaps_cli` and `yaps_mcp` binaries included with Yaps. Users do not need Rust, Python, an API key, a PATH shim, or manual JSON configuration.

## Safety

- Every operation stays on the user's computer.
- Memory uses the native Yaps Agent Access allowlist and write controls.
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

MIT
