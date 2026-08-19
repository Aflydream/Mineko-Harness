/**
 * TypeScript client SDK for the MiNeko Herness runtime: spawn the
 * `mnh-jsonrpc-agent` runtime as a subprocess and drive agent turns over
 * stdio JSON-RPC. `MiNekoHerness` is the high-level run API;
 * `HarnessClient` is the lower-level protocol client. A pure library — it
 * registers nothing on a Cordis context; the runtime process it spawns is a
 * complete harness configured by its own `cordis.yml`.
 *
 * @module @aflydream/mnh-sdk-client
 */

export { MiNekoHerness, HarnessSession } from './api.ts'
export type { RunOptions } from './api.ts'
export {
  HarnessClient,
  RequestTimeoutError,
  SdkProtocolError,
  TransportClosedError,
} from './client.ts'
export type { NotificationSubscription } from './client.ts'
export { JsonRpcResponseError } from '@aflydream/mnh-sdk-protocol'
export type {
  ContentBlock,
  MiNekoHernessOptions,
  HarnessClientOptions,
  HarnessNotification,
  NotificationFilter,
  RunResult,
} from './types.ts'
