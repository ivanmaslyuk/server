const express = require('express')
const bodyParser = require('body-parser')
const app = express()
const User = require('./schemas/user')
const db = require('./db')
const SyncService = require('./sync_service/SyncService').SyncService
const syncService = new SyncService()
const getAccessTokenPayload = require('./AccessTokenHelper').getAccessTokenPayload
const AppController = require('./controllers/AppsController');
const TestAppController = require("./app_controllers/TestAppController");

// MONGODB INITIALIZATION
db.connect('mongodb://localhost/test', (err) => {
    if (err) {
        console.log('Error connecting to MongoDB')
    }
    console.log('Connected to MongoDB')
})

// EXPRESS MIDDLEWARE
app.use(bodyParser.json())
app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, PUT, PATCH, POST, DELETE");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    next();
});
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
app.get('/mobile', (req, res) => res.redirect('/#/mobile'));
app.get('/projector', (req, res) => res.redirect('/#/projector'));
app.use(express.static(__dirname + '/static'));

// ENDPOINTS
app.post('/api/auth', require('./controllers/AuthController').handleAuthRequest)
app.post('/api/signup', require('./controllers/SignupController').handleSignupRequest)

app.get('/api/apps', AppController.get);
app.get('/api/apps/:id', AppController.getOne);
app.post('/api/apps', AppController.post);

app.listen(8080, () => console.log(`Server started on port`))






syncService.subscribe('lie_detector', {

    appLaunched: (sessionId, args) => {
        console.log(`${sessionId} APP LAUNCHED with args:`)
        console.log('lie_detector APP LAUNSCHED ARGS:' + args)
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

syncService.subscribe('test_app', TestAppController)

syncService.listen(3001)
