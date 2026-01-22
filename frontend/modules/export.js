// Granite Frontend - Export Module (HTML and PDF)

import { Debug } from './config.js';

export const exportMixin = {
    // Export current note as HTML
    async exportToHTML() {
        if (!this.currentNote || !this.noteContent) {
            alert('No note content to export');
            return;
        }

        try {
            const noteName = this.currentNoteName || 'note';
            let renderedHTML = this.renderedMarkdown;

            // Embed local images as base64
            const imgRegex = /src="\/api\/images\/([^"]+)"/g;
            const imgMatches = [...renderedHTML.matchAll(imgRegex)];

            for (const match of imgMatches) {
                const encodedPath = match[1];
                try {
                    const imgResponse = await fetch(`/api/images/${encodedPath}`);
                    if (imgResponse.ok) {
                        const blob = await imgResponse.blob();
                        const base64 = await new Promise((resolve) => {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve(reader.result);
                            reader.readAsDataURL(blob);
                        });
                        renderedHTML = renderedHTML.replace(match[0], `src="${base64}"`);
                    }
                } catch (e) {
                    Debug.warn(`Failed to embed image: ${encodedPath}`, e);
                    const decodedPath = decodeURIComponent(encodedPath);
                    renderedHTML = renderedHTML.replace(match[0], `src="${decodedPath}"`);
                }
            }

            // Get theme CSS
            const currentTheme = this.currentTheme || 'light';
            const themeResponse = await fetch(`/api/themes/${currentTheme}`);
            const themeText = await themeResponse.text();

            let themeCss;
            try {
                const themeJson = JSON.parse(themeText);
                themeCss = themeJson.css || themeText;
            } catch (e) {
                themeCss = themeText;
            }

            themeCss = themeCss.replace(/:root\[data-theme="[^"]+"\]/g, ':root');

            // Get highlight.js theme URL
            const highlightLinkElement = document.getElementById('highlight-theme');
            const highlightTheme = highlightLinkElement ? highlightLinkElement.href : '';

            // Extract markdown styles from current page
            let markdownStyles = '';
            const styleSheets = Array.from(document.styleSheets);

            for (const sheet of styleSheets) {
                try {
                    if (sheet.href && (sheet.href.startsWith('http://') || sheet.href.startsWith('https://'))) {
                        const currentOrigin = window.location.origin;
                        const sheetURL = new URL(sheet.href);
                        if (sheetURL.origin !== currentOrigin) {
                            continue;
                        }
                    }

                    const rules = Array.from(sheet.cssRules || []);
                    for (const rule of rules) {
                        const cssText = rule.cssText;
                        if (cssText.includes('.markdown-preview') ||
                            cssText.includes('mjx-container') ||
                            cssText.includes('.MathJax') ||
                            cssText.includes('.mermaid-rendered')) {
                            markdownStyles += cssText + '\n';
                        }
                    }
                } catch (e) {
                    console.debug('Skipping stylesheet:', sheet.href);
                }
            }

            // Create standalone HTML document
            const htmlDocument = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${noteName}</title>

    ${highlightTheme ? `<link rel="stylesheet" href="${highlightTheme}">` : ''}
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>

    <script>
        MathJax = {
            tex: {
                inlineMath: [['$', '$']],
                displayMath: [['$$', '$$']],
                processEscapes: true,
                processEnvironments: true
            },
            options: {
                skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code']
            },
            startup: {
                pageReady: () => {
                    return MathJax.startup.defaultPageReady().then(() => {
                        document.querySelectorAll('pre code:not(.language-mermaid)').forEach((block) => {
                            hljs.highlightElement(block);
                        });
                    });
                }
            }
        };
    </script>
    <script src="https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-mml-chtml.js"></script>

    <script type="module">
        import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11.12.2/dist/mermaid.esm.min.mjs';
        const isDark = ${this.getThemeType() === 'dark'};
        mermaid.initialize({
            startOnLoad: false,
            theme: isDark ? 'dark' : 'default',
            securityLevel: 'strict',
            fontFamily: 'inherit'
        });

        document.addEventListener('DOMContentLoaded', async () => {
            const mermaidBlocks = document.querySelectorAll('pre code.language-mermaid');
            for (let i = 0; i < mermaidBlocks.length; i++) {
                const block = mermaidBlocks[i];
                const pre = block.parentElement;
                try {
                    const code = block.textContent;
                    const id = 'mermaid-diagram-' + i;
                    const { svg } = await mermaid.render(id, code);
                    const container = document.createElement('div');
                    container.className = 'mermaid-rendered';
                    container.style.cssText = 'background-color: transparent; padding: 20px; text-align: center; overflow-x: auto;';
                    container.innerHTML = svg;
                    pre.parentElement.replaceChild(container, pre);
                } catch (error) {
                    Debug.error('Mermaid rendering error:', error);
                }
            }
        });
    </script>

    <style>
        ${themeCss}

        * { box-sizing: border-box; }

        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            margin: 0;
            padding: 2rem;
            max-width: 900px;
            margin-left: auto;
            margin-right: auto;
            background-color: var(--bg-primary);
            color: var(--text-primary);
        }

        ${markdownStyles}

        @media (max-width: 768px) {
            body { padding: 1rem; }
        }

        @media print {
            body { padding: 0.5in; max-width: none; }
        }
    </style>
</head>
<body>
    <div class="markdown-preview">
        ${renderedHTML}
    </div>
</body>
</html>`;

            // Download
            const blob = new Blob([htmlDocument], { type: 'text/html;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${noteName}.html`;
            document.body.appendChild(a);
            a.click();
            URL.revokeObjectURL(url);
            document.body.removeChild(a);

        } catch (error) {
            Debug.error('HTML export failed:', error);
            alert(`Failed to export HTML: ${error.message}`);
        }
    },

    // Export current note as PDF
    async exportToPDF() {
        if (!this.currentNote || !this.noteContent) {
            alert('No note content to export');
            return;
        }

        if (this.isExportingPDF) {
            return;
        }

        try {
            this.isExportingPDF = true;

            const noteName = this.currentNoteName || 'note';

            const response = await fetch('/api/plugins/pdf_export/export', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    note_path: this.currentNote,
                    content: this.noteContent,
                    output_filename: `${noteName}.pdf`
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || `Export failed with status ${response.status}`);
            }

            const blob = await response.blob();

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${noteName}.pdf`;
            document.body.appendChild(a);
            a.click();
            URL.revokeObjectURL(url);
            document.body.removeChild(a);

        } catch (error) {
            Debug.error('PDF export failed:', error);

            if (error.message.includes('not enabled')) {
                alert('PDF Export plugin is not enabled. Please enable it in Settings.');
            } else if (error.message.includes('not found')) {
                alert('PDF Export plugin is not installed. Please check the plugin installation.');
            } else {
                alert(`Failed to export PDF: ${error.message}`);
            }
        } finally {
            this.isExportingPDF = false;
        }
    },
};
