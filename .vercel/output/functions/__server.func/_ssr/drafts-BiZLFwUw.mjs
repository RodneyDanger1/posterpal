import { o as __toESM } from "../_runtime.mjs";
import { c as require_react, s as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { D as listPostsFn, M as relativeTime, V as useShellStore, _ as composeFn, p as cancelPostFn, r as Button } from "./app-shell-Cg4ECP4f.mjs";
import { t as Guard } from "./guard-BudBk3vn.mjs";
import { t as StatusBadge } from "./status-badge-DtbbexT3.mjs";
import { i as TabsTrigger, n as TabsContent, r as TabsList, t as Tabs } from "./tabs-CYWj-1Ow.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/drafts-BiZLFwUw.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function Drafts() {
	const pageId = useShellStore((s) => s.selectedPageId) ?? void 0;
	const [posts, setPosts] = (0, import_react.useState)([]);
	const load = () => {
		listPostsFn({ data: {
			pageId,
			limit: 100
		} }).then(setPosts);
	};
	(0, import_react.useEffect)(load, [pageId]);
	const groups = {
		drafts: posts.filter((p) => p.status === "LocalDraft" || p.status === "FacebookDraft"),
		queued: posts.filter((p) => p.status === "LocalScheduled" || p.status === "FacebookScheduled" || p.status === "Publishing"),
		failed: posts.filter((p) => p.status === "Failed")
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
			className: "text-xl font-semibold",
			children: "Drafts & queue"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Tabs, {
			defaultValue: "drafts",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TabsList, { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TabsTrigger, {
					value: "drafts",
					children: [
						"Drafts (",
						groups.drafts.length,
						")"
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TabsTrigger, {
					value: "queued",
					children: [
						"Scheduled (",
						groups.queued.length,
						")"
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TabsTrigger, {
					value: "failed",
					children: [
						"Failed (",
						groups.failed.length,
						")"
					]
				})
			] }), [
				"drafts",
				"queued",
				"failed"
			].map((key) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsContent, {
				value: key,
				className: "mt-4 space-y-2",
				children: groups[key].length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted-foreground",
					children: "Nothing here."
				}) : groups[key].map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
					className: "rounded-xl bg-card p-4 shadow-card",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap items-start justify-between gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "text-[12px] text-muted-foreground",
								children: [
									p.page_name,
									" · ",
									p.media_type,
									" · ",
									relativeTime(p.scheduled_publish_time ?? p.created_at)
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1 text-sm",
								children: p.message || "(no caption)"
							}),
							p.error_message ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-2 text-[13px] text-destructive",
								children: p.error_message
							}) : null
						] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: p.status })]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-3 flex flex-wrap gap-2",
						children: [p.status === "Failed" || p.status === "LocalDraft" || p.status === "FacebookDraft" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							size: "sm",
							onClick: () => {
								composeFn({ data: {
									pageId: p.page_id,
									message: p.message ?? "",
									link: p.link,
									mediaType: p.media_type,
									mode: "now"
								} }).then((r) => {
									toast.success(r.status);
									load();
								}).catch((e) => toast.error(e instanceof Error ? e.message : "Failed"));
							},
							children: "Publish now"
						}) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							size: "sm",
							variant: "outline",
							onClick: () => {
								cancelPostFn({ data: { postId: p.id } }).then(load);
							},
							children: "Cancel"
						})]
					})]
				}, p.id))
			}, key))]
		})]
	});
}
var SplitComponent = () => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Guard, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Drafts, {}) });
//#endregion
export { SplitComponent as component };
