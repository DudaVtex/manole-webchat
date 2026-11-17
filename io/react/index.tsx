import React from 'react'
import ReactDOM from 'react-dom'
import { canUseDOM } from 'vtex.render-runtime'

import App from './webchat/App'
import { resolveConfig } from './webchat/config'
import { STYLES } from './webchat/styles'
import { keepLegacyWidgetDestroyed, newChannelHasPriority } from './legacyWidget'

/**
 * Inside the store the panel is on the store's own origin: it writes the VTEX
 * session into the contact (as the official widget does), adds to the real
 * cart and reads the catalog directly.
 */
const IO_DEFAULTS = {
  collectVtexFields: true,
  cartMode: 'vtex' as const,
  catalogVia: 'store' as const,
}

const HOST_ID = 'webchat-assistant-host'

function injectStyles() {
  if (document.querySelector('style[data-agx-webchat]')) return
  const style = document.createElement('style')
  style.setAttribute('data-agx-webchat', '')
  style.textContent = STYLES
  document.head.appendChild(style)
}

/**
 * The store's `pixels` slot loads this module but never renders its React
 * component (measured on webchatteste: module in __RENDER_8_COMPONENTS__, no
 * panel in the DOM). So the panel mounts its own React root as soon as the
 * module runs, the way pixel apps run their code on load.
 *
 * The panel replaces the old Weni widget in every workspace (legacyWidget.ts).
 */
function boot() {
  if (!canUseDOM) return
  if (document.getElementById(HOST_ID)) return
  if (window.WebchatDemo?.disabled) return
  if (!newChannelHasPriority()) return

  keepLegacyWidgetDestroyed()
  injectStyles()

  const host = document.createElement('div')
  host.id = HOST_ID
  document.body.appendChild(host)
  ReactDOM.render(<App config={{ ...resolveConfig(), ...IO_DEFAULTS }} />, host)
}

if (canUseDOM) {
  if (document.body) boot()
  else document.addEventListener('DOMContentLoaded', boot)
}

/** Kept for the block declaration; the panel lives in its own root (boot). */
function WebchatAssistant() {
  return null
}

export default WebchatAssistant
