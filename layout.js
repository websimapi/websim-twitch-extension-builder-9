import { appState } from './state.js';
import { snapToGrid, rectsOverlap } from './utils.js';

let alignmentGuides = { v: null, h: null };

export function applyWrapperLayout(wrapper, props) {
    wrapper.style.position = 'absolute';
    wrapper.style.left = (typeof props.x === 'number' ? props.x : 0) + 'px';
    wrapper.style.top = (typeof props.y === 'number' ? props.y : 0) + 'px';
    wrapper.style.width = (typeof props.width === 'number') ? props.width + 'px' : 'auto';
    wrapper.style.height = (typeof props.height === 'number') ? props.height + 'px' : 'auto';
}

function getAlignmentGuide(canvas, axis) {
    if (axis === 'v') {
        if (!alignmentGuides.v || !alignmentGuides.v.parentNode) {
            const line = document.createElement('div');
            line.className = 'alignment-guide alignment-guide-vertical';
            canvas.appendChild(line);
            alignmentGuides.v = line;
        }
        return alignmentGuides.v;
    } else {
        if (!alignmentGuides.h || !alignmentGuides.h.parentNode) {
            const line = document.createElement('div');
            line.className = 'alignment-guide alignment-guide-horizontal';
            canvas.appendChild(line);
            alignmentGuides.h = line;
        }
        return alignmentGuides.h;
    }
}

export function hideAlignmentGuides() {
    if (alignmentGuides.v) alignmentGuides.v.style.display = 'none';
    if (alignmentGuides.h) alignmentGuides.h.style.display = 'none';
}

export function updateAlignmentGuides(wrapper, canvas) {
    const wrappers = Array.from(canvas.querySelectorAll('.element-wrapper')).filter(w => w !== wrapper);
    if (!wrappers.length) {
        hideAlignmentGuides();
        return;
    }

    const canvasRect = canvas.getBoundingClientRect();
    const rect = wrapper.getBoundingClientRect();
    const thisLeft = rect.left - canvasRect.left;
    const thisRight = thisLeft + rect.width;
    const thisTop = rect.top - canvasRect.top;
    const thisBottom = thisTop + rect.height;
    const thisCenterX = thisLeft + rect.width / 2;
    const thisCenterY = thisTop + rect.height / 2;

    const threshold = 5;
    let bestV = null;
    let bestH = null;

    wrappers.forEach(other => {
        const r = other.getBoundingClientRect();
        const oLeft = r.left - canvasRect.left;
        const oRight = oLeft + r.width;
        const oTop = r.top - canvasRect.top;
        const oBottom = oTop + r.height;
        const oCenterX = oLeft + r.width / 2;
        const oCenterY = oTop + r.height / 2;

        const candidatesV = [
            { x: oLeft, diff: Math.abs(thisLeft - oLeft) },
            { x: oRight, diff: Math.abs(thisRight - oRight) },
            { x: oCenterX, diff: Math.abs(thisCenterX - oCenterX) },
        ];
        candidatesV.forEach(c => {
            if (c.diff <= threshold && (!bestV || c.diff < bestV.diff)) {
                bestV = c;
            }
        });

        const candidatesH = [
            { y: oTop, diff: Math.abs(thisTop - oTop) },
            { y: oBottom, diff: Math.abs(thisBottom - oBottom) },
            { y: oCenterY, diff: Math.abs(thisCenterY - oCenterY) },
        ];
        candidatesH.forEach(c => {
            if (c.diff <= threshold && (!bestH || c.diff < bestH.diff)) {
                bestH = c;
            }
        });
    });

    if (bestV) {
        const line = getAlignmentGuide(canvas, 'v');
        line.style.display = 'block';
        line.style.left = `${bestV.x}px`;
    } else if (alignmentGuides.v) {
        alignmentGuides.v.style.display = 'none';
    }

    if (bestH) {
        const line = getAlignmentGuide(canvas, 'h');
        line.style.display = 'block';
        line.style.top = `${bestH.y}px`;
    } else if (alignmentGuides.h) {
        alignmentGuides.h.style.display = 'none';
    }
}

export function applySnap(wrapper, canvas) {
    if (appState.snapMode !== 'on') return;

    const rect = canvas.getBoundingClientRect();
    const props = JSON.parse(wrapper.dataset.props || '{}');
    const width = typeof props.width === 'number' ? props.width : wrapper.offsetWidth;
    const height = typeof props.height === 'number' ? props.height : wrapper.offsetHeight;
    let x = typeof props.x === 'number' ? props.x : 0;
    let y = typeof props.y === 'number' ? props.y : 0;

    const others = Array.from(canvas.querySelectorAll('.element-wrapper')).filter(w => w !== wrapper);
    const step = 5;
    let safety = 0;

    const makeRect = () => ({ left: x, top: y, right: x + width, bottom: y + height });
    const hasOverlap = () => {
        const r = makeRect();
        return others.some(w => {
            const wp = JSON.parse(w.dataset.props || '{}');
            const ww = typeof wp.width === 'number' ? wp.width : w.offsetWidth;
            const wh = typeof wp.height === 'number' ? wp.height : w.offsetHeight;
            const wx = typeof wp.x === 'number' ? wp.x : 0;
            const wy = typeof wp.y === 'number' ? wp.y : 0;
            const or = { left: wx, top: wy, right: wx + ww, bottom: wy + wh };
            return rectsOverlap(r, or);
        });
    };

    while (hasOverlap() && safety < 500) {
        y += step;
        if (y + height > rect.height) {
            y = 0;
            x += step;
            if (x + width > rect.width) x = rect.width - width;
        }
        safety++;
    }

    props.x = snapToGrid(x);
    props.y = snapToGrid(y);
    props.width = width;
    props.height = height;

    wrapper.dataset.props = JSON.stringify(props);
    applyWrapperLayout(wrapper, props);
}

