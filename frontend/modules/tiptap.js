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

        // Rich Editor Panel container (pane-based system)
        const container = this.$refs.tiptapPanelContainer || document.getElementById('tiptap-editor-panel');

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
            Editor, StarterKit, Placeholder, Image,
            CodeBlockLowlight, Table, TableRow, TableCell,
            TableHeader, TaskList, TaskItem,
            Underline, Highlight, CharacterCount, BubbleMenu, lowlight
        } = window.Tiptap;

        const self = this;

        // Remove old bubble menu element if exists (prevents stale handlers)
        let oldMenu = document.getElementById('tiptap-bubble-menu');
        if (oldMenu) {
            oldMenu.remove();
        }

        // Create bubble menu element
        const bubbleMenuElement = document.createElement('div');
        bubbleMenuElement.id = 'tiptap-bubble-menu';
        bubbleMenuElement.className = 'tiptap-bubble-menu';
        bubbleMenuElement.innerHTML = `
            <button type="button" data-action="bold" title="Bold (Ctrl+B)"><strong>B</strong></button>
            <button type="button" data-action="italic" title="Italic (Ctrl+I)"><em>I</em></button>
            <button type="button" data-action="underline" title="Underline (Ctrl+U)"><u>U</u></button>
            <button type="button" data-action="strike" title="Strikethrough"><s>S</s></button>
            <button type="button" data-action="highlight" title="Highlight"><mark>H</mark></button>
            <button type="button" data-action="code" title="Code"><code>&lt;/&gt;</code></button>
        `;
        document.body.appendChild(bubbleMenuElement);

        // Prevent focus loss on mousedown, but execute action on click
        bubbleMenuElement.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('mousedown', (e) => {
                e.preventDefault();  // Prevents button from stealing focus
            });
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const action = btn.dataset.action;
                self.executeBubbleMenuAction(action);
            });
        });

        // Extract frontmatter before converting to HTML
        const { frontmatter, content } = this.extractFrontmatter(this.noteContent || '');
        this._frontmatter = frontmatter;

        const htmlContent = this.markdownToHtml(content);
        Debug.log('Markdown to HTML:', { contentLength: content.length, htmlLength: htmlContent.length });

        const initialHtml = this.addBannerToHtml(this.noteContent || '', htmlContent);
        Debug.log('After banner:', { initialHtmlLength: initialHtml.length });

        // Store raw editor reference outside Alpine's reactivity to prevent proxy interference
        const editor = new Editor({
            element: container,
            extensions: [
                StarterKit.configure({
                    codeBlock: false, // Use CodeBlockLowlight instead
                    heading: {
                        levels: [1, 2, 3, 4, 5, 6],
                    },
                    underline: false, // Disable StarterKit's underline - we add it separately for explicit control
                }),
                Underline,
                Placeholder.configure({
                    placeholder: 'Start writing...',
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
                Highlight.configure({ multicolor: true }),  // Text highlighting
                CharacterCount.configure({ limit: null }),  // Word/character count
                BubbleMenu.configure({
                    element: bubbleMenuElement,
                    shouldShow: ({ editor, state }) => {
                        const { from, to } = state.selection;
                        const isTextSelected = from !== to;
                        return isTextSelected;
                    },
                    tippyOptions: {
                        duration: 100,
                        placement: 'top',
                        appendTo: () => document.body,
                        interactive: true,
                        maxWidth: 'none',
                        zIndex: 10000,
                        popperOptions: {
                            strategy: 'fixed',
                            modifiers: [
                                {
                                    name: 'flip',
                                    options: {
                                        fallbackPlacements: ['bottom', 'top'],
                                    },
                                },
                                {
                                    name: 'preventOverflow',
                                    options: {
                                        boundary: 'viewport',
                                    },
                                },
                            ],
                        },
                    },
                }),
                // Custom extensions
                this.createBannerExtension(),
                this.createWikilinkExtension(),
                this.createImageEmbedExtension(),
                this.createSpreadsheetExtension(),
                this.createMermaidExtension(),
                this.createMathInlineExtension(),
                this.createMathBlockExtension(),
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

        // Assign to component property and store raw reference for bubble menu
        this.tiptapEditor = editor;
        window._graniteTiptapEditor = editor;  // Raw reference bypasses Alpine proxy

        this.tiptapReady = true;
        Debug.log('Tiptap initialized successfully!');
        Debug.log('Tiptap final HTML:', {
            finalHtmlLength: editor.getHTML().length,
            finalHtmlPreview: editor.getHTML().substring(0, 300)
        });

        // Apply current reading preferences to the editor
        this.$nextTick(() => {
            this.updateTiptapReadingPreferences();
            this.updateTiptapBannerOpacity();
            this.renderTiptapSpecialBlocks();
        });
    },

    // Execute bubble menu formatting action
    executeBubbleMenuAction(action) {
        if (!this.tiptapEditor) return;

        // Clear any pending sync to prevent state mismatch
        if (this._tiptapSyncTimeout) {
            clearTimeout(this._tiptapSyncTimeout);
            this._tiptapSyncTimeout = null;
        }

        // Use raw editor reference (bypasses Alpine's reactive proxy) and defer to next frame
        // This prevents "mismatched transaction" errors from proxy/state conflicts
        requestAnimationFrame(() => {
            const editor = window._graniteTiptapEditor;
            if (!editor) return;
            switch (action) {
                case 'bold':
                    editor.chain().focus().toggleBold().run();
                    break;
                case 'italic':
                    editor.chain().focus().toggleItalic().run();
                    break;
                case 'underline':
                    editor.chain().focus().toggleUnderline().run();
                    break;
                case 'strike':
                    editor.chain().focus().toggleStrike().run();
                    break;
                case 'highlight':
                    editor.chain().focus().toggleHighlight({ color: '#fef08a' }).run();
                    break;
                case 'code':
                    editor.chain().focus().toggleCode().run();
                    break;
            }
        });
    },

    // Get character/word count from Tiptap
    getTiptapStats() {
        if (!this.tiptapEditor) return { characters: 0, words: 0 };

        const storage = this.tiptapEditor.storage.characterCount;
        return {
            characters: storage?.characters() || 0,
            words: storage?.words() || 0,
        };
    },

    // Destroy Tiptap editor
    destroyTiptap() {
        if (this.tiptapEditor) {
            this.tiptapEditor.destroy();
            this.tiptapEditor = null;
            window._graniteTiptapEditor = null;  // Clear raw reference
            this.tiptapReady = false;
            this._frontmatter = '';

            // Clean up bubble menu element
            const bubbleMenu = document.getElementById('tiptap-bubble-menu');
            if (bubbleMenu) {
                bubbleMenu.remove();
            }

            Debug.log('Tiptap destroyed');
        }
    },

    // Update Tiptap editor with reading preferences classes
    updateTiptapReadingPreferences() {
        if (!this.tiptapEditor || !this.tiptapReady) return;

        const contentElement = document.querySelector('.tiptap-editor-content');
        if (!contentElement) return;

        // Remove all previous reading preference classes
        contentElement.classList.remove(
            'reading-width-narrow', 'reading-width-medium', 'reading-width-wide', 'reading-width-full',
            'align-left', 'align-center', 'align-justified',
            'margins-compact', 'margins-normal', 'margins-relaxed', 'margins-extra-relaxed'
        );

        // Add new reading preference classes
        if (this.readingWidth) {
            contentElement.classList.add(`reading-width-${this.readingWidth}`);
        }
        if (this.contentAlign) {
            contentElement.classList.add(`align-${this.contentAlign}`);
        }
        if (this.contentMargins) {
            contentElement.classList.add(`margins-${this.contentMargins}`);
        }

        // Force reflow to ensure immediate visual update
        void contentElement.offsetHeight;

        Debug.log('Updated Tiptap reading preferences:', {
            width: this.readingWidth,
            align: this.contentAlign,
            margins: this.contentMargins
        });
    },

    // Update banner opacity in rich mode without reload
    updateTiptapBannerOpacity() {
        if (!this.tiptapEditor || !this.tiptapReady) return;

        const opacity = Math.max(0, Math.min(1, parseFloat(this.bannerOpacity) || 0));

        // Update the DOM directly for immediate visual feedback
        // Banner opacity is a display preference, not document content
        const banners = document.querySelectorAll('.tiptap-editor-content .note-banner');
        banners.forEach((banner) => {
            banner.dataset.bannerOpacity = String(opacity);
            const img = banner.querySelector('.banner-image');
            if (img) {
                img.style.opacity = String(opacity);
            }
        });
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

        // Protect math from marked.js with placeholders, render with KaTeX after
        const mathPlaceholders = [];
        let mathIndex = 0;

        // Protect block math $$...$$
        processed = processed.replace(/\$\$([\s\S]*?)\$\$/g, (match, tex) => {
            const placeholder = `XMATHBLOCKX${mathIndex}XEND`;
            mathPlaceholders.push({ placeholder, tex: tex.trim(), displayMode: true });
            mathIndex++;
            return placeholder;
        });

        // Protect inline math $...$
        processed = processed.replace(/\$([^$\n]+?)\$/g, (match, tex) => {
            const placeholder = `XMATHINLINEX${mathIndex}XEND`;
            mathPlaceholders.push({ placeholder, tex: tex.trim(), displayMode: false });
            mathIndex++;
            return placeholder;
        });

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

        // Convert ==highlight== syntax to <mark> tags
        processed = processed.replace(/==([^=]+)==/g, '<mark>$1</mark>');

        // Use marked.js from the page (already loaded via CDN)
        let html;
        if (typeof marked !== 'undefined') {
            // Configure marked for GFM tables and line breaks
            marked.setOptions({
                breaks: true,
                gfm: true,
            });
            html = marked.parse(processed);
        } else {
            // Fallback: basic conversion
            html = processed
                .replace(/^### (.*$)/gim, '<h3>$1</h3>')
                .replace(/^## (.*$)/gim, '<h2>$1</h2>')
                .replace(/^# (.*$)/gim, '<h1>$1</h1>')
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                .replace(/\n/g, '<br>');
        }

        // Restore math placeholders and render with KaTeX
        mathPlaceholders.forEach(({ placeholder, tex, displayMode }) => {
            let rendered;
            try {
                if (window.katex) {
                    const katexHtml = window.katex.renderToString(tex, {
                        displayMode: displayMode,
                        throwOnError: false
                    });
                    if (displayMode) {
                        rendered = `<div class="math-display" data-math-tex="${this.escapeHtml(tex)}">${katexHtml}</div>`;
                    } else {
                        rendered = `<span class="math-inline" data-math-tex="${this.escapeHtml(tex)}">${katexHtml}</span>`;
                    }
                } else {
                    // Fallback: show raw TeX
                    rendered = displayMode ? `$$${tex}$$` : `$${tex}$`;
                }
            } catch (e) {
                Debug.log('KaTeX error:', e);
                rendered = displayMode ? `$$${tex}$$` : `$${tex}$`;
            }
            html = html.replace(new RegExp(placeholder, 'g'), rendered);
        });

        // Transform spreadsheet code blocks to our custom format after marked parsing
        // marked converts ```spreadsheet to <pre><code class="language-spreadsheet">
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;

        tempDiv.querySelectorAll('pre code.language-spreadsheet').forEach((block) => {
            const pre = block.parentElement;
            if (!pre) return;
            const code = block.textContent || '';

            // Extract sheet name from first line if present (e.g., name="Sheet1")
            const lines = code.split('\n');
            let sheetName = '';
            let csvCode = code;
            if (lines.length > 0 && /^(?:name|title)\s*=/i.test(lines[0].trim())) {
                const nameMatch = lines[0].match(/(?:name|title)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s,;]+))/i);
                sheetName = nameMatch ? (nameMatch[1] || nameMatch[2] || nameMatch[3]) : '';
                csvCode = lines.slice(1).join('\n');
            }

            const wrapper = document.createElement('div');
            wrapper.className = 'spreadsheet-block';
            wrapper.dataset.originalCode = csvCode.trim();
            wrapper.dataset.sheetName = sheetName;
            wrapper.setAttribute('contenteditable', 'false');
            wrapper.innerHTML = `<div class="spreadsheet-placeholder">Spreadsheet${sheetName ? `: ${sheetName}` : ''}</div>`;
            pre.parentNode.replaceChild(wrapper, pre);
        });

        // Transform mermaid code blocks similarly
        tempDiv.querySelectorAll('pre code.language-mermaid').forEach((block) => {
            const pre = block.parentElement;
            if (!pre) return;
            const code = block.textContent || '';

            const wrapper = document.createElement('div');
            wrapper.className = 'mermaid-block';
            wrapper.dataset.originalCode = code.trim();
            wrapper.setAttribute('contenteditable', 'false');
            wrapper.innerHTML = '<div class="mermaid-placeholder">Mermaid Diagram</div>';
            pre.parentNode.replaceChild(wrapper, pre);
        });

        return tempDiv.innerHTML;
    },

    // Convert Tiptap HTML back to markdown
    htmlToMarkdown(html) {
        if (!html) return '';

        const temp = document.createElement('div');
        temp.innerHTML = html;

        // If MathJax has rendered, recover TeX from mjx-container
        temp.querySelectorAll('mjx-container').forEach((node) => {
            const tex = node.getAttribute('aria-label') || '';
            const display = node.getAttribute('display') === 'true';
            if (tex) {
                const replacement = display ? `$$${tex}$$` : `$${tex}$`;
                node.replaceWith(document.createTextNode(replacement));
            }
        });

        // Also recover from our data-tex wrappers in case MathJax didn’t run or aria-label missing
        temp.querySelectorAll('.math-tex-inline, .math-tex-block').forEach((el) => {
            const tex = el.getAttribute('data-tex');
            if (tex) {
                el.replaceWith(document.createTextNode(tex));
            }
        });

        const cleanedHtml = temp.innerHTML;

        const { TurndownService } = window.Tiptap;
        if (!TurndownService) {
            Debug.error('TurndownService not available');
            return cleanedHtml;
        }

        const turndown = new TurndownService({
            headingStyle: 'atx',
            codeBlockStyle: 'fenced',
            bulletListMarker: '-',
            emDelimiter: '*',
            strongDelimiter: '**',
            blankReplacement: (content, node) => {
                // Prevent extra blank lines in lists
                return node.isBlock ? '\n' : '';
            },
        });

        // Add custom rules for our extensions
        this.addTurndownRules(turndown);

        let markdown = turndown.turndown(cleanedHtml);

        // Clean up extra whitespace - but preserve single blank lines between paragraphs
        markdown = markdown.replace(/\n{3,}/g, '\n\n');

        // Fix list items that have extra blank lines between them
        markdown = markdown.replace(/^([-*+]|\d+\.)\s+(.+)\n\n(?=([-*+]|\d+\.)\s)/gm, '$1 $2\n');

        return markdown;
    },

    // Add Turndown rules for custom elements
    addTurndownRules(turndown) {
        // Rule for underline - use HTML tag since markdown doesn't have native underline
        turndown.addRule('underline', {
            filter: 'u',
            replacement: (content) => `<u>${content}</u>`
        });

        // Rule for highlight/mark - preserve as HTML or use ==text== syntax
        turndown.addRule('highlight', {
            filter: 'mark',
            replacement: (content) => `==${content}==`
        });

        // Rule for list items - handle <p> tags inside <li> to avoid extra newlines
        turndown.addRule('listItem', {
            filter: 'li',
            replacement: (content, node, options) => {
                // Remove leading/trailing newlines and collapse internal newlines
                content = content.replace(/^\n+/, '').replace(/\n+$/, '').replace(/\n\n+/g, '\n');

                const parent = node.parentNode;
                const isOrdered = parent && parent.nodeName === 'OL';
                const prefix = isOrdered
                    ? (Array.from(parent.children).indexOf(node) + 1) + '. '
                    : options.bulletListMarker + ' ';

                // Handle nested content with proper indentation
                const lines = content.split('\n');
                const indentedContent = lines.map((line, i) => i === 0 ? line : '    ' + line).join('\n');

                return prefix + indentedContent + '\n';
            }
        });

        // Rule for block math (display mode)
        turndown.addRule('mathDisplay', {
            filter: (node) => node.nodeName === 'DIV' && node.classList.contains('math-display'),
            replacement: (content, node) => {
                const tex = node.dataset.mathTex || '';
                return `\n$$${tex}$$\n`;
            }
        });

        // Rule for inline math
        turndown.addRule('mathInline', {
            filter: (node) => node.nodeName === 'SPAN' && node.classList.contains('math-inline'),
            replacement: (content, node) => {
                const tex = node.dataset.mathTex || '';
                return `$${tex}$`;
            }
        });

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

        // Rule for markdown tables (convert HTML tables back to markdown pipe tables)
        turndown.addRule('table', {
            filter: 'table',
            replacement: (content, node) => {
                const rows = Array.from(node.querySelectorAll('tr'));
                if (rows.length === 0) return '';

                let markdown = '\n';
                rows.forEach((row, rowIndex) => {
                    const cells = Array.from(row.querySelectorAll('td, th'));
                    const cellContents = cells.map(cell => {
                        const text = cell.textContent.trim();
                        // Escape pipes in cell content
                        return text.replace(/\|/g, '\\|');
                    });

                    markdown += '| ' + cellContents.join(' | ') + ' |\n';

                    // Add separator row after header
                    if (rowIndex === 0) {
                        markdown += '| ' + cells.map(() => '---').join(' | ') + ' |\n';
                    }
                });

                return markdown + '\n';
            }
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

            // Also update the pane's CodeMirror editor if panes are active
            if (this.activePaneId && typeof this.updatePaneEditorContent === 'function') {
                this.updatePaneEditorContent(this.activePaneId, fullContent);
            } else if (this.editorView) {
                // Legacy: update single editor
                this.updateEditorContent(fullContent);
            }

            // Use pane-specific autosave if panes are active
            if (this.activePaneId && typeof this.autoSavePane === 'function') {
                this.autoSavePane(this.activePaneId);
            } else {
                this.autoSave();
            }

            this.$nextTick(() => {
                this._tiptapUpdating = false;
            });
        }
    },

    // Update Tiptap content from noteContent
    updateTiptapContent(markdown) {
        if (!this.tiptapEditor || this._tiptapUpdating) return;

        this._tiptapUpdating = true;

        try {
            // Extract frontmatter
            const { frontmatter, content } = this.extractFrontmatter(markdown || '');
            this._frontmatter = frontmatter;

            const htmlWithBanner = this.addBannerToHtml(markdown, this.markdownToHtml(content));

            // Use raw editor reference to avoid Proxy interference which causes "mismatched transaction" errors
            const editor = window._graniteTiptapEditor || this.tiptapEditor;
            editor.commands.setContent(htmlWithBanner, false);
        } catch (err) {
            Debug.error('updateTiptapContent failed, rebuilding editor:', err);
            this._tiptapUpdating = false;
            // Rebuild the editor to recover from a mismatched transaction
            this.destroyTiptap();
            this.$nextTick(() => this.initTiptap());
            return;
        }

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
        // Choose container based on whether Rich Editor panel is open or using legacy view
        let container;
        if (this.showRichEditorPanel) {
            container = this.$refs.tiptapPanelContainer || document.getElementById('tiptap-editor-panel');
        } else {
            container = this.$refs.tiptapContainer || document.getElementById('tiptap-editor');
        }
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

    // Create Math Inline extension (for $...$)
    createMathInlineExtension() {
        const { Node } = window.Tiptap;

        return Node.create({
            name: 'mathInline',
            group: 'inline',
            inline: true,
            atom: true,
            selectable: true,

            addAttributes() {
                return {
                    tex: { default: '' },
                };
            },

            parseHTML() {
                return [{
                    tag: 'span.math-inline',
                    getAttrs: (dom) => ({
                        tex: dom.dataset.mathTex || '',
                    }),
                }];
            },

            renderHTML({ node }) {
                // Render KaTeX HTML
                let katexHtml = '';
                try {
                    if (window.katex) {
                        katexHtml = window.katex.renderToString(node.attrs.tex, {
                            displayMode: false,
                            throwOnError: false
                        });
                    }
                } catch (e) {
                    katexHtml = `$${node.attrs.tex}$`;
                }

                const span = document.createElement('span');
                span.className = 'math-inline';
                span.setAttribute('data-math-tex', node.attrs.tex);
                span.setAttribute('contenteditable', 'false');
                span.innerHTML = katexHtml || `$${node.attrs.tex}$`;
                return { dom: span };
            },
        });
    },

    // Create Math Block extension (for $$...$$)
    createMathBlockExtension() {
        const { Node } = window.Tiptap;

        return Node.create({
            name: 'mathBlock',
            group: 'block',
            atom: true,
            selectable: true,

            addAttributes() {
                return {
                    tex: { default: '' },
                };
            },

            parseHTML() {
                return [{
                    tag: 'div.math-display',
                    getAttrs: (dom) => ({
                        tex: dom.dataset.mathTex || '',
                    }),
                }];
            },

            renderHTML({ node }) {
                // Render KaTeX HTML
                let katexHtml = '';
                try {
                    if (window.katex) {
                        katexHtml = window.katex.renderToString(node.attrs.tex, {
                            displayMode: true,
                            throwOnError: false
                        });
                    }
                } catch (e) {
                    katexHtml = `$$${node.attrs.tex}$$`;
                }

                const div = document.createElement('div');
                div.className = 'math-display';
                div.setAttribute('data-math-tex', node.attrs.tex);
                div.setAttribute('contenteditable', 'false');
                div.innerHTML = katexHtml || `$$${node.attrs.tex}$$`;
                return { dom: div };
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

    // Create Banner extension to preserve banner block in Tiptap schema
    createBannerExtension() {
        const { Node, mergeAttributes } = window.Tiptap;

        return Node.create({
            name: 'noteBanner',
            group: 'block',
            atom: true,
            selectable: true,

            addAttributes() {
                return {
                    bannerUrl: { default: '' },
                    bannerTitle: { default: '' },
                    opacity: { default: 1 },
                };
            },

            parseHTML() {
                return [{
                    tag: 'div.note-banner',
                    getAttrs: (dom) => {
                        const url = dom.dataset.bannerUrl || dom.getAttribute('data-banner-url') || '';
                        const opacityAttr = dom.dataset.bannerOpacity || dom.getAttribute('data-banner-opacity');
                        const opacity = opacityAttr ? parseFloat(opacityAttr) : 1;

                        const titleFromData = dom.dataset.bannerTitle || dom.getAttribute('data-banner-title') || '';
                        const titleEl = dom.querySelector('h1.banner-title');
                        const title = titleFromData || (titleEl ? titleEl.textContent || '' : '');

                        return {
                            bannerUrl: url,
                            bannerTitle: title,
                            opacity: isNaN(opacity) ? 1 : opacity,
                        };
                    }
                }];
            },

            renderHTML({ node, HTMLAttributes }) {
                const attrs = mergeAttributes(HTMLAttributes, {
                    class: 'note-banner',
                    'data-banner-url': node.attrs.bannerUrl || '',
                    'data-banner-title': node.attrs.bannerTitle || '',
                    'data-banner-opacity': node.attrs.opacity,
                });

                const style = node.attrs.bannerUrl
                    ? `background-image: url('${node.attrs.bannerUrl}'); opacity: ${node.attrs.opacity};`
                    : `opacity: ${node.attrs.opacity};`;

                const children = [
                    ['div', { class: 'banner-image', style }]
                ];

                if (node.attrs.bannerTitle) {
                    children.push(['h1', { class: 'banner-title' }, node.attrs.bannerTitle]);
                }

                return ['div', attrs, ...children];
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

        const bannerHtml = `<div class="note-banner" data-banner-url="${safeUrl}" data-banner-title="${this.escapeHtml(titleHtml.replace(/<[^>]+>/g, '') )}" data-banner-opacity="${opacity}"><div class="banner-image" style="background-image: url('${safeUrl}'); opacity: ${opacity}"></div>${titleHtml}</div>`;
        return bannerHtml + contentHtml;
    },
};
