"""Run against JTSC_BASE_URL (default local development server), without changing data."""
import os
from playwright.sync_api import sync_playwright

base = os.environ.get("JTSC_BASE_URL", "http://localhost:3014")
with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    for width, height in [(1365, 900), (390, 844)]:
        page = browser.new_page(viewport={"width": width, "height": height})
        page.goto(f"{base}/state-times", wait_until="networkidle")
        page.get_by_role("button", name="Motivational levels").click()
        page.get_by_label("Age", exact=True).fill("10")
        card = page.locator("figure.qt-card").filter(has=page.get_by_text("50 Free", exact=True))
        assert card.get_by_text("39.79", exact=True).count() == 1
        assert card.get_by_text("28.29", exact=True).count() == 1
        card.get_by_label("Your time").fill("30.89")
        assert card.get_by_label("Already met").count() == 4
        assert page.get_by_text("JTSC Team Record", exact=False).count() == 0
        page.get_by_role("button", name="Boys", exact=True).click()
        assert card.get_by_text("38.19", exact=True).count() == 1
        page.get_by_role("button", name="LCM", exact=True).click()
        page.get_by_role("button", name="IM", exact=True).click()
        assert page.locator("figure.qt-card").filter(has=page.get_by_text("100 IM", exact=True)).count() == 0
        page.get_by_role("button", name="Meet qualifying times").click()
        assert page.get_by_text("Oklahoma Swimming", exact=False).count() > 0
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
        page.goto(f"{base}/parent-guide", wait_until="networkidle")
        assert page.locator("body").inner_text().strip()
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
        page.goto(f"{base}/#state-times", wait_until="networkidle")
        page.get_by_role("button", name="Motivational levels").click()
        assert page.get_by_text("USA Swimming 2024–2028", exact=False).first.is_visible()
        page.close()
        print(f"Passed state times and parent guide at {width}px")
    browser.close()
