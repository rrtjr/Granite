// Granite Frontend - CodeMirror Editor Module
// Note: Panes now initialize their own CodeMirror editors
// This function is legacy and not actively used in pane-based system

import { Debug } from './config.js';

export const editorMixin = {
    initCodeMirror() {
        if (!window.CodeMirror || !window.CodeMirrorReady) {
            Debug.log('CodeMirror not loaded yet, retrying...');
            setTimeout(() => this.initCodeMirror(), 100);
            return;
        }

        const container = this.$refs.editorContainer || document.getElementById('note-editor');
        if (!container) {
            Debug.log('Editor container not found, retrying...');
            setTimeout(() => this.initCodeMirror(), 100);
            return;
        }

        if (this.editorView) {
            Debug.log('CodeMirror already initialized');
            return;
        }

        Debug.log('Initializing CodeMirror 6...');

        const { EditorView, EditorState, markdown, basicExtensions, Compartment } = window.CodeMirror;

        this.editorThemeCompartment = new Compartment();

        const self = this;

        const updateListener = EditorView.updateListener.of((update) => {
            if (update.docChanged) {
                if (self.updateTimeout) {
                    clearTimeout(self.updateTimeout);
                }

                self.pendingUpdate = update.state;

                self.updateTimeout = setTimeout(() => {
                    if (self.pendingUpdate) {
                        self.noteContent = self.pendingUpdate.doc.toString();
                        self.pendingUpdate = null;
                        self.autoSave();
                    }
                }, self.performanceSettings.updateDelay);
            }
        });

        const pasteHandler = EditorView.domEventHandlers({
            paste: (event) => {
                const shouldHandle = self.shouldHandleImagePaste(event);
                if (shouldHandle) {
                    self.handleImagePasteAsync(event);
                    return true;
                }
                return false;
            },
            drop: (event, view) => {
                return self.onEditorDrop(event, view);
            }
        });

        const startState = EditorState.create({
            doc: this.noteContent,
            extensions: [
                ...basicExtensions,
                markdown(),
                this.editorThemeCompartment.of([]),
                updateListener,
                pasteHandler,
                EditorView.lineWrapping,
                EditorView.theme({
                    "&": { height: "100%" },
                    ".cm-scroller": { overflow: "auto" }
                })
            ]
        });

        this.editorView = new EditorView({
            state: startState,
            parent: container
        });

        Debug.log('CodeMirror 6 initialized successfully!');
    },

    updateEditorContent(content) {
        if (!this.editorView) return;

        const currentDoc = this.editorView.state.doc.toString();
        if (currentDoc === content) return;

        this.editorView.dispatch({
            changes: {
                from: 0,
                to: this.editorView.state.doc.length,
                insert: content
            }
        });
    },

    getEditorContent() {
        if (!this.editorView) return '';
        return this.editorView.state.doc.toString();
    },

    getCursorPosition() {
        if (!this.editorView) return 0;
        return this.editorView.state.selection.main.head;
    },

    setCursorPosition(pos) {
        if (!this.editorView) return;
        const { EditorSelection } = window.CodeMirror.EditorState;
        this.editorView.dispatch({
            selection: EditorSelection.cursor(pos)
        });
    },

    getSelectedText() {
        if (!this.editorView) return '';
        const selection = this.editorView.state.selection.main;
        return this.editorView.state.doc.sliceString(selection.from, selection.to);
    },

    getSelectionRange() {
        if (!this.editorView) return { from: 0, to: 0 };
        const selection = this.editorView.state.selection.main;
        return { from: selection.from, to: selection.to };
    },

    setSelectionRange(from, to) {
        if (!this.editorView) return;
        const { EditorSelection } = window.CodeMirror.EditorState;
        this.editorView.dispatch({
            selection: EditorSelection.range(from, to)
        });
        this.editorView.focus();
    },

    insertTextAtCursor(text) {
        if (!this.editorView) return;
        const pos = this.getCursorPosition();
        this.editorView.dispatch({
            changes: { from: pos, insert: text }
        });
    },

    replaceSelection(text) {
        if (!this.editorView) return;
        const selection = this.editorView.state.selection.main;
        this.editorView.dispatch({
            changes: { from: selection.from, to: selection.to, insert: text },
            selection: { anchor: selection.from + text.length }
        });
    },

    focusEditor() {
        if (this.editorView) {
            this.editorView.focus();
        }
    },

    wrapSelection(before, after, placeholder) {
        if (!this.editorView) return;

        const selection = this.editorView.state.selection.main;
        const selectedText = this.editorView.state.doc.sliceString(selection.from, selection.to);
        const textToWrap = selectedText || placeholder;
        const newText = before + textToWrap + after;

        this.editorView.dispatch({
            changes: { from: selection.from, to: selection.to, insert: newText },
            selection: selectedText
                ? { anchor: selection.from + before.length, head: selection.from + before.length + selectedText.length }
                : { anchor: selection.from + before.length, head: selection.from + before.length + placeholder.length }
        });

        this.editorView.focus();
    },

    insertLink() {
        if (!this.editorView) return;

        const selection = this.editorView.state.selection.main;
        const selectedText = this.editorView.state.doc.sliceString(selection.from, selection.to);
        const linkText = selectedText || 'link text';
        const linkUrl = 'url';
        const newText = `[${linkText}](${linkUrl})`;
        const urlStart = selection.from + linkText.length + 3;
        const urlEnd = urlStart + linkUrl.length;

        this.editorView.dispatch({
            changes: { from: selection.from, to: selection.to, insert: newText },
            selection: { anchor: urlStart, head: urlEnd }
        });

        this.editorView.focus();
    },

    insertTable() {
        if (!this.editorView) return;

        const cursorPos = this.getCursorPosition();
        const table = `| Header 1 | Header 2 | Header 3 |
|----------|----------|----------|
| Cell 1   | Cell 2   | Cell 3   |
| Cell 4   | Cell 5   | Cell 6   |
`;

        const textBefore = this.editorView.state.doc.sliceString(0, cursorPos);
        const needsNewlineBefore = textBefore.length > 0 && !textBefore.endsWith('\n');
        const prefix = needsNewlineBefore ? '\n\n' : '';
        const fullText = prefix + table;
        const newPos = cursorPos + prefix.length + 2;

        this.editorView.dispatch({
            changes: { from: cursorPos, insert: fullText },
            selection: { anchor: newPos, head: newPos + 8 }
        });

        this.editorView.focus();
    },

    async formatMarkdown() {
        if (!this.editorView) return;

        const content = this.getEditorContent();

        try {
            const response = await fetch('/api/format', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ content: content })
            });

            if (!response.ok) {
                throw new Error('Failed to format markdown');
            }

            const data = await response.json();

            // Only update if changed
            if (data.content !== content) {
                // Keep cursor position approx consistent?
                // Replacing entire doc resets cursor usually.
                // updateEditorContent handles full replacement.
                // We might want to preserve scroll at least.
                // Simple replacement is fine for now.
                this.updateEditorContent(data.content);
                Debug.log('Markdown formatted');
            }
        } catch (error) {
            console.error('Error formatting markdown:', error);
            Debug.log('Error formatting markdown: ' + error.message);
        }
    },
};
