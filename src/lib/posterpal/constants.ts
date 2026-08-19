export const GRAPH_VERSION = "v26.0";
export const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;
export const RUPLOAD_BASE = "https://rupload.facebook.com";
export const OAUTH_DIALOG = `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`;
export const LOOPBACK_REDIRECT = "http://127.0.0.1:55443/callback/";

export const REQUIRED_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "pages_manage_engagement",
  "pages_read_user_content",
  "pages_manage_metadata",
  "read_insights",
  "publish_video",
] as const;
