import { describe, expect, test } from "bun:test";
import { candidatePaths, resolveYapsMcpBinary } from "../bundle/server/resolve-yaps";

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

  test("finds per-machine and legacy per-user Windows installations", () => {
    const paths = candidatePaths({
      platform: "win32",
      home: "C:\\Users\\example",
      env: {
        ProgramFiles: "C:\\Program Files",
        LOCALAPPDATA: "C:\\Users\\example\\AppData\\Local",
      },
    });

    expect(paths).toContain("C:\\Program Files/Yaps/yaps_mcp.exe");
    expect(paths).toContain(
      "C:\\Users\\example\\AppData\\Local/Programs/Yaps/yaps_mcp.exe",
    );
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
});
