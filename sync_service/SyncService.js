const WebSocket = require('ws')
const getAccessTokenPayload = require('../AccessTokenChecker').getAccessTokenPayload
// const secretKey = require('../key').tokenKey

class SyncService {
    constructor() {
        this.apps = {}
        this.lastId = 1000
        this.sessionCache = {}
        this.sessionIdsForUserIds = {}
        this.userIdsForSessionIds = {}
        this.sessionOwners = {}
    }

    /**
     * Проверяет целостность объекта сообщения (события).
     * @param {object} msg 
     */
    _isMessageValid(msg) {
        if (!msg) return false;

        if (!msg.source || !msg.event) return false;

        return true;
    }

    /**
     * Генерирует уникальный идентификатор для обозначения устройства.
     */
    _genrateUniqueIdentifier() {
        this.lastId = this.lastId + 1
        return this.lastId
    }

    /**
     * Генерирует строку с ошибкой доступа, предназначенную для отправения клиенту.
     * @param {string} reason Повод отказа в доступе.
     */
    _accessDeniedBecause(reason) {
        return JSON.stringify({
            source: 'system',
            event: 'access_denied',
            payload: { reason }
        })
    }

    _accessGranted(payload) {
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
    _performHandshake(ws, payload, onHandshakeSucceeded) {
        try {
            // проверяем входные данные
            if (!['mobile', 'admin_console', 'projector'].includes(payload.deviceType)) {
                // TODO: отправить AccessDeniedBecause('Unknown device type.')
                return
            }

            // Проверяем, можно ли сейчас подключить устройство этого типа. Закрываем сокет если нельзя. 
            // Добавляем в сокет имя.
            switch (payload.deviceType) {
                case 'mobile': {
                    if (!payload.sessionId) {
                        ws.send(this._accessDeniedBecause('Invalid session identifier.'))
                        return ws.close()
                    }

                    // проверить, есть ли такая сессия
                    const sessionState = this.getSessionState(payload.sessionId)
                    if (!sessionState.adminConsole) {
                        ws.send(this._accessDeniedBecause('Invalid session identifier.'))
                        return ws.close()
                    }

                    // генерируем имя
                    const deviceModel = payload.deviceModel || 'Mobile Device'
                    const devicePostfix = sessionState.mobile.length + 1 //this._genrateUniqueIdentifier()
                    ws.deviceName = `${deviceModel} (${devicePostfix})`

                    ws.deviceType = 'mobile'
                    ws.sessionId = payload.sessionId
                    this._invalidateSessionCache(payload.sessionId)
                    ws.send(this._accessGranted({ yourName: ws.deviceName }))
                    break
                }
                case 'projector': {
                    if (!payload.sessionId) {
                        ws.send(this._accessDeniedBecause('Invalid session identifier.'))
                        return ws.close()
                    }

                    // проверить, есть ли такая сессия
                    const sessionState = this.getSessionState(payload.sessionId)
                    if (!sessionState.adminConsole) {
                        ws.send(this._accessDeniedBecause('Invalid session identifier.'))
                        return ws.close()
                    }

                    if (sessionState.projector) {
                        ws.send(this._accessDeniedBecause('Projector already connected.'))
                        return ws.close()
                    }

                    ws.deviceType = 'projector'
                    ws.sessionId = payload.sessionId
                    this._invalidateSessionCache(payload.sessionId)
                    ws.send(this._accessGranted())
                    break
                }
                case 'admin_console': {
                    // проверяем входные данные
                    if (!payload.accessToken) {
                        return ws.send(this._accessDeniedBecause('No access token was provided.'))
                    }

                    // проверяем токен
                    const tokenPayload = getAccessTokenPayload(payload.accessToken)
                    const userId = tokenPayload.userId

                    // отправляем ошибку если сессия занята
                    let sessionId = this.sessionIdsForUserIds[userId]
                    if (sessionId) {
                        ws.send(this._accessDeniedBecause('Maximum count of sessions has been reached.'))
                        return ws.close()
                    }

                    // начать сессию
                    sessionId = this._genrateUniqueIdentifier()
                    this.sessionIdsForUserIds[userId] = sessionId

                    ws.deviceType = 'admin_console'
                    ws.sessionId = sessionId
                    ws.userId = userId

                    ws.send(this._accessGranted({ sessionId }))
                    break
                }
            }

            onHandshakeSucceeded()
        }
        catch (err) {
            if (err.name === 'JsonWebTokenError') {
                // обработка неправильного токена
                ws.send(this._accessDeniedBecause('Invalid token.'))
                return ws.close()
            }
            else {
                console.log(err)
                return ws.close()
            }

        }
    }

    _getCurrentApp(sessionId) {
        const appName = this.sessionOwners[sessionId]
        // return appName ? this.apps[appName] : undefined
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
    _notifyDeviceConnected(ws) {
        // если отключилась админка, оповещать еще некого
        if (ws.deviceType === 'admin_console') { return }

        // если подключилось моб. устройство или проектор, оповестить админку и текущее приложение

        const adminConsoleConnection = this._getSessionCache(ws.sessionId).adminConsole
        const currentApp = this._getCurrentApp(ws.sessionId)

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

    _handleAppLaunched(ws, payload, sessionId) {
        // позволять запускать только с админки
        if (ws.deviceType !== 'admin_console') {
            return ws.send(this._accessDeniedBecause('Applications can only be launched from the admin console.'))
        }

        // не позволять запускать второе приложение
        if (this.sessionOwners[sessionId]) {
            return ws.send(this._accessDeniedBecause('Session is already reserved by different app.'))
        }

        const appName = payload.name
        const app = this.apps[appName]
        if (app) {
            // инициализировать сессию в приложении
            app.appLaunched(sessionId, payload.args || {})
            // занять sessionOwners[sessionId]
            this.sessionOwners[sessionId] = appName
        } else {
            // если такого приложения не нашлось, не занимать сессию
            // TODO: отправить ошибку
        }
    }

    _handleCurrentAppClosed(sessionId) {
        if (!this.sessionOwners[sessionId]) { return }
        // закрыть сессию в приложении
        const appName = this.sessionOwners[sessionId]
        if (appName) {
            const app = this.apps[appName]
            delete this.sessionOwners[sessionId]
            app.appClosed(sessionId)

        } else {
            // TODO: отправить ошибку, что никакого приложения запущено не было
        }
    }

    /**
     * Обрабатывает входящее сообщение и перенаправляет его нужному приложению.
     * @param {WebSocket} ws WebSocket, от которого поступило сообщение.
     * @param {string} messageString Строка с полученным сообщением.
     */
    _handleIncomingMessage(ws, messageString) {
        let messageObject = {}
        try {
            messageObject = JSON.parse(messageString)
        }
        catch (err) {
            console.log(err)
            // TODO: отправить ошибку 'Message was not valid JSON.'
            return
        }

        // проверяем целостность полученных от клиента данных
        if (!this._isMessageValid(messageObject)) return

        // проводим авторизацию
        if (messageObject.source === "device" && messageObject.event === "handshake") {
            return this._performHandshake(ws, messageObject.payload || {}, () => {
                this._notifyDeviceConnected(ws)
            })
        }

        // проверяем, авторизован ли сокет
        if (!ws.sessionId) {
            ws.send(this._accessDeniedBecause('Unauthorized.'))
            return
        }

        if (messageObject.source === "device" && messageObject.event === 'app_launched') {
            return this._handleAppLaunched(ws, messageObject.payload, ws.sessionId)
        }

        if (messageObject.source === "device" && messageObject.event === 'current_app_closed') {
            return this._handleCurrentAppClosed(ws.sessionId)
        }

        // передаем сообщение приложению
        /*for (const appName in this.apps) {
            if (appName === messageObject.source) {
                // вызываем обработчик приложения
                const notificationHandler = this.apps[appName]
                notificationHandler(messageObject, ws.deviceName, ws.deviceType, ws.sessionId)
            }
        }*/
        const currentAppName = this.sessionOwners[ws.sessionId]
        if (currentAppName !== messageObject.source) {
            return ws.send(this._accessDeniedBecause('This app is not launched.'))
        }

        const currentApp = this._getCurrentApp(ws.sessionId)
        currentApp.handleEvent(messageObject, ws.deviceName, ws.deviceType, ws.sessionId)
    }

    /**
     * Обрабатывает закртие подключения по инициативе клиента.
     * @param {WebSocket} ws WebSocket, который отключился.
     */
    _handleClientClosed(ws) {
        if (!ws.sessionId) { return }

        const currentApp = this._getCurrentApp(ws.sessionId)
        this._invalidateSessionCache(ws.sessionId)
        const sessionCache = this._getSessionCache(ws.sessionId)

        if (ws.deviceType === 'admin_console') {
            // оповестить приложение
            if (currentApp) {
                currentApp.sessionTerminated(ws.sessionId)
            }

            // оповестить мобильные устройства и закрыть их сокеты
            const msg = {
                source: 'system',
                event: 'session_terminated',
                payload: { reason: 'Admin console disconnected unexpectedly.' }
            }
            sessionCache.mobile.forEach((ws) => {
                ws.send(JSON.stringify(msg))
                ws.close()
            })

            // оповестить проектор и закрыть его сокет
            if (sessionCache.projector) {
                sessionCache.projector.send(JSON.stringify(msg))
                sessionCache.projector.close()
            }

            delete this.sessionOwners[ws.sessionId]
            delete this.sessionIdsForUserIds[ws.sessionId]
        }

        if (ws.deviceType === 'mobile') {
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

    _invalidateSessionCache(sessionId) {
        delete this.sessionCache[sessionId]
        // const userId = this.userIdsForSessionIds[sessionId]
        // delete this.sessionIdsForUserIds[userId]
        // delete this.sessionOwners[sessionId]
    }

    _getSessionCache(sessionId) {
        if (this.sessionCache[sessionId]) {
            return this.sessionCache[sessionId]
        }

        // считаем состояние
        const cache = {
            projector: undefined,
            adminConsole: undefined,
            mobile: []
        }

        for (const ws of this.wss.clients) {
            if (ws.sessionId === sessionId) {
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

        // кэшируем и возвращаем
        this.sessionCache[sessionId] = cache
        return cache
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
                this._handleIncomingMessage(ws, messageString)
            })

            ws.on('close', () => {
                this._handleClientClosed(ws)
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
        const internalState = this._getSessionCache(sessionId)

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
        this.apps[appName] = notificationHandler
    }

    /**
     * Отправляет сообщение на некоторое устройство.
     * @param {string} deviceName Имя устройства, на которое необходимо отправить сообщение.
     * @param {string} sessionId Идентификатор сессии, владеющей устройством, на которое отправляется сообщение.
     * @param {object} message Сообщение, которое необходимо отправить.
     */
    sendMessageToDevice(deviceType, deviceName, sessionId, message) {
        const internalSessionState = this._getSessionCache(sessionId)
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
}

module.exports = { SyncService }