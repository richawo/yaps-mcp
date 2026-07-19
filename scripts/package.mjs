import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const bundleRoot = join(root, "bundle");
const manifest = JSON.parse(await readFile(join(bundleRoot, "manifest.json"), "utf8"));
const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8"));

if (manifest.version !== packageJson.version) {
  throw new Error("bundle/manifest.json and package.json versions must match");
}
if (manifest.tools.length !== 28 || new Set(manifest.tools.map((tool) => tool.name)).size !== 28) {
  throw new Error("The bundle manifest must describe all 28 unique native Yaps MCP tools");
}

const outputDirectory = join(root, "dist", manifest.version);
const artifactName = `yaps-mcp-${manifest.version}.mcpb`;
const artifactPath = join(outputDirectory, artifactName);
await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });

runMcpb(["pack", bundleRoot, artifactPath]);
runMcpb(["info", artifactPath]);

const digest = createHash("sha256").update(await readFile(artifactPath)).digest("hex");
const releaseUrl = `https://github.com/richawo/yaps-mcp/releases/download/v${manifest.version}/${artifactName}`;
const serverJson = {
  $schema: "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
  name: "io.github.richawo/yaps",
  title: "Yaps Local Memory",
  description: "Search and safely manage your private local Yaps Markdown vault from MCP clients.",
  repository: {
    url: "https://github.com/richawo/yaps-mcp",
    source: "github",
  },
  version: manifest.version,
  packages: [
    {
      registryType: "mcpb",
      identifier: releaseUrl,
      fileSha256: digest,
      transport: { type: "stdio" },
    },
  ],
};

assertServerJson(serverJson);
await writeFile(
  join(outputDirectory, "server.json"),
  `${JSON.stringify(serverJson, null, 2)}\n`,
  "utf8",
);
await writeFile(
  join(outputDirectory, "checksums-sha256.txt"),
  `${digest}  ${artifactName}\n`,
  "utf8",
);

console.log(`Prepared MCPB and registry metadata in ${outputDirectory}`);

function runMcpb(args) {
  const executable = join(root, "node_modules", ".bin", process.platform === "win32" ? "mcpb.cmd" : "mcpb");
  const result = spawnSync(executable, args, { cwd: root, encoding: "utf8" });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    throw new Error(`mcpb ${args[0]} failed with exit code ${result.status}`);
  }
}

function assertServerJson(server) {
  const registryPackage = server.packages[0];
  if (!server.name.startsWith("io.github.richawo/")) {
    throw new Error("Registry name must use the authenticated richawo GitHub namespace");
  }
  if (server.description.length > 100) {
    throw new Error("Registry description must be at most 100 characters");
  }
  if (registryPackage.registryType !== "mcpb" || !registryPackage.identifier.includes("mcp")) {
    throw new Error("Registry package must be a public MCPB release URL");
  }
  if (!/^[a-f0-9]{64}$/.test(registryPackage.fileSha256)) {
    throw new Error("Registry package must include a SHA-256 digest");
  }
}
