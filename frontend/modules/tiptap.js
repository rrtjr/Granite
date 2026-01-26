// Granite Frontend - Tiptap Editor Module (Rich View)

import { Debug } from './config.js';

export const tiptapMixin = {
    // Tiptap editor instance
    tiptapEditor: null,
    tiptapReady: false,
    _tiptapSyncTimeout: null,
    _tiptapUpdating: false,  // Prevent circular updates
    _frontmatter: '',  // Store frontmatter separately (not editable in Rich view)

    // Initialize Tiptap editor
    initTiptap() {
        if (!window.Tiptap || !window.TiptapReady) {
            Debug.log('Tiptap not loaded yet, retrying...');
            setTimeout(() => this.initTiptap(), 100);
            return;
        }

        const container = this.$refs.tiptapContainer || document.getElementById('tiptap-editor');
        if (!container) {
            Debug.log('Tiptap container not found, retrying...');
            setTimeout(() => this.initTiptap(), 100);
            return;
        }

        if (this.tiptapEditor) {
            Debug.log('Tiptap already initialized');
            return;
        }

        Debug.log('Initializing Tiptap...');

        const {
            Editor, StarterKit, Placeholder, Link, Image,
            CodeBlockLowlight, Table, TableRow, TableCell,
            TableHeader, TaskList, TaskItem, lowlight
        } = window.Tiptap;

        const self = this;

        // Extract frontmatter before converting to HTML
        const { frontmatter, content } = this.extractFrontmatter(this.noteContent || '');
        this._frontmatter = frontmatter;

        const initialHtml = this.addBannerToHtml(this.noteContent || '', this.markdownToHtml(content));

        this.tiptapEditor = new Editor({
            element: container,
            extensions: [
                StarterKit.configure({
                    codeBlock: false, // Use CodeBlockLowlight instead
                    heading: {
                        levels: [1, 2, 3, 4, 5, 6],
                    },
                }),
                Placeholder.configure({
                    placeholder: 'Start writing...',
                }),
                Link.configure({
                    openOnClick: false,
                    HTMLAttributes: { class: 'tiptap-link' }
                }),
                Image.configure({
                    HTMLAttributes: { class: 'tiptap-image' },
                    allowBase64: true,
                }),
                CodeBlockLowlight.configure({
                    lowlight,
                }),
                Table.configure({ resizable: true }),
                TableRow,
                TableCell,
                TableHeader,
                TaskList,
                TaskItem.configure({ nested: true }),
                // Custom extensions
                this.createWikilinkExtension(),
                this.createImageEmbedExtension(),
                this.createSpreadsheetExtension(),
                this.createMermaidExtension(),
            ],
            content: initialHtml,
            onUpdate: ({ editor }) => {
                if (self._tiptapUpdating) return;

                if (self._tiptapSyncTimeout) {
                    clearTimeout(self._tiptapSyncTimeout);
                }

                self._tiptapSyncTimeout = setTimeout(() => {
                    self.syncTiptapToMarkdown();
                }, self.performanceSettings?.updateDelay || 300);
            },
            editorProps: {
                attributes: {
                    class: 'tiptap-editor-content prose max-w-none focus:outline-none',
                },
            },
        });

        this.tiptapReady = true;
        Debug.log('Tiptap initialized successfully!');
    },

    // Destroy Tiptap editor
    destroyTiptap() {
        if (this.tiptapEditor) {
            this.tiptapEditor.destroy();
            this.tiptapEditor = null;
            this.tiptapReady = false;
            this._frontmatter = '';
            Debug.log('Tiptap destroyed');
        }
    },

    // Extract YAML frontmatter from markdown
    extractFrontmatter(markdown) {
        if (!markdown) return { frontmatter: '', content: '' };

        const frontmatterMatch = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
        if (frontmatterMatch) {
            return {
                frontmatter: frontmatterMatch[0],
                content: markdown.slice(frontmatterMatch[0].length)
            };
        }
        return { frontmatter: '', content: markdown };
    },

    // Convert markdown to HTML for Tiptap
    markdownToHtml(markdown) {
        if (!markdown) return '';

        // Pre-process custom syntax
        let processed = markdown;

        // Convert wikilinks to spans: [[target]] or [[target|display]]
        processed = processed.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (match, target, display) => {
            const text = display || target;
            return `<span class="wikilink" data-target="${this.escapeHtml(target)}" data-wikilink="true">${this.escapeHtml(text)}</span>`;
        });

        // Convert image embeds: ![[image.png]] or ![[image.png|alt text]]
        processed = processed.replace(/!\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (match, target, alt) => {
            const imagePath = this.resolveImagePath(target);
            const altText = alt || target;
            return `<img class="image-embed" src="${imagePath}" alt="${this.escapeHtml(altText)}" data-original-path="${this.escapeHtml(target)}" />`;
        });

        // Convert spreadsheet blocks to divs
        processed = processed.replace(/```spreadsheet([^\n]*)\n([\s\S]*?)```/g, (match, meta, code) => {
            const nameMatch = meta.match(/(?:name|title)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s,;]+))/i);
            const sheetName = nameMatch ? (nameMatch[1] || nameMatch[2] || nameMatch[3]) : '';
            return `<div class="spreadsheet-block" data-original-code="${this.escapeHtml(code.trim())}" data-sheet-name="${this.escapeHtml(sheetName)}" contenteditable="false"><div class="spreadsheet-placeholder">Spreadsheet${sheetName ? `: ${sheetName}` : ''}</div></div>`;
        });

        // Convert mermaid blocks to divs
        processed = processed.replace(/```mermaid\n([\s\S]*?)```/g, (match, code) => {
            return `<div class="mermaid-block" data-original-code="${this.escapeHtml(code.trim())}" contenteditable="false"><div class="mermaid-placeholder">Mermaid Diagram</div></div>`;
        });

        // Use marked.js from the page (already loaded via CDN)
        if (typeof marked !== 'undefined') {
            return marked.parse(processed);
        }

        // Fallback: basic conversion
        return processed
            .replace(/^### (.*$)/gim, '<h3>$1</h3>')
            .replace(/^## (.*$)/gim, '<h2>$1</h2>')
            .replace(/^# (.*$)/gim, '<h1>$1</h1>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n/g, '<br>');
    },

    // Convert Tiptap HTML back to markdown
    htmlToMarkdown(html) {
        if (!html) return '';

        const { TurndownService } = window.Tiptap;
        if (!TurndownService) {
            Debug.error('TurndownService not available');
            return html;
        }

        const turndown = new TurndownService({
            headingStyle: 'atx',
            codeBlockStyle: 'fenced',
            bulletListMarker: '-',
            emDelimiter: '*',
            strongDelimiter: '**',
        });

        // Add custom rules for our extensions
        this.addTurndownRules(turndown);

        let markdown = turndown.turndown(html);

        // Clean up extra whitespace
        markdown = markdown.replace(/\n{3,}/g, '\n\n');

        return markdown;
    },

    // Add Turndown rules for custom elements
    addTurndownRules(turndown) {
        // Rule for wikilinks
        turndown.addRule('wikilink', {
            filter: (node) => node.nodeName === 'SPAN' && node.classList.contains('wikilink'),
            replacement: (content, node) => {
                const target = node.dataset.target || content;
                const display = content.trim();
                if (display !== target) {
                    return `[[${target}|${display}]]`;
                }
                return `[[${target}]]`;
            }
        });

        // Rule for image embeds
        turndown.addRule('imageEmbed', {
            filter: (node) => node.nodeName === 'IMG' && node.classList.contains('image-embed'),
            replacement: (content, node) => {
                const originalPath = node.dataset.originalPath || '';
                const alt = node.getAttribute('alt') || '';
                if (alt && alt !== originalPath) {
                    return `![[${originalPath}|${alt}]]`;
                }
                return `![[${originalPath}]]`;
            }
        });

        // Rule for spreadsheet blocks
        turndown.addRule('spreadsheet', {
            filter: (node) => node.classList && node.classList.contains('spreadsheet-block'),
            replacement: (content, node) => {
                const code = node.dataset.originalCode || '';
                const name = node.dataset.sheetName || '';
                const meta = name ? ` name="${name}"` : '';
                return `\n\`\`\`spreadsheet${meta}\n${code}\n\`\`\`\n`;
            }
        });

        // Rule for mermaid blocks
        turndown.addRule('mermaid', {
            filter: (node) => node.classList && node.classList.contains('mermaid-block'),
            replacement: (content, node) => {
                const code = node.dataset.originalCode || '';
                return `\n\`\`\`mermaid\n${code}\n\`\`\`\n`;
            }
        });

        // Rule for banner wrapper (keep inner content only)
        turndown.addRule('noteBanner', {
            filter: (node) => node.classList && node.classList.contains('note-banner'),
            replacement: (content) => content || ''
        });

        // Keep code blocks with language
        turndown.addRule('fencedCodeBlock', {
            filter: (node) => {
                return node.nodeName === 'PRE' && node.firstChild && node.firstChild.nodeName === 'CODE';
            },
            replacement: (content, node) => {
                const code = node.firstChild;
                const className = code.getAttribute('class') || '';
                const langMatch = className.match(/language-(\w+)/);
                const lang = langMatch ? langMatch[1] : '';
                const text = code.textContent || '';
                return `\n\`\`\`${lang}\n${text}\n\`\`\`\n`;
            }
        });
    },

    // Sync Tiptap content back to noteContent
    syncTiptapToMarkdown() {
        if (!this.tiptapEditor) return;

        const html = this.tiptapEditor.getHTML();
        const markdown = this.htmlToMarkdown(html);

        // Reconstruct with frontmatter
        const fullContent = this._frontmatter + markdown;

        if (fullContent !== this.noteContent) {
            this._tiptapUpdating = true;
            this.noteContent = fullContent;
            this.autoSave();
            this.$nextTick(() => {
                this._tiptapUpdating = false;
            });
        }
    },

    // Update Tiptap content from noteContent
    updateTiptapContent(markdown) {
        if (!this.tiptapEditor || this._tiptapUpdating) return;

        this._tiptapUpdating = true;

        // Extract frontmatter
        const { frontmatter, content } = this.extractFrontmatter(markdown || '');
        this._frontmatter = frontmatter;

        const htmlWithBanner = this.addBannerToHtml(markdown, this.markdownToHtml(content));
        this.tiptapEditor.commands.setContent(htmlWithBanner);

        this.$nextTick(() => {
            this._tiptapUpdating = false;
            // Render special blocks after content update
            this.renderTiptapSpecialBlocks();
        });
    },

    // Get Tiptap content as markdown
    getTiptapContent() {
        if (!this.tiptapEditor) return '';
        const html = this.tiptapEditor.getHTML();
        const markdown = this.htmlToMarkdown(html);
        return this._frontmatter + markdown;
    },

    // Focus Tiptap editor
    focusTiptap() {
        if (this.tiptapEditor) {
            this.tiptapEditor.commands.focus();
        }
    },

    // Resolve image path for embeds
    resolveImagePath(target) {
        // Check if it's already a full URL or path
        if (target.startsWith('http://') || target.startsWith('https://') || target.startsWith('/')) {
            return target;
        }

        // Try to find in notes list (images)
        const allImages = this.notes?.filter(n => n.type === 'image') || [];
        const foundImage = allImages.find(img =>
            img.name === target ||
            img.path === target ||
            img.name.toLowerCase() === target.toLowerCase()
        );

        if (foundImage) {
            return `/api/images/${foundImage.path.split('/').map(encodeURIComponent).join('/')}`;
        }

        // Default: assume it's in the images directory
        return `/api/images/${encodeURIComponent(target)}`;
    },

    // Escape HTML for attributes
    escapeHtml(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },

    // Render special blocks (spreadsheets, mermaid) after content load
    renderTiptapSpecialBlocks() {
        const container = this.$refs.tiptapContainer || document.getElementById('tiptap-editor');
        if (!container) return;

        // Render spreadsheets
        container.querySelectorAll('.spreadsheet-block').forEach((block, index) => {
            const code = block.dataset.originalCode || '';
            const sheetName = block.dataset.sheetName || '';

            if (code && typeof this.parseSpreadsheetCSV === 'function') {
                try {
                    const data = this.parseSpreadsheetCSV(code);
                    // Render a simple static table
                    let tableHtml = '<table class="spreadsheet-table tiptap-spreadsheet">';
                    data.forEach((row, rowIndex) => {
                        tableHtml += '<tr>';
                        row.forEach(cell => {
                            const tag = rowIndex === 0 ? 'th' : 'td';
                            tableHtml += `<${tag}>${this.escapeHtml(cell)}</${tag}>`;
                        });
                        tableHtml += '</tr>';
                    });
                    tableHtml += '</table>';

                    const nameDisplay = sheetName ? `<div class="spreadsheet-name">${this.escapeHtml(sheetName)}</div>` : '';
                    block.innerHTML = nameDisplay + tableHtml + '<div class="spreadsheet-edit-hint">Switch to Edit mode to modify</div>';
                } catch (e) {
                    Debug.error('Error rendering spreadsheet:', e);
                }
            }
        });

        // Render mermaid diagrams
        container.querySelectorAll('.mermaid-block').forEach(async (block, index) => {
            const code = block.dataset.originalCode || '';

            if (code && typeof window.mermaid !== 'undefined') {
                try {
                    const id = `tiptap-mermaid-${Date.now()}-${index}`;
                    const { svg } = await window.mermaid.render(id, code);
                    block.innerHTML = svg;
                } catch (e) {
                    block.innerHTML = `<div class="mermaid-error">Diagram error: ${e.message}</div>`;
                }
            }
        });
    },

    // Create Wikilink extension
    createWikilinkExtension() {
        const { Node, mergeAttributes } = window.Tiptap;
        const self = this;

        return Node.create({
            name: 'wikilink',
            group: 'inline',
            inline: true,
            selectable: true,
            atom: true,

            addAttributes() {
                return {
                    target: { default: null },
                    display: { default: null },
                };
            },

            parseHTML() {
                return [{
                    tag: 'span.wikilink',
                    getAttrs: (dom) => ({
                        target: dom.dataset.target,
                        display: dom.textContent,
                    }),
                }];
            },

            renderHTML({ node, HTMLAttributes }) {
                const { target, display } = node.attrs;
                const text = display || target || '';
                return ['span', mergeAttributes(HTMLAttributes, {
                    class: 'wikilink',
                    'data-target': target,
                    'data-wikilink': 'true',
                }), text];
            },

            addNodeView() {
                return ({ node }) => {
                    const span = document.createElement('span');
                    span.className = 'wikilink';
                    span.dataset.target = node.attrs.target || '';
                    span.dataset.wikilink = 'true';
                    span.textContent = node.attrs.display || node.attrs.target || '';
                    span.addEventListener('click', () => {
                        if (node.attrs.target) {
                            self.handleInternalLink(node.attrs.target);
                        }
                    });
                    return { dom: span };
                };
            },
        });
    },

    // Create Image Embed extension
    createImageEmbedExtension() {
        const { Node, mergeAttributes } = window.Tiptap;
        const self = this;

        return Node.create({
            name: 'imageEmbed',
            group: 'block',
            atom: true,

            addAttributes() {
                return {
                    src: { default: null },
                    alt: { default: null },
                    originalPath: { default: null },
                };
            },

            parseHTML() {
                return [{
                    tag: 'img.image-embed',
                    getAttrs: (dom) => ({
                        src: dom.getAttribute('src'),
                        alt: dom.getAttribute('alt'),
                        originalPath: dom.dataset.originalPath,
                    }),
                }];
            },

            renderHTML({ node, HTMLAttributes }) {
                return ['img', mergeAttributes(HTMLAttributes, {
                    class: 'image-embed tiptap-image-embed',
                    src: node.attrs.src,
                    alt: node.attrs.alt || '',
                    'data-original-path': node.attrs.originalPath,
                })];
            },
        });
    },

    // Create Spreadsheet extension
    createSpreadsheetExtension() {
        const { Node, mergeAttributes } = window.Tiptap;

        return Node.create({
            name: 'spreadsheetBlock',
            group: 'block',
            atom: true,
            selectable: true,

            addAttributes() {
                return {
                    code: { default: '' },
                    sheetName: { default: '' },
                };
            },

            parseHTML() {
                return [{
                    tag: 'div.spreadsheet-block',
                    getAttrs: (dom) => ({
                        code: dom.dataset.originalCode || '',
                        sheetName: dom.dataset.sheetName || '',
                    }),
                }];
            },

            renderHTML({ node, HTMLAttributes }) {
                return ['div', mergeAttributes(HTMLAttributes, {
                    class: 'spreadsheet-block',
                    'data-original-code': node.attrs.code,
                    'data-sheet-name': node.attrs.sheetName,
                    'contenteditable': 'false',
                }), ['div', { class: 'spreadsheet-placeholder' },
                    `Spreadsheet${node.attrs.sheetName ? `: ${node.attrs.sheetName}` : ''}`
                ]];
            },
        });
    },

    // Create Mermaid extension
    createMermaidExtension() {
        const { Node, mergeAttributes } = window.Tiptap;

        return Node.create({
            name: 'mermaidBlock',
            group: 'block',
            atom: true,
            selectable: true,

            addAttributes() {
                return {
                    code: { default: '' },
                };
            },

            parseHTML() {
                return [{
                    tag: 'div.mermaid-block',
                    getAttrs: (dom) => ({
                        code: dom.dataset.originalCode || '',
                    }),
                }];
            },

            renderHTML({ node, HTMLAttributes }) {
                return ['div', mergeAttributes(HTMLAttributes, {
                    class: 'mermaid-block',
                    'data-original-code': node.attrs.code,
                    'contenteditable': 'false',
                }), ['div', { class: 'mermaid-placeholder' }, 'Mermaid Diagram']];
            },
        });
    },

    // Inject banner HTML (from frontmatter banner:) ahead of note content for rich view
    addBannerToHtml(markdown, html) {
        if (!markdown || !html || typeof this.parseBannerFromContent !== 'function') {
            return html;
        }

        const bannerInfo = this.parseBannerFromContent(markdown);
        if (!bannerInfo || !bannerInfo.url) return html;

        const safeUrl = bannerInfo.url.replace(/"/g, '%22');
        const opacity = this.bannerOpacity;

        let contentHtml = html;
        let titleHtml = '';

        const h1Match = contentHtml.match(/<h1[^>]*>(.*?)<\/h1>/i);
        if (h1Match) {
            titleHtml = `<h1 class="banner-title">${h1Match[1]}</h1>`;
            contentHtml = contentHtml.replace(h1Match[0], '');
        }

        const bannerHtml = `<div class="note-banner"><div class="banner-image" style="background-image: url('${safeUrl}'); opacity: ${opacity}"></div>${titleHtml}</div>`;
        return bannerHtml + contentHtml;
    },
};
