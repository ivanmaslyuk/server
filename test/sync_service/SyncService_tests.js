/* eslint-disable no-undef */
const mocha = require('mocha')
const chai = require('chai')
const chaiSpies = require('chai-spies')
const proxyquire = require('proxyquire')

chai.use(chaiSpies)
const expect = chai.expect
const sandbox = chai.spy.sandbox()

const MockWS = require('./MockWS')
const MockAccessTokenChecker = require('./MockAccessTokenChecker')
const SyncService = proxyquire('../../sync_service/SyncService', { 'ws': MockWS, '../AccessTokenHelper': MockAccessTokenChecker }).SyncService

function AccessDeniedBecause(reason) {
    return {
        source: 'system',
        event: 'access_denied',
        payload: { reason }
    }
}

function AccessGrantedWithPayload(payload) {
    return {
        source: 'system',
        event: 'access_granted',
        payload
    }
}

function AccessGrantedMessage() {
    return {
        source: 'system',
        event: 'access_granted'
    }
}

function HandshakeMessageWithPayload(payload) {
    return {
        source: 'device',
        event: 'handshake',
        payload
    }
}

function AppController() {
    return {
        appLaunched: (sessionId) => { },
        appClosed: (sessionId) => { },
        sessionTerminated: (sessionId) => { },
        deviceConnected: (deviceType, deviceName, sessionId) => { },
        deviceDisconnected: (deviceType, deviceName, sessionId) => { },
        handleEvent: (message, deviceName, deviceType, sessionId) => { }
    }
}

function DeviceConnectedMessage(deviceName, deviceType) {
    const o = {
        source: 'system',
        event: 'device_connected',
        payload: {
            deviceType
        }
    }
    if (deviceName) {
        o.payload.deviceName = deviceName
    }
    return o
}

function DeviceDisonnectedMessage(deviceName, deviceType) {
    const o = {
        source: 'system',
        event: 'device_disconnected',
        payload: {
            deviceType
        }
    }
    if (deviceName) {
        o.payload.deviceName = deviceName
    }
    return o
}

describe('SyncService Test', () => {

    let syncService
    let mockWSS

    beforeEach(() => {
        syncService = new SyncService()
        syncService.listen(0)
        mockWSS = syncService.wss
    })

    it('присылает ошибку, если сообщение пришло в приложение, которое не было запущено', () => {
        // подключаемся
        const connection = mockWSS.simulateConnection('ws-id')
        connection.simulateMessage(HandshakeMessageWithPayload({
            deviceType: 'admin_console',
            accessToken: 'VALID.ACCESS.TOKEN'
        }))
        chai.spy.on(connection, 'send')

        // пытаемся отправить сообщение для незапущенного приложения
        connection.simulateMessage({
            source: 'app',
            event: 'some_event'
        })

        const expectedResponse = AccessDeniedBecause('This app is not launched.')

        expect(connection.send).to.have.been.called.with(JSON.stringify(expectedResponse))
    })

    it('не позволяет запускать приложение, если другое уже запущено', () => {
        syncService.subscribe('app_one', AppController())
        syncService.subscribe('app_two', AppController())

        // подключаемся
        const connection = mockWSS.simulateConnection('ws-id')
        connection.simulateMessage(HandshakeMessageWithPayload({
            deviceType: 'admin_console',
            accessToken: 'VALID.ACCESS.TOKEN'
        }))


        // запускаем первое приложение
        connection.simulateMessage({
            source: 'device',
            event: 'app_launched',
            payload: {
                name: 'app_one'
            }
        })

        // пытаемся запустить второе приложение
        chai.spy.on(connection, 'send')
        connection.simulateMessage({
            source: 'device',
            event: 'app_launched',
            payload: {
                name: 'app_two'
            }
        })

        const expectedResponse = AccessDeniedBecause('Session is already reserved by different app.')

        expect(connection.send).to.have.been.called.with(JSON.stringify(expectedResponse))
    })

    it('если админка отключилась, отправляет остальным устройствам ошибку и отключает их', () => {
        // подключаем админку
        const adminConnection = mockWSS.simulateConnection('admin-ws')
        adminConnection.simulateMessage(HandshakeMessageWithPayload({
            deviceType: 'admin_console',
            accessToken: 'VALID.ACCESS.TOKEN'
        }))
        const sessionId = adminConnection.sessionId

        // подключаем телефон
        const phoneConnection = mockWSS.simulateConnection('phone-ws')
        phoneConnection.simulateMessage(HandshakeMessageWithPayload({
            deviceType: 'mobile',
            sessionId
        }))

        // подключаем проектор
        const projectorConnection = mockWSS.simulateConnection('projector-ws')
        projectorConnection.simulateMessage(HandshakeMessageWithPayload({
            deviceType: 'projector',
            sessionId
        }))

        // отключаем админку
        chai.spy.on(phoneConnection, 'send')
        chai.spy.on(phoneConnection, 'close')
        chai.spy.on(projectorConnection, 'send')
        chai.spy.on(projectorConnection, 'close')
        adminConnection.simulateClose()

        // проверяем
        const expectedResponse = {
            source: 'system',
            event: 'session_terminated',
            payload: { reason: 'Admin console disconnected unexpectedly.' }
        }

        expect(phoneConnection.send).to.have.been.called.with(JSON.stringify(expectedResponse))
        expect(phoneConnection.close).to.have.been.called()
        expect(projectorConnection.send).to.have.been.called.with(JSON.stringify(expectedResponse))
        expect(projectorConnection.close).to.have.been.called()
    })

    it('посылает сообщение об отказе в доступе и закрывает сокет, если админка прислала невалидный токен', () => {
        const mockWS = mockWSS.simulateConnection('1')
        chai.spy.on(mockWS, 'send')
        chai.spy.on(mockWS, 'close')

        const message = HandshakeMessageWithPayload({
            deviceType: 'admin_console',
            accessToken: 'INVALID.ACCESS.TOKEN'
        })

        const connectionRefusal = AccessDeniedBecause('Invalid token.')

        const successResponse = AccessGrantedWithPayload({ yourName: 'Admin Console' })

        mockWS.simulateMessage(message)

        expect(mockWS.send).to.have.been.called.with(JSON.stringify(connectionRefusal))
        expect(mockWS.send).to.have.not.been.called.with(JSON.stringify(successResponse))
        expect(mockWS.close).to.have.been.called()

    })

    it('не позволяет подключить вторую админку', () => {
        const Connection1 = mockWSS.simulateConnection('1')
        const Connection2 = mockWSS.simulateConnection('2')

        chai.spy.on(Connection2, 'send')
        chai.spy.on(Connection2, 'close')

        const handshakeMessage = HandshakeMessageWithPayload({
            deviceType: 'admin_console',
            accessToken: 'userId'
        })

        Connection1.simulateMessage(handshakeMessage)
        Connection2.simulateMessage(handshakeMessage)

        const errorMessage = AccessDeniedBecause('Maximum count of sessions has been reached.')

        expect(Connection2.send).to.have.been.called.with(JSON.stringify(errorMessage))
        expect(Connection2.close).to.have.been.called()
    })

    it('отправляет мобильному устройству его имя при успешной авторизации', () => {
        // подключить админку
        const adminConnection = mockWSS.simulateConnection('admin-ws')
        adminConnection.simulateMessage(HandshakeMessageWithPayload({
            deviceType: 'admin_console',
            accessToken: 'VALID.ACCESS.TOKEN'
        }))

        // подключить мобильное устройство
        const mobileConnection = mockWSS.simulateConnection('mobile-ws')
        chai.spy.on(mobileConnection, 'send')
        mobileConnection.simulateMessage(HandshakeMessageWithPayload({
            deviceType: 'mobile',
            sessionId: adminConnection.sessionId
        }))

        // проверить
        const expectedResponse = AccessGrantedWithPayload({
            yourName: mobileConnection.deviceName
        })
        expect(mobileConnection.send).to.have.been.called.with(JSON.stringify(expectedResponse))
    })

    it('подключает проектор, если он прислал правильный ключ сессии', () => {
        // подключить админку
        const adminConnection = mockWSS.simulateConnection('admin-ws')
        adminConnection.simulateMessage(HandshakeMessageWithPayload({
            deviceType: 'admin_console',
            accessToken: 'VALID.ACCESS.TOKEN'
        }))

        // подключить проектор
        const projectorConnection = mockWSS.simulateConnection('projector-ws')
        chai.spy.on(projectorConnection, 'send')
        projectorConnection.simulateMessage(HandshakeMessageWithPayload({
            deviceType: 'projector',
            sessionId: adminConnection.sessionId
        }))

        // проверить
        const expectedResponse = AccessGrantedMessage()
        expect(projectorConnection.send).to.have.been.called.with(JSON.stringify(expectedResponse))
    })

    it('посылает ошибку и отключает сокет устройства, если оно прислало неправильный ключ сессии', () => {
        // подключаем админку
        const adminConnection = mockWSS.simulateConnection('admin-ws')
        adminConnection.simulateMessage(HandshakeMessageWithPayload({
            deviceType: 'admin_console',
            accessToken: 'VALID.ACCESS.TOKEN'
        }))

        // пытаемся подключить устройство с неправильным sessionId
        const deviceConnection = mockWSS.simulateConnection('projector-ws')
        chai.spy.on(deviceConnection, ['send', 'close'])
        deviceConnection.simulateMessage(HandshakeMessageWithPayload({
            deviceType: 'projector',
            sessionId: 'invalid-session-id'
        }))

        // проверяем
        const expectedResponse = AccessDeniedBecause('Invalid session identifier.')
        expect(deviceConnection.send).to.have.been.called.with(JSON.stringify(expectedResponse))
        expect(deviceConnection.close).to.have.been.called()
    })

    it('посылает события от приложения только обрабочику, подписавшемуся на него', () => {
        // зарегистрировать обработчик
        const appController = AppController()
        syncService.subscribe('app', appController)

        // подключить админку
        const adminConnection = mockWSS.simulateConnection('admin-ws')
        adminConnection.simulateMessage(HandshakeMessageWithPayload({
            deviceType: 'admin_console',
            accessToken: 'VALID.ACCESS.TOKEN'
        }))

        // запустить приложение
        chai.spy.on(appController, ['appLaunched', 'handleEvent', 'appClosed'])
        adminConnection.simulateMessage({
            source: 'device',
            event: 'app_launched',
            payload: {
                name: 'app'
            }
        })
        expect(appController.appLaunched).to.have.been.called.with(adminConnection.sessionId)

        // отправить сообщение в приложение
        const message1 = { source: 'app', event: 'some_event' }
        adminConnection.simulateMessage(message1)
        expect(appController.handleEvent).to.have.been.called.with(message1, undefined, 'admin_console', adminConnection.sessionId)

        // отправить сообщение в другое приложение
        const message2 = { source: 'different_app', event: 'some_event' }
        adminConnection.simulateMessage(message2)
        expect(appController.handleEvent).to.have.not.been.called.with(message2, undefined, 'admin_console', adminConnection.sessionId)

        // закрыть текущее приложение
        adminConnection.simulateMessage({
            source: 'device',
            event: 'current_app_closed'
        })
        expect(appController.appClosed).to.have.been.called.with(adminConnection.sessionId)
    })

    it('если админка отключилась, вызывает функцию sessionTerminated у текущего приложения', () => {
        // привязать обработчик
        const appController = AppController()
        syncService.subscribe('app', appController)

        // подключить админку
        const adminConnection = mockWSS.simulateConnection('admin-ws')
        adminConnection.simulateMessage(HandshakeMessageWithPayload({
            deviceType: 'admin_console',
            accessToken: 'VALID.ACCESS.TOKEN'
        }))

        // заупстить приложение
        chai.spy.on(appController, 'sessionTerminated')
        adminConnection.simulateMessage({
            source: 'device',
            event: 'app_launched',
            payload: {
                name: 'app'
            }
        })

        // отключить админку
        const sessionId = adminConnection.sessionId
        adminConnection.simulateClose()

        // проверить
        expect(appController.sessionTerminated).to.have.been.called.with(sessionId)
    })

    it('оповещает админку о том, что подключились/отключились проектор или телефон', () => {
        // подключить админку
        const adminConnection = mockWSS.simulateConnection('admin-ws')
        adminConnection.simulateMessage(HandshakeMessageWithPayload({
            deviceType: 'admin_console',
            accessToken: 'VALID.ACCESS.TOKEN'
        }))
        chai.spy.on(adminConnection, 'send')

        // подключить телефон
        const mobileConnection = mockWSS.simulateConnection('mobile-ws')
        chai.spy.on(mobileConnection, 'send')
        mobileConnection.simulateMessage(HandshakeMessageWithPayload({
            deviceType: 'mobile',
            sessionId: adminConnection.sessionId
        }))
        const mobileConnectedMessage = DeviceConnectedMessage(mobileConnection.deviceName, 'mobile')
        expect(adminConnection.send).to.have.been.called.with(JSON.stringify(mobileConnectedMessage))

        // подключить проектор
        const projectorConnection = mockWSS.simulateConnection('projector-ws')
        projectorConnection.simulateMessage(HandshakeMessageWithPayload({
            deviceType: 'projector',
            sessionId: adminConnection.sessionId
        }))
        const projectorConnectedMessage = DeviceConnectedMessage(undefined, 'projector')
        expect(adminConnection.send).to.have.been.called.with(JSON.stringify(projectorConnectedMessage))

        // отключить телефон
        mobileConnection.simulateClose()
        const mobileDisonnectedMessage = DeviceDisonnectedMessage(mobileConnection.deviceName, 'mobile')
        expect(adminConnection.send).to.have.been.called.with(JSON.stringify(mobileDisonnectedMessage))

        // отключить проектор
        projectorConnection.simulateClose()
        const projectorDiconnectedMessage = DeviceDisonnectedMessage(undefined, 'projector')
        expect(adminConnection.send).to.have.been.called.with(JSON.stringify(projectorDiconnectedMessage))
    })

    it('оповещает приложение о том, что устройство подключилось/отключилось', () => {
        // подключить обработчик
        const appController = AppController()
        syncService.subscribe('app', appController)
        chai.spy.on(appController, ['deviceDisconnected', 'deviceConnected'])

        // подключить админку
        const adminConnection = mockWSS.simulateConnection('admin-ws')
        adminConnection.simulateMessage(HandshakeMessageWithPayload({
            deviceType: 'admin_console',
            accessToken: 'VALID.ACCESS.TOKEN'
        }))

        // запустить приложение
        adminConnection.simulateMessage({
            source: 'device',
            event: 'app_launched',
            payload: {
                name: 'app'
            }
        })

        // подключить телефон
        const mobileConnection = mockWSS.simulateConnection('mobile-ws')
        mobileConnection.simulateMessage(HandshakeMessageWithPayload({
            deviceType: 'mobile',
            sessionId: adminConnection.sessionId
        }))
        const deviceName = mobileConnection.deviceName
        expect(appController.deviceConnected).to.have.been.called.with('mobile', deviceName, adminConnection.sessionId)

        // отключить телефон
        mobileConnection.simulateClose()
        expect(appController.deviceDisconnected).to.have.been.called.with('mobile', deviceName, adminConnection.sessionId)
    })

    it('отвечает ошибкой, если приложение попытались запустить не с админки', () => {
        // подключить админку
        const adminConnection = mockWSS.simulateConnection('admin-ws')
        adminConnection.simulateMessage(HandshakeMessageWithPayload({
            deviceType: 'admin_console',
            accessToken: 'VALID.ACCESS.TOKEN'
        }))

        // подключить мобильное устройство
        const mobileConnection = mockWSS.simulateConnection('mobile-ws')
        mobileConnection.simulateMessage(HandshakeMessageWithPayload({
            deviceType: 'mobile',
            sessionId: adminConnection.sessionId
        }))

        // попытаться запустить приложение с мобильного устройства
        chai.spy.on(mobileConnection, 'send')
        mobileConnection.simulateMessage({
            source: 'device',
            event: 'app_launched',
            payload: {
                name: 'app'
            }
        })

        // проверить
        const expectedResponse = AccessDeniedBecause('Applications can only be launched from the admin console.')
        expect(mobileConnection.send).to.have.been.called.with(JSON.stringify(expectedResponse))
    })

    it('оповещает устройства о том, что было запущено/закрыто приложение', () => {
        // зарегистрировать обработчик
        const appController = AppController()
        syncService.subscribe('app', appController)

        // подключить админку
        const adminConnection = mockWSS.simulateConnection('admin-ws')
        adminConnection.simulateMessage(HandshakeMessageWithPayload({
            deviceType: 'admin_console',
            accessToken: 'VALID.ACCESS.TOKEN'
        }))

        // подключить мобильное устройство
        const mobileConnection = mockWSS.simulateConnection('mobile-ws')
        mobileConnection.simulateMessage(HandshakeMessageWithPayload({
            deviceType: 'mobile',
            sessionId: adminConnection.sessionId
        }))
        chai.spy.on(mobileConnection, 'send')

        // подключить проектор
        const projectorConnection = mockWSS.simulateConnection('projector-ws')
        projectorConnection.simulateMessage(HandshakeMessageWithPayload({
            deviceType: 'projector',
            sessionId: adminConnection.sessionId
        }))
        chai.spy.on(projectorConnection, 'send')

        // запустить приложение
        adminConnection.simulateMessage({
            source: 'device',
            event: 'app_launched',
            payload: {
                name: 'app',
                args: { key: 'val' }
            }
        })

        // проверить
        const appLaunchedMessage = {
            source: 'system',
            event: 'app_launched',
            payload: {
                name: 'app',
                args: { key: 'val' }
            }
        }
        expect(mobileConnection.send).to.have.been.called.with(JSON.stringify(appLaunchedMessage))
        expect(projectorConnection.send).to.have.been.called.with(JSON.stringify(appLaunchedMessage))

        // закрыть приложение
        adminConnection.simulateMessage({
            source: 'device',
            event: 'current_app_closed'
        })

        // проверить
        const appClosedMessage = {
            source: 'system',
            event: 'current_app_closed'
        }
        expect(mobileConnection.send).to.have.been.called.with(JSON.stringify(appClosedMessage))
        expect(projectorConnection.send).to.have.been.called.with(JSON.stringify(appClosedMessage))
    })

})
