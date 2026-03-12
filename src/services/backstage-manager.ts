import { logger } from "../utils/logger.js";
import type {
  BackstageMessage,
  BackstageMessageType,
  BackstagePayloadByType,
} from "../types/backstage.js";

export type SocketLike = {
  readyState?: number;
  send?: (data: string) => void;
  close?: () => void;
};

const OPEN_STATE = 1;

class BackstageManager {
  private readonly clients = new Map<string, Set<SocketLike>>();

  subscribe(sessionId: string, ws: SocketLike): void {
    const set = this.clients.get(sessionId) ?? new Set<SocketLike>();
    set.add(ws);
    this.clients.set(sessionId, set);
  }

  unsubscribe(sessionId: string, ws: SocketLike): void {
    const set = this.clients.get(sessionId);
    if (!set) return;

    set.delete(ws);
    if (set.size === 0) this.clients.delete(sessionId);
  }

  getClientCount(): number {
    let count = 0;
    for (const set of this.clients.values()) {
      count += set.size;
    }
    return count;
  }

  emit<K extends BackstageMessageType>(
    type: K,
    args: {
      sessionId: string;
      eventId: string;
      traceId?: string;
      payload: BackstagePayloadByType[K];
    },
  ): void {
    const set = this.clients.get(args.sessionId);
    if (!set || set.size === 0) return;

    const message: BackstageMessage<K> = {
      type,
      sessionId: args.sessionId,
      timestamp: new Date().toISOString(),
      eventId: args.eventId,
      traceId: args.traceId ?? args.eventId,
      version: "v1",
      payload: args.payload,
    };

    const encoded = JSON.stringify(message);

    for (const ws of set) {
      try {
        if (typeof ws.readyState === "number" && ws.readyState !== OPEN_STATE) {
          set.delete(ws);
          continue;
        }
        if (typeof ws.send !== "function") {
          set.delete(ws);
          continue;
        }
        ws.send(encoded);
      } catch (err) {
        set.delete(ws);
        logger.warn({ err, sessionId: args.sessionId, type }, "Failed to send backstage WS message");
      }
    }

    if (set.size === 0) {
      this.clients.delete(args.sessionId);
    }
  }
}

export const backstageManager = new BackstageManager();
