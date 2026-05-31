#!/usr/bin/env node
/** Запуск AI Launcher V3 у фоні (термінал одразу звільняється). */
import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const launcher = path.join(__dirname, "launch-ai-gui.py");
const isWin = process.platform === "win32";

function resolvePythonw() {
  if (!isWin) return "python3";
  const local = process.env.LOCALAPPDATA;
  if (local) {
    for (const ver of ["313", "312", "311", "310"]) {
      const candidate = path.join(local, "Programs", "Python", `Python${ver}`, "pythonw.exe");
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  try {
    const lines = execFileSync("cmd", ["/c", "where pythonw"], { encoding: "utf8" })
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const good = lines.find(
      (l) => !/windowsapps|pythoncore/i.test(l) && fs.existsSync(l),
    );
    if (good) return good;
  } catch {
    /* ignore */
  }
  return "pythonw";
}

const bin = resolvePythonw();
const child = spawn(bin, [launcher], {
  cwd: root,
  detached: true,
  stdio: "ignore",
  windowsHide: true,
});

child.on("error", (err) => {
  console.error(`Не вдалось запустити ${bin}: ${err.message}`);
  console.error("Встанови залежності: python -m pip install -r scripts/requirements-launcher.txt");
  process.exit(1);
});

child.unref();
