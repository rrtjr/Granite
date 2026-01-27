// Tiptap bundle entry point - exports everything needed for Granite Rich view
// This file is bundled by esbuild into frontend/tiptap.bundle.js

import { Editor, Node, Mark, Extension, mergeAttributes } from '@tiptap/core';
import { StarterKit } from '@tiptap/starter-kit';
import { Placeholder } from '@tiptap/extension-placeholder';
import { Link } from '@tiptap/extension-link';
import { Image } from '@tiptap/extension-image';
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { Mathematics } from '@tiptap/extension-mathematics';
import { BubbleMenu } from '@tiptap/extension-bubble-menu';
import Typography from '@tiptap/extension-typography';
import { Underline } from '@tiptap/extension-underline';
import { Highlight } from '@tiptap/extension-highlight';
import { CharacterCount } from '@tiptap/extension-character-count';
import { common, createLowlight } from 'lowlight';
import TurndownService from 'turndown';

// Create lowlight instance with common languages
const lowlight = createLowlight(common);

// Export as global window object
window.Tiptap = {
    // Core
    Editor,
    Node,
    Mark,
    Extension,
    mergeAttributes,

    // Extensions
    StarterKit,
    Placeholder,
    Link,
    Image,
    CodeBlockLowlight,
    Table,
    TableRow,
    TableCell,
    TableHeader,
    TaskList,
    TaskItem,
    Mathematics,
    BubbleMenu,
    Typography,
    Underline,
    Highlight,
    CharacterCount,

    // Utilities
    lowlight,
    TurndownService,
};

// Signal that Tiptap is ready
window.TiptapReady = true;
if (window.GRANITE_DEBUG) console.log('[Granite] Tiptap bundle loaded successfully');
window.dispatchEvent(new Event('tiptap-ready'));
