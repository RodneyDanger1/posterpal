import { o as __toESM } from "../_runtime.mjs";
import { c as require_react, s as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { v as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { C as getSettingsFn, E as listPagesFn, I as savePrefs, P as saveFacebookApp, R as startPractice, V as useShellStore, i as Input, l as beginFacebookOAuth, m as cn, r as Button, z as updatePageVoiceFn } from "./app-shell-Cg4ECP4f.mjs";
import { t as Guard } from "./guard-BudBk3vn.mjs";
import { t as Label } from "./label-BF_kIDyZ.mjs";
import { i as REQUIRED_SCOPES } from "./crypto-DpPosqIC.mjs";
import { n as SwitchThumb, t as Switch$1 } from "../_libs/@radix-ui/react-switch+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/settings-DADd7e3D.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function Switch({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch$1, {
		className: cn("peer inline-flex h-6 w-11 shrink-0 items-center rounded-full bg-input transition-colors data-[state=checked]:bg-primary", className),
		...props,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SwitchThumb, { className: "block size-5 translate-x-0.5 rounded-full bg-card shadow-card transition-transform data-[state=checked]:translate-x-[22px]" })
	});
}
function Settings() {
	const theme = useShellStore((s) => s.theme);
	const setTheme = useShellStore((s) => s.setTheme);
	const [settings, setSettings] = (0, import_react.useState)(null);
	const [pages, setPages] = (0, import_react.useState)([]);
	const [appId, setAppId] = (0, import_react.useState)("");
	const [appSecret, setAppSecret] = (0, import_react.useState)("");
	const [warn, setWarn] = (0, import_react.useState)(8);
	const [block, setBlock] = (0, import_react.useState)(20);
	const [voice, setVoice] = (0, import_react.useState)("");
	const pageId = useShellStore((s) => s.selectedPageId);
	(0, import_react.useEffect)(() => {
		getSettingsFn().then((s) => {
			setSettings(s);
			setAppId(s.facebookAppId);
			setWarn(s.cadenceWarn);
			setBlock(s.cadenceBlock);
		});
		listPagesFn().then(setPages);
	}, []);
	(0, import_react.useEffect)(() => {
		const p = pages.find((x) => x.id === pageId);
		setVoice(p?.brand_voice ?? "");
	}, [pages, pageId]);
	const redirect = settings?.oauthRedirectUri ?? (typeof window !== "undefined" ? `${window.location.origin}/api/facebook/callback` : "");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mx-auto max-w-2xl space-y-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "text-xl font-semibold",
				children: "Settings"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "rounded-xl bg-card p-4 shadow-card",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-semibold",
					children: "Appearance"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "mt-3 flex items-center justify-between gap-3 text-sm",
					children: ["Dark theme", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
						checked: theme === "dark",
						onCheckedChange: (on) => {
							const t = on ? "dark" : "light";
							setTheme(t);
							savePrefs({ data: { theme: t } });
						}
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "rounded-xl bg-card p-4 shadow-card",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-semibold",
						children: "Facebook app"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-[13px] text-muted-foreground",
						children: "Development Mode is the intended personal-use mode. App Review is not required if only app roles use it."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-3 space-y-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "space-y-1",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "App ID" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									value: appId,
									onChange: (e) => setAppId(e.target.value)
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "space-y-1",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Label, { children: ["App Secret ", settings?.hasFacebookSecret ? "(saved)" : ""] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									type: "password",
									value: appSecret,
									onChange: (e) => setAppSecret(e.target.value),
									placeholder: "Leave blank to keep existing"
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "text-[12px] text-muted-foreground",
								children: [
									"Valid OAuth Redirect URI: ",
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
										className: "rounded bg-muted px-1",
										children: redirect
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
									"Desktop loopback: ",
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
										className: "rounded bg-muted px-1",
										children: "http://127.0.0.1:55443/callback/"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
									"Scopes: ",
									REQUIRED_SCOPES.join(", ")
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-wrap gap-2",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
										onClick: () => {
											saveFacebookApp({ data: {
												appId,
												appSecret
											} }).then(() => toast.success("Saved encrypted"));
										},
										children: "Save credentials"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
										variant: "outline",
										onClick: () => {
											beginFacebookOAuth({ data: { redirectUri: redirect } }).then(({ url }) => {
												window.open(url, "bookboss-fb", "popup,width=520,height=720");
											});
										},
										children: "Connect Facebook"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
										variant: "outline",
										asChild: true,
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
											to: "/setup",
											children: "Open wizard"
										})
									})
								]
							})
						]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "rounded-xl bg-card p-4 shadow-card",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-semibold",
						children: "Cadence guard"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-[13px] text-muted-foreground",
						children: "Warn default 8 / 24h. Hard cap default 20. Not a Graph limit — a spam-risk control."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-3 grid grid-cols-2 gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-1",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Warn at" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								type: "number",
								value: warn,
								onChange: (e) => setWarn(Number(e.target.value))
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-1",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Block at" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								type: "number",
								value: block,
								onChange: (e) => setBlock(Number(e.target.value))
							})]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						className: "mt-3",
						onClick: () => void savePrefs({ data: {
							cadenceWarn: warn,
							cadenceBlock: block
						} }).then(() => toast.success("Cadence saved")),
						children: "Save cadence"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "rounded-xl bg-card p-4 shadow-card",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-semibold",
						children: "Brand voice · selected Page"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
						className: "mt-3 min-h-24 w-full rounded-lg border border-input bg-card p-3 text-sm",
						value: voice,
						onChange: (e) => setVoice(e.target.value)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						className: "mt-3",
						disabled: !pageId,
						onClick: () => {
							if (!pageId) return;
							updatePageVoiceFn({ data: {
								pageId,
								brandVoice: voice
							} }).then(() => toast.success("Voice saved"));
						},
						children: "Save voice"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "rounded-xl bg-card p-4 shadow-card",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-semibold",
					children: "AI"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-[13px] text-muted-foreground",
					children: settings?.hasAiKey ? "Grok is available for captions, hashtags, sentiment, and reply drafts. Nothing auto-sends." : "AI buttons stay visible. Captions fall back to local variants until an xAI key is present in the environment."
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "rounded-xl bg-card p-4 shadow-card",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-semibold",
						children: "Practice workspace"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-[13px] text-muted-foreground",
						children: "Seed two local Pages with drafts, comments, and merch if this account is empty."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						className: "mt-3",
						variant: "outline",
						onClick: () => void startPractice().then(() => toast.success("Practice Pages ready")),
						children: "Seed practice Pages"
					})
				]
			})
		]
	});
}
var SplitComponent = () => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Guard, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Settings, {}) });
//#endregion
export { SplitComponent as component };
