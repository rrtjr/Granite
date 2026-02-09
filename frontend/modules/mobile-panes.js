/**
 * Mobile Panes Module v2 - Modern mobile experience
 *
 * Features:
 * - Bottom Navigation Bar (replaces FAB)
 * - Bottom Sheet for secondary actions (replaces sidebar)
 * - Mobile Header with prominent dirty indicator
 * - Tablet split-view support
 * - Gesture support (swipe to go back)
 * - Keyboard-aware bottom nav
 *
 * Breakpoints:
 * - Phone: ≤768px (single pane, full mobile UI)
 * - Phablet: 769-899px (single pane, enhanced bottom nav)
 * - Tablet: 900-1024px (optional split view)
 * - Desktop: >1024px (full desktop, mobile UI hidden)
 */

import {
    isPhoneDevice,
    isTabletDevice,
    isMobileOrTablet,
    isTabletSplitEnabled
} from './config.js';

console.log('[Mobile] Module v2 loaded');

/**
 * Internal state stored outside Alpine to avoid circular reference issues.
 * Alpine tries to make all mixin properties reactive, which fails for DOM elements.
 */
const _mobileState = {
    initialized: false,
    resizeListenerSet: false,
    keyboardListenerSet: false,
    gestureListenerSet: false,
    keyboardVisible: false,
    // Gesture tracking
    touchStartX: 0,
    touchStartY: 0,
    touchStartTime: 0,
    gestureInProgress: false,
    // Sheet drag tracking
    sheetStartY: 0,
    // Legacy state (for backward compatibility)
    sidebarVisible: false,
    fabButton: null,
    sidebar: null,
    overlay: null,
};

/**
 * Mobile Panes Mixin v2 - Extends the main app with mobile-specific functionality
 */
export const mobilePanesMixin = {

    /**
     * Initialize mobile panes functionality
     * Called from init() - sets up resize listener and initializes if on mobile
     */
    initMobilePanes() {
        console.log('[Mobile] initMobilePanes v2 called, innerWidth:', window.innerWidth);

        // Always set up resize listener (even on desktop) to detect viewport changes
        if (!_mobileState.resizeListenerSet) {
            this._setupMobileResizeListener();
            _mobileState.resizeListenerSet = true;
        }

        // Set up keyboard detection
        if (!_mobileState.keyboardListenerSet) {
            this._setupKeyboardDetection();
            _mobileState.keyboardListenerSet = true;
        }

        // Set up gesture handlers
        if (!_mobileState.gestureListenerSet) {
            this._setupGestureHandlers();
            _mobileState.gestureListenerSet = true;
        }

        // Skip if not on mobile/tablet or already initialized
        if (!isMobileOrTablet() || _mobileState.initialized) {
            return;
        }

        console.log('[Mobile] Initializing mobile panes v2');
        _mobileState.initialized = true;
    },

    /**
     * Toggle view mode on mobile (cycles edit <-> split)
     */
    _toggleMobileViewMode() {
        const pane = this.openPanes && this.openPanes[0];
        if (!pane) return;

        const newMode = pane.viewMode === 'edit' ? 'split' : 'edit';
        if (typeof this.setPaneViewMode === 'function') {
            this.setPaneViewMode(pane.id, newMode);
        }
    },

    /**
     * Set view mode for current pane on mobile
     */
    _setMobileViewMode(mode) {
        const pane = this.openPanes && this.openPanes[0];
        if (!pane) return;

        if (typeof this.setPaneViewMode === 'function') {
            this.setPaneViewMode(pane.id, mode);
        }

        // Close bottom sheet after selection
        this._closeMobileBottomSheet();
    },

    /**
     * Open mobile bottom sheet
     */
    _openMobileBottomSheet() {
        this.mobileBottomSheetOpen = true;
        document.body.style.overflow = 'hidden'; // Prevent background scroll
    },

    /**
     * Close mobile bottom sheet
     */
    _closeMobileBottomSheet() {
        this.mobileBottomSheetOpen = false;
        document.body.style.overflow = '';
    },

    /**
     * Go to homepage (close current pane)
     */
    _goMobileHome() {
        const pane = this.openPanes && this.openPanes[0];

        if (pane) {
            // Close pane (will prompt for save if dirty)
            if (typeof this.closePane === 'function') {
                this.closePane(pane.id);
            }
        }

        // Close bottom sheet if open
        this._closeMobileBottomSheet();

        // Navigate to homepage
        window.history.pushState({ homepageFolder: '' }, '', '/');
    },

    /**
     * Setup keyboard detection for hiding bottom nav
     * Uses visualViewport API for reliable keyboard detection
     */
    _setupKeyboardDetection() {
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', () => {
                const viewportHeight = window.visualViewport.height;
                const windowHeight = window.innerHeight;

                // If viewport is significantly smaller than window, keyboard is likely visible
                const keyboardVisible = (windowHeight - viewportHeight) > 150;

                if (keyboardVisible !== _mobileState.keyboardVisible) {
                    _mobileState.keyboardVisible = keyboardVisible;
                    this.mobileKeyboardVisible = keyboardVisible;
                }
            });
        }
    },

    /**
     * Setup gesture handlers for swipe navigation
     * Only handles edge swipes from left side of screen
     */
    _setupGestureHandlers() {
        // Edge swipe detection threshold (from left edge)
        const EDGE_THRESHOLD = 30;
        // Minimum swipe distance to trigger action
        const MIN_SWIPE_DISTANCE = 100;
        // Maximum vertical deviation
        const MAX_VERTICAL_DEVIATION = 100;
        // Maximum swipe duration (ms)
        const MAX_SWIPE_DURATION = 300;

        document.addEventListener('touchstart', (e) => {
            // Only handle edge swipes (from left edge)
            if (e.touches[0].clientX > EDGE_THRESHOLD) return;

            _mobileState.touchStartX = e.touches[0].clientX;
            _mobileState.touchStartY = e.touches[0].clientY;
            _mobileState.touchStartTime = Date.now();
            _mobileState.gestureInProgress = true;
        }, { passive: true });

        document.addEventListener('touchmove', () => {
            if (!_mobileState.gestureInProgress) return;
            // Could add visual feedback here (e.g., partial page reveal)
        }, { passive: true });

        document.addEventListener('touchend', (e) => {
            if (!_mobileState.gestureInProgress) return;
            _mobileState.gestureInProgress = false;

            const touchEndX = e.changedTouches[0].clientX;
            const touchEndY = e.changedTouches[0].clientY;
            const deltaX = touchEndX - _mobileState.touchStartX;
            const deltaY = Math.abs(touchEndY - _mobileState.touchStartY);
            const duration = Date.now() - _mobileState.touchStartTime;

            // Swipe right gesture: sufficient distance, quick, mostly horizontal
            if (deltaX > MIN_SWIPE_DISTANCE &&
                deltaY < MAX_VERTICAL_DEVIATION &&
                duration < MAX_SWIPE_DURATION) {
                // Go back/home if a note is open
                if (this.openPanes && this.openPanes.length > 0) {
                    this._goMobileHome();
                }
            }
        }, { passive: true });
    },

    /**
     * Handle bottom sheet drag start
     */
    _handleSheetTouchStart(e) {
        _mobileState.sheetStartY = e.touches[0].clientY;
    },

    /**
     * Handle bottom sheet drag move
     */
    _handleSheetTouchMove() {
        // Could implement drag-to-resize sheet here
    },

    /**
     * Handle bottom sheet drag end - dismiss if dragged down
     */
    _handleSheetTouchEnd(e) {
        const deltaY = e.changedTouches[0].clientY - _mobileState.sheetStartY;

        // If dragged down more than 100px, close the sheet
        if (deltaY > 100) {
            this._closeMobileBottomSheet();
        }
    },

    /**
     * Setup resize listener for responsive behavior
     */
    _setupMobileResizeListener() {
        let resizeTimeout;

        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                if (isMobileOrTablet()) {
                    if (!_mobileState.initialized) {
                        this.initMobilePanes();
                    }
                }
            }, 100);
        });
    },

    /**
     * Check if device is phone (for Alpine bindings)
     */
    isPhoneDevice() {
        return isPhoneDevice();
    },

    /**
     * Check if device is tablet (for Alpine bindings)
     */
    isTabletDevice() {
        return isTabletDevice();
    },

    /**
     * Check if device is mobile or tablet (for Alpine bindings)
     */
    isMobileOrTablet() {
        return isMobileOrTablet();
    },

    /**
     * Check if tablet split view should be enabled (for Alpine bindings)
     */
    isTabletSplitEnabled() {
        return isTabletSplitEnabled();
    },

    /**
     * Called when panes change - update mobile UI if needed
     */
    _onMobilePanesChanged() {
        // Mobile UI is now reactive via Alpine, no manual rendering needed
        // This hook is kept for any future non-reactive updates
    },

    // =========================================================================
    // Legacy Methods (kept for backward compatibility, redirect to new system)
    // =========================================================================

    /**
     * Toggle sidebar (legacy) - redirects to bottom sheet
     */
    _toggleMobileSidebar() {
        if (this.mobileBottomSheetOpen) {
            this._closeMobileBottomSheet();
        } else {
            this._openMobileBottomSheet();
        }
    },

    /**
     * Render sidebar (legacy) - no longer needed, Alpine handles reactivity
     */
    _renderMobileSidebar() {
        // No-op: Alpine reactive bindings handle UI updates
    },

    /**
     * Create FAB (legacy) - no longer needed, HTML is in index.html
     */
    _createMobileFAB() {
        // No-op: Bottom nav is now in index.html with Alpine bindings
    },

    /**
     * Create sidebar (legacy) - no longer needed, HTML is in index.html
     */
    _createMobileSidebar() {
        // No-op: Bottom sheet is now in index.html with Alpine bindings
    },

    /**
     * Show mobile elements (legacy) - handled by CSS media queries now
     */
    _showMobileElements() {
        // No-op: CSS media queries handle visibility
    },

    /**
     * Hide mobile elements (legacy) - handled by CSS media queries now
     */
    _hideMobileElements() {
        // No-op: CSS media queries handle visibility
    },

    /**
     * Escape HTML (utility)
     */
    _escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },
};

/**
 * Initialize mobile panes on page load if on mobile device
 */
export function initMobilePanesIfNeeded(app) {
    if (isMobileOrTablet()) {
        app.initMobilePanes();
    }
}

// Re-export device detection functions for use in Alpine bindings and backward compatibility
export {
    isMobileDevice,  // Legacy, use isMobileOrTablet() for new code
    isPhoneDevice,
    isTabletDevice,
    isMobileOrTablet,
    isTabletSplitEnabled,
    isSinglePaneMode
} from './config.js';
