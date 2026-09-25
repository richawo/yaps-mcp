import { spawn } from "node:child_process";
import { constants, access, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { extname, join, parse, resolve } from "node:path";
import { tmpdir } from "node:os";

const VIDEO_EXTENSIONS = new Set([
  ".3gp",
  ".avi",
  ".flv",
  ".m2ts",
  ".m4v",
  ".mkv",
  ".mov",
  ".mp4",
  ".mpeg",
  ".mpg",
  ".mts",
  ".ts",
  ".webm",
  ".wmv",
]);

const READ_ONLY_ANNOTATIONS = {
  title: "",
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

const CREATE_FILE_ANNOTATIONS = {
  title: "",
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: false,
};

function tool({
  name,
  title,
  description,
  inputSchema,
  annotations = READ_ONLY_ANNOTATIONS,
}) {
  return {
    name,
    title,
    description,
    inputSchema,
    annotations: { ...annotations, title },
  };
}

export const CLI_TOOLS = [
  tool({
    name: "yaps_connector_status",
    title: "Check Yaps connector",
    description:
      "Check whether the local Yaps app, CLI, Memory server, sign-in, and account access are ready. Returns no email address or billing identifiers.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  }),
  tool({
    name: "yaps_features_list",
    title: "List Yaps features",
    description:
      "List local Yaps feature and model readiness without installing or downloading anything.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  }),
  tool({
    name: "yaps_transcribe_media",
    title: "Transcribe audio or video",
    description:
      "Transcribe one local audio or video file with Yaps and create a new plain-text transcript. Existing files are never replaced.",
    inputSchema: {
      type: "object",
      properties: {
        source_path: { type: "string", description: "Absolute path to the audio or video file." },
        output_path: {
          type: "string",
          description:
            "Optional absolute destination ending in .txt. Defaults beside the source as '<name> Transcript.txt'.",
        },
      },
      required: ["source_path"],
      additionalProperties: false,
    },
    annotations: CREATE_FILE_ANNOTATIONS,
  }),
  tool({
    name: "yaps_generate_subtitles",
    title: "Generate SRT subtitles",
    description:
      "Generate a new timestamped SRT subtitle file from one local audio or video file with Yaps. Existing files are never replaced.",
    inputSchema: {
      type: "object",
      properties: {
        source_path: { type: "string", description: "Absolute path to the audio or video file." },
        output_path: {
          type: "string",
          description:
            "Optional absolute destination ending in .srt. Defaults beside the source as '<name> Subtitles.srt'.",
        },
      },
      required: ["source_path"],
      additionalProperties: false,
    },
    annotations: CREATE_FILE_ANNOTATIONS,
  }),
  tool({
    name: "yaps_transcribe_meeting",
    title: "Transcribe meeting with speakers",
    description:
      "Create a local Yaps meeting transcript with speaker-labelled segments from one audio or video recording.",
    inputSchema: {
      type: "object",
      properties: {
        source_path: { type: "string", description: "Absolute path to the meeting recording." },
        title: { type: "string", description: "Optional meeting title saved in Yaps." },
        engine: {
          type: "string",
          enum: ["auto", "sherpa", "moss"],
          default: "auto",
          description: "Use auto unless the user explicitly requests another installed engine.",
        },
        speakers: {
          type: "integer",
          minimum: 1,
          maximum: 20,
          description: "Optional expected speaker count for Sherpa. Omit for MOSS.",
        },
      },
      required: ["source_path"],
      additionalProperties: false,
    },
    annotations: {
      ...CREATE_FILE_ANNOTATIONS,
      title: "",
    },
  }),
  tool({
    name: "yaps_translate_text",
    title: "Translate text locally",
    description:
      "Translate supplied text with the installed local Yaps translation engine without a hosted translation API.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", minLength: 1, description: "Text to translate." },
        target_language: {
          type: "string",
          minLength: 2,
          description: "Target language code such as fr, de, es, or ja.",
        },
        source_language: {
          type: "string",
          minLength: 2,
          description: "Optional source language code when automatic detection is unsuitable.",
        },
      },
      required: ["text", "target_language"],
      additionalProperties: false,
    },
  }),
  tool({
    name: "yaps_translate_file",
    title: "Translate file locally",
    description:
      "Translate a local Markdown, text, or SRT file with Yaps and create a new file while preserving the source.",
    inputSchema: {
      type: "object",
      properties: {
        source_path: { type: "string", description: "Absolute path to a .md, .txt, or .srt file." },
        target_language: {
          type: "string",
          minLength: 2,
          description: "Target language code such as fr, de, es, or ja.",
        },
        source_language: {
          type: "string",
          minLength: 2,
          description: "Optional source language code when automatic detection is unsuitable.",
        },
        output_path: {
          type: "string",
          description:
            "Optional absolute destination. Defaults beside the source as '<name>.<target-language>.<extension>'.",
        },
      },
      required: ["source_path", "target_language"],
      additionalProperties: false,
    },
    annotations: CREATE_FILE_ANNOTATIONS,
  }),
  tool({
    name: "yaps_extract_audio",
    title: "Extract audio from video",
    description:
      "Create an MP3, WAV, or M4A audio-only copy of a local video using deterministic local media conversion, not AI media generation.",
    inputSchema: {
      type: "object",
      properties: {
        source_path: { type: "string", description: "Absolute path to the source video." },
        format: {
          type: "string",
          enum: ["mp3", "wav", "m4a"],
          default: "mp3",
          description: "Audio output format.",
        },
        output_path: {
          type: "string",
          description:
            "Optional absolute destination. Defaults beside the source as '<name> Audio.<format>'.",
        },
      },
      required: ["source_path"],
      additionalProperties: false,
    },
    annotations: CREATE_FILE_ANNOTATIONS,
  }),
];

export function textResult(value, isError = false) {
  return {
    content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
    structuredContent: value,
    ...(isError ? { isError: true } : {}),
  };
}

function terminateProcess(child) {
  try { child.stdout?.destroy(); } catch {}
  try { child.stderr?.destroy(); } catch {}
  try { child.kill("SIGTERM"); } catch {}
  const force = setTimeout(() => {
    if (child.exitCode == null && child.signalCode == null) {
      try { child.kill("SIGKILL"); } catch {}
    }
  }, 100);
  force.unref?.();
  child.once?.("close", () => clearTimeout(force));
}

/**
 * Current Yaps prints {"error","error_code"} on stdout (plus an "Error: ..."
 * line on stderr) and exits 130 when cancelled; older builds print plain text
 * on stderr with an empty stdout. YAPS_CLI_PROGRESS=json adds NDJSON progress
 * lines to stderr, which never explain a failure.
 */
export function cliFailureMessage(code, stdout, stderr) {
  try {
    const parsed = JSON.parse(stdout);
    if (parsed && typeof parsed.error === "string" && parsed.error.trim()) return parsed.error.trim();
  } catch {
    // Older builds: fall through to stderr.
  }
  if (code === 130) return "The Yaps operation was cancelled before it finished.";
  const explanation = stderr
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.trimStart().startsWith("{"))
    .join("\n")
    .trim();
  return explanation || stdout.trim() || `Yaps exited with code ${code}.`;
}

export async function runCliJson(cliBinary, args, {
  timeoutMs = 300_000,
  spawnProcess = spawn,
} = {}) {
  if (!cliBinary) {
    throw new Error(
      "Yaps is not installed. Download Yaps from https://yaps.ai/download, open it, sign in, and finish setup.",
    );
  }

  return await new Promise((resolvePromise, reject) => {
    const child = spawnProcess(cliBinary, ["--pretty", ...args], {
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      terminateProcess(child);
      settled = true;
      reject(new Error(`Yaps timed out while running: ${args.join(" ")}`));
    }, timeoutMs);

    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk) => {
      stdout += chunk;
      if (stdout.length > 10_000_000 && !settled) {
        settled = true;
        clearTimeout(timer);
        terminateProcess(child);
        reject(new Error("Yaps returned too much output."));
      }
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk;
      if (stderr.length > 1_000_000 && !settled) {
        settled = true;
        clearTimeout(timer);
        terminateProcess(child);
        reject(new Error("Yaps returned too much error output."));
      }
    });
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(cliFailureMessage(code, stdout, stderr)));
        return;
      }
      try {
        const parsed = JSON.parse(stdout);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          throw new Error("Yaps returned an unexpected JSON response.");
        }
        resolvePromise(parsed);
      } catch (error) {
        reject(new Error(`Yaps returned invalid JSON: ${error.message}`));
      }
    });
  });
}

async function requireSourceFile(pathValue, extensions) {
  if (typeof pathValue !== "string" || !pathValue.trim()) {
    throw new Error("source_path is required.");
  }
  const path = resolve(pathValue);
  const details = await stat(path).catch(() => undefined);
  if (!details?.isFile()) throw new Error(`Source file not found: ${path}`);
  if (extensions && !extensions.has(extname(path).toLowerCase())) {
    throw new Error(`Unsupported source file type: ${extname(path) || "(none)"}`);
  }
  return path;
}

async function requireNewOutput(pathValue, expectedExtension) {
  const path = resolve(pathValue);
  if (expectedExtension && extname(path).toLowerCase() !== expectedExtension) {
    throw new Error(`Output path must end in ${expectedExtension}: ${path}`);
  }
  try {
    await access(path, constants.F_OK);
    throw new Error(`Output already exists: ${path}. Choose a new output path.`);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  return path;
}

async function requireCreatedOutput(path) {
  const details = await stat(path).catch(() => undefined);
  if (!details?.isFile() || details.size === 0) {
    throw new Error(`Yaps did not create a non-empty output file: ${path}`);
  }
}

function defaultOutput(sourcePath, suffix, extension) {
  const parsed = parse(sourcePath);
  return join(parsed.dir, `${parsed.name}${suffix}${extension}`);
}

async function connectorStatus({
  cliBinary,
  mcpBinary,
  memoryServerAvailable,
  connectionDiagnosis,
  session,
  resolveSession,
  diagnoseAccount,
}) {
  const status = {
    installed: Boolean(cliBinary || mcpBinary),
    cli_available: Boolean(cliBinary),
    memory_server_available: memoryServerAvailable ?? Boolean(mcpBinary),
    authenticated: false,
    account_status: "unknown",
  };
  if (!cliBinary) {
    status.diagnostic_code = connectionDiagnosis?.code || "cli_missing";
    status.next_step = connectionDiagnosis?.message
      || "Download Yaps from https://yaps.ai/download, open it, sign in, and finish setup.";
    return status;
  }

  try {
    const currentSession = resolveSession ? await resolveSession() : session;
    const auth = currentSession?.auth;
    if (!auth) {
      status.next_step = diagnoseAccount
        ? diagnoseAccount(currentSession || {}).message
        : "Update Yaps; the connector will reuse its desktop account automatically.";
      return status;
    }
    status.authenticated = auth.authenticated === true;
    status.account_status = typeof auth.status === "string" ? auth.status : "unknown";
    if (diagnoseAccount && status.account_status !== "active") {
      status.next_step = diagnoseAccount(currentSession).message;
    } else if (!status.authenticated) {
      status.next_step = "Sign in inside Yaps. The connector will use that desktop session automatically.";
    } else if (status.account_status !== "active") {
      status.next_step = "Open Yaps and start an available free trial or activate Yaps Pro.";
    } else if (!status.memory_server_available) {
      status.diagnostic_code = connectionDiagnosis?.code || "vault_connector_unavailable";
      status.next_step = connectionDiagnosis?.message
        || "Update Yaps to restore the local Memory server.";
    } else {
      status.next_step = "Yaps is ready.";
    }
  } catch (error) {
    status.next_step = error.message;
  }
  return status;
}

async function requireActiveAccount(dependencies) {
  if (!dependencies.cliBinary) {
    const diagnosis = dependencies.connectionDiagnosis || {
      code: "cli_missing",
      message: "Yaps is not installed. Download Yaps from https://yaps.ai/download, open it, sign in, and finish setup.",
    };
    const error = new Error(diagnosis.message);
    error.diagnosticCode = diagnosis.code;
    throw error;
  }
  const session = dependencies.resolveSession
    ? await dependencies.resolveSession()
    : dependencies.session;
  if (session?.auth?.authenticated === true && session.auth.status === "active") {
    return session;
  }
  const diagnosis = dependencies.diagnoseAccount?.(session || {});
  const error = new Error(
    diagnosis?.message
      || "Open Yaps and sign in with an active free trial or Yaps Pro. This connector will use that desktop session automatically.",
  );
  error.diagnosticCode = diagnosis?.code || "account_not_active";
  throw error;
}

async function transcribeMedia(args, { cliBinary, runCli = runCliJson }) {
  const source = await requireSourceFile(args.source_path);
  const output = await requireNewOutput(
    args.output_path || defaultOutput(source, " Transcript", ".txt"),
    ".txt",
  );
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "yaps-connector-transcription-"));
  try {
    const temporarySrt = join(temporaryDirectory, "transcript.srt");
    const result = await runCli(cliBinary, ["srt", "generate", source, "--output", temporarySrt]);
    const transcript = typeof result.transcript === "string" ? result.transcript.trim() : "";
    if (!transcript) throw new Error("Yaps found no speech in this file.");
    await writeFile(output, `${transcript}\n`, "utf8");
    return {
      source_path: source,
      output_path: output,
      engine: result.engine,
      duration_secs: result.duration_secs,
      word_count: result.word_count,
    };
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

async function generateSubtitles(args, { cliBinary, runCli = runCliJson }) {
  const source = await requireSourceFile(args.source_path);
  const output = await requireNewOutput(
    args.output_path || defaultOutput(source, " Subtitles", ".srt"),
    ".srt",
  );
  const result = await runCli(cliBinary, ["srt", "generate", source, "--output", output]);
  await requireCreatedOutput(output);
  return result;
}

async function transcribeMeeting(args, { cliBinary, runCli = runCliJson }) {
  const source = await requireSourceFile(args.source_path);
  const engine = args.engine || "auto";
  if (!["auto", "sherpa", "moss"].includes(engine)) {
    throw new Error("engine must be auto, sherpa, or moss.");
  }
  if (args.speakers !== undefined && (!Number.isInteger(args.speakers) || args.speakers < 1 || args.speakers > 20)) {
    throw new Error("speakers must be an integer from 1 to 20.");
  }
  if (engine === "moss" && args.speakers !== undefined) {
    throw new Error("MOSS detects speakers automatically; omit speakers.");
  }

  const temporaryDirectory = VIDEO_EXTENSIONS.has(extname(source).toLowerCase())
    ? await mkdtemp(join(tmpdir(), "yaps-connector-meeting-"))
    : undefined;
  try {
    let recording = source;
    if (temporaryDirectory) {
      recording = join(temporaryDirectory, "meeting-audio.wav");
      await runCli(cliBinary, [
        "media",
        "extract-audio",
        source,
        "--format",
        "wav",
        "--output",
        recording,
      ]);
    }
    const command = ["meeting", "transcribe", recording, "--engine", engine];
    if (args.title) command.push("--title", args.title);
    if (args.speakers !== undefined) command.push("--speakers", String(args.speakers));
    const result = await runCli(cliBinary, command);
    return { ...result, source_path: source };
  } finally {
    if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

async function translateText(args, { cliBinary, runCli = runCliJson }) {
  if (typeof args.text !== "string" || !args.text.trim()) throw new Error("text is required.");
  if (typeof args.target_language !== "string" || args.target_language.trim().length < 2) {
    throw new Error("target_language is required.");
  }
  const command = ["translate", "--text", args.text, "--to", args.target_language.trim()];
  if (args.source_language) command.push("--from", args.source_language.trim());
  return await runCli(cliBinary, command);
}

async function translateFile(args, { cliBinary, runCli = runCliJson }) {
  const source = await requireSourceFile(
    args.source_path,
    new Set([".md", ".txt", ".srt"]),
  );
  if (typeof args.target_language !== "string" || args.target_language.trim().length < 2) {
    throw new Error("target_language is required.");
  }
  const target = args.target_language.trim();
  const parsed = parse(source);
  const output = await requireNewOutput(
    args.output_path || join(parsed.dir, `${parsed.name}.${target}${parsed.ext}`),
  );
  const command = ["translate", source, "--to", target, "--output", output];
  if (args.source_language) command.push("--from", args.source_language.trim());
  const result = await runCli(cliBinary, command);
  await requireCreatedOutput(output);
  return result;
}

async function extractAudio(args, { cliBinary, runCli = runCliJson }) {
  const source = await requireSourceFile(args.source_path, VIDEO_EXTENSIONS);
  const format = args.format || "mp3";
  if (!["mp3", "wav", "m4a"].includes(format)) {
    throw new Error("format must be mp3, wav, or m4a.");
  }
  const output = await requireNewOutput(
    args.output_path || defaultOutput(source, " Audio", `.${format}`),
    `.${format}`,
  );
  const result = await runCli(cliBinary, [
    "media",
    "extract-audio",
    source,
    "--format",
    format,
    "--output",
    output,
  ]);
  await requireCreatedOutput(output);
  return result;
}

export async function callCliTool(name, args = {}, dependencies) {
  if (name !== "yaps_connector_status") {
    await requireActiveAccount(dependencies);
  }
  switch (name) {
    case "yaps_connector_status":
      return textResult(await connectorStatus(dependencies));
    case "yaps_features_list":
      return textResult(await (dependencies.runCli || runCliJson)(
        dependencies.cliBinary,
        ["features", "list"],
      ));
    case "yaps_transcribe_media":
      return textResult(await transcribeMedia(args, dependencies));
    case "yaps_generate_subtitles":
      return textResult(await generateSubtitles(args, dependencies));
    case "yaps_transcribe_meeting":
      return textResult(await transcribeMeeting(args, dependencies));
    case "yaps_translate_text":
      return textResult(await translateText(args, dependencies));
    case "yaps_translate_file":
      return textResult(await translateFile(args, dependencies));
    case "yaps_extract_audio":
      return textResult(await extractAudio(args, dependencies));
    default:
      return undefined;
  }
}

export function isCliTool(name) {
  return CLI_TOOLS.some((entry) => entry.name === name);
}
