import os from "node:os";
import { mkdir, appendFile } from "node:fs/promises";
import path from "node:path";

type EventName =
  | "wish_created"
  | "wish_updated"
  | "question_candidates_generated"
  | "question_selected"
  | "record_created"
  | "reflection_created"
  | "next_step_shown"
  | "next_step_clicked"
  | "next_step_accepted"
  | "attachment_uploaded";

type EventPayload = Record<string, unknown>;

const logPath = process.env.EVENT_LOG_PATH || path.join(os.tmpdir(), "jiyu-kenkyu-navi-events.log");

export async function logEvent(name: EventName, payload: EventPayload = {}) {
  const line = JSON.stringify({
    name,
    payload,
    timestamp: new Date().toISOString(),
  });

  try {
    await mkdir(path.dirname(logPath), { recursive: true });
    await appendFile(logPath, `${line}\n`, "utf8");
  } catch (error) {
    console.error("failed_to_write_event_log", error);
  }
}
