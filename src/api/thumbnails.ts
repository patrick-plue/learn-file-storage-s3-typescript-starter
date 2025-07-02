import { getBearerToken, validateJWT } from '../auth';
import { respondWithJSON } from './json';
import { getAssetDiskPath, mediaTypeToExt, getAssetURL } from './assets';
import { getVideo, updateVideo } from '../db/videos';
import type { ApiConfig } from '../config';
import type { BunRequest } from 'bun';
import path from 'path';
import { BadRequestError, NotFoundError, UserForbiddenError } from './errors';
import { randomBytes } from 'crypto';

type Thumbnail = {
    data: ArrayBuffer;
    mediaType: string;
};

// const videoThumbnails: Map<string, Thumbnail> = new Map();

// export async function handlerGetThumbnail(cfg: ApiConfig, req: BunRequest) {
//     const { videoId } = req.params as { videoId?: string };
//     if (!videoId) {
//         throw new BadRequestError('Invalid video ID');
//     }

//     const video = getVideo(cfg.db, videoId);
//     if (!video) {
//         throw new NotFoundError("Couldn't find video");
//     }

//     const thumbnail = videoThumbnails.get(videoId);
//     if (!thumbnail) {
//         throw new NotFoundError('Thumbnail not found');
//     }

//     return new Response(thumbnail.data, {
//         headers: {
//             'Content-Type': thumbnail.mediaType,
//             'Cache-Control': 'no-store',
//         },
//     });
// }

export async function handlerUploadThumbnail(cfg: ApiConfig, req: BunRequest) {
    const { videoId } = req.params as { videoId?: string };
    if (!videoId) {
        throw new BadRequestError('Invalid video ID');
    }

    const token = getBearerToken(req.headers);
    const userID = validateJWT(token, cfg.jwtSecret);
    console.log('uploading thumbnail for video', videoId, 'by user', userID);

    const formData = await req.formData();
    const file = formData.get('thumbnail');
    if (!(file instanceof File)) {
        throw new BadRequestError('Thumbnail file missing');
    }

    const type = file.type;
    if (!type) {
        throw new BadRequestError('Missing Content-Type for thumbnail');
    }

    const MAX_UPLOAD_SIZE = 10 << 20;

    if (file.size > MAX_UPLOAD_SIZE) {
        throw new BadRequestError(
            'Thumbnail file exceeds the maximum allowed size of 10MB '
        );
    }

    const extension = mediaTypeToExt(type);
    const fileName = `${randomBytes(32).toString('base64url')}${extension}`;

    const assetDiskPath = getAssetDiskPath(cfg, fileName);
    await Bun.write(assetDiskPath, file);

    const urlPath = getAssetURL(cfg, fileName);

    const metaData = getVideo(cfg.db, videoId);
    if (!metaData) {
        throw new NotFoundError("Couldn't find video");
    }

    metaData.thumbnailURL = urlPath;

    if (metaData?.userID !== userID)
        throw new UserForbiddenError('Not authorized');

    updateVideo(cfg.db, metaData);

    return respondWithJSON(200, null);
}
