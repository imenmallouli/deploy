#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const I18N_FILE = path.resolve(process.cwd(), 'src/lib/i18n.tsx');

function parseArgs(argv) {
  const args = {
    source: 'en',
    target: 'fr',
    check: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--source' && argv[i + 1]) {
      args.source = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === '--target' && argv[i + 1]) {
      args.target = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === '--check') {
      args.check = true;
    }
  }

  return args;
}

function findMessagesBounds(content) {
  const marker = 'const messages: Record<Locale, Record<string, string>> = ';
  const markerIndex = content.indexOf(marker);
  if (markerIndex < 0) {
    throw new Error('Unable to find messages object in src/lib/i18n.tsx');
  }

  const objectStart = content.indexOf('{', markerIndex + marker.length);
  if (objectStart < 0) {
    throw new Error('Unable to find messages object start brace.');
  }

  let depth = 0;
  let objectEnd = -1;
  for (let i = objectStart; i < content.length; i += 1) {
    const ch = content[i];
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        objectEnd = i;
        break;
      }
    }
  }

  if (objectEnd < 0) {
    throw new Error('Unable to find messages object end brace.');
  }

  const semicolonIndex = content.indexOf(';', objectEnd);
  if (semicolonIndex < 0) {
    throw new Error('Unable to find messages object ending semicolon.');
  }

  return { objectStart, objectEnd, semicolonIndex };
}

function evalMessagesObject(objectLiteral) {
  // Trusted project source. Evaluating here avoids adding parser dependencies.
  // eslint-disable-next-line no-new-func
  return Function(`"use strict"; return (${objectLiteral});`)();
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function freeTranslate(text, source, target) {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(source)}|${encodeURIComponent(target)}`;

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Translation API request failed (${response.status}).`);
  }

  const json = await response.json();
  const translated = json?.responseData?.translatedText;
  if (!translated || typeof translated !== 'string') {
    throw new Error('Translation API returned an invalid payload.');
  }

  return translated;
}

function formatMessages(messages) {
  return `${JSON.stringify(messages, null, 2)}`
    .replace(/\"([^\"]+)\":/g, "'$1':")
    .replace(/"/g, "'");
}

function printMissingSummary(sourceLocale, targetLocale, missingKeys) {
  if (missingKeys.length === 0) {
    console.log(`[i18n] No missing keys in ${targetLocale} compared to ${sourceLocale}.`);
    return;
  }

  console.log(`[i18n] Missing keys in ${targetLocale} compared to ${sourceLocale}: ${missingKeys.length}`);
  for (const key of missingKeys) {
    console.log(`- ${key}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!['fr', 'en'].includes(args.source) || !['fr', 'en'].includes(args.target)) {
    throw new Error('Only fr and en are supported for --source/--target.');
  }
  if (args.source === args.target) {
    throw new Error('--source and --target must be different.');
  }

  const content = await fs.readFile(I18N_FILE, 'utf8');
  const bounds = findMessagesBounds(content);
  const objectLiteral = content.slice(bounds.objectStart, bounds.objectEnd + 1);
  const messages = evalMessagesObject(objectLiteral);

  const sourceMap = messages[args.source] ?? {};
  const targetMap = messages[args.target] ?? {};

  const sourceKeys = Object.keys(sourceMap);
  const missingKeys = sourceKeys.filter((key) => !(key in targetMap));

  if (args.check) {
    printMissingSummary(args.source, args.target, missingKeys);
    process.exit(missingKeys.length > 0 ? 1 : 0);
  }

  if (missingKeys.length === 0) {
    console.log(`[i18n] No missing keys. ${args.target} is already aligned with ${args.source}.`);
    return;
  }

  console.log(`[i18n] Translating ${missingKeys.length} missing keys from ${args.source} to ${args.target}...`);

  for (const key of missingKeys) {
    const sourceText = sourceMap[key];
    if (typeof sourceText !== 'string' || sourceText.length === 0) {
      continue;
    }

    let translatedText = sourceText;
    try {
      translatedText = await freeTranslate(sourceText, args.source, args.target);
      // Keep requests gentle for the free endpoint.
      await sleep(250);
    } catch (error) {
      console.warn(`[i18n] Warning: failed to translate key "${key}", using source text as fallback.`);
    }

    targetMap[key] = translatedText;
    console.log(`[i18n] ${key}`);
  }

  messages[args.target] = targetMap;

  const updatedObjectLiteral = formatMessages(messages);
  const updatedContent = `${content.slice(0, bounds.objectStart)}${updatedObjectLiteral}${content.slice(bounds.objectEnd + 1)}`;

  await fs.writeFile(I18N_FILE, updatedContent, 'utf8');
  console.log(`[i18n] Updated ${path.relative(process.cwd(), I18N_FILE)}.`);
}

main().catch((error) => {
  console.error(`[i18n] ${error.message}`);
  process.exit(1);
});
