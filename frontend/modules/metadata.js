// Granite Frontend - Metadata (Frontmatter) Module

import { Debug } from './config.js';
import { normalizeTags } from './tags.js';

export const metadataMixin = {
    // Parse YAML frontmatter metadata from note content
    parseMetadata() {
        if (!this.noteContent) {
            this.noteMetadata = null;
            this._lastFrontmatter = null;
            return;
        }

        const content = this.noteContent;

        if (!content.trim().startsWith('---')) {
            this.noteMetadata = null;
            this._lastFrontmatter = null;
            return;
        }

        try {
            const lines = content.split('\n');
            if (lines[0].trim() !== '---') {
                this.noteMetadata = null;
                this._lastFrontmatter = null;
                return;
            }

            let endIdx = -1;
            for (let i = 1; i < lines.length; i++) {
                if (lines[i].trim() === '---') {
                    endIdx = i;
                    break;
                }
            }

            if (endIdx === -1) {
                this.noteMetadata = null;
                this._lastFrontmatter = null;
                return;
            }

            // Performance optimization: skip if frontmatter unchanged
            const frontmatterRaw = lines.slice(0, endIdx + 1).join('\n');
            if (frontmatterRaw === this._lastFrontmatter) {
                return;
            }
            this._lastFrontmatter = frontmatterRaw;

            const frontmatterLines = lines.slice(1, endIdx);
            const metadata = {};
            let currentKey = null;
            let currentValue = [];

            for (const line of frontmatterLines) {
                const keyMatch = line.match(/^([a-zA-Z_][\w-]*):\s*(.*)$/);

                if (keyMatch) {
                    if (currentKey) {
                        metadata[currentKey] = this.parseYamlValue(currentValue.join('\n'));
                    }
                    currentKey = keyMatch[1];
                    const value = keyMatch[2].trim();
                    currentValue = [value];
                } else if (line.match(/^\s+-\s+/) && currentKey) {
                    currentValue.push(line);
                } else if (line.startsWith('  ') && currentKey) {
                    currentValue.push(line);
                }
            }

            if (currentKey) {
                metadata[currentKey] = this.parseYamlValue(currentValue.join('\n'));
            }

            this.noteMetadata = Object.keys(metadata).length > 0 ? metadata : null;

        } catch (error) {
            Debug.error('Failed to parse frontmatter:', error);
            this.noteMetadata = null;
            this._lastFrontmatter = null;
        }
    },

    // Parse a YAML value (handles arrays, strings, numbers, booleans)
    parseYamlValue(value) {
        if (!value || value.trim() === '') return null;

        value = value.trim();

        // Inline array: [item1, item2]
        if (value.startsWith('[') && value.endsWith(']')) {
            const inner = value.slice(1, -1);
            return inner.split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(s => s);
        }

        // YAML list format
        if (value.includes('\n  -') || value.startsWith('  -')) {
            const items = [];
            const lines = value.split('\n');
            for (const line of lines) {
                const match = line.match(/^\s*-\s*(.+)$/);
                if (match) {
                    items.push(match[1].trim().replace(/^["']|["']$/g, ''));
                }
            }
            return items.length > 0 ? items : value;
        }

        // Boolean
        if (value.toLowerCase() === 'true') return true;
        if (value.toLowerCase() === 'false') return false;

        // Number
        if (/^-?\d+(\.\d+)?$/.test(value)) {
            return parseFloat(value);
        }

        // String (remove quotes if present)
        return value.replace(/^["']|["']$/g, '');
    },

    // Format metadata value for display
    formatMetadataValue(key, value) {
        if (value === null || value === undefined) return '';

        if (Array.isArray(value)) return value;

        // Format dates nicely
        if (key === 'date' || key === 'created' || key === 'modified' || key === 'updated') {
            let date;
            if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
                const [year, month, day] = value.split('-').map(Number);
                date = new Date(year, month - 1, day);
            } else {
                date = new Date(value);
            }
            if (!isNaN(date.getTime())) {
                return date.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                });
            }
        }

        // Booleans
        if (typeof value === 'boolean') {
            return value ? '✓ Yes' : '✗ No';
        }

        return String(value);
    },

    // Format metadata value as HTML (for URL support)
    formatMetadataValueHtml(key, value) {
        const formatted = this.formatMetadataValue(key, value);

        if (this.isUrl(formatted)) {
            const escaped = this.escapeHtml(formatted);
            const displayUrl = formatted.length > 40
                ? formatted.substring(0, 37) + '...'
                : formatted;
            return `<a href="${escaped}" target="_blank" rel="noopener noreferrer" class="metadata-link">${this.escapeHtml(displayUrl)}</a>`;
        }

        return this.escapeHtml(formatted);
    },

    // Get priority metadata fields (shown in collapsed view)
    getPriorityMetadataFields() {
        if (!this.noteMetadata) return [];

        const priority = ['date', 'created', 'author', 'status', 'priority', 'type', 'category'];
        const fields = [];

        for (const key of priority) {
            if (this.noteMetadata[key] !== undefined && !Array.isArray(this.noteMetadata[key])) {
                const formatted = this.formatMetadataValue(key, this.noteMetadata[key]);
                const isUrl = this.isUrl(formatted);
                fields.push({
                    key,
                    value: formatted,
                    valueHtml: isUrl ? this.formatMetadataValueHtml(key, this.noteMetadata[key]) : this.escapeHtml(formatted),
                    isUrl
                });
            }
        }

        return fields.slice(0, 3);
    },

    // Get all metadata fields except tags (for expanded view)
    getAllMetadataFields() {
        if (!this.noteMetadata) return [];

        return Object.entries(this.noteMetadata)
            .filter(([key]) => key !== 'tags')
            .map(([key, value]) => {
                const isArray = Array.isArray(value);
                const formatted = this.formatMetadataValue(key, value);
                const isUrl = !isArray && this.isUrl(formatted);
                return {
                    key,
                    value: formatted,
                    valueHtml: isUrl ? this.formatMetadataValueHtml(key, value) : this.escapeHtml(formatted),
                    isArray,
                    isUrl
                };
            });
    },

    // Check if note has any displayable metadata
    getHasMetadata() {
        return this.noteMetadata && Object.keys(this.noteMetadata).length > 0;
    },

    // Get tags from metadata
    getMetadataTags() {
        if (!this.noteMetadata || !this.noteMetadata.tags) return [];
        return normalizeTags(this.noteMetadata.tags);
    },
};
