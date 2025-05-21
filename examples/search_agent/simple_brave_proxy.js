const http = require('http');
const https = require('https');
const url = require('url');

const BRAVE_API_HOST = 'api.search.brave.com';
const BRAVE_API_PATH = '/res/v1/web/search';
const PROXY_PORT = 8787;

const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const { pathname, query } = parsedUrl;

    // Set CORS headers for all responses
    res.setHeader('Access-Control-Allow-Origin', '*'); // Allow all origins
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Brave-Api-Key');

    // Handle OPTIONS preflight requests
    if (req.method === 'OPTIONS') {
        res.writeHead(204); // No Content
        res.end();
        return;
    }

    if (pathname === '/search' && req.method === 'GET') {
        const searchQuery = query.q;
        const braveApiKey = req.headers['x-brave-api-key'];

        if (!searchQuery) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Missing query parameter "q"' }));
            return;
        }

        if (!braveApiKey) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Missing X-Brave-Api-Key header' }));
            return;
        }

        const options = {
            hostname: BRAVE_API_HOST,
            port: 443,
            path: `${BRAVE_API_PATH}?q=${encodeURIComponent(searchQuery)}`,
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Accept-Encoding': 'gzip',
                'X-Subscription-Token': braveApiKey,
            },
        };

        const proxyReq = https.request(options, (proxyRes) => {
            res.writeHead(proxyRes.statusCode, proxyRes.headers);
            proxyRes.pipe(res, { end: true });
        });

        proxyReq.on('error', (err) => {
            console.error('Error fetching from Brave API:', err);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Failed to fetch from Brave API', details: err.message }));
        });

        req.pipe(proxyReq, { end: true });

    } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not Found' }));
    }
});

server.listen(PROXY_PORT, () => {
    console.log(`CORS Proxy for Brave Search API running on http://localhost:${PROXY_PORT}`);
    console.log(`Usage: Send GET requests to http://localhost:${PROXY_PORT}/search?q=YOUR_QUERY`);
    console.log(`Ensure you include the 'X-Brave-Api-Key' header with your Brave API key.`);
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`Error: Port ${PROXY_PORT} is already in use. Please use a different port.`);
    } else {
        console.error('Proxy server error:', err);
    }
});
