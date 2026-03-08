import { config } from "./index.js";

type RedisPrimitive = string | number;

type XReadEntry = [id: string, fields: string[]];
type XReadStream = [stream: string, entries: XReadEntry[]];

type RedisEvent = "connect" | "error";

class RedisAdapter {
  private client: Bun.RedisClient;
  private listeners: {
    connect: Array<() => void>;
    error: Array<(err: unknown) => void>;
  } = {
    connect: [],
    error: [],
  };

  constructor(url: string) {
    this.client = new Bun.RedisClient(url);
  }

  async connect(): Promise<void> {
    try {
      await this.client.connect();
      this.listeners.connect.forEach((cb) => cb());
    } catch (err) {
      this.listeners.error.forEach((cb) => cb(err));
      throw err;
    }
  }

  on(event: "connect", cb: () => void): void;
  on(event: "error", cb: (err: unknown) => void): void;
  on(event: RedisEvent, cb: (() => void) | ((err: unknown) => void)): void {
    if (event === "connect") {
      this.listeners.connect.push(cb as () => void);
      return;
    }

    this.listeners.error.push(cb as (err: unknown) => void);
  }

  ping(): Promise<string> {
    return this.client.ping();
  }

  get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  mget(...keys: string[]): Promise<Array<string | null>> {
    if (keys.length === 0) return Promise.resolve([]);
    return this.client.mget(...keys);
  }

  set(key: string, value: string): Promise<string>;
  set(key: string, value: string, mode: "EX", seconds: number): Promise<string>;
  set(key: string, value: string, mode?: "EX", seconds?: number): Promise<string> {
    if (mode === "EX" && typeof seconds === "number") {
      return this.client.send("SET", [key, value, mode, String(seconds)]) as Promise<string>;
    }

    return this.client.set(key, value);
  }

  expire(key: string, seconds: number): Promise<number> {
    return this.client.expire(key, seconds);
  }

  hset(key: string, values: Record<string, string | number>): Promise<number> {
    return this.client.hset(key, values);
  }

  sadd(key: string, ...members: string[]): Promise<number> {
    if (members.length === 0) return Promise.resolve(0);
    return this.client.sadd(key, ...members);
  }

  smembers(key: string): Promise<string[]> {
    return this.client.smembers(key);
  }

  unlink(...keys: string[]): Promise<number> {
    if (keys.length === 0) return Promise.resolve(0);
    return this.client.unlink(...keys);
  }

  xadd(
    key: string,
    id: string,
    ...fieldValues: RedisPrimitive[]
  ): Promise<string | null> {
    return this.client.send("XADD", [
      key,
      id,
      ...fieldValues.map((v) => String(v)),
    ]) as Promise<string | null>;
  }

  xread(...args: RedisPrimitive[]): Promise<XReadStream[] | null> {
    return this.client.send("XREAD", args.map((v) => String(v))) as Promise<XReadStream[] | null>;
  }

  scan(
    cursor: string,
    matchToken: "MATCH",
    pattern: string,
    countToken: "COUNT",
    count: number,
  ): Promise<[cursor: string, keys: string[]]> {
    return this.client.send("SCAN", [
      cursor,
      matchToken,
      pattern,
      countToken,
      String(count),
    ]) as Promise<[cursor: string, keys: string[]]>;
  }
}

export type RedisClient = RedisAdapter;

export const redis = new RedisAdapter(config.REDIS_URL);

redis.on("connect", () => console.log("[redis] connected"));
redis.on("error", (err) => console.error("[redis] error", err));

void redis.connect();

// Dedicated client for the blocking XREADGROUP call in the event consumer.
// Keeps the main client free for regular operations during blocking reads.
export function createConsumerClient(): RedisClient {
  const client = new RedisAdapter(config.REDIS_URL);
  void client.connect();
  return client;
}
