// Granite Frontend - Sidebar Module

import { CONFIG, Debug } from './config.js';

export const sidebarMixin = {
    // Load sidebar width from localStorage
    loadSidebarWidth() {
        const saved = localStorage.getItem('sidebarWidth');
        if (saved) {
            const width = parseInt(saved, 10);
            if (width >= 200 && width <= 600) {
                this.sidebarWidth = width;
            }
        }
    },

    // Save sidebar width to localStorage
    saveSidebarWidth() {
        localStorage.setItem('sidebarWidth', this.sidebarWidth.toString());
    },

    // Load sidebar collapsed state from localStorage
    loadSidebarCollapsed() {
        const saved = localStorage.getItem('sidebarCollapsed');
        if (saved !== null) {
            this.sidebarCollapsed = saved === 'true';
        }
    },

    // Save sidebar collapsed state to localStorage
    saveSidebarCollapsed() {
        localStorage.setItem('sidebarCollapsed', this.sidebarCollapsed.toString());
    },

    // Toggle sidebar collapsed state
    toggleSidebar() {
        this.sidebarCollapsed = !this.sidebarCollapsed;
        this.saveSidebarCollapsed();
    },

    // Start resizing sidebar
    startResize(event) {
        this.isResizing = true;
        event.preventDefault();

        const resize = (e) => {
            if (!this.isResizing) return;
            const newWidth = e.clientX;
            if (newWidth >= 200 && newWidth <= 600) {
                this.sidebarWidth = newWidth;
            }
        };

        const stopResize = () => {
            if (this.isResizing) {
                this.isResizing = false;
                this.saveSidebarWidth();
                document.removeEventListener('mousemove', resize);
                document.removeEventListener('mouseup', stopResize);
            }
        };

        document.addEventListener('mousemove', resize);
        document.addEventListener('mouseup', stopResize);
    },

    // Start resizing split panes (editor/preview)
    startSplitResize(event) {
        this.isResizingSplit = true;
        event.preventDefault();

        const container = event.target.parentElement;

        const resize = (e) => {
            if (!this.isResizingSplit) return;
            const containerRect = container.getBoundingClientRect();
            const mouseX = e.clientX - containerRect.left;
            const percentage = (mouseX / containerRect.width) * 100;
            if (percentage >= 20 && percentage <= 80) {
                this.editorWidth = percentage;
            }
        };

        const stopResize = () => {
            if (this.isResizingSplit) {
                this.isResizingSplit = false;
                this.saveEditorWidth();
                document.removeEventListener('mousemove', resize);
                document.removeEventListener('mouseup', stopResize);
            }
        };

        document.addEventListener('mousemove', resize);
        document.addEventListener('mouseup', stopResize);
    },

    // Load editor width from localStorage
    loadEditorWidth() {
        const saved = localStorage.getItem('editorWidth');
        if (saved) {
            const width = parseFloat(saved);
            if (width >= 20 && width <= 80) {
                this.editorWidth = width;
            }
        }
    },

    // Save editor width to localStorage
    saveEditorWidth() {
        localStorage.setItem('editorWidth', this.editorWidth.toString());
    },

    // Load default pane view mode from localStorage
    loadDefaultPaneViewMode() {
        try {
            const saved = localStorage.getItem('defaultPaneViewMode');
            if (saved && ['edit', 'split'].includes(saved)) {
                this.defaultPaneViewMode = saved;
            }
        } catch (error) {
            Debug.error('Error loading default pane view mode:', error);
        }
    },

    // Save default pane view mode to localStorage
    saveDefaultPaneViewMode() {
        try {
            localStorage.setItem('defaultPaneViewMode', this.defaultPaneViewMode);
        } catch (error) {
            Debug.error('Error saving default pane view mode:', error);
        }
    },

    // Load tags expanded state from localStorage
    loadTagsExpanded() {
        try {
            const saved = localStorage.getItem('tagsExpanded');
            if (saved !== null) {
                this.tagsExpanded = saved === 'true';
            }
        } catch (error) {
            Debug.error('Error loading tags expanded state:', error);
        }
    },

    // Save tags expanded state to localStorage
    saveTagsExpanded() {
        try {
            localStorage.setItem('tagsExpanded', this.tagsExpanded.toString());
        } catch (error) {
            Debug.error('Error saving tags expanded state:', error);
        }
    },

    // Setup mobile pane handler (pane-based system)
    setupPaneMobileHandling() {
        const MOBILE_BREAKPOINT = 768;
        let previousWidth = window.innerWidth;

        const handleResize = () => {
            const currentWidth = window.innerWidth;
            const wasMobile = previousWidth <= MOBILE_BREAKPOINT;
            const isMobile = currentWidth <= MOBILE_BREAKPOINT;

            // Switch all panes from split to edit when entering mobile viewport
            if (!wasMobile && isMobile && this.openPanes) {
                this.openPanes.forEach(pane => {
                    if (pane.viewMode === 'split' && typeof this.setPaneViewMode === 'function') {
                        this.setPaneViewMode(pane.id, 'edit');
                    }
                });
            }

            // Close extra panes on mobile (keep only active pane)
            if (!wasMobile && isMobile && this.openPanes && this.openPanes.length > 1) {
                if (typeof this.closePanesExcept === 'function') {
                    this.closePanesExcept(this.activePaneId);
                }
            }

            previousWidth = currentWidth;
        };

        window.addEventListener('resize', handleResize);

        // Check on initial load - switch panes to edit mode on mobile
        if (window.innerWidth <= MOBILE_BREAKPOINT && this.openPanes) {
            this.openPanes.forEach(pane => {
                if (pane.viewMode === 'split' && typeof this.setPaneViewMode === 'function') {
                    this.setPaneViewMode(pane.id, 'edit');
                }
            });
        }

        // Close extra panes on initial mobile load
        if (window.innerWidth <= MOBILE_BREAKPOINT && this.openPanes && this.openPanes.length > 1) {
            if (typeof this.closePanesExcept === 'function') {
                this.closePanesExcept(this.activePaneId);
            }
        }
    },
};
