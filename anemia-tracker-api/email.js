const RESEND_API_URL = "https://api.resend.com/emails";

function isEmailDeliveryConfigured(env = process.env) {
  return Boolean(env.RESEND_API_KEY && env.RESEND_FROM_EMAIL);
}

async function sendPasswordResetEmail({ to, otp, expiresInMinutes = 5, fetchImpl = fetch, env = process.env }) {
  if (!isEmailDeliveryConfigured(env)) {
    const error = new Error("Email delivery is not configured");
    error.code = "EMAIL_DELIVERY_NOT_CONFIGURED";
    throw error;
  }
  const response = await fetchImpl(RESEND_API_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: env.RESEND_FROM_EMAIL,
      to: [to],
      subject: "Your Anemia Tracker password reset code",
      text: `Your password reset code is ${otp}. It expires in ${expiresInMinutes} minutes. If you did not request this, ignore this email.`,
    }),
  });
  if (!response.ok) {
    const error = new Error("Email delivery failed");
    error.code = "EMAIL_DELIVERY_FAILED";
    throw error;
  }
}

module.exports = { isEmailDeliveryConfigured, sendPasswordResetEmail };
