# Milestone 3 — Service catalog and blueprints

Scope: FR-SVC-1, FR-BP-1…4 ([requirements.md](requirements.md) §2.3).
Status: **Implemented — awaiting owner review** · 2026-10-20 · Branch `feat/m3-catalog-blueprints` (stacked on
`feat/m2-clients-pipeline`).

D-8 (one blueprint version per project; a package maps to at most one blueprint) is still
OPEN; M3 follows the recommendation and nothing in M3 prevents changing it before M4.

## Data (`…_catalog_blueprints.sql`)

| Table | Notes |
|---|---|
| `services` | code (`^[a-z0-9-]{2,40}$`, unique per workspace), name, category, description, optional list price (owner-entered), active flag. |
| `packages` + `package_services` | bundles with quantity and order; optional list price. |
| `blueprints` | name, description, optional service, archived_at. |
| `blueprint_versions` | numbered; status `draft → published → retired`; at most one draft per blueprint (partial unique); change summary, content hash, published/retired stamps. |
| `task_templates` | key (`^[a-z0-9_]+$`, unique per version), title, phase, position, estimate, due offset (days), approval requirement + approver. |
| `task_template_dependencies` | both ends in the same version (composite FKs), no self-dependency; cycles rejected at publish. |
| `input_templates` | what the client must provide (`file`, `text`, `access_confirmation`, `decision`), optional task it blocks. Access confirmations record *where* a credential lives, never the credential. |

**Immutability (FR-BP-3/4):** triggers reject any insert/update/delete of templates whose
version is not a draft, any change to a published/retired version except publishing →
retiring, and deleting non-draft versions. Status only changes through functions:

- `create_draft_version(blueprint, from_version?)` — copies a version (tasks, dependencies,
  inputs mapped by key) into the next-numbered draft.
- `publish_blueprint_version(version, change_summary)` — validates (draft, ≥1 task, no cycles;
  references are guaranteed by composite FKs), stamps publisher and SHA-256 content hash.
- `retire_blueprint_version(version)`.

Publish/retire run as `security definer` in `private`, re-check owner/admin and MFA, and are
exposed through thin `security invoker` wrappers in `public`.

**Permissions:** everyone reads; owner/admin manage catalog and blueprints
(`catalog.manage`, `blueprints.publish`). All changes audited.

## Screens

`/catalog/services`, `/catalog/packages` (+ new/edit/detail) · `/blueprints` ·
`/blueprints/[id]` (version history, new draft, retire) · `/blueprints/[id]/versions/[n]`
(draft editor: tasks with prerequisites, client inputs, publish; read-only once published).

## Tests

pgTAP: immutability of published versions and templates (update/insert/delete), one-draft rule,
cycle detection, publish validation, draft copy, role checks, MFA. Vitest: schemas.
Playwright: create service → package → blueprint → draft tasks/dependency/input → publish →
edits blocked → new draft from published → retire.

## Evidence (2026-10-20)

| Check | Result |
|---|---|
| pgTAP | 153 assertions pass (42 new); mutation check: dropping the template immutability trigger fails 4 tests |
| Vitest | 123 tests pass (template keys, task/input/service schemas) |
| Playwright | service → package → blueprint → tasks + prerequisite + blocking input → publish (hash shown, editor gone) → new draft copies content → cycle blocks publish → delete draft → retire; viewer read-only (404 on write pages) |
| Browser QA | catalog and blueprint pages on desktop and phone: no console errors, no horizontal overflow |
| `supabase db lint` | clean (it caught an array-append bug in `blueprint_version_problems` before tests ran) |

## Known limitations (M3)

- Tasks are ordered by an explicit number (no drag-and-drop reordering).
- Packages are not yet linked to blueprints (D-8 decides this before M4).
- Catalog prices are USD only in the forms.
