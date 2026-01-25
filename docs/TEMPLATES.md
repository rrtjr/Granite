# Note Templates

Create notes from reusable templates with dynamic placeholder replacement.

## Overview

Templates allow you to quickly create notes with predefined structures and content. Perfect for recurring note types like meeting notes, daily journals, project plans, and more.

## Zettelkasten Workflow

Granite's templates follow the **Zettelkasten** (slip-box) method for building a scalable knowledge base. The key insight is separating **source-based notes** from **concept-based notes**.

### Core Note Types

| Note Type | Purpose | Lifespan |
|-----------|---------|----------|
| **Fleeting Note** | Quick capture, brain dump | Temporary (process within 48-72h) |
| **Literature Note** | Process one specific source (paper, article, video) | Written once, rarely changed |
| **Atomic Note** | Define one specific concept | Permanent and evolving |
| **Research Note** | Investigate a specific question | Active during research |
| **MOC (Map of Content)** | Organize notes by domain | Evolving index |

### The Workflow

```
┌─────────────────┐
│  Fleeting Note  │  ← Quick capture
└────────┬────────┘
         │ Process within 48-72h
         ▼
┌─────────────────┐
│ Literature Note │  ← Reading a source
└────────┬────────┘
         │ Extract concepts
         ▼
┌─────────────────┐
│  Atomic Note    │  ← Permanent knowledge
└────────┬────────┘
         │ Organize
         ▼
┌─────────────────┐
│      MOC        │  ← Domain index
└─────────────────┘
```

### Why This Works

**Without atomic notes:** When you need to recall "How does AUC handle class imbalance?", you search through 50 different PDF notes to find the one that mentioned it.

**With atomic notes:** You open your `[[AUC]]` note, and the answer is right there, synthesized from all the papers you've ever read.

### Key Principles

1. **Literature Notes link TO Atomic Notes** - When reading Fawcett (2006), you link to `[[AUC]]`, not define AUC inline
2. **Atomic Notes link FROM multiple Literature Notes** - Your `[[AUC]]` note grows as you read more sources
3. **One concept per atomic note** - Keep them focused and linkable
4. **MOCs organize, not duplicate** - They index your atomic notes, not repeat their content

## How to Use Templates

### 1. Create Template Files

By default, templates are stored in the `data/_templates/` folder as markdown files. You will need to create such folder if it doesn't exist:

```
data/
└── _templates/
    ├── meeting-notes.md
    ├── daily-journal.md
    └── project-plan.md
```

**Custom Templates Location**

You can configure a custom templates folder location through **Settings → Folders & Paths → Templates Folder**:

- **Relative paths**: Specify relative to your notes directory (e.g., `my_templates` → `data/my_templates`)
- **Absolute paths**: Use absolute path for templates outside the notes directory
- **Hot-swap**: Changes take effect immediately without restart
- **Examples**:
  - `_templates` (default)
  - `Resources/Templates`
  - `templates/work`
  - `/absolute/path/to/templates`

### 2. Access Templates

Click the **"New"** button (or **+** on any folder) and select **"New from Template"**:

1. Choose a template from the dropdown
2. Enter a name for your new note
3. Click "Create Note"

The template will be copied with all placeholders replaced automatically!

### 3. Use Placeholders

Templates support dynamic placeholders that are replaced when you create a note:

| Placeholder | Description | Example |
|------------|-------------|---------|
| `{{date}}` | Current date | `2025-11-26` |
| `{{time}}` | Current time | `14:30:45` |
| `{{datetime}}` | Current date and time | `2025-11-26 14:30:45` |
| `{{timestamp}}` | Unix timestamp | `1732632645` |
| `{{title}}` | Note name (without .md) | `Weekly Meeting` |
| `{{folder}}` | Parent folder name | `Projects` |
| `{{created}}` | Current datetime for frontmatter | `2025-11-26 14:30:45` |
| `{{modified}}` | Current datetime for frontmatter | `2025-11-26 14:30:45` |

> **Note:** Date/time placeholders use your configured timezone from **Settings → Date & Time → Timezone**.

## Built-in Templates

Granite includes templates designed for the Zettelkasten workflow:

### Knowledge Capture

| Template | Use When | Creates |
|----------|----------|---------|
| `template_fleeting_note` | Quick idea capture | Temporary note to process later |
| `template_literature_note` | Reading a paper/article/book | Source-based note |
| `template_atomic_note` | Defining a concept | Permanent concept note |

### Research & Projects

| Template | Use When | Creates |
|----------|----------|---------|
| `template_research_note` | Investigating a question | Research documentation |
| `template_experiment` | Running an experiment | Experiment log |
| `template_project` | Managing a project | Project tracker |

### Organization

| Template | Use When | Creates |
|----------|----------|---------|
| `template_moc` | Organizing a domain | Map of Content index |

### Domain-Specific

| Template | Use When | Creates |
|----------|----------|---------|
| `template_trading_strategy` | Documenting a trading strategy | Strategy specification |

## Example: Literature Note Template

```markdown
---
type: literature
source_type: [paper|article|book|course|video|podcast]
status: processing
created: {{created}}
modified: {{modified}}
tags: [source]
---

# [Title of Source]

**Author:** [Name]
**Link:** [URL]

## Summary
What is this source about?

## Key Insights
1. The author argues that...
2. A key finding was...

## Concepts Extracted
Atomic notes created or updated from this source:
- [[Concept A]] - Brief note on what this source adds
- [[Concept B]] - Brief note on what this source adds

## Connections
- Supports ideas from [[Literature Note X]]
- Provides evidence for [[Atomic Note Z]]
```

## Example: Atomic Note Template

```markdown
---
type: concept
status: permanent
created: {{created}}
modified: {{modified}}
tags: [concept]
---

# [Concept Name]

## Definition
The formal definition of this concept.

## Why It Matters
Why is this concept important?

## Related Concepts
- [[Related Concept A]]
- [[Related Concept B]]

## References
Sources where this concept is discussed:
- Defined formally in [[Literature Note 1]]
- Practical examples in [[Literature Note 2]]
```

## Tips

- Templates can include YAML frontmatter for tags and metadata
- Use descriptive template names (they appear in the dropdown)
- Templates work in any folder - the context is preserved
- You can edit templates anytime - changes apply to new notes only
- Combine templates with tags for powerful organization
- **Start with fleeting notes** - Don't pressure yourself to write perfect notes immediately
- **Process regularly** - Review fleeting notes every few days
- **Link generously** - The value of Zettelkasten comes from connections

---

**See also:**
- [Tags Documentation](TAGS.md) - Learn about organizing with tags
- [Features Overview](FEATURES.md) - All application features
