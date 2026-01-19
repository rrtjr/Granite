// Granite Frontend - Search Module

export const searchMixin = {
    // Search notes by text
    async searchNotes() {
        await this.applyFilters();
    },

    // Unified filtering logic combining tags and text search
    async applyFilters() {
        const hasTextSearch = this.searchQuery.trim().length > 0;
        const hasTagFilter = this.selectedTags.length > 0;

        // Case 1: No filters at all → show full folder tree
        if (!hasTextSearch && !hasTagFilter) {
            this.searchResults = [];
            this.currentSearchHighlight = '';
            this.clearSearchHighlights();
            this.buildFolderTree();
            return;
        }

        // Case 2: Only tag filter → convert to flat list of matching notes
        if (hasTagFilter && !hasTextSearch) {
            this.searchResults = this.notes.filter(note =>
                note.type === 'note' && this.noteMatchesTags(note)
            );
            this.currentSearchHighlight = '';
            this.clearSearchHighlights();
            return;
        }

        // Case 3: Text search (with or without tag filter)
        if (hasTextSearch) {
            try {
                const response = await fetch(`/api/search?q=${encodeURIComponent(this.searchQuery)}`);
                const data = await response.json();

                let results = data.results;
                if (hasTagFilter) {
                    results = results.filter(result => {
                        const note = this.notes.find(n => n.path === result.path);
                        return note ? this.noteMatchesTags(note) : false;
                    });
                }

                this.searchResults = results;

                if (this.currentNote && this.noteContent) {
                    this.currentSearchHighlight = this.searchQuery;
                    this.$nextTick(() => {
                        this.highlightSearchTerm(this.searchQuery, false);
                    });
                }
            } catch (error) {
                console.error('Search failed:', error);
            }
        }
    },

    // Highlight search term in editor and preview
    highlightSearchTerm(query, focusEditor = false) {
        if (!query || !query.trim()) {
            this.clearSearchHighlights();
            return;
        }

        const searchTerm = query.trim();
        this.highlightInEditor(searchTerm, focusEditor);
        this.highlightInPreview(searchTerm);
    },

    // Highlight search term in the editor
    highlightInEditor(searchTerm, shouldFocus = false) {
        const editor = this._domCache.editor || document.getElementById('editor');
        if (!editor) return;

        const content = editor.value;
        const lowerContent = content.toLowerCase();
        const lowerTerm = searchTerm.toLowerCase();
        const index = lowerContent.indexOf(lowerTerm);

        if (index !== -1) {
            const textBefore = content.substring(0, index);
            const lineNumber = textBefore.split('\n').length;
            const lineHeight = 20;
            editor.scrollTop = (lineNumber - 5) * lineHeight;

            if (shouldFocus) {
                editor.focus();
                editor.setSelectionRange(index, index + searchTerm.length);
                setTimeout(() => editor.blur(), 100);
            }
        }
    },

    // Highlight search term in the preview pane
    highlightInPreview(searchTerm) {
        const preview = document.querySelector('.markdown-preview');
        if (!preview) return;

        this.clearSearchHighlights();

        const walker = document.createTreeWalker(
            preview,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );

        const textNodes = [];
        let node;
        while (node = walker.nextNode()) {
            if (node.parentElement.tagName === 'CODE' ||
                node.parentElement.tagName === 'PRE') {
                continue;
            }
            textNodes.push(node);
        }

        const lowerTerm = searchTerm.toLowerCase();
        let matchIndex = 0;

        textNodes.forEach(textNode => {
            const text = textNode.textContent;
            const lowerText = text.toLowerCase();

            if (lowerText.includes(lowerTerm)) {
                const fragment = document.createDocumentFragment();
                let lastIndex = 0;
                let index;

                while ((index = lowerText.indexOf(lowerTerm, lastIndex)) !== -1) {
                    if (index > lastIndex) {
                        fragment.appendChild(
                            document.createTextNode(text.substring(lastIndex, index))
                        );
                    }

                    const mark = document.createElement('mark');
                    mark.className = 'search-highlight';
                    mark.setAttribute('data-match-index', matchIndex);
                    mark.textContent = text.substring(index, index + searchTerm.length);

                    if (matchIndex === 0) {
                        mark.classList.add('active-match');
                    }

                    fragment.appendChild(mark);
                    matchIndex++;

                    lastIndex = index + searchTerm.length;
                }

                if (lastIndex < text.length) {
                    fragment.appendChild(
                        document.createTextNode(text.substring(lastIndex))
                    );
                }

                textNode.parentNode.replaceChild(fragment, textNode);
            }
        });

        this.totalMatches = matchIndex;
        this.currentMatchIndex = matchIndex > 0 ? 0 : -1;

        if (this.totalMatches > 0) {
            this.scrollToMatch(0);
        }
    },

    // Navigate to next search match
    nextMatch() {
        if (this.totalMatches === 0) return;
        this.currentMatchIndex = (this.currentMatchIndex + 1) % this.totalMatches;
        this.scrollToMatch(this.currentMatchIndex);
    },

    // Navigate to previous search match
    previousMatch() {
        if (this.totalMatches === 0) return;
        this.currentMatchIndex = (this.currentMatchIndex - 1 + this.totalMatches) % this.totalMatches;
        this.scrollToMatch(this.currentMatchIndex);
    },

    // Scroll to a specific match index
    scrollToMatch(index) {
        const preview = document.querySelector('.markdown-preview');
        if (!preview) return;

        const allMatches = preview.querySelectorAll('mark.search-highlight');
        if (index < 0 || index >= allMatches.length) return;

        allMatches.forEach((mark, i) => {
            mark.classList.toggle('active-match', i === index);
        });

        const targetMatch = allMatches[index];
        const previewContainer = this._domCache.previewContainer;
        if (previewContainer && targetMatch) {
            const elementTop = targetMatch.offsetTop;
            previewContainer.scrollTop = elementTop - 100;
        }
    },

    // Clear search highlights
    clearSearchHighlights() {
        const preview = document.querySelector('.markdown-preview');
        if (!preview) return;

        const highlights = preview.querySelectorAll('mark.search-highlight');
        highlights.forEach(mark => {
            const text = document.createTextNode(mark.textContent);
            mark.parentNode.replaceChild(text, mark);
        });

        preview.normalize();

        this.totalMatches = 0;
        this.currentMatchIndex = -1;
    },
};
