import JSZip from 'jszip';
import saveAs from 'file-saver';
import forge from 'node-forge';

export function setupServerDownload({ btnServer }) {
    btnServer.addEventListener('click', () => {
        // UI Feedback
        const originalText = btnServer.innerHTML;
        btnServer.innerHTML = '<i class="fas fa-cog fa-spin"></i> Generating...';
        btnServer.disabled = true;

        // Allow UI to update before blocking operation
        setTimeout(async () => {
            try {
                const zip = new JSZip();

                // 1. Generate Self-Signed Certs (Client-side)
                const ssl = generateSSLCert();
                zip.file("localhost.key", ssl.key);
                zip.file("localhost.crt", ssl.cert);

                const serverJs = `
const https = require('https');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const PORT = 8080;

const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
};

// SSL Options
const options = {
    key: fs.readFileSync('localhost.key'),
    cert: fs.readFileSync('localhost.crt')
};

const requestHandler = (request, response) => {
    console.log('request ', request.url);

    let filePath = '.' + request.url;
    if (filePath == './') {
        filePath = './panel.html';
    }

    // Remove query strings
    filePath = filePath.split('?')[0];

    const extname = String(path.extname(filePath)).toLowerCase();
    const contentType = mimeTypes[extname] || 'application/octet-stream';

    // Basic CORS headers for Twitch Extension
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization',
        'Content-Type': contentType
    };

    if (request.method === 'OPTIONS') {
        response.writeHead(204, headers);
        response.end();
        return;
    }

    fs.readFile(filePath, function(error, content) {
        if (error) {
            if(error.code == 'ENOENT'){
                response.writeHead(404, headers);
                response.end('File not found');
            }
            else {
                response.writeHead(500, headers);
                response.end('Error: '+error.code);
            }
        }
        else {
            response.writeHead(200, headers);
            response.end(content, 'utf-8');
        }
    });
};

function generateHTMLForView(view) {
    const elementsHTML = (view.elements || []).map(el => {
        const type = el.type;
        const data = el.props || {};
        const layout = getLayoutStyle(data);
        switch(type) {
            case 'text':
                return \`<div class="teb-wrapper" style="\${layout}"><div class="teb-text" style="color:\${escapeAttribute(data.color)};font-size:\${escapeAttribute(data.size)};text-align:\${escapeAttribute(data.align)};">\${escapeHtml(data.text || '')}</div></div>\`;
            case 'button':
                return \`<div class="teb-wrapper" style="\${layout}"><button class="teb-btn" style="background-color:\${escapeAttribute(data.bgColor)};color:\${escapeAttribute(data.color)};">\${escapeHtml(data.label || '')}</button></div>\`;
            case 'container':
                return \`<div class="teb-wrapper" style="\${layout}"><div class="teb-container" style="background-color:\${escapeAttribute(data.bgColor)};padding:\${escapeAttribute(data.padding)};border-radius:\${escapeAttribute(data.radius)};color:#aaa;font-size:0.8rem;text-align:center;border:1px dashed #444;">Container Area</div></div>\`;
            case 'image':
                return \`<div class="teb-wrapper" style="\${layout}"><img class="teb-image" src="\${escapeAttribute(data.src || '')}" alt="\${escapeAttribute(data.alt || '')}" /></div>\`;
            case 'divider':
                return \`<div class="teb-wrapper" style="\${layout}"><div class="teb-divider" style="background-color:\${escapeAttribute(data.color)};margin:\${escapeAttribute(data.margin)} 0;"></div></div>\`;
            default:
                return '';
        }
    }).join('\\n');

    let extraStyle = '';
    if (view.type === 'video_overlay' || view.type === 'component') {
        extraStyle = '<style>body { background-color: transparent !important; }</style>';
    }

    return \`<!DOCTYPE html>
<html>
<head>
    <title>\${escapeHtml(view.label || '')}</title>
    <link rel="stylesheet" href="panel.css">
    \${extraStyle}
</head>
<body>
    <div id="app">
\${elementsHTML}
    </div>
    <script src="https://extension-files.twitch.tv/helper/v1/twitch-ext.min.js"></script>
    <script src="viewer.js"></script>
</body>
</html>\`;
}

function getLayoutStyle(data) {
    const x = typeof data.x === 'number' ? data.x : 0;
    const y = typeof data.y === 'number' ? data.y : 0;
    const w = typeof data.width === 'number' ? data.width : null;
    const h = typeof data.height === 'number' ? data.height : null;

    let style = \`left:\${x}px;top:\${y}px;\`;
    if (w !== null) style += \`width:\${w}px;\`;
    if (h !== null) style += \`height:\${h}px;\`;
    return style;
}

function escapeHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function escapeAttribute(str) {
    return String(str || '').replace(/"/g, '&quot;');
}

const cssContent = `body {
    background-color: #0e0e10;
    color: white;
    font-family: system-ui, sans-serif;
    margin: 0;
    padding: 0;
    overflow-x: hidden;
}
#app {
    position: relative;
    width: 100%;
    min-height: 100px;
    padding: 10px;
}
.teb-wrapper {
    position: absolute;
    box-sizing: border-box;
}
.teb-btn {
    border: none;
    padding: 8px 16px;
    border-radius: 4px;
    width: 100%;
    cursor: pointer;
    font-weight: 600;
    transition: opacity 0.2s;
}
.teb-btn:hover { opacity: 0.9; }
.teb-text { line-height: 1.4; }
.teb-image { max-width: 100%; height: auto; display: block; border-radius: 4px; }
.teb-divider { width: 100%; height: 1px; }
.teb-container { border-radius: 4px; }\`;

const jsContent = \`window.twitch = window.Twitch.ext;

twitch.onContext((context) => {
    console.log('Context:', context);
});

twitch.onAuthorized((auth) => {
    console.log('Authorized:', auth);
});

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.teb-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            console.log('Button clicked:', btn.textContent);
        });
    });
});\`;

const manifest = {
    "name": "My DragDrop Extension",
    "version": "0.0.1",
    "description": "Generated with Twitch Extension Builder",
    "author": "You",
    "views": {
        "panel": {
            "viewer_url": "panel.html",
            "height": 300,
            "can_link_external_content": false
        },
        "mobile": {
            "viewer_url": "mobile.html"
        },
        "config": {
            "viewer_url": "config.html"
        },
        "component": {
            "viewer_url": "video_component.html",
            "aspect_width": 3000,
            "aspect_height": 2000,
            "zoom": false
        },
        "video_overlay": {
            "viewer_url": "video_overlay.html"
        }
    },
    "manifest_version": "0.0.1"
};

// Create HTTPS server
const server = https.createServer(options, requestHandler);

// Attach WebSocket server for live editing
const wss = new WebSocket.Server({ server, path: '/live' });

wss.on('connection', (ws) => {
    console.log('Live editor connected');

    ws.on('message', (msg) => {
        try {
            const data = JSON.parse(msg.toString());
            if (data.type === 'syncProject' && data.views) {
                console.log('Received project sync');
                handleProjectSync(data.views);
            }
        } catch (e) {
            console.error('Error handling WS message', e);
        }
    });

    ws.on('close', () => {
        console.log('Live editor disconnected');
    });
});

function handleProjectSync(views) {
    try {
        // Ensure output directory (current dir) has all files
        Object.keys(views).forEach((key) => {
            const view = views[key];
            if (!view || !view.filename) return;
            const html = generateHTMLForView(view);
            fs.writeFileSync(path.join(process.cwd(), view.filename), html, 'utf8');
        });

        fs.writeFileSync(path.join(process.cwd(), 'panel.css'), cssContent, 'utf8');
        fs.writeFileSync(path.join(process.cwd(), 'viewer.js'), jsContent, 'utf8');
        fs.writeFileSync(path.join(process.cwd(), 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

        // Persist full project state so the builder can load it on startup
        fs.writeFileSync(
            path.join(process.cwd(), 'project.json'),
            JSON.stringify({ views }, null, 2),
            'utf8'
        );

        console.log('Project written to disk from live editor');
    } catch (e) {
        console.error('Error writing project to disk', e);
    }
}

server.listen(PORT, () => {
    console.log(\`HTTPS Server running at https://localhost:\${PORT}/\`);
    console.log('WebSocket live channel at wss://localhost:' + PORT + '/live');
    console.log('To test in Twitch Console:');
    console.log('1. Set "Testing Base URI" to https://localhost:' + PORT + '/');
    console.log('2. Open https://localhost:' + PORT + '/ in a browser tab and accept the "Not Secure" warning (because it is self-signed).');
});
                `;

                const readme = `
# Local Twitch Extension Server (HTTPS + Live Sync)

This server uses auto-generated self-signed certificates to run locally over HTTPS and exposes a WebSocket channel for live-syncing files from the visual builder.

## Setup
1. Unzip all files.
2. Install Node.js (https://nodejs.org/).
3. Install dependencies: \`npm install ws\`
4. Open a terminal in this folder.
5. Run: \`node server.js\`

## Live Sync
- The web-based builder connects to \`wss://localhost:8080/live\` and sends your project structure in real time.
- The server rewrites \`panel.html\`, \`mobile.html\`, \`video_component.html\`, \`video_overlay.html\`, \`config.html\`, \`panel.css\`, \`viewer.js\`, and \`manifest.json\` on each sync.
- This lets you refresh your local Twitch Extension and see changes immediately.

## Important
- **Browser Warning**: When you first visit \`https://localhost:8080\`, your browser will warn you that the connection is not secure. This is normal because the certificate is self-generated. You must click "Advanced" -> "Proceed to localhost" (or similar) to allow the assets to load.
- **Twitch Console**: Set your Extension's "Testing Base URI" to \`https://localhost:8080/\`.
                `;

                zip.file("server.js", serverJs);
                zip.file("README.md", readme);

                const content = await zip.generateAsync({ type: "blob" });
                saveAs(content, "server.zip");

            } catch (e) {
                console.error(e);
                alert("Error generating server: " + e.message);
            } finally {
                btnServer.innerHTML = originalText;
                btnServer.disabled = false;
            }
        }, 50); // Small delay to let UI render the spinner
    });
}

function generateSSLCert() {
    // Generate a self-signed cert for localhost using node-forge
    const keys = forge.pki.rsa.generateKeyPair(2048);
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = '01';
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1); // 1 year validity

    const attrs = [
        { name: 'commonName', value: 'localhost' },
        { name: 'countryName', value: 'US' },
        { shortName: 'ST', value: 'Local' },
        { name: 'localityName', value: 'TwitchDev' },
        { name: 'organizationName', value: 'Twitch Extension Builder' },
        { shortName: 'OU', value: 'Dev' }
    ];

    cert.setSubject(attrs);
    cert.setIssuer(attrs);

    // Extensions
    cert.setExtensions([
        { name: 'basicConstraints', cA: true },
        { name: 'keyUsage', keyCertSign: true, digitalSignature: true, nonRepudiation: true, keyEncipherment: true, dataEncipherment: true },
        { name: 'extKeyUsage', serverAuth: true, clientAuth: true, codeSigning: true, emailProtection: true, timeStamping: true },
        { name: 'subjectAltName', altNames: [{ type: 2, value: 'localhost' }] }
    ]);

    // Sign
    cert.sign(keys.privateKey, forge.md.sha256.create());

    return {
        key: forge.pki.privateKeyToPem(keys.privateKey),
        cert: forge.pki.certificateToPem(cert)
    };
}