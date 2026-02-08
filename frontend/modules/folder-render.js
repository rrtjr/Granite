// Granite Frontend - Folder Render Module
// Recursive folder tree rendering

export const folderRenderMixin = {
    // Render folder recursively (helper for deep nesting)
    renderFolderRecursive(folder, level = 0, isTopLevel = false) {
        if (!folder) return '';

        let html = '';
        const isExpanded = this.expandedFolders.has(folder.path);
        const escapedPath = folder.path.replace(/'/g, "\\'").replace(/\\/g, "\\\\");

        html += `
            <div>
                <div
                    draggable="true"
                    ondragstart="window.$root.onFolderDragStart('${escapedPath}', event)"
                    ondragend="window.$root.onFolderDragEnd()"
                    ondragover="event.preventDefault(); window.$root.dragOverFolder = '${escapedPath}'; this.classList.add('drag-over')"
                    ondragenter="event.preventDefault(); window.$root.dragOverFolder = '${escapedPath}'; this.classList.add('drag-over')"
                    ondragleave="window.$root.dragOverFolder = null; this.classList.remove('drag-over')"
                    ondrop="event.stopPropagation(); this.classList.remove('drag-over'); window.$root.onFolderDrop('${escapedPath}')"
                    onclick="window.$root.toggleFolder('${escapedPath}')"
                    onmouseover="if(!window.$root.draggedNote && !window.$root.draggedFolder) this.style.backgroundColor='var(--bg-hover)'"
                    onmouseout="if(!window.$root.draggedNote && !window.$root.draggedFolder) this.style.backgroundColor='transparent'"
                    class="folder-item px-2 py-1 text-sm relative"
                    role="treeitem"
                    aria-expanded="${isExpanded}"
                    style="color: var(--text-primary); cursor: pointer;"
                >
                    <div class="flex items-center gap-1">
                        <button
                            class="flex-shrink-0 w-4 h-4 flex items-center justify-center"
                            style="color: var(--text-tertiary); cursor: pointer; transition: transform 0.2s; pointer-events: none; margin-left: -5px; ${isExpanded ? 'transform: rotate(90deg);' : ''}"
                        >
                            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                                <path d="M6 4l4 4-4 4V4z"/>
                            </svg>
                        </button>
                        <span class="flex items-center gap-1 flex-1" style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500; pointer-events: none;">
                            <span>${folder.name}</span>
                            ${folder.notes.length === 0 && (!folder.children || Object.keys(folder.children).length === 0) ? '<span class="text-xs" style="color: var(--text-tertiary); font-weight: 400;">(empty)</span>' : ''}
                        </span>
                    </div>
                    <div class="hover-buttons flex gap-1 transition-opacity absolute right-2 top-1/2 transform -translate-y-1/2" style="opacity: 0; pointer-events: none; background: linear-gradient(to right, transparent, var(--bg-hover) 20%, var(--bg-hover)); padding-left: 20px;" onclick="event.stopPropagation()">
                        <button
                            onclick="event.stopPropagation(); window.$root.dropdownTargetFolder = '${escapedPath}'; window.$root.toggleNewDropdown(event)"
                            class="px-1.5 py-0.5 text-xs rounded hover:brightness-110"
                            style="background-color: var(--bg-tertiary); color: var(--text-secondary);"
                            title="Add item here"
                        >+</button>
                        <button
                            onclick="event.stopPropagation(); window.$root.renameFolder('${escapedPath}', '${folder.name.replace(/'/g, "\\'").replace(/\\/g, "\\\\")}')"
                            class="px-1.5 py-0.5 text-xs rounded hover:brightness-110"
                            style="background-color: var(--bg-tertiary); color: var(--text-secondary);"
                            title="Rename folder"
                        >✏️</button>
                        <button
                            onclick="event.stopPropagation(); window.$root.deleteFolder('${escapedPath}', '${folder.name.replace(/'/g, "\\'").replace(/\\/g, "\\\\")}')"
                            class="px-1 py-0.5 text-xs rounded hover:brightness-110"
                            style="color: var(--error);"
                            title="Delete folder"
                        >
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                            </svg>
                        </button>
                    </div>
                </div>
        `;

        if (isExpanded) {
            html += `<div class="folder-contents" role="group" style="padding-left: 10px;">`;

            if (folder.children && Object.keys(folder.children).length > 0) {
                const children = Object.entries(folder.children).sort((a, b) =>
                    a[1].name.toLowerCase().localeCompare(b[1].name.toLowerCase())
                );

                children.forEach(([childKey, childFolder]) => {
                    html += this.renderFolderRecursive(childFolder, 0, false);
                });
            }

            if (folder.notes && folder.notes.length > 0) {
                folder.notes.forEach(note => {
                    const isImage = note.type === 'image';
                    const isCurrentNote = this.currentNote === note.path;
                    const isCurrentImage = this.currentImage === note.path;
                    const isCurrent = isImage ? isCurrentImage : isCurrentNote;
                    const icon = isImage ? '🖼️' : '';

                    const escapedNotePath = note.path.replace(/'/g, "\\'").replace(/\\/g, "\\\\");
                    const escapedNoteName = note.name.replace(/'/g, "\\'").replace(/\\/g, "\\\\");

                    const clickHandler = `window.$root.openItem('${escapedNotePath}', '${note.type}')`;
                    const deleteHandler = isImage
                        ? `event.stopPropagation(); window.$root.deleteImage('${escapedNotePath}')`
                        : `event.stopPropagation(); window.$root.deleteNote('${escapedNotePath}', '${escapedNoteName}')`;

                    const isFavorited = !isImage && this.isFavorite(note.path);
                    const favoriteHandler = isImage ? '' : `event.stopPropagation(); window.$root.toggleFavorite('${escapedNotePath}')`;

                    html += `
                        <div
                            draggable="true"
                            ondragstart="window.$root.onNoteDragStart('${escapedNotePath}', event)"
                            ondragend="window.$root.onNoteDragEnd()"
                            onclick="${clickHandler}"
                            class="note-item px-2 py-1 text-sm relative"
                            style="${isCurrent ? 'background-color: var(--accent-light); color: var(--accent-primary);' : 'color: var(--text-primary);'} ${isImage ? 'opacity: 0.85;' : ''} cursor: pointer;"
                            onmouseover="if('${escapedNotePath}' !== window.$root.currentNote && '${escapedNotePath}' !== window.$root.currentImage) this.style.backgroundColor='var(--bg-hover)'"
                            onmouseout="if('${escapedNotePath}' !== window.$root.currentNote && '${escapedNotePath}' !== window.$root.currentImage) this.style.backgroundColor='transparent'"
                        >
                            <span class="truncate" style="display: block; padding-right: 50px;">${icon}${icon ? ' ' : ''}${note.name}</span>
                            ${!isImage ? `
                            <button
                                onclick="${favoriteHandler}"
                                class="note-favorite-btn absolute right-8 top-1/2 transform -translate-y-1/2 px-1 py-0.5 text-xs rounded hover:brightness-110 transition-opacity"
                                style="${isFavorited ? 'opacity: 1; color: var(--warning);' : 'opacity: 0; color: var(--text-tertiary);'}"
                                title="${isFavorited ? 'Remove from favorites' : 'Add to favorites'}"
                            >
                                <svg class="w-4 h-4" fill="${isFavorited ? 'currentColor' : 'none'}" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/>
                                </svg>
                            </button>
                            ` : ''}
                            <button
                                onclick="${deleteHandler}"
                                class="note-delete-btn absolute right-2 top-1/2 transform -translate-y-1/2 px-1 py-0.5 text-xs rounded hover:brightness-110 transition-opacity"
                                style="opacity: 0; color: var(--error);"
                                title="${isImage ? 'Delete image' : 'Delete note'}"
                            >
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                                </svg>
                            </button>
                        </div>
                    `;
                });
            }

            html += `</div>`;
        }

        html += `</div>`;
        return html;
    },
};
