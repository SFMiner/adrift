// One-time import: adrift-fragment-library.md + metadata files -> data/fragments.json.
// The library supplies the text, untouched. Metadata files supply everything else.
//
//   node tools/import_library.mjs --skeleton            print the id/text/group list
//   node tools/import_library.mjs meta1.json meta2.json --drafts drafts.json [--force]
//
// After the import, data/fragments.json is the canonical copy and is edited by hand.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

export function readLibrary() {
	const lines = readFileSync(join(root, 'adrift-fragment-library.md'), 'utf8').split(/\r?\n/);
	const out = [];
	let group = '';
	for (const line of lines) {
		if (line.startsWith('## ')) {
			group = line.slice(3).trim();
			if (/^possible overlaps/i.test(group)) break;
			continue;
		}
		if (line.startsWith('- ') && group) {
			out.push({ id: 's' + String(out.length + 1).padStart(3, '0'), group, text: line.slice(2).trim() });
		}
	}
	return out;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
	const args = process.argv.slice(2);
	const lib = readLibrary();
	if (args.includes('--skeleton')) {
		console.log(JSON.stringify(lib, null, '\t'));
		process.exit(0);
	}
	const force = args.includes('--force');
	const outPath = join(root, 'data', 'fragments.json');
	if (existsSync(outPath) && !force) {
		console.error('data/fragments.json exists; pass --force to overwrite it.');
		process.exit(1);
	}
	const meta = new Map();
	let drafts = [];
	for (let i = 0; i < args.length; i++) {
		if (args[i] === '--force') continue;
		if (args[i] === '--drafts') { drafts = JSON.parse(readFileSync(args[++i], 'utf8')); continue; }
		for (const m of JSON.parse(readFileSync(args[i], 'utf8'))) meta.set(m.id, m);
	}
	const fragments = [];
	for (const f of lib) {
		const m = meta.get(f.id);
		if (!m) { console.error('no metadata for', f.id, f.text); process.exit(1); }
		fragments.push({
			id: f.id, type: m.type, source: 'sean', text: f.text,
			echo: m.echo, valences: m.valences, tags: m.tags, questions: m.questions || [],
		});
	}
	drafts.forEach((d, i) => {
		fragments.push({
			id: 'd' + String(i + 1).padStart(3, '0'), type: d.type, source: 'draft', text: d.text,
			echo: d.echo, valences: d.valences, tags: d.tags, questions: d.questions || [],
		});
	});
	writeFileSync(outPath, JSON.stringify(fragments, null, '\t') + '\n');
	console.log(`wrote ${fragments.length} fragments (${lib.length} sean, ${drafts.length} draft)`);
}
