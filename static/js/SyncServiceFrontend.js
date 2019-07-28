var WS_HOST = 'ws://127.9.0.1:3001';

var onMessasgeCallback = null;
var onSessionTerminatedCallback = null;
var onConnectionErrorCallback = null;

function onMessasge(callback) {
    // callback вызывается с аргументами (event, payload)
    onMessasgeCallback = callback;
}

function onSessionTerminated(callback) {
    onSessionTerminatedCallback = callback;
}

function onConnectionError(callback) {
    onConnectionErrorCallback = callback;
}

/**
 * Возвращает тип устройства, на котором запущен скрипт - 'mobile', 'admin_console' или 'projector'.
 */
function getDeviceType() {
    var deviceType = document.body.getAttribute('data-device-type');
    if (!deviceType) {
        console.error('Device type not specified in the body tag.');
    }
    return deviceType
}

function connect(callback, sessionId) {
    // sessionId передается только на проекторе и мобильном устройстве
}

/**
 * Отправляет сообщение серверу от имени запущенного приложения.
 * @param {string} event Имя события.
 * @param {object} payload Аргументы события.
 */
function sendMessage(event, payload) {
    // вызвать callback с аргументами (succeeded)
}