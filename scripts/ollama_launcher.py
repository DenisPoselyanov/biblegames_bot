import tkinter as tk
from tkinter import messagebox, ttk
import subprocess
import threading
import os
import json
import re

def _is_dark_mode():
    try:
        import winreg
        key = winreg.OpenKey(winreg.HKEY_CURRENT_USER,
            r"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize")
        val, _ = winreg.QueryValueEx(key, "AppsUseLightTheme")
        winreg.CloseKey(key)
        return val == 0
    except Exception:
        return True

DARK = {
    "bg":"#0d1117","panel":"#161b22","panel2":"#1c2128","border":"#30363d",
    "text":"#e6edf3","text_dim":"#8b949e","btn_hov":"#2d333b",
    "accent":"#58a6ff","green":"#3fb950","orange":"#d29922",
    "red":"#f78166","purple":"#bc8cff","cyan":"#39c5cf","con_bg":"#0d1117",
}
LIGHT = {
    "bg":"#f6f8fa","panel":"#ffffff","panel2":"#f0f3f6","border":"#d0d7de",
    "text":"#1f2328","text_dim":"#656d76","btn_hov":"#eaeef2",
    "accent":"#0969da","green":"#1a7f37","orange":"#9a6700",
    "red":"#cf222e","purple":"#8250df","cyan":"#0550ae","con_bg":"#ffffff",
}

FONT_MONO  = ("Consolas", 10)
FONT_SM    = ("Segoe UI", 9)
FONT_H     = ("Segoe UI Semibold", 11)
FONT_TITLE = ("Segoe UI Light", 15)
FONT_DD    = ("Segoe UI", 10)

KEY_INDICATORS = [
    'цар','пророк','апостол','книг','писан','заповід',
    'закон','жертв','свят','чудо','зцілен','воскрес',
    'народ','земл','міст','річк','гор','пустел',
    'війн','битв','суд','полон','храм','скині',
    'псалм','пісн','молит','благослов','проклят',
    'род','плем','колін','син','доньк','батьк',
    'подорож','місі','проповід','навчан','притч',
]

# Канонічна важливість теми (0-60)
CANONICAL_IMPORTANCE = {
    'євангелі': 60,  # 4 Євангелія — життя Христа
    'псалм': 55,     # 150 псалмів
    'пророк': 50,    # Великі + малі пророки
    'павло': 45,     # 13 послань апостола
    'завіт': 40,     # Цілий Завіт (СЗ/НЗ)
    'закон': 35,     # П'ятикнижжя
    'цар': 30,       # Історія царів
    'притч': 25,     # Притчі Ісуса
    'чудо': 25,      # Чудеса
    'географ': 20,   # Географія
    'відкрит': 25,   # Об'явлення / есхатологія
    'патріарх': 20,  # Патріархи
    'судд': 20,      # Судді
    'заповід': 20,   # 10 заповідей
    'молит': 15,     # Молитви
    'бутт': 25,      # Буття (створення)
    'виход': 25,     # Вихід
    'повтор': 25,    # Повторення Закону
    'ісус': 30,      # Ісус Навин
    'самуїл': 25,    # Самуїл
    'єзек': 20,      # Єзекіїль
    'даниїл': 20,    # Даниїл
    'єрем': 20,      # Єремія
    'іса': 20,       # Ісая
    'марк': 20,      # Марко (скорочено)
    'лук': 20,       # Лука
    'іван': 20,      # Іван
    'матв': 20,      # Матвій
    'ерем': 20,      # Єремія (альт)
}


def _load_json(path):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except:
        return None


def _save_json(path, data):
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return True
    except:
        return False


def _flatten_nodes(node, depth=0, file_id="", parent_id=None):
    if not node:
        return []
    result = [(node, depth, file_id, parent_id)]
    node_id = node.get("id")
    for child in node.get("children", []):
        result.extend(_flatten_nodes(child, depth + 1, file_id, node_id))
    return result


# ========================== АНАЛІЗ ЯКОСТІ ТЕМ ==========================

def _calculate_breadth(node):
    score = 0
    title = node.get("title", "")
    desc = node.get("description", "") or ""
    title_lower = title.lower()
    desc_lower = desc.lower()

    # 1. Канонічна важливість (0-60)
    canonical_score = 0
    for keyword, weight in CANONICAL_IMPORTANCE.items():
        if keyword in title_lower:
            canonical_score = max(canonical_score, weight)
    score += canonical_score

    # 2. Ієрархічна ширина (0-25)
    children = node.get("children", [])
    child_score = min(len(children) * 5, 15)
    total = len(_flatten_nodes(node))
    descendant_score = min(int(total ** 0.5) * 4, 8)
    depth = _max_depth(node)
    depth_score = min(depth * 3, 5)
    score += child_score + descendant_score + depth_score

    # 3. Багатство опису (0-15)
    desc_words = desc.split()
    word_score = min(len(desc_words) // 2, 7)
    indicator_score = min(sum(1 for ki in KEY_INDICATORS if ki in desc_lower), 8)
    score += word_score + indicator_score

    # 4. Контекст групи/агрегації (0-10)
    if node.get("aggregateThemeIds") and len(node["aggregateThemeIds"]) > 1:
        score += 10
    elif node.get("themeId"):
        score += 5  # тема в складі групи

    return min(score, 100)


def _max_depth(node, depth=1):
    children = node.get("children", [])
    if not children: return depth
    return max(_max_depth(c, depth + 1) for c in children)


def _eval_description(node):
    desc = node.get("description", "") or ""
    words = desc.split()
    score = 0
    notes = []
    if len(words) >= 10: score += 30
    elif len(words) >= 5: score += 15; notes.append("Короткий")
    elif len(words) >= 2: score += 5; notes.append("Дуже короткий")
    else: notes.append("Опис відсутній")
    if desc and not desc.endswith("."):
        notes.append("Немає крапки")
    icon = node.get("icon", "")
    if icon and icon != "📖": score += 10
    else: notes.append("Стандартна іконка 📖")
    if re.search(r'[1-5]?\s*[А-Яа-яґєії]{2,}\.', desc):
        score += 15
    return min(score, 100), notes


def _analyze_all_topics(topics_dir):
    """Повертає список словників з аналізом кожного вузла.
    Якщо є topics-db.json — аналізуємо тільки його (єдине джерело).
    Інакше — аналізуємо всі окремі JSON-файли (фолбек).
    """
    results = []
    if not os.path.exists(topics_dir):
        return results

    merged_path = os.path.join(topics_dir, "topics-db.json")
    files_to_scan = ["topics-db.json"] if os.path.exists(merged_path) else sorted(
        f for f in os.listdir(topics_dir) if f.endswith(".json")
    )

    for fname in files_to_scan:
        file_id = fname.replace(".json", "")
        root = _load_json(os.path.join(topics_dir, fname))
        if not root: continue
        flat = _flatten_nodes(root, 0, file_id)
        for node, depth, fid, par_id in flat:
            if depth == 0: continue  # пропускаємо кореневі вузли файлів
            breadth = _calculate_breadth(node)
            desc_score, desc_notes = _eval_description(node)
            issues = []
            if breadth < 30: issues.append("Вузька тема")
            if depth == 0: issues.append("Коренева")
            if not node.get("icon") or node.get("icon") == "📖":
                issues.append("Немає іконки")
            if not node.get("description") or len(node.get("description","").split()) < 3:
                issues.append("Немає опису")
            if node.get("themeId") and not node.get("children"):
                issues.append("Лист-тема")
            results.append({
                "file_id": fid,
                "id": node.get("id", "?"),
                "title": node.get("title", "?"),
                "icon": node.get("icon", "\U0001f4d6"),
                "description": node.get("description", ""),
                "depth": depth,
                "breadth": breadth,
                "desc_score": desc_score,
                "themeId": node.get("themeId"),
                "issues": issues,
                "children": len(node.get("children", [])),
                "parent_id": par_id,
            })
    return results


# ========================== GUI ==========================

THEMES_DICT = {
    "old-testament":"Старий Завіт","mosaic-law":"Закон Мойсея","judges":"Судді",
    "kings":"Царі","prophets":"Пророки","psalms":"Псалми","patriarchs":"Патріархи",
    "geography":"Географія","commandments":"Десять заповідей",
    "new-testament":"Новий Завіт","gospels":"Євангелія","paul":"Апостол Павло",
    "parables":"Притчі","miracles":"Чудеса Ісуса","revelation":"Відкриття",
}

GROUPS_CONF = {
    "old-testament": {"title": "Старий Завіт", "theme_ids": ["old-testament","mosaic-law","judges","kings","prophets","psalms","patriarchs","geography","commandments"]},
    "new-testament": {"title": "Новий Завіт", "theme_ids": ["new-testament","gospels","paul","parables","miracles","revelation"]},
}

DIFFICULTIES = [
    ("all", "Усі рівні"), ("baby", "👶 Немовля"), ("child", "🧒 Дитина"),
    ("youth", "🧑 Юнак"), ("student", "🎓 Учень"), ("preacher", "📖 Проповідник"),
    ("teacher", "👨‍🏫 Учитель"), ("theologian", "⛪ Богослов"),
]


class OllamaLauncher(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Ollama Launcher")
        self.geometry("1020x720")
        self.minsize(800, 560)
        self._dark = _is_dark_mode()
        self.T = DARK if self._dark else LIGHT
        self.configure(bg=self.T["bg"])
        self.cwd = os.path.dirname(os.path.abspath(__file__))
        self.topics_dir = os.path.join(self.cwd, "..", "data", "topics-db")
        self.process = None
        self._pending_cmd = None
        self._cards_meta = []
        self._topic_results = []
        self._build_ui()

    def _build_ui(self):
        T = self.T
        self.hdr = tk.Frame(self, bg=T["bg"])
        self.hdr.pack(fill="x")
        hi = tk.Frame(self.hdr, bg=T["bg"])
        hi.pack(fill="x", padx=20, pady=12)
        self.lbl_title = tk.Label(hi, text="⬡  Ollama Launcher",
            font=FONT_TITLE, fg=T["accent"], bg=T["bg"])
        self.lbl_title.pack(side="left")
        self.lbl_sub = tk.Label(hi, text="npm run wrapper",
            font=FONT_SM, fg=T["text_dim"], bg=T["bg"])
        self.lbl_sub.pack(side="left", padx=10)
        self.theme_btn = tk.Label(hi, text="☀" if self._dark else "🌙",
            font=("Segoe UI Emoji", 14), fg=T["text_dim"], bg=T["bg"], cursor="hand2")
        self.theme_btn.pack(side="right")
        self.theme_btn.bind("<Button-1>", lambda e: self._toggle_theme())
        self.sep1 = tk.Frame(self, bg=T["border"], height=1)
        self.sep1.pack(fill="x")

        self.body = tk.Frame(self, bg=T["bg"])
        self.body.pack(fill="both", expand=True)

        # Sidebar
        self.sidebar = tk.Frame(self.body, bg=T["bg"], width=270)
        self.sidebar.pack(side="left", fill="y", padx=(16,0), pady=16)
        self.sidebar.pack_propagate(False)
        self.lbl_cmds = tk.Label(self.sidebar, text="КОМАНДИ",
            font=("Segoe UI Semibold", 8), fg=T["text_dim"], bg=T["bg"])
        self.lbl_cmds.pack(anchor="w", pady=(0,10))

        self._make_card("📊","Статистика питань",
            "Статистика всіх питань (AI + вбудовані)",
            T["accent"], self._run_stats)
        self._make_card("🌿","Ієрархія тем",
            "Генерація ієрархії тем через Ollama",
            T["green"], self._open_topics)
        self._make_card("✨","AI-питання",
            "Генерація питань через Ollama",
            T["purple"], self._open_questions)
        self._make_card("🔍","Якість тем",
            "Аналіз, сортування та редагування всіх тем",
            T["orange"], self._open_topic_quality)

        self.vsep = tk.Frame(self.body, bg=T["border"], width=1)
        self.vsep.pack(side="left", fill="y", padx=12)

        self.right = tk.Frame(self.body, bg=T["bg"])
        self.right.pack(side="left", fill="both", expand=True, padx=(0,16), pady=16)

        # Args panel
        self.args_outer = tk.Frame(self.right, bg=T["panel"],
            highlightthickness=1, highlightbackground=T["border"])

        # Console
        ch = tk.Frame(self.right, bg=T["bg"])
        ch.pack(fill="x", pady=(8,4))
        self.lbl_output = tk.Label(ch, text="ВИВІД",
            font=("Segoe UI Semibold",8), fg=T["text_dim"], bg=T["bg"])
        self.lbl_output.pack(side="left")
        self.clear_btn = tk.Label(ch, text="✕  Очистити",
            font=FONT_SM, fg=T["text_dim"], bg=T["bg"], cursor="hand2")
        self.clear_btn.pack(side="right")
        self.clear_btn.bind("<Button-1>", lambda e: self._clear_console())
        self.clear_btn.bind("<Enter>", lambda e: self.clear_btn.config(fg=T["red"]))
        self.clear_btn.bind("<Leave>", lambda e: self.clear_btn.config(fg=T["text_dim"]))

        self.con_wrap = tk.Frame(self.right, bg=T["con_bg"],
            highlightthickness=1, highlightbackground=T["border"])
        self.con_wrap.pack(fill="both", expand=True)

        self.con_scroll = tk.Scrollbar(self.con_wrap,
            bg=T["panel2"], troughcolor=T["con_bg"],
            relief="flat", bd=0, width=12)
        self.con_scroll.pack(side="right", fill="y")

        self.console = tk.Text(self.con_wrap, font=FONT_MONO,
            bg=T["con_bg"], fg=T["text"], insertbackground=T["accent"],
            relief="flat", bd=10, wrap="word", state="disabled",
            selectbackground=T["accent"], selectforeground=T["bg"],
            yscrollcommand=self.con_scroll.set)
        self.console.pack(side="left", fill="both", expand=True)
        self.con_scroll.config(command=self.console.yview)

        self.console.bind("<Control-c>", self._copy_selection)
        self.console.bind("<Control-C>", self._copy_selection)
        self._setup_tags()

        self.sep2 = tk.Frame(self, bg=T["border"], height=1)
        self.sep2.pack(fill="x")
        self.sb = tk.Frame(self, bg=T["bg"], pady=6)
        self.sb.pack(fill="x", padx=16)
        self.status_dot = tk.Label(self.sb, text="●", fg=T["green"],
            bg=T["bg"], font=("Segoe UI",9))
        self.status_dot.pack(side="left")
        self.status_var = tk.StringVar(value="Готовий")
        self.status_lbl = tk.Label(self.sb, textvariable=self.status_var,
            fg=T["text_dim"], bg=T["bg"], font=FONT_SM)
        self.status_lbl.pack(side="left", padx=4)
        self.stop_btn = tk.Label(self.sb, text="⏹  Зупинити",
            font=("Segoe UI Semibold",9), fg=T["text_dim"], bg=T["bg"],
            cursor="hand2", padx=8)
        self.stop_btn.pack(side="right")
        self.stop_btn.bind("<Button-1>", lambda e: self._stop_process())
        self.stop_btn.config(state="disabled")

    def _make_card(self, icon, title, desc, color, on_click):
        T = self.T
        card = tk.Frame(self.sidebar, bg=T["panel"], cursor="hand2",
            highlightthickness=1, highlightbackground=T["border"])
        card.pack(fill="x", pady=(0,8))
        stripe = tk.Frame(card, bg=color, width=4)
        stripe.pack(side="left", fill="y")
        inner = tk.Frame(card, bg=T["panel"])
        inner.pack(side="left", fill="x", expand=True, padx=12, pady=12)
        row = tk.Frame(inner, bg=T["panel"])
        row.pack(fill="x")
        ico = tk.Label(row, text=icon, font=("Segoe UI Emoji",18),
            fg=color, bg=T["panel"])
        ico.pack(side="left", padx=(0,10))
        txt = tk.Frame(row, bg=T["panel"])
        txt.pack(side="left", fill="x", expand=True)
        t_lbl = tk.Label(txt, text=title, font=FONT_H,
            fg=T["text"], bg=T["panel"], anchor="w")
        t_lbl.pack(fill="x")
        d_lbl = tk.Label(txt, text=desc, font=FONT_SM,
            fg=T["text_dim"], bg=T["panel"], anchor="w",
            wraplength=185, justify="left")
        d_lbl.pack(fill="x", pady=(2,0))
        arrow = tk.Label(row, text="›", font=("Segoe UI",18),
            fg=T["border"], bg=T["panel"])
        arrow.pack(side="right", padx=4)
        ws = [card, inner, row, ico, txt, t_lbl, d_lbl, arrow]

        def enter(e):
            card.configure(highlightbackground=color, bg=T["btn_hov"])
            for w in ws: _try_bg(w, T["btn_hov"])
            arrow.configure(fg=color)
        def leave(e):
            card.configure(highlightbackground=T["border"], bg=T["panel"])
            for w in ws: _try_bg(w, T["panel"])
            arrow.configure(fg=T["border"])
        def click(e): on_click()

        for w in ws + [stripe]:
            w.bind("<Enter>", enter); w.bind("<Leave>", leave); w.bind("<Button-1>", click)
        self._cards_meta.append({
            "frame":card,"stripe":stripe,"inner":inner,"row":row,
            "ico":ico,"txt":txt,"t_lbl":t_lbl,"d_lbl":d_lbl,
            "arrow":arrow,"color":color,"ws":ws
        })

    def _setup_tags(self):
        T = self.T
        self.console.tag_config("info",    foreground=T["accent"])
        self.console.tag_config("success", foreground=T["green"], font=("Consolas",10,"bold"))
        self.console.tag_config("error",   foreground=T["red"])
        self.console.tag_config("warning", foreground=T["orange"], font=("Consolas", 10, "bold"))
        self.console.tag_config("dim",     foreground=T["text_dim"])
        self.console.tag_config("purple",  foreground=T["purple"])
        self.console.tag_config("cyan",    foreground=T["cyan"])
        self.console.tag_config("header",  foreground=T["accent"], font=("Consolas",10,"bold"))

    def _tag_line(self, line):
        lo = line.lower().strip()
        if not lo: return None
        if any(x in lo for x in ("error","err:","✘","failed","exception","cannot","could not")):
            return "error"
        if any(x in lo for x in ("warn","warning","⚠","deprecated")):
            return "warning"
        if any(x in lo for x in ("✔","done","success","завершено","complete","finished")):
            return "success"
        if lo.startswith(("$","npm","node","run",">")):
            return "dim"
        if any(x in lo for x in ("generating","генеру","fetch","request","sending")):
            return "cyan"
        if any(x in lo for x in ("topic","тем","category","theme")):
            return "purple"
        if lo.startswith(("─","═","=","━","–")):
            return "header"
        return None

    # ====== СТАНДАРТНІ КОМАНДИ ======

    def _clear_args(self):
        for w in self.args_outer.winfo_children():
            w.destroy()

    def _show_simple_args(self, icon, title, hint, default, cmd):
        self._clear_args()
        T = self.T
        self._pending_cmd = cmd
        ai = tk.Frame(self.args_outer, bg=T["panel"])
        ai.pack(fill="x", padx=14, pady=12)
        rt = tk.Frame(ai, bg=T["panel"])
        rt.pack(fill="x")
        tk.Label(rt, text=icon, font=("Segoe UI Emoji",18),
            bg=T["panel"], fg=T["text"]).pack(side="left", padx=(0,8))
        tc = tk.Frame(rt, bg=T["panel"])
        tc.pack(side="left", fill="x", expand=True)
        tk.Label(tc, text=title, font=FONT_H, fg=T["text"], bg=T["panel"], anchor="w").pack(fill="x")
        tk.Label(tc, text=hint, font=FONT_SM, fg=T["text_dim"], bg=T["panel"], anchor="w").pack(fill="x")
        re = tk.Frame(ai, bg=T["panel"])
        re.pack(fill="x", pady=(10,0))
        tk.Label(re, text="$", font=FONT_MONO, fg=T["text_dim"], bg=T["panel2"]).pack(side="left", ipadx=8, ipady=6)
        self.args_var = tk.StringVar()
        self.args_entry = tk.Entry(re, textvariable=self.args_var,
            font=FONT_MONO, bg=T["panel2"], fg=T["text"],
            insertbackground=T["accent"], relief="flat", bd=0, highlightthickness=0)
        self.args_entry.pack(side="left", fill="x", expand=True, ipady=6, padx=2)
        self.args_entry.bind("<Return>", lambda e: self._run_pending())
        self.args_entry.bind("<Escape>", lambda e: self._hide_args())
        tk.Label(re, text="▶  Запустити", font=("Segoe UI Semibold",9),
            fg=T["bg"], bg=T["accent"], cursor="hand2", padx=12, pady=6
        ).pack(side="left", padx=(8,0))
        self.run_btn = re.winfo_children()[-1]
        self.run_btn.bind("<Button-1>", lambda e: self._run_pending())
        tk.Label(re, text="✕", font=FONT_SM, fg=T["text_dim"], bg=T["panel"],
            cursor="hand2", padx=8, pady=6
        ).pack(side="left", padx=2)
        re.winfo_children()[-1].bind("<Button-1>", lambda e: self._hide_args())
        self.args_outer.pack(fill="x", before=self.con_wrap, pady=(0,8))
        self.args_entry.focus_set()
        self.args_entry.select_range(0,"end")

    def _hide_args(self):
        self.args_outer.pack_forget()
        if hasattr(self, "_q_panel") and self._q_panel.winfo_ismapped():
            self._q_panel.pack_forget()
        self._pending_cmd = None

    def _run_stats(self):
        self._hide_args()
        self._execute("npm.cmd run questions:stats","📊 Статистика питань")

    def _open_topics(self):
        self._show_simple_args("🌿","Ієрархія тем",
            "Приклад: --theme geography  або --all",
            "--all",
            lambda a: self._execute(
                f"npm.cmd run generate-topics -- {a}","🌿 Генерація ієрархії тем"))

    def _open_questions(self):
        self._show_simple_args("✨","AI-питання",
            "Приклад: --theme geography --count 50  або --all --count 30",
            "--all --count 30",
            lambda a: self._execute(
                f"npm.cmd run generate-ai -- {a}","✨ Генерація AI-питань"))

    def _run_pending(self):
        if self._pending_cmd:
            args = self.args_var.get().strip() or "--all"
            fn = self._pending_cmd
            self._hide_args()
            fn(args)

    # ====== 4-та КАРТКА: ЯКІСТЬ ТЕМ ======

    def _open_topic_quality(self):
        self._hide_args()
        T = self.T

        # Створюємо UI один раз
        if not hasattr(self, "_q_panel"):
            self._q_panel = tk.Frame(self.right, bg=T["panel"],
                highlightthickness=1, highlightbackground=T["border"])

            # Хедер
            hdr = tk.Frame(self._q_panel, bg=T["panel"])
            hdr.pack(fill="x", padx=14, pady=(12,6))
            tk.Label(hdr, text="🔍", font=("Segoe UI Emoji",18),
                bg=T["panel"], fg=T["orange"]).pack(side="left", padx=(0,8))
            tc = tk.Frame(hdr, bg=T["panel"])
            tc.pack(side="left", fill="x", expand=True)
            tk.Label(tc, text="Аналіз якості тем", font=FONT_H,
                fg=T["text"], bg=T["panel"], anchor="w").pack(fill="x")
            self.q_subtitle = tk.Label(tc, text="Завантаження...",
                font=FONT_SM, fg=T["text_dim"], bg=T["panel"], anchor="w")
            self.q_subtitle.pack(fill="x")

            # Кнопка "Аналіз"
            analyze_btn = tk.Button(hdr, text="🔄 Аналіз", font=("Segoe UI Semibold",9),
                bg=T["accent"], fg=T["bg"], relief="flat", padx=10, cursor="hand2")
            analyze_btn.pack(side="right", padx=(8,0))
            analyze_btn.bind("<Button-1>", lambda e: self._run_topic_analysis())

            # Фільтри
            flt = tk.Frame(self._q_panel, bg=T["panel"])
            flt.pack(fill="x", padx=14, pady=(6,6))
            tk.Label(flt, text="Файл:", font=FONT_SM, fg=T["text_dim"], bg=T["panel"]).pack(side="left")
            self.q_filter_file = tk.StringVar(value="all")
            self.q_filter_combo = ttk.Combobox(flt, textvariable=self.q_filter_file,
                values=["all"], state="readonly", width=16, font=FONT_DD)
            self.q_filter_combo.pack(side="left", padx=4)
            tk.Label(flt, text="Бал від:", font=FONT_SM, fg=T["text_dim"], bg=T["panel"]).pack(side="left", padx=(6,0))
            self.q_min_score = tk.Spinbox(flt, from_=0, to=100, width=3,
                font=FONT_SM, bg=T["panel2"], fg=T["text"],
                buttonbackground=T["panel2"], relief="flat", highlightthickness=1,
                highlightbackground=T["border"])
            self.q_min_score.delete(0,"end"); self.q_min_score.insert(0,"0")
            self.q_min_score.pack(side="left", padx=2)
            tk.Label(flt, text="до:", font=FONT_SM, fg=T["text_dim"], bg=T["panel"]).pack(side="left", padx=(2,0))
            self.q_max_score = tk.Spinbox(flt, from_=0, to=100, width=3,
                font=FONT_SM, bg=T["panel2"], fg=T["text"],
                buttonbackground=T["panel2"], relief="flat", highlightthickness=1,
                highlightbackground=T["border"])
            self.q_max_score.delete(0,"end"); self.q_max_score.insert(0,"100")
            self.q_max_score.pack(side="left", padx=2)
            filter_btn = tk.Button(flt, text="Фільтр", font=("Segoe UI Semibold",9),
                bg=T["accent"], fg=T["bg"], relief="flat", padx=10, cursor="hand2")
            filter_btn.pack(side="left", padx=8)
            filter_btn.bind("<Button-1>", lambda e: self._refresh_quality_list())
            tk.Button(flt, text="✕", font=("Segoe UI",9),
                fg=T["text_dim"], bg=T["panel"], relief="flat", padx=6, cursor="hand2",
                command=self._hide_args).pack(side="right")

            # Статистика
            self.q_stat_frame = tk.Frame(self._q_panel, bg=T["panel"])

            # Список тем
            self.q_list_frame = tk.Frame(self._q_panel, bg=T["panel"],
                highlightthickness=1, highlightbackground=T["border"])
            self.q_list_frame.pack(fill="both", expand=True, padx=14, pady=(0,12))

            self.q_text = tk.Text(self.q_list_frame, font=("Consolas",9),
                bg=T["panel"], fg=T["text"], relief="flat", bd=6,
                wrap="none", state="normal",
                selectbackground=T["accent"], selectforeground=T["bg"],
                undo=False, autoseparators=0)
            self.q_text.pack(side="left", fill="both", expand=True)
            self.q_text.bind("<Key>", lambda e: "break")
            self.q_text.bind("<Control-c>", self._copy_selection)
            self.q_text.bind("<Control-C>", self._copy_selection)

            q_scroll = tk.Scrollbar(self.q_list_frame, orient="vertical",
                command=self.q_text.yview)
            q_scroll.pack(side="right", fill="y")
            self.q_text.configure(yscrollcommand=q_scroll.set)

            self.q_text.tag_config("red", foreground=T["red"])
            self.q_text.tag_config("orange", foreground=T["orange"])
            self.q_text.tag_config("green", foreground=T["green"])
            self.q_text.tag_config("dim", foreground=T["text_dim"])
            self.q_text.tag_config("accent", foreground=T["accent"])
            self.q_text.tag_config("link", foreground=T["cyan"], underline=1)

            self.q_text.bind("<Button-1>", self._on_topic_press)
            self.q_text.bind("<ButtonRelease-1>", self._on_topic_release)

        # Показуємо панель
        self._q_panel.pack(fill="both", expand=True, before=self.con_wrap, pady=(0,8))

        # Завантажуємо з кешу; без кешу — підказка
        cache_path = self._topic_cache_path()
        cached = _load_json(cache_path) if cache_path else None
        if cached and isinstance(cached, list) and len(cached) > 0:
            self._show_quality_results(cached, cached=True)
        else:
            self.q_subtitle.configure(text="Натисніть 🔄 Аналіз")
            self.q_text.delete("1.0", "end")
            self.q_text.insert("end", "\n  Натисніть 🔄 Аналіз для перевірки якості тем\n", "dim")
            self._set_status("Готовий", T["green"])

    def _topic_cache_path(self):
        return os.path.join(self.cwd, "..", "data", "topics-quality-cache.json")

    def _save_topic_cache(self, results):
        cache_path = self._topic_cache_path()
        if cache_path:
            _save_json(cache_path, results)

    def _run_topic_analysis(self):
        """Аналіз у потоці — не блокує UI."""
        try:
            self._set_status("⏳ Аналіз тем...", self.T["accent"])
            results = _analyze_all_topics(self.topics_dir)
            results.sort(key=lambda r: r["breadth"])
            self._save_topic_cache(results)
        except Exception as ex:
            self.after(0, lambda: self._log(f"✘ Помилка аналізу: {ex}\n", "error"))
            self.after(0, lambda: self._set_status("✘ Помилка аналізу", self.T["red"]))
            return
        self.after(0, lambda: self._show_quality_results(results, cached=False))

    def _show_quality_results(self, results, cached=False):
        """Main thread: оновлює UI після завершення аналізу."""
        self._topic_results = results
        all_files = sorted(set(r["file_id"] for r in results))
        file_opts = ["all"] + [f for f in all_files]
        self.q_filter_combo.configure(values=file_opts)

        poor = sum(1 for r in results if r["breadth"] < 30)
        mid = sum(1 for r in results if 30 <= r["breadth"] < 60)
        good = sum(1 for r in results if r["breadth"] >= 60)

        label = "{0} підтем • сортовано за якістю (найгірші перші)".format(len(results))
        if cached:
            label += " • з кешу"
        self.q_subtitle.configure(text=label)

        self.q_stat_frame.pack(fill="x", padx=14, pady=(0,4), before=self.q_list_frame)
        for w in self.q_stat_frame.winfo_children(): w.destroy()
        tk.Label(self.q_stat_frame, text="\U0001f534 {0}".format(poor), fg=self.T["red"], bg=self.T["panel"],
            font=("Segoe UI Semibold",9)).pack(side="left", padx=(0,6))
        tk.Label(self.q_stat_frame, text="\U0001f7e1 {0}".format(mid), fg=self.T["orange"], bg=self.T["panel"],
            font=("Segoe UI Semibold",9)).pack(side="left", padx=(0,6))
        tk.Label(self.q_stat_frame, text="\U0001f7e2 {0}".format(good), fg=self.T["green"], bg=self.T["panel"],
            font=("Segoe UI Semibold",9)).pack(side="left", padx=(0,6))
        tk.Label(self.q_stat_frame, text="\U0001f4e6 {0} всього".format(len(results)), fg=self.T["text_dim"], bg=self.T["panel"],
            font=FONT_SM).pack(side="left", padx=(6,0))

        self._refresh_quality_list()
        self._set_status("{0} тем проаналізовано".format(len(results)), self.T["green"])

    def _refresh_quality_list(self, event=None):
        self.q_text.configure(state="normal")
        self.q_text.delete("1.0", "end")

        T = self.T
        file_filter = self.q_filter_file.get()
        try: min_s = int(self.q_min_score.get())
        except: min_s = 0
        try: max_s = int(self.q_max_score.get())
        except: max_s = 100

        if not self._topic_results:
            self.q_text.insert("end", "  Немає даних\n", "dim")
            return

        filtered = [r for r in self._topic_results
                    if min_s <= r["breadth"] <= max_s
                    and (file_filter == "all" or r["file_id"] == file_filter)]

        if not filtered:
            self.q_text.insert("end", "  Немає результатів за вибраним фільтром\n", "dim")
            return

        # Мапа: file_id → назва Завіту
        CAT_MAP = {}
        for gid, ginfo in GROUPS_CONF.items():
            gtitle = ginfo["title"]
            for tid in ginfo["theme_ids"]:
                CAT_MAP[tid] = gtitle
            CAT_MAP[gid] = gtitle

        # Мапа: group_key / file_id → назва файлу (теми)
        FILE_NAMES = {}
        for r in filtered:
            gkey = r.get("themeId") or r["file_id"]
            if gkey in FILE_NAMES: continue
            if gkey in THEMES_DICT:
                FILE_NAMES[gkey] = THEMES_DICT[gkey]
            elif gkey in GROUPS_CONF:
                FILE_NAMES[gkey] = "Збірка: " + GROUPS_CONF[gkey]["title"]
            fid = r["file_id"]
            if fid not in FILE_NAMES:
                FILE_NAMES[fid] = "Об\'єднана база"

        # Будуємо все дерево одним проходом: Завіт → файл → дерево
        lines = []
        click_map = {}
        line_num = 1

        # Групуємо: Завіт → themeId → список (зберігаючи DFS-порядок)
        by_zavit = {}
        for r in filtered:
            cat = CAT_MAP.get(r.get("themeId") or r["file_id"], "Інше")
            group_key = r.get("themeId") or r["file_id"]
            by_zavit.setdefault(cat, {}).setdefault(group_key, []).append(r)

        # Рисуємо
        for zav_name in sorted(by_zavit.keys()):
            files_dict = by_zavit[zav_name]
            total_zav = sum(len(v) for v in files_dict.values())
            lines.append("\n  {0} ({1})\n".format(zav_name, total_zav))
            # заголовок Завіту (рядок 2) — клікабельний, відкриває першу тему
            first_in_zavit = None
            for fid in sorted(files_dict.keys(),
                key=lambda fid: FILE_NAMES.get(fid, fid)):
                first_in_zavit = next((it for it in files_dict[fid] if it["depth"] == 1), files_dict[fid][0]) if files_dict[fid] else None
                if first_in_zavit: break
            zav_header_line = str(line_num + 1)
            line_num += 2
            if first_in_zavit:
                click_map[zav_header_line] = first_in_zavit

            sorted_fids = sorted(files_dict.keys(),
                key=lambda fid: FILE_NAMES.get(fid, fid))

            for fid in sorted_fids:
                items = files_dict[fid]
                fname = FILE_NAMES.get(fid, fid)
                # заголовок файлу — клікабельний, відкриває кореневу тему
                root_for_file = next((it for it in items if it["depth"] == 1), items[0]) if items else None
                lines.append("    ── {0} ({1}) ──\n".format(fname, len(items)))
                if root_for_file:
                    click_map[str(line_num)] = root_for_file
                line_num += 1

                for r in items:
                    indent = "    " + "  " * (r["depth"] - 1)
                    icon = r.get("icon", "\U0001f4d6")
                    title = r["title"]
                    breadth = r["breadth"]
                    lines.append("{0}{1} {2}  [{3}/100]\n".format(indent, icon, title, breadth))
                    click_map[str(line_num)] = r
                    line_num += 1

        content = "".join(lines)
        self.q_text.insert("1.0", content)
        self._topic_click_map = click_map

        # Збираємо теги кольорів (без заголовків)
        tag_lines = {"red": [], "orange": [], "green": []}
        cur_line = 1
        for zav_name in sorted(by_zavit.keys()):
            files_dict = by_zavit[zav_name]
            cur_line += 2
            sorted_fids = sorted(files_dict.keys(),
                key=lambda fid: FILE_NAMES.get(fid, fid))
            for fid in sorted_fids:
                items = files_dict[fid]
                cur_line += 1
                for r2 in items:
                    breadth = r2["breadth"]
                    tag = "red" if breadth < 30 else ("orange" if breadth < 60 else "green")
                    tag_lines[tag].append(cur_line)
                    cur_line += 1

        # Наносимо теги суцільними діапазонами (мінімум викликів)
        for tag, lines in tag_lines.items():
            if not lines: continue
            ranges = []
            start = end = lines[0]
            for l in lines[1:]:
                if l == end + 1:
                    end = l
                else:
                    ranges.append((start, end))
                    start = end = l
            ranges.append((start, end))
            for start, end in ranges:
                self.q_text.tag_add(tag, "{0}.0".format(start), "{0}.end".format(end))

    def _on_topic_press(self, event):
        self._topic_click_pos = (event.x, event.y)

    def _on_topic_release(self, event):
        """Відкриває панель дій при кліку (але не при виділенні тексту)."""
        if not hasattr(self, "_topic_click_pos"):
            return
        dx = abs(event.x - self._topic_click_pos[0])
        dy = abs(event.y - self._topic_click_pos[1])
        if dx > 5 or dy > 5:
            return  # було перетягування (виділення), а не клік
        try:
            self.q_text.get(tk.SEL_FIRST, tk.SEL_LAST)
            return  # є виділення — не відкриваємо тему
        except tk.TclError:
            pass
        idx = self.q_text.index("@{0},{1}".format(self._topic_click_pos[0], self._topic_click_pos[1]))
        line = idx.split(".")[0]
        r = self._topic_click_map.get(line)
        if r:
            self._open_topic_actions(r)

    def _make_topic_card(self, parent, r):
        """Простий віджет-картка для теми в списку."""
        T = self.T
        breadth = r["breadth"]
        if breadth < 30: color = T["red"]
        elif breadth < 60: color = T["orange"]
        else: color = T["green"]

        card = tk.Frame(parent, bg=T["panel"],
            highlightthickness=1, highlightbackground=T["border"])
        card.pack(fill="x", pady=(1,0))

        tk.Frame(card, bg=color, width=3).pack(side="left", fill="y")

        # Рядок 1: icon + заголовок + score
        r1 = tk.Frame(card, bg=T["panel"])
        r1.pack(fill="x", padx=6, pady=(3,0))

        icon_lbl = tk.Label(r1, text=r.get("icon","📖"), font=("Segoe UI Emoji",11),
            bg=T["panel"])
        icon_lbl.pack(side="left", padx=(0,3))

        indent = "  " * r["depth"]
        tk.Label(r1, text=f"{indent}{r['title']}", font=FONT_SM,
            fg=T["text"], bg=T["panel"], anchor="w").pack(side="left")

        tk.Label(r1, text=f"{breadth}", font=("Consolas",9,"bold"),
            fg=color, bg=T["panel"]).pack(side="right", padx=(4,0))

        # Рядок 2: шлях
        path_parts = []
        if r["file_id"] in GROUPS_CONF:
            path_parts.append(GROUPS_CONF[r["file_id"]]["title"])
        elif r["file_id"] in THEMES_DICT:
            path_parts.append(THEMES_DICT[r["file_id"]])
        if r["themeId"] and r["themeId"] in THEMES_DICT and r["themeId"] != r["file_id"]:
            path_parts.append(THEMES_DICT[r["themeId"]])
        path_str = " > ".join(path_parts) if path_parts else r["file_id"]

        if path_str:
            r2 = tk.Frame(card, bg=T["panel"])
            r2.pack(fill="x", padx=6, pady=(0,1))
            tk.Label(r2, text=path_str, font=("Segoe UI",7),
                fg=T["text_dim"], bg=T["panel"], anchor="w").pack(side="left")

        # Кнопка редагування
        edit_btn = tk.Label(card, text="✎", font=("Segoe UI",12),
            fg=T["accent"], bg=T["panel"], cursor="hand2")
        edit_btn.pack(side="right", padx=(0,6))
        edit_btn.bind("<Button-1>", lambda e, rr=r: self._open_topic_editor(rr))

        # Hover
        def enter(e):
            card.configure(highlightbackground=color)
            _try_bg(card, T["btn_hov"])
            for w in card.winfo_children():
                _try_bg(w, T["btn_hov"])
        def leave(e):
            card.configure(highlightbackground=T["border"])
            _try_bg(card, T["panel"])
            for w in card.winfo_children():
                _try_bg(w, T["panel"])
        card.bind("<Enter>", enter); card.bind("<Leave>", leave)

    # ====== ПАНЕЛЬ ДІЙ З ТЕМОЮ ======

    def _build_topic_tree_options(self, file_id):
        """Будує список (label, node_id) для випадаючого списку тем у файлі."""
        path = os.path.join(self.topics_dir, f"{file_id}.json")
        root = _load_json(path)
        if not root:
            return []
        flat = _flatten_nodes(root, 0, file_id)
        options = []
        for node, depth, fid, _par in flat:
            label = "{0} {1} ({2})".format("• " * depth, node.get("title","?"), node.get("id","?"))
            options.append((label, node.get("id","?"), depth))
        return options

    def _open_topic_actions(self, r):
        """Панель дій: вибір підтеми, генерація питань/категорій."""
        # Сховати панель якості, якщо видима
        if hasattr(self, "_q_panel") and self._q_panel.winfo_ismapped():
            self._q_panel.pack_forget()
        self._clear_args()
        T = self.T
        outer = self.args_outer
        file_id = r["file_id"]

        # Хедер
        hdr = tk.Frame(outer, bg=T["panel"])
        hdr.pack(fill="x", padx=14, pady=12)
        tk.Label(hdr, text="📝 Дії з темою", font=FONT_TITLE,
            fg=T["accent"], bg=T["panel"]).pack(side="left")

        # Інфо
        path_parts = []
        if file_id in GROUPS_CONF:
            path_parts.append(GROUPS_CONF[file_id]["title"])
        elif file_id in THEMES_DICT:
            path_parts.append(THEMES_DICT[file_id])
        if r.get("themeId") and r["themeId"] in THEMES_DICT and r["themeId"] != file_id:
            path_parts.append(THEMES_DICT[r["themeId"]])
        path_parts.append(r["title"])
        path_str = " > ".join(path_parts)

        info_frame = tk.Frame(outer, bg=T["panel"])
        info_frame.pack(fill="x", padx=14, pady=(0,6))
        info_text = "ID: {0}  |  Глибина: {1}  |  Файл: {2}  |  Ширина: {3}/100".format(
            r["id"], r["depth"], file_id, r["breadth"])
        tk.Label(info_frame, text=info_text, font=FONT_SM, fg=T["text_dim"],
            bg=T["panel"], anchor="w").pack(fill="x")
        tk.Label(info_frame, text=path_str, font=FONT_SM, fg=T["cyan"],
            bg=T["panel"], anchor="w").pack(fill="x")

        # Форма (зі скролом, щоб кнопки не губилися)
        form_canvas = tk.Canvas(outer, bg=T["panel"], highlightthickness=0)
        form_scroll = tk.Scrollbar(outer, orient="vertical", command=form_canvas.yview)
        form = tk.Frame(form_canvas, bg=T["panel"])
        form.bind("<Configure>", lambda e: form_canvas.configure(scrollregion=form_canvas.bbox("all")))
        form_canvas.create_window((0,0), window=form, anchor="nw")
        form_canvas.configure(yscrollcommand=form_scroll.set)
        form_canvas.pack(side="left", fill="both", expand=True, padx=14, pady=(0,12))
        form_scroll.pack(side="right", fill="y")
        def _on_mousewheel(event):
            form_canvas.yview_scroll(-1 if event.delta > 0 else 1, "units")
        form_canvas.bind("<MouseWheel>", _on_mousewheel)
        form.bind("<MouseWheel>", _on_mousewheel)

        # 1. Випадаючий список тем (ієрархія файлу)
        tk.Label(form, text="Оберіть ціль:", font=FONT_SM, fg=T["text_dim"],
            bg=T["panel"], anchor="w").pack(fill="x", pady=(4,2))

        topic_opts = self._build_topic_tree_options(file_id)
        if not topic_opts:
            topic_opts = [("Помилка завантаження", r["id"], r["depth"])]

        # Знайти індекс поточного елемента
        current_idx = 0
        for i, (lbl, nid, dep) in enumerate(topic_opts):
            if nid == r["id"]:
                current_idx = i
                break

        self.tg_topic_var = tk.StringVar()
        topic_values = [t[0] for t in topic_opts]
        self.tg_topic_combo = ttk.Combobox(form, textvariable=self.tg_topic_var,
            values=topic_values, state="readonly", width=50, font=FONT_DD)
        self.tg_topic_combo.pack(fill="x", pady=(2,6))
        self.tg_topic_combo.current(current_idx)

        # 2. Кількість
        cnt_frame = tk.Frame(form, bg=T["panel"])
        cnt_frame.pack(fill="x", pady=(4,6))
        tk.Label(cnt_frame, text="Кількість додавань:", font=FONT_SM,
            fg=T["text_dim"], bg=T["panel"]).pack(side="left")
        self.tg_count = tk.Spinbox(cnt_frame, from_=1, to=500, width=5,
            font=FONT_SM, bg=T["panel2"], fg=T["text"],
            buttonbackground=T["panel2"], relief="flat", highlightthickness=1,
            highlightbackground=T["border"])
        self.tg_count.delete(0,"end"); self.tg_count.insert(0,"30")
        self.tg_count.pack(side="left", padx=8)

        # 3. Кнопки дій
        btn_frame = tk.Frame(form, bg=T["panel"])
        btn_frame.pack(fill="x", pady=(8,4))

        def _get_selected_id():
            sel = self.tg_topic_var.get()
            for lbl, nid, dep in topic_opts:
                if lbl == sel:
                    return nid, dep
            return r["id"], r["depth"]

        def _ai_cmd(action_label, *cmd_parts):
            cmd = " ".join(str(p) for p in cmd_parts)
            self._execute(cmd, action_label)

        def _gen_questions():
            nid, dep = _get_selected_id()
            cnt = self.tg_count.get()
            try: cnt = int(cnt)
            except: cnt = 30
            _ai_cmd("📝 Генерація питань: {0}".format(nid),
                "npm.cmd run generate-ai -- --topic", nid, "--count", cnt)

        def _gen_categories():
            nid, dep = _get_selected_id()
            target = "--theme {0}".format(file_id)
            _ai_cmd("🌿 Генерація категорій: {0}".format(file_id),
                "npm.cmd run generate-topics --", target)

        def _edit_topic():
            nid, dep = _get_selected_id()
            for res in self._topic_results:
                if res["id"] == nid:
                    self._open_topic_editor(res)
                    return
            messagebox.showwarning("Увага", "Тему {0} не знайдено".format(nid))

        # Рядок 1: Основні дії
        r1 = tk.Frame(btn_frame, bg=T["panel"])
        r1.pack(fill="x", pady=(0,4))
        tk.Button(r1, text="📝 Питання", font=("Segoe UI Semibold",9),
            bg=T["accent"], fg=T["bg"], relief="flat", padx=10, pady=4, cursor="hand2",
            command=_gen_questions).pack(side="left", padx=(0,6))
        tk.Button(r1, text="🌿 Категорії", font=("Segoe UI Semibold",9),
            bg=T["green"], fg=T["bg"], relief="flat", padx=10, pady=4, cursor="hand2",
            command=_gen_categories).pack(side="left", padx=(0,6))
        tk.Button(r1, text="✎ Ручне ред.", font=("Segoe UI Semibold",9),
            bg=T["orange"], fg=T["bg"], relief="flat", padx=10, pady=4, cursor="hand2",
            command=_edit_topic).pack(side="left", padx=(0,6))

        # Рядок 2: AI-дії
        ai_frame = tk.Frame(btn_frame, bg=T["panel"])
        ai_frame.pack(fill="x", pady=(4,4))

        def _confirm_delete(action_fn):
            if messagebox.askyesno("Підтвердження", "Видалити цю тему назавжди?"):
                action_fn()

        def _ai_topic(action):
            nid, dep = _get_selected_id()
            label_map = {
                "improve-desc": "🤖 Покращити опис",
                "suggest-icon": "🤖 Нова іконка",
                "improve-all": "🤖 Improve All",
                "organize-children": "🤖 Сортувальник",
                "delete-node": "🗑 Видалити",
            }
            lbl = label_map.get(action, "🤖 AI")
            extra = "--count 3" if action == "improve-all" else ""
            _ai_cmd("{0}: {1}".format(lbl, nid),
                "node scripts/ai-topic-edit.mjs --action", action,
                "--file", file_id, "--node", nid, extra)

        for act, txt, color in [
            ("improve-desc", "🤖 Покращити опис", "#6f42c1"),
            ("suggest-icon", "🤖 Нова іконка", "#6f42c1"),
            ("organize-children", "🤖 Сортувальник", "#17a2b8"),
            ("improve-all", "🤖 Improve All", "#8957e5"),
        ]:
            tk.Button(ai_frame, text=txt, font=("Segoe UI",8),
                bg=color, fg=T["bg"], relief="flat", padx=8, pady=3, cursor="hand2",
                command=lambda a=act: _ai_topic(a)
            ).pack(side="left", padx=(0,4))

        tk.Button(ai_frame, text="🗑 Видалити",
            font=("Segoe UI",8), bg=T["red"], fg=T["bg"],
            relief="flat", padx=8, pady=3, cursor="hand2",
            command=lambda: _confirm_delete(lambda: _ai_topic("delete-node"))
        ).pack(side="left", padx=(0,4))

        # Кнопка назад
        tk.Button(form, text="◀ До списку", font=("Segoe UI Semibold",9),
            fg=T["text_dim"], bg=T["panel"], relief="flat", padx=12, cursor="hand2",
            command=self._open_topic_quality).pack(pady=(8,0))

        self.args_outer.pack(fill="both", expand=True, before=self.con_wrap, pady=(0,8))

    # ====== РЕДАКТОР ТЕМИ ======

    def _open_topic_editor(self, r):
        """Відкриває редактор для конкретної теми."""
        if hasattr(self, "_q_panel") and self._q_panel.winfo_ismapped():
            self._q_panel.pack_forget()
        self._clear_args()
        T = self.T
        outer = self.args_outer

        # Хедер
        hdr = tk.Frame(outer, bg=T["panel"])
        hdr.pack(fill="x", padx=14, pady=12)
        tk.Label(hdr, text="✎ Редагування теми", font=FONT_TITLE,
            fg=T["accent"], bg=T["panel"]).pack(side="left")

        # Форма
        form = tk.Frame(outer, bg=T["panel"])
        form.pack(fill="both", expand=True, padx=14, pady=(0,12))

        row = 0
        fields = {}

        def add_field(label, value, row, multiline=False):
            tk.Label(form, text=label, font=FONT_SM, fg=T["text_dim"],
                bg=T["panel"], anchor="w").grid(row=row, column=0, sticky="w", pady=3)
            if multiline:
                txt = tk.Text(form, height=3, font=FONT_DD, wrap="word",
                    bg=T["panel2"], fg=T["text"],
                    insertbackground=T["accent"], relief="flat",
                    highlightthickness=1, highlightbackground=T["border"])
                txt.insert("1.0", value)
                txt.grid(row=row, column=1, sticky="ew", padx=(8,0), pady=3)
                form.columnconfigure(1, weight=1)
                return txt
            else:
                var = tk.StringVar(value=value)
                ent = tk.Entry(form, textvariable=var, font=FONT_DD,
                    bg=T["panel2"], fg=T["text"],
                    insertbackground=T["accent"], relief="flat",
                    highlightthickness=1, highlightbackground=T["border"])
                ent.grid(row=row, column=1, sticky="ew", padx=(8,0), pady=3)
                form.columnconfigure(1, weight=1)
                return var

        fields["icon"] = add_field("Іконка", r.get("icon", "📖"), row); row += 1
        fields["title"] = add_field("Назва", r["title"], row); row += 1
        fields["desc"] = add_field("Опис", r.get("description", ""), row, multiline=True); row += 1

        # Інфо
        info_text = f"ID: {r['id']}  |  Глибина: {r['depth']}  |  Файл: {r['file_id']}  |  Ширина: {r['breadth']}/100  |  Дітей: {r['children']}"
        tk.Label(form, text=info_text, font=FONT_SM, fg=T["text_dim"],
            bg=T["panel"], anchor="w").grid(row=row, column=0, columnspan=2, sticky="w", pady=3)

        def save():
            path = os.path.join(self.topics_dir, f"{r['file_id']}.json")
            root = _load_json(path)
            if not root:
                messagebox.showerror("Помилка", f"Не вдалося відкрити {path}")
                return

            # Знайти вузол по id
            def find_and_update(node):
                if node.get("id") == r["id"]:
                    node["icon"] = fields["icon"].get()
                    node["title"] = fields["title"].get()
                    node["description"] = fields["desc"].get("1.0", "end-1c").strip()
                    return True
                for ch in node.get("children", []):
                    if find_and_update(ch): return True
                return False

            if find_and_update(root):
                if _save_json(path, root):
                    messagebox.showinfo("✅", "Тему збережено!")
                    # Повернутись до списку
                    self._open_topic_quality()
                else:
                    messagebox.showerror("❌", "Помилка запису файлу")
            else:
                messagebox.showerror("❌", f"Вузол {r['id']} не знайдено у файлі")

        # Кнопки
        btn_row = tk.Frame(form, bg=T["panel"])
        btn_row.grid(row=row+1, column=0, columnspan=2, pady=(12,0))
        tk.Button(btn_row, text="💾 Зберегти", font=("Segoe UI Semibold",10),
            bg=T["green"], fg=T["bg"], relief="flat", padx=16, pady=6,
            cursor="hand2", command=save
        ).pack(side="left", padx=(0,8))
        tk.Button(btn_row, text="◀ До списку", font=("Segoe UI Semibold",9),
            fg=T["text_dim"], bg=T["panel"], relief="flat", padx=12, cursor="hand2",
            command=self._open_topic_quality
        ).pack(side="left")

        self.args_outer.pack(fill="both", expand=True, before=self.con_wrap, pady=(0,8))

    # ====== EXECUTE ======

    def _execute(self, cmd, label):
        if self.process and self.process.poll() is None:
            messagebox.showwarning("Зайнято","Дочекайтесь завершення поточної команди.")
            return
        self._log(f"{'─'*54}\n","header")
        self._log(f"  {label}\n","info")
        self._log(f"  $ {cmd}\n","dim")
        self._log(f"{'─'*54}\n","header")
        self._set_status(f"⏳  {label}", self.T["accent"], busy=True)

        def run():
            try:
                self.process = subprocess.Popen(cmd, shell=True, cwd=self.cwd,
                    stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                    text=True, encoding="utf-8", errors="replace", bufsize=1)
                for line in self.process.stdout:
                    self._log(line, self._tag_line(line))
                self.process.wait()
                rc = self.process.returncode
                if rc == 0:
                    self._log("\n✔  Завершено успішно\n\n","success")
                    self._set_status("✔  Завершено успішно", self.T["green"])
                else:
                    self._log(f"\n✘  Помилка (код {rc})\n\n","error")
                    self._set_status(f"✘  Помилка (код {rc})", self.T["red"])
            except Exception as ex:
                self._log(f"\n✘  Виняток: {ex}\n\n","error")
                self._set_status("✘  Помилка запуску", self.T["red"])
            finally:
                self.after(0, lambda: self.stop_btn.config(
                    state="disabled", fg=self.T["text_dim"]))
        threading.Thread(target=run, daemon=True).start()

    def _stop_process(self):
        if self.process and self.process.poll() is None:
            self.process.terminate()
            self._log("\n" + "━"*54 + "\n", "header")
            self._log("  ⏹  ПРОЦЕС ЗУПИНЕНО ВРУЧНУ\n", "warning")
            self._log("━"*54 + "\n\n", "header")
            self._set_status("⏹  Зупинено", self.T["orange"])
        else:
            self._set_status("Нічого не запущено", self.T["text_dim"])

    def _log(self, text, tag=None):
        def _do():
            self.console.configure(state="normal")
            if tag: self.console.insert("end", text, tag)
            else: self.console.insert("end", text)
            self.console.see("end")
            self.console.configure(state="disabled")
        self.after(0, _do)

    def _clear_console(self):
        self.console.configure(state="normal")
        self.console.delete("1.0","end")
        self.console.configure(state="disabled")

    def _copy_selection(self, event=None):
        """Копіює виділений текст з будь-якого текстового віджета."""
        try:
            w = event.widget if event else self.focus_get()
            if isinstance(w, (tk.Text, tk.Entry)):
                sel = w.get(tk.SEL_FIRST, tk.SEL_LAST)
                self.clipboard_clear()
                self.clipboard_append(sel)
        except (tk.TclError, AttributeError):
            pass
        return "break"

    def _set_status(self, text, color, busy=False):
        def _do():
            self.status_var.set(text)
            self.status_dot.configure(fg=color)
            self.stop_btn.config(
                state="normal" if busy else "disabled",
                fg=self.T["red"] if busy else self.T["text_dim"])
        self.after(0, _do)

    def _toggle_theme(self):
        self._dark = not self._dark
        self.T = DARK if self._dark else LIGHT
        self.theme_btn.configure(text="☀" if self._dark else "🌙")
        self._apply_theme()

    def _apply_theme(self):
        T = self.T
        self.configure(bg=T["bg"])
        _try_bg(self.hdr, T["bg"])
        for w in self.hdr.winfo_children():
            _try_bg(w, T["bg"])
            for c in w.winfo_children(): _try_bg(c, T["bg"])
        self.lbl_title.configure(fg=T["accent"])
        self.lbl_sub.configure(fg=T["text_dim"])
        self.theme_btn.configure(fg=T["text_dim"])
        self.sep1.configure(bg=T["border"])
        self.body.configure(bg=T["bg"])
        self.sidebar.configure(bg=T["bg"])
        self.lbl_cmds.configure(fg=T["text_dim"], bg=T["bg"])
        self.vsep.configure(bg=T["border"])
        self.right.configure(bg=T["bg"])
        for cd in self._cards_meta:
            cd["frame"].configure(bg=T["panel"], highlightbackground=T["border"])
            cd["stripe"].configure(bg=cd["color"])
            for w in cd["ws"]: _try_bg(w, T["panel"])
            cd["t_lbl"].configure(fg=T["text"])
            cd["d_lbl"].configure(fg=T["text_dim"])
            cd["arrow"].configure(fg=T["border"])
        self.lbl_output.configure(fg=T["text_dim"], bg=T["bg"])
        self.clear_btn.configure(fg=T["text_dim"], bg=T["bg"])
        self.con_wrap.configure(bg=T["con_bg"], highlightbackground=T["border"])
        self.con_scroll.configure(bg=T["panel2"], troughcolor=T["con_bg"])
        self.console.configure(bg=T["con_bg"], fg=T["text"],
            selectbackground=T["accent"], selectforeground=T["bg"])
        self._setup_tags()
        self.sep2.configure(bg=T["border"])
        self.sb.configure(bg=T["bg"])
        self.status_dot.configure(bg=T["bg"])
        self.status_lbl.configure(bg=T["bg"], fg=T["text_dim"])
        self.stop_btn.configure(bg=T["bg"])


def _try_bg(w, c):
    try: w.configure(bg=c)
    except: pass


if __name__ == "__main__":
    app = OllamaLauncher()
    app.mainloop()
