import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { B as useCurrentUserState, o as RedirectToSignIn, s as Skeleton, t as AppShell } from "./app-shell-Cg4ECP4f.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/guard-BudBk3vn.js
var import_jsx_runtime = require_jsx_runtime();
function Guard({ children, right }) {
	const { user, isPending } = useCurrentUserState();
	if (isPending) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex min-h-screen bg-background p-6",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-10 w-48" })
	});
	if (!user) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RedirectToSignIn, {});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, {
		right,
		children
	});
}
//#endregion
export { Guard as t };
