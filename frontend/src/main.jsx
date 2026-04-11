/**
 * main.jsx — React entry point
 * Mounts <App /> into #root (see index.html)
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Google Fonts are already loaded in index.html (Space Mono + Syne)
// Global body reset
document.body.style.cssText = 'margin:0;padding:0;box-sizing:border-box;';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
