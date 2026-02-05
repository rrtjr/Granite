// Granite Frontend - Main App Entry Point (Modular)
// This file composes all mixins into the main Alpine.js noteApp component

import { CONFIG, ErrorHandler } from './modules/config.js';
import { stateMixin } from './modules/state.js';
import { helpersMixin } from './modules/helpers.js';
import { themesMixin } from './modules/themes.js';
import { tagsMixin } from './modules/tags.js';
import { favoritesMixin } from './modules/favorites.js';
import { templatesMixin } from './modules/templates.js';
import { statsMixin } from './modules/stats.js';
import { metadataMixin } from './modules/metadata.js';
import { sidebarMixin } from './modules/sidebar.js';
import { settingsMixin } from './modules/settings.js';
import { editorMixin } from './modules/editor.js';
import { tiptapMixin } from './modules/tiptap.js';
import { notesMixin } from './modules/notes.js';
import { foldersMixin } from './modules/folders.js';
import { searchMixin } from './modules/search.js';
import { imagesMixin } from './modules/images.js';
import { pluginsMixin } from './modules/plugins.js';
import { graphMixin } from './modules/graph.js';
import { markdownMixin } from './modules/markdown.js';
import { spreadsheetMixin } from './modules/spreadsheet.js';
import { drawioMixin } from './modules/drawio.js';
import { uiMixin } from './modules/ui.js';
import { exportMixin } from './modules/export.js';
import { initMixin } from './modules/init.js';

// Make CONFIG and ErrorHandler available globally for modules that need them
window.CONFIG = CONFIG;
window.ErrorHandler = ErrorHandler;

/**
 * Main Alpine.js component for the Granite note-taking app.
 * Composed from multiple mixins for better modularity and maintainability.
 */
function noteApp() {
    return {
        // Spread all mixins
        ...stateMixin,
        ...helpersMixin,
        ...themesMixin,
        ...tagsMixin,
        ...favoritesMixin,
        ...templatesMixin,
        ...statsMixin,
        ...metadataMixin,
        ...sidebarMixin,
        ...settingsMixin,
        ...editorMixin,
        ...tiptapMixin,
        ...notesMixin,
        ...foldersMixin,
        ...searchMixin,
        ...imagesMixin,
        ...pluginsMixin,
        ...graphMixin,
        ...markdownMixin,
        ...spreadsheetMixin,
        ...drawioMixin,
        ...uiMixin,
        ...exportMixin,
        ...initMixin,

        // Check if app is empty (no notes and no folders)
        get isAppEmpty() {
            const notesArray = Array.isArray(this.notes) ? this.notes : [];
            const foldersArray = Array.isArray(this.allFolders) ? this.allFolders : [];
            return notesArray.length === 0 && foldersArray.length === 0;
        },
    };
}

// Expose noteApp globally for Alpine.js x-data binding
window.noteApp = noteApp;
