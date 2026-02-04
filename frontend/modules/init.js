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
        this.loadViewMode();
        this.loadTagsExpanded();

        // Load all user settings from server
        await this.loadUserSettings();

        // Load favorites
        await this.loadFavorites();

        // Load homepage content
        await this.loadHomepageContent();

        // Initialize stacked panes system
        if (typeof this.setupPaneKeyboardShortcuts === 'function') {
            this.setupPaneKeyboardShortcuts();
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
            this.initCodeMirror();
        });

        // Setup mobile view mode handler
        this.setupMobileViewMode();

        // Watch view mode changes and auto-save
        this.$watch('viewMode', (newValue, oldValue) => {
            this.saveViewMode();
            this.$nextTick(() => {
                this.refreshDOMCache();

                // Handle Edit or Split mode - sync CodeMirror
                if ((newValue === 'edit' || newValue === 'split') && this.noteContent) {
                    this.updateEditorContent(this.noteContent);
                }

                // Setup scroll sync for Split mode
                if (newValue === 'split') {
                    this.setupScrollSync();
                }

                // Handle Rich mode - initialize/update Tiptap
                if (newValue === 'rich') {
                    if (!this.tiptapEditor) {
                        this.initTiptap();
                    } else if (this.noteContent) {
                        this.updateTiptapContent(this.noteContent);
                    }
                }

                // Sync from Tiptap when leaving Rich mode (and Auto-Format)
                if (oldValue === 'rich' && this.tiptapEditor) {
                    const markdown = this.getTiptapContent();
                    // Update content even if length is same, as formatting might have changed
                    this.noteContent = markdown;

                    if (newValue === 'edit' || newValue === 'split') {
                        this.updateEditorContent(this.noteContent);

                        // Auto-format the markdown generated by Tiptap
                        // This ensures tables and spacing are clean when switching to edit view
                        this.formatMarkdown().then(() => {
                            this.noteContent = this.getEditorContent();
                            this.debouncedSave();
                        });
                    }
                }
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
