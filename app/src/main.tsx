import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode><App /></StrictMode>,
);

window.addEventListener('load', () => {
  // Optional chaining rather than an `in` check: some embedded webviews expose
  // the key with an undefined value, which passes `in` and then throws.
  navigator.serviceWorker?.register('./sw.js').catch(() => {
    // Offline support is a bonus; the app works without it.
  });
});
