export async function sendWhatsAppOTP(phone: string, code: string) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || "1095968196938919";
  const templateName = process.env.WHATSAPP_TEMPLATE_NAME || "hello_world";

  if (!token) {
    console.log(`[WhatsApp stub] To: ${phone} | OTP: ${code}`);
    return;
  }

  // Normalize phone: strip +, spaces, dashes. Ensure country code prefix.
  const normalizedPhone = phone.replace(/[^0-9]/g, "");

  const res = await fetch(
    `https://graph.facebook.com/v25.0/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: normalizedPhone,
        type: "template",
        template: {
          name: templateName,
          language: { code: "en_US" },
          // When using hello_world template: no components needed
          // When using authentication template: uncomment below
          // components: [
          //   { type: "body", parameters: [{ type: "text", text: code }] },
          //   { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: code }] }
          // ],
        },
      }),
    }
  );

  const data = await res.json();

  if (!res.ok) {
    console.error("[WhatsApp] API error:", data);
    throw new Error(`WhatsApp send failed: ${data?.error?.message || res.status}`);
  }

  console.log("[WhatsApp] Message sent:", data?.messages?.[0]?.id);
}
