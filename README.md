[![Validate](https://github.com/Abhijay/area-stuff/actions/workflows/validate.yml/badge.svg)](https://github.com/Abhijay/area-stuff/actions/workflows/validate.yml)

# Area Stuff

[![Open your Home Assistant instance and open this repository inside HACS.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=Abhijay&repository=area-stuff&category=integration)

A Home Assistant custom integration that keeps a shopping list and a record of
what you own, both organised by your Home Assistant areas.

The two are one list. Something you **need** for the office becomes something
you **have** in the office when you check it off, so you never retype it, and
later you can search for it and see which area it is in.

## What it does

- Adds a **Stuff** panel to the sidebar with **Shopping List** and **Inventory** tabs. Items
  are grouped by area, areas by floor (lowest level first), using your real
  areas and floors, so renaming or adding an area shows up straight away.
- A search box across both tabs answers "where's the drill?". It matches every
  word against the item's name, note and area.
- Each item has a name, area, quantity, note, and an optional image and link.
  Move an item by picking a new area; click it to edit the rest.
- Items with no area are listed first: **Anywhere** for needs, **To sort** for
  things you have but haven't put away yet.
- Creates `todo.area_stuff_shopping` with everything you need, so the companion
  app, voice assistants and the built-in to-do card keep working. Items added
  there have no area until you give them one; completing one moves it to Inventory.
- Adds an `area_stuff.add_item` action, so automations can add things. For
  example, record each delivered package as something you have, to sort into
  an area once it's unpacked:

  ```yaml
  action: area_stuff.add_item
  data:
    name: "{{ trigger.event.data.name }}"
    status: have
    image: "{{ trigger.event.data['items'][0].image }}"
  ```

  `area` takes an area ID or name. The action returns the stored item.

Items are stored in Home Assistant's `.storage/area_stuff`, on your own
instance. Nothing leaves it.

## Install

1. In HACS, add this repository as a custom repository (category: Integration),
   or use the button above.
2. Download **Area Stuff** and restart Home Assistant.
3. Settings → Devices & services → Add integration → **Area Stuff**.

## Development

```sh
python3 -m venv .venv
.venv/bin/pip install -r requirements_test.txt
.venv/bin/pytest tests
```
