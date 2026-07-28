import { constants, accessSync } from "node:fs";
import { delimiter, join } from "node:path";

function candidatePathsFor(executableBase, overrideEnvName, {
  platform = process.platform,
  env = process.env,
  home = env.HOME ?? env.USERPROFILE ?? "",
} = {}) {
  const executableName = platform === "win32" ? `${executableBase}.exe` : executableBase;
  const candidates = [];

  if (env[overrideEnvName]?.trim()) {
    candidates.push(env[overrideEnvName].trim());
  }

  if (platform === "darwin") {
    candidates.push(
      join("/Applications/Yaps.app/Contents/MacOS", executableName),
      home ? join(home, "Applications", "Yaps.app", "Contents", "MacOS", executableName) : "",
    );
  } else if (platform === "win32") {
    for (const base of [env.ProgramW6432, env.ProgramFiles, env["ProgramFiles(x86)"], env.LOCALAPPDATA]) {
      if (!base) continue;
      candidates.push(join(base, "Yaps", executableName));
      if (base === env.LOCALAPPDATA) {
        candidates.push(join(base, "Programs", "Yaps", executableName));
      }
    }
  }

  if (home) {
    candidates.push(join(home, ".local", "bin", executableName));
  }
  for (const directory of (env.PATH ?? "").split(delimiter).filter(Boolean)) {
    candidates.push(join(directory, executableName));
  }

  return [...new Set(candidates.filter(Boolean))];
}

function resolveBinary(executableBase, overrideEnvName, options = {}) {
  const platform = options.platform ?? process.platform;
  const env = options.env ?? process.env;
  const mode = platform === "win32" ? constants.F_OK : constants.X_OK;
  const canAccess = options.canAccess ?? ((path) => {
    try {
      accessSync(path, mode);
      return true;
    } catch {
      return false;
    }
  });

  const explicit = env[overrideEnvName]?.trim();
  if (explicit) {
    return canAccess(explicit) ? explicit : undefined;
  }

  return candidatePathsFor(executableBase, overrideEnvName, { ...options, env }).find(canAccess);
}

export function candidatePaths(options = {}) {
  return candidatePathsFor("yaps_mcp", "YAPS_MCP_BINARY", options);
}

export function cliCandidatePaths(options = {}) {
  return candidatePathsFor("yaps_cli", "YAPS_CLI_BINARY", options);
}

export function resolveYapsMcpBinary(options = {}) {
  return resolveBinary("yaps_mcp", "YAPS_MCP_BINARY", options);
}

export function resolveYapsCliBinary(options = {}) {
  return resolveBinary("yaps_cli", "YAPS_CLI_BINARY", options);
}
