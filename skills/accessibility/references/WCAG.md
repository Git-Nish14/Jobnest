# WCAG 2.2 criteria reference

Use the [W3C quick reference](https://www.w3.org/WAI/WCAG22/quickref/) for the complete criteria, levels, exceptions, and techniques. This is a working checklist, not a conformance certificate.

| Criteria | Check |
| --- | --- |
| 1.1.1 | Meaningful image alternatives; decorative images use empty alt text. |
| 1.2.1–1.2.5 | Appropriate transcripts, captions, and audio descriptions for media. |
| 1.3.1–1.3.2 | Semantic relationships and a meaningful reading order. |
| 1.4.1 | Meaning does not depend on color alone. |
| 1.4.3 | Text contrast at least 4.5:1; large text at least 3:1. |
| 1.4.4, 1.4.10 | Resize text to 200%; verify reflow at 320 CSS pixels without losing actions or content. |
| 1.4.11–1.4.13 | Component contrast, user text spacing, and dismissible hover/focus content. |
| 2.1.1–2.1.2 | All actions work by keyboard; users can leave components. |
| 2.2.1–2.2.2 | Adjustable time limits and control of moving or updating content. |
| 2.3.1 | Avoid flashing that exceeds the criterion's thresholds. |
| 2.4.1–2.4.7 | Skip links, page titles, logical focus, clear links/headings, and visible focus. |
| 2.4.11 | Focus is not entirely hidden by author-created content. |
| 2.5.3, 2.5.7–2.5.8 | Visible labels match names; dragging has a pointer alternative; targets meet size or spacing exceptions. |
| 3.1.1–3.1.2 | Declare page language and changes in language. |
| 3.2.1–3.2.3, 3.2.6 | Predictable focus/input behavior, navigation, and repeated help. |
| 3.3.1–3.3.3 | Label fields, identify errors, and offer useful corrections. |
| 3.3.7–3.3.8 | Avoid redundant entry and support accessible authentication. |
| 4.1.2–4.1.3 | Expose names, roles, values, and status messages. |

Large text means at least 18pt, equivalent to 24 CSS pixels, or 14pt bold, about 18.67 CSS pixels. See [W3C's contrast explanation](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html). Do not round a failing contrast ratio upward.

Record the URL or state tested, input method, browser, assistive technology, and remaining barriers. Automated tests cover only part of WCAG. A successful axe or Lighthouse run does not establish full conformance.
