import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createHistoryRepository } from '@/database';
import { translateAndRecord } from '@/features/translation/record-translation';
import { withCache } from '@/services/translation/caching-router';
import { createInFlightRegistry } from '@/services/translation/in-flight-requests';
import { mockTranslationService } from '@/services/translation/mock-translation-service';
import { createMemoryTranslationCache } from '@/services/translation/translation-cache';
import { createTranslationRouter } from '@/services/translation/translation-router';
import type { TranslationRequest } from '@/types';

import { createNodeSQLiteDatabase } from './support/node-sqlite-database';

/**
 * The translate-to-history path, wired from the real router through the real
 * repository. Only the SQLite driver is swapped.
 */

const request: TranslationRequest = {
  text: 'Hello',
  sourceLanguage: 'en',
  targetLanguage: 'de',
  origin: 'text',
};

async function stack() {
  const database = createNodeSQLiteDatabase();
  await database.open();

  const repository = createHistoryRepository(database);
  const initialised = await repository.initialize();
  assert.equal(initialised.ok, true);

  const router = withCache(createTranslationRouter({ engines: [mockTranslationService] }), {
    cache: createMemoryTranslationCache({ maxEntries: 20 }),
    inFlight: createInFlightRegistry(),
  });

  return { database, repository, router };
}

/** `translateAndRecord` writes without awaiting; let the write land. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

const unwrap = <T>(result: { ok: true; value: T } | { ok: false; error: unknown }): T => {
  assert.equal(result.ok, true, `expected ok, got ${JSON.stringify(result)}`);
  if (!result.ok) throw new Error('unreachable');
  return result.value;
};

describe('translation writes history', () => {
  it('a successful translation creates exactly one record', async () => {
    const { repository, router } = await stack();

    const result = await translateAndRecord(router, repository, request);
    assert.equal(result.ok, true);
    await settle();

    const entries = unwrap(await repository.listRecent());
    assert.equal(entries.length, 1);
    assert.equal(entries[0]?.sourceText, 'Hello');
    assert.equal(entries[0]?.translatedText, 'Hallo');
    assert.equal(entries[0]?.sourceLanguage, 'en');
    assert.equal(entries[0]?.targetLanguage, 'de');
  });

  it('a failed translation creates nothing', async () => {
    const { repository, router } = await stack();

    // Swahili is outside the sample engine's data.
    const result = await translateAndRecord(router, repository, {
      ...request,
      targetLanguage: 'sw',
    });
    assert.equal(result.ok, false);
    await settle();

    assert.equal(unwrap(await repository.count()), 0, 'failures must not be recorded');
  });

  it('an invalid request creates nothing', async () => {
    const { repository, router } = await stack();
    await translateAndRecord(router, repository, { ...request, text: '   ' });
    await settle();
    assert.equal(unwrap(await repository.count()), 0);
  });

  it('a cached translation still creates a new record', async () => {
    const { repository, router } = await stack();

    const first = await translateAndRecord(router, repository, request);
    const second = await translateAndRecord(router, repository, request);
    await settle();

    // Same cached result, so the same translation id both times...
    assert.equal(first.ok && second.ok, true);
    assert.equal(
      first.ok && second.ok && first.value.id,
      second.ok ? second.value.id : '',
      'the second translation came from the cache',
    );

    // ...but two separate history records, because they are two user actions.
    const entries = unwrap(await repository.listRecent());
    assert.equal(entries.length, 2, 'history must not deduplicate');
    assert.notEqual(entries[0]?.id, entries[1]?.id);
  });

  it('repeated translations of the same text all appear', async () => {
    const { repository, router } = await stack();

    for (let index = 0; index < 4; index += 1) {
      await translateAndRecord(router, repository, request);
    }
    await settle();

    assert.equal(unwrap(await repository.count()), 4);
  });

  it('records different pairs separately', async () => {
    const { repository, router } = await stack();

    await translateAndRecord(router, repository, request);
    await translateAndRecord(router, repository, { ...request, targetLanguage: 'es' });
    await settle();

    const entries = unwrap(await repository.listRecent());
    assert.equal(entries.length, 2);
    assert.deepEqual(entries.map((entry) => entry.targetLanguage).sort(), ['de', 'es']);
  });

  it('a history write failure does not fail the translation', async () => {
    const { router } = await stack();

    // A repository that is not initialised rejects every write.
    const broken = createHistoryRepository(createNodeSQLiteDatabase());

    const result = await translateAndRecord(router, broken, request);
    assert.equal(result.ok, true, 'the user still gets their translation');
  });

  it('records the translation the user can see, not a rewritten one', async () => {
    const { repository, router } = await stack();

    const result = await translateAndRecord(router, repository, request);
    await settle();

    const entries = unwrap(await repository.listRecent());
    assert.equal(result.ok && result.value.translatedText, entries[0]?.translatedText);
    assert.equal(result.ok && result.value.createdAt, entries[0]?.createdAt);
    assert.equal(result.ok && result.value.engine, entries[0]?.engine);
  });
});

describe('history survives a restart', () => {
  it('entries and favourites are still there after reopening', async () => {
    const { database, repository, router } = await stack();

    await translateAndRecord(router, repository, request);
    await settle();

    const created = unwrap(await repository.listRecent())[0];
    assert.ok(created);
    await repository.setFavorite(created.id, true);

    // A new repository over the same database, as after an app restart.
    const reopened = createHistoryRepository(database);
    await reopened.initialize();

    const entries = unwrap(await reopened.listRecent());
    assert.equal(entries.length, 1);
    assert.equal(entries[0]?.isFavorite, true);
    assert.equal(entries[0]?.translatedText, 'Hallo');
  });
});

describe('the saveHistory preference', () => {
  it('writes a record when saving is on', async () => {
    const { repository, router } = await stack();
    await translateAndRecord(router, repository, request, { saveHistory: true });
    await settle();
    assert.equal(unwrap(await repository.count()), 1);
  });

  it('writes nothing when the user turned saving off', async () => {
    const { repository, router } = await stack();
    const result = await translateAndRecord(router, repository, request, { saveHistory: false });
    await settle();

    assert.equal(result.ok, true, 'the translation still happens');
    assert.equal(unwrap(await repository.count()), 0, 'but nothing is recorded');
  });

  it('defaults to saving when no preference is passed', async () => {
    const { repository, router } = await stack();
    await translateAndRecord(router, repository, request);
    await settle();
    assert.equal(unwrap(await repository.count()), 1);
  });
});
