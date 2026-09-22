# Legacy AI Tooling — локальна генерація та аналіз контенту

> **Статус:** поточна інструкція для legacy scripts (`scripts/*.mjs`) — вони
> досі не мігровані на новий контракт нижче, це окремий обсяг Phase 4 WS10.  
> **Не є production publication workflow.**  
> **Актуальна AI-архітектура:** [./BIBLE_GAMES_MASTER_SPECIFICATION.md — Phase 4](./BIBLE_GAMES_MASTER_SPECIFICATION.md#phase-4--content-quality-reviewed-ai-pipeline--protected-content-studio)

## Phase 4 WS1 — серверний `AiProvider`-контракт (2026-09-22, code complete)

Окремо від legacy-скриптів нижче, `server/domains/ai/` + `server/infrastructure/ai/`
тепер мають production-контракт для генерації контенту через job queue:

- `server/domains/ai/types.ts` — інтерфейс `AiProvider` (`generateText`/`generateObject`),
  класифіковані помилки `AiProviderError` (`auth`/`rate_limited`/`timeout`/
  `invalid_response`/`unknown`, кожна з прапорцем `retryable` — job queue сам
  вирішує, чи повторювати спробу, провайдер не спить і не ретраїть всередині себе).
- `server/domains/ai/budget.ts` — `BudgetTracker`, жорстка зупинка по
  `maxRequests`/`maxTokens`/`maxCostUsd`.
- `server/infrastructure/ai/geminiProvider.ts` — реальний адаптер (Gemini,
  поточний основний провайдер); `openAiCompatibleProvider.ts` — generic
  `chat/completions`-клієнт, готовий під Groq/OpenRouter, коли їх оберуть
  основними (зараз не підключений — Gemini залишається primary); `mockProvider.ts`
  — детермінований мок для тестів.
- Job-тип `content.ai_generate` (`server/domains/jobs/catalog.ts` +
  `server/jobs/contentAi.ts`): один AI-виклик → сирий артефакт у
  `ai-artifacts/<jobId>.json` в object storage. Ще **не** пише в content-репозиторій
  — це задача WS2 (модель ревізій/drafts), яка ще не реалізована.
- Конфіг: **`CONTENT_AI_PROVIDER`** (`off`/`gemini`/`groq`/`openrouter`/`mock`) —
  навмисно інша змінна, ніж legacy `AI_PROVIDER` вище (різні допустимі значення,
  різні споживачі: ця — для `server/`, та — для `scripts/*.mjs`), плюс
  `GEMINI_API_KEY`/`GEMINI_MODEL` (спільні з legacy-скриптами), `GROQ_API_KEY`/
  `GROQ_MODEL`, `OPENROUTER_API_KEY`/`OPENROUTER_MODEL`, `AI_JOB_MAX_REQUESTS`,
  `AI_JOB_MAX_TOKENS`. У продакшені `CONTENT_AI_PROVIDER=mock` заборонено, а
  вибраний провайдер без свого ключа — помилка конфігурації, а не тихий фолбек.

AI-скрипти можуть допомагати створювати, класифікувати, аналізувати й ремонтувати чернетки питань. Результат AI не можна вважати біблійно правильним лише тому, що він має валідний JSON або пройшов build.

## Критичне попередження

До появи staging → review → publish workflow:

- завжди працюйте в окремій git branch;
- зробіть backup `data/question-db/` і `data/topics-db/`;
- спочатку використовуйте `--dry-run`, якщо команда його підтримує;
- не запускайте масовий write по `main`;
- переглядайте diff;
- запускайте quality, duplicate і Scripture audits;
- вручну перевіряйте фактичну правильність та українську мову;
- не деплойте автоматично згенерований контент;
- не використовуйте AI як духовний або доктринальний авторитет.

Невалідний `correctIndex` повинен бути відхилений. Не виправляйте його автоматичним значенням `0`.

## Підтримувані legacy provider

> **2026-09-22: Ollama видалено з ноутбука.** Локальна генерація більше не
> підтримується в цьому середовищі — усі провайдери нижче хмарні, без
> завантаження моделей. `scripts/lib/llm.mjs`'s `resolveProvider()` усе ще
> падає назад на `'ollama'`, коли `--provider`/`AI_PROVIDER` не задано — це
> тепер **зламаний дефолт**, доки Phase 4 (WS1) не прибере його. До того часу
> завжди передавайте `--provider gemini` або `--provider omniroute` явно, або
> задайте `AI_PROVIDER` у `.env`.

| Provider | Призначення | Основні вимоги |
|---|---|---|
| Gemini | cloud generation | `GEMINI_API_KEY` (Google AI Studio) |
| OmniRoute (клієнт) | generic OpenAI-сумісний gateway — код не прив'язаний до конкретного хмарного провайдера, лише до `chat/completions` + Bearer-токена | `OMNIROUTE_BASE_URL` + `OMNIROUTE_API_KEY`, вказані на реальний хмарний endpoint (див. нижче) |
| ~~Ollama~~ | видалено | — |

Provider і model flags відрізняються між legacy scripts. Перед запуском перевіряйте `--help` або source конкретної команди. У Phase 4 configuration буде уніфікована.

## Безкоштовні хмарні провайдери (без завантаження моделей)

`scripts/lib/omniroute.mjs` — це звичайний OpenAI-сумісний клієнт
(`POST {OMNIROUTE_BASE_URL}/chat/completions`, `Authorization: Bearer
{OMNIROUTE_API_KEY}`), не прив'язаний до конкретного продукту з назвою
"OmniRoute" — його можна спрямувати на будь-який хмарний gateway з таким же
контрактом, без змін коду. Перевірені варіанти станом на 2026-09-22
(рейтинг за придатністю для генерації українських питань):

| Провайдер | Free-tier ліміти | Картка? | `OMNIROUTE_BASE_URL` |
|---|---|---|---|
| **Groq** (рекомендовано як основний) | ~30 запитів/хв на модель, дуже швидко; Llama 3.3 70B, Qwen, gpt-oss-120b | Ні | `https://api.groq.com/openai/v1` |
| **OpenRouter** (рекомендовано як fallback) | 20 запитів/хв, 50/день (до 1000/день лише якщо поповнити $10 — не обов'язково); каталог моделей із суфіксом `:free` (DeepSeek, Llama, Qwen) ротується — перевіряйте актуальний список перед запуском | Ні | `https://openrouter.ai/api/v1` |
| Mistral La Plateforme | $10/міс кредитів у Free-плані | Ні | OpenAI-сумісний, окремий base URL — див. документацію Mistral |
| SambaNova Cloud | 200k токенів/день на модель | Ні | OpenAI-сумісний |
| Cloudflare Workers AI | 10 000 "neurons"/день | Ні, але потрібен Workers-акаунт | REST, не 1-в-1 chat/completions — потребує окремого клієнта, не `omniroute.mjs` |
| Cohere | 1000 викликів/міс | Ні | **тільки non-commercial** — не використовувати для продакшн-контенту |

Приклад `.env` для Groq (модель — на вибір із поточного списку на
console.groq.com):

```bash
OMNIROUTE_BASE_URL=https://api.groq.com/openai/v1
OMNIROUTE_API_KEY=<ключ з console.groq.com>
OMNIROUTE_MODEL=llama-3.3-70b-versatile
AI_PROVIDER=omniroute
```

Приклад для OpenRouter:

```bash
OMNIROUTE_BASE_URL=https://openrouter.ai/api/v1
OMNIROUTE_API_KEY=<ключ з openrouter.ai/keys>
OMNIROUTE_MODEL=deepseek/deepseek-chat-v3-0324:free
AI_PROVIDER=omniroute
```

Помилка `"OmniRoute недоступний... Запусти omniroute локально"` з
`omniroute.mjs` — застарілий текст з часів, коли endpoint був завжди
локальним; ігноруйте формулювання, причина та сама (endpoint недоступний
або неправильний base URL/ключ).

Безкоштовні ліміти й каталоги моделей змінюються без попередження —
перевіряйте актуальний стан на дашборді провайдера перед масовою
генерацією, а не покладайтесь на цю таблицю як на джерело правди в
довгостроковій перспективі.

## Основні команди

### Генерація питань

```bash
npm run generate-ai -- --theme geography --count 10 --difficulty youth
```

Перевірити:

- чи count означає фактично додані deduplicated questions;
- чи всі options унікальні;
- чи правильний answer;
- чи difficulty відповідає змісту;
- чи reference існує;
- чи питання належить темі.

### Генерація або регенерація тем

```bash
npm run generate-topics-ai -- --theme paul
```

Використовуйте `--force` тільки з backup і після розуміння write behavior.

### Сортування тем

```bash
npm run sort-topics-ai -- --theme paul --dry-run
npm run sort-topics-ai -- --all --reparent --dry-run
```

AI-порядок або reparent proposal не є автоматично правильним. Перевіряйте біблійну хронологію, канонічний контекст і логіку навчання.

### Сортування питань

```bash
npm run sort-questions -- --theme paul
npm run sort-questions -- --ai --theme paul --limit 5
```

Heuristic та AI classification можуть помилятися. Topic assignment потребує review.

### Аналіз

```bash
npm run questions:stats
npm run questions:dedupe-db
npm run analyze-quality
npm run analyze-explanations
npm run analyze-topics
npm run analyze-pools
npm run scripture:audit
```

Generated reports не замінюють human review.

### Repair

```bash
npm run fix-questions-ai
npm run fix-explanations-ai
```

Перед repair:

- backup;
- branch;
- обмежений scope;
- dry-run, якщо підтримується;
- review diff;
- повторний audit.

## Мінімальна перевірка після зміни контенту

```bash
npm run questions:stats
npm run questions:dedupe-db
npm run analyze-quality
npm run analyze-explanations
npm run scripture:audit
npm run test-classification
npm run smoke-audit
npm run build
```

Також вручну перевірте вибірку питань у UI на мобільному екрані.

## Відомі обмеження legacy tooling

- понад 20 окремих commands;
- дублювання parser/normalizer/retry logic;
- різна provider/model configuration;
- не всюди є dry-run;
- не всюди є atomic write;
- немає єдиного job store;
- немає централізованих budgets/cancellation/resume;
- немає обов’язкового staging;
- немає permissioned publication;
- немає центрального MockProvider для orchestration tests.

## Ціль Phase 4

Legacy tooling замінюється єдиним контрольованим entrypoint:

```bash
npm run ai -- <task> [options]
```

З lifecycle:

```text
draft
→ validation
→ staging
→ human review
→ approval
→ publication
→ audit/rollback
```

До завершення Phase 4 цей файл описує лише обережне використання існуючих локальних інструментів.