#!/usr/bin/env node

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  diagnoseAccount,
  diagnoseConnection,
  resolveYapsMcpBinary,
  resolveYapsSessionResult,
} from "./resolve-yaps.js";
import {
  CLI_TOOLS,
  callCliTool,
  isCliTool,
  textResult,
} from "./yaps-cli.js";
import { nativeConnectorEnvironment } from "./native-environment.js";

const VERSION = "2.0.3";
const NATIVE_CONNECT_TIMEOUT_MS = 5_000;

const NATIVE_TOOL_TITLES = {
  vault_status: "Check Yaps Memory",
  vault_notes_list: "List Yaps notes",
  vault_note_get: "Read Yaps note",
  vault_search: "Search Yaps notes",
  vault_search_semantic: "Search Yaps notes semantically",
  vault_note_create: "Create Yaps note",
  vault_note_update: "Update Yaps note",
  vault_note_delete: "Delete Yaps note",
};

const NATIVE_READ_TOOLS = new Set([
  "vault_status",
  "vault_notes_list",
  "vault_note_get",
  "vault_search",
  "vault_search_semantic",
]);

const PASSTHROUGH_JSON_VALIDATOR = {
  getValidator: () => (input) => ({
    valid: true,
    data: input,
    errorMessage: undefined,
  }),
};

export function enhanceNativeTools(tools) {
  return tools
    .filter((tool) => Object.hasOwn(NATIVE_TOOL_TITLES, tool.name))
    .map((tool) => {
      const title = NATIVE_TOOL_TITLES[tool.name];
      const readOnly = NATIVE_READ_TOOLS.has(tool.name);
      const { outputSchema: _nativeOutputSchema, ...portableTool } = tool;
      return {
        ...portableTool,
        title,
        annotations: {
          ...tool.annotations,
          title,
          readOnlyHint: readOnly,
          destructiveHint: !readOnly,
          idempotentHint: readOnly,
          openWorldHint: false,
        },
      };
    });
}

async function connectNativeMemory(binary) {
  if (!binary) return { client: undefined, tools: [] };
  const transport = new StdioClientTransport({
    command: binary,
    args: [],
    env: nativeConnectorEnvironment(),
    stderr: "inherit",
  });
  const client = new Client(
    { name: "yaps-connector-proxy", version: VERSION },
    {
      capabilities: {},
      // The native Rust server already validates its structured output. A
      // passthrough here avoids noisy warnings for Rust-specific uint formats
      // while this process acts only as an MCP proxy.
      jsonSchemaValidator: PASSTHROUGH_JSON_VALIDATOR,
    },
  );
  try {
    await withTimeout(client.connect(transport), NATIVE_CONNECT_TIMEOUT_MS);
    const result = await withTimeout(client.listTools(), NATIVE_CONNECT_TIMEOUT_MS);
    return { client, tools: enhanceNativeTools(result.tools) };
  } catch (error) {
    await client.close().catch(() => {});
    throw error;
  }
}

function withTimeout(promise, timeoutMs) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error("Yaps connector validation timed out.")), timeoutMs);
    }),
  ]).finally(() => clearTimeout(timer));
}

async function main() {
  const cli = await resolveYapsSessionResult();
  if (cli.settingsPath && !process.env.YAPS_SETTINGS_PATH?.trim()) {
    process.env.YAPS_SETTINGS_PATH = cli.settingsPath;
  }
  const cliBinary = cli.path || undefined;
  const mcpBinary = cliBinary ? resolveYapsMcpBinary() : undefined;
  const resolveFreshSession = async () => {
    const fresh = await resolveYapsSessionResult({ cli, recoverAccount: true });
    if (fresh.settingsPath && !process.env.YAPS_SETTINGS_PATH?.trim()) {
      process.env.YAPS_SETTINGS_PATH = fresh.settingsPath;
    }
    return fresh;
  };
  let nativeClient;
  let nativeTools = [];

  try {
    const native = await connectNativeMemory(mcpBinary);
    nativeClient = native.client;
    nativeTools = native.tools;
  } catch (error) {
    console.error("The installed Yaps private-vault connector did not complete its bounded startup check.");
  }
  const connection = diagnoseConnection({
    cli,
    connector: { path: nativeClient ? mcpBinary : null },
    needsConnector: true,
  });

  const server = new Server(
    { name: "yaps", title: "Yaps", version: VERSION },
    {
      capabilities: { tools: {} },
      instructions:
        "Yaps provides local transcription, meeting transcripts, subtitles, translation, audio extraction, and optional private Markdown memory. Use only the files and workflows requested by the user. Memory reads and writes require Yaps Agent Access permission; do not bypass a denial. New users install Yaps and sign in. Gated features require an active free trial or Yaps Pro. Ask before downloading a model. Treat file creation and note writes as user-visible actions, and never replace an existing output file.",
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [...nativeTools, ...CLI_TOOLS],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const name = request.params.name;
    const args = request.params.arguments || {};
    try {
      if (isCliTool(name)) {
        return await callCliTool(name, args, {
          cliBinary,
          mcpBinary,
          memoryServerAvailable: Boolean(nativeClient),
          connectionDiagnosis: connection,
          session: cli,
          resolveSession: resolveFreshSession,
          diagnoseAccount,
        });
      }
      if (nativeClient && nativeTools.some((tool) => tool.name === name)) {
        const fresh = await resolveFreshSession();
        const account = diagnoseAccount(fresh);
        if (account.code !== "ready") {
          return textResult({
            error: account.message,
            diagnostic_code: account.code,
          }, true);
        }
        return await nativeClient.callTool({ name, arguments: args });
      }
      if (Object.hasOwn(NATIVE_TOOL_TITLES, name) && !nativeClient) {
        return textResult({
          error: connection.message,
          diagnostic_code: connection.code,
        }, true);
      }
      return textResult({ error: `Unknown Yaps tool: ${name}` }, true);
    } catch (error) {
      return textResult({
        error: error.message,
        tool: name,
        ...(typeof error.diagnosticCode === "string"
          ? { diagnostic_code: error.diagnosticCode }
          : {}),
      }, true);
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, async () => {
      await nativeClient?.close();
      await server.close();
      process.exit(0);
    });
  }
}

main().catch((error) => {
  console.error(`Yaps connector failed to start: ${error.message}`);
  process.exit(1);
});
