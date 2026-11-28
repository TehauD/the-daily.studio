# Loading your own data (prior authorization as the worked example)

FORGE agents answer from **tables you load** through read-only tools. The templates ship synthetic tables in exactly the
shape a real one should have, so the fastest route is: download the template's table, fill it with your data in the same
columns, and load it. **Until patient data is separately approved, load reference data only** — criteria, codes, rules,
queues, turnaround times — never member, patient or claim-level records. FORGE refuses cells that look like personal data.

## 1. Get the shape

- Agent Studio → choose the template → **Tools** → each table has **Download CSV**; or before creating an agent:
  `GET /api/agents/templates/prior_auth/tables/services/csv`.
- Samples in this repo: [`docs/examples/prior_auth-services.csv`](examples/prior_auth-services.csv) (64 services) and the
  claims, patient-access and ITSM equivalents next to it — plus coding edits (procedures, PTP edits, diagnoses, coverage),
  pharmacy formulary, provider credentialing (providers, enrollments), supply-chain item master and HL7 interfaces (errors,
  fields, events, interfaces). [USE_CASES.md](USE_CASES.md) lists, per template, which real tables to load and the guardrails.
- **Licensed and public code sets:** the coding-edit template uses FORGE's own code formats. CPT® descriptions are licensed by
  the AMA — load them only under your organisation's licence; CMS NCCI PTP and MUE files are public and match the
  `ptp_edits` / `procedures` shapes. HL7 v2 tables and field names are public references.

## 2. The prior-authorization criteria table

One row per service code. Column names are free (they are normalised to `lower_snake_case`); these are the ones the
template's skills, rules and generators use:

| Column | Meaning | Example |
|---|---|---|
| `service_code` (**key**) | Your code for the service (internal code, CPT/HCPCS if your licence allows, or a group code) | `PA-1001` |
| `service` | Plain name people use in requests | `MRI lumbar spine` |
| `category` | Grouping for reports | `Imaging` |
| `requires_auth` | `yes` / `no` | `yes` |
| `units_without_auth` | Units / visits allowed before authorization is needed (0 if always required) | `12` |
| `unit_cost` | The plan's unit rate used for the high-cost rule | `1240` |
| `standard_turnaround_days` / `expedited_turnaround_days` | Decision timelines | `7` / `2` |
| `review_team` | Who reviews | `Imaging Review` |
| `documentation` | What must be attached | `order + prior imaging report` |

Rules that compare against fixed thresholds (e.g. *high-cost review if estimated cost ≥ $5,000 or inpatient*) live in
**Tools → Rules**, not in the table: edit the threshold there to match your policy.

Tips that make a better test:
- **Enough rows.** 50+ services gives the final test new items to be tested on; FORGE keeps each service in one split.
- **A key that appears in requests** (the code or the name people actually use). Add a `find_` search on the name column
  for requests that don't quote a code.
- **Real variety in answers.** If 90 % of services are `requires_auth = yes`, the coverage map will warn that "always yes"
  scores well; that's a property of your data worth knowing.
- One fact per cell; dates as `YYYY-MM-DD`; numbers without currency symbols.

## 3. Load it

Agent Studio → **Tools → Tables → Add a table**: paste or upload the CSV (or JSON list), name it, pick the key column.
Then in **Skills**, point each skill at the new table's `lookup_` / `find_` tools, and in **Practice tasks** write tasks
with the **teacher** (your table is not the template's, so its built-in generator doesn't apply) — every task is still
re-run against your table and kept only if the answer is exactly what the tools return.

## 4. Check the test before you trust results

- **Practice tasks → Coverage map**: tasks per skill and split, rows exercised, answer balance.
- After *Collect* and *Evaluate · dev*: **Evaluation Lab → Is this a good test?** flags skills with no room to improve,
  a weak teacher, unbalanced answers, or too few final-test tasks. Fix those before reading any gain.
