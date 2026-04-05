/**
 * lib/message-emitter.ts — In-process pub/sub for SSE chat delivery.
 *
 * NOTE: This EventEmitter works correctly on a single Node.js server instance.
 * On Vercel / any serverless platform where each request may run in a separate
 * cold function instance, emitters in different instances cannot communicate.
 * For multi-instance deployments, replace this with a shared pub/sub layer
 * such as Redis pub/sub, Ably, or Pusher.
 *
 * Usage:
 *   // Producer (POST /api/chat/conversations/[id]/messages):
 *   messageEmitter.emit(`msg:${conversationId}`, payload);
 *
 *   // Consumer (GET /api/messages/stream):
 *   messageEmitter.on(`msg:${conversationId}`, handler);
 *   messageEmitter.off(`msg:${conversationId}`, handler);
 */

import { EventEmitter } from "events";

// Survive Next.js HMR hot-reloads in development by attaching to `global`.
const g = global as unknown as { _charaivatiMsgEmitter?: EventEmitter };

if (!g._charaivatiMsgEmitter) {
  const emitter = new EventEmitter();
  emitter.setMaxListeners(500); // allow many simultaneous open chat streams
  g._charaivatiMsgEmitter = emitter;
}

export const messageEmitter: EventEmitter = g._charaivatiMsgEmitter!;
