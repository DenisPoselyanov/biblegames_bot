#!/usr/bin/env python3
"""Bootstrap: перевірка залежностей і запуск AI Launcher V3."""

import os
import subprocess
import sys
import tkinter as tk
from tkinter import messagebox

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(SCRIPT_DIR)
REQ = os.path.join(SCRIPT_DIR, "requirements-launcher.txt")
LAUNCHER = os.path.join(SCRIPT_DIR, "ai_launcher.py")


def _pip_python():
    exe = sys.executable
    if exe.lower().endswith("pythonw.exe"):
        alt = exe[:-10] + "python.exe"
        if os.path.isfile(alt):
            return alt
    return exe


def _deps_ok():
    try:
        import customtkinter  # noqa: F401
        return True
    except ImportError:
        return False


def ensure_deps():
    if _deps_ok():
        return True
    if not os.path.isfile(REQ):
        return False
    flags = getattr(subprocess, "CREATE_NO_WINDOW", 0) if os.name == "nt" else 0
    try:
        subprocess.check_call(
            [_pip_python(), "-m", "pip", "install", "-r", REQ],
            cwd=ROOT,
            creationflags=flags,
        )
        return _deps_ok()
    except Exception:
        return False


def _show_error(msg):
    root = tk.Tk()
    root.withdraw()
    messagebox.showerror("AI Launcher V3", msg)
    root.destroy()


def _log_crash(exc):
    log_path = os.path.join(SCRIPT_DIR, ".launcher-last-error.txt")
    try:
        with open(log_path, "w", encoding="utf-8") as f:
            f.write(f"{type(exc).__name__}: {exc}\n")
            f.write(f"python: {sys.executable}\n")
    except OSError:
        pass


def main():
    os.chdir(ROOT)
    if not ensure_deps():
        _show_error(
            "Не вдалось встановити залежності GUI.\n\n"
            "У терміналі з кореня проєкту:\n"
            "python -m pip install -r scripts/requirements-launcher.txt"
        )
        raise SystemExit(1)
    import runpy
    try:
        runpy.run_path(LAUNCHER, run_name="__main__")
    except Exception as exc:
        _log_crash(exc)
        _show_error(f"Помилка запуску:\n\n{exc}\n\nДеталі: scripts/.launcher-last-error.txt")
        raise SystemExit(1) from exc


if __name__ == "__main__":
    main()
