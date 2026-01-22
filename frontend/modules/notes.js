// Granite Frontend - Notes Module

import { CONFIG, ErrorHandler } from './config.js';

export const notesMixin = {
    // Load all notes
    async loadNotes() {
        try {
            const response = await fetch('/api/notes');
            const data = await response.json();
            this.notes = data.notes;
            this.allFolders = data.folders || [];
            this.buildFolderTree();
            await this.loadTags();
        } catch (error) {
            ErrorHandler.handle('load notes', error);
        }
    },

    // Load a specific note
    async loadNote(notePath, updateHistory = true, searchQuery = '') {
        try {
            this.mobileSidebarOpen = false;

            const response = await fetch(`/api/notes/${notePath}`);

            if (!response.ok) {
                if (response.status === 404) {
                    window.history.replaceState({ homepageFolder: this.selectedHomepageFolder || '' }, '', '/');
                    this.currentNote = '';
                    this.noteContent = '';
                    this.currentImage = '';
                    return;
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            this.currentNote = notePath;
            this.noteContent = data.content;
            this.updateEditorContent(data.content);
            this.currentNoteName = notePath.split('/').pop().replace('.md', '');
            this.currentImage = '';
            this.lastSaved = false;

            // Initialize undo/redo history
            this.undoHistory = [data.content];
            this.redoHistory = [];

            // Update browser URL
            if (updateHistory) {
                const pathWithoutExtension = notePath.replace('.md', '');
                const encodedPath = pathWithoutExtension.split('/').map(segment => encodeURIComponent(segment)).join('/');
                let url = `/${encodedPath}`;
                if (searchQuery) {
                    url += `?search=${encodeURIComponent(searchQuery)}`;
                }
                window.history.pushState(
                    { notePath: notePath, searchQuery: searchQuery, homepageFolder: this.selectedHomepageFolder || '' },
                    '',
                    url
                );
            }

            // Calculate stats if plugin enabled
            if (this.statsPluginEnabled) {
                this.calculateStats();
            }

            // Parse frontmatter metadata
            this.parseMetadata();

            // Store search query for highlighting
            if (searchQuery) {
                this.currentSearchHighlight = searchQuery;
            } else {
                this.currentSearchHighlight = '';
            }

            // Expand folder tree to show the loaded note
            this.expandFolderForNote(notePath);

            this.$nextTick(() => {
                this.$nextTick(() => {
                    this.refreshDOMCache();
                    this.setupScrollSync();
                    this.scrollToTop();

                    if (searchQuery) {
                        this.highlightSearchTerm(searchQuery, true);
                    } else {
                        this.clearSearchHighlights();
                    }

                    this.scrollNoteIntoView(notePath);
                });
            });

        } catch (error) {
            ErrorHandler.handle('load note', error);
        }
    },

    // Load note from URL path
    loadNoteFromURL() {
        let path = window.location.pathname;

        if (path.toLowerCase().endsWith('.md')) {
            path = path.slice(0, -3);
            window.history.replaceState(null, '', path);
        }

        if (path === '/' || path.startsWith('/static/') || path.startsWith('/api/')) {
            return;
        }

        const decodedPath = decodeURIComponent(path.substring(1));
        const matchedItem = this.notes.find(n => n.path === decodedPath);

        if (matchedItem && matchedItem.type === 'image') {
            this.viewImage(decodedPath, false);
        } else {
            const notePath = decodedPath + '.md';
            const urlParams = new URLSearchParams(window.location.search);
            const searchParam = urlParams.get('search');

            this.loadNote(notePath, false, searchParam || '');

            if (searchParam) {
                this.searchQuery = searchParam;
                this.searchNotes();
            }
        }
    },

    // Auto-save with debounce
    autoSave() {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }

        this.lastSaved = false;

        // Debounce undo history
        if (!this.isUndoRedo) {
            if (this.historyTimeout) {
                clearTimeout(this.historyTimeout);
            }
            this.historyTimeout = setTimeout(() => {
                this.pushToHistory();
            }, this.performanceSettings.historyDelay);
        }

        // Debounce stats
        if (this.statsPluginEnabled) {
            if (this.statsTimeout) {
                clearTimeout(this.statsTimeout);
            }
            this.statsTimeout = setTimeout(() => {
                this.calculateStats();
            }, this.performanceSettings.statsDelay);
        }

        // Debounce metadata
        if (this.metadataTimeout) {
            clearTimeout(this.metadataTimeout);
        }
        this.metadataTimeout = setTimeout(() => {
            this.parseMetadata();
        }, this.performanceSettings.metadataDelay);

        // Debounce save
        this.saveTimeout = setTimeout(() => {
            this.saveNote();
        }, this.performanceSettings.autosaveDelay);
    },

    // Push current content to undo history
    pushToHistory() {
        if (this.undoHistory.length > 0 &&
            this.undoHistory[this.undoHistory.length - 1] === this.noteContent) {
            return;
        }

        this.undoHistory.push(this.noteContent);

        if (this.undoHistory.length > this.maxHistorySize) {
            this.undoHistory.shift();
        }

        this.redoHistory = [];
    },

    // Undo last change
    undo() {
        if (!this.currentNote || this.undoHistory.length <= 1) return;

        const currentContent = this.undoHistory.pop();
        this.redoHistory.push(currentContent);

        const previousContent = this.undoHistory[this.undoHistory.length - 1];

        this.isUndoRedo = true;
        this.noteContent = previousContent;
        this.updateEditorContent(previousContent);

        if (this.statsPluginEnabled) {
            this.calculateStats();
        }

        this.$nextTick(() => {
            this.saveNote();
            this.isUndoRedo = false;
        });
    },

    // Redo last undone change
    redo() {
        if (!this.currentNote || this.redoHistory.length === 0) return;

        const nextContent = this.redoHistory.pop();
        this.undoHistory.push(nextContent);

        this.isUndoRedo = true;
        this.noteContent = nextContent;
        this.updateEditorContent(nextContent);

        if (this.statsPluginEnabled) {
            this.calculateStats();
        }

        this.$nextTick(() => {
            this.saveNote();
            this.isUndoRedo = false;
        });
    },

    // Save current note
    async saveNote() {
        if (!this.currentNote) return;

        this.isSaving = true;

        try {
            const response = await fetch(`/api/notes/${this.currentNote}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: this.noteContent })
            });

            if (response.ok) {
                this.lastSaved = true;

                const note = this.notes.find(n => n.path === this.currentNote);
                if (note) {
                    note.modified = new Date().toISOString();
                    note.size = new Blob([this.noteContent]).size;
                    note.tags = this.parseTagsFromContent(this.noteContent);
                }

                this.loadTagsDebounced();

                if (this.selectedTags.length > 0) {
                    this.buildFolderTree();
                }

                setTimeout(() => {
                    this.lastSaved = false;
                }, CONFIG.SAVE_INDICATOR_DURATION);
            } else {
                ErrorHandler.handle('save note', new Error('Server returned error'));
            }
        } catch (error) {
            ErrorHandler.handle('save note', error);
        } finally {
            this.isSaving = false;
        }
    },

    // Rename current note
    async renameNote() {
        if (!this.currentNote) return;

        const oldPath = this.currentNote;
        const newName = this.currentNoteName.trim();

        if (!newName) {
            alert('Note name cannot be empty.');
            return;
        }

        const folder = oldPath.split('/').slice(0, -1).join('/');
        const newPath = folder ? `${folder}/${newName}.md` : `${newName}.md`;

        if (oldPath === newPath) return;

        const existingNote = this.notes.find(n => n.path.toLowerCase() === newPath.toLowerCase());
        if (existingNote) {
            alert(`A note named "${newName}" already exists in this folder.`);
            this.currentNoteName = oldPath.split('/').pop().replace('.md', '');
            return;
        }

        try {
            const response = await fetch(`/api/notes/${newPath}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: this.noteContent })
            });

            if (response.ok) {
                await fetch(`/api/notes/${oldPath}`, { method: 'DELETE' });
                this.currentNote = newPath;
                await this.loadNotes();
            } else {
                ErrorHandler.handle('rename note', new Error('Server returned error'));
            }
        } catch (error) {
            ErrorHandler.handle('rename note', error);
        }
    },

    // Delete current note
    async deleteCurrentNote() {
        if (!this.currentNote) return;
        await this.deleteNote(this.currentNote, this.currentNoteName);
    },

    // Delete any note
    async deleteNote(notePath, noteName) {
        if (!confirm(`Delete "${noteName}"?`)) return;

        try {
            const response = await fetch(`/api/notes/${notePath}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                if (this.currentNote === notePath) {
                    this.currentNote = '';
                    this.noteContent = '';
                    this.currentNoteName = '';
                    window.history.replaceState({}, '', '/');
                }
                await this.loadNotes();
            } else {
                ErrorHandler.handle('delete note', new Error('Server returned error'));
            }
        } catch (error) {
            ErrorHandler.handle('delete note', error);
        }
    },

    // Create a new note
    async createNote(folderPath = null) {
        let targetFolder;
        if (folderPath !== null) {
            targetFolder = folderPath;
        } else if (this.dropdownTargetFolder !== null && this.dropdownTargetFolder !== undefined) {
            targetFolder = this.dropdownTargetFolder;
        } else {
            targetFolder = this.selectedHomepageFolder || '';
        }
        this.closeDropdown();

        const promptText = targetFolder
            ? `Create note in "${targetFolder}".\nEnter note name:`
            : 'Enter note name (you can use folder/name):';

        const noteName = prompt(promptText);
        if (!noteName) return;

        const sanitizedName = noteName.trim().replace(/[^a-zA-Z0-9-_\s\/]/g, '');
        if (!sanitizedName) {
            alert('Invalid note name.');
            return;
        }

        let notePath;
        if (targetFolder) {
            notePath = `${targetFolder}/${sanitizedName}.md`;
        } else {
            notePath = sanitizedName.endsWith('.md') ? sanitizedName : `${sanitizedName}.md`;
        }

        const existingNote = this.notes.find(note => note.path === notePath);
        if (existingNote) {
            alert(`A note named "${sanitizedName}" already exists in this location.\nPlease choose a different name.`);
            return;
        }

        try {
            const response = await fetch(`/api/notes/${notePath}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: '' })
            });

            if (response.ok) {
                if (targetFolder) {
                    this.expandedFolders.add(targetFolder);
                }
                await this.loadNotes();
                await this.loadNote(notePath);
            } else {
                ErrorHandler.handle('create note', new Error('Server returned error'));
            }
        } catch (error) {
            ErrorHandler.handle('create note', error);
        }
    },

    // Copy current note link to clipboard
    async copyNoteLink() {
        if (!this.currentNote) return;

        const pathWithoutExtension = this.currentNote.replace('.md', '');
        const encodedPath = pathWithoutExtension.split('/').map(segment => encodeURIComponent(segment)).join('/');
        const url = `${window.location.origin}/${encodedPath}`;

        try {
            await navigator.clipboard.writeText(url);
        } catch (error) {
            const textArea = document.createElement('textarea');
            textArea.value = url;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
        }

        this.linkCopied = true;
        setTimeout(() => {
            this.linkCopied = false;
        }, 1500);
    },

    // Handle clicks on internal links (wikilinks and markdown links) in the preview
    handleInternalLink(event) {
        const link = event.target.closest('a');
        if (!link) return;

        const href = link.getAttribute('href');
        if (!href) return;

        // Check if it's an external link
        if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('//')) {
            // Let external links open normally
            return;
        }

        // Prevent default navigation
        event.preventDefault();

        // Decode the href (it may be URL encoded)
        let linkTarget = decodeURIComponent(href);

        // Remove leading slash if present
        if (linkTarget.startsWith('/')) {
            linkTarget = linkTarget.substring(1);
        }

        // Check if this is a folder link (has data-folder-link attribute)
        const isFolderLink = link.hasAttribute('data-folder-link');

        // Try to find the matching note first (unless explicitly a folder link)
        const targetLower = linkTarget.toLowerCase();
        let matchingNote = null;

        if (!isFolderLink) {
            matchingNote = this.notes.find(n => {
                if (n.type === 'image') return false;

                const pathLower = n.path.toLowerCase();
                const nameLower = n.name.toLowerCase();

                return (
                    n.path === linkTarget ||
                    n.path === linkTarget + '.md' ||
                    pathLower === targetLower ||
                    pathLower === targetLower + '.md' ||
                    n.name === linkTarget ||
                    n.name === linkTarget + '.md' ||
                    nameLower === targetLower ||
                    nameLower === targetLower + '.md' ||
                    n.path.endsWith('/' + linkTarget) ||
                    n.path.endsWith('/' + linkTarget + '.md') ||
                    pathLower.endsWith('/' + targetLower) ||
                    pathLower.endsWith('/' + targetLower + '.md')
                );
            });
        }

        if (matchingNote) {
            this.loadNote(matchingNote.path);
            return;
        }

        // Try to find a matching folder
        const allFolders = this.allFolders || [];
        const matchingFolder = allFolders.find(f => {
            const folderLower = f.toLowerCase();
            const folderName = f.split('/').pop();
            const folderNameLower = folderName.toLowerCase();
            return (
                f === linkTarget ||
                folderLower === targetLower ||
                folderName === linkTarget ||
                folderNameLower === targetLower ||
                f.endsWith('/' + linkTarget) ||
                folderLower.endsWith('/' + targetLower)
            );
        });

        if (matchingFolder) {
            // Navigate to the folder
            this.navigateToFolder(matchingFolder);
            return;
        }

        // Neither note nor folder exists - offer to create a note
        const createNew = confirm(`Note "${linkTarget}" doesn't exist. Create it?`);
        if (createNew) {
            const notePath = linkTarget.endsWith('.md') ? linkTarget : linkTarget + '.md';
            this.createNoteFromLink(notePath);
        }
    },

    // Navigate to a folder (expand it and show in homepage view)
    navigateToFolder(folderPath) {
        // Clear current note to show homepage view
        this.currentNote = '';
        this.noteContent = '';
        this.currentNoteName = '';
        this.currentImage = '';

        // Set the homepage folder to navigate to that folder
        this.selectedHomepageFolder = folderPath;

        // Expand the folder and its parents in the sidebar
        const parts = folderPath.split('/');
        let currentPath = '';
        parts.forEach((part, index) => {
            currentPath = index === 0 ? part : `${currentPath}/${part}`;
            this.expandedFolders.add(currentPath);
        });
        this.expandedFolders = new Set(this.expandedFolders);

        // Update browser URL
        window.history.pushState(
            { homepageFolder: folderPath },
            '',
            '/'
        );

        // Close mobile sidebar if open
        this.mobileSidebarOpen = false;
    },

    // Create a note from a clicked link
    async createNoteFromLink(notePath) {
        try {
            const response = await fetch(`/api/notes/${notePath}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: '' })
            });

            if (response.ok) {
                await this.loadNotes();
                await this.loadNote(notePath);
            } else {
                ErrorHandler.handle('create note from link', new Error('Server returned error'));
            }
        } catch (error) {
            ErrorHandler.handle('create note from link', error);
        }
    },
};
