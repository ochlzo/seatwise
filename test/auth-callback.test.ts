import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveLoginCallbackUrl,
  sanitizeInternalReturnPath,
} from "../lib/auth/redirect.ts";

test("sanitizeInternalReturnPath rejects unsafe values", () => {
  assert.equal(sanitizeInternalReturnPath(null), null);
  assert.equal(sanitizeInternalReturnPath(undefined), null);
  assert.equal(sanitizeInternalReturnPath("https://evil.com"), null);
  assert.equal(sanitizeInternalReturnPath("//evil.com"), null);
  assert.equal(sanitizeInternalReturnPath("dashboard"), null);
  assert.equal(sanitizeInternalReturnPath("/login"), null);
});

test("resolveLoginCallbackUrl prefers default dashboard when header return is root", () => {
  const callback = resolveLoginCallbackUrl({
    headerReturnTo: "/",
    defaultReturnTo: "/dashboard",
  });

  assert.equal(callback, "/dashboard");
});

test("resolveLoginCallbackUrl uses header return for protected route when valid", () => {
  const callback = resolveLoginCallbackUrl({
    headerReturnTo: "/dashboard?tab=upcoming",
    defaultReturnTo: "/dashboard",
  });

  assert.equal(callback, "/dashboard?tab=upcoming");
});

test("resolveLoginCallbackUrl preserves deep-link show detail callback", () => {
  const callback = resolveLoginCallbackUrl({
    headerReturnTo: "/cml5d3s030003y0xyo2qe3uyh",
    defaultReturnTo: "/dashboard",
  });

  assert.equal(callback, "/cml5d3s030003y0xyo2qe3uyh");
});

test("resolveLoginCallbackUrl falls back to default when header return is unsafe", () => {
  const callback = resolveLoginCallbackUrl({
    headerReturnTo: "https://evil.com/phish",
    defaultReturnTo: "/admin",
  });

  assert.equal(callback, "/admin");
});
