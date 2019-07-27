const express = require('express')
const bodyParser = require('body-parser')
const app = express()
const User = require('./schemas/user')
const db = require('./db')
const SyncService = require('./sync_service/SyncService').SyncService
const syncService = new SyncService()
const getAccessTokenPayload = require('./AccessTokenHelper').getAccessTokenPayload

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
        const payload = getAccessTokenPayload(req.headers.authorization)
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
    } catch (e) {
        next()
    }
})


// ROUTES
app.use(express.static(__dirname + '/static'))
app.post('/auth', require('./controllers/AuthController').handleAuthRequest)
app.post('/signup', require('./controllers/SignupController').handleSignupRequest)

app.listen(8080, () => console.log(`Server started on port`))






syncService.subscribe('lie_detector', {

    appLaunched: (sessionId, args) => {
        console.log(`${sessionId} APP LAUNCHED with args:`)
        console.log(args)
    },

    appClosed: (sessionId) => {
        console.log(`${sessionId} APP CLOSED`)
    },

    sessionTerminated: (sessionId) => {
        console.log(`${sessionId} SESSION TERMINATED`)
    },

    handleEvent: (message, deviceName, deviceType, sessionId) => {
        console.log(`${sessionId} EVENT RECEIVED: ` + message.event + ` from ${deviceType} ${deviceName}`)
    },

    deviceConnected: (deviceType, deviceName, sessionId) => {
        console.log(`${sessionId} DEVICE CONNECTED: ${deviceType} ${deviceName}`)
    },

    deviceDisconnected: (deviceType, deviceName, sessionId) => {
        console.log(`${sessionId} DEVICE DISCONNECTED: ${deviceType} ${deviceName}`)
    }

})

syncService.listen(3001)
