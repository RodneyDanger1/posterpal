import { createFileRoute } from "@tanstack/react-router";
import { corsPreflight, jsonErr, jsonOk, redeemPairingCode } from "@/lib/posterpal/devices";

export const Route = createFileRoute("/api/sync/pair")({
  server: {
    handlers: {
      OPTIONS: () => corsPreflight(),
      POST: async ({ request }) => {
        let body: { code?: string; deviceName?: string; platform?: string };
        try {
          body = (await request.json()) as { code?: string; deviceName?: string; platform?: string };
        } catch {
          return jsonErr("Send JSON { code, deviceName, platform }.");
        }
        try {
          const result = await redeemPairingCode({
            code: String(body.code ?? ""),
            deviceName: String(body.deviceName ?? "Phone"),
            platform: String(body.platform ?? "android"),
          });
          return jsonOk(result);
        } catch (e) {
          return jsonErr(e instanceof Error ? e.message : "Pairing failed", 400);
        }
      },
    },
  },
});
