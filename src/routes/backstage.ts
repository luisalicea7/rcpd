import { Hono, type Context } from "hono";
import { backstageManager } from "../services/backstage-manager.js";
import { requireSessionId } from "../utils/session-context.js";

type UpgradeWebSocket = (handler: (c: Context) => Record<string, unknown>) => (c: Context) => Response;

export function createBackstageRoutes(upgradeWebSocket: UpgradeWebSocket): Hono {
  const backstageRoutes = new Hono();

  backstageRoutes.get(
    "/ws",
    upgradeWebSocket((c) => {
      const sessionResponse = requireSessionId(c);
      if (sessionResponse instanceof Response) {
        return {
          onOpen: (_event: unknown, ws: { close: () => void }) => ws.close(),
        };
      }

      const sessionId = sessionResponse;

      return {
        onOpen: (_event: unknown, ws: { send: (s: string) => void }) => {
          backstageManager.subscribe(sessionId, ws);
          ws.send(
            JSON.stringify({
              type: "status",
              sessionId,
              timestamp: new Date().toISOString(),
              version: "v1",
              payload: { connected: true },
            }),
          );
        },
        onClose: (_event: unknown, ws: { send: (s: string) => void }) => {
          backstageManager.unsubscribe(sessionId, ws);
        },
      };
    }),
  );

  backstageRoutes.get("/status", (c) => {
    return c.json({ ok: true, version: "v1", clients: backstageManager.getClientCount() });
  });

  return backstageRoutes;
}
