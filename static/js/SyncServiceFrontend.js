

function getCookie(name) {
    var matches = document.cookie.match(new RegExp(
        "(?:^|; )" + name.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, '\\$1') + "=([^;]*)"
    ));
    return matches ? decodeURIComponent(matches[1]) : undefined;
}

/**
 * Возвращает тип устройства, на котором запущен скрипт - 'mobile', 'admin_console' или 'projector'.
 */
function getDeviceType() {
    var deviceType = document.body.getAttribute('data-device-type');
    if (!deviceType) {
        console.error('Device type not specified in the body tag.');
    }
    return deviceType;
}

function getDeviceModel() {
    return 'Mobile Device'
}


/******************************* PRIVATE MEMBERS *******************************/


function _handleWSMessage(message) {
    if (message.source === 'system' && message.event === 'access_granted') {
        if (this.handshakeCallback) {
            this.handshakeCallback(message.payload || {})
        }
        return
    }

    if (message.source === 'system' && message.event === 'access_denied') {
        if (message.payload.reason === 'Invalid session identifier.') {
            if (this.handshakeCallback) {
                this.handshakeCallback(undefined, 'WRONG_SESSION_ID')
            }
            return
        }
    }

    if (message.source === 'system' && message.event === 'session_terminated') {
        if (this.onSessionTerminated) {
            this.onSessionTerminated()
        }
        return
    }

    _notifyMessage.call(this, message);
}

function _performHandshake(sessionId) {
    var deviceType = getDeviceType();

    var handshakeMessage = {
        source: 'device',
        event: 'handshake',
        payload: {
            deviceType,
        },
    };

    if (deviceType === 'mobile') {
        if (!sessionId) {
            return console.error('No session id was passed. Cannot perform handshake.');
        }

        handshakeMessage.payload.sessionId = sessionId;
        handshakeMessage.payload.deviceModel = getDeviceModel();
    }

    if (deviceType === 'projector') {
        if (!sessionId) {
            return console.error('No session id was passed. Cannot perform handshake.');
        }

        handshakeMessage.payload.sessionId = sessionId;
    }

    if (deviceType === 'admin_console') {
        var accessToken = localStorage.accessToken;
        if (!accessToken) {
            return console.error('No access token found in cookies. Cannot perform handshake.');
        }

        handshakeMessage.payload.accessToken = accessToken;
    }

    var messageString = JSON.stringify(handshakeMessage)
    this.socket.send(messageString);
}

function _notifyMessage(msg) {
    for (const key in this.onMessageCallbacks) {
        this.onMessageCallbacks[key](msg);
    }
}


/******************************* CLASS DEFINITION *******************************/


function SyncServiceFrontend(host, port) {
    this.host = host;
    this.port = port;
    this.onMessageCallbacks = {};
    this.onSessionTerminated = null;
    this.onConnectionError = null;
    this.handshakeCallback = null;
    this.socket = null;
}

SyncServiceFrontend.prototype.connect = function (callback, sessionId) {
    this.handshakeCallback = callback;
    this.socket = new WebSocket(`ws://${this.host}:${this.port}`);
    this.socket.onopen = () => _performHandshake.call(this, sessionId);
    this.socket.onmessage = (event) => _handleWSMessage.call(this, JSON.parse(event.data));
    this.socket.onerror = () => {
        console.error('WS CONNECTION ERROR');
        if (this.onConnectionError) {
            this.onConnectionError();
        }
    };
    this.socket.onclose = () => console.error('WS CLOSED');
}

/**
 * Отправляет сообщение серверу от имени запущенного приложения.
 * @param {string} event Имя события.
 * @param {object} payload Аргументы события.
 */
SyncServiceFrontend.prototype.sendMessage = function (message) {
    // вызвать callback с аргументами (succeeded)
    if (this.socket) {
        this.socket.send(JSON.stringify(message));
    }
}

SyncServiceFrontend.prototype.isConnected = function () {
    return this.socket && this.socket.readyState == WebSocket.OPEN;
}

SyncServiceFrontend.prototype.addMessageListener = function (name, callback) {
    this.onMessageCallbacks[name] = callback;
}

SyncServiceFrontend.prototype.removeMessageListener = function (name) {
    delete this.onMessageCallbacks[name];
}