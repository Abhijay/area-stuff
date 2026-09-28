"""Persisted items plus the area and floor registries they are grouped by."""

from __future__ import annotations

from collections.abc import Callable

from homeassistant.core import CALLBACK_TYPE, HomeAssistant, callback
from homeassistant.helpers import area_registry as ar, floor_registry as fr
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from .const import STORAGE_KEY, STORAGE_VERSION
from .stuff import Item, clean, find_area


class StuffStore:
    """All items, keyed by ID, saved on every change."""

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self._store: Store[dict] = Store(hass, STORAGE_VERSION, STORAGE_KEY)
        self.items: dict[str, Item] = {}
        self._listeners: list[Callable[[], None]] = []

    async def async_load(self) -> None:
        data = await self._store.async_load() or {}
        self.items = {item.id: item for item in map(Item.from_dict, data.get("items", []))}

    @callback
    def async_listen(self, listener: Callable[[], None]) -> CALLBACK_TYPE:
        self._listeners.append(listener)
        return lambda: self._listeners.remove(listener)

    def areas(self) -> list[dict]:
        return [{"id": area.id, "name": area.name, "floor_id": area.floor_id}
                for area in ar.async_get(self.hass).async_list_areas()]

    def floors(self) -> list[dict]:
        return [{"id": floor.floor_id, "name": floor.name, "level": floor.level}
                for floor in fr.async_get(self.hass).async_list_floors()]

    def area_name(self, area_id: str | None) -> str | None:
        area = ar.async_get(self.hass).async_get_area(area_id) if area_id else None
        return area.name if area else None

    async def async_add(self, changes: dict) -> Item:
        fields = clean({"status": "need", **changes})
        if "area_id" in fields:
            fields["area_id"] = find_area(fields["area_id"], self.areas())
        now = dt_util.utcnow().isoformat()
        item = Item(**fields, created=now, updated=now)
        self.items[item.id] = item
        await self._async_changed()
        return item

    async def async_update(self, item_id: str, changes: dict) -> Item:
        item = self._get(item_id)
        fields = clean(changes)
        if "area_id" in fields:
            fields["area_id"] = find_area(fields["area_id"], self.areas())
        for key, value in fields.items():
            setattr(item, key, value)
        item.updated = dt_util.utcnow().isoformat()
        await self._async_changed()
        return item

    async def async_remove(self, item_ids: list[str]) -> None:
        for item_id in item_ids:
            self._get(item_id)
        for item_id in item_ids:
            del self.items[item_id]
        await self._async_changed()

    def _get(self, item_id: str) -> Item:
        if item_id not in self.items:
            raise KeyError(item_id)
        return self.items[item_id]

    async def _async_changed(self) -> None:
        await self._store.async_save({"items": [item.to_dict() for item in self.items.values()]})
        for listener in list(self._listeners):
            listener()
