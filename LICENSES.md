# Licensing

This project is open under the [Open Definition](https://opendefinition.org/):
the code is under an OSI-approved licence and the written material is under a
Creative Commons licence, so an instructor can reuse the teaching content and a
developer can reuse the software, each under terms suited to what they are
reusing.

| What | Licence | Text |
|---|---|---|
| Code | GNU General Public License v3.0 | [LICENSE](LICENSE) |
| Written material and documentation | Creative Commons Attribution 4.0 International | [LICENSE-CC-BY-4.0.txt](LICENSE-CC-BY-4.0.txt) |
| IBM Plex Mono (`assets/fonts/`) | SIL Open Font License 1.1 | [assets/fonts/OFL.txt](assets/fonts/OFL.txt) |

## Code — GPL-3.0

Everything that runs: `assets/*.js`, `assets/styles.css`, `index.html`, the
tooling and tests in `tools/`, and `Benson Increments Calculator.ipynb`.

`SPDX-License-Identifier: GPL-3.0-or-later`

## Written material — CC BY 4.0

Everything that is read rather than executed: `README.md`, `CONTRIBUTING.md`,
`CHANGELOG.md`, `AI_USE.md`, `notation/README.md`, and the whole of
`reference/` — the method, the notation table, the glossary, the worked
examples and the sources — together with `reference.html`, which is generated
from `reference/`.

`SPDX-License-Identifier: CC-BY-4.0`

This is the material an instructor is most likely to want: reuse it, adapt it
for a different course, translate it, or lift the worked examples into a
problem set. Attribution is the only condition.

`CODE_OF_CONDUCT.md` is the Contributor Covenant 2.1, itself under CC BY 4.0,
and carries its own attribution.

## The increment values

The numbers in `CSV_data_files/` are transcribed from:

> Cohen, N.; Benson, S. W. Estimation of Heats of Formation of Organic
> Compounds by Additivity Methods. *Chem. Rev.* **1993**, *93* (7), 2419–2438.
> [10.1021/cr00023a005](https://doi.org/10.1021/cr00023a005)

They are measurements and derived values reported in the scientific
literature, reproduced here with attribution so the calculator can be checked
against its source. They are not claimed as an original work of this project,
and the licences above apply to this project's own selection, arrangement,
notation files and software rather than to the underlying data.

Cite Cohen and Benson for the values, and this project for the software; see
[CITATION.cff](CITATION.cff).

The cyclohexane A-values in `05_Cyclohexane_A_Values.csv` have no source
recorded. That gap is deliberate and documented rather than filled with a
guess — see the reference page.
