var connectView = document.getElementById('connect_view');
var connectedView = document.getElementById('connected_view');
var loadingView = document.getElementById('loading_view');
var disconnectedView = document.getElementById('disconnected_view');
var appView = document.getElementById('app_view');
var app = {};

function setAppHTML(html) {
    appView.innerHTML = html;
}

function setAppJS(js) {
    eval(js);
}

function resetApp() {
    appView.innerHTML = '';
    app = {};
}

function showView(name) {
    connectView.style.display = name === 'connect' ? 'block' : 'none';
    loadingView.style.display = name === 'loading' ? 'block' : 'none';
    disconnectedView.style.display = name === 'disconnected' ? 'block' : 'none';
    appView.style.display = name === 'app' ? 'block' : 'none';
    connectedView.style.display = name === 'connected' ? 'block' : 'none';
}

function showConnectView() { showView('connect') }
function showConnectedView() { showView('connected') }
function showLoadingView() { showView('loading') }
function showDisconnectedView() { showView('disconnected') }
function showAppView() { showView('app') }

/**
 * Отправляет сообщение серверу от имени запущенного приложения.
 * @param {string} event 
 * @param {object} payload 
 */
function raiseEvent(event, payload) {

}