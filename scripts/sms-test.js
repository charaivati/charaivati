// scripts/sms-test.js
require('dotenv').config();
const Twilio = require('twilio');

async function main() {
  const sid = process.env.TWILIO_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;
  const to = process.env.MY_TEST_PHONE; // set this in .env as your verified number

  if (!sid || !token || !from || !to) {
    console.error('Missing TWILIO_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER or MY_TEST_PHONE in .env');
    process.exit(1);
  }

  const client = Twilio(sid, token);

  try {
    const msg = await client.messages.create({
      body: `Test SMS from your app — time: ${new Date().toISOString()}`,
      from,
      to
    });
    console.log('SMS sent, SID:', msg.sid);
  } catch (err) {
    console.error('Failed to send SMS:', err.message || err);
    process.exit(2);
  }
}

main();
