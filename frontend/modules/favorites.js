// Granite Frontend - Favorites Module
// Manage favorite notes for quick access

import { Debug } from './config.js';

export const favoritesMixin = {
    // Load favorites from user settings
    async loadFavorites() {
        try {
            const response = await fetch('/api/settings/user');
            if (response.ok) {
                const settings = await response.json();
                this.favoriteNotes = settings.favorites || [];
            }
        } catch (error) {
            Debug.error('Failed to load favorites:', error);
            this.favoriteNotes = [];
        }
    },

    // Check if a note is favorited
    isFavorite(notePath) {
        return this.favoriteNotes.includes(notePath);
    },

    // Toggle favorite status for a note
    async toggleFavorite(notePath, event) {
        if (event) {
            event.stopPropagation();
        }

        const index = this.favoriteNotes.indexOf(notePath);
        if (index > -1) {
            // Remove from favorites
            this.favoriteNotes.splice(index, 1);
        } else {
            // Add to favorites
            this.favoriteNotes.push(notePath);
        }

        // Trigger reactivity
        this.favoriteNotes = [...this.favoriteNotes];

        // Save to server
        await this.saveFavorites();
    },

    // Save favorites to user settings
    async saveFavorites() {
        try {
            const response = await fetch('/api/settings/user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ favorites: this.favoriteNotes })
            });

            if (!response.ok) {
                Debug.error('Failed to save favorites');
            }
        } catch (error) {
            Debug.error('Error saving favorites:', error);
        }
    },

    // Get favorite notes with full note objects
    get favoriteNotesData() {
        if (!this.notes || !this.favoriteNotes) return [];
        return this.notes.filter(note => this.favoriteNotes.includes(note.path));
    },

    // Remove stale favorites whose paths no longer exist in loaded notes
    async cleanupStaleFavorites() {
        if (!this.notes || !this.favoriteNotes || this.favoriteNotes.length === 0) return;
        const notePaths = new Set(this.notes.map(n => n.path));
        const valid = this.favoriteNotes.filter(fav => notePaths.has(fav));
        if (valid.length !== this.favoriteNotes.length) {
            this.favoriteNotes = valid;
            await this.saveFavorites();
        }
    },

    // Remove a note from favorites (used when note is deleted)
    async removeFavorite(notePath) {
        const index = this.favoriteNotes.indexOf(notePath);
        if (index > -1) {
            this.favoriteNotes.splice(index, 1);
            this.favoriteNotes = [...this.favoriteNotes];
            await this.saveFavorites();
        }
    },

    // Update favorite path when note is moved/renamed
    async updateFavoritePath(oldPath, newPath) {
        const index = this.favoriteNotes.indexOf(oldPath);
        if (index > -1) {
            this.favoriteNotes[index] = newPath;
            this.favoriteNotes = [...this.favoriteNotes];
            await this.saveFavorites();
        }
    },
};
