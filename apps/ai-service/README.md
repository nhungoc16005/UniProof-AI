# UniProof AI service

The NestJS evidence worker calls this FastAPI service at `POST /evidence/process`.
It creates an AI job only after the student submits an assessment containing
evidence drafts with uploaded files. Saving a draft by itself does not run AI.

## Run locally

From `apps/ai-service`:

```powershell
python -m pip install -r requirements.txt
$env:Path = "C:\Program Files\Tesseract-OCR;$env:Path"
$env:TESSDATA_PREFIX = "$env:LOCALAPPDATA\UniProofAI\tessdata"
$env:TESSERACT_LANGUAGES = "vie+eng"
python -m uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload
```

The PowerShell environment settings above assume the Windows Tesseract
installation and language-data location described below. Adjust them if
Tesseract or its `tessdata` directory is installed elsewhere.

Set `AI_PIPELINE_URL` in the backend environment to the service URL. For two
machines, use the AI machine's reachable LAN address, for example
`http://192.168.1.20:8000`; do not use `localhost` from the backend machine.
Only allow trusted access to the AI service port.

For scanned images and PDFs, install the Tesseract OCR executable and the
Vietnamese and English language data (`vie+eng`). The Python `pytesseract`
package alone does not install the Tesseract executable. Set
`TESSERACT_LANGUAGES` if a different language set is installed. PDF rendering
uses PyMuPDF.

For each scanned page, OCR tries three bounded variants: normalized grayscale,
contrast-enhanced/upscaled grayscale, and adaptive thresholding. These use
Tesseract PSM 3, 6, and 11 respectively. The selected result and mean word
confidence are diagnostic only; confidence is not an authenticity probability.
If successful candidates disagree on a non-empty student name or student code,
the identity check is sent for human review and is not treated as a mismatch.
Multiple OCR attempts can increase processing time. Cropped, blurred, or
low-resolution text can still be unreadable and must be checked against the
original file.

Check `GET /health` for service status and whether OCR is actually available.
`GET /docs` exposes the API schema.

Do not fine-tune from OCR drafts. Training requires human-reviewed
line-image/transcription pairs and document-level train/validation/test splits;
the current local pilot still needs annotation review.

## The three analysis flows

1. **Document evidence:** image/PDF validation, blur and brightness checks,
   SHA-256/pHash and ELA indicators, OCR extraction, declared-student matching,
   and blood-donation fields when present.
2. **Public-source comparison:** queries public sources through a search
   provider and reports a matching article when a real result meets the
   text-match threshold. Official sources (DUT/university/union pages) receive
   the full confidence boost while social networks, press and other public
   pages receive a smaller boost. Network failure or no result is not replaced
   by a fabricated article.
3. **Event photos:** image quality and forensic checks, EXIF date comparison,
   face detection, and OCR-based banner/activity comparison. Face detection is
   not identity recognition; the service does not claim that a detected person
   is the student.

AI scores are supporting signals only. The backend keeps evidence in the
human-review workflow and does not treat the AI score as an approval.
