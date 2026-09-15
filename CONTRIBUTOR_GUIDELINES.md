# Benson Increments Calculator - Contributor Guidelines

## Adding New Benson Group Categories

The Benson Increments Calculator uses a modular CSV system that makes it easy for contributors to add new Benson group categories without modifying any code. Simply follow these guidelines to add your contributions.

This document is a friendly walkthrough. The authoritative reference for the
CSV format is [`README.md`](README.md)'s "Adding or changing increments"
section and [`.claude/rules/data.md`](.claude/rules/data.md) — if anything
here ever seems to disagree with either, they are right and this file is due
for an update.

### CSV File Naming Convention

All CSV files must follow this naming pattern:
```
NN_Category_Name.csv
```

Where:
- `NN` = Two-digit number for tab ordering (01, 02, 03, etc.)
- `Category_Name` = Descriptive name with underscores instead of spaces
- Examples:
  - `01_CH_Groups.csv` → "CH Groups" tab
  - `02_CHO_Groups.csv` → "CHO Groups" tab
  - `06_Heterocyclic_Rings.csv` → "Heterocyclic Rings" tab

### CSV File Structure

Each CSV file needs **two required columns**, matched by position (their
titles are free text):
1. **Group Name column**: Benson group names (e.g., `CH3`, `C-(C)(H)3`, `Ring Strain`)
2. **Value column**: values in kJ/mol (can be positive or negative numbers, or
   a published range like `1.05 to 1.76`, which is averaged)

Up to five **optional columns** may follow, found by header name rather than
position: `Unit`, `Uncertainty`, `Source`, `Verified`, `Note`. A file with
just the two required columns is still completely valid — the optional ones
exist for contributions that can cite where a value came from. See
[`.claude/rules/data.md`](.claude/rules/data.md) for what each one means and
how it's validated.

**Example CSV structure (two-column, the minimum):**
```csv
Group Name,kJ/mol
CH3,-42.3
CH2,-20.9
CH,-7.0
C,2.0
```

**With optional columns:**
```csv
Group Name,kJ/mol,Source,Verified,Note
CH3,-42.3,Cohen1993,,
```

### Step-by-Step Guide

1. **Choose a number**: Check existing CSV files and pick the next available number
2. **Create your CSV file**: Use Excel, Google Sheets, or any text editor
3. **Name your file**: Follow the `NN_Category_Name.csv` convention
4. **Add your data**: Include group names and their kJ/mol values, and a
   `Source` for each if you have one — see "Data Sources and References" below
5. **Validate and build**: run

   ```bash
   python tools/validate_data.py
   python tools/build_dist.py
   python tools/build_version.py
   ```

   `validate_data.py` catches the mistakes that actually happen — a missing
   value, a duplicate group name, a stray comma. The other two regenerate the
   generated artifact and the asset version your CSV change moves; CI
   regenerates both independently and fails if what you commit doesn't match.
6. **Submit a pull request**: include your CSV file together with the
   regenerated `dist/increments.json` and `index.html`

### Chemical Acronym Formatting

The system automatically formats tab titles with proper chemical notation:
- Chemical acronyms like CH, CHO, CHNO remain uppercase
- Other words are properly capitalized
- Examples:
  - `01_CH_Groups.csv` → "CH Groups"
  - `02_CHO_Groups.csv` → "CHO Groups"
  - `05_Cyclohexane_A_Values.csv` → "Cyclohexane A Values"

### Validation Rules

`python tools/validate_data.py` checks your file and reports every problem it
finds, not just the first:
- ✅ **Accepted**: two required columns, plus any of the five named optional
  ones (`Unit`, `Uncertainty`, `Source`, `Verified`, `Note`)
- ❌ **Refused, by name**: a missing group name or value, a duplicate group
  name (in this file or any other category file), a value that's neither a
  number nor a range, an optional column under a name the schema doesn't
  know, a `Source` that names no key in `data/references.csv`
- ✅ **Ordered**: numbered prefixes determine tab order

### Template Files

Use these templates as starting points:

**Basic Hydrocarbon Groups:**
```csv
Group Name,kJ/mol
CH3,-42.3
CH2,-20.9
CH,-7.0
C,2.0
```

**Ring Corrections:**
```csv
Correction,kJ/mol
3-membered ring,27.6
4-membered ring,26.1
5-membered ring,6.3
6-membered ring,0.0
```

**Functional Group Corrections:**
```csv
Correction,kJ/mol
-OH (aliphatic),-42.7
-COOH,-61.1
-NH2,-22.5
```

### Testing Your Contribution

1. Run `python tools/validate_data.py` and fix everything it reports
2. Run `python tools/build_dist.py` to regenerate `dist/increments.json`
3. Serve the site locally (`python -m http.server 8000`, then open
   `http://localhost:8000/`) and confirm your new tab appears with the
   correct title, values and buttons work
4. Run `python tools/build_version.py` last, so the asset version reflects
   your finished change

### Data Sources and References

Every value you add should be traceable to a printed source:

- Add a row to [`data/references.csv`](data/references.csv) for the work
  you're citing, and put its `Key` in your row's optional `Source` column.
  `validate_data.py` refuses a `Source` that names no key.
- Cite the original Benson method where applicable.
- Document any assumptions or modifications in the optional `Note` column.
- Provide an `Uncertainty` estimate if the source publishes one.

See [`.claude/rules/citations.md`](.claude/rules/citations.md) for how a
citation is checked against what its DOI actually resolves to.

### Quality Guidelines

- **Accuracy**: Verify values against reliable sources
- **Completeness**: Include all relevant groups for your category
- **Consistency**: Use consistent naming conventions
- **Documentation**: Provide clear descriptions and references

### Getting Help

If you need help:
1. Check existing CSV files for examples
2. Review the main README.md for system overview
3. Open an issue on GitHub for questions
4. Join the discussion in existing issues

### Example Contribution Workflow

```bash
# 1. Check existing files
ls CSV_data_files/

# 2. Create your CSV file
# (Use your preferred editor)

# 3. Validate and build
python tools/validate_data.py
python tools/build_dist.py
python tools/build_version.py

# 4. Submit your contribution
git add CSV_data_files/07_Your_Category.csv dist/increments.json index.html
git commit -m "Add new Benson group category: Your Category"
git push origin your-branch
```

Thank you for contributing to the Benson Increments Calculator! Your additions help expand the tool's capabilities for the chemistry community.
