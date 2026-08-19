import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { t as cva } from "../_libs/class-variance-authority+clsx.mjs";
import { m as cn } from "./app-shell-Cg4ECP4f.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/badge-C10s66SB.js
var import_jsx_runtime = require_jsx_runtime();
var badgeVariants = cva("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide", {
	variants: { variant: {
		default: "bg-accent text-accent-foreground",
		success: "bg-success/15 text-success",
		warning: "bg-warning/20 text-foreground",
		danger: "bg-destructive/15 text-destructive",
		muted: "bg-muted text-muted-foreground",
		outline: "border border-border text-muted-foreground"
	} },
	defaultVariants: { variant: "default" }
});
function Badge({ className, variant, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: cn(badgeVariants({ variant }), className),
		...props
	});
}
//#endregion
export { Badge as t };
