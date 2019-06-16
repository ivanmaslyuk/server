const mocha = require('mocha')
const chai = require('chai')
const chaiSpies = require('chai-spies')

chai.use(chaiSpies)
const expect = chai.expect
const sandbox = chai.spy.sandbox()


const LieDetectorController = require('../../lie_detector/LieDetectorController').LieDetectorController

function Message(event, payload) {
    const result = {
        source: 'lie_detector',
        event
    }
    if (payload) { result.payload = payload }
    return result
}

function Session(questions, answers, nextQuestionIndex, nextAnswerIndex, mobileReady, projectorReady) {
    return {
        id: '1',
        questions: questions || [],
        nextQuestionIndex: nextQuestionIndex || 0,
        nextAnswerIndex: nextAnswerIndex || 0,
        results: answers || [],
        mobileDevice: 'mobile device',
        mobileReady: mobileReady || false,
        projectorReady: projectorReady || false
    }
}

describe('LieDetectorController Test', () => {
    let lieDetectorController
    let _isSessionReserved
    let _allDevicesConnected

    beforeEach(() => {
        _isSessionReserved = false
        _allDevicesConnected = true

        lieDetectorController = new LieDetectorController(
            function sendMessageToPhone(sessionId, deviceName, message) { },
            function sendMessageToProjector(sessionId, message) { },
            function sendMessageToAdminConsole(sessionId, message) { },
            function chooseMobileDevice(sessionId) {
                return 'mobile device'
            },
            function allNecessaryDevicesConnected(sessionId) {
                return _allDevicesConnected
            },
            function reserveSession(sessionId) { },
            function freeSession(sessionId) { },
            function isSessionResered(sessionId) {
                return _isSessionReserved
            }
        )
        sandbox.on(lieDetectorController, ['sendMessageToPhone', 'sendMessageToProjector', 'sendMessageToAdminConsole', 'reserveSession', 'freeSession'])
    })

    afterEach(() => {
        sandbox.restore()
    })

    it('должен начать игру и отправить телефону и проектору событие о началеи игры', () => {
        const message = {
            source: 'lie_detector',
            event: 'game_launched',
            payload: {
                questions: [
                    'Вопрос 1?',
                    'Вопрос 2?',
                    'Вопрос 3?'
                ]
            }
        }
        const deviceName = 'admin console'
        const deviceType = 'admin_console'
        const sessionId = '1'

        lieDetectorController.handleEvent(message, deviceName, deviceType, sessionId)

        expect(lieDetectorController.sendMessageToProjector).to.have.been.called.with(sessionId, message)
        expect(lieDetectorController.sendMessageToPhone).to.have.been.called.with(sessionId, 'mobile device', message)
    })

    it('не начинает игру если запрос на начало игры пришел не с админки', () => {
        const message = {
            source: 'lie_detector',
            event: 'game_launched',
            payload: {
                questions: [
                    'Вопрос 1?',
                    'Вопрос 2?',
                    'Вопрос 3?'
                ]
            }
        }
        const deviceName = 'my mobile'
        const deviceType = 'mobile'
        const sessionId = '1'

        lieDetectorController.handleEvent(message, deviceName, deviceType, sessionId)

        expect(lieDetectorController.sendMessageToProjector).to.not.have.been.called.with(sessionId, message)
        expect(lieDetectorController.sendMessageToPhone).to.not.have.been.called.with(sessionId, 'mobile device', message)
    })

    it('при получении нового значения пульса, отправляет его телефону и проектору', () => {
        lieDetectorController.sessions['1'] = {
            id: '1',
            questions: [],
            nextQuestionIndex: 0,
            nextAnswerIndex: 0,
            results: [],
            mobileDevice: 'mobile device',
            //mobileDeviceReady: false,
            //projectorReady: false
        }
        const message = {
            source: 'lie_detector',
            event: 'new_pulse_value',
            payload: { value: 100 }
        }
        const deviceName = 'admin console'
        const deviceType = 'admin_console'
        const sessionId = '1'

        lieDetectorController.handleEvent(message, deviceName, deviceType, sessionId)

        expect(lieDetectorController.sendMessageToPhone).to.have.been.called.with(sessionId, 'mobile device', message)
        expect(lieDetectorController.sendMessageToProjector).to.have.been.called.with(sessionId, message)
    })

    it('при получении правды отправляет новый вопрос телефону и проектору', () => {
        lieDetectorController.sessions['1'] = {
            id: '1',
            questions: ['1?', '2?'],
            nextQuestionIndex: 0,
            nextAnswerIndex: 0,
            results: [],
            mobileDevice: 'mobile device'
        }
        const message = Message('truth_selected')
        const deviceName = 'admin console'
        const deviceType = 'admin_console'
        const sessionId = '1'
        const responseMessage = Message('next_question_shown', { question: '1?' })

        lieDetectorController.handleEvent(message, deviceName, deviceType, sessionId)

        expect(lieDetectorController.sendMessageToPhone).to.have.been.called.with(sessionId, 'mobile device', responseMessage)
        expect(lieDetectorController.sendMessageToProjector).to.have.been.called.with(sessionId, responseMessage)
    })

    it('при получении лжи отправляет новый вопрос телефону и проектору', () => {
        lieDetectorController.sessions['1'] = {
            id: '1',
            questions: ['1?', '2?'],
            nextQuestionIndex: 0,
            nextAnswerIndex: 0,
            results: [],
            mobileDevice: 'mobile device'
        }
        const message = Message('lie_selected')
        const deviceName = 'admin console'
        const deviceType = 'admin_console'
        const sessionId = '1'
        const responseMessage = Message('next_question_shown', { question: '1?' })

        lieDetectorController.handleEvent(message, deviceName, deviceType, sessionId)

        expect(lieDetectorController.sendMessageToPhone).to.have.been.called.with(sessionId, 'mobile device', responseMessage)
        expect(lieDetectorController.sendMessageToProjector).to.have.been.called.with(sessionId, responseMessage)
    })

    it('при получении правды последнего ответа отправляет сообщение questions_ended телефону и проектору', () => {
        lieDetectorController.sessions['1'] = {
            id: '1',
            questions: ['1?'],
            nextQuestionIndex: 1,
            nextAnswerIndex: 0,
            results: [],
            mobileDevice: 'mobile device'
        }
        const message = Message('truth_selected')
        const deviceName = 'admin console'
        const deviceType = 'admin_console'
        const sessionId = '1'
        const responseMessage = Message('questions_ended')

        lieDetectorController.handleEvent(message, deviceName, deviceType, sessionId)

        expect(lieDetectorController.sendMessageToPhone).to.have.been.called.with(sessionId, 'mobile device', responseMessage)
        expect(lieDetectorController.sendMessageToProjector).to.have.been.called.with(sessionId, responseMessage)
    })

    it('при получении лжи последнего ответа отправляет сообщение questions_ended телефону и проектору', () => {
        lieDetectorController.sessions['1'] = {
            id: '1',
            questions: ['1?'],
            nextQuestionIndex: 1,
            nextAnswerIndex: 0,
            results: [],
            mobileDevice: 'mobile device'
        }
        const message = Message('lie_selected')
        const deviceName = 'admin console'
        const deviceType = 'admin_console'
        const sessionId = '1'
        const responseMessage = Message('questions_ended')

        lieDetectorController.handleEvent(message, deviceName, deviceType, sessionId)

        expect(lieDetectorController.sendMessageToPhone).to.have.been.called.with(sessionId, 'mobile device', responseMessage)
        expect(lieDetectorController.sendMessageToProjector).to.have.been.called.with(sessionId, responseMessage)
    })

    it('отправляет ошибку телефону и проектору если отключилась админка', () => {
        lieDetectorController.sessions['1'] = Session()
        const message = Message('device_disconnected')
        message.source = 'system'
        const deviceName = 'admin console'
        const deviceType = 'admin_console'
        const sessionId = '1'
        const responseMessage = Message('game_interrupted', { reason: 'admin_disconnected' })

        lieDetectorController.handleEvent(message, deviceName, deviceType, sessionId)

        expect(lieDetectorController.sendMessageToPhone).to.have.been.called.with(sessionId, 'mobile device', responseMessage)
        expect(lieDetectorController.sendMessageToProjector).to.have.been.called.with(sessionId, responseMessage)
    })

    it('отправляет ошибку телефону и админке если отключился проектор', () => {
        lieDetectorController.sessions['1'] = Session()
        const message = Message('device_disconnected')
        message.source = 'system'
        const deviceName = 'Projector'
        const deviceType = 'projector'
        const sessionId = '1'
        const responseMessage = Message('game_interrupted', { reason: 'projector_disconnected' })

        lieDetectorController.handleEvent(message, deviceName, deviceType, sessionId)

        expect(lieDetectorController.sendMessageToPhone).to.have.been.called.with(sessionId, 'mobile device', responseMessage)
        expect(lieDetectorController.sendMessageToAdminConsole).to.have.been.called.with(sessionId, responseMessage)
    })

    it('отправляет ошибку проектору и админке если отключился телефон', () => {
        lieDetectorController.sessions['1'] = Session()
        const message = Message('device_disconnected')
        message.source = 'system'
        const deviceName = 'mobile device'
        const deviceType = 'mobile'
        const sessionId = '1'
        const responseMessage = Message('game_interrupted', { reason: 'mobile_disconnected' })

        lieDetectorController.handleEvent(message, deviceName, deviceType, sessionId)

        expect(lieDetectorController.sendMessageToProjector).to.have.been.called.with(sessionId, responseMessage)
        expect(lieDetectorController.sendMessageToAdminConsole).to.have.been.called.with(sessionId, responseMessage)
    })

    it('отправляет сообщение проектору и админке, если игрок убрал палец', () => {
        lieDetectorController.sessions['1'] = Session()
        const message = Message('player_removed_finger')
        const deviceName = 'mobile device'
        const deviceType = 'mobile'
        const sessionId = '1'

        lieDetectorController.handleEvent(message, deviceName, deviceType, sessionId)

        expect(lieDetectorController.sendMessageToProjector).to.have.been.called.with(sessionId, message)
        expect(lieDetectorController.sendMessageToAdminConsole).to.have.been.called.with(sessionId, message)
    })

    it('отправляет сообщение проектору и админке, если игрок приложил палец', () => {
        lieDetectorController.sessions['1'] = Session()
        const message = Message('player_placed_finger')
        const deviceName = 'mobile device'
        const deviceType = 'mobile'
        const sessionId = '1'

        lieDetectorController.handleEvent(message, deviceName, deviceType, sessionId)

        expect(lieDetectorController.sendMessageToProjector).to.have.been.called.with(sessionId, message)
        expect(lieDetectorController.sendMessageToAdminConsole).to.have.been.called.with(sessionId, message)
    })

    it('отправляет всем устройствам all_devices_ready, если все устройства прислали ready', () => {
        lieDetectorController.sessions['1'] = Session([], [], 0, 0, true, false)
        const message = Message('ready')
        const deviceName = 'Projector'
        const deviceType = 'projector'
        const sessionId = '1'
        const responseMessage = Message('all_devices_ready')

        lieDetectorController.handleEvent(message, deviceName, deviceType, sessionId)

        expect(lieDetectorController.sendMessageToProjector).to.have.been.called.with(sessionId, responseMessage)
        expect(lieDetectorController.sendMessageToAdminConsole).to.have.been.called.with(sessionId, responseMessage)
        expect(lieDetectorController.sendMessageToPhone).to.have.been.called.with(sessionId, 'mobile device', responseMessage)
    })

    it('не отправляет all_devices_ready в ответ на ready от устройства, если подключились еще не все устройства', () => {
        lieDetectorController.sessions['1'] = Session([], [], 0, 0, false, false)
        const message = Message('ready')
        const deviceName = 'Projector'
        const deviceType = 'projector'
        const sessionId = '1'
        const responseMessage = Message('all_devices_ready')

        lieDetectorController.handleEvent(message, deviceName, deviceType, sessionId)

        expect(lieDetectorController.sendMessageToProjector).to.have.not.been.called.with(sessionId, responseMessage)
        expect(lieDetectorController.sendMessageToAdminConsole).to.have.not.been.called.with(sessionId, responseMessage)
        expect(lieDetectorController.sendMessageToPhone).to.have.not.been.called.with(sessionId, 'mobile device', responseMessage)
    })

    it('отправляет телефону и проектору сообщение, когда игра была закрыта из админки', () => {
        lieDetectorController.sessions['1'] = Session()
        const message = Message('game_closed')
        const deviceName = 'admin console'
        const deviceType = 'admin_console'
        const sessionId = '1'

        lieDetectorController.handleEvent(message, deviceName, deviceType, sessionId)

        expect(lieDetectorController.sendMessageToPhone).to.have.been.called.with(sessionId, 'mobile device', message)
        expect(lieDetectorController.sendMessageToProjector).to.have.been.called.with(sessionId, message)
    })

    it('при получении answer_skipped, отправляет следующий answer проектору и телефону', () => {
        lieDetectorController.sessions['1'] = Session(['1?', '2?'], [true, false], 0, 0, false, false)
        const message = Message('answer_skipped')
        const deviceName = 'admin console'
        const deviceType = 'admin_console'
        const sessionId = '1'
        const responseMessage = Message('next_answer_shown', {answer: true})

        lieDetectorController.handleEvent(message, deviceName, deviceType, sessionId)

        expect(lieDetectorController.sendMessageToPhone).to.have.been.called.with(sessionId, 'mobile device', responseMessage)
        expect(lieDetectorController.sendMessageToProjector).to.have.been.called.with(sessionId, responseMessage)
    })

    it('при получении answer_skipped, когда закончились ответы, отправляет проектору и телефону answers_ended', () => {
        lieDetectorController.sessions['1'] = Session(['1?', '2?'], [true, false], 0, 2, false, false)
        const message = Message('answer_skipped')
        const deviceName = 'admin console'
        const deviceType = 'admin_console'
        const sessionId = '1'
        const responseMessage = Message('answers_ended')

        lieDetectorController.handleEvent(message, deviceName, deviceType, sessionId)

        expect(lieDetectorController.sendMessageToPhone).to.have.been.called.with(sessionId, 'mobile device', responseMessage)
        expect(lieDetectorController.sendMessageToProjector).to.have.been.called.with(sessionId, responseMessage)
    })

    it('возвращает ошибку, если запуск игры был запрошен, когда сессия занята другой игрой', () => {
        _isSessionReserved = true
        const message = Message('game_launched', {
            questions: [
                'Вопрос 1?',
                'Вопрос 2?',
                'Вопрос 3?'
            ]
        })
        const deviceName = 'admin console'
        const deviceType = 'admin_console'
        const sessionId = '1'
        const responseMessage = Message('game_launch_refused', { reason: 'The session is already reserved for another game.' })

        lieDetectorController.handleEvent(message, deviceName, deviceType, sessionId)

        expect(lieDetectorController.sendMessageToAdminConsole).to.have.been.called.with(sessionId, responseMessage)
    })

    it('возвращает ошибку, если запуск игры был запрошен, когда не все необходимые устройства были подключены', () => {
        _allDevicesConnected = false
        const message = Message('game_launched', {
            questions: [
                'Вопрос 1?',
                'Вопрос 2?',
                'Вопрос 3?'
            ]
        })
        const deviceName = 'admin console'
        const deviceType = 'admin_console'
        const sessionId = '1'
        const responseMessage = Message('game_launch_refused', { reason: 'Necessary devices aren\'t connected.' })

        lieDetectorController.handleEvent(message, deviceName, deviceType, sessionId)

        expect(lieDetectorController.sendMessageToAdminConsole).to.have.been.called.with(sessionId, responseMessage)
    })

    it('вызывает reserveSession при запуске игры', () => {
        const message = Message('game_launched', {
            questions: [
                'Вопрос 1?',
                'Вопрос 2?',
                'Вопрос 3?'
            ]
        })
        const deviceName = 'admin console'
        const deviceType = 'admin_console'
        const sessionId = '1'

        lieDetectorController.handleEvent(message, deviceName, deviceType, sessionId)

        expect(lieDetectorController.reserveSession).to.have.been.called.with('1')
    })

    it('вызывает freeSession при закрытии игры', () => {
        lieDetectorController.sessions['1'] = Session()
        const message = Message('game_closed')
        const deviceName = 'admin console'
        const deviceType = 'admin_console'
        const sessionId = '1'

        lieDetectorController.handleEvent(message, deviceName, deviceType, sessionId)

        expect(lieDetectorController.freeSession).to.have.been.called.with('1')
    })

    
})
