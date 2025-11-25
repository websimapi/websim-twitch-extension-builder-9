import { scrollBehaviourDragImageTranslateOverride } from 'mobile-drag-drop/scroll-behaviour';
import { polyfill } from 'mobile-drag-drop';
import { setupExport } from './exportExtension.js';
import { setupServerDownload } from './serverDownload.js';
import { setupLiveSync } from './liveSync.js';

// Initialize drag and drop polyfill for mobile
polyfill({
    dragImageTranslateOverride: scrollBehaviourDragImageTranslateOverride
});

// State
let currentSelection = null;
let nextId = 1;

// View State Management
export const views = {
    panel: { id: 'panel', label: 'Panel', filename: 'panel.html', type: 'panel', elements: [], height: 300 },
    mobile: { id: 'mobile', label: 'Mobile', filename: 'mobile.html', type: 'mobile', elements: [] },
    component: { id: 'component', label: 'Video Component', filename: 'video_component.html', type: 'component', elements: [] },
    overlay: { id: 'overlay', label: 'Video Overlay', filename: 'video_overlay.html', type: 'video_overlay', elements: [] },
    config: { id: 'config', label: 'Config', filename: 'config.html', type: 'config', elements: [] }
};
export let currentView = 'panel';

// DOM Elements
const canvas = document.getElementById('panel-canvas');
const modal = document.getElementById('property-modal');
const propertyForm = document.getElementById('property-form');
const btnCloseModal = document.getElementById('close-modal');
const btnSaveProps = document.getElementById('save-properties');
const btnDeleteElem = document.getElementById('delete-element');
const btnExport = document.getElementById('btn-export-extension');
const btnServer = document.getElementById('btn-download-server');
const emptyState = canvas.querySelector('.empty-state');
const liveStatusEl = document.getElementById('live-status');
const panelHeightControl = document.getElementById('panel-height-control');
const panelHeightButtons = panelHeightControl ? panelHeightControl.querySelectorAll('.panel-height-btn') : [];
const panelHeightCustomInput = document.getElementById('panel-height-custom-input');

// --- Live status UI ---

function setLiveStatus(state) {
    if (!liveStatusEl) return;
    liveStatusEl.classList.remove('connecting', 'connected', 'disconnected');
    liveStatusEl.classList.add(state);

    const labelEl = liveStatusEl.querySelector('.label');
    if (!labelEl) return;

    if (state === 'connecting') {
        labelEl.textContent = 'Connecting…';
    } else if (state === 'connected') {
        labelEl.textContent = 'Live';
    } else {
        labelEl.textContent = 'Offline';
    }
}

// Apply initial panel height to canvas and height control
if (panelHeightControl) {
    const initialHeight = views.panel.height || 300;
    canvas.style.height = `${initialHeight}px`;

    // Set active preset button or custom value
    let matchedPreset = false;
    panelHeightButtons.forEach(btn => {
        const btnHeight = parseInt(btn.dataset.height, 10);
        if (btnHeight === initialHeight) {
            btn.classList.add('active');
            matchedPreset = true;
        } else {
            btn.classList.remove('active');
        }
    });

    if (!matchedPreset && panelHeightCustomInput) {
        panelHeightCustomInput.value = String(initialHeight);
    }
}

// Handle preset height button clicks
panelHeightButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const value = parseInt(btn.dataset.height, 10);
        const clamped = Math.min(500, Math.max(100, isNaN(value) ? 300 : value));
        views.panel.height = clamped;
        if (currentView === 'panel') {
            canvas.style.height = `${clamped}px`;
        }

        // Update active state
        panelHeightButtons.forEach(b => b.classList.toggle('active', b === btn));

        // Clear custom input since a preset is chosen
        if (panelHeightCustomInput) {
            panelHeightCustomInput.value = '';
        }

        // Notify live sync because this affects the panel view
        notifyProjectChanged();
    });
});

// Handle custom height input (on blur or Enter)
if (panelHeightCustomInput) {
    const applyCustomHeight = () => {
        const raw = parseInt(panelHeightCustomInput.value, 10);
        if (isNaN(raw)) return;
        const clamped = Math.min(500, Math.max(100, raw));
        views.panel.height = clamped;
        panelHeightCustomInput.value = String(clamped);

        if (currentView === 'panel') {
            canvas.style.height = `${clamped}px`;
        }

        // Deactivate preset buttons
        panelHeightButtons.forEach(b => b.classList.remove('active'));

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

// --- View Switching ---

document.querySelectorAll('.view-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        const viewId = tab.dataset.view;
        switchView(viewId);
    });
});

function switchView(viewId) {
    if (currentView === viewId) return;

    // 1. Save current view state from DOM
    saveCurrentViewState();

    // 2. Clear Selection
    if (currentSelection) {
        currentSelection = null;
        closeModal();
    }

    // 3. Update Active View
    currentView = viewId;

    // 4. Update UI Tabs
    document.querySelectorAll('.view-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.view === viewId);
    });

    // 5. Update Canvas Mode
    updateCanvasMode(viewId);

    // 6. Restore Elements to DOM
    renderCurrentView();
}

export function saveCurrentViewState() {
    const elements = [];
    const wrappers = canvas.querySelectorAll('.element-wrapper');
    wrappers.forEach(wrapper => {
        elements.push({
            type: wrapper.dataset.type,
            props: JSON.parse(wrapper.dataset.props)
        });
    });
    views[currentView].elements = elements;
}

function renderCurrentView() {
    // Clear Canvas
    canvas.innerHTML = '<div class="empty-state">Drag items here</div>';
    // Re-select empty state since we overwrote innerHTML
    const newEmptyState = canvas.querySelector('.empty-state');
    
    const elements = views[currentView].elements;

    if (elements && elements.length > 0) {
        newEmptyState.style.display = 'none';
        elements.forEach(el => {
            renderElementToCanvas(el.type, el.props);
        });
    } else {
        newEmptyState.style.display = 'block';
    }
}

// Utility: snap to grid for cleaner alignment
function snapToGrid(value, grid = 5) {
    return Math.round(value / grid) * grid;
}

function updateCanvasMode(viewId) {
    // Reset classes
    canvas.className = 'twitch-panel';
    // Reset explicit height; we'll reapply for panel view
    canvas.style.height = '';

    // Toggle panel height control visibility
    if (panelHeightControl) {
        if (viewId === 'panel') {
            panelHeightControl.classList.remove('hidden');
        } else {
            panelHeightControl.classList.add('hidden');
        }
    }
    
    switch(viewId) {
        case 'panel':
            // Apply saved panel height (100–500px)
            {
                const h = views.panel.height || 300;
                canvas.style.height = `${h}px`;
            }
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

// --- Drag and Drop Logic ---

// Toolbox items
document.querySelectorAll('.tool-item').forEach(item => {
    item.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('type', item.dataset.type);
        e.dataTransfer.effectAllowed = 'copy';
    });
});

// Canvas Drop Zone
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
        addElement(type);
    }
});

// --- Element Management ---

function addElement(type) {
    // Hide empty state if present
    const es = canvas.querySelector('.empty-state');
    if (es) es.style.display = 'none';

    // Get Defaults
    const data = getDefaultData(type);
    
    // Render
    renderElementToCanvas(type, data);

    // Notify live sync about the change
    notifyProjectChanged();
}

function renderElementToCanvas(type, props) {
    const id = `el-${nextId++}`;
    const wrapper = document.createElement('div');
    wrapper.className = 'element-wrapper';
    wrapper.dataset.id = id;
    wrapper.dataset.type = type;

    // Ensure layout props exist for draggable/resizable behavior
    // If no explicit x/y/width/height, fall back to simple stacked layout
    let p = { ...props };
    if (typeof p.x !== 'number' || typeof p.y !== 'number') {
        // stacked layout: place at bottom of canvas
        const canvasRect = canvas.getBoundingClientRect();
        const currentMaxBottom = Array.from(canvas.querySelectorAll('.element-wrapper'))
            .reduce((max, el) => {
                const r = el.getBoundingClientRect();
                return Math.max(max, r.bottom);
            }, canvasRect.top);
        const offsetY = currentMaxBottom - canvasRect.top;
        p.x = 0;
        p.y = offsetY;
    }
    if (typeof p.width !== 'number') {
        p.width = canvas.clientWidth;
    }
    if (typeof p.height !== 'number') {
        p.height = undefined; // let content define until resized
    }

    wrapper.dataset.props = JSON.stringify(p);

    // Apply layout
    applyWrapperLayout(wrapper, p);

    // Render Content
    renderElementContent(wrapper, type, p);

    // Add resize handles
    addResizeHandles(wrapper);

    // Click to edit (but ignore when clicking on resize handles)
    wrapper.addEventListener('click', (e) => {
        if (e.target.classList.contains('resize-handle')) return;
        e.stopPropagation();
        selectElement(wrapper);
    });

    // Drag & resize handlers
    addDragAndResizeHandlers(wrapper);

    canvas.appendChild(wrapper);
}

function applyWrapperLayout(wrapper, props) {
    wrapper.style.position = 'absolute';
    wrapper.style.left = props.x + 'px';
    wrapper.style.top = props.y + 'px';
    if (typeof props.width === 'number') {
        wrapper.style.width = props.width + 'px';
    } else {
        wrapper.style.width = 'auto';
    }
    if (typeof props.height === 'number') {
        wrapper.style.height = props.height + 'px';
    } else {
        wrapper.style.height = 'auto';
    }
}

function addResizeHandles(wrapper) {
    const positions = ['nw', 'ne', 'sw', 'se'];
    positions.forEach(pos => {
        const handle = document.createElement('div');
        handle.className = `resize-handle resize-${pos}`;
        handle.dataset.dir = pos;
        wrapper.appendChild(handle);
    });
}

function addDragAndResizeHandlers(wrapper) {
    let isDragging = false;
    let isResizing = false;
    let dragStart = { x: 0, y: 0, left: 0, top: 0 };
    let resizeStart = { x: 0, y: 0, width: 0, height: 0, left: 0, top: 0, dir: '' };

    const onMouseMove = (e) => {
        if (!isDragging && !isResizing) return;
        const rect = canvas.getBoundingClientRect();
        const props = JSON.parse(wrapper.dataset.props);

        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        if (isDragging) {
            let dx = clientX - dragStart.x;
            let dy = clientY - dragStart.y;
            let newLeft = dragStart.left + dx;
            let newTop = dragStart.top + dy;

            // constrain within canvas
            newLeft = Math.max(0, Math.min(newLeft, rect.width - wrapper.offsetWidth));
            newTop = Math.max(0, Math.min(newTop, rect.height - wrapper.offsetHeight));

            props.x = snapToGrid(newLeft);
            props.y = snapToGrid(newTop);
            wrapper.dataset.props = JSON.stringify(props);
            applyWrapperLayout(wrapper, props);
        } else if (isResizing) {
            let dx = clientX - resizeStart.x;
            let dy = clientY - resizeStart.y;

            let newWidth = resizeStart.width;
            let newHeight = resizeStart.height;
            let newLeft = resizeStart.left;
            let newTop = resizeStart.top;

            const dir = resizeStart.dir;

            if (dir.includes('e')) {
                newWidth = resizeStart.width + dx;
            }
            if (dir.includes('s')) {
                newHeight = resizeStart.height + dy;
            }
            if (dir.includes('w')) {
                newWidth = resizeStart.width - dx;
                newLeft = resizeStart.left + dx;
            }
            if (dir.includes('n')) {
                newHeight = resizeStart.height - dy;
                newTop = resizeStart.top + dy;
            }

            // minimum size
            newWidth = Math.max(40, newWidth);
            newHeight = Math.max(24, newHeight);

            // constrain within canvas
            newLeft = Math.max(0, Math.min(newLeft, rect.width - newWidth));
            newTop = Math.max(0, Math.min(newTop, rect.height - newHeight));

            props.x = snapToGrid(newLeft);
            props.y = snapToGrid(newTop);
            props.width = snapToGrid(newWidth);
            props.height = snapToGrid(newHeight);

            wrapper.dataset.props = JSON.stringify(props);
            applyWrapperLayout(wrapper, props);
        }
    };

    const endInteraction = () => {
        if (isDragging || isResizing) {
            isDragging = false;
            isResizing = false;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('touchmove', onMouseMove);
            document.removeEventListener('mouseup', endInteraction);
            document.removeEventListener('touchend', endInteraction);
            notifyProjectChanged();
        }
    };

    // Drag start
    wrapper.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('resize-handle')) return;
        e.preventDefault();
        const rect = wrapper.getBoundingClientRect();
        isDragging = true;
        dragStart.x = e.clientX;
        dragStart.y = e.clientY;
        dragStart.left = rect.left - canvas.getBoundingClientRect().left;
        dragStart.top = rect.top - canvas.getBoundingClientRect().top;

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', endInteraction);
    });

    wrapper.addEventListener('touchstart', (e) => {
        if (e.target.classList.contains('resize-handle')) return;
        const touch = e.touches[0];
        const rect = wrapper.getBoundingClientRect();
        isDragging = true;
        dragStart.x = touch.clientX;
        dragStart.y = touch.clientY;
        dragStart.left = rect.left - canvas.getBoundingClientRect().left;
        dragStart.top = rect.top - canvas.getBoundingClientRect().top;

        document.addEventListener('touchmove', onMouseMove, { passive: false });
        document.addEventListener('touchend', endInteraction);
    }, { passive: true });

    // Resize start
    wrapper.querySelectorAll('.resize-handle').forEach(handle => {
        handle.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            e.preventDefault();
            const rect = wrapper.getBoundingClientRect();
            isResizing = true;
            resizeStart.x = e.clientX;
            resizeStart.y = e.clientY;
            resizeStart.width = rect.width;
            resizeStart.height = rect.height;
            resizeStart.left = rect.left - canvas.getBoundingClientRect().left;
            resizeStart.top = rect.top - canvas.getBoundingClientRect().top;
            resizeStart.dir = handle.dataset.dir;

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', endInteraction);
        });

        handle.addEventListener('touchstart', (e) => {
            e.stopPropagation();
            const touch = e.touches[0];
            const rect = wrapper.getBoundingClientRect();
            isResizing = true;
            resizeStart.x = touch.clientX;
            resizeStart.y = touch.clientY;
            resizeStart.width = rect.width;
            resizeStart.height = rect.height;
            resizeStart.left = rect.left - canvas.getBoundingClientRect().left;
            resizeStart.top = rect.top - canvas.getBoundingClientRect().top;
            resizeStart.dir = handle.dataset.dir;

            document.addEventListener('touchmove', onMouseMove, { passive: false });
            document.addEventListener('touchend', endInteraction);
        }, { passive: true });
    });
}

function getDefaultData(type) {
    switch(type) {
        case 'text': return { text: 'Hello Twitch!', color: '#efeff1', size: '16px', align: 'left' };
        case 'button': return { label: 'Click Me', bgColor: '#9146FF', color: '#ffffff' };
        case 'container': return { bgColor: '#26262c', padding: '10px', radius: '4px' };
        case 'image': return { src: 'https://placehold.co/300x150/9146FF/white?text=Image', alt: 'Placeholder' };
        case 'divider': return { color: '#3a3a3a', margin: '10px' };
        default: return {};
    }
}

export function renderElementContent(wrapper, type, data) {
    wrapper.innerHTML = ''; // Clear previous

    let content;
    switch(type) {
        case 'text':
            content = document.createElement('div');
            content.className = 'teb-text';
            content.textContent = data.text;
            content.style.color = data.color;
            content.style.fontSize = data.size;
            content.style.textAlign = data.align;
            break;
        case 'button':
            content = document.createElement('button');
            content.className = 'teb-btn';
            content.textContent = data.label;
            content.style.backgroundColor = data.bgColor;
            content.style.color = data.color;
            break;
        case 'container':
            content = document.createElement('div');
            content.className = 'teb-container';
            content.style.backgroundColor = data.bgColor;
            content.style.padding = data.padding;
            content.style.borderRadius = data.radius;
            content.textContent = 'Container Area';
            content.style.color = '#aaa';
            content.style.fontSize = '0.8rem';
            content.style.textAlign = 'center';
            content.style.border = '1px dashed #444';
            break;
        case 'image':
            content = document.createElement('img');
            content.className = 'teb-image';
            content.src = data.src;
            content.alt = data.alt;
            break;
        case 'divider':
            content = document.createElement('div');
            content.className = 'teb-divider';
            content.style.backgroundColor = data.color;
            content.style.marginTop = data.margin;
            content.style.marginBottom = data.margin;
            break;
    }

    if (content) wrapper.appendChild(content);

    // Ensure resize handles exist after rerender
    addResizeHandles(wrapper);
}

function selectElement(wrapper) {
    if (currentSelection) {
        currentSelection.classList.remove('selected');
    }
    currentSelection = wrapper;
    wrapper.classList.add('selected');
    openModal();
}

// --- Modal & Properties ---

function openModal() {
    if (!currentSelection) return;

    const type = currentSelection.dataset.type;
    const props = JSON.parse(currentSelection.dataset.props);

    propertyForm.innerHTML = ''; // Clear

    // Build Form based on type
    if (type === 'text') {
        addInput(propertyForm, 'Text', 'text', props.text);
        addInput(propertyForm, 'Color', 'color', props.color);
        addSelect(propertyForm, 'Size', 'size', props.size, ['12px', '14px', '16px', '20px', '24px']);
        addSelect(propertyForm, 'Align', 'align', props.align, ['left', 'center', 'right']);
    } else if (type === 'button') {
        addInput(propertyForm, 'Label', 'label', props.label);
        addInput(propertyForm, 'Background', 'bgColor', props.bgColor, 'color');
        addInput(propertyForm, 'Text Color', 'color', props.color, 'color');
    } else if (type === 'container') {
        addInput(propertyForm, 'Background', 'bgColor', props.bgColor, 'color');
        addInput(propertyForm, 'Padding', 'padding', props.padding);
        addInput(propertyForm, 'Border Radius', 'radius', props.radius);
    } else if (type === 'image') {
        addInput(propertyForm, 'Image URL', 'src', props.src);
        addInput(propertyForm, 'Alt Text', 'alt', props.alt);
    } else if (type === 'divider') {
        addInput(propertyForm, 'Color', 'color', props.color, 'color');
        addInput(propertyForm, 'Margin', 'margin', props.margin);
    }

    modal.classList.remove('hidden');
}

function addInput(parent, label, key, value, type = 'text') {
    const group = document.createElement('div');
    group.className = 'form-group';
    group.innerHTML = `<label>${label}</label>`;

    const input = document.createElement('input');
    input.type = type;
    input.value = value;
    input.dataset.key = key;

    group.appendChild(input);
    parent.appendChild(group);
}

function addSelect(parent, label, key, value, options) {
    const group = document.createElement('div');
    group.className = 'form-group';
    group.innerHTML = `<label>${label}</label>`;

    const select = document.createElement('select');
    select.dataset.key = key;
    options.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt;
        option.textContent = opt;
        if (opt === value) option.selected = true;
        select.appendChild(option);
    });

    group.appendChild(select);
    parent.appendChild(group);
}

function closeModal() {
    modal.classList.add('hidden');
}

btnSaveProps.addEventListener('click', () => {
    if (!currentSelection) return;

    const inputs = propertyForm.querySelectorAll('input, select');
    const newProps = {};

    inputs.forEach(input => {
        newProps[input.dataset.key] = input.value;
    });

    // Merge with existing layout props (x,y,width,height)
    const existing = JSON.parse(currentSelection.dataset.props || '{}');
    const merged = {
        ...existing,
        ...newProps
    };

    currentSelection.dataset.props = JSON.stringify(merged);
    applyWrapperLayout(currentSelection, merged);
    renderElementContent(currentSelection, currentSelection.dataset.type, merged);
    closeModal();

    // Notify live sync about the change
    notifyProjectChanged();
});

btnDeleteElem.addEventListener('click', () => {
    if (currentSelection) {
        currentSelection.remove();
        currentSelection = null;
        closeModal();
        
        // Check if empty
        if (canvas.querySelectorAll('.element-wrapper').length === 0) {
             const es = canvas.querySelector('.empty-state');
             if (es) es.style.display = 'block';
        }

        // Notify live sync about the change
        notifyProjectChanged();
    }
});

btnCloseModal.addEventListener('click', closeModal);

// --- Export Extension ---
// removed inline export extension logic (moved to exportExtension.js)

// --- Server Download ---
// removed inline server download and SSL generation logic (moved to serverDownload.js)

// Helper to notify live sync that something changed
function notifyProjectChanged() {
    window.dispatchEvent(new Event('projectChanged'));
}

// Initialize modular features
setupExport({
    btnExport,
    views,
    saveCurrentViewState,
    renderElementContent
});

setupServerDownload({
    btnServer
});

// Live sync to local Node server (if running)
setupLiveSync({
    getViewsSnapshot: () => {
        // Always capture the latest DOM state before sending
        saveCurrentViewState();
        return views;
    },
    onStatusChange: (state) => {
        // state: 'connecting' | 'connected' | 'disconnected' | 'error'
        if (state === 'connecting') setLiveStatus('connecting');
        else if (state === 'connected') setLiveStatus('connected');
        else setLiveStatus('disconnected');
    },
    onInitialProjectLoaded: (serverProject) => {
        try {
            if (!serverProject || !serverProject.views) return;
            const serverViews = serverProject.views;

            // Merge server views into local state
            Object.keys(serverViews).forEach((key) => {
                if (!views[key]) return;
                const incoming = serverViews[key];
                views[key].elements = Array.isArray(incoming.elements) ? incoming.elements : [];
            });

            // After loading from server, ensure DOM reflects current view
            renderCurrentView();
        } catch (e) {
            console.error('Error applying initial project from server', e);
        }
    }
});