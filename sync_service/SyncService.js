const WebSocket = require('ws')
const getAccessTokenPayload = require('../AccessTokenChecker').getAccessTokenPayload
const secretKey = require('../key').tokenKey

class SyncService {
    constructor() {
        this.apps = {}
        this.lastId = 1000
        this.sessionCache = {}
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

    /**
     * Производит процесс рукопожатия (handshake) с данным вебсокетом если это возможно.
     * @param {WebSocket} ws WebSocket, с которым необходимо произвести handshake.
     * @param {object} payload Данные о клиенте.
     * @param {function} onHandshakeSucceeded Обработчик события завершения handshake.
     */
    async _performHandshake(ws, payload, onHandshakeSucceeded) {
        try {
            // проверяем входные данные
            if (!payload.accessToken || !payload.deviceModel || !payload.deviceType
                || !['mobile', 'admin_console', 'projector'].includes(payload.deviceType)) {
                return
            }

            // проверяем токен
            const tokenPayload = await getAccessTokenPayload(payload.accessToken, secretKey)
            const userId = tokenPayload.userId

            // Проверяем, можно ли сейчас подключить устройство этого типа. Закрываем сокет если нельзя. 
            // Добавляем в сокет имя.
            const sessionState = this.getSessionState(userId)
            switch (payload.deviceType) {
                case 'mobile':
                    // генерируем имя
                    const deviceId = this._genrateUniqueIdentifier()
                    ws.deviceName = `${payload.deviceModel} (${deviceId})`
                    break
                case 'projector':
                    if (sessionState.projector) {
                        ws.send(this._accessDeniedBecause('Projector already connected.'))
                        return ws.close()
                    }
                    ws.deviceName = 'Projector'
                    break
                case 'admin_console':
                    if (sessionState.adminConsole) {
                        ws.send(this._accessDeniedBecause('Admin console already connected.'))
                        return ws.close()
                    }
                    ws.deviceName = 'Admin Console'
                    break
            }

            ws.deviceType = payload.deviceType
            ws.userId = userId
            
            this._invalidateSessionCacheForUser(userId)

            ws.send(JSON.stringify({
                source: 'system',
                event: 'access_granted',
                payload: {
                    yourName: ws.deviceName
                }
            }))

            onHandshakeSucceeded()
        }
        catch (err) {
            console.log(err)
            // обработка неправильного токена
            ws.send(JSON.stringify({
                source: 'system',
                event: 'access_denied',
                payload: { reason: 'Invalid token.' }
            }))
            return ws.close()
        }
    }

    /**
     * Оповещает все приложения, что подключилось новое устройство.
     * @param {WebSocket} ws WebSocket, который подключился.
     */
    _notifyDeviceConnected(ws) {
        // оповещаем всех, что подключилось устройство
        for (const appName in this.apps) {
            // вызываем обработчик приложения
            const notificationHandler = this.apps[appName]
            const deviceConnectedMessage = {
                source: 'system',
                event: 'device_connected',
                payload: {
                    deviceName: ws.deviceName,
                    deviceType: ws.deviceType
                }
            }
            notificationHandler(deviceConnectedMessage, ws.deviceName, ws.deviceType, ws.userId)
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
        catch(err) {
            console.log(err)
            return
        }

        // проверяем целостность полученных от клиента данных
        if (!this._isMessageValid(messageObject)) return

        if (messageObject.source === "device" && messageObject.event === "handshake") {
            return this._performHandshake(ws, messageObject.payload || {}, () => {
                this._notifyDeviceConnected(ws)
            })
        }

        // проверяем, авторизован ли сокет
        if (!ws.userId) {
            ws.send(this._accessDeniedBecause('Unauthorized.'))
            return
        }

        // перебираем все приложения и смотрим куда это можно отправить
        for (const appName in this.apps) {
            if (appName === messageObject.source) {
                // вызываем обработчик приложения
                const notificationHandler = this.apps[appName]
                notificationHandler(messageObject, ws.deviceName, ws.deviceType, ws.userId)
            }
        }
    }

    /**
     * Обрабатывает закртие подключения по инициативе клиента.
     * @param {WebSocket} ws WebSocket, который отключился.
     */
    _handleClientClosed(ws) {
        // проверяем, был ли авторизован сокет. если нет, не будем уведомлять о его отключении
        if (!ws.userId) {
            return
        }

        this._invalidateSessionCacheForUser(ws.userId)

        for (const appName in this.apps) {
            const notificationHandler = this.apps[appName]
            const message = {
                source: 'system',
                event: 'device_disconnected',
                payload: {
                    deviceName: ws.deviceName,
                    deviceType: ws.deviceType
                }
            }
            notificationHandler(message, ws.deviceName, ws.deviceType, ws.userId)
        }
    }

    _invalidateSessionCacheForUser(userId) {
        this.sessionCache[userId] = undefined
    }

    _getSessionCacheForUser(userId) {
        if (this.sessionCache[userId]) {
            return this.sessionCache[userId]
        }

        // считаем состояние
        const cache = {
            projector: undefined,
            adminConsole: undefined,
            mobile: []
        }

        for (const ws of this.wss.clients) {
            if (ws.userId === userId) {
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
        this.sessionCache[userId] = cache
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
        const internalState = this._getSessionCacheForUser(sessionId)

        const result = {
            projector: undefined,
            adminConsole: undefined,
            mobile: []
        }

        result.projector = (internalState.projector || {}).deviceName
        result.adminConsole = (internalState.adminConsole || {}).deviceName
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
    watch(appName, notificationHandler) {
        this.apps[appName] = notificationHandler
    }

    /**
     * Отправляет сообщение на некоторое устройство.
     * @param {string} deviceName Имя устройства, на которое необходимо отправить сообщение.
     * @param {string} sessionId Идентификатор сессии, владеющей устройством, на которое отправляется сообщение.
     * @param {object} message Сообщение, которое необходимо отправить.
     */
    sendMessageToDevice(deviceType, deviceName, sessionId, message) {
        const internalSessionState = this._getSessionCacheForUser(sessionId)
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

module.exports = SyncService