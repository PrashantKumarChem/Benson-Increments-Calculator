# CSV Modularization Execution Plan

## Overview
This plan outlines the steps to refactor the Benson Increments Calculator to use multiple modular CSV files instead of a single large CSV file. This will make the system more maintainable, collaborative, and extensible by allowing automatic detection and loading of CSV files from the `CSV_data_files/` folder.

## Goals
- Break down the monolithic `increment_correction_table.csv` into category-specific CSV files
- Modify the notebook to dynamically scan and load all CSV files
- Maintain backward compatibility and existing functionality
- Enable easy addition of new increment categories by collaborators

## Prerequisites
- [x] Backup the current `increment_correction_table.csv` file
- [x] Ensure all required Python packages are installed (pandas, ipywidgets, etc.)
- [x] Test the current notebook functionality before changes

## Step 1: Analyze Current CSV Structure
- [x] Review the current `increment_correction_table.csv` file structure
- [x] Identify all column pairs and their corresponding categories:
  - CH Groups: `CH Benson Group Increment` + `Delta_Hf kJ/mol`
  - CHO Groups: `CHO Benson Group Increment` + `CHO Values`
  - Corrections: `Correction` + `Correction Values`
  - CHNO Groups: `CHNO benson increments` + `CHNO benson value in kJ/mol`
  - Cyclohexane A-values: `Group on cyclohexane` + `A-values in kJ/mol`
- [x] Document any data overlaps or conflicts between categories

## Step 2: Create Individual CSV Files
- [x] Create `ch_groups.csv`:
  - Columns: `CH Benson Group Increment`, `Delta_Hf kJ/mol`
  - Extract relevant rows from the original CSV
- [x] Create `cho_groups.csv`:
  - Columns: `CHO Benson Group Increment`, `CHO Values`
  - Extract relevant rows from the original CSV
- [x] Create `corrections.csv`:
  - Columns: `Correction`, `Correction Values`
  - Extract relevant rows from the original CSV
- [x] Create `chno_groups.csv`:
  - Columns: `CHNO benson increments`, `CHNO benson value in kJ/mol`
  - Extract relevant rows from the original CSV
- [x] Create `cyclohexane_a_values.csv`:
  - Columns: `Group on cyclohexane`, `A-values in kJ/mol`
  - Extract relevant rows from the original CSV
- [x] Validate that all data has been transferred correctly (row counts, values)

## Step 3: Update Notebook Code
- [x] Add required imports: `import os` and `import glob`
- [x] Modify `load_increment_data()` function:
  - Change parameter from `csv_path` to `folder_path`
  - Use `glob.glob()` to find all `.csv` files in the folder
  - Load and concatenate all CSV files into a single DataFrame
  - Add error handling for invalid files
- [x] Modify `get_value_dicts()` function:
  - Update to iterate through DataFrame rows instead of using `zip()`
  - Use conditional checks for each category based on column presence
  - Handle potential duplicate keys (last value wins, or log warnings)
- [x] Update `main()` function:
  - Change the call to `load_increment_data('CSV_data_files/')`
  - Ensure all existing functionality remains intact

## Step 4: Add Enhancements
- [ ] Add CSV validation:
  - Check for required column pairs in each file
  - Warn about missing or malformed data
- [ ] Add logging/debugging features:
  - Print loaded files and their row counts
  - Log any data conflicts or skipped entries
- [ ] Update UI feedback:
  - Display loaded CSV files in the notebook for transparency
  - Show category counts (e.g., "Loaded 25 CH groups, 15 CHO groups")

## Step 5: Testing and Validation
- [ ] Test with original data:
  - Run notebook with new modular CSVs
  - Verify all buttons appear correctly
  - Check that calculations match the original single CSV
- [ ] Test edge cases:
  - Empty CSV files
  - Missing columns in some files
  - Duplicate entries across files
  - Files with extra columns
- [ ] Test adding new data:
  - Add a new row to one of the CSVs
  - Verify it appears in the notebook without code changes
- [ ] Performance testing:
  - Time loading with current data volume
  - Test with larger datasets if available

## Step 6: Documentation and Cleanup
- [ ] Update README.md:
  - Document the new CSV file structure
  - Explain how to add new increment categories
  - Provide examples of CSV formats
- [ ] Update code comments:
  - Document the new functions and their parameters
  - Explain the dynamic loading process
- [ ] Archive old CSV:
  - Move `increment_correction_table.csv` to `Archives/` folder
  - Update any references in documentation
- [ ] Create contributor guidelines:
  - Document CSV naming conventions
  - Explain how to add new categories
  - Provide templates for new CSV files

## Step 7: Deployment and Monitoring
- [ ] Commit changes to version control
- [ ] Test on different environments (if applicable)
- [ ] Monitor for any runtime issues
- [ ] Gather feedback from potential collaborators

## Risk Mitigation
- **Data Loss**: Always backup original CSV before modifications
- **Compatibility**: Ensure old single CSV still works if needed
- **Performance**: Monitor loading times with multiple files
- **Collaboration Conflicts**: Establish clear guidelines for CSV additions

## Success Criteria
- [ ] Notebook loads all data from modular CSVs automatically
- [ ] All existing functionality works identically
- [ ] Adding new data requires no code changes
- [ ] Clear documentation for contributors
- [ ] No performance degradation

## Timeline
- Step 1-2: 1-2 hours (data analysis and CSV creation)
- Step 3-4: 2-3 hours (code modifications)
- Step 5: 1-2 hours (testing)
- Step 6-7: 1 hour (documentation and deployment)

## Resources Needed
- Access to current CSV files
- Python environment with required packages
- Text editor for CSV manipulation
- Git for version control