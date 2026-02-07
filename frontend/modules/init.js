// Granite Frontend - Initialization Module

import { CONFIG, setDebugMode, Debug } from './config.js';

export const initMixin = {
    // Initialize app
    async init() {
        // Prevent double initialization
        if (window.__noteapp_initialized) return;
        window.__noteapp_initialized = true;

        // Store global reference for native event handlers in x-html content
        window.$root = this;

        // ESC key to cancel drag operations
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && (this.draggedNote || this.draggedFolder || this.draggedItem)) {
                this.cancelDrag();
            }
        });

        await this.loadConfig();
        await this.loadThemes();
        await this.initTheme();
        await this.loadNotes();
        await this.loadTemplates();
        await this.loadPlugins();
        this.loadSidebarWidth();
        this.loadSidebarCollapsed();
        this.loadEditorWidth();
        this.migrateViewModeToPane();  // Migrate old viewMode to new pane-based system
        this.loadDefaultPaneViewMode();  // Load default pane view mode preference
        this.loadTagsExpanded();

        // Load all user settings from server
        await this.loadUserSettings();

        // Load favorites and prune any stale paths (e.g. files moved outside the app)
        await this.loadFavorites();
        await this.cleanupStaleFavorites();

        // Load homepage content
        await this.loadHomepageContent();

        // Initialize stacked panes system
        if (typeof this.setupPaneKeyboardShortcuts === 'function') {
            this.setupPaneKeyboardShortcuts();
        }

        // Initialize draw.io diagram listeners
        if (typeof this.initDrawioListeners === 'function') {
            this.initDrawioListeners();
        }

        // Try to restore panes from previous session
        let panesRestored = false;
        if (typeof this.restorePanesState === 'function') {
            panesRestored = await this.restorePanesState();
        }

        // Parse URL and load specific note if provided (only if no panes were restored)
        if (!panesRestored) {
            this.loadNoteFromURL();
        }

        // Set initial homepage state
        if (window.location.pathname === '/') {
            window.history.replaceState({ homepageFolder: '' }, '', '/');
        }

        // Setup mobile pane handling (legacy)
        if (typeof this.setupPaneMobileHandling === 'function') {
            this.setupPaneMobileHandling();
        }

        // Initialize mobile panes (tab bar, swipe gestures)
        console.log('[Init] Checking initMobilePanes:', typeof this.initMobilePanes);
        if (typeof this.initMobilePanes === 'function') {
            console.log('[Init] Calling initMobilePanes');
            this.initMobilePanes();
        }

        // Listen for browser back/forward navigation
        window.addEventListener('popstate', (e) => {
            // Handle panes navigation if using stacked panes
            if (e.state && e.state.panes && typeof this.handlePanesPopstate === 'function') {
                this.handlePanesPopstate(e.state);
                return;
            }

            if (e.state && e.state.notePath) {
                const searchQuery = e.state.searchQuery || '';
                this.loadNote(e.state.notePath, false, searchQuery);

                if (searchQuery) {
                    this.searchQuery = searchQuery;
                    this.searchNotes();
                } else {
                    this.searchQuery = '';
                    this.searchResults = [];
                    this.clearSearchHighlights();
                }
            } else if (e.state && e.state.imagePath) {
                this.viewImage(e.state.imagePath, false);
            } else {
                this.currentNote = '';
                this.noteContent = '';
                this.currentNoteName = '';
                this.currentImage = '';

                if (e.state && e.state.homepageFolder !== undefined) {
                    this.selectedHomepageFolder = e.state.homepageFolder || '';
                } else {
                    this.selectedHomepageFolder = '';
                }

                this._homepageCache = {
                    folderPath: null,
                    notes: null,
                    folders: null,
                    breadcrumb: null
                };

                this.searchQuery = '';
                this.searchResults = [];
                this.clearSearchHighlights();
            }
        });

        // Cache DOM references after initial render
        this.$nextTick(() => {
            this.refreshDOMCache();
        });

        // Watch tags expanded state
        this.$watch('tagsExpanded', () => {
            this.saveTagsExpanded();
        });

        // Watch showGraph changes to initialize graph
        this.$watch('showGraph', async (newValue) => {
            if (newValue) {
                await this.initGraph();
            }
        });

        // Watch reading preferences changes and update Tiptap editor
        this.$watch('readingWidth', () => {
            this.updateTiptapReadingPreferences();
        });

        this.$watch('contentAlign', () => {
            this.updateTiptapReadingPreferences();
        });

        this.$watch('contentMargins', () => {
            this.updateTiptapReadingPreferences();
        });

        this.$watch('bannerOpacity', () => {
            this.updateTiptapBannerOpacity();
        });

        // Watch active pane changes to sync Rich Editor panel
        this.$watch('activePaneId', (newPaneId, oldPaneId) => {
            if (newPaneId && newPaneId !== oldPaneId && this.showRichEditorPanel) {
                const newPane = this.openPanes.find(p => p.id === newPaneId);
                if (newPane && this.tiptapEditor) {
                    // Sync from old pane first if needed
                    if (oldPaneId && this._tiptapSyncTimeout) {
                        clearTimeout(this._tiptapSyncTimeout);
                        const oldPane = this.openPanes.find(p => p.id === oldPaneId);
                        if (oldPane && this.tiptapEditor) {
                            oldPane.content = this.getTiptapContent();
                        }
                    }
                    // Update Tiptap with new pane's content
                    this.updateTiptapContent(newPane.content);
                }
            }

            // Update mobile toolbar when active pane changes
            if (typeof this._onMobilePanesChanged === 'function') {
                this._onMobilePanesChanged();
            }
        });

        // Watch openPanes changes to update mobile toolbar
        this.$watch('openPanes', () => {
            if (typeof this._onMobilePanesChanged === 'function') {
                this._onMobilePanesChanged();
            }
        });

        // Close dropdowns when clicking outside
        document.addEventListener('click', () => {
            this.closeDropdown();
        });
    },

    // Migrate old global viewMode to new pane-based defaultPaneViewMode
    migrateViewModeToPane() {
        const oldViewMode = localStorage.getItem('viewMode');
        if (oldViewMode && ['edit', 'split'].includes(oldViewMode)) {
            localStorage.setItem('defaultPaneViewMode', oldViewMode);
            localStorage.removeItem('viewMode');
            Debug.log('Migrated viewMode to defaultPaneViewMode:', oldViewMode);
        }
    },

    // Load app config
    async loadConfig() {
        try {
            const response = await fetch('/api/config');
            const data = await response.json();
            this.appConfig = data;
            // Set debug mode from backend config
            setDebugMode(data.debugMode || false);
        } catch (error) {
            Debug.error('Failed to load config:', error);
        }
    },

    // Load homepage content (configured file)
    async loadHomepageContent() {
        try {
            const response = await fetch('/api/homepage');
            if (response.ok) {
                const data = await response.json();
                this.homepageContent = data.content;
                this.homepageFilePath = data.path;
            }
        } catch (error) {
            Debug.error('Failed to load homepage content:', error);
        }
    },

    // Debounced save wrapper
    debouncedSave() {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }
        this.saveTimeout = setTimeout(() => {
            this.saveNote();
        }, this.performanceSettings.autosaveDelay);
    },
};
