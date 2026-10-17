const assert = require("node:assert/strict");
const { test } = require("node:test");
const { isEmailDeliveryConfigured, sendPasswordResetEmail } = require("../email");

test("email delivery reports missing configuration without sending", async () => {
  assert.equal(isEmailDeliveryConfigured({}), false);
  await assert.rejects(
    sendPasswordResetEmail({ to: "school@example.test", otp: "123456", env: {}, fetchImpl: async () => { throw new Error("must not send"); } }),
    { code: "EMAIL_DELIVERY_NOT_CONFIGURED" },
  );
});

test("email delivery uses a mocked Resend request without exposing test values", async () => {
  let request;
  await sendPasswordResetEmail({
    to: "school@example.test",
    otp: "123456",
    env: { RESEND_API_KEY: "test-key", RESEND_FROM_EMAIL: "no-reply@example.test" },
    fetchImpl: async (url, options) => { request = { url, options }; return { ok: true }; },
  });
  assert.equal(request.url, "https://api.resend.com/emails");
  assert.deepEqual(JSON.parse(request.options.body).to, ["school@example.test"]);
  assert.match(JSON.parse(request.options.body).text, /expires in 5 minutes/);
});

test("email delivery converts provider failures to a safe error", async () => {
  await assert.rejects(
    sendPasswordResetEmail({ env: { RESEND_API_KEY: "test-key", RESEND_FROM_EMAIL: "no-reply@example.test" }, fetchImpl: async () => ({ ok: false }) }),
    { code: "EMAIL_DELIVERY_FAILED" },
  );
});
