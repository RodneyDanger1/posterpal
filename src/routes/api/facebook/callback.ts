import { createFileRoute } from "@tanstack/react-router";
import { handleFacebookCallback } from "@/lib/posterpal/facebook-oauth";

export const Route = createFileRoute("/api/facebook/callback")({
  server: {
    handlers: {
      GET: ({ request }) => handleFacebookCallback(request),
    },
  },
});
