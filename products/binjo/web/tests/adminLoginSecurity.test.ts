import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import {
  adminCredentialsMatch,
  adminLoginClientKey,
  adminLoginFailureLimiter,
  FailedLoginLimiter,
} from "../lib/adminLoginSecurity";

test("credentials require both exact values", () => {
  const configured = { username: "admin", password: "correct horse battery" };

  assert.equal(adminCredentialsMatch(configured, configured), true);
  assert.equal(
    adminCredentialsMatch(
      { username: "other", password: configured.password },
      configured
    ),
    false
  );
  assert.equal(
    adminCredentialsMatch(
      { username: configured.username, password: "wrong" },
      configured
    ),
    false
  );
});

test("proxy addresses are ignored unless the deployment explicitly trusts them", () => {
  const headers = new Headers({
    "x-forwarded-for": "198.51.100.9, 203.0.113.20",
  });

  assert.equal(
    adminLoginClientKey(headers, {
      trustProxyHeaders: false,
      directAddress: "192.0.2.4",
    }),
    "ip:192.0.2.4"
  );
  assert.equal(
    adminLoginClientKey(headers, {
      trustProxyHeaders: true,
      directAddress: "192.0.2.4",
    }),
    "ip:203.0.113.20"
  );
});

test("client keys accept valid IPv6 and reject arbitrary forwarding text", () => {
  assert.equal(
    adminLoginClientKey(
      new Headers({ "x-forwarded-for": "unknown, [2001:db8::7]:443" }),
      { trustProxyHeaders: true }
    ),
    "ip:2001:db8::7"
  );
  assert.equal(
    adminLoginClientKey(
      new Headers({ "x-forwarded-for": "attacker-controlled" }),
      { trustProxyHeaders: true }
    ),
    "ip:unavailable"
  );
});

test("five failures block the client for the remainder of the five-minute window", () => {
  let now = 1_000_000;
  const limiter = new FailedLoginLimiter({ now: () => now });

  for (let attempt = 0; attempt < 5; attempt += 1) {
    assert.deepEqual(limiter.check("ip:192.0.2.8"), { limited: false });
    limiter.recordFailure("ip:192.0.2.8");
  }

  assert.deepEqual(limiter.check("ip:192.0.2.8"), {
    limited: true,
    retryAfterSeconds: 300,
  });

  now += 299_100;
  assert.deepEqual(limiter.check("ip:192.0.2.8"), {
    limited: true,
    retryAfterSeconds: 1,
  });

  now += 900;
  assert.deepEqual(limiter.check("ip:192.0.2.8"), { limited: false });
});

test("a successful login can clear prior failures", () => {
  const limiter = new FailedLoginLimiter();
  const clientKey = "ip:192.0.2.11";

  limiter.recordFailure(clientKey);
  limiter.recordFailure(clientKey);
  limiter.clear(clientKey);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    assert.deepEqual(limiter.check(clientKey), { limited: false });
    limiter.recordFailure(clientKey);
  }
  assert.equal(limiter.check(clientKey).limited, true);
});

test("admin login route clears failures on success and returns Retry-After when blocked", async () => {
  process.env.ADMIN_USERNAME = "route-test-admin";
  process.env.ADMIN_PASSWORD = "route-test-password";
  process.env.ADMIN_FARMER_ID = "00000000-0000-4000-8000-000000000001";
  process.env.JWT_SECRET = "route-test-jwt-secret-with-sufficient-entropy";
  process.env.ADMIN_LOGIN_TRUST_PROXY = "true";

  const clientAddress = "203.0.113.44";
  const clientKey = `ip:${clientAddress}`;
  adminLoginFailureLimiter.clear(clientKey);

  const { POST } = await import("../app/api/admin/login/route");
  const submit = (username: string, password: string) =>
    POST(
      new NextRequest("https://farm.example/api/admin/login", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": clientAddress,
        },
        body: JSON.stringify({ username, password }),
      })
    );

  try {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      assert.equal((await submit("route-test-admin", "wrong-password")).status, 401);
    }

    const successful = await submit("route-test-admin", "route-test-password");
    assert.equal(successful.status, 200);
    assert.match(successful.headers.get("set-cookie") ?? "", /admin_token=/);
    assert.equal(successful.headers.get("cache-control"), "no-store");

    // The successful request cleared the first two failures, so five new
    // failures are still processed before the following request is blocked.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      assert.equal((await submit("route-test-admin", "wrong-password")).status, 401);
    }

    const blocked = await submit("route-test-admin", "route-test-password");
    assert.equal(blocked.status, 429);
    assert.equal(blocked.headers.get("retry-after"), "300");
    assert.equal(blocked.headers.get("cache-control"), "no-store");
    assert.equal((await blocked.json()).error.code, "TOO_MANY_ATTEMPTS");
  } finally {
    adminLoginFailureLimiter.clear(clientKey);
  }
});
