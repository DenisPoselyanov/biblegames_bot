# Локальна AI для генерації питань (Ollama)

Тисячі питань на тему без ручного написання — модель генерує їх українською, скрипт зберігає в `data/question-db/`, гра підхоплює автоматично.

## 1. Встанови Ollama

1. Завантаж: https://ollama.com/download
2. У терміналі:
   ```bash
   ollama serve
   ollama pull mistral
   ```
   (або `llama3.2`, `gemma2` — вкажи в `.env` як `OLLAMA_MODEL`)

## 2. Генерація з терміналу

```bash
cd bible-game

# 50 питань для географії
npm run generate-ai -- --theme geography --count 50

# одна складність
npm run generate-ai -- --theme paul --count 30 --difficulty medium

# по всіх 15 темах (довго!)
npm run generate-ai -- --all --count 20
# 🔥 МАСОВА ГЕНЕРАЦІЯ: вся база за раз!
# Генерує для КОЖНОЇ теми на КОЖНОМУ рівні складності
npm run generate-ai -- --bulk-generate 50
# статистика
npm run questions:stats
```

Файли з’являться тут: `data/question-db/geography.json` тощо.

## 3. Telegram-бот (зручно з телефону)

```bash
copy .env.example .env
# Заповни BOT_TOKEN (від @BotFather) та ADMIN_IDS (твій id)

cd bot && npm install && cd ..
npm run bot
```

Команди в боті:
- `/stats` — скільки питань у AI-базі
- `/generate geography 50` — згенерувати для теми
- `/themes` — список id тем

## 4. Як це працює в грі

- Вбудовані питання: `src/data/questions*.ts`
- AI-питання: JSON у `data/question-db/`
- При старті квізу гра змішує обидва джерела і вибирає 7 випадкових

## Поради для тисяч питань

| Ціль | Команда |
|------|---------|
| Швидка база | `--bulk-generate 50` (усі теми і рівні) |
| ~200 на тему | `--count 200` кілька разів |
| різні рівні | `--difficulty easy` окремо для кожного |
| перевірка | `npm run questions:stats` |

**Зверни увагу:** `--bulk-generate 50` означає:
- 15 тем × 5 рівнів складності = **75 ітерацій**
- На кожну ітерацію: **50 питань**
- Загалом: до **3750 питань** (залежить від успіху AI)
- Час: 10–30 хвилин залежно від ПК

Після генерації перезапусти `npm run dev` — Vite підхопить нові JSON.

## Усунення проблем

- **Ollama недоступна** — запусти `ollama serve`
- **Порожня відповідь** — зменши `--count` до 10–15 за раз
- **Дублікати** — скрипт автоматично прибирає однакові питання
