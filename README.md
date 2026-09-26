# Park Gate — Real Application

Park Gate is a **real working parking management application**, not a simulation.

It consists of a real **Node.js backend + SQLite database** and a **PWA frontend** that connects directly to the API instead of using static mockup screens.

The application supports real OTP registration and verification. OTPs are stored and validated in the database using hashing and expiration times.

After registration, the phone number used by the user is automatically remembered on that device. Users do not need to enter their phone number every time they log in. The login screen only requires the PIN, with a **"Change Number"** option available for switching to another account on the same device.

## Features

- Real Node.js backend
- SQLite database using `better-sqlite3`
- No native compilation or Visual Studio Build Tools required
- Compatible with Node.js 22–24 on Windows
- Real API integration
- PWA user application
- OTP registration and verification
- Hashed OTP storage
- OTP expiration
- JWT authentication
- Vehicle management
- Parking session management
- Parking history
- Exit authorization
- STNK photo upload
- Admin dashboard
- Gate Simulator
- Database-backed parking data

## Requirements

Make sure the following are installed:

- Node.js 22–24
- npm

Check your installed versions:

```bash
node --version
npm --version