/**
 * Mastodon platform client — text + media (images, video, audio).
 */
import { load } from '../media.js';

async function uploadMedia(token, instance, { buffer, mimeType }, alt) {
  const form = new FormData();
  form.append('file', new Blob([buffer], { type: mimeType }), 'media');
  if (alt) form.append('description', alt);

  const res = await fetch(`${instance}/api/v2/media`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Mastodon media upload: ${res.status} ${await res.text()}`);
  const data = await res.json();
  console.log(`  📎 Mastodon media uploaded: ${data.id} (${mimeType})`);

  // Wait for processing — Mastodon transcodes video/audio asynchronously
  if (data.id && (mimeType.startsWith('video/') || mimeType.startsWith('audio/'))) {
    for (let i = 0; i < 60; i++) {
      const chk = await fetch(`${instance}/api/v1/media/${data.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const status = await chk.json();
      if (status.url) {
        console.log(`  ✅ Mastodon media processed`);
        break;
      }
      if (status.state === 'failed') throw new Error(`Mastodon media processing failed`);
      console.log(`  ⏳ Mastodon media processing... (${i+1}s)`);
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  return data.id;
}

export async function postToMastodon(text, media = [], options = {}) {
  const token = process.env.MASTODON_TOKEN;
  const instance = (process.env.MASTODON_INSTANCE || 'https://mastodon.social').replace(/\/$/, '');
  if (!token) throw new Error('MASTODON_TOKEN not set');

  const mediaIds = [];

  for (const item of media) {
    const source = item.file || item.url;
    if (!source) continue;
    const { buffer, mimeType } = await load(source);
    const id = await uploadMedia(token, instance, { buffer, mimeType }, item.alt);
    mediaIds.push(id);
  }

  const body = new URLSearchParams({
    status: text,
    visibility: options.visibility || 'public',
    ...(options.spoilerText ? { spoiler_text: options.spoilerText } : {}),
  });
  for (const id of mediaIds) body.append('media_ids[]', id);

  const res = await fetch(`${instance}/api/v1/statuses`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error(`Mastodon ${res.status}: ${await res.text()}`);

  const data = await res.json();
  console.log(`✅ Mastodon: "${text.slice(0, 50)}..."`);
  return data;
}
