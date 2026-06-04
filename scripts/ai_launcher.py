#!/usr/bin/env python3
"""AI Launcher V3 — GUI для AI-інструментів проєкту (CustomTkinter)."""

import json
import os
import shutil
import socket
import subprocess
import sys
import threading
import time
import tkinter as tk
from tkinter import messagebox, ttk
from urllib.error import URLError
from urllib.request import Request, urlopen

AI_PROVIDERS = ("ollama", "gemini", "omniroute")
AI_PROVIDER_LABELS = {"ollama": "Ollama", "gemini": "Gemini", "omniroute": "OmniRoute"}
GEMINI_MODEL_PRESETS = (
    "gemini-3.1-flash-lite",
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-1.5-pro",
    "gemini-1.5-flash",
)

try:
    import customtkinter as ctk
except ImportError:
    _root = tk.Tk()
    _root.withdraw()
    messagebox.showerror(
        "CustomTkinter",
        "Встанови залежності GUI:\n\npip install -r scripts/requirements-launcher.txt",
    )
    raise SystemExit(1)

try:
    import pyperclip
    HAS_PYPERCLIP = True
except ImportError:
    HAS_PYPERCLIP = False

ctk.set_appearance_mode("system")
ctk.set_default_color_theme("blue")
ctk.set_widget_scaling(1.12)

FONT_MONO = ("Consolas", 12)
FONT_MONO_TK = ("Consolas", 12)
FONT_SPIN = ("Segoe UI", 12)
FONT_SM = ("Segoe UI", 12)
FONT_H = ("Segoe UI Semibold", 14)
FONT_TITLE = ("Segoe UI Light", 18)
FONT_DD = ("Segoe UI", 13)
FONT_HINT = ("Consolas", 11)
FONT_BTN = ("Segoe UI Semibold", 12)
FONT_TAB = ("Segoe UI Semibold", 13)

# (light theme, dark theme) — вищий контраст ніж CTk "gray"
TEXT_MUTED = ("#424a53", "#c9d1d9")
TEXT_SUB = ("#57606a", "#adb6c2")
CTRL_H = 34
BTN_H = 34
INSTANCE_PORT = 51891
APP_NAME = "AI Launcher V3"
LEGACY_APP_TITLES = ("Ollama Launcher v2", "Ollama Launcher")

SCRIPT_HELP = {
    "questions:stats": (
        "Статистика питань\n\n"
        "Показує скільки питань є в базі, як вони розподілені по темах, "
        "складності та файлах question-db. Не змінює дані — лише звіт у «Вивід».\n\n"
        "Коли корисно: перед балансуванням або генерацією, щоб побачити прогалини."
    ),
    "analyze-quality": (
        "Якість питань (AI)\n\n"
        "Ollama оцінює кожне питання: зрозумілість, точність, відповідність темі. "
        "Результат — звіт з оцінками та проблемними питаннями.\n\n"
        "Потрібен запущений ollama serve. Може тривати довго на великій базі."
    ),
    "analyze-pools": (
        "Аналіз пулів\n\n"
        "Перевіряє баланс пулів питань для режимів гри (survival, kahoot тощо): "
        "чи достатньо питань, чи немає дублікатів і перекосів по темах.\n\n"
        "Не змінює файли — лише діагностика."
    ),
    "scripture:audit": (
        "Аудит Писання\n\n"
        "Перевіряє біблійні посилання в питаннях через API (Bolls). "
        "Знаходить зламані, відсутні або неточні цитати.\n\n"
        "Потрібен запущений сервер на localhost:3001 (npm run server:dev)."
    ),
    "generate-ai-theme": (
        "Fill підтем: одна тема\n\n"
        "Заповнює всі листові підтеми обраної теми до 100% практики "
        "(кожна підтема × кожна складність, з topicNodeId).\n\n"
        "CLI: npm run fill-practice-nodes -- --theme geography\n\n"
        "Поле «Кількість» = --max-questions (0 = без ліміту)."
    ),
    "generate-ai-all": (
        "Fill підтем: усі теми\n\n"
        "Послідовно заповнює прогалини для всіх тем з topics-db. "
        "Тривала операція — краще з --max-questions.\n\n"
        "CLI: npm run fill-practice-nodes"
    ),
    "generate-ai-group_ot": (
        "Fill підтем: група СЗ\n\n"
        "Заповнює листові підтеми всіх тем Старого Завіту.\n\n"
        "CLI: npm run fill-practice-nodes -- --group old-testament"
    ),
    "generate-ai-topic": (
        "Генерація: одна підтема\n\n"
        "Генерує питання для конкретного вузла (Topic ID), "
        "наприклад pentateuch-sub-1-sub-1. Кожне питання отримує topicNodeId.\n\n"
        "ID можна скопіювати з вкладки «Якість тем»."
    ),
    "balance-preview": (
        "Баланс: превʼю\n\n"
        "Показує, скільки питань додали б або прибрали для вирівнювання підтем "
        "без запису у файли. Scope: прямі діти або всі листи вузла.\n\n"
        "Ціль 0 = вирівняти до максимуму в групі."
    ),
    "balance-apply": (
        "Баланс: застосувати\n\n"
        "Реально вирівнює кількість питань між підтемами вузла (генерація або "
        "видалення зайвих). Змінює question-db — спочатку зробіть превʼю.\n\n"
        "Node/Theme — id батьківської теми з topics-db."
    ),
    "sort-questions": (
        "Сортування питань\n\n"
        "Класифікує питання по підтемах topics-db і записує topicNodeId.\n\n"
        "--ai: Ollama лише для неоднозначних (heuristic лишив корінь теми).\n"
        "--ai-all: Ollama для КОЖНОГО питання (дуже повільно на 9b!).\n"
        "limit>0: макс. кількість AI-запитів. 0 + --ai = лише неоднозначні.\n"
        "--resume: продовжити з question-categories.json (пропуск вже оброблених)."
    ),
    "generate-topics": (
        "Генерація ієрархії\n\n"
        "AI будує або доповнює дерево підтем у topics-db для теми або всіх тем. "
        "Створює структуру категорій, іконки, описи.\n\n"
        "За замовчуванням --all; для однієї теми: --theme geography."
    ),
    "sort-topics-ai": (
        "AI-сортування тем\n\n"
        "Ollama аналізує ієрархію topics-db: пропонує перестановку, "
        "об’єднання або reparent підтем (--reparent).\n\n"
        "Обережно: змінює структуру JSON — зробіть backup."
    ),
    "merge-topics-db": (
        "Merge topics-db\n\n"
        "Об’єднує розрізнені файли topics-db у цілісну структуру "
        "(скрипт merge-topics-db.py). Корисно після ручних правок або імпорту.\n\n"
        "Перевірте результат у «Якість тем»."
    ),
    "topic-conveyor": (
        "Конвеєр ієрархії\n\n"
        "Режим «Нова гілка»: оберіть завіт (СЗ/НЗ), AI пропонує гілку — "
        "можна змінити назву, прийняти або відхилити. L1/L2/L3 = 0 — пропуск рівня; "
        "L2/L3 можна вимкнути чекбоксами; питань/лист = 0 — лише структура.\n\n"
        "Перед генерацією AI перевіряє наявні гілки — попередження «схоже на…» у review.\n"
        "L3 також через екран перевірки (як L1/L2).\n\n"
        "«Існуючий вузол» — файл теми або 🌿 гілка з extensions. "
        "Гілки: data/topics-db/extensions/{covenant}.json → Merge topics-db."
    ),
    "topic-preview": (
        "Попередній перегляд ієрархії\n\n"
        "Дерево всіх категорій з topics-db.json (після Merge) та лічильники питань "
        "(прямі / у піддереві). Оновити — перебудувати індекс.\n\n"
        "Пошук, фільтр завіту, згортання за глибиною. Подвійний клік — розгорнути гілку. "
        "«У Конвеєрі» — режим «Існуючий вузол», батьком стає обрана категорія "
        "(не лише файл теми). Скинути сесію — якщо застряг review."
    ),
    "analyze-topics": (
        "Перевірка якості тем\n\n"
        "Аналіз «ширини» кожної підтеми: опис, нащадки, повнота ієрархії. "
        "Зберігає звіт у data/topics-quality-report.json.\n\n"
        "Список нижче оновиться; клік по рядку — дії з темою."
    ),
    "quality-filter": (
        "Фільтр списку\n\n"
        "Файл — показати лише одну тему з topics-db. "
        "Бал — діапазон breadthScore (0–100): червоні <30, жовті 30–59, зелені ≥60.\n\n"
        "Не запускає скрипт — лише фільтрує вже завантажений звіт."
    ),
    "analyze-quality-tab": (
        "Перевірка якості питань\n\n"
        "Rule-based аналіз усіх питань (embedded + question-db): дублікати, посилання, "
        "складність. Зберігає question-quality-report.json.\n\n"
        "Список нижче оновиться; клік — редагування та карантин."
    ),
    "question-quality-filter": (
        "Фільтр питань\n\n"
        "Статус — quarantined / pending / approved. Тема — themeId. "
        "Тип проблеми — duplicate, unclear_reference тощо. Бал — qualityScore 0–100.\n\n"
        "Не запускає скрипт — лише фільтрує завантажений звіт."
    ),
    "question-edit": (
        "Редагування питання\n\n"
        "Зміни text, варіанти, correctIndex, reference, пояснення. "
        "Питання з question-db зберігаються одразу у JSON.\n\n"
        "Вбудовані (src/data/questions.ts) — лише перегляд; правки у IDE."
    ),
    "question-quarantine": (
        "Карантин питання\n\n"
        "✅ Схвалити — зняти з карантину (оновлює звіт). "
        "❌ Видалити — прибрати з question-db. "
        "✎ Редаг. — відкрити форму правок."
    ),
    "question-bulk-approve": (
        "Масове схвалення\n\n"
        "Застосовується до всіх питань поточного фільтра. "
        "Оновлює question-quality-report.json; для AI-питань знімає quarantined у JSON."
    ),
    "question-bulk-delete": (
        "Масове видалення\n\n"
        "AI-питання — видаляє з data/question-db. "
        "Вбудовані (questions.ts) — прибирає зі звіту якості (у TS файлах лишаються). "
        "Усі видалені ID потрапляють у excludedQuestionIds і не повертаються після «Перевірка якості»."
    ),
    "question-bulk-dedupe": (
        "Зняти дублікати\n\n"
        "У кожній групі схожих питань (duplicate) лишає одне з найвищим балом "
        "(перевага вбудованим). Решту видаляє з question-db або rejected у звіті."
    ),
    "question-bulk-ai": (
        "AI масова правка\n\n"
        "Ollama переписує/доповнює всі питання поточного фільтра: виправляє дублікати, "
        "додає посилання, підганяє складність. Зберігає у question-db і схвалює у звіті.\n\n"
        "Потрібен ollama serve. Триває ~30–60 с на питання."
    ),
    "question-goto-explanation": (
        "Пояснення питання\n\n"
        "Переходить на вкладку «Пояснення» з тим самим questionId — "
        "редагування short/deep, AI-генерація, оцінка якості пояснень."
    ),
    "analyze-explanations-tab": (
        "Аналіз пояснень\n\n"
        "Евристики для всіх питань: відсутність, довжина, дублювання відповіді, "
        "контекст Писання. Зберігає data/explanation-quality-report.json.\n\n"
        "Список нижче — клік для редагування та AI."
    ),
    "explanation-filter": (
        "Фільтр пояснень\n\n"
        "Покриття — missing / short_only / complete. Тема, тип проблеми, бал 0–100, "
        "джерело embedded або db.\n\n"
        "Не запускає скрипт — лише фільтрує звіт."
    ),
    "explanation-edit": (
        "Редактор пояснень\n\n"
        "Коротке (1–3 речення) і детальне (контекст для навчання). "
        "Збереження лише для question-db.\n\n"
        "AI: згенерувати, покращити або розширити deep."
    ),
    "explanation-bulk-ai": (
        "AI: пояснення для фільтра\n\n"
        "Ollama генерує або покращує пояснення для питань поточного фільтра "
        "(лише question-db). Не змінює текст питання.\n\n"
        "Потрібен ollama serve."
    ),
    "explanation-ai-score": (
        "AI-оцінка пояснень\n\n"
        "Ollama оцінює якість уже наявних пояснень (short/deep) — точність, "
        "зрозумілість, навчальна цінність.\n\n"
        "Ліміт — поле «AI ліміт» (скільки питань за один запуск). "
        "Питання без пояснення (missing) пропускаються. "
        "Вже оцінені (є aiScore у звіті) не повторюються.\n\n"
        "Потрібен ollama serve. Спочатку «Аналіз пояснень»."
    ),
    "topic-gen-one": (
        "Питання для обраної теми\n\n"
        "Генерує вказану кількість питань для теми з комбобокса (поточний вузол "
        "ієрархії). Записує у question-db.\n\n"
        "Складність: easy / medium / hard / all."
    ),
    "topic-gen-children": (
        "Питання для всіх підтем\n\n"
        "Для кожної дочірньої підтеми обраного вузла запускає generate-ai. "
        "Якщо підтем >10 — попросить підтвердження.\n\n"
        "Тривало при глибокому дереві."
    ),
    "topic-gen-categories": (
        "Категорії теми\n\n"
        "Запускає generate-topics лише для файлу поточної теми (file_id). "
        "Допомагає розгорнути гілку ієрархії.\n\n"
        "Не генерує питання — лише структуру topics-db."
    ),
    "topic-edit": (
        "Редагування теми\n\n"
        "Ручна зміна іконки, назви та опису вузла в topics-db JSON. "
        "Збереження одразу в файл.\n\n"
        "Для масових змін краще AI-кнопки нижче."
    ),
    "topic-balance": (
        "Баланс вузла\n\n"
        "Переходить на вкладку «Питання» → «Вирівнювання підтем» з підставленим "
        "Node ID обраної теми.\n\n"
        "Далі — превʼю або застосування балансу."
    ),
    "ai-improve-desc": (
        "AI: покращити опис\n\n"
        "Ollama переписує description вузла: чіткіше, коротше, у стилі інших тем. "
        "Зміни в topics-db після підтвердження скрипта.\n\n"
        "Потрібен ollama serve."
    ),
    "ai-suggest-icon": (
        "AI: підібрати іконку\n\n"
        "Пропонує emoji-іконку за назвою та описом теми. "
        "Оновлює поле icon у JSON.\n\n"
        "Можна відредагувати вручну через «Редаг.»."
    ),
    "ai-add-children": (
        "AI: додати підтеми\n\n"
        "Генерує 3 нові дочірні вузли з id, назвою, описом і іконкою. "
        "Доповнює ієрархію там, де бракує глибини.\n\n"
        "Перевірте дублікати id після запуску."
    ),
    "ai-organize-children": (
        "AI: сортувати дітей\n\n"
        "Пропонує логічний порядок і групування наявних підтем під батьком. "
        "Може змінити порядок children у JSON.\n\n"
        "Зробіть backup перед застосуванням."
    ),
    "ai-improve-all": (
        "AI: покращити все\n\n"
        "Комплексне оновлення вузла: опис, іконка, можливо підтеми (--count 3). "
        "Одна команда замість кількох окремих.\n\n"
        "Найповільніший варіант AI-редагування."
    ),
    "ai-delete-node": (
        "Видалити вузол\n\n"
        "Назавжди прибирає тему та її піддерево з topics-db. "
        "Питання в question-db не видаляються автоматично.\n\n"
        "Потребує підтвердження — операція незворотна."
    ),
    "ai-provider": (
        "Провайдер AI\n\n"
        "Ollama — локально (ollama serve).\n"
        "Gemini — Google AI Studio (GEMINI_API_KEY). "
        "При 429 (free tier) скрипти автоматично чекають і повторюють запит — "
        "питання не пропускаються.\n"
        "OmniRoute — локальний шлюз OpenAI API (localhost:20128).\n\n"
        "Усі npm/node AI-команди отримують --provider та --model."
    ),
    "ollama-check": (
        "Перевірити Ollama\n\n"
        "Запит до http://localhost:11434/api/tags — чи працює ollama serve "
        "і які моделі завантажені.\n\n"
        "Статус також у шапці launcher."
    ),
    "ollama-model": (
        "Модель\n\n"
        "Список залежить від провайдера: Ollama /api/tags, OmniRoute /v1/models, "
        "Gemini — пресети.\n\n"
        "«Застосувати» зберігає AI_PROVIDER та AI_MODEL у .env."
    ),
    "gemini-check": (
        "Перевірити Gemini\n\n"
        "Потрібен GEMINI_API_KEY у .env (Google AI Studio). "
        "Тестовий запит до Generative Language API.\n\n"
        "Free tier (~20 req/min): при ліміті в консолі зʼявиться "
        "«⏳ Gemini rate limit — очікування …s» — запит повториться автоматично."
    ),
    "omniroute-check": (
        "Перевірити OmniRoute\n\n"
        "Локальний шлюз (типово http://localhost:20128/v1). "
        "Ключ з дашборду OmniRoute → Endpoints → OMNIROUTE_API_KEY."
    ),
}


class HelpTooltip:
    """Спливаюча підказка при наведенні на ?."""

    _tip_window = None

    def __init__(self, widget, text):
        self.widget = widget
        self.text = text
        widget.bind("<Enter>", self._show, add="+")
        widget.bind("<Leave>", self._hide, add="+")
        widget.bind("<ButtonPress>", self._hide, add="+")

    @classmethod
    def _destroy(cls):
        if cls._tip_window:
            cls._tip_window.destroy()
            cls._tip_window = None

    def _show(self, _event=None):
        self._destroy()
        if not self.text:
            return
        self.widget.update_idletasks()
        x = self.widget.winfo_rootx() + self.widget.winfo_width() + 6
        y = self.widget.winfo_rooty() - 4
        tip = tk.Toplevel(self.widget)
        tip.wm_overrideredirect(True)
        tip.wm_attributes("-topmost", True)
        dark = ctk.get_appearance_mode() == "Dark"
        bg = "#2d333b" if dark else "#ffffff"
        fg = "#e6edf3" if dark else "#1f2328"
        border = "#58a6ff"
        frame = tk.Frame(tip, bg=border, bd=0)
        frame.pack(fill="both", expand=True)
        inner = tk.Frame(frame, bg=bg, bd=0)
        inner.pack(fill="both", expand=True, padx=1, pady=1)
        lbl = tk.Label(
            inner,
            text=self.text,
            justify="left",
            bg=bg,
            fg=fg,
            font=("Segoe UI", 11),
            wraplength=400,
            padx=12,
            pady=10,
        )
        lbl.pack()
        tip.update_idletasks()
        sw = tip.winfo_screenwidth()
        sh = tip.winfo_screenheight()
        tw = tip.winfo_width()
        th = tip.winfo_height()
        if x + tw > sw - 8:
            x = self.widget.winfo_rootx() - tw - 6
        if y + th > sh - 8:
            y = max(8, sh - th - 8)
        tip.wm_geometry(f"+{x}+{y}")
        HelpTooltip._tip_window = tip

    def _hide(self, _event=None):
        self._destroy()


def _win_force_show(window):
    """Ensure the CTk top-level window is mapped and painted (Windows pythonw quirk)."""
    try:
        window.update_idletasks()
        window.state("normal")
        window.deiconify()
        window.lift()
    except Exception:
        pass
    if os.name != "nt":
        return
    try:
        import ctypes

        hwnd = window.winfo_id()
        if hwnd:
            user32 = ctypes.windll.user32
            user32.ShowWindow(hwnd, 9)  # SW_RESTORE
            user32.ShowWindow(hwnd, 5)  # SW_SHOW
    except Exception:
        pass


def _port_holder_pid():
    if os.name != "nt":
        return None
    flags = getattr(subprocess, "CREATE_NO_WINDOW", 0)
    try:
        out = subprocess.check_output(
            [
                "powershell",
                "-NoProfile",
                "-Command",
                f"(Get-NetTCPConnection -LocalPort {INSTANCE_PORT} -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1).OwningProcess",
            ],
            text=True,
            timeout=5,
            creationflags=flags,
        ).strip()
        return int(out) if out.isdigit() else None
    except Exception:
        return None


def _launcher_window_visible(pid):
    if os.name != "nt" or not pid:
        return False
    try:
        import ctypes
        from ctypes import wintypes

        user32 = ctypes.windll.user32
        found = []

        @ctypes.WINFUNCTYPE(ctypes.c_bool, wintypes.HWND, wintypes.LPARAM)
        def cb(hwnd, _):
            proc_id = wintypes.DWORD()
            user32.GetWindowThreadProcessId(hwnd, ctypes.byref(proc_id))
            if proc_id.value != pid:
                return True
            length = user32.GetWindowTextLengthW(hwnd)
            buf = ctypes.create_unicode_buffer(length + 1)
            user32.GetWindowTextW(hwnd, buf, length + 1)
            if buf.value in (APP_NAME,) + LEGACY_APP_TITLES:
                found.append(bool(user32.IsWindowVisible(hwnd)))
            return True

        user32.EnumWindows(cb, 0)
        return bool(found and found[0])
    except Exception:
        return False


def _kill_pid(pid):
    if not pid:
        return
    if os.name == "nt":
        flags = getattr(subprocess, "CREATE_NO_WINDOW", 0)
        subprocess.run(
            ["taskkill", "/F", "/T", "/PID", str(pid)],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=flags,
        )
    else:
        try:
            os.kill(pid, 9)
        except OSError:
            pass


def _try_reclaim_stale_instance():
    """Drop invisible zombie launcher that still holds the single-instance port."""
    pid = _port_holder_pid()
    if not pid or _launcher_window_visible(pid):
        return
    _kill_pid(pid)
    import time

    time.sleep(0.4)


def _acquire_single_instance():
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    try:
        sock.bind(("127.0.0.1", INSTANCE_PORT))
        sock.listen(1)
        return sock
    except OSError:
        sock.close()
        return None


def _kill_process_tree(proc):
    if not proc or proc.poll() is not None:
        return
    if os.name == "nt":
        flags = getattr(subprocess, "CREATE_NO_WINDOW", 0)
        subprocess.run(
            ["taskkill", "/F", "/T", "/PID", str(proc.pid)],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=flags,
        )
    else:
        proc.terminate()
        try:
            proc.wait(timeout=3)
        except subprocess.TimeoutExpired:
            proc.kill()


def _windows_full_path():
    """PATH для pythonw: додати користувацький PATH з реєстру (Node/npm часто лише там)."""
    if os.name != "nt":
        return os.environ.get("PATH", "")
    parts = [os.environ.get("PATH", "")]
    try:
        import winreg
        for root, subkey, name in (
            (winreg.HKEY_CURRENT_USER, r"Environment", "Path"),
            (winreg.HKEY_LOCAL_MACHINE, r"SYSTEM\CurrentControlSet\Control\Session Manager\Environment", "Path"),
        ):
            try:
                with winreg.OpenKey(root, subkey) as key:
                    val, _ = winreg.QueryValueEx(key, name)
                    if val:
                        parts.append(val)
            except OSError:
                pass
    except ImportError:
        pass
    merged = []
    seen = set()
    for chunk in parts:
        for item in chunk.split(os.pathsep):
            item = item.strip()
            if item and item not in seen:
                seen.add(item)
                merged.append(item)
    return os.pathsep.join(merged)


def _subprocess_env():
    env = dict(os.environ)
    if os.name == "nt":
        env["PATH"] = _windows_full_path()
    return env


def _resolve_executable(name):
    """node / npm / npm.cmd — з повним PATH."""
    path = _subprocess_env().get("PATH", "")
    found = shutil.which(name, path=path)
    if found:
        return found
    if os.name == "nt" and not name.lower().endswith(".cmd"):
        return shutil.which(name + ".cmd", path=path)
    return None


def _popen_kwargs(cwd, shell=True, env=None):
    kw = dict(
        shell=shell,
        cwd=cwd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace",
        bufsize=1,
        env=env if env is not None else _subprocess_env(),
    )
    if os.name == "nt":
        kw["creationflags"] = getattr(subprocess, "CREATE_NO_WINDOW", 0)
    return kw


def _popen_argv(cwd, env=None):
    """Запуск без shell — коректно для шляхів з пробілами."""
    return _popen_kwargs(cwd, shell=False, env=env)

THEME_IDS = [
    "geography", "old-testament", "mosaic-law", "judges", "kings", "prophets",
    "psalms", "patriarchs", "commandments", "new-testament", "gospels", "paul",
    "parables", "miracles", "revelation",
]

THEMES_DICT = {
    "old-testament": "Старий Завіт", "mosaic-law": "Закон Мойсея", "judges": "Судді",
    "kings": "Царі", "prophets": "Пророки", "psalms": "Псалми", "patriarchs": "Патріархи",
    "geography": "Географія СЗ", "geography-nt": "Географія НЗ", "commandments": "Десять заповідей",
    "new-testament": "Новий Завіт", "gospels": "Євангелія", "paul": "Апостол Павло",
    "parables": "Притчі", "miracles": "Чудеса Ісуса", "revelation": "Відкриття",
}

GROUPS_CONF = {
    "old-testament": {
        "title": "Старий Завіт",
        "theme_ids": [
            "old-testament", "mosaic-law", "judges", "kings", "prophets",
            "psalms", "patriarchs", "geography", "commandments",
        ],
    },
    "new-testament": {
        "title": "Новий Завіт",
        "theme_ids": [
            "new-testament", "gospels", "paul", "parables", "miracles", "revelation", "geography-nt",
        ],
    },
}

DIFFICULTIES = [
    ("all", "Усі рівні"), ("baby", "👶 Немовля"), ("child", "🧒 Дитина"),
    ("youth", "🧑 Юнак"), ("student", "🎓 Учень"), ("preacher", "📖 Проповідник"),
    ("teacher", "👨‍🏫 Учитель"), ("theologian", "⛪ Богослов"),
]

DIFFICULTY_LEVEL_IDS = [d[0] for d in DIFFICULTIES if d[0] != "all"]

CONVEYOR_CONTAINER_THEMES = frozenset({"old-testament", "new-testament"})

COVENANT_TITLES = {
    "old-testament": "Старий Завіт",
    "new-testament": "Новий Завіт",
}

SEMANTIC = {
    "dark": {
        "green": "#3fb950", "orange": "#d29922", "red": "#f85149",
        "purple": "#bc8cff", "cyan": "#58a6ff", "dim": "#adb6c2",
        "text_bg": "#161b22", "text_fg": "#f0f6fc",
    },
    "light": {
        "green": "#1a7f37", "orange": "#9a6700", "red": "#cf222e",
        "purple": "#8250df", "cyan": "#0550ae", "dim": "#57606a",
        "text_bg": "#ffffff", "text_fg": "#1f2328",
    },
}

# Поверхні UI — явні пари (light, dark) для CustomTkinter
UI = {
    "content_bg": ("#f4f6f8", "#1c2128"),
    "card_bg": ("#ffffff", "#252b33"),
    "card_border": ("#d0d7de", "#3d444d"),
    "heading_fg": ("#24292f", "#f0f6fc"),
    "body_fg": ("#424a53", "#c9d1d9"),
    "sash_bg": ("#c8cdd3", "#30363d"),
    "seg_bg": ("#e8ecef", "#2b3038"),
    "seg_selected": ("#ffffff", "#343b44"),
    "seg_unselected": ("#dde2e8", "#252b33"),
    "help_bg": ("#c8cdd3", "#3d444d"),
    "help_hover": ("#b0b8c1", "#545d68"),
    "help_fg": ("#24292f", "#f0f6fc"),
    "muted_btn": ("#e8ecef", "#343b44"),
    "muted_btn_text": ("#24292f", "#e6edf3"),
}

TAB_REGISTRY = [
    ("Питання", "tab_questions", "_build_tab_questions"),
    ("Теми", "tab_themes", "_build_tab_themes"),
    ("Конвеєр", "tab_conveyor", "_build_tab_conveyor"),
    ("Перегляд", "tab_preview", "_build_tab_preview"),
    ("Якість тем", "tab_quality", "_build_tab_quality"),
    ("Якість пит.", "tab_q_quality", "_build_tab_question_quality"),
    ("Пояснення", "tab_explanations", "_build_tab_explanations"),
    ("Налаштування", "tab_settings", "_build_tab_settings"),
]
TAB_BY_NAME = {name: (attr, builder) for name, attr, builder in TAB_REGISTRY}


def _load_json(path):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None


def _save_json(path, data):
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return True
    except Exception:
        return False


def _read_env(env_path):
    env = {}
    if not os.path.isfile(env_path):
        return env
    try:
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, _, v = line.partition("=")
                env[k.strip()] = v.strip().strip('"').strip("'")
    except Exception:
        pass
    return env


def _write_env_var(env_path, key, value):
    lines = []
    found = False
    if os.path.isfile(env_path):
        try:
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    if line.strip().startswith("{0}=".format(key)):
                        lines.append("{0}={1}\n".format(key, value))
                        found = True
                    else:
                        lines.append(line)
        except Exception:
            lines = []
    if not found:
        if lines and not lines[-1].endswith("\n"):
            lines.append("\n")
        lines.append("{0}={1}\n".format(key, value))
    try:
        with open(env_path, "w", encoding="utf-8") as f:
            f.writelines(lines)
        return True
    except Exception:
        return False


def _flatten_nodes(node, depth=0, file_id="", parent_id=None):
    if not node:
        return []
    result = [(node, depth, file_id, parent_id)]
    node_id = node.get("id")
    for child in node.get("children", []):
        result.extend(_flatten_nodes(child, depth + 1, file_id, node_id))
    return result


class AiLauncherV3(ctk.CTk):
    def __init__(self):
        super().__init__()
        self.title(APP_NAME)
        self.geometry("1020x720")
        self.minsize(800, 560)

        self.script_dir = os.path.dirname(os.path.abspath(__file__))
        self.project_root = os.path.normpath(os.path.join(self.script_dir, ".."))
        self.topics_dir = os.path.join(self.project_root, "data", "topics-db")
        self.report_path = os.path.join(self.project_root, "data", "topics-quality-report.json")
        self.question_report_path = os.path.join(self.project_root, "question-quality-report.json")
        self.explanation_report_path = os.path.join(
            self.project_root, "data", "explanation-quality-report.json",
        )
        self.questions_db_dir = os.path.join(self.project_root, "data", "question-db")

        self.env = _read_env(os.path.join(self.project_root, ".env"))
        self.env_path = os.path.join(self.project_root, ".env")
        self.ai_provider = (self.env.get("AI_PROVIDER") or "ollama").strip().lower()
        if self.ai_provider not in AI_PROVIDERS:
            self.ai_provider = "ollama"
        self.ai_model = (
            self.env.get("AI_MODEL")
            or self.env.get("OLLAMA_MODEL")
            or self.env.get("GEMINI_MODEL")
            or self.env.get("OMNIROUTE_MODEL")
            or "mistral"
        )
        self.ollama_model = self.ai_model
        self.ollama_host = self.env.get("OLLAMA_HOST", "localhost")
        self.ollama_port = self.env.get("OLLAMA_PORT", "11434")
        self.gemini_api_key = self.env.get("GEMINI_API_KEY", "")
        self.gemini_model = self.env.get("GEMINI_MODEL", "gemini-3.1-flash-lite")
        self.omniroute_base = self.env.get("OMNIROUTE_BASE_URL", "http://localhost:20128/v1").rstrip("/")
        self.omniroute_api_key = self.env.get("OMNIROUTE_API_KEY", "")
        self.omniroute_model = self.env.get("OMNIROUTE_MODEL", "google/gemini-2.0-flash")
        self._ollama_models = []
        self._omniroute_models = []

        self.process = None
        self._stop_requested = False
        self._topic_results = []
        self._topic_click_map = {}
        self._console_collapsed = False
        self._console_height = 260
        self._console_saved_height = 260
        self._console_min_height = 90
        self._top_min_height = 180
        self._sash_drag = {"start_y": 0, "start_h": 0}
        self._top_split = 0.68
        self._quality_cache_loaded = False
        self._quality_list_job = None
        self._question_results = []
        self._questions_by_id = {}
        self._question_click_map = {}
        self._qq_filtered_rows = []
        self._question_quality_cache_loaded = False
        self._question_list_job = None
        self._question_analysis_running = False
        self._explanation_results = []
        self._explanation_click_map = {}
        self._eq_filtered_rows = []
        self._explanation_quality_cache_loaded = False
        self._explanation_list_job = None
        self._explanation_analysis_running = False
        self._pending_explanation_qid = None
        self._conveyor_session_path = os.path.join(
            self.project_root, "data", "topic-conveyor-session.json",
        )
        self._conveyor = None
        self._conveyor_busy = False
        self._conveyor_review_rows = []
        self._conveyor_review_mode = None
        self._conveyor_branch_title_entry = None
        self._conveyor_cfg_widgets = []
        self._conveyor_avoid_titles = []
        self._conveyor_in_activity = False
        self._conveyor_preview_anchor = None
        self._preview_index_path = os.path.join(
            self.project_root, "data", "topic-preview-index.json",
        )
        self._preview_index = None
        self._preview_tree = None
        self._preview_tree_iid_map = {}
        self._preview_node_by_iid = {}
        self._preview_busy = False
        self._analysis_running = False
        self._shutting_down = False
        self._action_card_row = 0
        self._action_card_col = 0
        self._scroll_frames = []
        self._spinboxes = []
        self._help_buttons = []
        self._tabs_built = set()
        self._questions_index_loading = False
        self._questions_index_callbacks = []

        self.protocol("WM_DELETE_WINDOW", self._on_close)

        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(0, weight=0)
        self._boot_label = ctk.CTkLabel(
            self,
            text="⏳  Завантаження {0}…".format(APP_NAME),
            font=FONT_TITLE,
        )
        self._boot_label.grid(row=0, column=0)
        _win_force_show(self)
        self.update()
        self.after(0, self._finish_init)

    def _finish_init(self):
        try:
            self._boot_label.destroy()
        except Exception:
            pass
        self._build_ui()
        _win_force_show(self)
        self._ensure_tab_built("Налаштування")
        threading.Thread(target=self._check_active_provider, daemon=True).start()
        self.after(0, lambda: self._ensure_tab_built(self.tabview.get()))
        self.after(50, self._bring_to_front)
        self.after(250, lambda: _win_force_show(self))
        self.after(400, self._warmup_idle_tabs)

    def _ensure_tab_built(self, tab_name):
        if tab_name in self._tabs_built:
            return
        spec = TAB_BY_NAME.get(tab_name)
        if not spec:
            return
        attr, builder_name = spec
        parent = getattr(self, attr, None)
        if parent is None:
            return
        getattr(self, builder_name)(parent)
        self._tabs_built.add(tab_name)

    def _warmup_idle_tabs(self):
        if self._shutting_down:
            return
        current = self.tabview.get() if hasattr(self, "tabview") else ""
        for name, _, _ in TAB_REGISTRY:
            if name not in self._tabs_built and name != current:
                self._ensure_tab_built(name)
                self.after(120, self._warmup_idle_tabs)
                return

    def _bring_to_front(self):
        _win_force_show(self)
        try:
            self.attributes("-topmost", True)
            self.after(400, lambda: self.attributes("-topmost", False))
            self.focus_force()
        except Exception:
            pass

    def _on_close(self):
        if self.process and self.process.poll() is None:
            if not messagebox.askokcancel(
                "Закрити",
                "Команда ще виконується.\nЗупинити її і закрити launcher?",
            ):
                return
        self._shutdown()

    def _shutdown(self):
        if self._shutting_down:
            return
        self._shutting_down = True

        if self._quality_list_job:
            try:
                self.after_cancel(self._quality_list_job)
            except Exception:
                pass
            self._quality_list_job = None
        if self._question_list_job:
            try:
                self.after_cancel(self._question_list_job)
            except Exception:
                pass
            self._question_list_job = None
        self._questions_index_callbacks = []
        self._questions_index_loading = False

        _kill_process_tree(self.process)
        self.process = None

        try:
            self.quit()
        except Exception:
            pass
        try:
            self.destroy()
        except Exception:
            pass

    # ── Theme helpers ───────────────────────────────────────────────────────

    def _semantic(self):
        mode = ctk.get_appearance_mode()
        return SEMANTIC["dark"] if mode == "Dark" else SEMANTIC["light"]

    def _set_theme(self, value):
        mapping = {"System": "system", "Dark": "dark", "Light": "light"}
        ctk.set_appearance_mode(mapping.get(value, "system"))
        self._setup_tags()
        self._refresh_text_widgets()
        self._apply_theme_surfaces()

    def _style_tabview(self):
        if not hasattr(self, "tabview"):
            return
        seg = self.tabview._segmented_button
        self.tabview.configure(fg_color=UI["content_bg"])
        seg.configure(
            fg_color=UI["seg_bg"],
            selected_color=UI["seg_selected"],
            selected_hover_color=UI["seg_selected"],
            unselected_color=UI["seg_unselected"],
            unselected_hover_color=UI["seg_unselected"],
            text_color=UI["heading_fg"],
        )
        for name in self.tabview._name_list:
            self.tabview.tab(name).configure(fg_color="transparent")

    def _style_spinbox(self, sb):
        s = self._semantic()
        dark = ctk.get_appearance_mode() == "Dark"
        border = UI["card_border"][1 if dark else 0]
        sb.configure(
            bg=s["text_bg"],
            fg=s["text_fg"],
            insertbackground=s["cyan"],
            highlightbackground=border,
            highlightcolor=s["cyan"],
            disabledbackground=s["text_bg"],
        )

    def _apply_theme_surfaces(self):
        self._style_tabview()
        for frame in self._scroll_frames:
            try:
                frame.configure(fg_color=UI["content_bg"])
            except Exception:
                pass
        if hasattr(self, "_sash"):
            dark = ctk.get_appearance_mode() == "Dark"
            self._sash.configure(bg=UI["sash_bg"][1 if dark else 0])
        for sb in self._spinboxes:
            self._style_spinbox(sb)
        for btn in self._help_buttons:
            try:
                btn.configure(fg_color=UI["help_bg"], hover_color=UI["help_hover"], text_color=UI["help_fg"])
            except Exception:
                pass
        if hasattr(self, "theme_seg"):
            self.theme_seg.configure(
                fg_color=UI["seg_bg"],
                selected_color=UI["seg_selected"],
                selected_hover_color=UI["seg_selected"],
                unselected_color=UI["seg_unselected"],
                unselected_hover_color=UI["seg_unselected"],
                text_color=UI["heading_fg"],
            )
        if hasattr(self, "ollama_badge"):
            self.ollama_badge.configure(fg_color=UI["seg_unselected"], text_color=UI["body_fg"])

    def _refresh_text_widgets(self):
        s = self._semantic()
        if getattr(self, "_console_text", None):
            self._console_text.configure(bg=s["text_bg"], fg=s["text_fg"], insertbackground=s["cyan"])
        self._setup_quality_tags()

    def _setup_quality_tags(self, text_widget=None):
        widget = text_widget
        if widget is None and hasattr(self, "q_text"):
            widget = self.q_text
        if not widget:
            return
        s = self._semantic()
        for tag, color in [
            ("red", s["red"]), ("orange", s["orange"]), ("green", s["green"]),
            ("cyan", s["cyan"]), ("dim", s["dim"]),
        ]:
            widget.tag_config(tag, foreground=color)

    # ── UI shell ────────────────────────────────────────────────────────────

    def _build_ui(self):
        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(0, weight=0)
        self.grid_rowconfigure(1, weight=1)
        self.grid_rowconfigure(2, weight=0)

        self._build_header()
        self._build_main_pane()
        self._build_status_bar()
        self.after(0, self._apply_theme_surfaces)

    def _build_header(self):
        hdr = ctk.CTkFrame(self, fg_color="transparent")
        hdr.grid(row=0, column=0, sticky="ew", padx=16, pady=(8, 4))
        hdr.grid_columnconfigure(1, weight=1)

        ctk.CTkLabel(hdr, text="⬡  {0}".format(APP_NAME), font=FONT_TITLE).grid(row=0, column=0, sticky="w")

        self.ollama_badge = ctk.CTkLabel(
            hdr, text="AI: перевірка…", font=FONT_SM,
            fg_color=UI["seg_unselected"], text_color=UI["body_fg"],
            corner_radius=6, padx=12, pady=6,
        )
        self.ollama_badge.grid(row=0, column=1, padx=16, sticky="w")

        self.theme_seg = ctk.CTkSegmentedButton(
            hdr, values=["System", "Dark", "Light"], command=self._set_theme,
            width=260, height=CTRL_H, font=FONT_SM,
            fg_color=UI["seg_bg"],
            selected_color=UI["seg_selected"],
            selected_hover_color=UI["seg_selected"],
            unselected_color=UI["seg_unselected"],
            unselected_hover_color=UI["seg_unselected"],
            text_color=UI["heading_fg"],
        )
        self.theme_seg.set("System")
        self.theme_seg.grid(row=0, column=2, sticky="e")

    def _build_main_pane(self):
        self._main_stack = ctk.CTkFrame(self, fg_color="transparent")
        self._main_stack.grid(row=1, column=0, sticky="nsew", padx=12, pady=(0, 2))
        self._main_stack.grid_columnconfigure(0, weight=1)
        self._main_stack.grid_rowconfigure(0, weight=1)
        self._main_stack.grid_rowconfigure(1, weight=0)
        self._main_stack.grid_rowconfigure(2, weight=0, minsize=self._console_height)
        self._main_stack.bind("<Configure>", self._on_main_stack_configure)

        pane_bg = UI["sash_bg"][1 if ctk.get_appearance_mode() == "Dark" else 0]

        self.top_pane = ctk.CTkFrame(self._main_stack, fg_color="transparent")
        self.top_pane.grid(row=0, column=0, sticky="nsew")

        self._sash = tk.Frame(self._main_stack, height=6, cursor="size_ns", bg=pane_bg)
        self._sash.grid(row=1, column=0, sticky="ew")
        self._sash.bind("<Button-1>", self._sash_press)
        self._sash.bind("<B1-Motion>", self._sash_motion)
        self._sash.bind("<ButtonRelease-1>", self._sash_release)
        self._sash.bind("<Enter>", lambda e: self._sash.configure(bg="#58a6ff"))
        self._sash.bind("<Leave>", lambda e: self._sash_leave())

        self.bottom_pane = ctk.CTkFrame(self._main_stack, fg_color="transparent")
        self.bottom_pane.grid(row=2, column=0, sticky="nsew")

        self.top_pane.grid_columnconfigure(0, weight=1)
        self.top_pane.grid_rowconfigure(0, weight=1)

        self.tabview = ctk.CTkTabview(self.top_pane, fg_color=UI["content_bg"])
        self.tabview._segmented_button.configure(font=FONT_TAB, height=CTRL_H)
        self.tabview.grid(row=0, column=0, sticky="nsew", padx=2, pady=(0, 2))
        self._hook_tabview()

        self.tab_questions = self.tabview.add("Питання")
        self.tab_themes = self.tabview.add("Теми")
        self.tab_conveyor = self.tabview.add("Конвеєр")
        self.tab_preview = self.tabview.add("Перегляд")
        self.tab_quality = self.tabview.add("Якість тем")
        self.tab_q_quality = self.tabview.add("Якість пит.")
        self.tab_explanations = self.tabview.add("Пояснення")
        self.tab_settings = self.tabview.add("Налаштування")

        for tab in (
            self.tab_questions, self.tab_themes, self.tab_conveyor, self.tab_preview,
            self.tab_quality, self.tab_q_quality, self.tab_explanations, self.tab_settings,
        ):
            tab.grid_columnconfigure(0, weight=1)
            tab.grid_rowconfigure(0, weight=1)

        self._build_console(self.bottom_pane)
        self._style_tabview()
        self.after(80, self._set_initial_pane_ratio)

    def _max_console_height(self):
        stack_h = self._main_stack.winfo_height()
        if stack_h <= 0:
            return self._console_height
        return max(self._console_min_height, stack_h - self._top_min_height - self._sash.winfo_height())

    def _apply_console_height(self):
        if self._console_collapsed:
            self._sash.grid_remove()
            h = 36
        else:
            self._sash.grid()
            h = self._console_height
        self._main_stack.grid_rowconfigure(2, minsize=h)

    def _on_main_stack_configure(self, event=None):
        if self._console_collapsed or self._sash_drag.get("active"):
            return
        max_h = self._max_console_height()
        if self._console_height > max_h:
            self._console_height = max_h
            self._apply_console_height()

    def _sash_press(self, event):
        if self._console_collapsed:
            return
        self._sash_drag["start_y"] = event.y_root
        self._sash_drag["start_h"] = self._console_height
        self._sash_drag["active"] = True

    def _sash_motion(self, event):
        if self._console_collapsed or not self._sash_drag.get("active"):
            return
        delta = event.y_root - self._sash_drag["start_y"]
        max_h = self._max_console_height()
        new_h = int(max(self._console_min_height, min(max_h, self._sash_drag["start_h"] - delta)))
        if new_h == self._console_height:
            return
        self._console_height = new_h
        self._apply_console_height()

    def _sash_leave(self, _event=None):
        if not hasattr(self, "_sash"):
            return
        dark = ctk.get_appearance_mode() == "Dark"
        self._sash.configure(bg=UI["sash_bg"][1 if dark else 0])

    def _sash_release(self, event):
        self._sash_drag["active"] = False
        stack_h = self._main_stack.winfo_height()
        if stack_h > 0:
            self._top_split = max(0.25, min(0.85, 1.0 - (self._console_height / stack_h)))

    def _set_initial_pane_ratio(self):
        if self._console_collapsed:
            return
        self.update_idletasks()
        stack_h = self._main_stack.winfo_height()
        if stack_h < self._top_min_height + self._console_min_height:
            self.after(50, self._set_initial_pane_ratio)
            return
        self._console_height = max(
            self._console_min_height,
            min(self._max_console_height(), int(stack_h * (1.0 - self._top_split))),
        )
        self._apply_console_height()

    def _hook_tabview(self):
        seg = self.tabview._segmented_button
        original = seg._command

        def on_tab(name):
            if original:
                original(name)
            self._on_tab_selected(name)

        seg.configure(command=on_tab)

    def _on_tab_selected(self, name):
        self._ensure_tab_built(name)
        self._hide_quality_actions()
        self._hide_question_actions()
        self._hide_explanation_actions()
        if name == "Якість тем":
            self.after(1, self._ensure_quality_cached)
        elif name == "Якість пит.":
            self.after(1, self._ensure_question_quality_cached)
        elif name == "Пояснення":
            self.after(1, self._ensure_explanation_quality_cached)

    def _build_status_bar(self):
        sb = ctk.CTkFrame(self, fg_color="transparent", height=36)
        sb.grid(row=2, column=0, sticky="ew", padx=16, pady=(0, 8))
        sb.grid_columnconfigure(1, weight=1)

        self.status_dot = ctk.CTkLabel(sb, text="●", font=("Segoe UI", 14), text_color=self._semantic()["green"])
        self.status_dot.grid(row=0, column=0, padx=(0, 4))

        self.status_var = tk.StringVar(value="Готовий")
        ctk.CTkLabel(sb, textvariable=self.status_var, font=FONT_SM, text_color=TEXT_MUTED).grid(row=0, column=1, sticky="w")

        self.stop_btn = ctk.CTkButton(
            sb, text="⏹  Зупинити", width=120, height=BTN_H, font=FONT_BTN,
            state="disabled", command=self._stop_process,
        )
        self.stop_btn.grid(row=0, column=2, sticky="e")

    def _build_console(self, parent):
        parent.grid_columnconfigure(0, weight=1)
        parent.grid_rowconfigure(1, weight=1)

        ch = ctk.CTkFrame(parent, fg_color="transparent")
        ch.grid(row=0, column=0, sticky="ew", padx=8, pady=(6, 2))
        ch.grid_columnconfigure(1, weight=1)

        ctk.CTkLabel(ch, text="ВИВІД", font=FONT_BTN, text_color=TEXT_MUTED).grid(row=0, column=0, sticky="w")

        btn_frame = ctk.CTkFrame(ch, fg_color="transparent")
        btn_frame.grid(row=0, column=2, sticky="e")
        ctk.CTkButton(btn_frame, text="▼ Згорнути", width=100, height=30, font=FONT_SM,
                      fg_color="transparent", text_color=TEXT_MUTED, hover_color=("gray80", "gray30"),
                      command=self._toggle_console).pack(side="left", padx=2)
        ctk.CTkButton(btn_frame, text="📋 Копіювати", width=110, height=30, font=FONT_SM,
                      fg_color="transparent", text_color=TEXT_MUTED, hover_color=("gray80", "gray30"),
                      command=self._copy_console_all).pack(side="left", padx=2)
        ctk.CTkButton(btn_frame, text="✕ Очистити", width=100, height=30, font=FONT_SM,
                      fg_color="transparent", text_color=TEXT_MUTED, hover_color=("gray80", "gray30"),
                      command=self._clear_console).pack(side="left")

        self.console_wrap = ctk.CTkFrame(parent, corner_radius=8,
                                         fg_color=UI["card_bg"], border_width=1,
                                         border_color=UI["card_border"])
        self.console_wrap.grid(row=1, column=0, sticky="nsew", padx=8, pady=(0, 8))
        self.console_wrap.grid_columnconfigure(0, weight=1)
        self.console_wrap.grid_rowconfigure(0, weight=1)

        s = self._semantic()
        self.console = ctk.CTkTextbox(
            self.console_wrap, font=FONT_MONO, wrap="word", activate_scrollbars=True,
        )
        self.console.grid(row=0, column=0, sticky="nsew", padx=2, pady=2)
        self._console_text = self.console._textbox
        self._console_text.configure(state="disabled")
        self._console_text.bind("<Control-c>", self._copy_selection)
        self._console_text.bind("<Control-C>", self._copy_selection)
        self._console_text.bind("<Button-3>", self._show_context_menu)
        self._setup_tags()

    def _toggle_console(self):
        if self._console_collapsed:
            self.console_wrap.grid()
            self._console_collapsed = False
            self._console_height = max(self._console_min_height, self._console_saved_height)
            self._apply_console_height()
        else:
            self._console_saved_height = self._console_height
            self.console_wrap.grid_remove()
            self._console_collapsed = True
            self._apply_console_height()

    def _expand_console(self):
        if self._console_collapsed:
            self._toggle_console()

    # ── Shared UI helpers ───────────────────────────────────────────────────

    def _help_button(self, parent, help_key):
        text = SCRIPT_HELP.get(help_key, "")
        btn = ctk.CTkButton(
            parent,
            text="?",
            width=26,
            height=26,
            font=("Segoe UI Semibold", 12),
            fg_color=UI["help_bg"],
            hover_color=UI["help_hover"],
            text_color=UI["help_fg"],
            corner_radius=13,
        )
        if text:
            HelpTooltip(btn, text)
        if not hasattr(self, "_help_buttons"):
            self._help_buttons = []
        self._help_buttons.append(btn)
        return btn

    def _scroll_area(self, parent):
        frame = ctk.CTkScrollableFrame(parent, fg_color=UI["content_bg"])
        frame.grid(row=0, column=0, sticky="nsew")
        frame.grid_columnconfigure(0, weight=1)
        frame.grid_columnconfigure(1, weight=1)
        self._scroll_frames.append(frame)
        return frame

    def _section(self, parent, title, colspan=2):
        lbl = ctk.CTkLabel(parent, text=title, font=FONT_H, anchor="w", text_color=UI["heading_fg"])
        lbl.grid(row=getattr(parent, "_next_row", 0), column=0, columnspan=colspan,
                 sticky="w", padx=4, pady=(8, 6))
        parent._next_row = getattr(parent, "_next_row", 0) + 1

    def _panel(self, parent, colspan=2):
        frame = ctk.CTkFrame(parent, corner_radius=8, border_width=1,
                             fg_color=UI["card_bg"], border_color=UI["card_border"])
        frame.grid(row=parent._next_row, column=0, columnspan=colspan, sticky="ew", padx=4, pady=4)
        parent._next_row += 1
        frame.grid_columnconfigure(0, weight=1)
        inner = ctk.CTkFrame(frame, fg_color="transparent")
        inner.pack(fill="x", padx=16, pady=12)
        inner.grid_columnconfigure(1, weight=1)
        return inner

    def _reset_action_grid(self, parent):
        parent._next_row = 0
        self._action_card_row = 0
        self._action_card_col = 0

    def _action_card(self, parent, title, description, hint, on_run, help_key=None):
        col = self._action_card_col
        row = self._action_card_row
        card = ctk.CTkFrame(parent, corner_radius=8, border_width=1,
                            fg_color=UI["card_bg"], border_color=UI["card_border"])
        card.grid(row=row, column=col, sticky="nsew", padx=4, pady=4)
        card.grid_columnconfigure(0, weight=1)

        title_row = ctk.CTkFrame(card, fg_color="transparent")
        title_row.pack(fill="x", padx=14, pady=(14, 4))
        ctk.CTkLabel(title_row, text=title, font=FONT_H, anchor="w",
                     text_color=UI["heading_fg"]).pack(side="left")
        if help_key:
            self._help_button(title_row, help_key).pack(side="left", padx=(6, 0))

        ctk.CTkLabel(card, text=description, font=FONT_SM, anchor="w",
                     wraplength=440, justify="left").pack(fill="x", padx=14, pady=(0, 4))
        ctk.CTkLabel(card, text=hint, font=FONT_HINT, text_color=TEXT_SUB, anchor="w").pack(fill="x", padx=14)

        btn_row = ctk.CTkFrame(card, fg_color="transparent")
        btn_row.pack(fill="x", padx=14, pady=(10, 14))
        ctk.CTkButton(btn_row, text="▶  Запустити", width=130, height=BTN_H,
                      font=FONT_BTN, command=on_run).pack(side="right")

        self._action_card_col += 1
        if self._action_card_col > 1:
            self._action_card_col = 0
            self._action_card_row += 1
            parent._next_row = max(parent._next_row, self._action_card_row)

    def _cmd_row(self, parent, label, hint, on_run, arg_builder=None, help_key=None):
        inner = self._panel(parent)
        title_row = ctk.CTkFrame(inner, fg_color="transparent")
        title_row.grid(row=0, column=0, columnspan=2, sticky="ew")
        ctk.CTkLabel(title_row, text=label, font=FONT_H, anchor="w",
                     text_color=UI["heading_fg"]).pack(side="left")
        if help_key:
            self._help_button(title_row, help_key).pack(side="left", padx=(6, 0))
        ctk.CTkLabel(inner, text=hint, font=FONT_HINT, text_color=TEXT_SUB, anchor="w").grid(
            row=1, column=0, columnspan=2, sticky="w", pady=(2, 8))
        btn_row = ctk.CTkFrame(inner, fg_color="transparent")
        btn_row.grid(row=2, column=0, columnspan=2, sticky="e")
        ctk.CTkButton(
            btn_row, text="▶  Запустити", width=130, height=BTN_H,
            command=lambda: on_run(arg_builder() if arg_builder else ""),
        ).pack(side="right")

    def _spinbox(self, parent, from_, to, width=6, default="0"):
        wrap = ctk.CTkFrame(parent, fg_color="transparent")
        sb = tk.Spinbox(wrap, from_=from_, to=to, width=width, font=FONT_SPIN,
                        relief="flat", bd=1, highlightthickness=1)
        sb.pack()
        sb.delete(0, "end")
        sb.insert(0, default)
        self._spinboxes.append(sb)
        self._style_spinbox(sb)
        return sb, wrap

    # ── Tab: Питання ────────────────────────────────────────────────────────

    def _build_tab_questions(self, parent):
        inner = self._scroll_area(parent)
        self._reset_action_grid(inner)

        self._section(inner, "📊 Статистика та аналіз")
        self._action_card_row = inner._next_row
        self._action_card(
            inner, "Статистика питань", "Кількість і розподіл по темах",
            "npm run questions:stats",
            lambda: self._run_npm("questions:stats", "", "📊 Статистика"),
            help_key="questions:stats",
        )
        self._action_card(
            inner, "Якість питань", "Аналіз якості — звіт на вкладці «Якість пит.»",
            "npm run analyze-quality",
            lambda: self._run_question_analysis(),
            help_key="analyze-quality",
        )
        self._action_card(
            inner, "Аналіз пулів", "Баланс пулів питань",
            "npm run analyze-pools",
            lambda: self._run_npm("analyze-pools", "", "📦 Пули"),
            help_key="analyze-pools",
        )
        self._action_card(
            inner, "Аудит Писання", "Перевірка посилань (потрібен server :3001)",
            "npm run scripture:audit",
            lambda: self._run_npm("scripture:audit", "", "📜 Аудит Писання"),
            help_key="scripture:audit",
        )
        inner._next_row = self._action_card_row + 1

        self._section(inner, "✨ Генерація AI-питань")
        gf = self._panel(inner)

        r1 = ctk.CTkFrame(gf, fg_color="transparent")
        r1.grid(row=0, column=0, columnspan=2, sticky="ew", pady=2)
        ctk.CTkLabel(r1, text="Тема:", font=FONT_SM, text_color=TEXT_MUTED, width=90).pack(side="left")
        self.gen_theme = ctk.CTkComboBox(r1, values=THEME_IDS, width=240, height=CTRL_H, font=FONT_DD)
        self.gen_theme.set("geography")
        self.gen_theme.pack(side="left", padx=4)

        r2 = ctk.CTkFrame(gf, fg_color="transparent")
        r2.grid(row=1, column=0, columnspan=2, sticky="ew", pady=2)
        ctk.CTkLabel(r2, text="Кількість:", font=FONT_SM, text_color=TEXT_MUTED, width=90).pack(side="left")
        self.gen_count, _ = self._spinbox(r2, 1, 500, 6, "30")
        _.pack(side="left", padx=4)
        ctk.CTkLabel(r2, text="Складність:", font=FONT_SM, text_color=TEXT_MUTED).pack(side="left", padx=(12, 4))
        self.gen_diff = ctk.CTkComboBox(r2, values=[d[0] for d in DIFFICULTIES], width=140, height=CTRL_H, font=FONT_DD)
        self.gen_diff.set("all")
        self.gen_diff.pack(side="left")

        r3 = ctk.CTkFrame(gf, fg_color="transparent")
        r3.grid(row=2, column=0, columnspan=2, sticky="ew", pady=2)
        ctk.CTkLabel(r3, text="Topic ID:", font=FONT_SM, text_color=TEXT_MUTED, width=90).pack(side="left")
        self.gen_topic = ctk.CTkEntry(r3, font=FONT_DD, height=CTRL_H)
        self.gen_topic.pack(side="left", fill="x", expand=True, padx=4)

        bf = ctk.CTkFrame(gf, fg_color="transparent")
        bf.grid(row=3, column=0, columnspan=2, sticky="ew", pady=(8, 0))
        for txt, mode, help_key in [
            ("Fill тема", "theme", "generate-ai-theme"),
            ("Fill усі", "all", "generate-ai-all"),
            ("Fill СЗ", "group_ot", "generate-ai-group_ot"),
            ("Підтема", "topic", "generate-ai-topic"),
        ]:
            cell = ctk.CTkFrame(bf, fg_color="transparent")
            cell.pack(side="left", padx=(0, 6))
            ctk.CTkButton(cell, text=txt, width=90, height=BTN_H, font=FONT_SM,
                          fg_color=UI["muted_btn"], text_color=UI["muted_btn_text"],
                          command=lambda m=mode: self._run_generate(m)).pack(side="left")
            self._help_button(cell, help_key).pack(side="left", padx=(2, 0))

        self._section(inner, "⚖ Вирівнювання підтем")
        bf2 = self._panel(inner)

        br1 = ctk.CTkFrame(bf2, fg_color="transparent")
        br1.grid(row=0, column=0, columnspan=2, sticky="ew", pady=2)
        ctk.CTkLabel(br1, text="Node / Theme:", font=FONT_SM, text_color=TEXT_MUTED, width=110).pack(side="left")
        self.bal_node = ctk.CTkEntry(br1, font=FONT_DD, height=CTRL_H)
        self.bal_node.pack(side="left", fill="x", expand=True, padx=4)

        br2 = ctk.CTkFrame(bf2, fg_color="transparent")
        br2.grid(row=1, column=0, columnspan=2, sticky="ew", pady=2)
        self.bal_scope = tk.StringVar(value="siblings")
        ctk.CTkRadioButton(br2, text="Прямі діти", variable=self.bal_scope, value="siblings", font=FONT_SM).pack(side="left")
        ctk.CTkRadioButton(br2, text="Усі листи", variable=self.bal_scope, value="leaves", font=FONT_SM).pack(side="left", padx=8)
        ctk.CTkLabel(br2, text="Ціль (0=max):", font=FONT_SM, text_color=TEXT_MUTED).pack(side="left", padx=(12, 4))
        self.bal_target, _ = self._spinbox(br2, 0, 500, 5, "0")
        _.pack(side="left")

        br3 = ctk.CTkFrame(bf2, fg_color="transparent")
        br3.grid(row=2, column=0, columnspan=2, sticky="ew", pady=(8, 0))
        for txt, cmd, help_key in [
            ("👁 Превʼю", lambda: self._run_balance(True), "balance-preview"),
            ("⚖ Вирівняти", lambda: self._run_balance(False), "balance-apply"),
        ]:
            cell = ctk.CTkFrame(br3, fg_color="transparent")
            cell.pack(side="left", padx=(0, 6))
            fg = self._semantic()["cyan"] if "Прев" in txt else self._semantic()["purple"]
            ctk.CTkButton(cell, text=txt, width=120 if "Вир" in txt else 110, height=BTN_H,
                          font=FONT_BTN, fg_color=fg, hover=False,
                          command=cmd).pack(side="left")
            self._help_button(cell, help_key).pack(side="left", padx=(2, 0))

        self._section(inner, "🔄 Сортування")
        sf = self._panel(inner)
        sf_row = ctk.CTkFrame(sf, fg_color="transparent")
        sf_row.grid(row=0, column=0, columnspan=2, sticky="ew")
        self.sort_ai = tk.BooleanVar(value=False)
        self.sort_ai_all = tk.BooleanVar(value=False)
        self.sort_resume = tk.BooleanVar(value=True)
        ctk.CTkCheckBox(sf_row, text="--ai (Ollama)", variable=self.sort_ai, font=FONT_SM).pack(side="left")
        ctk.CTkCheckBox(sf_row, text="усі питання", variable=self.sort_ai_all, font=FONT_SM).pack(side="left", padx=(8, 0))
        ctk.CTkCheckBox(sf_row, text="resume", variable=self.sort_resume, font=FONT_SM).pack(side="left", padx=(8, 0))
        ctk.CTkLabel(sf_row, text="limit:", font=FONT_SM, text_color=TEXT_MUTED).pack(side="left", padx=(12, 4))
        self.sort_limit, _ = self._spinbox(sf_row, 0, 5000, 6, "0")
        _.pack(side="left")
        ctk.CTkLabel(sf_row, text="(0=неодн.)", font=FONT_SM, text_color=TEXT_MUTED).pack(side="left", padx=(4, 0))
        sort_cell = ctk.CTkFrame(sf_row, fg_color="transparent")
        sort_cell.pack(side="right")
        ctk.CTkButton(sort_cell, text="▶ sort-questions", width=160, height=BTN_H, font=FONT_BTN,
                      command=self._run_sort_questions).pack(side="left")
        self._help_button(sort_cell, "sort-questions").pack(side="left", padx=(4, 0))

    def _run_generate(self, mode):
        theme = self.gen_theme.get().strip()
        count = self.gen_count.get().strip() or "30"
        diff = self.gen_diff.get().strip() or "all"
        topic = self.gen_topic.get().strip()
        parts = [] + self._ai_args()
        if mode == "topic":
            nid = topic or ctk.CTkInputDialog(text="Вкажи node id підтеми:", title="Topic ID").get_input()
            if not nid:
                return
            parts = ["--topic", nid.strip(), "--count", count, "--difficulty", diff] + parts
            self._run_npm("generate-ai", " ".join(parts), "✨ Генерація для підтеми")
            return
        if diff and diff != "all":
            parts.extend(["--difficulty", diff])
        max_q = count.strip()
        if max_q and max_q != "0":
            parts.extend(["--max-questions", max_q])
        if mode == "theme":
            parts = ["--theme", theme] + parts
        elif mode == "all":
            pass
        elif mode == "group_ot":
            parts = ["--group", "old-testament"] + parts
        self._run_npm("fill-practice-nodes", " ".join(parts), "🌿 Fill підтем (практика)")

    def _run_balance(self, dry_run):
        raw = self.bal_node.get().strip()
        if not raw:
            messagebox.showwarning("Увага", "Вкажи node id або theme id")
            return
        scope = self.bal_scope.get()
        target = self.bal_target.get().strip() or "0"
        parts = []
        if raw in THEME_IDS:
            parts.extend(["--theme", raw])
        else:
            parts.extend(["--node", raw])
        parts.extend(["--scope", scope, "--target", target] + self._ai_args())
        if dry_run:
            parts.append("--dry-run")
        self._run_npm("balance-questions", " ".join(parts),
                      "👁 Превʼю балансу" if dry_run else "⚖ Вирівнювання підтем")

    def _run_sort_questions(self):
        parts = []
        if self.sort_ai.get():
            parts.append("--ai")
            if self.sort_ai_all.get():
                parts.append("--ai-all")
            limit = self.sort_limit.get().strip()
            if limit and limit != "0":
                parts.extend(["--limit", limit])
            if self.sort_resume.get():
                parts.append("--resume")
            parts.extend(self._ai_args())
        self._run_npm("sort-questions", " ".join(parts), "🔄 Сортування питань")

    def _open_balance_for_node(self, node_id):
        self.bal_node.delete(0, "end")
        self.bal_node.insert(0, node_id)
        self.tabview.set("Питання")

    # ── Tab: Теми ───────────────────────────────────────────────────────────

    def _build_tab_themes(self, parent):
        inner = self._scroll_area(parent)
        self._reset_action_grid(inner)

        self._section(inner, "🌿 Ієрархія та сортування", colspan=1)
        self._cmd_row(inner, "Генерація ієрархії", "npm run generate-topics -- --theme geography | --all",
                      lambda a: self._run_npm("generate-topics", a, "🌿 Генерація ієрархії"),
                      lambda: self._themes_args_default("--all"),
                      help_key="generate-topics")
        self._cmd_row(inner, "AI-сортування тем", "npm run sort-topics-ai -- --all --reparent",
                      lambda a: self._run_npm("sort-topics-ai", a, "🔄 AI-сортування тем"),
                      lambda: self._themes_args_default("--all --reparent"),
                      help_key="sort-topics-ai")
        merge_py = os.path.join(self.script_dir, "merge-topics-db.py")
        merge_cmd = 'python "{0}"'.format(merge_py)
        self._cmd_row(inner, "Merge topics-db", merge_cmd,
                      lambda a: self._execute(merge_cmd, "📦 Merge topics-db"),
                      help_key="merge-topics-db")

        self._section(inner, "Підказка", colspan=1)
        ctk.CTkLabel(
            inner, text="Дії з конкретною темою — вкладка «Якість тем» → клік по рядку.",
            font=FONT_SM, text_color=TEXT_MUTED, wraplength=700, justify="left",
        ).grid(row=inner._next_row, column=0, sticky="w", padx=4, pady=(0, 12))
        inner._next_row += 1

    def _themes_args_default(self, default):
        return default

    # ── Tab: Конвеєр ────────────────────────────────────────────────────────

    def _conveyor_themes_for_covenant(self, covenant_id):
        g = GROUPS_CONF.get(covenant_id, {})
        ids = g.get("theme_ids", [])
        return [t for t in ids if t not in CONVEYOR_CONTAINER_THEMES]

    def _conveyor_extension_branches(self, covenant_id):
        path = os.path.join(
            self.project_root, "data", "topics-db", "extensions", "{0}.json".format(covenant_id),
        )
        data = _load_json(path) or {}
        return data.get("branches") or []

    def _conveyor_existing_items(self, covenant_id):
        items = []
        for tid in self._conveyor_themes_for_covenant(covenant_id):
            items.append({
                "kind": "theme",
                "id": tid,
                "label": "{0} ({1})".format(THEMES_DICT.get(tid, tid), tid),
            })
        for branch in self._conveyor_extension_branches(covenant_id):
            bid = branch.get("id")
            if not bid:
                continue
            title = branch.get("title") or bid
            items.append({
                "kind": "extension",
                "id": bid,
                "label": "🌿 {0} ({1})".format(title, bid),
            })
        return items

    def _conveyor_theme_labels(self, theme_ids):
        return [
            "{0} ({1})".format(THEMES_DICT.get(t, t), t) for t in theme_ids
        ]

    def _conveyor_theme_id_from_label(self, label, theme_ids):
        for tid in theme_ids:
            if label.endswith("({0})".format(tid)) or label == tid:
                return tid
        return theme_ids[0] if theme_ids else ""

    def _conveyor_existing_item_from_label(self, label):
        for item in getattr(self, "_conveyor_existing_items_cache", []):
            if item["label"] == label:
                return item
        return None

    def _conveyor_get_difficulties(self):
        return [d for d in DIFFICULTY_LEVEL_IDS if self._conveyor_diff_vars[d].get()]

    def _conveyor_save_session(self):
        if not self._conveyor:
            return
        try:
            _save_json(self._conveyor_session_path, self._conveyor)
        except Exception:
            pass

    def _conveyor_load_session(self):
        data = _load_json(self._conveyor_session_path)
        if not isinstance(data, dict) or data.get("phase") in (None, "config", "done"):
            return
        self._conveyor = data
        phase = data.get("phase", "?")
        self._conveyor_status.configure(text="Сесія відновлена: {0}".format(phase))
        if phase == "branch_preview" and data.get("branch_draft"):
            self._conveyor_show_branch_review(
                data["branch_draft"], data.get("last_uniqueness"),
            )
        elif data.get("pending_nodes"):
            lvl = data.get("review_level", 1)
            titles = {1: "Категорії (L1)", 2: "Підтеми (L2)", 3: "Підпідтеми (L3)"}
            title = "{0} — {1}".format(
                titles.get(lvl, "?"), data.get("review_parent_title", ""),
            )
            self._conveyor_show_review(
                title, data["pending_nodes"], data.get("last_uniqueness"),
            )

    def _run_conveyor_json(self, argv, label, on_done):
        if self._conveyor_busy:
            messagebox.showwarning("Зайнято", "Конвеєр виконує крок…")
            return

        node = _resolve_executable("node")
        if not node:
            messagebox.showerror("Node.js", "Не знайдено node.exe у PATH.")
            return

        script = os.path.join(self.script_dir, "topic-conveyor.mjs")
        if not os.path.isfile(script):
            messagebox.showerror("Помилка", "Не знайдено:\n" + script)
            return

        self._conveyor_busy = True
        self._stop_requested = False
        self._conveyor_set_cfg_enabled(False)
        self._conveyor_update_step(extra=label)
        self._conveyor_start_progress_indeterminate()
        self._set_status("⏳  " + label, self._semantic()["cyan"], busy=True)
        self._log("\n── Конвеєр: {0} ──\n".format(label), "info")

        def work():
            rc = 1
            data = None
            err = None
            proc = None
            try:
                flags = getattr(subprocess, "CREATE_NO_WINDOW", 0) if os.name == "nt" else 0
                proc = subprocess.Popen(
                    [node, script] + argv,
                    cwd=self.project_root,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    encoding="utf-8",
                    errors="replace",
                    env=self._launcher_subprocess_env(),
                    creationflags=flags,
                )
                self.process = proc
                stdout, stderr = proc.communicate(timeout=600)
                rc = proc.returncode
                if self._stop_requested:
                    return
                out = (stdout or "").strip()
                if stderr:
                    self._safe_after(lambda: self._log(stderr + "\n", "dim"))
                if out:
                    line = out.split("\n")[-1].strip()
                    data = json.loads(line)
                if rc != 0 and data is None:
                    err = stderr or out or "код {0}".format(rc)
            except subprocess.TimeoutExpired:
                if proc:
                    _kill_process_tree(proc)
                    try:
                        proc.communicate(timeout=5)
                    except Exception:
                        pass
                err = "Таймаут (600s)"
            except Exception as ex:
                if not self._stop_requested:
                    err = str(ex)

            def finish():
                self._conveyor_busy = False
                self._conveyor_stop_progress_indeterminate()
                self._conveyor_set_cfg_enabled(True)
                self.process = None
                self.stop_btn.configure(state="disabled")
                if self._stop_requested:
                    self._stop_requested = False
                    self._log("\n⏹  ЗУПИНЕНО\n\n", "warning")
                    self._set_status("⏹  Зупинено", self._semantic()["orange"])
                    self._conveyor_status.configure(text="Зупинено.")
                    self._conveyor_show_activity("Зупинено", "Генерацію перервано.")
                    return
                api_err = None
                if isinstance(data, dict) and data.get("ok") is False:
                    api_err = str(data.get("error") or "Помилка API")
                if err or api_err:
                    msg = err or api_err
                    self._log("✘  {0}\n".format(msg), "error")
                    self._set_status("✘  Конвеєр", self._semantic()["red"])
                    on_done(data if api_err else None, msg)
                else:
                    self._set_status("✔  {0}".format(label), self._semantic()["green"])
                    on_done(data, None)

            self._safe_after(finish)

        threading.Thread(target=work, daemon=True).start()

    def _conveyor_write_apply_file(self, nodes):
        path = os.path.join(self.project_root, "data", "topic-conveyor-apply.json")
        _save_json(path, {"nodes": nodes})
        return path


    def _conveyor_write_branch_file(self, draft):
        path = os.path.join(self.project_root, "data", "topic-conveyor-branch.json")
        _save_json(path, draft)
        return path

    def _conveyor_covenant_label(self, covenant_id=None):
        cid = covenant_id or (self._conveyor_covenant.get() if hasattr(self, "_conveyor_covenant") else "")
        return COVENANT_TITLES.get(cid, cid)

    def _conveyor_set_cfg_enabled(self, enabled):
        state = "normal" if enabled else "disabled"
        for w in getattr(self, "_conveyor_cfg_widgets", []):
            try:
                w.configure(state=state)
            except Exception:
                pass
        self._conveyor_set_stop_enabled(not enabled)

    def _conveyor_set_stop_enabled(self, enabled):
        state = "normal" if enabled else "disabled"
        for attr in ("_conveyor_stop_btn", "_conveyor_activity_stop_btn"):
            w = getattr(self, attr, None)
            if w is not None:
                try:
                    w.configure(state=state)
                except Exception:
                    pass

    def _conveyor_start_progress_indeterminate(self):
        if hasattr(self, "_conveyor_progress"):
            try:
                self._conveyor_progress.start()
            except Exception:
                pass

    def _conveyor_stop_progress_indeterminate(self):
        if hasattr(self, "_conveyor_progress"):
            try:
                self._conveyor_progress.stop()
            except Exception:
                pass

    def _conveyor_show_activity(self, title, detail=""):
        self._conveyor_in_activity = True
        self._conveyor_set_review_buttons(None)
        if hasattr(self, "_conveyor_review_summary"):
            self._conveyor_review_summary.configure(text="")
        self._conveyor_review_label.configure(text=title)
        self._conveyor_review_panel.grid()
        self._conveyor_clear_review_frame()
        msg = detail or "Очікуйте відповідь AI…"
        ctk.CTkLabel(
            self._conveyor_review_frame, text="⏳  " + msg,
            font=FONT_DD, text_color=TEXT_MUTED, anchor="w", justify="left", wraplength=900,
        ).grid(row=0, column=0, sticky="ew", padx=8, pady=12)
        self._conveyor_review_row = 1
        if hasattr(self, "_conveyor_activity_stop_btn"):
            self._conveyor_activity_stop_btn.grid()

    def _conveyor_update_step(self, extra=""):
        if not hasattr(self, "_conveyor_step_label"):
            return
        c = self._conveyor
        if not c:
            self._conveyor_step_label.configure(text="")
            return
        phase = c.get("phase", "config")
        steps = {
            "branch_preview": (1, "Нова гілка"),
            "l1_preview": (2, "Категорії L1"),
            "l2_preview": (3, "Підтеми L2"),
            "l3_preview": (3, "Підпідтеми L3"),
            "l3_auto": (3, "Підпідтеми L3"),
            "questions": (4, "Питання"),
        }
        num, label = steps.get(phase, (0, phase))
        cov = self._conveyor_covenant_label(c.get("covenant"))
        txt = "Крок {0}/4 · {1} · {2}".format(num, label, cov) if num else ""
        if extra:
            txt = "{0}  —  {1}".format(txt, extra)
        self._conveyor_step_label.configure(text=txt)
        if extra and self._conveyor_busy:
            return
        self._conveyor_stop_progress_indeterminate()
        if hasattr(self, "_conveyor_progress") and phase == "l2_preview":
            q = c.get("l2_queue", [])
            idx = c.get("l2_index", 0)
            if q:
                self._conveyor_progress.set((idx + 0.35) / max(len(q), 1))
        elif hasattr(self, "_conveyor_progress") and phase in ("l3_preview", "l3_auto"):
            q = c.get("l3_queue", [])
            idx = c.get("l3_index", 0)
            if q:
                self._conveyor_progress.set((idx + 0.35) / max(len(q), 1))
        elif hasattr(self, "_conveyor_progress") and phase == "questions":
            leaves = c.get("leaves", [])
            idx = c.get("question_index", 0)
            if leaves:
                self._conveyor_progress.set(idx / max(len(leaves), 1))

    def _conveyor_collect_avoid_from_uniqueness(self, uniqueness):
        avoid = []
        for w in (uniqueness or {}).get("warnings", []):
            t = w.get("title")
            if t:
                avoid.append(t)
            st = (w.get("similarTo") or {}).get("title")
            if st:
                avoid.append(st)
        self._conveyor_avoid_titles = list(dict.fromkeys(avoid))[:12]

    def _conveyor_warning_text(self, uniqueness, node_title=None):
        warns = (uniqueness or {}).get("warnings", [])
        if node_title:
            for w in warns:
                if w.get("title") == node_title and w.get("similarTo"):
                    s = w["similarTo"]
                    return "Схоже на: «{0}» ({1}%)".format(
                        s.get("title", "?"), s.get("score", "?"),
                    )
            return None
        if not warns:
            return None
        w0 = warns[0]
        s = w0.get("similarTo") or {}
        return "Можливий дублікат: «{0}» схоже на «{1}» ({2}%)".format(
            w0.get("title", "?"), s.get("title", "?"), s.get("score", "?"),
        )

    def _conveyor_refresh_catalog_list(self):
        if not hasattr(self, "_conveyor_catalog_frame"):
            return
        for w in self._conveyor_catalog_frame.winfo_children():
            w.destroy()
        cid = self._conveyor_covenant.get() if hasattr(self, "_conveyor_covenant") else "old-testament"
        items = self._conveyor_existing_items(cid)
        ctk.CTkLabel(
            self._conveyor_catalog_frame,
            text="Вже в завіті ({0}):".format(len(items)),
            font=FONT_SM, text_color=TEXT_MUTED, anchor="w",
        ).pack(anchor="w", padx=4, pady=(4, 2))
        for item in items[:40]:
            ctk.CTkLabel(
                self._conveyor_catalog_frame,
                text=item["label"],
                font=FONT_HINT, text_color=TEXT_SUB, anchor="w",
            ).pack(anchor="w", padx=8, pady=1)
        if len(items) > 40:
            ctk.CTkLabel(
                self._conveyor_catalog_frame,
                text="… ще {0}".format(len(items) - 40),
                font=FONT_HINT, text_color=TEXT_MUTED,
            ).pack(anchor="w", padx=8)

    def _conveyor_open_in_preview(self, node_id=None):
        if node_id:
            self._preview_pending_focus = node_id
        self.tabview.set("Перегляд")
        self._ensure_tab_built("Перегляд")
        self._preview_ensure_index(force=False)

    def _conveyor_toggle_mode(self):
        is_cov = self._conveyor_mode.get() == "covenant"
        if is_cov:
            self._conveyor_branch_row.grid()
            self._conveyor_existing_row.grid_remove()
        else:
            self._conveyor_branch_row.grid_remove()
            self._conveyor_existing_row.grid()
        self._conveyor_on_covenant_change()

    def _conveyor_toggle_depth(self):
        l2_on = self._conveyor_enable_l2.get()
        try:
            self._conveyor_l2.configure(state="normal" if l2_on else "disabled")
        except Exception:
            pass
        if not l2_on:
            self._conveyor_enable_l3.set(False)
        l3_on = self._conveyor_enable_l3.get() and l2_on
        try:
            self._conveyor_l3.configure(state="normal" if l3_on else "disabled")
        except Exception:
            pass

    def _conveyor_preview_argv(self, action, parent_id, count=None, extra=None):
        c = self._conveyor
        target = c.get("target", "file")
        argv = ["--action", action, "--json", "--target", target,
                "--provider", c.get("provider", self.ai_provider), "--model", c["model"]]
        if target == "extensions":
            argv.extend(["--covenant", c["covenant"], "--file", c["covenant"]])
        else:
            argv.extend(["--file", c["theme_id"], "--theme", c["theme_id"], "--covenant", c["covenant"]])
        if parent_id:
            argv.extend(["--parent", parent_id])
        if count is not None:
            argv.extend(["--count", str(count)])
        avoid = getattr(self, "_conveyor_avoid_titles", None) or c.get("avoid_titles", [])
        if avoid:
            argv.extend(["--avoid", "|".join(avoid[:12])])
        if extra:
            argv.extend(extra)
        return argv

    def _conveyor_apply_argv(self, parent_id, input_path):
        c = self._conveyor
        target = c.get("target", "file")
        argv = ["--action", "apply", "--json", "--target", target, "--parent", parent_id, "--input", input_path]
        if target == "extensions":
            argv.extend(["--covenant", c["covenant"], "--file", c["covenant"]])
        else:
            argv.extend(["--file", c["theme_id"]])
        return argv

    def _conveyor_set_review_buttons(self, mode):
        self._conveyor_review_mode = mode
        self._conveyor_branch_btn_row.pack_forget()
        self._conveyor_nodes_btn_row.pack_forget()
        if mode == "branch":
            self._conveyor_branch_btn_row.pack(fill="x")
        elif mode == "nodes":
            self._conveyor_nodes_btn_row.pack(fill="x")

    def _conveyor_clear_review_frame(self):
        for w in self._conveyor_review_frame.winfo_children():
            w.destroy()
        self._conveyor_review_row = 0

    def _conveyor_hide_review(self):
        self._conveyor_in_activity = False
        self._conveyor_stop_progress_indeterminate()
        self._conveyor_review_panel.grid_remove()
        self._conveyor_review_label.configure(text="")
        if hasattr(self, "_conveyor_review_summary"):
            self._conveyor_review_summary.configure(text="")
        self._conveyor_clear_review_frame()
        self._conveyor_review_rows = []
        self._conveyor_branch_title_entry = None
        self._conveyor_set_review_buttons(None)
        if hasattr(self, "_conveyor_activity_stop_btn"):
            self._conveyor_activity_stop_btn.grid_remove()

    def _conveyor_set_row_approved(self, row, value):
        row["approved"].set(bool(value))
        s = self._semantic()
        yes_btn = row.get("yes_btn")
        no_btn = row.get("no_btn")
        card = row.get("card")
        if yes_btn:
            yes_btn.configure(
                fg_color=s["green"] if value else UI["muted_btn"],
                text_color=("white", "white") if value else UI["muted_btn_text"],
            )
        if no_btn:
            no_btn.configure(
                fg_color=s["red"] if not value else UI["muted_btn"],
                text_color=("white", "white") if not value else UI["muted_btn_text"],
            )
        if card:
            card.configure(border_color=s["green"] if value else s["red"])

    def _conveyor_on_row_toggle(self, row, value):
        self._conveyor_set_row_approved(row, value)
        self._conveyor_update_review_summary()

    def _conveyor_update_review_summary(self):
        if not hasattr(self, "_conveyor_review_summary"):
            return
        rows = self._conveyor_review_rows
        if not rows:
            self._conveyor_review_summary.configure(text="")
            return
        n = sum(1 for r in rows if r["approved"].get())
        total = len(rows)
        self._conveyor_review_summary.configure(
            text="Обрано: {0} / {1}".format(n, total),
            text_color=self._semantic()["green"] if n == total else TEXT_MUTED,
        )

    def _conveyor_show_review_panel(self, title):
        self._conveyor_in_activity = False
        self._conveyor_review_label.configure(text=title)
        self._conveyor_review_panel.grid()
        if hasattr(self, "_conveyor_activity_stop_btn"):
            self._conveyor_activity_stop_btn.grid_remove()

    def _conveyor_show_branch_loading(self):
        c = self._conveyor
        cov = self._conveyor_covenant_label(c.get("covenant") if c else None)
        model = (c or {}).get("model", self.ai_model)
        self._conveyor_show_activity(
            "Нова гілка — {0}".format(cov),
            "Генерація гілки… · модель: {0}".format(model),
        )

    def _conveyor_show_branch_review(self, draft, uniqueness=None):
        self._conveyor_hide_review()
        c = self._conveyor
        if uniqueness:
            c["last_uniqueness"] = uniqueness
            self._conveyor_collect_avoid_from_uniqueness(uniqueness)
        cov = self._conveyor_covenant_label(c.get("covenant"))
        self._conveyor_show_review_panel("Нова гілка — {0}".format(cov))
        self._conveyor_set_review_buttons("branch")
        self._conveyor_update_step()
        s = self._semantic()
        warn = self._conveyor_warning_text(uniqueness or c.get("last_uniqueness"))
        border = s["orange"] if warn else UI["card_border"]
        card = ctk.CTkFrame(
            self._conveyor_review_frame, fg_color=UI["card_bg"],
            border_width=1, border_color=border,
        )
        card.grid(row=0, column=0, sticky="ew", padx=4, pady=6)
        self._conveyor_review_row = 1
        card.grid_columnconfigure(1, weight=1)
        ctk.CTkLabel(card, text="Завіт:", font=FONT_SM, text_color=TEXT_MUTED).grid(row=0, column=0, sticky="w", padx=10, pady=(10, 4))
        ctk.CTkLabel(card, text=cov, font=FONT_DD).grid(row=0, column=1, sticky="w", padx=4, pady=(10, 4))
        ctk.CTkLabel(card, text="Назва:", font=FONT_SM, text_color=TEXT_MUTED).grid(row=1, column=0, sticky="w", padx=10, pady=4)
        self._conveyor_branch_title_entry = ctk.CTkEntry(card, font=FONT_DD, height=CTRL_H)
        self._conveyor_branch_title_entry.grid(row=1, column=1, sticky="ew", padx=4, pady=4)
        self._conveyor_branch_title_entry.insert(0, draft.get("title", ""))
        if warn:
            ctk.CTkLabel(
                card, text="⚠ " + warn, font=FONT_SM, text_color=s["orange"],
                anchor="w", wraplength=700, justify="left",
            ).grid(row=2, column=0, columnspan=2, sticky="w", padx=10, pady=2)
        desc_row = 3 if warn else 2
        ctk.CTkLabel(card, text="Опис:", font=FONT_SM, text_color=TEXT_MUTED).grid(
            row=desc_row, column=0, sticky="nw", padx=10, pady=4,
        )
        ctk.CTkLabel(
            card, text=draft.get("description", ""), font=FONT_DD, anchor="w", justify="left", wraplength=700,
        ).grid(row=desc_row, column=1, sticky="w", padx=4, pady=4)
        ctk.CTkLabel(
            card, text="{0}  id буде обчислено при збереженні".format(draft.get("icon", "📖")),
            font=FONT_SM, text_color=TEXT_MUTED,
        ).grid(row=desc_row + 1, column=1, sticky="w", padx=4, pady=(4, 10))
        c["branch_draft"] = dict(draft)

    def _conveyor_show_review(self, title, nodes, uniqueness=None):
        self._conveyor_hide_review()
        self._conveyor_show_review_panel(title)
        self._conveyor_set_review_buttons("nodes")
        if self._conveyor and uniqueness:
            self._conveyor["last_uniqueness"] = uniqueness
            self._conveyor_collect_avoid_from_uniqueness(uniqueness)
        self._conveyor_update_step()
        s = self._semantic()
        for i, node in enumerate(nodes):
            node_warn = self._conveyor_warning_text(
                uniqueness or (self._conveyor or {}).get("last_uniqueness"),
                node.get("title"),
            )
            border = s["orange"] if node_warn else UI["card_border"]
            card = ctk.CTkFrame(
                self._conveyor_review_frame, fg_color=UI["seg_unselected"],
                border_width=2, border_color=border,
            )
            card.grid(row=i, column=0, sticky="ew", pady=4, padx=2)
            self._conveyor_review_row = i + 1
            card.grid_columnconfigure(0, weight=1)

            approved = tk.BooleanVar(value=True)
            content = ctk.CTkFrame(card, fg_color="transparent")
            content.grid(row=0, column=0, sticky="ew", padx=12, pady=10)
            content.grid_columnconfigure(0, weight=1)

            icon = node.get("icon", "📖")
            ctk.CTkLabel(
                content,
                text="{0}  {1}".format(icon, node.get("title", "?")),
                font=FONT_H, anchor="w",
            ).grid(row=0, column=0, sticky="w")

            desc = (node.get("description") or "").strip()
            if desc:
                ctk.CTkLabel(
                    content, text=desc, font=FONT_SM, text_color=TEXT_MUTED,
                    anchor="w", justify="left", wraplength=700,
                ).grid(row=1, column=0, sticky="w", pady=(4, 0))

            if node_warn:
                ctk.CTkLabel(
                    content, text="⚠ " + node_warn, font=FONT_SM, text_color=s["orange"],
                    anchor="w", wraplength=680,
                ).grid(row=2, column=0, sticky="w", pady=(4, 0))

            ctk.CTkLabel(
                content, text=node.get("id", "?"), font=FONT_HINT,
                text_color=TEXT_SUB, anchor="w",
            ).grid(row=3, column=0, sticky="w", pady=(6, 0))

            actions = ctk.CTkFrame(card, fg_color="transparent")
            actions.grid(row=0, column=1, sticky="ns", padx=(0, 12), pady=10)
            yes_btn = ctk.CTkButton(
                actions, text="✓", width=42, height=34, font=FONT_BTN,
                corner_radius=8, hover=False,
            )
            no_btn = ctk.CTkButton(
                actions, text="✗", width=42, height=34, font=FONT_BTN,
                corner_radius=8, hover=False,
            )
            row_data = {
                "node": node, "approved": approved, "card": card,
                "yes_btn": yes_btn, "no_btn": no_btn,
            }
            yes_btn.configure(command=lambda r=row_data: self._conveyor_on_row_toggle(r, True))
            no_btn.configure(command=lambda r=row_data: self._conveyor_on_row_toggle(r, False))
            yes_btn.pack(pady=(0, 6))
            no_btn.pack()

            self._conveyor_set_row_approved(row_data, True)
            self._conveyor_review_rows.append(row_data)

        self._conveyor_update_review_summary()

    def _conveyor_branch_reject(self):
        self._conveyor_hide_review()
        if self._conveyor:
            self._conveyor["phase"] = "config"
            self._conveyor.pop("branch_draft", None)
            self._conveyor_save_session()
        self._conveyor_status.configure(text="Гілку відхилено. Змініть ідею або запустіть знову.")

    def _conveyor_branch_regenerate(self):
        if not self._conveyor:
            return
        hint = self._conveyor_branch_hint.get().strip() if hasattr(self, "_conveyor_branch_hint") else ""
        self._conveyor_branch_preview(hint or None)

    def _conveyor_branch_accept(self):
        c = self._conveyor
        if not c or not self._conveyor_branch_title_entry:
            return
        title = self._conveyor_branch_title_entry.get().strip()
        if not title:
            messagebox.showwarning("Увага", "Вкажіть назву гілки.")
            return
        draft = dict(c.get("branch_draft") or {})
        draft["title"] = title
        path = self._conveyor_write_branch_file(draft)
        argv = [
            "--action", "apply-branch", "--json",
            "--covenant", c["covenant"],
            "--input", path,
        ]
        self._conveyor_show_activity(
            "Збереження гілки",
            "Запис у extensions/{0}.json…".format(c["covenant"]),
        )
        self._conveyor_status.configure(text="Збереження гілки…")

        def done(data, err):
            if err or not data or not data.get("ok"):
                msg = (data or {}).get("error") or err or "apply-branch failed"
                messagebox.showerror("Конвеєр", msg)
                return
            branch = data.get("branch") or {}
            c["branch"] = branch
            c["phase"] = "l1_preview"
            c["review_parent_id"] = branch.get("id")
            c["review_parent_title"] = branch.get("title", branch.get("id"))
            self._conveyor_save_session()
            self._conveyor_on_covenant_change()
            self._conveyor_continue_after_branch()

        self._run_conveyor_json(argv, "apply-branch", done)

    def _conveyor_parent_node(self):
        c = self._conveyor
        branch = c.get("branch")
        if branch and branch.get("id"):
            return branch
        pid = c.get("review_parent_id") or c.get("theme_id") or ""
        title = c.get("review_parent_title") or THEMES_DICT.get(pid, pid)
        return {"id": pid, "title": title}

    def _conveyor_continue_after_branch(self):
        c = self._conveyor
        if not c:
            return
        l1_count = c["counts"]["l1"]
        if l1_count > 0:
            self._conveyor_status.configure(text="Крок 2: категорії (L1)…")
            self._conveyor_preview_l1()
            return
        parent = self._conveyor_parent_node()
        if not parent.get("id"):
            self._conveyor_finish()
            return
        c["review_parent_id"] = parent["id"]
        c["review_parent_title"] = parent.get("title", parent["id"])
        if c.get("enable_l2") and c["counts"]["l2"] > 0:
            c["l2_queue"] = [{"id": parent["id"], "title": parent.get("title", parent["id"])}]
            c["l2_index"] = 0
            c["phase"] = "l2_preview"
            self._conveyor_save_session()
            self._conveyor_status.configure(text="Підтеми (L2)…")
            self._conveyor_preview_l2_current()
            return
        if c["counts"]["questions"] > 0:
            self._conveyor_go_questions_with_nodes([parent])
            return
        self._conveyor_finish()

    def _conveyor_branch_preview(self, hint=None):
        c = self._conveyor
        if hint is None and hasattr(self, "_conveyor_branch_hint"):
            hint = self._conveyor_branch_hint.get().strip()
        argv = ["--action", "preview-branch", "--json", "--covenant", c["covenant"],
                "--provider", c.get("provider", self.ai_provider), "--model", c["model"]]
        if hint:
            argv.extend(["--title", hint])
        self._conveyor_status.configure(text="Генерація гілки для «{0}»…".format(self._conveyor_covenant_label(c["covenant"])))
        self._conveyor_show_branch_loading()

        def done(data, err):
            if err or not data or not data.get("ok"):
                msg = (data or {}).get("error") or err or "preview-branch failed"
                self._conveyor_hide_review()
                short = msg if len(msg) <= 160 else msg[:157] + "…"
                self._conveyor_status.configure(text="Помилка: {0}".format(short))
                messagebox.showerror("Конвеєр", msg)
                return
            c["phase"] = "branch_preview"
            uniq = data.get("uniqueness")
            if uniq:
                c["last_uniqueness"] = uniq
            self._conveyor_show_branch_review(data.get("draft") or {}, uniq)
            self._conveyor_save_session()
            self._conveyor_status.configure(text="Перевірте назву та опис гілки.")

        self._run_conveyor_json(argv, "preview-branch", done)

    def _conveyor_go_questions_with_nodes(self, nodes):
        c = self._conveyor
        c["leaves"] = [{"id": n["id"], "title": n.get("title", n["id"])} for n in nodes]
        c["phase"] = "questions"
        self._conveyor_save_session()
        if c["counts"]["questions"] <= 0:
            self._conveyor_finish()
            return
        self._conveyor_status.configure(text="Питання ({0} листів)…".format(len(c["leaves"])))
        self._conveyor_questions_start()
    def _build_tab_conveyor(self, parent):
        parent.grid_columnconfigure(0, weight=1)
        parent.grid_rowconfigure(1, weight=1)
        self._conveyor_cfg_widgets = []

        hdr = ctk.CTkFrame(parent, fg_color="transparent")
        hdr.grid(row=0, column=0, sticky="ew", padx=8, pady=(6, 4))
        ctk.CTkLabel(hdr, text="🏭 Конвеєр ієрархії", font=FONT_H).pack(side="left")
        self._help_button(hdr, "topic-conveyor").pack(side="left", padx=(8, 0))

        body = ctk.CTkFrame(parent, fg_color="transparent")
        body.grid(row=1, column=0, sticky="nsew", padx=8, pady=(0, 8))
        body.grid_columnconfigure(0, weight=0, minsize=380)
        body.grid_columnconfigure(1, weight=1)
        body.grid_rowconfigure(0, weight=1)

        cfg_card = ctk.CTkFrame(body, fg_color=UI["card_bg"], border_width=1, border_color=UI["card_border"])
        cfg_card.grid(row=0, column=0, sticky="nsew", padx=(2, 8), pady=2)
        cfg_card.grid_columnconfigure(1, weight=1)
        lbl_w = 110

        ctk.CTkLabel(cfg_card, text="Завіт:", font=FONT_SM, text_color=TEXT_MUTED, width=lbl_w
                     ).grid(row=0, column=0, sticky="w", padx=10, pady=(10, 4))
        cov_f = ctk.CTkFrame(cfg_card, fg_color="transparent")
        cov_f.grid(row=0, column=1, sticky="w", padx=4, pady=(10, 4))
        self._conveyor_covenant = tk.StringVar(value="old-testament")
        for cid, title in [("old-testament", "Старий Завіт"), ("new-testament", "Новий Завіт")]:
            ctk.CTkRadioButton(
                cov_f, text=title, variable=self._conveyor_covenant, value=cid,
                font=FONT_SM, command=self._conveyor_on_covenant_change,
            ).pack(side="left", padx=(0, 14))

        ctk.CTkLabel(cfg_card, text="Режим:", font=FONT_SM, text_color=TEXT_MUTED, width=lbl_w
                     ).grid(row=1, column=0, sticky="w", padx=10, pady=4)
        mode_f = ctk.CTkFrame(cfg_card, fg_color="transparent")
        mode_f.grid(row=1, column=1, sticky="w", padx=4, pady=4)
        self._conveyor_mode = tk.StringVar(value="covenant")
        ctk.CTkRadioButton(mode_f, text="Нова гілка в завіті", variable=self._conveyor_mode,
                             value="covenant", font=FONT_SM, command=self._conveyor_toggle_mode
                             ).pack(anchor="w")
        ctk.CTkRadioButton(mode_f, text="Існуючий вузол (тема або 🌿)", variable=self._conveyor_mode,
                             value="existing", font=FONT_SM, command=self._conveyor_toggle_mode
                             ).pack(anchor="w")

        self._conveyor_branch_row = ctk.CTkFrame(cfg_card, fg_color="transparent")
        self._conveyor_branch_row.grid(row=2, column=0, columnspan=2, sticky="ew", padx=10, pady=4)
        self._conveyor_branch_row.grid_columnconfigure(1, weight=1)
        ctk.CTkLabel(self._conveyor_branch_row, text="Ідея назви:", font=FONT_SM,
                     text_color=TEXT_MUTED, width=lbl_w).grid(row=0, column=0, sticky="w")
        self._conveyor_branch_hint = ctk.CTkEntry(self._conveyor_branch_row, font=FONT_DD, height=CTRL_H,
                                                   placeholder_text="Вкажіть назву — миттєво без AI")
        self._conveyor_branch_hint.grid(row=0, column=1, sticky="ew", padx=(4, 8))
        btn_gen = ctk.CTkButton(self._conveyor_branch_row, text="Згенерувати", width=120, height=BTN_H,
                                font=FONT_SM, command=lambda: self._conveyor_start_branch_only())
        btn_gen.grid(row=0, column=2, sticky="e")
        self._conveyor_cfg_widgets.append(btn_gen)

        self._conveyor_existing_row = ctk.CTkFrame(cfg_card, fg_color="transparent")
        self._conveyor_existing_row.grid(row=3, column=0, columnspan=2, sticky="ew", padx=10, pady=4)
        self._conveyor_existing_row.grid_columnconfigure(1, weight=1)
        ctk.CTkLabel(self._conveyor_existing_row, text="Вузол:", font=FONT_SM,
                     text_color=TEXT_MUTED, width=lbl_w).grid(row=0, column=0, sticky="w")
        ot_items = self._conveyor_existing_items("old-testament")
        self._conveyor_existing_items_cache = ot_items
        ot_labels = [i["label"] for i in ot_items]
        self._conveyor_theme = ctk.CTkComboBox(
            self._conveyor_existing_row, values=ot_labels if ot_labels else [""],
            height=CTRL_H, font=FONT_DD,
        )
        self._conveyor_theme.set(ot_labels[0] if ot_labels else "")
        self._conveyor_theme.grid(row=0, column=1, sticky="ew", padx=4)

        depth = ctk.CTkFrame(cfg_card, fg_color="transparent")
        depth.grid(row=4, column=0, columnspan=2, sticky="ew", padx=10, pady=4)
        ctk.CTkLabel(depth, text="Глибина:", font=FONT_SM, text_color=TEXT_MUTED, width=lbl_w
                     ).grid(row=0, column=0, sticky="nw", padx=(0, 4))
        d_inner = ctk.CTkFrame(depth, fg_color="transparent")
        d_inner.grid(row=0, column=1, sticky="ew")
        ctk.CTkLabel(d_inner, text="L1", font=FONT_SM).grid(row=0, column=0, padx=(0, 4))
        self._conveyor_l1, _ = self._spinbox(d_inner, 0, 20, 4, "3")
        _.grid(row=0, column=1, padx=(0, 10))
        self._conveyor_enable_l2 = tk.BooleanVar(value=True)
        ctk.CTkCheckBox(d_inner, text="L2", variable=self._conveyor_enable_l2,
                        font=FONT_SM, command=self._conveyor_toggle_depth).grid(row=0, column=2, padx=(0, 2))
        self._conveyor_l2, _ = self._spinbox(d_inner, 0, 20, 4, "3")
        _.grid(row=0, column=3, padx=(0, 10))
        self._conveyor_enable_l3 = tk.BooleanVar(value=True)
        ctk.CTkCheckBox(d_inner, text="L3", variable=self._conveyor_enable_l3,
                        font=FONT_SM, command=self._conveyor_toggle_depth).grid(row=0, column=4, padx=(0, 2))
        self._conveyor_l3, _ = self._spinbox(d_inner, 0, 20, 4, "2")
        _.grid(row=0, column=5)

        qrow = ctk.CTkFrame(cfg_card, fg_color="transparent")
        qrow.grid(row=5, column=0, columnspan=2, sticky="ew", padx=10, pady=4)
        ctk.CTkLabel(qrow, text="Питань/лист:", font=FONT_SM, text_color=TEXT_MUTED, width=lbl_w
                     ).pack(side="left")
        self._conveyor_qcount, _ = self._spinbox(qrow, 0, 200, 5, "10")
        _.pack(side="left", padx=4)

        diff_row = ctk.CTkFrame(cfg_card, fg_color="transparent")
        diff_row.grid(row=6, column=0, columnspan=2, sticky="ew", padx=10, pady=4)
        ctk.CTkLabel(diff_row, text="Складність:", font=FONT_SM, text_color=TEXT_MUTED, width=lbl_w
                     ).pack(side="left", anchor="n")
        diff_box = ctk.CTkFrame(diff_row, fg_color="transparent")
        diff_box.pack(side="left", fill="x", expand=True)
        self._conveyor_diff_vars = {}
        for i, did in enumerate(DIFFICULTY_LEVEL_IDS):
            var = tk.BooleanVar(value=(did in ("baby", "child", "youth")))
            self._conveyor_diff_vars[did] = var
            lbl = next((d[1] for d in DIFFICULTIES if d[0] == did), did)
            ctk.CTkCheckBox(diff_box, text=lbl, variable=var, font=FONT_SM).grid(
                row=i // 2, column=i % 2, sticky="w", padx=(0, 8), pady=1)

        act = ctk.CTkFrame(cfg_card, fg_color="transparent")
        act.grid(row=7, column=0, columnspan=2, sticky="ew", padx=10, pady=(8, 4))
        s = self._semantic()
        act_row1 = ctk.CTkFrame(act, fg_color="transparent")
        act_row1.pack(fill="x", pady=(0, 4))
        btn_start = ctk.CTkButton(act_row1, text="▶ Запустити", width=140, height=BTN_H, font=FONT_BTN,
                                  fg_color=s["green"], hover=False, command=self._conveyor_start)
        btn_start.pack(side="left")
        self._conveyor_cfg_widgets.append(btn_start)
        self._conveyor_stop_btn = ctk.CTkButton(
            act_row1, text="⏹ Зупинити", width=120, height=BTN_H, font=FONT_BTN,
            fg_color=s["orange"], hover=False, state="disabled", command=self._stop_process,
        )
        self._conveyor_stop_btn.pack(side="left", padx=(8, 0))
        act_row2 = ctk.CTkFrame(act, fg_color="transparent")
        act_row2.pack(fill="x")
        btn_reset = ctk.CTkButton(act_row2, text="Скинути сесію", width=130, height=BTN_H, font=FONT_SM,
                                  fg_color=UI["muted_btn"], text_color=UI["muted_btn_text"],
                                  command=self._conveyor_cancel)
        btn_reset.pack(side="left")
        self._conveyor_cfg_widgets.append(btn_reset)
        merge_py = os.path.join(self.script_dir, "merge-topics-db.py")
        ctk.CTkButton(act_row2, text="Merge topics-db", width=130, height=BTN_H, font=FONT_SM,
                      command=lambda: self._execute(
                          'python "{0}"'.format(merge_py), "📦 Merge topics-db")).pack(side="left", padx=(8, 0))

        prog_row = ctk.CTkFrame(cfg_card, fg_color="transparent")
        prog_row.grid(row=8, column=0, columnspan=2, sticky="ew", padx=10, pady=(0, 4))
        prog_row.grid_columnconfigure(0, weight=1)
        self._conveyor_step_label = ctk.CTkLabel(
            prog_row, text="", font=FONT_SM, text_color=TEXT_MUTED, anchor="w",
        )
        self._conveyor_step_label.grid(row=0, column=0, sticky="w")
        self._conveyor_progress = ctk.CTkProgressBar(prog_row, height=8)
        self._conveyor_progress.grid(row=1, column=0, sticky="ew", pady=(4, 0))
        self._conveyor_progress.set(0)

        self._conveyor_status = ctk.CTkLabel(
            cfg_card,
            text="Нова гілка зберігається в extensions/{covenant}.json. Потім — Merge topics-db.",
            font=FONT_SM, text_color=TEXT_MUTED, anchor="w", wraplength=340, justify="left",
        )
        self._conveyor_status.grid(row=9, column=0, columnspan=2, sticky="ew", padx=10, pady=(0, 10))

        right_col = ctk.CTkFrame(body, fg_color="transparent")
        right_col.grid(row=0, column=1, sticky="nsew", padx=(0, 2), pady=2)
        right_col.grid_columnconfigure(0, weight=1)
        right_col.grid_rowconfigure(1, weight=1)

        cat_row = ctk.CTkFrame(right_col, fg_color="transparent")
        cat_row.grid(row=0, column=0, sticky="ew", pady=(0, 6))
        cat_row.grid_columnconfigure(0, weight=1)
        self._conveyor_catalog_frame = ctk.CTkScrollableFrame(
            cat_row, height=100, fg_color=UI["seg_unselected"],
        )
        self._conveyor_catalog_frame.grid(row=0, column=0, sticky="ew")
        ctk.CTkButton(
            cat_row, text="Перегляд", width=90, height=BTN_H, font=FONT_SM,
            command=lambda: self._conveyor_open_in_preview(),
        ).grid(row=0, column=1, padx=(8, 0), sticky="ne")

        self._conveyor_review_panel = ctk.CTkFrame(
            right_col, fg_color=UI["card_bg"], border_width=1, border_color=UI["card_border"],
        )
        self._conveyor_review_panel.grid(row=1, column=0, sticky="nsew")
        self._conveyor_review_panel.grid_columnconfigure(0, weight=1)
        self._conveyor_review_panel.grid_rowconfigure(1, weight=1)

        review_hdr = ctk.CTkFrame(self._conveyor_review_panel, fg_color="transparent")
        review_hdr.grid(row=0, column=0, sticky="ew", padx=12, pady=(10, 6))
        review_hdr.grid_columnconfigure(0, weight=1)
        self._conveyor_review_label = ctk.CTkLabel(
            review_hdr, text="", font=FONT_H, anchor="w",
        )
        self._conveyor_review_label.grid(row=0, column=0, sticky="w")
        self._conveyor_review_summary = ctk.CTkLabel(
            review_hdr, text="", font=FONT_SM, anchor="e",
        )
        self._conveyor_review_summary.grid(row=0, column=1, sticky="e", padx=(8, 0))
        self._conveyor_activity_stop_btn = ctk.CTkButton(
            review_hdr, text="⏹ Зупинити", width=110, height=BTN_H, font=FONT_SM,
            fg_color=s["orange"], hover=False, state="disabled", command=self._stop_process,
        )
        self._conveyor_activity_stop_btn.grid(row=0, column=2, sticky="e", padx=(8, 0))
        self._conveyor_activity_stop_btn.grid_remove()

        self._conveyor_review_frame = ctk.CTkScrollableFrame(
            self._conveyor_review_panel, fg_color="transparent",
        )
        self._conveyor_review_frame.grid(row=1, column=0, sticky="nsew", padx=8)
        self._conveyor_review_frame.grid_columnconfigure(0, weight=1)
        self._conveyor_review_row = 0

        btn_wrap = ctk.CTkFrame(self._conveyor_review_panel, fg_color="transparent")
        btn_wrap.grid(row=2, column=0, sticky="ew", padx=12, pady=(4, 12))
        self._conveyor_branch_btn_row = ctk.CTkFrame(btn_wrap, fg_color="transparent")
        self._conveyor_branch_btn_row.pack(fill="x")
        for txt, cmd, fg in [
            ("✓ Прийняти гілку", self._conveyor_branch_accept, s["green"]),
            ("Відхилити", self._conveyor_branch_reject, s["red"]),
            ("↻ Перегенерувати", self._conveyor_branch_regenerate, UI["muted_btn"]),
        ]:
            ctk.CTkButton(self._conveyor_branch_btn_row, text=txt, width=150, height=BTN_H,
                          font=FONT_BTN if "Прийняти" in txt else FONT_SM,
                          fg_color=fg, hover=False, command=cmd).pack(side="left", padx=(0, 8))

        self._conveyor_nodes_btn_row = ctk.CTkFrame(btn_wrap, fg_color="transparent")
        self._conveyor_nodes_btn_row.pack(fill="x")
        ctk.CTkButton(
            self._conveyor_nodes_btn_row, text="✓ Прийняти всі", width=168, height=BTN_H,
            font=FONT_BTN, fg_color=s["green"], hover=False, command=self._conveyor_approve_all,
        ).pack(side="left", padx=(0, 8))
        ctk.CTkButton(
            self._conveyor_nodes_btn_row, text="Застосувати обрані", width=168, height=BTN_H,
            font=FONT_BTN, fg_color=s["cyan"], hover=False, command=self._conveyor_apply_review,
        ).pack(side="left", padx=(0, 8))
        ctk.CTkButton(
            self._conveyor_nodes_btn_row, text="↻ Перегенерувати", width=150, height=BTN_H,
            font=FONT_SM, fg_color=UI["muted_btn"], text_color=UI["muted_btn_text"],
            hover=False, command=self._conveyor_regenerate,
        ).pack(side="left")

        for w in (self._conveyor_covenant, self._conveyor_mode, self._conveyor_branch_hint,
                  self._conveyor_theme, self._conveyor_l1, self._conveyor_l2, self._conveyor_l3,
                  self._conveyor_qcount):
            self._conveyor_cfg_widgets.append(w)
        self._conveyor_toggle_mode()
        self._conveyor_toggle_depth()
        self._conveyor_hide_review()
        self._conveyor_refresh_catalog_list()
        self.after(200, self._conveyor_load_session)

    def _conveyor_on_covenant_change(self):
        cid = self._conveyor_covenant.get()
        items = self._conveyor_existing_items(cid)
        self._conveyor_existing_items_cache = items
        labels = [i["label"] for i in items]
        self._conveyor_theme.configure(values=labels if labels else [""])
        if labels:
            self._conveyor_theme.set(labels[0])
        self._conveyor_refresh_catalog_list()

    def _conveyor_cancel_silent(self):
        """Скинути сесію конвеєра без діалогів (для «У Конвеєрі» з перегляду)."""
        self._conveyor_preview_anchor = None
        self._conveyor = None
        self._conveyor_hide_review()
        self._conveyor_stop_progress_indeterminate()
        self._conveyor_busy = False
        self._conveyor_set_cfg_enabled(True)
        try:
            if os.path.isfile(self._conveyor_session_path):
                os.remove(self._conveyor_session_path)
        except OSError:
            pass

    def _conveyor_cancel(self):
        if self._conveyor_busy or (self.process and self.process.poll() is None):
            self._stop_process()
        self._conveyor_cancel_silent()
        if hasattr(self, "_conveyor_status"):
            self._conveyor_status.configure(text="Скасовано.")

    def _conveyor_build_session_base(self):
        covenant = self._conveyor_covenant.get()
        mode = self._conveyor_mode.get()
        target = "extensions" if mode == "covenant" else "file"
        theme_id = covenant
        parent_title = self._conveyor_covenant_label(covenant)
        if mode == "existing":
            item = self._conveyor_existing_item_from_label(self._conveyor_theme.get())
            if not item:
                theme_id = ""
            elif item["kind"] == "extension":
                target = "extensions"
                theme_id = item["id"]
                parent_title = item["label"]
            else:
                target = "file"
                theme_id = item["id"]
                parent_title = THEMES_DICT.get(theme_id, theme_id)
        return {
            "covenant": covenant,
            "target": target,
            "theme_id": theme_id,
            "mode": mode,
            "enable_l2": self._conveyor_enable_l2.get(),
            "enable_l3": self._conveyor_enable_l3.get() and self._conveyor_enable_l2.get(),
            "counts": {
                "l1": int(self._conveyor_l1.get() or 0),
                "l2": int(self._conveyor_l2.get() or 0),
                "l3": int(self._conveyor_l3.get() or 0),
                "questions": int(self._conveyor_qcount.get() or 0),
            },
            "difficulties": self._conveyor_get_difficulties(),
            "model": self.ai_model,
            "provider": self.ai_provider,
            "l1_approved": [],
            "l2_queue": [],
            "l2_index": 0,
            "l2_approved": {},
            "leaves": [],
            "question_index": 0,
            "review_parent_title": parent_title,
        }

    def _conveyor_start_branch_only(self):
        if self._conveyor_busy or (self.process and self.process.poll() is None):
            messagebox.showwarning("Зайнято", "Дочекайтесь завершення поточної команди.")
            return
        if self._conveyor_mode.get() != "covenant":
            messagebox.showinfo("Режим", "Генерація гілки доступна в режимі «Нова гілка в завіті».")
            return
        self._conveyor = self._conveyor_build_session_base()
        self._conveyor["phase"] = "branch_preview"
        self._conveyor_save_session()
        self.tabview.set("Конвеєр")
        self._conveyor_branch_preview()

    def _conveyor_start(self):
        if self._conveyor_busy or (self.process and self.process.poll() is None):
            messagebox.showwarning("Зайнято", "Дочекайтесь завершення поточної команди.")
            return
        base = self._conveyor_build_session_base()
        q_count = base["counts"]["questions"]
        if q_count > 0 and not base["difficulties"]:
            messagebox.showwarning("Увага", "Оберіть хоча б один рівень складності.")
            return
        if base["mode"] == "existing" and not base["theme_id"]:
            messagebox.showwarning("Увага", "Оберіть тему або гілку (🌿).")
            return
        dest = "extensions/{0}.json".format(base["covenant"]) if base["target"] == "extensions" else base["theme_id"] + ".json"
        if not messagebox.askyesno("Конвеєр", "Зміни запишуться в data/topics-db/{0} (з .bak).\nПродовжити?".format(dest)):
            return
        self._conveyor = base
        anchor = self._conveyor_preview_anchor
        if anchor and anchor.get("id"):
            self._conveyor["review_parent_id"] = anchor["id"]
            self._conveyor["review_parent_title"] = anchor.get("title") or anchor["id"]
            self._conveyor_preview_anchor = None
        else:
            self._conveyor["review_parent_id"] = base["theme_id"]
            self._conveyor["review_parent_title"] = base.get("review_parent_title") or base["theme_id"]
        self._conveyor_save_session()
        self.tabview.set("Конвеєр")
        if base["mode"] == "covenant":
            self._conveyor["phase"] = "branch_preview"
            self._conveyor_status.configure(text="Крок 1: нова гілка ({0})…".format(self._conveyor_covenant_label()))
            self._conveyor_branch_preview()
        else:
            self._conveyor["phase"] = "l1_preview"
            parent_label = self._conveyor["review_parent_title"]
            if base["counts"]["l1"] <= 0:
                self._conveyor_status.configure(
                    text="Пропуск L1… (батько: {0})".format(parent_label),
                )
                self._conveyor_continue_after_branch()
            else:
                self._conveyor_status.configure(
                    text="Крок 1: категорії (L1) для «{0}»…".format(parent_label),
                )
                self._conveyor_preview_l1()

    def _conveyor_preview(self, parent_id, count, level_label, on_ok):
        c = self._conveyor
        parent_title = (c or {}).get("review_parent_title", parent_id)
        model = (c or {}).get("model", self.ai_model)
        self._conveyor_show_activity(
            "Генерація {0} для «{1}»".format(level_label, parent_title),
            "{0} вузлів · модель: {1}".format(count, model),
        )
        argv = self._conveyor_preview_argv("preview", parent_id, count)

        def done(data, err):
            if err or not data or not data.get("ok"):
                msg = (data or {}).get("error") or err or "невідома помилка"
                self._conveyor_show_activity("Помилка", msg[:200])
                messagebox.showerror("Конвеєр", msg)
                return
            on_ok(data.get("nodes") or [], data.get("uniqueness"))

        self._run_conveyor_json(argv, "preview " + level_label, done)

    def _conveyor_preview_l1(self):
        c = self._conveyor
        if c["counts"]["l1"] <= 0:
            self._conveyor_continue_after_branch()
            return
        pid = c.get("review_parent_id") or (c.get("branch") or {}).get("id") or c["theme_id"]
        c["review_parent_id"] = pid
        self._conveyor_preview(pid, c["counts"]["l1"], "L1",
                               lambda nodes, u=None: self._conveyor_on_preview_ready(1, nodes, u))

    def _conveyor_on_preview_ready(self, level, nodes, uniqueness=None):
        c = self._conveyor
        c["phase"] = "l{0}_preview".format(level)
        c["review_level"] = level
        c["pending_nodes"] = nodes
        if uniqueness:
            c["last_uniqueness"] = uniqueness
        self._conveyor_save_session()
        titles = {1: "Категорії (L1)", 2: "Підтеми (L2)", 3: "Підпідтеми (L3)"}
        self._conveyor_status.configure(text="Перевірте {0} для «{1}»".format(
            titles.get(level, "?"), c.get("review_parent_title", "")))
        self._conveyor_show_review(
            "{0} — {1}".format(titles.get(level, ""), c.get("review_parent_title", "")),
            nodes,
            uniqueness,
        )

    def _conveyor_approved_from_review(self):
        return [row["node"] for row in self._conveyor_review_rows if row["approved"].get()]

    def _conveyor_approve_all(self):
        if self._conveyor_busy or not self._conveyor_review_rows:
            return
        for row in self._conveyor_review_rows:
            self._conveyor_set_row_approved(row, True)
        self._conveyor_update_review_summary()
        self._conveyor_apply_review()

    def _conveyor_regenerate(self):
        c = self._conveyor
        if not c:
            return
        if c.get("phase") == "branch_preview" or self._conveyor_review_mode == "branch":
            self._conveyor_branch_regenerate()
            return
        lvl = c.get("review_level", 1)
        if lvl == 1:
            self._conveyor_preview_l1()
        elif lvl == 2:
            self._conveyor_preview_l2_current()
        elif lvl == 3:
            self._conveyor_preview_l3_current()

    def _conveyor_apply_review(self):
        approved = self._conveyor_approved_from_review()
        if not approved:
            messagebox.showinfo("Конвеєр", "Немає прийнятих вузлів.")
            return
        c = self._conveyor
        lvl = c.get("review_level", 1)
        path = self._conveyor_write_apply_file(approved)
        argv = self._conveyor_apply_argv(c["review_parent_id"], path)
        self._conveyor_show_activity(
            "Запис у topics-db (L{0})".format(lvl),
            "Зберігається {0} вузлів…".format(len(approved)),
        )
        self._conveyor_status.configure(text="Запис у topics-db…")

        def done(data, err):
            if err or not data or not data.get("ok"):
                messagebox.showerror("Конвеєр", (data or {}).get("error") or err or "apply failed")
                return
            if lvl == 1:
                c["l1_approved"] = approved
                if not c.get("enable_l2", True):
                    self._conveyor_go_questions_with_nodes(approved)
                    return
                c["l2_queue"] = [{"id": n["id"], "title": n.get("title", n["id"])} for n in approved]
                c["l2_index"] = 0
                c["phase"] = "l2_preview"
                self._conveyor_save_session()
                self._conveyor_status.configure(text="Підтеми (L2)…")
                self._conveyor_preview_l2_current()
            elif lvl == 2:
                pid = c["review_parent_id"]
                c.setdefault("l2_approved", {})[pid] = approved
                c["l2_index"] = c.get("l2_index", 0) + 1
                self._conveyor_save_session()
                if c["l2_index"] >= len(c.get("l2_queue", [])):
                    self._conveyor_after_l2_done()
                else:
                    self._conveyor_preview_l2_current()
            elif lvl == 3:
                pid = c["review_parent_id"]
                c.setdefault("l3_approved", {})[pid] = approved
                for n in approved:
                    leaf = {"id": n["id"], "title": n.get("title", n["id"])}
                    leaves = c.setdefault("leaves", [])
                    if not any(x.get("id") == leaf["id"] for x in leaves):
                        leaves.append(leaf)
                c["l3_index"] = c.get("l3_index", 0) + 1
                self._conveyor_save_session()
                if c["l3_index"] >= len(c.get("l3_queue", [])):
                    self._conveyor_questions_start()
                else:
                    self._conveyor_preview_l3_current()

        self._run_conveyor_json(argv, "apply L{0}".format(lvl), done)

    def _conveyor_after_l2_done(self):
        c = self._conveyor
        if not c.get("enable_l3", True) or c["counts"]["l3"] <= 0:
            nodes = []
            for items in c.get("l2_approved", {}).values():
                nodes.extend(items)
            if not nodes:
                nodes = c.get("l1_approved", [])
            if not nodes:
                parent = self._conveyor_parent_node()
                if parent.get("id"):
                    nodes = [parent]
            self._conveyor_go_questions_with_nodes(nodes)
            return
        self._conveyor_status.configure(text="Підпідтеми (L3)…")
        c["phase"] = "l3_auto"
        self._conveyor_l3_start()

    def _conveyor_preview_l2_current(self):
        c = self._conveyor
        if not c.get("enable_l2") or c["counts"]["l2"] <= 0:
            self._conveyor_after_l2_done()
            return
        q = c.get("l2_queue", [])
        idx = c.get("l2_index", 0)
        if idx >= len(q):
            self._conveyor_after_l2_done()
            return
        parent = q[idx]
        c["review_parent_id"] = parent["id"]
        c["review_parent_title"] = parent.get("title", parent["id"])
        self._conveyor_save_session()
        self._conveyor_preview(parent["id"], c["counts"]["l2"], "L2",
                               lambda nodes, u=None: self._conveyor_on_preview_ready(2, nodes, u))

    def _conveyor_preview_l3_current(self):
        c = self._conveyor
        if not c.get("enable_l3") or c["counts"]["l3"] <= 0:
            self._conveyor_questions_start()
            return
        q = c.get("l3_queue", [])
        idx = c.get("l3_index", 0)
        if idx >= len(q):
            self._conveyor_questions_start()
            return
        parent = q[idx]
        c["review_parent_id"] = parent["id"]
        c["review_parent_title"] = parent.get("title", parent["id"])
        c["phase"] = "l3_preview"
        self._conveyor_save_session()
        self._conveyor_preview(parent["id"], c["counts"]["l3"], "L3",
                               lambda nodes, u=None: self._conveyor_on_preview_ready(3, nodes, u))

    def _conveyor_l3_start(self):
        c = self._conveyor
        parents = []
        for item in c.get("l2_approved", {}).values():
            parents.extend(item)
        if not parents:
            nodes = c.get("l1_approved", [])
            if not nodes:
                parent = self._conveyor_parent_node()
                if parent.get("id"):
                    nodes = [parent]
            self._conveyor_go_questions_with_nodes(nodes)
            return
        c["l3_queue"] = [{"id": p["id"], "title": p.get("title", p["id"])} for p in parents]
        c["l3_index"] = 0
        c["leaves"] = []
        c["l3_approved"] = {}
        c["phase"] = "l3_preview"
        self._conveyor_save_session()
        self._conveyor_preview_l3_current()

    def _conveyor_questions_start(self):
        c = self._conveyor
        if not c.get("leaves"):
            self._conveyor_finish()
            return
        c["question_index"] = 0
        c["phase"] = "questions"
        self._conveyor_save_session()
        self._conveyor_question_next()

    def _conveyor_question_next(self):
        c = self._conveyor
        leaves = c.get("leaves", [])
        idx = c.get("question_index", 0)
        if idx >= len(leaves):
            self._conveyor_finish()
            return
        leaf = leaves[idx]
        diffs = ",".join(c.get("difficulties", ["baby", "child"]))
        self._conveyor_show_activity(
            "Питання {0}/{1}".format(idx + 1, len(leaves)),
            "«{0}» · {1} пит. · модель: {2}".format(
                leaf.get("title", leaf["id"]), c["counts"]["questions"], c.get("model", self.ai_model),
            ),
        )
        self._conveyor_status.configure(text="Питання {0}/{1}: {2}".format(
            idx + 1, len(leaves), leaf.get("title", leaf["id"])))
        self._conveyor_update_step()

        def on_complete(rc):
            if self._shutting_down or not c:
                return
            self._conveyor_set_stop_enabled(False)
            self._conveyor_stop_progress_indeterminate()
            if self._stop_requested:
                return
            c["question_index"] = idx + 1
            self._conveyor_save_session()
            self.after(300, self._conveyor_question_next)

        self._conveyor_set_stop_enabled(True)
        self._conveyor_start_progress_indeterminate()
        parts = ["--topic", leaf["id"], "--count", str(c["counts"]["questions"]),
                 "--difficulties", diffs,
                 "--provider", c.get("provider", self.ai_provider), "--model", c["model"]]
        self._run_npm("generate-ai", " ".join(parts),
                      "📝 {0}/{1} {2}".format(idx + 1, len(leaves), leaf["id"]),
                      on_complete=on_complete)

    def _conveyor_finish(self):
        self._conveyor = None
        try:
            if os.path.isfile(self._conveyor_session_path):
                os.remove(self._conveyor_session_path)
        except OSError:
            pass
        self._conveyor_hide_review()
        self._conveyor_status.configure(text="✅ Конвеєр завершено. Merge topics-db → questions:stats")
        messagebox.showinfo("Конвеєр",
                            "Готово.\n\n1. Merge topics-db\n2. npm run questions:stats")

    # ── Tab: Попередній перегляд ────────────────────────────────────────────

    def _preview_index_fresh(self, max_age_sec=600):
        if not os.path.isfile(self._preview_index_path):
            return False
        try:
            age = time.time() - os.path.getmtime(self._preview_index_path)
            return age < max_age_sec
        except OSError:
            return False

    def _preview_load_cache(self):
        data = _load_json(self._preview_index_path)
        if isinstance(data, dict) and data.get("nodes"):
            self._preview_index = data
            return True
        return False

    def _preview_ensure_index(self, force=False):
        if not force and self._preview_index_fresh() and self._preview_load_cache():
            self._preview_rebuild_tree()
            self._preview_update_summary()
            return
        if self._preview_busy:
            return
        self._preview_busy = True
        if hasattr(self, "_preview_status"):
            self._preview_status.configure(text="Індексування…")
        if hasattr(self, "_preview_progress"):
            self._preview_progress.start()

        def work():
            rc = 1
            data = None
            err = None
            node = _resolve_executable("node")
            script = os.path.join(self.script_dir, "topic-preview-index.mjs")
            try:
                if node and os.path.isfile(script):
                    flags = getattr(subprocess, "CREATE_NO_WINDOW", 0) if os.name == "nt" else 0
                    proc = subprocess.run(
                        [node, script, "--write", "--json"],
                        cwd=self.project_root,
                        capture_output=True,
                        text=True,
                        encoding="utf-8",
                        errors="replace",
                        env=self._launcher_subprocess_env(),
                        creationflags=flags,
                        timeout=300,
                    )
                    rc = proc.returncode
                    line = (proc.stdout or "").strip().split("\n")[-1].strip()
                    if line:
                        data = json.loads(line)
            except Exception as ex:
                err = str(ex)

            def finish():
                self._preview_busy = False
                if hasattr(self, "_preview_progress"):
                    self._preview_progress.stop()
                if err or not data or not data.get("ok"):
                    msg = (data or {}).get("error") if data else err
                    msg = msg or "Не вдалося побудувати індекс"
                    if hasattr(self, "_preview_status"):
                        self._preview_status.configure(text=msg)
                    if not self._preview_load_cache():
                        messagebox.showwarning("Перегляд", msg)
                    return
                self._preview_index = data
                self._preview_rebuild_tree()
                self._preview_update_summary()
                if hasattr(self, "_preview_status"):
                    self._preview_status.configure(text="Готово")
                focus = getattr(self, "_preview_pending_focus", None)
                if focus:
                    self._preview_pending_focus = None
                    self._preview_focus_node(focus)

            self._safe_after(finish)

        threading.Thread(target=work, daemon=True).start()

    def _preview_update_summary(self):
        if not hasattr(self, "_preview_summary") or not self._preview_index:
            return
        idx = self._preview_index
        gen = idx.get("generatedAt", "")[:19].replace("T", " ")
        self._preview_summary.configure(
            text="Вузлів: {0}  ·  Питань: {1}  ·  Без тегу: {2}  ·  {3}".format(
                idx.get("totalNodes", 0),
                idx.get("totalQuestions", 0),
                idx.get("untaggedCount", 0),
                gen,
            ),
        )

    def _preview_apply_tree_style(self):
        style = ttk.Style()
        try:
            mode = ctk.get_appearance_mode()
        except Exception:
            mode = "Dark"
        if mode == "Light":
            bg, fg, field = "#ffffff", "#24292f", "#f4f6f8"
        else:
            bg, fg, field = "#252b33", "#f0f6fc", "#1c2128"
        style.theme_use("clam")
        style.configure("Preview.Treeview", background=field, foreground=fg, fieldbackground=field, rowheight=26)
        style.configure("Preview.Treeview.Heading", background=bg, foreground=fg)
        style.map("Preview.Treeview", background=[("selected", "#0550ae" if mode == "Light" else "#388bfd")])

    def _preview_row_tag(self, node):
        if node.get("isAggregate"):
            return "aggregate"
        if node.get("isExtension"):
            return "extension"
        sc = node.get("subtreeCount", 0)
        if sc <= 0:
            return "count_zero"
        if sc < 5:
            return "count_low"
        return "count_ok"

    def _preview_rebuild_tree(self):
        if not self._preview_tree or not self._preview_index:
            return
        tree = self._preview_tree
        for iid in tree.get_children(""):
            tree.delete(iid)
        self._preview_tree_iid_map = {}
        self._preview_node_by_iid = {}

        nodes = self._preview_index.get("nodes", [])
        scope = self._preview_filter_scope.get() if hasattr(self, "_preview_filter_scope") else "all"
        search = (self._preview_search_var.get() if hasattr(self, "_preview_search_var") else "").strip().lower()
        only_q = self._preview_only_with_q.get() if hasattr(self, "_preview_only_with_q") else False
        show_agg = self._preview_show_aggregate.get() if hasattr(self, "_preview_show_aggregate") else False

        visible_ids = set()
        ot_themes = set(GROUPS_CONF.get("old-testament", {}).get("theme_ids", []))
        nt_themes = set(GROUPS_CONF.get("new-testament", {}).get("theme_ids", []))
        for n in nodes:
            path = n.get("path", "")
            tid = n.get("themeId") or ""
            nid = n.get("id", "")
            if scope == "old-testament":
                if "Старий Завіт" not in path and not nid.startswith("ot-custom") and tid not in ot_themes:
                    continue
            if scope == "new-testament":
                if "Новий Завіт" not in path and not nid.startswith("nt-custom") and tid not in nt_themes:
                    continue
            if only_q and n.get("subtreeCount", 0) <= 0:
                continue
            if search:
                blob = "{0} {1} {2}".format(n.get("title", ""), n.get("id", ""), n.get("path", "")).lower()
                if search not in blob:
                    continue
            visible_ids.add(n["id"])

        id_to_node = {n["id"]: n for n in nodes}
        for nid in list(visible_ids):
            parts = (id_to_node.get(nid) or {}).get("path", "").split(" > ")
            for i in range(1, len(parts)):
                pass
        for n in nodes:
            if n["id"] not in visible_ids:
                continue
            path_parts = n.get("path", "").split(" > ")
            if len(path_parts) > 1:
                parent_path = " > ".join(path_parts[:-1])
                for pn in nodes:
                    if pn.get("path") == parent_path:
                        visible_ids.add(pn["id"])
                        break

        children_map = {}
        for n in nodes:
            if n["id"] not in visible_ids:
                continue
            path_parts = n.get("path", "").split(" > ")
            parent_path = " > ".join(path_parts[:-1]) if len(path_parts) > 1 else ""
            children_map.setdefault(parent_path, []).append(n)

        def insert_under(parent_path, parent_iid=""):
            for n in sorted(children_map.get(parent_path, []), key=lambda x: x.get("title", "")):
                if n.get("isAggregate") and not show_agg:
                    continue
                prefix = "🌿 " if n.get("isExtension") else ""
                title = "{0}{1} {2}".format(prefix, n.get("icon", ""), n.get("title", ""))
                iid = tree.insert(
                    parent_iid, "end", text=title,
                    values=(
                        "L{0}".format(n.get("depth", 0)),
                        n.get("directCount", 0),
                        n.get("subtreeCount", 0),
                    ),
                    tags=(self._preview_row_tag(n),),
                )
                self._preview_tree_iid_map[n["id"]] = iid
                self._preview_node_by_iid[iid] = n
                child_path = n.get("path", "")
                insert_under(child_path, iid)

        insert_under("")

    def _preview_focus_node(self, node_id):
        iid = self._preview_tree_iid_map.get(node_id)
        if not iid or not self._preview_tree:
            self._preview_pending_focus = node_id
            return
        parent = self._preview_tree.parent(iid)
        while parent:
            self._preview_tree.item(parent, open=True)
            parent = self._preview_tree.parent(parent)
        self._preview_tree.selection_set(iid)
        self._preview_tree.see(iid)
        self._preview_on_select(None)

    def _preview_on_select(self, _event):
        if not self._preview_tree:
            return
        sel = self._preview_tree.selection()
        if not sel:
            return
        n = self._preview_node_by_iid.get(sel[0])
        if not n or not hasattr(self, "_preview_detail_id"):
            return
        self._preview_detail_id.configure(text=n.get("id", ""))
        self._preview_detail_path.configure(text=n.get("path", ""))
        self._preview_detail_desc.configure(
            text=(n.get("description") or "—")[:500],
        )
        self._preview_selected_node = n

    def _preview_on_double(self, _event):
        if not self._preview_tree:
            return
        sel = self._preview_tree.selection()
        if not sel:
            return
        iid = sel[0]
        if self._preview_tree.get_children(iid):
            open_ = self._preview_tree.item(iid, "open")
            self._preview_tree.item(iid, open=not open_)

    def _preview_collapse_all(self):
        if not self._preview_tree:
            return

        def close(iid):
            for ch in self._preview_tree.get_children(iid):
                close(ch)
            self._preview_tree.item(iid, open=False)

        for root in self._preview_tree.get_children(""):
            close(root)

    def _preview_expand_to_depth(self, max_depth):
        if not self._preview_tree:
            return
        for iid, n in self._preview_node_by_iid.items():
            if n.get("depth", 0) < max_depth:
                self._preview_tree.item(iid, open=True)
            else:
                self._preview_tree.item(iid, open=False)

    def _preview_expand_all(self):
        if not self._preview_index:
            return
        n_nodes = len(self._preview_index.get("nodes", []))
        if n_nodes > 200:
            if not messagebox.askyesno("Перегляд", "Розгорнути {0} вузлів? Це може зайняти час.".format(n_nodes)):
                return
        if not self._preview_tree:
            return

        def open_all(iid):
            self._preview_tree.item(iid, open=True)
            for ch in self._preview_tree.get_children(iid):
                open_all(ch)

        for root in self._preview_tree.get_children(""):
            open_all(root)

    def _preview_copy_id(self):
        n = getattr(self, "_preview_selected_node", None)
        if not n:
            return
        text = n.get("id", "")
        if HAS_PYPERCLIP:
            pyperclip.copy(text)
        self._set_status("Скопійовано: " + text, self._semantic()["green"])

    def _preview_open_in_conveyor(self):
        n = getattr(self, "_preview_selected_node", None)
        if not n:
            messagebox.showinfo("Перегляд", "Оберіть вузол у дереві.")
            return
        nid = n.get("id", "")
        if not nid or n.get("isAggregate"):
            messagebox.showinfo(
                "Перегляд",
                "Оберіть звичайну категорію (не *-all і не корінь «Біблія»).",
            )
            return
        if self._conveyor_busy or (self.process and self.process.poll() is None):
            if not messagebox.askyesno(
                "Конвеєр",
                "Зараз виконується команда. Зупинити й відкрити обраний вузол?",
            ):
                return
            self._stop_process()
        self._conveyor_cancel_silent()
        self.tabview.set("Конвеєр")
        self._ensure_tab_built("Конвеєр")
        self._conveyor_preview_anchor = {
            "id": nid,
            "title": n.get("title") or nid,
            "depth": n.get("depth", 0),
            "themeId": n.get("themeId"),
        }
        if nid.startswith("ot-custom") or nid.startswith("nt-custom"):
            cov = "new-testament" if nid.startswith("nt-") else "old-testament"
            self._conveyor_covenant.set(cov)
            self._conveyor_mode.set("existing")
            self._conveyor_on_covenant_change()
            for item in self._conveyor_existing_items_cache:
                if item["id"] == nid:
                    self._conveyor_theme.set(item["label"])
                    break
        else:
            theme_id = n.get("themeId") or nid
            cov = "new-testament" if theme_id in GROUPS_CONF.get("new-testament", {}).get("theme_ids", []) else "old-testament"
            self._conveyor_covenant.set(cov)
            self._conveyor_mode.set("existing")
            self._conveyor_on_covenant_change()
            label = None
            for item in self._conveyor_existing_items_cache:
                if item["id"] == theme_id:
                    label = item["label"]
                    break
            if label:
                self._conveyor_theme.set(label)
        depth = n.get("depth", 0)
        hint = "Обрано: «{0}» ({1}).".format(n.get("title") or nid, nid)
        if depth >= 3:
            hint += " Для підтем тут: L1=0, увімкніть L2 або L3 → ▶ Запустити."
        elif depth >= 2:
            hint += " Можна L1=0 і лише L2/L3 → ▶ Запустити."
        else:
            hint += " ▶ Запустити — додасть підтеми під цей вузол."
        self._conveyor_status.configure(text=hint)

    def _build_tab_preview(self, parent):
        parent.grid_columnconfigure(0, weight=1)
        parent.grid_rowconfigure(1, weight=1)

        top = ctk.CTkFrame(parent, fg_color="transparent")
        top.grid(row=0, column=0, sticky="ew", padx=8, pady=(6, 4))
        top.grid_columnconfigure(1, weight=1)
        hdr = ctk.CTkFrame(top, fg_color="transparent")
        hdr.grid(row=0, column=0, sticky="w")
        ctk.CTkLabel(hdr, text="🗂 Попередній перегляд ієрархії", font=FONT_H).pack(side="left")
        self._help_button(hdr, "topic-preview").pack(side="left", padx=(8, 0))
        ctk.CTkButton(
            top, text="Оновити", width=100, height=BTN_H, font=FONT_SM,
            command=lambda: self._preview_ensure_index(force=True),
        ).grid(row=0, column=2, sticky="e")

        toolbar = ctk.CTkFrame(top, fg_color="transparent")
        toolbar.grid(row=0, column=1, sticky="e", padx=8)
        self._preview_search_var = tk.StringVar()
        self._preview_search_var.trace_add("write", lambda *_: self._preview_rebuild_tree())
        ctk.CTkEntry(toolbar, textvariable=self._preview_search_var, width=160, height=CTRL_H,
                     placeholder_text="Пошук…").pack(side="right", padx=4)
        self._preview_only_with_q = tk.BooleanVar(value=False)
        ctk.CTkCheckBox(
            toolbar, text="Лише з питаннями", variable=self._preview_only_with_q,
            font=FONT_SM, command=self._preview_rebuild_tree,
        ).pack(side="right", padx=4)
        self._preview_show_aggregate = tk.BooleanVar(value=False)
        ctk.CTkCheckBox(
            toolbar, text="*-all", variable=self._preview_show_aggregate,
            font=FONT_SM, command=self._preview_rebuild_tree,
        ).pack(side="right", padx=4)
        self._preview_filter_scope = tk.StringVar(value="all")
        ctk.CTkComboBox(
            toolbar, variable=self._preview_filter_scope, width=140, height=CTRL_H,
            values=["all", "old-testament", "new-testament"],
            command=lambda _: self._preview_rebuild_tree(),
        ).pack(side="right", padx=4)

        body = ctk.CTkFrame(parent, fg_color="transparent")
        body.grid(row=1, column=0, sticky="nsew", padx=8, pady=(0, 8))
        body.grid_columnconfigure(0, weight=3)
        body.grid_columnconfigure(1, weight=2)
        body.grid_rowconfigure(0, weight=1)

        tree_card = ctk.CTkFrame(body, fg_color=UI["card_bg"], border_width=1, border_color=UI["card_border"])
        tree_card.grid(row=0, column=0, sticky="nsew", padx=(0, 6))
        tree_card.grid_rowconfigure(1, weight=1)
        tree_card.grid_columnconfigure(0, weight=1)

        btn_row = ctk.CTkFrame(tree_card, fg_color="transparent")
        btn_row.grid(row=0, column=0, sticky="ew", padx=8, pady=8)
        for txt, cmd in [
            ("Розгорнути все", self._preview_expand_all),
            ("Згорнути все", self._preview_collapse_all),
            ("До L1", lambda: self._preview_expand_to_depth(1)),
            ("До L2", lambda: self._preview_expand_to_depth(2)),
        ]:
            ctk.CTkButton(btn_row, text=txt, width=110, height=BTN_H, font=FONT_SM, command=cmd).pack(side="left", padx=(0, 6))

        tree_host = tk.Frame(tree_card, bg=UI["card_bg"][1] if ctk.get_appearance_mode() == "Dark" else UI["card_bg"][0])
        tree_host.grid(row=1, column=0, sticky="nsew", padx=8, pady=(0, 8))
        tree_host.grid_rowconfigure(0, weight=1)
        tree_host.grid_columnconfigure(0, weight=1)

        self._preview_apply_tree_style()
        self._preview_tree = ttk.Treeview(
            tree_host, style="Preview.Treeview", columns=("depth", "direct", "subtree"),
            show="tree headings", selectmode="browse",
        )
        self._preview_tree.heading("#0", text="Категорія")
        self._preview_tree.heading("depth", text="Рівень")
        self._preview_tree.heading("direct", text="Прямі")
        self._preview_tree.heading("subtree", text="Усього")
        self._preview_tree.column("#0", width=320, minwidth=120)
        self._preview_tree.column("depth", width=52, anchor="center")
        self._preview_tree.column("direct", width=52, anchor="e")
        self._preview_tree.column("subtree", width=52, anchor="e")
        vsb = ttk.Scrollbar(tree_host, orient="vertical", command=self._preview_tree.yview)
        self._preview_tree.configure(yscrollcommand=vsb.set)
        self._preview_tree.grid(row=0, column=0, sticky="nsew")
        vsb.grid(row=0, column=1, sticky="ns")
        self._preview_tree.bind("<<TreeviewSelect>>", self._preview_on_select)
        self._preview_tree.bind("<Double-1>", self._preview_on_double)
        s = self._semantic()
        self._preview_tree.tag_configure("count_zero", foreground=TEXT_SUB[1] if ctk.get_appearance_mode() == "Dark" else TEXT_SUB[0])
        self._preview_tree.tag_configure("count_low", foreground=s["orange"])
        self._preview_tree.tag_configure("count_ok", foreground=s["green"])
        self._preview_tree.tag_configure("extension", foreground=s["purple"])
        self._preview_tree.tag_configure("aggregate", foreground=TEXT_MUTED[1] if ctk.get_appearance_mode() == "Dark" else TEXT_MUTED[0])

        detail = ctk.CTkFrame(body, fg_color=UI["card_bg"], border_width=1, border_color=UI["card_border"])
        detail.grid(row=0, column=1, sticky="nsew")
        detail.grid_columnconfigure(0, weight=1)
        ctk.CTkLabel(detail, text="Деталі вузла", font=FONT_H).grid(row=0, column=0, sticky="w", padx=12, pady=(12, 8))
        self._preview_detail_id = ctk.CTkLabel(detail, text="—", font=FONT_MONO, anchor="w", justify="left", wraplength=280)
        self._preview_detail_id.grid(row=1, column=0, sticky="w", padx=12)
        ctk.CTkLabel(detail, text="Шлях:", font=FONT_SM, text_color=TEXT_MUTED).grid(row=2, column=0, sticky="w", padx=12, pady=(8, 0))
        self._preview_detail_path = ctk.CTkLabel(detail, text="—", font=FONT_SM, anchor="w", justify="left", wraplength=280)
        self._preview_detail_path.grid(row=3, column=0, sticky="w", padx=12)
        ctk.CTkLabel(detail, text="Опис:", font=FONT_SM, text_color=TEXT_MUTED).grid(row=4, column=0, sticky="w", padx=12, pady=(8, 0))
        self._preview_detail_desc = ctk.CTkLabel(detail, text="—", font=FONT_SM, anchor="nw", justify="left", wraplength=280)
        self._preview_detail_desc.grid(row=5, column=0, sticky="nw", padx=12, pady=(0, 8))
        act_d = ctk.CTkFrame(detail, fg_color="transparent")
        act_d.grid(row=6, column=0, sticky="ew", padx=12, pady=8)
        ctk.CTkButton(act_d, text="Копіювати ID", width=120, height=BTN_H, font=FONT_SM,
                      command=self._preview_copy_id).pack(side="left", padx=(0, 8))
        ctk.CTkButton(act_d, text="У Конвеєрі", width=120, height=BTN_H, font=FONT_SM,
                      fg_color=s["cyan"], command=self._preview_open_in_conveyor).pack(side="left")

        foot = ctk.CTkFrame(parent, fg_color="transparent")
        foot.grid(row=2, column=0, sticky="ew", padx=8, pady=(0, 6))
        self._preview_summary = ctk.CTkLabel(foot, text="", font=FONT_SM, text_color=TEXT_MUTED, anchor="w")
        self._preview_summary.pack(side="left")
        self._preview_status = ctk.CTkLabel(foot, text="", font=FONT_SM, text_color=TEXT_MUTED, anchor="e")
        self._preview_status.pack(side="right")
        self._preview_progress = ctk.CTkProgressBar(foot, width=120, height=8, mode="indeterminate")
        self._preview_progress.pack(side="right", padx=8)

        self._preview_selected_node = None
        self._preview_pending_focus = None
        self.after(300, lambda: self._preview_ensure_index(force=False))

    # ── Tab: Якість тем ─────────────────────────────────────────────────────

    def _build_tab_quality(self, parent):
        parent.grid_rowconfigure(4, weight=1)

        hdr = ctk.CTkFrame(parent, fg_color="transparent")
        hdr.grid(row=0, column=0, sticky="ew", padx=4, pady=(4, 0))
        hdr.grid_columnconfigure(0, weight=1)
        title_hdr = ctk.CTkFrame(hdr, fg_color="transparent")
        title_hdr.grid(row=0, column=0, sticky="w")
        ctk.CTkLabel(title_hdr, text="🔍 Аналіз якості тем", font=FONT_H,
                     text_color=self._semantic()["orange"]).pack(side="left")
        run_hdr = ctk.CTkFrame(hdr, fg_color="transparent")
        run_hdr.grid(row=0, column=1, sticky="e")
        ctk.CTkButton(run_hdr, text="Перевірка якості", width=150, height=BTN_H, font=FONT_BTN,
                      command=self._run_topic_analysis).pack(side="left")
        self._help_button(run_hdr, "analyze-topics").pack(side="left", padx=(4, 0))

        meta = ctk.CTkFrame(parent, fg_color="transparent")
        meta.grid(row=1, column=0, sticky="ew", padx=8, pady=(4, 0))
        meta.grid_columnconfigure(0, weight=1)
        self.q_subtitle = ctk.CTkLabel(
            meta, text="Завантажиться зі збереженого звіту або натисніть «Перевірка якості»",
            font=FONT_SM, text_color=TEXT_MUTED, anchor="w",
        )
        self.q_subtitle.grid(row=0, column=0, sticky="w")

        flt = ctk.CTkFrame(meta, fg_color="transparent")
        flt.grid(row=0, column=1, sticky="e")
        ctk.CTkLabel(flt, text="Файл:", font=FONT_SM, text_color=TEXT_MUTED).pack(side="left")
        self.q_filter_file = tk.StringVar(value="all")
        self.q_filter_combo = ctk.CTkComboBox(flt, variable=self.q_filter_file, values=["all"],
                                              width=160, height=CTRL_H, font=FONT_DD,
                                              command=lambda _: self._refresh_quality_list())
        self.q_filter_combo.set("all")
        self.q_filter_combo.pack(side="left", padx=4)
        ctk.CTkLabel(flt, text="Бал:", font=FONT_SM, text_color=TEXT_MUTED).pack(side="left", padx=(6, 0))
        self.q_min_score, w1 = self._spinbox(flt, 0, 100, 3, "0")
        w1.pack(side="left", padx=2)
        ctk.CTkLabel(flt, text="–", font=FONT_SM, text_color=TEXT_MUTED).pack(side="left")
        self.q_max_score, w2 = self._spinbox(flt, 0, 100, 3, "100")
        w2.pack(side="left", padx=2)
        filt_cell = ctk.CTkFrame(flt, fg_color="transparent")
        filt_cell.pack(side="left", padx=(8, 0))
        ctk.CTkButton(filt_cell, text="Фільтр", width=90, height=BTN_H, font=FONT_BTN,
                      command=self._refresh_quality_list).pack(side="left")
        self._help_button(filt_cell, "quality-filter").pack(side="left", padx=(4, 0))

        self.q_stat_frame = ctk.CTkFrame(parent, fg_color="transparent")
        self.q_stat_frame.grid(row=2, column=0, sticky="w", padx=8, pady=(4, 0))

        self.quality_action_panel = ctk.CTkFrame(parent, corner_radius=8, border_width=1,
                                                  fg_color=UI["card_bg"],
                                                  border_color=UI["card_border"])

        self.q_list_frame = ctk.CTkFrame(parent, corner_radius=8, border_width=1,
                                         fg_color=UI["card_bg"],
                                         border_color=UI["card_border"])
        self.q_list_frame.grid(row=4, column=0, sticky="nsew", padx=4, pady=4)
        self.q_list_frame.grid_columnconfigure(0, weight=1)
        self.q_list_frame.grid_rowconfigure(0, weight=1)

        self.q_textbox = ctk.CTkTextbox(
            self.q_list_frame, font=FONT_MONO, wrap="none", activate_scrollbars=True,
        )
        self.q_textbox.grid(row=0, column=0, sticky="nsew", padx=2, pady=2)
        self.q_text = self.q_textbox._textbox
        self.q_text.configure(state="normal", undo=False, cursor="arrow")
        self.q_text.bind("<Key>", lambda e: "break")
        self.q_text.bind("<Control-c>", self._copy_selection)
        self.q_text.bind("<Button-1>", self._on_topic_press)
        self.q_text.bind("<ButtonRelease-1>", self._on_topic_release)
        self._setup_quality_tags()

        self.q_text.insert("end", "\n  Відкрийте вкладку — покажемо збережений звіт\n", "dim")
        self.q_text.configure(state="disabled")

    def _format_report_date(self, report):
        raw = report.get("generatedAt", "")
        if not raw:
            return ""
        try:
            from datetime import datetime
            dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
            return dt.strftime("%d.%m.%Y %H:%M")
        except Exception:
            return raw[:16].replace("T", " ")

    def _ensure_quality_cached(self):
        if self._quality_cache_loaded:
            return
        self._quality_cache_loaded = True
        self._load_quality_from_report(silent=True)

    def _report_to_results(self, report):
        results = []
        for item in report.get("breadth", []):
            score = item.get("breadthScore", item.get("breadth", 0))
            results.append({
                "file_id": item.get("fileId", "?"),
                "id": item.get("id", "?"),
                "title": item.get("title", "?"),
                "icon": item.get("icon", "\U0001f4d6"),
                "description": item.get("description", ""),
                "depth": item.get("depth", 0),
                "breadth": score,
                "desc_score": 0,
                "themeId": item.get("themeId"),
                "issues": item.get("issues", []),
                "children": item.get("childCount", item.get("children", 0)),
                "parent_id": item.get("parentId"),
            })
        return results

    def _load_quality_from_report(self, silent=False):
        report = _load_json(self.report_path)
        if report and report.get("breadth"):
            self._show_quality_results(self._report_to_results(report), cached=True, report=report)
        elif not silent:
            self.q_subtitle.configure(text="Натисніть «Перевірка якості»")
            self.q_text.configure(state="normal")
            self.q_text.delete("1.0", "end")
            self.q_text.insert("end", "\n  Немає збереженого звіту. Натисніть «Перевірка якості».\n", "dim")
            self.q_text.configure(state="disabled")

    def _run_topic_analysis(self):
        if self._analysis_running:
            return
        if self.process and self.process.poll() is None:
            messagebox.showwarning("Зайнято", "Дочекайтесь завершення поточної команди.")
            return

        self._analysis_running = True

        def complete(rc):
            self._analysis_running = False
            if self._shutting_down:
                return
            if rc == 0:
                self._quality_cache_loaded = True
                self._load_quality_from_report()

        self._execute("npm.cmd run analyze-topics", "🔍 Перевірка якості тем", on_complete=complete)

    def _show_quality_results(self, results, cached=False, report=None):
        self._topic_results = results
        all_files = sorted(set(r["file_id"] for r in results if r["file_id"] != "?"))
        self.q_filter_combo.configure(command=None)
        self.q_filter_combo.configure(values=["all"] + all_files)
        self.q_filter_combo.set("all")
        self.q_filter_combo.configure(command=lambda _: self._refresh_quality_list())

        poor = sum(1 for r in results if r["breadth"] < 30)
        mid = sum(1 for r in results if 30 <= r["breadth"] < 60)
        good = sum(1 for r in results if r["breadth"] >= 60)
        label = "{0} підтем • найгірші перші".format(len(results))
        if cached:
            when = self._format_report_date(report or {})
            label += " • зі збереженого звіту" + (" ({0})".format(when) if when else "")
        self.q_subtitle.configure(text=label)

        for w in self.q_stat_frame.winfo_children():
            w.destroy()
        s = self._semantic()
        for txt, col in [("\U0001f534 {0}".format(poor), s["red"]),
                         ("\U0001f7e1 {0}".format(mid), s["orange"]),
                         ("\U0001f7e2 {0}".format(good), s["green"])]:
            ctk.CTkLabel(self.q_stat_frame, text=txt, font=FONT_BTN,
                         text_color=col).pack(side="left", padx=(0, 8))
        ctk.CTkLabel(self.q_stat_frame, text="\U0001f4e6 {0} всього".format(len(results)),
                     font=FONT_SM, text_color=TEXT_MUTED).pack(side="left", padx=(6, 0))
        self._schedule_quality_list_refresh()

    def _schedule_quality_list_refresh(self):
        if self._quality_list_job:
            self.after_cancel(self._quality_list_job)
        self._quality_list_job = self.after(1, self._refresh_quality_list)

    def _breadth_tag(self, score):
        if score < 30:
            return "red"
        if score < 60:
            return "orange"
        return "green"

    def _refresh_quality_list(self, event=None):
        self._quality_list_job = None
        self.q_text.configure(state="normal")
        self.q_text.delete("1.0", "end")
        try:
            min_s = int(self.q_min_score.get())
        except Exception:
            min_s = 0
        try:
            max_s = int(self.q_max_score.get())
        except Exception:
            max_s = 100
        file_filter = self.q_filter_file.get()

        filtered = [r for r in self._topic_results
                    if min_s <= r["breadth"] <= max_s
                    and (file_filter == "all" or r["file_id"] == file_filter)]
        if not filtered:
            self.q_text.insert("end", "  Немає результатів\n", "dim")
            self.q_text.configure(state="disabled")
            return

        CAT_MAP = {}
        for gid, ginfo in GROUPS_CONF.items():
            for tid in ginfo["theme_ids"]:
                CAT_MAP[tid] = ginfo["title"]
            CAT_MAP[gid] = ginfo["title"]

        FILE_NAMES = {}
        for r in filtered:
            gkey = r.get("themeId") or r["file_id"]
            if gkey not in FILE_NAMES:
                if gkey in THEMES_DICT:
                    FILE_NAMES[gkey] = THEMES_DICT[gkey]
                elif gkey in GROUPS_CONF:
                    FILE_NAMES[gkey] = "Збірка: " + GROUPS_CONF[gkey]["title"]
                elif r["file_id"] not in FILE_NAMES:
                    FILE_NAMES[r["file_id"]] = r["file_id"]

        by_zavit = {}
        for r in filtered:
            cat = CAT_MAP.get(r.get("themeId") or r["file_id"], "Інше")
            gkey = r.get("themeId") or r["file_id"]
            by_zavit.setdefault(cat, {}).setdefault(gkey, []).append(r)

        click_map = {}
        line_num = 1
        tagged_lines = []
        chunks = []
        for zav_name in sorted(by_zavit.keys()):
            files_dict = by_zavit[zav_name]
            total_zav = sum(len(v) for v in files_dict.values())
            chunks.append("\n  {0} ({1})\n".format(zav_name, total_zav))
            line_num += 2
            for fid in sorted(files_dict.keys(), key=lambda x: FILE_NAMES.get(x, x)):
                items = files_dict[fid]
                fname = FILE_NAMES.get(fid, fid)
                root_for_file = next((it for it in items if it["depth"] == 1), items[0])
                chunks.append("    ── {0} ({1}) ──\n".format(fname, len(items)))
                click_map[str(line_num)] = root_for_file
                line_num += 1
                for r in items:
                    indent = "    " + "  " * max(0, r["depth"] - 1)
                    icon = r.get("icon", "\U0001f4d6")
                    chunks.append("{0}{1} {2}  [{3}/100]\n".format(
                        indent, icon, r["title"], r["breadth"]))
                    tagged_lines.append((line_num, r["breadth"]))
                    click_map[str(line_num)] = r
                    line_num += 1

        tb = self.q_text
        tb.insert("1.0", "".join(chunks))
        tag = self._breadth_tag
        for ln, score in tagged_lines:
            tb.tag_add(tag(score), "{0}.0".format(ln), "{0}.end".format(ln))

        self._topic_click_map = click_map
        self.q_text.configure(state="disabled")

    def _on_topic_press(self, event):
        self._topic_click_pos = (event.x, event.y)

    def _on_topic_release(self, event):
        if not hasattr(self, "_topic_click_pos"):
            return
        if abs(event.x - self._topic_click_pos[0]) > 5 or abs(event.y - self._topic_click_pos[1]) > 5:
            return
        try:
            self.q_text.get(tk.SEL_FIRST, tk.SEL_LAST)
            return
        except tk.TclError:
            pass
        idx = self.q_text.index("@{0},{1}".format(self._topic_click_pos[0], self._topic_click_pos[1]))
        line = idx.split(".")[0]
        r = self._topic_click_map.get(line)
        if r:
            self._open_topic_actions(r)

    # ── Topic actions / editor ────────────────────────────────────────────────

    def _hide_quality_actions(self):
        if not hasattr(self, "quality_action_panel"):
            return
        self.quality_action_panel.grid_forget()
        for w in self.quality_action_panel.winfo_children():
            w.destroy()

    def _open_topic_actions(self, r):
        self._hide_quality_actions()
        self.tabview.set("Якість тем")
        file_id = r["file_id"]
        panel = self.quality_action_panel
        panel.grid(row=3, column=0, sticky="ew", padx=4, pady=(0, 4))

        hdr = ctk.CTkFrame(panel, fg_color="transparent")
        hdr.pack(fill="x", padx=14, pady=(12, 4))
        hdr.grid_columnconfigure(0, weight=1)
        ctk.CTkLabel(hdr, text="📝 Дії з темою", font=FONT_TITLE).grid(row=0, column=0, sticky="w")
        ctk.CTkButton(hdr, text="✕", width=32, height=28, fg_color="transparent", text_color=TEXT_MUTED,
                      hover=False, command=self._hide_quality_actions).grid(row=0, column=1)

        ctk.CTkLabel(
            panel, text="ID: {0}  |  Файл: {1}  |  Ширина: {2}/100".format(r["id"], file_id, r["breadth"]),
            font=FONT_SM, text_color=TEXT_MUTED, anchor="w",
        ).pack(fill="x", padx=14, pady=(0, 8))

        form = ctk.CTkScrollableFrame(panel, fg_color="transparent", height=200)
        form.pack(fill="x", padx=14, pady=(0, 12))

        topic_opts = self._build_topic_tree_options(file_id)
        if not topic_opts:
            topic_opts = [("?", r["id"], r["depth"])]

        current_idx = next((i for i, t in enumerate(topic_opts) if t[1] == r["id"]), 0)
        self.tg_topic_var = tk.StringVar()
        self.tg_topic_combo = ctk.CTkComboBox(
            form, variable=self.tg_topic_var,
            values=[t[0] for t in topic_opts], width=500, font=FONT_DD,
        )
        self.tg_topic_combo.pack(fill="x", pady=4)
        self.tg_topic_combo.set(topic_opts[current_idx][0])

        cnt_frame = ctk.CTkFrame(form, fg_color="transparent")
        cnt_frame.pack(fill="x", pady=4)
        ctk.CTkLabel(cnt_frame, text="Питань:", font=FONT_SM, text_color=TEXT_MUTED).pack(side="left")
        self.tg_count, w = self._spinbox(cnt_frame, 1, 100, 5, "15")
        w.pack(side="left", padx=8)
        ctk.CTkLabel(cnt_frame, text="Складність:", font=FONT_SM, text_color=TEXT_MUTED).pack(side="left", padx=(12, 4))
        self.tg_diff = ctk.CTkComboBox(cnt_frame, values=[d[0] for d in DIFFICULTIES], width=100, font=FONT_DD)
        self.tg_diff.set("all")
        self.tg_diff.pack(side="left")

        def _get_selected_id():
            sel = self.tg_topic_var.get()
            for lbl, nid, dep in topic_opts:
                if lbl == sel:
                    return nid, dep
            return r["id"], r["depth"]

        def _gen_one():
            nid, _ = _get_selected_id()
            cnt = self.tg_count.get()
            diff = self.tg_diff.get()
            self._run_npm("generate-ai",
                          "--topic {0} --count {1} --difficulty {2} {3}".format(
                              nid, cnt, diff, self._ai_cli_suffix()),
                          "📝 Генерація: " + nid)

        def _gen_all_children():
            nid, _ = _get_selected_id()
            cnt = int(self.tg_count.get() or 15)
            child_ids = []
            cur = next((x for x in self._topic_results if x["id"] == nid), r)

            def collect(pid):
                for x in self._topic_results:
                    if x.get("parent_id") == pid:
                        child_ids.append(x["id"])
                        collect(x["id"])
            collect(cur["id"])
            if not child_ids:
                messagebox.showinfo("Інформація", "Немає підтем")
                return
            if len(child_ids) > 10 and not messagebox.askyesno("Підтвердження",
                    "{0} підтем × {1} питань. Продовжити?".format(len(child_ids), cnt)):
                return
            cmds = " && ".join(
                "npm.cmd run generate-ai -- --topic {0} --count {1} --difficulty {2} {3}".format(
                    c, cnt, self.tg_diff.get(), self._ai_cli_suffix()) for c in child_ids)
            self._execute(cmds, "📝 Генерація для {0} підтем".format(len(child_ids)))

        def _ai_topic(action):
            nid, _ = _get_selected_id()
            extra = ""
            if action in ("improve-all", "add-children"):
                extra = "--count 3"
            cmd = "node scripts/ai-topic-edit.mjs --action {0} --file {1} --node {2} {3} {4}".format(
                action, file_id, nid, extra, self._ai_cli_suffix())
            self._execute(cmd, "🤖 " + action + ": " + nid)

        btn_frame = ctk.CTkFrame(form, fg_color="transparent")
        btn_frame.pack(fill="x", pady=8)
        for txt, cmd, help_key in [
            ("📝 Ця тема", _gen_one, "topic-gen-one"),
            ("📝 Всі підтеми", _gen_all_children, "topic-gen-children"),
            ("🌿 Категорії", lambda: self._run_npm("generate-topics", "--theme " + file_id, "🌿 Категорії"), "topic-gen-categories"),
            ("✎ Редаг.", lambda: self._open_topic_editor(r), "topic-edit"),
            ("⚖ Баланс", lambda: self._open_balance_for_node(_get_selected_id()[0]), "topic-balance"),
        ]:
            cell = ctk.CTkFrame(btn_frame, fg_color="transparent")
            cell.pack(side="left", padx=(0, 4))
            ctk.CTkButton(cell, text=txt, width=100, height=BTN_H, font=FONT_SM,
                          command=cmd).pack(side="left")
            self._help_button(cell, help_key).pack(side="left", padx=(2, 0))

        ai_frame = ctk.CTkFrame(form, fg_color="transparent")
        ai_frame.pack(fill="x", pady=4)
        s = self._semantic()
        for act, txt, help_key in [
            ("improve-desc", "🤖 Опис", "ai-improve-desc"),
            ("suggest-icon", "🤖 Іконка", "ai-suggest-icon"),
            ("add-children", "🤖 +підтеми", "ai-add-children"),
            ("organize-children", "🤖 Сорт.", "ai-organize-children"),
            ("improve-all", "🤖 All", "ai-improve-all"),
        ]:
            cell = ctk.CTkFrame(ai_frame, fg_color="transparent")
            cell.pack(side="left", padx=(0, 4))
            ctk.CTkButton(cell, text=txt, width=90, height=BTN_H, font=FONT_SM,
                          fg_color=s["purple"], hover=False,
                          command=lambda a=act: _ai_topic(a)).pack(side="left")
            self._help_button(cell, help_key).pack(side="left", padx=(2, 0))
        del_cell = ctk.CTkFrame(ai_frame, fg_color="transparent")
        del_cell.pack(side="left", padx=(0, 4))
        ctk.CTkButton(del_cell, text="🗑", width=40, height=BTN_H, font=FONT_SM,
                      fg_color=s["red"], hover=False,
                      command=lambda: _ai_topic("delete-node") if messagebox.askyesno("Видалити?", "Назавжди?") else None
                      ).pack(side="left")
        self._help_button(del_cell, "ai-delete-node").pack(side="left", padx=(2, 0))

    def _build_topic_tree_options(self, file_id):
        path = os.path.join(self.topics_dir, "{0}.json".format(file_id))
        root = _load_json(path)
        if not root:
            return []
        return [("{0} {1} ({2})".format("• " * d, n.get("title", "?"), n.get("id", "?")), n.get("id", "?"), d)
                for n, d, _, _ in _flatten_nodes(root, 0, file_id)]

    def _open_topic_editor(self, r):
        self._hide_quality_actions()
        panel = self.quality_action_panel
        panel.grid(row=3, column=0, sticky="ew", padx=4, pady=(0, 4))

        hdr = ctk.CTkFrame(panel, fg_color="transparent")
        hdr.pack(fill="x", padx=14, pady=(12, 4))
        ctk.CTkLabel(hdr, text="✎ Редагування", font=FONT_TITLE).pack(side="left")
        ctk.CTkButton(hdr, text="✕", width=32, height=28, fg_color="transparent", text_color=TEXT_MUTED,
                      hover=False, command=self._hide_quality_actions).pack(side="right")

        form = ctk.CTkFrame(panel, fg_color="transparent")
        form.pack(fill="x", padx=14, pady=(0, 12))
        form.grid_columnconfigure(1, weight=1)

        fields = {}
        row = 0
        for label, key, multi in [("Іконка", "icon", False), ("Назва", "title", False), ("Опис", "desc", True)]:
            ctk.CTkLabel(form, text=label, font=FONT_SM, text_color=TEXT_MUTED).grid(row=row, column=0, sticky="w", pady=3)
            if multi:
                txt = ctk.CTkTextbox(form, height=72, font=FONT_DD)
                txt.insert("1.0", r.get("description", ""))
                txt.grid(row=row, column=1, sticky="ew", padx=(8, 0))
                fields[key] = txt
            else:
                val = r.get("icon", "📖") if key == "icon" else r["title"]
                ent = ctk.CTkEntry(form, font=FONT_DD)
                ent.insert(0, val)
                ent.grid(row=row, column=1, sticky="ew", padx=(8, 0))
                fields[key] = ent
            row += 1

        def save():
            path = os.path.join(self.topics_dir, "{0}.json".format(r["file_id"]))
            root = _load_json(path)
            if not root:
                messagebox.showerror("Помилка", "Файл не знайдено")
                return

            def update(node):
                if node.get("id") == r["id"]:
                    node["icon"] = fields["icon"].get()
                    node["title"] = fields["title"].get()
                    node["description"] = fields["desc"].get("1.0", "end-1c").strip()
                    return True
                for ch in node.get("children", []):
                    if update(ch):
                        return True
                return False

            if update(root) and _save_json(path, root):
                messagebox.showinfo("✅", "Збережено")
                self._hide_quality_actions()
                self._load_quality_from_report()
            else:
                messagebox.showerror("❌", "Помилка збереження")

        br = ctk.CTkFrame(form, fg_color="transparent")
        br.grid(row=row, column=0, columnspan=2, pady=12)
        s = self._semantic()
        ctk.CTkButton(br, text="💾 Зберегти", fg_color=s["green"], hover=False,
                      command=save).pack(side="left", padx=4)
        ctk.CTkButton(br, text="◀ Назад", fg_color=UI["muted_btn"],
                      text_color=UI["muted_btn_text"], command=self._hide_quality_actions).pack(side="left")

    # ── Tab: Якість питань ──────────────────────────────────────────────────

    def _normalize_reference(self, reference):
        if reference is None:
            return ""
        if isinstance(reference, list):
            return "; ".join(str(r).strip() for r in reference if str(r).strip())
        return str(reference).strip()

    def _collect_questions_index(self, include_embedded=True):
        index = {}
        if os.path.isdir(self.questions_db_dir):
            for fname in os.listdir(self.questions_db_dir):
                if not fname.endswith(".json"):
                    continue
                theme_id = fname[:-5]
                data = _load_json(os.path.join(self.questions_db_dir, fname)) or []
                if not isinstance(data, list):
                    continue
                for q in data:
                    if isinstance(q, dict) and q.get("id"):
                        index[q["id"]] = {**q, "_source": "db", "_theme_file": theme_id}
        if include_embedded:
            export_script = os.path.join(self.script_dir, "export-all-questions.mjs")
            if os.path.isfile(export_script):
                flags = getattr(subprocess, "CREATE_NO_WINDOW", 0) if os.name == "nt" else 0
                try:
                    proc = subprocess.run(
                        ["node", "--import", "tsx", export_script],
                        cwd=self.project_root,
                        capture_output=True,
                        text=True,
                        encoding="utf-8",
                        errors="replace",
                        timeout=120,
                        creationflags=flags,
                    )
                    if proc.returncode == 0 and proc.stdout.strip():
                        for q in json.loads(proc.stdout):
                            qid = q.get("id")
                            if qid:
                                prev = index.get(qid, {})
                                if prev.get("_theme_file") and not q.get("_theme_file"):
                                    q["_theme_file"] = prev["_theme_file"]
                                index[qid] = q
                except Exception:
                    pass
        return index

    def _finish_questions_index_refresh(self):
        callbacks = self._questions_index_callbacks
        self._questions_index_callbacks = []
        self._questions_index_loading = False
        for callback in callbacks:
            try:
                callback()
            except Exception:
                pass

    def _refresh_questions_index(self, on_done=None, include_embedded=True, async_=True):
        if on_done:
            self._questions_index_callbacks.append(on_done)
        if self._questions_index_loading:
            return

        def apply(index):
            if not self._shutting_down:
                self._questions_by_id = index
            self._finish_questions_index_refresh()

        if not async_:
            apply(self._collect_questions_index(include_embedded))
            return

        self._questions_index_loading = True

        def work():
            try:
                index = self._collect_questions_index(include_embedded)
            except Exception:
                index = dict(self._questions_by_id)

            def upd():
                apply(index)

            self._safe_after(upd)

        threading.Thread(target=work, daemon=True).start()

    def _build_tab_question_quality(self, parent):
        parent.grid_rowconfigure(5, weight=1)

        hdr = ctk.CTkFrame(parent, fg_color="transparent")
        hdr.grid(row=0, column=0, sticky="ew", padx=4, pady=(4, 0))
        hdr.grid_columnconfigure(0, weight=1)
        title_hdr = ctk.CTkFrame(hdr, fg_color="transparent")
        title_hdr.grid(row=0, column=0, sticky="w")
        ctk.CTkLabel(title_hdr, text="🔍 Якість питань", font=FONT_H,
                     text_color=self._semantic()["cyan"]).pack(side="left")
        run_hdr = ctk.CTkFrame(hdr, fg_color="transparent")
        run_hdr.grid(row=0, column=1, sticky="e")
        ctk.CTkButton(run_hdr, text="Перевірка якості", width=150, height=BTN_H, font=FONT_BTN,
                      command=self._run_question_analysis).pack(side="left")
        self._help_button(run_hdr, "analyze-quality-tab").pack(side="left", padx=(4, 0))

        meta = ctk.CTkFrame(parent, fg_color="transparent")
        meta.grid(row=1, column=0, sticky="ew", padx=8, pady=(4, 0))
        meta.grid_columnconfigure(0, weight=1)
        self.qq_subtitle = ctk.CTkLabel(
            meta,
            text="Завантажиться з question-quality-report.json або натисніть «Перевірка якості»",
            font=FONT_SM, text_color=TEXT_MUTED, anchor="w",
        )
        self.qq_subtitle.grid(row=0, column=0, sticky="w")

        flt = ctk.CTkFrame(meta, fg_color="transparent")
        flt.grid(row=0, column=1, sticky="e")
        ctk.CTkLabel(flt, text="Статус:", font=FONT_SM, text_color=TEXT_MUTED).pack(side="left")
        self.qq_status_filter = tk.StringVar(value="all")
        self.qq_status_combo = ctk.CTkComboBox(
            flt, variable=self.qq_status_filter,
            values=["all", "quarantined", "pending", "approved", "rejected"],
            width=120, height=CTRL_H, font=FONT_DD,
            command=lambda _: self._refresh_question_quality_list(),
        )
        self.qq_status_combo.set("all")
        self.qq_status_combo.pack(side="left", padx=4)
        ctk.CTkLabel(flt, text="Тема:", font=FONT_SM, text_color=TEXT_MUTED).pack(side="left", padx=(6, 0))
        self.qq_theme_filter = tk.StringVar(value="all")
        self.qq_theme_combo = ctk.CTkComboBox(
            flt, variable=self.qq_theme_filter, values=["all"],
            width=140, height=CTRL_H, font=FONT_DD,
            command=lambda _: self._refresh_question_quality_list(),
        )
        self.qq_theme_combo.set("all")
        self.qq_theme_combo.pack(side="left", padx=4)
        ctk.CTkLabel(flt, text="Проблема:", font=FONT_SM, text_color=TEXT_MUTED).pack(side="left", padx=(6, 0))
        self.qq_issue_filter = tk.StringVar(value="all")
        self.qq_issue_combo = ctk.CTkComboBox(
            flt, variable=self.qq_issue_filter,
            values=["all", "duplicate", "unclear_reference", "wrong_difficulty", "ambiguous", "typo", "theological_error"],
            width=150, height=CTRL_H, font=FONT_DD,
            command=lambda _: self._refresh_question_quality_list(),
        )
        self.qq_issue_combo.set("all")
        self.qq_issue_combo.pack(side="left", padx=4)
        ctk.CTkLabel(flt, text="Бал:", font=FONT_SM, text_color=TEXT_MUTED).pack(side="left", padx=(6, 0))
        self.qq_min_score, w1 = self._spinbox(flt, 0, 100, 3, "0")
        w1.pack(side="left", padx=2)
        ctk.CTkLabel(flt, text="–", font=FONT_SM, text_color=TEXT_MUTED).pack(side="left")
        self.qq_max_score, w2 = self._spinbox(flt, 0, 100, 3, "100")
        w2.pack(side="left", padx=2)
        filt_cell = ctk.CTkFrame(flt, fg_color="transparent")
        filt_cell.pack(side="left", padx=(8, 0))
        ctk.CTkButton(filt_cell, text="Фільтр", width=90, height=BTN_H, font=FONT_BTN,
                      command=self._refresh_question_quality_list).pack(side="left")
        self._help_button(filt_cell, "question-quality-filter").pack(side="left", padx=(4, 0))

        self.qq_stat_frame = ctk.CTkFrame(parent, fg_color="transparent")
        self.qq_stat_frame.grid(row=2, column=0, sticky="w", padx=8, pady=(4, 0))

        self.qq_bulk_frame = ctk.CTkFrame(parent, fg_color="transparent")
        self.qq_bulk_frame.grid(row=3, column=0, sticky="ew", padx=8, pady=(4, 0))
        self.qq_bulk_count = ctk.CTkLabel(
            self.qq_bulk_frame, text="У фільтрі: 0", font=FONT_SM, text_color=TEXT_MUTED,
        )
        self.qq_bulk_count.pack(side="left", padx=(0, 10))
        s_bulk = self._semantic()
        bulk_specs = [
            ("✅ Схвалити всі", self._bulk_approve_filtered, s_bulk["green"], "question-bulk-approve"),
            ("❌ Видалити AI", self._bulk_delete_filtered, s_bulk["red"], "question-bulk-delete"),
            ("🔄 Зняти дублікати", self._bulk_deduplicate_filtered, s_bulk["orange"], "question-bulk-dedupe"),
            ("🤖 AI правка", self._bulk_ai_fix_filtered, s_bulk["purple"], "question-bulk-ai"),
        ]
        for txt, cmd, color, help_key in bulk_specs:
            cell = ctk.CTkFrame(self.qq_bulk_frame, fg_color="transparent")
            cell.pack(side="left", padx=(0, 4))
            ctk.CTkButton(cell, text=txt, width=130, height=30, font=FONT_SM,
                          fg_color=color, hover=False, command=cmd).pack(side="left")
            self._help_button(cell, help_key).pack(side="left", padx=(2, 0))

        self.qq_action_panel = ctk.CTkFrame(parent, corner_radius=8, border_width=1,
                                            fg_color=UI["card_bg"], border_color=UI["card_border"])

        self.qq_list_frame = ctk.CTkFrame(parent, corner_radius=8, border_width=1,
                                          fg_color=UI["card_bg"], border_color=UI["card_border"])
        self.qq_list_frame.grid(row=5, column=0, sticky="nsew", padx=4, pady=4)
        self.qq_list_frame.grid_columnconfigure(0, weight=1)
        self.qq_list_frame.grid_rowconfigure(0, weight=1)

        self.qq_textbox = ctk.CTkTextbox(
            self.qq_list_frame, font=FONT_MONO, wrap="none", activate_scrollbars=True,
        )
        self.qq_textbox.grid(row=0, column=0, sticky="nsew", padx=2, pady=2)
        self.qq_text = self.qq_textbox._textbox
        self.qq_text.configure(state="normal", undo=False, cursor="arrow")
        self.qq_text.bind("<Key>", lambda e: "break")
        self.qq_text.bind("<Control-c>", self._copy_selection)
        self.qq_text.bind("<Button-1>", self._on_question_press)
        self.qq_text.bind("<ButtonRelease-1>", self._on_question_release)
        self._setup_quality_tags(self.qq_text)

        self.qq_text.insert("end", "\n  Відкрийте вкладку — покажемо збережений звіт\n", "dim")
        self.qq_text.configure(state="disabled")

    def _ensure_question_quality_cached(self):
        if self._question_quality_cache_loaded:
            return
        self._question_quality_cache_loaded = True
        self._load_question_quality_from_report(silent=True)
        self._refresh_questions_index(
            on_done=lambda: self._load_question_quality_from_report(silent=True),
        )

    def _report_to_question_rows(self, report):
        rows = []
        for item in report.get("reports", []):
            qid = item.get("questionId", "?")
            q = self._questions_by_id.get(qid, {})
            rows.append({
                "questionId": qid,
                "status": item.get("status", "pending"),
                "qualityScore": item.get("qualityScore", 0),
                "ambiguityScore": item.get("ambiguityScore", 0),
                "issues": item.get("issues", []),
                "duplicateIds": item.get("duplicateIds", []),
                "themeId": q.get("themeId", "?"),
                "difficulty": q.get("difficulty", "?"),
                "text": q.get("text", qid),
                "source": q.get("_source", "?"),
            })
        return rows

    def _load_question_quality_from_report(self, silent=False):
        report = _load_json(self.question_report_path)
        if report and report.get("reports"):
            self._show_question_quality_results(self._report_to_question_rows(report), cached=True, report=report)
        elif not silent:
            self.qq_subtitle.configure(text="Натисніть «Перевірка якості»")
            self.qq_text.configure(state="normal")
            self.qq_text.delete("1.0", "end")
            self.qq_text.insert("end", "\n  Немає збереженого звіту. Натисніть «Перевірка якості».\n", "dim")
            self.qq_text.configure(state="disabled")

    def _run_question_analysis(self):
        if self._question_analysis_running:
            return
        if self.process and self.process.poll() is None:
            messagebox.showwarning("Зайнято", "Дочекайтесь завершення поточної команди.")
            return
        self._question_analysis_running = True

        def complete(rc):
            self._question_analysis_running = False
            if self._shutting_down:
                return
            if rc == 0:
                self._question_quality_cache_loaded = True
                self._refresh_questions_index(on_done=self._load_question_quality_from_report)

        self._run_npm("analyze-quality", "", "🔍 Перевірка якості питань", on_complete=complete)

    def _show_question_quality_results(self, results, cached=False, report=None):
        self._question_results = results
        themes = sorted(set(r["themeId"] for r in results if r["themeId"] != "?"))
        self.qq_theme_combo.configure(command=None)
        self.qq_theme_combo.configure(values=["all"] + themes)
        self.qq_theme_combo.set("all")
        self.qq_theme_combo.configure(command=lambda _: self._refresh_question_quality_list())

        quarantined = sum(1 for r in results if r["status"] == "quarantined")
        pending = sum(1 for r in results if r["status"] == "pending")
        approved = sum(1 for r in results if r["status"] == "approved")
        label = "{0} питань у звіті".format(len(results))
        if cached:
            when = self._format_report_date(report or {})
            label += " • зі збереженого звіту" + (" ({0})".format(when) if when else "")
        self.qq_subtitle.configure(text=label)

        for w in self.qq_stat_frame.winfo_children():
            w.destroy()
        s = self._semantic()
        for txt, col in [
            ("\U0001f534 {0}".format(quarantined), s["red"]),
            ("\U0001f7e1 {0}".format(pending), s["orange"]),
            ("\U0001f7e2 {0}".format(approved), s["green"]),
        ]:
            ctk.CTkLabel(self.qq_stat_frame, text=txt, font=FONT_BTN, text_color=col).pack(side="left", padx=(0, 8))
        ctk.CTkLabel(self.qq_stat_frame, text="\U0001f4e6 {0} всього".format(len(results)),
                     font=FONT_SM, text_color=TEXT_MUTED).pack(side="left", padx=(6, 0))
        self._schedule_question_list_refresh()

    def _schedule_question_list_refresh(self):
        if self._question_list_job:
            self.after_cancel(self._question_list_job)
        self._question_list_job = self.after(1, self._refresh_question_quality_list)

    def _question_status_tag(self, status, score):
        if status == "quarantined":
            return "red"
        if status == "pending":
            return "orange"
        if score >= 80:
            return "green"
        return "dim"

    def _get_filtered_question_rows(self):
        try:
            min_s = int(self.qq_min_score.get())
        except Exception:
            min_s = 0
        try:
            max_s = int(self.qq_max_score.get())
        except Exception:
            max_s = 100
        status_filter = self.qq_status_filter.get()
        theme_filter = self.qq_theme_filter.get()
        issue_filter = self.qq_issue_filter.get()

        filtered = []
        for r in self._question_results:
            if not (min_s <= r["qualityScore"] <= max_s):
                continue
            if status_filter != "all" and r["status"] != status_filter:
                continue
            if theme_filter != "all" and r["themeId"] != theme_filter:
                continue
            if issue_filter != "all":
                if not any(i.get("type") == issue_filter for i in r.get("issues", [])):
                    continue
            filtered.append(r)

        filtered.sort(key=lambda x: (
            0 if x["status"] == "quarantined" else 1 if x["status"] == "pending" else 2,
            x["qualityScore"],
        ))
        return filtered

    def _update_qq_bulk_count(self, count):
        if hasattr(self, "qq_bulk_count"):
            self.qq_bulk_count.configure(text="У фільтрі: {0}".format(count))

    def _refresh_question_quality_list(self, event=None):
        self._question_list_job = None
        self.qq_text.configure(state="normal")
        self.qq_text.delete("1.0", "end")

        filtered = self._get_filtered_question_rows()
        self._qq_filtered_rows = filtered
        self._update_qq_bulk_count(len(filtered))

        if not filtered:
            self.qq_text.insert("end", "  Немає результатів\n", "dim")
            self.qq_text.configure(state="disabled")
            return

        click_map = {}
        line_num = 1
        tagged_lines = []
        chunks = []
        by_theme = {}
        for r in filtered:
            by_theme.setdefault(r["themeId"], []).append(r)

        for theme_id in sorted(by_theme.keys()):
            items = by_theme[theme_id]
            tname = THEMES_DICT.get(theme_id, theme_id)
            chunks.append("\n  {0} ({1})\n".format(tname, len(items)))
            line_num += 2
            for r in items:
                preview = r["text"][:70] + ("…" if len(r["text"]) > 70 else "")
                status_icon = {"quarantined": "\u26d4", "pending": "\u23f3", "approved": "\u2705"}.get(r["status"], "\u2022")
                issue_hint = ""
                highs = [i for i in r.get("issues", []) if i.get("severity") == "high"]
                if highs:
                    issue_hint = " — " + highs[0].get("message", "")[:50]
                elif r.get("issues"):
                    issue_hint = " — " + r["issues"][0].get("type", "")
                chunks.append("    {0} [{1}/100] {2} · {3}\n      {4}{5}\n".format(
                    status_icon, r["qualityScore"], r["difficulty"], r["questionId"], preview, issue_hint))
                tagged_lines.append((line_num, r["status"], r["qualityScore"]))
                click_map[str(line_num)] = r
                click_map[str(line_num + 1)] = r
                line_num += 2

        tb = self.qq_text
        tb.insert("1.0", "".join(chunks))
        for ln, status, score in tagged_lines:
            tb.tag_add(self._question_status_tag(status, score), "{0}.0".format(ln), "{0}.end".format(ln))

        self._question_click_map = click_map
        self.qq_text.configure(state="disabled")

    def _on_question_press(self, event):
        self._question_click_pos = (event.x, event.y)

    def _on_question_release(self, event):
        if not hasattr(self, "_question_click_pos"):
            return
        if abs(event.x - self._question_click_pos[0]) > 5 or abs(event.y - self._question_click_pos[1]) > 5:
            return
        try:
            self.qq_text.get(tk.SEL_FIRST, tk.SEL_LAST)
            return
        except tk.TclError:
            pass
        idx = self.qq_text.index("@{0},{1}".format(self._question_click_pos[0], self._question_click_pos[1]))
        line = idx.split(".")[0]
        r = self._question_click_map.get(line)
        if r:
            self._open_question_actions(r)

    def _hide_question_actions(self):
        if hasattr(self, "qq_action_panel"):
            self.qq_action_panel.grid_forget()
            for w in self.qq_action_panel.winfo_children():
                w.destroy()
        if hasattr(self, "qq_bulk_frame"):
            self.qq_bulk_frame.grid()

    def _show_question_action_panel(self):
        self.qq_bulk_frame.grid_remove()
        self.qq_action_panel.grid(row=4, column=0, sticky="ew", padx=4, pady=(0, 4))

    def _recalc_question_report_summary(self, report):
        reports = report.get("reports", [])
        summary = report.setdefault("summary", {})
        summary["total"] = len(reports)
        summary["approved"] = sum(1 for r in reports if r.get("status") == "approved")
        summary["quarantined"] = sum(1 for r in reports if r.get("status") == "quarantined")
        summary["pending"] = sum(1 for r in reports if r.get("status") == "pending")
        summary["rejected"] = sum(1 for r in reports if r.get("status") == "rejected")

    def _recalc_question_report_issue_types(self, report):
        issue_types = {}
        for item in report.get("reports", []):
            for issue in item.get("issues", []):
                issue_type = issue.get("type")
                if issue_type:
                    issue_types[issue_type] = issue_types.get(issue_type, 0) + 1
        report.setdefault("summary", {})["issueTypes"] = issue_types

    def _apply_dedupe_report_cleanup(self, report, clusters):
        losers = set()
        keepers = set()
        for cluster in clusters:
            keeper, cluster_losers = self._pick_cluster_keeper(cluster)
            keepers.add(keeper)
            losers.update(cluster_losers)

        for item in report.get("reports", []):
            qid = item.get("questionId")
            duplicate_ids = item.get("duplicateIds") or []
            item["duplicateIds"] = [dup for dup in duplicate_ids if dup not in losers]

            issues = item.get("issues") or []
            if qid in losers or qid in keepers or not item["duplicateIds"]:
                item["issues"] = [i for i in issues if i.get("type") != "duplicate"]

        self._recalc_question_report_issue_types(report)
        return len(losers), len(keepers)

    def _update_question_report_status(self, question_id, status):
        return self._batch_update_question_reports({question_id: status})

    def _batch_update_question_reports(self, status_map):
        if not status_map:
            return False
        report = _load_json(self.question_report_path)
        if not report:
            return False
        from datetime import datetime
        now = datetime.now().isoformat()
        updated = 0
        for item in report.get("reports", []):
            qid = item.get("questionId")
            if qid in status_map:
                item["status"] = status_map[qid]
                item["reviewedAt"] = now
                updated += 1
        if updated == 0:
            return False
        self._recalc_question_report_summary(report)
        return _save_json(self.question_report_path, report)

    def _batch_exclude_questions_from_report(self, question_ids):
        if not question_ids:
            return 0
        report = _load_json(self.question_report_path)
        if not report:
            return 0
        ids = set(question_ids)
        excluded = set(report.get("excludedQuestionIds") or [])
        excluded.update(ids)
        report["excludedQuestionIds"] = sorted(excluded)
        before = len(report.get("reports", []))
        report["reports"] = [
            item for item in report.get("reports", [])
            if item.get("questionId") not in ids
        ]
        removed = before - len(report["reports"])
        self._recalc_question_report_summary(report)
        self._recalc_question_report_issue_types(report)
        if not _save_json(self.question_report_path, report):
            return 0
        return removed

    def _batch_delete_db_questions(self, question_ids):
        by_theme = {}
        for qid in question_ids:
            q = self._questions_by_id.get(qid, {})
            if q.get("_source") != "db":
                continue
            theme_id = q.get("_theme_file") or q.get("themeId")
            if theme_id:
                by_theme.setdefault(theme_id, set()).add(qid)
        deleted = 0
        for theme_id, ids in by_theme.items():
            path = os.path.join(self.questions_db_dir, "{0}.json".format(theme_id))
            data = _load_json(path) or []
            if not isinstance(data, list):
                continue
            new_data = [q for q in data if q.get("id") not in ids]
            if len(new_data) == len(data):
                continue
            if _save_json(path, new_data):
                deleted += len(ids)
                for qid in ids:
                    self._questions_by_id.pop(qid, None)
        return deleted

    def _bulk_approve_filtered(self):
        rows = self._qq_filtered_rows
        if not rows:
            messagebox.showinfo("Інфо", "Немає питань у фільтрі")
            return
        if not messagebox.askyesno(
            "Масове схвалення",
            "Схвалити {0} питань з поточного фільтра?\nОновиться звіт і question-db.".format(len(rows)),
        ):
            return
        status_map = {r["questionId"]: "approved" for r in rows}
        if not self._batch_update_question_reports(status_map):
            messagebox.showerror("❌", "Не вдалось оновити звіт")
            return
        for r in rows:
            qobj = self._questions_by_id.get(r["questionId"])
            if qobj and qobj.get("_source") == "db":
                updated = {k: v for k, v in qobj.items() if not str(k).startswith("_")}
                updated["quarantined"] = False
                self._save_db_question(updated)
        messagebox.showinfo("✅", "Схвалено: {0}".format(len(rows)))
        self._load_question_quality_from_report()

    def _bulk_delete_filtered(self):
        rows = self._qq_filtered_rows
        if not rows:
            messagebox.showinfo("Інфо", "Немає питань у фільтрі")
            return
        db_rows = [r for r in rows if self._questions_by_id.get(r["questionId"], {}).get("_source") == "db"]
        emb_rows = [r for r in rows if r not in db_rows]
        all_ids = [r["questionId"] for r in rows]
        msg = "Прибрати {0} питань зі звіту якості?".format(len(rows))
        if db_rows:
            msg += "\n• AI з question-db: {0} (видалення з JSON)".format(len(db_rows))
        if emb_rows:
            msg += (
                "\n• Вбудовані з questions.ts: {0} (лише зі звіту, у грі лишаться до правки в IDE)"
                .format(len(emb_rows))
            )
        if not messagebox.askyesno("Масове видалення", msg):
            return
        deleted = self._batch_delete_db_questions([r["questionId"] for r in db_rows])
        removed = self._batch_exclude_questions_from_report(all_ids)
        messagebox.showinfo(
            "✅",
            "Видалено з question-db: {0}\nПрибрано зі звіту: {1}\nExcluded (не повернуться при аналізі): {2}".format(
                deleted, removed, len(all_ids)),
        )
        self._refresh_questions_index(on_done=self._load_question_quality_from_report)

    def _find_duplicate_clusters(self, rows):
        known_ids = {r["questionId"] for r in self._question_results}
        seed_ids = {r["questionId"] for r in rows}
        visited = set()
        clusters = []

        def neighbors(qid):
            result = set()
            row = next((x for x in self._question_results if x["questionId"] == qid), None)
            if row:
                for dup in row.get("duplicateIds", []):
                    if dup in known_ids:
                        result.add(dup)
            for x in self._question_results:
                if qid in x.get("duplicateIds", []):
                    result.add(x["questionId"])
            return result

        for qid in seed_ids:
            if qid in visited:
                continue
            cluster = set()
            stack = [qid]
            while stack:
                cur = stack.pop()
                if cur in visited:
                    continue
                visited.add(cur)
                cluster.add(cur)
                for nb in neighbors(cur):
                    if nb not in visited:
                        stack.append(nb)
            if len(cluster) > 1 and cluster & seed_ids:
                clusters.append(cluster)
        return clusters

    def _pick_cluster_keeper(self, cluster_ids):
        candidates = []
        for qid in cluster_ids:
            row = next((x for x in self._question_results if x["questionId"] == qid), None)
            q = self._questions_by_id.get(qid, {})
            score = row["qualityScore"] if row else 0
            bonus = 3 if q.get("_source") == "embedded" else 0
            candidates.append((score + bonus, qid))
        candidates.sort(reverse=True)
        keeper = candidates[0][1]
        losers = [c[1] for c in candidates[1:]]
        return keeper, losers

    def _bulk_deduplicate_filtered(self):
        rows = self._qq_filtered_rows
        if not rows:
            messagebox.showinfo("Інфо", "Немає питань у фільтрі")
            return
        clusters = self._find_duplicate_clusters(rows)
        if not clusters:
            messagebox.showinfo("Інфо", "У фільтрі немає груп дублікатів")
            return
        total_losers = sum(len(c) - 1 for c in clusters)
        if not messagebox.askyesno(
            "Зняти дублікати",
            "Знайдено {0} груп дублікатів.\n"
            "У кожній лишиться 1 питання; решта ({1}) — видалення з БД або rejected.\nПродовжити?".format(
                len(clusters), total_losers),
        ):
            return
        status_map = {}
        delete_ids = []
        for cluster in clusters:
            keeper, losers = self._pick_cluster_keeper(cluster)
            status_map[keeper] = "approved"
            for qid in losers:
                q = self._questions_by_id.get(qid, {})
                if q.get("_source") == "db":
                    delete_ids.append(qid)
                    status_map[qid] = "rejected"
                else:
                    status_map[qid] = "rejected"
        deleted = self._batch_delete_db_questions(delete_ids)
        report = _load_json(self.question_report_path)
        if not report:
            messagebox.showerror("❌", "Не вдалось оновити question-quality-report.json")
            return
        from datetime import datetime
        now = datetime.now().isoformat()
        updated = 0
        for item in report.get("reports", []):
            qid = item.get("questionId")
            if qid in status_map:
                item["status"] = status_map[qid]
                item["reviewedAt"] = now
                updated += 1
        loser_count, keeper_count = self._apply_dedupe_report_cleanup(report, clusters)
        self._recalc_question_report_summary(report)
        if not _save_json(self.question_report_path, report):
            messagebox.showerror("❌", "Не вдалось зберегти question-quality-report.json")
            return
        for qid, st in status_map.items():
            if st == "approved":
                qobj = self._questions_by_id.get(qid)
                if qobj and qobj.get("_source") == "db":
                    updated = {k: v for k, v in qobj.items() if not str(k).startswith("_")}
                    updated["quarantined"] = False
                    self._save_db_question(updated)
        messagebox.showinfo(
            "✅",
            "Груп: {0}, видалено з БД: {1}, оновлено звіт: {2}\n"
            "Прибрано duplicate-проблем: {3}, схвалено: {4}".format(
                len(clusters), deleted, updated, loser_count, keeper_count),
        )
        self._refresh_questions_index(on_done=self._load_question_quality_from_report)

    def _bulk_ai_fix_filtered(self):
        rows = self._qq_filtered_rows
        if not rows:
            messagebox.showinfo("Інфо", "Немає питань у фільтрі")
            return
        if self.process and self.process.poll() is None:
            messagebox.showwarning("Зайнято", "Дочекайтесь завершення поточної команди.")
            return
        est_min = max(1, len(rows) // 2)
        if not messagebox.askyesno(
            "AI масова правка",
            "Ollama перепише/допише {0} питань з поточного фільтра.\n\n"
            "• Виправить формулювання, посилання, дублікати\n"
            "• Збереже у question-db (перекриє вбудовані з тим же id)\n"
            "• Схвалить у звіті після успішної правки\n\n"
            "Орієнтовно {1}+ хв. Потрібен ollama serve.\n\nПродовжити?".format(
                len(rows), est_min),
        ):
            return
        parts = list(self._ai_args())
        st = self.qq_status_filter.get()
        if st and st != "all":
            parts.extend(["--status", st])
        th = self.qq_theme_filter.get()
        if th and th != "all":
            parts.extend(["--theme", th])
        iss = self.qq_issue_filter.get()
        if iss and iss != "all":
            parts.extend(["--issue", iss])
        try:
            parts.extend(["--min-score", str(int(self.qq_min_score.get()))])
            parts.extend(["--max-score", str(int(self.qq_max_score.get()))])
        except Exception:
            pass

        def complete(rc):
            if self._shutting_down:
                return
            if rc == 0:
                self._question_quality_cache_loaded = True
                self._refresh_questions_index(on_done=self._load_question_quality_from_report)

        self._run_npm(
            "fix-questions-ai",
            " ".join(parts),
            "🤖 AI правка ({0} пит.)".format(len(rows)),
            on_complete=complete,
        )

    def _ai_fix_one_question(self, question_id):
        if self.process and self.process.poll() is None:
            messagebox.showwarning("Зайнято", "Дочекайтесь завершення поточної команди.")
            return

        def complete(rc):
            if self._shutting_down:
                return
            if rc == 0:
                def after_index():
                    self._load_question_quality_from_report()
                    self._hide_question_actions()

                self._refresh_questions_index(on_done=after_index)

        self._run_npm(
            "fix-questions-ai",
            "--ids {0} --status all {1}".format(question_id, self._ai_cli_suffix()),
            "🤖 AI: " + question_id,
            on_complete=complete,
        )

    def _save_db_question(self, question):
        theme_id = question.get("themeId") or question.get("_theme_file")
        if not theme_id:
            return False
        path = os.path.join(self.questions_db_dir, "{0}.json".format(theme_id))
        data = _load_json(path) or []
        if not isinstance(data, list):
            return False
        clean = {k: v for k, v in question.items() if not str(k).startswith("_")}
        found = False
        for i, q in enumerate(data):
            if q.get("id") == clean.get("id"):
                data[i] = clean
                found = True
                break
        if not found:
            data.append(clean)
        if not _save_json(path, data):
            return False
        self._questions_by_id[clean["id"]] = {**clean, "_source": "db", "_theme_file": theme_id}
        return True

    def _delete_db_question(self, question_id, theme_id):
        path = os.path.join(self.questions_db_dir, "{0}.json".format(theme_id))
        data = _load_json(path) or []
        if not isinstance(data, list):
            return False
        new_data = [q for q in data if q.get("id") != question_id]
        if len(new_data) == len(data):
            return False
        if not _save_json(path, new_data):
            return False
        self._questions_by_id.pop(question_id, None)
        return True

    def _open_question_actions(self, r):
        self._hide_question_actions()
        self._show_question_action_panel()
        self.tabview.set("Якість пит.")
        qid = r["questionId"]
        q = self._questions_by_id.get(qid, {})
        panel = self.qq_action_panel

        hdr = ctk.CTkFrame(panel, fg_color="transparent")
        hdr.pack(fill="x", padx=14, pady=(12, 4))
        hdr.grid_columnconfigure(0, weight=1)
        ctk.CTkLabel(hdr, text="📝 Дії з питанням", font=FONT_TITLE).grid(row=0, column=0, sticky="w")
        ctk.CTkButton(hdr, text="✕", width=32, height=28, fg_color="transparent", text_color=TEXT_MUTED,
                      hover=False, command=self._hide_question_actions).grid(row=0, column=1)

        src_label = "question-db" if q.get("_source") == "db" else "вбудоване (questions.ts)"
        ctk.CTkLabel(
            panel,
            text="ID: {0}  |  {1}  |  Якість: {2}/100  |  {3}".format(
                qid, r["themeId"], r["qualityScore"], src_label),
            font=FONT_SM, text_color=TEXT_MUTED, anchor="w",
        ).pack(fill="x", padx=14, pady=(0, 4))

        if q.get("text"):
            ctk.CTkLabel(panel, text=q["text"], font=FONT_DD, anchor="w", wraplength=900,
                         justify="left").pack(fill="x", padx=14, pady=(0, 6))

        issues_frame = ctk.CTkFrame(panel, fg_color="transparent")
        issues_frame.pack(fill="x", padx=14, pady=(0, 6))
        for issue in r.get("issues", [])[:6]:
            ctk.CTkLabel(
                issues_frame,
                text="[{0}] {1}: {2}".format(issue.get("severity", "?"), issue.get("type", "?"), issue.get("message", "")),
                font=FONT_SM, text_color=TEXT_MUTED, anchor="w",
            ).pack(anchor="w")
        if r.get("duplicateIds"):
            ctk.CTkLabel(
                panel, text="Дублікати: " + ", ".join(r["duplicateIds"][:8]),
                font=FONT_SM, text_color=self._semantic()["orange"], anchor="w",
            ).pack(fill="x", padx=14, pady=(0, 6))

        btn_frame = ctk.CTkFrame(panel, fg_color="transparent")
        btn_frame.pack(fill="x", padx=14, pady=(0, 12))
        s = self._semantic()

        def approve():
            if self._update_question_report_status(qid, "approved"):
                qobj = self._questions_by_id.get(qid)
                if qobj and qobj.get("_source") == "db":
                    qobj = dict(qobj)
                    qobj["quarantined"] = False
                    self._save_db_question(qobj)
                messagebox.showinfo("✅", "Знято з карантину")
                self._hide_question_actions()
                self._load_question_quality_from_report()
            else:
                messagebox.showerror("❌", "Не вдалось оновити звіт")

        def reject_delete():
            if q.get("_source") == "db":
                if not messagebox.askyesno("Видалити?", "Видалити AI-питання {0} з question-db?".format(qid)):
                    return
                theme_id = q.get("_theme_file") or q.get("themeId")
                if self._delete_db_question(qid, theme_id):
                    self._batch_exclude_questions_from_report([qid])
                    messagebox.showinfo("✅", "Видалено з question-db і прибрано зі звіту")
                    self._hide_question_actions()
                    self._load_question_quality_from_report()
                else:
                    messagebox.showerror("❌", "Не вдалось видалити")
            else:
                if not messagebox.askyesno(
                    "Прибрати?",
                    "Прибрати вбудоване питання {0} зі звіту якості?\n(У questions.ts воно лишиться)".format(qid),
                ):
                    return
                if self._batch_exclude_questions_from_report([qid]):
                    messagebox.showinfo("✅", "Прибрано зі звіту (у questions.ts залишилось)")
                    self._hide_question_actions()
                    self._load_question_quality_from_report()
                else:
                    messagebox.showerror("❌", "Не вдалось оновити звіт")

        edit_cell = ctk.CTkFrame(btn_frame, fg_color="transparent")
        edit_cell.pack(side="left", padx=(0, 4))
        ctk.CTkButton(edit_cell, text="✎ Редаг.", width=100, height=BTN_H, font=FONT_SM,
                      command=lambda: self._open_question_editor(r)).pack(side="left")
        self._help_button(edit_cell, "question-edit").pack(side="left", padx=(2, 0))
        ai_cell = ctk.CTkFrame(btn_frame, fg_color="transparent")
        ai_cell.pack(side="left", padx=(0, 4))
        ctk.CTkButton(ai_cell, text="🤖 AI", width=70, height=BTN_H, font=FONT_SM,
                      fg_color=s["purple"], hover=False,
                      command=lambda: self._ai_fix_one_question(qid)).pack(side="left")
        self._help_button(ai_cell, "question-bulk-ai").pack(side="left", padx=(2, 0))
        expl_cell = ctk.CTkFrame(btn_frame, fg_color="transparent")
        expl_cell.pack(side="left", padx=(0, 4))
        ctk.CTkButton(expl_cell, text="→ Поясн.", width=90, height=BTN_H, font=FONT_SM,
                      command=lambda: self._open_explanation_for_question(qid)).pack(side="left")
        self._help_button(expl_cell, "question-goto-explanation").pack(side="left", padx=(2, 0))

        if r["status"] in ("quarantined", "pending", "rejected"):
            appr_cell = ctk.CTkFrame(btn_frame, fg_color="transparent")
            appr_cell.pack(side="left", padx=(0, 4))
            ctk.CTkButton(appr_cell, text="✅ Схвалити", width=110, height=BTN_H, font=FONT_SM,
                          fg_color=s["green"], hover=False, command=approve).pack(side="left")
            self._help_button(appr_cell, "question-quarantine").pack(side="left", padx=(2, 0))
            ctk.CTkButton(btn_frame, text="❌ Видалити", width=100, height=BTN_H, font=FONT_SM,
                          fg_color=s["red"], hover=False, command=reject_delete).pack(side="left", padx=4)

    def _open_question_editor(self, r):
        self._hide_question_actions()
        qid = r["questionId"]
        q = dict(self._questions_by_id.get(qid, {}))
        if not q:
            messagebox.showerror("Помилка", "Питання не знайдено в індексі")
            return
        is_db = q.get("_source") == "db"

        self._show_question_action_panel()
        panel = self.qq_action_panel

        hdr = ctk.CTkFrame(panel, fg_color="transparent")
        hdr.pack(fill="x", padx=14, pady=(12, 4))
        ctk.CTkLabel(hdr, text="✎ Редагування питання", font=FONT_TITLE).pack(side="left")
        ctk.CTkButton(hdr, text="✕", width=32, height=28, fg_color="transparent", text_color=TEXT_MUTED,
                      hover=False, command=self._hide_question_actions).pack(side="right")

        if not is_db:
            ctk.CTkLabel(
                panel,
                text="⚠ Вбудоване питання — збереження у src/data/questions.ts через IDE. Тут лише перегляд.",
                font=FONT_SM, text_color=self._semantic()["orange"], anchor="w",
            ).pack(fill="x", padx=14, pady=(0, 6))

        form = ctk.CTkScrollableFrame(panel, fg_color="transparent", height=280)
        form.pack(fill="x", padx=14, pady=(0, 8))
        form.grid_columnconfigure(1, weight=1)

        fields = {}
        row = 0

        def add_row(label, widget_factory):
            nonlocal row
            ctk.CTkLabel(form, text=label, font=FONT_SM, text_color=TEXT_MUTED).grid(
                row=row, column=0, sticky="nw", pady=3)
            w = widget_factory()
            w.grid(row=row, column=1, sticky="ew", padx=(8, 0))
            row += 1
            return w

        txt = add_row("Питання", lambda: ctk.CTkTextbox(form, height=64, font=FONT_DD))
        txt.insert("1.0", q.get("text", ""))
        fields["text"] = txt

        for i in range(4):
            opt = add_row("Варіант {0}".format(i + 1), lambda ii=i: ctk.CTkEntry(form, font=FONT_DD))
            opts = q.get("options", ["", "", "", ""])
            opt.insert(0, opts[i] if i < len(opts) else "")
            fields["opt_{0}".format(i)] = opt

        ci_row = ctk.CTkFrame(form, fg_color="transparent")
        ctk.CTkLabel(form, text="Правильна:", font=FONT_SM, text_color=TEXT_MUTED).grid(
            row=row, column=0, sticky="w", pady=3)
        ci_row.grid(row=row, column=1, sticky="w", padx=(8, 0))
        row += 1
        fields["correct"], wci = self._spinbox(ci_row, 1, 4, 3, str((q.get("correctIndex", 0) or 0) + 1))
        wci.pack(side="left")
        ctk.CTkLabel(ci_row, text="(1–4)", font=FONT_SM, text_color=TEXT_MUTED).pack(side="left", padx=6)

        ref_ent = add_row("Посилання", lambda: ctk.CTkEntry(form, font=FONT_DD))
        ref_ent.insert(0, self._normalize_reference(q.get("reference")))
        fields["reference"] = ref_ent

        diff_vals = [d[0] for d in DIFFICULTIES if d[0] != "all"]
        diff = add_row("Складність", lambda: ctk.CTkComboBox(form, values=diff_vals, width=160, font=FONT_DD))
        diff.set(q.get("difficulty", "child"))
        fields["difficulty"] = diff

        expl_s = add_row("Кор. поясн.", lambda: ctk.CTkTextbox(form, height=48, font=FONT_DD))
        expl_s.insert("1.0", q.get("explanationShort", "") or "")
        fields["expl_short"] = expl_s

        expl_d = add_row("Дет. поясн.", lambda: ctk.CTkTextbox(form, height=48, font=FONT_DD))
        expl_d.insert("1.0", q.get("explanationDeep", "") or "")
        fields["expl_deep"] = expl_d

        def save():
            if not is_db:
                messagebox.showinfo("Інфо", "Вбудовані питання редагуй у src/data/questions.ts")
                return
            options = [fields["opt_{0}".format(i)].get().strip() for i in range(4)]
            if not all(options):
                messagebox.showerror("Помилка", "Усі 4 варіанти обовʼязкові")
                return
            try:
                correct_index = int(fields["correct"].get()) - 1
            except Exception:
                correct_index = 0
            correct_index = max(0, min(3, correct_index))
            updated = {
                **{k: v for k, v in q.items() if not str(k).startswith("_")},
                "text": fields["text"].get("1.0", "end-1c").strip(),
                "options": options,
                "correctIndex": correct_index,
                "reference": fields["reference"].get().strip() or None,
                "difficulty": fields["difficulty"].get(),
                "quarantined": False,
            }
            expl_s_val = fields["expl_short"].get("1.0", "end-1c").strip()
            expl_d_val = fields["expl_deep"].get("1.0", "end-1c").strip()
            if expl_s_val:
                updated["explanationShort"] = expl_s_val
            elif "explanationShort" in updated:
                del updated["explanationShort"]
            if expl_d_val:
                updated["explanationDeep"] = expl_d_val
            elif "explanationDeep" in updated:
                del updated["explanationDeep"]
            if self._save_db_question(updated):
                self._update_question_report_status(qid, "approved")
                messagebox.showinfo("✅", "Збережено")
                self._hide_question_actions()
                self._load_question_quality_from_report()
            else:
                messagebox.showerror("❌", "Помилка збереження")

        br = ctk.CTkFrame(form, fg_color="transparent")
        br.grid(row=row, column=0, columnspan=2, pady=12, sticky="w")
        s = self._semantic()
        if is_db:
            ctk.CTkButton(br, text="💾 Зберегти", fg_color=s["green"], hover=False, command=save).pack(side="left", padx=4)
        ctk.CTkButton(br, text="◀ Назад", fg_color=UI["muted_btn"],
                      text_color=UI["muted_btn_text"],
                      command=lambda: self._open_question_actions(r)).pack(side="left")

    # ── Tab: Пояснення ──────────────────────────────────────────────────────

    EXPLANATION_ISSUE_TYPES = [
        "all", "missing_explanation", "too_short", "too_long_short", "repeats_answer",
        "contradicts_answer", "duplicates_question", "no_scripture_context",
        "generic_filler", "theological_red_flag", "orphan_deep",
    ]

    def _build_tab_explanations(self, parent):
        parent.grid_rowconfigure(5, weight=1)

        hdr = ctk.CTkFrame(parent, fg_color="transparent")
        hdr.grid(row=0, column=0, sticky="ew", padx=4, pady=(4, 0))
        hdr.grid_columnconfigure(0, weight=1)
        title_hdr = ctk.CTkFrame(hdr, fg_color="transparent")
        title_hdr.grid(row=0, column=0, sticky="w")
        ctk.CTkLabel(title_hdr, text="📖 Пояснення", font=FONT_H,
                     text_color=self._semantic()["cyan"]).pack(side="left")
        run_hdr = ctk.CTkFrame(hdr, fg_color="transparent")
        run_hdr.grid(row=0, column=1, sticky="e")
        ctk.CTkButton(run_hdr, text="Аналіз пояснень", width=150, height=BTN_H, font=FONT_BTN,
                      command=self._run_explanation_analysis).pack(side="left")
        self._help_button(run_hdr, "analyze-explanations-tab").pack(side="left", padx=(4, 0))
        ai_run = ctk.CTkFrame(run_hdr, fg_color="transparent")
        ai_run.pack(side="left", padx=(6, 0))
        ctk.CTkLabel(ai_run, text="AI ліміт:", font=FONT_SM, text_color=TEXT_MUTED).pack(side="left")
        self.eq_ai_limit, w_ai = self._spinbox(ai_run, 1, 500, 4, "10")
        w_ai.pack(side="left", padx=(4, 0))
        ctk.CTkButton(ai_run, text="AI-оцінка", width=100, height=BTN_H, font=FONT_SM,
                      command=self._run_explanation_ai_score).pack(side="left", padx=(6, 0))
        self._help_button(ai_run, "explanation-ai-score").pack(side="left", padx=(4, 0))

        meta = ctk.CTkFrame(parent, fg_color="transparent")
        meta.grid(row=1, column=0, sticky="ew", padx=8, pady=(4, 0))
        meta.grid_columnconfigure(0, weight=1)
        self.eq_subtitle = ctk.CTkLabel(
            meta,
            text="Завантажиться з explanation-quality-report.json або натисніть «Аналіз пояснень»",
            font=FONT_SM, text_color=TEXT_MUTED, anchor="w",
        )
        self.eq_subtitle.grid(row=0, column=0, sticky="w")

        flt = ctk.CTkFrame(meta, fg_color="transparent")
        flt.grid(row=0, column=1, sticky="e")
        ctk.CTkLabel(flt, text="Покриття:", font=FONT_SM, text_color=TEXT_MUTED).pack(side="left")
        self.eq_coverage_filter = tk.StringVar(value="all")
        self.eq_coverage_combo = ctk.CTkComboBox(
            flt, variable=self.eq_coverage_filter,
            values=["all", "missing", "short_only", "complete", "orphan_deep"],
            width=120, height=CTRL_H, font=FONT_DD,
            command=lambda _: self._refresh_explanation_list(),
        )
        self.eq_coverage_combo.set("all")
        self.eq_coverage_combo.pack(side="left", padx=4)
        ctk.CTkLabel(flt, text="Тема:", font=FONT_SM, text_color=TEXT_MUTED).pack(side="left", padx=(6, 0))
        self.eq_theme_filter = tk.StringVar(value="all")
        self.eq_theme_combo = ctk.CTkComboBox(
            flt, variable=self.eq_theme_filter, values=["all"],
            width=130, height=CTRL_H, font=FONT_DD,
            command=lambda _: self._refresh_explanation_list(),
        )
        self.eq_theme_combo.set("all")
        self.eq_theme_combo.pack(side="left", padx=4)
        ctk.CTkLabel(flt, text="Проблема:", font=FONT_SM, text_color=TEXT_MUTED).pack(side="left", padx=(6, 0))
        self.eq_issue_filter = tk.StringVar(value="all")
        self.eq_issue_combo = ctk.CTkComboBox(
            flt, variable=self.eq_issue_filter,
            values=self.EXPLANATION_ISSUE_TYPES,
            width=150, height=CTRL_H, font=FONT_DD,
            command=lambda _: self._refresh_explanation_list(),
        )
        self.eq_issue_combo.set("all")
        self.eq_issue_combo.pack(side="left", padx=4)
        ctk.CTkLabel(flt, text="Джерело:", font=FONT_SM, text_color=TEXT_MUTED).pack(side="left", padx=(6, 0))
        self.eq_source_filter = tk.StringVar(value="all")
        self.eq_source_combo = ctk.CTkComboBox(
            flt, variable=self.eq_source_filter,
            values=["all", "db", "embedded"],
            width=100, height=CTRL_H, font=FONT_DD,
            command=lambda _: self._refresh_explanation_list(),
        )
        self.eq_source_combo.set("all")
        self.eq_source_combo.pack(side="left", padx=4)
        self.eq_min_score, w1 = self._spinbox(flt, 0, 100, 3, "0")
        w1.pack(side="left", padx=(8, 2))
        self.eq_max_score, w2 = self._spinbox(flt, 0, 100, 3, "100")
        w2.pack(side="left", padx=2)
        filt_cell = ctk.CTkFrame(flt, fg_color="transparent")
        filt_cell.pack(side="left", padx=(6, 0))
        ctk.CTkButton(filt_cell, text="↻", width=32, height=CTRL_H, font=FONT_BTN,
                      command=self._refresh_explanation_list).pack(side="left")
        self._help_button(filt_cell, "explanation-filter").pack(side="left", padx=(4, 0))

        self.eq_stat_frame = ctk.CTkFrame(parent, fg_color="transparent")
        self.eq_stat_frame.grid(row=2, column=0, sticky="w", padx=8, pady=(4, 0))

        self.eq_bulk_frame = ctk.CTkFrame(parent, fg_color="transparent")
        self.eq_bulk_frame.grid(row=3, column=0, sticky="ew", padx=8, pady=(4, 0))
        self.eq_bulk_count = ctk.CTkLabel(
            self.eq_bulk_frame, text="У фільтрі: 0", font=FONT_SM, text_color=TEXT_MUTED,
        )
        self.eq_bulk_count.pack(side="left", padx=(0, 10))
        s_bulk = self._semantic()
        for label, cmd, color, help_key in [
            ("🤖 AI: згенерувати", self._bulk_explanation_ai, s_bulk["purple"], "explanation-bulk-ai"),
            ("✓ Переглянуто", self._bulk_mark_explanations_reviewed, s_bulk["green"], "explanation-edit"),
        ]:
            cell = ctk.CTkFrame(self.eq_bulk_frame, fg_color="transparent")
            cell.pack(side="left", padx=(0, 4))
            ctk.CTkButton(cell, text=label, width=140, height=BTN_H, font=FONT_SM,
                          fg_color=color, hover=False, command=cmd).pack(side="left")
            self._help_button(cell, help_key).pack(side="left", padx=(2, 0))

        self.eq_action_panel = ctk.CTkFrame(parent, corner_radius=8, border_width=1,
                                            border_color=UI["card_border"])
        self.eq_list_frame = ctk.CTkFrame(parent, corner_radius=8, border_width=1,
                                          border_color=UI["card_border"])
        self.eq_list_frame.grid(row=5, column=0, sticky="nsew", padx=4, pady=4)
        self.eq_list_frame.grid_columnconfigure(0, weight=1)
        self.eq_list_frame.grid_rowconfigure(0, weight=1)

        self.eq_textbox = ctk.CTkTextbox(
            self.eq_list_frame, font=FONT_MONO, wrap="none", activate_scrollbars=True,
        )
        self.eq_textbox.grid(row=0, column=0, sticky="nsew", padx=2, pady=2)
        self.eq_text = self.eq_textbox._textbox
        self.eq_text.configure(state="normal", undo=False, cursor="arrow")
        self.eq_text.bind("<Key>", lambda e: "break")
        self.eq_text.bind("<Control-c>", self._copy_selection)
        self.eq_text.bind("<Button-1>", self._on_explanation_press)
        self.eq_text.bind("<ButtonRelease-1>", self._on_explanation_release)
        self._setup_quality_tags(self.eq_text)

        self.eq_text.insert("end", "\n  Відкрийте вкладку — покажемо збережений звіт\n", "dim")
        self.eq_text.configure(state="disabled")

    def _ensure_explanation_quality_cached(self):
        if self._explanation_quality_cache_loaded:
            return
        self._explanation_quality_cache_loaded = True
        self._load_explanation_quality_from_report(silent=True)
        self._refresh_questions_index(on_done=self._finish_explanation_quality_cached)

    def _finish_explanation_quality_cached(self):
        if self._shutting_down:
            return
        self._load_explanation_quality_from_report(silent=True)
        qid = self._pending_explanation_qid
        if qid:
            self._pending_explanation_qid = None
            for r in self._explanation_results:
                if r.get("questionId") == qid:
                    self._open_explanation_actions(r)
                    break

    def _report_to_explanation_rows(self, report):
        rows = []
        for item in report.get("reports", []):
            qid = item.get("questionId", "?")
            q = self._questions_by_id.get(qid, {})
            rows.append({
                "questionId": qid,
                "coverage": item.get("coverage", "missing"),
                "heuristicScore": item.get("heuristicScore", 0),
                "aiScore": item.get("aiScore"),
                "aiDetails": item.get("aiDetails"),
                "issues": item.get("issues", []),
                "themeId": q.get("themeId", item.get("themeId", "?")),
                "difficulty": q.get("difficulty", "?"),
                "text": q.get("text", item.get("text", qid)),
                "source": q.get("_source", item.get("source", "?")),
                "explanationShortPreview": item.get("explanationShortPreview", ""),
                "reviewedAt": item.get("reviewedAt"),
            })
        return rows

    def _load_explanation_quality_from_report(self, silent=False):
        report = _load_json(self.explanation_report_path)
        if report and report.get("reports"):
            self._show_explanation_quality_results(
                self._report_to_explanation_rows(report), cached=True, report=report,
            )
        elif not silent:
            self.eq_subtitle.configure(text="Натисніть «Аналіз пояснень»")
            self.eq_text.configure(state="normal")
            self.eq_text.delete("1.0", "end")
            self.eq_text.insert("end", "\n  Немає збереженого звіту. Натисніть «Аналіз пояснень».\n", "dim")
            self.eq_text.configure(state="disabled")

    def _combo_filter_value(self, combo, string_var):
        try:
            val = combo.get()
            if val is not None:
                s = str(val).strip()
                if s:
                    return s
        except Exception:
            pass
        try:
            return str(string_var.get()).strip() or "all"
        except Exception:
            return "all"

    def _count_explanation_ai_pending(self):
        pending = 0
        already = 0
        no_expl = 0
        cov_f = self._combo_filter_value(self.eq_coverage_combo, self.eq_coverage_filter)
        theme_f = self._combo_filter_value(self.eq_theme_combo, self.eq_theme_filter)
        issue_f = self._combo_filter_value(self.eq_issue_combo, self.eq_issue_filter)
        source_f = self._combo_filter_value(self.eq_source_combo, self.eq_source_filter)
        try:
            min_s = int(self.eq_min_score.get())
            max_s = int(self.eq_max_score.get())
        except Exception:
            min_s, max_s = 0, 100

        for r in self._explanation_results:
            if r.get("coverage") == "missing":
                no_expl += 1
                continue
            if not (min_s <= r.get("heuristicScore", 0) <= max_s):
                continue
            if cov_f != "all" and r.get("coverage") != cov_f:
                continue
            if theme_f != "all" and r.get("themeId") != theme_f:
                continue
            if source_f != "all" and r.get("source") != source_f:
                continue
            if issue_f != "all":
                if not any(i.get("type") == issue_f for i in r.get("issues", [])):
                    continue
            ai_score = r.get("aiScore")
            if ai_score is not None and ai_score != "":
                already += 1
                continue
            pending += 1
        return pending, already, no_expl

    def _clear_stale_explanation_run_flag(self):
        if self._explanation_analysis_running:
            if self.process is None or self.process.poll() is not None:
                self._explanation_analysis_running = False

    def _run_explanation_analysis(self):
        self._clear_stale_explanation_run_flag()
        if self._explanation_analysis_running:
            messagebox.showinfo("Інфо", "Аналіз пояснень уже виконується.")
            return
        if self.process and self.process.poll() is None:
            messagebox.showwarning("Зайнято", "Дочекайтесь завершення поточної команди.")
            return

        def complete(rc):
            self._explanation_analysis_running = False
            if self._shutting_down:
                return
            if rc == 0:
                self._explanation_quality_cache_loaded = True
                self._refresh_questions_index(on_done=self._load_explanation_quality_from_report)
                self._set_status("✔  Аналіз пояснень готовий", self._semantic()["green"])
            else:
                messagebox.showerror(
                    "Помилка аналізу",
                    "Не вдалось завершити аналіз (код {0}).\n\n"
                    "Відкрийте «▼ Вивід» внизу — там текст помилки.\n"
                    "Переконайтесь, що встановлені Node.js і npm (npm install у корені проєкту).".format(rc),
                )

        self._expand_console()
        self._log("\n📖 Запуск аналізу пояснень…\n", "info")
        self._set_status("⏳  Аналіз пояснень…", self._semantic()["cyan"], busy=True)

        started = self._run_analyze_explanations_command(on_complete=complete)
        if not started:
            self._explanation_analysis_running = False
            self._set_status("✘  Не запущено", self._semantic()["red"])
            node = _resolve_executable("node")
            npm = _resolve_executable("npm") or _resolve_executable("npm.cmd")
            messagebox.showerror(
                "Не вдалось запустити",
                "Node.js/npm не знайдено для GUI (pythonw часто не бачить PATH).\n\n"
                "Знайдено:\n  node: {0}\n  npm: {1}\n\n"
                "Встановіть Node.js LTS з nodejs.org або запустіть з терміналу:\n"
                "  npm run analyze-explanations".format(node or "—", npm or "—"),
            )
            return
        self._explanation_analysis_running = True

    def _run_analyze_explanations_command(self, argv=None, label="📖 Аналіз пояснень", on_complete=None):
        """Кілька способів запуску analyze-explanations (Windows pythonw + PATH)."""
        argv = argv or []
        script_path = os.path.join(self.script_dir, "analyze-explanations.mjs")
        if not os.path.isfile(script_path):
            messagebox.showerror("Помилка", "Скрипт не знайдено:\n" + script_path)
            return False

        node = _resolve_executable("node")
        if node:
            cmd = [node, "--import", "tsx", script_path, *argv]
            display = "node --import tsx analyze-explanations.mjs"
            if argv:
                display += " " + " ".join(argv)
            if self._execute_argv(cmd, display, label, on_complete=on_complete):
                return True

        npm = _resolve_executable("npm") or _resolve_executable("npm.cmd")
        if npm:
            args_str = (" -- " + " ".join(argv)) if argv else ""
            if os.name == "nt":
                batch = 'cd /d "{0}" && "{1}" run analyze-explanations{2}'.format(
                    self.project_root, npm, args_str,
                )
                return self._execute_argv(
                    ["cmd", "/c", batch],
                    "npm run analyze-explanations",
                    label + " (npm)",
                    on_complete=on_complete,
                )
            cmd = '"{0}" run analyze-explanations{1}'.format(npm, args_str)
            return self._execute(cmd, label + " (npm)", on_complete=on_complete)

        return False

    def _run_explanation_ai_score(self):
        if self.process and self.process.poll() is None:
            messagebox.showwarning("Зайнято", "Дочекайтесь завершення поточної команди.")
            return
        if not self._explanation_results:
            messagebox.showinfo(
                "Немає звіту",
                "Спочатку натисніть «Аналіз пояснень» (евристики + звіт).",
            )
            return

        try:
            ai_limit = max(1, int(self.eq_ai_limit.get()))
        except Exception:
            ai_limit = 10

        pending, already, no_expl = self._count_explanation_ai_pending()
        if pending == 0:
            messagebox.showinfo(
                "AI-оцінка",
                "Немає питань для оцінки в поточному фільтрі.\n\n"
                "Уже оцінено (aiScore): {0}\n"
                "Без пояснення (missing): {1}\n\n"
                "Змініть фільтр (напр. short_only) або згенеруйте пояснення.".format(
                    already, no_expl,
                ),
            )
            return

        to_run = min(ai_limit, pending)
        if not messagebox.askyesno(
            "AI-оцінка",
            "Ollama оцінить {0} питань (ліміт {1}, у черзі {2}).\n\n"
            "Пропускаються: без пояснення ({3}), уже оцінені ({4}).\n"
            "Повторно оцінені не будуть.\n\nПродовжити?".format(
                to_run, ai_limit, pending, no_expl, already,
            ),
        ):
            return

        def complete(rc):
            if self._shutting_down:
                return
            if rc == 0:
                self._explanation_quality_cache_loaded = True
                self._refresh_questions_index(on_done=self._load_explanation_quality_from_report)
            else:
                messagebox.showerror("Помилка", "AI-оцінка не завершилась. Див. консоль внизу.")

        argv = [
            "--ai", "--ai-only", "--ai-limit", str(to_run),
            "--skip-scored", *self._ai_args(),
        ]
        cov = self._combo_filter_value(self.eq_coverage_combo, self.eq_coverage_filter)
        if cov and cov != "all":
            argv.extend(["--coverage", cov])
        th = self._combo_filter_value(self.eq_theme_combo, self.eq_theme_filter)
        if th and th != "all":
            argv.extend(["--theme", th])
        iss = self._combo_filter_value(self.eq_issue_combo, self.eq_issue_filter)
        if iss and iss != "all":
            argv.extend(["--issue", iss])
        try:
            argv.extend(["--min-score", str(int(self.eq_min_score.get()))])
            argv.extend(["--max-score", str(int(self.eq_max_score.get()))])
        except Exception:
            pass

        self._expand_console()
        self._run_analyze_explanations_command(
            argv, "🤖 AI-оцінка ({0} пит.)".format(to_run), on_complete=complete,
        )

    def _show_explanation_quality_results(self, results, cached=False, report=None):
        self._explanation_results = results
        themes = sorted(set(r["themeId"] for r in results if r["themeId"] != "?"))
        self.eq_theme_combo.configure(command=None)
        self.eq_theme_combo.configure(values=["all"] + themes)
        self.eq_theme_combo.set("all")
        self.eq_theme_combo.configure(command=lambda _: self._refresh_explanation_list())

        summary = (report or {}).get("summary", {})
        missing = summary.get("missing", sum(1 for r in results if r["coverage"] == "missing"))
        complete = summary.get("complete", sum(1 for r in results if r["coverage"] == "complete"))
        avg = summary.get("avgHeuristicScore", 0)
        if results and not avg:
            avg = round(sum(r["heuristicScore"] for r in results) / len(results))

        label = "{0} питань · {1} без поясн. · avg {2}/100".format(len(results), missing, avg)
        if cached:
            when = self._format_report_date(report or {})
            label += " • звіт" + (" ({0})".format(when) if when else "")
        self.eq_subtitle.configure(text=label)

        for w in self.eq_stat_frame.winfo_children():
            w.destroy()
        s = self._semantic()
        for txt, col in [
            ("\U0001f534 {0} missing".format(missing), s["red"]),
            ("\U0001f7e2 {0} complete".format(complete), s["green"]),
            ("\U0001f7e1 {0} weak".format(
                summary.get("weak", sum(1 for r in results if r["heuristicScore"] < 50)),
            ), s["orange"]),
        ]:
            ctk.CTkLabel(self.eq_stat_frame, text=txt, font=FONT_BTN, text_color=col).pack(side="left", padx=(0, 8))
        self._schedule_explanation_list_refresh()

    def _schedule_explanation_list_refresh(self):
        if self._explanation_list_job:
            self.after_cancel(self._explanation_list_job)
        self._explanation_list_job = self.after(1, self._refresh_explanation_list)

    def _explanation_status_tag(self, coverage, score):
        if coverage == "missing":
            return "red"
        if coverage == "complete" and score >= 50:
            return "green"
        if score >= 50:
            return "cyan"
        if score < 50:
            return "orange"
        return "dim"

    def _get_filtered_explanation_rows(self):
        try:
            min_s = int(self.eq_min_score.get())
        except Exception:
            min_s = 0
        try:
            max_s = int(self.eq_max_score.get())
        except Exception:
            max_s = 100
        cov_f = self._combo_filter_value(self.eq_coverage_combo, self.eq_coverage_filter)
        theme_f = self._combo_filter_value(self.eq_theme_combo, self.eq_theme_filter)
        issue_f = self._combo_filter_value(self.eq_issue_combo, self.eq_issue_filter)
        source_f = self._combo_filter_value(self.eq_source_combo, self.eq_source_filter)

        filtered = []
        for r in self._explanation_results:
            try:
                score = int(r.get("heuristicScore", 0))
            except (TypeError, ValueError):
                score = 0
            if not (min_s <= score <= max_s):
                continue
            if cov_f != "all" and r["coverage"] != cov_f:
                continue
            if theme_f != "all" and r["themeId"] != theme_f:
                continue
            if source_f != "all" and r.get("source") != source_f:
                continue
            if issue_f != "all":
                if not any(i.get("type") == issue_f for i in r.get("issues", [])):
                    continue
            filtered.append(r)

        filtered.sort(key=lambda x: (
            0 if x["coverage"] == "missing" else 1,
            x["heuristicScore"],
        ))
        return filtered

    def _update_eq_bulk_count(self, count):
        if hasattr(self, "eq_bulk_count"):
            self.eq_bulk_count.configure(text="У фільтрі: {0}".format(count))

    def _refresh_explanation_list(self, event=None):
        self._explanation_list_job = None
        self.eq_text.configure(state="normal")
        self.eq_text.delete("1.0", "end")

        filtered = self._get_filtered_explanation_rows()
        self._eq_filtered_rows = filtered
        self._update_eq_bulk_count(len(filtered))

        if not filtered:
            self.eq_text.insert("end", "  Немає результатів\n", "dim")
            self.eq_text.configure(state="disabled")
            return

        click_map = {}
        line_num = 1
        tagged_lines = []
        chunks = []
        by_theme = {}
        for r in filtered:
            by_theme.setdefault(r["themeId"], []).append(r)

        cov_icon = {"missing": "\u2717", "short_only": "\u25cb", "complete": "\u2713", "orphan_deep": "\u26a0"}
        for theme_id in sorted(by_theme.keys()):
            items = by_theme[theme_id]
            tname = THEMES_DICT.get(theme_id, theme_id)
            chunks.append("\n  {0} ({1})\n".format(tname, len(items)))
            line_num += 2
            for r in items:
                preview = r["text"][:55] + ("…" if len(r["text"]) > 55 else "")
                expl_prev = r.get("explanationShortPreview") or "(немає пояснення)"
                if len(expl_prev) > 60:
                    expl_prev = expl_prev[:60] + "…"
                icon = cov_icon.get(r["coverage"], "\u2022")
                ai_hint = ""
                if r.get("aiScore") is not None:
                    ai_hint = " AI:{0}".format(r["aiScore"])
                chunks.append(
                    "    {0} [{1}/100]{2} {3} · {4} · {5}\n      {6}\n      → {7}\n".format(
                        icon, r["heuristicScore"], ai_hint, r["coverage"],
                        r["difficulty"], r["questionId"], preview, expl_prev,
                    ),
                )
                tagged_lines.append((line_num, r["coverage"], r["heuristicScore"]))
                click_map[str(line_num)] = r
                click_map[str(line_num + 1)] = r
                click_map[str(line_num + 2)] = r
                line_num += 3

        self.eq_text.insert("1.0", "".join(chunks))
        for ln, coverage, score in tagged_lines:
            self.eq_text.tag_add(
                self._explanation_status_tag(coverage, score),
                "{0}.0".format(ln), "{0}.end".format(ln),
            )

        self._explanation_click_map = click_map
        self.eq_text.configure(state="disabled")

    def _on_explanation_press(self, event):
        self._explanation_click_pos = (event.x, event.y)

    def _on_explanation_release(self, event):
        if not hasattr(self, "_explanation_click_pos"):
            return
        if abs(event.x - self._explanation_click_pos[0]) > 5 or abs(event.y - self._explanation_click_pos[1]) > 5:
            return
        try:
            self.eq_text.get(tk.SEL_FIRST, tk.SEL_LAST)
            return
        except tk.TclError:
            pass
        idx = self.eq_text.index("@{0},{1}".format(self._explanation_click_pos[0], self._explanation_click_pos[1]))
        line = idx.split(".")[0]
        r = self._explanation_click_map.get(line)
        if r:
            self._open_explanation_actions(r)

    def _hide_explanation_actions(self):
        if hasattr(self, "eq_action_panel"):
            self.eq_action_panel.grid_forget()
            for w in self.eq_action_panel.winfo_children():
                w.destroy()
        if hasattr(self, "eq_bulk_frame"):
            self.eq_bulk_frame.grid()

    def _show_explanation_action_panel(self):
        self.eq_bulk_frame.grid_remove()
        self.eq_action_panel.grid(row=4, column=0, sticky="ew", padx=4, pady=(0, 4))

    def _open_explanation_for_question(self, question_id):
        self._pending_explanation_qid = question_id
        self.tabview.set("Пояснення")
        self._ensure_explanation_quality_cached()

    def _navigate_explanation(self, direction):
        rows = self._eq_filtered_rows
        if not rows:
            return
        current = getattr(self, "_current_explanation_row", None)
        idx = 0
        if current:
            for i, r in enumerate(rows):
                if r["questionId"] == current.get("questionId"):
                    idx = i
                    break
        idx = max(0, min(len(rows) - 1, idx + direction))
        self._open_explanation_actions(rows[idx])

    def _mark_explanation_reviewed(self, question_id):
        report = _load_json(self.explanation_report_path)
        if not report:
            return False
        for item in report.get("reports", []):
            if item.get("questionId") == question_id:
                from datetime import datetime
                item["reviewedAt"] = datetime.now().isoformat()
                break
        else:
            return False
        _save_json(self.explanation_report_path, report)
        return True

    def _bulk_mark_explanations_reviewed(self):
        rows = self._eq_filtered_rows
        if not rows:
            messagebox.showinfo("Інфо", "Немає питань у фільтрі")
            return
        report = _load_json(self.explanation_report_path)
        if not report:
            messagebox.showerror("Помилка", "Немає звіту — спочатку аналіз")
            return
        ids = {r["questionId"] for r in rows}
        from datetime import datetime
        ts = datetime.now().isoformat()
        n = 0
        for item in report.get("reports", []):
            if item.get("questionId") in ids:
                item["reviewedAt"] = ts
                n += 1
        _save_json(self.explanation_report_path, report)
        messagebox.showinfo("✅", "Позначено переглянутими: {0}".format(n))
        self._load_explanation_quality_from_report()

    def _bulk_explanation_ai(self):
        rows = self._eq_filtered_rows
        if not rows:
            messagebox.showinfo("Інфо", "Немає питань у фільтрі")
            return
        db_rows = [r for r in rows if r.get("source") == "db"]
        if not db_rows:
            messagebox.showinfo("Інфо", "У фільтрі немає питань з question-db (embedded не змінюються)")
            return
        if self.process and self.process.poll() is None:
            messagebox.showwarning("Зайнято", "Дочекайтесь завершення поточної команди.")
            return
        est_min = max(1, len(db_rows) // 2)
        if not messagebox.askyesno(
            "AI: пояснення",
            "Згенерувати/покращити пояснення для {0} питань (db)?\n\n~{1}+ хв. Потрібен ollama serve.".format(
                len(db_rows), est_min,
            ),
        ):
            return
        parts = list(self._ai_args()) + ["--coverage", "all"]
        cov = self.eq_coverage_filter.get()
        if cov and cov != "all":
            parts = list(self._ai_args()) + ["--coverage", cov]
        th = self.eq_theme_filter.get()
        if th and th != "all":
            parts.extend(["--theme", th])
        iss = self.eq_issue_filter.get()
        if iss and iss != "all":
            parts.extend(["--issue", iss])
        try:
            parts.extend(["--min-score", str(int(self.eq_min_score.get()))])
            parts.extend(["--max-score", str(int(self.eq_max_score.get()))])
        except Exception:
            pass

        def complete(rc):
            if self._shutting_down:
                return
            if rc == 0:
                self._explanation_quality_cache_loaded = True

                def after_index():
                    self._run_tsx_script(
                        "analyze-explanations.mjs", [],
                        "📖 Оновлення звіту",
                        on_complete=lambda rc2: self._load_explanation_quality_from_report() if rc2 == 0 else None,
                    )

                self._refresh_questions_index(on_done=after_index)

        self._run_npm(
            "fix-explanations-ai",
            " ".join(parts),
            "🤖 AI пояснення ({0})".format(len(db_rows)),
            on_complete=complete,
        )

    def _ai_fix_explanation_one(self, question_id, mode="generate"):
        if self.process and self.process.poll() is None:
            messagebox.showwarning("Зайнято", "Дочекайтесь завершення поточної команди.")
            return

        def complete(rc):
            if self._shutting_down:
                return
            if rc == 0:
                def after_index():
                    self._run_tsx_script(
                        "analyze-explanations.mjs", [],
                        "📖 Оновлення звіту",
                        on_complete=lambda rc2: (
                            self._load_explanation_quality_from_report(),
                            self._hide_explanation_actions(),
                        ) if rc2 == 0 else None,
                    )

                self._refresh_questions_index(on_done=after_index)

        self._run_npm(
            "fix-explanations-ai",
            "--ids {0} --mode {1} {2}".format(question_id, mode, self._ai_cli_suffix()),
            "🤖 AI: " + question_id,
            on_complete=complete,
        )

    def _open_explanation_actions(self, r):
        self._hide_explanation_actions()
        self._current_explanation_row = r
        self._show_explanation_action_panel()
        self.tabview.set("Пояснення")
        qid = r["questionId"]
        q = dict(self._questions_by_id.get(qid, {}))
        panel = self.eq_action_panel
        is_db = q.get("_source") == "db"

        hdr = ctk.CTkFrame(panel, fg_color="transparent")
        hdr.pack(fill="x", padx=14, pady=(12, 4))
        ctk.CTkLabel(hdr, text="📖 Пояснення", font=FONT_TITLE).pack(side="left")
        ctk.CTkButton(hdr, text="✕", width=32, height=28, fg_color="transparent", text_color=TEXT_MUTED,
                      hover=False, command=self._hide_explanation_actions).pack(side="right")

        ctx = ctk.CTkFrame(panel, fg_color="transparent")
        ctx.pack(fill="x", padx=14, pady=(0, 6))
        correct = ""
        if q.get("options") and q.get("correctIndex") is not None:
            opts = q["options"]
            ci = q["correctIndex"]
            if 0 <= ci < len(opts):
                correct = opts[ci]
        ctk.CTkLabel(
            ctx,
            text="Питання: {0}\nПравильна: {1}\nПосилання: {2}".format(
                (q.get("text") or r["text"])[:120],
                correct or "—",
                self._normalize_reference(q.get("reference")) or "—",
            ),
            font=FONT_SM, text_color=TEXT_MUTED, anchor="w", justify="left",
        ).pack(anchor="w")

        if r.get("issues"):
            iss_txt = "\n".join(
                "• [{0}] {1}".format(i.get("severity", "?"), i.get("message", ""))[:80]
                for i in r["issues"][:5]
            )
            ctk.CTkLabel(
                panel, text="Проблеми:\n" + iss_txt,
                font=FONT_SM, text_color=self._semantic()["orange"], anchor="w", justify="left",
            ).pack(fill="x", padx=14, pady=(0, 4))

        if r.get("aiDetails") and r["aiDetails"].get("summary"):
            ctk.CTkLabel(
                panel, text="AI: " + str(r["aiDetails"]["summary"])[:200],
                font=FONT_SM, text_color=TEXT_SUB, anchor="w",
            ).pack(fill="x", padx=14, pady=(0, 4))

        if not is_db:
            ctk.CTkLabel(
                panel,
                text="⚠ Вбудоване питання — збереження лише в src/data/questions.ts",
                font=FONT_SM, text_color=self._semantic()["orange"], anchor="w",
            ).pack(fill="x", padx=14, pady=(0, 4))

        form = ctk.CTkScrollableFrame(panel, fg_color="transparent", height=220)
        form.pack(fill="x", padx=14, pady=(0, 8))
        form.grid_columnconfigure(1, weight=1)

        ctk.CTkLabel(form, text="Коротке:", font=FONT_SM, text_color=TEXT_MUTED).grid(row=0, column=0, sticky="nw")
        expl_s = ctk.CTkTextbox(form, height=56, font=FONT_DD)
        expl_s.grid(row=0, column=1, sticky="ew", padx=(8, 0), pady=3)
        expl_s.insert("1.0", q.get("explanationShort", "") or "")

        ctk.CTkLabel(form, text="Детальне:", font=FONT_SM, text_color=TEXT_MUTED).grid(row=1, column=0, sticky="nw")
        expl_d = ctk.CTkTextbox(form, height=72, font=FONT_DD)
        expl_d.grid(row=1, column=1, sticky="ew", padx=(8, 0), pady=3)
        expl_d.insert("1.0", q.get("explanationDeep", "") or "")

        self._expl_char_lbl = ctk.CTkLabel(form, text="", font=FONT_SM, text_color=TEXT_MUTED)
        self._expl_char_lbl.grid(row=2, column=1, sticky="w", padx=(8, 0))

        def update_char_count(*_):
            s_len = len(expl_s.get("1.0", "end-1c").strip())
            d_len = len(expl_d.get("1.0", "end-1c").strip())
            self._expl_char_lbl.configure(text="short: {0} · deep: {1} символів".format(s_len, d_len))

        update_char_count()

        def save_explanations():
            if not is_db:
                messagebox.showinfo("Інфо", "Вбудовані питання редагуй у src/data/questions.ts")
                return
            updated = {k: v for k, v in q.items() if not str(k).startswith("_")}
            expl_s_val = expl_s.get("1.0", "end-1c").strip()
            expl_d_val = expl_d.get("1.0", "end-1c").strip()
            if expl_s_val:
                updated["explanationShort"] = expl_s_val
            elif "explanationShort" in updated:
                del updated["explanationShort"]
            if expl_d_val:
                updated["explanationDeep"] = expl_d_val
            elif "explanationDeep" in updated:
                del updated["explanationDeep"]
            if self._save_db_question(updated):
                self._mark_explanation_reviewed(qid)
                messagebox.showinfo("✅", "Збережено")

                def after_index():
                    self._run_tsx_script(
                        "analyze-explanations.mjs", [],
                        "📖 Оновлення звіту",
                        on_complete=lambda rc: self._load_explanation_quality_from_report() if rc == 0 else None,
                    )
                    self._hide_explanation_actions()

                self._refresh_questions_index(on_done=after_index)
            else:
                messagebox.showerror("❌", "Помилка збереження")

        btn_frame = ctk.CTkFrame(panel, fg_color="transparent")
        btn_frame.pack(fill="x", padx=14, pady=(0, 12))
        s = self._semantic()
        nav = ctk.CTkFrame(btn_frame, fg_color="transparent")
        nav.pack(side="left", padx=(0, 8))
        ctk.CTkButton(nav, text="◀", width=36, height=BTN_H, font=FONT_SM,
                      command=lambda: self._navigate_explanation(-1)).pack(side="left", padx=2)
        ctk.CTkButton(nav, text="▶", width=36, height=BTN_H, font=FONT_SM,
                      command=lambda: self._navigate_explanation(1)).pack(side="left", padx=2)
        if is_db:
            ctk.CTkButton(btn_frame, text="💾 Зберегти", width=100, height=BTN_H, font=FONT_SM,
                          fg_color=s["green"], hover=False, command=save_explanations).pack(side="left", padx=4)
            self._help_button(btn_frame, "explanation-edit").pack(side="left", padx=(0, 4))
        ai_cell = ctk.CTkFrame(btn_frame, fg_color="transparent")
        ai_cell.pack(side="left", padx=4)
        ctk.CTkButton(ai_cell, text="🤖 Згенер.", width=90, height=BTN_H, font=FONT_SM,
                      fg_color=s["purple"], hover=False,
                      command=lambda: self._ai_fix_explanation_one(qid, "generate")).pack(side="left")
        ctk.CTkButton(ai_cell, text="Покращ.", width=80, height=BTN_H, font=FONT_SM,
                      fg_color=s["purple"], hover=False,
                      command=lambda: self._ai_fix_explanation_one(qid, "improve")).pack(side="left", padx=2)
        ctk.CTkButton(ai_cell, text="Deep", width=56, height=BTN_H, font=FONT_SM,
                      fg_color=s["purple"], hover=False,
                      command=lambda: self._ai_fix_explanation_one(qid, "expand")).pack(side="left")
        self._help_button(ai_cell, "explanation-bulk-ai").pack(side="left", padx=(2, 0))

    # ── Tab: Налаштування ───────────────────────────────────────────────────

    def _ai_args(self):
        return ["--provider", self.ai_provider, "--model", self.ai_model]

    def _ai_cli_suffix(self):
        return "--provider {0} --model {1}".format(self.ai_provider, self.ai_model)

    def _launcher_subprocess_env(self):
        env = _subprocess_env()
        for key, val in self.env.items():
            if val is not None and val != "":
                env[key] = str(val)
        return env

    def _provider_display_to_id(self, label):
        for pid, plabel in AI_PROVIDER_LABELS.items():
            if plabel == label:
                return pid
        return "ollama"

    def _on_provider_changed(self, label):
        self.ai_provider = self._provider_display_to_id(label)
        self._show_provider_panel()
        self._sync_model_combo_for_provider()
        threading.Thread(target=self._check_active_provider, daemon=True).start()

    def _show_provider_panel(self):
        for pid, frame in self._provider_panels.items():
            if pid == self.ai_provider:
                frame.grid()
            else:
                frame.grid_remove()

    def _sync_model_combo_for_provider(self):
        if self.ai_provider == "gemini":
            self.ai_model = self.gemini_model
            models = list(GEMINI_MODEL_PRESETS)
        elif self.ai_provider == "omniroute":
            self.ai_model = self.omniroute_model
            models = self._omniroute_models or [self.omniroute_model]
        else:
            self.ai_model = self.env.get("OLLAMA_MODEL") or self.ai_model or "mistral"
            models = self._ollama_models or [self.ai_model]
        self.ollama_model = self.ai_model
        self._update_model_selector(models, online=True)

    def _build_tab_settings(self, parent):
        inner = self._scroll_area(parent)
        inner._next_row = 0

        self._section(inner, "🤖 Провайдер AI", colspan=1)
        prov_row = ctk.CTkFrame(inner, fg_color="transparent")
        prov_row.grid(row=inner._next_row, column=0, sticky="ew", padx=4, pady=4)
        inner._next_row += 1
        cur_label = AI_PROVIDER_LABELS.get(self.ai_provider, "Ollama")
        self.provider_seg = ctk.CTkSegmentedButton(
            prov_row,
            values=[AI_PROVIDER_LABELS[p] for p in AI_PROVIDERS],
            command=self._on_provider_changed,
            width=360,
            height=CTRL_H,
            font=FONT_SM,
        )
        self.provider_seg.set(cur_label)
        self.provider_seg.pack(side="left")
        self._help_button(prov_row, "ai-provider").pack(side="left", padx=(8, 0))

        self.settings_ollama_lbl = ctk.CTkLabel(inner, text="Перевірка...", font=FONT_SM, text_color=TEXT_MUTED, anchor="w")
        self.settings_ollama_lbl.grid(row=inner._next_row, column=0, sticky="w", padx=4, pady=(8, 0))
        inner._next_row += 1

        self._provider_panels = {}
        panel_host = ctk.CTkFrame(inner, fg_color="transparent")
        panel_host.grid(row=inner._next_row, column=0, sticky="ew", padx=4)
        inner._next_row += 1
        panel_host.grid_columnconfigure(0, weight=1)

        ollama_panel = ctk.CTkFrame(panel_host, fg_color="transparent")
        ollama_row = ctk.CTkFrame(ollama_panel, fg_color="transparent")
        ollama_row.pack(fill="x", pady=4)
        ctk.CTkButton(ollama_row, text="🔄 Перевірити Ollama", width=180, height=BTN_H, font=FONT_BTN,
                      command=lambda: threading.Thread(target=self._check_ollama, daemon=True).start()
                      ).pack(side="left")
        self._help_button(ollama_row, "ollama-check").pack(side="left", padx=(6, 0))
        self._provider_panels["ollama"] = ollama_panel

        gemini_panel = ctk.CTkFrame(panel_host, fg_color="transparent")
        g_row = ctk.CTkFrame(gemini_panel, fg_color="transparent")
        g_row.pack(fill="x", pady=4)
        ctk.CTkLabel(g_row, text="GEMINI_API_KEY:", font=FONT_SM, text_color=TEXT_MUTED).pack(side="left", padx=(0, 6))
        self.gemini_key_entry = ctk.CTkEntry(g_row, width=220, height=CTRL_H, font=FONT_SM, show="*")
        self.gemini_key_entry.pack(side="left", padx=(0, 8))
        if self.gemini_api_key:
            self.gemini_key_entry.insert(0, self.gemini_api_key)
        ctk.CTkButton(g_row, text="🔄 Перевірити Gemini", width=160, height=BTN_H, font=FONT_BTN,
                      command=lambda: threading.Thread(target=self._check_gemini, daemon=True).start()
                      ).pack(side="left")
        self._help_button(g_row, "gemini-check").pack(side="left", padx=(6, 0))
        self._provider_panels["gemini"] = gemini_panel

        omni_panel = ctk.CTkFrame(panel_host, fg_color="transparent")
        o_base = ctk.CTkFrame(omni_panel, fg_color="transparent")
        o_base.pack(fill="x", pady=2)
        ctk.CTkLabel(o_base, text="Base URL:", font=FONT_SM, text_color=TEXT_MUTED).pack(side="left", padx=(0, 6))
        self.omniroute_base_entry = ctk.CTkEntry(o_base, width=280, height=CTRL_H, font=FONT_SM)
        self.omniroute_base_entry.pack(side="left", padx=(0, 8))
        self.omniroute_base_entry.insert(0, self.omniroute_base)
        o_key = ctk.CTkFrame(omni_panel, fg_color="transparent")
        o_key.pack(fill="x", pady=2)
        ctk.CTkLabel(o_key, text="API Key:", font=FONT_SM, text_color=TEXT_MUTED).pack(side="left", padx=(0, 6))
        self.omniroute_key_entry = ctk.CTkEntry(o_key, width=220, height=CTRL_H, font=FONT_SM, show="*")
        self.omniroute_key_entry.pack(side="left", padx=(0, 8))
        if self.omniroute_api_key:
            self.omniroute_key_entry.insert(0, self.omniroute_api_key)
        o_btn = ctk.CTkFrame(omni_panel, fg_color="transparent")
        o_btn.pack(fill="x", pady=4)
        ctk.CTkButton(o_btn, text="🔄 Перевірити OmniRoute", width=180, height=BTN_H, font=FONT_BTN,
                      command=lambda: threading.Thread(target=self._check_omniroute, daemon=True).start()
                      ).pack(side="left")
        self._help_button(o_btn, "omniroute-check").pack(side="left", padx=(6, 0))
        self._provider_panels["omniroute"] = omni_panel
        self._show_provider_panel()

        self._section(inner, "⚙️ Модель", colspan=1)
        mr = ctk.CTkFrame(inner, fg_color="transparent")
        mr.grid(row=inner._next_row, column=0, sticky="ew", padx=4)
        inner._next_row += 1
        mr.grid_columnconfigure(1, weight=1)
        ctk.CTkLabel(mr, text="AI_MODEL:", font=FONT_SM, text_color=TEXT_MUTED).grid(
            row=0, column=0, sticky="w", padx=(0, 8))
        self.model_var = tk.StringVar(value=self.ai_model)
        self.model_combo = ctk.CTkComboBox(
            mr, variable=self.model_var, values=[self.ai_model],
            width=280, height=CTRL_H, font=FONT_DD,
            command=lambda _: self._sync_model_from_selector(),
        )
        self.model_combo.set(self.ai_model)
        self.model_combo.grid(row=0, column=1, sticky="ew", padx=(0, 8))
        btn_cell = ctk.CTkFrame(mr, fg_color="transparent")
        btn_cell.grid(row=0, column=2, sticky="e")
        ctk.CTkButton(btn_cell, text="Застосувати", width=110, height=BTN_H, font=FONT_BTN,
                      command=self._apply_model).pack(side="left")
        ctk.CTkButton(btn_cell, text="🔄", width=36, height=BTN_H, font=FONT_BTN,
                      command=lambda: threading.Thread(target=self._refresh_provider_models, daemon=True).start()
                      ).pack(side="left", padx=(4, 0))
        self._help_button(btn_cell, "ollama-model").pack(side="left", padx=(6, 0))
        self.model_hint = ctk.CTkLabel(
            mr, text="Список моделей — після перевірки провайдера",
            font=FONT_SM, text_color=TEXT_MUTED, anchor="w",
        )
        self.model_hint.grid(row=1, column=0, columnspan=3, sticky="w", pady=(6, 0))

        self._section(inner, "📁 Шляхи", colspan=1)
        ctk.CTkLabel(inner, text="Проєкт: " + self.project_root, font=FONT_SM, text_color=TEXT_MUTED, anchor="w"
                     ).grid(row=inner._next_row, column=0, sticky="w", padx=4)
        inner._next_row += 1
        ctk.CTkLabel(inner, text="Запуск: npm run ai-launcher", font=FONT_SM, text_color=TEXT_MUTED, anchor="w"
                     ).grid(row=inner._next_row, column=0, sticky="w", padx=4, pady=2)
        inner._next_row += 1
        ctk.CTkLabel(inner, text="Документація: scripts/AI_SETUP.md", font=FONT_SM,
                     text_color=self._semantic()["cyan"], anchor="w"
                     ).grid(row=inner._next_row, column=0, sticky="w", padx=4, pady=4)

    def _normalize_model_names(self, models):
        names = []
        seen = set()
        for raw in models or []:
            name = (raw or "").strip()
            if not name or name in seen:
                continue
            seen.add(name)
            names.append(name)
        names.sort(key=str.lower)
        current = (self.ai_model or "").strip()
        if current and current not in seen:
            names.insert(0, current)
        return names

    def _update_model_selector(self, models, online=True):
        if not hasattr(self, "model_combo"):
            return
        values = self._normalize_model_names(models)
        if self.ai_provider == "ollama":
            self._ollama_models = values
        elif self.ai_provider == "omniroute":
            self._omniroute_models = values
        if not values:
            values = [self.ai_model or "mistral"]
        selected = (self.model_var.get() or self.ai_model or values[0]).strip()
        self.model_combo.configure(values=values)
        if selected in values:
            self.model_combo.set(selected)
        else:
            self.model_combo.set(values[0])
            selected = values[0]
        self.ai_model = selected
        self.ollama_model = selected
        if hasattr(self, "model_hint"):
            plabel = AI_PROVIDER_LABELS.get(self.ai_provider, "AI")
            if online and values:
                self.model_hint.configure(
                    text="{0}: {1} моделей. Обрано: {2}".format(plabel, len(values), selected))
            elif online:
                self.model_hint.configure(text="{0} online — моделі не знайдено".format(plabel))
            else:
                self.model_hint.configure(text="{0} offline".format(plabel))

    def _sync_model_from_selector(self):
        selected = (self.model_var.get() or "").strip()
        if selected:
            self.ai_model = selected
            self.ollama_model = selected
            if self.ai_provider == "gemini":
                self.gemini_model = selected
            elif self.ai_provider == "omniroute":
                self.omniroute_model = selected

    def _read_provider_fields_from_ui(self):
        if hasattr(self, "gemini_key_entry"):
            self.gemini_api_key = self.gemini_key_entry.get().strip()
        if hasattr(self, "omniroute_base_entry"):
            self.omniroute_base = self.omniroute_base_entry.get().strip().rstrip("/")
        if hasattr(self, "omniroute_key_entry"):
            self.omniroute_api_key = self.omniroute_key_entry.get().strip()

    def _apply_model(self):
        self._read_provider_fields_from_ui()
        selected = (self.model_var.get() or "").strip() or self.ai_model or "mistral"
        self.ai_model = selected
        self.ollama_model = selected
        self.model_combo.set(selected)
        ok = True
        ok = _write_env_var(self.env_path, "AI_PROVIDER", self.ai_provider) and ok
        ok = _write_env_var(self.env_path, "AI_MODEL", selected) and ok
        if self.ai_provider == "ollama":
            ok = _write_env_var(self.env_path, "OLLAMA_MODEL", selected) and ok
        elif self.ai_provider == "gemini":
            self.gemini_model = selected
            ok = _write_env_var(self.env_path, "GEMINI_MODEL", selected) and ok
            ok = _write_env_var(self.env_path, "GEMINI_API_KEY", self.gemini_api_key) and ok
        elif self.ai_provider == "omniroute":
            self.omniroute_model = selected
            ok = _write_env_var(self.env_path, "OMNIROUTE_MODEL", selected) and ok
            ok = _write_env_var(self.env_path, "OMNIROUTE_BASE_URL", self.omniroute_base) and ok
            ok = _write_env_var(self.env_path, "OMNIROUTE_API_KEY", self.omniroute_api_key) and ok
        self.env["AI_PROVIDER"] = self.ai_provider
        self.env["AI_MODEL"] = selected
        self.env["OLLAMA_MODEL"] = selected if self.ai_provider == "ollama" else self.env.get("OLLAMA_MODEL", selected)
        self.env["GEMINI_API_KEY"] = self.gemini_api_key
        self.env["GEMINI_MODEL"] = self.gemini_model
        self.env["OMNIROUTE_BASE_URL"] = self.omniroute_base
        self.env["OMNIROUTE_API_KEY"] = self.omniroute_api_key
        self.env["OMNIROUTE_MODEL"] = self.omniroute_model
        msg = "{0} • {1}".format(AI_PROVIDER_LABELS.get(self.ai_provider, self.ai_provider), selected)
        if ok:
            msg += " (збережено в .env)"
        elif os.path.isfile(self.env_path):
            msg += " (не вдалось записати .env)"
        self._set_status(msg, self._semantic()["green"])

    def _fetch_ollama_models(self):
        url = "http://{0}:{1}/api/tags".format(self.ollama_host, self.ollama_port)
        with urlopen(url, timeout=3) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        return [m.get("name", "") for m in data.get("models", []) if m.get("name")]

    def _fetch_omniroute_models(self):
        base = self.omniroute_base.rstrip("/")
        url = base + "/models" if base.endswith("/v1") else base + "/v1/models"
        req = Request(url, headers={"Authorization": "Bearer " + self.omniroute_api_key})
        with urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        return [m.get("id", "") for m in data.get("data", []) if m.get("id")]

    def _refresh_provider_models(self):
        self._check_active_provider()

    def _refresh_ollama_models(self):
        self._check_ollama()

    def _update_ai_badge(self, text, color, models, online):
        def upd():
            if self._shutting_down:
                return
            self.ollama_badge.configure(text=text, text_color=color)
            if hasattr(self, "settings_ollama_lbl"):
                self.settings_ollama_lbl.configure(text=text, text_color=color)
            if self.ai_provider == getattr(self, "_last_check_provider", self.ai_provider):
                self._update_model_selector(models, online=online)
        self._last_check_provider = self.ai_provider
        self._safe_after(upd)

    def _check_active_provider(self):
        if self.ai_provider == "gemini":
            self._check_gemini()
        elif self.ai_provider == "omniroute":
            self._check_omniroute()
        else:
            self._check_ollama()

    def _check_ollama(self):
        try:
            models = self._fetch_ollama_models()
            preview = ", ".join(models[:3])
            if len(models) > 3:
                preview += "…"
            text = "Ollama online • {0} моделей".format(len(models))
            if preview:
                text += " ({0})".format(preview)
            color = self._semantic()["green"]
            online = True
        except (URLError, OSError, json.JSONDecodeError, TimeoutError):
            models = self._ollama_models
            text = "Ollama offline — запусти ollama serve"
            color = self._semantic()["red"]
            online = False
        self._update_ai_badge(text, color, models, online)

    def _check_gemini(self):
        self._read_provider_fields_from_ui()
        if not self.gemini_api_key:
            text = "Gemini: вкажи GEMINI_API_KEY"
            self._update_ai_badge(text, self._semantic()["red"], list(GEMINI_MODEL_PRESETS), False)
            return
        try:
            url = (
                "https://generativelanguage.googleapis.com/v1beta/models?key="
                + self.gemini_api_key
            )
            with urlopen(url, timeout=8) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            api_models = [
                m.get("name", "").replace("models/", "")
                for m in data.get("models", [])
                if "gemini" in str(m.get("name", ""))
            ]
            models = self._normalize_model_names(list(GEMINI_MODEL_PRESETS) + api_models[:20])
            text = "Gemini online • {0}".format(self.gemini_model or models[0])
            self._update_ai_badge(text, self._semantic()["green"], models, True)
        except (URLError, OSError, json.JSONDecodeError, TimeoutError) as ex:
            text = "Gemini offline — {0}".format(ex)
            self._update_ai_badge(text, self._semantic()["red"], list(GEMINI_MODEL_PRESETS), False)

    def _check_omniroute(self):
        self._read_provider_fields_from_ui()
        if not self.omniroute_api_key:
            text = "OmniRoute: вкажи OMNIROUTE_API_KEY"
            self._update_ai_badge(text, self._semantic()["red"], [self.omniroute_model], False)
            return
        try:
            models = self._fetch_omniroute_models()
            preview = ", ".join(models[:2])
            if len(models) > 2:
                preview += "…"
            text = "OmniRoute online • {0} моделей".format(len(models))
            if preview:
                text += " ({0})".format(preview)
            self._update_ai_badge(text, self._semantic()["green"], models, True)
        except (URLError, OSError, json.JSONDecodeError, TimeoutError):
            text = "OmniRoute offline — запусти omniroute"
            self._update_ai_badge(text, self._semantic()["red"], self._omniroute_models or [self.omniroute_model], False)

    # ── Execution ───────────────────────────────────────────────────────────

    def _run_npm(self, script, args, label, on_complete=None):
        cmd = "npm.cmd run {0}".format(script)
        if args:
            cmd += " -- {0}".format(args)
        return self._execute(cmd, label, on_complete=on_complete)

    def _run_tsx_script(self, script_rel, argv, label, on_complete=None):
        """tsx-скрипт; для analyze-explanations — окремий надійний запуск."""
        if script_rel == "analyze-explanations.mjs":
            return self._run_analyze_explanations_command(argv, label, on_complete)
        script_path = os.path.join(self.script_dir, script_rel)
        if not os.path.isfile(script_path):
            messagebox.showerror("Помилка", "Скрипт не знайдено:\n" + script_path)
            return False
        node = _resolve_executable("node")
        if not node:
            messagebox.showerror("Node.js", "Не знайдено node.exe у PATH.")
            return False
        cmd = [node, "--import", "tsx", script_path]
        if argv:
            cmd.extend(argv)
        display = "node --import tsx {0}".format(script_rel)
        if argv:
            display += " " + " ".join(argv)
        return self._execute_argv(cmd, display, label, on_complete=on_complete)

    def _execute_argv(self, argv, display_cmd, label, on_complete=None):
        if self._conveyor_busy or (self.process and self.process.poll() is None):
            messagebox.showwarning("Зайнято", "Дочекайтесь завершення поточної команди.")
            return False
        self._expand_console()
        self._log("─" * 54 + "\n", "header")
        self._log("  {0}\n".format(label), "info")
        self._log("  $ {0}\n".format(display_cmd), "dim")
        self._log("─" * 54 + "\n", "header")
        self._set_status("⏳  " + label, self._semantic()["cyan"], busy=True)
        self._stop_requested = False

        def run():
            rc = -1
            try:
                kw = _popen_argv(self.project_root)
                kw["env"] = self._launcher_subprocess_env()
                self.process = subprocess.Popen(argv, **kw)
                for line in self.process.stdout:
                    if self._shutting_down or self._stop_requested:
                        break
                    self._log(line, self._tag_line(line))
                if (self._shutting_down or self._stop_requested) and self.process.poll() is None:
                    _kill_process_tree(self.process)
                else:
                    self.process.wait()
                rc = self.process.returncode if self.process else -1
                if self._shutting_down or self._stop_requested:
                    return
                if rc == 0:
                    self._log("\n✔  Завершено успішно\n\n", "success")
                    self._set_status("✔  Завершено", self._semantic()["green"])
                else:
                    self._log("\n✘  Помилка (код {0})\n\n".format(rc), "error")
                    self._set_status("✘  Помилка", self._semantic()["red"])
            except Exception as ex:
                if not self._shutting_down:
                    self._log("\n✘  {0}\n\n".format(ex), "error")
                    self._set_status("✘  Помилка", self._semantic()["red"])
            finally:
                def _fin():
                    stopped = self._stop_requested
                    if stopped:
                        self._stop_requested = False
                        self.process = None
                    if on_complete and not stopped:
                        on_complete(rc)
                    if not self._shutting_down:
                        self.stop_btn.configure(state="disabled")
                self._safe_after(_fin)

        self.stop_btn.configure(state="normal")
        threading.Thread(target=run, daemon=True).start()
        return True

    def _execute(self, cmd, label, on_complete=None):
        if self._conveyor_busy or (self.process and self.process.poll() is None):
            messagebox.showwarning("Зайнято", "Дочекайтесь завершення поточної команди.")
            return False
        self._expand_console()
        self._log("─" * 54 + "\n", "header")
        self._log("  {0}\n".format(label), "info")
        self._log("  $ {0}\n".format(cmd), "dim")
        self._log("─" * 54 + "\n", "header")
        self._set_status("⏳  " + label, self._semantic()["cyan"], busy=True)
        self._stop_requested = False

        def run():
            rc = -1
            try:
                kw = _popen_kwargs(self.project_root)
                kw["env"] = self._launcher_subprocess_env()
                self.process = subprocess.Popen(cmd, **kw)
                for line in self.process.stdout:
                    if self._shutting_down or self._stop_requested:
                        break
                    self._log(line, self._tag_line(line))
                if (self._shutting_down or self._stop_requested) and self.process.poll() is None:
                    _kill_process_tree(self.process)
                else:
                    self.process.wait()
                rc = self.process.returncode if self.process else -1
                if self._shutting_down or self._stop_requested:
                    return
                if rc == 0:
                    self._log("\n✔  Завершено успішно\n\n", "success")
                    self._set_status("✔  Завершено", self._semantic()["green"])
                else:
                    self._log("\n✘  Помилка (код {0})\n\n".format(rc), "error")
                    self._set_status("✘  Помилка", self._semantic()["red"])
            except Exception as ex:
                if not self._shutting_down and not self._stop_requested:
                    self._log("\n✘  {0}\n\n".format(ex), "error")
                    self._set_status("✘  Помилка", self._semantic()["red"])
            finally:
                def _fin():
                    stopped = self._stop_requested
                    if stopped:
                        self._stop_requested = False
                        self.process = None
                    if on_complete and not stopped:
                        on_complete(rc)
                    if not self._shutting_down:
                        self.stop_btn.configure(state="disabled")
                self._safe_after(_fin)
        self.stop_btn.configure(state="normal")
        threading.Thread(target=run, daemon=True).start()
        return True

    def _stop_process(self):
        if self.process and self.process.poll() is None:
            self._stop_requested = True
            _kill_process_tree(self.process)
            self._log("\n⏹  ЗУПИНЕНО\n\n", "warning")
            self._set_status("⏹  Зупинено", self._semantic()["orange"])
            self.stop_btn.configure(state="disabled")
            self._conveyor_busy = False
            self._conveyor_stop_progress_indeterminate()
            self._conveyor_set_cfg_enabled(True)
            if hasattr(self, "_conveyor_status"):
                self._conveyor_status.configure(text="Зупинено.")
            if hasattr(self, "_conveyor_review_panel"):
                self._conveyor_show_activity("Зупинено", "Генерацію перервано.")
        elif self._conveyor_busy:
            self._stop_requested = True
            self._conveyor_busy = False
            self._log("\n⏹  ЗУПИНЕНО\n\n", "warning")
            self._set_status("⏹  Зупинено", self._semantic()["orange"])
            self.stop_btn.configure(state="disabled")
            self._conveyor_stop_progress_indeterminate()
            self._conveyor_set_cfg_enabled(True)
            if hasattr(self, "_conveyor_status"):
                self._conveyor_status.configure(text="Зупинено.")
            if hasattr(self, "_conveyor_review_panel"):
                self._conveyor_show_activity("Зупинено", "Генерацію перервано.")

    # ── Console helpers ─────────────────────────────────────────────────────

    def _setup_tags(self):
        s = self._semantic()
        tb = self._console_text
        for name, fg, bold in [
            ("info", s["cyan"], False), ("success", s["green"], True), ("error", s["red"], False),
            ("warning", s["orange"], True), ("dim", s["dim"], False), ("purple", s["purple"], False),
            ("cyan", s["cyan"], False), ("header", s["cyan"], True),
        ]:
            tb.tag_config(name, foreground=fg, font=("Consolas", 12, "bold") if bold else FONT_MONO_TK)

    def _tag_line(self, line):
        lo = line.lower().strip()
        if not lo:
            return None
        if any(x in lo for x in ("error", "failed", "✘", "exception")):
            return "error"
        if any(x in lo for x in ("warn", "⚠")):
            return "warning"
        if any(x in lo for x in ("✔", "done", "завершено", "success")):
            return "success"
        if lo.startswith(("$", "npm", ">")):
            return "dim"
        return None

    def _safe_after(self, callback):
        if self._shutting_down:
            return
        try:
            self.after(0, callback)
        except tk.TclError:
            pass

    def _log(self, text, tag=None):
        if self._shutting_down:
            return

        def _do():
            if self._shutting_down:
                return
            tb = self._console_text
            tb.configure(state="normal")
            if tag:
                tb.insert("end", text, tag)
            else:
                tb.insert("end", text)
            tb.see("end")
            tb.configure(state="disabled")

        self._safe_after(_do)

    def _clear_console(self):
        tb = self._console_text
        tb.configure(state="normal")
        tb.delete("1.0", "end")
        tb.configure(state="disabled")

    def _copy_to_clipboard(self, text):
        try:
            if HAS_PYPERCLIP:
                pyperclip.copy(text)
            else:
                self.clipboard_clear()
                self.clipboard_append(text)
            return True
        except Exception:
            return False

    def _copy_console_all(self):
        tb = self._console_text
        tb.configure(state="normal")
        text = tb.get("1.0", "end-1c")
        tb.configure(state="disabled")
        if self._copy_to_clipboard(text):
            self._set_status("📋 Скопійовано", self._semantic()["green"])

    def _copy_selection(self, event=None):
        try:
            w = event.widget if event else self.focus_get()
            if isinstance(w, tk.Text):
                try:
                    sel = w.get(tk.SEL_FIRST, tk.SEL_LAST)
                except tk.TclError:
                    sel = w.get("1.0", "end-1c")
            elif isinstance(w, (tk.Entry,)):
                try:
                    sel = w.get(tk.SEL_FIRST, tk.SEL_LAST)
                except tk.TclError:
                    return "break"
            else:
                return "break"
            self._copy_to_clipboard(sel)
        except Exception:
            pass
        return "break"

    def _show_context_menu(self, event):
        try:
            w = event.widget
            if isinstance(w, tk.Text):
                menu = tk.Menu(self, tearoff=0)
                menu.add_command(label="📋 Копіювати", command=lambda: self._copy_selection_for_widget(w))
                menu.post(event.x_root, event.y_root)
        except Exception:
            pass

    def _copy_selection_for_widget(self, widget):
        try:
            sel = widget.get(tk.SEL_FIRST, tk.SEL_LAST)
            self._copy_to_clipboard(sel)
        except Exception:
            pass

    def _set_status(self, text, color, busy=False):
        def _do():
            if self._shutting_down:
                return
            self.status_var.set(text)
            self.status_dot.configure(text_color=color)
            if busy:
                self.stop_btn.configure(state="normal")
        self._safe_after(_do)


def _show_topmost_message(title, message, kind="warning"):
    root = tk.Tk()
    root.withdraw()
    root.attributes("-topmost", True)
    if kind == "warning":
        messagebox.showwarning(title, message, parent=root)
    else:
        messagebox.showerror(title, message, parent=root)
    root.destroy()


if __name__ == "__main__":
    _try_reclaim_stale_instance()
    _instance_lock = _acquire_single_instance()
    if _instance_lock is None:
        _try_reclaim_stale_instance()
        _instance_lock = _acquire_single_instance()
    if _instance_lock is None:
        _show_topmost_message(
            APP_NAME,
            "Launcher уже запущено.\n\n"
            "Перевірте панель задач (іконка Python).\n"
            "Якщо вікна немає — закрийте pythonw у диспетчері задач і спробуйте знову.",
        )
        raise SystemExit(0)

    app = AiLauncherV3()
    app._instance_lock = _instance_lock
    try:
        app.mainloop()
    finally:
        _kill_process_tree(getattr(app, "process", None))
        try:
            _instance_lock.close()
        except Exception:
            pass
