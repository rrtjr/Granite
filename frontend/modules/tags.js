// Granite Frontend - Tags Module

import { Debug } from './config.js';

/**
 * Normalize raw tag input into a clean, deduplicated, sorted array.
 *
 * Handles:
 * - Comma-separated: "meta, vault" -> ["meta", "vault"]
 * - Space-separated: "meta vault" -> ["meta", "vault"]
 * - Hash prefixes: "#meta #vault" -> ["meta", "vault"]
 * - Mixed: "#meta, #vault" -> ["meta", "vault"]
 * - Hierarchical: "meta/vault" -> ["meta", "meta/vault", "vault"]
 */
export function normalizeTags(raw) {
    if (Array.isArray(raw)) {
        const all = [];
        for (const item of raw) {
            all.push(...normalizeTags(String(item)));
        }
        return [...new Set(all)].sort();
    }

    const text = String(raw).trim();
    if (!text) return [];

    const parts = text.includes(',') ? text.split(',') : text.split(/\s+/);

    const tags = new Set();
    for (const part of parts) {
        let tag = part.trim();
        if (tag.startsWith('#')) tag = tag.slice(1);
        tag = tag.trim().toLowerCase();
        if (!tag) continue;
        tags.add(tag);
        if (tag.includes('/')) {
            for (const segment of tag.split('/')) {
                const s = segment.trim();
                if (s) tags.add(s);
            }
        }
    }

    return [...tags].sort();
}

export const tagsMixin = {
    // Load all tags
    async loadTags() {
        try {
            const response = await fetch('/api/tags');
            const data = await response.json();
            this.allTags = data.tags || {};
        } catch (error) {
            Debug.error('Failed to load tags:', error);
        }
    },

    // Debounced tag reload (prevents excessive API calls during typing)
    loadTagsDebounced() {
        if (this.tagReloadTimeout) {
            clearTimeout(this.tagReloadTimeout);
        }
        this.tagReloadTimeout = setTimeout(() => {
            this.loadTags();
        }, 2000);
    },

    // Toggle tag selection for filtering
    toggleTag(tag) {
        const index = this.selectedTags.indexOf(tag);
        if (index > -1) {
            this.selectedTags.splice(index, 1);
        } else {
            this.selectedTags.push(tag);
        }
        this.applyFilters();
    },

    // Clear all tag filters
    clearTagFilters() {
        this.selectedTags = [];
        this.applyFilters();
    },

    // Check if a note matches selected tags (AND logic)
    noteMatchesTags(note) {
        if (this.selectedTags.length === 0) {
            return true;
        }
        if (!note.tags || note.tags.length === 0) {
            return false;
        }
        return this.selectedTags.every(tag => note.tags.includes(tag));
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

    // Parse tags from markdown content (matches backend logic)
    parseTagsFromContent(content) {
        if (!content || !content.trim().startsWith('---')) {
            return [];
        }

        try {
            const lines = content.split('\n');
            if (lines[0].trim() !== '---') return [];

            let endIdx = -1;
            for (let i = 1; i < lines.length; i++) {
                if (lines[i].trim() === '---') {
                    endIdx = i;
                    break;
                }
            }

            if (endIdx === -1) return [];

            const frontmatterLines = lines.slice(1, endIdx);
            let inTagsList = false;
            const rawListItems = [];

            for (const line of frontmatterLines) {
                const stripped = line.trim();

                if (stripped.startsWith('tags:')) {
                    const rest = stripped.substring(5).trim();
                    if (rest.startsWith('[') && rest.endsWith(']')) {
                        const tagsStr = rest.substring(1, rest.length - 1);
                        const rawTags = tagsStr.split(',').map(t => t.trim());
                        return normalizeTags(rawTags);
                    } else if (rest) {
                        return normalizeTags(rest);
                    } else {
                        inTagsList = true;
                    }
                } else if (inTagsList) {
                    if (stripped.startsWith('-')) {
                        const tag = stripped.substring(1).trim();
                        if (tag) {
                            rawListItems.push(tag);
                        }
                    } else if (stripped) {
                        break;
                    }
                }
            }

            if (rawListItems.length > 0) {
                return normalizeTags(rawListItems);
            }

            return [];
        } catch (e) {
            Debug.error('Error parsing tags:', e);
            return [];
        }
    },
};
