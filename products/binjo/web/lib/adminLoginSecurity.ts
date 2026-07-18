import { createHash, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";

export const ADMIN_LOGIN_FAILURE_LIMIT = 5;
export const ADMIN_LOGIN_WINDOW_MS = 5 * 60 * 1000;

const UNAVAILABLE_CLIENT_KEY = "ip:unavailable";

function normalizedIp(value: string | null | undefined): string | null {
  if (!value) return null;

  let candidate = value.trim();
  if (!candidate) return null;

  // A few proxies include the source port even though X-Forwarded-For
  // normally contains a bare address. Accept the common bracketed IPv6 and
  // IPv4-with-port forms without accepting arbitrary header text.
  const bracketedIpv6 = candidate.match(/^\[([^\]]+)](?::\d+)?$/);
  if (bracketedIpv6) {
    candidate = bracketedIpv6[1];
  } else {
    const ipv4WithPort = candidate.match(/^([^:]+):(\d+)$/);
    if (ipv4WithPort && isIP(ipv4WithPort[1]) === 4) {
      candidate = ipv4WithPort[1];
    }
  }

  return isIP(candidate) ? candidate : null;
}

export function adminLoginClientKey(
  headers: Pick<Headers, "get">,
  options: {
    trustProxyHeaders: boolean;
    directAddress?: string | null;
  }
): string {
  if (options.trustProxyHeaders) {
    const forwardedFor = headers.get("x-forwarded-for");
    if (forwardedFor) {
      // The closest trusted reverse proxy appends (or replaces with) the
      // address it observed. Reading from the right avoids trusting a
      // client-supplied left-most value when a proxy preserves the chain.
      const addresses = forwardedFor.split(",");
      for (let index = addresses.length - 1; index >= 0; index -= 1) {
        const address = normalizedIp(addresses[index]);
        if (address) return `ip:${address}`;
      }
    }
  }

  const directAddress = normalizedIp(options.directAddress);
  return directAddress ? `ip:${directAddress}` : UNAVAILABLE_CLIENT_KEY;
}

function sha256(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

export function constantTimeStringEqual(actual: string, expected: string): boolean {
  // Hashing first gives timingSafeEqual equal-length buffers even when a
  // submitted credential has a different byte length from the configured one.
  return timingSafeEqual(sha256(actual), sha256(expected));
}

export function adminCredentialsMatch(
  submitted: { username: string; password: string },
  configured: { username: string; password: string }
): boolean {
  // Evaluate both comparisons before combining their results so a wrong user
  // name does not skip the password comparison.
  const usernameMatches = constantTimeStringEqual(
    submitted.username,
    configured.username
  );
  const passwordMatches = constantTimeStringEqual(
    submitted.password,
    configured.password
  );
  return usernameMatches && passwordMatches;
}

export type RateLimitDecision =
  | { limited: false }
  | { limited: true; retryAfterSeconds: number };

export class FailedLoginLimiter {
  private readonly failures = new Map<string, number[]>();

  constructor(
    private readonly options: {
      limit?: number;
      windowMs?: number;
      maxTrackedClients?: number;
      now?: () => number;
    } = {}
  ) {}

  private get limit(): number {
    return this.options.limit ?? ADMIN_LOGIN_FAILURE_LIMIT;
  }

  private get windowMs(): number {
    return this.options.windowMs ?? ADMIN_LOGIN_WINDOW_MS;
  }

  private get maxTrackedClients(): number {
    return this.options.maxTrackedClients ?? 10_000;
  }

  private now(): number {
    return this.options.now?.() ?? Date.now();
  }

  private activeFailures(clientKey: string, now: number): number[] {
    const attempts = this.failures.get(clientKey);
    if (!attempts) return [];

    const cutoff = now - this.windowMs;
    const active = attempts.filter((attempt) => attempt > cutoff);
    if (active.length === 0) {
      this.failures.delete(clientKey);
      return [];
    }

    if (active.length !== attempts.length) {
      this.failures.set(clientKey, active);
    }
    return active;
  }

  check(clientKey: string): RateLimitDecision {
    const now = this.now();
    const attempts = this.activeFailures(clientKey, now);
    if (attempts.length < this.limit) return { limited: false };

    return {
      limited: true,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((attempts[0] + this.windowMs - now) / 1000)
      ),
    };
  }

  recordFailure(clientKey: string): void {
    const now = this.now();
    const attempts = this.activeFailures(clientKey, now);
    if (attempts.length >= this.limit) return;

    if (!this.failures.has(clientKey) && this.failures.size >= this.maxTrackedClients) {
      this.removeExpiredClients(now);
      if (this.failures.size >= this.maxTrackedClients) {
        // Bound memory under source-IP rotation. Evicting the oldest entry
        // weakens only that entry's limit and keeps the login process available.
        const oldestClient = this.failures.keys().next().value as string | undefined;
        if (oldestClient) this.failures.delete(oldestClient);
      }
    }

    attempts.push(now);
    this.failures.set(clientKey, attempts);
  }

  clear(clientKey: string): void {
    this.failures.delete(clientKey);
  }

  private removeExpiredClients(now: number): void {
    for (const clientKey of this.failures.keys()) {
      this.activeFailures(clientKey, now);
    }
  }
}

export const adminLoginFailureLimiter = new FailedLoginLimiter();
