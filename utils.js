export function snapToGrid(value, grid = 5) {
    return Math.round(value / grid) * grid;
}

export function rectsOverlap(a, b) {
    return !(
        a.right <= b.left ||
        a.left >= b.right ||
        a.bottom <= b.top ||
        a.top >= b.bottom
    );
}

export function notifyProjectChanged() {
    window.dispatchEvent(new Event('projectChanged'));
}

