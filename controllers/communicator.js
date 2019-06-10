exports.handleActionn = ({
    user,
    action,
    sendMessageToHost,
    sendMessageToClients,
    isHostOnline })
    => {
    switch (action) {
        case 'request_build':
            if (isHostOnline()) {
                sendMessageToHost({
                    event: "build_requested",
                    build_id: 1,
                    project_id: 1
                });
            }
            break;
    }
};

// правила детектора лжи
exports.handleAction = ({
    user,
    event,
    sendMessageToProjector,
    sendMessageToPhone,
    sendMessageToAdmin
}, {
    heartbeatValue
}) => {
    switch (event) {
        case 'device_disconnected':
            const msg = {
                event
            };
            sendMessageToAdmin(msg);
            sendMessageToPhone(msg);
            sendMessageToProjector(msg);
            break;
        case 'new_heartbeat_value':
            const msg = {
                event,
                heartbeatValue
            };
            sendMessageToPhone(msg);
            sendMessageToProjector(msg);
            break;
        
    }
}