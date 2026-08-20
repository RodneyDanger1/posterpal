import { createFileRoute } from "@tanstack/react-router";
import { bearerFrom, corsPreflight, jsonErr, jsonOk, resolveDeviceToken, snapshotForSync } from "@/lib/posterpal/devices";

export const Route = createFileRoute("/api/sync/snapshot")({
  server: {
    handlers: {
      OPTIONS: () => corsPreflight(),
      GET: async ({ request }) => {
        const token = bearerFrom(request);
        if (!token) return jsonErr("Missing Authorization: Bearer ppd_…", 401);
        const device = await resolveDeviceToken(token);
        if (!device) return jsonErr("Unknown or revoked device token.", 401);
        const origin = new URL(request.url).origin;
        const snap = await snapshotForSync(device.userId, origin);
        return jsonOk({ deviceId: device.deviceId, ...snap });
      },
    },
  },
});
