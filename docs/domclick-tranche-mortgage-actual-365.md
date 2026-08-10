# Domclick tranche mortgage verification (Actual/365)

## Implemented model

For every tranche stage the fixed payment is calculated without an annuity:

`stagePayment = nominalIssuedCredit × annualRate × 31 / 365`

For each payment period:

`interest = outstandingBalance × annualRate × actualDays / 365`

`principal = max(0, stagePayment − interest)`

`newBalance = oldBalance − principal`

If calculated interest exceeds the fixed payment, interest is capped at the
payment and principal is zero. The unconfirmed difference is not capitalized.
When another tranche is issued, its amount is added to the reduced outstanding
balance. The fixed stage payment is recalculated from the total nominal amount
issued across all active tranches.

The first public schedule row is shown on the issue date and equals the
contractual 31-day stage payment. Subsequent periods use the actual number of
days between monthly dates. Calculations retain fractions of a ruble internally;
the comparison below rounds only for display.

## Reproduced first-stage rows

| Row | Metric | Builder | Domclick | Difference |
|---:|---|---:|---:|---:|
| 1 | Payment | 64,901 | 64,901 | 0 |
| 1 | Interest | 64,901 | 64,901 | 0 |
| 1 | Principal | 0 | 0 | 0 |
| 1 | Balance | 3,980,000 | 3,980,000 | 0 |
| 2 | Payment | 64,901 | 64,901 | 0 |
| 2 | Interest | 64,901 | 64,901 | 0 |
| 2 | Principal | 0 | 0 | 0 |
| 2 | Balance | 3,980,000 | 3,980,000 | 0 |
| 3 | Payment | 64,901 | 64,901 | 0 |
| 3 | Interest | 62,808 | 62,807 | +1 |
| 3 | Principal | 2,094 | 2,093 | +1 |
| 3 | Balance | 3,977,906 | 3,977,906 | 0 |
| 4 | Payment | 64,901 | 64,901 | 0 |
| 4 | Interest | 64,867 | 64,867 | 0 |
| 4 | Principal | 34 | 34 | 0 |
| 4 | Balance | 3,977,872 | 3,977,872 | 0 |

## Second-stage limitation

The fixed payment is reproduced without fitting:

`13,980,000 × 19.2% × 31 / 365 = 227,969.75 ₽`

The client-facing stage payment discards kopecks (`floor`), therefore it is
shown as `227,969 ₽`. Internal interest and balance calculations retain the
unrounded `227,969.75… ₽` value.

The supplied second-stage detail is not sufficient for an exact 12-row
comparison and is internally inconsistent with integer calendar days. Given the
stated opening balance `3,946,351 + 10,000,000`, interest of `226,792` implies
`30.9143` days. Also `13,946,351 − 1,177 = 13,945,174`, not the supplied closing
balance `13,944,728` (a 446 ₽ difference). No correction factor has been added.

The Builder therefore exposes a mathematically consistent Actual/365 preliminary
schedule. The known Domclick stage payment differs by less than 1 ₽ before
display rounding. Exact comparison for the first 24 months and first 12 months
after tranche two requires the corresponding 36 dated, unrounded bank rows.
Personal events such as retirement age, insurance, scoring and individual bank
conditions are intentionally outside this model.

## Requested period comparison

The repository only contains the six Domclick detail rows supplied in the task,
not all 36 bank rows. A dash therefore means “bank value not supplied”, not a
match. Columns are payment / interest / principal / remaining balance, rounded
to whole rubles.

### First 24 rows

| # | Date | Builder | Domclick | Known difference |
|---:|---|---|---|---|
| 1 | 15.08.2026 | 64,901 / 64,901 / 0 / 3,980,000 | 64,901 / 64,901 / 0 / 3,980,000 | 0 / 0 / 0 / 0 |
| 2 | 15.09.2026 | 64,901 / 64,901 / 0 / 3,980,000 | 64,901 / 64,901 / 0 / 3,980,000 | 0 / 0 / 0 / 0 |
| 3 | 15.10.2026 | 64,901 / 62,808 / 2,094 / 3,977,906 | 64,901 / 62,807 / 2,093 / 3,977,906 | 0 / +1 / +1 / 0 |
| 4 | 15.11.2026 | 64,901 / 64,867 / 34 / 3,977,872 | 64,901 / 64,867 / 34 / 3,977,872 | 0 / 0 / 0 / 0 |
| 5 | 15.12.2026 | 64,901 / 62,774 / 2,127 / 3,975,745 | — | — |
| 6 | 15.01.2027 | 64,901 / 64,832 / 69 / 3,975,676 | — | — |
| 7 | 15.02.2027 | 64,901 / 64,831 / 71 / 3,975,605 | — | — |
| 8 | 15.03.2027 | 64,901 / 58,556 / 6,346 / 3,969,260 | — | — |
| 9 | 15.04.2027 | 64,901 / 64,726 / 175 / 3,969,085 | — | — |
| 10 | 15.05.2027 | 64,901 / 62,635 / 2,266 / 3,966,819 | — | — |
| 11 | 15.06.2027 | 64,901 / 64,686 / 215 / 3,966,604 | — | — |
| 12 | 15.07.2027 | 64,901 / 62,596 / 2,305 / 3,964,299 | — | — |
| 13 | 15.08.2027 | 64,901 / 64,645 / 256 / 3,964,043 | — | — |
| 14 | 15.09.2027 | 64,901 / 64,641 / 260 / 3,963,783 | — | — |
| 15 | 15.10.2027 | 64,901 / 62,552 / 2,350 / 3,961,433 | — | — |
| 16 | 15.11.2027 | 64,901 / 64,598 / 303 / 3,961,130 | — | — |
| 17 | 15.12.2027 | 64,901 / 62,510 / 2,391 / 3,958,739 | — | — |
| 18 | 15.01.2028 | 64,901 / 64,555 / 347 / 3,958,392 | — | — |
| 19 | 15.02.2028 | 64,901 / 64,549 / 352 / 3,958,040 | — | — |
| 20 | 15.03.2028 | 64,901 / 60,379 / 4,522 / 3,953,518 | — | — |
| 21 | 15.04.2028 | 64,901 / 64,469 / 432 / 3,953,086 | — | — |
| 22 | 15.05.2028 | 64,901 / 62,383 / 2,518 / 3,950,567 | — | — |
| 23 | 15.06.2028 | 64,901 / 64,421 / 480 / 3,950,088 | — | — |
| 24 | 15.07.2028 | 64,901 / 62,336 / 2,566 / 3,947,522 | — | — |

### First 12 rows after tranche two

| # | Date | Builder | Domclick | Known difference |
|---:|---|---|---|---|
| 1 | 15.08.2028 | 227,970 / 227,440 / 530 / 13,946,992 | 227,969 / 226,792 / 1,177 / 13,944,728 | +1 / +648 / −647 / +2,264 |
| 2 | 15.09.2028 | 227,970 / 227,432 / 538 / 13,946,454 | 227,969 / 221,527 / 6,441 / 13,938,287 | +1 / +5,905 / −5,903 / +8,167 |
| 3 | 15.10.2028 | 227,970 / 220,087 / 7,883 / 13,938,571 | — | — |
| 4 | 15.11.2028 | 227,970 / 227,294 / 676 / 13,937,895 | — | — |
| 5 | 15.12.2028 | 227,970 / 219,951 / 8,018 / 13,929,877 | — | — |
| 6 | 15.01.2029 | 227,970 / 227,152 / 817 / 13,929,060 | — | — |
| 7 | 15.02.2029 | 227,970 / 227,139 / 831 / 13,928,229 | — | — |
| 8 | 15.03.2029 | 227,970 / 205,146 / 22,824 / 13,905,405 | — | — |
| 9 | 15.04.2029 | 227,970 / 226,753 / 1,216 / 13,904,188 | — | — |
| 10 | 15.05.2029 | 227,970 / 219,420 / 8,550 / 13,895,638 | — | — |
| 11 | 15.06.2029 | 227,970 / 226,594 / 1,376 / 13,894,262 | — | — |
| 12 | 15.07.2029 | 227,970 / 219,263 / 8,707 / 13,885,556 | — | — |
