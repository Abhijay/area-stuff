"""Items, their areas, and how the panel groups and searches them. No Home Assistant imports."""

from __future__ import annotations

import uuid
from dataclasses import asdict, dataclass, field, fields

NEED, HAVE = "need", "have"
STATUSES = (NEED, HAVE)
UNSORTED_TITLE = {NEED: "Anywhere", HAVE: "To sort"}


@dataclass
class Item:
    name: str
    status: str = NEED
    area_id: str | None = None
    quantity: int = 1
    note: str = ""
    image: str | None = None
    link: str | None = None
    id: str = field(default_factory=lambda: uuid.uuid4().hex)
    created: str = ""
    updated: str = ""

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict) -> Item:
        known = {f.name for f in fields(cls)}
        return cls(**{key: value for key, value in data.items() if key in known})


def clean(changes: dict) -> dict:
    """Validate the fields a caller may set; raise ValueError on anything unusable."""
    result = {}
    if "name" in changes:
        name = " ".join(str(changes["name"] or "").split())
        if not name:
            raise ValueError("Name is required")
        result["name"] = name
    if "status" in changes:
        if changes["status"] not in STATUSES:
            raise ValueError(f"Status must be one of {', '.join(STATUSES)}")
        result["status"] = changes["status"]
    if "quantity" in changes:
        quantity = int(changes["quantity"])
        if quantity < 1:
            raise ValueError("Quantity must be at least 1")
        result["quantity"] = quantity
    for key in ("area_id", "image", "link"):
        if key in changes:
            result[key] = changes[key] or None
    if "note" in changes:
        result["note"] = str(changes["note"] or "").strip()
    return result


def matches(item: Item, query: str, area_names: dict[str, str]) -> bool:
    """Every word of the query appears in the item's name, note or area name."""
    text = " ".join([item.name, item.note, area_names.get(item.area_id or "", "")]).casefold()
    return all(word in text for word in query.casefold().split())


def ordered_areas(areas: list[dict], floors: list[dict]) -> list[dict]:
    """Areas by floor level (lowest first), then areas with no floor, each by name."""
    rank = {floor["id"]: (floor.get("level") is None, floor.get("level") or 0, floor["name"].casefold()) for floor in floors}
    return sorted(areas, key=lambda area: (area.get("floor_id") not in rank, rank.get(area.get("floor_id"), ()), area["name"].casefold()))


def area_key(item: Item, area_names: dict[str, str]) -> str | None:
    """The item's area, or None when it has none or its area was deleted."""
    return item.area_id if item.area_id in area_names else None


def in_area(items: list[Item], area: str, areas: list[dict]) -> list[Item]:
    """Filter to ``"all"``, ``"none"`` (no area, or a deleted one), or one area ID."""
    if area == "all":
        return items
    area_names = {entry["id"]: entry["name"] for entry in areas}
    wanted = None if area == "none" else area
    return [item for item in items if area_key(item, area_names) == wanted]


def sections(items: list[Item], areas: list[dict], floors: list[dict], status: str | None, query: str = "") -> list[dict]:
    """Group items into unsorted first, then areas by floor level, then areas with no floor.

    ``areas`` are ``{"id", "name", "floor_id"}`` and ``floors`` are ``{"id", "name", "level"}``.
    Items whose area was deleted count as unsorted. Only non-empty sections are returned.
    """
    area_names = {area["id"]: area["name"] for area in areas}
    floor_names = {floor["id"]: floor["name"] for floor in floors}
    chosen = [item for item in items if (status is None or item.status == status) and matches(item, query, area_names)]
    by_area: dict[str | None, list[Item]] = {}
    for item in chosen:
        by_area.setdefault(area_key(item, area_names), []).append(item)

    result = []
    if None in by_area:
        result.append({"area_id": None, "name": UNSORTED_TITLE.get(status, "No area"), "floor": None, "items": by_area[None]})
    for area in ordered_areas(areas, floors):
        if area["id"] in by_area:
            result.append({"area_id": area["id"], "name": area["name"], "floor": floor_names.get(area.get("floor_id")), "items": by_area[area["id"]]})
    for section in result:
        section["items"] = [item.to_dict() for item in sorted(section["items"], key=lambda item: item.name.casefold())]
    return result


def navigation(items: list[Item], areas: list[dict], floors: list[dict]) -> dict:
    """Every area with its need and have counts, grouped by floor in display order."""
    area_names = {area["id"]: area["name"] for area in areas}
    counts: dict[str | None, dict[str, int]] = {}
    for item in items:
        tally = counts.setdefault(area_key(item, area_names), dict.fromkeys(STATUSES, 0))
        tally[item.status] += 1
    empty = dict.fromkeys(STATUSES, 0)
    floor_names = {floor["id"]: floor["name"] for floor in floors}
    groups: list[dict] = []
    for area in ordered_areas(areas, floors):
        floor_id = area.get("floor_id") if area.get("floor_id") in floor_names else None
        if not groups or groups[-1]["id"] != floor_id:
            groups.append({"id": floor_id, "name": floor_names.get(floor_id), "areas": []})
        groups[-1]["areas"].append({"id": area["id"], "name": area["name"], **counts.get(area["id"], empty)})
    totals = {status: sum(tally[status] for tally in counts.values()) for status in STATUSES}
    return {"all": totals, "none": counts.get(None, empty), "floors": groups}


def find_area(value: str | None, areas: list[dict]) -> str | None:
    """Resolve an area ID or a case-insensitive area name; unknown values raise ValueError."""
    if not value:
        return None
    for area in areas:
        if value == area["id"] or value.casefold() == area["name"].casefold():
            return area["id"]
    raise ValueError(f"No area named {value}")
