import csv
import io
import json
import os
import re
import tempfile
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from playwright.sync_api import sync_playwright


BASE_URL = os.environ.get("JTSC_BASE_URL", "http://127.0.0.1:3011")
ADMIN_PIN = os.environ["JTSC_TEST_ADMIN_PIN"]
REAL_SIGNUP = os.environ.get("JTSC_SIGNUP_FILE", "")
HEADERS = [
    "Event Title", "Event Start Date", "Event End Date", "Account", "Job Name",
    "Credit Possible", "Credit Earned", "Credit Units", "Slot", "Completed?",
    "Notes", "Volunteer Info",
]


def wait_ready(page):
    page.wait_for_load_state("domcontentloaded")
    try:
        page.wait_for_load_state("networkidle", timeout=5000)
    except Exception:
        page.wait_for_timeout(500)


def post_json(page, path, payload):
    return page.request.post(
        f"{BASE_URL}{path}",
        data=json.dumps(payload),
        headers={"Content-Type": "application/json"},
    )


def make_csv(event_date, event_title, volunteers):
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(HEADERS)
    stamp = event_date.strftime("%m/%d/%Y")
    for index, (name, job, hours) in enumerate(volunteers, start=1):
        writer.writerow([
            event_title,
            f"{stamp} 7:00:00 AM",
            f"{stamp} 12:00:00 PM",
            f"Family, {name.split()[0]}\nfamily@example.com",
            job,
            hours,
            0,
            "Hrs.",
            f"#{index}",
            "NO",
            "",
            name,
        ])
    handle = tempfile.NamedTemporaryFile(suffix=".csv", delete=False)
    handle.write(output.getvalue().encode("utf-8"))
    handle.close()
    return handle.name


def open_admin(page):
    page.goto(f"{BASE_URL}/admin")
    wait_ready(page)
    if page.get_by_label("Admin access code", exact=True).is_visible():
        secret = page.get_by_label("Admin access code", exact=True)
        assert secret.get_attribute("type") == "password"
        page.get_by_role("button", name="Show admin access code").click()
        assert secret.get_attribute("type") == "text"
        page.get_by_role("button", name="Hide admin access code").click()
        secret.fill(ADMIN_PIN)
        page.get_by_role("button", name="Enter admin portal").click()
        page.get_by_text("Meet-day overview").wait_for()


def upload_from_admin(page, path):
    page.get_by_role("button", name="Sessions & jobs").click()
    chooser = page.locator(".signup-upload-form input[type=file]")
    chooser.set_input_files(path)
    page.get_by_role("button", name=re.compile("Import signup file")).click()
    page.locator(".admin-notice.success").wait_for()


def set_meet_checkin(page, event_date, event_title, verb):
    open_admin(page)
    page.get_by_role("button", name="Sessions & jobs").click()
    shown_date = datetime.fromisoformat(event_date).strftime("%b %d, %Y").replace(" 0", " ")
    label = f"{verb} check-in for {event_title} on {shown_date}"
    page.get_by_role("button", name=label, exact=True).click()
    page.locator(".admin-notice.success").wait_for()


def clear_import_from_admin(page, file_name):
    open_admin(page)
    page.get_by_role("button", name="Sessions & jobs").click()
    row = page.locator(".import-history-row").filter(has_text=file_name)
    row.get_by_role("button", name="Clear roster…").click()
    confirmation = page.locator(".import-clear-confirm")
    confirmation.get_by_label("Type CLEAR to confirm").fill("CLEAR")
    confirmation.get_by_role("button", name="Clear roster", exact=True).click()
    page.locator(".admin-notice.success").wait_for()


with sync_playwright() as playwright:
    executable = os.environ.get("JTSC_CHROMIUM_EXECUTABLE")
    browser = playwright.chromium.launch(headless=True, executable_path=executable or None)
    page = browser.new_page(viewport={"width": 1365, "height": 900})
    page_errors = []
    page.on("pageerror", lambda error: page_errors.append(str(error)))

    open_admin(page)
    reset = post_json(page, "/api/admin", {"action": "reset_signup_data", "confirm": "RESET"})
    assert reset.ok, reset.text()

    # Empty and recoverable initial-load states remain usable.
    page.goto(f"{BASE_URL}/volunteers")
    wait_ready(page)
    page.get_by_text("No signup roster uploaded yet").wait_for()
    failed = browser.new_page()
    failed.route("**/api/public**", lambda route: route.abort("failed"), times=1)
    failed.goto(f"{BASE_URL}/volunteers")
    failed.get_by_text("The roster could not load").wait_for()
    failed.get_by_role("button", name="Retry loading").click()
    failed.get_by_text("No signup roster uploaded yet").wait_for()
    failed.close()

    if REAL_SIGNUP and os.path.exists(REAL_SIGNUP):
        open_admin(page)
        upload_from_admin(page, REAL_SIGNUP)
        public = page.request.get(f"{BASE_URL}/api/public").json()
        admin_data = page.request.get(f"{BASE_URL}/api/admin").json()
        assert admin_data["signupImports"][0]["rowCount"] == 40
        assert len(public["signupRows"]) == admin_data["signupImports"][0]["assignedCount"]
        names = [row["volunteerName"] for row in public["signupRows"]]
        assert not any("@" in name for name in names)
        assert not any(re.search(r"\d{3}.*\d{3}.*\d{4}", name) for name in names)
        assert sorted(set(name for name in names if "Gorka" in name or "Matute" in name)) == ["Gorka Matute"]
        assert sorted(set(name for name in names if "Lenski" in name)) == ["Ben Lenski"]
        export_id = admin_data["signupImports"][0]["id"]
        exported = page.request.get(f"{BASE_URL}/api/admin/signup-export?importId={export_id}")
        assert exported.ok and len(exported.body()) > 1000
        assert "-updated.xls" in exported.headers["content-disposition"]
        # The real workbook is for a future meet and must remain view-only today.
        page.goto(f"{BASE_URL}/volunteers")
        wait_ready(page)
        page.get_by_role("button", name="Not open").first.wait_for()
        assert page.get_by_role("button", name="Not open").first.is_disabled()
        selected_date, selected_title = page.locator(".signup-toolbar select").input_value().split("|||", 1)
        set_meet_checkin(page, selected_date, selected_title, "Open")
        opened = page.request.get(f"{BASE_URL}/api/public").json()
        opened_meet = next(item for item in opened["signupDates"]
                           if item["eventDate"] == selected_date and item["eventTitle"] == selected_title)
        assert opened_meet["checkinMode"] == "open" and opened_meet["checkinOpen"] is True
        page.goto(f"{BASE_URL}/volunteers")
        wait_ready(page)
        assert page.get_by_role("button", name="Check in").first.is_enabled()
        set_meet_checkin(page, selected_date, selected_title, "Close")
        page.screenshot(path="/tmp/jtsc-admin-meet-controls.png", full_page=True)
        closed = page.request.get(f"{BASE_URL}/api/public").json()
        closed_meet = next(item for item in closed["signupDates"]
                           if item["eventDate"] == selected_date and item["eventTitle"] == selected_title)
        assert closed_meet["checkinMode"] == "closed" and closed_meet["checkinOpen"] is False
        page.goto(f"{BASE_URL}/volunteers")
        wait_ready(page)
        page.get_by_role("button", name="Closed").first.wait_for()
        assert page.get_by_role("button", name="Closed").first.is_disabled()
        clear_import_from_admin(page, os.path.basename(REAL_SIGNUP))
        cleared = page.request.get(f"{BASE_URL}/api/admin").json()
        assert cleared["signupImports"] == []
        assert cleared["signupDates"] == []

    open_admin(page)
    reset = post_json(page, "/api/admin", {"action": "reset_signup_data", "confirm": "RESET"})
    assert reset.ok

    today = datetime.now(ZoneInfo("America/Chicago")).date()
    tomorrow = today + timedelta(days=1)
    meet_title = "Recurring Meet"
    today_file = make_csv(today, meet_title, [
        ("Alice Helper", "Timer", 5),
        ("Bob Helper", "Console Operator", 5),
        ("Dana Helper", "Concessions", 4),
    ])
    tomorrow_file = make_csv(tomorrow, meet_title, [("Charlie Helper", "Runner", 3)])
    try:
        upload_from_admin(page, today_file)
        page.goto(f"{BASE_URL}/volunteers")
        wait_ready(page)

        # A walk-in can use an imported job instead of requiring the desk to
        # recreate a manual session. It is stored in the same roster and can
        # be checked out from the normal on-deck flow.
        walkin = page.locator("form.signup-walkin-form")
        walkin.get_by_label("Walk-in volunteer name").fill("Eve Helper")
        walkin.get_by_label("Walk-in swimmer").select_option(label="Family, Alice")
        walkin.get_by_label("Walk-in job").select_option(label=re.compile("^Timer"))
        walkin.get_by_label("Walk-in hours").fill("4")
        walkin.get_by_role("button", name="Check in walk-in").click()
        page.get_by_text("Eve Helper is checked in for Timer.").wait_for()
        eve = page.locator("article.signup-person").filter(has_text="Eve Helper")
        eve.get_by_role("button", name="Check out").click()
        eve.get_by_text("Completed").wait_for()

        alice = page.locator("article.signup-person").filter(has_text="Alice Helper")
        alice.get_by_role("button", name="Check in").click()
        alice.get_by_text("On deck").wait_for()
        alice.get_by_role("button", name="Check out").click()
        alice.get_by_text("Completed").wait_for()

        # Let the POST reach D1, then drop only its browser response. The UI must
        # reconcile with public data instead of inviting a duplicate check-in.
        def save_then_interrupt(route):
            route.fetch()
            route.abort("failed")

        page.route("**/api/checkins", save_then_interrupt, times=1)
        bob = page.locator("article.signup-person").filter(has_text="Bob Helper")
        bob.get_by_role("button", name="Check in").focus()
        bob.get_by_role("button", name="Check in").press("Enter")
        page.get_by_text(re.compile("saved status was confirmed")).wait_for()
        bob.get_by_text("On deck").wait_for()

        # An admin can close a live meet without trapping volunteers who are already
        # on deck. New check-ins are rejected by the server, while check-out stays live.
        set_meet_checkin(page, today.isoformat(), meet_title, "Close")
        public = page.request.get(f"{BASE_URL}/api/public").json()
        dana_row = next(row for row in public["signupRows"] if row["volunteerName"] == "Dana Helper")
        closed_checkin = post_json(page, "/api/checkins", {
            "action": "signup_checkin", "id": dana_row["id"], "creditedHours": 4,
        })
        assert closed_checkin.status == 409
        assert "closed by an admin" in closed_checkin.json()["error"]
        page.goto(f"{BASE_URL}/volunteers")
        wait_ready(page)
        bob = page.locator("article.signup-person").filter(has_text="Bob Helper")
        assert bob.get_by_role("button", name="Check out").is_enabled()
        bob.get_by_role("button", name="Check out").click()
        bob.get_by_text("Completed").wait_for()

        open_admin(page)
        upload_from_admin(page, tomorrow_file)
        public = page.request.get(f"{BASE_URL}/api/public").json()
        same_title_rows = [row for row in public["signupRows"] if row["eventTitle"] == meet_title]
        assert len(same_title_rows) == 5
        assert {row["eventDate"] for row in same_title_rows} == {today.isoformat(), tomorrow.isoformat()}
        assert next(row for row in same_title_rows if row["volunteerName"] == "Alice Helper")["completed"] is True
        future_row = next(row for row in same_title_rows if row["eventDate"] == tomorrow.isoformat())
        future_checkin = post_json(page, "/api/checkins", {
            "action": "signup_checkin", "id": future_row["id"], "creditedHours": 3,
        })
        assert future_checkin.status == 409
        assert "opens on" in future_checkin.json()["error"]

        invalid_time = post_json(page, "/api/admin", {
            "action": "create_session", "title": "Bad session", "date": today.isoformat(),
            "startTime": "13:00", "endTime": "07:00", "location": "Pool",
        })
        assert invalid_time.status == 400
        assert "after start" in invalid_time.json()["error"]

        # Narrow meet-deck layout keeps the check-in controls inside the viewport.
        page.set_viewport_size({"width": 390, "height": 844})
        page.goto(f"{BASE_URL}/volunteers")
        wait_ready(page)
        assert page.evaluate("document.documentElement.scrollWidth <= document.documentElement.clientWidth")
        page.screenshot(path="/tmp/jtsc-volunteer-live-day.png", full_page=True)

        # Eight failures are tolerated in the window; the next request is throttled.
        post_json(page, "/api/admin/logout", {})
        for _ in range(8):
            assert post_json(page, "/api/admin/login", {"pin": "wrong"}).status == 401
        throttled = post_json(page, "/api/admin/login", {"pin": "wrong"})
        assert throttled.status == 429
        assert int(throttled.headers["retry-after"]) > 0
    finally:
        os.unlink(today_file)
        os.unlink(tomorrow_file)

    assert not page_errors, page_errors
    browser.close()
    print("Volunteer live-day browser regression passed")
