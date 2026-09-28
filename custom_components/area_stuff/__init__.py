"""Area Stuff: what you need and what you have, by Home Assistant area."""

from __future__ import annotations

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant

from .api import async_register_commands, async_register_services
from .const import DOMAIN, SERVICE_ADD_ITEM
from .panel import async_register_panel, async_remove_panel
from .store import StuffStore

PLATFORMS = [Platform.TODO]


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up from a config entry."""
    store = StuffStore(hass)
    await store.async_load()
    entry.runtime_data = store
    async_register_commands(hass)
    async_register_services(hass, store)
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    await async_register_panel(hass)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    async_remove_panel(hass)
    hass.services.async_remove(DOMAIN, SERVICE_ADD_ITEM)
    return await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
