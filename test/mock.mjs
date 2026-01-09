/**
 * Mock implementations for browser globals used by pushi.js
 * These mocks allow testing in Node.js environment
 */

/**
 * Mock WebSocket implementation
 */
class MockWebSocket {
    constructor(url) {
        this.url = url;
        this.readyState = MockWebSocket.CONNECTING;
        this.subscriptions = [];
        this._callback = null;

        // simulate async connection
        setTimeout(() => {
            this.readyState = MockWebSocket.OPEN;
            if (this.onopen) {
                this.onopen();
            }
        }, 0);
    }

    send(data) {
        this._lastSent = data;
        if (this._onSend) {
            this._onSend(data);
        }
    }

    close() {
        this.readyState = MockWebSocket.CLOSED;
        if (this.onclose) {
            this.onclose();
        }
    }

    // simulate receiving a message
    _receive(data) {
        if (this.onmessage) {
            this.onmessage({ data: JSON.stringify(data) });
        }
    }
}

MockWebSocket.CONNECTING = 0;
MockWebSocket.OPEN = 1;
MockWebSocket.CLOSING = 2;
MockWebSocket.CLOSED = 3;

/**
 * Mock XMLHttpRequest implementation
 */
class MockXMLHttpRequest {
    constructor() {
        this.readyState = 0;
        this.status = 0;
        this.responseText = "";
        this.withCredentials = false;
        this._headers = {};
    }

    open(method, url, async) {
        this.method = method;
        this.url = url;
        this.async = async;
        this.readyState = 1;
    }

    setRequestHeader(name, value) {
        this._headers[name] = value;
    }

    send(data) {
        this._sentData = data;

        // simulate async response
        setTimeout(() => {
            this.readyState = 4;
            this.status = MockXMLHttpRequest._nextStatus || 200;
            this.responseText = MockXMLHttpRequest._nextResponse || "{}";
            if (this.onreadystatechange) {
                this.onreadystatechange();
            }
            // reset for next request
            MockXMLHttpRequest._nextStatus = null;
            MockXMLHttpRequest._nextResponse = null;
        }, 0);
    }

    static mockResponse(status, response) {
        MockXMLHttpRequest._nextStatus = status;
        MockXMLHttpRequest._nextResponse = typeof response === "string"
            ? response
            : JSON.stringify(response);
    }
}

/**
 * Mock window object
 */
const mockWindow = {
    atob: (str) => Buffer.from(str, "base64").toString("binary")
};

/**
 * Mock Notification API
 */
class MockNotification {
    static permission = "default";

    static requestPermission() {
        return Promise.resolve(MockNotification.permission);
    }
}

/**
 * Mock navigator with serviceWorker
 */
const mockNavigator = {
    serviceWorker: {
        register: () => Promise.resolve({
            pushManager: {
                getSubscription: () => Promise.resolve(null),
                subscribe: () => Promise.resolve({
                    endpoint: "https://mock.endpoint/subscription",
                    toJSON: () => ({
                        endpoint: "https://mock.endpoint/subscription",
                        keys: {
                            p256dh: "mock-p256dh-key",
                            auth: "mock-auth-key"
                        }
                    }),
                    unsubscribe: () => Promise.resolve(true)
                })
            }
        }),
        ready: Promise.resolve({
            pushManager: {
                getSubscription: () => Promise.resolve(null)
            }
        })
    }
};

// Store original values for cleanup
let originalNavigator;
let originalWindow;

/**
 * Setup global mocks
 */
function setupMocks() {
    global.WebSocket = MockWebSocket;
    global.XMLHttpRequest = MockXMLHttpRequest;
    global.Notification = MockNotification;

    // Store originals
    originalWindow = global.window;
    originalNavigator = global.navigator;

    // Use Object.defineProperty for read-only properties (Node 22+)
    try {
        global.window = mockWindow;
    } catch (_error) {
        Object.defineProperty(global, "window", {
            value: mockWindow,
            writable: true,
            configurable: true
        });
    }

    try {
        global.navigator = mockNavigator;
    } catch (_error) {
        Object.defineProperty(global, "navigator", {
            value: mockNavigator,
            writable: true,
            configurable: true
        });
    }
}

/**
 * Cleanup global mocks
 */
function cleanupMocks() {
    delete global.WebSocket;
    delete global.XMLHttpRequest;
    delete global.Notification;

    // Restore originals using defineProperty for read-only properties
    try {
        global.window = originalWindow;
    } catch (_error) {
        Object.defineProperty(global, "window", {
            value: originalWindow,
            writable: true,
            configurable: true
        });
    }

    try {
        global.navigator = originalNavigator;
    } catch (_error) {
        Object.defineProperty(global, "navigator", {
            value: originalNavigator,
            writable: true,
            configurable: true
        });
    }
}

export {
    MockWebSocket,
    MockXMLHttpRequest,
    MockNotification,
    mockWindow,
    mockNavigator,
    setupMocks,
    cleanupMocks
};
