/**
 * The new panel replaces the store's old Weni widget (manole.pixel-app-wenichat)
 * in every workspace, master included (launch approved on 2026-11-04). The old
 * widget is torn down with `WebChat.destroy()`, so the visitor has a single
 * socket. To turn the new panel off, use the app setting "Desativar o painel".
 *
 * The old widget is weni-ai/webchat-react v3: `script.js` of the channel calls
 * `WebChat.default.init({ selector: '#wwc', ... })`, and `destroy()` unmounts
 * that React root, whose cleanup disconnects the socket.
 */

type LegacyWebChatApi = {
  destroy?: () => unknown
}

type LegacyWebChatGlobal = LegacyWebChatApi & {
  default?: LegacyWebChatApi
}

type VtexRuntime = {
  workspace?: string
}

const LOG_PREFIX = '[webchat-assistant]'
const MASTER = 'master'

/** How long to wait for the old widget, which loads async after the page. */
const WAIT_FOR_LEGACY_MS = 60000
const POLL_MS = 500

/** The VTEX workspace serving this page (for logs). Unknown counts as master. */
export function currentWorkspace(): string {
  const runtime = (window as unknown as { __RUNTIME__?: VtexRuntime }).__RUNTIME__
  const workspace = runtime && runtime.workspace
  return workspace ? workspace.toLowerCase() : MASTER
}

/** The new channel has priority in every workspace, master included. */
export function newChannelHasPriority(): boolean {
  return true
}

function legacyApi(): LegacyWebChatApi | undefined {
  const global = (window as unknown as { WebChat?: LegacyWebChatGlobal }).WebChat
  if (!global) return undefined
  if (global.default && typeof global.default.destroy === 'function') return global.default
  if (typeof global.destroy === 'function') return global
  return undefined
}

function legacyIsMounted(): boolean {
  const host = document.getElementById('wwc')
  return !!host && host.childElementCount > 0
}

/**
 * Destroys the old widget if it is mounted. Awaits `destroy()` in case it
 * returns a promise. Never throws.
 */
export async function destroyLegacyWidget(): Promise<boolean> {
  if (!legacyIsMounted()) return false
  const api = legacyApi()
  if (!api || !api.destroy) return false
  try {
    await Promise.resolve(api.destroy())
    console.info(`${LOG_PREFIX} widget antigo destruído no workspace "${currentWorkspace()}"`)
    return true
  } catch (error) {
    console.warn(`${LOG_PREFIX} falha ao destruir o widget antigo`, error)
    return false
  }
}

/**
 * Waits for the old widget to mount, destroys it, and destroys it again if
 * it ever re-mounts into #wwc. Returns a cleanup function.
 */
export function keepLegacyWidgetDestroyed(): () => void {
  if (!newChannelHasPriority()) return () => undefined

  let stopped = false
  let busy = false
  let observer: MutationObserver | null = null

  const attempt = async () => {
    if (stopped || busy) return
    busy = true
    try {
      await destroyLegacyWidget()
    } finally {
      busy = false
    }
    watchHost()
  }

  // Once #wwc exists, react to anything mounted into it.
  const watchHost = () => {
    if (stopped || observer) return
    const host = document.getElementById('wwc')
    if (!host) return
    observer = new MutationObserver(() => {
      if (legacyIsMounted()) attempt()
    })
    observer.observe(host, { childList: true })
  }

  const startedAt = Date.now()
  const timer = window.setInterval(() => {
    if (stopped || Date.now() - startedAt > WAIT_FOR_LEGACY_MS) {
      window.clearInterval(timer)
      return
    }
    attempt()
  }, POLL_MS)
  attempt()

  return () => {
    stopped = true
    window.clearInterval(timer)
    if (observer) observer.disconnect()
  }
}
