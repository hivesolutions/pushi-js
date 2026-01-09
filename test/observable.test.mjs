import assert from "assert";
import { setupMocks, cleanupMocks } from "./mock.mjs";
import { Observable } from "../pushi.mjs";

describe("Observable", function() {
    before(function() {
        setupMocks();
    });

    after(function() {
        cleanupMocks();
    });

    describe("#constructor()", function() {
        it("should initialize with empty events object", function() {
            const observable = new Observable();
            assert.deepStrictEqual(observable.events, {});
        });
    });

    describe("#bind()", function() {
        it("should register event handler", function() {
            const observable = new Observable();
            const handler = function() {};

            observable.bind("test", handler);

            assert.strictEqual(observable.events["test"].length, 1);
            assert.strictEqual(observable.events["test"][0], handler);
        });

        it("should register multiple handlers for same event", function() {
            const observable = new Observable();
            const handler1 = function() {};
            const handler2 = function() {};

            observable.bind("test", handler1);
            observable.bind("test", handler2);

            assert.strictEqual(observable.events["test"].length, 2);
        });

        it("should mark handler as oneshot when specified", function() {
            const observable = new Observable();
            const handler = function() {};

            observable.bind("test", handler, true);

            assert.strictEqual(handler.oneshot, true);
        });

        it("should mark handler as not oneshot by default", function() {
            const observable = new Observable();
            const handler = function() {};

            observable.bind("test", handler);

            assert.strictEqual(handler.oneshot, false);
        });
    });

    describe("#unbind()", function() {
        it("should remove registered handler", function() {
            const observable = new Observable();
            const handler = function() {};

            observable.bind("test", handler);
            observable.unbind("test", handler);

            assert.strictEqual(observable.events["test"].length, 0);
        });

        it("should only remove specified handler", function() {
            const observable = new Observable();
            const handler1 = function() {};
            const handler2 = function() {};

            observable.bind("test", handler1);
            observable.bind("test", handler2);
            observable.unbind("test", handler1);

            assert.strictEqual(observable.events["test"].length, 1);
            assert.strictEqual(observable.events["test"][0], handler2);
        });

        it("should handle unbinding non-existent handler gracefully", function() {
            const observable = new Observable();
            const handler = function() {};

            // should not throw
            observable.unbind("test", handler);
            assert.strictEqual(observable.events["test"], undefined);
        });
    });

    describe("#trigger()", function() {
        it("should call registered handler with event name", function() {
            const observable = new Observable();
            let calledWith = null;

            observable.bind("test", function(event) {
                calledWith = event;
            });
            observable.trigger("test");

            assert.strictEqual(calledWith, "test");
        });

        it("should call handler with additional arguments", function() {
            const observable = new Observable();
            let receivedArgs = null;

            observable.bind("test", function(event, arg1, arg2) {
                receivedArgs = [event, arg1, arg2];
            });
            observable.trigger("test", "value1", "value2");

            assert.deepStrictEqual(receivedArgs, ["test", "value1", "value2"]);
        });

        it("should call multiple handlers in order", function() {
            const observable = new Observable();
            const callOrder = [];

            observable.bind("test", function() {
                callOrder.push(1);
            });
            observable.bind("test", function() {
                callOrder.push(2);
            });
            observable.trigger("test");

            assert.deepStrictEqual(callOrder, [1, 2]);
        });

        it("should remove oneshot handlers after trigger", function() {
            const observable = new Observable();
            let callCount = 0;

            observable.bind("test", function() {
                callCount++;
            }, true);

            observable.trigger("test");
            observable.trigger("test");

            assert.strictEqual(callCount, 1);
            assert.strictEqual(observable.events["test"].length, 0);
        });

        it("should keep non-oneshot handlers after trigger", function() {
            const observable = new Observable();
            let callCount = 0;

            observable.bind("test", function() {
                callCount++;
            }, false);

            observable.trigger("test");
            observable.trigger("test");

            assert.strictEqual(callCount, 2);
            assert.strictEqual(observable.events["test"].length, 1);
        });

        it("should handle triggering event with no handlers", function() {
            const observable = new Observable();

            // should not throw
            observable.trigger("nonexistent");
        });
    });
});
