import assert from "assert";
import { setupMocks, cleanupMocks, MockXMLHttpRequest } from "./mock.mjs";
import { Pushi } from "../pushi.mjs";

describe("Pushi", function() {
    let testId = 0;

    // generate unique app key for each test to avoid PUSHI_CONNECTIONS cache
    function uniqueKey(base = "test-key") {
        return `${base}-${++testId}-${Date.now()}`;
    }

    before(function() {
        setupMocks();
    });

    after(function() {
        cleanupMocks();
    });

    describe("#constructor()", function() {
        it("should initialize with app key and default options", function() {
            const key = uniqueKey("app-key");
            const pushi = new Pushi(key, {});

            assert.strictEqual(pushi.appKey, key);
            assert.strictEqual(pushi.state, "disconnected");
            assert.deepStrictEqual(pushi.channels, {});
        });

        it("should use provided base URL", function() {
            const key = uniqueKey("base-url");
            const pushi = new Pushi(key, {
                baseUrl: "wss://custom.server.com/"
            });

            assert.strictEqual(pushi.baseUrl, "wss://custom.server.com/");
            assert.strictEqual(pushi.url, `wss://custom.server.com/${key}`);
        });

        it("should use default base URL when not provided", function() {
            const key = uniqueKey("default-url");
            const pushi = new Pushi(key, {});

            assert.strictEqual(pushi.baseUrl, "wss://puxiapp.com/");
        });

        it("should store app credentials when provided", function() {
            const key = uniqueKey("credentials");
            const pushi = new Pushi(key, {
                appId: "my-app-id",
                appSecret: "my-secret"
            });

            assert.strictEqual(pushi.appId, "my-app-id");
            assert.strictEqual(pushi.appSecret, "my-secret");
        });
    });

    describe("#config()", function() {
        it("should update configuration values", function() {
            const key = uniqueKey("config-1");
            const newKey = uniqueKey("config-2");
            const pushi = new Pushi(key, {});
            pushi.config(newKey, {
                baseUrl: "wss://new.server.com/",
                timeout: 10000
            });

            assert.strictEqual(pushi.appKey, newKey);
            assert.strictEqual(pushi.baseUrl, "wss://new.server.com/");
            assert.strictEqual(pushi.timeout, 10000);
        });
    });

    describe("#isValid()", function() {
        it("should return true for matching app key and base URL", function() {
            const key = uniqueKey("valid");
            const pushi = new Pushi(key, {
                baseUrl: "wss://test.com/"
            });

            assert.strictEqual(pushi.isValid(key, "wss://test.com/"), true);
        });

        it("should return false for non-matching app key", function() {
            const key = uniqueKey("valid-key");
            const pushi = new Pushi(key, {
                baseUrl: "wss://test.com/"
            });

            assert.strictEqual(pushi.isValid("other-key", "wss://test.com/"), false);
        });

        it("should return false for non-matching base URL", function() {
            const key = uniqueKey("valid-url");
            const pushi = new Pushi(key, {
                baseUrl: "wss://test.com/"
            });

            assert.strictEqual(pushi.isValid(key, "wss://other.com/"), false);
        });
    });

    describe("#sendEvent()", function() {
        it("should send JSON message through socket", function(done) {
            const key = uniqueKey("send-event");
            const pushi = new Pushi(key, {});

            setTimeout(() => {
                pushi.socket._onSend = function(data) {
                    const parsed = JSON.parse(data);
                    assert.strictEqual(parsed.event, "test-event");
                    assert.strictEqual(parsed.data, "test-data");
                    assert.strictEqual(parsed.echo, false);
                    assert.strictEqual(parsed.persist, true);
                    done();
                };

                pushi.sendEvent("test-event", "test-data");
            }, 10);
        });

        it("should use provided echo and persist values", function(done) {
            const key = uniqueKey("echo-persist");
            const pushi = new Pushi(key, {});

            setTimeout(() => {
                pushi.socket._onSend = function(data) {
                    const parsed = JSON.parse(data);
                    assert.strictEqual(parsed.echo, true);
                    assert.strictEqual(parsed.persist, false);
                    done();
                };

                pushi.sendEvent("test-event", "test-data", true, false);
            }, 10);
        });
    });

    describe("#sendChannel()", function() {
        it("should send message with channel", function(done) {
            const key = uniqueKey("send-channel");
            const pushi = new Pushi(key, {});

            setTimeout(() => {
                pushi.socket._onSend = function(data) {
                    const parsed = JSON.parse(data);
                    assert.strictEqual(parsed.event, "test-event");
                    assert.strictEqual(parsed.channel, "my-channel");
                    done();
                };

                pushi.sendChannel("test-event", "data", "my-channel");
            }, 10);
        });
    });

    describe("#subscribe()", function() {
        it("should create channel and send subscribe event", function(done) {
            const key = uniqueKey("subscribe");
            const pushi = new Pushi(key, {});

            setTimeout(() => {
                let subscribeEventSent = false;
                pushi.socket._onSend = function(data) {
                    const parsed = JSON.parse(data);
                    if (parsed.event === "pusher:subscribe") {
                        subscribeEventSent = true;
                        assert.strictEqual(parsed.data.channel, "public-channel");
                    }
                };

                const channel = pushi.subscribe("public-channel");
                assert.strictEqual(channel.name, "public-channel");
                assert.ok(pushi.channels["public-channel"]);

                setTimeout(() => {
                    assert.strictEqual(subscribeEventSent, true);
                    done();
                }, 10);
            }, 10);
        });

        it("should return existing channel if already subscribed", function(done) {
            const key = uniqueKey("existing-channel");
            const pushi = new Pushi(key, {});

            setTimeout(() => {
                const channel1 = pushi.subscribe("test-channel");
                const channel2 = pushi.subscribe("test-channel");

                assert.strictEqual(channel1, channel2);
                done();
            }, 10);
        });

        it("should throw error for private channel without auth endpoint", function(done) {
            const key = uniqueKey("private-no-auth");
            const pushi = new Pushi(key, {});

            setTimeout(() => {
                assert.throws(() => {
                    pushi.subscribe("private-channel");
                }, /No auth endpoint defined/);
                done();
            }, 10);
        });
    });

    describe("#unsubscribe()", function() {
        it("should send unsubscribe event for subscribed channel", function(done) {
            const key = uniqueKey("unsubscribe");
            const pushi = new Pushi(key, {});

            setTimeout(() => {
                // first subscribe
                pushi.subscribe("test-channel");

                let unsubscribeReceived = false;
                pushi.socket._onSend = function(data) {
                    const parsed = JSON.parse(data);
                    if (parsed.event === "pusher:unsubscribe") {
                        assert.strictEqual(parsed.data.channel, "test-channel");
                        unsubscribeReceived = true;
                    }
                };

                pushi.unsubscribe("test-channel");

                setTimeout(() => {
                    assert.strictEqual(unsubscribeReceived, true);
                    done();
                }, 10);
            }, 10);
        });

        it("should return undefined for non-subscribed channel", function(done) {
            const key = uniqueKey("unsub-nonexist");
            const pushi = new Pushi(key, {});

            setTimeout(() => {
                const result = pushi.unsubscribe("nonexistent-channel");
                assert.strictEqual(result, undefined);
                done();
            }, 10);
        });
    });

    describe("#invalidate()", function() {
        it("should remove specific channel when name provided", function(done) {
            const key = uniqueKey("invalidate-specific");
            const pushi = new Pushi(key, {});

            setTimeout(() => {
                pushi.subscribe("channel-1");
                pushi.subscribe("channel-2");

                pushi.invalidate("channel-1");

                assert.strictEqual(pushi.channels["channel-1"], undefined);
                assert.ok(pushi.channels["channel-2"]);
                done();
            }, 10);
        });

        it("should remove all channels when no name provided", function(done) {
            const key = uniqueKey("invalidate-all");
            const pushi = new Pushi(key, {});

            setTimeout(() => {
                pushi.subscribe("channel-1");
                pushi.subscribe("channel-2");

                pushi.invalidate();

                assert.deepStrictEqual(pushi.channels, {});
                done();
            }, 10);
        });
    });

    describe("#_buildApiUrl()", function() {
        it("should build URL from baseWebUrl when provided", function() {
            const key = uniqueKey("build-url-web");
            const pushi = new Pushi(key, {
                baseWebUrl: "https://api.example.com"
            });

            const url = pushi._buildApiUrl("/test/path");

            assert.strictEqual(url, "https://api.example.com/test/path");
        });

        it("should derive URL from baseUrl when baseWebUrl not provided", function() {
            const key = uniqueKey("build-url-base");
            const pushi = new Pushi(key, {
                baseUrl: "wss://example.com/"
            });

            const url = pushi._buildApiUrl("/test/path");

            assert.strictEqual(url, "https://example.com/test/path");
        });
    });

    describe("#_urlBase64ToUint8Array()", function() {
        it("should convert base64url to Uint8Array", function() {
            const key = uniqueKey("base64-1");
            const pushi = new Pushi(key, {});

            // "Hello" in base64url
            const result = pushi._urlBase64ToUint8Array("SGVsbG8");

            assert.ok(result instanceof Uint8Array);
            assert.strictEqual(result.length, 5);
            assert.strictEqual(String.fromCharCode(...result), "Hello");
        });

        it("should handle base64url with special characters", function() {
            const key = uniqueKey("base64-2");
            const pushi = new Pushi(key, {});

            // base64url uses - and _ instead of + and /
            const result = pushi._urlBase64ToUint8Array("PDw_Pz4-");

            assert.ok(result instanceof Uint8Array);
        });
    });

    describe("#extractSubscriptionInfo()", function() {
        it("should extract endpoint and keys from subscription", function() {
            const key = uniqueKey("extract-sub");
            const pushi = new Pushi(key, {});
            const mockSubscription = {
                toJSON: () => ({
                    endpoint: "https://push.example.com/abc123",
                    keys: {
                        p256dh: "p256dh-key-value",
                        auth: "auth-key-value"
                    }
                })
            };

            const info = pushi.extractSubscriptionInfo(mockSubscription);

            assert.deepStrictEqual(info, {
                endpoint: "https://push.example.com/abc123",
                p256dh: "p256dh-key-value",
                auth: "auth-key-value"
            });
        });
    });

    describe("Observable methods", function() {
        it("should have bind method", function() {
            const key = uniqueKey("observable-bind");
            const pushi = new Pushi(key, {});
            assert.strictEqual(typeof pushi.bind, "function");
        });

        it("should have unbind method", function() {
            const key = uniqueKey("observable-unbind");
            const pushi = new Pushi(key, {});
            assert.strictEqual(typeof pushi.unbind, "function");
        });

        it("should have trigger method", function() {
            const key = uniqueKey("observable-trigger");
            const pushi = new Pushi(key, {});
            assert.strictEqual(typeof pushi.trigger, "function");
        });

        it("should trigger connect event on connection", function(done) {
            const key = uniqueKey("connect-event");
            const pushi = new Pushi(key, {});

            pushi.bind("connect", function() {
                assert.strictEqual(pushi.state, "connected");
                done();
            });

            // simulate connection established
            setTimeout(() => {
                pushi.socket._receive({
                    event: "pusher:connection_established",
                    data: JSON.stringify({ socket_id: "123.456" })
                });
            }, 10);
        });
    });

    describe("#login()", function() {
        it("should reject without app ID", async function() {
            const key = uniqueKey("login-no-id");
            const pushi = new Pushi(key, {});

            try {
                await pushi.login({ appSecret: "secret" });
                assert.fail("Should have thrown");
            } catch (error) {
                assert.ok(error.message.includes("App ID is required"));
            }
        });

        it("should reject without app secret", async function() {
            const key = uniqueKey("login-no-secret");
            const pushi = new Pushi(key, {
                appId: "my-app"
            });

            try {
                await pushi.login({});
                assert.fail("Should have thrown");
            } catch (error) {
                assert.ok(error.message.includes("App secret is required"));
            }
        });

        it("should make login request and set authenticated", async function() {
            const key = uniqueKey("login-success");
            const pushi = new Pushi(key, {
                appId: "my-app",
                appSecret: "my-secret",
                baseWebUrl: "https://api.example.com"
            });

            MockXMLHttpRequest.mockResponse(200, {});

            await pushi.login();

            assert.strictEqual(pushi.authenticated, true);
        });
    });

    describe("#setupWebPush()", function() {
        it("should reject when not authenticated", async function() {
            const key = uniqueKey("setup-no-auth");
            const pushi = new Pushi(key, {});

            try {
                await pushi.setupWebPush("test-event");
                assert.fail("Should have thrown");
            } catch (error) {
                assert.ok(error.message.includes("Login required"));
            }
        });
    });

    describe("#teardownWebPush()", function() {
        it("should reject when not authenticated", async function() {
            const key = uniqueKey("teardown-no-auth");
            const pushi = new Pushi(key, {});

            try {
                await pushi.teardownWebPush("test-event");
                assert.fail("Should have thrown");
            } catch (error) {
                assert.ok(error.message.includes("Login required"));
            }
        });
    });
});
