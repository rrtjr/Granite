// Granite Frontend - Configuration Constants and Error Handler

// Debug mode flag - will be set from backend config
let debugModeEnabled = false;

/**
 * Set the debug mode flag (called when config is loaded from backend)
 * @param {boolean} enabled - Whether debug mode is enabled
 */
export function setDebugMode(enabled) {
    debugModeEnabled = enabled;
    if (enabled) {
        console.log('[Debug] Debug mode enabled - logging active');
    }
}

/**
 * Check if debug mode is enabled
 * @returns {boolean} Whether debug mode is enabled
 */
export function isDebugMode() {
    return debugModeEnabled;
}

/**
 * Debug logger - only logs when debug mode is enabled
 * Use this instead of console.log for all debug output
 */
export const Debug = {
    /**
     * Log a debug message (only when debug mode is enabled)
     * @param {...any} args - Arguments to log
     */
    log(...args) {
        if (debugModeEnabled) {
            console.log(...args);
        }
    },

    /**
     * Log a warning (only when debug mode is enabled)
     * @param {...any} args - Arguments to log
     */
    warn(...args) {
        if (debugModeEnabled) {
            console.warn(...args);
        }
    },

    /**
     * Log an error (only when debug mode is enabled)
     * @param {...any} args - Arguments to log
     */
    error(...args) {
        if (debugModeEnabled) {
            console.error(...args);
        }
    },

    /**
     * Log debug info with a prefix (only when debug mode is enabled)
     * @param {string} prefix - Prefix for the log message
     * @param {...any} args - Arguments to log
     */
    info(prefix, ...args) {
        if (debugModeEnabled) {
            console.log(`[${prefix}]`, ...args);
        }
    },

    /**
     * Log a group of related messages (only when debug mode is enabled)
     * @param {string} label - Group label
     * @param {Function} callback - Function that contains console.log calls
     */
    group(label, callback) {
        if (debugModeEnabled) {
            console.group(label);
            callback();
            console.groupEnd();
        }
    }
};

// Configuration constants
export const CONFIG = {
    AUTOSAVE_DELAY: 1000,              // ms - Delay before triggering autosave
    SAVE_INDICATOR_DURATION: 2000,     // ms - How long to show "saved" indicator
    SCROLL_SYNC_DELAY: 50,             // ms - Delay to prevent scroll sync interference
    SCROLL_SYNC_MAX_RETRIES: 10,       // Maximum attempts to find editor/preview elements
    SCROLL_SYNC_RETRY_INTERVAL: 100,   // ms - Time between setupScrollSync retries
    MAX_UNDO_HISTORY: 50,              // Maximum number of undo steps to keep
    DEFAULT_SIDEBAR_WIDTH: 256,        // px - Default sidebar width (w-64 in Tailwind)
    MOBILE_BREAKPOINT: 768,            // px - Max width for mobile layout (legacy)
    // Responsive breakpoints
    BREAKPOINT_PHONE: 768,             // px - Phone/small mobile (single pane)
    BREAKPOINT_TABLET: 900,            // px - Tablet (optional split view)
    BREAKPOINT_DESKTOP: 1024,          // px - Desktop (full multi-pane)
};

/**
 * Check if current device is mobile (phone)
 * Defined here to avoid circular imports between panes.js and mobile-panes.js
 */
export function isMobileDevice() {
    return window.innerWidth <= CONFIG.MOBILE_BREAKPOINT;
}

/**
 * Check if current device is a phone (≤768px)
 */
export function isPhoneDevice() {
    return window.innerWidth <= CONFIG.BREAKPOINT_PHONE;
}

/**
 * Check if current device is a tablet (769-1024px)
 */
export function isTabletDevice() {
    return window.innerWidth > CONFIG.BREAKPOINT_PHONE &&
           window.innerWidth <= CONFIG.BREAKPOINT_DESKTOP;
}

/**
 * Check if current device is mobile or tablet (≤1024px)
 * This is the main check for showing mobile UI components
 */
export function isMobileOrTablet() {
    return window.innerWidth <= CONFIG.BREAKPOINT_DESKTOP;
}

/**
 * Check if tablet split view should be enabled (900-1024px)
 */
export function isTabletSplitEnabled() {
    return window.innerWidth >= CONFIG.BREAKPOINT_TABLET &&
           window.innerWidth <= CONFIG.BREAKPOINT_DESKTOP;
}

/**
 * Check if single-pane mode should be enforced (phones and phablets, <900px)
 * Used by panes.js to determine if only one pane should be open
 */
export function isSinglePaneMode() {
    return window.innerWidth < CONFIG.BREAKPOINT_TABLET;
}

// Centralized error handling
export const ErrorHandler = {
    /**
     * Handle errors consistently across the app
     * @param {string} operation - The operation that failed (e.g., "load notes", "save note")
     * @param {Error} error - The error object
     * @param {boolean} showToast - Whether to show a toast notification to the user
     */
    handle(operation, error, showToast = true) {
        // Only log to console when debug mode is enabled
        if (debugModeEnabled) {
            console.error(`Failed to ${operation}:`, error);
        }

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
        if (debugModeEnabled) {
            console.warn(message);
        }
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
