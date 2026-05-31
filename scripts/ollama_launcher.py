#!/usr/bin/env python3
"""Сумісність: старий шлях scripts/ollama_launcher.py → ai_launcher.py."""

import os
import runpy

if __name__ == "__main__":
    target = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ai_launcher.py")
    runpy.run_path(target, run_name="__main__")
