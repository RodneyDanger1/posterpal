/**
 * Ten unique practice-Page identities. Facebook cannot create Pages via Graph —
 * these exist so an operator can learn the desk at fleet scale, then Connect
 * real Pages with the same uniqueness rules.
 */
export type FleetIdentity = {
  name: string;
  category: string;
  fans: number;
  voice: string;
  pillars: string[];
  merch?: { title: string; url: string; platform: string; cta: string };
  cadenceWarn: number;
  cadenceBlock: number;
};

export const PRACTICE_FLEET: FleetIdentity[] = [
  {
    name: "North Shore Books",
    category: "Bookstore",
    fans: 2847,
    voice:
      "Warm independent bookstore on the Mississippi. Specific, bookish, never salesy. Talk like a well-read neighbor in Winona.",
    pillars: ["story hour", "Minnesota authors", "staff picks", "shop hours"],
    merch: {
      title: "Winona canvas tote",
      url: "https://northshorebooks.example/tote",
      platform: "Shopify",
      cta: "Get the tote",
    },
    cadenceWarn: 8,
    cadenceBlock: 20,
  },
  {
    name: "Winona Weekend",
    category: "Local events",
    fans: 1204,
    voice: "Upbeat local events desk. Short, useful, time-and-place first. No FOMO theatrics.",
    pillars: ["markets", "live music", "hours", "parking"],
    cadenceWarn: 8,
    cadenceBlock: 20,
  },
  {
    name: "Sugar Loaf Ceramics",
    category: "Art studio",
    fans: 640,
    voice:
      "Quiet clay studio under Sugar Loaf. Hands, kilns, and the next open-studio Saturday. No hype, name the glaze.",
    pillars: ["open studio", "glaze drops", "class seats", "seconds sale"],
    merch: {
      title: "River mug seconds",
      url: "https://sugarloafceramics.example/seconds",
      platform: "Own store",
      cta: "See the seconds",
    },
    cadenceWarn: 6,
    cadenceBlock: 14,
  },
  {
    name: "Mississippi Merch Co",
    category: "Apparel",
    fans: 890,
    voice:
      "Small-run shirts for river towns. Fabric, print, size — then the shop link. Never copy a bookstore caption.",
    pillars: ["drops", "sizing", "print method", "restocks"],
    merch: {
      title: "Bluff line tee",
      url: "https://mississippimerch.example/bluff-tee",
      platform: "Printful",
      cta: "Shop the tee",
    },
    cadenceWarn: 7,
    cadenceBlock: 16,
  },
  {
    name: "Bluffside Coffee",
    category: "Cafe",
    fans: 1512,
    voice:
      "Neighborhood pour-over. Roast, pastry, and whether the window seats are free. No event-listing voice.",
    pillars: ["roast", "pastry", "hours", "window seats"],
    merch: {
      title: "House beans 12oz",
      url: "https://bluffsidecoffee.example/beans",
      platform: "Own store",
      cta: "Order beans",
    },
    cadenceWarn: 8,
    cadenceBlock: 18,
  },
  {
    name: "Prairie Ticket Desk",
    category: "Music venue",
    fans: 2103,
    voice:
      "Door time, set time, all-ages or not. Tickets before adjectives. Never steal Winona Weekend's market copy.",
    pillars: ["door time", "tickets", "all-ages", "load-in"],
    merch: {
      title: "Thursday ticket",
      url: "https://prairieticket.example/thu",
      platform: "Eventbrite",
      cta: "Get a ticket",
    },
    cadenceWarn: 10,
    cadenceBlock: 22,
  },
  {
    name: "Levee Dog Walks",
    category: "Pet service",
    fans: 430,
    voice:
      "Leash, weather, and the levee path. Practical. Never a bookstore or cafe caption in a dog coat.",
    pillars: ["routes", "weather", "booking", "pack size"],
    merch: {
      title: "Six-walk card",
      url: "https://leveedogs.example/card",
      platform: "Own store",
      cta: "Book walks",
    },
    cadenceWarn: 5,
    cadenceBlock: 12,
  },
  {
    name: "Riverlight Press",
    category: "Print shop",
    fans: 318,
    voice:
      "Zines, posters, and one-color jobs. Paper stock and turnaround. No merch-drop slang.",
    pillars: ["turnaround", "stock", "zine fair", "file prep"],
    merch: {
      title: "Winona zine #12",
      url: "https://riverlightpress.example/zine-12",
      platform: "Own store",
      cta: "Grab the zine",
    },
    cadenceWarn: 5,
    cadenceBlock: 12,
  },
  {
    name: "Driftless Kitchen",
    category: "Meal kits",
    fans: 776,
    voice:
      "Thursday pickup, Saturday leftover soup. Ingredients from the valley. Never an events-calendar tone.",
    pillars: ["pickup window", "menu", "allergens", "leftovers"],
    merch: {
      title: "Thursday kit",
      url: "https://driftlesskitchen.example/thu",
      platform: "Own store",
      cta: "Reserve a kit",
    },
    cadenceWarn: 6,
    cadenceBlock: 14,
  },
  {
    name: "Garvin Heights Guides",
    category: "Tours",
    fans: 954,
    voice:
      "Overlook walks with a start time and a weather call. Boots, not books. No cafe specials.",
    pillars: ["start time", "weather call", "group size", "boots"],
    merch: {
      title: "Saturday bluff walk",
      url: "https://garvinheights.example/sat",
      platform: "Eventbrite",
      cta: "Join the walk",
    },
    cadenceWarn: 5,
    cadenceBlock: 12,
  },
];

export const FLEET_SIZE = PRACTICE_FLEET.length;

/** 0–100: how distinct this Page's last captions are from the rest of the fleet. */
export function uniquenessScore(
  thisCaptions: string[],
  otherCaptions: string[],
  jaccardFn: (a: string[], b: string[]) => number,
  tokenizeFn: (t: string) => string[],
): number {
  if (thisCaptions.length === 0) return 100;
  if (otherCaptions.length === 0) return 100;
  let worst = 0;
  for (const a of thisCaptions) {
    const ta = tokenizeFn(a);
    for (const b of otherCaptions) {
      const s = jaccardFn(ta, tokenizeFn(b));
      if (s > worst) worst = s;
    }
  }
  return Math.max(0, Math.round((1 - worst) * 100));
}
