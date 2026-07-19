# Yaps MCP tool reference

Yaps exposes 28 local stdio tools. Every tool returns MCP `content` plus machine-readable `structuredContent`, declares `openWorldHint: false`, and remains subject to the local Yaps Agent Access policy.

## Read-only tools

- `yaps_status` — server status and resolved local settings location.
- `vault_status` — active vault root and note count.
- `vault_notes_list` — notes filtered by folder, tag, kind, source, pinned state, or title.
- `vault_note_get` — one note by vault-relative path.
- `vault_search` — lexical note search with optional filters.
- `vault_search_semantic` — lexical, semantic, or hybrid local search; falls back to lexical when the optional local embedding component is unavailable.
- `vault_note_history_list` — local snapshots for one note.
- `vault_folders_list` — folders derived from note paths.
- `vault_tags_list` — tags and note counts.
- `vault_mentions_list` — text mentions and explicit wikilinks for a term.
- `vault_mention_terms_list` — distinct explicit wikilink targets.
- `vault_backlinks` — backlinks and unlinked mentions for a note.
- `history_list` — recent local dictation, reading, and action history.
- `usage_get_local` — local Yaps usage statistics.

## Write tools

These fail unless the user separately enables writes in Yaps:

- `vault_note_create`
- `vault_note_update`
- `vault_note_delete`
- `vault_note_move`
- `vault_note_rename`
- `vault_open_daily_note`
- `vault_create_from_template`
- `vault_note_history_restore`
- `vault_note_toggle_pin`
- `vault_note_tags_add`
- `vault_note_tags_remove`
- `vault_note_tags_replace`
- `vault_tag_rename`
- `vault_tag_delete`

## Common safety arguments

- Paths are relative to the active vault. Parent traversal is rejected.
- Pass `expected_updated_at` from the latest `vault_note_get` when updating a note; a mismatch rejects a stale overwrite.
- `vault_note_delete` requires `confirm: true` and supports an expected title check.
- `vault_note_rename` can update inbound wikilinks when requested.
- Write batches can be checkpointed automatically when Vault Versioning is enabled.

## Search result behavior

`vault_search_semantic` accepts `mode: "lexical"`, `"semantic"`, or `"hybrid"`. Its structured result reports the effective mode, whether it fell back, and scored hits containing a note ID, path, title, snippet, and available lexical/semantic/fused scores.

All search and mutation operations act on the user's local Markdown vault. The MCP Bundle itself adds no hosted proxy, analytics client, or API-key flow.
