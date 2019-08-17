const WebSocket = require('ws')
const getAccessTokenPayload = require('../AccessTokenHelper').getAccessTokenPayload

/**
 * Проверяет целостность объекта сообщения (события).
 * @param {object} msg 
 */
function _isMessageValid(msg) {
    if (!msg) return false;

    if (!msg.source || !msg.event) return false;

    return true;
}

/**
 * Генерирует уникальный идентификатор для обозначения устройства.
 */
function _genrateUniqueIdentifier() {
    this.lastId = this.lastId + 1
    return this.lastId
}

/**
 * Генерирует строку с ошибкой доступа, предназначенную для отправения клиенту.
 * @param {string} reason Повод отказа в доступе.
 */
function _accessDeniedBecause(reason) {
    return JSON.stringify({
        source: 'system',
        event: 'access_denied',
        payload: { reason }
    })
}

function _accessGranted(payload) {
    const o = {
        source: 'system',
        event: 'access_granted'
    }
    if (payload) {
        o.payload = payload
    }
    return JSON.stringify(o)
}

/**
 * Производит процесс рукопожатия (handshake) с данным вебсокетом если это возможно.
 * @param {WebSocket} ws WebSocket, с которым необходимо произвести handshake.
 * @param {object} payload Данные о клиенте.
 * @param {function} onHandshakeSucceeded Обработчик события завершения handshake.
 */
function _performHandshake(ws, payload, onHandshakeSucceeded) {
    console.log("_performHandshake called with payload:");
    console.log(payload);
    // console.log(this.sessionCache)
    try {
        // проверяем входные данные
        if (!['mobile', 'admin_console', 'projector'].includes(payload.deviceType)) {
            ws.send(_accessDeniedBecause('Unknown device type.'))
            ws.close()
            return
        }

        // Проверяем, можно ли сейчас подключить устройство этого типа. Закрываем сокет если нельзя. 
        // Добавляем в сокет имя.
        switch (payload.deviceType) {
            case 'mobile': {
                console.log("it is a mobile device");
                if (!payload.sessionId) {
                    console.log("sessionId was not in the payload. denying.");
                    ws.send(_accessDeniedBecause('Invalid session identifier.'))
                    return ws.close()
                }

                // проверить, есть ли такая сессия
                const sessionState = this.getSessionState(payload.sessionId)
                if (!sessionState.adminConsole) {
                    console.log("admin console with such sessionId is not connected. denying.")
                    ws.send(_accessDeniedBecause('Invalid session identifier.'))
                    return ws.close()
                }

                // генерируем имя
                const deviceModel = payload.deviceModel || 'Mobile Device'
                const devicePostfix = sessionState.mobile.length + 1
                ws.deviceName = `${deviceModel} (${devicePostfix})`

                ws.deviceType = 'mobile'
                ws.sessionId = payload.sessionId
                _invalidateSessionCache.call(this, payload.sessionId)

                const responsePayload = {
                    yourName: ws.deviceName,
                };
                const currentApp = this.sessionOwners[payload.sessionId];
                if (currentApp) {
                    responsePayload.currentApp = currentApp;
                }

                console.log("connection approved.");
                ws.send(_accessGranted(responsePayload))
                break
            }
            case 'projector': {
                console.log("it is a projector");
                if (!payload.sessionId) {
                    console.log("sessionId was not in the payload. denying.");
                    ws.send(_accessDeniedBecause('Invalid session identifier.'))
                    return ws.close()
                }

                // проверить, есть ли такая сессия
                const sessionState = this.getSessionState(payload.sessionId)
                if (!sessionState.adminConsole) {
                    console.log("admin console with such sessionId is not connected. denying.")
                    ws.send(_accessDeniedBecause('Invalid session identifier.'))
                    return ws.close()
                }

                if (sessionState.projector) {
                    console.log("projector already connected. denying.");
                    ws.send(_accessDeniedBecause('Projector already connected.'))
                    return ws.close()
                }

                ws.deviceType = 'projector'
                ws.sessionId = payload.sessionId
                _invalidateSessionCache.call(this, payload.sessionId)

                const currentApp = this.sessionOwners[payload.sessionId];

                console.log("connection approved.");
                ws.send(_accessGranted(currentApp ? { currentApp } : undefined))
                break
            }
            case 'admin_console': {
                console.log("it is an admin console");
                // проверяем входные данные
                if (!payload.accessToken) {
                    console.log("no access token. denying.");
                    return ws.send(_accessDeniedBecause('No access token was provided.'))
                }

                // проверяем токен
                console.log("checking access token");
                const tokenPayload = getAccessTokenPayload(payload.accessToken)
                const userId = tokenPayload.userId

                // отправляем ошибку если сессия занята
                let sessionId = this.sessionIdsForUserIds[userId]
                if (sessionId) {
                    console.log("max amount of sessions already reached. denying.");
                    ws.send(_accessDeniedBecause('Maximum count of sessions has been reached.'))
                    return ws.close()
                }

                // начать сессию
                sessionId = _genrateUniqueIdentifier.call(this)
                this.sessionIdsForUserIds[userId] = sessionId

                ws.deviceType = 'admin_console'
                ws.sessionId = sessionId
                ws.userId = userId

                console.log("connection approved");
                ws.send(_accessGranted({ sessionId }))
                break
            }
        }
        // console.log('about to call onHandshakeSucceeded')
        onHandshakeSucceeded()
    }
    catch (err) {
        if (err.name === 'JsonWebTokenError') {
            console.log("invalid token. denying connection.")
            // обработка неправильного токена
            ws.send(_accessDeniedBecause('Invalid token.'))
            return ws.close()
        }
        else {
            console.log('error when trying to perform handshake')
            console.log(err)
            return ws.close()
        }

    }
}

function _getCurrentApp(sessionId) {
    const appName = this.sessionOwners[sessionId]
    if (appName) {
        return this.apps[appName]
    } else {
        return undefined
    }
}

/**
 * Оповещает все приложения, что подключилось новое устройство.
 * @param {WebSocket} ws WebSocket, который подключился.
 */
function _notifyDeviceConnected(ws) {
    console.log(`_notifyDeviceConnected called for WS ${ws.sessionId} ${ws.deviceType} (name: ${ws.deviceName})`);

    // если отключилась админка, оповещать еще некого
    if (ws.deviceType === 'admin_console') { return }

    // если подключилось моб. устройство или проектор, оповестить админку и текущее приложение
    const sessionCache = _getSessionCache.call(this, ws.sessionId)
    const adminConsoleConnection = sessionCache.adminConsole
    const currentApp = _getCurrentApp.call(this, ws.sessionId)

    if (ws.deviceType === 'mobile') {
        // оповестить админку
        const msg = {
            source: 'system',
            event: 'device_connected',
            payload: {
                deviceType: ws.deviceType,
                deviceName: ws.deviceName
            }
        }
        adminConsoleConnection.send(JSON.stringify(msg))
        // оповестить приложение
        if (currentApp) {
            currentApp.deviceConnected(ws.deviceType, ws.deviceName, ws.sessionId)
        }
    }

    if (ws.deviceType === 'projector') {
        // оповестить админку
        const msg = {
            source: 'system',
            event: 'device_connected',
            payload: {
                deviceType: ws.deviceType
            }
        }
        adminConsoleConnection.send(JSON.stringify(msg))
        // оповестить приложение
        if (currentApp) {
            currentApp.deviceConnected(ws.deviceType, undefined, ws.sessionId)
        }
    }
}

function _handleAppLaunched(ws, payload, sessionId) {
    // позволять запускать только с админки
    if (ws.deviceType !== 'admin_console') {
        return ws.send(_accessDeniedBecause('Applications can only be launched from the admin console.'))
    }

    // не позволять запускать второе приложение
    if (this.sessionOwners[sessionId]) {
        return ws.send(_accessDeniedBecause('Session is already reserved by different app.'))
    }

    const appName = payload.name
    const app = this.apps[appName]
    if (app) {
        // инициализировать сессию в приложении
        app.appLaunched(sessionId, payload.args || {})
        // занять sessionOwners[sessionId]
        this.sessionOwners[sessionId] = appName
        // отправить сообщение телефонам и проектору
        const session = _getSessionCache.call(this, sessionId)
        const msg = JSON.stringify({
            source: 'system',
            event: 'app_launched',
            payload: {
                name: appName,
                args: payload.args
            }
        })
        if (session.projector) {
            session.projector.send(msg)
        }
        session.mobile.forEach((device) => {
            device.send(msg)
        })
    } else {
        // если такого приложения не нашлось, не занимать сессию
        // TODO: отправить ошибку
    }
}

function _handleCurrentAppClosed(ws, sessionId) {
    // позволять запускать только с админки
    if (ws.deviceType !== 'admin_console') {
        return ws.send(_accessDeniedBecause('Applications can only be closed from the admin console.'))
    }

    if (!this.sessionOwners[sessionId]) { return }
    // закрыть сессию в приложении
    const appName = this.sessionOwners[sessionId]
    if (appName) {
        const app = this.apps[appName]
        delete this.sessionOwners[sessionId]
        app.appClosed(sessionId)
        // отправить сообщение телефонам и проектору
        const session = _getSessionCache.call(this, sessionId)
        const msg = JSON.stringify({
            source: 'system',
            event: 'current_app_closed'
        })
        if (session.projector) {
            session.projector.send(msg)
        }
        session.mobile.forEach((device) => {
            device.send(msg)
        })
    } else {
        // TODO: отправить ошибку, что никакого приложения запущено не было
    }
}

/**
 * Обрабатывает входящее сообщение и перенаправляет его нужному приложению.
 * @param {WebSocket} ws WebSocket, от которого поступило сообщение.
 * @param {string} messageString Строка с полученным сообщением.
 */
function _handleIncomingMessage(ws, messageString) {
    let messageObject = {}
    try {
        messageObject = JSON.parse(messageString)
    }
    catch (err) {
        console.log(err)
        // TODO: отправить ошибку 'Message was not valid JSON.'
        return
    }

    if (messageObject.payload && messageObject.payload.sessionId) {
        messageObject.payload.sessionId = parseInt(messageObject.payload.sessionId);
    }

    // проверяем целостность полученных от клиента данных
    if (!_isMessageValid.call(this, messageObject)) return

    // проводим авторизацию
    if (messageObject.source === "device" && messageObject.event === "handshake") {
        return _performHandshake.call(this, ws, messageObject.payload || {}, () => {
            _notifyDeviceConnected.call(this, ws)
        })
    }

    // проверяем, авторизован ли сокет
    if (!ws.sessionId) {
        ws.send(_accessDeniedBecause.call(this, 'Unauthorized.'))
        return
    }



    if (messageObject.source == "device") {
        if (messageObject.event === 'app_launched') {
            return _handleAppLaunched.call(this, ws, messageObject.payload, ws.sessionId)
        }

        if (messageObject.event === 'current_app_closed') {
            return _handleCurrentAppClosed.call(this, ws, ws.sessionId)
        }

        // возвращаем, потому что если event равен чему-то другому, кроме того,
        // что выше, то код пойдет дальше и device будет считаться приложением
        return
    }

    // передаем сообщение приложению
    const currentAppName = this.sessionOwners[ws.sessionId]
    if (currentAppName !== messageObject.source) {
        return ws.send(_accessDeniedBecause.call(this, 'This app is not launched.'))
    }

    const currentApp = _getCurrentApp.call(this, ws.sessionId)
    currentApp.handleEvent(messageObject, ws.deviceName, ws.deviceType, ws.sessionId)
}

/**
 * Обрабатывает закртие подключения по инициативе клиента.
 * @param {WebSocket} ws WebSocket, который отключился.
 */
function _handleClientClosed(ws) {
    console.log(`WS closed: ${ws.sessionId} ${ws.deviceType} (name: ${ws.deviceName})`);
    if (!ws.sessionId) { return }

    const currentApp = _getCurrentApp.call(this, ws.sessionId)
    _invalidateSessionCache.call(this, ws.sessionId)
    const sessionCache = _getSessionCache.call(this, ws.sessionId)

    if (ws.deviceType === 'admin_console') {
        console.log(`Admin console disconnected for session ${ws.sessionId}`);

        // оповестить приложение
        if (currentApp) {
            console.log(`Calling sessionTerminated hook for current app in session ${ws.sessionId}`);
            currentApp.sessionTerminated(ws.sessionId)
        }

        // оповестить мобильные устройства и закрыть их сокеты
        const msg = JSON.stringify({
            source: 'system',
            event: 'session_terminated',
            payload: { reason: 'Admin console disconnected unexpectedly.' }
        })
        sessionCache.mobile.forEach(function (mobileWS) {
            console.log(`Notifying and disconnecting mobile device ${mobileWS.deviceName} from terminated session ${mobileWS.sessionId}.`);
            mobileWS.send(msg)
            ws.close()
        })

        // оповестить проектор и закрыть его сокет
        if (sessionCache.projector) {
            console.log(`Notifying and disconnecting projector in terminated session ${ws.sessionId}.`);
            sessionCache.projector.send(msg)
            sessionCache.projector.close()
        }

        delete this.sessionOwners[ws.sessionId]
        delete this.sessionIdsForUserIds[ws.userId]
    }

    if (ws.deviceType === 'mobile') {
        if (!sessionCache.adminConsole) {
            // игнорируем случаи, когда устройство было отключено по причине отключения админка
            return
        }

        // TODO: обработать случай, когда приложение было отключено другим приложением, но админка все еще не подключена (?)

        if (currentApp) {
            currentApp.deviceDisconnected(ws.deviceType, ws.deviceName, ws.sessionId)
        }

        const msg = {
            source: 'system',
            event: 'device_disconnected',
            payload: {
                deviceType: 'mobile',
                deviceName: ws.deviceName
            }
        }

        sessionCache.adminConsole.send(JSON.stringify(msg))
    }

    if (ws.deviceType === 'projector') {
        if (!sessionCache.adminConsole) {
            // игнорируем случаи, когда устройство было отключено по причине отключения админка
            return
        }

        // TODO: обработать случай, когда приложение было отключено другим приложением, но админка все еще не подключена (?)

        if (currentApp) {
            currentApp.deviceDisconnected(ws.deviceType, undefined, ws.sessionId)
        }

        const msg = {
            source: 'system',
            event: 'device_disconnected',
            payload: {
                deviceType: 'projector'
            }
        }
        sessionCache.adminConsole.send(JSON.stringify(msg))
    }
}

function _invalidateSessionCache(sessionId) {
    delete this.sessionCache[sessionId]
    console.log(`Cache for session ${sessionId} has been invalidated.`);
}

function _getSessionCache(sessionId) {
    console.log(`_getSessionCache called for session ${sessionId}`)
    if (this.sessionCache[sessionId]) {
        console.log("_getSessionCache: returning cached state")
        return this.sessionCache[sessionId]
    }
    console.log("_getSessionCache: computing state")
    // считаем состояние
    const cache = {
        projector: undefined,
        adminConsole: undefined,
        mobile: []
    }

    for (const ws of this.wss.clients) {
        if (ws.sessionId == sessionId) {
            switch (ws.deviceType) {
                case 'mobile':
                    cache.mobile.push(ws)
                    break
                case 'projector':
                    cache.projector = ws
                    break
                case 'admin_console':
                    cache.adminConsole = ws
                    break
            }
        }
    }

    this.sessionCache[sessionId] = cache

    const newStateFormatted = {
        projector: undefined,
        adminConsole: undefined,
        mobile: []
    }
    newStateFormatted.projector = cache.projector ? true : false
    newStateFormatted.adminConsole = cache.adminConsole ? true : false
    cache.mobile.forEach((mobileDevice) => {
        newStateFormatted.mobile.push(mobileDevice.deviceName)
    })
    console.log(newStateFormatted);
    console.log(`WS clients connected: ${this.wss.clients.size}`);

    return cache
}

class SyncService {
    constructor() {
        this.apps = {}
        this.lastId = 1000
        this.sessionCache = {}
        this.sessionIdsForUserIds = {}
        this.sessionOwners = {}
    }

    /**
     * Инициализирует внутренний WebSocket-сервер и начинает прослушивание на данном порте.
     * @param {number} port Порт, на котором следует открыть WebSocket-сервер.
     */
    listen(port) {
        this.wss = new WebSocket.Server({ port })

        this.wss.on('listening', (ws) => {
            console.log(`SyncService listening on port ${port}`)
        })

        this.wss.on('error', (ws) => {
            console.log('SyncService error')
        })

        this.wss.on('connection', (ws) => {
            // TODO: НЕ ПОЗВОЛЯТЬ ПОДКЮЧАТЬ БОЛЬШЕ 10 УСТРОЙСТВ ДЛЯ ИЗБЕЖАНИЯ DDOS ?
            ws.on('message', (messageString) => {
                try {
                    console.log('received message');
                    _handleIncomingMessage.call(this, ws, messageString)
                } catch (err) {
                    console.log('error during handling of message');
                    console.log(err);
                }
            })

            ws.on('close', () => {
                _handleClientClosed.call(this, ws)
            })

        })

        // TODO: запустить цикл поиска битых сокетов
    }

    /**
     * Возвращает состояние некоторой сессии. 
     * Возвращаемые данные включают имена подключенных устройств.
     * @param {string} sessionId Идентификатор сессии, состояние которой необходимо получить.
     */
    getSessionState(sessionId) {
        const internalState = _getSessionCache.call(this, sessionId)

        const result = {
            projector: undefined,
            adminConsole: undefined,
            mobile: []
        }

        result.projector = internalState.projector ? true : false
        result.adminConsole = internalState.adminConsole ? true : false
        internalState.mobile.forEach((mobileDevice) => {
            result.mobile.push(mobileDevice.deviceName)
        })

        return result
    }

    /**
     * Выполяет подписку на события в определенном приложении.
     * @param {string} appName Имя источника, на который необзодимо подписаться.
     * @param {function} notificationHandler Функция, обрабатывабщая будущие события в этом приложении.
     */
    subscribe(appName, notificationHandler) {
        notificationHandler.syncService = this;
        this.apps[appName] = notificationHandler;
    }

    /**
     * Отправляет сообщение на некоторое устройство.
     * @param {string} deviceName Имя устройства, на которое необходимо отправить сообщение.
     * @param {string} sessionId Идентификатор сессии, владеющей устройством, на которое отправляется сообщение.
     * @param {object} message Сообщение, которое необходимо отправить.
     */
    sendMessageToDevice(deviceType, deviceName, sessionId, message) {
        // console.log(this);
        const internalSessionState = _getSessionCache.call(this, sessionId)
        const messageString = JSON.stringify(message)

        switch (deviceType) {
            case 'projector':
                if (internalSessionState.projector) {
                    internalSessionState.projector.send(messageString)
                }
                break
            case 'admin_console':
                if (internalSessionState.adminConsole) {
                    internalSessionState.adminConsole.send(messageString)
                }
                break
            case 'mobile':
                internalSessionState.mobile.forEach((mobileDevice) => {
                    if (mobileDevice.deviceName === deviceName) {
                        mobileDevice.send(messageString)
                    }
                })
                break
        }
    }

    exitCurrentApp(sessionId, message) {
        if (!this.sessionOwners[sessionId]) { return }

        delete this.sessionOwners[sessionId];

        const session = _getSessionCache.call(this, sessionId);
        const msg = JSON.stringify({
            source: 'system',
            event: 'current_app_exited',
            payload: {
                message
            }
        });
        if (session.projector) {
            session.projector.send(msg);
        }
        session.mobile.forEach((device) => {
            device.send(msg);
        })
        session.adminConsole.send(msg);
    }
}

module.exports = { SyncService }