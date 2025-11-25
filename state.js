export const views = {
    panel: { id: 'panel', label: 'Panel', filename: 'panel.html', type: 'panel', elements: [], height: 300 },
    mobile: { id: 'mobile', label: 'Mobile', filename: 'mobile.html', type: 'mobile', elements: [] },
    component: { id: 'component', label: 'Video Component', filename: 'video_component.html', type: 'component', elements: [] },
    overlay: { id: 'overlay', label: 'Video Overlay', filename: 'video_overlay.html', type: 'video_overlay', elements: [] },
    config: { id: 'config', label: 'Config', filename: 'config.html', type: 'config', elements: [] }
};

export const appState = {
    currentView: 'panel',
    currentMode: 'move', // 'move' | 'interact' | 'edit'
    snapMode: 'on',
    currentSelection: null,
    nextId: 1
};

export function setCurrentView(viewId) {
    appState.currentView = viewId;
}

export function setCurrentSelection(el) {
    appState.currentSelection = el;
}

export function incrementId() {
    return appState.nextId++;
}