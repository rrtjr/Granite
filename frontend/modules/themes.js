// Granite Frontend - Theme Management

import { Debug } from './config.js';

export const themesMixin = {
    // Load available themes from backend
    async loadThemes() {
        try {
            const response = await fetch('/api/themes');
            const data = await response.json();

            // Use theme names directly from backend (already include emojis)
            this.availableThemes = data.themes;
        } catch (error) {
            Debug.error('Failed to load themes:', error);
            // Fallback to default themes
            this.availableThemes = [
                { id: 'light', name: '🌞 Light' },
                { id: 'dark', name: '🌙 Dark' }
            ];
        }
    },

    // Initialize theme system
    async initTheme() {
        // Load saved theme preference from localStorage
        const savedTheme = localStorage.getItem('graniteTheme') || 'light';
        this.currentTheme = savedTheme;
        await this.applyTheme(savedTheme);
    },

    // Set and apply theme
    async setTheme(themeId) {
        this.currentTheme = themeId;
        localStorage.setItem('graniteTheme', themeId);
        await this.applyTheme(themeId);
    },

    // Apply theme to document
    async applyTheme(themeId) {
        // Load theme CSS from file
        try {
            const response = await fetch(`/api/themes/${themeId}`);
            const data = await response.json();

            // Create or update style element
            let styleEl = document.getElementById('dynamic-theme');
            if (!styleEl) {
                styleEl = document.createElement('style');
                styleEl.id = 'dynamic-theme';
                document.head.appendChild(styleEl);
            }
            styleEl.textContent = data.css;

            // Set data attribute for theme-specific selectors
            document.documentElement.setAttribute('data-theme', themeId);

            // Load appropriate Highlight.js theme for code syntax highlighting
            const highlightTheme = document.getElementById('highlight-theme');
            if (highlightTheme) {
                if (themeId === 'light') {
                    highlightTheme.href = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css';
                } else {
                    // Use dark theme for dark/custom themes
                    highlightTheme.href = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css';
                }
            }

            // Re-render Mermaid diagrams with new theme if there's a current note
            if (this.currentNote) {
                // Small delay to allow theme CSS to load
                setTimeout(() => {
                    // Clear existing Mermaid renders
                    const previewContent = document.querySelector('.markdown-preview');
                    if (previewContent) {
                        const mermaidContainers = previewContent.querySelectorAll('.mermaid-rendered');
                        mermaidContainers.forEach(container => {
                            // Replace with the original code block for re-rendering
                            const parent = container.parentElement;
                            if (parent && container.dataset.originalCode) {
                                const pre = document.createElement('pre');
                                const code = document.createElement('code');
                                code.className = 'language-mermaid';
                                code.textContent = container.dataset.originalCode;
                                pre.appendChild(code);
                                parent.replaceChild(pre, container);
                            }
                        });
                    }
                    // Re-render with new theme
                    this.renderMermaid();
                }, 100);
            }

            // Refresh graph if visible (longer delay to ensure CSS is applied)
            if (this.showGraph) {
                setTimeout(() => this.initGraph(), 300);
            }
        } catch (error) {
            Debug.error('Failed to load theme:', error);
        }
    },

    getThemeType() {
        // Determine if theme is light or dark for Mermaid
        const darkThemes = ['dark', 'dracula', 'nord', 'monokai', 'gruvbox-dark', 'cobalt2',
                          'solarized-dark', 'github-dark', 'one-dark-pro', 'catppuccin-mocha',
                          'vue-high-contrast'];
        return darkThemes.includes(this.currentTheme) ? 'dark' : 'default';
    },
};
