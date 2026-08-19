import { o as __toESM } from "../_runtime.mjs";
import { c as require_react, s as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { L as sendReplyFn, M as relativeTime, T as hideCommentFn, V as useShellStore, h as commentsFn, r as Button, x as generateReplyDraftsFn } from "./app-shell-Cg4ECP4f.mjs";
import { t as Guard } from "./guard-BudBk3vn.mjs";
import { t as Badge } from "./badge-C10s66SB.mjs";
import { i as TabsTrigger, r as TabsList, t as Tabs } from "./tabs-CYWj-1Ow.mjs";
import { t as Textarea } from "./textarea-BVZEn6W5.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/inbox-DfnzREGn.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function Inbox() {
	const pageId = useShellStore((s) => s.selectedPageId) ?? void 0;
	const [filter, setFilter] = (0, import_react.useState)("needs");
	const [rows, setRows] = (0, import_react.useState)([]);
	const [active, setActive] = (0, import_react.useState)(null);
	const [draft, setDraft] = (0, import_react.useState)("");
	const load = () => {
		commentsFn({ data: {
			filter,
			pageId
		} }).then((list) => {
			setRows(list);
			setActive((cur) => list.find((c) => c.id === cur?.id) ?? list[0] ?? null);
		});
	};
	(0, import_react.useEffect)(load, [filter, pageId]);
	(0, import_react.useEffect)(() => {
		if (!active) {
			setDraft("");
			return;
		}
		const parsed = active.reply_drafts_json ? JSON.parse(active.reply_drafts_json) : [];
		setDraft(parsed[0] ?? "");
	}, [active?.id]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "text-xl font-semibold",
				children: "Inbox"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mb-3 text-[13px] text-muted-foreground",
				children: "AI may draft replies. A human must click Send. BookBoss never auto-likes, auto-follows, or auto-comments."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tabs, {
				value: filter,
				onValueChange: (v) => setFilter(v),
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TabsList, { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsTrigger, {
						value: "needs",
						children: "Needs reply"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsTrigger, {
						value: "hidden",
						children: "Hidden"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsTrigger, {
						value: "all",
						children: "All"
					})
				] })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-3 space-y-1",
				children: rows.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
					className: "rounded-xl bg-card p-4 text-sm text-muted-foreground shadow-card",
					children: "Inbox zero for this filter."
				}) : rows.map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: () => setActive(c),
					className: `w-full rounded-lg px-3 py-2 text-left ${active?.id === c.id ? "bg-accent" : "bg-card hover:bg-muted"}`,
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-[13px] font-semibold",
								children: c.author_name ?? "Visitor"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-[11px] text-muted-foreground",
								children: relativeTime(c.created_at)
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "line-clamp-2 text-sm",
							children: c.message
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-1 flex gap-1",
							children: [c.sentiment ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
								variant: "muted",
								children: c.sentiment
							}) : null, c.needs_reply ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
								variant: "warning",
								children: "Needs reply"
							}) : null]
						})
					]
				}) }, c.id))
			})
		] }), active ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
			className: "rounded-xl bg-card p-4 shadow-card",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "text-[12px] text-muted-foreground",
					children: [
						active.page_name,
						" · on “",
						active.post_message?.slice(0, 80),
						"”"
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "mt-1 font-semibold",
					children: active.author_name
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-[15px]",
					children: active.message
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-4 space-y-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex flex-wrap gap-2",
							children: (active.reply_drafts_json ? JSON.parse(active.reply_drafts_json) : []).map((d, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: "max-w-full rounded-lg border border-border px-3 py-2 text-left text-[13px] hover:bg-muted",
								onClick: () => setDraft(d),
								children: d
							}, i))
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
							value: draft,
							onChange: (e) => setDraft(e.target.value),
							className: "min-h-28"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap gap-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									onClick: () => {
										sendReplyFn({ data: {
											commentId: active.id,
											message: draft
										} }).then(() => {
											toast.success("Reply sent by you — not by a bot.");
											load();
										}).catch((e) => toast.error(e instanceof Error ? e.message : "Send failed"));
									},
									disabled: !draft.trim(),
									children: "Send"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									variant: "outline",
									onClick: () => {
										generateReplyDraftsFn({ data: { commentId: active.id } }).then((r) => {
											setDraft(r.drafts[0] ?? "");
											setActive({
												...active,
												reply_drafts_json: JSON.stringify(r.drafts)
											});
										}).catch((e) => toast.error(e instanceof Error ? e.message : "Drafts failed"));
									},
									children: "3 drafts"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									variant: "outline",
									onClick: () => {
										hideCommentFn({ data: {
											commentId: active.id,
											hidden: !active.is_hidden
										} }).then(load);
									},
									children: active.is_hidden ? "Unhide" : "Hide"
								})
							]
						})
					]
				})
			]
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "rounded-xl bg-card p-6 text-sm text-muted-foreground shadow-card",
			children: "Select a comment."
		})]
	});
}
var SplitComponent = () => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Guard, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Inbox, {}) });
//#endregion
export { SplitComponent as component };
