"""The Need items as a to-do list, so the companion app and voice can add to it."""

from __future__ import annotations

from homeassistant.components.todo import TodoItem, TodoItemStatus, TodoListEntity, TodoListEntityFeature
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

from .store import StuffStore
from .stuff import HAVE, NEED


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddConfigEntryEntitiesCallback) -> None:
    async_add_entities([ShoppingList(entry)])


class ShoppingList(TodoListEntity):
    """Items still needed. Completing one moves it to Inventory in the same area."""

    _attr_name = "Area Stuff Shopping"
    _attr_icon = "mdi:cart-outline"
    _attr_should_poll = False
    _attr_supported_features = (
        TodoListEntityFeature.CREATE_TODO_ITEM | TodoListEntityFeature.UPDATE_TODO_ITEM | TodoListEntityFeature.DELETE_TODO_ITEM
    )

    def __init__(self, entry: ConfigEntry) -> None:
        self._store: StuffStore = entry.runtime_data
        self._attr_unique_id = f"{entry.entry_id}_shopping"

    async def async_added_to_hass(self) -> None:
        self.async_on_remove(self._store.async_listen(self.async_write_ha_state))

    @property
    def todo_items(self) -> list[TodoItem]:
        needed = sorted((item for item in self._store.items.values() if item.status == NEED), key=lambda item: item.created)
        return [
            TodoItem(
                uid=item.id,
                summary=item.name if item.quantity == 1 else f"{item.name} ×{item.quantity}",
                status=TodoItemStatus.NEEDS_ACTION,
                description=" · ".join(part for part in (self._store.area_name(item.area_id), item.note) if part) or None,
            )
            for item in needed
        ]

    async def async_create_todo_item(self, item: TodoItem) -> None:
        await self._store.async_add({"name": item.summary, "status": NEED})

    async def async_update_todo_item(self, item: TodoItem) -> None:
        if item.status == TodoItemStatus.COMPLETED:
            await self._store.async_update(item.uid, {"status": HAVE})
            return
        current = self._store.items[item.uid]
        shown = current.name if current.quantity == 1 else f"{current.name} ×{current.quantity}"
        if item.summary and item.summary != shown:
            await self._store.async_update(item.uid, {"name": item.summary})

    async def async_delete_todo_items(self, uids: list[str]) -> None:
        await self._store.async_remove(uids)
