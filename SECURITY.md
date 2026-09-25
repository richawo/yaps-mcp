# Security policy

Report suspected vulnerabilities privately through the security contact published at [yaps.ai](https://yaps.ai). Do not include vault contents, account credentials, settings files, raw dictation audio, or agent activity logs in a public issue.

The MCP Bundle is a local stdio connector. It resolves only explicit or conventional Yaps installation paths, spawns first-party Yaps binaries without a shell, and writes diagnostics only to stderr. Memory calls are proxied through the native server, so the bundle does not weaken or bypass the Yaps Agent Access policy.

The native Memory server denies disabled, non-allowlisted, and write-disabled clients; normalises vault paths; rejects traversal; requires confirmation for destructive operations; and supports stale-write rejection. The standalone bundle deliberately does not set Yaps' first-party auto-authorize flag, because Claude Desktop remains subject to the user's Agent Access choice. Before forwarding native or CLI processing tools, the wrapper refreshes and verifies the sanitized desktop account state. File-producing CLI tools validate source files, use fixed command shapes, and refuse to replace existing outputs. Temporary meeting audio is removed after the call. These controls are covered by unit, protocol, and packaged-bundle smoke tests.
