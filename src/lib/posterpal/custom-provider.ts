/**
 * Resolve the operator's custom OpenAI-compatible endpoint from settings.
 * Server-only: the base URL/model are plaintext, the key is encrypted at rest.
 *
 * The URL is re-validated (structural + DNS) by network-guard when it is actually
 * used, not only when saved — a hostname can later resolve to a private address.
 */
import type { CustomEndpoint } from "./ai";
import { getSetting } from "./repo";

export async function customTextEndpoint(userId: string): Promise<CustomEndpoint | null> {
  const [baseUrl, model] = await Promise.all([
    getSetting(userId, "custom_base_url"),
    getSetting(userId, "custom_text_model"),
  ]);
  if (!baseUrl?.trim() || !model?.trim()) return null;
  return { baseUrl: baseUrl.trim(), model: model.trim() };
}

export async function customImageEndpoint(userId: string): Promise<CustomEndpoint | null> {
  const [baseUrl, model] = await Promise.all([
    getSetting(userId, "custom_base_url"),
    getSetting(userId, "custom_image_model"),
  ]);
  if (!baseUrl?.trim() || !model?.trim()) return null;
  return { baseUrl: baseUrl.trim(), model: model.trim() };
}

export async function customConfigured(userId: string): Promise<boolean> {
  const endpoint = await customTextEndpoint(userId);
  return Boolean(endpoint);
}
