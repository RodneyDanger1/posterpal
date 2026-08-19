import { o as __toESM } from "../_runtime.mjs";
import { c as require_react, s as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { A as merchFn, E as listPagesFn, S as generateVariantsFn, V as useShellStore, _ as composeFn, d as cadenceFn, i as Input, j as policyFn, r as Button, w as hashtagsFn } from "./app-shell-Cg4ECP4f.mjs";
import { t as Guard } from "./guard-BudBk3vn.mjs";
import { n as CardContent, t as Card } from "./card-Bsxv0xqm.mjs";
import { n as validateReel } from "./policy-BrE_WUcI.mjs";
import { t as Label } from "./label-BF_kIDyZ.mjs";
import { t as Textarea } from "./textarea-BVZEn6W5.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/composer-C0IKruwx.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function ComposerPage() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Guard, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Composer, {}) });
}
function useComposerState() {
	const pageId = useShellStore((s) => s.selectedPageId);
	const [pages, setPages] = (0, import_react.useState)([]);
	const [message, setMessage] = (0, import_react.useState)("");
	const [link, setLink] = (0, import_react.useState)("");
	const [firstComment, setFirstComment] = (0, import_react.useState)("");
	const [mode, setMode] = (0, import_react.useState)("local-draft");
	const [when, setWhen] = (0, import_react.useState)("");
	const [mediaType, setMediaType] = (0, import_react.useState)("Text");
	const [media, setMedia] = (0, import_react.useState)([]);
	const [merch, setMerch] = (0, import_react.useState)([]);
	const [policy, setPolicy] = (0, import_react.useState)(null);
	const [cadence, setCadence] = (0, import_react.useState)(null);
	const [busy, setBusy] = (0, import_react.useState)(false);
	const [variants, setVariants] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		listPagesFn().then(setPages);
	}, []);
	const selected = pages.find((p) => p.id === pageId) ?? pages[0];
	(0, import_react.useEffect)(() => {
		if (!selected) return;
		merchFn({ data: { pageId: selected.id } }).then(setMerch);
		cadenceFn({ data: { pageId: selected.id } }).then(setCadence);
	}, [selected?.id]);
	(0, import_react.useEffect)(() => {
		if (!selected) return;
		const t = window.setTimeout(() => {
			policyFn({ data: {
				pageId: selected.id,
				message,
				link: link || null,
				merchUrl: merch[0]?.url ?? null,
				hasImages: media.length > 0,
				missingAlt: media.some((m) => !m.altText.trim()),
				createdWithAi: media.some((m) => m.createdWithAi)
			} }).then(setPolicy);
		}, 250);
		return () => window.clearTimeout(t);
	}, [
		message,
		link,
		media,
		merch,
		selected?.id
	]);
	return {
		pages,
		selected,
		message,
		setMessage,
		link,
		setLink,
		firstComment,
		setFirstComment,
		mode,
		setMode,
		when,
		setWhen,
		mediaType,
		setMediaType,
		media,
		setMedia,
		merch,
		policy,
		cadence,
		busy,
		setBusy,
		variants,
		setVariants
	};
}
function Composer() {
	const s = useComposerState();
	(0, import_react.useEffect)(() => {
		const onKey = (e) => {
			if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
				e.preventDefault();
				submit(s, s.mode === "local-draft" ? "now" : s.mode);
			}
			if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
				e.preventDefault();
				submit(s, "local-draft");
			}
			if (e.key === "Escape") {
				s.setMessage("");
				s.setMedia([]);
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	});
	if (!s.selected) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "text-sm text-muted-foreground",
		children: "Add a Page in setup first."
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mx-auto w-full max-w-3xl space-y-4 xl:mx-0",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex flex-wrap items-end justify-between gap-2",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "text-xl font-semibold",
						children: "Composer"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-[13px] text-muted-foreground",
						children: [
							s.selected.name,
							s.selected.is_read_only ? " · analyze-only" : "",
							" · Ctrl+Enter publish · Ctrl+S draft · Esc clear"
						]
					})] })
				}),
				s.cadence?.level !== "ok" && s.cadence ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: `rounded-lg px-3 py-2 text-sm ${s.cadence.level === "block" ? "bg-destructive/10 text-destructive" : "bg-warning/20"}`,
					children: [
						s.cadence.postedLast24h,
						" posts in 24h (warn ",
						s.cadence.warnAt,
						", block ",
						s.cadence.blockAt,
						"). Identical high-frequency posts are a spam risk."
					]
				}) : null,
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(CardContent, {
					className: "space-y-3 pt-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex flex-wrap gap-1",
							children: [
								"Text",
								"Photo",
								"Carousel",
								"Video",
								"Reel",
								"Story"
							].map((k) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								size: "sm",
								variant: s.mediaType === k ? "default" : "outline",
								onClick: () => s.setMediaType(k),
								children: k
							}, k))
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
							value: s.message,
							onChange: (e) => s.setMessage(e.target.value),
							placeholder: "Write the caption…",
							className: "min-h-40 text-[15px]"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid gap-3 sm:grid-cols-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "space-y-1.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Link" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									value: s.link,
									onChange: (e) => s.setLink(e.target.value),
									placeholder: "https://"
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "space-y-1.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "First comment (stored locally; posted after publish if the API allows)" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									value: s.firstComment,
									onChange: (e) => s.setFirstComment(e.target.value)
								})]
							})]
						}),
						s.merch.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex flex-wrap gap-2",
							children: s.merch.map((m) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
								size: "sm",
								variant: "outline",
								onClick: () => {
									s.setLink(applyUtm(m.url, m.utm_template));
									if (m.cta_override) s.setMessage((prev) => prev ? `${prev}\n\n${m.cta_override}` : m.cta_override);
									toast.message("Merch CTA inserted. Add a branded-content disclosure if this is commercial.");
								},
								children: ["Insert ", m.title]
							}, m.id))
						}) : null,
						s.mediaType !== "Text" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MediaDrop, {
							media: s.media,
							setMedia: s.setMedia,
							mediaType: s.mediaType
						}) : null,
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap items-center gap-2",
							children: [[
								"now",
								"schedule",
								"local-draft",
								"fb-draft"
							].map((m) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								size: "sm",
								variant: s.mode === m ? "default" : "secondary",
								onClick: () => s.setMode(m),
								children: m === "now" ? "Publish now" : m === "schedule" ? "Schedule" : m === "local-draft" ? "Local draft" : "Facebook draft"
							}, m)), s.mode === "schedule" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								type: "datetime-local",
								className: "w-auto",
								value: s.when,
								onChange: (e) => s.setWhen(e.target.value)
							}) : null]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap gap-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									disabled: s.busy || s.cadence?.level === "block",
									onClick: () => void submit(s, s.mode),
									children: s.busy ? "Working…" : "Send"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									variant: "outline",
									disabled: s.busy || !s.message.trim(),
									onClick: () => {
										s.setBusy(true);
										generateVariantsFn({ data: {
											pageId: s.selected.id,
											brief: s.message,
											merchCta: s.merch[0]?.cta_override
										} }).then((v) => {
											s.setVariants(v);
											if (!v.ai) toast.message("AI key not available — showing local variants. Add nothing; Grok is used when present.");
										}).catch((e) => toast.error(e instanceof Error ? e.message : "Variant failed")).finally(() => s.setBusy(false));
									},
									children: "3 variants"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									variant: "outline",
									disabled: s.busy || !s.message.trim(),
									onClick: () => {
										hashtagsFn({ data: {
											pageId: s.selected.id,
											caption: s.message
										} }).then((r) => {
											s.setMessage((m) => `${m.trim()} ${r.tags.join(" ")}`.trim());
										}).catch((e) => toast.error(e instanceof Error ? e.message : "Hashtags failed"));
									},
									children: "Hashtags"
								})
							]
						}),
						s.variants ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "grid gap-2",
							children: [
								["Storytelling", s.variants.storytelling],
								["Direct CTA", s.variants.cta],
								["Question", s.variants.question]
							].map(([label, text]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								className: "rounded-lg border border-border p-3 text-left text-sm hover:bg-muted",
								onClick: () => s.setMessage(text),
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-[11px] font-semibold text-muted-foreground",
									children: label
								}), text]
							}, label))
						}) : null
					]
				}) })
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
			className: "rounded-xl bg-card p-4 shadow-card xl:sticky xl:top-4",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "text-[13px] font-semibold",
					children: "Policy checklist"
				}),
				!s.policy ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-[13px] text-muted-foreground",
					children: "Flags appear as you write."
				}) : s.policy.flags.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-[13px] text-success",
					children: "Clear to publish."
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "mt-2 space-y-2",
					children: s.policy.flags.map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "text-[13px]",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-semibold",
							children: f.title
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "mt-0.5 block text-muted-foreground",
							children: f.detail
						})]
					}, f.id))
				}),
				s.policy && s.policy.similar.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "mt-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "text-[13px] font-semibold",
						children: "Similar past posts"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "mt-2 space-y-2",
						children: s.policy.similar.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: "text-[13px]",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "tabular-nums text-muted-foreground",
								children: [
									Math.round(p.score * 100),
									"% · ",
									p.engagement,
									" eng"
								]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "mt-0.5 line-clamp-3 block",
								children: p.message
							})]
						}, p.id))
					})]
				}) : null,
				s.cadence ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "mt-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "text-[13px] font-semibold",
						children: "Cadence"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-1 text-[13px] text-muted-foreground tabular-nums",
						children: [
							s.cadence.postedLast24h,
							" / warn ",
							s.cadence.warnAt,
							" / block ",
							s.cadence.blockAt,
							" in 24h"
						]
					})]
				}) : null
			]
		})]
	});
}
async function submit(s, mode) {
	if (!s.selected) return;
	if (s.policy && !s.policy.canPublish && mode !== "local-draft") {
		toast.error("Policy checklist blocked this publish. Fix the blocking flags or save a local draft.");
		return;
	}
	if (s.cadence?.level === "block" && mode !== "local-draft") {
		toast.error("Cadence hard cap reached.");
		return;
	}
	s.setBusy(true);
	try {
		const scheduledAt = s.when ? new Date(s.when).toISOString() : null;
		const result = await composeFn({ data: {
			pageId: s.selected.id,
			message: s.message,
			link: s.link || null,
			firstComment: s.firstComment || null,
			mediaType: s.mediaType,
			mode,
			scheduledAt,
			merchUrl: s.merch[0]?.url ?? null,
			media: s.media,
			variantLabel: void 0
		} });
		toast.success(`${result.status}${result.warning ? " — " + result.warning : ""}`);
		if (mode !== "local-draft") {
			s.setMessage("");
			s.setMedia([]);
		}
	} catch (e) {
		toast.error(e instanceof Error ? e.message : "Publish failed");
	} finally {
		s.setBusy(false);
	}
}
function applyUtm(url, template) {
	if (!template) return url;
	const u = new URL(url, "https://example.invalid");
	for (const part of template.split("&")) {
		const [k, v] = part.split("=");
		if (k) u.searchParams.set(k, (v ?? "").replace("{slug}", "post"));
	}
	return u.toString();
}
function MediaDrop({ media, setMedia, mediaType }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-lg border border-dashed border-input p-4",
		onDragOver: (e) => e.preventDefault(),
		onDrop: (e) => {
			e.preventDefault();
			ingestFiles(Array.from(e.dataTransfer.files), media, setMedia, mediaType);
		},
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Label, {
				className: "block cursor-pointer",
				children: ["Drop media or browse", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					type: "file",
					className: "sr-only",
					accept: mediaType === "Video" || mediaType === "Reel" ? "video/*,image/*" : "image/*",
					multiple: mediaType === "Carousel",
					onChange: (e) => {
						ingestFiles(Array.from(e.target.files ?? []), media, setMedia, mediaType);
						e.target.value = "";
					}
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-[12px] text-muted-foreground",
				children: "Reels: 9:16, 3–60s, min 540×960. Photos stored locally for drafts; remote URLs used for Graph when present."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-3 space-y-2",
				children: media.map((m, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "flex items-start gap-2 text-sm",
					children: [
						m.mimeType.startsWith("image") && m.dataUrl.startsWith("data:image") ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
							src: m.dataUrl,
							alt: "",
							className: "size-12 rounded-md object-cover"
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "grid size-12 place-items-center rounded-md bg-muted text-[11px]",
							children: "file"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "min-w-0 flex-1",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "truncate",
								children: m.fileName
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								className: "mt-1 h-8",
								placeholder: "Alt text",
								value: m.altText,
								onChange: (e) => {
									const next = media.slice();
									next[i] = {
										...m,
										altText: e.target.value
									};
									setMedia(next);
								}
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							size: "sm",
							variant: "ghost",
							onClick: () => setMedia(media.filter((_, j) => j !== i)),
							children: "Remove"
						})
					]
				}, i))
			})
		]
	});
}
async function ingestFiles(files, current, setMedia, mediaType) {
	const next = [...current];
	for (const file of files) {
		if (file.size > 5e6) {
			toast.error(`${file.name} is over 5MB. Use a URL in production or compress.`);
			continue;
		}
		const dataUrl = await readDataUrl(file);
		const meta = await probeMedia(file, dataUrl);
		if (mediaType === "Reel") {
			const err = validateReel(meta);
			if (err) {
				toast.error(err);
				continue;
			}
		}
		next.push({
			fileName: file.name,
			mimeType: file.type,
			dataUrl,
			width: meta.width,
			height: meta.height,
			durationMs: meta.durationMs,
			altText: "",
			createdWithAi: false
		});
	}
	setMedia(next);
}
function readDataUrl(file) {
	return new Promise((resolve, reject) => {
		const r = new FileReader();
		r.onload = () => resolve(String(r.result));
		r.onerror = () => reject(r.error);
		r.readAsDataURL(file);
	});
}
function probeMedia(file, dataUrl) {
	return new Promise((resolve) => {
		if (file.type.startsWith("image/")) {
			const img = new Image();
			img.onload = () => resolve({
				width: img.naturalWidth,
				height: img.naturalHeight
			});
			img.onerror = () => resolve({});
			img.src = dataUrl;
			return;
		}
		if (file.type.startsWith("video/")) {
			const v = document.createElement("video");
			v.preload = "metadata";
			v.onloadedmetadata = () => {
				resolve({
					width: v.videoWidth,
					height: v.videoHeight,
					durationMs: Math.round((v.duration || 0) * 1e3)
				});
			};
			v.onerror = () => resolve({});
			v.src = dataUrl;
			return;
		}
		resolve({});
	});
}
//#endregion
export { ComposerPage as component };
