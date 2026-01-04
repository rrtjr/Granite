# Tags

## Overview

Organize and filter your notes using tags defined in YAML frontmatter.

## Basic Usage

Add tags to the top of your note:

```markdown
---
tags: [python, tutorial]
---

# Your Note Content

The rest of your note goes here...
```

## Syntax Formats

### Inline Array (Recommended)
```yaml
---
tags: [python, tutorial, backend]
---
```

### Multi-line List
```yaml
---
tags:
  - python
  - tutorial
  - backend
---
```

### Single Tag
```yaml
---
tags: python
---
```

## Features

### Filtering
- Click any tag in the sidebar to filter notes
- Select multiple tags to combine filters (AND logic)
- Only notes with ALL selected tags are shown
- Tag count badge shows number of notes per tag

### Combined Search
- Use tags alone to filter by category
- Use text search alone to find content
- Combine both to narrow results (e.g., search "async" in notes tagged "python")

### Display Modes

| Filter Type | Display |
|------------|---------|
| None | Full folder tree |
| Tags only | Flat list of matching notes |
| Text only | Search results with matches |
| Tags + Text | Combined filtered results |

## Tips

- **Tag names**: Lowercase, no spaces (e.g., `python`, `work-notes`)
- **Consistency**: Use consistent tag names across notes
- **Hierarchy**: Use related tags (e.g., `python`, `python-async`, `python-web`)
- **Don't overdo it**: 3-5 tags per note is usually sufficient

## Frontmatter Rules

- Must start with `---` on the first line
- Must end with `---` on its own line
- Content between markers is YAML format
- Frontmatter is hidden from preview

## Examples

### Project Organization
```markdown
---
tags: [project, backend, api]
---

# API Documentation
```

### Knowledge Base
```markdown
---
tags: [tutorial, beginner, docker]
---

# Getting Started with Docker
```

### Work Notes
```markdown
---
tags: [meeting, q4-2024, planning]
---

# Q4 Planning Meeting Notes
```

