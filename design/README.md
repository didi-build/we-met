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
| card | Visitor confirmation (receipt after exchange) | [card/visitor-confirmation/spec.md](card/visitor-confirmation/spec.md) |
