// Granite Frontend - Configuration Constants and Error Handler

// Configuration constants
export const CONFIG = {
    AUTOSAVE_DELAY: 1000,              // ms - Delay before triggering autosave
    SAVE_INDICATOR_DURATION: 2000,     // ms - How long to show "saved" indicator
    SCROLL_SYNC_DELAY: 50,             // ms - Delay to prevent scroll sync interference
    SCROLL_SYNC_MAX_RETRIES: 10,       // Maximum attempts to find editor/preview elements
    SCROLL_SYNC_RETRY_INTERVAL: 100,   // ms - Time between setupScrollSync retries
    MAX_UNDO_HISTORY: 50,              // Maximum number of undo steps to keep
    DEFAULT_SIDEBAR_WIDTH: 256,        // px - Default sidebar width (w-64 in Tailwind)
};

// Centralized error handling
export const ErrorHandler = {
    /**
     * Handle errors consistently across the app
     * @param {string} operation - The operation that failed (e.g., "load notes", "save note")
     * @param {Error} error - The error object
     * @param {boolean} showToast - Whether to show a toast notification to the user
     */
    handle(operation, error, showToast = true) {
        // Always log to console for debugging
        console.error(`Failed to ${operation}:`, error);

        // Show user-friendly toast notification if requested
        if (showToast && window.noteAppInstance?.addToast) {
            window.noteAppInstance.addToast(`Failed to ${operation}. Please try again.`, 'error', 5000);
        }
    },

    /**
     * Show a success message to the user
     * @param {string} message - The success message to display
     */
    success(message) {
        if (window.noteAppInstance?.addToast) {
            window.noteAppInstance.addToast(message, 'success', 3000);
        }
    },

    /**
     * Show a warning message to the user
     * @param {string} message - The warning message to display
     */
    warn(message) {
        console.warn(message);
        if (window.noteAppInstance?.addToast) {
            window.noteAppInstance.addToast(message, 'warning', 4000);
        }
    },

    /**
     * Show an info message to the user
     * @param {string} message - The info message to display
     */
    info(message) {
        if (window.noteAppInstance?.addToast) {
            window.noteAppInstance.addToast(message, 'info', 3000);
        }
    }
};
