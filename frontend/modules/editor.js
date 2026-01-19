// Granite Frontend - CodeMirror Editor Module

export const editorMixin = {
    // Initialize CodeMirror 6 editor
    initCodeMirror() {
        if (!window.CodeMirror || !window.CodeMirrorReady) {
            console.log('CodeMirror not loaded yet, retrying...');
            setTimeout(() => this.initCodeMirror(), 100);
            return;
        }

        const container = this.$refs.editorContainer || document.getElementById('note-editor');
        if (!container) {
            console.log('Editor container not found, retrying...');
            setTimeout(() => this.initCodeMirror(), 100);
            return;
        }

        if (this.editorView) {
            console.log('CodeMirror already initialized');
            return;
        }

        console.log('Initializing CodeMirror 6...');

        const { EditorView, EditorState, markdown, basicExtensions, Compartment } = window.CodeMirror;

        this.editorThemeCompartment = new Compartment();

        const self = this;

        // Update listener for content changes
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

        // Paste/drop handler for images
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

        // Create editor state
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

        // Create editor view
        this.editorView = new EditorView({
            state: startState,
            parent: container
        });

        console.log('CodeMirror 6 initialized successfully!');
    },

    // Update editor content (when loading a new note)
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

    // Get current editor content
    getEditorContent() {
        if (!this.editorView) return '';
        return this.editorView.state.doc.toString();
    },

    // Get cursor position
    getCursorPosition() {
        if (!this.editorView) return 0;
        return this.editorView.state.selection.main.head;
    },

    // Set cursor position
    setCursorPosition(pos) {
        if (!this.editorView) return;
        const { EditorSelection } = window.CodeMirror.EditorState;
        this.editorView.dispatch({
            selection: EditorSelection.cursor(pos)
        });
    },

    // Get selected text
    getSelectedText() {
        if (!this.editorView) return '';
        const selection = this.editorView.state.selection.main;
        return this.editorView.state.doc.sliceString(selection.from, selection.to);
    },

    // Get selection range
    getSelectionRange() {
        if (!this.editorView) return { from: 0, to: 0 };
        const selection = this.editorView.state.selection.main;
        return { from: selection.from, to: selection.to };
    },

    // Set selection range
    setSelectionRange(from, to) {
        if (!this.editorView) return;
        const { EditorSelection } = window.CodeMirror.EditorState;
        this.editorView.dispatch({
            selection: EditorSelection.range(from, to)
        });
        this.editorView.focus();
    },

    // Insert text at cursor
    insertTextAtCursor(text) {
        if (!this.editorView) return;
        const pos = this.getCursorPosition();
        this.editorView.dispatch({
            changes: { from: pos, insert: text }
        });
    },

    // Replace selection with text
    replaceSelection(text) {
        if (!this.editorView) return;
        const selection = this.editorView.state.selection.main;
        this.editorView.dispatch({
            changes: { from: selection.from, to: selection.to, insert: text },
            selection: { anchor: selection.from + text.length }
        });
    },

    // Focus editor
    focusEditor() {
        if (this.editorView) {
            this.editorView.focus();
        }
    },

    // Markdown formatting: wrap selection
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

    // Insert link
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

    // Insert a markdown table
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
};
