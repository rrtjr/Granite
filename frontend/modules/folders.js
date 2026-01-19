// Granite Frontend - Folders Module

import { ErrorHandler } from './config.js';

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

    // Create a new folder
    async createFolder(parentPath = null) {
        let targetFolder;
        if (parentPath !== null) {
            targetFolder = parentPath;
        } else if (this.dropdownTargetFolder !== null && this.dropdownTargetFolder !== undefined) {
            targetFolder = this.dropdownTargetFolder;
        } else {
            targetFolder = this.selectedHomepageFolder || '';
        }
        this.closeDropdown();

        const promptText = targetFolder
            ? `Create subfolder in "${targetFolder}".\nEnter folder name:`
            : 'Create new folder.\nEnter folder path (e.g., "Projects" or "Work/2025"):';

        const folderName = prompt(promptText);
        if (!folderName) return;

        const sanitizedName = folderName.trim().replace(/[^a-zA-Z0-9-_\s\/]/g, '');
        if (!sanitizedName) {
            alert('Invalid folder name.');
            return;
        }

        const folderPath = targetFolder ? `${targetFolder}/${sanitizedName}` : sanitizedName;

        const existingFolder = this.allFolders.find(folder => folder === folderPath);
        if (existingFolder) {
            alert(`A folder named "${sanitizedName}" already exists in this location.\nPlease choose a different name.`);
            return;
        }

        try {
            const response = await fetch('/api/folders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: folderPath })
            });

            if (response.ok) {
                if (targetFolder) {
                    this.expandedFolders.add(targetFolder);
                }
                this.expandedFolders.add(folderPath);
                await this.loadNotes();
                this.goToHomepageFolder(folderPath);
            } else {
                ErrorHandler.handle('create folder', new Error('Server returned error'));
            }
        } catch (error) {
            ErrorHandler.handle('create folder', error);
        }
    },

    // Rename a folder
    async renameFolder(folderPath, currentName) {
        const newName = prompt(`Rename folder "${currentName}" to:`, currentName);
        if (!newName || newName === currentName) return;

        const sanitizedName = newName.trim().replace(/[^a-zA-Z0-9-_\s]/g, '');
        if (!sanitizedName) {
            alert('Invalid folder name.');
            return;
        }

        const pathParts = folderPath.split('/');
        pathParts[pathParts.length - 1] = sanitizedName;
        const newPath = pathParts.join('/');

        try {
            const response = await fetch('/api/folders/rename', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ oldPath: folderPath, newPath: newPath })
            });

            if (response.ok) {
                if (this.expandedFolders.has(folderPath)) {
                    this.expandedFolders.delete(folderPath);
                    this.expandedFolders.add(newPath);
                }

                if (this.currentNote && this.currentNote.startsWith(folderPath + '/')) {
                    this.currentNote = this.currentNote.replace(folderPath, newPath);
                }

                await this.loadNotes();
            } else {
                ErrorHandler.handle('rename folder', new Error('Server returned error'));
            }
        } catch (error) {
            ErrorHandler.handle('rename folder', error);
        }
    },

    // Delete folder
    async deleteFolder(folderPath, folderName) {
        const confirmation = confirm(
            `⚠️ WARNING ⚠️\n\n` +
            `Are you sure you want to delete the folder "${folderName}"?\n\n` +
            `This will PERMANENTLY delete:\n` +
            `• All notes inside this folder\n` +
            `• All subfolders and their contents\n\n` +
            `This action CANNOT be undone!`
        );

        if (!confirmation) return;

        try {
            const response = await fetch(`/api/folders/${encodeURIComponent(folderPath)}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' }
            });

            if (response.ok) {
                this.expandedFolders.delete(folderPath);

                if (this.currentNote && this.currentNote.startsWith(folderPath + '/')) {
                    this.currentNote = '';
                    this.noteContent = '';
                }

                await this.loadNotes();
            } else {
                ErrorHandler.handle('delete folder', new Error('Server returned error'));
            }
        } catch (error) {
            ErrorHandler.handle('delete folder', error);
        }
    },

    // Render folder recursively (helper for deep nesting)
    renderFolderRecursive(folder, level = 0, isTopLevel = false) {
        if (!folder) return '';

        let html = '';
        const isExpanded = this.expandedFolders.has(folder.path);
        const escapedPath = folder.path.replace(/'/g, "\\'").replace(/\\/g, "\\\\");

        html += `
            <div>
                <div
                    draggable="true"
                    ondragstart="window.$root.onFolderDragStart('${escapedPath}', event)"
                    ondragend="window.$root.onFolderDragEnd()"
                    ondragover="event.preventDefault(); window.$root.dragOverFolder = '${escapedPath}'; this.classList.add('drag-over')"
                    ondragenter="event.preventDefault(); window.$root.dragOverFolder = '${escapedPath}'; this.classList.add('drag-over')"
                    ondragleave="window.$root.dragOverFolder = null; this.classList.remove('drag-over')"
                    ondrop="event.stopPropagation(); this.classList.remove('drag-over'); window.$root.onFolderDrop('${escapedPath}')"
                    onclick="window.$root.toggleFolder('${escapedPath}')"
                    onmouseover="if(!window.$root.draggedNote && !window.$root.draggedFolder) this.style.backgroundColor='var(--bg-hover)'"
                    onmouseout="if(!window.$root.draggedNote && !window.$root.draggedFolder) this.style.backgroundColor='transparent'"
                    class="folder-item px-2 py-1 text-sm relative"
                    style="color: var(--text-primary); cursor: pointer;"
                >
                    <div class="flex items-center gap-1">
                        <button
                            class="flex-shrink-0 w-4 h-4 flex items-center justify-center"
                            style="color: var(--text-tertiary); cursor: pointer; transition: transform 0.2s; pointer-events: none; margin-left: -5px; ${isExpanded ? 'transform: rotate(90deg);' : ''}"
                        >
                            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                                <path d="M6 4l4 4-4 4V4z"/>
                            </svg>
                        </button>
                        <span class="flex items-center gap-1 flex-1" style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500; pointer-events: none;">
                            <span>${folder.name}</span>
                            ${folder.notes.length === 0 && (!folder.children || Object.keys(folder.children).length === 0) ? '<span class="text-xs" style="color: var(--text-tertiary); font-weight: 400;">(empty)</span>' : ''}
                        </span>
                    </div>
                    <div class="hover-buttons flex gap-1 transition-opacity absolute right-2 top-1/2 transform -translate-y-1/2" style="opacity: 0; pointer-events: none; background: linear-gradient(to right, transparent, var(--bg-hover) 20%, var(--bg-hover)); padding-left: 20px;" onclick="event.stopPropagation()">
                        <button
                            onclick="event.stopPropagation(); window.$root.dropdownTargetFolder = '${escapedPath}'; window.$root.toggleNewDropdown(event)"
                            class="px-1.5 py-0.5 text-xs rounded hover:brightness-110"
                            style="background-color: var(--bg-tertiary); color: var(--text-secondary);"
                            title="Add item here"
                        >+</button>
                        <button
                            onclick="event.stopPropagation(); window.$root.renameFolder('${escapedPath}', '${folder.name.replace(/'/g, "\\'").replace(/\\/g, "\\\\")}')"
                            class="px-1.5 py-0.5 text-xs rounded hover:brightness-110"
                            style="background-color: var(--bg-tertiary); color: var(--text-secondary);"
                            title="Rename folder"
                        >✏️</button>
                        <button
                            onclick="event.stopPropagation(); window.$root.deleteFolder('${escapedPath}', '${folder.name.replace(/'/g, "\\'").replace(/\\/g, "\\\\")}')"
                            class="px-1 py-0.5 text-xs rounded hover:brightness-110"
                            style="color: var(--error);"
                            title="Delete folder"
                        >
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                            </svg>
                        </button>
                    </div>
                </div>
        `;

        if (isExpanded) {
            html += `<div class="folder-contents" style="padding-left: 10px;">`;

            if (folder.children && Object.keys(folder.children).length > 0) {
                const children = Object.entries(folder.children).sort((a, b) =>
                    a[1].name.toLowerCase().localeCompare(b[1].name.toLowerCase())
                );

                children.forEach(([childKey, childFolder]) => {
                    html += this.renderFolderRecursive(childFolder, 0, false);
                });
            }

            if (folder.notes && folder.notes.length > 0) {
                folder.notes.forEach(note => {
                    const isImage = note.type === 'image';
                    const isCurrentNote = this.currentNote === note.path;
                    const isCurrentImage = this.currentImage === note.path;
                    const isCurrent = isImage ? isCurrentImage : isCurrentNote;
                    const icon = isImage ? '🖼️' : '';

                    const escapedNotePath = note.path.replace(/'/g, "\\'").replace(/\\/g, "\\\\");
                    const escapedNoteName = note.name.replace(/'/g, "\\'").replace(/\\/g, "\\\\");

                    const clickHandler = `window.$root.openItem('${escapedNotePath}', '${note.type}')`;
                    const deleteHandler = isImage
                        ? `event.stopPropagation(); window.$root.deleteImage('${escapedNotePath}')`
                        : `event.stopPropagation(); window.$root.deleteNote('${escapedNotePath}', '${escapedNoteName}')`;

                    html += `
                        <div
                            draggable="true"
                            ondragstart="window.$root.onNoteDragStart('${escapedNotePath}', event)"
                            ondragend="window.$root.onNoteDragEnd()"
                            onclick="${clickHandler}"
                            class="note-item px-2 py-1 text-sm relative"
                            style="${isCurrent ? 'background-color: var(--accent-light); color: var(--accent-primary);' : 'color: var(--text-primary);'} ${isImage ? 'opacity: 0.85;' : ''} cursor: pointer;"
                            onmouseover="if('${escapedNotePath}' !== window.$root.currentNote && '${escapedNotePath}' !== window.$root.currentImage) this.style.backgroundColor='var(--bg-hover)'"
                            onmouseout="if('${escapedNotePath}' !== window.$root.currentNote && '${escapedNotePath}' !== window.$root.currentImage) this.style.backgroundColor='transparent'"
                        >
                            <span class="truncate" style="display: block; padding-right: 30px;">${icon}${icon ? ' ' : ''}${note.name}</span>
                            <button
                                onclick="${deleteHandler}"
                                class="note-delete-btn absolute right-2 top-1/2 transform -translate-y-1/2 px-1 py-0.5 text-xs rounded hover:brightness-110 transition-opacity"
                                style="opacity: 0; color: var(--error);"
                                title="${isImage ? 'Delete image' : 'Delete note'}"
                            >
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                                </svg>
                            </button>
                        </div>
                    `;
                });
            }

            html += `</div>`;
        }

        html += `</div>`;
        return html;
    },
};
