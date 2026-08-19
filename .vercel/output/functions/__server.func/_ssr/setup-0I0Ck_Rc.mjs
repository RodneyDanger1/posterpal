import { o as __toESM } from "../_runtime.mjs";
import { c as require_react, s as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { b as useNavigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { B as useCurrentUserState, C as getSettingsFn, P as saveFacebookApp, R as startPractice, g as completeSetup, i as Input, l as beginFacebookOAuth, n as BookBossMark, o as RedirectToSignIn, r as Button } from "./app-shell-Cg4ECP4f.mjs";
import { t as Label } from "./label-BF_kIDyZ.mjs";
import { i as REQUIRED_SCOPES } from "./crypto-DpPosqIC.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/setup-0I0Ck_Rc.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function SetupPage() {
	const { user, isPending } = useCurrentUserState();
	if (isPending) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "min-h-screen bg-background" });
	if (!user) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RedirectToSignIn, {});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "min-h-screen bg-background",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SetupWizard, {})
	});
}
function SetupWizard() {
	const navigate = useNavigate();
	const [step, setStep] = (0, import_react.useState)(1);
	const [appId, setAppId] = (0, import_react.useState)("");
	const [appSecret, setAppSecret] = (0, import_react.useState)("");
	const [redirect, setRedirect] = (0, import_react.useState)("");
	const [busy, setBusy] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		getSettingsFn().then((s) => {
			setAppId(s.facebookAppId);
			setRedirect(s.oauthRedirectUri);
		});
	}, []);
	const saveCreds = async () => {
		setBusy(true);
		try {
			await saveFacebookApp({ data: {
				appId,
				appSecret
			} });
			toast.success("App credentials saved (encrypted).");
			setStep(3);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Could not save");
		} finally {
			setBusy(false);
		}
	};
	const connect = async () => {
		setBusy(true);
		try {
			const uri = redirect || `${window.location.origin}/api/facebook/callback`;
			const { url } = await beginFacebookOAuth({ data: { redirectUri: uri } });
			if (!window.open(url, "bookboss-fb", "popup,width=520,height=720")) {
				window.location.href = url;
				return;
			}
			const onMsg = (ev) => {
				if (ev.origin !== window.location.origin) return;
				const data = ev.data;
				if (data?.source !== "bookboss-facebook") return;
				window.removeEventListener("message", onMsg);
				if (data.ok) {
					toast.success(data.message ?? "Connected");
					setStep(4);
				} else toast.error(data.message ?? "Connect failed");
				setBusy(false);
			};
			window.addEventListener("message", onMsg);
		} catch (e) {
			setBusy(false);
			toast.error(e instanceof Error ? e.message : "Could not start OAuth");
		}
	};
	const practice = async () => {
		setBusy(true);
		try {
			await startPractice();
			toast.success("Practice Pages are ready.");
			navigate({ to: "/" });
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Could not seed practice workspace");
		} finally {
			setBusy(false);
		}
	};
	const finish = async () => {
		await completeSetup();
		navigate({ to: "/" });
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mx-auto max-w-2xl px-4 py-10",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mb-6 flex items-center gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BookBossMark, { size: 36 }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "text-xl font-semibold",
					children: "First-run setup"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-[13px] text-muted-foreground",
					children: [
						"Step ",
						step,
						" of 4 · Development Mode is enough"
					]
				})] })]
			}),
			step === 1 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Panel, {
				title: "How BookBoss talks to Facebook",
				body: "Create a Facebook App at developers.facebook.com. Keep it in Development Mode and add yourself as Admin, Developer, or Tester — App Review is not required for role users. Products: Facebook Login with Client OAuth Login and Web OAuth Login on.",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ol", {
					className: "list-decimal space-y-2 pl-5 text-sm text-muted-foreground",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: ["Valid OAuth Redirect URI (this app): ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
							className: "rounded bg-muted px-1 text-foreground",
							children: redirect || `${typeof window !== "undefined" ? window.location.origin : ""}/api/facebook/callback`
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: ["Desktop WPF build uses the loopback URI ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
							className: "rounded bg-muted px-1 text-foreground",
							children: "http://127.0.0.1:55443/callback/"
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: ["Permissions: ", REQUIRED_SCOPES.join(", ")] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [
							"Page tokens come from ",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
								className: "rounded bg-muted px-1",
								children: "/me/accounts"
							}),
							". CREATE_CONTENT is required to publish; ANALYZE-only Pages import as read-only."
						] })
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-5 flex flex-wrap gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						onClick: () => setStep(2),
						children: "I have an App ID"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "outline",
						onClick: () => void practice(),
						disabled: busy,
						children: "Skip — start with practice Pages"
					})]
				})]
			}) : null,
			step === 2 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Panel, {
				title: "Facebook App credentials",
				body: "Stored encrypted. Never logged. Never compiled in.",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "space-y-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-1.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
							htmlFor: "appid",
							children: "App ID"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							id: "appid",
							value: appId,
							onChange: (e) => setAppId(e.target.value),
							placeholder: "123456789012345"
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-1.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
							htmlFor: "secret",
							children: "App Secret"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							id: "secret",
							type: "password",
							value: appSecret,
							onChange: (e) => setAppSecret(e.target.value),
							placeholder: "Paste secret"
						})]
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-5 flex gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						onClick: () => void saveCreds(),
						disabled: busy || !appId,
						children: "Save & continue"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "ghost",
						onClick: () => setStep(1),
						children: "Back"
					})]
				})]
			}) : null,
			step === 3 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Panel, {
				title: "Connect Facebook",
				body: "Opens the official OAuth dialog in a popup. We exchange the code, request a long-lived user token, then import Pages from /me/accounts.",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-[13px] text-muted-foreground",
					children: ["Redirect URI that must be on the app: ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
						className: "rounded bg-muted px-1 text-foreground",
						children: redirect
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-5 flex flex-wrap gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						onClick: () => void connect(),
						disabled: busy,
						children: "Connect Facebook"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "outline",
						onClick: () => void practice(),
						disabled: busy,
						children: "Use practice Pages instead"
					})]
				})]
			}) : null,
			step === 4 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Panel, {
				title: "You are in",
				body: "Optional: add AI later in Settings. Captions, hashtags, and reply drafts use Grok when the platform key is present — they never auto-send comments.",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-5 flex gap-2",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						onClick: () => void finish(),
						children: "Open BookBoss"
					})
				})
			}) : null
		]
	});
}
function Panel({ title, body, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "rounded-xl bg-card p-6 shadow-card",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "text-lg font-semibold",
				children: title
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-sm text-muted-foreground",
				children: body
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-4",
				children
			})
		]
	});
}
//#endregion
export { SetupPage as component };
