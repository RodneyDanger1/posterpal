import { o as __toESM } from "../_runtime.mjs";
import { c as require_react, s as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { V as useShellStore, c as analyticsFn, r as Button, y as exportCsvFn } from "./app-shell-Cg4ECP4f.mjs";
import { t as Guard } from "./guard-BudBk3vn.mjs";
import { i as CardTitle, n as CardContent, r as CardHeader, t as Card } from "./card-Bsxv0xqm.mjs";
import { a as Line, c as ResponsiveContainer, i as XAxis, l as Tooltip, n as LineChart, o as CartesianGrid, r as YAxis, s as Bar, t as BarChart } from "../_libs/recharts+[...].mjs";
import { t as format } from "../_libs/date-fns.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/analytics-CNoMpt0z.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function Analytics() {
	const pageId = useShellStore((s) => s.selectedPageId) ?? void 0;
	const [days, setDays] = (0, import_react.useState)(28);
	const [pack, setPack] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		analyticsFn({ data: {
			pageId,
			days
		} }).then(setPack);
	}, [pageId, days]);
	const series = (0, import_react.useMemo)(() => {
		return (pack?.rows ?? []).map((r) => ({
			t: format(new Date(String(r.published_time ?? r.created_at)), "MMM d"),
			reactions: Number(r.reactions_count ?? 0),
			comments: Number(r.comments_count ?? 0),
			views: Number(r.media_view_unique ?? 0),
			variant: String(r.ai_variant_label ?? ""),
			message: String(r.message ?? "")
		}));
	}, [pack]);
	const totals = series.reduce((a, r) => ({
		reactions: a.reactions + r.reactions,
		comments: a.comments + r.comments,
		views: a.views + r.views
	}), {
		reactions: 0,
		comments: 0,
		views: 0
	});
	const winners = (0, import_react.useMemo)(() => {
		const groups = /* @__PURE__ */ new Map();
		for (const r of series) {
			if (!r.variant) continue;
			const g = groups.get(r.variant) ?? {
				label: r.variant,
				n: 0,
				reactions: 0
			};
			g.n += 1;
			g.reactions += r.reactions;
			groups.set(r.variant, g);
		}
		return [...groups.values()].sort((a, b) => b.reactions / Math.max(1, b.n) - a.reactions / Math.max(1, a.n));
	}, [series]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-center justify-between gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "text-xl font-semibold",
					children: "Analytics"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-[13px] text-muted-foreground",
					children: "Post-level reactions, comments, and media views. Page insights require 100+ likes."
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex gap-2",
					children: [[
						7,
						28,
						90
					].map((d) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						size: "sm",
						variant: days === d ? "default" : "outline",
						onClick: () => setDays(d),
						children: [d, "d"]
					}, d)), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						size: "sm",
						variant: "outline",
						onClick: () => {
							exportCsvFn({ data: {
								pageId,
								days
							} }).then((csv) => {
								const blob = new Blob([csv], { type: "text/csv" });
								const a = document.createElement("a");
								a.href = URL.createObjectURL(blob);
								a.download = "bookboss-analytics.csv";
								a.click();
							});
						},
						children: "Export CSV"
					})]
				})]
			}),
			pack?.insightsLocked ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rounded-lg bg-warning/20 px-3 py-2 text-sm",
				children: [
					"Insights require 100+ likes (this Page has ",
					pack.fanCount,
					"). Showing post-level engagement from Graph fields that do not need the Page insights edge."
				]
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-3 sm:grid-cols-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
						label: "Reactions",
						value: totals.reactions
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
						label: "Comments",
						value: totals.comments
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
						label: "Media views",
						value: totals.views
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CardHeader, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CardTitle, { children: "Media views & reactions" }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CardContent, {
				className: "h-64",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResponsiveContainer, {
					width: "100%",
					height: "100%",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(LineChart, {
						data: series,
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CartesianGrid, {
								strokeDasharray: "3 3",
								stroke: "var(--color-border)"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(XAxis, {
								dataKey: "t",
								tick: { fontSize: 11 }
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(YAxis, { tick: { fontSize: 11 } }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tooltip, {}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Line, {
								type: "monotone",
								dataKey: "views",
								stroke: "var(--color-primary)",
								strokeWidth: 2,
								dot: false
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Line, {
								type: "monotone",
								dataKey: "reactions",
								stroke: "var(--color-success)",
								strokeWidth: 2,
								dot: false
							})
						]
					})
				})
			})] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CardHeader, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CardTitle, { children: "Comments" }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CardContent, {
				className: "h-52",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResponsiveContainer, {
					width: "100%",
					height: "100%",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(BarChart, {
						data: series,
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CartesianGrid, {
								strokeDasharray: "3 3",
								stroke: "var(--color-border)"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(XAxis, {
								dataKey: "t",
								tick: { fontSize: 11 }
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(YAxis, { tick: { fontSize: 11 } }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tooltip, {}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bar, {
								dataKey: "comments",
								fill: "var(--color-primary)",
								radius: 4
							})
						]
					})
				})
			})] }),
			winners.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CardHeader, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CardTitle, { children: "A/B variant winner" }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(CardContent, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "text-sm",
				children: [
					"Leading variant: ",
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: winners[0]?.label }),
					" (",
					Math.round((winners[0]?.reactions ?? 0) / Math.max(1, winners[0]?.n ?? 1)),
					" avg reactions)."
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-2 space-y-1 text-sm text-muted-foreground",
				children: winners.map((w) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [
					w.label,
					": ",
					w.n,
					" posts, ",
					w.reactions,
					" reactions"
				] }, w.label))
			})] })] }) : null
		]
	});
}
function Stat({ label, value }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(CardContent, {
		className: "pt-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "text-[12px] font-semibold text-muted-foreground",
			children: label
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-1 text-2xl font-semibold tabular-nums",
			children: value.toLocaleString()
		})]
	}) });
}
var SplitComponent = () => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Guard, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Analytics, {}) });
//#endregion
export { SplitComponent as component };
