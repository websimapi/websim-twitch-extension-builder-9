import JSZip from 'jszip';
import saveAs from 'file-saver';
import { views } from './script.js';

export function setupExport({ btnExport, saveCurrentViewState, renderElementContent }) {
    btnExport.addEventListener('click', async () => {
        // Save current view state before exporting to ensure latest changes are captured
        saveCurrentViewState();

        const zip = new JSZip();

        // 1. Generate HTML for ALL views
        for (const key of Object.keys(views)) {
            const view = views[key];
            const htmlContent = generateHTMLForView(view, renderElementContent);
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
    display: flex;
    flex-direction: column;
    gap: 4px;
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
document.querySelectorAll('.teb-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        console.log('Button clicked:', btn.textContent);
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

function generateHTMLForView(view, renderElementContent) {
    // Generate elements HTML
    const elementsHTML = view.elements.map(el => {
        const tempWrapper = document.createElement('div');
        renderElementContent(tempWrapper, el.type, el.props);
        return tempWrapper.innerHTML;
    }).join('\n');

    // Special styles for overlay/component (Transparency)
    let extraStyle = '';
    if (view.type === 'video_overlay' || view.type === 'component') {
        extraStyle = '<style>body { background-color: transparent !important; }</style>';
    }

    return `<!DOCTYPE html>
<html>
<head>
    <title>${view.label}</title>
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