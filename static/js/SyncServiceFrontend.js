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

function showConnectView() { showView('connect'); }
function showConnectedView() { showView('connected'); }
function showLoadingView() { showView('loading'); }
function showDisconnectedView() { showView('disconnected'); }
function showAppView() { showView('app'); }

/**
 * Возвращает тип устройства, на котором запущен скрипт - 'mobile', 'admin_console' или 'projector'.
 */
function getDeviceType() {
    var deviceType = document.body.getAttribute('data-device-type');
    if (!deviceType) {
        console.warn('Device type not specified in the body tag.');
    }
    return deviceType
}

/**
 * Отправляет сообщение серверу от имени запущенного приложения.
 * @param {string} event Имя события.
 * @param {object} payload Аргументы события.
 */
function raiseEvent(event, payload) {

}