import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

class GlobalErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // You can also log the error to an error reporting service
    console.error('Uncaught error in component tree:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6 text-gray-900 font-sans">
          <div className="bg-white rounded-xl shadow-xl border border-gray-100 p-8 max-w-lg w-full text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-6">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
            <p className="text-gray-500 mb-8">
              We encountered an unexpected error while trying to render this page.
            </p>
            <button
              onClick={this.handleReload}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-medium transition-colors"
            >
              <RefreshCw className="w-5 h-5" />
              Reload Page
            </button>
            {process.env.NODE_ENV === 'development' && (
              <div className="mt-8 text-left w-full bg-gray-50 p-4 rounded-lg border border-gray-200 text-xs text-red-600 overflow-auto max-h-48">
                <p className="font-mono">{this.state.error?.toString()}</p>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children; 
  }
}

export default GlobalErrorBoundary;
