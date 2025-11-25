import JSZip from 'jszip';
import saveAs from 'file-saver';
import { views } from './script.js';

export function setupExport({ btnExport, saveCurrentViewState }) {
    btnExport.addEventListener('click', async () => {
        // Save current view state before exporting to ensure latest changes are captured
        saveCurrentViewState();

        const zip = new JSZip();

        // 1. Generate HTML for ALL views
        for (const key of Object.keys(views)) {
            const view = views[key];
            const htmlContent = generateHTMLForView(view);
            zip.file(view.filename, htmlContent);
        }

        // 2. CSS (Shared)
        const cssContent = `
body {
    background-color: #0e0e10; /* Dark mode base */
    color: white;
    font-family: system-ui, sans-serif;
    margin: 0;
    padding: 10px;
    overflow-x: hidden;
}
#app {
    position: relative;
    width: 100%;
    min-height: 100px;
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
.teb-container { border-radius: 4px; }
        `;

        // 3. JS (Shared)
        const jsContent = `
window.twitch = window.Twitch.ext;

twitch.onContext((context) => {
    console.log('Context:', context);
});

twitch.onAuthorized((auth) => {
    console.log('Authorized:', auth);
});

// Add basic interactions
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.teb-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            console.log('Button clicked:', btn.textContent);
        });
    });
});
        `;

        // Derive panel height from current view settings (fallback to 300)
        const panelHeight = (views.panel && views.panel.height) ? views.panel.height : 300;

        // 4. Manifest
        const manifest = {
            "name": "My DragDrop Extension",
            "version": "0.0.1",
            "description": "Generated with Twitch Extension Builder",
            "author": "You",
            "views": {
                "panel": {
                    "viewer_url": "panel.html",
                    "height": panelHeight,
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

        zip.file("panel.css", cssContent);
        zip.file("viewer.js", jsContent);
        zip.file("manifest.json", JSON.stringify(manifest, null, 2));

        const content = await zip.generateAsync({ type: "blob" });
        saveAs(content, "extension.zip");
    });
}

function generateHTMLForView(view) {
    const elementsHTML = (view.elements || []).map(el => {
        const type = el.type;
        const data = el.props || {};
        const layout = getLayoutStyle(data);

        let inner = '';
        switch(type) {
            case 'text':
                inner = `<div class="teb-text" style="color:${escapeAttr(data.color)};font-size:${escapeAttr(data.size)};text-align:${escapeAttr(data.align)};">${escapeHtml(data.text || '')}</div>`;
                break;
            case 'button':
                inner = `<button class="teb-btn" style="background-color:${escapeAttr(data.bgColor)};color:${escapeAttr(data.color)};">${escapeHtml(data.label || '')}</button>`;
                break;
            case 'container':
                inner = `<div class="teb-container" style="background-color:${escapeAttr(data.bgColor)};padding:${escapeAttr(data.padding)};border-radius:${escapeAttr(data.radius)};color:#aaa;font-size:0.8rem;text-align:center;border:1px dashed #444;">Container Area</div>`;
                break;
            case 'image':
                inner = `<img class="teb-image" src="${escapeAttr(data.src || '')}" alt="${escapeAttr(data.alt || '')}" />`;
                break;
            case 'divider':
                inner = `<div class="teb-divider" style="background-color:${escapeAttr(data.color)};margin:${escapeAttr(data.margin)} 0;"></div>`;
                break;
            default:
                inner = '';
        }

        if (!inner) return '';
        return `<div class="teb-wrapper" style="${layout}">${inner}</div>`;
    }).join('\n');

    // Special styles for overlay/component (Transparency)
    let extraStyle = '';
    if (view.type === 'video_overlay' || view.type === 'component') {
        extraStyle = '<style>body { background-color: transparent !important; }</style>';
    }

    return `<!DOCTYPE html>
<html>
<head>
    <title>${escapeHtml(view.label || '')}</title>
    <link rel="stylesheet" href="panel.css">
    ${extraStyle}
</head>
<body>
    <div id="app">
${elementsHTML}
    </div>
    <script src="https://extension-files.twitch.tv/helper/v1/twitch-ext.min.js"></script>
    <script src="viewer.js"></script>
</body>
</html>`;
}

function getLayoutStyle(data) {
    const x = typeof data.x === 'number' ? data.x : 0;
    const y = typeof data.y === 'number' ? data.y : 0;
    const w = typeof data.width === 'number' ? data.width : null;
    const h = typeof data.height === 'number' ? data.height : null;

    let style = `left:${x}px;top:${y}px;`;
    if (w !== null) style += `width:${w}px;`;
    if (h !== null) style += `height:${h}px;`;
    return style;
}

function escapeHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function escapeAttr(str) {
    return String(str || '').replace(/"/g, '&quot;');
}