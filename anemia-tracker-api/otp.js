const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const MOCK_OTP_DELIVERY_HISTORY_LIMIT = 20;

const parentOtpResendStore = new Map();
const mockOtpDeliveries = [];

function canReturnDevelopmentOtp() {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.ALLOW_DEV_OTP === "true"
  );
}

function normalizePhoneNumber(phoneNumber) {
  return phoneNumber.trim();
}

function getOtpSmsProvider() {
  return (process.env.OTP_SMS_PROVIDER || "").trim().toLowerCase();
}

function isMockOtpSmsProviderEnabled() {
  return getOtpSmsProvider() === "mock";
}

function isOtpSmsDeliveryConfigured() {
  return (
    canReturnDevelopmentOtp() ||
    (process.env.NODE_ENV !== "production" && isMockOtpSmsProviderEnabled())
  );
}

async function sendOtpSms(phoneNumber, otp) {
  const provider = getOtpSmsProvider();

  if (provider === "mock") {
    if (process.env.NODE_ENV === "production") {
      const error = new Error("OTP delivery is not configured");
      error.code = "OTP_DELIVERY_NOT_CONFIGURED";
      throw error;
    }

    mockOtpDeliveries.push({
      phone_number: normalizePhoneNumber(phoneNumber),
      sent_at: Date.now(),
    });

    if (mockOtpDeliveries.length > MOCK_OTP_DELIVERY_HISTORY_LIMIT) {
      mockOtpDeliveries.splice(
        0,
        mockOtpDeliveries.length - MOCK_OTP_DELIVERY_HISTORY_LIMIT,
      );
    }

    return;
  }

  const error = new Error("OTP delivery is not configured");
  error.code = "OTP_DELIVERY_NOT_CONFIGURED";
  throw error;
}

function pruneExpiredOtpCooldowns(now = Date.now()) {
  for (const [phoneNumber, cooldownExpiresAt] of parentOtpResendStore) {
    if (now >= cooldownExpiresAt) {
      parentOtpResendStore.delete(phoneNumber);
    }
  }
}

function getOtpCooldownState(phoneNumber, now = Date.now()) {
  pruneExpiredOtpCooldowns(now);

  const normalizedPhoneNumber = normalizePhoneNumber(phoneNumber);
  const cooldownExpiresAt = parentOtpResendStore.get(normalizedPhoneNumber) || 0;

  if (now < cooldownExpiresAt) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((cooldownExpiresAt - now) / 1000),
    };
  }

  return {
    allowed: true,
    retryAfterSeconds: 0,
  };
}

function recordOtpRequestCooldown(phoneNumber, now = Date.now()) {
  parentOtpResendStore.set(
    normalizePhoneNumber(phoneNumber),
    now + OTP_RESEND_COOLDOWN_MS,
  );
}

function createOtpRequestSuccessResponse(otp) {
  const response = {
    message: "If the number is registered and eligible, an OTP can be requested.",
    expires_in_seconds: 300,
  };

  if (canReturnDevelopmentOtp() && otp) {
    response.otp = otp;
  }

  return response;
}

module.exports = {
  MOCK_OTP_DELIVERY_HISTORY_LIMIT,
  canReturnDevelopmentOtp,
  createOtpRequestSuccessResponse,
  getOtpCooldownState,
  getOtpSmsProvider,
  isMockOtpSmsProviderEnabled,
  isOtpSmsDeliveryConfigured,
  mockOtpDeliveries,
  normalizePhoneNumber,
  parentOtpResendStore,
  pruneExpiredOtpCooldowns,
  recordOtpRequestCooldown,
  sendOtpSms,
};
