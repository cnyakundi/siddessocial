"""Siddes Sets / Subsides backend scaffolding.

Sets are "rooms inside a Side". In early dev, the frontend keeps Sets in localStorage.
This backend module is the server-ready scaffold so we can later enforce:
- ownership
- membership
- history/audit trail
- side inheritance

This module is framework-agnostic and is wired via templates in:
- django_ninja_template.py
- drf_template.py
"""
