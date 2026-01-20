// Granite Frontend - Folders Module
// Folder tree building and expansion state management

export const foldersMixin = {
    // Build folder tree structure
    buildFolderTree() {
        const tree = {};

        // Add ALL folders from backend (including empty ones)
        this.allFolders.forEach(folderPath => {
            const parts = folderPath.split('/');
            let current = tree;

            parts.forEach((part, index) => {
                const fullPath = parts.slice(0, index + 1).join('/');

                if (!current[part]) {
                    current[part] = {
                        name: part,
                        path: fullPath,
                        children: {},
                        notes: []
                    };
                }
                current = current[part].children;
            });
        });

        // Add ALL notes to their folders
        this.notes.forEach(note => {
            if (!note.folder) {
                if (!tree['__root__']) {
                    tree['__root__'] = {
                        name: '',
                        path: '',
                        children: {},
                        notes: []
                    };
                }
                tree['__root__'].notes.push(note);
            } else {
                const parts = note.folder.split('/');
                let current = tree;

                for (let i = 0; i < parts.length; i++) {
                    if (!current[parts[i]]) {
                        current[parts[i]] = {
                            name: parts[i],
                            path: parts.slice(0, i + 1).join('/'),
                            children: {},
                            notes: []
                        };
                    }
                    if (i === parts.length - 1) {
                        current[parts[i]].notes.push(note);
                    } else {
                        current = current[parts[i]].children;
                    }
                }
            }
        });

        // Sort notes
        const sortNotes = (obj) => {
            if (obj.notes && obj.notes.length > 0) {
                obj.notes = [...obj.notes].sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
            }
            if (obj.children && Object.keys(obj.children).length > 0) {
                Object.values(obj.children).forEach(child => sortNotes(child));
            }
        };

        if (tree['__root__'] && tree['__root__'].notes) {
            tree['__root__'].notes = [...tree['__root__'].notes].sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
        }

        Object.values(tree).forEach(folder => {
            if (folder.path !== undefined) {
                sortNotes(folder);
            }
        });

        // Calculate note counts
        const calculateNoteCounts = (folderNode) => {
            const directNotes = folderNode.notes ? folderNode.notes.length : 0;

            if (!folderNode.children || Object.keys(folderNode.children).length === 0) {
                folderNode.noteCount = directNotes;
                return directNotes;
            }

            const childNotesCount = Object.values(folderNode.children).reduce(
                (total, child) => total + calculateNoteCounts(child),
                0
            );

            folderNode.noteCount = directNotes + childNotesCount;
            return folderNode.noteCount;
        };

        Object.values(tree).forEach(folder => {
            if (folder.path !== undefined || folder === tree['__root__']) {
                calculateNoteCounts(folder);
            }
        });

        // Invalidate homepage cache
        this._homepageCache = {
            folderPath: null,
            notes: null,
            folders: null,
            breadcrumb: null
        };

        this.folderTree = tree;
    },

    // Toggle folder expansion
    toggleFolder(folderPath) {
        if (this.expandedFolders.has(folderPath)) {
            this.expandedFolders.delete(folderPath);
        } else {
            this.expandedFolders.add(folderPath);
        }
        this.expandedFolders = new Set(this.expandedFolders);
    },

    // Check if folder is expanded
    isFolderExpanded(folderPath) {
        return this.expandedFolders.has(folderPath);
    },

    // Expand all folders
    expandAllFolders() {
        this.allFolders.forEach(folder => {
            this.expandedFolders.add(folder);
        });
        this.expandedFolders = new Set(this.expandedFolders);
    },

    // Collapse all folders
    collapseAllFolders() {
        this.expandedFolders.clear();
        this.expandedFolders = new Set(this.expandedFolders);
    },

    // Expand folder tree to show a specific note
    expandFolderForNote(notePath) {
        const parts = notePath.split('/');
        if (parts.length <= 1) return;

        parts.pop();

        let currentPath = '';
        parts.forEach((part, index) => {
            currentPath = index === 0 ? part : `${currentPath}/${part}`;
            this.expandedFolders.add(currentPath);
        });

        this.expandedFolders = new Set(this.expandedFolders);
    },

    // Scroll note into view in the sidebar
    scrollNoteIntoView(notePath) {
        setTimeout(() => {
            const sidebar = document.querySelector('.flex-1.overflow-y-auto.custom-scrollbar');
            if (!sidebar) return;

            const noteElements = sidebar.querySelectorAll('.note-item');
            let targetElement = null;
            const noteName = notePath.split('/').pop().replace('.md', '');

            noteElements.forEach(el => {
                if (el.textContent.trim().startsWith(noteName) || el.textContent.includes(noteName)) {
                    const computedStyle = window.getComputedStyle(el);
                    const bgColor = computedStyle.backgroundColor;

                    if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent' && !bgColor.includes('255, 255, 255')) {
                        targetElement = el;
                    }
                }
            });

            if (targetElement) {
                targetElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center',
                    inline: 'nearest'
                });
            }
        }, 200);
    },

    // Get folder node by path (used by homepage and other modules)
    getFolderNode(path) {
        if (!path) {
            return this.folderTree['__root__'] || { notes: [], children: this.folderTree };
        }

        const parts = path.split('/');
        let current = this.folderTree;

        for (const part of parts) {
            if (current[part]) {
                if (parts.indexOf(part) === parts.length - 1) {
                    return current[part];
                }
                current = current[part].children;
            } else {
                return null;
            }
        }

        return null;
    },
};
