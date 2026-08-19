import { o as __toESM } from "../_runtime.mjs";
import { c as require_react, r as Slot, s as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { b as useNavigate, d as useRouterState, v as Link, y as Navigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { i as createServerFn, o as getServerFnById, t as TSS_SERVER_FUNCTION } from "./ssr.mjs";
import { i as signOut, t as authClient } from "./client-sGid3STf.mjs";
import { t as authMiddleware } from "./middleware-nfuoPv-U.mjs";
import { a as Search, c as KeyRound, d as FileText, f as ChartColumn, i as Settings, l as Inbox, n as SquarePen, o as Menu, p as CalendarDays, r as ShoppingBag, s as LayoutGrid, u as Image } from "../_libs/lucide-react.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { n as create, t as persist } from "../_libs/zustand.mjs";
import { n as clsx, t as cva } from "../_libs/class-variance-authority+clsx.mjs";
import { t as twMerge } from "../_libs/tailwind-merge.mjs";
import { i as Viewport, n as Scrollbar, r as Thumb, t as Root } from "../_libs/radix-ui__react-scroll-area.mjs";
import { t as _e } from "../_libs/cmdk.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/app-shell-Cg4ECP4f.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
/**
* Current user + loading state. Same behavior in live preview and when deployed:
*   - Auth enabled (default) -> the real signed-in user; `user` is `null` while
*                            the session resolves (`isPending: true`) and when
*                            signed out (`isPending: false`). Session comes from
*                            Better Auth `useSession()` → `/api/auth/get-session`
*                            (cookie when deployed; bearer in live preview).
*   - Auth disabled (`VITE_AUTH_ENABLED=false`) -> `DEV_USER`, never pending.
*
* Protect a route by waiting out `isPending` before acting on `user` —
* redirecting on `user: null` alone bounces signed-in visitors to sign-in on
* every hard reload:
*
*   import { RedirectToSignIn } from "@/lib/auth/gates";
*   const { user, isPending } = useCurrentUserState();
*   if (isPending) return null;              // still resolving — don't redirect yet
*   if (!user) return <RedirectToSignIn />;  // definitely signed out
*
* `authEnabled` is a module-level constant fixed at load, so the guarded hook
* call keeps a stable hook order across every render of a given component.
*/
function useCurrentUserState() {
	const { data, isPending } = authClient.useSession();
	const user = data?.user;
	return {
		user: user ? {
			id: user.id,
			displayName: user.name ?? null,
			primaryEmail: user.email ?? null,
			profileImageUrl: user.image ?? null,
			isDevFallback: false
		} : null,
		isPending
	};
}
/**
* Convenience view of `useCurrentUserState().user` for display (e.g.
* `user?.displayName ?? "Guest"`). NOTE: `null` means *loading OR signed out* —
* for redirects/guards use `useCurrentUserState()` and check `isPending`.
*/
function useCurrentUser() {
	return useCurrentUserState().user;
}
/**
* Auth state components — plain wrappers around `useCurrentUserState()`.
*
* Auth is ON by default (including the sandbox live preview, which does real
* sign-in). Visitors are signed out until they authenticate. The shared dev
* user only appears when auth is explicitly disabled (`VITE_AUTH_ENABLED=false`).
* While the session is still resolving, gates that care about signed-out state
* render nothing so there's no signed-out flash on hard reload.
*/
/** Where `RedirectToSignIn` sends signed-out visitors. Create this route. */
var SIGN_IN_PATH = "/login";
/**
* Client-side redirect to the sign-in route (TanStack `<Navigate>` — NOT a full
* `window.location` reload). A hard navigation re-bootstraps the SPA and re-runs
* session loading, which feels like a second "Loading…" on /login.
*
* Guard routes by waiting out `isPending` first (see `use-current-user`), then
* render this.
*/
function RedirectToSignIn({ to = SIGN_IN_PATH }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Navigate, { to });
}
/**
* Minimal signed-in identity chip + sign-out. Restyle freely (see the
* `design-ui` skill). Sign-out is only shown when auth is enabled (the
* disabled-auth dev user has nothing to sign out of).
*/
function UserButton() {
	const user = useCurrentUser();
	if (!user) return null;
	const label = user.displayName ?? user.primaryEmail ?? "Account";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-center gap-2",
		children: [
			user.profileImageUrl ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
				src: user.profileImageUrl,
				alt: "",
				className: "h-8 w-8 rounded-full object-cover"
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "grid h-8 w-8 place-items-center rounded-full bg-black/10 text-sm font-medium dark:bg-white/20",
				children: label.charAt(0).toUpperCase()
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-sm font-medium",
				children: label
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				onClick: () => void signOut(),
				className: "cursor-pointer text-sm underline-offset-4 opacity-70 hover:underline",
				children: "Sign out"
			})
		]
	});
}
var createSsrRpc = (functionId) => {
	const url = "/_serverFn/" + functionId;
	const serverFnMeta = { id: functionId };
	const fn = async (...args) => {
		return (await getServerFnById(functionId, { origin: "server" }))(...args);
	};
	return Object.assign(fn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
var bootstrapApp = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(createSsrRpc("f09da5c83013ee7ecb017568a31b69a12726f09279fd6867a4110756a970eb0d"));
var getSettingsFn = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(createSsrRpc("0580bb890321da4d8e54b982b67f3cddcc95c6ae232f5a24baee56f88117990b"));
var saveFacebookApp = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((d) => d).handler(createSsrRpc("b551655a07afcad0bb30c88862af7edca4a4f238116fef8ac9c27584e89926f6"));
var savePrefs = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((d) => d).handler(createSsrRpc("a98e5ded0dc02c9677dea9b968a91af9047c460c190baaf0d8e86a96de82963d"));
var completeSetup = createServerFn({ method: "POST" }).middleware([authMiddleware]).handler(createSsrRpc("ec64c401dc6818bad4f27a783f0def0b35e9b51c1c850081480cf8c80abc4e60"));
var startPractice = createServerFn({ method: "POST" }).middleware([authMiddleware]).handler(createSsrRpc("4fef2d2abdd97d907010feb84f7b0ebaf40d8d0790a2099819cf2441ba913af3"));
var beginFacebookOAuth = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((d) => d).handler(createSsrRpc("489af1dacd746435e9efe85f7c29d4a343f35a0136de00d764b582f4c3b13598"));
var listPagesFn = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(createSsrRpc("1d3977c182845211c56773f5f09b3ef2ac09f6b14610d36dc72007c528fd9988"));
var listPostsFn = createServerFn({ method: "GET" }).middleware([authMiddleware]).validator((d) => d).handler(createSsrRpc("5da1ecf50df589f88e1080b492c0c2de4d186332d261e386a07458ff7a64efa3"));
createServerFn({ method: "GET" }).middleware([authMiddleware]).validator((d) => d).handler(createSsrRpc("44a9aa4100793213c6af3d1560f828c615b64ad6095b0d19cb3cc18e44c8df92"));
var cadenceFn = createServerFn({ method: "GET" }).middleware([authMiddleware]).validator((d) => d).handler(createSsrRpc("887e40d64d7307d65d76aeec062b7d46c0a361207cf8a4e604f44d0757f57abd"));
var policyFn = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((d) => d).handler(createSsrRpc("c0172c2544b382857109e2d257f1329c09df486431f1c52f198c5744fd4bfae4"));
var composeFn = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((d) => d).handler(createSsrRpc("fea208b6d444b4f8c7225499766509a652bfbcbb078e5ec4aff149635515b68f"));
var rescheduleFn = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((d) => d).handler(createSsrRpc("c4fb2cb27721b6b9bf6fe087d6d41bdb069cccddc8e1ebf7fa1d8f73747aa44d"));
var cancelPostFn = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((d) => d).handler(createSsrRpc("d4e46519a5b05cd89bea4ac8de5e624382db1d4c1a6c733913c4365f6dd78538"));
var commentsFn = createServerFn({ method: "GET" }).middleware([authMiddleware]).validator((d) => d).handler(createSsrRpc("33098acbf6d39dc136644cf3aa0712ce53c1752b709425cc7d39da8792166af9"));
var hideCommentFn = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((d) => d).handler(createSsrRpc("32c1efc0d9d202129d41b50d8dd1db1257695559175cf7c32e4af8647b84bc88"));
var sendReplyFn = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((d) => d).handler(createSsrRpc("82db74f32e69a42b6b0b0932f15716f3f5f78fad1ea3be79bf07b2d5681321a1"));
var generateReplyDraftsFn = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((d) => d).handler(createSsrRpc("a637e0b6f5e17c80a75f53dd23ecf172ad78c4a8dd293277ccfd574a165037ad"));
var merchFn = createServerFn({ method: "GET" }).middleware([authMiddleware]).validator((d = {}) => d).handler(createSsrRpc("9c7b53baf14acfecf3e6d45203f4ae6da6679fa6aeb479b6a8b827d6aba745c1"));
var saveMerchFn = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((d) => d).handler(createSsrRpc("af9c9107d566596341e2601dd1264475e27cb7dc17e582f8fdf6fd268b98605d"));
var deleteMerchFn = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((d) => d).handler(createSsrRpc("796155597e90e3ee01cf86838c13bf2377f19f5bc979c3480049dcdb25666d65"));
var vaultFn = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(createSsrRpc("9ad8fc2b19ce93ff1843fd0b1cc893f03d21a0cb412d092434f8186ca640ae51"));
var logsFn = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(createSsrRpc("1e268868072d54527652e1fd9294e58e670917faa078d79601ab4bf98e325a03"));
var searchFn = createServerFn({ method: "GET" }).middleware([authMiddleware]).validator((d) => d).handler(createSsrRpc("5f6d3a28887b4b341e9717c6bee15f071ba9a8ebdf0b82ee483491b62fb7d5f7"));
var analyticsFn = createServerFn({ method: "GET" }).middleware([authMiddleware]).validator((d) => d).handler(createSsrRpc("4b0cd3c75cd692eb8cee23197fe1c8344f71fdcb6bc29210f9d5d4fb9abe1e5e"));
var mediaLibraryFn = createServerFn({ method: "GET" }).middleware([authMiddleware]).validator((d = {}) => d).handler(createSsrRpc("a3e59aa91c7e05da42619dfc4dadaefbef31ab5fc51bb175ded9d75026248a8f"));
var generateVariantsFn = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((d) => d).handler(createSsrRpc("4039e4c05ec5b11df05aee1092c64e5b3b47aeed8046999a675d8e2ee6aacdc2"));
var hashtagsFn = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((d) => d).handler(createSsrRpc("b7967ccb5dfae1e3f82c21961cb1c39c507c92a87651e1ed99264aaf8228f499"));
createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((d) => d).handler(createSsrRpc("1cbedc570b88a6a3eff41fa3d5d85bb4ce64576227c4ed53a3eac29547d2a654"));
var updatePageVoiceFn = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((d) => d).handler(createSsrRpc("4cca22317f9bd5e178cadb437e54c40028db2c2173315dfbf8a4135f354dda62"));
var exportCsvFn = createServerFn({ method: "GET" }).middleware([authMiddleware]).validator((d) => d).handler(createSsrRpc("cdfb0cc629ca1283cadc9ef6dac3d0e0f82cd2943cade75999d5d2a95200083f"));
var tickFn = createServerFn({ method: "POST" }).middleware([authMiddleware]).handler(createSsrRpc("4e573092f755d8cf5362fe25617290ccc1f8d941910d4e54514f386e22a402c4"));
var calendarFn = createServerFn({ method: "GET" }).middleware([authMiddleware]).validator((d = {}) => d).handler(createSsrRpc("f964b8af51e13786be324d7fa4945697468861261e51dae9a3a22fc1b58291b9"));
var useShellStore = create()(persist((set) => ({
	selectedPageId: null,
	setSelectedPageId: (id) => set({ selectedPageId: id }),
	commandOpen: false,
	setCommandOpen: (open) => set({ commandOpen: open }),
	theme: "light",
	setTheme: (t) => {
		if (typeof document !== "undefined") document.documentElement.classList.toggle("dark", t === "dark");
		set({ theme: t });
	}
}), { name: "bookboss-shell" }));
function cn(...inputs) {
	return twMerge(clsx(inputs));
}
function formatFanCount(n) {
	if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, "")}M`;
	if (n >= 1e3) return `${(n / 1e3).toFixed(1).replace(/\.0$/, "")}K`;
	return n.toLocaleString();
}
function initials(name) {
	const parts = name.trim().split(/\s+/).filter(Boolean);
	if (parts.length === 0) return "P";
	if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
	return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}
function relativeTime(iso) {
	if (!iso) return "—";
	const t = new Date(iso).getTime();
	if (Number.isNaN(t)) return "—";
	const diff = Date.now() - t;
	const mins = Math.round(Math.abs(diff) / 6e4);
	if (mins < 1) return "just now";
	if (mins < 60) return diff > 0 ? `${mins}m ago` : `in ${mins}m`;
	const hours = Math.round(mins / 60);
	if (hours < 24) return diff > 0 ? `${hours}h ago` : `in ${hours}h`;
	const days = Math.round(hours / 24);
	if (days < 14) return diff > 0 ? `${days}d ago` : `in ${days}d`;
	return new Date(iso).toLocaleDateString(void 0, {
		month: "short",
		day: "numeric"
	});
}
function pageHue(id) {
	let h = 0;
	for (let i = 0; i < id.length; i += 1) h = (h + id.charCodeAt(i) * 17) % 360;
	return `hsl(${h} 42% 46%)`;
}
function PageAvatar({ id, name, size = 40, className }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: cn("inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white", className),
		style: {
			width: size,
			height: size,
			background: pageHue(id),
			fontSize: size * .36
		},
		"aria-hidden": true,
		children: initials(name)
	});
}
var buttonVariants = cva("inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98]", {
	variants: {
		variant: {
			default: "bg-primary text-primary-foreground hover:bg-fb-hover active:bg-fb-press",
			secondary: "bg-secondary text-secondary-foreground hover:bg-muted",
			outline: "border border-border bg-card text-foreground hover:bg-muted",
			ghost: "text-foreground hover:bg-muted",
			destructive: "bg-destructive text-destructive-foreground hover:opacity-90",
			link: "text-primary underline-offset-4 hover:underline"
		},
		size: {
			default: "h-10 px-4",
			sm: "h-8 rounded-sm px-3 text-[13px]",
			lg: "h-11 px-5",
			icon: "size-10"
		}
	},
	defaultVariants: {
		variant: "default",
		size: "default"
	}
});
function Button({ className, variant, size, asChild = false, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(asChild ? Slot : "button", {
		className: cn(buttonVariants({
			variant,
			size,
			className
		})),
		...props
	});
}
function Input({ className, type, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
		type,
		className: cn("flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground shadow-none placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50", className),
		...props
	});
}
function ScrollArea({ className, children, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Root, {
		className: cn("overflow-hidden", className),
		...props,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Viewport, {
			className: "size-full",
			children
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scrollbar, {
			orientation: "vertical",
			className: "flex w-2 touch-none bg-transparent p-px",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Thumb, { className: "relative flex-1 rounded-full bg-border" })
		})]
	});
}
function Skeleton({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: cn("animate-pulse rounded-md bg-muted", className),
		...props
	});
}
function CommandPalette({ pages, onSearch }) {
	const open = useShellStore((s) => s.commandOpen);
	const setOpen = useShellStore((s) => s.setCommandOpen);
	const setPage = useShellStore((s) => s.setSelectedPageId);
	const navigate = useNavigate();
	const [q, setQ] = (0, import_react.useState)("");
	const [hits, setHits] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		if (!open) return;
		const t = window.setTimeout(() => {
			if (q.trim().length < 2) {
				setHits(null);
				return;
			}
			onSearch(q).then(setHits).catch(() => setHits(null));
		}, 180);
		return () => window.clearTimeout(t);
	}, [
		q,
		open,
		onSearch
	]);
	if (!open) return null;
	const go = (path) => {
		setOpen(false);
		navigate({ to: path });
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "fixed inset-0 z-50 flex items-start justify-center bg-foreground/40 pt-[12vh]",
		onClick: () => setOpen(false),
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(_e, {
			className: "w-[min(640px,calc(100vw-24px))] overflow-hidden rounded-xl bg-card shadow-lift",
			onClick: (e) => e.stopPropagation(),
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(_e.Input, {
				autoFocus: true,
				value: q,
				onValueChange: setQ,
				placeholder: "Jump to a Page, post, or destination…",
				className: "h-12 w-full border-b border-border bg-transparent px-4 text-sm outline-none"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(_e.List, {
				className: "max-h-[420px] overflow-auto p-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(_e.Empty, {
						className: "px-3 py-6 text-sm text-muted-foreground",
						children: "No matches."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(_e.Group, {
						heading: "Go",
						className: "text-[11px] font-semibold text-muted-foreground",
						children: [
							["/", "Pages home"],
							["/composer", "Composer"],
							["/drafts", "Drafts"],
							["/calendar", "Calendar"],
							["/inbox", "Inbox"],
							["/analytics", "Analytics"],
							["/media", "Media library"],
							["/merchandise", "Merchandise"],
							["/vault", "Token vault"],
							["/settings", "Settings"]
						].map(([path, label]) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(_e.Item, {
							value: `go ${label}`,
							onSelect: () => go(path),
							className: "flex cursor-pointer items-center rounded-md px-3 py-2 text-sm text-foreground aria-selected:bg-muted",
							children: label
						}, path))
					}),
					pages.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(_e.Group, {
						heading: "Pages",
						className: "text-[11px] font-semibold text-muted-foreground",
						children: pages.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(_e.Item, {
							value: `page ${p.name}`,
							onSelect: () => {
								setPage(p.id);
								go("/");
							},
							className: "flex cursor-pointer items-center rounded-md px-3 py-2 text-sm aria-selected:bg-muted",
							children: p.name
						}, p.id))
					}) : null,
					hits?.posts.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(_e.Item, {
						value: `post ${p.message ?? ""}`,
						onSelect: () => go("/drafts"),
						className: "flex cursor-pointer items-center rounded-md px-3 py-2 text-sm aria-selected:bg-muted",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "truncate",
							children: p.message || "(no caption)"
						})
					}, p.id))
				]
			})]
		})
	});
}
var NAV = [
	{
		to: "/",
		label: "Pages",
		icon: LayoutGrid
	},
	{
		to: "/composer",
		label: "Composer",
		icon: SquarePen
	},
	{
		to: "/drafts",
		label: "Drafts",
		icon: FileText
	},
	{
		to: "/calendar",
		label: "Calendar",
		icon: CalendarDays
	},
	{
		to: "/inbox",
		label: "Inbox",
		icon: Inbox
	},
	{
		to: "/analytics",
		label: "Analytics",
		icon: ChartColumn
	},
	{
		to: "/media",
		label: "Media",
		icon: Image
	},
	{
		to: "/merchandise",
		label: "Merchandise",
		icon: ShoppingBag
	},
	{
		to: "/vault",
		label: "Token vault",
		icon: KeyRound
	},
	{
		to: "/settings",
		label: "Settings",
		icon: Settings
	}
];
function AppShell({ children, right }) {
	const { user, isPending } = useCurrentUserState();
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const { selectedPageId, setSelectedPageId, setCommandOpen, theme, setTheme } = useShellStore();
	const [data, setData] = (0, import_react.useState)(null);
	const [railOpen, setRailOpen] = (0, import_react.useState)(false);
	const [query, setQuery] = (0, import_react.useState)("");
	(0, import_react.useEffect)(() => {
		if (!user) return;
		let cancelled = false;
		bootstrapApp().then((snap) => {
			if (cancelled) return;
			setData(snap);
			if (snap.settings.theme && snap.settings.theme !== theme) setTheme(snap.settings.theme);
			if (!selectedPageId) {
				const pick = snap.settings.defaultPageId ?? snap.pages[0]?.id ?? null;
				if (pick) setSelectedPageId(pick);
			}
		}).catch((e) => toast.error(e instanceof Error ? e.message : "Could not load workspace"));
		const t = window.setInterval(() => {
			tickFn().catch(() => void 0);
		}, 6e4);
		return () => {
			cancelled = true;
			window.clearInterval(t);
		};
	}, [user]);
	(0, import_react.useEffect)(() => {
		const onKey = (e) => {
			if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
				e.preventDefault();
				setCommandOpen(true);
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [setCommandOpen]);
	const pages = data?.pages ?? [];
	const selected = pages.find((p) => p.id === selectedPageId) ?? pages[0] ?? null;
	const filteredPages = (0, import_react.useMemo)(() => {
		const q = query.trim().toLowerCase();
		if (!q) return pages;
		return pages.filter((p) => p.name.toLowerCase().includes(q) || (p.category ?? "").toLowerCase().includes(q));
	}, [pages, query]);
	if (isPending) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex min-h-screen bg-background",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "hidden w-[280px] border-r border-border bg-rail p-4 md:block",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-8 w-36" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "mt-6 h-10 w-full" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-6 space-y-2",
					children: Array.from({ length: 8 }).map((_, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-9 w-full" }, i))
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex-1 p-6",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-10 w-64" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "mt-6 h-48 w-full" })]
		})]
	});
	const quotaPct = data?.quota?.call_count_pct;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex min-h-screen bg-background",
		children: [
			railOpen ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				className: "fixed inset-0 z-30 bg-foreground/30 md:hidden",
				"aria-label": "Close navigation",
				onClick: () => setRailOpen(false)
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
				className: cn("fixed inset-y-0 left-0 z-40 flex w-[280px] flex-col border-r border-border bg-rail md:static md:translate-x-0", railOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"),
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2 px-4 pt-4 pb-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BookBossMark, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-[15px] font-semibold leading-none",
							children: "BookBoss"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-0.5 text-[11px] text-muted-foreground",
							children: "Every Page. One desk."
						})] })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "px-3 pb-2",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "relative",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								value: query,
								onChange: (e) => setQuery(e.target.value),
								placeholder: "Search Pages",
								className: "h-9 bg-chip pl-8"
							})]
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ScrollArea, {
						className: "max-h-52 px-2",
						children: filteredPages.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "px-2 py-3 text-[13px] text-muted-foreground",
							children: pages.length === 0 ? "No Pages yet. Finish setup to import or practice." : "No match."
						}) : filteredPages.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageRowButton, {
							page: p,
							active: selected?.id === p.id,
							onClick: () => {
								setSelectedPageId(p.id);
								setRailOpen(false);
							}
						}, p.id))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
						className: "mt-2 flex-1 space-y-0.5 overflow-y-auto px-2 pb-4",
						children: NAV.map((item) => {
							const Icon = item.icon;
							const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
							const badge = item.to === "/inbox" && data && data.inboxCount > 0 ? data.inboxCount : null;
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
								to: item.to,
								onClick: () => setRailOpen(false),
								className: cn("flex h-10 items-center gap-3 rounded-md px-3 text-[14px] font-medium", active ? "bg-accent text-accent-foreground" : "text-foreground hover:bg-muted"),
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: "size-[18px]" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "flex-1",
										children: item.label
									}),
									badge ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "rounded-full bg-destructive px-1.5 text-[11px] font-semibold text-destructive-foreground tabular-nums",
										children: badge
									}) : null
								]
							}, item.to);
						})
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex min-w-0 flex-1 flex-col",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
					className: "flex h-14 items-center gap-3 border-b border-border bg-card px-3 md:px-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "ghost",
							size: "icon",
							className: "md:hidden",
							onClick: () => setRailOpen(true),
							"aria-label": "Open navigation",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Menu, { className: "size-5" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: () => setCommandOpen(true),
							className: "hidden min-w-0 flex-1 items-center gap-2 rounded-lg bg-chip px-3 py-2 text-left text-[13px] text-muted-foreground sm:flex",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "size-4" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "flex-1 truncate",
									children: "Search posts, comments, Pages"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("kbd", {
									className: "rounded-sm border border-border bg-card px-1.5 text-[11px]",
									children: "Ctrl+K"
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "ghost",
							size: "icon",
							className: "sm:hidden",
							onClick: () => setCommandOpen(true),
							"aria-label": "Search",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "size-5" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "hidden items-center gap-2 rounded-full bg-chip px-3 py-1.5 text-[12px] font-medium md:flex",
							title: "Graph usage from X-App-Usage / X-Business-Use-Case-Usage. Page tokens use Pages BUC (4800 × engaged users / 24h). There is no invented 100-posts/day Graph cap.",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "size-2 rounded-full bg-success" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-muted-foreground",
									children: "Quota"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "tabular-nums",
									children: quotaPct == null ? "—" : `${Math.round(quotaPct)}%`
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "ml-auto flex items-center gap-2",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(UserButton, {})
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex min-h-0 flex-1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
						className: "min-w-0 flex-1 overflow-auto p-3 md:p-4",
						children
					}), right ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("aside", {
						className: "hidden w-[320px] shrink-0 overflow-auto border-l border-border bg-card p-4 xl:block",
						children: right
					}) : null]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CommandPalette, {
				pages,
				onSearch: (q) => searchFn({ data: { q } })
			})
		]
	});
}
function PageRowButton({ page, active, onClick }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
		type: "button",
		onClick,
		className: cn("mb-0.5 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left", active ? "bg-accent" : "hover:bg-muted"),
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageAvatar, {
			id: page.id,
			name: page.name,
			size: 32
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
			className: "min-w-0 flex-1",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "block truncate text-[13px] font-semibold",
				children: page.name
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "block text-[11px] text-muted-foreground tabular-nums",
				children: [
					formatFanCount(page.fan_count),
					" likes",
					page.is_practice ? " · Practice" : "",
					page.is_read_only ? " · Analyze only" : ""
				]
			})]
		})]
	});
}
function BookBossMark({ size = 28 }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
		width: size,
		height: size,
		viewBox: "0 0 100 100",
		"aria-hidden": true,
		className: "shrink-0",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
			width: "100",
			height: "100",
			rx: "22",
			fill: "#1877F2"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
			d: "M28 22h22c12 0 20 7 20 18 0 7-4 13-11 16 9 3 14 10 14 18 0 13-10 20-24 20H28V22zm16 28h8c6 0 10-3 10-8s-4-8-10-8h-8v16zm0 12v16h10c7 0 12-3 12-9s-5-7-12-7h-10z",
			fill: "#fff"
		})]
	});
}
//#endregion
export { merchFn as A, useCurrentUserState as B, getSettingsFn as C, listPostsFn as D, listPagesFn as E, saveMerchFn as F, vaultFn as H, savePrefs as I, sendReplyFn as L, relativeTime as M, rescheduleFn as N, logsFn as O, saveFacebookApp as P, startPractice as R, generateVariantsFn as S, hideCommentFn as T, useShellStore as V, composeFn as _, PageAvatar as a, formatFanCount as b, analyticsFn as c, cadenceFn as d, calendarFn as f, completeSetup as g, commentsFn as h, Input as i, policyFn as j, mediaLibraryFn as k, beginFacebookOAuth as l, cn as m, BookBossMark as n, RedirectToSignIn as o, cancelPostFn as p, Button as r, Skeleton as s, AppShell as t, bootstrapApp as u, deleteMerchFn as v, hashtagsFn as w, generateReplyDraftsFn as x, exportCsvFn as y, updatePageVoiceFn as z };
