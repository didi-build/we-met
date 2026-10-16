import {
  draftJsonToEditorCard,
  editorCardToPersistedJson,
  photoKeyFromDraftPhotoUrl,
  publishedRowToEditorCard,
} from "@/app-card/editor-persist";
import { emptyEditorCard } from "@/app-card/route-auth";
import { ACCOUNT_EMAIL_SENTINEL } from "@/card-data/account-email";
import type { EditorCard } from "@/app-api/types";
import { nowIso } from "@/app-auth/time";
import type { D1Database } from "@cloudflare/workers-types";

function parseJson<T>(raw: string): T {
  return JSON.parse(raw) as T;
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
  const photoKey =
    photoKeyFromDraftPhotoUrl(card.photo) ??
    (card.photo.trim() ? card.photo.trim() : null);
  const draftJson = JSON.stringify({
    ...card,
    photo: "",
  });

  await db
    .prepare(
      `INSERT INTO card_drafts (account_id, draft_json, photo_key, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(account_id) DO UPDATE SET
         draft_json = excluded.draft_json,
         photo_key = excluded.photo_key,
         updated_at = excluded.updated_at`,
    )
    .bind(accountId, draftJson, photoKey, updatedAt)
    .run();

  return updatedAt;
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

export async function publishCard(
  db: D1Database,
  accountId: string,
  card: EditorCard,
  photoKey: string | null,
): Promise<{ url: string; slug: string }> {
  const persisted = editorCardToPersistedJson(card, photoKey);
  const linksJson = JSON.stringify(persisted.links);
  const pageCopyJson = JSON.stringify(persisted.pageCopy);
  const contactJson = JSON.stringify(persisted.contact);
  const copyJson = JSON.stringify(persisted.copy);
  const updatedAt = nowIso();
  const slug = card.slug.trim();
  const displayName = card.name.trim();

  const existing = await db
    .prepare("SELECT id, slug FROM cards WHERE account_id = ?")
    .bind(accountId)
    .first<{ id: string; slug: string }>();

  const draftJson = JSON.stringify({ ...card, photo: "" });

  if (!existing) {
    const cardId = crypto.randomUUID();
    const sinkId = `${slug}-owner-inbox`;
    const sinkConfig = JSON.stringify({ to: ACCOUNT_EMAIL_SENTINEL });
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
    return { url: `/hi/${slug}`, slug };
  }

  if (existing.slug !== slug) {
    throw new Error("slug-locked");
  }

  await db.batch([
    db
      .prepare(
        `UPDATE cards SET
          variant = 'mono',
          display_name = ?,
          status = 'live',
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

  return { url: `/hi/${slug}`, slug };
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
