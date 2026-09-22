# Park Gate

### Smart Parking & Vehicle Access System

ParkSense is a smart parking system designed to integrate a mobile user application with IoT-based parking gates.

The system allows registered users to manage their vehicles, monitor parking activity, receive parking notifications, and authorize vehicle exits through the mobile application.

The project is designed to support multiple parking gates and connect them through a centralized backend.

---

## Features

### User Authentication

* Phone number registration
* OTP verification
* PIN creation
* PIN-based login

No email or password is required for the main authentication flow.

---

### Vehicle Management

Users can register multiple vehicles.

Supported vehicle types:

* Motorcycle
* Car
* Truck
* Bus

Vehicle registration uses an STNK scanning flow:

```text
Scan STNK
   ↓
Automatic Capture
   ↓
Read STNK Data
   ↓
Confirm Data
   ↓
Save / Retake
```

The application can retrieve vehicle information such as:

* License plate number
* Owner name
* Address
* Vehicle brand/type
* Vehicle color
* STNK information

---

## Parking Monitoring

The mobile application provides a simple parking activity list directly on the Home screen.

Each parking record contains:

* Vehicle
* License plate
* Date
* Entry time
* Exit time
* Entry photo
* Exit photo

Example:

```text
Honda Beat
L 1234 XX
22 September 2026

Entry : 08:15   [View Photo]
Exit  : 17:30   [View Photo]
```

Parking photos are not displayed automatically. Users can view them by selecting the corresponding **View Photo** button.

Parking fees are not displayed in the parking activity log.

---

## Parking Entry Flow

The user does not need to open the mobile application when entering the parking area.

```text
Vehicle Arrives
      ↓
Vehicle Sensor Detects Vehicle
      ↓
ANPR Reads License Plate
      ↓
User Enters PIN on Gate
      ↓
Backend Validates Vehicle + PIN
      ↓
CCTV Captures Entry Documentation
      ↓
Entry Session Created
      ↓
Barrier Opens
      ↓
Push Notification Sent
```

The system records the entry time and the Gate ID used by the vehicle.

---

## Parking Exit Flow

The exit process requires authorization from the vehicle owner.

```text
Vehicle Arrives at Exit Gate
          ↓
Vehicle Sensor Detects Vehicle
          ↓
ANPR Reads License Plate
          ↓
User Enters PIN on Gate
          ↓
Active Parking Session Found
          ↓
Notification Sent to Mobile App
          ↓
User Opens App
          ↓
PIN Login
          ↓
Exit Authorization
       /       \
     NO         YES
     ↓           ↓
Gate Closed   QRIS Appears
                on Gate
                  ↓
               Payment
                  ↓
             CCTV Capture
                  ↓
             Exit Recorded
                  ↓
             Barrier Opens
                  ↓
          Exit Notification
```

The QRIS is displayed **only on the physical parking gate**, not inside the mobile application.

---

## Exit Authorization

When a vehicle requests to leave, the user receives a notification such as:

```text
Vehicle Exit Request

Honda Beat
L 1234 XX

Gate A
17:30

Do you authorize this vehicle to exit?

[ NO ]    [ YES ]
```

The user must log in using their PIN before approving the exit request.

If the user selects **NO**, the gate remains closed.

If the user selects **YES**, the backend sends authorization to the specific gate where the vehicle is waiting.

---

## Multi-Gate Support

ParkSense supports multiple parking gates.

Each gate has a unique identifier.

Example:

```text
GATE-A
Main Entrance

GATE-B
Main Exit

GATE-C
Basement Exit
```

The Gate ID is sent to the backend by the hardware.

The user does not manually select a gate.

For example:

```text
Vehicle:
L 1234 XX

Gate:
GATE-B

Status:
Waiting for Payment
```

When the user approves the exit request, the backend knows that the QRIS and authorization must be sent to `GATE-B`.

This allows multiple gates to operate independently while remaining connected to the same backend.

---

## Parking Tariff

Parking uses a flat-rate pricing model.

| Vehicle Type | Tariff  |
| ------------ | ------- |
| Motorcycle   | Rp3,000 |
| Car          | Rp5,000 |
| Truck        | Rp5,000 |
| Bus          | Rp5,000 |

The tariff is used during the payment process.

**Parking fees are not displayed in the user's parking history.**

---

## Mobile Application

The mobile application contains four main sections:

```text
Home
├── Current Parking
└── Parking Activity

Vehicles
├── Vehicle List
├── Add Vehicle
└── STNK Scan

Notifications
├── Entry Notification
├── Exit Request
├── Payment Notification
└── Exit Notification

Profile
└── User Account
```

---

## System Architecture

ParkSense consists of three main components:

```text
┌─────────────────────┐
│    Mobile App       │
│       User          │
└──────────┬──────────┘
           │
           │ API
           ▼
┌─────────────────────┐
│      Backend        │
│       Server        │
└──────────┬──────────┘
           │
           │ IoT / Network
           ▼
┌─────────────────────┐
│    Parking Gate     │
│                     │
│  ANPR               │
│  PIN Keypad         │
│  CCTV               │
│  QRIS Display       │
│  Vehicle Sensor     │
│  Barrier            │
└─────────────────────┘
```

---

## Gate Components

Each parking gate may contain:

* Vehicle sensor
* ANPR/LPR camera
* PIN keypad
* CCTV camera
* QRIS display
* IoT controller
* Barrier gate
* Network connection

### Vehicle Sensor

The vehicle sensor is responsible only for detecting the presence of a vehicle.

It does not identify the vehicle owner.

### ANPR/LPR

The ANPR camera reads the vehicle license plate.

### CCTV

CCTV provides visual documentation during entry and exit.

### PIN Keypad

The keypad allows the user to authenticate at the physical gate.

### QRIS Display

The QRIS display is activated after exit authorization has been approved.

---

## Emergency Exit

If the user's phone is unavailable or the battery is dead, an operator can perform manual verification.

The operator verifies the physical STNK against the registered vehicle data.

After verification:

```text
Physical STNK Verification
          ↓
Operator Authorization
          ↓
QRIS Displayed on Gate
          ↓
Payment
          ↓
CCTV Documentation
          ↓
Barrier Opens
```

Manual authorization is recorded for auditing purposes.

---

## Security

* User PINs must not be displayed to administrators.
* PINs should be stored securely using hashing.
* Each parking gate has a unique Gate ID.
* Vehicle access is associated with a registered parking session.
* Manual operator authorization should be logged.
* CCTV and STNK data should have restricted access.

---

## Privacy

The system may process vehicle and identification data such as:

* License plate numbers
* STNK images
* Vehicle information
* CCTV images
* Parking activity

Access to this information should be restricted to authorized users and operators.

---

## Project Status

ParkSense is currently under development.

The project is being developed as a prototype for an IoT-based smart parking system consisting of:

* Mobile User Application
* Backend Server
* IoT Parking Gate
* ANPR/LPR
* CCTV
* QRIS Payment
* Multi-Gate Management

---

## License

This project is intended for educational and prototype development purposes.
