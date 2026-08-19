import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { t as Badge } from "./badge-C10s66SB.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/status-badge-DtbbexT3.js
var import_jsx_runtime = require_jsx_runtime();
var MAP = {
	LocalDraft: {
		label: "Local draft",
		variant: "muted"
	},
	FacebookDraft: {
		label: "Facebook draft",
		variant: "outline"
	},
	LocalScheduled: {
		label: "Local schedule",
		variant: "warning"
	},
	FacebookScheduled: {
		label: "Scheduled",
		variant: "default"
	},
	Publishing: {
		label: "Publishing",
		variant: "default"
	},
	Published: {
		label: "Published",
		variant: "success"
	},
	Failed: {
		label: "Failed",
		variant: "danger"
	},
	Cancelled: {
		label: "Cancelled",
		variant: "muted"
	}
};
function StatusBadge({ status }) {
	const m = MAP[status] ?? {
		label: status,
		variant: "muted"
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
		variant: m.variant,
		children: m.label
	});
}
//#endregion
export { StatusBadge as t };
