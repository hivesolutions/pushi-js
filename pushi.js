// Hive Pushi System
// Copyright (c) 2008-2024 Hive Solutions Lda.
//
// This file is part of Hive Pushi System.
//
// Hive Pushi System is free software: you can redistribute it and/or modify
// it under the terms of the Apache License as published by the Apache
// Foundation, either version 2.0 of the License, or (at your option) any
// later version.
//
// Hive Pushi System is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// Apache License for more details.
//
// You should have received a copy of the Apache License along with
// Hive Pushi System. If not, see <http://www.apache.org/licenses/>.

// __author__    = João Magalhães <joamag@hive.pt>
// __copyright__ = Copyright (c) 2008-2024 Hive Solutions Lda.
// __license__   = Apache License, Version 2.0

var PUSHI_CONNECTIONS = {};

// ===========================================
// Observable Implementation
// ===========================================

var Observable = function() {
    this.events = {};
};

Observable.prototype.trigger = function(event) {
    var index = 0;
    var oneshots = null;
    var methods = this.events[event] || [];
    for (index = 0; index < methods.length; index++) {
        var method = methods[index];
        method.apply(this, arguments);
        if (method.oneshot === false) {
            continue;
        }
        oneshots = oneshots === null ? [] : oneshots;
        oneshots.push(method);
    }
    if (oneshots === null) {
        return;
    }
    for (index = 0; index < oneshots.length; index++) {
        var oneshot = oneshots[index];
        this.unbind(event, oneshot);
    }
};

Observable.prototype.bind = function(event, method, oneshot) {
    method.oneshot = oneshot ? true : false;
    var methods = this.events[event] || [];
    methods.push(method);
    this.events[event] = methods;
};

Observable.prototype.unbind = function(event, method) {
    var methods = this.events[event] || [];
    var index = methods.indexOf(method);
    index !== -1 && methods.splice(index, 1);
};

// ===========================================
// Pushi Channel Implementation
// ===========================================

var Channel = function(pushi, name) {
    this.pushi = pushi;
    this.name = name;
    this.data = null;
    this.subscribed = false;
    this.events = {};
};

Channel.prototype.setsubscribe = function(data) {
    var alias = (data && data.alias) || [];
    for (var index = 0; index < alias.length; index++) {
        var name = alias[index];

        var channel = new Channel(this.pushi, name);
        this.pushi.channels[name] = channel;

        this.pushi.onsubscribe(name, {});
    }

    this.data = data;
    this.subscribed = true;
    this.trigger("subscribe", data);
};

Channel.prototype.setunsubscribe = function(data) {
    var alias = (data && data.alias) || [];
    for (var index = 0; index < alias.length; index++) {
        var name = alias[index];
        this.pushi.onunsubscribe(name, {});
    }

    this.subscribed = false;
    this.trigger("unsubscribe", data);
};

Channel.prototype.setlatest = function(data) {
    this.trigger("latest", data);
};

Channel.prototype.setmessage = function(event, data, mid, timestamp) {
    this.trigger(event, data, mid, timestamp);
};

Channel.prototype.send = function(event, data, echo, persist) {
    this.pushi.sendChannel(event, data, this.name, echo, persist);
};

Channel.prototype.unsubscribe = function(callback) {
    this.pushi.unsubscribe(this.name, callback);
};

Channel.prototype.latest = function(skip, count, callback) {
    this.pushi.latest(this.name, skip, count, callback);
};

Channel.prototype.trigger = Observable.prototype.trigger;
Channel.prototype.bind = Observable.prototype.bind;
Channel.prototype.unbind = Observable.prototype.unbind;

// ===========================================
// Pushi Base Implementation
// ===========================================

var Pushi = function(appKey, options) {
    this.init(appKey, options);
};

Pushi.prototype.init = function(appKey, options, callback) {
    // tries to retrieve any previously existing instance
    // of pushi for the provided key and in case it exists
    // clones it and returns it as the properly initialized
    // pushi instance (provides re-usage of resources)
    var previous = PUSHI_CONNECTIONS[appKey];
    if (previous) {
        return this.clone(previous);
    }

    // runs the configuration operation for the current instance
    // so that the state based configuration variables are set
    // according to the provided (configuration) values
    this.config(appKey, options);

    // starts the various state related variables for
    // the newly initialized pushi instance
    this.socket = null;
    this.socketId = null;
    this.state = "disconnected";
    this.channels = {};
    this.events = {};
    this.auths = {};
    this._base = null;
    this._cloned = false;

    // updates the proper auth endpoint for the current
    // instance so that the proper call is made if required
    this.authEndpoint = this.options.authEndpoint;

    // triggers the starts of the connection loading by calling
    // the open (connection) method in the instance
    this.open(callback);
};

Pushi.prototype.config = function(appKey, options) {
    // runs the definition of a series of constant values that
    // will be used as defaults for some options
    var TIMEOUT = 5000;
    var BASE_URL = "wss://puxiapp.com/";

    // retrieves the proper values for the options, defaulting
    // to the pre-defined (constant) values if that's required
    var timeout = options.timeout || TIMEOUT;
    var baseUrl = options.baseUrl || BASE_URL;
    var baseWebUrl = options.baseWebUrl || null;

    // removes any previously registered configuration for the
    // the current instance app key (for cases of re-configuration)
    delete PUSHI_CONNECTIONS[this.appKey];

    // updates the various configuration related variables
    // that will condition the way the pushi instance behaves
    this.timeout = timeout;
    this.url = baseUrl + appKey;
    this.baseUrl = baseUrl;
    this.baseWebUrl = baseWebUrl;
    this.appKey = appKey;
    this.options = options || {};

    // sets the current connection for the app key value
    // so that it gets re-used if that's requested
    PUSHI_CONNECTIONS[appKey] = this;
};

Pushi.prototype.reconfig = function(appKey, options, callback) {
    this.config(appKey, options);
    this.reopen(callback);
};

Pushi.prototype.clone = function(base) {
    // copies the complete set of attributes from the base
    // object to the new one (cloned) so that they may be
    // re-used for any future operation/action
    this.timeout = base.timeout;
    this.url = base.url;
    this.baseUrl = base.baseUrl;
    this.baseWebUrl = base.baseWebUrl;
    this.appKey = base.appKey;
    this.options = base.options;
    this.socket = base.socket;
    this.socketId = base.socketId;
    this.state = base.state;
    this.channels = [];
    this.events = [];
    this.auths = base.auths;
    this.authEndpoint = base.authEndpoint;
    this._base = base;
    this._cloned = true;

    // adds the current reference to the list of subscriptions
    // for the socket that is going to be used (as expected)
    this.socket.subscriptions.push(this);

    // in case the current state of the connection is
    // connected must simulate the connection by calling
    // the appropriate handler with the correct data
    if (this.state === "connected") {
        var data = {
            socket_id: this.socketId
        };
        this.onoconnect(data);
    }
};

Pushi.prototype.open = function(callback) {
    // in case the current state is not disconnected returns immediately
    // as this is considered to be the only valid state for the operation
    if (this.state !== "disconnected") {
        return;
    }

    // retrieves the current context as a local variable and then tries
    // to gather the subscriptions from the current socket defaulting to
    // a simple list with the current instance otherwise, this will make
    // possible the re-usage of previously existing subscriptions for the
    // instance for cloning situations (as defined in specifications)
    var self = this;
    var subscriptions = this.socket ? this.socket.subscriptions : [this];

    // creates the new websocket reference with the currently defined
    // url, then updates the reference to the underlying subscriptions
    // and sets the proper callback value for the socket operation
    var socket = new WebSocket(this.url);
    socket.subscriptions = subscriptions;
    socket._callback = callback;

    // creates the function that will initialize the instance's socket to
    // the one that has now been created and then calls it to all the
    // subscriptions of the current socket (sets socket for subscription)
    var _init = function() {
        this.socket = socket;
    };
    this.callobj(_init, subscriptions);

    this.socket.onopen = function() {
        this._callback && this._callback();
        this._callback = null;
    };

    this.socket.onmessage = function(event) {
        var data = null;
        var message = event.data;
        var json = JSON.parse(message);

        var isConnected = self.state === "disconnected" && json.event === "pusher:connection_established";

        if (isConnected) {
            data = JSON.parse(json.data);
            self.callobj(Pushi.prototype.onoconnect, this.subscriptions, data);
        } else if (self.state === "connected") {
            data = json;
            self.callobj(Pushi.prototype.onmessage, this.subscriptions, data);
        }

        this._callback && this._callback();
        this._callback = null;
    };

    this.socket.onclose = function() {
        self.callobj(Pushi.prototype.onodisconnect, this.subscriptions);
        this._callback && this._callback();
        this._callback = null;
    };
};

Pushi.prototype.close = function(callback) {
    // in case the current state is not connected returns immediately
    // as this is considered to be the only valid state for the operation
    if (this.state !== "connected") {
        return;
    }

    // updates the next operation callback reference in the socket to the
    // provided callback so that it gets notified on closing
    this.socket._callback = callback;

    // closes the currently assigned socket, triggering a series of events
    // that will update the current pushi status as disconnected
    this.socket.close();
};

Pushi.prototype.reopen = function(callback) {
    var self = this;
    this.close(function() {
        self.open(callback);
    });
};

Pushi.prototype.callobj = function(callable, objects) {
    var index = 0;
    var args = [];

    for (index = 2; index < arguments.length; index++) {
        args.push(arguments[index]);
    }

    for (index = 0; index < objects.length; index++) {
        var _object = objects[index];
        callable.apply(_object, args);
    }
};

Pushi.prototype.retry = function() {
    // sets the current object context in the self variable
    // to be used by the clojures that are going to be created
    var self = this;

    // in case this is a cloned object the retry operation
    // is not possible because this object does not owns
    // the underyling websocket object
    if (this._cloned) {
        return;
    }

    // sets the timeout for the new initialization of the
    // object this value should not be to low that congests
    // the server side nor to large that takes to long for
    // the reconnection to take effect (bad user experience)
    setTimeout(function() {
        self.open();
    }, this.timeout);
};

Pushi.prototype.onoconnect = function(data) {
    this.socketId = data.socket_id;
    this.state = "connected";
    this.trigger("connect");
};

Pushi.prototype.onodisconnect = function(data) {
    this.socketId = null;
    this.channels = {};
    this.state = "disconnected";
    this.trigger("disconnect");
    this.retry();
};

Pushi.prototype.onsubscribe = function(channel, data) {
    if (!this.channels[channel]) {
        return;
    }
    var _channel = this.channels[channel];
    _channel.setsubscribe(data);
    this.trigger("subscribe", channel, data);
};

Pushi.prototype.onunsubscribe = function(channel, data) {
    if (!this.channels[channel]) {
        return;
    }
    var _channel = this.channels[channel];
    delete this.channels[channel];
    _channel.setunsubscribe(data);
    this.trigger("unsubscribe", channel, data);
};

Pushi.prototype.onlatest = function(channel, data) {
    if (!this.channels[channel]) {
        return;
    }
    var _channel = this.channels[channel];
    _channel.setlatest(data);
    this.trigger("latest", channel, data);
};

Pushi.prototype.onmemberadded = function(channel, member) {
    this.trigger("member_added", channel, member);
};

Pushi.prototype.onmemberremoved = function(channel, member) {
    this.trigger("member_removed", channel, member);
};

Pushi.prototype.onmessage = function(json) {
    var data = null;
    var member = null;
    var channel = json.channel;
    var _channel = this.channels[channel];
    var isPeer = channel.startsWith("peer-");
    if (channel && !_channel && !isPeer) {
        return;
    }

    switch (json.event) {
        case "pusher_internal:subscription_succeeded":
            data = JSON.parse(json.data);
            this.onsubscribe(channel, data);
            break;

        case "pusher_internal:unsubscription_succeeded":
            data = JSON.parse(json.data);
            this.onunsubscribe(channel, data);
            break;

        case "pusher_internal:latest":
            data = JSON.parse(json.data);
            this.onlatest(channel, data);
            break;

        case "pusher:member_added":
            member = JSON.parse(json.member);
            this.onmemberadded(channel, member);
            break;

        case "pusher:member_removed":
            member = JSON.parse(json.member);
            this.onmemberremoved(channel, member);
            break;
    }

    this.trigger(json.event, json.data, json.channel, json.mid, json.timestamp);
    _channel && _channel.setmessage(json.event, json.data, json.mid, json.timestamp);
};

Pushi.prototype.send = function(json) {
    var data = JSON.stringify(json);
    this.socket.send(data);
};

Pushi.prototype.sendEvent = function(event, data, echo, persist) {
    echo = echo === undefined ? false : echo;
    persist = persist === undefined ? true : persist;
    var json = {
        event: event,
        data: data,
        echo: echo,
        persist: persist
    };
    this.send(json);
};

Pushi.prototype.sendChannel = function(event, data, channel, echo, persist) {
    echo = echo === undefined ? false : echo;
    persist = persist === undefined ? true : persist;
    var json = {
        event: event,
        data: data,
        channel: channel,
        echo: echo,
        persist: persist
    };
    this.send(json);
};

Pushi.prototype.invalidate = function(channel) {
    // in case the channel (name) value is provided
    // removes its reference from the map associating
    // the channel name with the channel info
    if (channel) {
        delete this.channels[channel];
    }
    // otherwise removes all the channel information from
    // the channels map invalidating all of the elements
    else {
        this.channels = {};
    }
};

Pushi.prototype.subscribe = function(channel, force, callback) {
    // sets the current context in the self variable to
    // be used latter for the clojure functions
    var self = this;

    // tries to retrieve the channel information for the
    // provided channel name in case it's found returns
    // the channel object immediately (avoids double
    // registration of the channel)
    var _channel = this.channels[channel];
    if (_channel && !force) {
        return _channel;
    }

    // in case this is a cloned proxy object we must also
    // check if the base object is already subscribed for
    // the channel for such cases the callback should be
    // called immediately as there's no remote call to be
    // performed for such situations
    if (this._cloned) {
        _channel = this._base.channels[channel];
        if (_channel && !force) {
            setTimeout(function() {
                self.onsubscribe(channel, _channel.data);
            });
            this.channels[channel] = _channel;
            return _channel;
        }
    }

    // verifies if the current channel to be subscribed
    // is of type private and in case it is uses the proper
    // private way of subscription otherwise uses the public
    // way for subscription (no authentication process)
    var isPrivate = channel.startsWith("private-") || channel.startsWith("presence-") || channel.startsWith(
        "personal-");
    if (isPrivate) {
        this.subscribePrivate(channel);
    } else {
        this.subscribePublic(channel);
    }

    // retrieves the channel as the name value and then creates
    // a channel object with the current context and the name and
    // then sets the channel in the channels map structure
    var name = channel;
    channel = new Channel(this, name);
    this.channels[name] = channel;

    // in case the callback function is defined registers for the
    // subscribe event on the channel object
    callback && channel.bind("subscribe", callback, true);

    // returns the channel structure as a result of this function
    // to be used by the caller method or function
    return channel;
};

Pushi.prototype.unsubscribe = function(channel, callback) {
    // verifies if the channel is currently defined in the
    // list of channels for the connection if not returns immediately
    if (!this.channels[channel]) {
        return;
    }

    // sends the event for the unsubscription of the channel through
    // the current pushi socket so that no more messages are received
    // regarding the provided channel
    this.sendEvent("pusher:unsubscribe", {
        channel: channel
    });

    // sets the channel as the name value and then tries to retrieve
    // the channel structure for the provided name
    var name = channel;
    channel = this.channels[name];

    // in case the callback function is defined registers for the
    // unsubscribe event on the channel object
    callback && channel.bind("unsubscribe", callback, true);

    // returns the channel structure to the caller function so that
    // may be used for any other operations pending
    return channel;
};

Pushi.prototype.latest = function(channel, skip, count, callback) {
    // sets the default values for the latest retrieval, so that if
    // they are not provided values are ensured
    skip = skip || 0;
    count = count || 10;

    // verifies if the channel is currently defined in the
    // list of channels for the connection if not returns immediately
    if (!this.channels[channel] && !channel.startsWith("peer-")) {
        return;
    }

    // sends the event for the latest (retrieval) of the channel through
    // the current pushi socket so that the latest messages are retrieved
    this.sendEvent("pusher:latest", {
        channel: channel,
        skip: skip,
        count: count
    });

    // sets the channel as the name value and then tries to retrieve
    // the channel structure for the provided name, note that the ensure
    // call will make sure that at least one channel object exists
    var name = channel;
    channel = this.ensureChannel(name);

    // in case the callback function is defined registers for the
    // latest event on the channel object
    callback && channel.bind("latest", callback, true);

    // returns the channel structure to the caller function so that
    // may be used for any other operations pending
    return channel;
};

Pushi.prototype.ensureChannel = function(name) {
    if (this.channels[name]) {
        return this.channels[name];
    }
    var channel = new Channel(this, name);
    this.channels[name] = channel;
    return channel;
};

Pushi.prototype.subscribePublic = function(channel) {
    this.sendEvent("pusher:subscribe", {
        channel: channel
    });
};

Pushi.prototype.subscribePrivate = function(channel) {
    // in case no authentication endpoint exists returns immediately
    // because there's not enough information to proceed with the
    // authentication process for the private channel
    if (!this.authEndpoint) {
        throw "No auth endpoint defined";
    }

    // sets the current context in the self variable to be
    // used by the clojures in the current function
    var self = this;

    // constructs the get query part of the url with both the socket
    // id of the current connection and the channel value for it
    // then constructs the complete url value for the connection
    var query = "?socket_id=" + this.socketId + "&channel=" + channel;
    var url = this.authEndpoint + query;

    // creates the remote async request that it's going
    // to be used to retrieve the authentication information
    // this is going to use the provided auth endpoint together
    // with some of the current context
    var request = new XMLHttpRequest();
    request.open("get", url, true);
    request.onreadystatechange = function() {
        // in case the current state is not ready returns
        // immediately as it's not a (to) success change
        if (request.readyState !== 4) {
            return;
        }

        // retrieves the response data and parses it as a json
        // message and returns immediately in case no auth
        // information is provided as part of the response
        var result = JSON.parse(request.responseText);
        if (!result.auth) {
            return;
        }

        // sends a pusher subscribe event containing all of the
        // channel information together with the auth token and
        // the channel data to be used (in case it exists)
        self.sendEvent("pusher:subscribe", {
            channel: channel,
            auth: result.auth,
            channel_data: result.channel_data
        });
    };
    request.send();
};

Pushi.prototype.isValid = function(appKey, baseUrl) {
    return appKey === this.appKey && baseUrl === this.baseUrl;
};

// ===========================================
// Observable Support
// ===========================================

Pushi.prototype.trigger = Observable.prototype.trigger;
Pushi.prototype.bind = Observable.prototype.bind;
Pushi.prototype.unbind = Observable.prototype.unbind;

// ===========================================
// Web Push API Support
// ===========================================

/**
 * Fetches the VAPID public key from the server. This key is
 * needed to subscribe to push notifications using the browser's
 * Push API (applicationServerKey parameter).
 *
 * @param {Function} callback Optional callback with (error, vapidPublicKey).
 * @returns {Promise} Promise that resolves with the VAPID public key.
 */
Pushi.prototype.getVapidPublicKey = function(callback) {
    var self = this;
    var url = this._buildApiUrl("/vapid_key");

    return new Promise(function(resolve, reject) {
        var request = new XMLHttpRequest();
        request.open("GET", url, true);
        request.onreadystatechange = function() {
            if (request.readyState !== 4) {
                return;
            }

            if (request.status === 200) {
                var result = JSON.parse(request.responseText);
                var publicKey = result.vapid_public_key;
                callback && callback(null, publicKey);
                resolve(publicKey);
            } else {
                var error = new Error("Failed to get VAPID public key: " + request.status);
                callback && callback(error, null);
                reject(error);
            }
        };
        request.send();
    });
};

/**
 * Requests notification permission from the user. This must be
 * called before attempting to subscribe to push notifications.
 *
 * @returns {Promise} Promise that resolves with permission state
 * ('granted', 'denied', or 'default').
 */
Pushi.prototype.requestNotificationPermission = function() {
    return new Promise(function(resolve, reject) {
        if (!("Notification" in window)) {
            reject(new Error("Notifications not supported in this browser"));
            return;
        }

        Notification.requestPermission().then(function(permission) {
            resolve(permission);
        }).catch(function(error) {
            reject(error);
        });
    });
};

/**
 * Registers a service worker for handling push notifications.
 * The service worker is required to receive and display push
 * notifications in the browser.
 *
 * @param {String} swPath Path to the service worker file (default: '/sw.js').
 * @returns {Promise} Promise that resolves with the ServiceWorkerRegistration.
 */
Pushi.prototype.registerServiceWorker = function(swPath) {
    swPath = swPath || "/sw.js";

    return new Promise(function(resolve, reject) {
        if (!("serviceWorker" in navigator)) {
            reject(new Error("Service workers not supported in this browser"));
            return;
        }

        navigator.serviceWorker.register(swPath).then(function(registration) {
            resolve(registration);
        }).catch(function(error) {
            reject(error);
        });
    });
};

/**
 * Gets the current push subscription from the browser's
 * push manager, if one exists.
 *
 * @param {ServiceWorkerRegistration} registration The service worker registration.
 * @returns {Promise} Promise that resolves with PushSubscription or null.
 */
Pushi.prototype.getPushSubscription = function(registration) {
    return registration.pushManager.getSubscription();
};

/**
 * Subscribes the browser to push notifications using the
 * Web Push API. Requires a VAPID public key from the server.
 *
 * @param {ServiceWorkerRegistration} registration The service worker registration.
 * @param {String} vapidPublicKey The VAPID public key in base64url format.
 * @returns {Promise} Promise that resolves with PushSubscription.
 */
Pushi.prototype.subscribeToPush = function(registration, vapidPublicKey) {
    var self = this;

    return new Promise(function(resolve, reject) {
        // converts the base64url public key to Uint8Array
        // as required by the Push API
        var applicationServerKey = self._urlBase64ToUint8Array(vapidPublicKey);

        registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: applicationServerKey
        }).then(function(subscription) {
            resolve(subscription);
        }).catch(function(error) {
            reject(error);
        });
    });
};

/**
 * Extracts the subscription information from a PushSubscription
 * object into a plain object suitable for sending to the server.
 *
 * @param {PushSubscription} subscription The browser's push subscription.
 * @returns {Object} Object containing endpoint, p256dh, and auth keys.
 */
Pushi.prototype.extractSubscriptionInfo = function(subscription) {
    var json = subscription.toJSON();
    return {
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth
    };
};

/**
 * Sends the push subscription to the Pushi server to register
 * for notifications on a specific event/channel.
 *
 * @param {Object} subscriptionInfo Object with endpoint, p256dh, auth.
 * @param {String} event The event/channel name to subscribe to.
 * @param {Object} options Optional settings (auth, unsubscribe).
 * @returns {Promise} Promise that resolves with server response.
 */
Pushi.prototype.sendSubscriptionToServer = function(subscriptionInfo, event, options) {
    var self = this;
    options = options || {};

    var url = this._buildApiUrl("/web_pushes");

    if (options.auth) {
        url += "&auth=" + encodeURIComponent(options.auth);
    }
    if (options.unsubscribe !== undefined) {
        url += "&unsubscribe=" + options.unsubscribe;
    }

    var data = {
        endpoint: subscriptionInfo.endpoint,
        p256dh: subscriptionInfo.p256dh,
        auth: subscriptionInfo.auth,
        event: event
    };

    return new Promise(function(resolve, reject) {
        var request = new XMLHttpRequest();
        request.open("POST", url, true);
        request.setRequestHeader("Content-Type", "application/json");
        request.onreadystatechange = function() {
            if (request.readyState !== 4) {
                return;
            }

            if (request.status === 200 || request.status === 201) {
                var result = JSON.parse(request.responseText);
                resolve(result);
            } else {
                var error = new Error("Failed to send subscription to server: " + request.status);
                reject(error);
            }
        };
        request.send(JSON.stringify(data));
    });
};

/**
 * Removes the push subscription from the Pushi server for a
 * specific event/channel or all events if event is not provided.
 *
 * @param {String} endpoint The push endpoint URL.
 * @param {String} event The event/channel (optional, removes all if not provided).
 * @returns {Promise} Promise that resolves with server response.
 */
Pushi.prototype.removeSubscriptionFromServer = function(endpoint, event) {
    var self = this;

    var path = "/web_pushes/" + encodeURIComponent(endpoint);
    var url = this._buildApiUrl(path);
    if (event) {
        url += "&event=" + encodeURIComponent(event);
    }

    return new Promise(function(resolve, reject) {
        var request = new XMLHttpRequest();
        request.open("DELETE", url, true);
        request.onreadystatechange = function() {
            if (request.readyState !== 4) {
                return;
            }

            if (request.status === 200) {
                var result = JSON.parse(request.responseText);
                resolve(result);
            } else {
                var error = new Error("Failed to remove subscription from server: " + request.status);
                reject(error);
            }
        };
        request.send();
    });
};

/**
 * High-level method to set up Web Push notifications. This handles
 * the complete flow: requesting permission, registering service worker,
 * subscribing to push, and registering with the server.
 *
 * @param {String} event The event/channel to subscribe to.
 * @param {Object} options Configuration options including:
 *   - swPath: Service worker path (default: '/sw.js')
 *   - auth: Authentication token for private channels
 *   - unsubscribe: Remove existing subscriptions (default: true)
 * @returns {Promise} Promise that resolves with the subscription info.
 */
Pushi.prototype.setupWebPush = function(event, options) {
    var self = this;
    options = options || {};

    var registration = null;
    var vapidPublicKey = null;

    return this.requestNotificationPermission()
        .then(function(permission) {
            if (permission !== "granted") {
                throw new Error("Notification permission denied");
            }
            return self.registerServiceWorker(options.swPath);
        })
        .then(function(reg) {
            registration = reg;
            return self.getVapidPublicKey();
        })
        .then(function(key) {
            vapidPublicKey = key;
            return self.subscribeToPush(registration, vapidPublicKey);
        })
        .then(function(subscription) {
            var info = self.extractSubscriptionInfo(subscription);
            return self.sendSubscriptionToServer(info, event, options)
                .then(function(result) {
                    return {
                        subscription: subscription,
                        subscriptionInfo: info,
                        serverResponse: result
                    };
                });
        });
};

/**
 * High-level method to unsubscribe from Web Push notifications.
 * This removes the subscription from both the browser and the server.
 *
 * @param {String} event The event/channel to unsubscribe from (optional).
 * @returns {Promise} Promise that resolves when unsubscribed.
 */
Pushi.prototype.teardownWebPush = function(event) {
    var self = this;

    return navigator.serviceWorker.ready
        .then(function(registration) {
            return registration.pushManager.getSubscription();
        })
        .then(function(subscription) {
            if (!subscription) {
                return null;
            }

            var endpoint = subscription.endpoint;

            // unsubscribes from the browser first, then removes
            // the subscription from the server
            return subscription.unsubscribe()
                .then(function() {
                    return self.removeSubscriptionFromServer(endpoint, event);
                });
        });
};

/**
 * Builds an API URL with the app key parameter. This is used
 * internally by the Web Push methods to construct request URLs.
 *
 * @param {String} path The API path (e.g., '/vapid_key').
 * @returns {String} The complete API URL with app key.
 * @private
 */
Pushi.prototype._buildApiUrl = function(path) {
    // determines the HTTP API base URL from options or derives it
    // from the WebSocket URL by replacing the protocol
    var baseWebUrl = this.baseWebUrl;
    if (!baseWebUrl) {
        baseWebUrl = this.baseUrl.replace("wss://", "https://").replace("ws://", "http://");
    }
    baseWebUrl = baseWebUrl.replace(/\/$/, "");

    // builds the complete URL with app key parameter
    var url = baseWebUrl + path;
    url += (url.indexOf("?") === -1 ? "?" : "&") + "app_key=" + this.appKey;
    return url;
};

/**
 * Converts a base64url string to Uint8Array. This is used
 * internally to convert the VAPID public key to the format
 * required by the Push API (applicationServerKey).
 *
 * @param {String} base64String Base64url encoded string.
 * @returns {Uint8Array} The decoded bytes.
 * @private
 */
Pushi.prototype._urlBase64ToUint8Array = function(base64String) {
    // adds padding if needed (base64url doesn't require padding
    // but atob requires it)
    var padding = "=".repeat((4 - base64String.length % 4) % 4);
    var base64 = (base64String + padding)
        .replace(/-/g, "+")
        .replace(/_/g, "/");

    var rawData = window.atob(base64);
    var outputArray = new Uint8Array(rawData.length);

    for (var i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
};

if (typeof String.prototype.startsWith !== "function") {
    String.prototype.startsWith = function(string) {
        return this.slice(0, string.length) === string;
    };
}
