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
     * @param {boolean} showAlert - Whether to show an alert to the user
     */
    handle(operation, error, showAlert = true) {
        // Always log to console for debugging
        console.error(`Failed to ${operation}:`, error);

        // Show user-friendly alert if requested
        if (showAlert) {
            alert(`Failed to ${operation}. Please try again.`);
        }
    }
};
