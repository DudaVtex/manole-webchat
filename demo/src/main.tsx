import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './webchat/App';
import { resolveConfig } from './webchat/config';
import { STYLES } from './webchat/styles';

function mount() {
  if (window.WebchatDemo?.disabled || document.getElementById('agx-webchat-demo')) return;

  const style = document.createElement('style');
  style.setAttribute('data-agx-webchat', '');
  style.textContent = STYLES;
  document.head.appendChild(style);

  const container = document.createElement('div');
  container.id = 'agx-webchat-demo';
  document.body.appendChild(container);
  createRoot(container).render(<App config={resolveConfig()} />);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
else mount();
