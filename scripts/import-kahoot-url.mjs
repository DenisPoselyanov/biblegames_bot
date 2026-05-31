#!/usr/bin/env node
/**
 * Stub: import public Kahoot discover URL metadata.
 * Full scrape requires Kahoot API — outputs instructions for manual TSV import.
 *
 * Usage: node scripts/import-kahoot-url.mjs "https://create.kahoot.it/share/..."
 */
const url = process.argv[2];

if (!url) {
  console.error('Usage: node scripts/import-kahoot-url.mjs <kahoot-share-url>');
  process.exit(1);
}

console.log(`
Kahoot URL import (ClassQuiz-style workflow):

1. Open: ${url}
2. Export or copy questions manually into TSV format:
   question \\t opt1 \\t opt2 \\t opt3 \\t opt4 \\t correctIndex \\t reference

3. Run: node scripts/import-kahoot-tsv.mjs your-quiz.tsv

Limitations (same as ClassQuiz):
- Videos are not imported
- Metadata (cover, dates) is skipped
`);
