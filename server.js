const express = require('express')
const bodyParser = require('body-parser')
const app = express()
const jwt = require('jsonwebtoken')
const key = require('./key')
const User = require('./schemas/user')
const db = require('./db')
const SyncService = require('./SyncService')
const syncService = new SyncService()

// MONGODB INITIALIZATION
db.connect('mongodb://localhost/test', (err) => {
    if (err) {
        console.log('Error connecting to MongoDB')
    }
    console.log('Connected to MongoDB')
})

// EXPRESS MIDDLEWARE
app.use(bodyParser.json())
app.use((req, res, next) => {
    try {
        jwt.verify(req.headers.authorization, key.tokenKey, (err, payload) => {
            if (payload) {
                User.findById(payload.userId).then(
                    (doc) => {
                        req.user = doc
                        next()
                    }
                )
            } else {
                next()
            }
        })
    } catch (e) {
        next()
    }
})

// ROUTES
app.post('/auth', require('./controllers/AuthController').handleAuthRequest)

app.post('/signup', require('./controllers/SignupController').handleSignupRequest)

app.get('/users/:id', (req, res) => {
    if (!req.user) {
        return res.status(401).json({ message: 'No access token.' })
    }

    res.json({ message: "welcome, " + req.user.email })
})

app.listen(8080, () => console.log('Server started on port'))





syncService.watch('lie_detector', (message, deviceName, deviceType, userId) => {
    console.log(syncService.getSessionState(userId))
    syncService.sendMessageToDevice(deviceName, userId, {
        source: 'lie_detector',
        event: 'player_lifted_finger'
    })
    
})

syncService.watch('system', (message, deviceName, deviceType, userId) => {
    // отправвить в админку что устройство подключилось/отключилось
    switch (message.event) {
        case 'device_connected':
            syncService.sendMessageToDevice('admin_console', userId, message)
            break
        case 'device_disconnected':
            syncService.sendMessageToDevice('admin_console', userId, message)
            break
        /*case 'game_launched':
            // TODO: отправить на все мобильные
            syncService.sendMessageToDevice('')
            break

            Код выше не подходит, т.к. он не позволяет передать параметры начала игры (список вопросов, имя игрока).
            Наверно надо, чтобы его отправляла не система, а игра. Так игра сможет инициализировать у себя сессию для ее владельца.
            Новая идея: игру начинает устройство от своего имени. Хотя нет, лучше пусть от имени игры, чтобы это сообщене сразу шло
            в обработчик lie_detector и там инициализировалась сессия.
            {
                source: 'device',
                event: 'game_launched',
                payload: {
                    game: 'lie_detector'
                }
            }
        */
    }
})

syncService.listen(3001)