/**
 * @file main.jsx
 * @description Entry point for the React frontend application.
 * 
 * Purpose: Mounts the React application to the DOM and initializes the root.
 * Inputs: None (reads from 'root' element in index.html).
 * Outputs: Renders the App component tree to the DOM.
 * Side Effects: Modifies the DOM by injecting the React application into the element with ID 'root'.
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

/**
 * Initializes and renders the React application.
 * 
 * Purpose: Creates a React root and renders the App component within StrictMode.
 * Parameters: None.
 * Return value: void.
 * Side effects: Injects the React component tree into the DOM.
 */
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
