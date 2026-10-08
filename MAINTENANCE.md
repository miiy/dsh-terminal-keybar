# Maintenance

This plugin deliberately copies no terminal code: it is a thin Client-half bundle that
talks to documented DSH services. Everything it depends on is listed here, together
with what breaks when upstream changes it — that table plus the diff procedure below is
the whole adaptation guide.

## What it depends on

| Dependency | Upstream location | Symptom when it changes |
|---|---|---|
| `window.__ModuleLoader__.load({ id, factory })`, `id` equal to the package name | Web client module loader (`packages/client/modules`) | the Client half never activates |
| `ctx.slots.inject` / `ctx.slots.register({ name, id, locale, inject }, C)` | `packages/client/ui-slots` | fails at load (undeclared slot / invalid options) |
| slot name `shell.overlay` (list, root scope) | `packages/client/ui-layout` | fails at load |
| `inject` face `hooks: { <name>: observable }` → component prop `use<Name>` | `packages/client/ui-slots` renderer | component renders without the hook and throws |
| `locale: '<ns>'` injecting `t`; `ctx.locale.register(ns, { zh, en })` | `packages/client/locale` | button labels degrade to raw keys or blank |
| `ctx.sidebarRight.mounted` (`ObservableSnapshot<SessionId \| undefined>`) | `packages/client/ui-sidebar-right` | service never arrives → Client half stays PENDING (**no bar and no error**) |
| `ctx.sidebarRight.openTabs.subscribe` | same | the bar stops updating after a tab switch |
| `ctx.sidebarRight.active()` → `TabRecord` fields `.id` `.kind` `.contentId` | same | the bar shows but presses do nothing |
| `ctx.webTerminals.view(sessionId, key, contentId)` → `TerminalView` | `packages/api/terminal-controller` | fails at load; if `key` semantics change, a second view is created that fights for the attachment (the terminal turns read-only and asks to "take control") |
| `TerminalView.write(data)` (ignores input while the attachment is not writable) | same | keys do nothing |
| `react-dom` `createPortal` is a baseline module | `packages/client/web/src/platform.ts` (`PLATFORM_MODULES`) | fails at load |
| Layer order: `shell.overlay` = 20, fullscreen right panel = 40 | `AppFrame.module.css`, `SidebarRight.module.css` | if upstream lifts the overlay above 40, the portal can go; if the panel goes higher, raise the bar's `zIndex` (1000) |
| Theme tokens `--dsw-alias-bg-overlay`, `-bg-layer-2`, `-border-l1`, `-label-primary` | `packages/client/ui-theme` | cosmetic only; renamed tokens never break rendering |

**The one hard constraint**: `key` must equal the occurrence key the terminal body
registered its model under — that is `TabRecord.id` from `ctx.sidebarRight.active()`.
`webTerminals.view()` caches by `(sessionId, key)` and returns the **same**
`TerminalView`; a different key creates a second view that steals the attachment.

**Why the portal**: the bar registers on the `shell.overlay` seat but renders into
`document.body`. On a viewport narrower than 768px the right sidebar presents fullscreen
and raises the dockkit layer to z-index 40, above the overlay layer's 20 — an element
painted inside that layer is covered by the very terminal it serves. Menus, modals and
toasts in this shell portal for the same reason.

## After upgrading DSH

```sh
# 1. See what upstream moved (other files are irrelevant to this plugin)
git -C <dsh-checkout> log --oneline <old>..<new> -- \
  packages/client/ui-sidebar-right/src/client/service.ts \
  packages/client/ui-sidebar-right/src/client/shell/SidebarRight.module.css \
  packages/client/ui-slots/src/index.ts \
  packages/api/terminal-controller/src/client/index.ts \
  packages/client/ui-layout/src/client/AppFrame.module.css \
  packages/client/web/src/platform.ts

# 2. Fix the matching few lines in client.js against the table above

# 3. Self-check
node --check client.js && node --check index.js
node -e "JSON.parse(require('fs').readFileSync('package.json','utf8'))"

# 4. Reinstall, then reload the page; if a replaced package does not hot-reload,
#    restart dsh web to load a fresh JavaScript module generation
#    plugin_manager: install_bundle, target = this directory
```

## Smoke test

On the phone: open a terminal → tap `↑` → the previous history entry appears; tap `^C`
→ the running command is interrupted; tap `↵` → the command runs.

If the bar is missing, turn on the `DEBUG` switch at the top of `client.js`:

- **no badge at all** → the Client half did not load or activate (a service or slot name changed, or the page is old); check that the `terminal-keybar` seat is live
- **badge present** → it prints `touch`, `tp` (maxTouchPoints), `mounted`, `expanded`, `kind`, `w` (viewport width) and `kb` (keyboard inset); whichever value is 0/`none` is the failing condition

Turn `DEBUG` back off when done — it is off by default.
