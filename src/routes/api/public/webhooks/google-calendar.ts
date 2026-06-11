import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/webhooks/google-calendar")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("x-goog-channel-token");
        const expected = process.env.GOOGLE_CALENDAR_WEBHOOK_TOKEN;
        if (!expected || !token || token !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }
        const state = request.headers.get("x-goog-resource-state");
        // Google sends a "sync" notification when the channel is first registered
        if (state === "sync") return new Response("ok");
        try {
          const { pullGoogleChanges } = await import("@/lib/google-calendar.server");
          await pullGoogleChanges();
        } catch (e) {
          console.error("[google-calendar webhook] pull failed", e);
        }
        return new Response("ok");
      },
    },
  },
});