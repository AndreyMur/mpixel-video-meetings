import { execFile } from 'node:child_process';

export function runCommand(
  command: string,
  args: string[],
  options: { cwd?: string } = {},
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      { cwd: options.cwd, maxBuffer: 128 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          const message = String(stderr).trim();
          reject(new Error(message || error.message));
          return;
        }
        resolve({ stdout: stdout.toString(), stderr: stderr.toString() });
      },
    );
  });
}
