// Granite Frontend - Note Statistics Module

export const statsMixin = {
    // Calculate note statistics (client-side)
    calculateStats() {
        if (!this.statsPluginEnabled || !this.noteContent) {
            this.noteStats = null;
            return;
        }

        const content = this.noteContent;

        // Word count
        const words = (content.match(/\S+/g) || []).length;

        // Character count
        const chars = content.replace(/\s/g, '').length;
        const totalChars = content.length;

        // Reading time (200 words per minute)
        const readingTime = Math.max(1, Math.round(words / 200));

        // Line count
        const lines = content.split('\n').length;

        // Paragraph count
        const paragraphs = content.split('\n\n').filter(p => p.trim()).length;

        // Sentences
        const sentences = (content.match(/[.!?]+(?:\s|$)/g) || []).length;

        // List items (excluding tasks)
        const listItems = (content.match(/^\s*(?:[-*+]|\d+\.)\s+(?!\[)/gm) || []).length;

        // Tables (markdown separator rows)
        const tables = (content.match(/^\s*\|(?:\s*:?-+:?\s*\|){1,}\s*$/gm) || []).length;

        // Markdown links
        const markdownLinkMatches = content.match(/\[([^\]]+)\]\(([^\)]+)\)/g) || [];
        const markdownLinks = markdownLinkMatches.length;
        const markdownInternalLinks = markdownLinkMatches.filter(l => l.includes('.md')).length;

        // Wikilinks
        const wikilinks = (content.match(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g) || []).length;

        // Total links
        const links = markdownLinks + wikilinks;
        const internalLinks = markdownInternalLinks + wikilinks;

        // Code blocks
        const codeBlocks = (content.match(/```[\s\S]*?```/g) || []).length;
        const inlineCode = (content.match(/`[^`]+`/g) || []).length;

        // Headings
        const h1 = (content.match(/^# /gm) || []).length;
        const h2 = (content.match(/^## /gm) || []).length;
        const h3 = (content.match(/^### /gm) || []).length;

        // Tasks
        const totalTasks = (content.match(/- \[[ x]\]/gi) || []).length;
        const completedTasks = (content.match(/- \[x\]/gi) || []).length;
        const pendingTasks = totalTasks - completedTasks;
        const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

        // Images
        const images = (content.match(/!\[([^\]]*)\]\(([^\)]+)\)/g) || []).length;

        // Blockquotes
        const blockquotes = (content.match(/^> /gm) || []).length;

        this.noteStats = {
            words,
            sentences,
            characters: chars,
            total_characters: totalChars,
            reading_time_minutes: readingTime,
            lines,
            paragraphs,
            list_items: listItems,
            tables,
            links,
            internal_links: internalLinks,
            external_links: links - internalLinks,
            wikilinks,
            code_blocks: codeBlocks,
            inline_code: inlineCode,
            headings: {
                h1,
                h2,
                h3,
                total: h1 + h2 + h3
            },
            tasks: {
                total: totalTasks,
                completed: completedTasks,
                pending: pendingTasks,
                completion_rate: completionRate
            },
            images,
            blockquotes
        };
    },
};
