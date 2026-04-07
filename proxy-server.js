const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const HTTP_PORT = 3000;
const HTTPS_PORT = 3443;

const API_KEY = process.env.ANTHROPIC_API_KEY || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

if (!API_KEY) {
  console.error('ERROR: Please set your Anthropic API key');
  console.error('Run: export ANTHROPIC_API_KEY="your-key-here"');
  process.exit(1);
}

if (!OPENAI_API_KEY) {
  console.warn('WARNING: OPENAI_API_KEY not set — speech transcription will not work');
  console.warn('Run: export OPENAI_API_KEY="your-key-here"');
}

const MIME_TYPES = {
  '.html': 'text/html',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
};

function handleRequest(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Whisper transcription proxy
  if (req.method === 'POST' && req.url === '/api/transcribe') {
    let chunks = [];
    req.on('data', chunk => { chunks.push(chunk); });
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      const options = {
        hostname: 'api.openai.com',
        path: '/v1/audio/transcriptions',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': req.headers['content-type'],
          'Content-Length': body.length
        }
      };

      const apiReq = https.request(options, apiRes => {
        let data = '';
        apiRes.on('data', chunk => { data += chunk.toString(); });
        apiRes.on('end', () => {
          res.writeHead(apiRes.statusCode, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          });
          res.end(data);
        });
      });

      apiReq.on('error', error => {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: error.message } }));
      });

      apiReq.write(body);
      apiReq.end();
    });
    return;
  }

  // Anthropic chat proxy
  if (req.method === 'POST' && req.url === '/api/chat') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      console.log('Forwarding to Anthropic API...');
      const options = {
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY,
          'anthropic-version': '2023-06-01',
          'Content-Length': Buffer.byteLength(body)
        }
      };

      const apiReq = https.request(options, apiRes => {
        let data = '';
        apiRes.on('data', chunk => { data += chunk.toString(); });
        apiRes.on('end', () => {
          res.writeHead(apiRes.statusCode, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          });
          res.end(data);
        });
      });

      apiReq.on('error', error => {
        console.error('Anthropic API error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: error.message } }));
      });

      apiReq.write(body);
      apiReq.end();
    });
    return;
  }

  // Serve static files
  let filePath = req.url === '/' ? '/index.html' : req.url;
  filePath = path.join(__dirname, filePath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'text/plain' });
    res.end(data);
  });
}

// Always start HTTP server (works on desktop via localhost)
http.createServer(handleRequest).listen(HTTP_PORT, '0.0.0.0', () => {
  console.log(`HTTP:  http://localhost:${HTTP_PORT}  (desktop)`);
});

// Start HTTPS server if certificates exist (required for mobile mic access)
const certPath = path.join(__dirname, 'cert.pem');
const keyPath  = path.join(__dirname, 'key.pem');

if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
  const sslOptions = {
    cert: fs.readFileSync(certPath),
    key:  fs.readFileSync(keyPath),
  };
  https.createServer(sslOptions, handleRequest).listen(HTTPS_PORT, '0.0.0.0', () => {
    console.log(`HTTPS: https://<your-local-ip>:${HTTPS_PORT}  (mobile)`);
  });
} else {
  console.log('');
  console.log('── Mobile access ──────────────────────────────────');
  console.log('To use on your phone, generate a self-signed cert:');
  console.log('');
  console.log('  openssl req -x509 -newkey rsa:2048 \\');
  console.log('    -keyout key.pem -out cert.pem \\');
  console.log('    -days 365 -nodes -subj "/CN=localhost"');
  console.log('');
  console.log('Then restart the server. On your phone, open:');
  console.log(`  https://<your-local-ip>:${HTTPS_PORT}`);
  console.log('and accept the certificate warning.');
  console.log('────────────────────────────────────────────────────');
}

process.on('SIGINT', () => {
  console.log('\nShutting down...');
  process.exit(0);
});
