# ML Part 7 - Side Guards (Public vs Private)

Siddes must protect users from mis-post risk. The highest-risk mistake is
accidentally pushing a contact-derived group into a Public context.

Rule:
- Contacts-derived suggestions are never Public.
- Public is for Topics / broadcasts / intentionally public discovery - not your address book.

Where enforced (implemented):
- Suggested Sets UI disables the Public pill for contacts-derived suggestions.
- On-device engine defaults to Friends/Close/Work for contact clusters.

Why:
- Fear of posting kills posting.
- Side guards keep the Clerkless Context Engine safe and trustworthy.
