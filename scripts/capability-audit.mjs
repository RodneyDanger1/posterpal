#!/usr/bin/env node
/**
 * Capability audit — derive what PosterPal can ACTUALLY do from the code, then
 * compare it to what the docs/prompts claim. Exits non-zero on a hard failure
 * (claimed capability with no implementation), so it can gate CI.
 *
 *   node scripts/capability-audit.mjs            # audit + print matrix
 *   node scripts/capability-audit.mjs --write    # also write docs/CAPABILITY-AUDIT.md
 *
 * Mirrors the capability-auditor protocol: matrix first, then ranked gaps.
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src");

function read(path) {
  return readFileSync(join(ROOT, path), "utf8");
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|mjs)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const allSrcFiles = walk(SRC);

function moduleBody(text, startMarker, endMarker) {
  const start = text.indexOf(startMarker);
  if (start < 0) return "";
  const candidates = endMarker
    ? [endMarker]
    : ["] as const", "\r\n];", "\n];", "};"];
  let end = -1;
  for (const marker of candidates) {
    const idx = text.indexOf(marker, start + startMarker.length);
    if (idx >= 0 && (end < 0 || idx < end)) end = idx;
  }
  return end < 0 ? text.slice(start) : text.slice(start, end);
}

function quoted(text) {
  return [...text.matchAll(/"([a-z0-9_-]+)"/g)].map((m) => m[1]);
}

// ── 1. Server-function surface: exported fns vs actual imports ───────────────
function auditServerFns() {
  const definitions = [];
  for (const rel of [
    "src/lib/posterpal/fns.ts",
    "src/lib/posterpal/messenger-fns.ts",
    "src/lib/commerce/fns.ts",
  ]) {
    const text = read(rel);
    for (const m of text.matchAll(/export const (\w+Fn) = createServerFn/g)) {
      definitions.push({ name: m[1], file: rel });
    }
  }
  const wired = [];
  const dead = [];
  for (const fn of definitions) {
    let used = false;
    for (const file of allSrcFiles) {
      const rel = relative(ROOT, file).replace(/\\/g, "/");
      if (rel === fn.file) continue;
      const text = readFileSync(file, "utf8");
      if (new RegExp(`\\b${fn.name}\\b`).test(text)) {
        used = true;
        break;
      }
    }
    (used ? wired : dead).push(fn);
  }
  return { total: definitions.length, wired, dead };
}

// ── 2. Agent personas/skills: advertised vs gated in code ────────────────────
function auditAgent() {
  const skillsFile = read("src/lib/posterpal/agent-skills.ts");
  const agentFile = read("src/lib/posterpal/agent.ts");
  const personas = quoted(moduleBody(skillsFile, "export const AGENT_PERSONAS = ["));
  const skills = quoted(moduleBody(skillsFile, "export const AGENT_SKILLS = ["));
  const personaMapBody = moduleBody(skillsFile, "export const PERSONAS: Record<AgentPersonaId, AgentPersona> = {");
  const skillsForRunBody = skillsFile.slice(skillsFile.indexOf("export function skillsForRun"));
  const overlayBody = skillsFile.slice(skillsFile.indexOf("export function personaSystemOverlay"));
  const personasMissing = personas.filter((p) => !new RegExp(`\\b${p}:`).test(personaMapBody));
  const personaOverlaysMissing = personas.filter((p) => !overlayBody.includes(`"${p}"`) && !overlayBody.includes(`'${p}'`));
  const skillsUnhandled = skills.filter((s) => !skillsForRunBody.includes(`"${s}"`) && !skillsForRunBody.includes(`'${s}'`));
  return {
    personas,
    skills,
    personasMissing,
    personaOverlaysMissing,
    skillsUnhandled,
    agentRunnerPresent: /export async function runDeskAgent/.test(agentFile),
    hitlRefusalPresent: /REFUSE_RE/.test(agentFile),
  };
}

// ── 3. AI providers: every catalog entry has a handler ──────────────────────
function auditProviders() {
  const providersFile = read("src/lib/posterpal/providers.ts");
  const aiFile = read("src/lib/posterpal/ai.ts");
  const ids = (section) => [...section.matchAll(/\bid:\s*"([a-z0-9_-]+)"/g)].map((m) => m[1]);
  const textIds = [...new Set(ids(moduleBody(providersFile, "export const TEXT_PROVIDERS")))];
  const imageIds = [...new Set(ids(moduleBody(providersFile, "export const IMAGE_PROVIDERS")))];
  const textMissing = textIds.filter((id) => !new RegExp(`provider === "${id}"`).test(aiFile));
  const imageMissing = imageIds.filter(
    (id) =>
      !new RegExp(`provider === "${id}"`).test(aiFile) &&
      !new RegExp(`input\\.provider === "${id}"`).test(aiFile),
  );
  return {
    text: textIds,
    image: imageIds,
    textMissing,
    imageMissing,
    customGuard: /resolveProviderBaseUrl/.test(aiFile),
    ssrfGuardModule: /isPrivateAddress/.test(read("src/lib/posterpal/network-guard.ts")),
  };
}

// ── 4. Claimed product capabilities → implementation markers ────────────────
const CAPABILITY_MARKERS = [
  ["Publish now (Graph)", "src/lib/posterpal/publish.ts", "attemptGraphPublish"],
  ["Schedule on Graph (10m–30d window)", "src/lib/posterpal/graph.ts", "facebookScheduleWindow"],
  ["Local scheduler (worker/tick)", "scripts/worker.ts", "tickScheduler"],
  ["Inbox: reply / hide / handled", "src/routes/api/sync/action.ts", "hide"],
  ["Analytics: post engagement", "src/lib/posterpal/sync.ts", "reactions_count"],
  ["Analytics: media views w/ metric fallback", "src/lib/posterpal/insights.ts", "post_media_view"],
  ["AI captions (multi-provider)", "src/lib/posterpal/ai.ts", "generateCaptionVariants"],
  ["AI images (multi-provider + aspect)", "src/lib/posterpal/ai.ts", "aspectRatio"],
  ["Agent research with refuse list", "src/lib/posterpal/agent.ts", "REFUSE_RE"],
  ["Messenger webhook + 24h window", "src/lib/posterpal/messenger.ts", "messagingWindow"],
  ["Commerce: Fourthwall products/orders/webhook", "src/lib/commerce/fourthwall.ts", "verifyFourthwallSignature"],
  ["Print pipeline (DPI/upscale/quantise)", "src/lib/commerce/print-assets.ts", "prepareForPrint"],
  ["Media on disk + serving route", "src/routes/api/media/$id.ts", "readMediaBytes"],
  ["Needs-you inbox aggregation", "src/lib/posterpal/devices.ts", "needsYou"],
  ["Custom OpenAI-compatible provider", "src/lib/posterpal/ai.ts", "chatCustom"],
  ["Magic Wand prompt improver (works without AI)", "src/lib/posterpal/prompt-craft.ts", "improveImagePromptHeuristic"],
  ["Image metadata scrub before publish", "src/lib/posterpal/publish.ts", "sanitizeDataUrl"],
  ["Magic-byte upload validation", "src/lib/posterpal/media-files.ts", "sniffMime"],
  ["Fuzzy Page rail search", "src/components/app-shell.tsx", "fuzzyFilter"],
  ["List auto-animation (@formkit/auto-animate)", "src/routes/inbox.tsx", "useAutoAnimate"],
  ["Wand UI wired to caption/image prompts", "src/components/magic-wand.tsx", "improvePromptFn"],
  ["Saved prompt styles + locks persisted", "src/lib/posterpal/prompt-fns.ts", "savePromptStyleFn"],
  ["Caption quality score", "src/lib/posterpal/prompt-craft.ts", "scoreCaption"],
  ["SSRF guard for custom endpoints", "src/lib/posterpal/network-guard.ts", "resolveProviderBaseUrl"],
];

function auditCapabilities() {
  return CAPABILITY_MARKERS.map(([name, file, marker]) => {
    let present = false;
    try {
      present = read(file).includes(marker);
    } catch {
      present = false;
    }
    return { name, file, marker, present };
  });
}

// ── 5. Graph endpoint census (what the desk actually calls) ─────────────────
function auditGraphCalls() {
  const files = allSrcFiles.filter((f) => /posterpal\/(publish|graph|sync|insights|messenger|facebook-oauth)\.ts$/.test(f.replace(/\\/g, "/")));
  const paths = new Set();
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(/path:\s*[`"']([^`"']+)[`"']/g)) paths.add(m[1].replace(/\$\{[^}]+\}/g, "{id}").split("?")[0]);
  }
  return [...paths].sort();
}

export function audit() {
  const serverFns = auditServerFns();
  const agent = auditAgent();
  const providers = auditProviders();
  const capabilities = auditCapabilities();
  const graphCalls = auditGraphCalls();
  const failures = [];
  if (!agent.agentRunnerPresent) failures.push("Agent runner missing");
  if (agent.personasMissing.length) failures.push(`Personas without config: ${agent.personasMissing.join(", ")}`);
  if (agent.skillsUnhandled.length) failures.push(`Skills advertised but never gated: ${agent.skillsUnhandled.join(", ")}`);
  if (providers.textMissing.length) failures.push(`Text providers without handler: ${providers.textMissing.join(", ")}`);
  if (providers.imageMissing.length) failures.push(`Image providers without handler: ${providers.imageMissing.join(", ")}`);
  if (!providers.customGuard || !providers.ssrfGuardModule) failures.push("Custom provider SSRF guard missing");
  for (const cap of capabilities) if (!cap.present) failures.push(`Claimed capability has no code marker: ${cap.name} (${cap.file})`);
  // Secrets must never appear in source.
  const secretRe = /(sk-[A-Za-z0-9]{20,}|EAA[A-Za-z0-9]{30,}|xai-[A-Za-z0-9]{20,})/;
  const leaking = allSrcFiles.filter((f) => secretRe.test(readFileSync(f, "utf8"))).map((f) => relative(ROOT, f));
  if (leaking.length) failures.push(`Secret-shaped strings in source: ${leaking.join(", ")}`);
  return {
    generatedAt: new Date().toISOString(),
    serverFns,
    agent,
    providers,
    capabilities,
    graphCalls,
    failures,
    counts: {
      serverFns: serverFns.total,
      wiredFns: serverFns.wired.length,
      deadFns: serverFns.dead.length,
      personas: agent.personas.length,
      skills: agent.skills.length,
      textProviders: providers.text.length,
      imageProviders: providers.image.length,
      capabilitiesPresent: capabilities.filter((c) => c.present).length,
      capabilitiesTotal: capabilities.length,
    },
  };
}

function renderMarkdown(result) {
  const lines = [];
  lines.push("# PosterPal capability audit");
  lines.push("");
  lines.push(`Generated: ${result.generatedAt} · source-derived (not hand-written)`);
  lines.push("");
  lines.push("## Matrix");
  lines.push("");
  lines.push("| Capability | Code marker | Verdict |");
  lines.push("|---|---|---|");
  for (const cap of result.capabilities) {
    lines.push(`| ${cap.name} | \`${cap.file}\` · \`${cap.marker}\` | ${cap.present ? "PASS" : "FAIL"} |`);
  }
  lines.push("");
  lines.push("## Server functions");
  lines.push("");
  lines.push(`- Exported: **${result.serverFns.total}** · referenced somewhere: **${result.serverFns.wired.length}** · unreferenced: **${result.serverFns.dead.length}**`);
  if (result.serverFns.dead.length) {
    lines.push(`- Unreferenced (dead surface or mobile-only): ${result.serverFns.dead.map((f) => `\`${f.name}\``).join(", ")}`);
  }
  lines.push("");
  lines.push("## Desk agent");
  lines.push("");
  lines.push(`- Personas: ${result.agent.personas.join(", ")}`);
  lines.push(`- Skills: ${result.agent.skills.join(", ")}`);
  lines.push(`- Personas without config: ${result.agent.personasMissing.join(", ") || "none"}`);
  lines.push(`- Skills not gated in \`skillsForRun\`: ${result.agent.skillsUnhandled.join(", ") || "none"}`);
  lines.push(`- Refuse list present: ${result.agent.hitlRefusalPresent ? "yes" : "NO"}`);
  lines.push("");
  lines.push("## AI providers");
  lines.push("");
  lines.push(`- Text: ${result.providers.text.join(", ")}`);
  lines.push(`- Image: ${result.providers.image.join(", ")}`);
  lines.push(`- Missing text handlers: ${result.providers.textMissing.join(", ") || "none"}`);
  lines.push(`- Missing image handlers: ${result.providers.imageMissing.join(", ") || "none"}`);
  lines.push(`- Custom endpoint SSRF guard: ${result.providers.customGuard && result.providers.ssrfGuardModule ? "present" : "MISSING"}`);
  lines.push("");
  lines.push("## Graph endpoint census (paths referenced in code)");
  lines.push("");
  lines.push(result.graphCalls.map((p) => `- \`${p}\``).join("\n") || "- none parsed");
  lines.push("");
  lines.push("## Verdict");
  lines.push("");
  if (result.failures.length) {
    for (const f of result.failures) lines.push(`- **FAIL** ${f}`);
  } else {
    lines.push("- All claimed capabilities have a code path; no advertised provider/persona/skill is unimplemented.");
  }
  return lines.join("\n");
}

const isMain = process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("scripts/capability-audit.mjs");
if (isMain) {
  const result = audit();
  console.log(renderMarkdown(result));
  if (process.argv.includes("--write")) {
    writeFileSync(join(ROOT, "docs/CAPABILITY-AUDIT.md"), renderMarkdown(result) + "\n");
    console.log("\nwrote docs/CAPABILITY-AUDIT.md");
  }
  if (result.failures.length) {
    console.error(`\n${result.failures.length} hard failure(s).`);
    process.exit(1);
  }
  process.exit(0);
}
