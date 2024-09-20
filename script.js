const UART_SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const UART_TX_CHARACTERISTIC_UUID = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";
const UART_RX_CHARACTERISTIC_UUID = "6e400003-b5a3-f393-e0a9-e50e24dcca9e";

const name_regex = /BBC micro:bit \[(.*)\]/;

window.devices = new Map();
window.cityMap = new Map();

async function connect() {
    console.log("Connecting to micro:bit...");
    const device = await navigator.bluetooth.requestDevice({
        optionalServices: [UART_SERVICE_UUID],
        filters: [{ namePrefix: "BBC micro:bit" }],
    });

    const name = device.name.match(name_regex)[1];

    const server = await device.gatt.connect();
    console.log(`Available services: ${await server.getPrimaryServices()}`);

    const service = await server.getPrimaryService(UART_SERVICE_UUID);

    const rx_characteristic = await service.getCharacteristic(UART_RX_CHARACTERISTIC_UUID);
    const tx_characteristic = await service.getCharacteristic(UART_TX_CHARACTERISTIC_UUID);

    tx_characteristic.startNotifications();
    tx_characteristic.addEventListener("characteristicvaluechanged", (ev) => onTxCharacteristicValueChanged(name, ev));

    window.devices.set(name, {
        device: device,
        server: server,
        service: service,
        rx_characteristic: rx_characteristic,
        tx_characteristic: tx_characteristic,
    });

    console.log(`Connected to device: ${name}`);
    addCity(name, name);
}

function onTxCharacteristicValueChanged(name, event) {
    let receivedData = [];
    for (var i = 0; i < event.target.value.byteLength; i++) {
        receivedData[i] = event.target.value.getUint8(i);
    }

    const receivedString = String.fromCharCode.apply(null, receivedData);
    console.log(`Received data from ${name}: ${receivedString}`);
    const cls = (receivedString === 'A' ? 'sunny' : 'cloudy');
    
    const cityElement = window.cityMap.get(name);
    if (cityElement) {
        cityElement.className = `city ${cls}`;
    } else {
        console.log(`No city found for device: ${name}`);
    }
}

function addCity(cityName, deviceId) {
    const mapContainer = document.getElementById('map-container');
    const cityElement = document.createElement('div');
    cityElement.className = 'city cloudy';
    cityElement.innerHTML = `<span class="city-label">${cityName}</span>`;
    
    // Set initial position (you may want to adjust these values)
    cityElement.style.left = '50%';
    cityElement.style.top = '50%';
    
    mapContainer.appendChild(cityElement);
    window.cityMap.set(deviceId, cityElement);

    makeDraggable(cityElement);
    makeEditable(cityElement);
}

function makeDraggable(element) {
    interact(element).draggable({
        inertia: true,
        modifiers: [
            interact.modifiers.restrictRect({
                restriction: 'parent',
                endOnly: true
            })
        ],
        autoScroll: true,
        listeners: {
            move: dragMoveListener,
        }
    });
}

function dragMoveListener(event) {
    var target = event.target;
    var x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx;
    var y = (parseFloat(target.getAttribute('data-y')) || 0) + event.dy;

    target.style.transform = `translate(${x}px, ${y}px)`;

    target.setAttribute('data-x', x);
    target.setAttribute('data-y', y);
}

function makeEditable(element) {
    const label = element.querySelector('.city-label');
    
    element.addEventListener('dblclick', function() {
        const input = document.createElement('input');
        input.value = label.textContent;
        label.textContent = '';
        label.appendChild(input);
        input.focus();

        input.addEventListener('blur', function() {
            label.textContent = this.value;
        });

        input.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                label.textContent = this.value;
            }
        });
    });
}

// Initialize default cities if needed
addCity('Glasgow', 'zopot');
addCity('Edinburgh', 'zatev');