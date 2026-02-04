// Granite Frontend - Stacked Panes Module
// Obsidian-style sliding panes for multi-note viewing

import { CONFIG, Debug } from './config.js';

export const panesMixin = {
    // Generate unique pane ID
    generatePaneId() {
        return 'pane-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    },

    // Open a note in a new pane (or focus existing)
    async openInPane(notePath, options = {}) {
        const {
            focusExisting = true,  // Focus if already open
            width = 500,           // Default pane width
        } = options;

        Debug.log('openInPane:', notePath, options);

        // Check if note is already open
        const existingPane = this.openPanes.find(p => p.path === notePath);
        if (existingPane && focusExisting) {
            this.focusPane(existingPane.id);
            this.scrollPaneIntoView(existingPane.id);
            return existingPane;
        }

        // Enforce max panes limit
        if (this.openPanes.length >= this.maxPanes) {
            // Close oldest non-dirty pane
            const oldestClean = this.openPanes.find(p => !p.isDirty);
            if (oldestClean) {
                await this.closePane(oldestClean.id, { save: false, prompt: false });
            } else {
                this.addToast('Maximum panes reached. Close a pane first.', 'warning');
                return null;
            }
        }

        // Fetch note content
        try {
            const response = await fetch(`/api/notes/${notePath}`);
            if (!response.ok) {
                if (response.status === 404) {
                    this.addToast('Note not found', 'error');
                }
                return null;
            }
            const data = await response.json();

            // Create new pane object
            // Panes only support 'edit' and 'split' modes (Rich Editor is a separate panel)
            const paneViewMode = (this.viewMode === 'edit' || this.viewMode === 'split') ? this.viewMode : 'split';
            const newPane = {
                id: this.generatePaneId(),
                path: notePath,
                content: data.content,
                name: notePath.split('/').pop().replace('.md', ''),
                editorView: null,
                tiptapEditor: null,
                scrollPos: 0,
                previewScrollPos: 0,
                viewMode: paneViewMode, // Only 'edit' or 'split' - 'rich' is handled by Rich Editor panel
                isDirty: false,
                lastSaved: new Date(),
                width: width,
                undoHistory: [data.content],
                redoHistory: [],
                _saveTimeout: null,
                metadataExpanded: false, // Frontmatter panel expanded state
            };

            // Insert after active pane or at end
            const activeIndex = this.openPanes.findIndex(p => p.id === this.activePaneId);
            const insertIndex = activeIndex !== -1 ? activeIndex + 1 : this.openPanes.length;
            this.openPanes.splice(insertIndex, 0, newPane);

            // Focus the new pane
            this.activePaneId = newPane.id;

            // Update URL
            this.updatePanesUrl();

            // Save panes state
            this.savePanesState();

            // Initialize editor after DOM update
            this.$nextTick(() => {
                this.initPaneEditor(newPane.id);
                this.scrollPaneIntoView(newPane.id);
            });

            Debug.log('Pane created:', newPane.id, newPane.path);
            return newPane;

        } catch (error) {
            Debug.error('Error opening pane:', error);
            this.addToast('Failed to load note', 'error');
            return null;
        }
    },

    // Focus a specific pane
    focusPane(paneId) {
        const paneIndex = this.openPanes.findIndex(p => p.id === paneId);
        if (paneIndex === -1) return;

        const pane = this.openPanes[paneIndex];

        // No change needed if already active
        if (this.activePaneId === paneId) return;

        Debug.log('Focusing pane:', paneId, 'from:', this.activePaneId);

        // Save scroll position of previously active pane
        if (this.activePaneId) {
            this.savePaneScrollPosition(this.activePaneId);
        }

        this.activePaneId = paneId;

        // Force Alpine reactivity by creating a new array reference
        this.openPanes = this.openPanes.slice();

        this.updatePanesUrl();

        // Restore focus to editor after DOM update
        this.$nextTick(() => {
            if (pane.editorView) {
                pane.editorView.focus();
            }
            // Update Rich Editor panel content if open
            if (this.showRichEditorPanel && this.tiptapEditor) {
                this.updateTiptapContent(pane.content);
            }
        });

        Debug.log('Focused pane complete:', paneId);
    },

    // Close a pane
    async closePane(paneId, options = { save: true, prompt: true }) {
        const pane = this.openPanes.find(p => p.id === paneId);
        if (!pane) return false;

        // Check for unsaved changes
        if (pane.isDirty && options.prompt) {
            if (!confirm(`"${pane.name}" has unsaved changes. Close anyway?`)) {
                return false;
            }
        }

        // Save if requested and dirty
        if (pane.isDirty && options.save) {
            await this.savePane(paneId);
        }

        // Clear any pending save timeout
        if (pane._saveTimeout) {
            clearTimeout(pane._saveTimeout);
        }

        // Destroy editor instance
        this.destroyPaneEditor(paneId);

        // Remove from array
        const index = this.openPanes.findIndex(p => p.id === paneId);
        this.openPanes.splice(index, 1);

        // Focus adjacent pane
        if (this.activePaneId === paneId) {
            if (this.openPanes.length > 0) {
                const newIndex = Math.min(index, this.openPanes.length - 1);
                this.activePaneId = this.openPanes[newIndex].id;
            } else {
                this.activePaneId = null;
            }
        }

        this.updatePanesUrl();
        this.savePanesState();

        Debug.log('Closed pane:', paneId);
        return true;
    },

    // Close all panes except specified
    async closePanesExcept(keepPaneId = null) {
        const panesToClose = [...this.openPanes].filter(p => p.id !== keepPaneId);
        for (const pane of panesToClose) {
            await this.closePane(pane.id, { save: true, prompt: false });
        }
    },

    // Close all panes
    async closeAllPanes() {
        await this.closePanesExcept(null);
    },

    // Initialize CodeMirror for a pane
    initPaneEditor(paneId) {
        const pane = this.openPanes.find(p => p.id === paneId);
        if (!pane) return;

        // Skip if editor already initialized
        if (pane.editorView) return;

        // Note: Panes only support 'edit' and 'split' modes
        // Rich Editor is a separate panel that syncs with the active pane

        const container = document.querySelector(`[data-pane-id="${paneId}"] .pane-editor-container`);
        if (!container) {
            Debug.log(`Editor container not found for pane ${paneId}, will retry`);
            // Retry after a short delay
            setTimeout(() => this.initPaneEditor(paneId), 50);
            return;
        }

        // Check if CodeMirror is loaded
        if (!window.CodeMirror) {
            Debug.log('CodeMirror not loaded yet, will retry');
            setTimeout(() => this.initPaneEditor(paneId), 100);
            return;
        }

        const { EditorView, EditorState, markdown, basicExtensions, Compartment } = window.CodeMirror;

        const themeCompartment = new Compartment();
        const self = this;

        // Update listener for content changes
        const updateListener = EditorView.updateListener.of((update) => {
            if (update.docChanged && !self._tiptapUpdating) {
                const content = update.state.doc.toString();
                pane.content = content;
                pane.isDirty = true;
                self.autoSavePane(paneId);

                // Sync to Rich Editor panel if open and this is the active pane
                if (self.showRichEditorPanel && self.activePaneId === paneId && self.tiptapEditor) {
                    self.debouncedSyncToTiptap(content);
                }
            }
        });

        // Create editor state
        const startState = EditorState.create({
            doc: pane.content,
            extensions: [
                ...basicExtensions,
                markdown(),
                themeCompartment.of([]),
                updateListener,
                EditorView.lineWrapping,
                EditorView.theme({
                    "&": { height: "100%" },
                    ".cm-scroller": { overflow: "auto" }
                })
            ]
        });

        // Create editor view
        pane.editorView = new EditorView({
            state: startState,
            parent: container
        });

        // Apply theme
        if (this.editorThemeCompartment && this.getEditorTheme) {
            try {
                const theme = this.getEditorTheme();
                pane.editorView.dispatch({
                    effects: themeCompartment.reconfigure(theme)
                });
            } catch (e) {
                Debug.log('Could not apply editor theme:', e);
            }
        }

        // Restore scroll position
        if (pane.scrollPos > 0) {
            pane.editorView.scrollDOM.scrollTop = pane.scrollPos;
        }

        // Setup scroll sync for split mode (with delay to ensure preview is rendered)
        if (pane.viewMode === 'split') {
            setTimeout(() => this.setupPaneScrollSync(paneId), 100);
        }

        Debug.log('Initialized editor for pane:', paneId);
    },

    // Initialize Tiptap for a pane (Rich mode)
    initPaneTiptap(paneId) {
        const pane = this.openPanes.find(p => p.id === paneId);
        if (!pane || pane.tiptapEditor) return;

        // Use the existing Tiptap initialization but target pane container
        // This will be handled by tiptap.js integration
        Debug.log('Tiptap init for pane:', paneId, '- delegating to tiptap module');
    },

    // Destroy editor for a pane
    destroyPaneEditor(paneId) {
        const pane = this.openPanes.find(p => p.id === paneId);
        if (!pane) return;

        // Clean up scroll sync handlers
        this.cleanupPaneScrollSync(paneId);

        if (pane.editorView) {
            pane.editorView.destroy();
            pane.editorView = null;
        }
        if (pane.tiptapEditor) {
            pane.tiptapEditor.destroy();
            pane.tiptapEditor = null;
        }

        Debug.log('Destroyed editor for pane:', paneId);
    },

    // Setup scroll sync between editor and preview for a pane
    setupPaneScrollSync(paneId) {
        const pane = this.openPanes.find(p => p.id === paneId);
        if (!pane || !pane.editorView || pane.viewMode !== 'split') return;

        // Clean up any existing handlers first
        this.cleanupPaneScrollSync(paneId);

        const editorScroller = pane.editorView.scrollDOM;
        const previewEl = document.querySelector(`[data-pane-id="${paneId}"] .pane-preview`);

        if (!editorScroller || !previewEl) {
            Debug.log('Scroll sync: elements not found for pane', paneId);
            return;
        }

        // Flag to prevent infinite scroll loops
        let isScrolling = false;

        // Editor scroll -> Preview scroll
        const editorScrollHandler = () => {
            if (isScrolling) {
                isScrolling = false;
                return;
            }

            const scrollableHeight = editorScroller.scrollHeight - editorScroller.clientHeight;
            if (scrollableHeight <= 0) return;

            const scrollPercentage = editorScroller.scrollTop / scrollableHeight;
            const previewScrollableHeight = previewEl.scrollHeight - previewEl.clientHeight;

            if (previewScrollableHeight > 0) {
                isScrolling = true;
                previewEl.scrollTop = scrollPercentage * previewScrollableHeight;
            }
        };

        // Preview scroll -> Editor scroll
        const previewScrollHandler = () => {
            if (isScrolling) {
                isScrolling = false;
                return;
            }

            const scrollableHeight = previewEl.scrollHeight - previewEl.clientHeight;
            if (scrollableHeight <= 0) return;

            const scrollPercentage = previewEl.scrollTop / scrollableHeight;
            const editorScrollableHeight = editorScroller.scrollHeight - editorScroller.clientHeight;

            if (editorScrollableHeight > 0) {
                isScrolling = true;
                editorScroller.scrollTop = scrollPercentage * editorScrollableHeight;
            }
        };

        // Attach listeners
        editorScroller.addEventListener('scroll', editorScrollHandler);
        previewEl.addEventListener('scroll', previewScrollHandler);

        // Store handlers on pane for cleanup
        pane._scrollSyncHandlers = {
            editor: editorScrollHandler,
            preview: previewScrollHandler,
            editorEl: editorScroller,
            previewEl: previewEl
        };

        Debug.log('Scroll sync setup for pane:', paneId);
    },

    // Cleanup scroll sync handlers for a pane
    cleanupPaneScrollSync(paneId) {
        const pane = this.openPanes.find(p => p.id === paneId);
        if (!pane || !pane._scrollSyncHandlers) return;

        const { editor, preview, editorEl, previewEl } = pane._scrollSyncHandlers;

        if (editorEl && editor) {
            editorEl.removeEventListener('scroll', editor);
        }
        if (previewEl && preview) {
            previewEl.removeEventListener('scroll', preview);
        }

        pane._scrollSyncHandlers = null;
        Debug.log('Scroll sync cleaned up for pane:', paneId);
    },

    // Update pane's CodeMirror editor content (from external source like Tiptap)
    updatePaneEditorContent(paneId, content) {
        const pane = this.openPanes.find(p => p.id === paneId);
        if (!pane || !pane.editorView) return;

        const currentContent = pane.editorView.state.doc.toString();
        if (currentContent === content) return; // No change needed

        // Update editor without triggering the change listener
        const { EditorView } = window.CodeMirror;
        pane.editorView.dispatch({
            changes: {
                from: 0,
                to: pane.editorView.state.doc.length,
                insert: content
            }
        });

        Debug.log('Updated pane editor content:', paneId);
    },

    // Save scroll position for a pane
    savePaneScrollPosition(paneId) {
        const pane = this.openPanes.find(p => p.id === paneId);
        if (!pane) return;

        if (pane.editorView) {
            pane.scrollPos = pane.editorView.scrollDOM.scrollTop;
        }

        // Also save preview scroll if in split mode
        const previewEl = document.querySelector(`[data-pane-id="${paneId}"] .pane-preview`);
        if (previewEl) {
            pane.previewScrollPos = previewEl.scrollTop;
        }
    },

    // Scroll pane into view in horizontal container
    scrollPaneIntoView(paneId) {
        const paneEl = document.querySelector(`[data-pane-id="${paneId}"]`);
        if (!paneEl) return;

        paneEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    },

    // Auto-save a specific pane (debounced)
    autoSavePane(paneId) {
        const pane = this.openPanes.find(p => p.id === paneId);
        if (!pane) return;

        if (pane._saveTimeout) {
            clearTimeout(pane._saveTimeout);
        }

        pane._saveTimeout = setTimeout(() => {
            this.savePane(paneId);
        }, this.performanceSettings.autosaveDelay);
    },

    // Save a specific pane
    async savePane(paneId) {
        const pane = this.openPanes.find(p => p.id === paneId);
        if (!pane || !pane.isDirty) return;

        try {
            const response = await fetch(`/api/notes/${pane.path}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: pane.content })
            });

            if (response.ok) {
                pane.isDirty = false;
                pane.lastSaved = new Date();
                Debug.log('Saved pane:', paneId);

                // Update note in notes list if needed
                const noteInList = this.notes.find(n => n.path === pane.path);
                if (noteInList) {
                    noteInList.modified = pane.lastSaved.toISOString();
                }
            }
        } catch (error) {
            Debug.error('Error saving pane:', error);
            this.addToast('Failed to save note', 'error');
        }
    },

    // Update URL to reflect active pane
    updatePanesUrl() {
        if (this.activePane) {
            const pathWithoutExtension = this.activePane.path.replace('.md', '');
            const encodedPath = pathWithoutExtension.split('/').map(segment => encodeURIComponent(segment)).join('/');

            window.history.pushState(
                {
                    panes: this.openPanes.map(p => p.path),
                    activePaneId: this.activePaneId
                },
                '',
                `/${encodedPath}`
            );
        } else {
            window.history.pushState({ panes: [], activePaneId: null }, '', '/');
        }
    },

    // Save panes state to localStorage
    savePanesState() {
        try {
            const state = {
                panes: this.openPanes.map(p => ({
                    path: p.path,
                    viewMode: p.viewMode,
                    width: p.width,
                })),
                activePaneId: this.activePaneId,
            };
            localStorage.setItem('granitePanesState', JSON.stringify(state));
        } catch (error) {
            Debug.error('Error saving panes state:', error);
        }
    },

    // Restore panes from localStorage
    async restorePanesState() {
        try {
            const saved = localStorage.getItem('granitePanesState');
            if (!saved) return false;

            const state = JSON.parse(saved);
            if (!state.panes || state.panes.length === 0) return false;

            Debug.log('Restoring panes state:', state);

            for (const paneData of state.panes) {
                const pane = await this.openInPane(paneData.path, {
                    focusExisting: false,
                    width: paneData.width || 500
                });
                if (pane) {
                    // Ensure viewMode is only 'edit' or 'split' (not 'rich')
                    const restoredMode = paneData.viewMode;
                    pane.viewMode = (restoredMode === 'edit' || restoredMode === 'split') ? restoredMode : 'split';
                }
            }

            // Restore active pane
            const targetActive = this.openPanes.find(p => {
                const savedPane = state.panes.find(sp => sp.path === p.path);
                return savedPane && state.panes.indexOf(savedPane) === state.panes.findIndex(sp => sp.path === p.path);
            });
            if (targetActive) {
                this.activePaneId = targetActive.id;
            }

            // Force Alpine reactivity after all panes are restored with their viewModes
            this.openPanes = this.openPanes.slice();

            Debug.log('Panes restored:', this.openPanes.length, 'active:', this.activePaneId);

            return this.openPanes.length > 0;
        } catch (error) {
            Debug.error('Error restoring panes state:', error);
            return false;
        }
    },

    // Handle pane resize
    startPaneResize(paneId, event) {
        event.preventDefault();
        event.stopPropagation();

        const pane = this.openPanes.find(p => p.id === paneId);
        if (!pane) return;

        const startX = event.clientX;
        const startWidth = pane.width;

        const resize = (e) => {
            const delta = e.clientX - startX;
            const newWidth = Math.max(300, Math.min(1200, startWidth + delta));
            pane.width = newWidth;
        };

        const stopResize = () => {
            document.removeEventListener('mousemove', resize);
            document.removeEventListener('mouseup', stopResize);
            this.savePanesState();
        };

        document.addEventListener('mousemove', resize);
        document.addEventListener('mouseup', stopResize);
    },

    // Set view mode for a pane
    setPaneViewMode(paneId, mode) {
        const paneIndex = this.openPanes.findIndex(p => p.id === paneId);
        if (paneIndex === -1) return;

        // Panes only support 'edit' and 'split' modes
        if (mode !== 'edit' && mode !== 'split') {
            Debug.warn('Invalid pane view mode:', mode, '- defaulting to split');
            mode = 'split';
        }

        const pane = this.openPanes[paneIndex];
        const oldMode = pane.viewMode;
        if (oldMode === mode) return; // No change needed

        Debug.log('Setting pane view mode:', paneId, oldMode, '->', mode);

        pane.viewMode = mode;

        // Force Alpine reactivity by creating a new array reference
        // slice() creates a shallow copy which triggers array change detection
        this.openPanes = this.openPanes.slice();

        Debug.log('Set pane view mode complete, viewMode is now:', pane.viewMode);

        // Handle scroll sync based on view mode
        if (mode === 'split') {
            // Setup scroll sync when switching to split mode
            this.$nextTick(() => {
                setTimeout(() => this.setupPaneScrollSync(paneId), 100);
            });
        } else if (oldMode === 'split') {
            // Cleanup scroll sync when leaving split mode
            this.cleanupPaneScrollSync(paneId);
        }

        // Handle editor transitions
        if (oldMode === 'rich' && mode !== 'rich') {
            // Destroy Tiptap, init CodeMirror
            if (pane.tiptapEditor) {
                pane.tiptapEditor.destroy();
                pane.tiptapEditor = null;
            }
            this.$nextTick(() => this.initPaneEditor(paneId));
        } else if (oldMode !== 'rich' && mode === 'rich') {
            // Destroy CodeMirror, init Tiptap
            if (pane.editorView) {
                pane.editorView.destroy();
                pane.editorView = null;
            }
            this.$nextTick(() => this.initPaneTiptap(paneId));
        }

        this.savePanesState();
    },

    // Focus next pane
    focusNextPane() {
        if (this.openPanes.length <= 1) return;

        const currentIndex = this.openPanes.findIndex(p => p.id === this.activePaneId);
        const nextIndex = (currentIndex + 1) % this.openPanes.length;
        this.focusPane(this.openPanes[nextIndex].id);
        this.scrollPaneIntoView(this.openPanes[nextIndex].id);
    },

    // Focus previous pane
    focusPreviousPane() {
        if (this.openPanes.length <= 1) return;

        const currentIndex = this.openPanes.findIndex(p => p.id === this.activePaneId);
        const prevIndex = currentIndex <= 0 ? this.openPanes.length - 1 : currentIndex - 1;
        this.focusPane(this.openPanes[prevIndex].id);
        this.scrollPaneIntoView(this.openPanes[prevIndex].id);
    },

    // Render markdown preview for a pane (includes banner, wikilinks, images)
    renderPanePreview(pane) {
        if (!pane || !pane.content) return '';

        const originalContent = pane.content;

        // Parse banner from frontmatter (before stripping)
        let bannerUrl = null;
        if (typeof this.parseBannerFromContent === 'function') {
            const bannerInfo = this.parseBannerFromContent(originalContent);
            if (bannerInfo && bannerInfo.url) {
                bannerUrl = bannerInfo.url;
            }
        }

        // Strip frontmatter from content
        let contentToRender = originalContent;
        if (contentToRender.trim().startsWith('---')) {
            const lines = contentToRender.split('\n');
            if (lines[0].trim() === '---') {
                let endIdx = -1;
                for (let i = 1; i < lines.length; i++) {
                    if (lines[i].trim() === '---') {
                        endIdx = i;
                        break;
                    }
                }
                if (endIdx !== -1) {
                    contentToRender = lines.slice(endIdx + 1).join('\n').trim();
                }
            }
        }

        // Process image embeds ![[image]]
        if (this.notes) {
            const allImages = this.notes.filter(n => n.type === 'image');
            contentToRender = contentToRender.replace(
                /!\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
                (match, target, altText) => {
                    const imageTarget = target.trim();
                    const imageAlt = altText ? altText.trim() : imageTarget;
                    const imageTargetLower = imageTarget.toLowerCase();

                    const foundImage = allImages.find(img => {
                        const nameLower = img.name.toLowerCase();
                        return (
                            img.name === imageTarget ||
                            nameLower === imageTargetLower ||
                            img.path === imageTarget ||
                            img.path.toLowerCase() === imageTargetLower
                        );
                    });

                    if (foundImage) {
                        const encodedPath = foundImage.path.split('/').map(segment => encodeURIComponent(segment)).join('/');
                        const safeAlt = imageAlt.replace(/"/g, '&quot;').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                        return `<img src="/api/images/${encodedPath}" alt="${safeAlt}" title="${safeAlt}" />`;
                    } else {
                        const safeTarget = imageTarget.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                        return `<span class="wikilink-broken" title="Image not found">![[${safeTarget}]]</span>`;
                    }
                }
            );

            // Process wikilinks [[link]]
            const notes = this.notes;
            const allFolders = this.allFolders || [];
            contentToRender = contentToRender.replace(
                /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
                (match, target, displayText) => {
                    const linkTarget = target.trim();
                    const linkText = displayText ? displayText.trim() : linkTarget;
                    const linkTargetLower = linkTarget.toLowerCase();

                    const noteExists = notes.some(n => {
                        const pathLower = n.path.toLowerCase();
                        const nameLower = n.name.toLowerCase();
                        return (
                            n.path === linkTarget ||
                            n.path === linkTarget + '.md' ||
                            pathLower === linkTargetLower ||
                            pathLower === linkTargetLower + '.md' ||
                            n.name === linkTarget ||
                            n.name === linkTarget + '.md' ||
                            nameLower === linkTargetLower ||
                            nameLower === linkTargetLower + '.md' ||
                            n.path.endsWith('/' + linkTarget) ||
                            n.path.endsWith('/' + linkTarget + '.md') ||
                            pathLower.endsWith('/' + linkTargetLower) ||
                            pathLower.endsWith('/' + linkTargetLower + '.md')
                        );
                    });

                    const folderExists = allFolders.some(f => {
                        const folderLower = f.toLowerCase();
                        const folderName = f.split('/').pop();
                        const folderNameLower = folderName.toLowerCase();
                        return (
                            f === linkTarget ||
                            folderLower === linkTargetLower ||
                            folderName === linkTarget ||
                            folderNameLower === linkTargetLower ||
                            f.endsWith('/' + linkTarget) ||
                            folderLower.endsWith('/' + linkTargetLower)
                        );
                    });

                    const safeHref = linkTarget.replace(/"/g, '%22');
                    const safeText = linkText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                    const linkExists = noteExists || folderExists;
                    const brokenClass = linkExists ? '' : ' class="wikilink-broken"';
                    const folderAttr = (folderExists && !noteExists) ? ' data-folder-link="true"' : '';
                    return `<a href="${safeHref}"${brokenClass} data-wikilink="true"${folderAttr}>${safeText}</a>`;
                }
            );
        }

        // Render markdown
        let html = '';
        if (window.marked) {
            window.marked.setOptions({
                breaks: true,
                gfm: true,
                highlight: function(code, lang) {
                    if (lang && window.hljs && window.hljs.getLanguage(lang)) {
                        try {
                            return window.hljs.highlight(code, { language: lang }).value;
                        } catch (err) {
                            Debug.error('Highlight error:', err);
                        }
                    }
                    return window.hljs ? window.hljs.highlightAuto(code).value : code;
                }
            });
            html = window.marked.parse(contentToRender);
        } else {
            html = contentToRender;
        }

        // Post-process: handle relative images and external links
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;

        // Make external links open in new tab
        const links = tempDiv.querySelectorAll('a');
        links.forEach(link => {
            const href = link.getAttribute('href');
            if (href && typeof href === 'string') {
                const isExternal = href.indexOf('http://') === 0 ||
                                  href.indexOf('https://') === 0 ||
                                  href.indexOf('//') === 0;
                if (isExternal) {
                    link.setAttribute('target', '_blank');
                    link.setAttribute('rel', 'noopener noreferrer');
                }
            }
        });

        // Handle relative image paths
        const images = tempDiv.querySelectorAll('img');
        images.forEach(img => {
            const src = img.getAttribute('src');
            if (src && !src.startsWith('http://') && !src.startsWith('https://') &&
                !src.startsWith('//') && !src.startsWith('/api/images/') &&
                !src.startsWith('data:')) {

                let imagePath = src;
                if (!src.startsWith('/')) {
                    const currentNoteFolder = pane.path ?
                        (pane.path.includes('/') ? pane.path.substring(0, pane.path.lastIndexOf('/')) : '')
                        : '';
                    if (currentNoteFolder) {
                        imagePath = `${currentNoteFolder}/${src}`;
                    }
                } else {
                    imagePath = src.substring(1);
                }

                const encodedPath = imagePath.split('/').map(segment => encodeURIComponent(segment)).join('/');
                img.setAttribute('src', `/api/images/${encodedPath}`);
            }

            const altText = img.getAttribute('alt');
            if (altText) {
                img.setAttribute('title', altText);
            }
        });

        html = tempDiv.innerHTML;

        // Add banner if present
        if (bannerUrl) {
            const safeUrl = bannerUrl.replace(/"/g, '%22');
            const opacity = this.bannerOpacity || 0.5;

            let titleHtml = '';
            const h1Match = html.match(/<h1[^>]*>(.*?)<\/h1>/i);
            if (h1Match) {
                const titleText = h1Match[1];
                titleHtml = `<h1 class="banner-title">${titleText}</h1>`;
                html = html.replace(h1Match[0], '');
            }

            const bannerHtml = `<div class="note-banner"><div class="banner-image" style="background-image: url('${safeUrl}'); opacity: ${opacity}"></div>${titleHtml}</div>`;
            html = bannerHtml + html;
        }

        // Trigger math typesetting and mermaid rendering for this pane
        setTimeout(() => {
            const paneEl = document.querySelector(`[data-pane-id="${pane.id}"] .pane-preview`);
            if (paneEl) {
                // Syntax highlighting for code blocks
                paneEl.querySelectorAll('pre code:not(.language-mermaid):not(.language-spreadsheet)').forEach((block) => {
                    if (!block.classList.contains('hljs') && window.hljs) {
                        window.hljs.highlightElement(block);
                    }
                });

                // Math typesetting
                if (typeof this.typesetMath === 'function') {
                    this.typesetMath();
                }

                // Mermaid rendering
                if (typeof this.renderMermaid === 'function') {
                    this.renderMermaid();
                }
            }
        }, 0);

        return html;
    },

    // Extract frontmatter from pane content
    getPaneFrontmatter(pane) {
        if (!pane || !pane.content) return null;

        const content = pane.content;
        if (!content.startsWith('---')) return null;

        const endIndex = content.indexOf('\n---', 3);
        if (endIndex === -1) return null;

        const yamlContent = content.slice(4, endIndex).trim();
        try {
            // Simple YAML parsing for common cases
            const metadata = {};
            const lines = yamlContent.split('\n');

            for (const line of lines) {
                const colonIndex = line.indexOf(':');
                if (colonIndex === -1) continue;

                const key = line.slice(0, colonIndex).trim();
                let value = line.slice(colonIndex + 1).trim();

                // Handle arrays (simple single-line format)
                if (value.startsWith('[') && value.endsWith(']')) {
                    value = value.slice(1, -1).split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
                } else if (value.startsWith('"') && value.endsWith('"')) {
                    value = value.slice(1, -1);
                } else if (value.startsWith("'") && value.endsWith("'")) {
                    value = value.slice(1, -1);
                }

                metadata[key] = value;
            }

            return Object.keys(metadata).length > 0 ? metadata : null;
        } catch (e) {
            Debug.error('Error parsing pane frontmatter:', e);
            return null;
        }
    },

    // Check if pane has frontmatter
    paneHasFrontmatter(pane) {
        return this.getPaneFrontmatter(pane) !== null;
    },

    // Get tags from pane frontmatter
    getPaneTags(pane) {
        const metadata = this.getPaneFrontmatter(pane);
        if (!metadata || !metadata.tags) return [];
        return Array.isArray(metadata.tags) ? metadata.tags : [metadata.tags];
    },

    // Get priority fields from pane frontmatter
    getPanePriorityFields(pane) {
        const metadata = this.getPaneFrontmatter(pane);
        if (!metadata) return [];

        const priority = ['date', 'created', 'author', 'status', 'priority', 'type', 'category'];
        const fields = [];

        for (const key of priority) {
            if (metadata[key] !== undefined && !Array.isArray(metadata[key])) {
                fields.push({ key, value: String(metadata[key]) });
            }
        }

        return fields.slice(0, 3); // Limit to 3 fields for compact display
    },

    // Get all metadata fields for expanded view (excludes tags which are shown separately)
    getPaneAllMetadataFields(pane) {
        const metadata = this.getPaneFrontmatter(pane);
        if (!metadata) return [];

        const fields = [];
        for (const [key, value] of Object.entries(metadata)) {
            // Skip tags (shown separately) and arrays
            if (key === 'tags') continue;
            if (Array.isArray(value)) {
                fields.push({ key, value: value.join(', ') });
            } else {
                fields.push({ key, value: String(value) });
            }
        }

        return fields;
    },

    // Toggle pane metadata expanded state
    togglePaneMetadata(pane) {
        if (!pane) return;
        pane.metadataExpanded = !pane.metadataExpanded;
        // Force reactivity
        this.openPanes = this.openPanes.slice();
    },

    // Setup keyboard shortcuts for panes
    setupPaneKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Only handle if we have panes
            if (this.openPanes.length === 0) return;

            // Ctrl/Cmd + W: Close active pane
            if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
                e.preventDefault();
                if (this.activePaneId) {
                    this.closePane(this.activePaneId);
                }
            }

            // Ctrl/Cmd + Tab: Next pane
            if ((e.ctrlKey || e.metaKey) && e.key === 'Tab' && !e.shiftKey) {
                e.preventDefault();
                this.focusNextPane();
            }

            // Ctrl/Cmd + Shift + Tab: Previous pane
            if ((e.ctrlKey || e.metaKey) && e.key === 'Tab' && e.shiftKey) {
                e.preventDefault();
                this.focusPreviousPane();
            }

            // Ctrl/Cmd + 1-9: Focus pane by index
            if ((e.ctrlKey || e.metaKey) && e.key >= '1' && e.key <= '9') {
                const index = parseInt(e.key) - 1;
                if (this.openPanes[index]) {
                    e.preventDefault();
                    this.focusPane(this.openPanes[index].id);
                    this.scrollPaneIntoView(this.openPanes[index].id);
                }
            }
        });
    },

    // Handle popstate for pane navigation
    handlePanesPopstate(state) {
        if (!state || !state.panes) return;

        // For now, just focus the note if it's already open
        if (state.activePaneId) {
            const pane = this.openPanes.find(p => p.id === state.activePaneId);
            if (pane) {
                this.focusPane(pane.id);
            }
        }
    },

    // Debounce sync timeout for CodeMirror → Tiptap
    _paneToTiptapTimeout: null,

    // Debounced sync from pane content to Tiptap (when Rich Editor panel is open)
    debouncedSyncToTiptap(content) {
        if (this._paneToTiptapTimeout) {
            clearTimeout(this._paneToTiptapTimeout);
        }

        this._paneToTiptapTimeout = setTimeout(() => {
            if (this.tiptapEditor && !this._tiptapUpdating) {
                this.updateTiptapContent(content);
            }
        }, this.performanceSettings?.updateDelay || 300);
    },
};
