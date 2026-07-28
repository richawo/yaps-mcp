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
  resolveYapsCliBinary,
  resolveYapsMcpBinary,
} from "./resolve-yaps.js";
import {
  CLI_TOOLS,
  callCliTool,
  isCliTool,
  textResult,
} from "./yaps-cli.js";

const VERSION = "2.0.1";

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
    env: {
      ...process.env,
      YAPS_MCP_CLIENT_ID: process.env.YAPS_MCP_CLIENT_ID || "claude-desktop",
    },
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
  await client.connect(transport);
  const result = await client.listTools();
  return { client, tools: enhanceNativeTools(result.tools) };
}

async function main() {
  const mcpBinary = resolveYapsMcpBinary();
  const cliBinary = resolveYapsCliBinary();
  let nativeClient;
  let nativeTools = [];

  try {
    const native = await connectNativeMemory(mcpBinary);
    nativeClient = native.client;
    nativeTools = native.tools;
  } catch (error) {
    console.error(`Yaps Memory could not start: ${error.message}`);
  }

  const server = new Server(
    { name: "yaps", title: "Yaps", version: VERSION },
    {
      capabilities: { tools: {} },
      instructions:
        "Yaps provides local Memory, transcription, meeting transcripts, subtitles, translation, and deterministic video-to-audio conversion. Read the user's local Yaps notes before relying on remembered details. Treat all file creation and note writes as user-visible actions. Never replace an existing output file.",
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
        });
      }
      if (nativeClient && nativeTools.some((tool) => tool.name === name)) {
        return await nativeClient.callTool({ name, arguments: args });
      }
      if (Object.hasOwn(NATIVE_TOOL_TITLES, name) && !mcpBinary) {
        return textResult({
          error:
            "Yaps Memory is unavailable because the local Yaps MCP server was not found.",
          next_step:
            "Download or update Yaps at https://yaps.ai/download, then open Yaps → Settings → Agent Access.",
        }, true);
      }
      return textResult({ error: `Unknown Yaps tool: ${name}` }, true);
    } catch (error) {
      return textResult({
        error: error.message,
        tool: name,
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
