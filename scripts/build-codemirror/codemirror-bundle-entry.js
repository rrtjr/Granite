// CodeMirror 6 bundle entry point - exports everything needed for Granite
import {EditorView, lineNumbers, highlightActiveLineGutter, highlightSpecialChars,
        drawSelection, dropCursor, rectangularSelection, crosshairCursor,
        highlightActiveLine, keymap} from "@codemirror/view";
import {EditorState, Compartment} from "@codemirror/state";
import {markdown} from "@codemirror/lang-markdown";
import {defaultKeymap, history, historyKeymap, indentWithTab} from "@codemirror/commands";
import {searchKeymap} from "@codemirror/search";
import {autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap} from "@codemirror/autocomplete";
import {lintKeymap} from "@codemirror/lint";
import {foldGutter, indentOnInput, bracketMatching, foldKeymap} from "@codemirror/language";

// Create basic extensions array
const basicExtensions = [
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightSpecialChars(),
    history(),
    foldGutter(),
    drawSelection(),
    dropCursor(),
    EditorState.allowMultipleSelections.of(true),
    indentOnInput(),
    bracketMatching(),
    closeBrackets(),
    rectangularSelection(),
    crosshairCursor(),
    highlightActiveLine(),
    keymap.of([
        ...defaultKeymap,
        ...historyKeymap,
        ...foldKeymap,
        ...completionKeymap,
        ...lintKeymap,
        ...searchKeymap,
        ...closeBracketsKeymap,
        {key: "Tab", run: indentWithTab}
    ]),
    autocompletion()
];

// Export as global
window.CodeMirror = {
    EditorView,
    EditorState,
    markdown,
    basicExtensions,
    Compartment
};

window.CodeMirrorReady = true;
console.log('CodeMirror 6 bundle loaded successfully (local bundle, single shared state)');
window.dispatchEvent(new Event('codemirror-ready'));
