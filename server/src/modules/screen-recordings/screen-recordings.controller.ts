import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Request, Response } from "express";
import { ScreenRecordingsService } from "./screen-recordings.service";
import { ScreenRecordingStorageService } from "./screen-recording-storage.service";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types/request-user.type";

// A 3-minute clip at the agent's encoding settings lands well under this;
// the cap exists so a misconfigured agent can't push a gigabyte onto the
// volume in one request.
const MAX_RECORDING_BYTES = 200 * 1024 * 1024;

// How much to send for an open-ended range request, so playback starts
// quickly instead of buffering the whole clip.
const RANGE_CHUNK_BYTES = 2 * 1024 * 1024;

@Controller("screen-recordings")
export class ScreenRecordingsController {
  constructor(private readonly service: ScreenRecordingsService) {}

  // Uploaded by the desktop agent as the employee being recorded.
  @Post()
  @UseInterceptors(
    FileInterceptor("file", {
      storage: ScreenRecordingStorageService.multerStorage(),
      limits: { fileSize: MAX_RECORDING_BYTES },
    }),
  )
  async create(
    @UploadedFile() file: Express.Multer.File,
    @Body("durationSec") durationSec: string,
    @CurrentUser() user: RequestUser,
  ) {
    if (!file) {
      throw new BadRequestException("No recording uploaded");
    }
    const seconds = Number(durationSec);
    return this.service.create(
      user,
      file,
      Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds) : 0,
    );
  }

  @Get()
  list(
    @CurrentUser() user: RequestUser,
    @Query("userId") userId?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.service.list(user, { userId, from, to });
  }

  @Get(":id/video")
  async video(
    @Param("id") id: string,
    @CurrentUser() user: RequestUser,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const recording = await this.service.getForPlayback(id, user);
    const size = await this.service.fileSize(recording.storagePath);

    res.set({
      "Content-Type": recording.mimeType,
      "Accept-Ranges": "bytes",
      "Cross-Origin-Resource-Policy": "cross-origin",
      "Cache-Control": "private, max-age=3600",
    });

    const range = parseRange(req.headers.range, size);
    if (range === "unsatisfiable") {
      res
        .status(416)
        .set({ "Content-Range": `bytes */${size}` })
        .end();
      return;
    }
    if (!range) {
      res.status(200).set({ "Content-Length": String(size) });
      this.service.fileStream(recording.storagePath, 0, Math.max(size - 1, 0)).pipe(res);
      return;
    }

    res.status(206).set({
      "Content-Range": `bytes ${range.start}-${range.end}/${size}`,
      "Content-Length": String(range.end - range.start + 1),
    });
    this.service.fileStream(recording.storagePath, range.start, range.end).pipe(res);
  }

  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.service.remove(id, user);
  }
}

// Handles the Range forms browsers send for media ("bytes=start-" /
// "bytes=start-end" / "bytes=-suffix"); anything else falls back to a 200.
function parseRange(
  header: string | undefined,
  size: number,
): { start: number; end: number } | "unsatisfiable" | null {
  if (!header || size === 0) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;

  const [, startPart, endPart] = match;
  if (startPart === "") {
    const suffixLength = Number(endPart);
    if (!endPart || !Number.isFinite(suffixLength) || suffixLength === 0) return "unsatisfiable";
    return { start: Math.max(size - suffixLength, 0), end: size - 1 };
  }

  const start = Number(startPart);
  if (start >= size) return "unsatisfiable";
  const end =
    endPart === ""
      ? Math.min(start + RANGE_CHUNK_BYTES - 1, size - 1)
      : Math.min(Number(endPart), size - 1);
  if (end < start) return "unsatisfiable";
  return { start, end };
}
