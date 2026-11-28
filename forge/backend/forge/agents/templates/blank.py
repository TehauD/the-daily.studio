"""Blank agent: add your own tables, rules and skills."""
ID = "blank"
TEMPLATE = {"title": "Blank agent", "domain": "Any", "description": "Start from nothing: add your own tables, rules and skills.",
            "role": "", "tables": [], "tools": {"calculator": True, "units": False, "dates": False, "rules": [], "knowledge_pack": None},
            "skills": []}


def values(tables):
    return {}
