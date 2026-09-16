"""Exercise Finish Line direct editing and PNG parity without changing shared data."""

import base64
from io import BytesIO
import os
from pathlib import Path
import tempfile

from PIL import Image, ImageChops
from playwright.sync_api import expect, sync_playwright


base = os.environ.get("JTSC_BASE_URL", "http://127.0.0.1:3000").rstrip("/")
output = Path(tempfile.mkdtemp(prefix="jtsc-finish-editor-"))
launch = {"headless": True}
if os.environ.get("JTSC_CHROMIUM_EXECUTABLE"):
    launch["executable_path"] = os.environ["JTSC_CHROMIUM_EXECUTABLE"]


def same_pixels(a, b):
    left = Image.open(BytesIO(a)).convert("RGB")
    right = Image.open(BytesIO(b)).convert("RGB")
    return left.size == right.size and ImageChops.difference(left, right).getbbox() is None


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(**launch)
    try:
        for viewport in [{"width": 1440, "height": 1000}, {"width": 390, "height": 844}]:
            context = browser.new_context(viewport=viewport, accept_downloads=True, reduced_motion="reduce")
            page = context.new_page()
            errors = []
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.goto(base + "/parent-guide", wait_until="networkidle")
            page.get_by_role("tab", name="Achievement studio", exact=True).click()
            page.wait_for_load_state("networkidle")
            studio = page.locator("#panel-studio")
            studio.get_by_role("group", name="Card template").get_by_role("button", name="Finish Line", exact=False).click()
            editor = studio.get_by_label("Finish Line layout editor")
            canvas = studio.get_by_label("Preview of the swimmer achievement card", exact=True)
            expect(editor.get_by_role("button", name="Swimmer photo")).to_have_attribute("aria-pressed", "true")
            studio.get_by_label("Swimmer photo", exact=True).set_input_files("public/jenks-trojan-logo.png")
            expect(studio.get_by_role("button", name="Replace photo", exact=False)).to_be_visible()

            # Move the frame directly and resize from its lower-right touch handle.
            canvas.scroll_into_view_if_needed()
            rect = canvas.bounding_box()
            assert rect is not None
            photo = studio.locator(".finish-selection").bounding_box()
            assert photo is not None
            start = (photo["x"] + photo["width"] / 2, photo["y"] + photo["height"] / 2)
            page.mouse.move(*start)
            page.mouse.down()
            page.mouse.move(start[0] + 25, start[1] + 20, steps=5)
            page.mouse.up()
            inspector = studio.get_by_label("Edit swimmer photo")
            left = inspector.get_by_label("Left (px)")
            assert int(left.input_value()) > 48
            canvas.scroll_into_view_if_needed()
            moved = studio.locator(".finish-selection").bounding_box()
            corner = (moved["x"] + moved["width"] - 5, moved["y"] + moved["height"] - 5)
            old_width = int(inspector.get_by_label("Width (px)").input_value())
            page.mouse.move(*corner)
            page.mouse.down()
            page.mouse.move(corner[0] - 20, corner[1] - 20, steps=5)
            page.mouse.up()
            assert int(inspector.get_by_label("Width (px)").input_value()) < old_width
            left.fill("70")
            expect(left).to_have_value("70")
            canvas.focus()
            canvas.press("ArrowRight")
            expect(left).to_have_value("71")

            editor.get_by_role("button", name="+ Text").click()
            expect(studio.locator(".finish-field textarea")).to_be_visible()
            studio.locator(".finish-field textarea").fill("GO TROJANS")
            editor.get_by_role("button", name="+ Color block").click()
            expect(studio.get_by_label("Edit panel")).to_be_visible()
            editor.get_by_role("button", name="+ Image").click()
            studio.get_by_label("Finish Line image").set_input_files("public/jenks-trojan-logo.png")
            expect(editor.get_by_role("button", name="Replace image", exact=False)).to_be_visible()
            studio.get_by_label("Finish Line image").set_input_files("package.json")
            expect(editor.get_by_role("alert")).to_contain_text("JPG, PNG, or WebP")
            expect(editor.get_by_role("button", name="Replace image", exact=False)).to_be_visible()
            editor.get_by_role("button", name="Remove", exact=True).click()
            expect(editor.get_by_role("button", name="Undo remove")).to_be_visible()
            editor.get_by_role("button", name="Undo remove").click()
            expect(editor.get_by_role("button", name="Replace image", exact=False)).to_be_visible()

            for label, height in [("Instagram · 4:5", 1350), ("Facebook · 1:1", 1080)]:
                studio.get_by_role("button", name=label, exact=True).click()
                page.wait_for_timeout(150)
                preview = base64.b64decode(canvas.evaluate("element => element.toDataURL().split(',')[1]"))
                with page.expect_download() as pending:
                    studio.get_by_role("button", name="Finish Line PNG", exact=False).click()
                download = pending.value
                saved = output / f"finish-{viewport['width']}-{height}.png"
                download.save_as(saved)
                assert Image.open(saved).size == (1080, height)
                assert same_pixels(preview, saved.read_bytes())

            editor.get_by_role("button", name="Reset layout").click()
            expect(editor.get_by_role("button", name="Undo reset")).to_be_visible()
            editor.get_by_role("button", name="Undo reset").click()
            expect(editor.get_by_role("button", name="Image 3")).to_be_visible()
            editor.get_by_role("button", name="Reset layout").click()
            expect(editor.get_by_role("button", name="+ Text")).to_be_visible()
            assert editor.get_by_role("button", name="Swimmer photo").count() == 1
            assert editor.get_by_role("button", name="Image 3").count() == 0
            page.screenshot(path=str(output / f"finish-{viewport['width']}.png"), full_page=True)
            assert not errors, errors
            if viewport["width"] == 390:
                assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"), "Mobile horizontal overflow"
            context.close()
        print(f"PASS: drag, resize, keyboard, overlays, reset, mobile, and PNG parity. Screenshots: {output}")
    finally:
        browser.close()
