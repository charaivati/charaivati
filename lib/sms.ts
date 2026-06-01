export async function sendSMS(phone: string, code: string) {
  const authkey = process.env.MSG91_AUTHKEY;
  if (!authkey) {
    console.log(`[SMS stub] To: ${phone} | OTP: ${code}`);
    return;
  }

  // Normalize to E.164 without leading +
  const mobile = phone.replace(/^\+/, "");

  const res = await fetch("https://control.msg91.com/api/v5/otp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      authkey,
    },
    body: JSON.stringify({
      mobile,
      otp: code,
      // uses the default OTP template on your MSG91 account
    }),
  });

  const json = await res.json().catch(() => null);
  console.log("[MSG91 response]", res.status, JSON.stringify(json));

  if (!res.ok) {
    throw new Error(`MSG91 send OTP failed: ${res.status} ${JSON.stringify(json)}`);
  }
}
