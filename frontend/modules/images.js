// Granite Frontend - Images Module

import { ErrorHandler } from './config.js';

export const imagesMixin = {
    // Handle note drag start
    onNoteDragStart(notePath, event) {
        const item = this.notes.find(n => n.path === notePath);
        const isImage = item && item.type === 'image';

        this.draggedItem = {
            path: notePath,
            type: isImage ? 'image' : 'note'
        };

        this.draggedNote = notePath;

        if (event.target) {
            event.target.style.opacity = '0.5';
        }

        event.dataTransfer.effectAllowed = 'all';
    },

    onNoteDragEnd() {
        this.draggedNote = null;
        this.draggedItem = null;
        this.dropTarget = null;
        this.dragOverFolder = null;
        document.querySelectorAll('.note-item').forEach(el => el.style.opacity = '1');
        document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    },

    // Handle dragover on editor
    onEditorDragOver(event) {
        if (!this.draggedItem) return;
        event.preventDefault();
        this.dropTarget = 'editor';

        const textarea = event.target;
        textarea.focus();

        if (textarea.setSelectionRange && document.caretPositionFromPoint) {
            const pos = document.caretPositionFromPoint(event.clientX, event.clientY);
            if (pos && pos.offsetNode === textarea) {
                textarea.setSelectionRange(pos.offset, pos.offset);
            }
        }
    },

    onEditorDragEnter(event) {
        if (!this.draggedItem) return;
        event.preventDefault();
        this.dropTarget = 'editor';
    },

    onEditorDragLeave(event) {
        if (event.target.tagName === 'TEXTAREA') {
            this.dropTarget = null;
        }
    },

    // Handle drop into editor
    async onEditorDrop(event, view) {
        event.preventDefault();
        this.dropTarget = null;

        // Check if files are being dropped
        if (event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files.length > 0) {
            await this.handleImageDrop(event, view);
            return false;
        }

        if (!this.draggedItem) return false;

        const notePath = this.draggedItem.path;
        const isImage = this.draggedItem.type === 'image';

        let link;
        if (isImage) {
            const filename = notePath.split('/').pop().replace(/\.[^/.]+$/, '');
            link = `![${filename}](${notePath})`;
        } else {
            const noteName = notePath.split('/').pop().replace('.md', '');
            const encodedPath = notePath.split('/').map(segment => encodeURIComponent(segment)).join('/');
            link = `[${noteName}](${encodedPath})`;
        }

        if (view) {
            const pos = view.posAtCoords({ x: event.clientX, y: event.clientY }) || this.getCursorPosition();
            view.dispatch({
                changes: { from: pos, insert: link },
                selection: { anchor: pos + link.length }
            });
        } else {
            this.insertTextAtCursor(link);
        }

        this.draggedItem = null;
        return true;
    },

    // Handle image files dropped into editor
    async handleImageDrop(event, view) {
        if (!this.currentNote) {
            alert('Please open a note first before uploading images.');
            return;
        }

        const files = Array.from(event.dataTransfer.files);
        const imageFiles = files.filter(file => {
            const type = file.type.toLowerCase();
            return type.startsWith('image/') &&
                   ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'].includes(type);
        });

        if (imageFiles.length === 0) {
            alert('No valid image files found. Supported formats: JPG, PNG, GIF, WEBP');
            return;
        }

        const cursorPos = view ? (view.posAtCoords({ x: event.clientX, y: event.clientY }) || this.getCursorPosition()) : this.getCursorPosition();

        for (const file of imageFiles) {
            try {
                const imagePath = await this.uploadImage(file, this.currentNote);
                if (imagePath) {
                    this.insertImageMarkdown(imagePath, file.name, cursorPos);
                }
            } catch (error) {
                ErrorHandler.handle(`upload image ${file.name}`, error);
            }
        }
    },

    // Upload an image file
    async uploadImage(file, notePath) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('note_path', notePath);

        try {
            const response = await fetch('/api/upload-image', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Upload failed');
            }

            const data = await response.json();
            return data.path;
        } catch (error) {
            throw error;
        }
    },

    // Insert image markdown at cursor position
    insertImageMarkdown(imagePath, altText, cursorPos) {
        const filename = imagePath.split('/').pop() || imagePath;
        const markdown = `![[${filename}]]\n`;

        if (this.editorView) {
            this.editorView.dispatch({
                changes: { from: cursorPos, insert: markdown }
            });
        } else {
            const textBefore = this.noteContent.substring(0, cursorPos);
            const textAfter = this.noteContent.substring(cursorPos);
            this.noteContent = textBefore + markdown + textAfter;
        }

        this.loadNotes();
    },

    // Synchronously check if we should handle image paste
    shouldHandleImagePaste(event) {
        if (!this.currentNote) return false;

        const items = event.clipboardData?.items;
        if (!items) return false;

        let hasImage = false;
        for (const item of items) {
            if (item.type.startsWith('image/')) {
                hasImage = true;
                break;
            }
        }

        if (!hasImage) return false;

        const text = event.clipboardData?.getData('text/plain') || '';
        const trimmedText = text.trim();

        if (trimmedText.length === 0 || trimmedText.length < 100) {
            return true;
        }

        return false;
    },

    // Handle image paste asynchronously
    async handleImagePasteAsync(event) {
        event.preventDefault();

        const items = event.clipboardData?.items;
        if (!items) return;

        for (const item of items) {
            if (item.type.startsWith('image/')) {
                const blob = item.getAsFile();
                if (blob) {
                    try {
                        const cursorPos = this.getCursorPosition();
                        const ext = item.type.split('/')[1] || 'png';
                        const filename = `pasted-image.${ext}`;
                        const file = new File([blob], filename, { type: item.type });

                        const imagePath = await this.uploadImage(file, this.currentNote);
                        if (imagePath) {
                            this.insertImageMarkdown(imagePath, filename, cursorPos);
                        }
                    } catch (error) {
                        ErrorHandler.handle('paste image', error);
                    }
                }
                break;
            }
        }
    },

    // Open a note or image
    openItem(path, type = 'note', searchHighlight = '') {
        this.showGraph = false;
        if (type === 'image' || path.match(/\.(png|jpg|jpeg|gif|webp)$/i)) {
            this.viewImage(path);
        } else {
            this.loadNote(path, true, searchHighlight);
        }
    },

    // View an image in the main pane
    viewImage(imagePath, updateHistory = true) {
        this.showGraph = false;
        this.currentNote = '';
        this.currentNoteName = '';
        this.noteContent = '';
        this.currentImage = imagePath;
        this.viewMode = 'preview';

        if (updateHistory) {
            const encodedPath = imagePath.split('/').map(segment => encodeURIComponent(segment)).join('/');
            window.history.pushState(
                { imagePath: imagePath },
                '',
                `/${encodedPath}`
            );
        }
    },

    // Delete an image
    async deleteImage(imagePath) {
        const filename = imagePath.split('/').pop();
        if (!confirm(`Delete image "${filename}"?`)) return;

        try {
            const response = await fetch(`/api/notes/${encodeURIComponent(imagePath)}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                await this.loadNotes();

                if (this.currentImage === imagePath) {
                    this.currentImage = '';
                }
            } else {
                throw new Error('Failed to delete image');
            }
        } catch (error) {
            ErrorHandler.handle('delete image', error);
        }
    },

    // Parse banner URL from YAML frontmatter
    parseBannerFromContent(content) {
        if (!content || !content.trim().startsWith('---')) {
            return null;
        }

        try {
            const lines = content.split('\n');
            if (lines[0].trim() !== '---') return null;

            let endIdx = -1;
            for (let i = 1; i < lines.length; i++) {
                if (lines[i].trim() === '---') {
                    endIdx = i;
                    break;
                }
            }

            if (endIdx === -1) return null;

            const frontmatterLines = lines.slice(1, endIdx);

            for (const line of frontmatterLines) {
                const stripped = line.trim();

                if (stripped.startsWith('banner:')) {
                    let value = stripped.substring(7).trim();

                    if ((value.startsWith('"') && value.endsWith('"')) ||
                        (value.startsWith("'") && value.endsWith("'"))) {
                        value = value.substring(1, value.length - 1);
                    }

                    if (!value) return null;

                    if (value.startsWith('http://') || value.startsWith('https://')) {
                        return { url: value, isExternal: true };
                    }

                    const wikiMatch = value.match(/^\[\[([^\]]+)\]\]$/);
                    if (wikiMatch) {
                        value = wikiMatch[1].trim();
                    }

                    const allImages = this.notes.filter(n => n.type === 'image');
                    const valueLower = value.toLowerCase();

                    const foundImage = allImages.find(img => {
                        const nameLower = img.name.toLowerCase();
                        return (
                            img.name === value ||
                            nameLower === valueLower ||
                            img.path === value ||
                            img.path.toLowerCase() === valueLower ||
                            img.path.endsWith('/' + value) ||
                            img.path.toLowerCase().endsWith('/' + valueLower)
                        );
                    });

                    if (foundImage) {
                        const encodedPath = foundImage.path.split('/').map(segment => encodeURIComponent(segment)).join('/');
                        return { url: `/api/images/${encodedPath}`, isExternal: false };
                    }

                    return null;
                }
            }

            return null;
        } catch (e) {
            console.error('Error parsing banner:', e);
            return null;
        }
    },

    // Folder drag handlers
    onFolderDragStart(folderPath, event) {
        this.draggedFolder = folderPath;
        if (event && event.target) {
            event.target.style.opacity = '0.5';
        }
    },

    onFolderDragEnd() {
        this.draggedFolder = null;
        this.dropTarget = null;
        this.dragOverFolder = null;
        document.querySelectorAll('.folder-item').forEach(el => el.style.opacity = '1');
        document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    },

    cancelDrag() {
        this.draggedNote = null;
        this.draggedFolder = null;
        this.draggedItem = null;
        this.dropTarget = null;
        this.dragOverFolder = null;
        document.querySelectorAll('.folder-item').forEach(el => el.style.opacity = '1');
        document.querySelectorAll('.note-item').forEach(el => el.style.opacity = '1');
        document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    },

    // Handle drop into folder
    async onFolderDrop(targetFolderPath) {
        if (this.dropTarget === 'editor') {
            return;
        }

        if (this.draggedNote) {
            const item = this.notes.find(n => n.path === this.draggedNote);
            if (!item) return;

            const filename = item.path.split('/').pop();
            const newPath = targetFolderPath ? `${targetFolderPath}/${filename}` : filename;

            if (newPath === this.draggedNote) {
                this.draggedNote = null;
                return;
            }

            const isImage = item.type === 'image';

            try {
                const response = await fetch('/api/notes/move', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        oldPath: this.draggedNote,
                        newPath: newPath
                    })
                });

                if (response.ok) {
                    await this.loadNotes();
                    if (isImage && this.currentImage === this.draggedNote) {
                        this.currentImage = newPath;
                    } else if (!isImage && this.currentNote === this.draggedNote) {
                        this.currentNote = newPath;
                    }
                } else {
                    alert(`Failed to move ${isImage ? 'image' : 'note'}.`);
                }
            } catch (error) {
                console.error(`Failed to move ${isImage ? 'image' : 'note'}:`, error);
                alert(`Failed to move ${isImage ? 'image' : 'note'}.`);
            }

            this.draggedNote = null;
            this.draggedItem = null;
            return;
        }

        if (this.draggedFolder) {
            if (targetFolderPath === this.draggedFolder ||
                targetFolderPath.startsWith(this.draggedFolder + '/')) {
                alert('Cannot move folder into itself or its subfolder.');
                this.draggedFolder = null;
                return;
            }

            const folderName = this.draggedFolder.split('/').pop();
            const newPath = targetFolderPath ? `${targetFolderPath}/${folderName}` : folderName;

            if (newPath === this.draggedFolder) {
                this.draggedFolder = null;
                return;
            }

            try {
                const response = await fetch('/api/folders/move', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        oldPath: this.draggedFolder,
                        newPath: newPath
                    })
                });

                if (response.ok) {
                    await this.loadNotes();
                    if (this.currentNote && this.currentNote.startsWith(this.draggedFolder + '/')) {
                        this.currentNote = this.currentNote.replace(this.draggedFolder, newPath);
                    }
                } else {
                    alert('Failed to move folder.');
                }
            } catch (error) {
                console.error('Failed to move folder:', error);
                alert('Failed to move folder.');
            }

            this.draggedFolder = null;
            this.dropTarget = null;
        }
    },
};
