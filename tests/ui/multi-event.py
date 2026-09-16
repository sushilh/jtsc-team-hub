from pathlib import Path
import struct
import os
import tempfile
from playwright.sync_api import sync_playwright, expect

out = Path(tempfile.mkdtemp(prefix='jtsc-multi-event-'))
launch_options = {'headless': True}
if os.environ.get('JTSC_CHROMIUM_EXECUTABLE'):
    launch_options['executable_path'] = os.environ['JTSC_CHROMIUM_EXECUTABLE']
with sync_playwright() as p:
    browser = p.chromium.launch(**launch_options)
    context = browser.new_context(viewport={'width':1440,'height':1000}, accept_downloads=True, reduced_motion='reduce')
    page = context.new_page()
    errors=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.goto(os.environ.get('JTSC_BASE_URL','http://localhost:3000').rstrip('/') + '/')
    page.wait_for_load_state('networkidle')
    print(page.locator('.event-results-editor').aria_snapshot())
    studio=page.locator('#panel-studio')
    canvas=studio.get_by_label('Preview of the swimmer achievement card',exact=True)
    names=studio.get_by_role('textbox',name='Event name',exact=True)
    times=studio.get_by_role('textbox',name='Time (optional)',exact=True)
    add=studio.get_by_role('button',name='+ Add event',exact=True)
    original=canvas.evaluate('(c)=>c.toDataURL()')
    add.click()
    expect(names.nth(1)).to_be_focused()
    assert canvas.evaluate('(c)=>c.toDataURL()')==original,'Blank row changed original single-event layout'
    times.nth(1).fill('1:02.35')
    expect(names.nth(1)).to_have_attribute('aria-invalid','true')
    expect(studio.get_by_role('button',name='Signature PNG',exact=False)).to_be_disabled()
    names.nth(1).fill('100Y Breaststroke')
    expect(studio.get_by_role('button',name='Signature PNG',exact=False)).to_be_enabled()
    studio.get_by_role('button',name='Remove event 1',exact=True).click()
    expect(names.first).to_have_value('100Y Breaststroke')
    expect(names.first).to_be_focused()
    names.first.fill('200Y Breaststroke')
    studio.get_by_role('button',name='Undo remove',exact=True).click()
    expect(names.first).to_have_value('100Y Butterfly')
    expect(names.nth(1)).to_have_value('200Y Breaststroke')
    expect(names.first).to_be_focused()
    for event in ['50Y Freestyle','100Y Backstroke','200Y Individual Medley','500Y Freestyle']:
        add.click(); names.last.fill(event); times.last.fill('2:01.45')
    expect(add).to_be_disabled()
    expect(names).to_have_count(6)
    names.nth(0).fill('100Y Butterfly')
    times.nth(5).fill('')
    studio.get_by_role('button',name='Made State',exact=False).click()
    studio.get_by_label('Meet name (optional)').fill('Oklahoma State Championships')
    studio.get_by_label('Meet date (optional)').fill('2027-02-19')
    for event in ['100Y Butterfly','200Y Breaststroke','500Y Freestyle']:
        assert event in studio.get_by_label('Instagram caption',exact=True).input_value()
        assert event in studio.get_by_label('Facebook caption',exact=True).input_value()
    studio.locator('input[type=file]').set_input_files(str(Path(__file__).resolve().parents[2] / 'public' / 'og.png'))
    expect(studio.get_by_role('button',name='Replace photo',exact=False)).to_be_visible()
    def download(label,path,size):
        with page.expect_download() as event: studio.get_by_role('button',name=label,exact=False).click()
        file=out/path; event.value.save_as(file)
        assert struct.unpack('>II',file.read_bytes()[16:24])==size
    for format,height in [('Instagram · 4:5',1350),('Facebook · 1:1',1080)]:
        studio.get_by_role('button',name=format,exact=True).click()
        for label,slug in [('Classic PNG','classic'),('Signature PNG','signature'),('Race Result PNG','race'),('Finish Line PNG','finish')]:
            download(label,f'{slug}-{height}.png',(1080,height))
    page.get_by_role('tab',name='Meet Day Studio').click()
    expect(page.get_by_role('textbox',name='Text (line breaks supported)',exact=True)).to_be_visible()
    page.get_by_role('textbox',name='Text (line breaks supported)',exact=True).fill('TEST MEET\nSESSION DETAILS')
    page.get_by_role('tab',name='Achievement studio').click()
    expect(names).to_have_count(6)
    assert '500Y Freestyle' in studio.get_by_label('Instagram caption',exact=True).input_value()
    # Native input label activation, narrow viewport, and global scrollbar baseline.
    page.set_viewport_size({'width':390,'height':844})
    names.nth(0).scroll_into_view_if_needed()
    page.locator('label[for="event-name-first"]').click()
    expect(names.nth(0)).to_be_focused()
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page.screenshot(path=str(out/'editor-mobile.png'))
    assert page.evaluate('getComputedStyle(document.documentElement).scrollbarColor')!='auto'
    # Two-event export offline and recovery to the original single-event format.
    for index in [6,5,4,3]: studio.get_by_role('button',name=f'Remove event {index}',exact=True).click()
    await_fonts=page.evaluate('document.fonts.ready.then(()=>true)')
    context.set_offline(True)
    download('Signature PNG','two-events-offline.png',(1080,1080))
    studio.get_by_role('button',name='Remove event 2',exact=True).click()
    expect(names).to_have_count(1)
    expect(studio.get_by_role('button',name='Remove event 1',exact=True)).to_be_disabled()
    download('Signature PNG','one-event-offline.png',(1080,1080))
    assert not errors,errors
    print('PASS: add/edit/remove/undo, max/blank/invalid/optional rows, focus/labels, captions, all eight export combinations, tab retention, mobile, offline, single-event fallback. No JS errors.')
    browser.close()
