# Benson Increments Calculator

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gp### For Contributors

**Adding New Benson Group Categories:**
1. Create a new CSV file following the naming convention (see Data Format section)
2. Ensure it has exactly 2 columns: group names and kJ/mol values
3. Test your CSV file by placing it in `CSV_data_files/` and running the notebook
4. Submit a pull request with your CSV file and any relevant documentation

**Guidelines:**
- Use numbered prefixes (01_, 02_, etc.) for proper tab ordering
- Keep chemical acronyms (CH, CHO, CHNO) in uppercase
- Provide clear, descriptive group names
- Include references for increment values when possible
- Test that your CSV loads correctly (no warnings in the notebook output)

### For Developers

Please see [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines and [CONTRIBUTOR_GUIDELINES.md](CONTRIBUTOR_GUIDELINES.md) for detailed instructions on adding new Benson group categories.3.8+](https://img.shields.io/badge/python-3.8+-blue.svg)](https://www.python.org/downloads/)

A Jupyter Notebook-based tool for estimating the standard heat of formation of organic molecules using the Benson Group Increment method. Designed for Chemistry C450/C540 at Indiana University Bloomington by Prashant Kumar and Dr. Nicola L. B. Pohl.

## Project Description

This notebook is designed to calculate approximate heats of formation of organic molecules based on the idea of Benson Group Increments (Cohen & Benson, *Chem. Rev.* **1993**, *93*, 2419).

The notebook automatically loads Benson group increment data from multiple CSV files located in the `CSV_data_files/` folder. Each CSV file represents a different category of Benson groups (CH Groups, CHO Groups, CHNO Groups, Corrections, etc.). The system dynamically detects and loads all valid CSV files, making it easy for contributors to add new Benson group categories without modifying any code.

The Benson Group Increments are rendered into compact buttons that users can click to select. The value associated with each button is automatically added to the total displayed below the buttons. Users need to decide which increments and corrections are needed based on the molecule of interest to make the entire process of estimation transparent.

## Features

- **Modular CSV System**: Automatically detects and loads Benson group data from multiple CSV files
- **Dynamic Categories**: New Benson group categories appear as tabs without code changes
- **Interactive UI**: Click buttons to add Benson group increments and corrections
- **Real-time Calculation**: Automatic updates of heat of formation in kJ/mol and kcal/mol
- **History Panel**: View and remove individual increments
- **Professional Display**: Chemical acronyms (CH, CHO, CHNO) properly formatted in tab titles
- **Collaborative**: Easy for contributors to add new Benson group categories

## Installation

### Prerequisites

- Python 3.8 or higher
- Jupyter Notebook or JupyterLab

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/Prashant-Kumar-IU/Benson-Increments-Calculator.git
   cd Benson-Increments-Calculator
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Prepare the data files:
   - The `CSV_data_files/` directory contains modular CSV files for different Benson group categories
   - Each CSV file should have exactly 2 columns: group names and their kJ/mol values
   - Files are automatically detected and loaded - no code changes needed for new categories

4. Launch Jupyter:
   ```bash
   jupyter notebook
   ```

5. Open `Benson Increments Calculator.ipynb` and run the cells.

## Usage

1. **Load the Notebook**: Open the `.ipynb` file in Jupyter.
2. **Run the Main Function**: Execute the `main()` cell to launch the interactive calculator.
3. **Select Increments**:
   - Use the dynamically generated tabs to navigate between different Benson group categories
   - Tabs are automatically created from CSV filenames (e.g., `01_CH_Groups.csv` → "CH Groups" tab)
   - Click buttons to add increments to your molecule
4. **Monitor Totals**: View the updated heat of formation in both kJ/mol and kcal/mol.
5. **Manage Selections**:
   - Use "Undo the last addition" to remove the most recent increment.
   - Use "Reset all selections" to start over.
   - Use the "Remove" buttons in the history panel for precise control.

## Data Format

The calculator uses a modular CSV system where each Benson group category is stored in a separate CSV file in the `CSV_data_files/` directory. The system automatically detects and loads all valid CSV files.

### CSV File Requirements

Each CSV file must follow these rules:
- **Exactly 2 columns**: Group names and their corresponding kJ/mol values
- **No header row required**: The system automatically uses the first column as group names and the second as values
- **Standardized naming**: Use numbered prefixes (01_, 02_, etc.) for consistent tab ordering
- **Chemical acronyms**: Keep acronyms like CH, CHO, CHNO in uppercase

### CSV File Naming Convention

```
NN_Category_Name.csv
```

Where:
- `NN` = Two-digit number for tab ordering (01, 02, 03, etc.)
- `Category_Name` = Descriptive name with underscores
- Examples:
  - `01_CH_Groups.csv` → "CH Groups" tab
  - `02_CHO_Groups.csv` → "CHO Groups" tab
  - `03_Corrections.csv` → "Corrections" tab

### CSV File Structure

Each CSV file should look like this:

```csv
Group Name,Value kJ/mol
CH₃,-42.3
CH₂,-20.9
CH,-7.0
```

### Current Categories

The system currently includes:
- **CH Groups** (`01_CH_Groups.csv`): 44 hydrocarbon group increments
- **CHO Groups** (`02_CHO_Groups.csv`): 82 oxygen-containing group increments
- **CHNO Groups** (`03_CHNO_Groups.csv`): 57 nitrogen/oxygen group increments
- **Corrections** (`04_Corrections.csv`): 24 correction factors
- **Cyclohexane A Values** (`05_Cyclohexane_A_Values.csv`): 29 cyclohexane-specific increments

### Adding New Categories

To add a new Benson group category:

1. Create a new CSV file following the naming convention (e.g., `06_New_Category.csv`)
2. Add exactly 2 columns: group names and kJ/mol values
3. Place the file in the `CSV_data_files/` directory
4. The new category will automatically appear as a tab in the calculator (no code changes needed!)

## Contributing

We welcome contributions! The modular CSV system makes it easy for contributors to add new Benson group categories.

### For Contributors

**Adding New Benson Group Categories:**
1. Create a new CSV file following the naming convention (see Data Format section)
2. Ensure it has exactly 2 columns: group names and kJ/mol values
3. Test your CSV file by placing it in `CSV_data_files/` and running the notebook
4. Submit a pull request with your new category

**Guidelines:**
- Use numbered prefixes (01_, 02_, etc.) for proper tab ordering
- Keep chemical acronyms (CH, CHO, CHNO) in uppercase
- Provide clear, descriptive group names
- Include references for increment values when possible
- Test that your CSV loads correctly (no warnings in the notebook output)

### For Developers

Please see [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines and [CONTRIBUTOR_GUIDELINES.md](CONTRIBUTOR_GUIDELINES.md) for detailed instructions on adding new Benson group categories.

## License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

## Citation

If you use this tool in your research, please cite:

```bibtex
@software{benson_increments_calculator,
  author = {Kumar, Prashant and Pohl, Nicola L. B.},
  title = {Benson Increments Calculator},
  year = {2024},
  url = {https://github.com/Prashant-Kumar-IU/Benson-Increments-Calculator},
  version = {1.0}
}
```

For the original Benson method:
Cohen, N.; Benson, S. W. *Chem. Rev.* **1993**, *93*, 2419.

## Support

For questions or issues, please open an issue on GitHub or contact the maintainers.