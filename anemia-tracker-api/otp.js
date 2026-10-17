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
  const result = validateIndianMobileNumber(phoneNumber);
  return result.normalized || (typeof phoneNumber === "string" ? phoneNumber.trim() : "");
}

function isValidPhoneNumber(phoneNumber) {
  return validateIndianMobileNumber(phoneNumber).valid;
}

function validateIndianMobileNumber(phoneNumber) {
  if (typeof phoneNumber !== "string" || phoneNumber.trim() === "") {
    return { valid: false, reason: "required", normalized: "" };
  }

  const value = phoneNumber.trim();
  if (!/^[0-9+().\-\s]+$/.test(value) || /[+]/.test(value.slice(1)) || /^[.\-]|[.\-]$/.test(value) || /[+][().\-]|[().\-]\s*[+]/.test(value) || /[().\-]{2,}/.test(value)) {
    return { valid: false, reason: "format", normalized: "" };
  }

  const compact = value.replace(/[\s().-]/g, "");
  let nationalNumber = compact;
  if (compact.startsWith("+91")) {
    nationalNumber = compact.slice(3);
  } else if (compact.startsWith("+")) {
    return { valid: false, reason: "country_code", normalized: "" };
  } else if (compact.length === 12 && compact.startsWith("91")) {
    return { valid: false, reason: "country_code", normalized: "" };
  }

  if (nationalNumber.length !== 10) {
    return { valid: false, reason: "incomplete", normalized: "" };
  }
  if (!/^[0-9]+$/.test(nationalNumber)) {
    return { valid: false, reason: "format", normalized: "" };
  }
  if (!/^[6-9]/.test(nationalNumber)) {
    return { valid: false, reason: "prefix", normalized: "" };
  }
  return { valid: true, reason: "", normalized: `+91${nationalNumber}` };
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
  isValidPhoneNumber,
  validateIndianMobileNumber,
  parentOtpResendStore,
  pruneExpiredOtpCooldowns,
  recordOtpRequestCooldown,
  sendOtpSms,
};
