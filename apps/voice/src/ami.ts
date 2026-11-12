import { connect, type Socket } from "node:net";
import { readFileSync } from "node:fs";

/** Mutes what the AI says to the other side of a call, without muting what it hears. */
export interface VoiceGate {
  mute(): Promise<void>;
  unmute(): Promise<void>;
  close?(): void;
  /** True when the gate never mutes (no Asterisk Manager Interface): the AI is always heard. */
  alwaysOpen?: boolean;
}

/** Used when no Asterisk Manager Interface is configured: the AI is always heard. */
export const openGate: VoiceGate = { mute: async () => {}, unmute: async () => {}, alwaysOpen: true };

export interface AmiConfig {
  host: string;
  port: number;
  username: string;
  secret: string;
}

/**
 * The default gateway of this container, read from /proc/net/route. With Asterisk on the host
 * network, it is the address where the host (and Asterisk's AMI) is reachable.
 */
export function defaultGateway(routeTable = safeRead("/proc/net/route")): string | undefined {
  for (const line of routeTable.split("\n").slice(1)) {
    const [, destination, gateway] = line.trim().split(/\s+/);
    if (destination !== "00000000" || !gateway) continue;
    const n = parseInt(gateway, 16);
    // Little-endian hex: 0101000A is 10.0.1.1.
    return [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255].join(".");
  }
  return undefined;
}

function safeRead(path: string): string {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}

type Message = Record<string, string>;

/** A minimal AMI client: one connection per call, actions answered by ActionID. */
export class AmiClient {
  private socket?: Socket;
  private buffer = "";
  private nextId = 1;
  private readonly pending = new Map<string, (msg: Message) => void>();

  constructor(
    private readonly config: AmiConfig,
    private readonly timeoutMs = 2000,
  ) {}

  async open(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const socket = connect(this.config.port, this.config.host);
      const timer = setTimeout(() => {
        socket.destroy();
        reject(new Error(`AMI connect timeout ${this.config.host}:${this.config.port}`));
      }, this.timeoutMs);
      socket.once("connect", () => {
        clearTimeout(timer);
        resolve();
      });
      socket.once("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });
      socket.setEncoding("utf8");
      socket.on("data", (chunk: string) => this.onData(chunk));
      socket.on("error", () => {});
      this.socket = socket;
    });
    const login = await this.action({ Action: "Login", Username: this.config.username, Secret: this.config.secret, Events: "off" });
    if (login.Response !== "Success") throw new Error(`AMI login failed: ${login.Message ?? "unknown"}`);
  }

  private onData(chunk: string) {
    this.buffer += chunk;
    let end: number;
    while ((end = this.buffer.indexOf("\r\n\r\n")) >= 0) {
      const block = this.buffer.slice(0, end);
      this.buffer = this.buffer.slice(end + 4);
      const msg: Message = {};
      for (const line of block.split("\r\n")) {
        const i = line.indexOf(":");
        if (i > 0) msg[line.slice(0, i).trim()] = line.slice(i + 1).trim();
      }
      const id = msg.ActionID;
      if (id && this.pending.has(id)) {
        this.pending.get(id)!(msg);
        this.pending.delete(id);
      }
    }
  }

  action(fields: Message): Promise<Message> {
    const socket = this.socket;
    if (!socket) return Promise.reject(new Error("AMI not connected"));
    const id = String(this.nextId++);
    const text = Object.entries({ ...fields, ActionID: id })
      .map(([k, v]) => `${k}: ${v}`)
      .join("\r\n");
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`AMI ${fields.Action} timeout`));
      }, this.timeoutMs);
      this.pending.set(id, (msg) => {
        clearTimeout(timer);
        resolve(msg);
      });
      socket.write(`${text}\r\n\r\n`);
    });
  }

  close() {
    try {
      this.socket?.end("Action: Logoff\r\n\r\n");
    } catch {
      // Already closed.
    }
    this.socket?.destroy();
    this.socket = undefined;
  }
}

/**
 * Mutes the audio the AI sends into Asterisk (MuteAudio direction "in") on the channel of one call.
 * The dialplan stores that channel in the global AI_CHANNEL_<DDD+number>. Never throws: without
 * Asterisk the call goes on, only unmuted.
 */
export class AsteriskVoiceGate implements VoiceGate {
  private client?: AmiClient;
  private channel?: string;
  private muted = false;
  private queue: Promise<void> = Promise.resolve();

  constructor(
    private readonly config: AmiConfig,
    /** National number the AI dialed (DDD + number), as the dialplan stores it. */
    private readonly number: string,
    private readonly log: (msg: string) => void = () => {},
  ) {}

  mute(): Promise<void> {
    return this.set(true);
  }

  unmute(): Promise<void> {
    return this.set(false);
  }

  /** Changes run one after the other, so a quick mute then unmute keep their order. */
  private set(muted: boolean): Promise<void> {
    this.queue = this.queue.then(() => this.apply(muted)).catch((err: Error) => this.log(`voice gate: ${err.message}`));
    return this.queue;
  }

  private async apply(muted: boolean) {
    if (this.muted === muted && this.channel) return;
    if (!this.client) {
      this.client = new AmiClient(this.config);
      await this.client.open();
    }
    if (!this.channel) {
      const res = await this.client.action({ Action: "Getvar", Variable: `AI_CHANNEL_${this.number}` });
      if (res.Response !== "Success" || !res.Value) throw new Error(`no channel for ${this.number}`);
      this.channel = res.Value;
    }
    const res = await this.client.action({
      Action: "MuteAudio",
      Channel: this.channel,
      Direction: "in",
      State: muted ? "on" : "off",
    });
    if (res.Response !== "Success") throw new Error(`MuteAudio ${muted ? "on" : "off"} failed: ${res.Message ?? "unknown"}`);
    this.muted = muted;
    this.log(`voice gate: AI ${muted ? "muted" : "heard"} (${this.channel})`);
  }

  close() {
    void this.queue.finally(() => this.client?.close());
  }
}

/** Where Asterisk writes recordings, and the script it runs when one is closed (deploy/asterisk). */
export const RECORDING_DIR = "/var/spool/asterisk/recuidado";
export const RECORDING_UPLOAD = "/opt/recuidado/upload-recording.sh";

/**
 * Starts MixMonitor (both directions, 16 kHz WAV) on the AI's channel of a call. When the call ends,
 * Asterisk runs the upload script, which posts the file to the API (calls panel). It only copies the
 * audio: the call itself does not wait for it. The dialplan stores the channel in AI_CHANNEL_<number>
 * a moment after the call is created, and the previous call's channel may still be there, so it
 * retries until MixMonitor accepts a live channel. Never throws.
 */
export async function startRecording(
  config: AmiConfig,
  number: string,
  sessionId: string,
  log: (msg: string) => void = () => {},
  opts: { attempts?: number; waitMs?: number } = {},
): Promise<boolean> {
  if (!/^[A-Za-z0-9_-]+$/.test(sessionId)) return false;
  const client = new AmiClient(config);
  const attempts = opts.attempts ?? 30;
  let lastError = "";
  try {
    await client.open();
    for (let i = 0; i < attempts; i++) {
      const v = await client.action({ Action: "Getvar", Variable: `AI_CHANNEL_${number}` });
      if (v.Response === "Success" && v.Value) {
        const file = `${RECORDING_DIR}/${sessionId}.wav16`;
        const res = await client.action({
          Action: "MixMonitor",
          Channel: v.Value,
          File: file,
          Command: `${RECORDING_UPLOAD} ${file} ${sessionId}`,
        });
        if (res.Response === "Success") {
          log(`recording started (${v.Value})`);
          return true;
        }
        lastError = res.Message ?? "unknown";
      } else {
        lastError = `no channel for ${number}`;
      }
      await new Promise((r) => setTimeout(r, opts.waitMs ?? 500));
    }
    log(`recording not started: ${lastError}`);
    return false;
  } catch (err) {
    log(`recording not started: ${(err as Error).message}`);
    return false;
  } finally {
    client.close();
  }
}

/**
 * Waits until an Asterisk global variable turns "1" (polls Getvar every 400 ms), for at most maxMs or
 * until stop() says to give up. True when it became "1". Never throws.
 */
export async function waitForGlobal(
  config: AmiConfig,
  name: string,
  stop: () => boolean,
  maxMs = 4 * 60 * 1000,
): Promise<boolean> {
  const client = new AmiClient(config);
  try {
    await client.open();
    const until = Date.now() + maxMs;
    // A "1" left by an earlier call does not count: it must be seen unset (or "0") first.
    let reset = false;
    while (!stop() && Date.now() < until) {
      const res = await client.action({ Action: "Getvar", Variable: name });
      if (res.Value === "1" && reset) return true;
      if (res.Value !== "1") reset = true;
      await new Promise((r) => setTimeout(r, 400));
    }
    return false;
  } catch {
    return false;
  } finally {
    client.close();
  }
}
