# Issues Identified

## 1. Git Branch Clutter

**Description:** There are approximately 126 branches, most of which are remote branches merged into `main`.
**Status:** Local merged branches cleaned up. Remote branches require manual deletion or a script run with credentials.
**Action:** Review and delete remote branches that are already merged.

## 2. Missing Backend XSS Sanitization

**Description:** User input was not consistently sanitized against XSS before processing/storage.
**Status:** Fixed.
**Details:** Implemented `sanitize_xss` in `lib/validation.php` and applied it to `normalize_appointment`, `normalize_review`, and `normalize_callback` in `lib/models.php`.

## 3. Incomplete PHPUnit Configuration

**Description:** `phpunit.xml` was missing test suites for `Booking`, `Payment`, `Security`, and `Integration`.
**Status:** Fixed.
**Details:** Updated `phpunit.xml` to include these directories.
