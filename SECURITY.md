# Security policy

Report suspected vulnerabilities privately through the security contact published at [yaps.ai](https://yaps.ai). Do not include vault contents, account credentials, settings files, raw dictation audio, or agent activity logs in a public issue.

The MCP Bundle is a local stdio launcher. It resolves only explicit or conventional Yaps installation paths, spawns the native server without a shell, inherits stdio directly, and writes diagnostics only to stderr. It does not weaken or modify the native Agent Access policy.

The native server denies disabled, non-allowlisted, and write-disabled clients; normalises vault paths; rejects traversal; requires confirmation for destructive operations; supports stale-write rejection; and reports MCP safety annotations. These controls are covered by protocol-level smoke tests against temporary settings and vault roots.
