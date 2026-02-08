// Granite Frontend - Markdown Rendering Module

import { CONFIG, Debug } from './config.js';

export const markdownMixin = {
    get renderedMarkdown() {
        if (!this.noteContent) return '<p style="color: var(--text-tertiary);">Nothing to preview yet...</p>';
        if (typeof this.parseBannerFromContent !== 'function') return '';
        if (!this.notes) return '';

        const bannerInfo = this.parseBannerFromContent(this.noteContent);

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
                    return `<img src="/api/images/${encodedPath}" alt="${safeAlt}" title="${safeAlt}" loading="lazy" />`;
                } else {
                    const safeTarget = imageTarget.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                    return `<span class="wikilink-broken" title="Image not found">![[${safeTarget}]]</span>`;
                }
            }
        );

        const notes = this.notes;
        const allFolders = this.allFolders || [];
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

                const folderExists = allFolders.some(f => {
                    const folderLower = f.toLowerCase();
                    const folderName = f.split('/').pop();
                    const folderNameLower = folderName.toLowerCase();
                    return (
                        f === linkTarget ||
                        folderLower === linkTargetLower ||
                        folderName === linkTarget ||
                        folderNameLower === linkTargetLower ||
                        f.endsWith('/' + linkTarget) ||
                        folderLower.endsWith('/' + linkTargetLower)
                    );
                });

                const safeHref = linkTarget.replace(/"/g, '%22');
                const safeText = linkText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                const linkExists = noteExists || folderExists;
                const brokenClass = linkExists ? '' : ' class="wikilink-broken"';
                const folderAttr = (folderExists && !noteExists) ? ' data-folder-link="true"' : '';
                return `<a href="${safeHref}"${brokenClass} data-wikilink="true"${folderAttr}>${safeText}</a>`;
            }
        );

        marked.setOptions({
            breaks: true,
            gfm: true,
            highlight: function(code, lang) {
                if (lang && hljs.getLanguage(lang)) {
                    try {
                        return hljs.highlight(code, { language: lang }).value;
                    } catch (err) {
                        Debug.error('Highlight error:', err);
                    }
                }
                return hljs.highlightAuto(code).value;
            }
        });

        let html = marked.parse(contentToRender);

        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;

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

            img.setAttribute('loading', 'lazy');
        });

        html = tempDiv.innerHTML;

        // Transform spreadsheet blocks inline before returning HTML
        // This ensures wrappers are part of the HTML Alpine sets, not added after
        if (typeof this.transformSpreadsheetHtml === 'function') {
            html = this.transformSpreadsheetHtml(html);
        }

        // Transform draw.io diagram blocks
        if (typeof this.transformDrawioHtml === 'function') {
            html = this.transformDrawioHtml(html);
        }

        this.typesetMath();
        this.renderMermaid();

        setTimeout(() => {
            const previewEl = this._domCache.previewContent || document.querySelector('.markdown-preview');
            if (previewEl) {
                // Exclude mermaid, spreadsheet, and drawio blocks from syntax highlighting
                previewEl.querySelectorAll('pre code:not(.language-mermaid):not(.language-spreadsheet):not(.language-drawio)').forEach((block) => {
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

    get renderedHomepageContent() {
        if (!this.homepageContent) return '';
        if (typeof this.parseBannerFromContent !== 'function') return '';
        if (!this.notes) return '';

        const bannerInfo = this.parseBannerFromContent(this.homepageContent);

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
                    return `<img src="/api/images/${encodedPath}" alt="${safeAlt}" title="${safeAlt}" loading="lazy" />`;
                } else {
                    const safeTarget = imageTarget.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                    return `<span class="wikilink-broken" title="Image not found">![[${safeTarget}]]</span>`;
                }
            }
        );

        const notes = this.notes;
        const allFolders = this.allFolders || [];
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

                const folderExists = allFolders.some(f => {
                    const folderLower = f.toLowerCase();
                    const folderName = f.split('/').pop();
                    const folderNameLower = folderName.toLowerCase();
                    return (
                        f === linkTarget ||
                        folderLower === linkTargetLower ||
                        folderName === linkTarget ||
                        folderNameLower === linkTargetLower ||
                        f.endsWith('/' + linkTarget) ||
                        folderLower.endsWith('/' + linkTargetLower)
                    );
                });

                const safeHref = linkTarget.replace(/"/g, '%22');
                const safeText = linkText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                const linkExists = noteExists || folderExists;
                const brokenClass = linkExists ? '' : ' class="wikilink-broken"';
                const folderAttr = (folderExists && !noteExists) ? ' data-folder-link="true"' : '';
                return `<a href="${safeHref}"${brokenClass} data-wikilink="true"${folderAttr}>${safeText}</a>`;
            }
        );

        marked.setOptions({
            breaks: true,
            gfm: true,
            highlight: function(code, lang) {
                if (lang && hljs.getLanguage(lang)) {
                    try {
                        return hljs.highlight(code, { language: lang }).value;
                    } catch (err) {
                        Debug.error('Highlight error:', err);
                    }
                }
                return hljs.highlightAuto(code).value;
            }
        });

        let html = marked.parse(contentToRender);

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

    typesetMath() {
        if (typeof MathJax !== 'undefined' && MathJax.typesetPromise) {
            setTimeout(() => {
                // Query all markdown preview elements (homepage content + note preview)
                const previewElements = document.querySelectorAll('.markdown-preview');
                if (previewElements.length > 0) {
                    MathJax.typesetPromise([...previewElements]).catch((err) => {
                        Debug.error('MathJax typesetting failed:', err);
                    });
                }
            }, 10);
        }
    },

    async renderMermaid() {
        if (typeof window.mermaid === 'undefined') {
            Debug.warn('Mermaid not loaded yet');
            return;
        }

        requestAnimationFrame(async () => {
            // Query all markdown preview elements (homepage content + note preview)
            const previewElements = document.querySelectorAll('.markdown-preview');
            if (previewElements.length === 0) return;

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

            let blockIndex = 0;
            for (const previewContent of previewElements) {
                const mermaidBlocks = previewContent.querySelectorAll('pre code.language-mermaid');
                if (mermaidBlocks.length === 0) continue;

                for (let i = 0; i < mermaidBlocks.length; i++) {
                    const block = mermaidBlocks[i];
                    const pre = block.parentElement;

                    // Skip if structure is missing (can happen if another renderer already replaced it)
                    if (!pre || !pre.parentElement) continue;

                    if (pre.querySelector('.mermaid-rendered')) continue;

                    try {
                        const code = block.textContent;
                        const id = `mermaid-diagram-${Date.now()}-${blockIndex++}`;
                        const { svg } = await window.mermaid.render(id, code);

                        const container = document.createElement('div');
                        container.className = 'mermaid-rendered';
                        container.style.cssText = 'background-color: transparent; padding: 20px; text-align: center; overflow-x: auto;';
                        container.innerHTML = svg;
                        container.dataset.originalCode = code;

                        // Re-check parent right before replacing (may have been detached by another renderer)
                        const currentParent = pre.parentElement;
                        if (currentParent) {
                            currentParent.replaceChild(container, pre);
                        }
                    } catch (error) {
                        Debug.error('Mermaid rendering error:', error);
                        const errorMsg = document.createElement('div');
                        errorMsg.style.cssText = 'color: var(--error); padding: 10px; border-left: 3px solid var(--error); margin-top: 10px;';
                        errorMsg.textContent = `⚠️ Mermaid diagram error: ${error.message}`;
                        const currentParent = pre.parentElement;
                        if (currentParent) {
                            currentParent.insertBefore(errorMsg, pre.nextSibling);
                        }
                    }
                }
            }
        });
    },

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
                Debug.error('Failed to copy code:', err);
            }
        });

        preElement.appendChild(button);
    },
};
