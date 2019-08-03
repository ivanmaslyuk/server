this.app = {

    appLaunched: () => {
        var redButton = document.getElementById('red-button');
        var blueButton = document.getElementById('blue-button');
        var greenButton = document.getElementById('green-button');
        const self = this;
        redButton.onclick = function (e) {
            self.sendMessage('red')
        }
        blueButton.onclick = function (e) {
            self.sendMessage('blue')
        }
        greenButton.onclick = function (e) {
            self.sendMessage('green')
        }
    },

    appClosed: () => {
        console.log("I WAS CLOSED :(")
    },

    handleEvent: (event, payload) => {
        console.log("I RECEIVED EVENT!")
        console.log(event)
    },

    deviceConnected: (deviceType, deviceName) => {
        console.log("HELLO, " + deviceName + " of type " + deviceType)
    },

    deviceDisconnected: (deviceType, deviceName) => {
        console.log("GOODBYE, " + deviceName + " of type " + deviceType)
    }

}