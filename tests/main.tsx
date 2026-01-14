/// <reference lib="dom" />
import React from 'react'
import ReactDOM from 'react-dom/client'
import { PurchaseWidget } from './react-example'
import '@pulse-js/react/devtools'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <div style={{ padding: '20px' }}>
        <h1>Pulse React Example</h1>
        <PurchaseWidget />
    </div>
  </React.StrictMode>,
)
