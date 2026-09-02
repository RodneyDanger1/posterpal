import { randomUUID } from "node:crypto";
import { getSql } from "@/lib/db";
import { localSentiment } from "./ai";
import { setSetting } from "./repo";

export async function seedPracticeWorkspace(userId: string): Promise<void> {
  const sql = await getSql();
  const existing = await sql<{ n: number }>`
    select count(*)::int as n from pages where user_id = ${userId}
  `;
  if (Number(existing[0]?.n ?? 0) > 0) {
    await expandPracticeFleet(userId);
    await ensureMemory(userId);
    return;
  }

  const nsb = randomUUID();
  const ww = randomUUID();
  const now = new Date();
  const iso = (d: Date) => d.toISOString();
  const hoursAgo = (h: number) => iso(new Date(now.getTime() - h * 3600_000));
  const hoursAhead = (h: number) => iso(new Date(now.getTime() + h * 3600_000));

  await sql`
    insert into pages (
      id, user_id, facebook_page_id, name, category, fan_count, tasks_json,
      is_active, is_read_only, is_practice, brand_voice, cadence_warn_per_24h, cadence_block_per_24h
    ) values
    (
      ${nsb}, ${userId}, null, ${"North Shore Books"}, ${"Bookstore"}, ${2847},
      ${JSON.stringify(["ANALYZE", "ADVERTISE", "MODERATE", "CREATE_CONTENT", "MANAGE"])},
      true, false, true,
      ${"Warm independent bookstore on the Mississippi. Specific, bookish, never salesy. Talk like a well-read neighbor in Winona."},
      8, 20
    ),
    (
      ${ww}, ${userId}, null, ${"Winona Weekend"}, ${"Local events"}, ${1204},
      ${JSON.stringify(["ANALYZE", "CREATE_CONTENT", "MODERATE"])},
      true, false, true,
      ${"Upbeat local events desk. Short, useful, time-and-place first. No FOMO theatrics."},
      8, 20
    )
  `;

  type SeedPost = {
    id: string;
    page: string;
    message: string;
    status: string;
    media: string;
    published?: string;
    scheduled?: string;
    reactions: number;
    comments: number;
    shares: number;
    views?: number;
    link?: string;
    variant?: string;
    error?: string;
  };

  const idStory = randomUUID();
  const idArrivals = randomUUID();
  const idStaff = randomUUID();
  const idHours = randomUUID();
  const idFail = randomUUID();
  const idFarmers = randomUUID();
  const idShow = randomUUID();
  const idCta = randomUUID();
  const idOverdue = randomUUID();

  const posts: SeedPost[] = [
    {
      id: idStory,
      page: nsb,
      message:
        "Saturday story hour is back at 10:30. Picture books on the river rug, cider for grown-ups, and a quiet corner if you just need a chair and a hardcover. Bring a neighbor.",
      status: "Published",
      media: "Photo",
      published: hoursAgo(30),
      reactions: 86,
      comments: 12,
      shares: 9,
      views: 1420,
    },
    {
      id: idArrivals,
      page: nsb,
      message:
        "New arrivals from Minnesota authors landed this morning — Louise Erdrich reprints, a slim Winona history, and the cookbook that made our staff fight over the galley. Come browse before they walk.",
      status: "Published",
      media: "Carousel",
      published: hoursAgo(78),
      reactions: 54,
      comments: 7,
      shares: 4,
      views: 980,
    },
    {
      id: idStaff,
      page: nsb,
      message:
        "Staff pick Tuesday: a novel that starts on a train and ends in a kitchen you will want to stand in. Ask Maya at the desk — she will put it in your hands.",
      status: "LocalScheduled",
      media: "Text",
      scheduled: hoursAhead(18),
      reactions: 0,
      comments: 0,
      shares: 0,
      variant: "Storytelling",
    },
    {
      id: idHours,
      page: nsb,
      message:
        "Holiday hours draft — open 10–6 through Christmas Eve, closed Christmas Day, back December 26. Need a photo of the front window display.",
      status: "LocalDraft",
      media: "Text",
      reactions: 0,
      comments: 0,
      shares: 0,
    },
    {
      id: idFail,
      page: nsb,
      message:
        "Flash sale on totes — 20% off this weekend only. Grab one with your next stack.",
      status: "Failed",
      media: "Photo",
      reactions: 0,
      comments: 0,
      shares: 0,
      error: "Graph 100: unpublished_content_type is not available on this Page. Saved as a local draft instead.",
    },
    {
      id: idFarmers,
      page: ww,
      message:
        "Saturday market on 2nd Street, 8–noon. Live fiddle at 9, leftover bread at 11. Street parking fills by 8:15 — bike if you can.",
      status: "Published",
      media: "Photo",
      published: hoursAgo(20),
      reactions: 41,
      comments: 6,
      shares: 11,
      views: 760,
    },
    {
      id: idShow,
      page: ww,
      message:
        "Thursday at the winery: two local bands, doors 7, music 8. Tickets at the door, cash or card. If you are bringing a dog, keep them on the lawn side.",
      status: "FacebookScheduled",
      media: "Text",
      scheduled: hoursAhead(52),
      reactions: 0,
      comments: 0,
      shares: 0,
    },
    {
      id: idCta,
      page: nsb,
      message:
        "Need a gift that actually gets opened? Our Winona tote is restocked — heavy canvas, one pocket, no logo scream. In store or via the shop link.",
      status: "Published",
      media: "Photo",
      published: hoursAgo(120),
      reactions: 33,
      comments: 5,
      shares: 2,
      views: 610,
      link: "https://northshorebooks.example/tote",
      variant: "Direct CTA",
    },
    {
      id: idOverdue,
      page: nsb,
      message:
        "Window-display polaroid from last night — the river light caught the spines. Scheduled while the desk was closed; publish when you open the phone.",
      status: "LocalScheduled",
      media: "Photo",
      scheduled: hoursAgo(2),
      reactions: 0,
      comments: 0,
      shares: 0,
    },
  ];

  for (const p of posts) {
    const score =
      p.reactions + p.comments * 2 + p.shares * 3 + (p.views ?? 0) * 0.01;
    await sql`
      insert into posts (
        id, user_id, page_id, message, link, media_type, status,
        scheduled_publish_time, published_time, created_by_this_app, ai_variant_label,
        engagement_score, reactions_count, comments_count, shares_count, media_view_unique,
        error_message, created_at, updated_at
      ) values (
        ${p.id}, ${userId}, ${p.page}, ${p.message}, ${p.link ?? null}, ${p.media}, ${p.status},
        ${p.scheduled ?? null}, ${p.published ?? null}, true, ${p.variant ?? null},
        ${score}, ${p.reactions}, ${p.comments}, ${p.shares}, ${p.views ?? null},
        ${p.error ?? null}, ${p.published ?? p.scheduled ?? hoursAgo(2)}, now()
      )
    `;
  }

  await sql`
    insert into content_items (id, user_id, post_id, file_name, mime_type, media_kind, width, height, alt_text, sort_order)
    values
      (${randomUUID()}, ${userId}, ${idStory}, ${"story-hour.jpg"}, ${"image/jpeg"}, ${"Photo"}, 1200, 900, ${"Children sitting on a river-blue rug during story hour"}, 0),
      (${randomUUID()}, ${userId}, ${idArrivals}, ${"stack-1.jpg"}, ${"image/jpeg"}, ${"Photo"}, 1000, 1000, ${"Stack of new Minnesota titles"}, 0),
      (${randomUUID()}, ${userId}, ${idArrivals}, ${"stack-2.jpg"}, ${"image/jpeg"}, ${"Photo"}, 1000, 1000, ${"Cookbook galley on oak table"}, 1),
      (${randomUUID()}, ${userId}, ${idFarmers}, ${"market.jpg"}, ${"image/jpeg"}, ${"Photo"}, 1600, 900, ${"Second Street market stalls on a clear Saturday"}, 0),
      (${randomUUID()}, ${userId}, ${idCta}, ${"tote.jpg"}, ${"image/jpeg"}, ${"Photo"}, 1000, 1000, ${"Heavy canvas tote on the shop counter"}, 0)
  `;

  await sql`
    insert into merchandise_links (id, user_id, page_id, title, url, platform, utm_template, cta_override)
    values
      (${randomUUID()}, ${userId}, ${nsb}, ${"Winona canvas tote"}, ${"https://northshorebooks.example/tote"}, ${"Shopify"}, ${"utm_source=facebook&utm_medium=page&utm_campaign={slug}"}, ${"Get the tote"}),
      (${randomUUID()}, ${userId}, ${nsb}, ${"Staff-pick subscription"}, ${"https://northshorebooks.example/club"}, ${"Own store"}, ${"utm_source=facebook&utm_medium=page"}, ${"Join the club"})
  `;

  const comments: Array<{ post: string; author: string; msg: string; hours: number; needs: boolean; hidden?: boolean }> = [
    { post: idStory, author: "Priya N.", msg: "What time is story hour again — is it every Saturday?", hours: 28, needs: true },
    { post: idStory, author: "Mark T.", msg: "We came last week and it was lovely. Thank you for the cider.", hours: 26, needs: false },
    { post: idArrivals, author: "Elena R.", msg: "Do you have the new Louise Erdrich, or is it already gone?", hours: 70, needs: true },
    { post: idCta, author: "Sam K.", msg: "Is the tote machine-washable? Need one that survives the river path.", hours: 100, needs: true },
    { post: idCta, author: "Riley C.", msg: "How much is the tote and where can I buy it? Do you ship?", hours: 0.4, needs: true },
    { post: idFarmers, author: "Jordan P.", msg: "Will there be the honey stall this week?", hours: 18, needs: true },
    { post: idArrivals, author: "spam-bot", msg: "MAKE $5000 A DAY click this sketchy link!!!", hours: 71, needs: false, hidden: true },
  ];

  for (const c of comments) {
    const drafts = c.needs
      ? JSON.stringify([
          `Hi ${c.author.split(" ")[0]}, thanks for asking — I'll confirm and reply with the details.`,
          `Great question. Stop by the desk or reply here and we'll sort it out.`,
          `Appreciate you writing in. Let me check stock/hours and get right back to you.`,
        ])
      : null;
    await sql`
      insert into comments (
        id, user_id, post_id, message, author_name, sentiment, needs_reply, reply_drafts_json, is_hidden, created_at
      ) values (
        ${randomUUID()}, ${userId}, ${c.post}, ${c.msg}, ${c.author},
        ${localSentiment(c.msg)}, ${c.needs}, ${drafts}, ${Boolean(c.hidden)},
        ${hoursAgo(c.hours)}
      )
    `;
  }

  await sql`
    insert into quota_snapshots (id, user_id, page_id, source_header, call_count_pct, estimated_regain_minutes)
    values (${randomUUID()}, ${userId}, ${nsb}, ${"X-Business-Use-Case-Usage (practice)"}, ${12}, ${0})
  `;

  await sql`
    insert into saved_ideas (id, user_id, page_id, title, body, media_type, notes)
    values
      (${randomUUID()}, ${userId}, ${nsb}, ${"River rug photo"}, ${"Need a photo of Saturday story hour — kids on the river rug, cider for grown-ups, no faces in the foreground if we can help it."}, ${"Photo"}, ${"photo-needed"}),
      (${randomUUID()}, ${userId}, ${ww}, ${"Thursday bands"}, ${"Two local bands at the winery. Doors 7, music 8. Cash or card. Dogs on the lawn side."}, ${"Text"}, ${"caption-ready"}),
      (${randomUUID()}, ${userId}, ${nsb}, ${"Tote restock"}, ${"Canvas tote is back Friday. First-comment shop link, #ad in the caption, UTM campaign tote-friday."}, ${"Photo"}, ${"offer-this-week"})
  `;

  await sql`
    insert into caption_snippets (id, user_id, page_id, label, body)
    values
      (${randomUUID()}, ${userId}, ${nsb}, ${"Hours block"}, ${"Open 10–6 Tuesday through Saturday, noon–4 Sunday. Closed Monday."}),
      (${randomUUID()}, ${userId}, ${nsb}, ${"Staff pick closer"}, ${"Ask Maya at the desk — she will put it in your hands."})
  `;

  await setSetting(userId, "default_page_id", nsb, false);
  await expandPracticeFleet(userId);
}

const FLEET_STARTERS: Record<string, string> = {
  "Sugar Loaf Ceramics":
    "Open-studio Saturday 10–2. The river glaze just came out of the kiln — a few mugs, no two alike. Seconds table by the door.",
  "Mississippi Merch Co":
    "Bluff line tee is back in S–XL. Heavy cotton, water-based print, no bookstore slogan on the chest. Shop link in the first comment. #ad",
  "Bluffside Coffee":
    "Ethiopia natural on bar this week. Window seats free before 8. Cardamom bun sold out yesterday by 9 — we baked extra.",
  "Prairie Ticket Desk":
    "Doors 7, music 8, all-ages. Thursday's two-band bill still has floor tickets. Cash or card at the door.",
  "Levee Dog Walks":
    "North levee at 7am tomorrow if the wind stays under 15. Six-dog cap. Text us if your pup is new to the pack.",
  "Riverlight Press":
    "One-color poster jobs back in 5 days on French paper. Zine #12 is on the counter — $8, no shipping this week.",
  "Driftless Kitchen":
    "Thursday kit: pork, squash, and a cider pan sauce. Pickup 4–6 at the side door. Allergen card is on the menu.",
  "Garvin Heights Guides":
    "Saturday 9am overlook walk. Boots, not sneakers. Weather call Friday at 6. Eight spots, start at the upper lot.",
};

/** Fill the practice desk out to 10 unique Pages. Never runs once a live
 *  Facebook Page exists — we will not mix practice rows into a real vault. */
export async function expandPracticeFleet(userId: string): Promise<number> {
  const { PRACTICE_FLEET } = await import("./fleet");
  const sql = await getSql();
  const live = await sql<{ n: number }>`
    select count(*)::int as n from pages where user_id = ${userId} and is_practice = false
  `;
  if (Number(live[0]?.n ?? 0) > 0) return 0;

  const existing = await sql<{ name: string }>`
    select name from pages where user_id = ${userId}
  `;
  const have = new Set(existing.map((r) => r.name));
  let added = 0;
  const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

  for (const ident of PRACTICE_FLEET) {
    if (have.has(ident.name)) continue;
    const id = randomUUID();
    await sql`
      insert into pages (
        id, user_id, facebook_page_id, name, category, fan_count, tasks_json,
        is_active, is_read_only, is_practice, brand_voice, cadence_warn_per_24h, cadence_block_per_24h
      ) values (
        ${id}, ${userId}, null, ${ident.name}, ${ident.category}, ${ident.fans},
        ${JSON.stringify(["ANALYZE", "CREATE_CONTENT", "MODERATE"])},
        true, false, true, ${ident.voice}, ${ident.cadenceWarn}, ${ident.cadenceBlock}
      )
    `;
    const starter = FLEET_STARTERS[ident.name];
    if (starter) {
      const postId = randomUUID();
      await sql`
        insert into posts (
          id, user_id, page_id, message, media_type, status, published_time,
          created_by_this_app, reactions_count, comments_count, shares_count, created_at, updated_at
        ) values (
          ${postId}, ${userId}, ${id}, ${starter}, 'Text', 'Published', ${hoursAgo(18)},
          true, 12, 2, 1, ${hoursAgo(18)}, now()
        )
      `;
    }
    if (ident.merch) {
      await sql`
        insert into merchandise_links (id, user_id, page_id, title, url, platform, utm_template, cta_override)
        values (
          ${randomUUID()}, ${userId}, ${id}, ${ident.merch.title}, ${ident.merch.url},
          ${ident.merch.platform}, ${"utm_source=facebook&utm_medium=page&utm_campaign={slug}"}, ${ident.merch.cta}
        )
      `;
    }
    have.add(ident.name);
    added += 1;
  }
  return added;
}

export async function ensureMemory(userId: string) {
  const sql = await getSql();
  // Seed once per desk. Re-seeding on count=0 resurrects Later cards the operator deleted.
  const seeded = await sql<{ n: number }>`
    select count(*)::int as n from app_settings where user_id = ${userId} and key = 'memory_seeded_once'
  `;
  if (Number(seeded[0]?.n ?? 0) > 0) return;
  const ideas = await sql<{ n: number }>`select count(*)::int as n from saved_ideas where user_id = ${userId}`;
  if (Number(ideas[0]?.n ?? 0) > 0) {
    await setSetting(userId, "memory_seeded_once", "1", false);
    return;
  }
  const pages = await sql<{ id: string; name: string }>`
    select id, name from pages where user_id = ${userId} order by name limit 2
  `;
  const a = pages[0]?.id ?? null;
  const b = pages[1]?.id ?? pages[0]?.id ?? null;
  await sql`
    insert into saved_ideas (id, user_id, page_id, title, body, media_type)
    values
      (${randomUUID()}, ${userId}, ${a}, ${"River rug photo"}, ${"Need a photo of Saturday story hour — kids on the river rug, cider for grown-ups, no faces in the foreground if we can help it."}, ${"Photo"}),
      (${randomUUID()}, ${userId}, ${b}, ${"Thursday bands"}, ${"Two local bands at the winery. Doors 7, music 8. Cash or card. Dogs on the lawn side."}, ${"Text"})
  `;
  await setSetting(userId, "memory_seeded_once", "1", false);
  const snips = await sql<{ n: number }>`select count(*)::int as n from caption_snippets where user_id = ${userId}`;
  if (Number(snips[0]?.n ?? 0) > 0) return;
  await sql`
    insert into caption_snippets (id, user_id, page_id, label, body)
    values
      (${randomUUID()}, ${userId}, ${a}, ${"Hours block"}, ${"Open 10–6 Tuesday through Saturday, noon–4 Sunday. Closed Monday."}),
      (${randomUUID()}, ${userId}, ${a}, ${"Staff pick closer"}, ${"Ask Maya at the desk — she will put it in your hands."})
  `;
}

/** One overdue practice post so the Needs-you queue is never empty on a demo desk. */
export async function ensureOverduePractice(userId: string) {
  const sql = await getSql();
  const live = await sql<{ n: number }>`
    select count(*)::int as n from pages where user_id = ${userId} and is_practice = false
  `;
  if (Number(live[0]?.n ?? 0) > 0) return;

  const polaroid = await sql<{ id: string; status: string }>`
    select id, status from posts
    where user_id = ${userId}
      and message like 'Window-display polaroid%'
    order by created_at desc
  `;
  if (polaroid.length > 1) {
    const keep =
      polaroid.find((p) => p.status === "LocalScheduled")?.id ??
      polaroid.find((p) => p.status === "Published")?.id ??
      polaroid[0]?.id;
    if (keep) {
      await sql`
        delete from posts
        where user_id = ${userId}
          and message like 'Window-display polaroid%'
          and id <> ${keep}
      `;
    }
  }
  if (polaroid.length > 0) return;

  const overdue = await sql<{ n: number }>`
    select count(*)::int as n from posts
    where user_id = ${userId}
      and status = 'LocalScheduled'
      and scheduled_publish_time is not null
      and scheduled_publish_time < now()
  `;
  if (Number(overdue[0]?.n ?? 0) > 0) return;
  const page = await sql<{ id: string }>`
    select id from pages where user_id = ${userId} and is_practice = true order by name limit 1
  `;
  const pageId = page[0]?.id;
  if (!pageId) return;
  const when = new Date(Date.now() - 2 * 3600_000).toISOString();
  await sql`
    insert into posts (
      id, user_id, page_id, message, media_type, status,
      scheduled_publish_time, created_by_this_app, created_at, updated_at
    ) values (
      ${randomUUID()}, ${userId}, ${pageId},
      ${"Window-display polaroid from last night — the river light caught the spines. Scheduled while the desk was closed; publish from Needs you."},
      ${"Photo"}, ${"LocalScheduled"}, ${when}, true, ${when}, now()
    )
  `;
}
