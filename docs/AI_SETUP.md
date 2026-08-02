# Legacy AI Tooling — локальна генерація та аналіз контенту

> **Статус:** поточна інструкція для legacy scripts до виконання Phase 4.  
> **Не є production publication workflow.**  
> **Актуальна AI-архітектура:** [./BIBLE_GAMES_MASTER_SPECIFICATION.md — Phase 4](./BIBLE_GAMES_MASTER_SPECIFICATION.md#phase-4--content-quality-reviewed-ai-pipeline--protected-content-studio)

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

| Provider | Призначення | Основні вимоги |
|---|---|---|
| Ollama | локальна генерація | запущений Ollama server і локальна model |
| Gemini | cloud generation | `GEMINI_API_KEY` |
| OmniRoute | локальний/зовнішній gateway | налаштований endpoint/API key відповідно до поточного tooling |

Provider і model flags відрізняються між legacy scripts. Перед запуском перевіряйте `--help` або source конкретної команди. У Phase 4 configuration буде уніфікована.

## Ollama

1. Встановіть Ollama.
2. Запустіть server:

```bash
ollama serve
```

3. Завантажте model, наприклад:

```bash
ollama pull mistral
```

4. Перевірте, що endpoint доступний до запуску scripts.

Не припускайте, що temperature/model/env однаково обробляються всіма legacy scripts.

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