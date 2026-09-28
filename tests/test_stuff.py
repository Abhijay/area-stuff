import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "custom_components" / "area_stuff"))

from stuff import HAVE, NEED, Item, clean, find_area, matches, sections  # noqa: E402

FLOORS = [{"id": "up", "name": "Upstairs", "level": 1}, {"id": "main", "name": "Main", "level": 0}]
AREAS = [
    {"id": "office", "name": "Office", "floor_id": "up"},
    {"id": "kitchen", "name": "Kitchen", "floor_id": "main"},
    {"id": "bedroom", "name": "Bedroom", "floor_id": "up"},
    {"id": "garage", "name": "Garage", "floor_id": None},
]


def names(result):
    return [(section["name"], [item["name"] for item in section["items"]]) for section in result]


def test_sections_put_unsorted_first_then_floors_by_level_then_floorless_areas():
    items = [
        Item("Drill", HAVE, "garage"),
        Item("desk lamp", HAVE, "office"),
        Item("Blender", HAVE, "kitchen"),
        Item("Cable ties", HAVE, None),
        Item("Adapter", HAVE, "office"),
        Item("Pillow", HAVE, "bedroom"),
    ]
    assert names(sections(items, AREAS, FLOORS, HAVE)) == [
        ("To sort", ["Cable ties"]),
        ("Kitchen", ["Blender"]),
        ("Bedroom", ["Pillow"]),
        ("Office", ["Adapter", "desk lamp"]),
        ("Garage", ["Drill"]),
    ]


def test_sections_filter_by_status_and_label_unsorted_needs_as_anywhere():
    items = [Item("TV mount", NEED, None), Item("Desk", NEED, "office"), Item("Monitor", HAVE, "office")]
    assert names(sections(items, AREAS, FLOORS, NEED)) == [("Anywhere", ["TV mount"]), ("Office", ["Desk"])]
    assert names(sections(items, AREAS, FLOORS, None))[0] == ("No area", ["TV mount"])


def test_items_in_a_deleted_area_fall_back_to_unsorted():
    assert names(sections([Item("Rug", HAVE, "gone")], AREAS, FLOORS, HAVE)) == [("To sort", ["Rug"])]


def test_search_matches_every_word_across_name_note_and_area():
    drill = Item("Cordless drill", HAVE, "garage", note="bits in the red case")
    area_names = {area["id"]: area["name"] for area in AREAS}
    assert matches(drill, "drill", area_names)
    assert matches(drill, "RED garage", area_names)
    assert not matches(drill, "drill kitchen", area_names)
    assert names(sections([drill, Item("Blender", HAVE, "kitchen")], AREAS, FLOORS, HAVE, "drill")) == [("Garage", ["Cordless drill"])]


def test_clean_normalises_and_rejects_bad_fields():
    assert clean({"name": "  Real   second desk ", "area_id": "", "note": " oak ", "quantity": "2"}) == {
        "name": "Real second desk", "area_id": None, "note": "oak", "quantity": 2}
    for bad in ({"name": "  "}, {"status": "lost"}, {"quantity": 0}):
        with pytest.raises(ValueError):
            clean(bad)


def test_items_round_trip_and_ignore_unknown_stored_fields():
    item = Item("Glue", HAVE, "office", image="https://img/glue.jpg")
    assert Item.from_dict({**item.to_dict(), "legacy": True}) == item


def test_find_area_accepts_ids_and_names():
    assert find_area("office", AREAS) == "office"
    assert find_area("kitchen", AREAS) == "kitchen"
    assert find_area("KITCHEN", AREAS) == "kitchen"
    assert find_area("", AREAS) is None
    with pytest.raises(ValueError):
        find_area("Attic", AREAS)
