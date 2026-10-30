import assert from "node:assert/strict";
import { test } from "node:test";

import {
  checkProviderBaseUrl,
  isPrivateAddress,
  joinBaseUrl,
  localProvidersAllowed,
} from "../src/lib/posterpal/network-guard.ts";

// SSRF guard tests: a user-supplied provider URL is fetched server-side, so every
// private/metadata/loopback target must be rejected before it is saved or called.

test("private, loopback, link-local and CGNAT addresses are rejected", () => {
  for (const ip of [
    "127.0.0.1",
    "127.9.9.9",
    "10.0.0.1",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "224.0.0.1",
    "::1",
    "fe80::1",
    "fd00::1",
    "::ffff:10.0.0.1",
  ]) {
    assert.equal(isPrivateAddress(ip), true, ip);
  }
  for (const ip of ["8.8.8.8", "1.1.1.1", "172.15.0.1", "172.32.0.1", "2606:4700::1111"]) {
    assert.equal(isPrivateAddress(ip), false, ip);
  }
});

test("https public base URLs are accepted", () => {
  const r = checkProviderBaseUrl("https://api.groq.com/openai/v1");
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.url.toString(), "https://api.groq.com/openai/v1");
    assert.equal(r.local, false);
  }
});

test("trailing slug is normalised and joinBaseUrl never doubles slashes", () => {
  assert.equal(joinBaseUrl("https://x.test/v1/", "/chat/completions"), "https://x.test/v1/chat/completions");
  assert.equal(joinBaseUrl("https://x.test/v1", "chat/completions"), "https://x.test/v1/chat/completions");
});

test("http is rejected for remote hosts", () => {
  const r = checkProviderBaseUrl("http://api.example.com/v1");
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.reason, /https/);
});

test("loopback is rejected unless local providers are enabled", () => {
  const saved = process.env.POSTERPAL_ALLOW_LOCAL_PROVIDERS;
  try {
    delete process.env.POSTERPAL_ALLOW_LOCAL_PROVIDERS;
    assert.equal(localProvidersAllowed(), false);
    assert.equal(checkProviderBaseUrl("http://127.0.0.1:11434/v1").ok, false);
    assert.equal(checkProviderBaseUrl("https://127.0.0.1/v1").ok, false);
    process.env.POSTERPAL_ALLOW_LOCAL_PROVIDERS = "1";
    assert.equal(localProvidersAllowed(), true);
    // The env flag alone is not enough: the caller must opt in explicitly (saveAiKeys
    // passes it only through resolveProviderBaseUrl, which reads the env).
    assert.equal(checkProviderBaseUrl("http://127.0.0.1:11434/v1").ok, false);
    const local = checkProviderBaseUrl("http://127.0.0.1:11434/v1", { allowLocal: true });
    assert.equal(local.ok, true);
    if (local.ok) assert.equal(local.local, true);
    // local mode still refuses private non-loopback targets
    assert.equal(checkProviderBaseUrl("http://192.168.1.10:11434/v1", { allowLocal: true }).ok, false);
  } finally {
    if (saved === undefined) delete process.env.POSTERPAL_ALLOW_LOCAL_PROVIDERS;
    else process.env.POSTERPAL_ALLOW_LOCAL_PROVIDERS = saved;
  }
});

test("credentials, weird schemes and non-URLs are rejected", () => {
  assert.equal(checkProviderBaseUrl("https://user:pass@api.example.com/v1").ok, false);
  assert.equal(checkProviderBaseUrl("ftp://api.example.com/v1").ok, false);
  assert.equal(checkProviderBaseUrl("file:///etc/passwd").ok, false);
  assert.equal(checkProviderBaseUrl("not a url").ok, false);
  assert.equal(checkProviderBaseUrl("").ok, false);
  assert.equal(checkProviderBaseUrl("https://api.example.com/v1?key=1").ok, false);
  assert.equal(checkProviderBaseUrl("https://api.example.com/v1#frag").ok, false);
});

test("local-network hostnames are rejected", () => {
  assert.equal(checkProviderBaseUrl("https://router.local/v1").ok, false);
  assert.equal(checkProviderBaseUrl("https://db.internal/v1").ok, false);
  assert.equal(checkProviderBaseUrl("https://nas.lan/v1").ok, false);
});

test("IP-literal metadata endpoint is rejected even over https", () => {
  assert.equal(checkProviderBaseUrl("https://169.254.169.254/latest/meta-data").ok, false);
  assert.equal(checkProviderBaseUrl("https://[::1]/v1").ok, false);
});
