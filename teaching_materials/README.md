# Instructional Materials and Teaching Archive

This directory archives the pedagogical materials, legacy Jupyter notebooks, and classroom assignments used across three years of teaching Benson group additivity in **Advanced Organic Chemistry (CHEM-C 450/C 540)** at Indiana University Bloomington.

These records document the iterative pedagogical and software evolution described in the accompanying paper for the *Journal of Open Source Education* (JOSE):

---

## Pedagogical Evolution (2024–2026)

### Year 1: Fall 2024 — Local Jupyter Notebook Environment
* **Location:** [`2024_Fall/`](2024_Fall/)
* **Implementation:** Python Jupyter notebook (`ipywidgets`, `pandas`) run via local Anaconda Navigator installations, introduced alongside lecture instruction on Python programming basics and computational notebooks in chemistry ([`Chem540ClassNotes24Sept2024.pdf`](2024_Fall/Chem540ClassNotes24Sept2024.pdf)).
* **Classroom Observations:** Environment configuration, Anaconda package installations, and troubleshooting consumed 20–30 minutes (30–50% of the introductory class period), motivating a transition to cloud-hosted environments.

### Year 2: Fall 2025 — Google Colab Migration
* **Location:** [`2025_Fall/`](2025_Fall/)
* **Implementation:** Cloud-hosted Google Colab deployment ([`Google_Colab_Exercise_Benson_Increments_Calculator.pdf`](2025_Fall/Google_Colab_Exercise_Benson_Increments_Calculator.pdf)) using single-table increment data with added cyclohexane $A$-values.
* **Classroom Observations:** Eliminated local Python setup issues, but browser authentication hurdles, Canvas file downloads/uploads, and notebook UI overhead continued to distract from chemical discussion.

### Year 3: Fall 2026 — Zero-Install Standalone Web Application
* **Location:** Repository root ([`index.html`](../index.html), [`CSV_data_files/`](../CSV_data_files/))
* **Implementation:** Zero-dependency client-side HTML5/CSS/JavaScript web application running instantly across laptops, tablets, and smartphones via GitHub Pages.
* **Instructional Impact:** Introductory exercises (ethanol, isopropanol, cyclopentadiene) completed within 5 minutes of class start, dedicating nearly all instructional time to physical organic reasoning, reaction coordinate diagrams, and literature analysis.

---

## Directory Contents

| Directory | Core Artifacts | Focus |
| :--- | :--- | :--- |
| [`2024_Fall/`](2024_Fall/) | `Chem540ClassNotes24Sept2024.pdf`<br>`UpdatedBensonIncrementsCalculatorF24Chem540.ipynb`<br>`increment_correction_table_2024.csv` | Local Anaconda/Jupyter teaching setup & computational notebook slides. |
| [`2025_Fall/`](2025_Fall/) | `Google_Colab_Exercise_Benson_Increments_Calculator.pdf`<br>`Benson_Increments_Calculator_Colab_2025.ipynb`<br>`increment_correction_table_2025.csv` | Google Colab student workflow & exercise sheet. |
