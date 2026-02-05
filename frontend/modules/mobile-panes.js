/**
 * Mobile Panes Module - Simplified single-pane mobile experience
 *
 * Features:
 * - Single pane only on phones (replaces instead of stacking)
 * - Floating action button (FAB) to toggle toolbar
 * - Slide-in toolbar with view mode selector
 * - Maximum screen real estate for content
 *
 * This module only activates on mobile devices (≤768px) and does NOT affect desktop/tablet.
 */

// Breakpoint for mobile vs desktop
const MOBILE_BREAKPOINT = 768;

/**
 * Check if current device is mobile (phone)
 */
function isMobileDevice() {
    return window.innerWidth <= MOBILE_BREAKPOINT;
}

/**
 * Internal state stored outside Alpine to avoid circular reference issues.
 * Alpine tries to make all mixin properties reactive, which fails for DOM elements.
 */
const _mobileState = {
    initialized: false,
    toolbarVisible: false,
    fabButton: null,
    toolbar: null,
};

/**
 * Mobile Panes Mixin - Extends the main app with mobile-specific functionality
 */
export const mobilePanesMixin = {

    /**
     * Initialize mobile panes functionality
     * Called from init() if on mobile device
     */
    initMobilePanes() {
        if (!isMobileDevice() || _mobileState.initialized) {
            return;
        }

        if (window.GRANITE_DEBUG) {
            console.log('[Granite Mobile] Initializing mobile panes (simplified)');
        }

        _mobileState.initialized = true;

        // Create FAB and toolbar elements
        this._createMobileFAB();
        this._createMobileToolbar();

        // Setup resize listener
        this._setupMobileResizeListener();

        // Initial render if pane exists
        this._renderMobileToolbar();
    },

    /**
     * Create the floating action button (FAB)
     */
    _createMobileFAB() {
        if (document.querySelector('.mobile-fab')) return;

        const fab = document.createElement('button');
        fab.className = 'mobile-fab';
        fab.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
        fab.setAttribute('aria-label', 'Toggle toolbar');

        fab.addEventListener('click', () => this._toggleMobileToolbar());

        document.body.appendChild(fab);
        _mobileState.fabButton = fab;
    },

    /**
     * Create the slide-in toolbar
     */
    _createMobileToolbar() {
        if (document.querySelector('.mobile-toolbar')) return;

        const toolbar = document.createElement('div');
        toolbar.className = 'mobile-toolbar';

        document.body.appendChild(toolbar);
        _mobileState.toolbar = toolbar;
    },

    /**
     * Toggle toolbar visibility
     */
    _toggleMobileToolbar() {
        _mobileState.toolbarVisible = !_mobileState.toolbarVisible;

        if (_mobileState.toolbar) {
            _mobileState.toolbar.classList.toggle('visible', _mobileState.toolbarVisible);
        }
        if (_mobileState.fabButton) {
            _mobileState.fabButton.classList.toggle('toolbar-open', _mobileState.toolbarVisible);
        }

        if (_mobileState.toolbarVisible) {
            this._renderMobileToolbar();
        }
    },

    /**
     * Render/update the mobile toolbar content
     */
    _renderMobileToolbar() {
        if (!_mobileState.toolbar || !isMobileDevice()) return;

        const pane = this.openPanes && this.openPanes[0];

        if (!pane) {
            _mobileState.toolbar.innerHTML = `
                <div class="mobile-toolbar-empty">
                    <span>No note open</span>
                    <button class="mobile-toolbar-home-btn" onclick="window.$root._goMobileHome()">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                            <polyline points="9 22 9 12 15 12 15 22"/>
                        </svg>
                        Home
                    </button>
                </div>
            `;
            return;
        }

        const currentMode = pane.viewMode || 'split';
        const isDirty = pane.isDirty;
        const noteName = this._escapeHtml(pane.name || 'Untitled');

        _mobileState.toolbar.innerHTML = `
            <div class="mobile-toolbar-header">
                <button class="mobile-toolbar-home-btn" onclick="window.$root._goMobileHome()" title="Go to homepage">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                        <polyline points="9 22 9 12 15 12 15 22"/>
                    </svg>
                </button>
                <span class="mobile-toolbar-title">${noteName}</span>
                ${isDirty ? '<span class="mobile-toolbar-dirty" title="Unsaved changes"></span>' : ''}
            </div>
            <div class="mobile-toolbar-modes">
                <button class="mobile-toolbar-mode ${currentMode === 'edit' ? 'active' : ''}"
                        onclick="window.$root._setMobileViewMode('edit')">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                    Edit
                </button>
                <button class="mobile-toolbar-mode ${currentMode === 'split' ? 'active' : ''}"
                        onclick="window.$root._setMobileViewMode('split')">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                        <line x1="12" y1="3" x2="12" y2="21"/>
                    </svg>
                    Split
                </button>
                <button class="mobile-toolbar-mode ${currentMode === 'rich' ? 'active' : ''}"
                        onclick="window.$root._setMobileViewMode('rich')">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                        <line x1="16" y1="13" x2="8" y2="13"/>
                        <line x1="16" y1="17" x2="8" y2="17"/>
                    </svg>
                    Rich
                </button>
            </div>
        `;
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

        // Re-render toolbar to update active state
        this._renderMobileToolbar();
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

        // Hide toolbar
        if (_mobileState.toolbarVisible) {
            this._toggleMobileToolbar();
        }

        // Navigate to homepage
        window.history.pushState({ homepageFolder: '' }, '', '/');
    },

    /**
     * Setup resize listener for responsive behavior
     */
    _setupMobileResizeListener() {
        let resizeTimeout;

        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                if (isMobileDevice()) {
                    if (!_mobileState.initialized) {
                        this.initMobilePanes();
                    }
                    this._showMobileElements();
                    this._renderMobileToolbar();
                } else {
                    // Switched to desktop - hide mobile elements
                    this._hideMobileElements();
                }
            }, 100);
        });
    },

    /**
     * Show mobile elements (FAB, toolbar if open)
     */
    _showMobileElements() {
        if (_mobileState.fabButton) {
            _mobileState.fabButton.style.display = '';
        }
        if (_mobileState.toolbar && _mobileState.toolbarVisible) {
            _mobileState.toolbar.style.display = '';
        }
    },

    /**
     * Hide mobile elements when switching to desktop
     */
    _hideMobileElements() {
        if (_mobileState.fabButton) {
            _mobileState.fabButton.style.display = 'none';
        }
        if (_mobileState.toolbar) {
            _mobileState.toolbar.style.display = 'none';
            _mobileState.toolbar.classList.remove('visible');
        }
        if (_mobileState.fabButton) {
            _mobileState.fabButton.classList.remove('toolbar-open');
        }
        _mobileState.toolbarVisible = false;
    },

    /**
     * Escape HTML to prevent XSS
     */
    _escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    /**
     * Called when panes change - update toolbar
     */
    _onMobilePanesChanged() {
        if (isMobileDevice()) {
            this._renderMobileToolbar();
        }
    },
};

/**
 * Initialize mobile panes on page load if on mobile device
 */
export function initMobilePanesIfNeeded(app) {
    if (isMobileDevice()) {
        app.initMobilePanes();
    }
}

export { isMobileDevice };
