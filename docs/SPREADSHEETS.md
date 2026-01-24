# Spreadsheets

Granite supports **Excel-like spreadsheets** directly in your markdown notes! Create tables with formulas, add or remove rows and columns, and have calculations update automatically.

## How to Use

Create a code block with the language set to `spreadsheet`:

````markdown
```spreadsheet
Name,Value,Total
Item 1,100,=B2*1.1
Item 2,200,=B3*1.1
```
````

The spreadsheet will render as an interactive table. Click on it to edit.

## Basic Example

````markdown
```spreadsheet
Product,Price,Quantity,Total
Laptop,1000,2,=B2*C2
Phone,500,3,=B3*C3
Tablet,300,4,=B4*C4
Grand Total,,,=SUM(D2:D4)
```
````

**Features:**
- First row is treated as headers (bold)
- Click the table to enter edit mode
- Use `+ Row` / `+ Column` buttons to add cells
- Use `- Row` / `- Col` buttons to remove cells
- Changes auto-save to your note

---

## Formula Syntax

Spreadsheets support Excel-style formulas. All formulas start with `=`.

### Cell References

| Reference | Description |
|-----------|-------------|
| `A1` | Single cell (column A, row 1) |
| `B2` | Single cell (column B, row 2) |
| `A1:A10` | Range (cells A1 through A10) |
| `B2:D5` | Range (rectangular block) |

### Basic Math

| Formula | Description |
|---------|-------------|
| `=A1+B1` | Addition |
| `=A1-B1` | Subtraction |
| `=A1*B1` | Multiplication |
| `=A1/B1` | Division |
| `=A1^2` | Power (A1 squared) |
| `=(A1+B1)*C1` | Parentheses for order |

### Common Functions

| Function | Example | Description |
|----------|---------|-------------|
| `SUM` | `=SUM(A1:A10)` | Sum of values |
| `AVERAGE` | `=AVERAGE(B2:B5)` | Average of values |
| `MIN` | `=MIN(C1:C100)` | Minimum value |
| `MAX` | `=MAX(D1:D50)` | Maximum value |
| `COUNT` | `=COUNT(E1:E20)` | Count of numbers |
| `IF` | `=IF(A1>0,B1,C1)` | Conditional |

---

## Examples

### Budget Tracker

````markdown
```spreadsheet
Category,Budget,Spent,Remaining
Rent,1500,1500,=B2-C2
Utilities,200,150,=B3-C3
Groceries,400,380,=B4-C4
Transport,150,120,=B5-C5
Total,=SUM(B2:B5),=SUM(C2:C5),=SUM(D2:D5)
```
````

### Grade Calculator

````markdown
```spreadsheet
Student,Test 1,Test 2,Test 3,Average
Alice,85,90,88,=AVERAGE(B2:D2)
Bob,78,82,80,=AVERAGE(B3:D3)
Charlie,92,95,91,=AVERAGE(B4:D4)
Class Average,=AVERAGE(B2:B4),=AVERAGE(C2:C4),=AVERAGE(D2:D4),=AVERAGE(E2:E4)
```
````

### Sales Report

````markdown
```spreadsheet
Month,Units,Price,Revenue,Tax,Net
January,100,25,=B2*C2,=D2*0.1,=D2-E2
February,120,25,=B3*C3,=D3*0.1,=D3-E3
March,150,25,=B4*C4,=D4*0.1,=D4-E4
Total,=SUM(B2:B4),,=SUM(D2:D4),=SUM(E2:E4),=SUM(F2:F4)
```
````

---

## Editing Spreadsheets

### Static View
When you first view a note, spreadsheets appear as static tables with calculated values displayed.

### Edit Mode
Click anywhere on the spreadsheet to enter edit mode:
- Cell inputs appear for direct editing
- Toolbar with row/column controls appears
- Type formulas or values directly
- Press **Tab** to move to the next cell
- Press **Enter** to move to the cell below
- Press **Arrow keys** to navigate
- Click outside to save and exit

### Row & Column Operations
In edit mode, use the toolbar buttons:
- **+ Row** - Add a new row at the bottom
- **+ Column** - Add a new column on the right
- **- Row** - Remove the last row
- **- Col** - Remove the last column

---

## CSV Format

Spreadsheet data is stored as CSV (comma-separated values) in your markdown file:

```
Name,Value,Total
Item 1,100,=B2*1.1
```

### Special Characters
- Values with commas must be quoted: `"Smith, John"`
- Quotes in values use double quotes: `"Say ""Hello"""`
- Empty cells are just empty between commas: `A,,C`

---

## Tips

1. **Start simple** - Build your spreadsheet incrementally
2. **Check formulas** - If a cell shows an error, verify your formula syntax
3. **Use ranges** - `SUM(A1:A10)` is cleaner than `A1+A2+A3+...`
4. **Headers help** - Put descriptive headers in the first row
5. **Save often** - Changes auto-save, but give it a moment after editing

## Limitations

- Large spreadsheets (100+ rows) may slow down rendering
- Complex nested formulas may take longer to calculate
- Not all Excel functions are supported (see HyperFormula documentation for full list)

## Technical Details

Spreadsheets are powered by [HyperFormula](https://hyperformula.handsontable.com/), an open-source spreadsheet calculation engine. It supports:
- 400+ built-in functions
- Named expressions
- Cross-sheet references (not yet exposed in Granite)
- Array formulas

For the complete function reference, see the [HyperFormula documentation](https://hyperformula.handsontable.com/guide/built-in-functions.html).

---

**Pro Tip**: Combine spreadsheets with Mermaid diagrams to create dynamic reports - calculate your data in a spreadsheet and visualize it with a chart!
