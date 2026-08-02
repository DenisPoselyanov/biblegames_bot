# Bible Games — варіанти монетизації та decision framework

> **Статус:** активний допоміжний документ Phase 6  
> **Рішення про конкретну модель:** ще не прийняте  
> **Канонічна фаза:** Phase 6 — Economy, Shop, Entitlements & Monetization  
> **Дата перевірки можливостей Telegram:** 2026-08-02

---

# 1. Призначення документа

Цей документ описує доступні способи монетизації Bible Games у Telegram, їхні технічні вимоги, обмеження, ризики та порядок оцінювання.

Документ **не обирає бізнес-модель автоматично**. Перед production-реалізацією власник продукту повинен окремо затвердити потрібну комбінацію через ADR у `DECISIONS.md`.

Монетизація не може випереджати:

- production-safe authentication;
- server-authoritative economy;
- стабільні entitlements;
- надійні payment callbacks;
- контентну якість;
- базову цінність безкоштовної версії;
- захист неповнолітніх;
- legal/privacy review.

---

# 2. Незмінні принципи

## 2.1. Навчання не перетворюється на pay-to-win

Не продаються:

- правильні відповіді;
- доступ до базового біблійного змісту, необхідного для проходження основного навчального шляху;
- штучне підвищення rank або leaderboard score;
- перемога у Kahoot, Challenge або «Мільйонері»;
- обхід mastery чи review;
- приховане зменшення складності в рейтинговому режимі;
- перевага над безкоштовним користувачем у competitive mode.

Дозволені напрямки:

- косметичні теми;
- аватари, рамки та значки;
- optional supportive features;
- розширена статистика;
- інструменти ведучого та редактора;
- церковні й classroom-функції;
- додаткові приватні групові можливості;
- добровільні supporter bundles;
- платні навчальні матеріали лише тоді, коли безкоштовний core залишається повноцінним і зрозумілим.

## 2.2. Внутрішні монети та Telegram Stars — різні системи

### Внутрішні монети Bible Games

- ігрова reward currency;
- нараховується лише сервером;
- використовується для дозволеної косметики або внутрішніх reward-механік;
- не має обіцянки реальної грошової вартості;
- не виводиться;
- не конвертується назад у Stars або гроші.

### Telegram Stars

- офіційний платіжний інструмент Telegram для цифрових товарів і послуг;
- обробляється через Telegram payment flow;
- має окремий transaction ledger;
- не додається до внутрішнього `coinBalance`;
- не видається за gameplay score;
- не може бути підроблений client payload.

Будь-яка майбутня конвертація між внутрішніми монетами та Stars заборонена без окремого ADR, юридичного аналізу та повної перебудови ризик-моделі.

## 2.3. Прозорість

Користувач до оплати повинен бачити:

- що саме купує;
- чи покупка одноразова або recurring;
- валюту;
- повну ціну;
- строк доступу;
- умови renewal/cancel;
- чи впливає покупка на рейтинг;
- правила refund;
- sponsor/advertising label;
- обмеження функції.

## 2.4. Захист неповнолітніх

- жодних loot boxes або випадкових paid rewards без окремого legal/ethical рішення;
- жодних countdown dark patterns;
- жодного сорому за відсутність Premium;
- жодних агресивних push-нагадувань про оплату;
- spending limits і parental considerations мають бути оцінені до запуску;
- sponsor content повинен відповідати християнській та сімейній brand-safety policy.

---

# 3. Варіанти монетизації

# 3.1. Варіант A — офіційний Telegram Ads revenue sharing

Telegram може показувати sponsored messages у чаті з ботом. За офіційною документацією розробники можуть отримувати частку доходу від Telegram Ads, які з’являються у чаті з ботом.

## Що контролює Telegram

- eligibility;
- доступність рекламного інвентарю;
- показ оголошення;
- формат і placement у Telegram interface;
- рекламний попит;
- revenue reporting;
- platform policy.

## Що не повинно обіцяти Bible Games

- гарантований показ;
- гарантований CPM або дохід;
- повний контроль рекламодавців;
- можливість вставити official Telegram sponsored message у довільне місце Mini App;
- прогнозовану основну виручку лише з Ads.

## Роль у бізнес-моделі

Це може бути **пасивний додатковий дохід**, але не основний фінансовий фундамент.

## Умови запуску

- перевірити фактичну eligibility бота в Telegram;
- перевірити актуальні Telegram Bot Developer Terms;
- зафіксувати доступні brand-safety controls;
- не закладати Ads revenue в обов’язковий budget;
- відокремити Telegram Ads від власних sponsor placements;
- не створювати в Mini App фальшиві блоки, схожі на official Telegram Ads.

## Метрики

- ad revenue per MAU;
- частка активних користувачів, для яких Telegram фактично показує Ads;
- вплив на retention;
- скарги на недоречний контент;
- частка доходу Ads у загальній виручці.

---

# 3.2. Варіант B — одноразові цифрові покупки через Telegram Stars

Це основний Telegram-native механізм для продажу цифрових товарів і послуг у ботах та Mini Apps.

## Можливі продукти

- themes;
- avatars;
- profile frames;
- badges;
- supporter bundles;
- додаткові cosmetic packs;
- optional hint packs лише поза competitive/ranked modes;
- creator tools;
- додаткові playlist/editor capabilities;
- premium lesson presentation assets;
- експортні можливості для лідерів;
- optional content packs за умови, що безкоштовний core залишається повноцінним.

## Заборонені продукти

- готові правильні відповіді;
- leaderboard XP;
- rank boost;
- guaranteed win;
- обхід server validation;
- paid advantage у challenge/multiplayer;
- «купити streak», якщо це спотворює історію реального навчання.

## Технічний flow

1. Server створює authoritative order.
2. Server визначає product, price та currency `XTR`.
3. Telegram invoice/payment flow запускається з server-generated даними.
4. Server перевіряє pre-checkout/payment event.
5. Успішна Telegram transaction записується ідемпотентно.
6. Entitlement видається в одній транзакції або через надійний outbox flow.
7. Client лише оновлює UI після server confirmation.
8. Duplicate callback не створює повторну покупку.
9. Refund/reversal змінює entitlement за заздалегідь визначеною policy.

## Обов’язкові дані

- internal order ID;
- Telegram user ID;
- product/catalog revision;
- price in Stars;
- payment status;
- Telegram charge identifier;
- timestamps;
- idempotency key;
- entitlement result;
- refund/reversal state;
- audit metadata.

## Acceptance gate

- жодне entitlement не видається лише за client success screen;
- catalog price не приймається з клієнта;
- webhook/update verification покрита tests;
- duplicate update безпечний;
- restore purchase працює на іншому пристрої;
- audit показує зв’язок order → payment → entitlement.

---

# 3.3. Варіант C — платні підписки через Telegram Stars

Telegram Mini Apps підтримують paid subscriptions із рівнями контенту та функцій.

## Можлива структура тарифів

### Free

- базовий навчальний шлях;
- практика;
- основні пояснення;
- базовий progress;
- участь у дозволених групах;
- core Bible content.

### Premium

Можливі функції:

- розширена статистика;
- додаткові cosmetic packs;
- розширені персональні цілі;
- advanced review tools;
- optional AI-assisted explanations лише з approved retrieval;
- додаткові playlists;
- export/history features;
- відсутність **власних** sponsor placements Bible Games, якщо це технічно та комерційно обрано.

Premium не повинен обіцяти видалення platform-level Telegram Ads, якщо Telegram не надає продукту такого контролю.

### Church / Classroom

Можливі функції:

- приватні групи;
- roles і moderation;
- власні question sets;
- classroom presenter;
- Kahoot host tools;
- scheduled plans;
- group analytics;
- assignments;
- review queue;
- content import/export;
- адміністративні seats;
- audit history;
- organization branding у допустимих межах.

## Subscription state machine

```text
pending
→ active
→ grace_period
→ cancelled_at_period_end
→ expired
→ revoked
```

State machine уточнюється відповідно до актуальних Telegram subscription APIs і terms на момент реалізації.

## Вимоги

- server-authoritative subscription status;
- renewal and expiry reconciliation;
- entitlement snapshots;
- cancel flow;
- restore flow;
- plan versioning;
- grandfathering policy;
- notification policy без spam;
- чітке пояснення recurring payment;
- feature flags для кожного plan entitlement.

## Метрики

- free-to-paid conversion;
- trial-to-paid conversion, якщо trial підтримується і схвалений;
- monthly renewal;
- voluntary churn;
- involuntary churn;
- refund rate;
- feature usage per plan;
- support load;
- retention difference без маніпулятивної інтерпретації.

---

# 3.4. Варіант D — Telegram Affiliate Program

Telegram дозволяє Mini Apps створювати affiliate program, у якій користувачі, канали, автори та інші Mini Apps отримують комісію у Stars за покупки приведених користувачів.

## Потенційні партнери

- християнські автори;
- церковні канали;
- молодіжні служителі;
- викладачі недільної школи;
- блогери;
- навчальні платформи;
- партнерські Mini Apps.

## Налаштування програми

- commission rate;
- commission duration;
- public terms;
- referral attribution;
- eligible Star transactions;
- abuse monitoring;
- termination policy;
- financial reporting.

## Ризики

- self-referral;
- fake accounts;
- refund abuse;
- spam promotion;
- misleading promises від affiliate;
- надто висока commission, що руйнує margin;
- конфлікт із church/non-commercial positioning.

## Правила запуску

- запускати лише після стабільних Stars purchases;
- створити affiliate content policy;
- заборонити богословсько маніпулятивні рекламні обіцянки;
- показувати transparent terms;
- визначити allowed promotional assets;
- мати abuse suspension process;
- врахувати commission у unit economics.

## Метрики

- attributed new users;
- attributed payers;
- affiliate conversion;
- commission cost;
- refund/fraud rate;
- net revenue after commission;
- retention referred users;
- concentration risk по найбільших affiliate.

---

# 3.5. Варіант E — ручні тематичні sponsorships

Bible Games може вручну співпрацювати з перевіреними партнерами:

- християнськими видавництвами;
- магазинами Біблій;
- біблійними коледжами;
- конференціями;
- таборами;
- музичними та навчальними проєктами;
- благодійними або церковними ініціативами після перевірки.

## Дозволені surfaces

- окремий clearly labeled sponsor card на Home;
- recommendation після завершення уроку;
- partner section;
- sponsor of a non-ranked event;
- sponsor card у Telegram-каналі Bible Games;
- branded educational collection лише з редакційною незалежністю Bible Games.

## Заборонені surfaces

- між питанням і відповіддю;
- поверх біблійного тексту;
- як обов’язковий interstitial перед молитвою або уроком;
- прихована реклама без label;
- sponsor influence на правильні відповіді;
- behavioral targeting на основі духовної вразливості;
- категорії, несумісні з сімейною та християнською політикою.

## Вимоги

- sponsor label;
- contract and dates;
- approved creative;
- impression/click measurement без надмірного tracking;
- age/content policy;
- kill switch;
- audit trail;
- separation editorial vs commercial;
- disclosure у privacy policy, якщо збираються додаткові дані.

## Метрики

- impressions;
- viewability;
- clicks без dark patterns;
- sponsor conversion, якщо дозволено;
- complaints;
- retention impact;
- revenue per placement;
- frequency cap.

---

# 3.6. Варіант F — окремий Telegram-канал Bible Games

Канал може використовуватися для:

- вірша дня;
- нових навчальних планів;
- community updates;
- рейтингів;
- анонсів;
- paid media;
- suggested posts;
- Telegram Ads revenue sharing, якщо канал відповідає актуальним умовам;
- sponsor posts;
- просування Mini App.

Канал є окремим acquisition/content surface і не повинен бути єдиним місцем для core product functionality.

## Правила

- застосунок не вимагає обов’язкової підписки на канал для базового навчання;
- paid posts чітко позначені;
- channel analytics не змішуються з product analytics;
- sponsor policy така сама, як у Mini App;
- Stars balance і revenue accounting каналу ведуться окремо;
- правила Telegram перевіряються перед запуском кожного monetization feature.

---

# 3.7. Варіант G — сторонні рекламні мережі всередині Mini App

Технічно Mini App є web application, але інтеграція сторонньої ad network у Telegram WebView має суттєві ризики.

## Ризики

- нестабільна робота у WebView;
- cookie/consent limitations;
- tracking і privacy;
- невідповідний рекламний контент;
- gambling, alcohol, adult, political або інші небажані категорії;
- погіршення performance;
- порушення Telegram, Apple, Google або ad-network policies;
- слабкий контроль brand safety;
- негативний вплив на духовний та навчальний контекст;
- accessibility issues;
- складна підтримка неповнолітніх користувачів.

## Статус

**Відкладений / experimental варіант. Не реалізовувати за замовчуванням.**

Для запуску потрібні:

- окремий ADR;
- legal/privacy review;
- список дозволених категорій;
- consent management;
- sandbox test у Telegram Android/iOS/Desktop;
- performance budget;
- content moderation guarantees;
- kill switch;
- A/B test із чіткими stop conditions.

Для Bible Games ручні sponsorships або Telegram-native monetization зазвичай мають вищий пріоритет, ніж generic ad network.

---

# 4. Можливі пакети продукту

Це лише варіанти для майбутнього рішення.

## Модель 1 — Free + cosmetics

- free learning core;
- cosmetic Star purchases;
- internal coin shop;
- official Telegram Ads як passive addition;
- без subscription на першому етапі.

## Модель 2 — Free + Premium

- free learning core;
- Premium subscription;
- cosmetic one-time purchases;
- affiliate program після стабілізації;
- optional curated sponsorships.

## Модель 3 — Individual + Church

- free individual tier;
- individual Premium;
- Church/Classroom plan;
- host/editor/admin capabilities;
- organization analytics;
- affiliate program для церковних каналів і служителів.

## Модель 4 — Sponsor-supported free product

- core безкоштовний;
- мінімальні curated sponsor placements;
- optional supporter pack;
- відсутність generic third-party ad network;
- строгий brand-safety review.

## Модель 5 — No monetization during validation

- нуль monetization до досягнення retention/content quality targets;
- лише внутрішня economy без real payments;
- збір product metrics;
- monetization decision після closed beta.

---

# 5. Рекомендований порядок оцінювання, а не автоматичне рішення

1. Визначити, чи продукт спершу проходить beta без monetization.
2. Стабілізувати internal economy і entitlement architecture.
3. Реалізувати sandbox one-time Stars purchase.
4. Перевірити cosmetics/supporter bundle без pay-to-win.
5. Оцінити Premium і Church plan окремими фінансовими моделями.
6. Лише після стабільних purchases оцінити affiliate program.
7. Перевірити eligibility і реальний дохід Telegram Ads без залежності від нього.
8. Ручні sponsorships запускати лише з brand-safety policy.
9. Generic third-party ads залишити останнім і необов’язковим варіантом.

Цей порядок можна змінити лише через документоване продуктове рішення.

---

# 6. Архітектурні вимоги

## 6.1. Мінімальні сутності

```text
CatalogItem
CatalogRevision
InternalWallet
WalletLedgerEntry
PaymentOrder
TelegramStarTransaction
Entitlement
SubscriptionPlan
Subscription
RefundOrReversal
AffiliateProgramConfig
AffiliateAttribution
SponsorCampaign
SponsorPlacement
RevenueLedgerEntry
```

Назви можуть змінюватися під час domain design, але відповідальності не повинні змішуватися.

## 6.2. Payment state machine

```text
created
→ invoice_issued
→ pending
→ paid
→ entitlement_pending
→ completed
```

Помилкові гілки:

```text
created | invoice_issued | pending
→ expired | cancelled | failed

paid | entitlement_pending | completed
→ refund_pending | refunded | reversed
```

## 6.3. Головні інваріанти

- одна підтверджена Telegram transaction не може grant-ити entitlement двічі;
- client не визначає price;
- client не визначає payment status;
- client не визначає subscription expiry;
- internal coin ledger не дорівнює revenue ledger;
- refund має відтворюваний вплив на entitlement;
- affiliate commission не змінює entitlement користувача;
- sponsor campaign не впливає на learning answer logic;
- payment data не зберігається в localStorage як source of truth;
- усі критичні переходи auditable.

## 6.4. Feature flags

Окремі flags:

- `telegram_ads_revenue_enabled`;
- `telegram_stars_purchases_enabled`;
- `telegram_stars_subscriptions_enabled`;
- `affiliate_program_enabled`;
- `curated_sponsorships_enabled`;
- `third_party_ads_enabled`;
- `church_plan_enabled`;
- `premium_plan_enabled`.

Production default для нового monetization feature — `false`, доки не пройдені gates.

---

# 7. Decision gate перед реалізацією

До початку production monetization створюється ADR з відповідями:

1. Яка модель або комбінація моделей обрана?
2. Який free core гарантовано залишається доступним?
3. Які продукти продаються?
4. Чи є recurring subscription?
5. Чи потрібний Church plan?
6. Чи дозволені official Telegram Ads?
7. Чи дозволені curated sponsorships?
8. Чи відкладені generic third-party ads?
9. Яка policy для неповнолітніх?
10. Які країни запуску?
11. Які tax/legal/privacy obligations?
12. Яка refund policy?
13. Які unit economics після Telegram/affiliate/reward costs?
14. Які метрики визначають успіх або зупинку експерименту?
15. Хто є operational owner платежів, support і incidents?

Без цього ADR дозволені лише sandbox/prototype integrations за feature flag.

---

# 8. Release gates

Монетизація не виходить у production, поки не виконано все:

- server-authoritative auth;
- server-authoritative wallet;
- окремі internal coins і Telegram Stars;
- versioned catalog;
- idempotent payment processing;
- verified successful payment flow;
- refund/reversal policy;
- entitlement restore;
- subscription cancel/expiry flow, якщо є subscription;
- affiliate abuse policy, якщо є affiliate;
- sponsor policy, якщо є sponsor;
- privacy/legal review;
- minor protection review;
- support procedure;
- monitoring and reconciliation;
- rollback/kill switch;
- staging tests;
- production smoke test;
- no pay-to-win review;
- canonical ADR із затвердженою моделлю.

---

# 9. Офіційні Telegram references

Перед реалізацією перевіряти актуальні версії:

- Bot Payments API for Digital Goods and Services: `https://core.telegram.org/bots/payments-stars`
- Telegram Stars API: `https://core.telegram.org/api/stars`
- Telegram Mini Apps: `https://core.telegram.org/bots/webapps`
- Telegram Bot Features: `https://core.telegram.org/bots/features`
- Affiliate programs API: `https://core.telegram.org/api/bots/referrals`
- Affiliate Programs overview: `https://telegram.org/tour/affiliate-programs`
- Telegram Bot Developer Terms: `https://telegram.org/tos/bot-developers`

Telegram capabilities, eligibility, fees, reward mechanisms and policy may change. На етапі реалізації офіційна документація та чинні Terms мають вищий пріоритет за цей snapshot.
