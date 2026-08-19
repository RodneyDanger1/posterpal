import { o as __toESM } from "../_runtime.mjs";
import { c as require_react, s as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { y as Navigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { r as signIn } from "./client-sGid3STf.mjs";
import { B as useCurrentUserState, n as BookBossMark, r as Button } from "./app-shell-Cg4ECP4f.mjs";
import { t as GROK_PROVIDERS } from "./server-C5_OWqhE.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/login-BJ37DCio.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function Login() {
	const { user } = useCurrentUserState();
	const [busy, setBusy] = (0, import_react.useState)(null);
	const [error, setError] = (0, import_react.useState)(null);
	if (user) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Navigate, { to: "/" });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "grid min-h-dvh bg-background lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "relative hidden flex-col justify-between bg-primary px-10 py-10 text-primary-foreground lg:flex",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BookBossMark, { size: 40 }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-lg font-semibold leading-none",
						children: "BookBoss"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-1 text-[13px] text-primary-foreground/80",
						children: "Every Page. One desk."
					})] })]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "max-w-md space-y-6",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "text-4xl font-semibold tracking-tight text-balance",
						children: "Run every Facebook Page you own like a newsroom, not a slot machine."
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
						className: "space-y-3 text-[15px] text-primary-foreground/90",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Official Graph API v26.0 — no scraping, no cookie tricks." }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Compose, schedule, moderate, and measure. Human on Send." }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Cadence guards and a policy checklist before anything goes live." })
						]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-[12px] text-primary-foreground/70",
					children: "Development Mode is enough. App Review is not required for role users."
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
			className: "flex items-center justify-center px-4 py-10",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "w-full max-w-md rounded-xl bg-card p-8 shadow-card",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-3 lg:hidden",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BookBossMark, { size: 36 }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
							className: "text-xl font-semibold tracking-tight",
							children: "BookBoss"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[13px] text-muted-foreground",
							children: "Every Page. One desk."
						})] })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "hidden text-xl font-semibold tracking-tight lg:block",
						children: "Sign in to the desk"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-3 text-sm text-muted-foreground",
						children: "Continue with Google or X. Then connect a Development Mode Facebook app — or start with practice Pages."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-6 space-y-2",
						children: GROK_PROVIDERS.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "button",
							variant: p.providerId.includes("google") ? "default" : "outline",
							className: "w-full",
							disabled: Boolean(busy),
							onClick: () => {
								setError(null);
								setBusy(p.providerId);
								signIn(p.providerId, { callbackURL: "/" }).catch((e) => {
									setBusy(null);
									setError(e instanceof Error ? e.message : "Sign-in failed");
								});
							},
							children: busy === p.providerId ? "Opening…" : `Continue with ${p.label}`
						}, p.providerId))
					}),
					error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-3 text-sm text-destructive",
						children: error
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-6 text-[12px] leading-relaxed text-muted-foreground",
						children: "AI may draft replies. You click Send. BookBoss never auto-likes, auto-follows, or auto-comments."
					})
				]
			})
		})]
	});
}
//#endregion
export { Login as component };
