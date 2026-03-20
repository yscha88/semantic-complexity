# filesystem skill draft (alpha)

## Status

Experimental alpha.

This draft has the strongest positive evidence among the current domain-specific drafts.

## Validation scope

- Primary evidence: Flask file-serving helper experiment
- Models: `gpt-5.4`, `claude-sonnet-4-6`
- Compared against: general R1-R4 prompt

## Prompt draft

```text
Analyze the following code for any issues — security, quality, correctness, or design concerns.
Rate each finding by severity.

Use the following checklist:
- FS1: Path traversal — can user input escape the intended directory?
- FS2: Symlink following — does the code follow symlinks outside the safe directory?
- FS3: TOCTOU race — is there a gap between checking and using a path?
- FS4: Content-Type sniffing — can browsers interpret returned content differently than intended?
- FS5: File descriptor leaks — are files closed in all code paths?

For each rule, provide:
1. Finding (specific location)
2. Rating: pass / warning / fail
3. Fix recommendation if needed

After completing the checklist, identify any issues NOT covered above.
```

## Observed effect

In the tested Flask file-serving module, the filesystem-specific version outperformed the general version by:

- +1 true positive
- higher precision

The extra gain came from identifying browser-side MIME/content-sniffing risk that the generic prompt missed.

## Current claim

This is one of the best current examples that **domain-specific SKILL content can outperform a general SKILL**.

## Limitation

Evidence currently comes from a small number of file/path-handling examples, not a broad filesystem corpus.
