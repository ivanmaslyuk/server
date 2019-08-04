this.app = {

    appLaunched() {
        var redButton = document.getElementById('red-button');
        var blueButton = document.getElementById('blue-button');
        var greenButton = document.getElementById('green-button');
        redButton.onclick = e => {
            this.sendMessage('red')
        }
        blueButton.onclick = e => {
            this.sendMessage('blue')
        }
        greenButton.onclick = e => {
            this.sendMessage('green')
        }
    },

    appClosed() {
        console.log("I WAS CLOSED :(")
    },

    handleEvent(event, payload) {
        console.log("I RECEIVED EVENT!")
        console.log(event)
    },

    deviceConnected(deviceType, deviceName) {
        console.log("HELLO, " + deviceName + " of type " + deviceType)
    },

    deviceDisconnected(deviceType, deviceName) {
        console.log("GOODBYE, " + deviceName + " of type " + deviceType)
    }

}