/**
 * Telegram platform client — text + media (images, video, audio).
 * Uses the Telegram Bot API to post to a channel.
 */

import { load } from '../media.js';

function getConfig() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const channelId = process.env.TELEGRAM_CHANNEL_ID;
  if (!botToken) throw new Error('TELEGRAM_BOT_TOKEN not set');
  if (!channelId) throw new Error('TELEGRAM_CHANNEL_ID not set');
  return { botToken, channelId };
}

function target(channelId) {
  return channelId.startsWith('@') ? channelId : Number(channelId);
}

export async function postToTelegram(text, media = [], options = {}) {
  const { botToken, channelId } = getConfig();
  const api = `https://api.telegram.org/bot${botToken}`;
  const chatId = target(channelId);
  const parseMode = options.parseMode || 'HTML';
  const disablePreview = options.disablePreview !== false;

  if (media.length === 0) {
    // Text-only post
    const body = { chat_id: chatId, text, parse_mode: parseMode, disable_web_page_preview: disablePreview };

    const res = await fetch(`${api}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(`Telegram sendMessage: ${err.description || res.status}`);
    }

    console.log(`✅ Telegram: "${text.slice(0, 50)}..."`);
    return res.json();
  }

  // With media — send first file with caption, remaining as replies
  const first = media[0];
  const rest = media.slice(1);
  const source = first.file || first.url;
  if (!source) throw new Error('Telegram: media item has no file or url');

  const { buffer, mimeType } = await load(source);
  const isVideo = mimeType.startsWith('video/');
  const isImage = mimeType.startsWith('image/');
  const isAudio = mimeType.startsWith('audio/');

  let method, formData, uploadedMessageId;

  const caption = first.alt ? `${text}\n\n${first.alt}` : text;

  if (isVideo) {
    method = 'sendVideo';
    formData = new FormData();
    formData.append('chat_id', String(chatId));
    formData.append('video', new Blob([buffer], { type: mimeType }), 'video.mp4');
    formData.append('caption', caption);
    formData.append('parse_mode', parseMode);
    formData.append('supports_streaming', 'true');
  } else if (isImage) {
    method = 'sendPhoto';
    formData = new FormData();
    formData.append('chat_id', String(chatId));
    formData.append('photo', new Blob([buffer], { type: mimeType }), 'photo.jpg');
    formData.append('caption', caption);
    formData.append('parse_mode', parseMode);
  } else if (isAudio) {
    method = 'sendAudio';
    formData = new FormData();
    formData.append('chat_id', String(chatId));
    formData.append('audio', new Blob([buffer], { type: mimeType }), 'audio.mp3');
    formData.append('caption', caption);
    formData.append('parse_mode', parseMode);
  } else {
    method = 'sendDocument';
    formData = new FormData();
    formData.append('chat_id', String(chatId));
    formData.append('document', new Blob([buffer], { type: mimeType }), 'file');
    formData.append('caption', caption);
    formData.append('parse_mode', parseMode);
  }

  const res = await fetch(`${api}/${method}`, { method: 'POST', body: formData });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Telegram ${method}: ${err.description || res.status}`);
  }
  const data = await res.json();
  uploadedMessageId = data.result?.message_id;
  console.log(`  📎 Telegram ${method} sent (message_id: ${uploadedMessageId})`);

  // Send remaining media as replies
  for (let i = 0; i < rest.length; i++) {
    const item = rest[i];
    const src = item.file || item.url;
    if (!src) continue;

    const { buffer: buf, mimeType: mime } = await load(src);
    const replyForm = new FormData();
    if (uploadedMessageId) replyForm.append('reply_to_message_id', String(uploadedMessageId));
    replyForm.append('chat_id', String(chatId));

    if (mime.startsWith('video/')) {
      replyForm.append('video', new Blob([buf], { type: mime }), `media_${i}.mp4`);
      const r = await fetch(`${api}/sendVideo`, { method: 'POST', body: replyForm });
      if (!r.ok) console.warn(`  ⚠️  Telegram additional video ${i+1} failed`);
      else console.log(`  📎 Telegram additional video ${i+1} sent`);
    } else if (mime.startsWith('image/')) {
      replyForm.append('photo', new Blob([buf], { type: mime }), `media_${i}.jpg`);
      const r = await fetch(`${api}/sendPhoto`, { method: 'POST', body: replyForm });
      if (!r.ok) console.warn(`  ⚠️  Telegram additional photo ${i+1} failed`);
      else console.log(`  📎 Telegram additional photo ${i+1} sent`);
    }
  }

  console.log(`✅ Telegram: "${text.slice(0, 50)}..."`);
}
