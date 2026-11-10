// A tiny static file server for the tests, on a free port. No dependencies.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const TYPES = {
	'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
	'.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
	'.woff2': 'font/woff2', '.png': 'image/png', '.txt': 'text/plain; charset=utf-8',
};

function serve(rootDir) {
	const root = path.resolve(rootDir);
	const server = http.createServer((req, res) => {
		const urlPath = decodeURIComponent(req.url.split('?')[0]);
		let file = path.join(root, urlPath);
		if (!file.startsWith(root)) { res.writeHead(403); res.end(); return; }
		if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
		fs.readFile(file, (err, data) => {
			if (err) { res.writeHead(404); res.end('not found'); return; }
			res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
			res.end(data);
		});
	});
	return new Promise((resolve) => {
		server.listen(0, '127.0.0.1', () => resolve({ server, url: `http://127.0.0.1:${server.address().port}` }));
	});
}

// Playwright lives in the sims server's node_modules; nothing is installed for this project.
function loadPlaywright() {
	const candidates = [
		process.env.PLAYWRIGHT_PATH,
		'playwright',
		path.resolve(__dirname, '../../../../../Website/game-sim-server/node_modules/playwright'),
		'C:/Users/seanm/Nextcloud2/Website/game-sim-server/node_modules/playwright',
	].filter(Boolean);
	for (const c of candidates) {
		try { return require(c); } catch { /* try the next */ }
	}
	throw new Error('Playwright not found. Set PLAYWRIGHT_PATH to a node_modules/playwright folder.');
}

module.exports = { serve, loadPlaywright };
