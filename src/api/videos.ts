import { respondWithJSON } from './json';
import { NotFoundError, UserForbiddenError } from './errors';
import {
    getAssetDiskPath,
    getAssetURL,
    getS3Url,
    getVideoAspectRatio,
} from './assets';
import { getVideo, updateVideo } from '../db/videos';
import { randomBytes, type UUID } from 'crypto';
import { type ApiConfig } from '../config';
import type { BunRequest } from 'bun';
import { BadRequestError } from './errors';
import { getBearerToken, validateJWT } from '../auth';
import { mediaTypeToExt } from './assets';

export async function handlerUploadVideo(cfg: ApiConfig, req: BunRequest) {
    const { videoId } = req.params as { videoId?: UUID };
    if (!videoId) {
        throw new BadRequestError('Invalid video ID');
    }
    const token = getBearerToken(req.headers);
    const userID = validateJWT(token, cfg.jwtSecret);

    const MAX_UPLOAD_SIZE = 1 << 30;

    const metaData = getVideo(cfg.db, videoId);
    if (!metaData) {
        throw new NotFoundError("Couldn't find video");
    }
    if (metaData?.userID !== userID)
        throw new UserForbiddenError('Not authorized');
    const formData = await req.formData();
    const file = formData.get('video');

    if (!(file instanceof File)) {
        throw new BadRequestError('Video file missing');
    }
    if (file.size > MAX_UPLOAD_SIZE) {
        throw new BadRequestError('Video is too big');
    }

    const type = file.type;

    if (!type) {
        throw new BadRequestError('Missing Content-Type for thumbnail');
    }

    if (!(type == 'video/mp4')) {
        throw new BadRequestError('Wrong video type');
    }

    const extension = mediaTypeToExt(type);
    const fileName = `${randomBytes(32).toString('hex')}${extension}`;

    const assetDiskPath = getAssetDiskPath(cfg, fileName);
    await Bun.write(assetDiskPath, file);

    const tempFile = Bun.file(assetDiskPath);

    const aspectRatio = await getVideoAspectRatio(assetDiskPath);

    const prefixedFileName = `${aspectRatio}/${fileName}`;

    const bucket = cfg.s3Client.file(prefixedFileName, {
        type: type,
    });

    await bucket.write(tempFile);

    metaData.videoURL = getS3Url(cfg, prefixedFileName);

    updateVideo(cfg.db, metaData);

    await Bun.write(assetDiskPath, new Uint8Array(0)); // Clear the file

    return respondWithJSON(200, null);
}
