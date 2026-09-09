Three molecules, worked the way you would work them in the calculator. Every
value below is the one in this repository's CSV files, so you can check each
line against the buttons on the calculator page.

## Butane

Four carbons: two methyls at the ends, two methylenes in the middle.

- `C-(C)(H)3` × 2 = −84.0
- `C-(C)2(H)2` × 2 = −41.8
- **Total −125.8 kJ/mol**

## Ethanol

The point of this one is that its groups come from two different files — the
CH groups and the CHO groups. Crossing two or three categories is normal, and
the calculator lets you filter several at once for exactly this reason.

- `C-(C)(H)3` = −42
- `C-(H)2(O)(C)` = −33
- `O-(H)(C)` = −159
- **Total −234.0 kJ/mol**

## Cyclohexane

Six identical methylenes — and then a correction, because six methylenes in a
ring are not the same as six in a chain. This is what corrections are for.

- `C-(C)2(H)2` × 6 = −125.4
- `cyclohexane` correction = +2
- **Total −123.4 kJ/mol**

Without the correction the estimate would be −125.4, and the ring would be
indistinguishable from hexane's interior. The correction is added once for the
ring, not once per carbon in it.

## What not to add together

A cyclohexane A-value is a free energy, not an enthalpy of formation. Adding
the methyl A-value of 7.28 to the ΔHf° above does not give you the enthalpy of
anything. The calculator will let you select both — sometimes you want both on
screen — but it stops heading the total ΔHf° the moment the sum stops being
one, and says plainly what it has been mixed with.
