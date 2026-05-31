#!/usr/bin/env node
/**
 * Конвеєр підтем: preview/apply для file або extensions (гілки завіту).
 *
 * npm run topic-conveyor -- --action preview-branch --covenant old-testament --title "Жертовник" --json
 * npm run topic-conveyor -- --target extensions --action preview --covenant old-testament --parent ot-custom-x --count 3 --json
 */

import fs from 'fs';
import {
  applyAiCliFlags,
  checkLLM,
  defaultAiOpts,
  loadProjectEnv,
} from './lib/llm.mjs';
import {
  loadTree,
  findNode,
  isAggregateNode,
  generateBranchRoot,
  applyBranch,
  previewChildrenTarget,
  applyChildrenTarget,
} from './lib/topic-generate.mjs';

loadProjectEnv();
const { provider: DEFAULT_PROVIDER, model: DEFAULT_MODEL } = defaultAiOpts();

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    action: 'preview',
    target: 'file',
    file: null,
    parent: null,
    count: 3,
    provider: DEFAULT_PROVIDER,
    model: DEFAULT_MODEL,
    themeId: null,
    covenant: null,
    title: '',
    input: null,
    json: false,
    noBackup: false,
    avoid: [],
  };

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--action' && args[i + 1]) opts.action = args[++i];
    else if (a === '--target' && args[i + 1]) opts.target = args[++i];
    else if (a === '--file' && args[i + 1]) opts.file = args[++i];
    else if (a === '--parent' && args[i + 1]) opts.parent = args[++i];
    else if (a === '--count' && args[i + 1]) opts.count = parseInt(args[++i], 10);
    else if (a === '--provider' && args[i + 1]) opts.provider = args[++i];
    else if (a === '--model' && args[i + 1]) opts.model = args[++i];
    else if (a === '--theme' && args[i + 1]) opts.themeId = args[++i];
    else if (a === '--covenant' && args[i + 1]) opts.covenant = args[++i];
    else if (a === '--title' && args[i + 1]) opts.title = args[++i];
    else if (a === '--input' && args[i + 1]) opts.input = args[++i];
    else if (a === '--avoid' && args[i + 1]) {
      opts.avoid = args[++i].split('|').map((s) => s.trim()).filter(Boolean);
    }
    else if (a === '--json') opts.json = true;
    else if (a === '--no-backup') opts.noBackup = true;
  }

  const branchOnly = opts.action === 'preview-branch' || opts.action === 'apply-branch';

  if (branchOnly) {
    // preview/apply-branch працюють лише з --covenant
  } else if (opts.target === 'extensions') {
    if (!opts.covenant) {
      console.error('❌ --target extensions потребує --covenant old-testament|new-testament');
      process.exit(1);
    }
    if (!opts.file) opts.file = opts.covenant;
  } else if (!opts.file) {
    console.error('❌ Вкажи --file <themeId> або --target extensions --covenant ...');
    process.exit(1);
  }

  if (!opts.themeId) opts.themeId = opts.file;
  if (!opts.parent && opts.action !== 'preview-branch' && opts.action !== 'apply-branch') {
    opts.parent = opts.file;
  }

  applyAiCliFlags(opts, args);
  return opts;
}

function emitResult(payload, opts) {
  const line = JSON.stringify(payload);
  if (opts.json) process.stdout.write(`${line}\n`);
  else console.log(line);
}

async function runPreviewBranch(opts) {
  if (!opts.covenant) {
    emitResult({ ok: false, error: 'Потрібен --covenant' }, opts);
    process.exit(1);
  }
  const hasHint = Boolean(String(opts.title || '').trim());
  if (!hasHint) {
    const ok = await checkLLM(opts.model, { provider: opts.provider, quick: true });
    if (!ok) {
      emitResult({ ok: false, error: 'AI не відповідає' }, opts);
      process.exit(1);
    }
  }
  try {
    const { draft, uniqueness } = await generateBranchRoot(
      opts.title,
      opts.covenant,
      opts.model,
      opts.provider,
      { avoidTitles: opts.avoid },
    );
    emitResult({
      ok: true,
      action: 'preview-branch',
      covenant: opts.covenant,
      draft,
      uniqueness,
    }, opts);
  } catch (e) {
    emitResult({ ok: false, error: e.message }, opts);
    process.exit(1);
  }
}

async function runApplyBranch(opts) {
  if (!opts.covenant) {
    emitResult({ ok: false, error: 'Потрібен --covenant' }, opts);
    process.exit(1);
  }
  if (!opts.input || !fs.existsSync(opts.input)) {
    emitResult({ ok: false, error: 'Вкажи --input <json> з полями title, description, icon' }, opts);
    process.exit(1);
  }
  let draft;
  try {
    draft = JSON.parse(fs.readFileSync(opts.input, 'utf8'));
    if (draft.draft) draft = draft.draft;
  } catch (e) {
    emitResult({ ok: false, error: `Невалідний JSON: ${e.message}` }, opts);
    process.exit(1);
  }
  const result = applyBranch(opts.covenant, draft, { backup: !opts.noBackup });
  emitResult({ ok: true, action: 'apply-branch', ...result }, opts);
}

async function runPreview(opts) {
  if (opts.target === 'file') {
    const root = loadTree(opts.file);
    const found = findNode(root, opts.parent);
    if (!found?.node) {
      emitResult({ ok: false, error: `Вузол не знайдено: ${opts.parent}` }, opts);
      process.exit(1);
    }
    if (isAggregateNode(found.node)) {
      emitResult({ ok: false, error: 'Неможна генерувати під aggregate / *-all' }, opts);
      process.exit(1);
    }
  }

  const ok = await checkLLM(opts.model, { provider: opts.provider, quick: true });
  if (!ok) {
    emitResult({ ok: false, error: 'AI не відповідає' }, opts);
    process.exit(1);
  }

  try {
    const { nodes, uniqueness } = await previewChildrenTarget(
      opts.target,
      opts.target === 'extensions' ? opts.covenant : opts.file,
      opts.parent,
      opts.count,
      {
        themeId: opts.themeId,
        covenantId: opts.covenant,
        model: opts.model,
        provider: opts.provider,
        avoidTitles: opts.avoid,
      },
    );

    if (!nodes?.length) {
      emitResult({
        ok: false,
        error: 'Усі запропоновані підтеми схожі на наявні. Спробуйте перегенерувати.',
        uniqueness,
      }, opts);
      process.exit(1);
    }

    emitResult({
      ok: true,
      action: 'preview',
      target: opts.target,
      file: opts.file,
      covenant: opts.covenant,
      parentId: opts.parent,
      themeId: opts.themeId,
      nodes,
      uniqueness,
    }, opts);
  } catch (e) {
    emitResult({ ok: false, error: e.message }, opts);
    process.exit(1);
  }
}

async function runApply(opts) {
  if (!opts.input || !fs.existsSync(opts.input)) {
    emitResult({ ok: false, error: 'Вкажи --input <json file>' }, opts);
    process.exit(1);
  }
  let payload;
  try {
    payload = JSON.parse(fs.readFileSync(opts.input, 'utf8'));
  } catch (e) {
    emitResult({ ok: false, error: `Невалідний JSON: ${e.message}` }, opts);
    process.exit(1);
  }
  const nodes = payload.nodes || payload;
  if (!Array.isArray(nodes) || nodes.length === 0) {
    emitResult({ ok: false, error: 'Порожній масив nodes' }, opts);
    process.exit(1);
  }

  const key = opts.target === 'extensions' ? opts.covenant : opts.file;
  const result = applyChildrenTarget(opts.target, key, opts.parent, nodes, {
    backup: !opts.noBackup,
  });

  emitResult({
    ok: true,
    action: 'apply',
    target: opts.target,
    ...result,
    nodes,
  }, opts);
}

async function main() {
  const opts = parseArgs();
  switch (opts.action) {
    case 'preview-branch':
      await runPreviewBranch(opts);
      break;
    case 'apply-branch':
      await runApplyBranch(opts);
      break;
    case 'preview':
      await runPreview(opts);
      break;
    case 'apply':
      await runApply(opts);
      break;
    default:
      console.error('❌ action: preview | apply | preview-branch | apply-branch');
      process.exit(1);
  }
}

main().catch((e) => {
  emitResult({ ok: false, error: e.message }, { json: process.argv.includes('--json') });
  process.exit(1);
});
