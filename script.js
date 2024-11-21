const UART_SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const UART_TX_CHARACTERISTIC_UUID = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";
const UART_RX_CHARACTERISTIC_UUID = "6e400003-b5a3-f393-e0a9-e50e24dcca9e";

const name_regex = /BBC micro:bit \[(.*)\]/;

const HOT_TEMP = 24;
const COLD_TEMP = 20;
const DARK = 50;
const LIGHT = 150;

const MAX_MESSAGES = 1000;

window.devices = new Map();
window.cityMap = new Map();

async function initializeCharacteristics(name, server) {
    const service = await server.getPrimaryService(UART_SERVICE_UUID);
    const rx_characteristic = await service.getCharacteristic(UART_RX_CHARACTERISTIC_UUID);
    const tx_characteristic = await service.getCharacteristic(UART_TX_CHARACTERISTIC_UUID);

    await tx_characteristic.startNotifications();
    tx_characteristic.addEventListener("characteristicvaluechanged", 
        (ev) => onTxCharacteristicValueChanged(name, ev));

    return { service, rx_characteristic, tx_characteristic };
}

function startDeviceMonitoring(deviceName) {
    const deviceInfo = window.devices.get(deviceName);
    if (!deviceInfo) return;

    deviceInfo.lastMessageTime = Date.now();
    deviceInfo.monitorInterval = setInterval(() => {
        const timeSinceLastMessage = Date.now() - deviceInfo.lastMessageTime;
        console.log(`Time since last message from ${deviceName}: ${timeSinceLastMessage}ms`);
        if (timeSinceLastMessage > 10000) { // 10 seconds
            console.log(`No message received from ${deviceName} for ${timeSinceLastMessage}ms`);
            clearInterval(deviceInfo.monitorInterval);
            reconnectWithBackoff(deviceInfo.device);
        }
    }, 1000);
}

async function connect() {
    console.log("Connecting to micro:bit...");
    const device = await navigator.bluetooth.requestDevice({
        optionalServices: [UART_SERVICE_UUID],
        filters: [{ namePrefix: "BBC micro:bit" }],
    });


    const name = device.name.match(name_regex)[1];
    const server = await device.gatt.connect();
    
    const { service, rx_characteristic, tx_characteristic } = 
        await initializeCharacteristics(name, server);

    window.devices.set(name, {
        device: device,
        server: server,
        service: service,
        rx_characteristic: rx_characteristic,
        tx_characteristic: tx_characteristic,
    });

    // Start monitoring after device is set up
    startDeviceMonitoring(name);

    console.log(`Connected to device: ${name}`);
    addCity(name, name);
}

async function reconnectWithBackoff(device, maxAttempts = 10) {
    // Clear existing monitor interval if it exists
    const deviceEntry = Array.from(window.devices.entries())
        .find(([_, d]) => d.device === device);
    if (deviceEntry && deviceEntry[1].monitorInterval) {
        clearInterval(deviceEntry[1].monitorInterval);
    }

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            const server = await device.gatt.connect();
            
            // Find the device name from the devices map
            const deviceEntry = Array.from(window.devices.entries())
            .find(([_, d]) => d.device === device);
            if (!deviceEntry) {
                console.error('Could not find device in devices map');
                return;
            }
            const name = deviceEntry[0];
            
            // Reinitialize characteristics
            const { service, rx_characteristic, tx_characteristic } = 
            await initializeCharacteristics(name, server);
            
            // Update device info and restart monitoring
            window.devices.set(name, {
                device: device,
                server: server,
                service: service,
                rx_characteristic: rx_characteristic,
                tx_characteristic: tx_characteristic,
            });
            
            // Restart monitoring after reconnection
            startDeviceMonitoring(name);
            
            console.log('Reconnected on attempt', attempt + 1);
            
            return;
        } catch (error) {
            console.log('Reconnection attempt', attempt + 1, 'failed:', error);
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
    }
    console.log('Failed to reconnect after', maxAttempts, 'attempts');
}

function onTxCharacteristicValueChanged(name, event) {
    // Update last message timestamp
    const deviceInfo = window.devices.get(name);
    if (deviceInfo) {
        deviceInfo.lastMessageTime = Date.now();
    }

    let receivedData = [];
    for (var i = 0; i < event.target.value.byteLength; i++) {
        receivedData[i] = event.target.value.getUint8(i);
    }

    const receivedString = String.fromCharCode.apply(null, receivedData);
    
    const cityData = window.cityMap.get(name);
    if (cityData) {
        if (!cityData.isEarthquake || receivedString === 'S') {
            updateCityVisual(name, receivedString);
            updateTerminal(name, receivedString);
        } else {
            console.log(`Ignoring message for ${name} due to ongoing earthquake`);
        }
    } else {
        console.log(`No city found for device: ${name}`);
    }
}

function updateCityVisual(deviceId, data) {
    const cityData = window.cityMap.get(deviceId);
    if (!cityData) {
        console.log(`No city found for device: ${deviceId}`);
        return;
    }

    const cityContainer = cityData.container;
    const cityElement = cityContainer.querySelector('.city');
    const labelElement = cityContainer.querySelector('.city-label');
    
    // Remove earthquake classes if present
    cityElement.classList.remove('earthquake');
    labelElement.classList.remove('earthquake');

    if (data === 'S') {
        // Earthquake
        const previousBackgroundImage = cityElement.style.backgroundImage;
        cityElement.style.backgroundImage = 'url("earthquake.svg")';
        cityElement.classList.add('earthquake');
        labelElement.classList.add('earthquake');
        cityData.isEarthquake = true;
        setTimeout(() => {
            cityElement.classList.remove('earthquake');
            labelElement.classList.remove('earthquake');
            cityElement.style.backgroundImage = previousBackgroundImage;
            cityData.isEarthquake = false;
        }, 5000);
    } else if (data === 'A') {
        // Reset position to center
        cityContainer.style.transform = 'translate(0px, 0px)';
        cityContainer.setAttribute('data-x', '0');
        cityContainer.setAttribute('data-y', '0');
    } else if (data.startsWith('temperature:')) {
        // Temperature
        const temp = parseInt(data.split(':')[1]);
        updateOverlay(cityElement, temp > HOT_TEMP ? 'thermometer_hot.png' : (temp < COLD_TEMP ? 'snowflake.png' : null));
    } else if (data.startsWith('light:')) {
        // Light
        const light = parseInt(data.split(':')[1]);
        if (light < DARK) {
            cityElement.style.backgroundImage = 'url("grey_clouds.png")';
        } else if (light > LIGHT) {
            cityElement.style.backgroundImage = 'url("sunshine.png")';
        } else {
            cityElement.style.backgroundImage = 'url("some_clouds.png")';
        }
    } else if (data.startsWith('dx:')) {
        const dx = parseInt(data.split(':')[1]);
        const currentX = parseFloat(cityContainer.getAttribute('data-x') || 0);
        const currentY = parseFloat(cityContainer.getAttribute('data-y') || 0);
        const newX = currentX + dx/100;
        cityContainer.style.transform = `translate(${newX}px, ${currentY}px)`;
        cityContainer.setAttribute('data-x', newX);
    } else if (data.startsWith('dy:')) {
        const dy = parseInt(data.split(':')[1]);
        const currentX = parseFloat(cityContainer.getAttribute('data-x') || 0);
        const currentY = parseFloat(cityContainer.getAttribute('data-y') || 0);
        const newY = currentY + dy/100;
        cityContainer.style.transform = `translate(${currentX}px, ${newY}px)`;
        cityContainer.setAttribute('data-y', newY);
    }
}

function updateOverlay(cityElement, overlayImage) {
    let overlay = cityElement.querySelector('.weather-overlay');
    if (overlayImage) {
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'weather-overlay';
            cityElement.appendChild(overlay);
        }
        overlay.style.backgroundImage = `url("${overlayImage}")`;
    } else if (overlay) {
        overlay.remove();
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
    cityContainer.setAttribute('data-city', cityName);
    
    const cityElement = document.createElement('div');
    cityElement.className = 'city';
    cityElement.style.backgroundImage = 'url("question-mark.svg")';
    
    const labelElement = document.createElement('div');
    labelElement.className = 'city-label';
    labelElement.textContent = cityName;
    
    cityContainer.appendChild(cityElement);
    cityContainer.appendChild(labelElement);
    
    // Set initial position (you may want to adjust these values)
    cityContainer.style.left = '50%';
    cityContainer.style.top = '50%';
    
    mapContainer.appendChild(cityContainer);

    // Store both the container and the state in cityMap
    window.cityMap.set(deviceId, {
        container: cityContainer,
        isEarthquake: false
    });

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

function updateTerminal(deviceName, message) {
    const cityName = window.cityMap.get(deviceName).container.querySelector('.city-label').textContent;
    const terminalContent = document.getElementById('terminal-content');
    const now = new Date();
    const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    
    let interpretation = '';
    if (message === 'S') {
        interpretation = 'Earthquake detected!';
    } else if (message === 'A') {
        interpretation = 'Reset position to center';
    } else if (message.startsWith('temperature:')) {
        const temp = parseInt(message.split(':')[1]);
        interpretation = `${temp} ºC`;
        if (temp > HOT_TEMP) {
            interpretation += ' (Hot)';
        } else if (temp < COLD_TEMP) {
            interpretation += ' (Cold)';
        } else {
            interpretation += ' (Normal)';
        }
    } else if (message.startsWith('light:')) {
        const light = parseInt(message.split(':')[1]);
        if (light < DARK) {
            interpretation = 'Dark';
        } else if (light > LIGHT) {
            interpretation = 'Bright';
        } else {
            interpretation = 'Normal light';
        }
        interpretation += ` (${light})`;
    } else if (message.startsWith('dx:')) {
        const dx = parseInt(message.split(':')[1]);
        interpretation = `Moved ${dx}px horizontally`;
    } else if (message.startsWith('dy:')) {
        const dy = parseInt(message.split(':')[1]);
        interpretation = `Moved ${dy}px vertically`;
    }

    const logEntry = document.createElement('p');
    logEntry.innerHTML = `<span class="time">${time}</span> <span class="city-name">${cityName}</span> <span class="message">${message}</span> <span class="arrow">=></span> <span class="interpretation">${interpretation}</span>`;
    
    terminalContent.appendChild(logEntry);
    
    // Truncate old messages if needed
    while (terminalContent.children.length > MAX_MESSAGES) {
        terminalContent.removeChild(terminalContent.firstChild);
    }
    
    // Scroll to the bottom
    terminalContent.scrollTop = terminalContent.scrollHeight;
}

// Make the terminal draggable
interact('#terminal')
  .draggable({
    allowFrom: '#terminal-header',
    listeners: {
      move(event) {
        const target = event.target;
        const x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx;
        const y = (parseFloat(target.getAttribute('data-y')) || 0) + event.dy;

        target.style.transform = `translate(${x}px, ${y}px)`;
        target.setAttribute('data-x', x);
        target.setAttribute('data-y', y);
      }
    }
  })
  .resizable({
    edges: { bottom: true, right: true },
    listeners: {
      move(event) {
        let { x, y } = event.target.dataset;
        x = (parseFloat(x) || 0) + event.deltaRect.left;
        y = (parseFloat(y) || 0) + event.deltaRect.top;

        Object.assign(event.target.style, {
          width: `${event.rect.width}px`,
          height: `${event.rect.height}px`,
          transform: `translate(${x}px, ${y}px)`
        });

        Object.assign(event.target.dataset, { x, y });
      }
    }
  });