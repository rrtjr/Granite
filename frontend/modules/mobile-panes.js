/**
 * Mobile Panes Module - Isolated mobile/tablet pane management
 *
 * Features:
 * - Tab bar navigation for phones
 * - Swipe gestures to switch panes
 * - Tablet split view (landscape)
 * - Touch-optimized interactions
 *
 * This module only activates on mobile/tablet devices and does NOT affect desktop.
 */

// Breakpoints matching CSS
const BREAKPOINTS = {
    PHONE: 480,
    TABLET_PORTRAIT: 768,
    TABLET_LANDSCAPE: 1024,
};

/**
 * Check if current device is mobile/tablet
 */
function isMobileDevice() {
    return window.innerWidth <= BREAKPOINTS.TABLET_LANDSCAPE;
}

/**
 * Check if device is phone
 */
function isPhone() {
    return window.innerWidth <= BREAKPOINTS.TABLET_PORTRAIT;
}

/**
 * Check if device is tablet
 */
function isTablet() {
    return window.innerWidth > BREAKPOINTS.TABLET_PORTRAIT && window.innerWidth <= BREAKPOINTS.TABLET_LANDSCAPE;
}

/**
 * Check if device is in landscape orientation
 */
function isLandscape() {
    return window.innerWidth > window.innerHeight;
}

/**
 * Internal state stored outside Alpine to avoid circular reference issues.
 * Alpine tries to make all mixin properties reactive, which fails for DOM elements
 * and complex objects with circular references.
 */
const _mobileState = {
    initialized: false,
    tabBar: null,
    swipeState: null,
    tabletSplitEnabled: false,
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
            console.log('[Granite Mobile] Initializing mobile panes');
        }

        _mobileState.initialized = true;

        // Create tab bar element
        this._createMobileTabBar();

        // Setup swipe gestures
        this._setupSwipeGestures();

        // Setup resize listener
        this._setupMobileResizeListener();

        // Setup orientation change listener
        this._setupOrientationListener();

        // Initial render
        this._renderMobileTabBar();
    },

    /**
     * Create the mobile tab bar DOM element
     */
    _createMobileTabBar() {
        // Check if already exists
        if (document.querySelector('.mobile-pane-tabs')) {
            return;
        }

        const tabBar = document.createElement('div');
        tabBar.className = 'mobile-pane-tabs';
        tabBar.setAttribute('x-show', 'openPanes.length > 0');

        // Insert before panes container or at end of main content
        const panesContainer = document.querySelector('.panes-container');
        if (panesContainer && panesContainer.parentElement) {
            panesContainer.parentElement.appendChild(tabBar);
        }

        // Store reference
        _mobileState.tabBar = tabBar;
    },

    /**
     * Render/update the mobile tab bar
     */
    _renderMobileTabBar() {
        if (!_mobileState.tabBar || !isMobileDevice()) {
            return;
        }

        const openPanes = this.openPanes || [];
        const activePaneId = this.activePaneId;

        // Build tab HTML
        let html = '';

        openPanes.forEach((pane, index) => {
            const isActive = pane.id === activePaneId;
            const isDirty = pane.isDirty;

            html += `
                <button class="mobile-pane-tab ${isActive ? 'active' : ''}"
                        data-pane-id="${pane.id}"
                        data-pane-index="${index}">
                    ${isDirty ? '<span class="mobile-pane-tab-dirty"></span>' : ''}
                    <span class="mobile-pane-tab-title">${this._escapeHtml(pane.name || 'Untitled')}</span>
                    <button class="mobile-pane-tab-close"
                            data-pane-id="${pane.id}"
                            onclick="event.stopPropagation();">
                        &times;
                    </button>
                </button>
            `;
        });

        // Add "new tab" button
        html += `
            <button class="mobile-pane-tab-add" title="Open note in new tab">
                +
            </button>
        `;

        // Add tablet split toggle if applicable
        if (isTablet() && isLandscape()) {
            html += `
                <button class="tablet-split-toggle ${_mobileState.tabletSplitEnabled ? 'active' : ''}"
                        title="Toggle split view">
                    Split
                </button>
            `;
        }

        _mobileState.tabBar.innerHTML = html;

        // Attach event listeners
        this._attachMobileTabListeners();
    },

    /**
     * Attach event listeners to mobile tab bar
     */
    _attachMobileTabListeners() {
        if (!_mobileState.tabBar) return;

        // Tab click
        _mobileState.tabBar.querySelectorAll('.mobile-pane-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const paneId = tab.dataset.paneId;
                if (paneId) {
                    this.focusPane(paneId);
                }
            });
        });

        // Close button click
        _mobileState.tabBar.querySelectorAll('.mobile-pane-tab-close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const paneId = btn.dataset.paneId;
                if (paneId) {
                    this.closePane(paneId);
                }
            });
        });

        // Add tab button
        const addBtn = _mobileState.tabBar.querySelector('.mobile-pane-tab-add');
        if (addBtn) {
            addBtn.addEventListener('click', () => {
                // Show note selector or create new note
                this.showMobileSidebar = true;
            });
        }

        // Split toggle button
        const splitToggle = _mobileState.tabBar.querySelector('.tablet-split-toggle');
        if (splitToggle) {
            splitToggle.addEventListener('click', () => {
                this._toggleTabletSplitView();
            });
        }
    },

    /**
     * Setup swipe gestures for pane navigation
     */
    _setupSwipeGestures() {
        const panesContainer = document.querySelector('.panes-container');
        if (!panesContainer) return;

        let startX = 0;
        let startY = 0;
        let isDragging = false;
        const threshold = 50;

        // Create swipe indicators
        this._createSwipeIndicators();

        panesContainer.addEventListener('touchstart', (e) => {
            if (!isPhone()) return;
            if (e.touches.length !== 1) return;

            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            isDragging = true;

            _mobileState.swipeState = {
                startX,
                startY,
                currentX: startX,
                direction: null
            };
        }, { passive: true });

        panesContainer.addEventListener('touchmove', (e) => {
            if (!isDragging || !_mobileState.swipeState) return;
            if (!isPhone()) return;

            const currentX = e.touches[0].clientX;
            const currentY = e.touches[0].clientY;
            const deltaX = currentX - _mobileState.swipeState.startX;
            const deltaY = currentY - _mobileState.swipeState.startY;

            // Only handle horizontal swipes
            if (Math.abs(deltaY) > Math.abs(deltaX)) {
                isDragging = false;
                this._hideSwipeIndicators();
                return;
            }

            _mobileState.swipeState.currentX = currentX;
            _mobileState.swipeState.direction = deltaX > 0 ? 'right' : 'left';

            // Show swipe indicator
            if (Math.abs(deltaX) > threshold / 2) {
                this._showSwipeIndicator(_mobileState.swipeState.direction, Math.abs(deltaX) / threshold);
            }

            // Prevent scrolling during horizontal swipe
            if (Math.abs(deltaX) > 10) {
                panesContainer.classList.add('swiping');
            }
        }, { passive: true });

        panesContainer.addEventListener('touchend', (e) => {
            panesContainer.classList.remove('swiping');

            if (!isDragging || !_mobileState.swipeState) {
                this._hideSwipeIndicators();
                return;
            }

            if (!isPhone()) {
                this._hideSwipeIndicators();
                return;
            }

            const deltaX = _mobileState.swipeState.currentX - _mobileState.swipeState.startX;

            if (Math.abs(deltaX) >= threshold) {
                if (deltaX > 0) {
                    // Swipe right - previous pane
                    this._goToPreviousPaneWithAnimation('left');
                } else {
                    // Swipe left - next pane
                    this._goToNextPaneWithAnimation('right');
                }
            }

            isDragging = false;
            _mobileState.swipeState = null;
            this._hideSwipeIndicators();
        }, { passive: true });

        panesContainer.addEventListener('touchcancel', () => {
            isDragging = false;
            _mobileState.swipeState = null;
            panesContainer.classList.remove('swiping');
            this._hideSwipeIndicators();
        }, { passive: true });
    },

    /**
     * Create swipe indicator elements
     */
    _createSwipeIndicators() {
        if (document.querySelector('.mobile-swipe-indicator')) return;

        const leftIndicator = document.createElement('div');
        leftIndicator.className = 'mobile-swipe-indicator left';
        document.body.appendChild(leftIndicator);

        const rightIndicator = document.createElement('div');
        rightIndicator.className = 'mobile-swipe-indicator right';
        document.body.appendChild(rightIndicator);
    },

    /**
     * Show swipe indicator
     */
    _showSwipeIndicator(direction, intensity) {
        const indicator = document.querySelector(`.mobile-swipe-indicator.${direction === 'right' ? 'left' : 'right'}`);
        if (indicator) {
            indicator.classList.add('visible');
            indicator.style.opacity = Math.min(intensity, 1) * 0.6;
        }
    },

    /**
     * Hide swipe indicators
     */
    _hideSwipeIndicators() {
        document.querySelectorAll('.mobile-swipe-indicator').forEach(el => {
            el.classList.remove('visible');
            el.style.opacity = '';
        });
    },

    /**
     * Go to previous pane with animation
     */
    _goToPreviousPaneWithAnimation(slideDirection) {
        const openPanes = this.openPanes || [];
        if (openPanes.length <= 1) return;

        const currentIndex = openPanes.findIndex(p => p.id === this.activePaneId);
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : openPanes.length - 1;
        const prevPane = openPanes[prevIndex];

        if (prevPane) {
            this._animatePaneTransition(slideDirection);
            this.focusPane(prevPane.id);
        }
    },

    /**
     * Go to next pane with animation
     */
    _goToNextPaneWithAnimation(slideDirection) {
        const openPanes = this.openPanes || [];
        if (openPanes.length <= 1) return;

        const currentIndex = openPanes.findIndex(p => p.id === this.activePaneId);
        const nextIndex = currentIndex < openPanes.length - 1 ? currentIndex + 1 : 0;
        const nextPane = openPanes[nextIndex];

        if (nextPane) {
            this._animatePaneTransition(slideDirection);
            this.focusPane(nextPane.id);
        }
    },

    /**
     * Add slide animation to pane transition
     */
    _animatePaneTransition(direction) {
        const activePane = document.querySelector('.note-pane.pane-active');
        if (activePane) {
            activePane.classList.add(`pane-slide-${direction}`);
            setTimeout(() => {
                activePane.classList.remove(`pane-slide-${direction}`);
            }, 250);
        }
    },

    /**
     * Toggle tablet split view
     */
    _toggleTabletSplitView() {
        _mobileState.tabletSplitEnabled = !_mobileState.tabletSplitEnabled;

        const mainContainer = document.querySelector('.panes-container')?.parentElement;
        if (mainContainer) {
            mainContainer.classList.toggle('tablet-split-view', _mobileState.tabletSplitEnabled);
        }

        this._renderMobileTabBar();

        if (window.GRANITE_DEBUG) {
            console.log('[Granite Mobile] Split view:', _mobileState.tabletSplitEnabled);
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
                if (isMobileDevice()) {
                    if (!_mobileState.initialized) {
                        this.initMobilePanes();
                    }
                    this._renderMobileTabBar();
                } else {
                    // Switched to desktop - hide mobile elements
                    this._hideMobileElements();
                }
            }, 100);
        });
    },

    /**
     * Setup orientation change listener
     */
    _setupOrientationListener() {
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                this._renderMobileTabBar();

                // Disable split view when switching to portrait
                if (!isLandscape() && _mobileState.tabletSplitEnabled) {
                    _mobileState.tabletSplitEnabled = false;
                    const mainContainer = document.querySelector('.panes-container')?.parentElement;
                    if (mainContainer) {
                        mainContainer.classList.remove('tablet-split-view');
                    }
                }
            }, 100);
        });
    },

    /**
     * Hide mobile elements when switching to desktop
     */
    _hideMobileElements() {
        if (_mobileState.tabBar) {
            _mobileState.tabBar.style.display = 'none';
        }

        const mainContainer = document.querySelector('.panes-container')?.parentElement;
        if (mainContainer) {
            mainContainer.classList.remove('tablet-split-view');
        }

        this._hideSwipeIndicators();
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
     * Watch for pane changes and update tab bar
     * Call this when panes are opened/closed/focused
     */
    _onMobilePanesChanged() {
        if (isMobileDevice()) {
            this._renderMobileTabBar();

            // Scroll active tab into view
            setTimeout(() => {
                const activeTab = _mobileState.tabBar?.querySelector('.mobile-pane-tab.active');
                if (activeTab) {
                    activeTab.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                }
            }, 50);
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

export { isMobileDevice, isPhone, isTablet, isLandscape };
