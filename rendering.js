import { appState, incrementId } from './state.js';
import { applyWrapperLayout } from './layout.js';
import { addResizeHandles, addDragAndResizeHandlers } from './interactions.js';
import { notifyProjectChanged } from './utils.js';

export function getDefaultData(type) {
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
    wrapper.innerHTML = '';
    let content;
    switch(type) {
        case 'text':
            content = document.createElement('div');
            content.className = 'teb-text';
            content.textContent = data.text;
            Object.assign(content.style, { color: data.color, fontSize: data.size, textAlign: data.align });
            break;
        case 'button':
            content = document.createElement('button');
            content.className = 'teb-btn';
            content.textContent = data.label;
            Object.assign(content.style, { backgroundColor: data.bgColor, color: data.color });
            break;
        case 'container':
            content = document.createElement('div');
            content.className = 'teb-container';
            Object.assign(content.style, { backgroundColor: data.bgColor, padding: data.padding, borderRadius: data.radius, color: '#adadb8', fontSize: '13px', textAlign: 'center', border: '1px dashed #444' });
            content.textContent = 'Container Area';
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
            Object.assign(content.style, { backgroundColor: data.color, marginTop: data.margin, marginBottom: data.margin });
            break;
    }
    if (content) wrapper.appendChild(content);
    addResizeHandles(wrapper);
}

export function renderElementToCanvas(type, props, canvas, onEdit) {
    const id = `el-${incrementId()}`;
    const wrapper = document.createElement('div');
    wrapper.className = 'element-wrapper';
    wrapper.dataset.id = id;
    wrapper.dataset.type = type;

    let p = { ...props };
    if (typeof p.x !== 'number' || typeof p.y !== 'number') {
        const canvasRect = canvas.getBoundingClientRect();
        // Stack at bottom if no pos
        const elements = Array.from(canvas.querySelectorAll('.element-wrapper'));
        let bottomY = 0;
        if (elements.length > 0) {
             bottomY = elements.reduce((max, el) => Math.max(max, el.getBoundingClientRect().bottom), canvasRect.top) - canvasRect.top;
        }
        p.x = 0;
        p.y = bottomY;
    }
    if (typeof p.width !== 'number') p.width = canvas.clientWidth;

    wrapper.dataset.props = JSON.stringify(p);
    applyWrapperLayout(wrapper, p);
    renderElementContent(wrapper, type, p);

    if (appState.currentMode === 'interact') wrapper.classList.add('interact-mode');

    wrapper.addEventListener('click', (e) => {
        if (e.target.classList.contains('resize-handle')) return;
        if (appState.currentMode === 'edit') {
            e.stopPropagation();
            if (onEdit) onEdit(wrapper);
        }
    });

    addDragAndResizeHandlers(wrapper, canvas);
    canvas.appendChild(wrapper);
}

export function addElement(type, canvas, onEdit) {
    const es = canvas.querySelector('.empty-state');
    if (es) es.style.display = 'none';
    const data = getDefaultData(type);
    renderElementToCanvas(type, data, canvas, onEdit);
    notifyProjectChanged();
}

