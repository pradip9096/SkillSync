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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import './index.css'
import App from './App.jsx'

// Initialize the query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
})

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
    <QueryClientProvider client={queryClient}>
      <App />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </StrictMode>,
)
