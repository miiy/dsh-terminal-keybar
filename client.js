/**
 * Touch key bar for the DSH Web terminal.
 *
 * A phone's soft keyboard has no Escape, Tab, Ctrl or arrow keys, and the DSH
 * terminal has no on-screen replacement. This Client-half plugin floats a
 * translucent column of those keys on the right edge of the screen while the
 * right Sidebar's active tab is a terminal, and writes the byte sequences
 * through the public Client terminal service.
 *
 * The column is portalled to `document.body`, beside `#root`, instead of being
 * painted inside the `shell.overlay` layer it registers on. That layer sits at
 * z-index 20 while a viewport narrower than 768px presents the right panel with
 * the dock layer raised to 40, so an element inside it is covered by the very
 * terminal it serves. Menus, modals and toasts in this shell portal for the
 * same reason.
 *
 * It copies no terminal code. Every upstream name it depends on is listed in
 * MAINTENANCE.md, so an upstream upgrade can be adapted from that list alone.
 */
window.__ModuleLoader__.load({
  id: 'dsh-terminal-keybar',
  factory(require) {
    const React = require('react')
    const { createPortal } = require('react-dom')
    const h = React.createElement

    /**
     * Diagnosis switch, off in normal use.
     *
     * While true the seat also paints a badge with the live gate inputs, so a
     * device whose bar does not appear reports which condition failed. Turn it
     * back on when the bar stops showing after an upgrade.
     */
    const DEBUG = false

    /** Locale namespace of this plugin's copy. */
    const NS = 'terminalKeybar'

    /** Simplified Chinese copy. */
    const zh = {
      label: '终端按键',
      'aria.escape': 'Escape',
      'aria.tab': 'Tab',
      'aria.enter': '回车',
      'aria.interrupt': 'Control-C（中断）',
      'aria.up': '上方向键',
      'aria.down': '下方向键',
      'aria.left': '左方向键',
      'aria.right': '右方向键',
    }

    /** English copy. */
    const en = {
      label: 'Terminal keys',
      'aria.escape': 'Escape',
      'aria.tab': 'Tab',
      'aria.enter': 'Enter',
      'aria.interrupt': 'Control-C (interrupt)',
      'aria.up': 'Arrow up',
      'aria.down': 'Arrow down',
      'aria.left': 'Arrow left',
      'aria.right': 'Arrow right',
    }

    /**
     * One row key: the glyph the user reads, the accessible name key, and the
     * bytes a terminal expects.
     *
     * The arrow sequences are the CSI forms (`ESC [ A`…). An application in
     * DECCKM would expect the SS3 forms (`ESC O A`…), which this plugin cannot
     * read; readline and vim accept both, so the row stays usable there.
     */
    const KEYS = [
      { id: 'escape', text: 'Esc', data: '\u001b' },
      { id: 'tab', text: 'Tab', data: '\t' },
      { id: 'enter', text: '\u21b5', data: '\r' },
      { id: 'interrupt', text: '^C', data: '\u0003' },
      { id: 'up', text: '\u2191', data: '\u001b[A' },
      { id: 'down', text: '\u2193', data: '\u001b[B' },
      { id: 'left', text: '\u2190', data: '\u001b[D' },
      { id: 'right', text: '\u2192', data: '\u001b[C' },
    ]

    /** Height of one key button and the gap between them; the column is sized from these. */
    const KEY_HEIGHT = 34
    const KEY_GAP = 3

    /** Rendered column height, which decides where it centres when the keyboard shrinks the view. */
    const BAR_HEIGHT = KEYS.length * KEY_HEIGHT + (KEYS.length - 1) * KEY_GAP + 6

    /** Host theme tokens only: the bar follows light, dark and token overrides. */
    const styles = {
      bar: {
        position: 'fixed',
        // Clear of the notch/rounded corner on a phone held either way.
        right: 'max(8px, env(safe-area-inset-right))',
        // `top` is computed from the visible box and centres the column in it.
        transform: 'translateY(-50%)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        gap: KEY_GAP,
        padding: 3,
        border: '1px solid var(--dsw-alias-border-l1)',
        borderRadius: 10,
        background: 'var(--dsw-alias-bg-overlay)',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.18)',
        // A translucent accessory column: the terminal stays readable behind it.
        opacity: 0.62,
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        // `shell.overlay` is a click-through layer: an entry opts back in.
        pointerEvents: 'auto',
        userSelect: 'none',
        touchAction: 'manipulation',
      },
      key: {
        width: 40,
        height: KEY_HEIGHT,
        padding: 0,
        border: '1px solid var(--dsw-alias-border-l1)',
        borderRadius: 7,
        background: 'var(--dsw-alias-bg-layer-2)',
        color: 'var(--dsw-alias-label-primary)',
        font: 'inherit',
        fontSize: 13,
        lineHeight: 1,
        cursor: 'pointer',
        touchAction: 'manipulation',
      },
      badge: {
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 2147483000,
        maxWidth: '100vw',
        padding: '2px 6px',
        overflow: 'hidden',
        background: '#b00020',
        color: '#ffffff',
        fontFamily: 'ui-monospace, monospace',
        fontSize: 11,
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
      },
    }

    /**
     * The box the user can actually see, in layout-viewport coordinates.
     *
     * iOS Safari does not resize the layout viewport for the on-screen keyboard,
     * so a fixed element centred on the window would sit behind it. Centring on
     * the visual viewport keeps the column inside the visible area while the
     * user types; without the API the whole window is visible.
     * @returns the visible box, `{ top, height }`.
     */
    function useViewportBox() {
      const read = () => {
        const viewport = window.visualViewport
        return viewport === undefined
          ? { top: 0, height: window.innerHeight }
          : { top: Math.round(viewport.offsetTop), height: Math.round(viewport.height) }
      }
      const [box, setBox] = React.useState(read)
      React.useEffect(() => {
        const viewport = window.visualViewport
        if (viewport === undefined) return undefined
        const update = () => setBox((current) => {
          const next = read()
          return current.top === next.top && current.height === next.height ? current : next
        })
        update()
        viewport.addEventListener('resize', update)
        viewport.addEventListener('scroll', update)
        return () => {
          viewport.removeEventListener('resize', update)
          viewport.removeEventListener('scroll', update)
        }
      }, [])
      return box
    }

    /**
     * The floating key row.
     * @param props - the terminal target hook, the byte sender, the diagnosis
     *   probe and the locale seat.
     * @returns the key row on a touch device while a terminal is the active tab,
     *   plus the diagnosis badge while `DEBUG` is on.
     */
    function KeyBar({ useTerminal, press, probe, t }) {
      const target = typeof useTerminal === 'function' ? useTerminal(value => value) : null
      const [touch] = React.useState(() => {
        if (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) return true
        return typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0
      })
      const box = useViewportBox()
      const bar = touch && target !== null
        ? h('div', {
          role: 'group',
          'aria-label': t('label'),
          'data-terminal-keybar': '',
          style: { ...styles.bar, top: Math.round(box.top + Math.max(box.height, BAR_HEIGHT) / 2) },
        }, KEYS.map(key => h('button', {
          key: key.id,
          type: 'button',
          style: styles.key,
          'aria-label': t(`aria.${key.id}`),
          // pointerdown, not click: the terminal's textarea keeps focus, so the
          // soft keyboard stays open and the bytes precede any blur teardown.
          onPointerDown: (event) => {
            event.preventDefault()
            press(key.data)
          },
        }, key.text)))
        : null
      if (!DEBUG || typeof probe !== 'function') return portal(bar)
      const info = probe()
      return portal(h(React.Fragment, null, bar, h('div', {
        'data-terminal-keybar-debug': '',
        style: styles.badge,
      }, `kb touch=${touch ? 1 : 0} tp=${String(info.points)} mounted=${info.mounted ? 1 : 0}`
        + ` expanded=${info.expanded ? 1 : 0} kind=${String(info.kind)} w=${String(info.width)} kb=${String(info.keyboard)}`)))
    }

    /**
     * Mount the bar beside `#root`, above the fullscreen right panel.
     * @param content - the rendered entries, or null while nothing shows.
     * @returns the portal, or null so an empty state adds no body child.
     */
    function portal(content) {
      return content === null ? null : createPortal(content, document.body)
    }

    return {
      inject: ['slots', 'locale', 'sidebarRight', 'webTerminals'],
      /**
       * Register the copy and the frame-wide seat, and keep the seat's terminal
       * target current.
       * @param ctx - Client root Context with the sidebar, terminal and slot services.
       */
      apply(ctx) {
        /** Last published target; a new object only when the target moves. */
        let published = null
        const listeners = new Set()

        /**
         * The terminal the bar speaks to: the active tab of the mounted seat,
         * carrying the same occurrence key its body used, so the service hands
         * back that body's own view instead of a second one.
         *
         * The seat's own `isExpanded()` is deliberately not part of the gate: a
         * viewport narrower than 768px presents an expanded panel fullscreen,
         * where that flag is not what tells the two apart.
         * @returns a stable target object, or null when no terminal is active.
         */
        const read = () => {
          const sessionId = ctx.sidebarRight.mounted.getSnapshot()
          if (sessionId === undefined) return null
          const tab = ctx.sidebarRight.active()
          if (tab === undefined || tab.kind !== 'terminal') return null
          if (published !== null && published.sessionId === sessionId && published.tabId === tab.id) return published
          return { sessionId, tabId: tab.id, contentId: tab.contentId }
        }

        /** Re-read the layout and notify only when the target actually moved. */
        const recompute = () => {
          const next = read()
          if (next === published) return
          published = next
          for (const listener of listeners) listener()
        }
        recompute()

        /**
         * Report the live gate inputs to the diagnosis badge.
         * @returns the values the bar's visibility is decided from.
         */
        const probe = () => {
          const sessionId = ctx.sidebarRight.mounted.getSnapshot()
          const tab = sessionId === undefined ? undefined : ctx.sidebarRight.active()
          const viewport = window.visualViewport
          return {
            points: typeof navigator === 'undefined' ? -1 : navigator.maxTouchPoints,
            mounted: sessionId !== undefined,
            expanded: ctx.sidebarRight.isExpanded(),
            kind: tab === undefined ? 'none' : String(tab.kind),
            width: window.innerWidth,
            keyboard: viewport === undefined
              ? -1
              : Math.round(window.innerHeight - viewport.height - viewport.offsetTop),
          }
        }

        /**
         * Send one key sequence to the terminal the user is looking at.
         * @param data - the bytes to write; `TerminalView.write` ignores them
         *   while the attachment is not writable (another page owns input).
         */
        const press = (data) => {
          recompute()
          if (published === null) return
          ctx.webTerminals.view(published.sessionId, published.tabId, published.contentId).write(data)
        }

        /** The target observable the renderer binds to `useTerminal`. */
        const terminal = {
          getSnapshot: () => published,
          subscribe: (listener) => {
            listeners.add(listener)
            return () => { listeners.delete(listener) }
          },
        }

        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'terminal-keybar: copy')
        ctx.effect(() => {
          const stopMounted = ctx.sidebarRight.mounted.subscribe(recompute)
          const stopTabs = ctx.sidebarRight.openTabs.subscribe(recompute)
          return () => { stopMounted(); stopTabs() }
        }, 'terminal-keybar: layout sources')
        ctx.effect(() => {
          // Tab switches, pane focus and expand/collapse all begin with a
          // pointer gesture; re-reading once after it lands covers the layout
          // commits the services publish on no observable of their own. The
          // interval is the safety net for a change neither path reports.
          let frame = 0
          const schedule = () => {
            if (frame !== 0) return
            frame = requestAnimationFrame(() => { frame = 0; recompute() })
          }
          document.addEventListener('pointerdown', schedule, true)
          document.addEventListener('pointerup', schedule, true)
          window.addEventListener('resize', schedule)
          const interval = window.setInterval(recompute, 1000)
          return () => {
            document.removeEventListener('pointerdown', schedule, true)
            document.removeEventListener('pointerup', schedule, true)
            window.removeEventListener('resize', schedule)
            window.clearInterval(interval)
            if (frame !== 0) cancelAnimationFrame(frame)
          }
        }, 'terminal-keybar: layout re-reads')
        ctx.effect(() => ctx.slots.inject('shell.overlay', () => ctx.slots.register({
          name: 'shell.overlay', id: 'terminal-keybar', locale: NS,
          inject: () => ({ hooks: { terminal }, press, probe }),
        }, KeyBar)), 'terminal-keybar: seat')
        // Diagnosis marker: its presence in the live slot proves this build
        // reached the page. It renders nothing and goes away with DEBUG.
        if (DEBUG) {
          ctx.effect(() => ctx.slots.inject('shell.overlay', () => ctx.slots.register({
            name: 'shell.overlay', id: 'terminal-keybar.debug',
          }, () => null)), 'terminal-keybar: debug marker')
        }
      },
    }
  },
})
