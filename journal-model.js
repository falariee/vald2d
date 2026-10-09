export const JOURNAL_KEY = 'stride-journal-v1';
export const MAX_IMAGES = 6;
export const SESSION_TAGS = Object.freeze(['Everyday', 'Run', 'Gym', 'Rest']);

function calendarDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
    ? parsed
    : null;
}

export function isValidDate(date, today) {
  return Boolean(calendarDate(date) && calendarDate(today) && date <= today);
}

export function isSafeJournalImage(value) {
  if (typeof value !== 'string') return false;
  const match = /^data:image\/(?:jpeg|png|webp|gif);base64,(.+)$/i.exec(value);
  return Boolean(match && /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(match[1]));
}

export function validatePost(post, today) {
  if (!post || typeof post !== 'object' || Array.isArray(post)) return 'Enter a journal post.';
  if (!isValidDate(post.date, today)) return 'Choose a valid date on or before today.';
  if (typeof post.caption !== 'string') return 'Enter your caption as text.';
  if (post.caption.length > 2000) return 'Keep your caption to 2,000 characters or fewer.';
  if (!SESSION_TAGS.includes(post.sessionTag)) return 'Choose a valid session tag.';
  if (!Array.isArray(post.images)) return 'Choose valid journal photos.';
  if (post.images.length > MAX_IMAGES) return `Choose up to ${MAX_IMAGES} photos per post.`;
  if (post.images.some(image => !isSafeJournalImage(image))) return 'Use JPEG, PNG, WebP, or GIF photos.';
  if (!post.images.length && !post.caption.trim()) return 'Add a photo or write a caption.';
  return '';
}

function timestamp(value) {
  if (typeof value !== 'string') return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function compareText(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function sortPosts(posts) {
  return [...posts].sort((a, b) =>
    compareText(String(b.date ?? ''), String(a.date ?? '')) ||
    timestamp(b.createdAt) - timestamp(a.createdAt) ||
    compareText(String(a.id ?? ''), String(b.id ?? ''))
  );
}

function legacyID(photo) {
  if (typeof photo.id === 'string' && photo.id.trim()) return photo.id;
  const fingerprint = `${photo.date}\u0000${photo.url}`;
  let first = 2166136261;
  let second = 5381;
  for (let i = 0; i < fingerprint.length; i++) {
    first = Math.imul(first ^ fingerprint.charCodeAt(i), 16777619);
    second = Math.imul(second, 33) ^ fingerprint.charCodeAt(i);
  }
  return `legacy-${(first >>> 0).toString(16)}-${(second >>> 0).toString(16)}-${fingerprint.length}`;
}

export function migrateLegacyPhotos(existingPosts, legacyPhotos, { today } = {}) {
  const result = [];
  const ids = new Set();
  for (const post of Array.isArray(existingPosts) ? existingPosts : []) {
    if (!post || typeof post !== 'object') continue;
    const id = typeof post.id === 'string' && post.id.trim() ? post.id : null;
    if (id && ids.has(id)) continue;
    if (id) ids.add(id);
    result.push(post);
  }
  for (const photo of Array.isArray(legacyPhotos) ? legacyPhotos : []) {
    if (!photo || !isValidDate(photo.date, today) || !isSafeJournalImage(photo.url)) continue;
    const id = legacyID(photo);
    if (ids.has(id)) continue;
    ids.add(id);
    const createdAt = typeof photo.createdAt === 'string' && Number.isFinite(Date.parse(photo.createdAt))
      ? photo.createdAt
      : `${photo.date}T12:00:00.000Z`;
    result.push({
      id,
      date: photo.date,
      createdAt,
      updatedAt: typeof photo.updatedAt === 'string' && Number.isFinite(Date.parse(photo.updatedAt))
        ? photo.updatedAt
        : createdAt,
      caption: '',
      sessionTag: 'Everyday',
      images: [photo.url],
    });
  }
  return result;
}

function shiftDate(date, days) {
  const result = calendarDate(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

export function journalStats(posts, today) {
  if (!calendarDate(today)) return { posts: 0, postedDays: 0, thisWeek: 0, currentStreak: 0 };
  const eligible = posts.filter(post => post && isValidDate(post.date, today));
  const dates = new Set(eligible.map(post => post.date));
  const monday = shiftDate(today, -((calendarDate(today).getUTCDay() + 6) % 7));
  // Eligible dates already stop at today, so no future days in this week count.
  const thisWeek = [...dates].filter(date => date >= monday).length;
  let streakDate = dates.has(today) ? today : shiftDate(today, -1);
  let currentStreak = 0;
  while (dates.has(streakDate)) {
    currentStreak++;
    streakDate = shiftDate(streakDate, -1);
  }
  return { posts: eligible.length, postedDays: dates.size, thisWeek, currentStreak };
}
