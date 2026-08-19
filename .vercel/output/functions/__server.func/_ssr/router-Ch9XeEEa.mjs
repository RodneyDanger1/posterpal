import { o as __toESM } from "../_runtime.mjs";
import { c as require_react, s as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { _ as createRootRoute, g as createFileRoute, h as lazyRouteComponent, l as Scripts, m as Outlet, p as createRouter, u as HeadContent, x as useRouter } from "../_libs/@tanstack/react-router+[...].mjs";
import { L as string, N as number, P as object, R as union, j as literal } from "../_libs/@better-auth/core+[...].mjs";
import { t as TriangleAlert } from "../_libs/lucide-react.mjs";
import { t as Toaster } from "../_libs/sonner.mjs";
import { r as getSql } from "./db-BDeUOKCw.mjs";
import { n as auth } from "./server-C5_OWqhE.mjs";
import { c as encryptSecret, i as REQUIRED_SCOPES, s as decryptSecret, t as GRAPH_BASE, u as graphFetch } from "./crypto-DpPosqIC.mjs";
import { randomUUID } from "node:crypto";
//#region node_modules/.nitro/vite/services/ssr/assets/router-Ch9XeEEa.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function AppErrorComponent({ error }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-red-500",
				"aria-hidden": "true",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, {
					className: "size-10",
					strokeWidth: 2
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "text-lg font-semibold",
				children: "Something went wrong"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "max-w-md text-sm break-words text-zinc-500 dark:text-zinc-400",
				children: error.message || "An unexpected error occurred. Try reloading the page."
			})
		]
	});
}
/**
* App-wide client provider mounted once near the root (in `src/routes/__root.tsx`):
*
*   <AuthProvider><Outlet /></AuthProvider>
*
* Better Auth's React client (`@/lib/auth/client`) needs NO context provider —
* its `useSession()` works standalone — so this is a passthrough today. It's
* kept as the single, stable mount point for any future client-side providers
* (e.g. a toast or theme provider) without churning the root shell.
*/
function AuthProvider({ children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children });
}
/**
* Guest side of the grok-web ↔ sandbox preview postMessage bridge.
*
* Activates only when this page is framed by an allowlisted Grok embedder.
* Top-level runs (download/export, local `npm run dev`, deployed sites) noop.
*/
var PREVIEW_BRIDGE_CHANNEL = "grok-preview-bridge";
var EnvelopeSchema = object({
	channel: literal(PREVIEW_BRIDGE_CHANNEL),
	version: number().int().positive(),
	type: string().min(1)
});
var HelloSchema = EnvelopeSchema.extend({ type: literal("hello") });
var NavigateSchema = EnvelopeSchema.extend({
	type: literal("navigate"),
	path: string().min(1)
});
var HistorySchema = EnvelopeSchema.extend({
	type: literal("history"),
	delta: union([literal(-1), literal(1)])
});
/**
* Whether `origin` is a known Grok embedder. Exported for tests.
* Do not list internal staging hosts here — this file ships in download/export.
*/
function isGrokEmbedderOrigin(origin) {
	try {
		const url = new URL(origin);
		if (url.protocol !== "https:" && url.protocol !== "http:") return false;
		const host = url.hostname.toLowerCase();
		if (host === "grok.com" || host.endsWith(".grok.com")) return true;
		if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") return true;
		return false;
	} catch {
		return false;
	}
}
/** Public preview zone. Staging embedders frame this host via the proxy CSP. */
function isSandboxPreviewGuestHost(hostname) {
	const host = hostname.toLowerCase();
	return host === "grok-sandbox.com" || host.endsWith(".grok-sandbox.com");
}
/** Resolve the parent origin to post to, or null when the bridge must noop. */
function resolveParentEmbedderOrigin(parentIsSelf, referrer, ancestorOrigin, guestHostname = "") {
	if (parentIsSelf) return null;
	const candidates = [referrer, ancestorOrigin ?? ""].filter(Boolean);
	for (const candidate of candidates) try {
		const origin = candidate.includes("://") ? new URL(candidate).origin : candidate;
		if (isGrokEmbedderOrigin(origin)) return origin;
		if (!isSandboxPreviewGuestHost(guestHostname)) continue;
		const parsed = new URL(origin.includes("://") ? origin : `https://${origin}`);
		if (parsed.protocol === "https:" || parsed.protocol === "http:") return parsed.origin;
	} catch {}
	return null;
}
function isSafeBridgePath(path) {
	if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return false;
	try {
		return new URL(path, "https://preview.invalid").origin === "https://preview.invalid";
	} catch {
		return false;
	}
}
/**
* Install host↔guest messaging. Returns a dispose function.
* Noops (returns a no-op dispose) when not embedded under a Grok parent.
*/
function installPreviewHostBridge(options = {}) {
	if (typeof window === "undefined") return () => {};
	const ancestorOrigin = typeof location.ancestorOrigins !== "undefined" && location.ancestorOrigins.length > 0 ? location.ancestorOrigins[0] : null;
	const parentOrigin = resolveParentEmbedderOrigin(window.parent === window, document.referrer, ancestorOrigin, window.location.hostname);
	if (parentOrigin === null) return () => {};
	const ROOT_STATE_KEY = "__grokPreviewBridgeRoot";
	const originalPushState = window.history.pushState.bind(window.history);
	const originalReplaceState = window.history.replaceState.bind(window.history);
	const isAtHistoryRoot = () => {
		const state = window.history.state;
		return Boolean(state && typeof state === "object" && state[ROOT_STATE_KEY] === true);
	};
	try {
		const current = window.history.state;
		if (!(current !== null && typeof current === "object" && Object.prototype.hasOwnProperty.call(current, ROOT_STATE_KEY))) {
			const isRoot = window.history.length <= 1;
			originalReplaceState(current && typeof current === "object" ? {
				...current,
				[ROOT_STATE_KEY]: isRoot
			} : { [ROOT_STATE_KEY]: isRoot }, "", window.location.href);
		}
	} catch {}
	const post = (message) => {
		window.parent.postMessage(message, parentOrigin);
	};
	const reportLocation = () => {
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "location",
			path: window.location.pathname || "/",
			search: window.location.search,
			hash: window.location.hash
		});
	};
	const reportRoutes = () => {
		const paths = options.getRoutePaths?.() ?? [];
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "routes",
			paths
		});
	};
	const defaultNavigate = (path) => {
		if (!isSafeBridgePath(path)) return;
		try {
			const url = new URL(path, window.location.origin);
			if (url.origin !== window.location.origin) return;
			const next = `${url.pathname}${url.search}${url.hash}`;
			window.history.pushState(window.history.state, "", next);
			window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
		} catch {}
	};
	const navigate = (path) => {
		if (!isSafeBridgePath(path)) return;
		if (options.navigate) {
			options.navigate(path);
			return;
		}
		defaultNavigate(path);
	};
	const announce = () => {
		reportLocation();
		reportRoutes();
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "ready"
		});
	};
	const onMessage = (event) => {
		if (event.source !== window.parent) return;
		if (event.origin !== parentOrigin) return;
		const envelope = EnvelopeSchema.safeParse(event.data);
		if (!envelope.success || envelope.data.version !== 1) return;
		if (envelope.data.type === "hello") {
			if (!HelloSchema.safeParse(event.data).success) return;
			announce();
			return;
		}
		if (envelope.data.type === "navigate") {
			const parsed = NavigateSchema.safeParse(event.data);
			if (!parsed.success) return;
			navigate(parsed.data.path);
			queueMicrotask(reportLocation);
			return;
		}
		if (envelope.data.type === "history") {
			const parsed = HistorySchema.safeParse(event.data);
			if (!parsed.success) return;
			if (parsed.data.delta === -1 && isAtHistoryRoot()) return;
			window.history.go(parsed.data.delta);
		}
	};
	const onPopState = () => {
		reportLocation();
	};
	const onHashChange = () => {
		reportLocation();
	};
	window.history.pushState = (data, unused, url) => {
		const next = data && typeof data === "object" ? {
			...data,
			[ROOT_STATE_KEY]: false
		} : data;
		originalPushState(next, unused, url);
		reportLocation();
	};
	window.history.replaceState = (data, unused, url) => {
		const next = isAtHistoryRoot() ? {
			...data && typeof data === "object" ? data : {},
			[ROOT_STATE_KEY]: true
		} : data;
		originalReplaceState(next, unused, url);
		reportLocation();
	};
	window.addEventListener("message", onMessage);
	window.addEventListener("popstate", onPopState);
	window.addEventListener("hashchange", onHashChange);
	announce();
	return () => {
		window.removeEventListener("message", onMessage);
		window.removeEventListener("popstate", onPopState);
		window.removeEventListener("hashchange", onHashChange);
		window.history.pushState = originalPushState;
		window.history.replaceState = originalReplaceState;
	};
}
/** Collect static path patterns from a TanStack route tree (best-effort). */
function collectRoutePathsFromTree(routeTree) {
	const paths = /* @__PURE__ */ new Set();
	const walk = (node) => {
		if (!node || typeof node !== "object") return;
		const record = node;
		const full = typeof record.fullPath === "string" ? record.fullPath : typeof record.path === "string" ? record.path : null;
		if (full !== null && full !== "") paths.add(full.startsWith("/") ? full : `/${full}`);
		else if (full === "") paths.add("/");
		const children = record.children;
		if (Array.isArray(children)) for (const child of children) walk(child);
		else if (children && typeof children === "object") for (const child of Object.values(children)) walk(child);
	};
	walk(routeTree);
	return [...paths];
}
/**
* Mount once in `__root.tsx` so the Grok preview chrome can drive navigation
* (and later receive registered routes). Noops when the app is not embedded.
*/
function PreviewHostBridge() {
	const router = useRouter();
	(0, import_react.useEffect)(() => {
		return installPreviewHostBridge({
			navigate: (path) => {
				router.history.push(path);
			},
			getRoutePaths: () => collectRoutePathsFromTree(router.routeTree)
		});
	}, [router]);
	return null;
}
var styles_default = "/assets/styles-CNYJmrrr.css";
var APP_NAME = "BookBoss";
var Route$14 = createRootRoute({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1"
			},
			{ title: APP_NAME },
			{
				name: "description",
				content: "Compose, schedule, moderate, and analyze unlimited Facebook Pages."
			},
			{
				name: "apple-mobile-web-app-title",
				content: APP_NAME
			},
			{
				name: "theme-color",
				content: "#1877F2"
			},
			{
				name: "twitter:card",
				content: "summary_large_image"
			},
			{
				property: "og:type",
				content: "website"
			},
			{
				property: "og:title",
				content: APP_NAME
			},
			{
				property: "og:description",
				content: "Every Page. One desk."
			},
			...[]
		],
		links: [
			{
				rel: "icon",
				type: "image/svg+xml",
				href: "/favicon.svg"
			},
			{
				rel: "stylesheet",
				href: styles_default
			},
			{
				rel: "manifest",
				href: "/__grok/manifest.webmanifest"
			},
			{
				rel: "apple-touch-icon",
				href: "/__grok/icon-180.png"
			}
		]
	}),
	errorComponent: AppErrorComponent,
	component: RootDocument
});
function RootDocument() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("html", {
		lang: "en",
		suppressHydrationWarning: true,
		className: "antialiased",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("head", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HeadContent, {}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("body", { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PreviewHostBridge, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AuthProvider, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Outlet, {}) }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toaster, {
				position: "bottom-right",
				richColors: true,
				closeButton: true
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scripts, {})
		] })]
	});
}
var $$splitComponentImporter$11 = () => import("./routes-Bmm5jRMF.mjs");
var Route$13 = createFileRoute("/")({ component: lazyRouteComponent($$splitComponentImporter$11, "component") });
var $$splitComponentImporter$10 = () => import("./analytics-CNoMpt0z.mjs");
var Route$12 = createFileRoute("/analytics")({ component: lazyRouteComponent($$splitComponentImporter$10, "component") });
var $$splitComponentImporter$9 = () => import("./calendar-C2Hc1PGK.mjs");
var Route$11 = createFileRoute("/calendar")({ component: lazyRouteComponent($$splitComponentImporter$9, "component") });
var $$splitComponentImporter$8 = () => import("./composer-C0IKruwx.mjs");
var Route$10 = createFileRoute("/composer")({ component: lazyRouteComponent($$splitComponentImporter$8, "component") });
var $$splitComponentImporter$7 = () => import("./drafts-BiZLFwUw.mjs");
var Route$9 = createFileRoute("/drafts")({ component: lazyRouteComponent($$splitComponentImporter$7, "component") });
var $$splitComponentImporter$6 = () => import("./inbox-DfnzREGn.mjs");
var Route$8 = createFileRoute("/inbox")({ component: lazyRouteComponent($$splitComponentImporter$6, "component") });
var $$splitComponentImporter$5 = () => import("./login-BJ37DCio.mjs");
var Route$7 = createFileRoute("/login")({ component: lazyRouteComponent($$splitComponentImporter$5, "component") });
var $$splitComponentImporter$4 = () => import("./media-h3eqOiWq.mjs");
var Route$6 = createFileRoute("/media")({ component: lazyRouteComponent($$splitComponentImporter$4, "component") });
var $$splitComponentImporter$3 = () => import("./merchandise-CEOYGkcf.mjs");
var Route$5 = createFileRoute("/merchandise")({ component: lazyRouteComponent($$splitComponentImporter$3, "component") });
var $$splitComponentImporter$2 = () => import("./settings-DADd7e3D.mjs");
var Route$4 = createFileRoute("/settings")({ component: lazyRouteComponent($$splitComponentImporter$2, "component") });
var $$splitComponentImporter$1 = () => import("./setup-0I0Ck_Rc.mjs");
var Route$3 = createFileRoute("/setup")({ component: lazyRouteComponent($$splitComponentImporter$1, "component") });
var $$splitComponentImporter = () => import("./vault-BRUvdkaZ.mjs");
var Route$2 = createFileRoute("/vault")({ component: lazyRouteComponent($$splitComponentImporter, "component") });
var Route$1 = createFileRoute("/api/auth/$")({ server: { handlers: {
	GET: ({ request }) => auth.handler(request),
	POST: ({ request }) => auth.handler(request)
} } });
async function handleFacebookCallback(request) {
	const url = new URL(request.url);
	const err = url.searchParams.get("error_description") ?? url.searchParams.get("error");
	if (err) return htmlClose(`Facebook returned an error: ${err}`);
	const code = url.searchParams.get("code");
	const state = url.searchParams.get("state");
	if (!code || !state) return htmlClose("Missing code or state from Facebook.");
	const sql = await getSql();
	const userId = (await sql`
    select user_id from oauth_states where state = ${state} and expires_at > now()
  `)[0]?.user_id;
	if (!userId) return htmlClose("OAuth state expired or invalid. Close this window and try Connect again.");
	await sql`delete from oauth_states where state = ${state}`;
	const appRows = await sql`
    select value_plain, value_enc from app_settings where user_id = ${userId} and key = 'facebook_app_id'
  `;
	const secretRows = await sql`
    select value_plain, value_enc from app_settings where user_id = ${userId} and key = 'facebook_app_secret'
  `;
	const appId = appRows[0]?.value_plain ?? decryptSecret(appRows[0]?.value_enc) ?? "";
	const appSecret = decryptSecret(secretRows[0]?.value_enc) ?? secretRows[0]?.value_plain ?? "";
	if (!appId || !appSecret) return htmlClose("Facebook App ID or Secret is missing. Save them in Settings first.");
	const redirectUri = `${url.origin}/api/facebook/callback`;
	try {
		const short = await exchangeToken({
			client_id: appId,
			client_secret: appSecret,
			redirect_uri: redirectUri,
			code
		});
		if (!short.access_token) return htmlClose("Token exchange returned no access_token.");
		let longLived = short.access_token;
		let expiresAt = short.expires_in ? new Date(Date.now() + short.expires_in * 1e3).toISOString() : null;
		try {
			const longTok = await exchangeToken({
				grant_type: "fb_exchange_token",
				client_id: appId,
				client_secret: appSecret,
				fb_exchange_token: short.access_token
			});
			if (longTok.access_token) longLived = longTok.access_token;
			if (longTok.expires_in) expiresAt = new Date(Date.now() + longTok.expires_in * 1e3).toISOString();
		} catch {}
		let dataAccessExpires = null;
		let isValid = true;
		let scopes = REQUIRED_SCOPES.join(",");
		try {
			const d = (await graphFetch({
				path: "/debug_token",
				token: `${appId}|${appSecret}`,
				appSecret,
				query: { input_token: longLived }
			})).data.data;
			if (d) {
				isValid = d.is_valid !== false;
				if (d.scopes?.length) scopes = d.scopes.join(",");
				if (d.expires_at) expiresAt = (/* @__PURE__ */ new Date(d.expires_at * 1e3)).toISOString();
				if (d.data_access_expires_at) dataAccessExpires = (/* @__PURE__ */ new Date(d.data_access_expires_at * 1e3)).toISOString();
			}
		} catch {}
		await sql`
      insert into token_vault (
        id, user_id, name, user_token_enc, long_lived_token_enc, expires_at,
        data_access_expires_at, scopes, last_validated_at, is_valid
      ) values (
        ${randomUUID()}, ${userId}, ${"Facebook user"}, ${encryptSecret(short.access_token)},
        ${encryptSecret(longLived)}, ${expiresAt}, ${dataAccessExpires}, ${scopes}, now(), ${isValid}
      )
    `;
		const accounts = await graphFetch({
			path: "/me/accounts",
			token: longLived,
			appSecret,
			query: { fields: "id,name,access_token,category,category_list,fan_count,tasks" }
		});
		let imported = 0;
		for (const acct of accounts.data.data ?? []) {
			const tasks = acct.tasks ?? [];
			const canCreate = tasks.includes("CREATE_CONTENT");
			const existing = await sql`
        select id from pages where user_id = ${userId} and facebook_page_id = ${acct.id}
      `;
			if (existing[0]) await sql`
          update pages set
            name = ${acct.name},
            category = ${acct.category ?? null},
            fan_count = ${acct.fan_count ?? 0},
            tasks_json = ${JSON.stringify(tasks)},
            access_token_enc = ${acct.access_token ? encryptSecret(acct.access_token) : null},
            is_read_only = ${!canCreate},
            is_practice = false,
            updated_at = now()
          where id = ${existing[0].id}
        `;
			else await sql`
          insert into pages (
            id, user_id, facebook_page_id, name, category, fan_count, tasks_json,
            access_token_enc, is_active, is_read_only, is_practice
          ) values (
            ${randomUUID()}, ${userId}, ${acct.id}, ${acct.name}, ${acct.category ?? null},
            ${acct.fan_count ?? 0}, ${JSON.stringify(tasks)},
            ${acct.access_token ? encryptSecret(acct.access_token) : null},
            true, ${!canCreate}, false
          )
        `;
			imported += 1;
		}
		return htmlClose(`Connected. Imported ${imported} Page${imported === 1 ? "" : "s"}. You can close this window.`, true);
	} catch (e) {
		return htmlClose(`Facebook connect failed: ${e instanceof Error ? e.message : String(e)}`);
	}
}
async function exchangeToken(params) {
	const u = new URL(`${GRAPH_BASE}/oauth/access_token`);
	for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
	const res = await fetch(u, { method: "GET" });
	const json = await res.json();
	if (!res.ok || json.error) throw new Error(json.error?.message ?? `Token exchange failed (${res.status})`);
	return json;
}
function htmlClose(message, ok = false) {
	const payload = JSON.stringify({
		source: "bookboss-facebook",
		ok,
		message
	});
	const body = `<!doctype html><html><body style="font-family:Segoe UI,system-ui,sans-serif;padding:32px;background:#F0F2F5;color:#050505">
  <p>${escapeHtml(message)}</p>
  <script>
    try { window.opener && window.opener.postMessage(${payload}, window.location.origin); } catch (e) {}
    setTimeout(function(){ window.close(); }, 400);
  <\/script>
  </body></html>`;
	return new Response(body, {
		status: 200,
		headers: { "content-type": "text/html; charset=utf-8" }
	});
}
function escapeHtml(s) {
	return s.replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">");
}
var Route = createFileRoute("/api/facebook/callback")({ server: { handlers: { GET: ({ request }) => handleFacebookCallback(request) } } });
var rootRouteChildren = {
	IndexRoute: Route$13.update({
		id: "/",
		path: "/",
		getParentRoute: () => Route$14
	}),
	AnalyticsRoute: Route$12.update({
		id: "/analytics",
		path: "/analytics",
		getParentRoute: () => Route$14
	}),
	CalendarRoute: Route$11.update({
		id: "/calendar",
		path: "/calendar",
		getParentRoute: () => Route$14
	}),
	ComposerRoute: Route$10.update({
		id: "/composer",
		path: "/composer",
		getParentRoute: () => Route$14
	}),
	DraftsRoute: Route$9.update({
		id: "/drafts",
		path: "/drafts",
		getParentRoute: () => Route$14
	}),
	InboxRoute: Route$8.update({
		id: "/inbox",
		path: "/inbox",
		getParentRoute: () => Route$14
	}),
	LoginRoute: Route$7.update({
		id: "/login",
		path: "/login",
		getParentRoute: () => Route$14
	}),
	MediaRoute: Route$6.update({
		id: "/media",
		path: "/media",
		getParentRoute: () => Route$14
	}),
	MerchandiseRoute: Route$5.update({
		id: "/merchandise",
		path: "/merchandise",
		getParentRoute: () => Route$14
	}),
	SettingsRoute: Route$4.update({
		id: "/settings",
		path: "/settings",
		getParentRoute: () => Route$14
	}),
	SetupRoute: Route$3.update({
		id: "/setup",
		path: "/setup",
		getParentRoute: () => Route$14
	}),
	VaultRoute: Route$2.update({
		id: "/vault",
		path: "/vault",
		getParentRoute: () => Route$14
	}),
	ApiAuthSplatRoute: Route$1.update({
		id: "/api/auth/$",
		path: "/api/auth/$",
		getParentRoute: () => Route$14
	}),
	ApiFacebookCallbackRoute: Route.update({
		id: "/api/facebook/callback",
		path: "/api/facebook/callback",
		getParentRoute: () => Route$14
	})
};
var routeTree = Route$14._addFileChildren(rootRouteChildren)._addFileTypes();
function getRouter() {
	return createRouter({
		routeTree,
		defaultErrorComponent: AppErrorComponent
	});
}
//#endregion
export { getRouter };
