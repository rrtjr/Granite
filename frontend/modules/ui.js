// Granite Frontend - UI Utilities Module

import { CONFIG, Debug } from './config.js';

export const uiMixin = {
    // Toast notification methods
    addToast(message, type = 'info', duration = 4000) {
        const id = this.nextToastId++;
        this.toasts.push({ id, message, type, timestamp: Date.now() });
        if (duration > 0) {
            setTimeout(() => this.removeToast(id), duration);
        }
        return id;
    },

    removeToast(id) {
        this.toasts = this.toasts.filter(t => t.id !== id);
    },

    // Setup scroll synchronization
    setupScrollSync() {
        const editorScroller = this.editorView?.scrollDOM;
        // Preview container is the scrollable parent of .markdown-preview
        const markdownPreview = document.querySelector('.markdown-preview');
        const preview = this._domCache.previewContainer || (markdownPreview ? markdownPreview.parentElement : null);

        if (!editorScroller || !preview) {
            if (!this._setupScrollSyncRetries) this._setupScrollSyncRetries = 0;
            if (this._setupScrollSyncRetries < CONFIG.SCROLL_SYNC_MAX_RETRIES) {
                this._setupScrollSyncRetries++;
                setTimeout(() => this.setupScrollSync(), CONFIG.SCROLL_SYNC_RETRY_INTERVAL);
            } else {
                // Only warn if a note is actually open (otherwise this is expected on homepage)
                if (this.currentNote) {
                    Debug.warn(`setupScrollSync: Failed to find editor/preview elements after ${CONFIG.SCROLL_SYNC_MAX_RETRIES} retries`);
                }
            }
            return;
        }

        this._setupScrollSyncRetries = 0;

        // Remove old listeners
        if (this._editorScrollHandler && this._lastEditorScroller) {
            this._lastEditorScroller.removeEventListener('scroll', this._editorScrollHandler);
        }
        if (this._previewScrollHandler) {
            preview.removeEventListener('scroll', this._previewScrollHandler);
        }

        this._lastEditorScroller = editorScroller;

        this._editorScrollHandler = () => {
            if (this.isScrolling) {
                this.isScrolling = false;
                return;
            }

            const scrollableHeight = editorScroller.scrollHeight - editorScroller.clientHeight;
            if (scrollableHeight <= 0) return;

            const scrollPercentage = editorScroller.scrollTop / scrollableHeight;
            const previewScrollableHeight = preview.scrollHeight - preview.clientHeight;

            if (previewScrollableHeight > 0) {
                this.isScrolling = true;
                preview.scrollTop = scrollPercentage * previewScrollableHeight;
            }
        };

        this._previewScrollHandler = () => {
            if (this.isScrolling) {
                this.isScrolling = false;
                return;
            }

            const scrollableHeight = preview.scrollHeight - preview.clientHeight;
            if (scrollableHeight <= 0) return;

            const scrollPercentage = preview.scrollTop / scrollableHeight;
            const editorScrollableHeight = editorScroller.scrollHeight - editorScroller.clientHeight;

            if (editorScrollableHeight > 0) {
                this.isScrolling = true;
                editorScroller.scrollTop = scrollPercentage * editorScrollableHeight;
            }
        };

        editorScroller.addEventListener('scroll', this._editorScrollHandler);
        preview.addEventListener('scroll', this._previewScrollHandler);
    },

    // Scroll to top of editor and preview
    scrollToTop() {
        this.isScrolling = true;

        if (!this._domCache.editor || !this._domCache.previewContainer) {
            this.refreshDOMCache();
        }

        if (this.viewMode === 'edit' || this.viewMode === 'split') {
            if (this._domCache.editor) {
                this._domCache.editor.scrollTop = 0;
            }
        }

        if (this.viewMode === 'preview' || this.viewMode === 'split') {
            if (this._domCache.previewContainer) {
                this._domCache.previewContainer.scrollTop = 0;
            }
        }

        setTimeout(() => {
            this.isScrolling = false;
        }, CONFIG.SCROLL_SYNC_DELAY);
    },

    // Extract headings from rendered markdown for Table of Contents
    extractTocHeadings() {
        const previewEl = document.querySelector('.markdown-preview');
        if (!previewEl) {
            this.tocHeadings = [];
            return;
        }

        const headings = previewEl.querySelectorAll('h1, h2, h3, h4, h5, h6');
        const tocItems = [];
        const usedIds = new Set();

        headings.forEach((heading, index) => {
            let id = heading.id;
            if (!id) {
                const text = heading.textContent.trim();
                let baseId = 'toc-' + text.toLowerCase()
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/^-|-$/g, '')
                    .substring(0, 50);

                id = baseId;
                let counter = 1;
                while (usedIds.has(id)) {
                    id = `${baseId}-${counter}`;
                    counter++;
                }
                heading.id = id;
            }
            usedIds.add(id);

            const level = parseInt(heading.tagName.charAt(1), 10);
            tocItems.push({
                id: id,
                text: heading.textContent.trim(),
                level: level
            });
        });

        this.tocHeadings = tocItems;
    },

    // Scroll to a heading in the preview
    scrollToHeading(headingId) {
        const previewContainer = document.querySelector('.markdown-preview')?.parentElement;
        const headingEl = document.getElementById(headingId);

        if (!previewContainer || !headingEl) return;

        this.isScrolling = true;

        const containerRect = previewContainer.getBoundingClientRect();
        const headingRect = headingEl.getBoundingClientRect();
        const scrollOffset = headingRect.top - containerRect.top + previewContainer.scrollTop - 20;

        previewContainer.scrollTo({
            top: scrollOffset,
            behavior: 'smooth'
        });

        headingEl.style.transition = 'background-color 0.3s ease';
        headingEl.style.backgroundColor = 'var(--accent-light, rgba(124, 58, 237, 0.2))';
        setTimeout(() => {
            headingEl.style.backgroundColor = 'transparent';
        }, 1500);

        setTimeout(() => {
            this.isScrolling = false;
        }, 500);
    },

    // Toggle new item dropdown
    toggleNewDropdown(event) {
        event.stopPropagation();
        this.showNewDropdown = !this.showNewDropdown;
        if (this.showNewDropdown) {
            const button = event.currentTarget;
            const rect = button.getBoundingClientRect();
            this.dropdownPosition = { top: rect.bottom + 4, left: rect.left };
        }
    },

    // Close dropdowns
    closeDropdown() {
        this.showNewDropdown = false;
        this.dropdownTargetFolder = null;
    },

    // Close all modals
    closeAllModals() {
        this.showSettings = false;
        this.showGitSettingsModal = false;
        this.showPdfExportSettingsModal = false;
        this.showTemplateModal = false;
        this.showUnsplashModal = false;
    },

    // Homepage folder navigation
    goToHomepageFolder(folderPath) {
        this.showGraph = false;
        this.selectedHomepageFolder = folderPath || '';

        this.currentNote = '';
        this.currentNoteName = '';
        this.noteContent = '';
        this.currentImage = '';

        this._homepageCache = {
            folderPath: null,
            notes: null,
            folders: null,
            breadcrumb: null
        };

        window.history.pushState({ homepageFolder: folderPath || '' }, '', '/');
    },

    // Navigate to homepage root
    goHome() {
        this.showGraph = false;
        this.selectedHomepageFolder = '';
        this.currentNote = '';
        this.currentNoteName = '';
        this.noteContent = '';
        this.currentImage = '';
        this.mobileSidebarOpen = false;

        this._homepageCache = {
            folderPath: null,
            notes: null,
            folders: null,
            breadcrumb: null
        };

        window.history.pushState({ homepageFolder: '' }, '', '/');
    },

    // Get homepage folder breadcrumb (method - called as function in HTML)
    homepageBreadcrumb() {
        if (!this.selectedHomepageFolder) return [];
        if (!this._homepageCache) return [];

        const cacheKey = this.selectedHomepageFolder;
        if (this._homepageCache.folderPath === cacheKey && this._homepageCache.breadcrumb !== null) {
            return this._homepageCache.breadcrumb;
        }

        const parts = this.selectedHomepageFolder.split('/');
        const breadcrumb = parts.map((part, index) => ({
            name: part,
            path: parts.slice(0, index + 1).join('/')
        }));

        this._homepageCache.breadcrumb = breadcrumb;
        return breadcrumb;
    },

    // Get homepage folders (method - called as function in HTML)
    homepageFolders() {
        if (!this._homepageCache) return [];
        if (typeof this.getFolderNode !== 'function') return [];

        const cacheKey = this.selectedHomepageFolder || '__root__';
        if (this._homepageCache.folderPath === cacheKey && this._homepageCache.folders !== null) {
            return this._homepageCache.folders;
        }

        let folders = [];
        const folderNode = this.getFolderNode(this.selectedHomepageFolder);

        if (folderNode && folderNode.children) {
            folders = Object.values(folderNode.children)
                .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
        } else if (!this.selectedHomepageFolder && this.folderTree) {
            folders = Object.entries(this.folderTree)
                .filter(([key, value]) => key !== '__root__' && value.path !== undefined)
                .map(([key, value]) => value)
                .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
        }

        this._homepageCache.folderPath = cacheKey;
        this._homepageCache.folders = folders;
        return folders;
    },

    // Get homepage notes (method - called as function in HTML)
    homepageNotes() {
        if (!this._homepageCache) return [];
        if (typeof this.getFolderNode !== 'function') return [];

        const cacheKey = this.selectedHomepageFolder || '__root__';
        if (this._homepageCache.folderPath === cacheKey && this._homepageCache.notes !== null) {
            return this._homepageCache.notes;
        }

        let notes = [];
        const folderNode = this.getFolderNode(this.selectedHomepageFolder);

        if (folderNode && folderNode.notes) {
            notes = [...folderNode.notes]
                .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
        } else if (!this.selectedHomepageFolder && this.folderTree && this.folderTree['__root__']) {
            notes = [...(this.folderTree['__root__'].notes || [])]
                .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
        }

        this._homepageCache.folderPath = cacheKey;
        this._homepageCache.notes = notes;
        return notes;
    },
};
