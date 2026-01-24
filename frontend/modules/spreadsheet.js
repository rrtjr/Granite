// Granite Frontend - Spreadsheet Module
// Provides Excel-like spreadsheet functionality within notes using code blocks

import { Debug } from './config.js';

export const spreadsheetMixin = {
    // State
    activeSpreadsheet: null,
    spreadsheetInstances: {},
    _spreadsheetIdCounter: 0,

    // Check if HyperFormula is loaded
    isHyperFormulaReady() {
        return typeof HyperFormula !== 'undefined';
    },

    // Parse CSV string to 2D array
    parseSpreadsheetCSV(csvText) {
        const lines = csvText.trim().split('\n');
        return lines.map(line => {
            const cells = [];
            let current = '';
            let inQuotes = false;

            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char === '"') {
                    if (inQuotes && line[i + 1] === '"') {
                        current += '"';
                        i++;
                    } else {
                        inQuotes = !inQuotes;
                    }
                } else if (char === ',' && !inQuotes) {
                    cells.push(current.trim());
                    current = '';
                } else {
                    current += char;
                }
            }
            cells.push(current.trim());
            return cells;
        });
    },

    // Convert 2D array back to CSV
    serializeSpreadsheetCSV(data) {
        return data.map(row =>
            row.map(cell => {
                const str = String(cell ?? '');
                if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                    return `"${str.replace(/"/g, '""')}"`;
                }
                return str;
            }).join(',')
        ).join('\n');
    },

    // Calculate values using HyperFormula
    evaluateSpreadsheet(data) {
        if (!this.isHyperFormulaReady()) {
            Debug.warn('HyperFormula not loaded, returning raw data. Check if CDN is accessible.');
            console.warn('[Spreadsheet] HyperFormula not loaded - formulas will display as text');
            return data;
        }

        try {
            const hf = HyperFormula.buildFromArray(data, {
                licenseKey: 'gpl-v3'
            });

            const evaluated = [];
            for (let row = 0; row < data.length; row++) {
                evaluated[row] = [];
                for (let col = 0; col < (data[row]?.length || 0); col++) {
                    const value = hf.getCellValue({ sheet: 0, row, col });
                    // Check for formula errors
                    if (value && typeof value === 'object' && value.type) {
                        Debug.warn(`Formula error at row ${row}, col ${col}:`, value);
                        evaluated[row][col] = `#${value.type}`;
                    } else {
                        evaluated[row][col] = value;
                    }
                }
            }

            hf.destroy();
            Debug.log('Spreadsheet evaluated successfully');
            return evaluated;
        } catch (error) {
            Debug.error('HyperFormula evaluation error:', error);
            console.error('[Spreadsheet] Failed to evaluate formulas:', error);
            return data;
        }
    },

    // Escape HTML for safe rendering
    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    // Escape for use in attributes
    escapeAttr(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    },

    // Render static HTML table from spreadsheet data
    renderStaticSpreadsheet(data, spreadsheetId) {
        const evaluated = this.evaluateSpreadsheet(data);

        let html = `<div class="spreadsheet-container" data-spreadsheet-id="${spreadsheetId}">`;
        html += '<div class="spreadsheet-toolbar spreadsheet-static-hint">';
        html += '<span class="spreadsheet-hint-text">Click to edit spreadsheet</span>';
        html += '</div>';
        html += '<table class="spreadsheet-table">';

        evaluated.forEach((row, rowIdx) => {
            html += '<tr>';
            row.forEach((cell) => {
                const tag = rowIdx === 0 ? 'th' : 'td';
                const displayValue = cell === null || cell === undefined ? '' : cell;
                html += `<${tag}>${this.escapeHtml(String(displayValue))}</${tag}>`;
            });
            html += '</tr>';
        });

        html += '</table></div>';

        return html;
    },

    // Deactivate a spreadsheet (return to static view)
    deactivateSpreadsheet(spreadsheetId) {
        const instance = this.spreadsheetInstances[spreadsheetId];
        if (!instance) return;

        // Save any pending changes
        if (this._spreadsheetSaveTimeout) {
            clearTimeout(this._spreadsheetSaveTimeout);
            this._spreadsheetSaveTimeout = null;
            this.saveSpreadsheetToMarkdown(spreadsheetId);
        }

        // Destroy HyperFormula instance
        if (instance.hf) {
            try {
                instance.hf.destroy();
            } catch (error) {
                Debug.error('Error destroying HyperFormula instance:', error);
            }
        }

        // Re-render as static table
        const wrapper = instance.container;
        if (wrapper) {
            const data = this.parseSpreadsheetCSV(wrapper.dataset.originalCode || '');
            const evaluated = this.evaluateSpreadsheet(data);

            // Build static table HTML
            let tableHtml = '<div class="spreadsheet-toolbar spreadsheet-static-hint">';
            tableHtml += '<span class="spreadsheet-hint-text">Click to edit spreadsheet</span>';
            tableHtml += '</div>';
            tableHtml += '<table class="spreadsheet-table">';
            evaluated.forEach((row, rowIdx) => {
                tableHtml += '<tr>';
                row.forEach((cell) => {
                    const tag = rowIdx === 0 ? 'th' : 'td';
                    const displayValue = cell === null || cell === undefined ? '' : cell;
                    tableHtml += `<${tag}>${this.escapeHtml(String(displayValue))}</${tag}>`;
                });
                tableHtml += '</tr>';
            });
            tableHtml += '</table>';

            const container = wrapper.querySelector('.spreadsheet-container');
            if (container) {
                container.innerHTML = tableHtml;
                container.classList.remove('spreadsheet-active');
            }
        }

        // Clean up instance
        delete this.spreadsheetInstances[spreadsheetId];
        if (this.activeSpreadsheet === spreadsheetId) {
            this.activeSpreadsheet = null;
        }

        Debug.log(`Spreadsheet #${spreadsheetId} deactivated`);
    },

    // Activate spreadsheet for editing
    activateSpreadsheetEditor(container) {
        if (!this.isHyperFormulaReady()) {
            Debug.error('Cannot activate spreadsheet: HyperFormula not loaded');
            return;
        }

        const spreadsheetId = container.dataset.spreadsheetId;

        // Deactivate currently active spreadsheet if different
        if (this.activeSpreadsheet !== null && this.activeSpreadsheet !== spreadsheetId) {
            this.deactivateSpreadsheet(this.activeSpreadsheet);
        }

        // Don't re-activate if already active
        if (this.spreadsheetInstances[spreadsheetId]) {
            return;
        }

        const wrapper = container.closest('.spreadsheet-wrapper');
        const originalCode = wrapper?.dataset.originalCode || '';
        const data = this.parseSpreadsheetCSV(originalCode);

        // Create HyperFormula instance
        const hf = HyperFormula.buildFromArray(data, {
            licenseKey: 'gpl-v3'
        });

        this.spreadsheetInstances[spreadsheetId] = {
            hf,
            data: JSON.parse(JSON.stringify(data)), // Deep copy
            container: wrapper
        };
        this.activeSpreadsheet = spreadsheetId;

        // Render editable table
        this.renderEditableSpreadsheet(container, data, spreadsheetId);
    },

    // Render editable spreadsheet with input cells
    renderEditableSpreadsheet(container, data, spreadsheetId) {
        const instance = this.spreadsheetInstances[spreadsheetId];
        if (!instance) return;

        let html = '<div class="spreadsheet-toolbar">';
        html += `<button type="button" class="spreadsheet-btn" data-action="add-row" data-id="${spreadsheetId}">+ Row</button>`;
        html += `<button type="button" class="spreadsheet-btn" data-action="add-col" data-id="${spreadsheetId}">+ Column</button>`;
        html += `<button type="button" class="spreadsheet-btn spreadsheet-btn-danger" data-action="remove-row" data-id="${spreadsheetId}">- Row</button>`;
        html += `<button type="button" class="spreadsheet-btn spreadsheet-btn-danger" data-action="remove-col" data-id="${spreadsheetId}">- Col</button>`;
        html += '</div>';

        html += '<table class="spreadsheet-table spreadsheet-editable">';

        data.forEach((row, rowIdx) => {
            html += '<tr>';
            row.forEach((cell, colIdx) => {
                const displayValue = this.getSpreadsheetDisplayValue(instance, rowIdx, colIdx);
                const rawValue = String(cell ?? '');
                html += `<td class="spreadsheet-cell" data-row="${rowIdx}" data-col="${colIdx}">`;
                html += `<input type="text" class="spreadsheet-input" `;
                html += `value="${this.escapeAttr(rawValue)}" `;
                html += `data-display="${this.escapeAttr(String(displayValue))}" `;
                html += `data-spreadsheet-id="${spreadsheetId}" `;
                html += `data-row="${rowIdx}" data-col="${colIdx}" />`;
                html += '</td>';
            });
            html += '</tr>';
        });

        html += '</table>';

        container.innerHTML = html;
        container.classList.add('spreadsheet-active');

        // Attach event listeners
        this.attachSpreadsheetEventListeners(container, spreadsheetId);
    },

    // Attach event listeners to spreadsheet elements
    attachSpreadsheetEventListeners(container, spreadsheetId) {
        // Button click handlers
        container.querySelectorAll('.spreadsheet-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.dataset.action;
                const id = btn.dataset.id;

                switch (action) {
                    case 'add-row':
                        this.addSpreadsheetRow(id);
                        break;
                    case 'add-col':
                        this.addSpreadsheetColumn(id);
                        break;
                    case 'remove-row':
                        this.removeSpreadsheetRow(id);
                        break;
                    case 'remove-col':
                        this.removeSpreadsheetColumn(id);
                        break;
                }
            });
        });

        // Input handlers
        container.querySelectorAll('.spreadsheet-input').forEach(input => {
            input.addEventListener('input', (e) => {
                this.onSpreadsheetCellInput(e, spreadsheetId);
            });

            input.addEventListener('blur', (e) => {
                this.onSpreadsheetCellBlur(e, spreadsheetId);
            });

            input.addEventListener('keydown', (e) => {
                this.onSpreadsheetKeydown(e, spreadsheetId);
            });
        });
    },

    // Get display value (evaluated formula result)
    getSpreadsheetDisplayValue(instance, row, col) {
        if (!instance?.hf) return '';
        try {
            const value = instance.hf.getCellValue({ sheet: 0, row, col });
            return value === null || value === undefined ? '' : value;
        } catch {
            return '';
        }
    },

    // Handle cell input
    onSpreadsheetCellInput(event, spreadsheetId) {
        const instance = this.spreadsheetInstances[spreadsheetId];
        if (!instance) return;

        const input = event.target;
        const row = parseInt(input.dataset.row);
        const col = parseInt(input.dataset.col);
        const newValue = input.value;

        // Update data
        if (!instance.data[row]) instance.data[row] = [];
        instance.data[row][col] = newValue;

        // Update HyperFormula
        try {
            instance.hf.setCellContents({ sheet: 0, row, col }, [[newValue]]);
        } catch (error) {
            Debug.error('HyperFormula update error:', error);
        }

        // Debounce save
        if (this._spreadsheetSaveTimeout) {
            clearTimeout(this._spreadsheetSaveTimeout);
        }
        this._spreadsheetSaveTimeout = setTimeout(() => {
            this.saveSpreadsheetToMarkdown(spreadsheetId);
        }, 500);
    },

    // Handle cell blur - update display value
    onSpreadsheetCellBlur(event, spreadsheetId) {
        const instance = this.spreadsheetInstances[spreadsheetId];
        if (!instance) return;

        const input = event.target;
        const row = parseInt(input.dataset.row);
        const col = parseInt(input.dataset.col);

        // Update all cells with their calculated values
        this.refreshSpreadsheetDisplayValues(spreadsheetId);
    },

    // Handle keyboard navigation
    onSpreadsheetKeydown(event, spreadsheetId) {
        const input = event.target;
        const row = parseInt(input.dataset.row);
        const col = parseInt(input.dataset.col);
        const container = input.closest('.spreadsheet-container');

        let nextRow = row;
        let nextCol = col;

        switch (event.key) {
            case 'Tab':
                event.preventDefault();
                nextCol = event.shiftKey ? col - 1 : col + 1;
                break;
            case 'Enter':
                event.preventDefault();
                nextRow = event.shiftKey ? row - 1 : row + 1;
                break;
            case 'ArrowUp':
                if (!event.shiftKey) nextRow = row - 1;
                break;
            case 'ArrowDown':
                if (!event.shiftKey) nextRow = row + 1;
                break;
            default:
                return;
        }

        // Find and focus the next cell
        const nextInput = container?.querySelector(
            `.spreadsheet-input[data-row="${nextRow}"][data-col="${nextCol}"]`
        );
        if (nextInput) {
            nextInput.focus();
            nextInput.select();
        }
    },

    // Refresh all display values in spreadsheet
    refreshSpreadsheetDisplayValues(spreadsheetId) {
        const instance = this.spreadsheetInstances[spreadsheetId];
        if (!instance) return;

        const container = instance.container?.querySelector('.spreadsheet-container');
        if (!container) return;

        container.querySelectorAll('.spreadsheet-input').forEach(input => {
            const row = parseInt(input.dataset.row);
            const col = parseInt(input.dataset.col);
            const displayValue = this.getSpreadsheetDisplayValue(instance, row, col);
            input.dataset.display = String(displayValue);
        });
    },

    // Add row to spreadsheet
    addSpreadsheetRow(spreadsheetId) {
        const instance = this.spreadsheetInstances[spreadsheetId];
        if (!instance) return;

        const colCount = instance.data[0]?.length || 1;
        const newRow = new Array(colCount).fill('');
        instance.data.push(newRow);

        try {
            instance.hf.addRows(0, [instance.data.length - 1, 1]);
        } catch (error) {
            Debug.error('HyperFormula addRows error:', error);
        }

        const container = instance.container?.querySelector('.spreadsheet-container');
        if (container) {
            this.renderEditableSpreadsheet(container, instance.data, spreadsheetId);
        }
        this.saveSpreadsheetToMarkdown(spreadsheetId);
    },

    // Add column to spreadsheet
    addSpreadsheetColumn(spreadsheetId) {
        const instance = this.spreadsheetInstances[spreadsheetId];
        if (!instance) return;

        instance.data.forEach(row => row.push(''));

        try {
            instance.hf.addColumns(0, [instance.data[0].length - 1, 1]);
        } catch (error) {
            Debug.error('HyperFormula addColumns error:', error);
        }

        const container = instance.container?.querySelector('.spreadsheet-container');
        if (container) {
            this.renderEditableSpreadsheet(container, instance.data, spreadsheetId);
        }
        this.saveSpreadsheetToMarkdown(spreadsheetId);
    },

    // Remove last row from spreadsheet
    removeSpreadsheetRow(spreadsheetId) {
        const instance = this.spreadsheetInstances[spreadsheetId];
        if (!instance || instance.data.length <= 1) return;

        instance.data.pop();

        try {
            instance.hf.removeRows(0, [instance.data.length, 1]);
        } catch (error) {
            Debug.error('HyperFormula removeRows error:', error);
        }

        const container = instance.container?.querySelector('.spreadsheet-container');
        if (container) {
            this.renderEditableSpreadsheet(container, instance.data, spreadsheetId);
        }
        this.saveSpreadsheetToMarkdown(spreadsheetId);
    },

    // Remove last column from spreadsheet
    removeSpreadsheetColumn(spreadsheetId) {
        const instance = this.spreadsheetInstances[spreadsheetId];
        if (!instance || (instance.data[0]?.length || 0) <= 1) return;

        instance.data.forEach(row => row.pop());

        try {
            instance.hf.removeColumns(0, [instance.data[0].length, 1]);
        } catch (error) {
            Debug.error('HyperFormula removeColumns error:', error);
        }

        const container = instance.container?.querySelector('.spreadsheet-container');
        if (container) {
            this.renderEditableSpreadsheet(container, instance.data, spreadsheetId);
        }
        this.saveSpreadsheetToMarkdown(spreadsheetId);
    },

    // Save spreadsheet back to markdown source
    saveSpreadsheetToMarkdown(spreadsheetId) {
        const instance = this.spreadsheetInstances[spreadsheetId];
        if (!instance) return;

        const csv = this.serializeSpreadsheetCSV(instance.data);
        const wrapper = instance.container;
        if (wrapper) {
            wrapper.dataset.originalCode = csv;
        }

        // Update the markdown source in the editor
        this.updateSpreadsheetInEditor(spreadsheetId, csv);
    },

    // Update spreadsheet content in CodeMirror editor
    updateSpreadsheetInEditor(spreadsheetId, newCsv) {
        if (!this.editorView) {
            Debug.warn('Cannot sync spreadsheet to editor: editorView not available');
            return;
        }
        if (typeof this.getEditorContent !== 'function') {
            Debug.warn('Cannot sync spreadsheet to editor: getEditorContent not available');
            return;
        }

        const content = this.getEditorContent();

        // Find and replace the nth spreadsheet code block
        const regex = /```spreadsheet\n([\s\S]*?)\n```/g;
        let match;
        let currentId = 0;
        let result = content;
        let offset = 0;

        let found = false;
        while ((match = regex.exec(content)) !== null) {
            if (String(currentId) === String(spreadsheetId)) {
                const newBlock = '```spreadsheet\n' + newCsv + '\n```';
                const start = match.index + offset;
                const end = start + match[0].length;
                result = result.substring(0, start) + newBlock + result.substring(end);
                offset += newBlock.length - match[0].length;
                found = true;
                break;
            }
            currentId++;
        }

        if (!found) {
            Debug.warn(`Spreadsheet block #${spreadsheetId} not found in editor content`);
            return;
        }

        if (result !== content && typeof this.updateEditorContent === 'function') {
            // Update without triggering a full re-render
            // Keep the flag true until after Alpine's reactive update completes
            this._skipSpreadsheetRender = true;
            this.noteContent = result;
            this.updateEditorContent(result);

            // Use requestAnimationFrame to reset flag after DOM updates
            requestAnimationFrame(() => {
                this._skipSpreadsheetRender = false;
            });
            Debug.log(`Spreadsheet #${spreadsheetId} synced to editor`);
        }
    },

    // Render all spreadsheets in preview (called after marked.parse)
    renderSpreadsheets() {
        if (this._skipSpreadsheetRender) return;

        requestAnimationFrame(() => {
            // Target the note preview specifically (has .note-preview class)
            // This ensures spreadsheet IDs match the editor content
            const notePreview = document.querySelector('.markdown-preview.note-preview');
            if (!notePreview) return;

            const spreadsheetBlocks = notePreview.querySelectorAll('pre code.language-spreadsheet');
            if (spreadsheetBlocks.length === 0) return;

            Debug.log(`Found ${spreadsheetBlocks.length} spreadsheet blocks to render`);

            spreadsheetBlocks.forEach((block) => {
                const pre = block.parentElement;
                if (!pre || pre.parentElement?.classList.contains('spreadsheet-wrapper')) return;

                const code = block.textContent;
                const spreadsheetId = String(this._spreadsheetIdCounter++);
                const data = this.parseSpreadsheetCSV(code);

                // Create wrapper
                const wrapper = document.createElement('div');
                wrapper.className = 'spreadsheet-wrapper';
                wrapper.dataset.originalCode = code;
                wrapper.innerHTML = this.renderStaticSpreadsheet(data, spreadsheetId);

                // Add click handler for activation
                wrapper.addEventListener('click', (e) => {
                    // Don't activate if clicking on an input or button
                    if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;

                    const container = wrapper.querySelector('.spreadsheet-container');
                    if (container && !container.classList.contains('spreadsheet-active')) {
                        this.activateSpreadsheetEditor(container);
                    }
                });

                pre.parentElement.replaceChild(wrapper, pre);
            });
        });
    },

    // Cleanup spreadsheets on note change
    cleanupSpreadsheets() {
        // Destroy HyperFormula instances
        Object.values(this.spreadsheetInstances).forEach(instance => {
            if (instance?.hf) {
                try {
                    instance.hf.destroy();
                } catch (error) {
                    Debug.error('Error destroying HyperFormula instance:', error);
                }
            }
        });

        this.spreadsheetInstances = {};
        this.activeSpreadsheet = null;
        this._spreadsheetIdCounter = 0;

        if (this._spreadsheetSaveTimeout) {
            clearTimeout(this._spreadsheetSaveTimeout);
            this._spreadsheetSaveTimeout = null;
        }

        Debug.log('Spreadsheet instances cleaned up');
    },
};
