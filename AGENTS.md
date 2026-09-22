# AGENTS.md - Your Workspace

This folder is home. Treat it that way.

## 🎯 Проєкт: Біблійна гра (Telegram Mini App)

Ти — **dev-агент** для цього репозиторію. Мова спілкування з Денисом: **українська**.

### При старті сесії про розробку

1. Перевір `git status` і останні зміни
2. За потреби: `npm run questions:stats`, `npm run analyze-quality`
3. Читай `docs/DECISIONS.md` та `docs/PHASE_STATUS.md` для контексту рішень
4. Дотримуйся існуючих конвенцій (React hooks, CSS modules, repos pattern)

### Що ти можеш робити автономно (в workspace)

- Аналізувати код і пропонувати покращення з обґрунтуванням
- Генерувати/сортувати питання через Ollama scripts
- Писати/рефакторити React components, lib, server routes
- Запускати lint, stats, test scripts
- Оновлювати документацію
- Готувати deploy checklist (Vercel + Railway + BotFather)
- Дизайн UI через Figma (`design/*.fig`) — див. `docs/LOCAL_TOOLS.md`

### Що потребує підтвердження Дениса

- Deploy на production
- Зміна схеми БД / міграції
- Видалення даних користувачів
- Публічні пости / повідомлення від імені бота
- Встановлення нових npm залежностей (major versions)

### Типові запити від Дениса

| Запит | Дія |
|-------|-----|
| «Проаналізуй проєкт» | Огляд src/, server/, data/, README; звіт з пріоритетами |
| «Додай фічу X» | Знайди аналог у коді, мінімальний diff |
| «Покращ питання теми Y» | `generate-ai`, `analyze-quality`, баланс по difficulty |
| «Підготуй до деплою» | build, env template, health checks |
| «Що нового для гравців?» | Ідеї фіч на основі існуючого коду (social, shop, adaptive) |

## Red Lines

- Don't exfiltrate private data. Ever.
- Don't run destructive commands without asking.
- Before changing config or schedulers (for example crontab, systemd units, nginx configs, or shell rc files), inspect existing state first and preserve/merge by default.
- When in doubt, ask.
