import { describe, expect, test } from "bun:test";
import {
  candidatePaths,
  cliCandidatePaths,
  resolveYapsCliBinary,
  resolveYapsMcpBinary,
  resolveYapsSessionResult,
} from "../bundle/server/resolve-yaps";

describe("Yaps MCP app discovery", () => {
  test("prefers an explicit override without executing through a shell", () => {
    const paths = candidatePaths({
      platform: "darwin",
      home: "/Users/example",
      env: {
        HOME: "/Users/example",
        PATH: "/usr/bin:/bin",
        YAPS_MCP_BINARY: "/Volumes/Yaps Test/yaps_mcp",
      },
    });

    expect(paths[0]).toBe("/Volumes/Yaps Test/yaps_mcp");
    expect(paths).toContain("/Applications/Yaps.app/Contents/MacOS/yaps_mcp");
  });

  test("finds only the verified per-machine Windows installation", () => {
    const paths = candidatePaths({
      platform: "win32",
      home: "C:\\Users\\example",
      env: {
        ProgramFiles: "C:\\Program Files",
        LOCALAPPDATA: "C:\\Users\\example\\AppData\\Local",
      },
    });

    expect(paths).toContain("C:\\Program Files\\Yaps\\yaps_mcp.exe");
    expect(paths.some((path) => path.includes("AppData"))).toBe(false);
  });

  test("returns the first accessible candidate and otherwise fails closed", () => {
    const expected = "/Applications/Yaps.app/Contents/MacOS/yaps_mcp";
    expect(
      resolveYapsMcpBinary({
        platform: "darwin",
        home: "/Users/example",
        env: { HOME: "/Users/example" },
        canAccess: (path) => path === expected,
      }),
    ).toBe(expected);
    expect(
      resolveYapsMcpBinary({
        platform: "darwin",
        home: "/Users/example",
        env: { HOME: "/Users/example" },
        canAccess: () => false,
      }),
    ).toBeUndefined();
  });

  test("treats an explicit but inaccessible override as authoritative", () => {
    expect(
      resolveYapsMcpBinary({
        platform: "darwin",
        home: "/Users/example",
        env: {
          HOME: "/Users/example",
          YAPS_MCP_BINARY: "/missing/custom/yaps_mcp",
        },
        canAccess: (path) => path === "/Applications/Yaps.app/Contents/MacOS/yaps_mcp",
      }),
    ).toBeUndefined();
  });

  test("deduplicates overlapping PATH candidates", () => {
    const paths = candidatePaths({
      platform: "darwin",
      home: "/Users/example",
      env: {
        HOME: "/Users/example",
        PATH: "/Users/example/.local/bin:/Users/example/.local/bin",
      },
    });
    expect(paths.filter((path) => path.endsWith(".local/bin/yaps_mcp"))).toHaveLength(1);
  });

  test("discovers the packaged CLI independently from the native MCP server", () => {
    const paths = cliCandidatePaths({
      platform: "darwin",
      home: "/Users/example",
      env: {
        HOME: "/Users/example",
        PATH: "/usr/local/bin",
        YAPS_CLI_BINARY: "/Volumes/Yaps Test/yaps_cli",
      },
    });

    expect(paths[0]).toBe("/Volumes/Yaps Test/yaps_cli");
    expect(paths).toContain("/Applications/Yaps.app/Contents/MacOS/yaps_cli");
    expect(paths).toContain("/usr/local/bin/yaps_cli");
  });

  test("resolves and validates the Windows CLI without confusing it with yaps_mcp", async () => {
    const expected = "C:\\Program Files\\Yaps\\yaps_cli.exe";
    expect(
      await resolveYapsCliBinary({
        platform: "win32",
        home: "C:\\Users\\example",
        env: { ProgramFiles: "C:\\Program Files" },
        canAccess: (path) => path === expected,
        probe: async () => ({ ok: true }),
      }),
    ).toBe(expected);
  });

  test("rejects an invalid CLI override instead of falling through", async () => {
    expect(
      await resolveYapsCliBinary({
        platform: "darwin",
        env: { HOME: "/Users/example", PATH: "/healthy", YAPS_CLI_BINARY: "/fake/yaps_cli" },
        canAccess: () => true,
        probe: async () => ({ ok: false, reason: "invalid_status" }),
      }),
    ).toBeUndefined();
  });

  test("passes automatic settings recovery through to the bundled MCP server", async () => {
    const settingsPath = "/Users/example/Library/Application Support/com.yaps.app/settings.json";
    const result = await resolveYapsSessionResult({
      cli: {
        path: "/Applications/Yaps.app/Contents/MacOS/yaps_cli",
        source: "installed_app",
        rejected: [],
      },
      platform: "darwin",
      env: {},
      appVersion: "2.3.124",
      readAuth: async (selected: string | null) => selected
        ? { ok: true, auth: { authenticated: true, status: "active", diagnosticCode: null, recommendedSettingsPath: null } }
        : { ok: true, auth: { authenticated: false, status: "settings_path_mismatch", diagnosticCode: "settings_path_mismatch", recommendedSettingsPath: settingsPath } },
    });

    expect(result.settingsPath).toBe(settingsPath);
    expect(result.auth?.status).toBe("active");
  });
});
