import net from 'net';
import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0'; // Listen on all network interfaces
const DIST_DIR = path.join(__dirname, 'dist');

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.js': 'text/javascript; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

const requestHandler = (req, res) => {
  let filePath = path.join(DIST_DIR, req.url === '/' ? 'index.html' : req.url.split('?')[0]);

  // Prevent directory traversal
  if (!filePath.startsWith(DIST_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Fallback to index.html for Single Page Application routing
      filePath = path.join(DIST_DIR, 'index.html');
    }

    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500);
        res.end('Server Error: Could not read file');
      } else {
        res.writeHead(200, {
          'Content-Type': contentType,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(content);
      }
    });
  });
};

const certPath = path.join(__dirname, 'cert.pem');
const keyPath = path.join(__dirname, 'key.pem');

const httpServer = http.createServer(requestHandler);
let httpsServer = null;

if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
  const options = {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath)
  };
  httpsServer = https.createServer(options, requestHandler);
}

const server = net.createServer((socket) => {
  socket.once('data', (buffer) => {
    socket.pause();
    // 0x16 (22) is TLS Handshake record type
    if (httpsServer && buffer[0] === 0x16) {
      httpsServer.emit('connection', socket);
    } else {
      httpServer.emit('connection', socket);
    }
    socket.unshift(buffer);
    socket.resume();
  });
});

server.listen(PORT, HOST, () => {
  console.log('\n================================================================');
  console.log(' 🌊 TWEEDPUMP LOCAL NETWORK SCADA SERVER IS ACTIVE!');
  console.log('================================================================');
  console.log(` Status: Listening on all network interfaces (http & https on port ${PORT})`);
  console.log('\n Access the Tweedpump Controller from any device on your LAN:\n');
  console.log(` 🏠 Local Computer:   http://localhost:${PORT}  (or https://localhost:${PORT})`);

  const interfaces = os.networkInterfaces();
  Object.keys(interfaces).forEach((ifaceName) => {
    if (interfaces[ifaceName]) {
      interfaces[ifaceName].forEach((iface) => {
        if (iface.family === 'IPv4' && !iface.internal) {
          console.log(` 🌐 Network Device:   http://${iface.address}:${PORT}`);
        }
      });
    }
  });

  console.log('================================================================');
  console.log(' Press Ctrl+C to stop the server\n');
});
