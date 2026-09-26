require('dotenv').config();
const app = require('./src/app');
const { activeChannel } = require('./src/otp');

const PORT = process.env.PORT || 4000;

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is not set. Copy .env.example to .env and set it before starting.');
  process.exit(1);
}

app.listen(PORT, () => {
  console.log(`Park Gate server running on http://localhost:${PORT}`);
  console.log(`User app:     http://localhost:${PORT}/`);
  console.log(`Admin panel:  http://localhost:${PORT}/admin/`);
  console.log(`OTP channel:  ${activeChannel()} ${activeChannel() === 'dev_console' ? '(set .env to send real WhatsApp/SMS/Email OTP)' : ''}`);
});
