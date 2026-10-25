# Design specs

This folder holds the design specs for We Met. Specs are organized by feature, never by ticket.

## Layout

```
design/<area>/<feature>/
  spec.md      purpose, states, final copy, decisions, and a Changes list
  mockups/     images and static HTML
```

- To change a feature later, edit its existing `spec.md` in place and add a dated line to its Changes list with the ticket link. Git history is the record, so don't add per-ticket copies.
- No ticket numbers in folder or file names.
- Design PRs touch only files under `design/`. Developer builds the real components with tests.

## Features

| Area | Feature | Spec |
| --- | --- | --- |
| app | Contacts setup (add We Met to Google contacts) | [app/contacts-setup/spec.md](app/contacts-setup/spec.md) |
| card | Exchange and details sheets | [card/exchange-sheet/spec.md](card/exchange-sheet/spec.md) |
| card | Visitor confirmation (receipt after exchange) | [card/visitor-confirmation/spec.md](card/visitor-confirmation/spec.md) |
| emails | Owner relay email | [emails/owner-relay/spec.md](emails/owner-relay/spec.md) |
| emails | Owner new lead email (retired) | [emails/owner-new-lead/spec.md](emails/owner-new-lead/spec.md) |
| emails | Owner details update email (retired) | [emails/owner-details-update/spec.md](emails/owner-details-update/spec.md) |
| emails | Visitor follow-up email | [emails/visitor-followup/spec.md](emails/visitor-followup/spec.md) |
| landing | Relay mode (How it works step 3) | [landing/relay-mode/spec.md](landing/relay-mode/spec.md) |
