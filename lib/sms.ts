export async function sendSMS(phone: string, code: string) {
  // TODO: integrate Twilio / MSG91 / AWS SNS
  console.log(`[SMS] To: ${phone} | OTP: ${code}`);
}
