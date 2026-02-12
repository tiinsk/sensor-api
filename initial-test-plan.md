## Initial test plan

In order to make sure that the new lambda-api (with DynamoDB) works identically to the old API (sensor-api-OLD repo), tests are needed.

The Home monitor's home page contains a list of devices (ordered by device order). 

The home page has two selectors: "timeframe" and "sensor type". Timeframe options are day, week, month, and year. Sensor type options are temperature, humidity, and pressure. 

The page will fetch all latest readings for all devices and then, based on the timeframe and sensor type options, fetch all readings from that timeframe. For example, if timeframe is month and sensor type is temperature, day-level temperature readings are fetched for each device.

There is also a separate sensor data sender (running on a Raspberry Pi) that will send new readings through the API.

### Home monitor (front-end):
- authentication
  - login `POST /login`
- home page
  - devices `GET /devices`
  - latest readings `GET /latest`
  - timeframe (either day, week, month, or year)
    - statistics `GET /statistics`
    - sensor type (either temperature, humidity, or pressure)
      - timeframe = day -> level = 30 minutes
        - readings `GET /readings`
      - timeframe = week -> level = day
        - readings `GET /readings`
      - timeframe = month -> level = day
          - readings `GET /readings`
      - timeframe = year -> level = month
          - readings `GET /readings`

### Sensor data sender (Raspberry Pi):
- add reading `POST /devices/:id/readings`
