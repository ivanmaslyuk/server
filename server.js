const express = require('express')
const bodyParser = require('body-parser')
const app = express()
const db = require('./db')
const { SyncService } = require('./sync_service/SyncService')
const AppController = require('./controllers/AppsController');
const TestAppController = require("./app_controllers/TestAppController");
const LieDetectorAppController = require("./app_controllers/TestAppController");
const { AccessTokenMiddleware } = require("./middleware");

// MONGODB INITIALIZATION
db.connect('mongodb://localhost/test', (err) => {
    if (err) {
        console.log('Error connecting to MongoDB')
    }
    console.log('Connected to MongoDB')
})

// MIDDLEWARE
app.use(bodyParser.json())
app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, PUT, PATCH, POST, DELETE");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    next();
});
app.use(AccessTokenMiddleware);

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

app.listen(8080, () => console.log(`Server started on port 8080`));

// APPS
const syncService = new SyncService();
syncService.subscribe('lie_detector', LieDetectorAppController);
syncService.subscribe('test_app', TestAppController);
syncService.listen(3001);
