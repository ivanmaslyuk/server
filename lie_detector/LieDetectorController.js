module.exports.handleEvent = (message, deviceName, deviceType, userId) => {
    switch (message.event) {
        case 'new_pulse_value':
            //const newValue = message.payload.newValue
            sendMessageToPhone(message)
            sendMessageToProjector(message)
            break
        case 'truth_selected':
            // сохранить значение правды для текущего вопроса
            break
        case 'lie_selected':
            // сохранить значение лжи для текущего вопроса
            break
        case 'device_connected':
            break
        case 'device_disconnected':
            // проверить что за устройство отключилось
            // отправляем оставшимся устройствам, что устройство отключилось
            /* Тут немного не понятно насчет того, как передавать админке инфу о том, что отключилось устройство,
            ведь она должна знать как обо всех устройствах, чтобы отображать, что подключено, так и отдельным образом о тех,
            которые используются сейчас в игре. 
            Наверно надо отдельно, вне этого скрипта отсылать в админку системные оповещения а здесь сделать специальное событие,
            которое будет указывать, что используемое в игре устройство отключилось.  */
            break
        case 'player_removed_finger':
            break
        case 'player_placed_finger':
            break
        case 'ready':
            //TODO: отправить сообщеиние all_devies_ready, когда все устройства пришлют ready
            break
        case 'game_launched':
            break
        case 'game_closed':
            break
    }
}