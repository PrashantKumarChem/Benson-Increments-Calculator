# Benson Increments Calculator - Contributor Guidelines

## Adding New Benson Group Categories

The Benson Increments Calculator uses a modular CSV system that makes it easy for contributors to add new Benson group categories without modifying any code. Simply follow these guidelines to add your contributions.

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

Each CSV file must have **exactly 2 columns**:
1. **Group Name Column**: Benson group names (e.g., "CH₃", "C-(C)(H)₃", "Ring Strain")
2. **Value Column**: kJ/mol values (can be positive or negative numbers)

**Example CSV structure:**
```csv
Group Name,kJ/mol
CH₃,-42.3
CH₂,-20.9
CH,-7.0
C,2.0
```

### Step-by-Step Guide

1. **Choose a number**: Check existing CSV files and pick the next available number
2. **Create your CSV file**: Use Excel, Google Sheets, or any text editor
3. **Name your file**: Follow the `NN_Category_Name.csv` convention
4. **Add your data**: Include group names and their kJ/mol values
5. **Test your file**: Place it in the `CSV_data_files/` folder and run the notebook
6. **Submit a pull request**: Include your CSV file and any relevant documentation

### Chemical Acronym Formatting

The system automatically formats tab titles with proper chemical notation:
- Chemical acronyms like CH, CHO, CHNO remain uppercase
- Other words are properly capitalized
- Examples:
  - `01_CH_Groups.csv` → "CH Groups"
  - `02_CHO_Groups.csv` → "CHO Groups"
  - `05_Cyclohexane_A_Values.csv` → "Cyclohexane A Values"

### Validation Rules

The system will automatically validate your CSV file:
- ✅ **Accepted**: Files with exactly 2 columns
- ⚠️ **Warning**: Files with wrong number of columns are skipped
- ✅ **Processed**: Valid group-value pairs only (ignores empty rows)
- ✅ **Ordered**: Numbered prefixes determine tab order

### Template Files

Use these templates as starting points:

**Basic Hydrocarbon Groups:**
```csv
Group Name,kJ/mol
CH₃,-42.3
CH₂,-20.9
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
-NH₂,-22.5
```

### Testing Your Contribution

1. Place your CSV file in the `CSV_data_files/` folder
2. Run the Benson Increments Calculator notebook
3. Verify your new tab appears with the correct title
4. Test that buttons work and add correct values
5. Check that calculations are accurate

### Data Sources and References

When contributing new data, please:
- Include references to literature sources
- Cite the original Benson method where applicable
- Document any assumptions or modifications
- Provide uncertainty estimates if available

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

# 3. Test locally
# Run the notebook and verify your tab appears

# 4. Submit your contribution
git add CSV_data_files/07_Your_Category.csv
git commit -m "Add new Benson group category: Your Category"
git push origin your-branch
```

Thank you for contributing to the Benson Increments Calculator! Your additions help expand the tool's capabilities for the chemistry community.