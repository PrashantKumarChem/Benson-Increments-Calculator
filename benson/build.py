"""Emitting the artifact the consumers read.

Will apply the rules in this package to the source data and write one JSON file
holding everything derived — values, precision, ranges, notation, a pre-ranked
search index, references, and the display and uncertainty configuration.

The point of emitting the derived parts rather than the raw parts is that a
consumer then has no rule of its own to get wrong. A website that renders a
pre-ranked index is not implementing a ranking algorithm; one that reads
`decimals` is not implementing a precision rule. CI regenerates the artifact and
fails on any difference, which is the bargain `CSV_data_files/manifest.json` and
the asset version already keep here.
"""
