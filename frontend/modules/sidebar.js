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

    // Load view mode from localStorage
    loadViewMode() {
        try {
            const saved = localStorage.getItem('viewMode');
            if (saved && ['edit', 'split', 'rich'].includes(saved)) {
                this.viewMode = saved;
            } else if (saved === 'preview') {
                // Migrate old preview mode to rich
                this.viewMode = 'rich';
            }
        } catch (error) {
            Debug.error('Error loading view mode:', error);
        }
    },

    // Save view mode to localStorage
    saveViewMode() {
        try {
            localStorage.setItem('viewMode', this.viewMode);
        } catch (error) {
            Debug.error('Error saving view mode:', error);
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

    // Setup mobile view mode handler
    setupMobileViewMode() {
        const MOBILE_BREAKPOINT = 768;
        let previousWidth = window.innerWidth;

        const handleResize = () => {
            const currentWidth = window.innerWidth;
            const wasMobile = previousWidth <= MOBILE_BREAKPOINT;
            const isMobile = currentWidth <= MOBILE_BREAKPOINT;

            // Switch from split to edit when entering mobile viewport
            if (!wasMobile && isMobile && this.viewMode === 'split') {
                this.viewMode = 'edit';
            }

            previousWidth = currentWidth;
        };

        window.addEventListener('resize', handleResize);

        // Check on initial load
        if (window.innerWidth <= MOBILE_BREAKPOINT && this.viewMode === 'split') {
            this.viewMode = 'edit';
        }
    },
};
