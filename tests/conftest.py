from pathlib import Path

import pytest

pytest_plugins = "pytest_homeassistant_custom_component"


@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(enable_custom_integrations):
    # The test harness ships its own custom_components package; the loader walks its __path__.
    import custom_components

    repo = str(Path(__file__).resolve().parents[1] / "custom_components")
    if repo not in custom_components.__path__:
        custom_components.__path__.append(repo)
    yield
