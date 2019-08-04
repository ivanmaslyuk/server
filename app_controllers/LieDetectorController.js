
function _resetSession(sessionId) {
    // чтобы не получалось так, что при выполнении этой функции когда сессия занята чем-то другим, мы освобождали сессию не от своего процесса
    if (this.sessions[sessionId]) {
        delete this.sessions[sessionId]
        this.freeSession(sessionId)
    }
}

function _getSession(sessionId) {
    return this.sessions[sessionId]
}

function _handleDeviceDisconnected(session, deviceType, deviceName) {
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

    _resetSession.call(this, session.id)
}

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

function _handleGameLaunched(sessionId, initiatorDeviceType, message) {
    // ничего не делать если игра уже запущена в этой сессии
    if (this.sessions[sessionId]) { return }

    // проверяем подключены ли все необхобимые устройства. Если нет - не запускаем игру
    const refusal = {
        source: 'lie_detector',
        event: 'game_launch_refused',
        payload: {
            reason: undefined
        }
    }
    // удостоверяемся, что запрос пришел из админки
    if (initiatorDeviceType !== 'admin_console') {
        refusal.payload.reason = 'Games can only be launched from the admin console.'
        // игнорируем запрос на запуск игры не из админки
        return
    }
    if (!this.allNecessaryDevicesConnected()) {
        refusal.payload.reason = 'Necessary devices aren\'t connected.'
        return this.sendMessageToAdminConsole(sessionId, refusal)
    }
    if (this.isSessionResered()) {
        refusal.payload.reason = 'The session is already reserved for another game.'
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
    session.questions = message.payload.questions
    session.mobileDevice = this.chooseMobileDevice(sessionId)

    this.sessions[sessionId] = session

    // отправляем проектору и телефону сообщение о начале игры
    this.sendMessageToPhone(sessionId, session.mobileDevice, message)
    this.sendMessageToProjector(sessionId, message)
    this.reserveSession(sessionId)
}

function _handleGameClosed(session, message) {
    // отправить сообщение телефону и проектору
    this.sendMessageToPhone(session.id, session.mobileDevice, message)
    this.sendMessageToProjector(session.id, message)
    _resetSession.call(this, session.id)
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



class LieDetectorController {
    constructor(sendMessageToPhone, 
        sendMessageToProjector, 
        sendMessageToAdminConsole, 
        chooseMobileDevice, 
        allNecessaryDevicesConnected, 
        reserveSession, 
        freeSession,
        isSessionResered) {
        this.sessions = {}

        this.sendMessageToPhone = sendMessageToPhone
        this.sendMessageToProjector = sendMessageToProjector
        this.sendMessageToAdminConsole = sendMessageToAdminConsole
        this.chooseMobileDevice = chooseMobileDevice
        this.allNecessaryDevicesConnected = allNecessaryDevicesConnected
        this.reserveSession = reserveSession
        this.freeSession = freeSession
        this.isSessionResered = isSessionResered
    }

    handleEvent(message, deviceName, deviceType, sessionId) {
        // пускаем ниже только если для запроса есть сессия или он о начале игры
        const session = _getSession.call(this, sessionId)
        if (!session && message.event !== 'game_launched') {
            // TODO: отправить устройству, от которого пришел запрос ошибку, что игра не запущена в этой сессии
            return
        }

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
            case 'device_connected':
                // игнорируем
                break
            case 'device_disconnected':
                _handleDeviceDisconnected.call(this, session, deviceType, deviceName)
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
            case 'game_launched':
                _handleGameLaunched.call(this, sessionId, deviceType, message)
                break
            case 'game_closed':
                _handleGameClosed.call(this, session, message)
                break
            case 'answer_skipped':
                // проверить закончились ли все вопросы
                if (session.results.length == session.questions.length) {
                    _handleAnswerSkipped.call(this, session)
                }
                break
        }
    }
}

module.exports = { LieDetectorController }