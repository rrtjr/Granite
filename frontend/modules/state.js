// Granite Frontend - State Management
// All state variables and computed-like helpers for the application

import { CONFIG } from './config.js';

export const stateMixin = {
    // App state
    appConfig: null, // Loaded from backend via loadConfig()
    appName: 'Granite',
    appTagline: 'Your Self-Hosted Knowledge Base',
    appVersion: '0.0.0',
    authEnabled: false,
    notes: [],
    searchQuery: '',

    // Stacked panes state
    openPanes: [],           // Array of pane objects
    activePaneId: null,      // Currently focused pane ID
    maxPanes: 10,            // Maximum open panes limit
    showRichEditorPanel: false, // Rich Editor right sidebar panel
    // Pane object structure:
    // {
    //   id: 'pane-uuid',
    //   path: 'folder/note.md',
    //   content: '# Content',
    //   name: 'note',
    //   editorView: null,         // CodeMirror instance
    //   tiptapEditor: null,       // Tiptap instance (for rich mode)
    //   scrollPos: 0,
    //   previewScrollPos: 0,
    //   viewMode: 'split',        // Per-pane view mode (edit/split only)
    //   isDirty: false,
    //   width: 500,
    //   undoHistory: [],
    //   redoHistory: [],
    // }

    // Legacy single-note state (for backward compatibility)
    _legacyCurrentNote: '',
    _legacyNoteContent: '',
    _legacyCurrentNoteName: '',
    viewMode: 'split', // 'edit', 'split', or 'rich' (WYSIWYG) - default for new panes

    // Reading preferences
    readingWidth: 'full', // 'narrow', 'medium', 'wide', 'full'
    contentAlign: 'left', // 'left', 'center', 'justified'
    contentMargins: 'normal', // 'compact', 'normal', 'relaxed', 'extra-relaxed'
    bannerOpacity: 0.5, // 0.0 to 1.0 - opacity of the banner gradient overlay

    // Folders & Paths
    templatesDir: '_templates', // Templates folder path (relative to notes_dir)
    homepageFile: '', // Homepage file path (relative to notes_dir)

    // Advanced performance settings (ms)
    performanceSettings: {
        updateDelay: 100,      // Delay before updating content on keystroke
        statsDelay: 300,       // Delay before recalculating statistics
        metadataDelay: 300,    // Delay before parsing metadata
        historyDelay: 500,     // Delay before updating undo history
        autosaveDelay: 1000    // Delay before triggering autosave
    },

    // Graph state (separate overlay, doesn't affect viewMode)
    showGraph: false,
    graphInstance: null,
    graphLoaded: false,
    graphData: null,
    searchResults: [],
    currentSearchHighlight: '', // Track current highlighted search term
    currentMatchIndex: 0, // Current match being viewed
    totalMatches: 0, // Total number of matches in the note
    isSaving: false,
    lastSaved: false,
    linkCopied: false,
    saveTimeout: null,
    statsTimeout: null,
    metadataTimeout: null,
    historyTimeout: null,
    updateTimeout: null,
    pendingUpdate: null,
    isExportingPDF: false,

    // PDF Export Settings state
    showPdfExportSettingsModal: false,
    pdfExportSettings: {
        page_size: 'A4',
        orientation: 'portrait',
        margin_top: '2cm',
        margin_bottom: '2cm',
        margin_left: '2cm',
        margin_right: '2cm',
        include_title: true,
        include_date: true,
        include_author: false,
        author_name: '',
        include_page_numbers: true,
        font_family: 'serif',
        font_size: '11pt',
        line_height: '1.6',
        code_background: '#f5f5f5',
        table_text_size: '10pt',
        heading_color: '#333',
        enable_tables: true,
        enable_code_highlighting: true,
        enable_toc: false,
        break_tables_across_pages: false,
        compress_tables: true,
        remove_frontmatter: true,
        remove_banner: true,
    },

    // Datetime settings state
    datetimeSettings: {
        timezone: 'local',
        updateModifiedOnOpen: true,
    },

    // Theme state
    currentTheme: 'light',
    availableThemes: [],

    // CodeMirror editor instance (legacy - used when no panes open)
    _legacyEditorView: null,
    editorThemeCompartment: null,

    // Icon rail / panel state
    activePanel: 'files', // 'files', 'search', 'tags', 'settings'

    // Folder state
    folderTree: [],
    allFolders: [],
    expandedFolders: new Set(),
    draggedNote: null,
    draggedFolder: null,
    dragOverFolder: null,  // Track which folder is being hovered during drag

    // Tags state
    allTags: {},
    selectedTags: [],
    tagsExpanded: false,
    tagReloadTimeout: null, // For debouncing tag reloads

    // Favorites state
    favoriteNotes: [], // Array of favorite note paths

    // Scroll sync state
    isScrolling: false,

    // Unified drag state
    draggedItem: null,  // { path: string, type: 'note' | 'image' }
    dropTarget: null,   // 'editor' | 'folder' | null

    // Undo/Redo history
    undoHistory: [],
    redoHistory: [],
    maxHistorySize: CONFIG.MAX_UNDO_HISTORY,
    isUndoRedo: false,

    // Stats plugin state
    statsPluginEnabled: false,
    noteStats: null,
    statsExpanded: false,

    // Plugin management state
    availablePlugins: null, // null = loading, [] = no plugins, [...] = plugin list

    // Git plugin settings state
    showGitSettingsModal: false,
    gitSettings: null,
    gitStatus: null,

    // Note metadata (frontmatter) state
    noteMetadata: null,
    metadataExpanded: false,
    _lastFrontmatter: null, // Cache to avoid re-parsing unchanged frontmatter

    // Sidebar resize state
    sidebarWidth: CONFIG.DEFAULT_SIDEBAR_WIDTH,
    isResizing: false,

    // Mobile sidebar state
    mobileSidebarOpen: false,

    // Toast notification state
    toasts: [],
    nextToastId: 1,

    // Desktop sidebar collapse state
    sidebarCollapsed: false,

    // Split view resize state
    editorWidth: 50, // percentage
    isResizingSplit: false,

    // Dropdown state
    showNewDropdown: false,
    dropdownTargetFolder: null, // Folder context for "New" dropdown ('' = root, null = not set)
    dropdownPosition: { top: 0, left: 0 }, // Position for contextual dropdown

    // Template state
    showTemplateModal: false,
    availableTemplates: [],
    selectedTemplate: '',
    newTemplateNoteName: '',

    // Unsplash banner picker state
    showUnsplashModal: false,
    unsplashUrl: '',
    unsplashPreviewError: false,

    // Table of Contents state
    showToc: false,
    tocHeadings: [],

    // Homepage state
    selectedHomepageFolder: '',
    homepageContent: null, // Content of the configured homepage file
    homepageFilePath: null, // Path to the homepage file
    homepageCardExpanded: true, // Collapsible state for homepage card
    _homepageCache: {
        folderPath: null,
        notes: null,
        folders: null,
        breadcrumb: null
    },

    // Homepage constants
    HOMEPAGE_MAX_NOTES: 50,

    // Mermaid state cache
    lastMermaidTheme: null,

    // Image viewer state
    currentImage: '',

    // DOM element cache (to avoid repeated querySelector calls)
    _domCache: {
        editor: null,
        previewContainer: null,
        previewContent: null
    },

    // Computed-like helpers for homepage (cached for performance)
    homepageNotes() {
        // Return cached result if folder hasn't changed
        if (this._homepageCache.folderPath === this.selectedHomepageFolder && this._homepageCache.notes) {
            return this._homepageCache.notes;
        }

        if (!this.folderTree || typeof this.folderTree !== 'object') {
            return [];
        }

        const folderNode = this.getFolderNode(this.selectedHomepageFolder || '');
        const result = (folderNode && Array.isArray(folderNode.notes)) ? folderNode.notes : [];

        // Cache the result
        this._homepageCache.notes = result;
        this._homepageCache.folderPath = this.selectedHomepageFolder;

        return result;
    },

    homepageFolders() {
        // Return cached result if folder hasn't changed
        if (this._homepageCache.folderPath === this.selectedHomepageFolder && this._homepageCache.folders) {
            return this._homepageCache.folders;
        }

        if (!this.folderTree || typeof this.folderTree !== 'object') {
            return [];
        }

        // Get child folders
        let childFolders = [];
        if (!this.selectedHomepageFolder) {
            // Root level: all top-level folders
            childFolders = Object.entries(this.folderTree)
                .filter(([key]) => key !== '__root__')
                .map(([, folder]) => folder);
        } else {
            // Inside a folder: get its children
            const parentFolder = this.getFolderNode(this.selectedHomepageFolder);
            if (parentFolder && parentFolder.children) {
                childFolders = Object.values(parentFolder.children);
            }
        }

        // Map to simplified structure (note count already cached in folder node)
        const result = childFolders
            .map(folder => ({
                name: folder.name,
                path: folder.path,
                noteCount: folder.noteCount || 0  // Use pre-calculated count
            }))
            .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

        // Cache the result
        this._homepageCache.folders = result;
        this._homepageCache.folderPath = this.selectedHomepageFolder;

        return result;
    },

    homepageBreadcrumb() {
        // Return cached result if folder hasn't changed
        if (this._homepageCache.folderPath === this.selectedHomepageFolder && this._homepageCache.breadcrumb) {
            return this._homepageCache.breadcrumb;
        }

        const breadcrumb = [{ name: 'Home', path: '' }];

        if (this.selectedHomepageFolder) {
            const parts = this.selectedHomepageFolder.split('/').filter(Boolean);
            let currentPath = '';

            parts.forEach(part => {
                currentPath = currentPath ? `${currentPath}/${part}` : part;
                breadcrumb.push({ name: part, path: currentPath });
            });
        }

        // Cache the result
        this._homepageCache.breadcrumb = breadcrumb;
        this._homepageCache.folderPath = this.selectedHomepageFolder;

        return breadcrumb;
    },

    // Check if app is empty (no notes and no folders)
    get isAppEmpty() {
        const notesArray = Array.isArray(this.notes) ? this.notes : [];
        const foldersArray = Array.isArray(this.allFolders) ? this.allFolders : [];
        return notesArray.length === 0 && foldersArray.length === 0;
    },

    // Get all tags sorted by name (defensive for spread operation)
    get sortedTags() {
        if (!this.allTags) return [];
        return Object.entries(this.allTags).sort((a, b) => a[0].localeCompare(b[0]));
    },

    // Get tags for current note (defensive for spread operation)
    get currentNoteTags() {
        if (!this.currentNote || !this.notes) return [];
        const note = this.notes.find(n => n.path === this.currentNote);
        return note && note.tags ? note.tags : [];
    },

    // Stacked panes computed getters (backward compatibility)
    get activePane() {
        return this.openPanes.find(p => p.id === this.activePaneId) || null;
    },

    get currentNote() {
        return this.activePane?.path || this._legacyCurrentNote || '';
    },

    set currentNote(value) {
        if (this.activePane) {
            this.activePane.path = value;
        } else {
            this._legacyCurrentNote = value;
        }
    },

    get noteContent() {
        return this.activePane?.content || this._legacyNoteContent || '';
    },

    set noteContent(value) {
        if (this.activePane) {
            this.activePane.content = value;
            this.activePane.isDirty = true;
        } else {
            this._legacyNoteContent = value;
        }
    },

    get currentNoteName() {
        return this.activePane?.name || this._legacyCurrentNoteName || '';
    },

    set currentNoteName(value) {
        if (this.activePane) {
            this.activePane.name = value;
        } else {
            this._legacyCurrentNoteName = value;
        }
    },

    get editorView() {
        return this.activePane?.editorView || this._legacyEditorView || null;
    },

    set editorView(value) {
        if (this.activePane) {
            this.activePane.editorView = value;
        } else {
            this._legacyEditorView = value;
        }
    },
};
