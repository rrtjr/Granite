# Draw.io Diagrams

Granite supports **Draw.io** (diagrams.net) diagrams directly in your markdown notes! Draw.io provides a full-featured diagramming editor for creating flowcharts, UML diagrams, network diagrams, wireframes, and more.

## How to Use

Create a code block with the language set to `drawio`:

````markdown
```drawio
<mxGraphModel>...</mxGraphModel>
```
````

You can also add a name to your diagram:

````markdown
```drawio name="Architecture Diagram"
<mxGraphModel>...</mxGraphModel>
```
````

## Creating Diagrams

### Method 1: Click "New Diagram"

1. In your markdown, type the basic structure:
   ````markdown
   ```drawio

   ```
   ````
2. In the preview, you'll see a placeholder with "Click to edit"
3. Click the placeholder or the "Edit" button to open the Draw.io editor
4. Create your diagram using the visual editor
5. Click "Save and Exit" to embed the diagram in your note

### Method 2: Paste Existing XML

If you have an existing Draw.io diagram, you can paste its XML directly:

1. In Draw.io, go to **File > Export as > XML**
2. Copy the XML content
3. Paste it into a `drawio` code block

## Editor Features

The embedded Draw.io editor includes:

- **Full toolbar** with shapes, connectors, and formatting options
- **Shape libraries** for flowcharts, UML, AWS, Azure, network diagrams, and more
- **Layers and groups** for complex diagrams
- **Grid and guides** for precise alignment
- **Export options** for the final diagram

### Editor Buttons

| Button | Description |
|--------|-------------|
| **Save** | Saves the diagram without closing the editor |
| **Exit** | Closes the editor without saving |
| **Save and Exit** | Saves the diagram and closes the editor |

## SVG Preview Caching

Draw.io diagrams are automatically cached as SVG files for fast preview rendering:

- **Cache location**: `.drawio-cache/` folder in your notes directory
- **Cache key**: SHA-256 hash of the XML content (16-char hex)
- **Auto-cleanup**: Old cached files can be removed via the API
- **Persistence**: Previews survive page refreshes and browser restarts

### Cache Management API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/drawio-cache` | GET | Get cache statistics |
| `/api/drawio-cache` | POST | Save SVG to cache |
| `/api/drawio-cache/{hash}` | GET | Get cached SVG |
| `/api/drawio-cache/{hash}` | DELETE | Delete specific cache |
| `/api/drawio-cache/cleanup` | POST | Remove old files (default: 30 days) |
| `/api/drawio-cache` | DELETE | Clear all cached files |

## Theme Support

Draw.io diagrams support theme switching:

- **Light themes**: Editor uses light interface (`ui=kennedy`)
- **Dark themes**: Editor uses dark interface (`ui=dark`)
- The editor theme is automatically selected based on your current Granite theme

## Supported Views

Draw.io diagrams render in all Granite views:

| View | Rendering |
|------|-----------|
| **Preview pane** | Full SVG preview with toolbar |
| **Split view** | SVG preview in preview pane |
| **Rich Editor** | SVG preview block (read-only) |
| **Export** | Embedded in HTML export |

## Example Diagrams

### Simple Flowchart

Create a basic flowchart with start, decision, and end nodes:

1. Open the Draw.io editor
2. Drag shapes from the "Flowchart" palette
3. Connect shapes with arrows
4. Add text labels
5. Save and exit

### Network Diagram

Create network architecture diagrams:

1. Enable the "Network" shape library
2. Drag server, router, and cloud icons
3. Connect with network lines
4. Add IP addresses and labels

### UML Class Diagram

Create software design diagrams:

1. Enable the "UML" shape library
2. Drag class boxes
3. Add attributes and methods
4. Draw inheritance and association lines

## Tips

1. **Use layers**: Organize complex diagrams with layers for better maintainability
2. **Group elements**: Group related shapes to move them together
3. **Use styles**: Apply consistent colors and fonts across your diagram
4. **Keyboard shortcuts**: Use Ctrl+D to duplicate, Ctrl+G to group
5. **Zoom**: Use Ctrl+Mouse wheel to zoom in/out

## Troubleshooting

### Diagram shows "Click to edit" placeholder

This happens when:
- The diagram is new and hasn't been edited yet
- The cached SVG preview is missing

**Solution**: Click to open the editor, make any change, and save to generate the SVG preview.

### Preview doesn't update after editing

The cache might be stale. Try:
1. Hard refresh the page (Ctrl+Shift+R)
2. Clear the specific cache via API
3. Re-edit and save the diagram

### Editor doesn't load

The editor requires internet connectivity as it loads from `embed.diagrams.net`.

**Solution**: Ensure you have internet access. Preview will still work offline using cached SVGs.

## Technical Details

### XML Structure

Draw.io diagrams are stored as `mxGraphModel` XML:

```xml
<mxGraphModel dx="1234" dy="789" grid="1" ...>
  <root>
    <mxCell id="0"/>
    <mxCell id="1" parent="0"/>
    <mxCell id="2" value="Box" style="..." vertex="1" parent="1">
      <mxGeometry x="100" y="100" width="120" height="60" as="geometry"/>
    </mxCell>
  </root>
</mxGraphModel>
```

### Communication Protocol

The editor uses postMessage API for communication:

| Event | Direction | Description |
|-------|-----------|-------------|
| `init` | Editor → Granite | Editor is ready |
| `load` | Granite → Editor | Load diagram XML |
| `save` | Editor → Granite | User saved diagram |
| `exit` | Editor → Granite | User closed editor |
| `export` | Granite → Editor | Request SVG export |

## More Information

- [Draw.io Documentation](https://www.drawio.com/doc/)
- [Shape Libraries](https://www.drawio.com/shapes)
- [Keyboard Shortcuts](https://www.drawio.com/doc/faq/keyboard-shortcuts)

---

**Pro Tip**: Combine Draw.io diagrams with Mermaid for different use cases - use Mermaid for simple text-based diagrams that need version control, and Draw.io for complex visual diagrams with precise positioning!
