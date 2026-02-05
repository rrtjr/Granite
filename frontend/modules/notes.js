// Granite Frontend - Notes Module

import { CONFIG, ErrorHandler } from './config.js';

export const notesMixin = {
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

    async loadNote(notePath, updateHistory = true, searchQuery = '') {
        try {
            // Always use pane system
            this.mobileSidebarOpen = false;

            if (typeof this.openInPane === 'function') {
                await this.openInPane(notePath, { focusExisting: true });

                // Handle search highlighting in the new pane if needed
                if (searchQuery) {
                    this.currentSearchHighlight = searchQuery;
                    this.$nextTick(() => {
                        this.highlightSearchTerm(searchQuery, true);
                    });
                }
            } else {
                Debug.error('openInPane function not available');
            }
        } catch (error) {
            ErrorHandler.handle('load note', error);
        }
    },


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

    autoSave() {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }

        this.lastSaved = false;

        if (!this.isUndoRedo) {
            if (this.historyTimeout) {
                clearTimeout(this.historyTimeout);
            }
            this.historyTimeout = setTimeout(() => {
                this.pushToHistory();
            }, this.performanceSettings.historyDelay);
        }

        if (this.statsPluginEnabled) {
            if (this.statsTimeout) {
                clearTimeout(this.statsTimeout);
            }
            this.statsTimeout = setTimeout(() => {
                this.calculateStats();
            }, this.performanceSettings.statsDelay);
        }

        if (this.metadataTimeout) {
            clearTimeout(this.metadataTimeout);
        }
        this.metadataTimeout = setTimeout(() => {
            this.parseMetadata();
        }, this.performanceSettings.metadataDelay);

        this.saveTimeout = setTimeout(() => {
            this.saveNote();
        }, this.performanceSettings.autosaveDelay);
    },

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

    async deleteCurrentNote() {
        if (!this.currentNote) return;
        await this.deleteNote(this.currentNote, this.currentNoteName);
    },

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

    handleInternalLink(event) {
        const link = event.target.closest('a');
        if (!link) return;

        const href = link.getAttribute('href');
        if (!href) return;

        if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('//')) {
            return;
        }

        event.preventDefault();

        let linkTarget = decodeURIComponent(href);

        if (linkTarget.startsWith('/')) {
            linkTarget = linkTarget.substring(1);
        }

        const isFolderLink = link.hasAttribute('data-folder-link');

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
            this.navigateToFolder(matchingFolder);
            return;
        }

        const createNew = confirm(`Note "${linkTarget}" doesn't exist. Create it?`);
        if (createNew) {
            const notePath = linkTarget.endsWith('.md') ? linkTarget : linkTarget + '.md';
            this.createNoteFromLink(notePath);
        }
    },

    navigateToFolder(folderPath) {
        this.currentNote = '';
        this.noteContent = '';
        this.currentNoteName = '';
        this.currentImage = '';

        this.selectedHomepageFolder = folderPath;

        const parts = folderPath.split('/');
        let currentPath = '';
        parts.forEach((part, index) => {
            currentPath = index === 0 ? part : `${currentPath}/${part}`;
            this.expandedFolders.add(currentPath);
        });
        this.expandedFolders = new Set(this.expandedFolders);

        window.history.pushState(
            { homepageFolder: folderPath },
            '',
            '/'
        );

        this.mobileSidebarOpen = false;
    },

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
