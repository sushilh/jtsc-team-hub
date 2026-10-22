"""Import a supplied roster into an isolated localhost test database only."""
import os
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

base = os.environ.get("JTSC_BASE_URL", "http://127.0.0.1:3011")
if urlparse(base).hostname not in {"localhost", "127.0.0.1", "::1"}:
    raise RuntimeError("Import test requires an isolated localhost database")
pin = os.environ["JTSC_TEST_ADMIN_PIN"]
signup = os.environ["JTSC_SIGNUP_FILE"]

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 390, "height": 844})
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(f"{base}/admin", wait_until="domcontentloaded")
    page.get_by_label("Admin access code", exact=True).fill(pin)
    page.get_by_role("button", name="Enter admin portal").click()
    page.get_by_text("Meet-day overview").wait_for()
    page.get_by_role("button", name="Sessions & jobs").click()
    page.locator(".signup-upload-form input[type=file]").set_input_files(signup)
    page.get_by_role("button", name="Import signup file").click()
    page.locator(".admin-notice.success").wait_for()
    public = page.request.get(f"{base}/api/public").json()
    assert len(public["signupDates"]) == 3
    controls = page.locator(".meet-checkin-row")
    assert controls.count() == 5
    saturday_am = controls.filter(has_text="Oct 24, 2026 · AM")
    saturday_pm = controls.filter(has_text="Oct 24, 2026 · PM")
    assert saturday_am.count() == saturday_pm.count() == 1
    saturday_am.get_by_role("button", name="Open check-in").click()
    saturday_am.get_by_text("Manually open").wait_for()
    assert saturday_pm.get_by_text("Follows schedule").count() == 1
    state = page.request.get(f"{base}/api/public").json()
    assert next(s for s in state["signupSessions"] if s["eventDate"] == "2026-10-24" and s["period"] == "morning")["checkinOpen"]
    assert not next(s for s in state["signupSessions"] if s["eventDate"] == "2026-10-24" and s["period"] == "later")["checkinOpen"]
    meet = next(s for s in state["signupDates"] if s["eventDate"] == "2026-10-24")
    page.goto(f"{base}/volunteers", wait_until="domcontentloaded")
    selector = page.get_by_label("Meet date and session")
    selector.wait_for()
    selector.select_option(value=f'{meet["eventDate"]}|||{meet["eventTitle"]}|||morning')
    assert page.locator("article.signup-person button").first.is_enabled()
    selector.select_option(value=f'{meet["eventDate"]}|||{meet["eventTitle"]}|||later')
    assert page.locator("article.signup-person button").first.is_disabled()
    page.goto(f"{base}/admin", wait_until="domcontentloaded")
    page.get_by_role("button", name="Sessions & jobs").click()
    saturday_am = page.locator(".meet-checkin-row").filter(has_text="Oct 24, 2026 · AM")
    saturday_am.get_by_role("button", name="Use scheduled check-in").click()
    saturday_am.get_by_text("Follows schedule").wait_for()
    page.goto(f"{base}/volunteers", wait_until="domcontentloaded")
    date = page.get_by_label("Meet date and session")
    date.wait_for()
    assert date.locator("option").count() == 5
    assert [option.split("|||")[-1] for option in date.locator("option").evaluate_all("nodes => nodes.map(node => node.value)")] == ["later", "morning", "later", "morning", "later"]
    labels = date.locator("option").all_text_contents()
    assert "Oct 24, 2026 · AM" in labels[1] and "Oct 24, 2026 · PM" in labels[2]
    assert "Oct 25, 2026 · AM" in labels[3] and "Oct 25, 2026 · PM" in labels[4]
    saturday = next(item for item in public["signupDates"] if item["eventDate"] == "2026-10-24")
    sunday = next(item for item in public["signupDates"] if item["eventDate"] == "2026-10-25")
    for day in (saturday, sunday):
        date.select_option(value=f'{day["eventDate"]}|||{day["eventTitle"]}|||morning')
        assert page.locator(".signup-result-head strong").inner_text() == "29"
        assert page.locator("article.signup-person").count() == 29
        date.select_option(value=f'{day["eventDate"]}|||{day["eventTitle"]}|||later')
        assert page.locator(".signup-result-head strong").inner_text() == "27"
        assert page.locator("article.signup-person").count() == 27
        page.locator(".walkin-panel summary").click()
        assert page.locator(".signup-walkin-form").count() == 1 or not day["checkinOpen"]
        page.locator(".walkin-panel summary").click()
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
    # A repeat upload of the exact file must not erase a desk check-in or change
    # the assignments/session options. This runs only against an isolated DB.
    for period in ("morning", "later"):
        opened = page.request.post(f"{base}/api/admin", data={"action": "set_signup_session_checkin", "eventDate": saturday["eventDate"], "eventTitle": saturday["eventTitle"], "period": period, "checkinMode": "open"}, headers={"Origin": base})
        assert opened.ok
    row = next(item for item in public["signupRows"] if item["eventDate"] == saturday["eventDate"] and not item["completed"])
    checked = page.request.post(f"{base}/api/checkins", data={"action": "signup_checkin", "id": row["id"], "creditedHours": row["creditPossible"]}, headers={"Origin": base})
    assert checked.ok
    page.goto(f"{base}/admin", wait_until="domcontentloaded")
    page.get_by_role("button", name="Sessions & jobs").click()
    page.locator(".signup-upload-form input[type=file]").set_input_files(signup)
    page.get_by_role("button", name="Import signup file").click()
    page.locator(".admin-notice.success").wait_for()
    after = page.request.get(f"{base}/api/public").json()
    saved = next(item for item in after["signupRows"] if item["id"] == row["id"])
    assert saved["checkedInAt"] and saved["creditedValue"] == row["creditPossible"]
    assert len(after["signupRows"]) == len(public["signupRows"])
    page.goto(f"{base}/volunteers", wait_until="domcontentloaded")
    date = page.get_by_label("Meet date and session")
    date.wait_for()
    assert date.locator("option").count() == 5
    page.goto(f"{base}/parent-guide", wait_until="domcontentloaded")
    assert page.locator("body").inner_text().strip()
    assert not errors, errors
    browser.close()
print("Real workbook import and separate Saturday/Sunday sessions passed at 390px")
