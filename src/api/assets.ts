import { existsSync, mkdirSync } from 'fs';
import path from 'path';

import type { ApiConfig } from '../config';
import { stderr, stdout } from 'process';

export function ensureAssetsDir(cfg: ApiConfig) {
    if (!existsSync(cfg.assetsRoot)) {
        mkdirSync(cfg.assetsRoot, { recursive: true });
    }
}

export function mediaTypeToExt(mediaType: string) {
    const parts = mediaType.split('/');
    if (parts.length !== 2) {
        return '.bin';
    }
    return '.' + parts[1];
}

export function getAssetDiskPath(cfg: ApiConfig, assetPath: string) {
    return path.join(cfg.assetsRoot, assetPath);
}

export function getAssetURL(cfg: ApiConfig, assetPath: string) {
    return `http://localhost:${cfg.port}/assets/${assetPath}`;
}

export function getS3Url(cfg: ApiConfig, assetKey: string) {
    console.log(assetKey);
    return `http://${cfg.s3Bucket}.s3.amazonaws.com/${assetKey}`;
}

export async function getVideoAspectRatio(filePath: string) {
    const proc = Bun.spawn(
        [
            'ffprobe',
            '-v',
            'error',
            '-select_streams',
            'v:0',
            '-show_entries',
            'stream=width,height',
            '-of',
            'json',
            filePath,
        ],
        {
            stdout: 'pipe',
            stderr: 'pipe',
        }
    );

    const stdoutText = await new Response(proc.stdout).text();

    const stderrText = await new Response(proc.stderr).text();

    if ((await proc.exited) !== 0) {
        console.log('Command failed: ', stderrText);
    }

    const metaData = JSON.parse(stdoutText);
    const { width, height } = metaData.streams[0];

    const ratio = width / height;

    if (ratio > 1.5 && ratio < 2) {
        return 'landscape';
    } else if (ratio > 0.4 && ratio < 0.8) {
        return 'portrait';
    } else {
        return 'other';
    }
}
