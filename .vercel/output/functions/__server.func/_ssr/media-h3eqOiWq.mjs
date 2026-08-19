import { o as __toESM } from "../_runtime.mjs";
import { c as require_react, s as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { V as useShellStore, k as mediaLibraryFn } from "./app-shell-Cg4ECP4f.mjs";
import { t as Guard } from "./guard-BudBk3vn.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/media-h3eqOiWq.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function Media() {
	const pageId = useShellStore((s) => s.selectedPageId) ?? void 0;
	const [rows, setRows] = (0, import_react.useState)([]);
	(0, import_react.useEffect)(() => {
		mediaLibraryFn({ data: { pageId } }).then(setRows);
	}, [pageId]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
			className: "text-xl font-semibold",
			children: "Media library"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-[13px] text-muted-foreground",
			children: "Cached against posts. Desktop build stores files under %LocalAppData%\\BookBoss\\MediaCache."
		})] }), rows.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-sm text-muted-foreground",
			children: "No media yet. Drop files in Composer."
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4",
			children: rows.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("figure", {
				className: "overflow-hidden rounded-xl bg-card shadow-card",
				children: [typeof r.data_url === "string" && String(r.data_url).startsWith("data:image") ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
					src: String(r.data_url),
					alt: String(r.alt_text ?? r.file_name),
					className: "aspect-square w-full object-cover"
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "grid aspect-square place-items-center bg-muted text-sm text-muted-foreground",
					children: String(r.media_kind)
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("figcaption", {
					className: "p-2 text-[12px]",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "truncate font-medium",
						children: String(r.file_name)
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "truncate text-muted-foreground",
						children: String(r.page_name)
					})]
				})]
			}, String(r.id)))
		})]
	});
}
var SplitComponent = () => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Guard, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Media, {}) });
//#endregion
export { SplitComponent as component };
