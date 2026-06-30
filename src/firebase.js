/**
 * firebase.js — Firebase Admin SDK initialization for the scheduler.
 * 
 * In production (GitHub Actions), reads service account from
 * FIREBASE_SERVICE_ACCOUNT env var (JSON as a single line).
 * 
 * For local dev, you can set FIREBASE_SERVICE_ACCOUNT_PATH to
 * point at a downloaded service account JSON file.
 */

import admin from 'firebase-admin';

let db = null;

export function getDatabase() {
  if (db) return db;

  const databaseURL = process.env.FIREBASE_DATABASE_URL;
  if (!databaseURL) throw new Error('FIREBASE_DATABASE_URL not set');

  const saJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  const saPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

  let credential;
  if (saJson) {
    credential = admin.credential.cert(JSON.parse(saJson));
  } else if (saPath) {
    credential = admin.credential.cert(saPath);
  } else {
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT (JSON string) or FIREBASE_SERVICE_ACCOUNT_PATH (file path) must be set'
    );
  }

  admin.initializeApp({ credential, databaseURL });
  db = admin.database();
  return db;
}

/**
 * Fetch all scheduled posts that are due and still pending.
 */
export async function getDuePosts() {
  const database = getDatabase();
  const now = Date.now();

  const snapshot = await database
    .ref('scheduled-posts')
    .orderByChild('scheduledAt')
    .endAt(now)
    .once('value');

  const posts = [];
  snapshot.forEach((child) => {
    const val = child.val();
    if (val.status === 'pending') {
      posts.push({ id: child.key, ...val });
    }
  });

  return posts;
}

/**
 * Mark a post as publishing in progress.
 */
export async function markPublishing(postId) {
  const database = getDatabase();
  await database.ref(`scheduled-posts/${postId}`).update({
    status: 'publishing',
    publishingStartedAt: Date.now(),
  });
}

/**
 * Write per-platform publish results to a post's log.
 */
export async function updatePostResults(postId, results) {
  const database = getDatabase();
  const allOk = results.every((r) => r.status === 'ok');
  const anyError = results.some((r) => r.status === 'error');

  await database.ref(`scheduled-posts/${postId}`).update({
    status: allOk ? 'published' : anyError ? 'partial' : 'published',
    results,
    publishedAt: Date.now(),
  });
}

/**
 * Delete a post after successful publishing.
 */
export async function deletePost(postId) {
  const database = getDatabase();
  await database.ref(`scheduled-posts/${postId}`).remove();
  console.log(`  🗑️ Deleted post ${postId} from database`);
}

/**
 * Mark a post as failed with an error message.
 */
export async function markFailed(postId, error) {
  const database = getDatabase();
  await database.ref(`scheduled-posts/${postId}`).update({
    status: 'failed',
    results: null,
    error: error?.message || String(error),
    failedAt: Date.now(),
  });
}
