module.exports = {
    appLaunched(sessionId, args) { },

    appClosed(sessionId) { },

    sessionTerminated(sessionId) { },

    handleEvent(message, deviceName, deviceType, sessionId) {
        this.syncService.getSessionState(sessionId).mobile.forEach(deviceName => {
            this.syncService.sendMessageToDevice('mobile', deviceName, sessionId, message)
        })
        this.syncService.sendMessageToDevice('admin_console', null, sessionId, {
            source: 'test_app',
            event: "OK!"
        })
    },

    deviceConnected(deviceType, deviceName, sessionId) { },

    deviceDisconnected(deviceType, deviceName, sessionId) { }
}