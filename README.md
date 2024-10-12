# microbit_sensornet
Collect data from a swarm of micro:bits in the browser over BLE. This repository implements a central "dashboard" web app ideal for a workshop setting where audience members program their micro:bits to communicate with the central dashboard. The app has a button for connecting to nearby micro:bits and will reconnect to any devices that drop off due to weak signal or interference. We have tested the functionality in a large conference room using 10 micro:bits — devices within a radius of 10 m should be okay.

## Launching the dashboard
A [live version] of this dashboard is available via GitHub pages.

## Customising the dashboard
Much of the dashboard can be tweaked using your browsers developer tools (right-click anywhere and choose _Insect_). You can change the background and icons easily this way. To make more fundamental changes or to preserve your modifications (typically they are reset every time you refresh the page), download or clone this repository, then serve locally, e.g. using `python -m http.server` or similar. This method only works for testing on your local machine, as HTTPS is required for Web Bluetooth access. To create your own dashboard accessible from anywhere you can create a GitHub repository and use its GitHub pages functionality — it's free and works great.

## Micro:bit code
A bare minimum starting point MakeCode sketch is available [here][starting point] and simply handles the initial connection. A larger demo program using all of the dashboard's recognised message types can be found [here][full demo].

[live version]: https://mehrresearch.github.io/microbit_sensornet/
[starting point]: https://makecode.microbit.org/_6k9g5UadyV9k
[full demo]: https://makecode.microbit.org/_27C0q1947UWh
