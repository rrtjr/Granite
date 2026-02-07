// Granite Frontend - Folder Operations Module
// CRUD operations for folders: create, rename, delete

import { ErrorHandler } from './config.js';

export const folderOperationsMixin = {
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
            ErrorHandler.warn('Invalid folder name.');
            return;
        }

        const folderPath = targetFolder ? `${targetFolder}/${sanitizedName}` : sanitizedName;

        const existingFolder = this.allFolders.find(folder => folder === folderPath);
        if (existingFolder) {
            ErrorHandler.warn(`A folder named "${sanitizedName}" already exists in this location.`);
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
                ErrorHandler.success(`Folder "${sanitizedName}" created`);
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
            ErrorHandler.warn('Invalid folder name.');
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

                // Update favorites for all notes inside the renamed folder
                if (typeof this.updateFavoritePath === 'function' && this.favoriteNotes) {
                    const oldPrefix = folderPath + '/';
                    const updatedFavorites = this.favoriteNotes.map(fav =>
                        fav.startsWith(oldPrefix) ? newPath + '/' + fav.slice(oldPrefix.length) : fav
                    );
                    if (JSON.stringify(updatedFavorites) !== JSON.stringify(this.favoriteNotes)) {
                        this.favoriteNotes = updatedFavorites;
                        await this.saveFavorites();
                    }
                }

                if (this.currentNote && this.currentNote.startsWith(folderPath + '/')) {
                    this.currentNote = this.currentNote.replace(folderPath, newPath);
                }

                await this.loadNotes();
                ErrorHandler.success(`Folder renamed to "${sanitizedName}"`);
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

                // Remove favorites for all notes inside the deleted folder
                if (typeof this.removeFavorite === 'function' && this.favoriteNotes) {
                    const oldPrefix = folderPath + '/';
                    const remaining = this.favoriteNotes.filter(fav => !fav.startsWith(oldPrefix));
                    if (remaining.length !== this.favoriteNotes.length) {
                        this.favoriteNotes = remaining;
                        await this.saveFavorites();
                    }
                }

                if (this.currentNote && this.currentNote.startsWith(folderPath + '/')) {
                    this.currentNote = '';
                    this.noteContent = '';
                }

                await this.loadNotes();
                ErrorHandler.success(`Folder "${folderName}" deleted`);
            } else {
                ErrorHandler.handle('delete folder', new Error('Server returned error'));
            }
        } catch (error) {
            ErrorHandler.handle('delete folder', error);
        }
    },
};
