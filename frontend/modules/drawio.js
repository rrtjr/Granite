// Granite Frontend - Draw.io Diagrams Module
// Embedded draw.io editor support for diagram creation and editing

import { Debug } from './config.js';

export const drawioMixin = {
    // Draw.io state
    drawioInstances: {},           // Map of drawioId -> { container, xml, name }
    activeDrawio: null,            // Currently editing diagram ID
    _drawioIdCounter: 0,           // Unique ID counter for diagrams
    _skipDrawioRender: false,      // Flag to prevent render loops during sync
    showDrawioModal: false,        // Modal visibility state
    drawioModalData: null,         // { drawioId, xml, name } for current edit session
    _drawioIframe: null,           // Reference to iframe element
    _drawioMessageHandler: null,   // Bound message event handler for cleanup
    _drawioLoadTimeout: null,      // Timeout for iframe loading
    _drawioLoaded: false,          // Track if editor has initialized
    _pendingSvgExport: false,      // Flag for pending SVG export after save
    _closeAfterSvgExport: false,   // Flag to close editor after SVG export
    _drawioHashCache: {},          // Cache of xml -> hash mappings

    /**
     * Generate a SHA-256 hash of XML content (first 16 chars).
     * Matches the backend hash format.
     * @param {string} xml - XML content to hash
     * @returns {Promise<string>} 16-character hex hash
     */
    async hashDrawioXml(xml) {
        // Check cache first
        if (this._drawioHashCache[xml]) {
            return this._drawioHashCache[xml];
        }

        // Use SubtleCrypto for SHA-256
        const encoder = new TextEncoder();
        const data = encoder.encode(xml);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        const hash = hashHex.substring(0, 16);

        // Cache for future use
        this._drawioHashCache[xml] = hash;
        return hash;
    },

    /**
     * Save SVG to backend cache.
     * @param {string} xml - Original XML content
     * @param {string} svg - SVG content to cache
     */
    async saveSvgToCache(xml, svg) {
        try {
            const response = await fetch('/api/drawio-cache', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ xml, svg })
            });

            if (response.ok) {
                const data = await response.json();
                Debug.log('SVG cached with hash:', data.hash);
                return data.hash;
            }
        } catch (e) {
            Debug.warn('Failed to cache SVG:', e);
        }
        return null;
    },

    /**
     * Load SVG from backend cache.
     * @param {string} hash - Hash of the XML content
     * @returns {Promise<string|null>} SVG content or null if not cached
     */
    async loadSvgFromCache(hash) {
        try {
            const response = await fetch(`/api/drawio-cache/${hash}`);
            if (response.ok) {
                return await response.text();
            }
        } catch (e) {
            Debug.log('No cached SVG found for hash:', hash);
        }
        return null;
    },

    /**
     * Load cached SVG previews for all diagrams in the current view.
     * Called after HTML transformation to async load cached previews.
     */
    async loadCachedSvgPreviews() {
        const wrappers = document.querySelectorAll('.drawio-wrapper');
        if (wrappers.length === 0) return;

        for (const wrapper of wrappers) {
            const xml = wrapper.dataset.originalXml;
            if (!xml) continue;

            // Skip if already has SVG preview
            const existingSvg = wrapper.querySelector('.drawio-svg-container svg');
            if (existingSvg) continue;

            try {
                const hash = await this.hashDrawioXml(xml);
                const svg = await this.loadSvgFromCache(hash);

                if (svg) {
                    // Handle legacy cache that might have data URL format
                    let svgContent = svg;
                    if (svg.startsWith('data:image/svg+xml')) {
                        const commaIndex = svg.indexOf(',');
                        if (commaIndex !== -1) {
                            try {
                                svgContent = atob(svg.substring(commaIndex + 1));
                            } catch (e) {
                                Debug.warn('Failed to decode cached SVG:', e);
                                continue; // Skip this diagram
                            }
                        }
                    }

                    const previewDiv = wrapper.querySelector('.drawio-preview');
                    if (previewDiv) {
                        const svgContainer = document.createElement('div');
                        svgContainer.className = 'drawio-svg-container';
                        svgContainer.innerHTML = svgContent;

                        // Make SVG responsive
                        const svgElement = svgContainer.querySelector('svg');
                        if (svgElement) {
                            svgElement.style.width = '100%';
                            svgElement.style.height = 'auto';
                            svgElement.style.maxHeight = '400px';
                        }

                        previewDiv.innerHTML = '';
                        previewDiv.appendChild(svgContainer);
                        Debug.log('Loaded cached SVG for diagram');
                    }
                }
            } catch (e) {
                Debug.warn('Failed to load cached SVG:', e);
            }
        }
    },

    /**
     * Transform draw.io code blocks in HTML to rendered diagram containers.
     * Called synchronously before DOM update.
     * @param {string} html - HTML content to transform
     * @param {string} sourceContent - Optional source markdown for name extraction
     * @returns {string} Transformed HTML
     */
    transformDrawioHtml(html, sourceContent = null) {
        if (!html) return html;

        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;

        const drawioBlocks = tempDiv.querySelectorAll('pre code.language-drawio');
        if (drawioBlocks.length === 0) return html;

        // Reset counter for this render
        this._drawioIdCounter = 0;

        // Extract names from source content
        const src = sourceContent || this.noteContent || '';
        const names = this.extractDrawioNamesFromContent(src);

        drawioBlocks.forEach((block, index) => {
            const pre = block.parentElement;
            if (!pre || !pre.parentElement) return;

            const xml = block.textContent.trim();
            const drawioId = String(this._drawioIdCounter++);
            const name = names[index] || '';

            const wrapper = document.createElement('div');
            wrapper.className = 'drawio-wrapper';
            wrapper.dataset.originalXml = xml;
            wrapper.dataset.drawioId = drawioId;
            wrapper.dataset.diagramName = name;
            wrapper.innerHTML = this.renderStaticDrawio(xml, drawioId, name);

            pre.parentElement.replaceChild(wrapper, pre);
        });

        // Schedule loading of cached SVG previews after DOM update
        requestAnimationFrame(() => {
            this.loadCachedSvgPreviews();
        });

        return tempDiv.innerHTML;
    },

    /**
     * Extract diagram names from markdown source using regex.
     * @param {string} content - Markdown content
     * @returns {string[]} Array of diagram names in order
     */
    extractDrawioNamesFromContent(content) {
        if (!content) return [];
        const names = [];
        // Match: ```drawio name="DiagramName" or name='DiagramName' or name=DiagramName
        const headerRe = /^[ \t]*```+[ \t]*drawio([^\r\n]*)/gmi;

        let m;
        while ((m = headerRe.exec(content)) !== null) {
            const meta = (m[1] || '').trim();
            let name = '';
            if (meta) {
                const nameMatch = meta.match(/(?:name|title)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s,;]+))/i);
                if (nameMatch) {
                    name = (nameMatch[1] || nameMatch[2] || nameMatch[3] || '').trim();
                }
            }
            names.push(name);
        }
        return names;
    },

    /**
     * Render a static (non-editable) diagram preview.
     * @param {string} xml - Draw.io XML content
     * @param {string} drawioId - Unique diagram ID
     * @param {string} name - Optional diagram name
     * @returns {string} HTML string for the diagram container
     */
    renderStaticDrawio(xml, drawioId, name) {
        const displayName = name || `Diagram ${parseInt(drawioId) + 1}`;
        let svgContent = '';

        // Try to extract embedded SVG from XML
        try {
            svgContent = this.extractSvgFromDrawioXml(xml);
        } catch (e) {
            Debug.warn('Could not extract SVG from draw.io XML:', e);
        }

        const preview = svgContent
            ? `<div class="drawio-svg-container">${svgContent}</div>`
            : `<div class="drawio-placeholder">
                 <svg class="drawio-icon" viewBox="0 0 24 24" width="48" height="48">
                   <path fill="currentColor" d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
                 </svg>
                 <span class="drawio-placeholder-text">Draw.io Diagram</span>
                 <span class="drawio-edit-hint">Click to view or edit</span>
               </div>`;

        const escapedName = this.escapeHtml ? this.escapeHtml(displayName) : displayName.replace(/</g, '&lt;').replace(/>/g, '&gt;');

        return `
            <div class="drawio-container" data-drawio-id="${drawioId}">
                <div class="drawio-toolbar">
                    <span class="drawio-name">${escapedName}</span>
                    <button type="button" class="drawio-btn drawio-btn-edit"
                            onclick="window.dispatchEvent(new CustomEvent('drawio-edit', { detail: '${drawioId}' }))"
                            title="Edit diagram">
                        <svg viewBox="0 0 24 24" width="14" height="14">
                            <path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                        </svg>
                        Edit
                    </button>
                </div>
                <div class="drawio-preview" onclick="window.dispatchEvent(new CustomEvent('drawio-edit', { detail: '${drawioId}' }))">
                    ${preview}
                </div>
            </div>
        `;
    },

    /**
     * Try to extract embedded SVG from draw.io XML.
     * Draw.io XML can contain SVG in multiple formats.
     * @param {string} xml - Draw.io XML content
     * @returns {string} SVG string or empty string
     */
    extractSvgFromDrawioXml(xml) {
        if (!xml) return '';

        // Check for direct SVG
        if (xml.trim().startsWith('<svg')) {
            return xml;
        }

        // Try to parse mxfile format
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(xml, 'text/xml');

            // Check for parsing errors
            const parseError = doc.querySelector('parsererror');
            if (parseError) {
                return '';
            }

            // Look for embedded SVG in mxfile
            const svgElement = doc.querySelector('svg');
            if (svgElement) {
                return new XMLSerializer().serializeToString(svgElement);
            }

            // Draw.io stores diagrams in compressed format
            // Full SVG rendering requires the mxGraph library
            // For now, we show a placeholder and render in the editor
        } catch (e) {
            Debug.warn('Failed to parse draw.io XML:', e);
        }

        return '';
    },

    /**
     * Initialize draw.io event listeners.
     * Called during app initialization.
     */
    initDrawioListeners() {
        // Listen for edit requests from rendered diagrams
        window.addEventListener('drawio-edit', (e) => {
            const drawioId = e.detail;
            this.openDrawioEditor(drawioId);
        });

        Debug.log('Draw.io listeners initialized');
    },

    /**
     * Open the draw.io editor modal for a diagram.
     * @param {string} drawioId - ID of the diagram to edit
     */
    openDrawioEditor(drawioId) {
        // Only allow editing in edit mode for panes
        const activePane = this.activePane;
        if (activePane && activePane.viewMode !== 'edit' && activePane.viewMode !== 'split') {
            this.addToast('Switch to Edit or Split mode to modify diagrams', 'info');
            return;
        }

        // Find the wrapper and get XML
        const wrapper = document.querySelector(`.drawio-wrapper[data-drawio-id="${drawioId}"]`);
        if (!wrapper) {
            Debug.error('Draw.io wrapper not found:', drawioId);
            return;
        }

        const xml = wrapper.dataset.originalXml || '';
        const name = wrapper.dataset.diagramName || '';

        this.drawioModalData = { drawioId, xml, name };
        this.showDrawioModal = true;
        this._drawioLoaded = false;

        // Initialize iframe after modal is visible
        this.$nextTick(() => {
            this.initDrawioIframe();
        });

        Debug.log('Opening draw.io editor for diagram:', drawioId);
    },

    /**
     * Initialize the draw.io iframe with postMessage API.
     */
    initDrawioIframe() {
        const container = document.getElementById('drawio-iframe-container');
        if (!container || !this.drawioModalData) return;

        // Determine theme
        const isDark = typeof this.getThemeType === 'function' && this.getThemeType() === 'dark';
        const uiTheme = isDark ? 'dark' : 'kennedy';

        // Build iframe URL with configuration
        const params = new URLSearchParams({
            embed: '1',
            proto: 'json',
            spin: '1',
            modified: 'unsavedChanges',
            ui: uiTheme,
            noSaveBtn: '0',
            saveAndExit: '1',
            noExitBtn: '0',
        });

        const iframe = document.createElement('iframe');
        iframe.id = 'drawio-editor-iframe';
        iframe.src = `https://embed.diagrams.net/?${params.toString()}`;
        iframe.className = 'drawio-iframe';
        iframe.setAttribute('frameborder', '0');

        container.innerHTML = '';
        container.appendChild(iframe);

        this._drawioIframe = iframe;

        // Setup message handler
        this._drawioMessageHandler = this.handleDrawioMessage.bind(this);
        window.addEventListener('message', this._drawioMessageHandler);

        // Set timeout for loading
        this._drawioLoadTimeout = setTimeout(() => {
            if (this.showDrawioModal && !this._drawioLoaded) {
                this.addToast('Draw.io editor is taking longer than expected to load', 'warning');
            }
        }, 30000);

        Debug.log('Draw.io iframe initialized');
    },

    /**
     * Handle postMessage events from draw.io iframe.
     * @param {MessageEvent} event - Message event from iframe
     */
    handleDrawioMessage(event) {
        // Only handle messages from diagrams.net
        if (!event.origin.includes('diagrams.net') && !event.origin.includes('draw.io')) {
            return;
        }

        if (!event.data || typeof event.data !== 'string') return;

        try {
            const msg = JSON.parse(event.data);

            switch (msg.event) {
                case 'init':
                    // Editor ready - load the diagram
                    this._drawioLoaded = true;
                    if (this._drawioLoadTimeout) {
                        clearTimeout(this._drawioLoadTimeout);
                        this._drawioLoadTimeout = null;
                    }
                    this.loadDiagramIntoEditor();
                    break;

                case 'save':
                    // User clicked save (or Save & Exit)
                    this.saveDrawioDiagram(msg.xml);
                    // If this was "Save & Exit", close after SVG export
                    if (msg.exit) {
                        this._closeAfterSvgExport = true;
                    }
                    break;

                case 'exit':
                    // User clicked exit
                    if (msg.modified) {
                        // Ask to save changes
                        if (confirm('Save changes before closing?')) {
                            // Request export to get final XML
                            this.requestXmlExport();
                            return;
                        }
                    }
                    this.closeDrawioEditor();
                    break;

                case 'export':
                    // Export response (for save on exit or SVG preview)
                    if (msg.format === 'xml' && msg.data) {
                        this.saveDrawioDiagram(msg.data);
                        // Request SVG for preview before closing
                        this._closeAfterSvgExport = true;
                        this.requestSvgExport();
                    } else if (msg.format === 'svg' && msg.data) {
                        // SVG export received - update preview
                        this.updateDrawioPreviewSvg(msg.data);
                        if (this._closeAfterSvgExport) {
                            this._closeAfterSvgExport = false;
                            this.closeDrawioEditor();
                        }
                        this._pendingSvgExport = false;
                    }
                    break;

                case 'autosave':
                    // Autosave event - update XML
                    if (msg.xml) {
                        this.saveDrawioDiagram(msg.xml);
                    }
                    break;
            }
        } catch (e) {
            // Not JSON or parse error, ignore
        }
    },

    /**
     * Load the diagram XML into the iframe editor.
     */
    loadDiagramIntoEditor() {
        if (!this._drawioIframe || !this.drawioModalData) return;

        const xml = this.drawioModalData.xml || '';

        // Default empty diagram if no content
        const defaultXml = '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel>';

        // Send load message to iframe
        const msg = {
            action: 'load',
            xml: xml || defaultXml,
            autosave: 1
        };

        this._drawioIframe.contentWindow.postMessage(JSON.stringify(msg), '*');
        Debug.log('Diagram loaded into editor');
    },

    /**
     * Request XML export from the editor.
     */
    requestXmlExport() {
        if (!this._drawioIframe) return;

        const msg = {
            action: 'export',
            format: 'xml'
        };

        this._drawioIframe.contentWindow.postMessage(JSON.stringify(msg), '*');
    },

    /**
     * Save the diagram XML back to markdown.
     * @param {string} xml - Updated diagram XML
     */
    saveDrawioDiagram(xml) {
        if (!this.drawioModalData) return;

        const { drawioId, name } = this.drawioModalData;

        // Update wrapper data attribute
        const wrapper = document.querySelector(`.drawio-wrapper[data-drawio-id="${drawioId}"]`);
        if (wrapper) {
            wrapper.dataset.originalXml = xml;
        }

        // Update markdown source
        this.updateDrawioInEditor(drawioId, xml, name);

        // Request SVG export for preview (non-blocking)
        if (!this._pendingSvgExport) {
            this._pendingSvgExport = true;
            this.requestSvgExport();
        }

        this.addToast('Diagram saved', 'success');
        Debug.log('Draw.io diagram saved:', drawioId);
    },

    /**
     * Request SVG export from the editor for preview.
     */
    requestSvgExport() {
        if (!this._drawioIframe) return;

        const msg = {
            action: 'export',
            format: 'svg',
            spinKey: 'svg-export'
        };

        this._drawioIframe.contentWindow.postMessage(JSON.stringify(msg), '*');
        Debug.log('Requested SVG export for preview');
    },

    /**
     * Update the diagram preview with SVG content.
     * @param {string} svg - SVG content from draw.io export (raw SVG or data URL)
     */
    updateDrawioPreviewSvg(svg) {
        if (!this.drawioModalData || !svg) return;

        const { drawioId } = this.drawioModalData;
        const wrapper = document.querySelector(`.drawio-wrapper[data-drawio-id="${drawioId}"]`);

        if (!wrapper) {
            Debug.warn('Could not find wrapper to update SVG preview');
            return;
        }

        const xml = wrapper.dataset.originalXml;

        // Handle data URL format (base64 encoded SVG)
        // draw.io may return various formats like:
        // - data:image/svg+xml;base64,...
        // - data:image/svg+xml;charset=utf-8;base64,...
        let svgContent = svg;
        if (svg.startsWith('data:image/svg+xml')) {
            try {
                // Find the comma separator and decode everything after it
                const commaIndex = svg.indexOf(',');
                if (commaIndex !== -1) {
                    const base64 = svg.substring(commaIndex + 1);
                    svgContent = atob(base64);
                    Debug.log('Decoded base64 SVG from data URL');
                }
            } catch (e) {
                Debug.warn('Failed to decode base64 SVG:', e);
            }
        }

        // Save SVG to backend cache (async, non-blocking)
        if (xml) {
            this.saveSvgToCache(xml, svgContent).catch(e => {
                Debug.warn('Failed to save SVG to cache:', e);
            });
        }

        // Store SVG in data attribute for session caching
        wrapper.dataset.svgPreview = svgContent;

        // Update the preview container
        const previewDiv = wrapper.querySelector('.drawio-preview');
        if (previewDiv) {
            // Create SVG container with the exported SVG
            const svgContainer = document.createElement('div');
            svgContainer.className = 'drawio-svg-container';
            svgContainer.innerHTML = svgContent;

            // Make SVG responsive
            const svgElement = svgContainer.querySelector('svg');
            if (svgElement) {
                svgElement.style.width = '100%';
                svgElement.style.height = 'auto';
                svgElement.style.maxHeight = '400px';
            }

            previewDiv.innerHTML = '';
            previewDiv.appendChild(svgContainer);
        }

        Debug.log('Updated diagram preview with SVG');
    },

    /**
     * Update the drawio code block in the markdown source.
     * @param {string} drawioId - Diagram ID
     * @param {string} newXml - Updated XML content
     * @param {string} name - Diagram name
     */
    updateDrawioInEditor(drawioId, newXml, name) {
        // Get editor content from active pane or legacy
        let content = '';
        if (this.activePane && this.activePane.editorView) {
            content = this.activePane.content || '';
        } else if (this.editorView) {
            content = this.getEditorContent ? this.getEditorContent() : '';
        } else if (this.noteContent) {
            content = this.noteContent;
        }

        if (!content) {
            Debug.warn('Cannot sync drawio to editor: no content available');
            return;
        }

        // Match drawio code blocks with optional metadata
        const regex = /```+[ \t]*drawio([^\r\n]*)?\r?\n([\s\S]*?)\r?\n?```+/g;
        let match;
        let currentId = 0;
        let result = content;
        let offset = 0;

        // Create a copy of regex for iteration
        const iterRegex = new RegExp(regex.source, regex.flags);

        while ((match = iterRegex.exec(content)) !== null) {
            if (String(currentId) === String(drawioId)) {
                const meta = name ? ` name="${name}"` : (match[1] ? match[1] : '');
                const newBlock = '```drawio' + meta + '\n' + newXml + '\n```';
                const start = match.index + offset;
                const end = start + match[0].length;
                result = result.substring(0, match.index) + newBlock + result.substring(match.index + match[0].length);
                offset += newBlock.length - match[0].length;
                break;
            }
            currentId++;
        }

        if (result !== content) {
            this._skipDrawioRender = true;

            // Update content through appropriate channel
            if (this.activePane) {
                this.activePane.content = result;
                this.activePane.isDirty = true;
                if (this.activePane.editorView && typeof this.updateEditorContent === 'function') {
                    this.updateEditorContent(result);
                }
            } else {
                this.noteContent = result;
                if (typeof this.updateEditorContent === 'function') {
                    this.updateEditorContent(result);
                }
            }

            requestAnimationFrame(() => {
                this._skipDrawioRender = false;
            });

            Debug.log(`Draw.io #${drawioId} synced to editor`);
        }
    },

    /**
     * Close the draw.io editor modal and cleanup.
     */
    closeDrawioEditor() {
        this.showDrawioModal = false;
        this.drawioModalData = null;
        this._drawioLoaded = false;
        this._pendingSvgExport = false;
        this._closeAfterSvgExport = false;
        this.releaseFocus();

        // Clear timeout
        if (this._drawioLoadTimeout) {
            clearTimeout(this._drawioLoadTimeout);
            this._drawioLoadTimeout = null;
        }

        // Cleanup message handler
        if (this._drawioMessageHandler) {
            window.removeEventListener('message', this._drawioMessageHandler);
            this._drawioMessageHandler = null;
        }

        // Clear iframe container
        const container = document.getElementById('drawio-iframe-container');
        if (container) {
            container.innerHTML = '';
        }

        // Clear iframe reference
        this._drawioIframe = null;

        Debug.log('Draw.io editor closed');
    },

    /**
     * Cleanup draw.io instances on note change.
     */
    cleanupDrawio() {
        this.closeDrawioEditor();
        this.drawioInstances = {};
        this._drawioIdCounter = 0;
        Debug.log('Draw.io instances cleaned up');
    },
};
