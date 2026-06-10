import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// --- Global Error Handling ---

// Catch unhandled promise rejections (e.g., from async functions, like Supabase calls)
window.addEventListener('unhandledrejection', event => {
  console.error('Ceaznet Admin - Unhandled Promise Rejection:', event.reason);
});

// Catch other synchronous JavaScript errors that might not be in the React tree
window.onerror = (message, source, lineno, colno, error) => {
    console.error('Ceaznet Admin - Global Unhandled Error:', {
        message,
        source,
        lineno,
        colno,
        error
    });
    // We are already logging it, so this avoids duplicate messages in some browsers.
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