Benson group additivity estimates the standard enthalpy of formation of a
molecule by adding up contributions from its parts. You identify the groups
the molecule is made of, look up what each one contributes, and sum them.
That sum is the estimate. There is no other step.

A **group** is one polyvalent atom together with the ligands bonded to it.
The central atom is what the group is *of*; the ligands describe the
neighbourhood it sits in. So a carbon bonded to one carbon and three
hydrogens is written `C-(C)(H)3`, and it is worth −42 kJ/mol wherever it
appears — in propane, in toluene, in a steroid.

The method works because a bond's energy is not quite a constant. A C–H bond
in a methyl group is not identical to a C–H bond next to a carbonyl, and the
difference is large enough to matter. What decides it is mostly the
*next-nearest* neighbours — and the central-atom-plus-ligands group is
precisely that neighbourhood, written down. Additivity over groups therefore
captures what additivity over bonds misses.

What it does not capture is anything that depends on the shape of the whole
molecule: ring strain, two substituents crowding each other, a *cis* double
bond forcing groups together. Those are handled by **corrections**, which are
added once per ring or per interaction rather than once per atom.

The calculator deliberately does not inspect a structure or decide which
groups a molecule needs. You choose them. The method is the thing being
taught, so the reasoning stays in your hands and the arithmetic stays visible.
