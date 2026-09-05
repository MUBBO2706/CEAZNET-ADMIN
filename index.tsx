import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// --- Global Error Handling ---

const originalWarn = console.warn;
console.warn = (...args) => {
    // Silence Recharts transient layout warnings
    if (typeof args[0] === 'string' && args[0].includes('The width(') && args[0].includes('and height(')) {
        return;
    }
    originalWarn(...args);
};

// Catch unhandled promise rejections (e.g., from transient network drops, aborted queries, or third-party SDK background tasks)
window.addEventListener('unhandledrejection', event => {
  event.preventDefault?.();
  const reason = event.reason;
  const message = reason?.message || (typeof reason === 'string' ? reason : JSON.stringify(reason || ''));
  console.warn('Ceaznet Admin - Handled background promise rejection:', message);
});

// Catch other synchronous JavaScript errors that might not be in the React tree
window.onerror = (message, source, lineno, colno, error) => {
    console.warn('Ceaznet Admin - Handled Global Error:', {
        message,
        source,
        lineno,
        colno,
        error
    });
    return true; 
};


const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);