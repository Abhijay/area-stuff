"""Websocket commands for the panel, and the add_item service for automations."""

from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, ServiceCall, ServiceResponse, SupportsResponse, callback
from homeassistant.exceptions import ServiceValidationError
from homeassistant.helpers import config_validation as cv

from .const import DOMAIN, SERVICE_ADD_ITEM
from .store import StuffStore
from .stuff import STATUSES, in_area, navigation, sections

FIELDS = {
    vol.Optional("status"): vol.In(STATUSES),
    vol.Optional("area_id"): vol.Any(None, str),
    vol.Optional("quantity"): vol.All(vol.Coerce(int), vol.Range(min=1)),
    vol.Optional("note"): vol.Any(None, str),
    vol.Optional("image"): vol.Any(None, str),
    vol.Optional("link"): vol.Any(None, str),
    **{vol.Optional(key): vol.Any(None, str) for key in ("manufacturer", "model_number", "serial_number", "purchase_from", "purchase_date", "warranty_expires")},
    vol.Optional("purchase_price"): vol.Any(None, vol.All(vol.Coerce(float), vol.Range(min=0))),
    vol.Optional("lifetime_warranty"): bool,
    vol.Optional("insured"): bool,
    vol.Optional("tags"): [str],
}


def _store(hass: HomeAssistant) -> StuffStore | None:
    entries = hass.config_entries.async_entries(DOMAIN)
    return getattr(entries[0], "runtime_data", None) if entries else None


@callback
def async_register_commands(hass: HomeAssistant) -> None:
    for command in (ws_sections, ws_subscribe, ws_add, ws_update, ws_remove):
        websocket_api.async_register_command(hass, command)


def _loaded(handler):
    """Answer not_loaded instead of running the command before the entry is set up."""

    async def wrapper(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
        if (store := _store(hass)) is None:
            connection.send_error(msg["id"], "not_loaded", "Area Stuff is not loaded")
            return
        try:
            await handler(hass, connection, msg, store)
        except KeyError:
            connection.send_error(msg["id"], "not_found", "No such item")
        except ValueError as err:
            connection.send_error(msg["id"], "invalid_format", str(err))

    return wrapper


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/sections", vol.Optional("status"): vol.Any(None, vol.In(STATUSES)), vol.Optional("query", default=""): str, vol.Optional("area", default="all"): str})
@websocket_api.async_response
@_loaded
async def ws_sections(hass, connection, msg, store: StuffStore) -> None:
    """``area`` is ``"all"``, ``"none"`` or an area ID; ``counts`` cover that area, ``nav`` covers every area."""
    items = list(store.items.values())
    areas, floors = store.areas(), store.floors()
    shown = in_area(items, msg["area"], areas)
    connection.send_result(msg["id"], {
        "sections": sections(shown, areas, floors, msg.get("status"), msg["query"]),
        "counts": {status: sum(item.status == status for item in shown) for status in STATUSES},
        "nav": navigation(items, areas, floors),
        "areas": sorted(areas, key=lambda area: area["name"].casefold()),
    })


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/subscribe"})
@websocket_api.async_response
@_loaded
async def ws_subscribe(hass, connection, msg, store: StuffStore) -> None:
    """Send an empty event whenever an item changes; the panel refetches what it shows."""
    connection.subscriptions[msg["id"]] = store.async_listen(lambda: connection.send_message(websocket_api.event_message(msg["id"], {})))
    connection.send_result(msg["id"])


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/add", vol.Required("name"): str, **FIELDS})
@websocket_api.async_response
@_loaded
async def ws_add(hass, connection, msg, store: StuffStore) -> None:
    item = await store.async_add({key: value for key, value in msg.items() if key not in ("id", "type")})
    connection.send_result(msg["id"], item.to_dict())


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/update", vol.Required("item_id"): str, vol.Optional("name"): str, **FIELDS})
@websocket_api.async_response
@_loaded
async def ws_update(hass, connection, msg, store: StuffStore) -> None:
    item = await store.async_update(msg["item_id"], {key: value for key, value in msg.items() if key not in ("id", "type", "item_id")})
    connection.send_result(msg["id"], item.to_dict())


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/remove", vol.Required("item_ids"): [str]})
@websocket_api.async_response
@_loaded
async def ws_remove(hass, connection, msg, store: StuffStore) -> None:
    await store.async_remove(msg["item_ids"])
    connection.send_result(msg["id"])


ADD_ITEM_SCHEMA = vol.Schema({vol.Required("name"): cv.string, vol.Optional("area"): vol.Any(None, cv.string), **FIELDS})


@callback
def async_register_services(hass: HomeAssistant, store: StuffStore) -> None:
    async def add_item(call: ServiceCall) -> ServiceResponse:
        data: dict[str, Any] = dict(call.data)
        if "area" in data:
            data["area_id"] = data.pop("area")
        try:
            item = await store.async_add(data)
        except ValueError as err:
            raise ServiceValidationError(str(err)) from err
        return item.to_dict()

    hass.services.async_register(DOMAIN, SERVICE_ADD_ITEM, add_item, ADD_ITEM_SCHEMA, supports_response=SupportsResponse.OPTIONAL)
