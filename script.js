const UART_SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";

// Allows the micro:bit to transmit a byte array
const UART_TX_CHARACTERISTIC_UUID = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";

// Allows a connected client to send a byte array
const UART_RX_CHARACTERISTIC_UUID = "6e400003-b5a3-f393-e0a9-e50e24dcca9e";

const name_regex = /BBC micro:bit \[(.*)\]/;

window.devices = new Map();

async function connect() {
    console.log("Connecting to micro:bit...");
    const device = await navigator.bluetooth.requestDevice({
        // micro:bit UART service
        optionalServices: [UART_SERVICE_UUID],
        filters: [{ namePrefix: "BBC micro:bit" }],
    });

    const name = device.name.match(name_regex)[1];

    const server = await device.gatt.connect();

    console.log(`Available services: ${await server.getPrimaryServices()}`);

    const service = await server.getPrimaryService(UART_SERVICE_UUID);

    const rx_characteristic = await service.getCharacteristic(
        UART_RX_CHARACTERISTIC_UUID
    );
    const tx_characteristic = await service.getCharacteristic(
        UART_TX_CHARACTERISTIC_UUID
    );

    tx_characteristic.startNotifications();
    tx_characteristic.addEventListener(
        "characteristicvaluechanged",
        (ev) => onTxCharacteristicValueChanged(name, ev)
    );

    window.devices[name] = {
        device: device,
        server: server,
        service: service,
        rx_characteristic: rx_characteristic,
        tx_characteristic: tx_characteristic,
    };
}

function onTxCharacteristicValueChanged(name, event) {
    let receivedData = [];
    for (var i = 0; i < event.target.value.byteLength; i++) {
        receivedData[i] = event.target.value.getUint8(i);
    }

    const receivedString = String.fromCharCode.apply(null, receivedData);
    console.log(`Received data from ${name}: ${receivedString}`);
    const cls = (receivedString === 'A' ? 'sunny' : 'cloudy');
    const city = (name === 'zatev' ? 'edinburgh' : 'glasgow');
    document.getElementById(city).className = cls;
}
