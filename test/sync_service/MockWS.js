class Socket {
    constructor(id, server) {
        this.id = id
        this.server = server
    }

    on(event, func) {
        if (event === 'message') {
            this.onMessage = func
        }
        if (event === 'close') {
            this.onClose = func
        }
    }

    send(whatToSend) {

    }

    close() {
        this.server.clients.delete(this)
    }

    simulateMessage(msgObject) {
        this.onMessage(JSON.stringify(msgObject))
    }

    simulateClose() {
        this.onClose()
        this.server.clients.delete(this)
    }
}

class Server {
    constructor(params) {
        this.port = params.port
        this.clients = new Set()
    }

    on(event, func) {
        if (event === 'connection') {
            this.onConnection = func
        }
        if (event === 'close') {
            this.onClosed = func
        }
    }

    simulateConnection(connectionId) {
        const ws = new Socket(connectionId, this)
        this.clients.add(ws)
        this.onConnection(ws)
        return ws
    }

    /*simulateMessage(connectionId, messageObject) {
        const messageString = JSON.stringify(messageObject)
        for (const conn of this.clients) {
            if (conn.id == connectionId) {
                conn.onMessage(messageString)
            }
        }
    }*/

    /*simulateClosed(connectionId) {
        for (const conn of this.clients) {
            if (conn.id == connectionId) {
                conn.onClosed()
            }
        }
    }*/
}

module.exports = { Server }