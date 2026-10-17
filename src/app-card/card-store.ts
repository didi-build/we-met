import {
  draftJsonToEditorCard,
  editorCardToPersistedJson,
  publishedRowToEditorCard,
} from "@/app-card/editor-persist";
import { draftJsonFromEditorCard } from "@/app-card/parse-editor-card";
import { PublishCardError } from "@/app-card/publish-errors";
import { emptyEditorCard } from "@/app-card/route-auth";
import { ACCOUNT_EMAIL_SENTINEL } from "@/card-data/account-email";
import type { EditorCard } from "@/app-api/types";
import { nowIso } from "@/app-auth/time";
import type { D1Database } from "@cloudflare/workers-types";

function parseJson<T>(raw: string): T {
  return JSON.parse(raw) as T;
}

function isD1UniqueError(message: string, index: string): boolean {
  return message.includes(index);
}

export async function loadCardBundle(
  db: D1Database,
  accountId: string,
): Promise<{ draft: EditorCard; published: EditorCard | null; updatedAt: string }> {
  const draftRow = await db
    .prepare(
      "SELECT draft_json, photo_key, updated_at FROM card_drafts WHERE account_id = ?",
    )
    .bind(accountId)
    .first<{ draft_json: string; photo_key: string | null; updated_at: string }>();

  const publishedRow = await db
    .prepare(
      `SELECT slug, photo_key, page_copy_json, links_json, updated_at
       FROM cards WHERE account_id = ?`,
    )
    .bind(accountId)
    .first<{
      slug: string;
      photo_key: string | null;
      page_copy_json: string;
      links_json: string;
      updated_at: string;
    }>();

  const published = publishedRow
    ? publishedRowToEditorCard(publishedRow, parseJson)
    : null;

  if (draftRow) {
    return {
      draft: draftJsonToEditorCard(draftRow.draft_json, draftRow.photo_key),
      published,
      updatedAt: draftRow.updated_at,
    };
  }

  return {
    draft: published ?? emptyEditorCard(),
    published,
    updatedAt: publishedRow?.updated_at ?? nowIso(),
  };
}

export async function saveDraft(
  db: D1Database,
  accountId: string,
  card: EditorCard,
): Promise<string> {
  const updatedAt = nowIso();
  const draftJson = draftJsonFromEditorCard(card);

  await db
    .prepare(
      `INSERT INTO card_drafts (account_id, draft_json, photo_key, updated_at)
       VALUES (?, ?, NULL, ?)
       ON CONFLICT(account_id) DO UPDATE SET
         draft_json = excluded.draft_json,
         updated_at = excluded.updated_at`,
    )
    .bind(accountId, draftJson, updatedAt)
    .run();

  return updatedAt;
}

export async function clearDraftPhotoKey(
  db: D1Database,
  accountId: string,
): Promise<void> {
  const updatedAt = nowIso();
  await db
    .prepare(
      `UPDATE card_drafts SET photo_key = NULL, updated_at = ? WHERE account_id = ?`,
    )
    .bind(updatedAt, accountId)
    .run();
}

export async function setDraftPhotoKey(
  db: D1Database,
  accountId: string,
  photoKey: string,
): Promise<void> {
  const updatedAt = nowIso();
  const draftJson = draftJsonFromEditorCard(emptyEditorCard());
  await db
    .prepare(
      `INSERT INTO card_drafts (account_id, draft_json, photo_key, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(account_id) DO UPDATE SET
         photo_key = excluded.photo_key,
         updated_at = excluded.updated_at`,
    )
    .bind(accountId, draftJson, photoKey, updatedAt)
    .run();
}

export async function slugTakenByOther(
  db: D1Database,
  slug: string,
  accountId: string,
): Promise<boolean> {
  const row = await db
    .prepare("SELECT account_id FROM cards WHERE slug = ?")
    .bind(slug)
    .first<{ account_id: string }>();
  if (!row) {
    return false;
  }
  return row.account_id !== accountId;
}

export async function loadPublishedSlug(
  db: D1Database,
  accountId: string,
): Promise<string | null> {
  const row = await db
    .prepare("SELECT slug FROM cards WHERE account_id = ?")
    .bind(accountId)
    .first<{ slug: string }>();
  return row?.slug ?? null;
}

async function loadAccountName(db: D1Database, accountId: string): Promise<string> {
  const row = await db
    .prepare("SELECT name FROM accounts WHERE id = ?")
    .bind(accountId)
    .first<{ name: string }>();
  return row?.name?.trim() ?? "";
}

async function loadExistingCard(
  db: D1Database,
  accountId: string,
): Promise<{ id: string; slug: string; status: string } | null> {
  const row = await db
    .prepare("SELECT id, slug, status FROM cards WHERE account_id = ?")
    .bind(accountId)
    .first<{ id: string; slug: string; status: string }>();
  return row ?? null;
}

async function updatePublishedCard(
  db: D1Database,
  accountId: string,
  card: EditorCard,
  photoKey: string | null,
  existing: { id: string; slug: string; status: string },
): Promise<{ path: string; slug: string }> {
  if (existing.status !== "live") {
    throw new PublishCardError("forbidden");
  }
  if (existing.slug !== card.slug.trim()) {
    throw new PublishCardError("slug-locked");
  }

  const accountName = await loadAccountName(db, accountId);
  const persisted = editorCardToPersistedJson(card, photoKey, accountName);
  const linksJson = JSON.stringify(persisted.links);
  const pageCopyJson = JSON.stringify(persisted.pageCopy);
  const contactJson = JSON.stringify(persisted.contact);
  const copyJson = JSON.stringify(persisted.copy);
  const updatedAt = nowIso();
  const slug = card.slug.trim();
  const displayName = persisted.displayName;
  const draftJson = draftJsonFromEditorCard(card);

  await db.batch([
    db
      .prepare(
        `UPDATE cards SET
          variant = 'mono',
          display_name = ?,
          photo_key = ?,
          links_json = ?,
          page_copy_json = ?,
          contact_json = ?,
          copy_json = ?,
          updated_at = ?
         WHERE account_id = ?`,
      )
      .bind(
        displayName,
        photoKey,
        linksJson,
        pageCopyJson,
        contactJson,
        copyJson,
        updatedAt,
        accountId,
      ),
    db
      .prepare(
        `INSERT INTO card_drafts (account_id, draft_json, photo_key, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(account_id) DO UPDATE SET
           draft_json = excluded.draft_json,
           photo_key = excluded.photo_key,
           updated_at = excluded.updated_at`,
      )
      .bind(accountId, draftJson, photoKey, updatedAt),
  ]);

  return { path: `/hi/${slug}`, slug };
}

async function insertPublishedCard(
  db: D1Database,
  accountId: string,
  card: EditorCard,
  photoKey: string | null,
): Promise<{ path: string; slug: string }> {
  const accountName = await loadAccountName(db, accountId);
  const persisted = editorCardToPersistedJson(card, photoKey, accountName);
  const linksJson = JSON.stringify(persisted.links);
  const pageCopyJson = JSON.stringify(persisted.pageCopy);
  const contactJson = JSON.stringify(persisted.contact);
  const copyJson = JSON.stringify(persisted.copy);
  const updatedAt = nowIso();
  const slug = card.slug.trim();
  const displayName = persisted.displayName;
  const draftJson = draftJsonFromEditorCard(card);
  const cardId = crypto.randomUUID();
  const sinkId = `${slug}-owner-inbox`;
  const sinkConfig = JSON.stringify({ to: ACCOUNT_EMAIL_SENTINEL });

  try {
    await db.batch([
      db
        .prepare(
          `INSERT INTO cards (
            id, slug, variant, display_name, account_id, status, photo_key,
            links_json, page_copy_json, contact_json, copy_json, updated_at
          ) VALUES (?, ?, 'mono', ?, ?, 'live', ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          cardId,
          slug,
          displayName,
          accountId,
          photoKey,
          linksJson,
          pageCopyJson,
          contactJson,
          copyJson,
          updatedAt,
        ),
      db
        .prepare(
          `INSERT INTO lead_sinks (id, card_id, kind, enabled, config_json, created_at, updated_at)
           VALUES (?, ?, 'email', 1, ?, ?, ?)`,
        )
        .bind(sinkId, cardId, sinkConfig, updatedAt, updatedAt),
      db
        .prepare(
          `INSERT INTO card_drafts (account_id, draft_json, photo_key, updated_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(account_id) DO UPDATE SET
             draft_json = excluded.draft_json,
             photo_key = excluded.photo_key,
             updated_at = excluded.updated_at`,
        )
        .bind(accountId, draftJson, photoKey, updatedAt),
    ]);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (
      isD1UniqueError(message, "cards_slug_unique") ||
      /UNIQUE constraint failed:\s*cards\.slug/i.test(message)
    ) {
      throw new PublishCardError("slug-taken");
    }
    if (
      isD1UniqueError(message, "cards_one_per_account") ||
      /UNIQUE constraint failed:\s*cards\.account_id/i.test(message)
    ) {
      const existing = await loadExistingCard(db, accountId);
      if (!existing) {
        throw err;
      }
      return updatePublishedCard(db, accountId, card, photoKey, existing);
    }
    throw err;
  }

  return { path: `/hi/${slug}`, slug };
}

export async function publishCard(
  db: D1Database,
  accountId: string,
  card: EditorCard,
  photoKey: string | null,
): Promise<{ path: string; slug: string }> {
  const existing = await loadExistingCard(db, accountId);
  if (!existing) {
    return insertPublishedCard(db, accountId, card, photoKey);
  }
  return updatePublishedCard(db, accountId, card, photoKey, existing);
}

export async function loadDraftPhotoKey(
  db: D1Database,
  accountId: string,
): Promise<string | null> {
  const row = await db
    .prepare("SELECT photo_key FROM card_drafts WHERE account_id = ?")
    .bind(accountId)
    .first<{ photo_key: string | null }>();
  return row?.photo_key ?? null;
}
