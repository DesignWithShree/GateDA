import React from 'react'
import { ToastProvider } from './components/Toast.jsx'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import '@fontsource-variable/manrope'
import '@fontsource-variable/jetbrains-mono'
import './index.css'

createRoot(document.getElementById('root')).render(
  <ToastProvider><App /></ToastProvider>
)
