import assert from "assert";
import { setupMocks, cleanupMocks } from "./mock.mjs";
import { Channel } from "../pushi.mjs";

describe("Channel", function() {
    before(function() {
        setupMocks();
    });

    after(function() {
        cleanupMocks();
    });

    describe("#constructor()", function() {
        it("should initialize with pushi reference and name", function() {
            const mockPushi = { channels: {} };
            const channel = new Channel(mockPushi, "test-channel");

            assert.strictEqual(channel.pushi, mockPushi);
            assert.strictEqual(channel.name, "test-channel");
            assert.strictEqual(channel.data, null);
            assert.strictEqual(channel.subscribed, false);
            assert.deepStrictEqual(channel.events, {});
        });
    });

    describe("#setsubscribe()", function() {
        it("should mark channel as subscribed", function() {
            const mockPushi = {
                channels: {},
                onsubscribe: function() {}
            };
            const channel = new Channel(mockPushi, "test-channel");

            channel.setsubscribe({ info: "test" });

            assert.strictEqual(channel.subscribed, true);
            assert.deepStrictEqual(channel.data, { info: "test" });
        });

        it("should trigger subscribe event", function(done) {
            const mockPushi = {
                channels: {},
                onsubscribe: function() {}
            };
            const channel = new Channel(mockPushi, "test-channel");

            // Note: trigger passes (eventName, ...args), so handler receives ("subscribe", data)
            channel.bind("subscribe", function(eventName, data) {
                assert.strictEqual(eventName, "subscribe");
                assert.deepStrictEqual(data, { info: "test" });
                done();
            });

            channel.setsubscribe({ info: "test" });
        });

        it("should handle alias channels", function() {
            const subscribedChannels = [];
            const mockPushi = {
                channels: {},
                onsubscribe: function(name) {
                    subscribedChannels.push(name);
                }
            };
            const channel = new Channel(mockPushi, "test-channel");

            channel.setsubscribe({
                alias: ["alias-1", "alias-2"]
            });

            assert.deepStrictEqual(subscribedChannels, ["alias-1", "alias-2"]);
            assert.ok(mockPushi.channels["alias-1"]);
            assert.ok(mockPushi.channels["alias-2"]);
        });
    });

    describe("#setunsubscribe()", function() {
        it("should mark channel as unsubscribed", function() {
            const mockPushi = {
                channels: {},
                onsubscribe: function() {},
                onunsubscribe: function() {}
            };
            const channel = new Channel(mockPushi, "test-channel");

            channel.setsubscribe({});
            channel.setunsubscribe({});

            assert.strictEqual(channel.subscribed, false);
        });

        it("should trigger unsubscribe event", function(done) {
            const mockPushi = {
                channels: {},
                onsubscribe: function() {},
                onunsubscribe: function() {}
            };
            const channel = new Channel(mockPushi, "test-channel");

            channel.bind("unsubscribe", function() {
                done();
            });

            channel.setunsubscribe({});
        });
    });

    describe("#setlatest()", function() {
        it("should trigger latest event with data", function(done) {
            const mockPushi = { channels: {} };
            const channel = new Channel(mockPushi, "test-channel");
            const testData = { messages: [1, 2, 3] };

            // trigger passes (eventName, data)
            channel.bind("latest", function(eventName, data) {
                assert.strictEqual(eventName, "latest");
                assert.deepStrictEqual(data, testData);
                done();
            });

            channel.setlatest(testData);
        });
    });

    describe("#setmessage()", function() {
        it("should trigger event with message data", function(done) {
            const mockPushi = { channels: {} };
            const channel = new Channel(mockPushi, "test-channel");

            // trigger passes (eventName, data, mid, timestamp)
            channel.bind("custom-event", function(eventName, data, mid, timestamp) {
                assert.strictEqual(eventName, "custom-event");
                assert.strictEqual(data, "message-data");
                assert.strictEqual(mid, "msg-123");
                assert.strictEqual(timestamp, 1234567890);
                done();
            });

            channel.setmessage("custom-event", "message-data", "msg-123", 1234567890);
        });
    });

    describe("#send()", function() {
        it("should call pushi sendChannel with correct parameters", function() {
            let sentParams = null;
            const mockPushi = {
                channels: {},
                sendChannel: function(event, data, channel, echo, persist) {
                    sentParams = { event, data, channel, echo, persist };
                }
            };
            const channel = new Channel(mockPushi, "test-channel");

            channel.send("my-event", { foo: "bar" }, true, false);

            assert.deepStrictEqual(sentParams, {
                event: "my-event",
                data: { foo: "bar" },
                channel: "test-channel",
                echo: true,
                persist: false
            });
        });
    });

    describe("#unsubscribe()", function() {
        it("should call pushi unsubscribe with channel name", function() {
            let unsubscribedChannel = null;
            const mockPushi = {
                channels: {},
                unsubscribe: function(name, callback) {
                    unsubscribedChannel = name;
                    if (callback) callback();
                }
            };
            const channel = new Channel(mockPushi, "test-channel");

            channel.unsubscribe();

            assert.strictEqual(unsubscribedChannel, "test-channel");
        });
    });

    describe("#latest()", function() {
        it("should call pushi latest with correct parameters", function() {
            let latestParams = null;
            const mockPushi = {
                channels: {},
                latest: function(channel, skip, count, callback) {
                    latestParams = { channel, skip, count };
                }
            };
            const channel = new Channel(mockPushi, "test-channel");

            channel.latest(5, 20);

            assert.deepStrictEqual(latestParams, {
                channel: "test-channel",
                skip: 5,
                count: 20
            });
        });
    });

    describe("Observable methods", function() {
        it("should have bind method from Observable", function() {
            const mockPushi = { channels: {} };
            const channel = new Channel(mockPushi, "test-channel");

            assert.strictEqual(typeof channel.bind, "function");
        });

        it("should have unbind method from Observable", function() {
            const mockPushi = { channels: {} };
            const channel = new Channel(mockPushi, "test-channel");

            assert.strictEqual(typeof channel.unbind, "function");
        });

        it("should have trigger method from Observable", function() {
            const mockPushi = { channels: {} };
            const channel = new Channel(mockPushi, "test-channel");

            assert.strictEqual(typeof channel.trigger, "function");
        });
    });
});
