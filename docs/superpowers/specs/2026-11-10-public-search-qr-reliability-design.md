# Public Search and QR Reliability Design

Date: 2026-11-10
Status: Awaiting user review

## Goal

Make public-source lookup run by default in the AI test console and improve QR
discovery across evidence files, while keeping OCR uncertainty and identity
mismatches under human review.

## Current behavior

- The AI test console initializes `enableWebSearch` to `false`.
- The evidence test API also defaults an omitted `enableWebSearch` value to
  `false`, even though the AI schema and evidence worker default it to `true`.
- The document pipeline skips public search on OCR identity or term-date
  mismatches.
- When search is skipped, the result panel can label it as merely disabled.
- QR detection runs once on the first image used by the pipeline. Additional
  attachments, rendered PDF pages, rotated or low-resolution QR codes are not
  tried.
- Public search uses DuckDuckGo HTML and requires outbound internet access;
  this implementation does not require a separate search API key.

## Approved direction

### Public-source lookup

- Default `enableWebSearch` to `true` in the AI test console and test endpoint.
- When enabled and the quality gate passes, perform the search even if OCR
  identity or term-date checks report a mismatch.
- Prefer the activity name entered in the form. If it is empty, use the OCR
  extracted activity name as a fallback and identify that query source in the
  result.
- Search results are supporting evidence only. Identity/date failures and
  review states remain unchanged. A result found using an OCR-derived query
  must not add a confidence boost.
- Distinguish disabled search, search skipped by the quality gate, completed
  search with no match, and a network/provider error in the API/UI.

### QR discovery

- Attempt QR decoding on every submitted image and on rendered PDF pages within
  the existing PDF page limit.
- Use a bounded set of image variants (normalized orientation, enlarged image,
  and right-angle rotations) and available OpenCV single/multi QR decoding.
- Verify the first successfully decoded URL and return which attachment/page
  contained it. If no QR is decoded, report that all eligible inputs were
  checked.
- A QR lookup result does not clear identity mismatch or automatically approve
  an evidence item.

## Safety and failure handling

- Keep the image-quality gate. Low-quality evidence does not trigger public
  network requests.
- Keep OCR identity and term-date checks authoritative for review/invalid
  status; public search cannot override them.
- Do not treat a failed QR decode or a missing public result as proof of fraud.
- Bound QR variants, PDF pages, network timeouts, and response size.
- Preserve the current response shape where possible; add only optional
  diagnostics needed to distinguish query source and QR attachment/page.

## Tests and acceptance

- Test that the console and backend test endpoint default public search on.
- Test that enabled search runs despite OCR identity and term-date mismatches,
  while those mismatches remain in the response and do not receive a search
  score boost.
- Test declared-activity query preference and OCR-fallback query behavior.
- Test UI messages for disabled, quality-gated, skipped, no-match, and
  provider-error states.
- Test QR found in a later attachment, a rendered PDF page, and a rotated or
  enlarged input; test no-QR behavior and bounded processing.
- Run AI-service and frontend/backend regression suites, then exercise the
  `/api/v1/evidence/inspect` flow with web search enabled and with a QR-bearing
  sample.
