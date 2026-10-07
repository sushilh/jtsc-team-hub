"""Check the visible preview and downloaded PNG after actual swimmer changes.

Set JTSC_BASE_URL and, if needed, JTSC_CHROMIUM_EXECUTABLE to test a deployment.
All editing and exports stay in the browser; no shared records are changed.
"""

import base64
from io import BytesIO
import os
from pathlib import Path
import tempfile

from PIL import Image, ImageChops
from playwright.sync_api import expect, sync_playwright


base_url = os.environ.get("JTSC_BASE_URL", "http://127.0.0.1:3000").rstrip("/")
output = Path(tempfile.mkdtemp(prefix="jtsc-achievement-preview-"))
transition_finished = "document.querySelector('.preview-crossfade').getAnimations().every(a => a.effect.getTiming().iterations === Infinity || a.playState === 'finished')"
launch_options = {"headless": True}
if os.environ.get("JTSC_CHROMIUM_EXECUTABLE"):
    launch_options["executable_path"] = os.environ["JTSC_CHROMIUM_EXECUTABLE"]


def same_pixels(first, second, tolerance=0):
    first_image = Image.open(BytesIO(first)).convert("RGB")
    second_image = Image.open(BytesIO(second)).convert("RGB")
    if first_image.size != second_image.size:
        return False
    difference = ImageChops.difference(first_image, second_image)
    if tolerance:
        difference = difference.point(lambda value: 0 if value <= tolerance else value)
    return difference.getbbox() is None


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(**launch_options)
    try:
        for motion in ["no-preference", "reduce"]:
            context = browser.new_context(
                viewport={"width": 1440, "height": 1000},
                reduced_motion=motion,
                accept_downloads=True,
            )
            page = context.new_page()
            errors = []
            page.on("pageerror", lambda error: errors.append(str(error)))
            # Observe text actually painted by the real canvas renderer.
            page.add_init_script("""
                window.previewText = [];
                const original = CanvasRenderingContext2D.prototype.fillText;
                CanvasRenderingContext2D.prototype.fillText = function(text, ...args) {
                    if (this.canvas.getAttribute('aria-label') === 'Preview of the swimmer achievement card') {
                        window.previewText.push(text);
                    }
                    return original.call(this, text, ...args);
                };
            """)
            page.goto(base_url + "/parent-guide", wait_until="networkidle")
            page.get_by_role("tab", name="Achievement studio", exact=True).click()
            # The lazily mounted studio loads its logo before pixel comparisons.
            page.wait_for_load_state("networkidle")
            page.evaluate("document.fonts.ready")
            studio = page.locator("#panel-studio")
            swimmer = studio.get_by_role("combobox", name="Swimmer name", exact=True)
            canvas = studio.get_by_label("Preview of the swimmer achievement card", exact=True)
            overlay = studio.locator(".preview-crossfade")
            frame = studio.locator(".canvas-frame")

            def change_swimmer(name):
                assert swimmer.input_value() != name, "Test must select a different swimmer"
                page.evaluate("window.previewText = []")
                swimmer.select_option(label=name)
                expect(swimmer).to_have_value(name)
                page.wait_for_function("name => window.previewText.includes(name.toUpperCase())", arg=name)
                assert name in studio.get_by_label("Instagram caption", exact=True).input_value()

            def check_visible_card(tag):
                # A correct main canvas is insufficient: an old snapshot can cover it.
                page.wait_for_function(transition_finished)
                page.mouse.move(0, 0)
                visible = frame.screenshot(path=str(output / f"{motion}-{tag}.png"), animations="disabled")
                overlay.evaluate("element => { element.style.visibility = 'hidden'; }")
                uncovered = frame.screenshot(path=str(output / f"{motion}-{tag}-uncovered.png"), animations="disabled")
                overlay.evaluate("element => { element.style.removeProperty('visibility'); }")
                # Browser edge antialiasing can vary a few color levels when a
                # transparent layer is hidden. Export comparisons remain exact.
                assert same_pixels(visible, uncovered, tolerance=8), f"{motion}/{tag}: stale transition image hides the current card"

            change_swimmer("Asakevich, Graham")
            check_visible_card("initial-name-change")

            record_milestone = "NEW JTSC TEAM RECORD"
            studio.get_by_role("button", name=record_milestone, exact=True).click()
            expect(studio.get_by_label("Achievement name", exact=True)).to_have_value(record_milestone)
            page.wait_for_function("text => window.previewText.includes(text)", arg=record_milestone)
            check_visible_card("new-team-record-milestone")

            templates = [
                ("Classic Zone", "Classic PNG", "classic", "Hatkar, Reya"),
                ("Race Result", "Race Result PNG", "race", "Hatkar, Saisha"),
                ("JTSC Signature", "Signature PNG", "signature", "Asakevich, Graham"),
                ("Finish Line", "Finish Line PNG", "finish", "Zeiler, Landon"),
            ]
            for format_label, height in [("Instagram · 4:5", 1350), ("Facebook · 1:1", 1080)]:
                studio.get_by_role("button", name=format_label, exact=True).click()
                for template_label, download_label, slug, name in templates:
                    studio.get_by_role("group", name="Card template").get_by_role("button", name=template_label, exact=False).click()
                    # Covers normal completion before editing, the original failure.
                    page.wait_for_function(transition_finished)
                    change_swimmer(name)
                    check_visible_card(f"{slug}-{height}")
                    expected_image = base64.b64decode(canvas.evaluate("element => element.toDataURL().split(',')[1]"))
                    with page.expect_download() as pending:
                        studio.get_by_role("button", name=download_label, exact=False).click()
                    download = pending.value
                    path = output / f"{motion}-{slug}-{height}-download.png"
                    download.save_as(path)
                    assert Image.open(path).size == (1080, height)
                    assert same_pixels(expected_image, path.read_bytes()), "Download differs from selected swimmer's preview"
                    assert name.split(",")[0].lower() in download.suggested_filename

            # Pause immediately during a transition, then edit and switch tabs.
            studio.get_by_role("button", name="Classic Zone", exact=False).click()
            studio.get_by_role("button", name="Pause animations", exact=True).click()
            change_swimmer("Hatkar, Reya")
            check_visible_card("paused-name-change")
            page.get_by_role("tab", name="Parent guide", exact=True).click()
            page.get_by_role("tab", name="Achievement studio", exact=True).click()
            expect(swimmer).to_have_value("Hatkar, Reya")
            check_visible_card("return-to-studio")

            # A Meet Report new-record handoff carries the swimmer's actual age
            # and official record bracket into the editable Finish Line card.
            page.evaluate("""localStorage.setItem('jtsc:achievement-prefill', JSON.stringify({
                name: 'Asakevich, Graham', milestone: 'NEW JTSC TEAM RECORD',
                eventName: '25Y Freestyle', time: '18.22', meetName: 'JTSC Fall Intrasquad',
                meetDate: '2026-09-19', recordAge: '6 YEAR OLD', recordAgeGroup: '6 AND UNDER'
            }))""")
            page.get_by_role("tab", name="Parent guide", exact=True).click()
            page.get_by_role("tab", name="Achievement studio", exact=True).click()
            studio.get_by_role("group", name="Card template").get_by_role("button", name="Finish Line", exact=False).click()
            expect(swimmer).to_have_value("Asakevich, Graham")
            page.wait_for_function("window.previewText.includes('6 YEAR OLD') && window.previewText.includes('6 AND UNDER')")
            expect(studio.get_by_role("button", name="Record age", exact=True)).to_be_visible()
            expect(studio.get_by_role("button", name="Record age group", exact=True)).to_be_visible()
            check_visible_card("record-age-handoff")
            page.set_viewport_size({"width": 390, "height": 844})
            expect(canvas).to_be_visible()
            mobile_record = frame.screenshot(path=str(output / f"{motion}-record-age-handoff-mobile.png"), animations="disabled")
            assert Image.open(BytesIO(mobile_record)).size[0] > 0
            assert not errors, errors
            context.close()
        print(f"PASS: selected names render visibly, all four designs and both PNG sizes match, motion/reduced motion/pause/tab return work. Screenshots: {output}")
    finally:
        browser.close()
