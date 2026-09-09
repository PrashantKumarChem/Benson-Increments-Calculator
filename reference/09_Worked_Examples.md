Three molecules, worked the way you would work them in the calculator. Every
increment below is the one in this repository's CSV files, so you can check each
line against the buttons on the calculator page. The measured values are from
the NIST Chemistry WebBook, for gas-phase ΔHf° at 298 K.

## Butane

Four carbons: two methyls at the ends, two methylenes in the middle.

- `C-(C)(H)3` × 2 = −84.0
- `C-(C)2(H)2` × 2 = −41.8
- **Estimate −125.8 kJ/mol** — measured −125.6 ± 0.67 (Pittam and Pilcher, 1972)

## Ethanol

The point of this one is that its groups come from two different files — the CH
groups and the CHO groups. Crossing two or three categories is normal, and the
calculator lets you filter several at once for exactly this reason.

- `C-(C)(H)3` = −42
- `C-(H)2(O)(C)` = −33
- `O-(H)(C)` = −159
- **Estimate −234.0 kJ/mol** — measured −234 ± 2 (average of nine values)

## Cyclohexane

Six identical methylenes — and then a correction, because six methylenes in a
ring are not the same as six in a chain. This is what corrections are for.

- `C-(C)2(H)2` × 6 = −125.4
- `cyclohexane` correction = +2
- **Estimate −123.4 kJ/mol** — measured −123.1 ± 0.79 (Prosen, Johnson et al.,
  1946)

Without the correction the estimate would be −125.4, and the ring would be
indistinguishable from six carbons of a chain. The correction is added once for
the ring, not once per carbon in it.

## A word about how well these agree

All three land within about half a kJ/mol of experiment, which is better than
the method's own typical accuracy and better than you should expect in general.
These are easy molecules: unstrained, monofunctional, and among the compounds
whose measured values went into deriving the increments in the first place.
Reported accuracies for group additivity run from roughly 2 to 10 kJ/mol
depending on the compound and whose group values are used, and multifunctional
or strained molecules are where it does worst. An estimate is an estimate.

## What not to add together

A cyclohexane A-value is a free energy, not an enthalpy of formation. Adding
the methyl A-value of 7.28 to the ΔHf° above does not give you the enthalpy of
anything. The calculator will let you select both — sometimes you want both on
screen — but it stops heading the total ΔHf° the moment the sum stops being
one, and says plainly what it has been mixed with.
