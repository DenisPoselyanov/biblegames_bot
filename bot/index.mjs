#!/usr/bin/env node
/**
 * Telegram-бот для адміністрування бази питань (генерація через Ollama).
 * Тільки для ADMIN_IDS з .env
 */

import dotenv from 'dotenv';
import { spawn } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { Bot } from 'grammy';
import { DIFFICULTIES, THEME_IDS, getTheme } from '../scripts/lib/themes-config.mjs';
import { getGlobalStats, loadThemeQuestions } from '../scripts/lib/question-db.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

dotenv.config({ path: join(ROOT, '.env') });

const token = process.env.BOT_TOKEN;
const adminIds = (process.env.ADMIN_IDS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
  .map(Number);

if (!token) {
  console.error('❌ Додай BOT_TOKEN у bible-game/.env');
  process.exit(1);
}

if (adminIds.length === 0) {
  console.warn('⚠️ ADMIN_IDS порожній — ніхто не зможе керувати ботом');
}

const bot = new Bot(token);

function isAdmin(ctx) {
  const id = ctx.from?.id;
  return id != null && adminIds.includes(id);
}

async function denyUnlessAdmin(ctx) {
  if (isAdmin(ctx)) return false;
  await ctx.reply('⛔ Ця команда лише для адміністратора.');
  return true;
}

function formatStats() {
  const dbStats = getGlobalStats();
  const lines = ['📊 *База AI-питань*\n'];

  let total = 0;
  for (const themeId of THEME_IDS) {
    const s = dbStats[themeId];
    const count = s?.total ?? loadThemeQuestions(themeId).length;
    total += count;
    if (count > 0) {
      lines.push(`• ${themeId}: *${count}*`);
    }
  }

  lines.push(`\n*Всього AI:* ${total}`);
  lines.push('\nГенерація: `/generate geography 30`');
  lines.push('Статистика TS: `npm run questions:stats`');
  return lines.join('\n');
}

function runGenerate(themeId, count, difficulty = 'all') {
  return new Promise((resolve, reject) => {
    const args = [
      'scripts/generate-questions-ai.mjs',
      '--theme',
      themeId,
      '--count',
      String(count),
    ];
    if (difficulty !== 'all') {
      args.push('--difficulty', difficulty);
    }

    const child = spawn('node', args, {
      cwd: ROOT,
      env: { ...process.env },
      shell: process.platform === 'win32',
    });

    let out = '';
    let err = '';
    child.stdout.on('data', (d) => {
      out += d.toString();
    });
    child.stderr.on('data', (d) => {
      err += d.toString();
    });
    child.on('close', (code) => {
      if (code === 0) resolve(out || 'Готово.');
      else reject(new Error(err || out || `exit ${code}`));
    });
  });
}

bot.command('start', async (ctx) => {
  if (await denyUnlessAdmin(ctx)) return;
  await ctx.reply(
    '👋 *Біблійна гра — адмін-бот*\n\n' +
      '/stats — скільки AI-питань у базі\n' +
      '/generate `<тема>` `<кількість>` — Ollama\n' +
      '/themes — список тем\n' +
      '/help — довідка',
    { parse_mode: 'Markdown' },
  );
});

bot.command('help', async (ctx) => {
  if (await denyUnlessAdmin(ctx)) return;
  await ctx.reply(
    '*Команди:*\n' +
      '`/stats`\n' +
      '`/generate geography 50`\n' +
      '`/generate paul 20 medium`\n' +
      '`/themes`\n\n' +
      '*Ollama:* `ollama serve` + `ollama pull mistral`\n' +
      '*Модель:* OLLAMA_MODEL у .env',
    { parse_mode: 'Markdown' },
  );
});

bot.command('themes', async (ctx) => {
  if (await denyUnlessAdmin(ctx)) return;
  const list = THEME_IDS.map((id) => {
    const t = getTheme(id);
    return `• \`${id}\` — ${t?.title ?? id}`;
  }).join('\n');
  await ctx.reply(list, { parse_mode: 'Markdown' });
});

bot.command('stats', async (ctx) => {
  if (await denyUnlessAdmin(ctx)) return;
  await ctx.reply(formatStats(), { parse_mode: 'Markdown' });
});

bot.command('generate', async (ctx) => {
  if (await denyUnlessAdmin(ctx)) return;

  const text = ctx.message?.text ?? '';
  const argsText = text.replace(/^\/generate(?:@\w+)?\s*/i, '').trim();
  const parts = argsText.split(/\s+/);
  const themeId = parts[0];
  const count = parseInt(parts[1] || '20', 10);
  const difficulty = parts[2] || 'all';

  if (!themeId || !getTheme(themeId)) {
    await ctx.reply('❌ Використання: `/generate geography 30`', {
      parse_mode: 'Markdown',
    });
    return;
  }

  if (difficulty !== 'all' && !DIFFICULTIES.includes(difficulty)) {
    await ctx.reply(`❌ Складність: ${DIFFICULTIES.join(', ')}`);
    return;
  }

  const theme = getTheme(themeId);
  await ctx.reply(
    `⏳ Генерую ~${count} питань для *${theme.title}* (${difficulty})…\nЦе може зайняти кілька хвилин.`,
    { parse_mode: 'Markdown' },
  );

  try {
    const log = await runGenerate(themeId, count, difficulty);
    const after = loadThemeQuestions(themeId).length;
    await ctx.reply(
      `✅ Готово!\nТема \`${themeId}\`: *${after}* питань у AI-базі.\n\n\`\`\`\n${log.slice(-800)}\n\`\`\``,
      { parse_mode: 'Markdown' },
    );
  } catch (e) {
    await ctx.reply(`❌ Помилка:\n\`${e.message.slice(0, 500)}\``, {
      parse_mode: 'Markdown',
    });
  }
});

bot.catch((err) => {
  console.error('Bot error:', err);
});

console.log('🤖 Bible Game admin bot запущено');
bot.start();
