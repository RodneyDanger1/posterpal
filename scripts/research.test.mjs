import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractTopics,
  inferLocale,
  inferPagePurpose,
  parseResearchJson,
  planSearchQueries,
} from "../src/lib/posterpal/research.ts";

describe("page research planner", () => {
  it("infers Winona locale from voice", () => {
    assert.equal(inferLocale("Warm independent bookstore on the Mississippi in Winona."), "Winona, Minnesota");
  });

  it("extracts topics from captions without stop words", () => {
    const topics = extractTopics([
      "Saturday story hour is back. Picture books on the river rug.",
      "Story hour cider and a hardcover on the river.",
      "Tote restock from the shop — river print.",
    ]);
    assert.ok(topics.includes("story") || topics.includes("river") || topics.includes("tote"));
    assert.ok(!topics.includes("saturday"));
  });

  it("plans distinct public-web queries from profile + brief", () => {
    const profile = {
      pageId: "p1",
      name: "North Shore Books",
      category: "Bookstore",
      brandVoice: "Warm independent bookstore in Winona.",
      purpose: "A bookstore Page.",
      localeHint: "Winona, Minnesota",
      topics: ["story", "river", "tote"],
      merch: [{ title: "River tote", url: "https://example.com/tote" }],
      recentCaptions: [],
      suggestedBriefs: [],
    };
    const qs = planSearchQueries(profile, "farmers market hours this weekend");
    assert.ok(qs.length >= 3);
    assert.ok(qs.some((q) => /farmers/i.test(q)));
    assert.ok(qs.some((q) => /Winona/i.test(q)));
    const lower = qs.map((q) => q.toLowerCase());
    assert.equal(new Set(lower).size, lower.length);
  });

  it("builds a purpose sentence from voice + topics + merch", () => {
    const purpose = inferPagePurpose(
      {
        id: "1",
        user_id: "u",
        facebook_page_id: null,
        name: "North Shore Books",
        category: "Bookstore",
        fan_count: 1,
        tasks_json: null,
        is_active: true,
        is_read_only: false,
        is_practice: true,
        ai_provider: null,
        ai_model: null,
        brand_voice: "Warm independent bookstore on the Mississippi.",
        cadence_warn_per_24h: 8,
        cadence_block_per_24h: 20,
        created_at: "",
        updated_at: "",
        has_token: false,
      },
      ["story", "river"],
      ["River tote"],
    );
    assert.match(purpose, /bookstore/i);
    assert.match(purpose, /story/);
    assert.match(purpose, /River tote/);
  });

  it("parses research JSON with notes and citations", () => {
    const parsed = parseResearchJson(
      `here\n{"summary":"Market is 8–noon.","topics":["market"],"notes":[{"heading":"Hours","body":"8–noon Saturday","url":"https://city.example/market","confidence":"verified"}],"sources":[{"title":"City","url":"https://city.example/market"}],"image_prompt":"photoreal market stall"}`,
    );
    assert.equal(parsed.summary, "Market is 8–noon.");
    assert.equal(parsed.notes[0]?.confidence, "verified");
    assert.equal(parsed.sources[0]?.url, "https://city.example/market");
    assert.equal(parsed.imageHint, "photoreal market stall");
  });
});
