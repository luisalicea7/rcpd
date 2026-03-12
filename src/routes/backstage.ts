import { Hono, type Context, type MiddlewareHandler } from "hono";
import { backstageManager, type SocketLike } from "../services/backstage-manager.js";
import { logger } from "../utils/logger.js";
import { requireSessionId } from "../utils/session-context.js";

type UpgradeWebSocket = (handler: (c: Context) => Record<string, unknown>) => MiddlewareHandler;

export const BACKSTAGE_VERSION = "v1" as const;

interface IBackstageSocket extends SocketLike {}

export function createBackstageRoutes(upgradeWebSocket: UpgradeWebSocket): Hono {
  const backstageRoutes = new Hono();

  backstageRoutes.get(
    "/ws",
    upgradeWebSocket((c) => {
      const sessionResponse = requireSessionId(c);
      if (sessionResponse instanceof Response) {
        return {
          onOpen: (_event: unknown, ws: IBackstageSocket) => ws.close?.(),
        };
      }

      const sessionId = sessionResponse;

      return {
        onOpen: (_event: unknown, ws: IBackstageSocket) => {
          backstageManager.subscribe(sessionId, ws);
          ws.send?.(
            JSON.stringify({
              type: "status",
              sessionId,
              timestamp: new Date().toISOString(),
              version: BACKSTAGE_VERSION,
              payload: { connected: true, version: BACKSTAGE_VERSION },
            }),
          );
        },
        onClose: (_event: unknown, ws: IBackstageSocket) => {
          backstageManager.unsubscribe(sessionId, ws);
        },
        onError: (_event: unknown, ws: IBackstageSocket, err: unknown) => {
          logger.warn({ err, sessionId }, "Backstage websocket error");
          backstageManager.unsubscribe(sessionId, ws);
          ws.close?.();
        },
      };
    }),
  );

  backstageRoutes.get("/status", (c) => {
    return c.json({ ok: true, version: BACKSTAGE_VERSION, clients: backstageManager.getClientCount() });
  });

  return backstageRoutes;
}
