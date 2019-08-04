var connectView = document.getElementById('connect_view');
var connectedView = document.getElementById('connected_view');
var loadingView = document.getElementById('loading_view');
var disconnectedView = document.getElementById('disconnected_view');
var appView = document.getElementById('app_view');
var errorView = document.getElementById('error_view');
var app = null;

function setAppHTML(html) {
    appView.innerHTML = html;
}

function setAppJS(js) {
    eval(js);
}

function resetApp() {
    appView.innerHTML = '';
    app = null;
}

function showView(name) {
    connectView.style.display = name === 'connect' ? 'block' : 'none';
    loadingView.style.display = name === 'loading' ? 'block' : 'none';
    disconnectedView.style.display = name === 'disconnected' ? 'block' : 'none';
    appView.style.display = name === 'app' ? 'block' : 'none';
    connectedView.style.display = name === 'connected' ? 'block' : 'none';
    errorView.style.display = name === 'error' ? 'block' : 'none';
}

function showConnectView() { showView('connect'); }
function showConnectedView() { showView('connected'); }
function showLoadingView() { showView('loading'); }
function showDisconnectedView() { showView('disconnected'); }
function showAppView() { showView('app'); }
function showErrorView() { showView('error'); }




// пример использования SyncServiceFrontend (удалить)

var printSuccess = function (payload, err) {
    console.log(err ? err : 'HANDSHAKE SUCCEEDED')
    console.log(payload);
}

function onMessage(m) {
    console.log(m);
}

function onSessionTerminated() {
    console.error('SESSION TERMINATED');
}

function onConnectionError() {
    console.error('CONNECTION ERROR');
}

var syncService = new SyncServiceFrontend('127.0.0.1', 3001);
syncService.addMessageListener("main", onMessage);
syncService.onSessionTerminated = onSessionTerminated;
syncService.onConnectionError = onConnectionError;
syncService.connect(printSuccess, 1002);
