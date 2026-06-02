# Formatting and copy style

House rules for all user-visible text in Tube Checker (the app, terms.html, help.html)
and, where practical, code comments. Keep copy plain, clinical, and calm.

## Punctuation and characters (do not use)
- **No em dashes** (`—`). Use a comma, a colon, or a spaced hyphen ` - ` instead.
- **No en dashes** (`–`). Use a hyphen `-`.
- **No smart / curly quotes** (`' ' " "`). Use straight quotes only.
- **No ellipsis character** (`…`). Use three dots `...` (or rewrite to avoid it).
- **No emoji.** Use an inline line-SVG icon or plain text.
- **No double quotes in visible UI text.** Use single straight quotes `'...'` for any
  quoting in labels, buttons, hints, and messages. (Double quotes are fine in code,
  HTML attributes, and CSS.)

## Spelling and wording
- **Australian / British spelling:** colour, labelling, oestradiol, haematology, etc.
- Clinical and concise. Prefer plain words over jargon where both are clear.
- Sentence case for buttons and labels (not Title Case), e.g. `Share summary`.

## Tone and layout
- iOS-style "sterile" clinical look: restrained, lots of whitespace, no decorative chrome.
- Decision-support framing, never authoritative. Keep the verify-locally disclaimer visible.
- Do not add fake/non-functional UI (nav tabs, bottom bars) for looks.

## Quick self-check before shipping copy
Run a sweep for the banned characters:
```
python -c "import sys; [print(f) for f in ['index.html','help.html','terms.html'] if any(c in open(f,encoding='utf-8').read() for c in '—–‘’“”…')]"
```
(No output = clean.)
