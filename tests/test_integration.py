import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry

from homeassistant.helpers import area_registry as ar, floor_registry as fr
from homeassistant.setup import async_setup_component

DOMAIN = "area_stuff"
SHOPPING = "todo.area_stuff_shopping"


@pytest.fixture
async def setup(hass):
    await async_setup_component(hass, "http", {})
    upstairs = fr.async_get(hass).async_create("Upstairs", level=1)
    office = ar.async_get(hass).async_create("Office", floor_id=upstairs.floor_id)
    entry = MockConfigEntry(domain=DOMAIN, title="Area Stuff")
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return office


async def todo_items(hass):
    response = await hass.services.async_call("todo", "get_items", {"entity_id": SHOPPING}, blocking=True, return_response=True)
    return response[SHOPPING]["items"]


async def test_service_adds_by_area_name_and_the_shopping_list_shows_needs(hass, setup):
    item = await hass.services.async_call(DOMAIN, "add_item", {"name": "Real second desk", "area": "office"}, blocking=True, return_response=True)
    assert item["area_id"] == setup.id and item["status"] == "need"
    await hass.services.async_call(DOMAIN, "add_item", {"name": "Glue", "status": "have"}, blocking=True)
    assert [(i["summary"], i.get("description")) for i in await todo_items(hass)] == [("Real second desk", "Office")]
    assert hass.states.get(SHOPPING).state == "1"


async def test_checking_off_on_the_list_moves_the_item_to_have(hass, setup, hass_ws_client):
    await hass.services.async_call("todo", "add_item", {"entity_id": SHOPPING, "item": "TV mount"}, blocking=True)
    [item] = await todo_items(hass)
    await hass.services.async_call("todo", "update_item", {"entity_id": SHOPPING, "item": item["uid"], "status": "completed"}, blocking=True)
    assert await todo_items(hass) == []

    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": f"{DOMAIN}/sections", "status": "have"})
    result = (await client.receive_json())["result"]
    assert [(s["name"], [i["name"] for i in s["items"]]) for s in result["sections"]] == [("To sort", ["TV mount"])]
    assert result["counts"] == {"need": 0, "have": 1}


async def test_panel_commands_add_move_search_and_remove(hass, setup, hass_ws_client):
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": f"{DOMAIN}/subscribe"})
    assert (await client.receive_json())["success"]

    await client.send_json_auto_id({"type": f"{DOMAIN}/add", "name": "Cordless drill", "status": "have", "note": "red case"})
    events_and_result = [await client.receive_json(), await client.receive_json()]
    added = next(m for m in events_and_result if m["type"] == "result")["result"]
    assert any(m["type"] == "event" for m in events_and_result)

    await client.send_json_auto_id({"type": f"{DOMAIN}/update", "item_id": added["id"], "area_id": setup.id})
    while (message := await client.receive_json())["type"] != "result":
        pass
    assert message["result"]["area_id"] == setup.id

    await client.send_json_auto_id({"type": f"{DOMAIN}/sections", "query": "red office"})
    while (message := await client.receive_json())["type"] != "result":
        pass
    assert [(s["name"], s["floor"]) for s in message["result"]["sections"]] == [("Office", "Upstairs")]

    await client.send_json_auto_id({"type": f"{DOMAIN}/update", "item_id": "missing", "name": "x"})
    while (message := await client.receive_json())["type"] != "result":
        pass
    assert message["error"]["code"] == "not_found"

    await client.send_json_auto_id({"type": f"{DOMAIN}/remove", "item_ids": [added["id"]]})
    while (message := await client.receive_json())["type"] != "result":
        pass
    assert message["success"]


async def test_items_survive_a_reload(hass, setup):
    await hass.services.async_call(DOMAIN, "add_item", {"name": "Carpet for litter area"}, blocking=True)
    entry = hass.config_entries.async_entries(DOMAIN)[0]
    assert await hass.config_entries.async_reload(entry.entry_id)
    await hass.async_block_till_done()
    assert [i["summary"] for i in await todo_items(hass)] == ["Carpet for litter area"]


async def test_unknown_area_is_a_validation_error(hass, setup):
    from homeassistant.exceptions import ServiceValidationError

    with pytest.raises(ServiceValidationError):
        await hass.services.async_call(DOMAIN, "add_item", {"name": "Rug", "area": "Attic"}, blocking=True)
