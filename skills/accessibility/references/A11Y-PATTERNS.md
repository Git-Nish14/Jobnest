# Accessibility code patterns

Use established components when they already provide keyboard and focus behavior. Check [WAI-ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/patterns/) for the interaction model before building a custom widget.

## Modal focus trap

In this repository, use the existing Radix Dialog components. Give the dialog a title and an accessible close button. Move initial focus to an appropriate heading or control. Tab and Shift+Tab must stay inside an open modal. Escape closes it and restores focus to its trigger, unless an action deliberately navigates to another target. A dropdown inside a dialog should consume its first Escape without closing the dialog.

For native `<dialog>`, use `showModal()`, not an `open` attribute alone. Check initial focus, Escape, and focus restoration in supported browsers. Never use a modal focus trap on ordinary page content.

## Skip link

```html
<a class="skip-link" href="#main-content">Skip to main content</a>
<main id="main-content" tabindex="-1">...</main>
```

Hide the link visually until focused. Keep it above fixed navigation when focused. Use one main landmark and a unique target ID.

## Dragging movements

Give draggable items equivalent buttons, such as Move up and Move down. After reordering, keep focus on the moved item's control and announce its new position. The accessibility ball in this project also offers corner choices and a position reset so dragging is optional.

## Form labels

```html
<label for="email">Email address</label>
<input id="email" name="email" type="email" autocomplete="email"
       aria-describedby="email-hint">
<p id="email-hint">We'll send your booking confirmation here.</p>
```

Placeholders supplement labels. They do not replace them. Group related controls with a fieldset and legend when appropriate.

## Error handling

```html
<label for="departure">Departure date</label>
<input id="departure" type="date" aria-invalid="true"
       aria-describedby="departure-error">
<p id="departure-error" role="alert">Choose today or a later date.</p>
```

Validate on submit, preserve entered values, and focus the first invalid field or a linked error summary. Clear stale error states after correction. Avoid repeatedly announcing errors on every keystroke.

## ARIA tabs

Use a `tablist` containing `tab` buttons, each connected to a `tabpanel` with `aria-controls` and `aria-labelledby`. Set `aria-selected` on the active tab. Give only the active tab `tabindex="0"`; others use `-1`. Support arrow keys and Home/End. Use automatic activation only when the panel appears without noticeable latency.

## Live regions and notifications

Mount a persistent empty `role="status"` region, then update its text for routine confirmations. Reserve `role="alert"` for urgent errors. Do not announce the same update through both a live region and automatic speech. Do not move focus for routine notifications.

```html
<p role="status" aria-atomic="true" id="save-status"></p>
```

```js
document.getElementById('save-status').textContent = 'Trip saved.';
```

## Screen reader commands

On Windows, use NVDA browse mode to inspect headings, landmarks, links, and form controls, then focus mode to operate fields. On macOS, use VoiceOver's rotor to inspect the same structures. On Android, use TalkBack swipe navigation and explore by touch. Consult each screen reader's current help for shortcuts and keyboard layouts.

For each journey, verify names and states, reading order, focus changes, errors, status announcements, and whether a user can complete the action. Record the actual device/browser combination and results.
