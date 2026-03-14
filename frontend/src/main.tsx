import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#0d2040',
            color: '#b8dff0',
            border: '1px solid rgba(100,180,220,0.2)',
            borderRadius: '12px',
            fontFamily: 'Outfit, sans-serif',
            fontSize: '13px',
          },
          success: { iconTheme: { primary: '#5DCAA5', secondary: '#0d2040' } },
          error:   { iconTheme: { primary: '#f09595', secondary: '#0d2040' } },
        }}
      />
    </BrowserRouter>
  </React.StrictMode>
)
