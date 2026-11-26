import { spawn } from "node:child_process";
import { join } from "node:path";
import type { Plugin } from "@opencode-ai/plugin";
import { define } from "@opencode-ai/plugin/v2/promise";

/**
 * Penegak dokumentasi untuk OpenCode.
 *
 * Instruksi di AGENTS.md tidak mengikat; plugin ini yang deterministik.
 * `tool.execute.before` memanggil scripts/docs-hook.py gate dan melempar
 * galat saat exit code 2, sehingga aksi tulis dibatalkan selama drift
 * dokumen terdeteksi. Tool subagen ("task") ikut diperiksa supaya subagen
 * tidak bisa menulis tanpa melewati gerbang.
 *
 * Plugin dimuat otomatis dari .opencode/plugins/ (lihat rujukan Plugins OpenCode).
 */

const WRITE_TOOLS = new Set(["edit", "write", "bash", "task"]);

type PythonCandidate = {
  bin: string;
  argsPrefix: string[];
};

/**
 * Biner Python yang dipakai memanggil dispatcher.
 *
 * `python3` tidak selalu tersedia atau bisa berupa stub Windows App Store,
 * sehingga fallback ke `python` lalu `py -3.13` memastikan gate tetap menyala
 * di Linux maupun Windows. DOCS_PYTHON_BIN menang lebih dulu.
 */
const pythonCandidates = (hookPath: string): PythonCandidate[] => {
  const configured = process.env.DOCS_PYTHON_BIN?.trim();

  return [
    ...(configured ? [{ bin: configured, argsPrefix: [hookPath] }] : []),
    { bin: "python3", argsPrefix: [hookPath] },
    { bin: "python", argsPrefix: [hookPath] },
    { bin: "py", argsPrefix: ["-3.13", hookPath] },
  ];
};

const isEditingDoc = (input: { tool: string; args?: Record<string, unknown> }): boolean => {
  if (input.tool === "bash") {
    return false;
  }

  const raw = input.args?.file_path ?? input.args?.path ?? input.args?.filePath;
  const target = typeof raw === "string" ? raw : "";

  if (!target) {
    return false;
  }

  const normalized = target.replace(/\\/g, "/");

  return (
    normalized.includes("docs/") ||
    normalized.endsWith(".md") ||
    normalized.endsWith("docs-map.json") ||
    normalized.endsWith("llms.txt")
  );
};

export const DocsEnforcer: Plugin = async ({ directory }) => {
  const hookPath = join(directory, "scripts", "docs-hook.py");

  const runHook = (event: string): Promise<string> => {
    const candidates = pythonCandidates(hookPath);

    return new Promise((resolve, reject) => {
      const attempt = (remaining: PythonCandidate[]): void => {
        const [current, ...rest] = remaining;

        if (!current) {
          resolve("");

          return;
        }

        let settled = false;

        const child = spawn(current.bin, [...current.argsPrefix, event, "--agent=opencode"], {
          cwd: directory,
          stdio: ["ignore", "pipe", "pipe"],
          windowsHide: true,
        });

        let stdout = "";
        let stderr = "";

        child.stdout?.on("data", (chunk: Buffer) => {
          stdout += chunk.toString();
        });

        child.stderr?.on("data", (chunk: Buffer) => {
          stderr += chunk.toString();
        });

        child.on("error", () => {
          if (settled) {
            return;
          }

          settled = true;

          if (rest.length > 0) {
            attempt(rest);

            return;
          }

          // Semua kandidat gagal dipanggil; loloskan agar agen tidak membeku
          resolve("");
        });

        child.on("close", (code) => {
          if (settled) {
            return;
          }

          settled = true;

          const cleanStdout = stdout.trim();
          const cleanStderr = stderr.trim();
          const output = cleanStdout !== "" ? cleanStdout : cleanStderr;

          if (code === 2) {
            reject(new Error(output === "" ? "Drift dokumen." : output));

            return;
          }

          // Fallback bila stub Windows Store atau biner rusak mengembalikan kode non-0 selain 2
          if (code !== 0 && rest.length > 0) {
            attempt(rest);

            return;
          }

          resolve(output);
        });
      };

      attempt(candidates);
    });
  };

  return {
    "tool.execute.before": async (input) => {
      if (!WRITE_TOOLS.has(input.tool) || isEditingDoc(input)) {
        return;
      }

      try {
        await runHook("gate");
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);

        throw new Error(
          `Aksi dibatalkan oleh penegak dokumentasi.\n${detail}\n` +
            `Perbarui dokumen yang disebut di atas pada siklus ini, lalu ulangi aksi yang sama.`,
          { cause: error },
        );
      }
    },

    event: async ({ event }) => {
      if (event.type !== "session.idle") {
        return;
      }

      try {
        const message = await runHook("stop");

        if (message) {
          console.warn(message);
        }
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);

        console.error(detail);
      }
    },
  };
};

export default define({
  id: "docs-enforcer",
  setup: async () => {},
});
