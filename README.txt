# Park Gate

## Smart Parking IoT System

Par Gate is an **IoT-based smart parking system** that integrates a mobile application, web-based administration dashboard, backend services, and smart parking gate hardware.

The system is designed to manage vehicle registration, parking access, parking sessions, exit authorization, payment, CCTV documentation, and multiple parking gates in an integrated environment.

---

## System Overview

ParkSense consists of four main components:

1. **User Mobile Application**
2. **Web Admin / Operator Dashboard**
3. **Backend Server**
4. **IoT Parking Gate Hardware**

```text id="1qu4j7"
                       ┌──────────────────────┐
                       │    User Mobile App   │
                       │                      │
                       │ • Vehicle Management │
                       │ • Notifications     │
                       │ • Exit Authorization│
                       └──────────┬───────────┘
                                  │
                                  │ API
                                  ▼
                       ┌──────────────────────┐
                       │    Backend Server    │
                       │                      │
                       │ • Authentication    │
                       │ • Parking Sessions  │
                       │ • Gate Management   │
                       │ • Notifications     │
                       │ • Payment Status    │
                       └───────┬───────┬──────┘
                               │       │
                         API / IoT     │
                               │       │
                ┌──────────────┘       └──────────────┐
                ▼                                     ▼
      ┌────────────────────┐               ┌────────────────────┐
      │   Web Admin        │               │ Parking Gate IoT   │
      │    Operator        │               │                    │
      │                    │               │ • Vehicle Sensor   │
      │ • Dashboard        │               │ • ANPR/LPR         │
      │ • Monitoring       │               │ • PIN Keypad       │
      │ • Users            │               │ • CCTV             │
      │ • Vehicles         │               │ • QRIS Display     │
      │ • Payments         │               │ • Barrier          │
      │ • Manual Auth      │               │ • IoT Controller   │
      └────────────────────┘               └────────────────────┘
```

---

# Main Features

## User Mobile Application

The mobile application is used by parking users.

Main features:

* Phone number registration
* OTP verification
* PIN creation
* PIN-based login
* Multiple vehicle registration
* Vehicle type selection
* STNK scanning
* Parking activity monitoring
* Entry photo viewing
* Exit photo viewing
* Parking notifications
* Exit authorization
* Payment status notifications
* User profile

---

## Web Admin / Operator

The web dashboard is used by parking administrators and operators.

Main features:

* Dashboard
* Parking monitoring
* Multi-gate monitoring
* User management
* Vehicle management
* Parking history
* Payment monitoring
* Revenue monitoring
* Exit request monitoring
* CCTV documentation
* Hardware status
* Tariff management
* Emergency/manual authorization
* Audit log

---

## IoT Parking Gate

Each parking gate is equipped with hardware for vehicle detection, identification, authentication, documentation, payment, and physical access control.

Main components:

* Vehicle sensor
* ANPR/LPR camera
* PIN keypad
* CCTV camera
* QRIS display
* IoT / industrial controller
* Barrier gate
* Network connection
* Power supply / UPS

---

# User Authentication

## Registration

The registration process is intentionally simple.

```text id="a2cg18"
Phone Number
      ↓
OTP Verification
      ↓
Create PIN
      ↓
Add Vehicle
      ↓
Account Ready
```

Users do not need to register an email or password.

---

## Login

User authentication uses a PIN.

```text id="e0q5fk"
Open App
   ↓
Enter PIN
   ↓
Login
```

The PIN is also used as part of the vehicle access authorization process.

---

# Vehicle Management

Users can register multiple vehicles.

Supported vehicle types:

* Motorcycle
* Car
* Truck
* Bus

Vehicle data includes:

* License plate
* Owner name
* Address
* Vehicle type
* Brand/model
* Vehicle color
* STNK information

---

# STNK Scanning

STNK registration is performed directly from the mobile application.

The application uses the camera to scan the STNK.

```text id="5o0r9r"
Open Add Vehicle
       ↓
Select Vehicle Type
       ↓
Scan STNK
       ↓
Automatic Capture
       ↓
STNK Data Recognition
       ↓
Show Result
       ↓
"Is the data correct?"
      /              \
   Save              Retake
    ↓                  ↓
Vehicle Added       Scan Again
```

The user can retake the photo if the captured STNK image or extracted data is incorrect.

---

# Parking Entry

The user does not need to open the mobile application when entering the parking area.

## Entry Flow

```text id="f0i9lq"
Vehicle Arrives
       ↓
Vehicle Sensor Detects Vehicle
       ↓
ANPR/LPR Reads License Plate
       ↓
User Enters PIN on Gate
       ↓
Backend Validates:
• License Plate
• PIN
• Registered Vehicle
       ↓
CCTV Captures Entry Documentation
       ↓
Parking Session Created
       ↓
Entry Date & Time Recorded
       ↓
Gate Opens
       ↓
Push Notification Sent
```

The system records the Gate ID used for entry.

Example:

```text id="0e5b3h"
Vehicle       : Honda Beat
License Plate : L 1234 XX
Entry Gate    : GATE-A
Entry Date    : 22 September 2026
Entry Time    : 08:15
Status        : PARKED
```

---

# Parking Session

A parking session is created when a vehicle successfully enters.

A session contains information such as:

* Vehicle
* License plate
* Entry gate
* Entry date
* Entry time
* Entry documentation
* Exit gate
* Exit date
* Exit time
* Exit documentation
* Payment status
* Session status

Example:

```text id="j8h3uw"
Vehicle       : Honda Beat
License Plate : L 1234 XX

Entry Gate    : GATE-A
Entry Time    : 08:15

Exit Gate     : GATE-B
Exit Time     : 17:35

Status        : EXITED
```

---

# Parking Exit

The exit process requires confirmation from the vehicle owner.

## Exit Flow

```text id="x8m6cy"
Vehicle Arrives at Exit Gate
          ↓
Vehicle Sensor Detects Vehicle
          ↓
ANPR/LPR Reads License Plate
          ↓
User Enters PIN on Gate
          ↓
Backend Finds Active Parking Session
          ↓
Exit Request Created
          ↓
Mobile Notification Sent
          ↓
User Opens Mobile App
          ↓
User Logs In Using PIN
          ↓
Exit Authorization
        /       \
      NO         YES
      ↓           ↓
Gate Closed   Authorization Sent
                  to Gate
                    ↓
              QRIS Displayed
                 at Gate
                    ↓
                Payment
                    ↓
             Payment Verified
                    ↓
            CCTV Captures Exit
                    ↓
             Exit Time Recorded
                    ↓
            Parking Session Done
                    ↓
               Gate Opens
                    ↓
           Exit Notification
```

---

# Exit Authorization

The user receives a notification:

```text id="njb0sn"
Vehicle Exit Request

Honda Beat
L 1234 XX

Gate A
17:30

Do you authorize this vehicle to exit?

[ NO ]       [ YES ]
```

The user must log in to the application using their PIN before confirming the request.

### If the user selects NO

```text
Exit Authorization
       ↓
Rejected
       ↓
Gate Remains Closed
```

### If the user selects YES

```text
Exit Authorization
       ↓
Backend Sends Authorization
       ↓
Correct Gate Receives Authorization
       ↓
QRIS Appears on Gate
```

The QRIS is **never displayed inside the mobile application**.

---

# QRIS Payment

Payment is performed at the physical parking gate.

The payment flow is:

```text id="3w0c4m"
User Approves Exit
       ↓
Gate Displays QRIS
       ↓
User Scans QRIS
       ↓
Payment
       ↓
Backend Receives Payment Status
       ↓
Payment Verified
       ↓
Exit Process Continues
```

Parking uses a flat-rate tariff.

| Vehicle Type |  Tariff |
| ------------ | ------: |
| Motorcycle   | Rp3,000 |
| Car          | Rp5,000 |
| Truck        | Rp5,000 |
| Bus          | Rp5,000 |

Entry and exit times are used for monitoring and history, not for calculating the tariff.

---

# CCTV Documentation

CCTV is used to capture visual documentation during parking access.

## Entry

CCTV captures documentation after the vehicle and PIN have been validated.

## Exit

CCTV captures documentation after payment has been successfully completed.

The mobile application does not automatically display these images.

Users can select:

* **View Entry Photo**
* **View Exit Photo**

to load the corresponding documentation.

Authorized operators can also access the documentation through the Web Admin.

---

# Multi-Gate Architecture

ParkSense supports multiple entrance and exit gates.

Every gate has a unique Gate ID.

Example:

```text id="1v0y2t"
GATE-A
Main Entrance

GATE-B
Main Exit

GATE-C
Basement Exit

GATE-D
East Exit
```

Each hardware device identifies itself using its Gate ID.

The backend uses this ID to determine which gate is handling a vehicle.

---

## Gate Identification

Example:

```text id="55tdh0"
GATE-A

Device ID:
GATE-A

Location:
Main Entrance

Status:
ONLINE
```

When a vehicle arrives:

```text id="zhb2l8"
Vehicle:
L 1234 XX

Gate:
GATE-A
```

The Gate ID becomes part of the parking session.

When the vehicle exits through another gate:

```text id="g6v2cq"
Entry Gate:
GATE-A

Exit Gate:
GATE-B
```

---

# Gate-to-Backend Communication

The hardware sends information to the backend.

Example:

```text id="qihj1d"
GATE-B

Vehicle Detected
        ↓
ANPR Result:
L 1234 XX
        ↓
PIN Entered
        ↓
Exit Request
        ↓
Waiting for User Approval
```

When the user presses **YES** in the mobile application:

```text id="y6t6h9"
Backend
   ↓
GATE-B
   ↓
Display QRIS
   ↓
Payment
   ↓
Open Barrier
```

The user does not manually select Gate B.

The backend knows which gate requested the authorization.

---

# Gate Hardware

## Vehicle Sensor

The vehicle sensor detects whether a vehicle is physically present at the gate.

Its purpose is only vehicle presence detection.

It does not identify the vehicle owner.

Possible implementations:

* IR beam sensor
* Ultrasonic / ToF sensor
* Radar vehicle detector
* Inductive loop for production deployment

---

## ANPR / LPR Camera

The ANPR/LPR camera is responsible for reading the vehicle license plate.

Example:

```text id="o5t40j"
Camera
   ↓
License Plate Detection
   ↓
L 1234 XX
   ↓
Backend
```

The plate number is then matched against registered vehicle data.

---

## PIN Keypad

The physical keypad allows the user to enter their PIN at the parking gate.

The backend validates the PIN against the registered user.

User PINs must never be exposed to administrators.

---

## CCTV Camera

CCTV provides visual documentation of the vehicle and surrounding access area.

It is used during:

* Vehicle entry
* Vehicle exit
* Manual verification when required

---

## QRIS Display

The QRIS display is located on the physical gate.

It remains inactive until the exit request has been authorized.

```text id="n2v7kd"
Exit Request
     ↓
User Approves YES
     ↓
Backend
     ↓
Correct Gate
     ↓
QRIS Display ON
```

---

## Barrier Gate

The barrier physically controls vehicle access.

The barrier opens only after the required validation and authorization process has been completed.

---

# Web Admin / Operator

The Web Admin is designed for desktop/PC use.

## Dashboard

The dashboard displays:

* Vehicles currently parked
* Entries today
* Exits today
* Revenue today
* Online gates
* Offline gates
* System alerts

Example:

```text id="7s30s9"
Currently Parked : 128
Entries Today    : 342
Exits Today      : 214
Revenue Today    : Rp1.070.000
Online Gates     : 8 / 10
Offline Gates    : 2
```

---

# Parking Monitor

The operator can monitor currently parked vehicles.

Example:

| Vehicle       | Plate     | Type       | Entry Time | Entry Gate | Status |
| ------------- | --------- | ---------- | ---------- | ---------- | ------ |
| Honda Beat    | L 1234 XX | Motorcycle | 08:15      | GATE-A     | Parked |
| Toyota Avanza | L 5678 AB | Car        | 08:30      | GATE-A     | Parked |

The operator can search by:

* License plate
* Vehicle type
* Gate
* Status

---

# Gate Monitoring

The Web Admin provides hardware monitoring for each gate.

Example:

```text id="0d1jmw"
GATE-A
Main Entrance

Gate Status      : ONLINE
Vehicle Sensor   : ONLINE
ANPR Camera      : ONLINE
CCTV             : ONLINE
PIN Keypad       : ONLINE
QRIS Display     : ONLINE
Barrier          : ONLINE
```

This allows operators to quickly identify hardware problems.

---

# User Management

Admin can view:

* User name
* Phone number
* Registered vehicle count
* Account status
* Registration date

Admin can search users using:

* Name
* Phone number
* License plate

The user's PIN is never displayed.

---

# Vehicle Management

Admin can manage registered vehicles.

Information includes:

* License plate
* Vehicle type
* Brand/model
* Color
* Owner
* STNK status
* Registration status

STNK images are only shown when viewing the vehicle detail.

---

# Parking History

The Web Admin can view completed parking sessions.

Example:

| Date | Vehicle | Plate | Entry | Exit | Entry Gate | Exit Gate | Status |
| ---- | ------- | ----- | ----- | ---- | ---------- | --------- | ------ |

Filters:

* Date
* License plate
* Vehicle type
* Gate
* Status

---

# Payment Monitoring

The admin can monitor payment transactions.

Information includes:

* Transaction ID
* Date
* Time
* Vehicle
* License plate
* Vehicle type
* Gate
* Payment status
* Amount

Payment statuses:

* Pending
* Paid
* Failed

---

# Exit Request Monitoring

Operators can monitor active exit requests.

Example:

```text id="y9y6gn"
Honda Beat
L 1234 XX

Gate:
GATE-B

Status:
Waiting for User Approval
```

Possible statuses:

```text id="l0h4f9"
Waiting for User Approval
Approved
Rejected
Waiting for Payment
Payment Completed
Exited
```

The normal exit authorization is performed by the vehicle owner through the mobile application.

---

# Emergency Manual Authorization

If the user's phone is unavailable, for example because the phone battery is dead, the operator can perform manual verification.

The user provides the physical STNK.

The operator verifies:

* License plate
* Owner name
* Vehicle type
* Vehicle information
* STNK information

Flow:

```text id="0q7d8x"
Physical STNK
      ↓
Operator Verification
      ↓
Vehicle Data Matched
      ↓
Manual Authorization
      ↓
QRIS Appears at Gate
      ↓
Payment
      ↓
CCTV Documentation
      ↓
Barrier Opens
```

Every manual authorization must be recorded in the Audit Log.

---

# Audit Log

The system records important administrative actions.

Example:

| Date       | Time  | Admin       | Action                    | Gate   | Vehicle   |
| ---------- | ----- | ----------- | ------------------------- | ------ | --------- |
| 22/09/2026 | 17:32 | Operator 01 | Manual Exit Authorization | GATE-B | L 1234 XX |

Logged actions may include:

* Manual exit authorization
* Vehicle data changes
* User data changes
* Tariff changes
* Gate configuration changes
* Administrative login

---

# Tariff Management

Administrators can configure parking tariffs.

Default tariff:

```text id="9j7hbt"
Motorcycle   Rp3,000
Car          Rp5,000
Truck        Rp5,000
Bus          Rp5,000
```

Tariff changes are recorded in the Audit Log.

---

# Notification System

The mobile application receives notifications for important parking events.

## Entry Notification

```text id="4v0o5r"
Vehicle Entered Successfully

Honda Beat
L 1234 XX

Gate A
08:15

[ View Photo ]
```

## Exit Request

```text id="7w2j5u"
Vehicle Exit Request

Honda Beat
L 1234 XX

Gate A
17:30

[ NO ] [ YES ]
```

## Payment Notification

```text id="5z4q2s"
Payment Successful

Honda Beat
L 1234 XX
```

## Exit Notification

```text id="l9i5jz"
Vehicle Exited Successfully

Honda Beat
L 1234 XX

Gate A
17:35

[ View Photo ]
```

---

# Parking Activity in Mobile App

The mobile application keeps the parking interface simple.

The Home screen directly displays the user's parking activity.

Example:

```text id="d7d6ly"
Honda Beat
L 1234 XX
22 September 2026

Entry : 08:15  [ View Photo ]
Exit  : 17:35  [ View Photo ]
```

No separate complex history detail page is required.

Parking fees are not displayed in the user's parking activity list.

---

# System Status

A parking session can use statuses such as:

```text id="p5br3s"
PARKED
   ↓
EXIT REQUEST
   ↓
WAITING FOR APPROVAL
   ↓
AUTHORIZED
   ↓
WAITING FOR PAYMENT
   ↓
PAYMENT COMPLETED
   ↓
EXITED
```

---

# Security

ParkSense follows basic security principles:

* User PINs are stored securely using hashing.
* User PINs are never shown to administrators.
* Authentication is required for sensitive actions.
* Every gate has a unique Gate ID.
* Vehicle access is validated against registered vehicle data.
* Manual authorizations are logged.
* Administrative actions are recorded in the Audit Log.
* STNK data is restricted to authorized access.
* CCTV documentation is restricted to authorized access.

---

# Data Flow

The overall system data flow is:

```text id="8f9mcv"
                    USER
                     │
                     ▼
              ┌─────────────┐
```
