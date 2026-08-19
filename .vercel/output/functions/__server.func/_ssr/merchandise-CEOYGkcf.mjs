import { o as __toESM } from "../_runtime.mjs";
import { c as require_react, s as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { A as merchFn, E as listPagesFn, F as saveMerchFn, V as useShellStore, i as Input, r as Button, v as deleteMerchFn } from "./app-shell-Cg4ECP4f.mjs";
import { t as Guard } from "./guard-BudBk3vn.mjs";
import { t as Label } from "./label-BF_kIDyZ.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/merchandise-CEOYGkcf.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function Merch() {
	const pageId = useShellStore((s) => s.selectedPageId);
	const [pages, setPages] = (0, import_react.useState)([]);
	const [rows, setRows] = (0, import_react.useState)([]);
	const [title, setTitle] = (0, import_react.useState)("");
	const [url, setUrl] = (0, import_react.useState)("");
	const [platform, setPlatform] = (0, import_react.useState)("Shopify");
	const [cta, setCta] = (0, import_react.useState)("");
	const load = () => {
		listPagesFn().then(setPages);
		merchFn({ data: { pageId: pageId ?? void 0 } }).then(setRows);
	};
	(0, import_react.useEffect)(load, [pageId]);
	const page = pages.find((p) => p.id === pageId) ?? pages[0];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "grid gap-4 lg:grid-cols-[1fr_320px]",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "text-xl font-semibold",
				children: "Merchandise"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mb-4 text-[13px] text-muted-foreground",
				children: "Insert shop links from Composer. Policy checklist warns if a merch URL is present without branded-content disclosure."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "space-y-2",
				children: rows.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "flex items-start justify-between gap-3 rounded-xl bg-card p-4 shadow-card",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "font-semibold",
							children: r.title
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "text-[13px] text-muted-foreground",
							children: [
								r.platform,
								" · ",
								r.url
							]
						}),
						r.cta_override ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-1 text-sm",
							children: r.cta_override
						}) : null
					] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						size: "sm",
						variant: "outline",
						onClick: () => void deleteMerchFn({ data: { id: r.id } }).then(load),
						children: "Remove"
					})]
				}, r.id))
			})
		] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
			className: "rounded-xl bg-card p-4 shadow-card",
			onSubmit: (e) => {
				e.preventDefault();
				if (!page) return;
				saveMerchFn({ data: {
					pageId: page.id,
					title,
					url,
					platform,
					cta
				} }).then(() => {
					toast.success("Saved");
					setTitle("");
					setUrl("");
					load();
				}).catch((err) => toast.error(err instanceof Error ? err.message : "Save failed"));
			},
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
				className: "font-semibold",
				children: ["Add link ", page ? `· ${page.name}` : ""]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3 space-y-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Title" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							value: title,
							onChange: (e) => setTitle(e.target.value),
							required: true
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "URL" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							value: url,
							onChange: (e) => setUrl(e.target.value),
							required: true,
							placeholder: "https://"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Platform" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							value: platform,
							onChange: (e) => setPlatform(e.target.value)
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "CTA" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							value: cta,
							onChange: (e) => setCta(e.target.value),
							placeholder: "Get the tote"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "submit",
						className: "w-full",
						disabled: !page,
						children: "Save"
					})
				]
			})]
		})]
	});
}
var SplitComponent = () => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Guard, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Merch, {}) });
//#endregion
export { SplitComponent as component };
