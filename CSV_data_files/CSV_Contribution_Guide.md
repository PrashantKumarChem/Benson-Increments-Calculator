# Contributing to the Increment Correction Table CSV

This guide explains how to contribute to the `increment_correction_table.csv` file by adding new Benson group increments, CHO increments, or correction values.

## Overview

The `increment_correction_table.csv` is the data source for the Benson Increments Calculator. It contains three main categories of data:

1. **CH Benson Group Increments**: Increments for carbon-hydrogen groups
2. **CHO Benson Group Increments**: Increments for carbon-hydrogen-oxygen groups  
3. **Corrections**: Additional correction factors for specific molecular features

## CSV Structure

The CSV file must have the following columns:

- `CH Benson Group Increment`: Names/symbols for CH group increments (e.g., "CH₃", "CH₂", etc.)
- `Delta_Hf kJ/mol`: Numerical increment values in kJ/mol for CH groups
- `CHO Benson Group Increment`: Names/symbols for CHO group increments
- `CHO Values`: Numerical increment values in kJ/mol for CHO groups
- `Correction`: Names of correction factors (e.g., "Ring Strain", "Conjugation")
- `Correction Values`: Numerical correction values in kJ/mol

## How to Add New Increments

### Step 1: Research Reliable Values

- Consult the original Benson paper: Cohen, N.; Benson, S. W. *Chem. Rev.* **1993**, *93*, 2419.
- Check recent literature for updated or additional increment values
- Ensure values are in kJ/mol (convert from kcal/mol if necessary: 1 kcal/mol = 4.184 kJ/mol)
- Verify values against experimental data when possible

### Step 2: Format the Entry

- Use standard chemical notation for group names (e.g., CH₃, OH, COOH)
- Ensure numerical values are precise (typically 1-2 decimal places)
- Leave empty cells as blank (not zero) if a category doesn't apply

### Step 3: Add to CSV

- Open `increment_correction_table.csv` in a spreadsheet application or text editor
- Add your new row(s) following the existing format
- Save the file ensuring it's UTF-8 encoded and comma-separated

### Step 4: Test the Changes

- Run the Benson Increments Calculator notebook
- Verify that new buttons appear in the appropriate tabs
- Test calculations with known molecules to ensure accuracy

### Step 5: Submit a Pull Request

- Fork the repository on GitHub
- Create a new branch for your changes
- Commit your updated CSV file
- Open a pull request with:
  - Description of the new increments added
  - Source/reference for the values
  - Any validation performed

## Guidelines for New Increments

- **Accuracy**: Only add well-established, experimentally validated values
- **Completeness**: Provide both the increment name and numerical value
- **Consistency**: Follow existing naming conventions in the file
- **Documentation**: Include references to the source of the values

## Validation

Before submitting, please:

1. Ensure the CSV can be read by pandas without errors
2. Verify that numerical columns contain only numbers (no text)
3. Test that the notebook loads and displays the new increments
4. Check calculations against literature values for validation

## Questions?

If you have questions about contributing to the CSV or need help finding reliable increment values, please open an issue on the GitHub repository.