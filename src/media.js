/**
 * media.js — Media loading for images, video, audio.
 * Supports local files and remote URLs.
 */

import fs from 'fs';
import path from 'path';

const MIME_TYPES = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.gif': 'image/gif', '.webp': 'image/webp', '.mp4': 'video/mp4',
  '.webm': 'video/webm', '.mov': 'video/quicktime', '.avi': 'video/x-msvideo',
  '.mkv': 'video/x-matroska', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
  '.ogg': 'audio/ogg', '.svg': 'image/svg+xml',
};

export function mimeType(filePath) {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

function isUrl(s) { return s.startsWith('http://') || s.startsWith('https://'); }

export async function load(source) {
  if (isUrl(source)) {
    const res = await fetch(source);
    if (!res.ok) throw new Error(`Fetch ${source}: ${res.status}`);
    return {
      buffer: Buffer.from(await res.arrayBuffer()),
      mimeType: res.headers.get('content-type') || 'application/octet-stream',
    };
  }
  return { buffer: fs.readFileSync(source), mimeType: mimeType(source) };
}
