// Granite Frontend - Tags Module

export const tagsMixin = {
    // Load all tags
    async loadTags() {
        try {
            const response = await fetch('/api/tags');
            const data = await response.json();
            this.allTags = data.tags || {};
        } catch (error) {
            console.error('Failed to load tags:', error);
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
            const tags = [];
            let inTagsList = false;

            for (const line of frontmatterLines) {
                const stripped = line.trim();

                if (stripped.startsWith('tags:')) {
                    const rest = stripped.substring(5).trim();
                    if (rest.startsWith('[') && rest.endsWith(']')) {
                        const tagsStr = rest.substring(1, rest.length - 1);
                        const rawTags = tagsStr.split(',').map(t => t.trim());
                        tags.push(...rawTags.filter(t => t).map(t => t.toLowerCase()));
                        break;
                    } else if (rest) {
                        tags.push(rest.toLowerCase());
                        break;
                    } else {
                        inTagsList = true;
                    }
                } else if (inTagsList) {
                    if (stripped.startsWith('-')) {
                        const tag = stripped.substring(1).trim();
                        if (tag && !tag.startsWith('#')) {
                            tags.push(tag.toLowerCase());
                        }
                    } else if (stripped && !stripped.startsWith('#')) {
                        break;
                    }
                }
            }

            return [...new Set(tags)].sort();
        } catch (e) {
            console.error('Error parsing tags:', e);
            return [];
        }
    },
};
