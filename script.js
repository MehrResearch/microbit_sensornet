const UART_SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const UART_TX_CHARACTERISTIC_UUID = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";
const UART_RX_CHARACTERISTIC_UUID = "6e400003-b5a3-f393-e0a9-e50e24dcca9e";

const name_regex = /BBC micro:bit \[(.*)\]/;

const HOT_TEMP = 25;
const COLD_TEMP = 20;
const DARK = 50;
const LIGHT = 120;

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
    
    const cityElement = window.cityMap.get(name);
    if (cityElement) {
        updateCityVisual(cityElement, receivedString);
    } else {
        console.log(`No city found for device: ${name}`);
    }
}

function updateCityVisual(cityContainer, data) {
    const cityElement = cityContainer.querySelector('.city');
    const labelElement = cityContainer.querySelector('.city-label');
    
    // Remove previous classes and overlays
    cityElement.classList.remove('earthquake');
    labelElement.classList.remove('earthquake');
    const existingOverlay = cityElement.querySelector('.weather-overlay');
    if (existingOverlay) {
        existingOverlay.remove();
    }

    if (data === 'S') {
        // Earthquake
        const previousBackgroundImage = cityElement.style.backgroundImage;
        cityElement.style.backgroundImage = 'url("earthquake.svg")';
        cityElement.classList.add('earthquake');
        labelElement.classList.add('earthquake');
        setTimeout(() => {
            cityElement.classList.remove('earthquake');
            labelElement.classList.remove('earthquake');
            cityElement.style.backgroundImage = previousBackgroundImage;
        }, 5000);
    } else if (data.startsWith('T')) {
        // Temperature
        const temp = parseInt(data.slice(1));
        if (temp > HOT_TEMP) {
            addOverlay(cityElement, 'thermometer_hot.png');
        } else if (temp < COLD_TEMP) {
            addOverlay(cityElement, 'snowflake.png');
        }
    } else if (data.startsWith('L')) {
        // Light
        const light = parseInt(data.slice(1));
        if (light < DARK) {
            cityElement.style.backgroundImage = 'url("grey_clouds.png")';
        } else if (light > LIGHT) {
            cityElement.style.backgroundImage = 'url("sunshine.png")';
        } else {
            cityElement.style.backgroundImage = 'url("some_clouds.png")';
        }
    }
}

function addOverlay(cityElement, imageName) {
    const overlay = document.createElement('div');
    overlay.className = 'weather-overlay';
    overlay.style.backgroundImage = `url("${imageName}")`;
    cityElement.appendChild(overlay);
}

function addCity(cityName, deviceId) {
    const mapContainer = document.getElementById('map-container');
    const cityContainer = document.createElement('div');
    cityContainer.className = 'city-container';
    
    const cityElement = document.createElement('div');
    cityElement.className = 'city';
    
    const labelElement = document.createElement('div');
    labelElement.className = 'city-label';
    labelElement.textContent = cityName;
    
    cityContainer.appendChild(cityElement);
    cityContainer.appendChild(labelElement);
    
    // Set initial position (you may want to adjust these values)
    cityContainer.style.left = '50%';
    cityContainer.style.top = '50%';
    
    mapContainer.appendChild(cityContainer);
    window.cityMap.set(deviceId, cityContainer);

    makeDraggable(cityContainer);
    makeEditable(labelElement);
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
    element.addEventListener('dblclick', function() {
        const input = document.createElement('input');
        input.value = this.textContent;
        this.textContent = '';
        this.appendChild(input);
        input.focus();

        input.addEventListener('blur', function() {
            element.textContent = this.value;
        });

        input.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                element.textContent = this.value;
            }
        });
    });
}