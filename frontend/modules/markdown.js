// Granite Frontend - Markdown Rendering Module

import { CONFIG } from './config.js';

export const markdownMixin = {
    // Computed property for rendered markdown (defensive for spread operation)
    get renderedMarkdown() {
        if (!this.noteContent) return '<p style="color: var(--text-tertiary);">Nothing to preview yet...</p>';
        // Guard against spread operation - methods from other mixins won't exist yet
        if (typeof this.parseBannerFromContent !== 'function') return '';
        if (!this.notes) return '';

        // Parse banner from frontmatter before stripping it
        const bannerInfo = this.parseBannerFromContent(this.noteContent);

        // Strip YAML frontmatter from content before rendering
        let contentToRender = this.noteContent;
        if (contentToRender.trim().startsWith('---')) {
            const lines = contentToRender.split('\n');
            if (lines[0].trim() === '---') {
                let endIdx = -1;
                for (let i = 1; i < lines.length; i++) {
                    if (lines[i].trim() === '---') {
                        endIdx = i;
                        break;
                    }
                }
                if (endIdx !== -1) {
                    contentToRender = lines.slice(endIdx + 1).join('\n').trim();
                }
            }
        }

        // Convert Obsidian-style image embeds
        const allImages = this.notes.filter(n => n.type === 'image');
        contentToRender = contentToRender.replace(
            /!\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
            (match, target, altText) => {
                const imageTarget = target.trim();
                const imageAlt = altText ? altText.trim() : imageTarget;
                const imageTargetLower = imageTarget.toLowerCase();

                const foundImage = allImages.find(img => {
                    const nameLower = img.name.toLowerCase();
                    return (
                        img.name === imageTarget ||
                        nameLower === imageTargetLower ||
                        img.path === imageTarget ||
                        img.path.toLowerCase() === imageTargetLower
                    );
                });

                if (foundImage) {
                    const encodedPath = foundImage.path.split('/').map(segment => encodeURIComponent(segment)).join('/');
                    const safeAlt = imageAlt.replace(/"/g, '&quot;').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                    return `<img src="/api/images/${encodedPath}" alt="${safeAlt}" title="${safeAlt}" />`;
                } else {
                    const safeTarget = imageTarget.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                    return `<span class="wikilink-broken" title="Image not found">![[${safeTarget}]]</span>`;
                }
            }
        );

        // Convert Obsidian-style wikilinks
        const notes = this.notes;
        contentToRender = contentToRender.replace(
            /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
            (match, target, displayText) => {
                const linkTarget = target.trim();
                const linkText = displayText ? displayText.trim() : linkTarget;
                const linkTargetLower = linkTarget.toLowerCase();

                const noteExists = notes.some(n => {
                    const pathLower = n.path.toLowerCase();
                    const nameLower = n.name.toLowerCase();
                    return (
                        n.path === linkTarget ||
                        n.path === linkTarget + '.md' ||
                        pathLower === linkTargetLower ||
                        pathLower === linkTargetLower + '.md' ||
                        n.name === linkTarget ||
                        n.name === linkTarget + '.md' ||
                        nameLower === linkTargetLower ||
                        nameLower === linkTargetLower + '.md' ||
                        n.path.endsWith('/' + linkTarget) ||
                        n.path.endsWith('/' + linkTarget + '.md') ||
                        pathLower.endsWith('/' + linkTargetLower) ||
                        pathLower.endsWith('/' + linkTargetLower + '.md')
                    );
                });

                const safeHref = linkTarget.replace(/"/g, '%22');
                const safeText = linkText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                const brokenClass = noteExists ? '' : ' class="wikilink-broken"';
                return `<a href="${safeHref}"${brokenClass} data-wikilink="true">${safeText}</a>`;
            }
        );

        // Configure marked
        marked.setOptions({
            breaks: true,
            gfm: true,
            highlight: function(code, lang) {
                if (lang && hljs.getLanguage(lang)) {
                    try {
                        return hljs.highlight(code, { language: lang }).value;
                    } catch (err) {
                        console.error('Highlight error:', err);
                    }
                }
                return hljs.highlightAuto(code).value;
            }
        });

        // Parse markdown
        let html = marked.parse(contentToRender);

        // Post-process HTML
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;

        // Add target="_blank" to external links
        const links = tempDiv.querySelectorAll('a');
        links.forEach(link => {
            const href = link.getAttribute('href');
            if (href && typeof href === 'string') {
                const isExternal = href.indexOf('http://') === 0 ||
                                  href.indexOf('https://') === 0 ||
                                  href.indexOf('//') === 0;

                if (isExternal) {
                    link.setAttribute('target', '_blank');
                    link.setAttribute('rel', 'noopener noreferrer');
                }
            }
        });

        // Transform relative image paths
        const images = tempDiv.querySelectorAll('img');
        images.forEach(img => {
            const src = img.getAttribute('src');
            if (src) {
                if (!src.startsWith('http://') && !src.startsWith('https://') &&
                    !src.startsWith('//') && !src.startsWith('/api/images/') &&
                    !src.startsWith('data:')) {

                    let imagePath = src;

                    if (!src.startsWith('/')) {
                        const currentNoteFolder = this.currentNote ?
                            (this.currentNote.includes('/') ? this.currentNote.substring(0, this.currentNote.lastIndexOf('/')) : '')
                            : '';

                        if (currentNoteFolder) {
                            imagePath = `${currentNoteFolder}/${src}`;
                        }
                    } else {
                        imagePath = src.substring(1);
                    }

                    const encodedPath = imagePath.split('/').map(segment => encodeURIComponent(segment)).join('/');
                    img.setAttribute('src', `/api/images/${encodedPath}`);
                }
            }

            const altText = img.getAttribute('alt');
            if (altText) {
                img.setAttribute('title', altText);
            }
        });

        html = tempDiv.innerHTML;

        // Trigger MathJax and Mermaid rendering
        this.typesetMath();
        this.renderMermaid();

        // Apply syntax highlighting and add copy buttons
        setTimeout(() => {
            const previewEl = this._domCache.previewContent || document.querySelector('.markdown-preview');
            if (previewEl) {
                previewEl.querySelectorAll('pre code:not(.language-mermaid)').forEach((block) => {
                    if (!block.classList.contains('hljs')) {
                        hljs.highlightElement(block);
                    }

                    const pre = block.parentElement;
                    if (pre && !pre.querySelector('.copy-code-button')) {
                        this.addCopyButtonToCodeBlock(pre);
                    }
                });
            }

            this.extractTocHeadings();
        }, 0);

        // Prepend banner if present
        if (bannerInfo && bannerInfo.url) {
            const safeUrl = bannerInfo.url.replace(/"/g, '%22');
            const opacity = this.bannerOpacity;

            let titleHtml = '';
            const h1Match = html.match(/<h1[^>]*>(.*?)<\/h1>/i);
            if (h1Match) {
                const titleText = h1Match[1];
                titleHtml = `<h1 class="banner-title">${titleText}</h1>`;
                html = html.replace(h1Match[0], '');
            }

            const bannerHtml = `<div class="note-banner"><div class="banner-image" style="background-image: url('${safeUrl}'); opacity: ${opacity}"></div>${titleHtml}</div>`;
            html = bannerHtml + html;
        }

        return html;
    },

    // Computed property for rendered homepage content
    get renderedHomepageContent() {
        if (!this.homepageContent) return '';
        if (typeof this.parseBannerFromContent !== 'function') return '';

        // Parse banner from frontmatter before stripping it
        const bannerInfo = this.parseBannerFromContent(this.homepageContent);

        // Strip YAML frontmatter from content before rendering
        let contentToRender = this.homepageContent;
        if (contentToRender.trim().startsWith('---')) {
            const lines = contentToRender.split('\n');
            if (lines[0].trim() === '---') {
                let endIdx = -1;
                for (let i = 1; i < lines.length; i++) {
                    if (lines[i].trim() === '---') {
                        endIdx = i;
                        break;
                    }
                }
                if (endIdx !== -1) {
                    contentToRender = lines.slice(endIdx + 1).join('\n').trim();
                }
            }
        }

        // Configure marked
        marked.setOptions({
            breaks: true,
            gfm: true,
            highlight: function(code, lang) {
                if (lang && hljs.getLanguage(lang)) {
                    try {
                        return hljs.highlight(code, { language: lang }).value;
                    } catch (err) {
                        console.error('Highlight error:', err);
                    }
                }
                return hljs.highlightAuto(code).value;
            }
        });

        let html = marked.parse(contentToRender);

        // Prepend banner if present
        if (bannerInfo && bannerInfo.url) {
            const safeUrl = bannerInfo.url.replace(/"/g, '%22');
            const opacity = this.bannerOpacity;

            let titleHtml = '';
            const h1Match = html.match(/<h1[^>]*>(.*?)<\/h1>/i);
            if (h1Match) {
                const titleText = h1Match[1];
                titleHtml = `<h1 class="banner-title">${titleText}</h1>`;
                html = html.replace(h1Match[0], '');
            }

            const bannerHtml = `<div class="note-banner"><div class="banner-image" style="background-image: url('${safeUrl}'); opacity: ${opacity}"></div>${titleHtml}</div>`;
            html = bannerHtml + html;
        }

        return html;
    },

    // Trigger MathJax typesetting after DOM update
    typesetMath() {
        if (typeof MathJax !== 'undefined' && MathJax.typesetPromise) {
            setTimeout(() => {
                const previewContent = document.querySelector('.markdown-preview');
                if (previewContent) {
                    MathJax.typesetPromise([previewContent]).catch((err) => {
                        console.error('MathJax typesetting failed:', err);
                    });
                }
            }, 10);
        }
    },

    // Render Mermaid diagrams
    async renderMermaid() {
        if (typeof window.mermaid === 'undefined') {
            console.warn('Mermaid not loaded yet');
            return;
        }

        requestAnimationFrame(async () => {
            const previewContent = document.querySelector('.markdown-preview');
            if (!previewContent) return;

            const themeType = this.getThemeType();
            const mermaidTheme = themeType === 'light' ? 'default' : 'dark';

            if (this.lastMermaidTheme !== mermaidTheme) {
                window.mermaid.initialize({
                    startOnLoad: false,
                    theme: mermaidTheme,
                    securityLevel: 'strict',
                    fontFamily: 'inherit',
                    flowchart: { useMaxWidth: true },
                    sequence: { useMaxWidth: true },
                    gantt: { useMaxWidth: true },
                    journey: { useMaxWidth: true },
                    timeline: { useMaxWidth: true },
                    class: { useMaxWidth: true },
                    state: { useMaxWidth: true },
                    er: { useMaxWidth: true },
                    pie: { useMaxWidth: true },
                    quadrantChart: { useMaxWidth: true },
                    requirement: { useMaxWidth: true },
                    mindmap: { useMaxWidth: true },
                    gitGraph: { useMaxWidth: true }
                });
                this.lastMermaidTheme = mermaidTheme;
            }

            const mermaidBlocks = previewContent.querySelectorAll('pre code.language-mermaid');
            if (mermaidBlocks.length === 0) return;

            for (let i = 0; i < mermaidBlocks.length; i++) {
                const block = mermaidBlocks[i];
                const pre = block.parentElement;

                if (pre.querySelector('.mermaid-rendered')) continue;

                try {
                    const code = block.textContent;
                    const id = `mermaid-diagram-${Date.now()}-${i}`;
                    const { svg } = await window.mermaid.render(id, code);

                    const container = document.createElement('div');
                    container.className = 'mermaid-rendered';
                    container.style.cssText = 'background-color: transparent; padding: 20px; text-align: center; overflow-x: auto;';
                    container.innerHTML = svg;
                    container.dataset.originalCode = code;

                    pre.parentElement.replaceChild(container, pre);
                } catch (error) {
                    console.error('Mermaid rendering error:', error);
                    const errorMsg = document.createElement('div');
                    errorMsg.style.cssText = 'color: var(--error); padding: 10px; border-left: 3px solid var(--error); margin-top: 10px;';
                    errorMsg.textContent = `⚠️ Mermaid diagram error: ${error.message}`;
                    pre.parentElement.insertBefore(errorMsg, pre.nextSibling);
                }
            }
        });
    },

    // Add copy button to code block
    addCopyButtonToCodeBlock(preElement) {
        const button = document.createElement('button');
        button.className = 'copy-code-button';
        button.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
        `;
        button.title = 'Copy to clipboard';

        button.style.position = 'absolute';
        button.style.top = '8px';
        button.style.right = '8px';
        button.style.padding = '6px';
        button.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
        button.style.border = 'none';
        button.style.borderRadius = '4px';
        button.style.cursor = 'pointer';
        button.style.opacity = '0';
        button.style.transition = 'opacity 0.2s, background-color 0.2s';
        button.style.color = 'white';
        button.style.display = 'flex';
        button.style.alignItems = 'center';
        button.style.justifyContent = 'center';
        button.style.zIndex = '10';

        preElement.style.position = 'relative';

        preElement.addEventListener('mouseenter', () => {
            button.style.opacity = '1';
        });

        preElement.addEventListener('mouseleave', () => {
            button.style.opacity = '0';
        });

        button.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();

            const codeElement = preElement.querySelector('code');
            if (!codeElement) return;

            const code = codeElement.textContent;

            try {
                await navigator.clipboard.writeText(code);

                button.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                `;
                button.style.backgroundColor = 'rgba(34, 197, 94, 0.8)';
                button.title = 'Copied!';

                setTimeout(() => {
                    button.innerHTML = `
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                    `;
                    button.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
                    button.title = 'Copy to clipboard';
                }, 2000);
            } catch (err) {
                console.error('Failed to copy code:', err);
            }
        });

        preElement.appendChild(button);
    },
};
