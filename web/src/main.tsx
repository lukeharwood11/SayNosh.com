import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { captureAppException } from '@/lib/posthog-error-reporting.ts'
import { PostHogRoot } from './providers/PostHogRoot.tsx'

const posthogToken = import.meta.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN

const rootOptions =
  posthogToken ?
    {
      onUncaughtError(error: unknown, errorInfo: { componentStack?: string }) {
        console.error(error)
        captureAppException(error, {
          react_error_handler: 'onUncaughtError',
          component_stack: errorInfo.componentStack,
        })
      },
      onRecoverableError(error: unknown, errorInfo: { componentStack?: string }) {
        console.error(error)
        captureAppException(error, {
          react_error_handler: 'onRecoverableError',
          component_stack: errorInfo.componentStack,
        })
      },
    }
  : undefined

createRoot(document.getElementById('root')!, rootOptions).render(
  <StrictMode>
    <PostHogRoot>
      <App />
    </PostHogRoot>
  </StrictMode>,
)

if ('serviceWorker' in navigator) {
  import('virtual:pwa-register').then(({ registerSW }) => {
    registerSW({ immediate: true })
  })
}
