import {
  createGranolaEventSource,
  getCacheMtimeMs,
  normalizeDiff,
} from "./event-source.js";
import type { WatchArgs } from "./types.js";

export { getCacheMtimeMs, normalizeDiff };

export async function runWatch(args: WatchArgs): Promise<void> {
  await new Promise<void>(() => {
    const source = createGranolaEventSource(args, {
      started(event) {
        console.error(JSON.stringify(event));
      },
      transcriptDiff(event) {
        console.log(JSON.stringify(event));
      },
      error(event) {
        console.error(JSON.stringify(event));
      },
    });

    source.start();
  });
}
