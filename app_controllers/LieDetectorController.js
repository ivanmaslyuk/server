
function _handleReadyMessage(session, deviceType) {
    // выставляем устройство как готовое
    switch (deviceType) {
        case 'mobile':
            session.mobileReady = true
            break
        case 'projector':
            session.projectorReady = true
            break
    }

    // проверяем, подключились ли все устройства
    const allDevicesReady = session.projectorReady && session.mobileReady
    if (allDevicesReady) {
        const message = {
            source: 'lie_detector',
            event: 'all_devices_ready'
        }
        this.sendMessageToPhone(session.id, session.mobileDevice, message)
        this.sendMessageToProjector(session.id, message)
        this.sendMessageToAdminConsole(session.id, message)
    }
}

function _handleQuestionAnswered(session) {
    const nextQuestion = session.questions[session.nextQuestionIndex]

    const message = {
        source: 'lie_detector'
    }

    if (session.nextQuestionIndex < session.questions.length) {
        message.event = 'next_question_shown'
        message.payload = { question: nextQuestion }
    } else {
        message.event = 'questions_ended'
    }

    session.nextQuestionIndex++

    this.sendMessageToPhone(session.id, session.mobileDevice, message)
    this.sendMessageToProjector(session.id, message)
}

function _handleAnswerSkipped(session) {
    const nextAnswer = session.results[session.nextAnswerIndex]

    const message = {
        source: 'lie_detector'
    }

    if (session.nextAnswerIndex < session.results.length) {
        message.event = 'next_answer_shown'
        message.payload = { answer: nextAnswer }
    } else {
        message.event = 'answers_ended'
    }

    session.nextAnswerIndex++

    this.sendMessageToPhone(session.id, session.mobileDevice, message)
    this.sendMessageToProjector(session.id, message)
}

module.exports = {
    chooseMobileDevice(sessionId) {
        return this.syncService.getSessionState(sessionId).mobile.length > 0;
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

    freeSession() {
        console.log("LIE DETECTOR TRIED TO CLOSE ITSELF")
        // TODO: доделать эту функцию
        // this.syncService.exitCurrentApp("Не подключены необходимые устройства.")
    },

    sessions: {},

    appLaunched(sessionId, args) {
        // проверяем подключены ли все необхобимые устройства. Если нет - не запускаем игру
        const refusal = {
            source: 'lie_detector',
            event: 'game_launch_refused',
            payload: {
                reason: undefined
            }
        }
        if (!this.allNecessaryDevicesConnected(sessionId)) {
            refusal.payload.reason = 'Necessary devices aren\'t connected.'
            return this.sendMessageToAdminConsole(sessionId, refusal)
        }

        // создаем сессию
        const session = {
            id: 0,
            questions: [],
            nextQuestionIndex: 0,
            nextAnswerIndex: 0,
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
        // пускаем ниже только если для запроса есть сессия или он о начале игры
        const session = this.sessions[sessionId]

        switch (message.event) {
            case 'new_pulse_value':
                this.sendMessageToPhone(sessionId, session.mobileDevice, message)
                this.sendMessageToProjector(sessionId, message)
                break
            case 'truth_selected':
                // предотвратить возможность записи ответа если все ответы уже записаны
                if (session.results.length <= session.questions.length) {
                    session.results.push(true)
                    _handleQuestionAnswered.call(this, session)
                }
                break
            case 'lie_selected':
                // предотвратить возможность записи ответа если все ответы уже записаны
                if (session.results.length <= session.questions.length) {
                    session.results.push(false)
                    _handleQuestionAnswered.call(this, session)
                }
                break
            case 'player_removed_finger':
                this.sendMessageToProjector(sessionId, message)
                this.sendMessageToAdminConsole(sessionId, message)
                break
            case 'player_placed_finger':
                this.sendMessageToProjector(sessionId, message)
                this.sendMessageToAdminConsole(sessionId, message)
                break
            case 'ready':
                _handleReadyMessage.call(this, session, deviceType)
                break
            case 'answer_skipped':
                // проверить закончились ли все вопросы
                if (session.results.length == session.questions.length) {
                    _handleAnswerSkipped.call(this, session)
                }
                break
        }
    },

    deviceConnected(deviceType, deviceName, sessionId) { },

    deviceDisconnected(deviceType, deviceName, sessionId) {
        // TODO: убрать это отсюда, когда сделаю syncService.exitCurrentApp

        const session = this.sessions[sessionId]

        // отправляем сообщение о неожиданном завершении игры и убиваем игру
        const _message = {
            source: 'lie_detector',
            event: 'game_interrupted',
            payload: {
                reason: undefined
            }
        }

        switch (deviceType) {
            case 'admin_console':
                _message.payload.reason = 'admin_disconnected'
                this.sendMessageToPhone(session.id, session.mobileDevice, _message)
                this.sendMessageToProjector(session.id, _message)
                break
            case 'mobile':
                // проверяем, использовалось ли устройство
                if (deviceName !== session.mobileDevice) { break }
                _message.payload.reason = 'mobile_disconnected'
                this.sendMessageToProjector(session.id, _message)
                this.sendMessageToAdminConsole(session.id, _message)
                break
            case 'projector':
                _message.payload.reason = 'projector_disconnected'
                this.sendMessageToAdminConsole(session.id, _message)
                this.sendMessageToPhone(session.id, session.mobileDevice, _message)
                break
        }

        this.freeSession(session.id);
    }
}