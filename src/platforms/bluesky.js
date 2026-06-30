/**
 * Bluesky platform client — text + images (video doesn't embed directly).
 */
import { load } from '../media.js';

export async function postToBluesky(text, media = [], options = {}) {
  const { BskyAgent } = await import('@atproto/api');
  const identifier = process.env.BLUESKY_USERNAME;
  const password = process.env.BLUESKY_PASSWORD;
  if (!identifier || !password) throw new Error('BLUESKY_USERNAME and BLUESKY_PASSWORD must be set');

  const agent = new BskyAgent({ service: 'https://bsky.social' });
  await agent.login({ identifier, password });

  const images = [];
  let postText = text;

  for (const item of media) {
    const source = item.file || item.url;
    if (!source) continue;
    const { buffer, mimeType } = await load(source);

    if (mimeType.startsWith('image/')) {
      const { data: blob } = await agent.uploadBlob(buffer, mimeType);
      images.push({ alt: item.alt || '', image: blob.blob });
      console.log(`  📎 Bluesky image uploaded`);
    } else if (mimeType.startsWith('video/')) {
      // Bluesky doesn't support direct video embeds yet.
      const fn = typeof source === 'string' ? source.split('/').pop() : 'video.mp4';
      postText += `\n🎬 ${fn}`;
      console.log(`  ℹ️ Bluesky: video noted in text (no native video embed)`);
    }
  }

  let embed;
  if (images.length > 0) {
    embed = { $type: 'app.bsky.embed.images', images };
  }

  const postData = {
    text: postText,
    langs: options.langs || ['en'],
    createdAt: new Date().toISOString(),
  };
  if (embed) postData.embed = embed;

  await agent.post(postData);
  console.log(`✅ Bluesky: "${postText.slice(0, 50)}..."`);
}
