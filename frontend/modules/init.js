// Granite Frontend - Initialization Module

import { CONFIG } from './config.js';

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
        this.loadViewMode();
        this.loadTagsExpanded();

        // Load all user settings from server
        await this.loadUserSettings();

        // Load favorites
        await this.loadFavorites();

        // Load homepage content
        await this.loadHomepageContent();

        // Parse URL and load specific note if provided
        this.loadNoteFromURL();

        // Set initial homepage state
        if (window.location.pathname === '/') {
            window.history.replaceState({ homepageFolder: '' }, '', '/');
        }

        // Listen for browser back/forward navigation
        window.addEventListener('popstate', (e) => {
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
            this.initCodeMirror();
        });

        // Setup mobile view mode handler
        this.setupMobileViewMode();

        // Watch view mode changes and auto-save
        this.$watch('viewMode', (newValue) => {
            this.saveViewMode();
            this.$nextTick(() => {
                this.refreshDOMCache();
                this.setupScrollSync();
            });
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

        // Close dropdowns when clicking outside
        document.addEventListener('click', () => {
            this.closeDropdown();
        });
    },

    // Load app config
    async loadConfig() {
        try {
            const response = await fetch('/api/config');
            const data = await response.json();
            this.appConfig = data;
        } catch (error) {
            console.error('Failed to load config:', error);
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
            console.error('Failed to load homepage content:', error);
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
