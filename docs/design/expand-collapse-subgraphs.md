# Expand/Collapse All Subgraphs

## Feature Overview and Strategic Fit

The Display Options popover has an "Expand Subgraphs" checkbox bound to
`visualization.expandSubgraphs`. Today it writes the preference but nothing
reads it — subgraphs can only be collapsed/expanded one at a time via each
subgraph's own header button. This feature wires the checkbox up as a global
control: one click expands or collapses **all** subgraphs at the
currently-viewed level, and the choice persists across restarts.

This is a **wiring task**. `applyCollapses`, the per-subgraph header buttons,
the consumer-owned `collapseByLevel` state, and preference persistence
(`useUserPreferences` / `ConfigFileManager`) all already exist and are
unchanged.

A subgraph is **collapsed** when its id is in the level's `Set<number>` (see
[apply-collapses.ts](../../packages/react-app/src/widgets/graph-designer/lib/apply-collapses.ts)),
which then replaces it with a `SubgraphProxyNode`. **Critically**,
`applyCollapses` removes collapsed subgraphs from `LevelView.subgraphs[]` and
adds proxies to `subgraphProxies[]` instead — so the complete list of a
level's subgraph ids only ever lives on the **raw** `levelView`, never on the
post-`applyCollapses` `graph`.

---

## Requirements

| Requirement | Detail |
| --- | --- |
| Wire existing control | No new control or preference key — reuse `visualization.expandSubgraphs`. |
| Apply-all on toggle | Checking → collapse set becomes empty (all expanded). Unchecking → collapse set becomes all current-level subgraph ids, from the **raw** `levelView` (all collapsed). |
| Current-level scope | Acts only on the currently-viewed `levelId`. |
| Derived checkbox display | `checked = collapsedSubgraphs.size === 0`. No `subgraphs.length` guard — an empty level is vacuously "all expanded". |
| Individual toggles preserved | Per-subgraph header buttons are unchanged; collapsing any one subgraph unchecks the box, re-expanding the last one re-checks it. |
| Default state on first visit | On a level's first visit, the persisted `expandSubgraphs` sets its default collapse set (`true` → empty, `false` → all ids). Read-only — never written back. |
| Write-path isolation | Only the checkbox click writes `expandSubgraphs`. See invariant below. |
| Persist across restarts | Via existing `useUserPreferences` / `ConfigFileManager`. No new persistence code. |
| Default flip | `DEFAULT_VISUALIZATION_PREFERENCES.expandSubgraphs`: `false` → `true`, so fresh users keep today's all-expanded first-load view. |

---

## Key Invariant: Write-Path Isolation

The persisted `expandSubgraphs` boolean and the checkbox's *displayed*
`checked` state are decoupled. `checked` is derived live from
`collapsedSubgraphs`; the preference is **written only** by the checkbox's
`onCheckedChange`, and **read only** by the effect that sets the default.
Individual subgraph toggles touch `collapseByLevel` alone.

If an individual toggle were allowed to write the preference, collapsing one
subgraph would round-trip `false` into persistence and silently change the
default for every future level — the failure mode this split exists to
avoid.

---

## Architectural Impacts

- `widgets/graph-designer/lib/all-subgraph-ids.ts` — new file. Pure function
  `allSubgraphIds(level)` reading raw subgraph ids from `LevelView`.
- `widgets/graph-designer/lib/default-collapse-for-level.ts` — new file. Pure
  function `defaultCollapseForLevel(current, levelId, level, expandSubgraphs)`
  that sets a level's default collapse set once, without ever overwriting a
  later individual toggle.
- `widgets/graph-designer/ui/display-options-popover.tsx` — the "Expand
  Subgraphs" checkbox gains two new props (`expandSubgraphsChecked`,
  `onExpandSubgraphsChange`), matching how the port-visibility checkbox
  already takes `preferences` / `updatePreference`.
- `widgets/graph-designer/ui/graph-designer.tsx` — derives
  `expandSubgraphsChecked`, adds the `onExpandSubgraphsChange` handler, and
  adds a `useEffect` that sets each level's default collapse state once.
- `shared/config/user-preferences-types.ts` —
  `DEFAULT_VISUALIZATION_PREFERENCES.expandSubgraphs` flips from `false` to
  `true`.

---

## Design

**New pure functions** (`widgets/graph-designer/lib/`):

```ts
// all-subgraph-ids.ts — raw ids, NOT the post-applyCollapses graph
export function allSubgraphIds(level: LevelView): number[];

// default-collapse-for-level.ts — sets the default once, never overwrites a
// later toggle
export function defaultCollapseForLevel(
  current: Record<string, Set<number>>,
  levelId: string,
  level: LevelView,
  expandSubgraphs: boolean,
): Record<string, Set<number>>;
```

`defaultCollapseForLevel` returns `current` unchanged (same reference) if
`levelId` is already a key — this is what lets the default-setting effect
re-run safely on every render without ever clobbering a user's individual
toggle.

**`DisplayOptionsPopover`** gains two props, parallel to how the
port-visibility checkbox already takes `preferences` / `updatePreference`:

```ts
expandSubgraphsChecked: boolean;
onExpandSubgraphsChange: (checked: boolean) => void;
```

On toggle, the checkbox calls **both** `onExpandSubgraphsChange` (parent
rewrites `collapseByLevel`) **and** the popover's existing `savePreference`
(durable write — same debounced-save-plus-flush-on-close path every sibling
checkbox uses). `updatePreference` alone isn't enough: it only writes
in-memory, never calls `.save()`, so writing the preference from the parent
instead would leave persistence to an un-awaited save on app exit that a
crash could lose.

**`GraphDesigner`** (already owns `collapseByLevel`, `levelId`, `preferences`)
adds:
- `expandSubgraphsChecked = collapsedSubgraphs.size === 0` (derived, inline).
- `onExpandSubgraphsChange(checked)` — rewrites `collapseByLevel[levelId]` to
  `new Set()` when checked, or `new Set(allSubgraphIds(levelView))` when
  unchecked. Reads the **raw** `levelView`, never the post-collapse `graph`.
- A `useEffect` that sets the default, keyed on `levelView` and the
  persisted preference, that calls `defaultCollapseForLevel` and is safe to
  re-run: it's a no-op once the level already has a default. The existing
  selection-change effect already resets `collapseByLevel({})` and nulls
  `levelView` on usecase change, so this effect just sets the default again
  once the new level arrives — no ordering change needed.

---

## Error Handling

No new failure modes. `allSubgraphIds` and `defaultCollapseForLevel` are
pure, total functions over already-validated `LevelView` / in-memory state.
A preference-save failure surfaces via the existing toast in
`DisplayOptionsPopover`, unchanged.

---

## Testing Strategy

`graph-designer.tsx` has no render harness (would need mocking
`GraphDesignerStoreContext`, async ELK layout, and the full `@xyflow/react`
tree — not built for the port-visibility work either). Correctness lives in
pure `lib/` functions, unit-tested directly; the thin hook-wiring in
`graph-designer.tsx` is verified by typecheck + manual testing.

- **`allSubgraphIds`**: returns every id; `[]` for empty/absent `subgraphs`.
- **`defaultCollapseForLevel`**: sets default to empty set when `true`, all-ids
  when `false`; **returns the input untouched, same reference, when the
  level is already present** — proves the default can't clobber an
  individual toggle; preserves other levels already in the record.
- **`DisplayOptionsPopover`** (extend `display-options-popover.test.tsx`):
  checkbox reflects `expandSubgraphsChecked`; clicking calls
  `onExpandSubgraphsChange` with the negated value and persists
  `visualization.expandSubgraphs` via the same `savePreference` path
  sibling checkboxes already use.
- **Manual** (`pnpm dev:ui`): fresh load is all-expanded; unchecking
  collapses all subgraphs at the current level, checking re-expands them;
  collapsing one subgraph individually unchecks the box without touching
  the preference; the choice survives an app restart; a level with no
  subgraphs shows checked.

---

## Security Considerations

None — no new inputs or network calls; `expandSubgraphs` already exists in
the preferences schema, only its default changes.

---

## Performance Considerations

`allSubgraphIds` is `O(n)` over a level's subgraphs; `defaultCollapseForLevel`
is `O(n)` on first visit, `O(1)` after via the in-record guard. Both are
negligible next to the `applyCollapses` / layout pipeline that already runs
per render.
