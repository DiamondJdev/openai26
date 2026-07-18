import Image from "next/image";
import Link from "next/link";
import cleanEntrance from "@/fixtures/footage/demo-clean/entrance.png";
import cleanExit from "@/fixtures/footage/demo-clean/exit.png";
import damageEntrance from "@/fixtures/footage/demo-damage/entrance.png";
import damageExit from "@/fixtures/footage/demo-damage/exit.png";
import damageMid from "@/fixtures/footage/demo-damage/mid.png";

function ArrowUpRight() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" fill="none">
      <path d="M3 13 13 3M6 3h7v7" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function ClaimLensMark() {
  return (
    <span aria-hidden="true" className="landing-mark">
      <span />
      <span />
      <span />
      <span />
    </span>
  );
}

function CameraLabel({ children }: { children: React.ReactNode }) {
  return <span className="landing-camera-label">{children}</span>;
}

export default function HomePage() {
  return (
    <main className="landing-page">
      <header className="landing-nav-wrap">
        <nav aria-label="Primary navigation" className="landing-nav">
          <Link href="#top" className="landing-brand" aria-label="ClaimLens home">
            <ClaimLensMark />
            <span>ClaimLens</span>
          </Link>

          <div className="landing-nav-links">
            <a href="#evidence">Evidence</a>
            <a href="#workflow">Workflow</a>
            <a href="#report">Report</a>
          </div>

          <Link href="/employee" className="landing-nav-cta">
            Open console <ArrowUpRight />
          </Link>
        </nav>
      </header>

      <section id="top" className="landing-hero" aria-labelledby="hero-title">
        <div className="landing-hero-copy">
          <p className="landing-eyebrow">
            <span /> Vehicle evidence, in sequence
          </p>
          <h1 id="hero-title">
            <span>When a claim lands,</span>
            <span>start with what</span>
            <span className="landing-hero-ink">the cameras saw.</span>
          </h1>
          <p className="landing-hero-intro">
            ClaimLens turns the three fixed cameras around your car wash into a
            calm, cited investigation—so your team can answer the question that
            matters: did the wash cause new damage?
          </p>
          <div className="landing-hero-actions">
            <Link href="/employee" className="landing-button landing-button-dark">
              Start a claim <ArrowUpRight />
            </Link>
            <a href="#workflow" className="landing-text-link">
              See the workflow <span aria-hidden="true">↓</span>
            </a>
          </div>
        </div>

        <div className="landing-hero-evidence" aria-label="Three camera footage views">
          <div className="landing-orbit landing-orbit-one" aria-hidden="true" />
          <div className="landing-orbit landing-orbit-two" aria-hidden="true" />

          <figure className="landing-hero-frame landing-hero-frame-main">
            <Image
              src={damageExit}
              alt="Exit camera footage of a vehicle leaving the car wash"
              fill
              priority
              sizes="(max-width: 900px) 92vw, 52vw"
            />
            <figcaption>
              <CameraLabel>CAM 03 · EXIT</CameraLabel>
              <span>11:07:34</span>
            </figcaption>
            <span className="landing-frame-corner landing-frame-corner-tl" />
            <span className="landing-frame-corner landing-frame-corner-br" />
            <span className="landing-detection landing-detection-main" aria-hidden="true" />
          </figure>

          <figure className="landing-hero-frame landing-hero-frame-entrance">
            <Image
              src={damageEntrance}
              alt="Entrance camera footage of a vehicle arriving at the car wash"
              fill
              sizes="(max-width: 900px) 42vw, 20vw"
            />
            <figcaption>
              <CameraLabel>CAM 01 · ENTRY</CameraLabel>
            </figcaption>
          </figure>

          <figure className="landing-hero-frame landing-hero-frame-tunnel">
            <Image
              src={damageMid}
              alt="Mid-tunnel camera footage of a vehicle during its wash"
              fill
              sizes="(max-width: 900px) 38vw, 18vw"
            />
            <figcaption>
              <CameraLabel>CAM 02 · TUNNEL</CameraLabel>
            </figcaption>
          </figure>

          <aside className="landing-evidence-note">
            <span className="landing-live-dot" aria-hidden="true" />
            <div>
              <p>Three viewpoints</p>
              <span>One ordered record</span>
            </div>
          </aside>
        </div>
      </section>

      <section className="landing-assurance" aria-label="ClaimLens foundations">
        <p>Built around the footage you already capture</p>
        <ul>
          <li>Entrance</li>
          <li>Mid-tunnel</li>
          <li>Exit</li>
          <li>Cited findings</li>
        </ul>
      </section>

      <section id="evidence" className="landing-section landing-evidence-section">
        <div className="landing-section-heading">
          <p className="landing-eyebrow">
            <span /> The record is already there
          </p>
          <h2>The wash already recorded the answer.</h2>
          <p>
            A damage claim should not begin with a memory or a hunch. ClaimLens
            lines up the vehicle’s trip through the wash, then keeps every
            conclusion attached to the frame that supports it.
          </p>
        </div>

        <div className="landing-contact-sheet">
          <div className="landing-sheet-head">
            <div>
              <span className="landing-sheet-kicker">Claim reference</span>
              <strong>8XYZ204</strong>
            </div>
            <span>Three-camera sequence</span>
          </div>
          <div className="landing-sheet-grid">
            <figure>
              <Image
                src={damageEntrance}
                alt="Vehicle at the entrance camera"
                fill
                sizes="(max-width: 700px) 92vw, 30vw"
              />
              <figcaption>
                <CameraLabel>01 · ENTRY</CameraLabel>
                <span>11:04:09</span>
              </figcaption>
            </figure>
            <figure>
              <Image
                src={damageMid}
                alt="Vehicle seen by the mid-tunnel camera"
                fill
                sizes="(max-width: 700px) 92vw, 30vw"
              />
              <figcaption>
                <CameraLabel>02 · TUNNEL</CameraLabel>
                <span>11:05:42</span>
              </figcaption>
            </figure>
            <figure>
              <Image
                src={damageExit}
                alt="Vehicle at the exit camera"
                fill
                sizes="(max-width: 700px) 92vw, 30vw"
              />
              <figcaption>
                <CameraLabel>03 · EXIT</CameraLabel>
                <span>11:07:34</span>
              </figcaption>
            </figure>
          </div>
        </div>
      </section>

      <section id="workflow" className="landing-section landing-workflow-section">
        <div className="landing-workflow-intro">
          <p className="landing-eyebrow landing-eyebrow-light">
            <span /> A claim moves without a pile of email
          </p>
          <h2>From a plate to an evidence-backed report.</h2>
          <p>
            The workflow is intentionally narrow: give each person only the
            next thing they need to do, while keeping the whole claim in one
            private record.
          </p>
        </div>

        <ol className="landing-workflow-list">
          <li>
            <span className="landing-step-number">01</span>
            <div>
              <h3>Open the claim by plate.</h3>
              <p>
                An employee creates the case from the vehicle plate and shares
                a private link and PIN with the customer.
              </p>
            </div>
            <div className="landing-step-art landing-step-art-link" aria-hidden="true">
              <span>PRIVATE ACCESS</span>
              <strong>••••••••</strong>
              <i />
            </div>
          </li>
          <li>
            <span className="landing-step-number">02</span>
            <div>
              <h3>Collect the customer’s side.</h3>
              <p>
                Intake captures contact details, the concern, and supporting
                photos in the case file—without exposing the employee console.
              </p>
            </div>
            <div className="landing-step-art landing-step-art-intake" aria-hidden="true">
              <span className="landing-mini-line" />
              <span className="landing-mini-line" />
              <span className="landing-mini-line short" />
              <b>Submitted</b>
            </div>
          </li>
          <li>
            <span className="landing-step-number">03</span>
            <div>
              <h3>Investigate the timeline, not a guess.</h3>
              <p>
                ClaimLens reasons over the fixed footage, records its steps in
                plain language, and produces findings that cite their evidence.
              </p>
            </div>
            <div className="landing-step-art landing-step-art-log" aria-hidden="true">
              <span><i /> Entry frame reviewed</span>
              <span><i /> Exit frame compared</span>
              <span><i /> Finding saved</span>
            </div>
          </li>
        </ol>
      </section>

      <section id="report" className="landing-section landing-report-section">
        <div className="landing-report-visual">
          <figure className="landing-report-image landing-report-image-before">
            <Image
              src={cleanEntrance}
              alt="Clean vehicle footage at the car-wash entrance"
              fill
              sizes="(max-width: 800px) 70vw, 26vw"
            />
            <figcaption>Before · entry frame</figcaption>
          </figure>
          <figure className="landing-report-image landing-report-image-after">
            <Image
              src={cleanExit}
              alt="Clean vehicle footage at the car-wash exit"
              fill
              sizes="(max-width: 800px) 70vw, 26vw"
            />
            <figcaption>After · exit frame</figcaption>
          </figure>
          <div className="landing-report-card" aria-hidden="true">
            <p>Evidence report</p>
            <strong>Every finding points back to a frame.</strong>
            <span>Ready for release</span>
          </div>
        </div>

        <div className="landing-report-copy">
          <p className="landing-eyebrow">
            <span /> A conclusion you can inspect
          </p>
          <h2>Reports that show their work.</h2>
          <p>
            Each release is immutable and tied to stored evidence. When a
            question is too close to call, hold the claim for manual review
            rather than forcing an answer.
          </p>
          <ul className="landing-check-list">
            <li>Plain-language investigation trace</li>
            <li>Timecoded camera evidence</li>
            <li>Optional focused before-and-after crops</li>
          </ul>
          <Link href="/employee" className="landing-text-link landing-text-link-strong">
            Open the employee console <ArrowUpRight />
          </Link>
        </div>
      </section>

      <section className="landing-final-cta" aria-labelledby="final-title">
        <p className="landing-eyebrow landing-eyebrow-light">
          <span /> Let the evidence lead
        </p>
        <h2 id="final-title">Put the cameras to work when it counts.</h2>
        <p>
          Begin a ClaimLens investigation with the footage, not the follow-up.
        </p>
        <Link href="/employee" className="landing-button landing-button-light">
          Start a claim <ArrowUpRight />
        </Link>
      </section>

      <footer className="landing-footer">
        <Link href="#top" className="landing-brand">
          <ClaimLensMark />
          <span>ClaimLens</span>
        </Link>
        <p>Vehicle evidence for car-wash damage claims.</p>
        <a href="#workflow">How it works ↑</a>
      </footer>
    </main>
  );
}
