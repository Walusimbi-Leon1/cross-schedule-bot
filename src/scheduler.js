/**
 * scheduler.js — Check Firebase for due posts and publish to all platforms.
 */

import { getDuePosts, markPublishing, deletePost, markFailed } from './firebase.js';
import { postToMastodon } from './platforms/mastodon.js';
import { postToBluesky } from './platforms/bluesky.js';
import { postToTelegram } from './platforms/telegram.js';

const DRY_RUN = process.env.DRY_RUN === 'true';

const PLATFORM_DEFS = {
  mastodon: {
    check: () => !!process.env.MASTODON_TOKEN,
    skipMsg: 'MASTODON_TOKEN not configured',
    post: (t, m) => {
      const truncated = t.length > 497 ? t.slice(0, 494) + '…' : t;
      return postToMastodon(truncated, m);
    },
  },
  bluesky: {
    check: () => !!(process.env.BLUESKY_USERNAME && process.env.BLUESKY_PASSWORD),
    skipMsg: 'Bluesky credentials not configured',
    post: (t, m) => postToBluesky(t, m),
  },
  telegram: {
    check: () => !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHANNEL_ID),
    skipMsg: 'Telegram credentials not configured',
    post: (t, m) => postToTelegram(t, m),
  },
};

/**
 * Publish a single post to all configured platforms.
 * Returns { platform: string, status: string }[].
 */
async function publishPost(post) {
  const { id, text, media, platforms } = post;
  const results = [];
  const mediaItems = media || [];

  // Determine which platforms to post to
  const selected = platforms || Object.keys(PLATFORM_DEFS);

  console.log(`\n📤 Publishing post ${id}`);
  console.log(`   Text:      ${(text || '(no text)').slice(0, 80)}`);
  console.log(`   Media:     ${mediaItems.length} item(s)`);
  console.log(`   Platforms: ${selected.join(', ')}`);

  for (const name of selected) {
    const def = PLATFORM_DEFS[name];
    if (!def) {
      results.push({ platform: name, status: 'skipped', error: `Unknown platform: ${name}` });
      continue;
    }
    if (!def.check()) {
      results.push({ platform: name, status: 'skipped', error: def.skipMsg });
      continue;
    }

    if (DRY_RUN) {
      console.log(`  🔍 DRY RUN — would post to ${name}`);
      results.push({ platform: name, status: 'ok' });
      continue;
    }

    try {
      await def.post(text || '', mediaItems);
      results.push({ platform: name, status: 'ok' });
    } catch (e) {
      console.error(`  ❌ ${name}: ${e.message}`);
      results.push({ platform: name, status: 'error', error: e.message });
    }
  }

  return results;
}

/**
 * Main scheduler run: fetch due posts, publish, delete on success.
 */
export async function runScheduler() {
  console.log(`\n╔══════════════════════════════════╗`);
  console.log(`║  📡  Cross-Schedule Bot          ║`);
  console.log(`╚══════════════════════════════════╝`);
  console.log(`   Mode: ${DRY_RUN ? '🔍 DRY RUN' : '🚀 LIVE'}`);
  console.log(`   Time: ${new Date().toISOString()}`);
  console.log('');

  const duePosts = await getDuePosts();

  if (duePosts.length === 0) {
    console.log('📭 No due posts found.');
    return;
  }

  console.log(`📬 Found ${duePosts.length} due post(s) to publish.`);

  for (const post of duePosts) {
    if (!DRY_RUN) {
      await markPublishing(post.id);
    }

    const results = await publishPost(post);

    const allOk = results.every((r) => r.status === 'ok');
    const someSkipped = results.some((r) => r.status === 'skipped');

    if (allOk) {
      if (!DRY_RUN) {
        await deletePost(post.id);
      } else {
        console.log(`  🔍 DRY RUN — would delete post ${post.id}`);
      }
    } else if (someSkipped && results.filter((r) => r.status === 'error').length === 0) {
      // Only skipped (not errored) — still ok to delete
      if (!DRY_RUN) {
        await deletePost(post.id);
      } else {
        console.log(`  🔍 DRY RUN — would delete post ${post.id} (skipped unconfigured platforms)`);
      }
    } else {
      if (!DRY_RUN) {
        const errors = results.filter((r) => r.status === 'error').map((r) => r.error).join('; ');
        await markFailed(post.id, errors);
      } else {
        console.log(`  🔍 DRY RUN — would mark post ${post.id} as failed`);
      }
    }
  }

  console.log('\n✅ Scheduler run complete.\n');
}
