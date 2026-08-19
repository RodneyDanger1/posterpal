import { i as createServerFn, t as TSS_SERVER_FUNCTION } from "./ssr.mjs";
import { t as authMiddleware } from "./middleware-nfuoPv-U.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/fns-BLF7LtZb.js
var createServerRpc = (serverFnMeta, splitImportFn) => {
	const url = "/_serverFn/" + serverFnMeta.id;
	return Object.assign(splitImportFn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
var bootstrapApp_createServerFn_handler = createServerRpc({
	id: "f09da5c83013ee7ecb017568a31b69a12726f09279fd6867a4110756a970eb0d",
	name: "bootstrapApp",
	filename: "src/lib/bookboss/fns.ts"
}, (opts) => bootstrapApp.__executeServer(opts));
var bootstrapApp = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(bootstrapApp_createServerFn_handler, async ({ context }) => {
	return (await import("./ops-omSMy2j5.mjs")).bootstrapApp(context.userId);
});
var getSettingsFn_createServerFn_handler = createServerRpc({
	id: "0580bb890321da4d8e54b982b67f3cddcc95c6ae232f5a24baee56f88117990b",
	name: "getSettingsFn",
	filename: "src/lib/bookboss/fns.ts"
}, (opts) => getSettingsFn.__executeServer(opts));
var getSettingsFn = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(getSettingsFn_createServerFn_handler, async ({ context }) => {
	return (await import("./ops-omSMy2j5.mjs")).getSettings(context.userId);
});
var saveFacebookApp_createServerFn_handler = createServerRpc({
	id: "b551655a07afcad0bb30c88862af7edca4a4f238116fef8ac9c27584e89926f6",
	name: "saveFacebookApp",
	filename: "src/lib/bookboss/fns.ts"
}, (opts) => saveFacebookApp.__executeServer(opts));
var saveFacebookApp = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((d) => d).handler(saveFacebookApp_createServerFn_handler, async ({ context, data }) => {
	return (await import("./ops-omSMy2j5.mjs")).saveFacebookApp(context.userId, data);
});
var savePrefs_createServerFn_handler = createServerRpc({
	id: "a98e5ded0dc02c9677dea9b968a91af9047c460c190baaf0d8e86a96de82963d",
	name: "savePrefs",
	filename: "src/lib/bookboss/fns.ts"
}, (opts) => savePrefs.__executeServer(opts));
var savePrefs = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((d) => d).handler(savePrefs_createServerFn_handler, async ({ context, data }) => {
	return (await import("./ops-omSMy2j5.mjs")).savePrefs(context.userId, data);
});
var completeSetup_createServerFn_handler = createServerRpc({
	id: "ec64c401dc6818bad4f27a783f0def0b35e9b51c1c850081480cf8c80abc4e60",
	name: "completeSetup",
	filename: "src/lib/bookboss/fns.ts"
}, (opts) => completeSetup.__executeServer(opts));
var completeSetup = createServerFn({ method: "POST" }).middleware([authMiddleware]).handler(completeSetup_createServerFn_handler, async ({ context }) => {
	return (await import("./ops-omSMy2j5.mjs")).completeSetup(context.userId);
});
var startPractice_createServerFn_handler = createServerRpc({
	id: "4fef2d2abdd97d907010feb84f7b0ebaf40d8d0790a2099819cf2441ba913af3",
	name: "startPractice",
	filename: "src/lib/bookboss/fns.ts"
}, (opts) => startPractice.__executeServer(opts));
var startPractice = createServerFn({ method: "POST" }).middleware([authMiddleware]).handler(startPractice_createServerFn_handler, async ({ context }) => {
	return (await import("./ops-omSMy2j5.mjs")).startPractice(context.userId);
});
var beginFacebookOAuth_createServerFn_handler = createServerRpc({
	id: "489af1dacd746435e9efe85f7c29d4a343f35a0136de00d764b582f4c3b13598",
	name: "beginFacebookOAuth",
	filename: "src/lib/bookboss/fns.ts"
}, (opts) => beginFacebookOAuth.__executeServer(opts));
var beginFacebookOAuth = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((d) => d).handler(beginFacebookOAuth_createServerFn_handler, async ({ context, data }) => {
	return (await import("./ops-omSMy2j5.mjs")).beginFacebookOAuth(context.userId, data.redirectUri);
});
var listPagesFn_createServerFn_handler = createServerRpc({
	id: "1d3977c182845211c56773f5f09b3ef2ac09f6b14610d36dc72007c528fd9988",
	name: "listPagesFn",
	filename: "src/lib/bookboss/fns.ts"
}, (opts) => listPagesFn.__executeServer(opts));
var listPagesFn = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(listPagesFn_createServerFn_handler, async ({ context }) => {
	return (await import("./ops-omSMy2j5.mjs")).listPages(context.userId);
});
var listPostsFn_createServerFn_handler = createServerRpc({
	id: "5da1ecf50df589f88e1080b492c0c2de4d186332d261e386a07458ff7a64efa3",
	name: "listPostsFn",
	filename: "src/lib/bookboss/fns.ts"
}, (opts) => listPostsFn.__executeServer(opts));
var listPostsFn = createServerFn({ method: "GET" }).middleware([authMiddleware]).validator((d) => d).handler(listPostsFn_createServerFn_handler, async ({ context, data }) => {
	return (await import("./ops-omSMy2j5.mjs")).listPosts(context.userId, data);
});
var getPostBundle_createServerFn_handler = createServerRpc({
	id: "44a9aa4100793213c6af3d1560f828c615b64ad6095b0d19cb3cc18e44c8df92",
	name: "getPostBundle",
	filename: "src/lib/bookboss/fns.ts"
}, (opts) => getPostBundle.__executeServer(opts));
var getPostBundle = createServerFn({ method: "GET" }).middleware([authMiddleware]).validator((d) => d).handler(getPostBundle_createServerFn_handler, async ({ context, data }) => {
	return (await import("./ops-omSMy2j5.mjs")).getPostBundle(context.userId, data.postId);
});
var cadenceFn_createServerFn_handler = createServerRpc({
	id: "887e40d64d7307d65d76aeec062b7d46c0a361207cf8a4e604f44d0757f57abd",
	name: "cadenceFn",
	filename: "src/lib/bookboss/fns.ts"
}, (opts) => cadenceFn.__executeServer(opts));
var cadenceFn = createServerFn({ method: "GET" }).middleware([authMiddleware]).validator((d) => d).handler(cadenceFn_createServerFn_handler, async ({ context, data }) => {
	return (await import("./ops-omSMy2j5.mjs")).cadence(context.userId, data.pageId);
});
var policyFn_createServerFn_handler = createServerRpc({
	id: "c0172c2544b382857109e2d257f1329c09df486431f1c52f198c5744fd4bfae4",
	name: "policyFn",
	filename: "src/lib/bookboss/fns.ts"
}, (opts) => policyFn.__executeServer(opts));
var policyFn = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((d) => d).handler(policyFn_createServerFn_handler, async ({ context, data }) => {
	return (await import("./ops-omSMy2j5.mjs")).policy(context.userId, data);
});
var composeFn_createServerFn_handler = createServerRpc({
	id: "fea208b6d444b4f8c7225499766509a652bfbcbb078e5ec4aff149635515b68f",
	name: "composeFn",
	filename: "src/lib/bookboss/fns.ts"
}, (opts) => composeFn.__executeServer(opts));
var composeFn = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((d) => d).handler(composeFn_createServerFn_handler, async ({ context, data }) => {
	return (await import("./ops-omSMy2j5.mjs")).compose(context.userId, data);
});
var rescheduleFn_createServerFn_handler = createServerRpc({
	id: "c4fb2cb27721b6b9bf6fe087d6d41bdb069cccddc8e1ebf7fa1d8f73747aa44d",
	name: "rescheduleFn",
	filename: "src/lib/bookboss/fns.ts"
}, (opts) => rescheduleFn.__executeServer(opts));
var rescheduleFn = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((d) => d).handler(rescheduleFn_createServerFn_handler, async ({ context, data }) => {
	return (await import("./ops-omSMy2j5.mjs")).reschedule(context.userId, data);
});
var cancelPostFn_createServerFn_handler = createServerRpc({
	id: "d4e46519a5b05cd89bea4ac8de5e624382db1d4c1a6c733913c4365f6dd78538",
	name: "cancelPostFn",
	filename: "src/lib/bookboss/fns.ts"
}, (opts) => cancelPostFn.__executeServer(opts));
var cancelPostFn = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((d) => d).handler(cancelPostFn_createServerFn_handler, async ({ context, data }) => {
	return (await import("./ops-omSMy2j5.mjs")).cancelPost(context.userId, data.postId);
});
var commentsFn_createServerFn_handler = createServerRpc({
	id: "33098acbf6d39dc136644cf3aa0712ce53c1752b709425cc7d39da8792166af9",
	name: "commentsFn",
	filename: "src/lib/bookboss/fns.ts"
}, (opts) => commentsFn.__executeServer(opts));
var commentsFn = createServerFn({ method: "GET" }).middleware([authMiddleware]).validator((d) => d).handler(commentsFn_createServerFn_handler, async ({ context, data }) => {
	return (await import("./ops-omSMy2j5.mjs")).comments(context.userId, data.filter, data.pageId);
});
var hideCommentFn_createServerFn_handler = createServerRpc({
	id: "32c1efc0d9d202129d41b50d8dd1db1257695559175cf7c32e4af8647b84bc88",
	name: "hideCommentFn",
	filename: "src/lib/bookboss/fns.ts"
}, (opts) => hideCommentFn.__executeServer(opts));
var hideCommentFn = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((d) => d).handler(hideCommentFn_createServerFn_handler, async ({ context, data }) => {
	return (await import("./ops-omSMy2j5.mjs")).hideComment(context.userId, data);
});
var sendReplyFn_createServerFn_handler = createServerRpc({
	id: "82db74f32e69a42b6b0b0932f15716f3f5f78fad1ea3be79bf07b2d5681321a1",
	name: "sendReplyFn",
	filename: "src/lib/bookboss/fns.ts"
}, (opts) => sendReplyFn.__executeServer(opts));
var sendReplyFn = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((d) => d).handler(sendReplyFn_createServerFn_handler, async ({ context, data }) => {
	return (await import("./ops-omSMy2j5.mjs")).sendReply(context.userId, data);
});
var generateReplyDraftsFn_createServerFn_handler = createServerRpc({
	id: "a637e0b6f5e17c80a75f53dd23ecf172ad78c4a8dd293277ccfd574a165037ad",
	name: "generateReplyDraftsFn",
	filename: "src/lib/bookboss/fns.ts"
}, (opts) => generateReplyDraftsFn.__executeServer(opts));
var generateReplyDraftsFn = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((d) => d).handler(generateReplyDraftsFn_createServerFn_handler, async ({ context, data }) => {
	return (await import("./ops-omSMy2j5.mjs")).generateReplyDrafts(context.userId, data.commentId);
});
var merchFn_createServerFn_handler = createServerRpc({
	id: "9c7b53baf14acfecf3e6d45203f4ae6da6679fa6aeb479b6a8b827d6aba745c1",
	name: "merchFn",
	filename: "src/lib/bookboss/fns.ts"
}, (opts) => merchFn.__executeServer(opts));
var merchFn = createServerFn({ method: "GET" }).middleware([authMiddleware]).validator((d = {}) => d).handler(merchFn_createServerFn_handler, async ({ context, data }) => {
	return (await import("./ops-omSMy2j5.mjs")).merch(context.userId, data.pageId);
});
var saveMerchFn_createServerFn_handler = createServerRpc({
	id: "af9c9107d566596341e2601dd1264475e27cb7dc17e582f8fdf6fd268b98605d",
	name: "saveMerchFn",
	filename: "src/lib/bookboss/fns.ts"
}, (opts) => saveMerchFn.__executeServer(opts));
var saveMerchFn = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((d) => d).handler(saveMerchFn_createServerFn_handler, async ({ context, data }) => {
	return (await import("./ops-omSMy2j5.mjs")).saveMerch(context.userId, data);
});
var deleteMerchFn_createServerFn_handler = createServerRpc({
	id: "796155597e90e3ee01cf86838c13bf2377f19f5bc979c3480049dcdb25666d65",
	name: "deleteMerchFn",
	filename: "src/lib/bookboss/fns.ts"
}, (opts) => deleteMerchFn.__executeServer(opts));
var deleteMerchFn = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((d) => d).handler(deleteMerchFn_createServerFn_handler, async ({ context, data }) => {
	return (await import("./ops-omSMy2j5.mjs")).deleteMerch(context.userId, data.id);
});
var vaultFn_createServerFn_handler = createServerRpc({
	id: "9ad8fc2b19ce93ff1843fd0b1cc893f03d21a0cb412d092434f8186ca640ae51",
	name: "vaultFn",
	filename: "src/lib/bookboss/fns.ts"
}, (opts) => vaultFn.__executeServer(opts));
var vaultFn = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(vaultFn_createServerFn_handler, async ({ context }) => {
	return (await import("./ops-omSMy2j5.mjs")).vault(context.userId);
});
var logsFn_createServerFn_handler = createServerRpc({
	id: "1e268868072d54527652e1fd9294e58e670917faa078d79601ab4bf98e325a03",
	name: "logsFn",
	filename: "src/lib/bookboss/fns.ts"
}, (opts) => logsFn.__executeServer(opts));
var logsFn = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(logsFn_createServerFn_handler, async ({ context }) => {
	return (await import("./ops-omSMy2j5.mjs")).logs(context.userId);
});
var searchFn_createServerFn_handler = createServerRpc({
	id: "5f6d3a28887b4b341e9717c6bee15f071ba9a8ebdf0b82ee483491b62fb7d5f7",
	name: "searchFn",
	filename: "src/lib/bookboss/fns.ts"
}, (opts) => searchFn.__executeServer(opts));
var searchFn = createServerFn({ method: "GET" }).middleware([authMiddleware]).validator((d) => d).handler(searchFn_createServerFn_handler, async ({ context, data }) => {
	return (await import("./ops-omSMy2j5.mjs")).search(context.userId, data.q);
});
var analyticsFn_createServerFn_handler = createServerRpc({
	id: "4b0cd3c75cd692eb8cee23197fe1c8344f71fdcb6bc29210f9d5d4fb9abe1e5e",
	name: "analyticsFn",
	filename: "src/lib/bookboss/fns.ts"
}, (opts) => analyticsFn.__executeServer(opts));
var analyticsFn = createServerFn({ method: "GET" }).middleware([authMiddleware]).validator((d) => d).handler(analyticsFn_createServerFn_handler, async ({ context, data }) => {
	return (await import("./ops-omSMy2j5.mjs")).analytics(context.userId, data);
});
var mediaLibraryFn_createServerFn_handler = createServerRpc({
	id: "a3e59aa91c7e05da42619dfc4dadaefbef31ab5fc51bb175ded9d75026248a8f",
	name: "mediaLibraryFn",
	filename: "src/lib/bookboss/fns.ts"
}, (opts) => mediaLibraryFn.__executeServer(opts));
var mediaLibraryFn = createServerFn({ method: "GET" }).middleware([authMiddleware]).validator((d = {}) => d).handler(mediaLibraryFn_createServerFn_handler, async ({ context, data }) => {
	return (await import("./ops-omSMy2j5.mjs")).mediaLibrary(context.userId, data.pageId);
});
var generateVariantsFn_createServerFn_handler = createServerRpc({
	id: "4039e4c05ec5b11df05aee1092c64e5b3b47aeed8046999a675d8e2ee6aacdc2",
	name: "generateVariantsFn",
	filename: "src/lib/bookboss/fns.ts"
}, (opts) => generateVariantsFn.__executeServer(opts));
var generateVariantsFn = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((d) => d).handler(generateVariantsFn_createServerFn_handler, async ({ context, data }) => {
	return (await import("./ops-omSMy2j5.mjs")).generateVariants(context.userId, data);
});
var hashtagsFn_createServerFn_handler = createServerRpc({
	id: "b7967ccb5dfae1e3f82c21961cb1c39c507c92a87651e1ed99264aaf8228f499",
	name: "hashtagsFn",
	filename: "src/lib/bookboss/fns.ts"
}, (opts) => hashtagsFn.__executeServer(opts));
var hashtagsFn = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((d) => d).handler(hashtagsFn_createServerFn_handler, async ({ context, data }) => {
	return (await import("./ops-omSMy2j5.mjs")).hashtags(context.userId, data);
});
var analyzeFn_createServerFn_handler = createServerRpc({
	id: "1cbedc570b88a6a3eff41fa3d5d85bb4ce64576227c4ed53a3eac29547d2a654",
	name: "analyzeFn",
	filename: "src/lib/bookboss/fns.ts"
}, (opts) => analyzeFn.__executeServer(opts));
var analyzeFn = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((d) => d).handler(analyzeFn_createServerFn_handler, async ({ context, data }) => {
	return (await import("./ops-omSMy2j5.mjs")).analyze(data.content);
});
var updatePageVoiceFn_createServerFn_handler = createServerRpc({
	id: "4cca22317f9bd5e178cadb437e54c40028db2c2173315dfbf8a4135f354dda62",
	name: "updatePageVoiceFn",
	filename: "src/lib/bookboss/fns.ts"
}, (opts) => updatePageVoiceFn.__executeServer(opts));
var updatePageVoiceFn = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((d) => d).handler(updatePageVoiceFn_createServerFn_handler, async ({ context, data }) => {
	return (await import("./ops-omSMy2j5.mjs")).updatePageVoice(context.userId, data);
});
var exportCsvFn_createServerFn_handler = createServerRpc({
	id: "cdfb0cc629ca1283cadc9ef6dac3d0e0f82cd2943cade75999d5d2a95200083f",
	name: "exportCsvFn",
	filename: "src/lib/bookboss/fns.ts"
}, (opts) => exportCsvFn.__executeServer(opts));
var exportCsvFn = createServerFn({ method: "GET" }).middleware([authMiddleware]).validator((d) => d).handler(exportCsvFn_createServerFn_handler, async ({ context, data }) => {
	return (await import("./ops-omSMy2j5.mjs")).exportCsv(context.userId, data);
});
var tickFn_createServerFn_handler = createServerRpc({
	id: "4e573092f755d8cf5362fe25617290ccc1f8d941910d4e54514f386e22a402c4",
	name: "tickFn",
	filename: "src/lib/bookboss/fns.ts"
}, (opts) => tickFn.__executeServer(opts));
var tickFn = createServerFn({ method: "POST" }).middleware([authMiddleware]).handler(tickFn_createServerFn_handler, async ({ context }) => {
	return (await import("./ops-omSMy2j5.mjs")).tick(context.userId);
});
var calendarFn_createServerFn_handler = createServerRpc({
	id: "f964b8af51e13786be324d7fa4945697468861261e51dae9a3a22fc1b58291b9",
	name: "calendarFn",
	filename: "src/lib/bookboss/fns.ts"
}, (opts) => calendarFn.__executeServer(opts));
var calendarFn = createServerFn({ method: "GET" }).middleware([authMiddleware]).validator((d = {}) => d).handler(calendarFn_createServerFn_handler, async ({ context, data }) => {
	return (await import("./ops-omSMy2j5.mjs")).calendar(context.userId, data.pageId);
});
//#endregion
export { analyticsFn_createServerFn_handler, analyzeFn_createServerFn_handler, beginFacebookOAuth_createServerFn_handler, bootstrapApp_createServerFn_handler, cadenceFn_createServerFn_handler, calendarFn_createServerFn_handler, cancelPostFn_createServerFn_handler, commentsFn_createServerFn_handler, completeSetup_createServerFn_handler, composeFn_createServerFn_handler, deleteMerchFn_createServerFn_handler, exportCsvFn_createServerFn_handler, generateReplyDraftsFn_createServerFn_handler, generateVariantsFn_createServerFn_handler, getPostBundle_createServerFn_handler, getSettingsFn_createServerFn_handler, hashtagsFn_createServerFn_handler, hideCommentFn_createServerFn_handler, listPagesFn_createServerFn_handler, listPostsFn_createServerFn_handler, logsFn_createServerFn_handler, mediaLibraryFn_createServerFn_handler, merchFn_createServerFn_handler, policyFn_createServerFn_handler, rescheduleFn_createServerFn_handler, saveFacebookApp_createServerFn_handler, saveMerchFn_createServerFn_handler, savePrefs_createServerFn_handler, searchFn_createServerFn_handler, sendReplyFn_createServerFn_handler, startPractice_createServerFn_handler, tickFn_createServerFn_handler, updatePageVoiceFn_createServerFn_handler, vaultFn_createServerFn_handler };
