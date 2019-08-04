# Описание работы SyncService

SyncService является оберткой WebSocketServer (а SyncServiceFrontend - оберткой WebSocket), предназначенной для нужд системы.

## Формат

Для общения приложения используют следующий формат:
``` JSON
{
    source: "источник события",
    event: "назваие события",
    payload: {
        arg1: "значение",
        ...
        arg10: "значение"
    }
}
```

Свойство payload содержит аргументы, имеющие отношение к событию.

Например, при успешной авторизации панели усправления, сервер возвращает в payload свойство sessionId.

``` JSON
...
payload: { 
    sessionId: 1001
}
...
```

## Авторизация

Авторизация страницы мобильного устройства, проектора и панели усправления происходит немного по разному.

Везде для этого используется событие **handshake** с источником **device**. Сообщение с любым другим событием игнорируется, если устройство не авторизовано.

Для авторизации мобильного устройства в **payload** нужно передать **sessionId** и **deviceModel**, а в случае проектора передается только **sessionId**.

Для авторизации панели управления в **payload** нужно передать **accessToken**, который хранится в localStorage (cookies) браузера.

Кроме того, всегда передается **deviceType** - "mobile", "projector" или "admin_console".

## Приложеия

Логика одного приложения разделяется на 4 скрипта. Для сервера, панели администратора, мобильного устройства и проектора.

Первый должен иметь функции

1. appLaunched(sessionId, args)
1. appClosed(sessionId)
1. sessionTerminated(sessionId)
1. deviceConnected(deviceType, deviceName, sessionId)
1. deviceDisconnected(deviceType, deviceName, sessionId)
1. handleEvent(message, deviceName, deviceType, sessionId)

Внутри он может реализовывать любую необходимую логику и может получать доступ к экземпляру SyncService для получения состояния сессии и отправки сообщений устройствам через **this.syncService**.

Последние три должны иметь функции

1. appLaunched()
1. appClosed()
1. handleEvent(event, payload)
1. deviceConencted(deviceType, deviceName)
1. deviceDisconnected(deviceType, deviceName)

Внутри могут реализовывать любую необходимую логику и могут отправлять сообщения серверу через **this.sendMessage**.