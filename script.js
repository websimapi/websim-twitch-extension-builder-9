import { scrollBehaviourDragImageTranslateOverride } from 'mobile-drag-drop/scroll-behaviour';
import { polyfill } from 'mobile-drag-drop';
import { setupExport } from './exportExtension.js';
import { setupServerDownload } from './serverDownload.js';
import { setupLiveSync } from './liveSync.js';
import { appState, views, setCurrentView, setCurrentSelection } from './state.js';
import { notifyProjectChanged } from './utils.js';
import { renderElementToCanvas, addElement } from './rendering.js';
import { setupPropertiesModal, openModal, closeModal } from './properties.js';

// Initialize drag and drop polyfill for mobile
polyfill({
    dragImageTranslateOverride: scrollBehaviourDragImageTranslateOverride
});

// DOM Elements
const canvas = document.getElementById('panel-canvas');
const panelHeightControl = document.getElementById('panel-height-control');

// Initialize Properties Modal
setupPropertiesModal(
    document.getElementById('property-modal'),
    document.getElementById('property-form'),
    document.getElementById('close-modal'),
    document.getElementById('save-properties'),
    document.getElementById('delete-element')
);

// --- View Switching ---

document.querySelectorAll('.view-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        const viewId = tab.dataset.view;
        if (appState.currentView === viewId) return;

        // Save current view state from DOM
        saveCurrentViewState();

        // Clear Selection
        if (appState.currentSelection) {
            setCurrentSelection(null);
            closeModal();
        }

        // Update Active View
        setCurrentView(viewId);
        document.querySelectorAll('.view-tab').forEach(t => {
            t.classList.toggle('active', t.dataset.view === viewId);
        });

        // Update Canvas Mode
        updateCanvasMode(viewId);

        // Restore Elements to DOM
        renderCurrentView();
    });
});

export function saveCurrentViewState() {
    const elements = [];
    const wrappers = canvas.querySelectorAll('.element-wrapper');
    wrappers.forEach(wrapper => {
        elements.push({
            type: wrapper.dataset.type,
            props: JSON.parse(wrapper.dataset.props)
        });
    });
    views[appState.currentView].elements = elements;
}

function renderCurrentView() {
    canvas.innerHTML = '<div class="empty-state">Drag items here</div>';
    const newEmptyState = canvas.querySelector('.empty-state');
    const elements = views[appState.currentView].elements;

    if (elements && elements.length > 0) {
        newEmptyState.style.display = 'none';
        elements.forEach(el => {
            renderElementToCanvas(el.type, el.props, canvas, openModal);
        });
    } else {
        newEmptyState.style.display = 'block';
    }
}

function updateCanvasMode(viewId) {
    canvas.className = 'twitch-panel';
    canvas.style.height = '';

    if (panelHeightControl) {
        panelHeightControl.classList.toggle('hidden', viewId !== 'panel');
    }
    
    switch(viewId) {
        case 'panel':
            canvas.style.height = `${views.panel.height || 300}px`;
            break;
        case 'mobile':
            break;
        case 'component':
            canvas.classList.add('component-mode');
            break;
        case 'overlay':
            canvas.classList.add('overlay-mode');
            break;
        case 'config':
            canvas.classList.add('config-mode');
            break;
    }
}

// --- Mode switching ---

document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        if (mode === appState.currentMode) return;
        appState.currentMode = mode;

        document.querySelectorAll('.mode-btn').forEach(b => b.classList.toggle('active', b === btn));

        canvas.querySelectorAll('.element-wrapper').forEach(wrapper => {
            if (appState.currentMode === 'interact') {
                wrapper.classList.add('interact-mode');
            } else {
                wrapper.classList.remove('interact-mode');
            }
        });
    });
});

// Snap / Free toggle
document.querySelectorAll('.snap-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const mode = btn.dataset.snap;
        appState.snapMode = mode;
        document.querySelectorAll('.snap-btn').forEach(b => b.classList.toggle('active', b === btn));
    });
});

// --- Panel Height Control ---

document.querySelectorAll('.panel-height-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const value = parseInt(btn.dataset.height, 10);
        const clamped = Math.min(500, Math.max(100, isNaN(value) ? 300 : value));
        views.panel.height = clamped;
        if (appState.currentView === 'panel') {
            canvas.style.height = `${clamped}px`;
        }

        document.querySelectorAll('.panel-height-btn').forEach(b => b.classList.toggle('active', b === btn));
        const customInput = document.getElementById('panel-height-custom-input');
        if (customInput) customInput.value = '';
        notifyProjectChanged();
    });
});

const panelHeightCustomInput = document.getElementById('panel-height-custom-input');
if (panelHeightCustomInput) {
    const applyCustomHeight = () => {
        const raw = parseInt(panelHeightCustomInput.value, 10);
        if (isNaN(raw)) return;
        const clamped = Math.min(500, Math.max(100, raw));
        views.panel.height = clamped;
        panelHeightCustomInput.value = String(clamped);

        if (appState.currentView === 'panel') {
            canvas.style.height = `${clamped}px`;
        }
        document.querySelectorAll('.panel-height-btn').forEach(b => b.classList.remove('active'));
        notifyProjectChanged();
    };

    panelHeightCustomInput.addEventListener('blur', applyCustomHeight);
    panelHeightCustomInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            applyCustomHeight();
            panelHeightCustomInput.blur();
        }
    });
}

// --- Drag and Drop Logic ---

document.querySelectorAll('.tool-item').forEach(item => {
    item.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('type', item.dataset.type);
        e.dataTransfer.effectAllowed = 'copy';
    });
});

canvas.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    canvas.classList.add('drag-over');
});

canvas.addEventListener('dragleave', () => {
    canvas.classList.remove('drag-over');
});

canvas.addEventListener('drop', (e) => {
    e.preventDefault();
    canvas.classList.remove('drag-over');
    const type = e.dataTransfer.getData('type');
    if (type) {
        addElement(type, canvas, openModal);
    }
});

// Initialize modular features
setupExport({
    btnExport: document.getElementById('btn-export-extension'),
    saveCurrentViewState
});

setupServerDownload({
    btnServer: document.getElementById('btn-download-server')
});

// Initial Height Setup
const initialHeight = views.panel.height || 300;
canvas.style.height = `${initialHeight}px`;

// Live sync
setupLiveSync({
    getViewsSnapshot: () => {
        saveCurrentViewState();
        return views;
    },
    onStatusChange: (state) => {
        const liveStatusEl = document.getElementById('live-status');
        if (!liveStatusEl) return;
        liveStatusEl.classList.remove('connecting', 'connected', 'disconnected');
        liveStatusEl.classList.add(state);
        const labelEl = liveStatusEl.querySelector('.label');
        if (labelEl) {
            labelEl.textContent = state === 'connecting' ? 'Connecting…' : (state === 'connected' ? 'Live' : 'Offline');
        }
    },
    onInitialProjectLoaded: (serverProject) => {
        try {
            if (!serverProject || !serverProject.views) return;
            const serverViews = serverProject.views;
            Object.keys(serverViews).forEach((key) => {
                if (!views[key]) return;
                const incoming = serverViews[key];
                views[key].elements = Array.isArray(incoming.elements) ? incoming.elements : [];
            });
            renderCurrentView();
        } catch (e) {
            console.error('Error applying initial project from server', e);
        }
    }
});