import { appState, setCurrentSelection } from './state.js';
import { applyWrapperLayout } from './layout.js';
import { renderElementContent } from './rendering.js';
import { notifyProjectChanged } from './utils.js';

let modal, propertyForm, btnClose, btnSave, btnDelete;

export function setupPropertiesModal(modalEl, formEl, btnCloseEl, btnSaveEl, btnDeleteEl) {
    modal = modalEl;
    propertyForm = formEl;
    btnClose = btnCloseEl;
    btnSave = btnSaveEl;
    btnDelete = btnDeleteEl;

    btnClose.addEventListener('click', closeModal);
    btnSave.addEventListener('click', saveProperties);
    btnDelete.addEventListener('click', deleteElement);
}

export function openModal(wrapper) {
    setCurrentSelection(wrapper);
    wrapper.classList.add('selected');
    
    // Deselect others
    document.querySelectorAll('.element-wrapper').forEach(el => {
        if (el !== wrapper) el.classList.remove('selected');
    });

    const type = wrapper.dataset.type;
    const props = JSON.parse(wrapper.dataset.props);
    propertyForm.innerHTML = '';

    if (type === 'text') {
        addInput('Text', 'text', props.text);
        addInput('Color', 'color', props.color, 'color');
        addSelect('Size', 'size', props.size, ['12px', '14px', '16px', '20px', '24px']);
        addSelect('Align', 'align', props.align, ['left', 'center', 'right']);
    } else if (type === 'button') {
        addInput('Label', 'label', props.label);
        addInput('Background', 'bgColor', props.bgColor, 'color');
        addInput('Text Color', 'color', props.color, 'color');
    } else if (type === 'container') {
        addInput('Background', 'bgColor', props.bgColor, 'color');
        addInput('Padding', 'padding', props.padding);
        addInput('Border Radius', 'radius', props.radius);
    } else if (type === 'image') {
        addInput('Image URL', 'src', props.src);
        addInput('Alt Text', 'alt', props.alt);
    } else if (type === 'divider') {
        addInput('Color', 'color', props.color, 'color');
        addInput('Margin', 'margin', props.margin);
    }

    modal.classList.remove('hidden');
}

export function closeModal() {
    if (modal) modal.classList.add('hidden');
}

function saveProperties() {
    const sel = appState.currentSelection;
    if (!sel) return;

    const inputs = propertyForm.querySelectorAll('input, select');
    const newProps = {};
    inputs.forEach(input => newProps[input.dataset.key] = input.value);

    const existing = JSON.parse(sel.dataset.props || '{}');
    const merged = { ...existing, ...newProps };

    sel.dataset.props = JSON.stringify(merged);
    applyWrapperLayout(sel, merged);
    renderElementContent(sel, sel.dataset.type, merged);
    closeModal();
    notifyProjectChanged();
}

function deleteElement() {
    const sel = appState.currentSelection;
    if (sel) {
        sel.remove();
        setCurrentSelection(null);
        closeModal();
        const canvas = document.getElementById('panel-canvas');
        if (canvas && canvas.querySelectorAll('.element-wrapper').length === 0) {
            const es = canvas.querySelector('.empty-state');
            if (es) es.style.display = 'block';
        }
        notifyProjectChanged();
    }
}

function addInput(label, key, value, type = 'text') {
    const group = document.createElement('div');
    group.className = 'form-group';
    group.innerHTML = `<label>${label}</label>`;
    const input = document.createElement('input');
    input.type = type;
    input.value = value;
    input.dataset.key = key;
    group.appendChild(input);
    propertyForm.appendChild(group);
}

function addSelect(label, key, value, options) {
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
    propertyForm.appendChild(group);
}