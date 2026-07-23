"""
Bracket tables and scenario models for the Tax Calculation engine.
The engine owns these reference tables and scenario models; the Express Core never touches them directly.
"""

from app.db import (
    add_scenario_for_case,
    get_db,
    get_db_connection,
    get_federal_brackets,
    get_state_brackets,
    init_db,
    seed_brackets,
)

__all__ = [
    "get_db_connection",
    "get_db",
    "init_db",
    "seed_brackets",
    "get_federal_brackets",
    "get_state_brackets",
    "add_scenario_for_case",
]
