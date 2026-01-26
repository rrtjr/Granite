// Granite Frontend - Main App Entry Point (Modular)
// This file composes all mixins into the main Alpine.js noteApp component

console.log('[Granite] Starting module loader...');

// Use dynamic imports with error handling to identify which module fails
let CONFIG, ErrorHandler;
let stateMixin, helpersMixin, themesMixin, tagsMixin, favoritesMixin, templatesMixin;
let statsMixin, metadataMixin, sidebarMixin, settingsMixin, editorMixin, tiptapMixin;
let notesMixin, foldersMixin, folderOperationsMixin, folderRenderMixin;
let searchMixin, imagesMixin, pluginsMixin;
let graphMixin, markdownMixin, uiMixin, exportMixin, initMixin;
let spreadsheetMixin;

async function loadModules() {
    const modules = [
        { name: 'config', path: './modules/config.js' },
        { name: 'state', path: './modules/state.js' },
        { name: 'helpers', path: './modules/helpers.js' },
        { name: 'themes', path: './modules/themes.js' },
        { name: 'tags', path: './modules/tags.js' },
        { name: 'favorites', path: './modules/favorites.js' },
        { name: 'templates', path: './modules/templates.js' },
        { name: 'stats', path: './modules/stats.js' },
        { name: 'metadata', path: './modules/metadata.js' },
        { name: 'sidebar', path: './modules/sidebar.js' },
        { name: 'settings', path: './modules/settings.js' },
        { name: 'editor', path: './modules/editor.js' },
        { name: 'tiptap', path: './modules/tiptap.js' },
        { name: 'notes', path: './modules/notes.js' },
        { name: 'folders', path: './modules/folders.js' },
        { name: 'folder-operations', path: './modules/folder-operations.js' },
        { name: 'folder-render', path: './modules/folder-render.js' },
        { name: 'search', path: './modules/search.js' },
        { name: 'images', path: './modules/images.js' },
        { name: 'plugins', path: './modules/plugins.js' },
        { name: 'graph', path: './modules/graph.js' },
        { name: 'markdown', path: './modules/markdown.js' },
        { name: 'ui', path: './modules/ui.js' },
        { name: 'export', path: './modules/export.js' },
        { name: 'init', path: './modules/init.js' },
        { name: 'spreadsheet', path: './modules/spreadsheet.js' },
    ];

    const loaded = {};

    for (const mod of modules) {
        try {
            console.log(`[Granite] Loading ${mod.name}.js...`);
            loaded[mod.name] = await import(mod.path);
            console.log(`[Granite] OK: ${mod.name}.js`);
        } catch (error) {
            console.error(`[Granite] FAILED: ${mod.name}.js -`, error.message);
            throw new Error(`Failed to load ${mod.name}.js: ${error.message}`);
        }
    }

    // Extract exports
    CONFIG = loaded.config.CONFIG;
    ErrorHandler = loaded.config.ErrorHandler;
    stateMixin = loaded.state.stateMixin;
    helpersMixin = loaded.helpers.helpersMixin;
    themesMixin = loaded.themes.themesMixin;
    tagsMixin = loaded.tags.tagsMixin;
    favoritesMixin = loaded.favorites.favoritesMixin;
    templatesMixin = loaded.templates.templatesMixin;
    statsMixin = loaded.stats.statsMixin;
    metadataMixin = loaded.metadata.metadataMixin;
    sidebarMixin = loaded.sidebar.sidebarMixin;
    settingsMixin = loaded.settings.settingsMixin;
    editorMixin = loaded.editor.editorMixin;
    tiptapMixin = loaded.tiptap.tiptapMixin;
    notesMixin = loaded.notes.notesMixin;
    foldersMixin = loaded.folders.foldersMixin;
    folderOperationsMixin = loaded['folder-operations'].folderOperationsMixin;
    folderRenderMixin = loaded['folder-render'].folderRenderMixin;
    searchMixin = loaded.search.searchMixin;
    imagesMixin = loaded.images.imagesMixin;
    pluginsMixin = loaded.plugins.pluginsMixin;
    graphMixin = loaded.graph.graphMixin;
    markdownMixin = loaded.markdown.markdownMixin;
    uiMixin = loaded.ui.uiMixin;
    exportMixin = loaded.export.exportMixin;
    initMixin = loaded.init.initMixin;
    spreadsheetMixin = loaded.spreadsheet.spreadsheetMixin;

    // Make CONFIG and ErrorHandler available globally
    window.CONFIG = CONFIG;
    window.ErrorHandler = ErrorHandler;

    console.log('[Granite] All modules loaded successfully!');

    // Verify all mixins are defined
    const mixins = {
        stateMixin, helpersMixin, themesMixin, tagsMixin, favoritesMixin, templatesMixin,
        statsMixin, metadataMixin, sidebarMixin, settingsMixin, editorMixin, tiptapMixin,
        notesMixin, foldersMixin, folderOperationsMixin, folderRenderMixin,
        searchMixin, imagesMixin, pluginsMixin,
        graphMixin, markdownMixin, uiMixin, exportMixin, initMixin,
        spreadsheetMixin
    };

    for (const [name, mixin] of Object.entries(mixins)) {
        if (mixin === undefined || mixin === null) {
            console.error(`[Granite] Mixin ${name} is ${mixin}!`);
            throw new Error(`Mixin ${name} is ${mixin}`);
        }
        console.log(`[Granite] Mixin OK: ${name} (${typeof mixin})`);
    }

    return true;
}

/**
 * Merge multiple objects while preserving getters/setters.
 * Regular spread (...obj) evaluates getters immediately, losing reactivity.
 * This function properly copies property descriptors to preserve getters.
 */
function mergeWithGetters(...sources) {
    const result = {};
    for (const source of sources) {
        if (!source) continue;
        const descriptors = Object.getOwnPropertyDescriptors(source);
        Object.defineProperties(result, descriptors);
    }
    return result;
}

/**
 * Main Alpine.js component for the Granite note-taking app.
 * Composed from multiple mixins for better modularity and maintainability.
 */
function noteApp() {
    try {
        // Use mergeWithGetters instead of spread to preserve reactive getters
        const result = mergeWithGetters(
            stateMixin,
            helpersMixin,
            themesMixin,
            tagsMixin,
            favoritesMixin,
            templatesMixin,
            statsMixin,
            metadataMixin,
            sidebarMixin,
            settingsMixin,
            editorMixin,
            tiptapMixin,
            notesMixin,
            foldersMixin,
            folderOperationsMixin,
            folderRenderMixin,
            searchMixin,
            imagesMixin,
            pluginsMixin,
            graphMixin,
            markdownMixin,
            uiMixin,
            exportMixin,
            initMixin,
            spreadsheetMixin,
        );
        console.log('[Granite] noteApp() built successfully with', Object.keys(result).length, 'properties');
        return result;
    } catch (error) {
        console.error('[Granite] Error building noteApp:', error);
        return {
            error: error.message,
            init() {
                console.error('Granite failed to load:', error);
                document.body.innerHTML = `
                    <div style="padding: 40px; font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                        <h1 style="color: #ef4444;">Granite Failed to Load</h1>
                        <p>There was an error loading the application:</p>
                        <pre style="background: #f3f4f6; padding: 16px; border-radius: 8px; overflow: auto;">${error.message}</pre>
                        <p>Check the browser console (F12) for more details.</p>
                    </div>
                `;
            }
        };
    }
}

// Load modules and then initialize Alpine
loadModules()
    .then(() => {
        // Expose noteApp globally for Alpine.js x-data binding
        window.noteApp = noteApp;
        console.log('[Granite] noteApp registered. Loading Alpine.js...');

        // Dynamically load Alpine.js after noteApp is ready
        const alpineScript = document.createElement('script');
        alpineScript.src = 'https://cdn.jsdelivr.net/npm/alpinejs@3.14.1/dist/cdn.min.js';
        alpineScript.onload = () => {
            console.log('[Granite] Alpine.js loaded and initialized.');
        };
        alpineScript.onerror = (err) => {
            console.error('[Granite] Failed to load Alpine.js:', err);
        };
        document.head.appendChild(alpineScript);
    })
    .catch((error) => {
        console.error('[Granite] Module loading failed:', error);
        document.body.innerHTML = `
            <div style="padding: 40px; font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #ef4444;">Granite Failed to Load</h1>
                <p>There was an error loading the application modules:</p>
                <pre style="background: #f3f4f6; padding: 16px; border-radius: 8px; overflow: auto;">${error.message}</pre>
                <p>Check the browser console (F12) for more details.</p>
            </div>
        `;
    });
