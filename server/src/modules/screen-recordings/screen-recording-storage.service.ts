import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { createReadStream, type ReadStream } from "node:fs";
import { mkdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { diskStorage } from "multer";

// Same local-disk-behind-an-interface approach as ScreenshotStorageService --
// separate subfolder under the gitignored "server/storage/" root, which in
// production is the mounted Railway volume.
//
// Unlike screenshots these go straight to disk via multer rather than through
// a Buffer: a 3-minute clip is tens of megabytes and has no business sitting
// in the Node heap on the way in.
const STORAGE_ROOT = join(process.cwd(), "storage", "screen-recordings");

@Injectable()
export class ScreenRecordingStorageService {
  static multerStorage() {
    return diskStorage({
      destination: (_req, _file, cb) => {
        mkdir(STORAGE_ROOT, { recursive: true })
          .then(() => cb(null, STORAGE_ROOT))
          .catch((err) => cb(err as Error, STORAGE_ROOT));
      },
      filename: (_req, _file, cb) => cb(null, `${randomUUID()}.webm`),
    });
  }

  size(storagePath: string): Promise<number> {
    return stat(join(STORAGE_ROOT, storagePath)).then((s) => s.size);
  }

  // start/end are inclusive byte offsets, matching HTTP Range semantics --
  // video has to be seekable or the reviewer waits for the whole clip.
  stream(storagePath: string, start: number, end: number): ReadStream {
    return createReadStream(join(STORAGE_ROOT, storagePath), { start, end });
  }

  async delete(storagePath: string): Promise<void> {
    try {
      await rm(join(STORAGE_ROOT, storagePath), { force: true });
    } catch {
      // Best-effort -- a missing file shouldn't block the DB cleanup.
    }
  }
}
