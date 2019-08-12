module.exports = {
    appLaunched(sessionId, args) { },

    appClosed(sessionId) { },

    sessionTerminated(sessionId) { },

    handleEvent(message, deviceName, deviceType, sessionId) {
        this.syncService.getSessionState(sessionId).mobile.forEach(deviceName => {
            this.syncService.sendMessageToDevice('mobile', deviceName, sessionId, message)
        })
        this.syncService.sendMessageToDevice("projector", null, sessionId, message)
    },

    deviceConnected(deviceType, deviceName, sessionId) { },

    deviceDisconnected(deviceType, deviceName, sessionId) { }
}