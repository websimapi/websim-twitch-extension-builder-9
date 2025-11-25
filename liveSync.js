// Simple live-sync client that pushes the current project views
// to the local Node.js server over a WebSocket connection.

let socket = null;
let reconnectTimeout = null;

export function setupLiveSync({ getViewsSnapshot, onStatusChange, onInitialProjectLoaded }) {
    function setStatus(state) {
        if (typeof onStatusChange === 'function') {
            onStatusChange(state);
        }
    }

    function scheduleReconnect() {
        if (reconnectTimeout) clearTimeout(reconnectTimeout);
        reconnectTimeout = setTimeout(() => {
            connect();
        }, 3000);
    }

    function sendSnapshot() {
        if (!socket || socket.readyState !== WebSocket.OPEN) return;
        try {
            const views = getViewsSnapshot();
            socket.send(JSON.stringify({ type: 'syncProject', views }));
        } catch (e) {
            console.error('[LiveSync] Error collecting/sending views', e);
        }
    }

    async function loadInitialProject() {
        const isHttps = window.location.protocol === 'https:';
        const protocol = isHttps ? 'https' : 'http';
        const host = 'localhost:8080';
        const url = `${protocol}://${host}/project.json`;

        try {
            const res = await fetch(url, { cache: 'no-store' });
            if (!res.ok) {
                console.log('[LiveSync] No existing project.json on server');
                return;
            }
            const data = await res.json();
            if (typeof onInitialProjectLoaded === 'function') {
                onInitialProjectLoaded(data);
            }
            console.log('[LiveSync] Loaded initial project from server');
        } catch (e) {
            console.log('[LiveSync] Could not load initial project from server', e);
        }
    }

    function connect() {
        // Only attempt to connect to localhost; if blocked, we just no-op.
        const isHttps = window.location.protocol === 'https:';
        const protocol = isHttps ? 'wss' : 'ws';
        const host = 'localhost:8080';
        const url = `${protocol}://${host}/live`;

        try {
            setStatus('connecting');
            socket = new WebSocket(url);

            socket.addEventListener('open', () => {
                console.log('[LiveSync] Connected to', url);
                setStatus('connected');

                // Send an immediate snapshot on connect
                sendSnapshot();
            });

            socket.addEventListener('close', () => {
                console.log('[LiveSync] Disconnected from server');
                setStatus('disconnected');
                scheduleReconnect();
            });

            socket.addEventListener('error', (err) => {
                console.error('[LiveSync] WebSocket error', err);
                setStatus('error');
                try {
                    socket.close();
                } catch (_) {}
            });

            socket.addEventListener('message', (event) => {
                // Reserved for future use (e.g., server->client notifications)
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'fileUpdated') {
                        console.log('[LiveSync] File updated on server:', data.path);
                    }
                } catch {
                    // ignore non-JSON messages
                }
            });

            // Listen for change events from the builder and send updates on demand
            window.addEventListener('projectChanged', () => {
                sendSnapshot();
            });
        } catch (e) {
            console.error('[LiveSync] Failed to connect', e);
            setStatus('error');
            scheduleReconnect();
        }
    }

    // First try to pull the existing project from the server, then connect
    loadInitialProject().finally(() => {
        connect();
    });
}