# Contacts setup (Google People API)

**Status:** Accepted (2026-10-23)  
**Ticket:** [DIDI-747](https://linear.app/didi-build/issue/DIDI-747)

## Context

After publish, eligible card owners can add a single **We Met** Google Contact with configured sender addresses so follow-up mail is less likely to land in Spam.

## Decision

1. **Incremental OAuth** for `https://www.googleapis.com/auth/contacts` only, with `include_granted_scopes=true` and **online** access (no refresh token).
2. **Callback** exchanges the authorization code, calls People API once (`searchContacts` warm-up, then create or update), then **discards the access token**. No Google OAuth tokens are stored in D1, logs, or queues.
3. **D1** stores only `accounts.contact_added_at` and `accounts.contact_sender_addresses` (JSON list of addresses recorded).
4. **Eligibility** until Google verification: `CONTACTS_SETUP_ALLOWLIST` and `CONTACTS_SETUP_ENABLED_FOR_ALL` (default false). Sender addresses come from `WE_MET_CONTACT_SENDER_ADDRESSES` on the app Worker.
5. **Decline / admin block:** hide the row for the session via `__Host-wm_cs_hide`; do not set `contact_added_at`.

## Consequences

- Consent screen and scope verification remain operator work ([DIDI-750](https://linear.app/didi-build/issue/DIDI-750)).
- Privacy copy for [DIDI-748](https://linear.app/didi-build/issue/DIDI-748): we write one contact to the owner's Google account and store no Google tokens.
