export const MEDIA_TYPES = ["Text", "Photo", "Carousel", "Video", "Reel", "Story"] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];

export const POST_STATUSES = [
  "LocalDraft",
  "FacebookDraft",
  "LocalScheduled",
  "FacebookScheduled",
  "Publishing",
  "Published",
  "Failed",
  "Cancelled",
] as const;
export type PostStatus = (typeof POST_STATUSES)[number];

export const SENTIMENTS = ["positive", "neutral", "negative", "question"] as const;
export type Sentiment = (typeof SENTIMENTS)[number];

export type PageRow = {
  id: string;
  user_id: string;
  facebook_page_id: string | null;
  name: string;
  category: string | null;
  fan_count: number;
  tasks_json: string | null;
  is_active: boolean;
  is_read_only: boolean;
  is_practice: boolean;
  ai_provider: string | null;
  ai_model: string | null;
  brand_voice: string | null;
  cadence_warn_per_24h: number;
  cadence_block_per_24h: number;
  created_at: string;
  updated_at: string;
  has_token: boolean;
};

export type PostRow = {
  id: string;
  user_id: string;
  page_id: string;
  facebook_post_id: string | null;
  message: string | null;
  link: string | null;
  first_comment: string | null;
  media_type: MediaType;
  status: PostStatus;
  scheduled_publish_time: string | null;
  published_time: string | null;
  created_by_this_app: boolean;
  ai_variant_label: string | null;
  variant_group_id: string | null;
  engagement_score: number | null;
  reactions_count: number;
  comments_count: number;
  shares_count: number;
  media_view_unique: number | null;
  last_insights_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  page_name?: string;
};

export type ContentItemRow = {
  id: string;
  post_id: string;
  file_name: string;
  mime_type: string | null;
  media_kind: string;
  file_size: number | null;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
  alt_text: string | null;
  data_url: string | null;
  sort_order: number;
  created_with_ai: boolean;
};

export type CommentRow = {
  id: string;
  facebook_comment_id: string | null;
  post_id: string;
  message: string;
  author_name: string | null;
  author_id: string | null;
  sentiment: Sentiment | null;
  needs_reply: boolean;
  reply_drafts_json: string | null;
  is_hidden: boolean;
  is_from_page: boolean;
  created_at: string;
  post_message?: string | null;
  page_name?: string;
};

export type MerchRow = {
  id: string;
  page_id: string;
  title: string;
  url: string;
  platform: string | null;
  utm_template: string | null;
  cta_override: string | null;
  created_at: string;
};

export type VaultRow = {
  id: string;
  name: string;
  expires_at: string | null;
  data_access_expires_at: string | null;
  scopes: string | null;
  last_validated_at: string | null;
  is_valid: boolean;
  created_at: string;
  has_token: boolean;
};

export type QuotaRow = {
  id: string;
  page_id: string | null;
  source_header: string | null;
  call_count_pct: number | null;
  estimated_regain_minutes: number | null;
  captured_at: string;
};

export type SchedulerLogRow = {
  id: string;
  post_id: string | null;
  attempt_time: string;
  status: string;
  error_message: string | null;
  graph_error_code: number | null;
  http_status_code: number | null;
  duration_ms: number | null;
  request_path: string | null;
};

export type PolicyFlag = {
  id: string;
  severity: "block" | "warn" | "info";
  title: string;
  detail: string;
};

export type PolicyResult = {
  flags: PolicyFlag[];
  canPublish: boolean;
  duplicateScore: number;
  similar: Array<{ id: string; message: string; score: number; engagement: number }>;
};

export type CadenceResult = {
  postedLast24h: number;
  warnAt: number;
  blockAt: number;
  level: "ok" | "warn" | "block";
};

export type ContentAnalysis = {
  sentiment: Sentiment;
  topics: string[];
  riskFlags: string[];
  suggestedHashtags: string[];
};

export type SettingsBag = {
  facebookAppId: string;
  hasFacebookSecret: boolean;
  hasAiKey: boolean;
  theme: "light" | "dark";
  defaultPageId: string | null;
  cadenceWarn: number;
  cadenceBlock: number;
  setupComplete: boolean;
  oauthRedirectUri: string;
};

export type HomeSnapshot = {
  pages: PageRow[];
  recentPosts: PostRow[];
  dueSoon: PostRow[];
  inboxCount: number;
  quota: QuotaRow | null;
  settings: SettingsBag;
};

export type ComposerInput = {
  pageId: string;
  message: string;
  link?: string | null;
  firstComment?: string | null;
  mediaType: "Text" | "Photo" | "Carousel" | "Video" | "Reel" | "Story";
  mode: "now" | "schedule" | "local-draft" | "fb-draft";
  scheduledAt?: string | null;
  variantLabel?: string | null;
  variantGroupId?: string | null;
  merchUrl?: string | null;
  media?: Array<{
    fileName: string;
    mimeType?: string;
    dataUrl?: string;
    width?: number;
    height?: number;
    durationMs?: number;
    altText?: string;
    createdWithAi?: boolean;
  }>;
};

export type MediaLibraryItem = {
  id: string;
  file_name: string;
  media_kind: string;
  alt_text: string | null;
  data_url: string | null;
  page_name: string;
  mime_type: string | null;
};

export type AnalyticsPoint = {
  id: string;
  message: string | null;
  published_time: string | null;
  created_at: string;
  reactions_count: number;
  comments_count: number;
  shares_count: number;
  media_view_unique: number | null;
  ai_variant_label: string | null;
  variant_group_id: string | null;
};

export type SyncResult = {
  pagesUpdated: number;
  postsUpdated: number;
  commentsImported: number;
  errors: string[];
};

export type IdeaRow = {
  id: string;
  page_id: string | null;
  title: string;
  body: string;
  media_type: string;
  notes: string | null;
  created_at: string;
  page_name?: string | null;
};

export type SnippetRow = {
  id: string;
  page_id: string | null;
  label: string;
  body: string;
  created_at: string;
};
