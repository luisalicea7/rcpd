// Augment Hono's context so c.get("sessionId") is typed everywhere
declare module "hono" {
  interface ContextVariableMap {
    sessionId: string;
  }
}

export type SessionId = string;

export interface Session {
  id: SessionId;
  createdAt: number;
  lastActiveAt: number;
}

export type ConsentStatus = "granted" | "pending";