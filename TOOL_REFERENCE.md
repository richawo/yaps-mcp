# Yaps connector tool reference

Yaps exposes 16 focused local tools. Every tool has a human-readable title and declares either `readOnlyHint: true` or `destructiveHint: true`; `openWorldHint` is always false.

## Read-only tools

- `vault_status` — check the local Memory vault and note count.
- `vault_notes_list` — list notes with optional filters.
- `vault_note_get` — read one note by vault-relative path.
- `vault_search` — lexical note search.
- `vault_search_semantic` — semantic or hybrid local note search.
- `yaps_connector_status` — check app, CLI, Memory, sign-in, and account readiness without returning email or billing identifiers.
- `yaps_features_list` — inspect local feature and model readiness without installing anything.
- `yaps_translate_text` — translate supplied text with an installed local Yaps model.

## User-visible write tools

Claude prompts before these tools run.

- `vault_note_create` — create a Memory note when Agent Access writes are enabled.
- `vault_note_update` — update a Memory note with stale-write protection.
- `vault_note_delete` — delete a confirmed Memory note when writes are enabled.
- `yaps_transcribe_media` — create a new plain-text transcript from local audio or video.
- `yaps_generate_subtitles` — create a new SRT subtitle file.
- `yaps_transcribe_meeting` — create a speaker-labelled meeting project in Yaps.
- `yaps_translate_file` — translate a local Markdown, text, or SRT file into a new file.
- `yaps_extract_audio` — create an MP3, WAV, or M4A copy of a local video through deterministic conversion.

## Safety behavior

- The connector never replaces an existing output file.
- Memory paths are relative to the active vault; parent traversal is rejected by the native server.
- Pass `expected_updated_at` from the latest `vault_note_get` when updating a note to reject stale overwrites.
- `vault_note_delete` requires `confirm: true`.
- Memory reads and writes remain subject to the local Yaps Agent Access policy.
- The connector excludes AI image, video, and audio generation tools.
- Video meeting audio is extracted into a temporary directory and removed after transcription.
