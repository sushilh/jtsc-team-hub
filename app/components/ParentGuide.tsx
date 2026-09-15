import GuideMotion from "./GuideMotion";
import { ArmMarkingDiagram, GearList, SeasonTimeline } from "./GuideGraphics";

const guideSections = [
  { id: "guide-welcome", label: "Welcome to JTSC" },
  { id: "guide-seasons-gear", label: "Seasons & gear" },
  { id: "guide-meet-basics", label: "Meet basics" },
  { id: "guide-sign-up", label: "Signing up" },
  { id: "guide-meet-day", label: "Meet day" },
  { id: "guide-volunteering", label: "Volunteering" },
];

function SectionHeading({ number, title, eyebrow }: { number: string; title: string; eyebrow: string }) {
  return <div className="guide-section-heading">
    <span className="guide-lane-number" aria-hidden="true">{number}</span>
    <div><p>{eyebrow}</p><h2>{title}</h2></div>
  </div>;
}

export default function ParentGuide() {
  return <main className="parent-guide">
    <GuideMotion />
    <section className="guide-hero">
      <div className="guide-hero-copy">
        <p className="guide-kicker">New Parent Information Guide</p>
        <h1>Your first season,<br /><em>mapped out.</em></h1>
        <p className="guide-lede">Keep the essential JTSC information in one place—from team gear and meet sign-up to deck expectations and volunteer roles.</p>
      </div>
      <div className="guide-update" aria-label="Guide updated September 14, 2026">
        <span>UPDATED</span><strong>09.14.26</strong>
      </div>
    </section>

    <section className="guide-facts" aria-label="JTSC at a glance">
      <div><strong>200+</strong><span>Athletes, beginner through national level</span></div>
      <div><strong>2</strong><span>Short Course and Long Course seasons</span></div>
      <div><strong>Level 3</strong><span>USA Swimming club</span></div>
    </section>

    <div className="guide-layout">
      <aside className="guide-jump">
        <p>IN THIS GUIDE</p>
        <nav aria-label="Parent guide sections">
          <ol>
            {guideSections.map((section, index) => <li key={section.id}>
              <a href={`#${section.id}`}><span>{String(index + 1).padStart(2, "0")}</span>{section.label}</a>
            </li>)}
          </ol>
        </nav>
        <div className="guide-contact-card">
          <span>NEED HELP?</span>
          <strong>Jenks Trojan Swim Club</strong>
          <a href="tel:+19182994411">(918) 299-4411 ext. 2475</a>
        </div>
      </aside>

      <article className="guide-article">
        <section id="guide-welcome" className="guide-section">
          <SectionHeading number="01" eyebrow="START HERE" title="Welcome to JTSC" />
          <div className="guide-prose">
            <p>JTSC is a year-round competitive swim program with more than 200 athletes, ranging from beginners to national-level competitors. We are a USA Swimming Level 3 Club.</p>
            <p>Our experienced coaches are passionate about developing swimmers at every level, with backgrounds in both competitive swimming and coaching. Practices are held at Oklahoma&apos;s premier aquatic facility, providing a top-tier training environment.</p>
          </div>
          <div className="guide-focus-grid">
            <div><span>01</span><strong>Sportsmanship</strong></div>
            <div><span>02</span><strong>Teamwork</strong></div>
            <div><span>03</span><strong>Confidence & self-esteem</strong></div>
          </div>
          <p className="guide-callout">We partner with parents to help athletes succeed not only in swimming, but in life. Our goal is to foster a lifelong love of the sport while helping each swimmer reach their full potential.</p>
        </section>

        <section id="guide-seasons-gear" className="guide-section">
          <SectionHeading number="02" eyebrow="GET EQUIPPED" title="Seasons & swimmer gear" />
          <div className="guide-split">
            <div className="guide-card season-card">
              <p className="guide-card-label">SWIM SEASONS</p>
              <div className="season-row"><strong>Short Course <small>SCY</small></strong><span>September–February</span><p>25-yard, and sometimes 25-meter, pools. Meets are typically indoors and run fall through winter.</p></div>
              <div className="season-row"><strong>Long Course <small>LCM</small></strong><span>March–August</span><p>50-meter Olympic-length pools. Meets are often outdoors and run spring through summer.</p></div>
              <SeasonTimeline />
              <p className="guide-note">Swimmers are encouraged to join both seasons. Breaks include Christmas, Spring Break, and about two weeks between seasons.</p>
            </div>
            <div className="guide-card">
              <p className="guide-card-label">WHAT TO BRING</p>
              <h3>Required for meets</h3>
              <GearList items={[
                { icon: "suit", text: "Jenks team suit" },
                { icon: "cap", text: "Two team swim caps" },
                { icon: "goggles", text: "Competition goggles" },
              ]} />
              <h3>For practice</h3>
              <GearList items={[
                { icon: "suit", text: "Snug-fitting practice suit" },
                { icon: "cap", text: "Practice cap of any type" },
              ]} />
              <h3>Optional</h3>
              <GearList items={[
                { icon: "goggles", text: "Mirrored goggles for outdoor meets" },
                { icon: "plus", text: "Additional equipment for 7th grade and above—check with your coach" },
              ]} />
            </div>
          </div>
          <div className="guide-info-band">
            <div><span>TEAM SUIT & CAP</span><p>Purchase and get properly fitted at the Trojan Head when try-on dates are announced in the weekly email. Personalized caps are usually available to order once each year in September.</p></div>
            <a href="https://elsmoreswim.com/collections/jenks-trojan-swim-club">Order Jenks team gear <span aria-hidden="true">↗</span></a>
          </div>
          <div className="guide-prose compact">
            <h3>Goggle and practice-suit tips</h3>
            <ul><li>Goggles must be competition style with no nose coverage.</li><li>Mirrored lenses are recommended for outdoor meets.</li><li>Practice suits should fit snugly for racing conditions; avoid loose or recreational swimwear.</li></ul>
          </div>
        </section>

        <section id="guide-meet-basics" className="guide-section">
          <SectionHeading number="03" eyebrow="READ THE HEAT SHEET" title="Swim meet basics" />
          <div className="guide-meet-summary">
            <div><strong>~4 hours</strong><span>Typical meet length</span></div>
            <div><strong>AM / PM</strong><span>Sessions divided by age</span></div>
            <div><strong>MeetMobile</strong><span>Schedules and results</span></div>
          </div>
          <div className="guide-terms">
            <div><b>E</b><p><strong>Event</strong><span>A race category listed in numerical order in the meet program.</span></p></div>
            <div><b>H</b><p><strong>Heat</strong><span>A group of swimmers racing the same event. One event may have one heat or more than eleven.</span></p></div>
            <div><b>L</b><p><strong>Lane</strong><span>The numbered lane assigned to the swimmer for the race.</span></p></div>
            <div><b>S</b><p><strong>Stroke</strong><span>The race and distance, such as 50 free, 25 back, 100 fly, or 200 IM.</span></p></div>
          </div>
          <div className="guide-abbreviations">
            <p className="guide-card-label">COMMON ABBREVIATIONS</p>
            <p><strong>FR</strong> Freestyle · <strong>BK</strong> Backstroke · <strong>BR</strong> Breaststroke · <strong>FL / FLY</strong> Butterfly · <strong>IM</strong> Individual Medley</p>
            <p><strong>NT</strong> No Time—the swimmer has not competed in the event yet. <strong>DQ</strong> Disqualified—an illegal move was performed and no time is recorded.</p>
          </div>
          <div className="guide-example">
            <div><p className="guide-card-label">ARM-MARKING EXAMPLE</p><p>Write the swimmer&apos;s event information on an arm or leg before warmups. Volunteers and coaches can help if the heat or lane is not available yet.</p><ArmMarkingDiagram /></div>
            <div className="guide-table-wrap"><table><thead><tr><th>Event</th><th>Heat</th><th>Lane</th><th>Stroke</th></tr></thead><tbody><tr><td>2</td><td>1</td><td>8</td><td>50 FR</td></tr><tr><td>12</td><td>2</td><td>5</td><td>25 FLY</td></tr><tr><td>22</td><td>3</td><td>1</td><td>50 BK</td></tr></tbody></table></div>
          </div>
        </section>

        <section id="guide-sign-up" className="guide-section">
          <SectionHeading number="04" eyebrow="BEFORE THE MEET" title="How to sign up" />
          <div className="guide-signup">
            <div>
              <p className="guide-card-label">TEAM WEBSITE</p>
              <h3>Start in GoMotion</h3>
              <p>Log in for practice schedules, meet schedules, event signups, volunteer opportunities, qualifying times, and coach information.</p>
              <a className="guide-primary-link" href="https://www.gomotionapp.com/team/osjtsc/page/home">Open the JTSC team website <span aria-hidden="true">↗</span></a>
            </div>
            <ol className="guide-steps">
              <li><span>1</span><p>Click <strong>Team Event Signup</strong>.</p></li>
              <li><span>2</span><p>Select the meet.</p></li>
              <li><span>3</span><p>Click <strong>Edit Commitment</strong>.</p></li>
              <li><span>4</span><p>Select your swimmer&apos;s name.</p></li>
              <li><span>5</span><p>Choose Yes or No for participation.</p></li>
              <li><span>6</span><p>Select the days or sessions your swimmer can attend.</p></li>
            </ol>
          </div>
          <p className="guide-note wide">Coaches assign the events to your swimmer. Sometimes this happens during the week of the meet.</p>
        </section>

        <section id="guide-meet-day" className="guide-section">
          <SectionHeading number="05" eyebrow="ARRIVE READY" title="Meet-day expectations" />
          <div className="guide-day-grid">
            <div className="guide-card">
              <p className="guide-card-label">WHEN YOU ARRIVE</p>
              <ul><li>Arrive at least 15 minutes before the scheduled warm-up time.</li><li>For home meets, arrive wearing the team suit when possible.</li><li>Swimmers always enter through the locker rooms and sit on the bleachers with their teammates.</li><li>Volunteers check in at the volunteer table in the lobby.</li></ul>
            </div>
            <div className="guide-card alert-card">
              <p className="guide-card-label">FOR PARENTS</p>
              <ul><li>Parents are never allowed in locker rooms.</li><li>Parents are not allowed on deck unless volunteering.</li><li>Spectator bleachers are on the second floor; there is no spectator fee.</li><li>Do not drop items from the stands to swimmers below.</li></ul>
            </div>
            <div className="guide-card">
              <p className="guide-card-label">BETWEEN RACES</p>
              <p>Swimmers stay with their teammates, have fun, and eat snacks. At home meets, Jenks swimmers sit on the bleachers directly below the stands.</p>
            </div>
          </div>
          <div className="guide-pack">
            <div><p className="guide-card-label">PACK THE SWIM BAG</p><GearList items={[
              { icon: "bag", text: "Extra suit, goggles, and cap" },
              { icon: "towel", text: "Two or more towels" },
              { icon: "marker", text: "Sharpie for writing events" },
              { icon: "shirt", text: "Change of clothes" },
            ]} /></div>
            <div><p className="guide-card-label">GOOD EXTRAS</p><GearList items={[
              { icon: "sun", text: "Sunscreen for outdoor meets" },
              { icon: "bottle", text: "Healthy snacks and water" },
            ]} /><p className="guide-note">Leave valuables at home. Swimmers and bags are packed closely together in the bleachers.</p></div>
          </div>
        </section>

        <section id="guide-volunteering" className="guide-section">
          <SectionHeading number="06" eyebrow="HELP RUN THE MEET" title="Volunteer requirements & roles" />
          <div className="guide-volunteer-intro">
            <div><strong>20</strong><span>Hours per season</span></div>
            <p>Parents are expected to help run home meets. Jobs are posted by email and some fill quickly. Hours may be completed by anyone age 13 or older.</p>
            <ol><li>Open <strong>Edit Job Signup</strong> under Events.</li><li>Select your role or roles.</li><li>Submit the signup.</li></ol>
          </div>

          <div className="guide-role-tier">
            <div className="guide-tier-heading"><span>BEGINNER-FRIENDLY</span><h3>Jump right in</h3></div>
            <div className="guide-role-grid">
              <div><strong>Timer</strong><p>Run a stopwatch and record swimmer times after each heat. Officials hold a quick meeting before each session, and an experienced head timer is always available.</p></div>
              <div><strong>Hospitality</strong><p>Keep drinks and snacks stocked for officials and coaches, and take water to timers, coaches, and officials on deck.</p></div>
              <div><strong>Safety Officer</strong><p>Help swimmers and spectators stay in their designated areas and follow pool, locker-room, lobby, and stands safety rules.</p></div>
              <div><strong>Concessions</strong><p>Sell snacks and drinks. No prior experience is necessary.</p></div>
            </div>
          </div>

          <div className="guide-role-tier">
            <div className="guide-tier-heading"><span>INTERMEDIATE</span><h3>Know the flow</h3></div>
            <div className="guide-role-grid">
              <div><strong>Head Timer</strong><p>Prepare timer clipboards and equipment with admin officials, then run backup stopwatches during the meet.</p></div>
              <div><strong>Runner</strong><p>Collect sheets from timers and the console table, post results, and help officials in the fishbowl and on deck.</p></div>
              <div><strong>Stager</strong><p>Use a heat sheet to help new and young swimmers mark their events and reach the block on time.</p></div>
              <div><strong>Volunteer Check-In</strong><p>Check in volunteers at the start of the session. This role usually begins 15 minutes before the session.</p></div>
            </div>
          </div>

          <div className="guide-role-tier advanced">
            <div className="guide-tier-heading"><span>ADVANCED</span><h3>Specialized meet roles</h3></div>
            <div className="guide-role-grid">
              <div><strong>Announcer</strong><p>Make announcements and read events, heats, and swimmer names throughout the meet. <a href="mailto:jtscboosterclub@gmail.com">Email the booster club</a>.</p></div>
              <div><strong>Clerk of Course</strong><p>Help admin officials with time trials, deck entries, scratches, fees, and other on-deck needs. <a href="mailto:jtscboosterclub@gmail.com">Email the booster club</a>.</p></div>
              <div><strong>Console Operator</strong><p>Run the deck computer that collects swimmer times and work with officials to ensure legal times enter the system. <a href="mailto:jtscboosterclub@gmail.com">Email the booster club</a>.</p></div>
              <div><strong>Official — high need</strong><p>No swimming background is required. The club provides and pays for training, with opportunities to shadow current officials. <a href="mailto:Jim_Lostroscio@yahoo.com">Email Jim Lostroscio</a>.</p></div>
            </div>
          </div>

          <div className="guide-final-note"><span aria-hidden="true">JT</span><p><strong>Every family strengthens the team.</strong> JTSC is a volunteer-supported organization. Your involvement helps ensure successful meets and a strong swim community.</p></div>
        </section>
      </article>
    </div>

    <footer className="guide-footer"><span>JENKS TROJAN SWIM CLUB</span><p>205 East B Street · Jenks, OK 74037 · <a href="tel:+19182994411">(918) 299-4411 ext. 2475</a></p></footer>
  </main>;
}
