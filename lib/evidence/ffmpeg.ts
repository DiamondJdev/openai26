import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const FFMPEG_BIN = process.env.FFMPEG_PATH ?? "ffmpeg";

/**
 * Run ffmpeg with an explicit argument array (never a shell string) so no
 * argument can be interpreted as a shell command. Bounded by a timeout.
 */
export async function runFfmpeg(
  args: readonly string[],
  timeoutMs = 20_000,
): Promise<void> {
  await execFileAsync(FFMPEG_BIN, [...args], {
    timeout: timeoutMs,
    maxBuffer: 4 * 1024 * 1024,
  });
}
