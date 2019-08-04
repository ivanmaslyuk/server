this.app = {

    appLaunched() { },

    appClosed() { },

    handleEvent(event, payload) {
        var bkg = document.getElementById("background");

        if (event === "red") {
            bkg.style.backgroundColor = "red";
        }
        if (event === "blue") {
            bkg.style.backgroundColor = "blue";
        }
        if (event === "green") {
            bkg.style.backgroundColor = "green";
        }
    },

    deviceConencted(deviceType, deviceName) { },

    deviceDisconnected(deviceType, deviceName) { }

}