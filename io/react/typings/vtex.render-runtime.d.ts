declare module 'vtex.render-runtime' {
  export const canUseDOM: boolean
}

// react-dom ships with IO's react builder; only `render` is used here.
declare module 'react-dom' {
  import { ReactElement } from 'react'
  export function render(element: ReactElement, container: Element): void
  const ReactDOM: { render: typeof render }
  export default ReactDOM
}
