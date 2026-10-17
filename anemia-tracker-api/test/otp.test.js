const assert = require("node:assert/strict");
const Module = require("node:module");
const { after, before, beforeEach, test } = require("node:test");

const otpHelpers = require("../otp");

test("phone validation accepts supported numbers and rejects malformed input", () => {
  assert.equal(otpHelpers.isValidPhoneNumber("9876543210"), true);
  assert.equal(otpHelpers.isValidPhoneNumber("+91 98765-43210"), true);
  assert.equal(otpHelpers.normalizePhoneNumber("98765 43210"), "+919876543210");
  assert.equal(otpHelpers.normalizePhoneNumber("+91 98765-43210"), "+919876543210");
  assert.equal(otpHelpers.isValidPhoneNumber("1412345678"), false);
  assert.equal(otpHelpers.isValidPhoneNumber("5123456789"), false);
  assert.equal(otpHelpers.isValidPhoneNumber("fdsfs"), false);
  assert.equal(otpHelpers.isValidPhoneNumber("1234567"), false);
  assert.equal(otpHelpers.isValidPhoneNumber("1234567890123456"), false);
  assert.equal(otpHelpers.isValidPhoneNumber("+92 9876543210"), false);
  assert.equal(otpHelpers.isValidPhoneNumber("91+9876543210"), false);
  for (const value of ["", "   ", "9", "98", "987654", "09876543210", "987654321", "98765432101", "+91", "+91987654321", "+9198765432101", "++919876543210", "+91+9876543210", "98765abc10", "98765 43210 ext 2", "１２３４５６７８９０"]) {
    assert.equal(otpHelpers.isValidPhoneNumber(value), false, value);
  }
  assert.equal(otpHelpers.isValidPhoneNumber("(98765) 43210"), true);
  assert.equal(otpHelpers.isValidPhoneNumber("98765.43210"), true);
});

const originalEnv = {
  ALLOW_DEV_OTP: process.env.ALLOW_DEV_OTP,
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET,
  NODE_ENV: process.env.NODE_ENV,
  OTP_SMS_PROVIDER: process.env.OTP_SMS_PROVIDER,
};

process.env.DATABASE_URL = "postgres://unit-test";
process.env.JWT_SECRET = "unit-test-secret";

const originalLoad = Module._load;
Module._load = function loadWithoutDotenv(request, parent, isMain) {
  if (request === "dotenv") {
    return {
      config() {
        return {};
      },
    };
  }

  return originalLoad.call(this, request, parent, isMain);
};

const { app, pool } = require("../index");
Module._load = originalLoad;
const originalPoolQuery = pool.query.bind(pool);
let server;
let baseUrl;

function restoreEnv() {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

async function request(path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return {
    status: response.status,
    body: await response.json(),
  };
}

function stubPoolQuery(handler) {
  pool.query = async (...args) => handler(...args);
}

function stubActiveParent(parentId = 123) {
  stubPoolQuery((sql) => {
    if (sql.includes("WHERE phone_number = $1 AND status = 'active'")) {
      return {
        rows: [{ parent_id: parentId }],
      };
    }

    if (sql.includes("WHERE parent_id = $1 AND phone_number = $2 AND status = 'active'")) {
      return {
        rows: [{ parent_id: parentId }],
      };
    }

    throw new Error("Unexpected query in OTP test");
  });
}

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(() => {
  otpHelpers.parentOtpResendStore.clear();
  otpHelpers.mockOtpDeliveries.length = 0;
  pool.query = originalPoolQuery;
  delete process.env.ALLOW_DEV_OTP;
  delete process.env.OTP_SMS_PROVIDER;
  process.env.NODE_ENV = "test";
});

after(async () => {
  restoreEnv();
  Module._load = originalLoad;
  pool.query = originalPoolQuery;

  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }

  await pool.end();
});

test("mock provider is available only outside production and does not store OTP values", async () => {
  process.env.OTP_SMS_PROVIDER = " mock ";

  assert.equal(otpHelpers.getOtpSmsProvider(), "mock");
  assert.equal(otpHelpers.isMockOtpSmsProviderEnabled(), true);
  assert.equal(otpHelpers.isOtpSmsDeliveryConfigured(), true);

  await otpHelpers.sendOtpSms(" +919876543210 ", "123456");

  assert.equal(otpHelpers.mockOtpDeliveries.length, 1);
  assert.deepEqual(Object.keys(otpHelpers.mockOtpDeliveries[0]), [
    "phone_number",
    "sent_at",
  ]);
  assert.equal(otpHelpers.mockOtpDeliveries[0].phone_number, "+919876543210");
});

test("mock provider is rejected in production", async () => {
  process.env.NODE_ENV = "production";
  process.env.OTP_SMS_PROVIDER = "mock";

  assert.equal(otpHelpers.isOtpSmsDeliveryConfigured(), false);

  await assert.rejects(
    () => otpHelpers.sendOtpSms("+919876543210", "123456"),
    {
      code: "OTP_DELIVERY_NOT_CONFIGURED",
    },
  );
  assert.equal(otpHelpers.mockOtpDeliveries.length, 0);
});

test("development OTP response gate is explicit and disabled in production", () => {
  process.env.ALLOW_DEV_OTP = "true";

  assert.equal(otpHelpers.canReturnDevelopmentOtp(), true);
  assert.equal(otpHelpers.isOtpSmsDeliveryConfigured(), true);
  assert.equal(
    Object.hasOwn(otpHelpers.createOtpRequestSuccessResponse("123456"), "otp"),
    true,
  );

  process.env.NODE_ENV = "production";

  assert.equal(otpHelpers.canReturnDevelopmentOtp(), false);
  assert.equal(otpHelpers.isOtpSmsDeliveryConfigured(), false);
  assert.equal(
    Object.hasOwn(otpHelpers.createOtpRequestSuccessResponse("123456"), "otp"),
    false,
  );
});

test("cooldown is keyed by normalized phone number and expired entries are pruned", () => {
  const now = 1000;

  assert.deepEqual(otpHelpers.getOtpCooldownState(" +919876543210 ", now), {
    allowed: true,
    retryAfterSeconds: 0,
  });

  otpHelpers.recordOtpRequestCooldown(" +919876543210 ", now);
  otpHelpers.recordOtpRequestCooldown("+919999999999", now);

  assert.deepEqual(otpHelpers.getOtpCooldownState("+919876543210", now + 1), {
    allowed: false,
    retryAfterSeconds: 60,
  });
  assert.equal(otpHelpers.parentOtpResendStore.size, 2);
  assert.deepEqual(otpHelpers.getOtpCooldownState("+919876543210", now + 60000), {
    allowed: true,
    retryAfterSeconds: 0,
  });
  assert.equal(otpHelpers.parentOtpResendStore.size, 0);
});

test("mock delivery history is bounded", async () => {
  process.env.OTP_SMS_PROVIDER = "mock";

  for (let index = 0; index < otpHelpers.MOCK_OTP_DELIVERY_HISTORY_LIMIT + 5; index += 1) {
    await otpHelpers.sendOtpSms(`+9198765432${String(index).padStart(2, "0")}`, "123456");
  }

  assert.equal(
    otpHelpers.mockOtpDeliveries.length,
    otpHelpers.MOCK_OTP_DELIVERY_HISTORY_LIMIT,
  );
  assert.equal(otpHelpers.mockOtpDeliveries[0].phone_number, "+919876543205");
});

test("production OTP requests fail with 503 and do not query the database", async () => {
  process.env.NODE_ENV = "production";
  process.env.OTP_SMS_PROVIDER = "mock";
  process.env.ALLOW_DEV_OTP = "true";
  let queryCount = 0;
  stubPoolQuery(() => {
    queryCount += 1;
    throw new Error("Database should not be queried");
  });

  const response = await request("/parents/login/request-otp", {
    phone_number: "+919876540001",
  });

  assert.equal(response.status, 503);
  assert.deepEqual(response.body, {
    message: "OTP delivery is not configured",
  });
  assert.equal(queryCount, 0);
});

test("eligible mock OTP request does not disclose OTP without development gate", async () => {
  process.env.OTP_SMS_PROVIDER = "mock";
  stubActiveParent();

  const response = await request("/parents/login/request-otp", {
    phone_number: "+919876540002",
  });

  assert.equal(response.status, 200);
  assert.equal(Object.hasOwn(response.body, "otp"), false);
  assert.equal(otpHelpers.mockOtpDeliveries.length, 1);
});

test("eligible development OTP request discloses OTP only with explicit gate", async () => {
  process.env.ALLOW_DEV_OTP = "true";
  stubActiveParent();

  const response = await request("/parents/login/request-otp", {
    phone_number: "+919876540003",
  });

  assert.equal(response.status, 200);
  assert.match(response.body.otp, /^\d{6}$/);
});

test("expired OTPs are rejected by the verification route", async () => {
  process.env.ALLOW_DEV_OTP = "true";
  stubActiveParent();

  const originalDateNow = Date.now;
  Date.now = () => 1000;

  try {
    const otpResponse = await request("/parents/login/request-otp", {
      phone_number: "+919876540004",
    });

    Date.now = () => 1000 + 5 * 60 * 1000 + 1;

    const verifyResponse = await request("/parents/login/verify-otp", {
      phone_number: "+919876540004",
      otp: otpResponse.body.otp,
    });

    assert.equal(verifyResponse.status, 401);
    assert.deepEqual(verifyResponse.body, {
      message: "Invalid or expired OTP",
    });
  } finally {
    Date.now = originalDateNow;
  }
});

test("OTP state is deleted after five incorrect attempts", async () => {
  process.env.ALLOW_DEV_OTP = "true";
  let revalidationQueryCount = 0;
  stubPoolQuery((sql) => {
    if (sql.includes("WHERE phone_number = $1 AND status = 'active'")) {
      return {
        rows: [{ parent_id: 456 }],
      };
    }

    if (sql.includes("WHERE parent_id = $1 AND phone_number = $2 AND status = 'active'")) {
      revalidationQueryCount += 1;
      return {
        rows: [{ parent_id: 456 }],
      };
    }

    throw new Error("Unexpected query in OTP test");
  });

  const otpResponse = await request("/parents/login/request-otp", {
    phone_number: "+919876540005",
  });

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const wrongResponse = await request("/parents/login/verify-otp", {
      phone_number: "+919876540005",
      otp: "000000",
    });
    assert.equal(wrongResponse.status, 401);
  }

  const correctResponse = await request("/parents/login/verify-otp", {
      phone_number: "+919876540005",
    otp: otpResponse.body.otp,
  });

  assert.equal(correctResponse.status, 401);
  assert.equal(revalidationQueryCount, 0);
});
