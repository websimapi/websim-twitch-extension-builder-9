import { appState } from './state.js';
import { snapToGrid, notifyProjectChanged } from './utils.js';
import { applyWrapperLayout, updateAlignmentGuides, applySnap, hideAlignmentGuides } from './layout.js';

export function addResizeHandles(wrapper) {
    if (wrapper.querySelector('.resize-handle')) return;
    const positions = ['nw', 'ne', 'sw', 'se'];
    positions.forEach(pos => {
        const handle = document.createElement('div');
        handle.className = `resize-handle resize-${pos}`;
        handle.dataset.dir = pos;
        wrapper.appendChild(handle);
    });
}

export function addDragAndResizeHandlers(wrapper, canvas) {
    let isDragging = false;
    let isResizing = false;
    let dragStart = { x: 0, y: 0, left: 0, top: 0 };
    let resizeStart = { x: 0, y: 0, width: 0, height: 0, left: 0, top: 0, dir: '' };

    const onMouseMove = (e) => {
        if (!isDragging && !isResizing) return;
        if (e.touches && e.touches.length) e.preventDefault();

        const rect = canvas.getBoundingClientRect();
        const props = JSON.parse(wrapper.dataset.props);
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        if (isDragging) {
            let dx = clientX - dragStart.x;
            let dy = clientY - dragStart.y;
            let newLeft = Math.max(0, Math.min(dragStart.left + dx, rect.width - wrapper.offsetWidth));
            let newTop = Math.max(0, Math.min(dragStart.top + dy, rect.height - wrapper.offsetHeight));

            props.x = snapToGrid(newLeft);
            props.y = snapToGrid(newTop);
            wrapper.dataset.props = JSON.stringify(props);
            applyWrapperLayout(wrapper, props);
            updateAlignmentGuides(wrapper, canvas);
        } else if (isResizing) {
            let dx = clientX - resizeStart.x;
            let dy = clientY - resizeStart.y;
            let newWidth = resizeStart.width;
            let newHeight = resizeStart.height;
            let newLeft = resizeStart.left;
            let newTop = resizeStart.top;
            const dir = resizeStart.dir;

            if (dir.includes('e')) newWidth += dx;
            if (dir.includes('s')) newHeight += dy;
            if (dir.includes('w')) { newWidth -= dx; newLeft += dx; }
            if (dir.includes('n')) { newHeight -= dy; newTop += dy; }

            newWidth = Math.max(40, newWidth);
            newHeight = Math.max(24, newHeight);
            newLeft = Math.max(0, Math.min(newLeft, rect.width - newWidth));
            newTop = Math.max(0, Math.min(newTop, rect.height - newHeight));

            props.x = snapToGrid(newLeft);
            props.y = snapToGrid(newTop);
            props.width = snapToGrid(newWidth);
            props.height = snapToGrid(newHeight);

            wrapper.dataset.props = JSON.stringify(props);
            applyWrapperLayout(wrapper, props);
            updateAlignmentGuides(wrapper, canvas);
        }
    };

    const endInteraction = () => {
        if (isDragging || isResizing) {
            isDragging = false;
            isResizing = false;
            applySnap(wrapper, canvas);
            hideAlignmentGuides();
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('touchmove', onMouseMove);
            document.removeEventListener('mouseup', endInteraction);
            document.removeEventListener('touchend', endInteraction);
            notifyProjectChanged();
        }
    };

    wrapper.addEventListener('mousedown', (e) => {
        if (appState.currentMode !== 'move' || e.button !== 0 || e.target.classList.contains('resize-handle')) return;
        e.preventDefault();
        const rect = wrapper.getBoundingClientRect();
        const canvasRect = canvas.getBoundingClientRect();
        isDragging = true;
        dragStart = { x: e.clientX, y: e.clientY, left: rect.left - canvasRect.left, top: rect.top - canvasRect.top };
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', endInteraction);
    });

    wrapper.addEventListener('touchstart', (e) => {
        if (appState.currentMode !== 'move' || e.target.classList.contains('resize-handle')) return;
        const touch = e.touches[0];
        const rect = wrapper.getBoundingClientRect();
        const canvasRect = canvas.getBoundingClientRect();
        isDragging = true;
        dragStart = { x: touch.clientX, y: touch.clientY, left: rect.left - canvasRect.left, top: rect.top - canvasRect.top };
        document.addEventListener('touchmove', onMouseMove, { passive: false });
        document.addEventListener('touchend', endInteraction);
    }, { passive: true });

    wrapper.querySelectorAll('.resize-handle').forEach(handle => {
        const onStart = (cx, cy) => {
            const rect = wrapper.getBoundingClientRect();
            const canvasRect = canvas.getBoundingClientRect();
            isResizing = true;
            resizeStart = { x: cx, y: cy, width: rect.width, height: rect.height, left: rect.left - canvasRect.left, top: rect.top - canvasRect.top, dir: handle.dataset.dir };
        };

        handle.addEventListener('mousedown', (e) => {
            if (appState.currentMode !== 'move' || e.button !== 0) return;
            e.stopPropagation(); e.preventDefault();
            onStart(e.clientX, e.clientY);
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', endInteraction);
        });

        handle.addEventListener('touchstart', (e) => {
            if (appState.currentMode !== 'move') return;
            e.stopPropagation();
            onStart(e.touches[0].clientX, e.touches[0].clientY);
            document.addEventListener('touchmove', onMouseMove, { passive: false });
            document.addEventListener('touchend', endInteraction);
        }, { passive: true });
    });
}