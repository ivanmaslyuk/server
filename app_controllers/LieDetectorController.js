function _handleQuestionAnswered(session) {
    let evt = '';
    let payload = {};

    if (session.nextQuestionIndex < session.questions.length) {
        evt = 'next_question_shown'
    } else {
        evt = 'questions_ended'
        payload = {
            results: session.results
        }
    }

    session.nextQuestionIndex++

    this.sendMessageToPhone(session.id, session.mobileDevice, evt)
    this.sendMessageToProjector(session.id, evt, payload)
}

function _handleAnswerSkipped(session) {
    session.nextAnswerIndex++;

    let event = '';
    if (session.nextAnswerIndex <= session.results.length) {
        event = 'next_answer_shown';
    } else {
        event = 'answers_ended';
    }

    this.sendMessageToPhone(session.id, session.mobileDevice, event)
    this.sendMessageToProjector(session.id, event)
}

module.exports = {
    chooseMobileDevice(sessionId) {
        return this.syncService.getSessionState(sessionId).mobile[0];
    },

    allNecessaryDevicesConnected(sessionId) {
        return this.syncService.getSessionState(sessionId).mobile.length > 0;
    },

    sendMessageToAdminConsole(sessionId, event, payload) {
        this.syncService.sendMessageToDevice('admin_console', null, sessionId, {
            source: "lie_detector",
            event,
            payload: payload || {}
        })
    },

    sendMessageToPhone(sessionId, deviceName, event, payload) {
        this.syncService.sendMessageToDevice('mobile', deviceName, sessionId, {
            source: "lie_detector",
            event,
            payload: payload || {}
        })
    },

    sendMessageToProjector(sessionId, event, payload) {
        this.syncService.sendMessageToDevice('projector', null, sessionId, {
            source: "lie_detector",
            event,
            payload: payload || {}
        })
    },

    sessions: {},

    appLaunched(sessionId, args) {
        if (!this.allNecessaryDevicesConnected(sessionId)) {
            return this.syncService.exitCurrentApp(sessionId, "Проектор и мобильное устройство необходимы для запуска.");
        }

        // создаем сессию
        const session = {
            id: 0,
            questions: [],
            nextQuestionIndex: 1,
            nextAnswerIndex: 1,
            results: [],
            mobileDevice: undefined,
            mobileDeviceReady: false,
            projectorReady: false
        }

        session.id = sessionId
        session.questions = args.questions
        session.mobileDevice = this.chooseMobileDevice(sessionId)

        this.sessions[sessionId] = session
    },

    appClosed(sessionId) {
        delete this.sessions[sessionId]
    },

    sessionTerminated(sessionId) {
        delete this.sessions[sessionId]
    },

    handleEvent(message, deviceName, deviceType, sessionId) {
        const session = this.sessions[sessionId]

        switch (message.event) {
            case 'new_pulse_value':
                this.sendMessageToPhone(sessionId, session.mobileDevice, message.event, message.payload)
                this.sendMessageToProjector(sessionId, message.event, message.payload)
                break
            case 'question_answered':
                if (session.results.length <= session.questions.length) {
                    session.results.push({
                        truth: message.payload.truth,
                        answer: message.payload.answer
                    })
                    _handleQuestionAnswered.call(this, session)
                }
                break
            case 'player_removed_finger':
                this.sendMessageToProjector(sessionId, message.event)
                this.sendMessageToAdminConsole(sessionId, message.event)
                break
            case 'player_placed_finger':
                this.sendMessageToProjector(sessionId, message.event)
                this.sendMessageToAdminConsole(sessionId, message.event)
                break
            case 'started_showing_results':
                this.sendMessageToProjector(sessionId, message.event)
                this.sendMessageToAdminConsole(sessionId, message.event)
                break;
            case 'answer_skipped':
                if (session.results.length == session.questions.length) {
                    _handleAnswerSkipped.call(this, session)
                }
                break
        }
    },

    deviceConnected(deviceType, deviceName, sessionId) { },

    deviceDisconnected(deviceType, deviceName, sessionId) {
        const session = this.sessions[sessionId]
        if (deviceType === "projector" || deviceName === session.mobileDevice) {
            delete this.sessions[sessionId];
            this.syncService.exitCurrentApp(sessionId, "Проектор или мобильное устройство отключились от сервиса.");
        }
    }
}