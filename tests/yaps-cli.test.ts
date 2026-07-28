import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  CLI_TOOLS,
  callCliTool,
  isCliTool,
} from "../bundle/server/yaps-cli";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((path) =>
      rm(path, { recursive: true, force: true }),
    ),
  );
});

async function fixtureDirectory() {
  const path = await mkdtemp(join(tmpdir(), "yaps-connector-test-"));
  temporaryDirectories.push(path);
  return path;
}

describe("Yaps connector CLI tools", () => {
  test("all tools have directory-safe titles and permission annotations", () => {
    expect(CLI_TOOLS).toHaveLength(8);
    for (const tool of CLI_TOOLS) {
      expect(tool.name.length).toBeLessThanOrEqual(64);
      expect(tool.title.length).toBeGreaterThan(0);
      expect(tool.annotations.title).toBe(tool.title);
      expect(
        tool.annotations.readOnlyHint === true ||
          tool.annotations.destructiveHint === true,
      ).toBe(true);
      expect(tool.annotations.openWorldHint).toBe(false);
      expect(isCliTool(tool.name)).toBe(true);
    }
  });

  test("status reports readiness without leaking account identifiers", async () => {
    const result = await callCliTool(
      "yaps_connector_status",
      {},
      {
        cliBinary: "/Applications/Yaps.app/Contents/MacOS/yaps_cli",
        mcpBinary: "/Applications/Yaps.app/Contents/MacOS/yaps_mcp",
        runCli: async () => ({
          authenticated: true,
          status: "active",
          email: "private@example.com",
          plan: "basic_monthly",
        }),
      },
    );

    expect(result.structuredContent).toEqual({
      installed: true,
      cli_available: true,
      memory_server_available: true,
      authenticated: true,
      account_status: "active",
      next_step: "Yaps is ready.",
    });
    expect(result.content[0].text).not.toContain("private@example.com");
    expect(result.content[0].text).not.toContain("basic_monthly");
  });

  test("plain transcription creates a new text file and rejects overwrite", async () => {
    const directory = await fixtureDirectory();
    const source = join(directory, "interview.wav");
    const output = join(directory, "interview.txt");
    await writeFile(source, "fixture", "utf8");
    const runCli = async () => ({
      transcript: "Hello from Yaps.",
      engine: "local",
      duration_secs: 2,
      word_count: 3,
    });

    const result = await callCliTool(
      "yaps_transcribe_media",
      { source_path: source, output_path: output },
      { cliBinary: "/fake/yaps_cli", runCli },
    );
    expect(await readFile(output, "utf8")).toBe("Hello from Yaps.\n");
    expect(result.structuredContent.output_path).toBe(output);

    const repeated = await callCliTool(
      "yaps_transcribe_media",
      { source_path: source, output_path: output },
      { cliBinary: "/fake/yaps_cli", runCli },
    ).catch((error) => error);
    expect(repeated.message).toContain("Output already exists");
  });

  test("subtitle, translated-file, and audio tools verify their outputs", async () => {
    const directory = await fixtureDirectory();
    const video = join(directory, "demo.mp4");
    const note = join(directory, "notes.md");
    await writeFile(video, "video", "utf8");
    await writeFile(note, "# Hello", "utf8");

    const commands: string[][] = [];
    const runCli = async (_binary: string, args: string[]) => {
      commands.push(args);
      const outputIndex = args.indexOf("--output");
      if (outputIndex >= 0) {
        await writeFile(args[outputIndex + 1], "generated", "utf8");
      }
      return { output_path: outputIndex >= 0 ? args[outputIndex + 1] : undefined };
    };

    await callCliTool(
      "yaps_generate_subtitles",
      { source_path: video },
      { cliBinary: "/fake/yaps_cli", runCli },
    );
    await callCliTool(
      "yaps_translate_file",
      { source_path: note, target_language: "fr" },
      { cliBinary: "/fake/yaps_cli", runCli },
    );
    await callCliTool(
      "yaps_extract_audio",
      { source_path: video, format: "wav" },
      { cliBinary: "/fake/yaps_cli", runCli },
    );

    expect(commands[0]).toEqual([
      "srt",
      "generate",
      video,
      "--output",
      join(directory, "demo Subtitles.srt"),
    ]);
    expect(commands[1]).toEqual([
      "translate",
      note,
      "--to",
      "fr",
      "--output",
      join(directory, "notes.fr.md"),
    ]);
    expect(commands[2]).toEqual([
      "media",
      "extract-audio",
      video,
      "--format",
      "wav",
      "--output",
      join(directory, "demo Audio.wav"),
    ]);
  });

  test("meeting transcription extracts video audio and validates engine arguments", async () => {
    const directory = await fixtureDirectory();
    const video = join(directory, "meeting.mp4");
    await writeFile(video, "video", "utf8");
    const commands: string[][] = [];
    const runCli = async (_binary: string, args: string[]) => {
      commands.push(args);
      const outputIndex = args.indexOf("--output");
      if (outputIndex >= 0) {
        await writeFile(args[outputIndex + 1], "wav", "utf8");
      }
      return args[0] === "meeting"
        ? { meeting_id: "meeting-1", segments: [{ speaker: "Speaker 1", text: "Hello" }] }
        : { output_path: args[outputIndex + 1] };
    };

    const result = await callCliTool(
      "yaps_transcribe_meeting",
      { source_path: video, title: "Weekly", engine: "sherpa", speakers: 3 },
      { cliBinary: "/fake/yaps_cli", runCli },
    );
    expect(commands).toHaveLength(2);
    expect(commands[0].slice(0, 3)).toEqual(["media", "extract-audio", video]);
    expect(commands[1]).toContain("--speakers");
    expect(result.structuredContent.source_path).toBe(video);

    await expect(
      callCliTool(
        "yaps_transcribe_meeting",
        { source_path: video, engine: "moss", speakers: 2 },
        { cliBinary: "/fake/yaps_cli", runCli },
      ),
    ).rejects.toThrow("MOSS detects speakers automatically");
  });

  test("text translation passes explicit language choices to Yaps", async () => {
    const calls: string[][] = [];
    const result = await callCliTool(
      "yaps_translate_text",
      { text: "Hello", target_language: "fr", source_language: "en" },
      {
        cliBinary: "/fake/yaps_cli",
        runCli: async (_binary: string, args: string[]) => {
          calls.push(args);
          return { text: "Bonjour", detected_source_lang: "en" };
        },
      },
    );

    expect(calls).toEqual([
      ["translate", "--text", "Hello", "--to", "fr", "--from", "en"],
    ]);
    expect(result.structuredContent.text).toBe("Bonjour");
  });
});
