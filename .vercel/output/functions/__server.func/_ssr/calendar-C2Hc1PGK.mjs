import { o as __toESM } from "../_runtime.mjs";
import { c as require_react, s as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { N as rescheduleFn, V as useShellStore, f as calendarFn, m as cn, r as Button } from "./app-shell-Cg4ECP4f.mjs";
import { t as Guard } from "./guard-BudBk3vn.mjs";
import { a as isSameDay, c as addDays, i as endOfMonth, n as endOfWeek, o as startOfWeek, r as startOfMonth, s as addMonths, t as format } from "../_libs/date-fns.mjs";
import { t as StatusBadge } from "./status-badge-DtbbexT3.mjs";
import { i as TabsTrigger, r as TabsList, t as Tabs } from "./tabs-CYWj-1Ow.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/calendar-C2Hc1PGK.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function whenOf(p) {
	return new Date(p.scheduled_publish_time ?? p.published_time ?? p.created_at);
}
function CalendarView() {
	const pageId = useShellStore((s) => s.selectedPageId) ?? void 0;
	const [posts, setPosts] = (0, import_react.useState)([]);
	const [cursor, setCursor] = (0, import_react.useState)(/* @__PURE__ */ new Date());
	const [mode, setMode] = (0, import_react.useState)("month");
	const [dragId, setDragId] = (0, import_react.useState)(null);
	const load = () => {
		calendarFn({ data: { pageId } }).then(setPosts);
	};
	(0, import_react.useEffect)(load, [pageId]);
	const days = (0, import_react.useMemo)(() => {
		if (mode === "week") {
			const start = startOfWeek(cursor, { weekStartsOn: 0 });
			return Array.from({ length: 7 }, (_, i) => addDays(start, i));
		}
		const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 });
		const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 });
		const out = [];
		for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
		return out;
	}, [cursor, mode]);
	const heat = (0, import_react.useMemo)(() => {
		const map = /* @__PURE__ */ new Map();
		for (const p of posts) {
			const key = format(whenOf(p), "yyyy-MM-dd");
			const cur = map.get(key) ?? {
				count: 0,
				eng: 0
			};
			cur.count += 1;
			cur.eng += p.engagement_score || p.reactions_count + p.comments_count;
			map.set(key, cur);
		}
		return map;
	}, [posts]);
	const dropOn = (day) => {
		if (!dragId) return;
		const iso = new Date(day);
		iso.setHours(10, 0, 0, 0);
		rescheduleFn({ data: {
			postId: dragId,
			scheduledAt: iso.toISOString()
		} }).then((r) => {
			toast.message(r.warning ?? "Rescheduled");
			load();
		}).catch((e) => toast.error(e instanceof Error ? e.message : "Could not reschedule"));
		setDragId(null);
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex flex-wrap items-center justify-between gap-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "text-xl font-semibold",
				children: "Calendar"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-[13px] text-muted-foreground",
				children: "Drag a post onto a day to reschedule. Graph window is 10 minutes–30 days; otherwise local scheduler keeps it."
			})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "outline",
						size: "sm",
						onClick: () => setCursor((d) => addMonths(d, mode === "week" ? 0 : -1)),
						children: "Prev"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "outline",
						size: "sm",
						onClick: () => setCursor(/* @__PURE__ */ new Date()),
						children: "Today"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "outline",
						size: "sm",
						onClick: () => setCursor((d) => addMonths(d, 1)),
						children: "Next"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tabs, {
						value: mode,
						onValueChange: (v) => setMode(v),
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TabsList, { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsTrigger, {
								value: "month",
								children: "Month"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsTrigger, {
								value: "week",
								children: "Week"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsTrigger, {
								value: "heat",
								children: "Heatmap"
							})
						] })
					})
				]
			})]
		}), mode === "heat" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Heatmap, {
			posts,
			heat
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "overflow-x-auto rounded-xl bg-card shadow-card",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "grid grid-cols-7 border-b border-border text-center text-[12px] font-semibold text-muted-foreground",
				children: [
					"Sun",
					"Mon",
					"Tue",
					"Wed",
					"Thu",
					"Fri",
					"Sat"
				].map((d) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "px-2 py-2",
					children: d
				}, d))
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "grid grid-cols-7",
				children: days.map((day) => {
					const items = posts.filter((p) => isSameDay(whenOf(p), day));
					const heatVal = heat.get(format(day, "yyyy-MM-dd"));
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						onDragOver: (e) => e.preventDefault(),
						onDrop: () => dropOn(day),
						className: cn("min-h-28 border-b border-r border-border p-1.5", day.getMonth() !== cursor.getMonth() && mode === "month" ? "bg-muted/40" : "", isSameDay(day, /* @__PURE__ */ new Date()) ? "bg-accent/40" : ""),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between text-[12px] tabular-nums",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: format(day, "d") }), heatVal ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-muted-foreground",
								children: heatVal.count
							}) : null]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-1 space-y-1",
							children: items.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								draggable: true,
								onDragStart: () => setDragId(p.id),
								className: "cursor-grab rounded-md bg-chip px-1.5 py-1 text-[11px] leading-tight",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center justify-between gap-1",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "truncate font-medium",
										children: p.page_name
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: p.status })]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "line-clamp-2 text-muted-foreground",
									children: p.message
								})]
							}, p.id))
						})]
					}, day.toISOString());
				})
			})]
		})]
	});
}
function Heatmap({ posts, heat }) {
	const end = /* @__PURE__ */ new Date();
	const start = addDays(end, -119);
	const days = [];
	for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
	const max = Math.max(1, ...[...heat.values()].map((v) => v.count));
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-xl bg-card p-4 shadow-card",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "text-[13px] text-muted-foreground",
			children: [posts.length, " posts · GitHub-style cadence (count)"]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-3 flex flex-wrap gap-1",
			children: days.map((d) => {
				const key = format(d, "yyyy-MM-dd");
				const v = heat.get(key);
				const t = v ? v.count / max : 0;
				return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					title: `${key}: ${v?.count ?? 0} posts, ${Math.round(v?.eng ?? 0)} engagement`,
					className: "size-3.5 rounded-sm",
					style: { background: t === 0 ? "var(--color-muted)" : `color-mix(in oklab, var(--color-primary) ${Math.round(30 + t * 70)}%, var(--color-muted))` }
				}, key);
			})
		})]
	});
}
var SplitComponent = () => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Guard, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CalendarView, {}) });
//#endregion
export { SplitComponent as component };
