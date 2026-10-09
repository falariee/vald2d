import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  JOURNAL_KEY, MAX_IMAGES, SESSION_TAGS, isValidDate, isSafeJournalImage, validatePost,
  sortPosts, migrateLegacyPhotos, journalStats,
} from './journal-model.js';

const today = '2026-10-09';
const png = 'data:image/png;base64,aGVsbG8=';
const jpeg = 'data:image/jpeg;base64,aW1hZ2U=';
const validPost = overrides => ({
  id: 'post-1', date: today, caption: '', sessionTag: 'Everyday',
  images: [png], createdAt: '2026-10-09T10:00:00.000Z', ...overrides,
});

test('journal constants establish a separate store and the supported session tags', () => {
  assert.equal(JOURNAL_KEY, 'stride-journal-v1');
  assert.equal(MAX_IMAGES, 6);
  assert.deepEqual(SESSION_TAGS, ['Everyday', 'Run', 'Gym', 'Rest']);
});

test('dates require a real calendar day, including correct leap years', () => {
  for (const date of ['2024-02-29', '2000-02-29', today]) assert.equal(isValidDate(date, today), true, date);
  for (const date of ['2025-02-29', '1900-02-29', '2026-04-31', '2026-13-01', '2026-00-01', '2026-10-00', '2026-10-32']) {
    assert.equal(isValidDate(date, today), false, date);
  }
});

test('dates reject future days and noncanonical or nonstring input', () => {
  for (const date of ['2026-10-10', '2026-1-09', '2026-10-9', ' 2026-10-09', '2026-10-09T00:00:00Z', null, 20261009]) {
    assert.equal(isValidDate(date, today), false, String(date));
  }
  assert.equal(isValidDate(today, '2026-02-30'), false);
});

test('posts allow multiple photos and captions without inventing session metrics', () => {
  const post = validPost({ sessionTag: 'Run', caption: 'A good morning.', images: [png, jpeg] });
  assert.equal(validatePost(post, today), '');
  assert.equal('distance' in post, false);
  assert.equal('calories' in post, false);
  assert.equal(validatePost(validPost({ images: Array(6).fill(png) }), today), '');
  assert.match(validatePost(validPost({ images: Array(7).fill(png) }), today), /6/);
});

test('text-only entries need actual caption text and preserve plain text exactly', () => {
  const caption = '<img src=x onerror=alert(1)> & a "rest" day';
  const post = validPost({ caption, images: [], sessionTag: 'Rest' });
  const before = structuredClone(post);
  assert.equal(validatePost(post, today), '');
  assert.deepEqual(post, before);
  assert.equal(post.caption, caption);
  assert.match(validatePost(validPost({ caption: ' \n\t ', images: [] }), today), /photo or write a caption/);
});

test('validation requires caption strings, supported tags and an images array', () => {
  for (const caption of [null, undefined, 3, {}, []]) assert.notEqual(validatePost(validPost({ caption }), today), '');
  assert.equal(validatePost(validPost({ caption: 'x'.repeat(2000) }), today), '');
  assert.match(validatePost(validPost({ caption: 'x'.repeat(2001) }), today), /2,000/);
  assert.notEqual(validatePost(validPost({ sessionTag: 'Walk' }), today), '');
  assert.notEqual(validatePost(validPost({ images: png }), today), '');
  assert.notEqual(validatePost(validPost({ date: '2026-10-10' }), today), '');
  assert.notEqual(validatePost(null, today), '');
});

test('photos accept only raster base64 data URLs and reject remote or executable content', () => {
  for (const mime of ['jpeg', 'png', 'webp', 'gif']) {
    const source = `data:image/${mime};base64,aGVsbG8=`;
    assert.equal(isSafeJournalImage(source), true);
    assert.equal(validatePost(validPost({ images: [source] }), today), '');
  }
  for (const url of ['https://example.com/photo.jpg', 'javascript:alert(1)', 'data:image/svg+xml;base64,PHN2Zz4=', 'data:text/html;base64,aGVsbG8=', 'data:image/png;base64,', 'data:image/png;base64,aGVsbG8', 'data:image/png;base64,!!!!', 'data:image/png;base64,aA===', 'data:image/png,aGVsbG8=']) {
    assert.equal(isSafeJournalImage(url), false);
    assert.notEqual(validatePost(validPost({ images: [url] }), today), '', url);
  }
});

test('sort puts date first, then actual creation time, with a stable ID tie breaker', () => {
  const posts = [
    validPost({ id: 'b', createdAt: '2026-10-09T10:00:00Z' }),
    validPost({ id: 'previous-day', date: '2026-10-08', createdAt: '2026-10-09T23:00:00Z' }),
    validPost({ id: 'a', createdAt: '2026-10-09T10:00:00Z' }),
    validPost({ id: 'latest', createdAt: '2026-10-09T19:30:00+08:00' }),
  ];
  const before = structuredClone(posts);
  assert.deepEqual(sortPosts(posts).map(post => post.id), ['latest', 'a', 'b', 'previous-day']);
  assert.deepEqual(posts, before);
  assert.deepEqual(sortPosts([...posts].reverse()).map(post => post.id), ['latest', 'a', 'b', 'previous-day']);
});

test('legacy migration keeps IDs and uses stable dates while preserving saved posts', () => {
  const existing = [validPost({ id: 'saved', caption: 'Keep this caption.' })];
  const legacy = [
    { id: 'saved', date: today, url: jpeg },
    { id: 'legacy-1', date: '2026-10-07', url: png },
    { id: 'legacy-2', date: '2026-10-08', url: jpeg, createdAt: '2026-10-08T19:00:00+08:00', updatedAt: '2026-10-09T09:00:00+08:00' },
  ];
  const before = structuredClone({ existing, legacy });
  const migrated = migrateLegacyPhotos(existing, legacy, { today, now: '2026-10-09T16:00:00Z' });
  assert.deepEqual(migrated.map(post => post.id), ['saved', 'legacy-1', 'legacy-2']);
  assert.equal(migrated[0].caption, 'Keep this caption.');
  assert.deepEqual(migrated[1], { id: 'legacy-1', date: '2026-10-07', createdAt: '2026-10-07T12:00:00.000Z', updatedAt: '2026-10-07T12:00:00.000Z', caption: '', sessionTag: 'Everyday', images: [png] });
  assert.equal(migrated[2].createdAt, legacy[2].createdAt);
  assert.equal(migrated[2].updatedAt, legacy[2].updatedAt);
  assert.deepEqual({ existing, legacy }, before);
  assert.deepEqual(migrateLegacyPhotos(migrated, legacy, { today }), migrated);
});

test('legacy migration deduplicates IDs and generates deterministic IDs for old idless photos', () => {
  const idless = { date: '2026-10-07', url: png };
  const legacy = [idless, { ...idless }, { date: '2026-10-08', url: png }, { id: 'same', date: today, url: jpeg }, { id: 'same', date: today, url: png }];
  const first = migrateLegacyPhotos([], legacy, { today });
  assert.equal(first.length, 3);
  assert.equal(new Set(first.map(post => post.id)).size, 3);
  assert.deepEqual(migrateLegacyPhotos([], legacy, { today, now: '2099-01-01T00:00:00Z' }), first);
  assert.deepEqual(migrateLegacyPhotos(first, legacy, { today }), first);
});

test('legacy migration rejects invalid dates and unsafe photos and does not fabricate their contents', () => {
  const legacy = [
    { id: 'future', date: '2026-10-10', url: png },
    { id: 'bad-date', date: '2026-02-30', url: png },
    { id: 'bad-url', date: today, url: 'https://example.com/photo.jpg' },
    { id: 'svg', date: today, url: 'data:image/svg+xml;base64,PHN2Zz4=' },
    { id: 'good', date: today, url: png, createdAt: 'invalid', updatedAt: 'invalid' },
    null,
  ];
  const result = migrateLegacyPhotos([], legacy, { today });
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'good');
  assert.equal(result[0].createdAt, '2026-10-09T12:00:00.000Z');
  assert.equal(result[0].updatedAt, result[0].createdAt);
});

test('journal statistics count distinct posting dates and exclude invalid or future records', () => {
  const posts = ['2026-10-04', '2026-10-05', '2026-10-05', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-11', '2026-10-12', '2026-02-30'].map((date, i) => validPost({ id: String(i), date }));
  assert.deepEqual(journalStats(posts, today), { posts: 6, postedDays: 5, thisWeek: 4, currentStreak: 3 });
});

test('streak remains active when only today is missed, but breaks after a missed yesterday', () => {
  const posts = ['2026-10-06', '2026-10-07', '2026-10-08', '2026-10-08'].map(date => validPost({ date }));
  assert.equal(journalStats(posts, today).currentStreak, 3);
  assert.equal(journalStats(posts.filter(post => post.date !== '2026-10-08'), today).currentStreak, 0);
  assert.deepEqual(journalStats([], today), { posts: 0, postedDays: 0, thisWeek: 0, currentStreak: 0 });
});

test('weeks start on Monday and streaks cross leap days and year boundaries', () => {
  const posts = ['2025-12-29', '2025-12-31', '2026-01-01', '2026-01-02'].map(date => validPost({ date }));
  assert.deepEqual(journalStats(posts, '2026-01-02'), { posts: 4, postedDays: 4, thisWeek: 4, currentStreak: 3 });
  assert.equal(journalStats([{ date: '2026-10-04' }, { date: '2026-10-05' }], '2026-10-05').thisWeek, 1);
  assert.equal(journalStats(['2024-02-28', '2024-02-29', '2024-03-01'].map(date => ({ date })), '2024-03-01').currentStreak, 3);
  assert.deepEqual(journalStats(posts, 'not-a-date'), { posts: 0, postedDays: 0, thisWeek: 0, currentStreak: 0 });
});

test('statistics safely handle the limits of a four-digit calendar year', () => {
  assert.deepEqual(journalStats([{ date: '0000-01-01' }], '0000-01-01'), { posts: 1, postedDays: 1, thisWeek: 1, currentStreak: 1 });
  assert.deepEqual(journalStats([{ date: '9999-12-31' }], '9999-12-31'), { posts: 1, postedDays: 1, thisWeek: 1, currentStreak: 1 });
});
