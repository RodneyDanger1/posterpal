import { randomUUID } from "node:crypto";
import { getSql } from "@/lib/db";
import { localSentiment } from "./ai";

export async function seedPracticeWorkspace(userId: string): Promise<void> {
  const sql = await getSql();
  const existing = await sql<{ n: number }>`
    select count(*)::int as n from pages where user_id = ${userId}
  `;
  if (Number(existing[0]?.n ?? 0) > 0) {
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
    insert into saved_ideas (id, user_id, page_id, title, body, media_type)
    values
      (${randomUUID()}, ${userId}, ${nsb}, ${"River rug photo"}, ${"Need a photo of Saturday story hour — kids on the river rug, cider for grown-ups, no faces in the foreground if we can help it."}, ${"Photo"}),
      (${randomUUID()}, ${userId}, ${ww}, ${"Thursday bands"}, ${"Two local bands at the winery. Doors 7, music 8. Cash or card. Dogs on the lawn side."}, ${"Text"})
  `;

  await sql`
    insert into caption_snippets (id, user_id, page_id, label, body)
    values
      (${randomUUID()}, ${userId}, ${nsb}, ${"Hours block"}, ${"Open 10–6 Tuesday through Saturday, noon–4 Sunday. Closed Monday."}),
      (${randomUUID()}, ${userId}, ${nsb}, ${"Staff pick closer"}, ${"Ask Maya at the desk — she will put it in your hands."})
  `;
}

export async function ensureMemory(userId: string) {
  const sql = await getSql();
  const ideas = await sql<{ n: number }>`select count(*)::int as n from saved_ideas where user_id = ${userId}`;
  if (Number(ideas[0]?.n ?? 0) > 0) return;
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
  const snips = await sql<{ n: number }>`select count(*)::int as n from caption_snippets where user_id = ${userId}`;
  if (Number(snips[0]?.n ?? 0) > 0) return;
  await sql`
    insert into caption_snippets (id, user_id, page_id, label, body)
    values
      (${randomUUID()}, ${userId}, ${a}, ${"Hours block"}, ${"Open 10–6 Tuesday through Saturday, noon–4 Sunday. Closed Monday."}),
      (${randomUUID()}, ${userId}, ${a}, ${"Staff pick closer"}, ${"Ask Maya at the desk — she will put it in your hands."})
  `;
}
