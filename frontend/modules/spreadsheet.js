// Granite Frontend - Spreadsheet Module
// Provides Excel-like spreadsheet functionality within notes using code blocks

import { Debug } from './config.js';

export const spreadsheetMixin = {
    // State
    activeSpreadsheet: null,
    spreadsheetInstances: {},
    _spreadsheetIdCounter: 0,
    _sharedHF: null,           // Shared HyperFormula instance for cross-sheet references
    _sheetCount: 0,            // Number of sheets in the shared instance
    _sheetNames: [],           // Custom or default sheet names in order
    _spreadsheetRenderInProgress: false, // Prevent recursive/looping renders
    _spreadsheetLastHash: null,
    _spreadsheetLastRenderTs: 0,

    // Transform spreadsheet code blocks in HTML string to rendered wrappers
    // This runs synchronously before Alpine sets innerHTML, ensuring wrappers persist
    transformSpreadsheetHtml(html) {
        if (!html || !this.isHyperFormulaReady()) {
            return html;
        }

        // Parse HTML to DOM for manipulation
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;

        const spreadsheetBlocks = tempDiv.querySelectorAll('pre code.language-spreadsheet');
        if (spreadsheetBlocks.length === 0) {
            return html;
        }

        // Reset state for this render
        this._spreadsheetIdCounter = 0;
        this._sheetNames = [];
        this._sheetCount = 0;
        if (this._sharedHF) {
            try {
                this._sharedHF.destroy();
            } catch (e) {
                Debug.warn('Error destroying shared HyperFormula during transform:', e);
            }
            this._sharedHF = null;
        }

        // First pass: collect all spreadsheet data
        const allSheetsData = [];
        const blocksToProcess = [];

        spreadsheetBlocks.forEach((block) => {
            const pre = block.parentElement;
            if (!pre) return;

            const code = block.textContent;
            const data = this.parseSpreadsheetCSV(code);
            allSheetsData.push(data);
            blocksToProcess.push({ block, pre, code, data });
        });

        // Extract custom sheet names from source
        let names = [];
        try {
            const src = this.noteContent || '';
            names = this.extractSpreadsheetNamesFromContent(src);
        } catch (e) {
            Debug.warn('Failed to extract spreadsheet names:', e);
        }

        // Ensure names array matches sheets count
        if (!Array.isArray(names)) names = [];
        while (names.length < allSheetsData.length) {
            names.push('');
        }
        names = names.slice(0, allSheetsData.length);

        // Build shared HyperFormula instance
        this.buildSharedHyperFormula(allSheetsData, names);

        // Second pass: replace pre blocks with rendered wrappers
        blocksToProcess.forEach(({ pre, code, data }) => {
            const spreadsheetId = String(this._spreadsheetIdCounter++);
            const parent = pre.parentElement;
            if (!parent) return;

            // Create wrapper
            const wrapper = document.createElement('div');
            wrapper.className = 'spreadsheet-wrapper';
            wrapper.dataset.originalCode = code;
            wrapper.dataset.sheetIndex = spreadsheetId;
            wrapper.innerHTML = this.renderStaticSpreadsheet(data, spreadsheetId);

            parent.replaceChild(wrapper, pre);
        });

        return tempDiv.innerHTML;
    },

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

    // Calculate values using HyperFormula (single sheet, standalone)
    evaluateSpreadsheet(data) {
        if (!this.isHyperFormulaReady()) {
            Debug.warn('HyperFormula not loaded, returning raw data.');
            return data;
        }

        try {
            const hf = HyperFormula.buildFromArray(data, {
                licenseKey: 'gpl-v3'
            });

            const evaluated = this._extractSheetValues(hf, 0, data);
            hf.destroy();
            Debug.log('Spreadsheet evaluated successfully');
            return evaluated;
        } catch (error) {
            Debug.error('HyperFormula evaluation error:', error);
            return data;
        }
    },

    // Evaluate a specific sheet from the shared HyperFormula instance
    evaluateSheetFromShared(sheetIndex, data) {
        if (!this._sharedHF) {
            return this.evaluateSpreadsheet(data);
        }

        try {
            return this._extractSheetValues(this._sharedHF, sheetIndex, data);
        } catch (error) {
            Debug.error(`Error evaluating sheet ${sheetIndex} from shared instance:`, error);
            return data;
        }
    },

    // Extract evaluated values from a HyperFormula instance for a specific sheet
    _extractSheetValues(hf, sheetIndex, data) {
        const evaluated = [];
        for (let row = 0; row < data.length; row++) {
            evaluated[row] = [];
            for (let col = 0; col < (data[row]?.length || 0); col++) {
                const value = hf.getCellValue({ sheet: sheetIndex, row, col });
                // Check for formula errors
                if (value && typeof value === 'object' && value.type) {
                    Debug.warn(`Formula error at sheet ${sheetIndex}, row ${row}, col ${col}:`, value);
                    evaluated[row][col] = `#${value.type}`;
                } else {
                    evaluated[row][col] = value;
                }
            }
        }
        return evaluated;
    },

    // Build or rebuild the shared HyperFormula instance with all sheets
    // Optionally accepts explicit sheetNames (array aligned to sheetsData)
    buildSharedHyperFormula(sheetsData, sheetNames) {
        if (!this.isHyperFormulaReady()) {
            Debug.warn('HyperFormula not loaded, cannot build shared instance');
            return;
        }

        // Destroy existing shared instance
        if (this._sharedHF) {
            try {
                this._sharedHF.destroy();
            } catch (error) {
                Debug.error('Error destroying shared HyperFormula:', error);
            }
            this._sharedHF = null;
        }

        if (sheetsData.length === 0) {
            this._sheetCount = 0;
            this._sheetNames = [];
            return;
        }

        try {
            // Build named sheets object (Sheet1, Sheet2, etc. - 1-indexed for user-friendliness)
            const namedSheets = {};

            // Derive names: use provided sheetNames if valid; else default to Sheet{n}
            const finalNames = [];
            const used = new Set();

            const sanitizeName = (name) => {
                // Trim and limit length; allow spaces (user may need quotes in formulas)
                let n = String(name || '').trim();
                if (!n) return '';
                // HyperFormula supports many chars; avoid invalid control chars
                n = n.replace(/[\u0000-\u001F]/g, '');
                return n.substring(0, 64);
            };

            for (let i = 0; i < sheetsData.length; i++) {
                let candidate = sanitizeName(sheetNames && sheetNames[i]);
                if (!candidate) candidate = `Sheet${i + 1}`;

                // Ensure uniqueness
                let unique = candidate;
                let counter = 2;
                while (used.has(unique)) {
                    unique = `${candidate} (${counter++})`;
                }
                used.add(unique);
                finalNames.push(unique);
            }

            // Persist names for UI/toolbars
            this._sheetNames = finalNames;
            Debug.log(`[Spreadsheet] Final sheet names: ${finalNames.join(', ')}`);

            finalNames.forEach((name, index) => {
                namedSheets[name] = sheetsData[index];
            });

            this._sharedHF = HyperFormula.buildFromSheets(namedSheets, {
                licenseKey: 'gpl-v3'
            });
            this._sheetCount = sheetsData.length;

            Debug.log(`Built shared HyperFormula with ${sheetsData.length} sheets`);
        } catch (error) {
            Debug.error('Failed to build shared HyperFormula:', error);
            this._sharedHF = null;
            this._sheetCount = 0;
            this._sheetNames = [];
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
        // Use shared instance for cross-sheet references if available
        const sheetIndex = parseInt(spreadsheetId);
        const evaluated = this._sharedHF
            ? this.evaluateSheetFromShared(sheetIndex, data)
            : this.evaluateSpreadsheet(data);

        // Show sheet name hint for cross-references
        const sheetName = this._sheetNames[sheetIndex] || `Sheet${sheetIndex + 1}`;

        let html = `<div class="spreadsheet-container" data-spreadsheet-id="${spreadsheetId}">`;
        html += '<div class="spreadsheet-toolbar">';
        html += `<span class="spreadsheet-sheet-name">${sheetName}</span>`;
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

        // Only destroy HyperFormula if it's a standalone instance (not shared)
        if (instance.hf && !instance.useSharedInstance) {
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
            const sheetIndex = parseInt(spreadsheetId);
            const sheetName = this._sheetNames[sheetIndex] || `Sheet${sheetIndex + 1}`;

            // Use shared instance for evaluation if available
            const evaluated = this._sharedHF
                ? this.evaluateSheetFromShared(sheetIndex, data)
                : this.evaluateSpreadsheet(data);

            // Build static table HTML
            let tableHtml = '<div class="spreadsheet-toolbar">';
            tableHtml += `<span class="spreadsheet-sheet-name">${sheetName}</span>`;
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
        // Disable spreadsheet editing when not in full edit mode (e.g., preview/split)
        if (this.viewMode !== 'edit') {
            Debug.log('Spreadsheet edit blocked: viewMode is not edit');
            return;
        }
        if (!this.isHyperFormulaReady()) {
            Debug.error('Cannot activate spreadsheet: HyperFormula not loaded');
            return;
        }

        const spreadsheetId = container.dataset.spreadsheetId;
        const sheetIndex = parseInt(spreadsheetId);

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

        // Use shared HyperFormula instance for cross-sheet references
        // If shared instance doesn't exist or sheet index is invalid, create standalone
        let hf = this._sharedHF;
        let useSharedInstance = false;

        if (hf && sheetIndex < this._sheetCount) {
            useSharedInstance = true;
            Debug.log(`Using shared HyperFormula for Sheet${sheetIndex + 1}`);
        } else {
            // Fallback to standalone instance
            hf = HyperFormula.buildFromArray(data, {
                licenseKey: 'gpl-v3'
            });
            Debug.log(`Created standalone HyperFormula for spreadsheet ${spreadsheetId}`);
        }

        this.spreadsheetInstances[spreadsheetId] = {
            hf,
            data: JSON.parse(JSON.stringify(data)), // Deep copy
            container: wrapper,
            sheetIndex,
            useSharedInstance
        };
        this.activeSpreadsheet = spreadsheetId;

        // Render editable table
        this.renderEditableSpreadsheet(container, data, spreadsheetId);
    },

    // Render editable spreadsheet with input cells
    renderEditableSpreadsheet(container, data, spreadsheetId) {
        const instance = this.spreadsheetInstances[spreadsheetId];
        if (!instance) return;

        const sheetIndex = parseInt(spreadsheetId);
        const sheetName = this._sheetNames[sheetIndex] || `Sheet${sheetIndex + 1}`;

        let html = '<div class="spreadsheet-toolbar">';
        html += `<span class="spreadsheet-sheet-name spreadsheet-sheet-name-active">${sheetName}</span>`;
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
            // Use the correct sheet index for shared instance
            const sheetIdx = instance.useSharedInstance ? instance.sheetIndex : 0;
            const value = instance.hf.getCellValue({ sheet: sheetIdx, row, col });
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

        // Update HyperFormula with correct sheet index
        try {
            const sheetIdx = instance.useSharedInstance ? instance.sheetIndex : 0;
            instance.hf.setCellContents({ sheet: sheetIdx, row, col }, [[newValue]]);

            // If using shared instance, refresh other static spreadsheets that might reference this one
            if (instance.useSharedInstance) {
                this.refreshOtherSpreadsheets(spreadsheetId);
            }
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

    // Refresh display values in other (non-active) spreadsheets that might have cross-references
    refreshOtherSpreadsheets(excludeId) {
        if (!this._sharedHF) return;

        const notePreview = document.querySelector('.markdown-preview.note-preview');
        if (!notePreview) return;

        // Find all spreadsheet wrappers and refresh their static tables
        notePreview.querySelectorAll('.spreadsheet-wrapper').forEach(wrapper => {
            const container = wrapper.querySelector('.spreadsheet-container');
            if (!container) return;

            const spreadsheetId = container.dataset.spreadsheetId;

            // Skip the currently active spreadsheet
            if (spreadsheetId === excludeId) return;

            // Skip if this spreadsheet is in edit mode
            if (container.classList.contains('spreadsheet-active')) return;

            // Re-render the static table with updated values from shared HF
            const sheetIndex = parseInt(spreadsheetId);
            const code = wrapper.dataset.originalCode || '';
            const data = this.parseSpreadsheetCSV(code);
            const evaluated = this.evaluateSheetFromShared(sheetIndex, data);

            // Update table cells
            const table = container.querySelector('.spreadsheet-table');
            if (table) {
                const rows = table.querySelectorAll('tr');
                evaluated.forEach((rowData, rowIdx) => {
                    const row = rows[rowIdx];
                    if (!row) return;
                    const cells = row.querySelectorAll('th, td');
                    rowData.forEach((cellValue, colIdx) => {
                        const cell = cells[colIdx];
                        if (cell) {
                            const displayValue = cellValue === null || cellValue === undefined ? '' : cellValue;
                            cell.textContent = String(displayValue);
                        }
                    });
                });
            }
        });
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
            const sheetIdx = instance.useSharedInstance ? instance.sheetIndex : 0;
            instance.hf.addRows(sheetIdx, [instance.data.length - 1, 1]);
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
            const sheetIdx = instance.useSharedInstance ? instance.sheetIndex : 0;
            instance.hf.addColumns(sheetIdx, [instance.data[0].length - 1, 1]);
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
            const sheetIdx = instance.useSharedInstance ? instance.sheetIndex : 0;
            instance.hf.removeRows(sheetIdx, [instance.data.length, 1]);
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
            const sheetIdx = instance.useSharedInstance ? instance.sheetIndex : 0;
            instance.hf.removeColumns(sheetIdx, [instance.data[0].length, 1]);
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
        // Capture optional meta after language (e.g., ```spreadsheet name="Income")
        // Robust to Windows newlines and optional trailing newline before closing fence
        const regex = /```+[ \t]*spreadsheet([^\r\n]*)?\r?\n([\s\S]*?)\r?\n?```+/g;
        let match;
        let currentId = 0;
        let result = content;
        let offset = 0;

        let found = false;
        while ((match = regex.exec(content)) !== null) {
            if (String(currentId) === String(spreadsheetId)) {
                const openingMeta = match[1] || '';
                const newBlock = '```spreadsheet' + openingMeta + '\n' + newCsv + '\n```';
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
            // Update without triggering an immediate recursive render; re-enable rendering after DOM updates
            this._skipSpreadsheetRender = true;
            this.noteContent = result;
            this.updateEditorContent(result);

            // Allow the note content/preview to update, then rerender spreadsheets
            requestAnimationFrame(() => {
                this._skipSpreadsheetRender = false;
                // Trigger a fresh spreadsheet render after the preview updates
                requestAnimationFrame(() => {
                    this.renderSpreadsheets();
                });
            });
            Debug.log(`Spreadsheet #${spreadsheetId} synced to editor`);
        }
    },

    // Render all spreadsheets in preview (called after marked.parse)
    renderSpreadsheets() {
        // Prevent runaway recursive renders
        if (this._spreadsheetRenderInProgress) {
            return;
        }

        // Lightweight debounce: if the source hash is identical and last render was < 400ms ago, skip
        const srcForHash = (typeof this.getEditorContent === 'function' ? this.getEditorContent() : '') || (this.noteContent || '');
        const hashKey = `${srcForHash.length}:${srcForHash.slice(0, 64)}`;
        const now = Date.now();
        if (this._spreadsheetLastHash === hashKey && now - this._spreadsheetLastRenderTs < 400) {
            return;
        }

        this._spreadsheetLastHash = hashKey;
        this._spreadsheetLastRenderTs = now;

        this._spreadsheetRenderInProgress = true;

        if (this._skipSpreadsheetRender) {
            this._spreadsheetRenderInProgress = false;
            return;
        }

        // Reset counters/state so re-renders within the same note stay aligned
        this._spreadsheetIdCounter = 0;
        this._sheetNames = [];
        this._sheetCount = 0;
        if (this._sharedHF) {
            try {
                this._sharedHF.destroy();
            } catch (e) {
                Debug.warn('Error destroying shared HyperFormula during re-render:', e);
            }
            this._sharedHF = null;
        }

        // Use setTimeout(0) instead of requestAnimationFrame to run after the current
        // call stack completes but before Alpine re-renders from any reactive update
        setTimeout(() => {
            try {
                // Target the note preview specifically (has .note-preview class)
                // This ensures spreadsheet IDs match the editor content
                const notePreview = document.querySelector('.markdown-preview.note-preview');
                if (!notePreview) {
                    return;
                }

                const spreadsheetBlocks = notePreview.querySelectorAll('pre code.language-spreadsheet');
                if (spreadsheetBlocks.length === 0) {
                    return;
                }

                Debug.log(`Found ${spreadsheetBlocks.length} spreadsheet blocks to render`);

                // First pass: collect all spreadsheet data for cross-sheet references
                const allSheetsData = [];
                const blocksToProcess = [];

                spreadsheetBlocks.forEach((block) => {
                    const pre = block.parentElement;
                    if (!pre || pre.parentElement?.classList.contains('spreadsheet-wrapper')) return;

                    const code = block.textContent;
                    const data = this.parseSpreadsheetCSV(code);
                    allSheetsData.push(data);
                    blocksToProcess.push({ block, pre, code, data });
                });

                // Extract custom sheet names from editor content, aligned by order
                let names = [];
                try {
                    const srcFromEditor = typeof this.getEditorContent === 'function' ? this.getEditorContent() : '';
                    const src = (srcFromEditor && srcFromEditor.trim().length > 0) ? srcFromEditor : (this.noteContent || '');
                    names = this.extractSpreadsheetNamesFromContent(src);
                } catch (e) {
                    Debug.warn('Failed to extract spreadsheet names from content:', e);
                }

                // Ensure names array is the correct length, preserving extracted names and filling Sheet{n} for missing ones
                if (!Array.isArray(names)) {
                    names = [];
                }
                while (names.length < allSheetsData.length) {
                    names.push(''); // Empty string will be replaced with Sheet{n} in buildSharedHyperFormula
                }
                names = names.slice(0, allSheetsData.length); // Trim if there are extras

                // Build shared HyperFormula instance with all sheets and names
                this.buildSharedHyperFormula(allSheetsData, names);

                // Second pass: render each spreadsheet using the shared instance
                blocksToProcess.forEach(({ pre, code, data }) => {
                    const spreadsheetId = String(this._spreadsheetIdCounter++);

                    // Re-check parent exists (may have been detached by another renderer)
                    const parent = pre.parentElement;
                    if (!parent) {
                        return;
                    }

                    // Create wrapper
                    const wrapper = document.createElement('div');
                    wrapper.className = 'spreadsheet-wrapper';
                    wrapper.dataset.originalCode = code;
                    wrapper.dataset.sheetIndex = spreadsheetId;
                    wrapper.innerHTML = this.renderStaticSpreadsheet(data, spreadsheetId);

                    // Add click handler for activation only in edit mode
                    if (this.viewMode === 'edit') {
                        wrapper.addEventListener('click', (e) => {
                            // Don't activate if clicking on an input or button
                            if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;

                            const container = wrapper.querySelector('.spreadsheet-container');
                            if (container && !container.classList.contains('spreadsheet-active')) {
                                this.activateSpreadsheetEditor(container);
                            }
                        });
                    }

                    parent.replaceChild(wrapper, pre);
                });
            } finally {
                this._spreadsheetRenderInProgress = false;
            }
        });
    },

    // Cleanup spreadsheets on note change
    cleanupSpreadsheets() {
        // Destroy standalone HyperFormula instances (not shared ones)
        Object.values(this.spreadsheetInstances).forEach(instance => {
            if (instance?.hf && !instance.useSharedInstance) {
                try {
                    instance.hf.destroy();
                } catch (error) {
                    Debug.error('Error destroying HyperFormula instance:', error);
                }
            }
        });

        // Destroy shared HyperFormula instance
        if (this._sharedHF) {
            try {
                this._sharedHF.destroy();
            } catch (error) {
                Debug.error('Error destroying shared HyperFormula instance:', error);
            }
            this._sharedHF = null;
            this._sheetCount = 0;
            this._sheetNames = [];
        }

        this.spreadsheetInstances = {};
        this.activeSpreadsheet = null;
        this._spreadsheetIdCounter = 0;

        if (this._spreadsheetSaveTimeout) {
            clearTimeout(this._spreadsheetSaveTimeout);
            this._spreadsheetSaveTimeout = null;
        }

        Debug.log('Spreadsheet instances cleaned up');
    },

    // Helper: extract custom spreadsheet names from markdown content
    // Supports: ```spreadsheet name="Income" or ```spreadsheet name='Income' or ```spreadsheet name=Income
    // Extract custom spreadsheet names from markdown content
    // Supports: ```spreadsheet name="SheetName" or name='SheetName' or name=SheetName
    extractSpreadsheetNamesFromContent(content) {
        if (!content) {
            return [];
        }
        const names = [];

        // Robust header-only scanning: match lines starting with ```spreadsheet
        // This avoids complex multiline matching issues which can fail on line endings or large content
        const headerRe = /^[ \t]*```+[ \t]*spreadsheet([^\r\n]*)/gmi;

        let m;
        while ((m = headerRe.exec(content)) !== null) {
            const meta = (m[1] || '').trim();
            let name = '';
            if (meta) {
                // Try name=... or title=... with flexible quoting
                const nameMatch = meta.match(/(?:name|title)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s,;]+))/i);
                if (nameMatch) {
                    name = (nameMatch[1] || nameMatch[2] || nameMatch[3] || '').trim();
                }
            }
            names.push(name);
        }

        return names;
    },
};
