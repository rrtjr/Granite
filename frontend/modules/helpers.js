// Granite Frontend - Helper Functions

export const helpersMixin = {
    // Helper: Format file size nicely
    formatSize(bytes) {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    },

    getFolderNode(folderPath = '') {
        if (!this.folderTree || typeof this.folderTree !== 'object') {
            return null;
        }

        if (!folderPath) {
            return this.folderTree['__root__'] || { name: '', path: '', children: {}, notes: [], noteCount: 0 };
        }

        const parts = folderPath.split('/').filter(Boolean);
        let currentLevel = this.folderTree;
        let node = null;

        for (const part of parts) {
            if (!currentLevel[part]) {
                return null;
            }
            node = currentLevel[part];
            currentLevel = node.children || {};
        }

        return node;
    },

    isUrl(str) {
        if (typeof str !== 'string') return false;
        return /^https?:\/\/\S+$/i.test(str.trim());
    },

    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    refreshDOMCache() {
        this._domCache.editor = document.querySelector('.cm-editor');
        this._domCache.previewContent = document.querySelector('.markdown-preview');
        // Preview container is the scrollable parent of .markdown-preview
        this._domCache.previewContainer = this._domCache.previewContent ? this._domCache.previewContent.parentElement : null;
    },
};
