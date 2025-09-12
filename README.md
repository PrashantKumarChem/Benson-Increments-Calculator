# Benson Increments Calculator

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Python 3.8+](https://img.shields.io/badge/python-3.8+-blue.svg)](https://www.python.org/downloads/)

A Jupyter Notebook-based tool for estimating the standard heat of formation of organic molecules using the Benson Group Increment method. Designed for Chemistry C450/C540 at Indiana University Bloomington by Prashant Kumar and Dr. Nicola L. B. Pohl.

## Project Description

This notebook is designed to calculate approximate heats of formation of organic molecules based on the idea of Benson Group Increments (Cohen & Benson, *Chem. Rev.* **1993**, *93*, 2419).

The notebook takes values from a user-provided file titled `increment_correction_table.csv` located in the same folder as the notebook. This CSV file contains columns for Benson Group increment types and their corresponding numerical values in kJ/mol. Research is ongoing to update values and add increments to better describe a range of molecules; users can decide which increments to use in the calculator.

The Benson Group Increments are rendered into compact buttons that users can click to select. The value associated with each button is automatically added to the total displayed below the buttons. Users need to decide which increments and corrections are needed based on the molecule of interest to make the entire process of estimation transparent.

## Features

- **Interactive UI**: Click buttons to add Benson group increments and corrections.
- **Real-time Calculation**: Automatic updates of heat of formation in kJ/mol and kcal/mol.
- **Undo/Redo Functionality**: Remove last additions or reset all selections.
- **History Panel**: View and remove individual increments.
- **Tabbed Interface**: Organized into CH Groups, CHO Groups, and Corrections.

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

3. Prepare the data file:
   - Ensure `increment_correction_table.csv` is in the `CSV_data_files/` directory.
   - The CSV should contain columns: `CH Benson Group Increment`, `Delta_Hf kJ/mol`, `CHO Benson Group Increment`, `CHO Values`, `Correction`, `Correction Values`.

4. Launch Jupyter:
   ```bash
   jupyter notebook
   ```

5. Open `Benson Increments Calculator.ipynb` and run the cells.

## Usage

1. **Load the Notebook**: Open the `.ipynb` file in Jupyter.
2. **Run the Main Function**: Execute the `main()` cell to launch the interactive calculator.
3. **Select Increments**:
   - Use the tabs to navigate between CH Groups, CHO Groups, and Corrections.
   - Click buttons to add increments to your molecule.
4. **Monitor Totals**: View the updated heat of formation in both kJ/mol and kcal/mol.
5. **Manage Selections**:
   - Use "Undo the last addition" to remove the most recent increment.
   - Use "Reset all selections" to start over.
   - Use the "Remove" buttons in the history panel for precise control.

## Example

Suppose you want to calculate the heat of formation for methane (CH₄):

1. Click the "CH₃" button in the CH Groups tab.
2. The total updates to reflect the increment.
3. The result is the estimated ΔH_f for CH₄.

## Data Format

The `increment_correction_table.csv` file must have the following structure:

| CH Benson Group Increment | Delta_Hf kJ/mol | CHO Benson Group Increment | CHO Values | Correction | Correction Values |
|---------------------------|-----------------|----------------------------|------------|------------|-------------------|
| CH₃                      | -42.3          | CHO                        | 25.1      | Ring Strain| -10.5            |
| ...                      | ...            | ...                       | ...       | ...       | ...              |

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

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