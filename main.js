/* =========================================================================
   MAIN.JS - CORE LOGIC, PHYSICS SCROLL, DOM SPLITTING, & GSAP ANIMATIONS
   This 600+ line behemoth controls the timing of the entire experience.
   ========================================================================= */

// ----- A. GLOBALS & STATE ----- //
window.__SCROLL_MOMENTUM = 0;
window.__GLOBAL_PROGRESS = 0;

const state = {
    isLoaded: false,
    audioUnlocked: false,
    scroll: {
        y: 0,
        target: 0,
        limit: 0,
        ease: 0.08,  // How slow the momentum catches up
        velocity: 0
    },
    mouse: { x: window.innerWidth / 2, y: window.innerHeight / 2 },
    timeWasted: 0
};

// Register GSAP Plugins
gsap.registerPlugin(ScrollTrigger, CustomEase);

// Custom extremely dramatic easing curve for the typography stretches
CustomEase.create("timeWarp", "M0,0,C0.1,0.9,0.2,1,1,1");

// ----- B. DOM UTILITY & MANIPULATION ----- //

// A custom lightweight text splitting engine heavily inspired by SplitText
// Maps standard text nodes to individually targetable span characters
const splitTextCore = () => {
    // 1. Split Characters
    const charTargets = document.querySelectorAll('.split-chars');
    charTargets.forEach(el => {
        let text = el.innerText;
        el.innerHTML = '';
        el.style.opacity = '1';
        [...text].forEach(char => {
            let span = document.createElement('span');
            span.innerHTML = char === ' ' ? '&nbsp;' : char;
            span.style.display = 'inline-block';
            // Pre-set matrix to avoid FOUC
            span.style.transform = "translate(0px, 100%)";
            span.style.opacity = "0";
            span.className = "char";
            el.appendChild(span);
        });
    });

    // 2. Split Words
    const wordTargets = document.querySelectorAll('.split-words');
    wordTargets.forEach(el => {
        let words = el.innerText.split(' ');
        el.innerHTML = '';
        el.style.opacity = '1';
        words.forEach(word => {
            let span = document.createElement('span');
            span.innerText = word + ' ';
            span.style.display = 'inline-block';
            span.style.transform = "translate(0px, 30px) rotate(3deg)";
            span.style.opacity = "0";
            span.className = "word";
            el.appendChild(span);
        });
    });

    // 3. Split Lines (using wrapper trick)
    const lineTargets = document.querySelectorAll('.split-lines');
    lineTargets.forEach(el => {
        // Simple regex replace to wrap <br> separated lines in div
        let html = el.innerHTML;
        let lines = html.split(/<br\s*\/?>/i);
        el.innerHTML = '';
        el.style.opacity = '1';
        lines.forEach(l => {
            let wrapper = document.createElement('div');
            wrapper.style.overflow = 'hidden';
            wrapper.style.display = 'block';

            let inner = document.createElement('span');
            inner.innerHTML = l;
            inner.style.display = 'block';
            inner.style.transform = "translateY(110%)";
            inner.className = 'line';

            wrapper.appendChild(inner);
            el.appendChild(wrapper);
        });
    });
};

/* ----- C. CUSTOM SMOOTH SCROLL ENGINE ----- */
// By hijacking the native scroll, we can introduce high-mass momentum
// which makes the user feel like they are pushing through "syrup" (time).

const scrollWrapper = document.getElementById('smooth-wrapper');
const scrollContent = document.getElementById('smooth-content');

let scrollRAF;

const initSmoothScroll = () => {
    // Calculate total height
    const calculateBounds = () => {
        state.scroll.limit = scrollContent.getBoundingClientRect().height - window.innerHeight;
        // Also update ScrollTrigger that we are faking scroll
        ScrollTrigger.refresh();
    };

    // Call once and on resize
    calculateBounds();
    window.addEventListener('resize', calculateBounds);

    // Hijack mouse wheel
    window.addEventListener('wheel', (e) => {
        if (!state.isLoaded) return;

        let delta = e.deltaY;

        // Normalize delta across browsers
        if (e.deltaMode === 1) delta *= 40;

        // Apply to target
        state.scroll.target += delta;
        // Clamp to limits
        state.scroll.target = Math.max(0, Math.min(state.scroll.target, state.scroll.limit));
    }, { passive: false }); // Do not event.preventDefault() so OS gestures partly work but are hijacked

    // Keyboard support (Space, Arrows)
    window.addEventListener('keydown', (e) => {
        if (!state.isLoaded) return;
        let amount = 0;
        switch (e.key) {
            case 'ArrowDown': amount = 100; break;
            case 'ArrowUp': amount = -100; break;
            case 'PageDown': case ' ': amount = window.innerHeight * 0.8; break;
            case 'PageUp': amount = -window.innerHeight * 0.8; break;
            case 'Home': state.scroll.target = 0; break;
            case 'End': state.scroll.target = state.scroll.limit; break;
        }
        if (amount !== 0) {
            state.scroll.target += amount;
            state.scroll.target = Math.max(0, Math.min(state.scroll.target, state.scroll.limit));
            e.preventDefault();
        }
    });

    // Touch Support for mobile
    let touchY = 0;
    window.addEventListener('touchstart', (e) => {
        touchY = e.touches[0].clientY;
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
        if (!state.isLoaded) return;
        let deltaY = touchY - e.touches[0].clientY;
        touchY = e.touches[0].clientY;

        state.scroll.target += deltaY * 2.5; // Touch multiplier
        state.scroll.target = Math.max(0, Math.min(state.scroll.target, state.scroll.limit));
    }, { passive: true });

    // The Render Loop
    const fluidScrollRender = () => {
        // LERP (Linear Interpolation) the scroll position
        state.scroll.y += (state.scroll.target - state.scroll.y) * state.scroll.ease;

        // Calculate velocity (delta)
        let vel = (state.scroll.target - state.scroll.y);
        state.scroll.velocity = vel;

        // Apply physical transformation to DOM
        scrollContent.style.transform = `translate3d(0, ${-state.scroll.y}px, 0)`;

        // Update global bridges for WebGL and Audio
        window.__SCROLL_MOMENTUM = state.scroll.velocity;

        if (state.scroll.limit > 0) {
            window.__GLOBAL_PROGRESS = Math.max(0, Math.min(1, state.scroll.y / state.scroll.limit));
            let progFrame = document.getElementById('scroll-progress');
            if (progFrame) progFrame.style.transform = `translateY(${(window.__GLOBAL_PROGRESS - 1) * 100}%)`;

            // HUD Velocity Updates
            let velHud = document.querySelector('.velocity-bar');
            if (velHud) {
                velHud.style.height = `${Math.min(100, Math.abs(state.scroll.velocity) * 2)}px`;
            }

            // Fingerprint Tracking
            if (window.CHRONOS_EFFECTS && window.CHRONOS_EFFECTS.Fingerprint) {
                window.CHRONOS_EFFECTS.Fingerprint.recordData(Math.abs(state.scroll.velocity), window.__GLOBAL_PROGRESS);
            }
        }

        // Feed the fake scroll position to GSAP!
        ScrollTrigger.update();

        scrollRAF = requestAnimationFrame(fluidScrollRender);
    };

    // Tell GSAP about our custom scroll engine
    ScrollTrigger.scrollerProxy(scrollWrapper, {
        scrollTop(value) {
            if (arguments.length) {
                state.scroll.target = value;
                state.scroll.y = value;
            }
            return state.scroll.y;
        },
        getBoundingClientRect() {
            return { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight };
        },
        pinType: "transform"
    });

    // Hook native GSAP refresh to proxy
    ScrollTrigger.addEventListener("refresh", () => {
        state.scroll.limit = scrollContent.getBoundingClientRect().height - window.innerHeight;
    });

    // Boot
    fluidScrollRender();
};


/* ----- D. ENTRANCE LOADER & LIFE CYCLE ----- */
// Calculates a fake boot sequence, text scrambled loading
const initLoaderSequence = () => {
    let pct = 0;
    const pctNode = document.getElementById('loading-pct');
    const btn = document.getElementById('enter-btn');
    const hint = document.querySelector('.headphones-hint');

    splitTextCore(); // Prepare all DOM elements while loading

    let loadInterval = setInterval(() => {
        let jump = Math.floor(Math.random() * 15) + 1;
        pct += jump;

        if (pct >= 100) {
            pct = 100;
            clearInterval(loadInterval);

            // Loading Finish state
            setTimeout(() => {
                hint.style.opacity = '1';
                hint.style.transform = 'translateY(0)';
                btn.classList.remove('disabled');

                // Animate Button in
                gsap.to(btn, { opacity: 1, y: 0, duration: 1, ease: "power3.out" });

                // Glitch the title
                const titleChars = document.querySelectorAll('.loader-title .char');
                gsap.to(titleChars, {
                    delay: 0.5,
                    duration: 0.1,
                    opacity: 1,
                    y: 0,
                    stagger: 0.05,
                    color: "rgba(179, 155, 130, 1)",
                    onComplete: () => {
                        document.querySelector('.loader-title').classList.add('glitch-text');
                        document.querySelector('.loader-title').setAttribute('data-text', "CHRONOS");
                    }
                });
            }, 500);
        }
        pctNode.innerText = pct;
        document.querySelector('.loader-progress-bar').style.width = pct + '%';
    }, 120);

    // Boot the world when button clicked
    btn.addEventListener('click', () => {
        // Unlock Audio Context (MUST be done within user interaction)
        if (window.AudioEngine_Boot) {
            window.AudioEngine_Boot();
            state.audioUnlocked = true;
        }

        // Hide overlay with dramatic fade
        gsap.to('.loader-overlay', {
            opacity: 0,
            duration: 1.5,
            ease: 'power4.inOut',
            onComplete: () => {
                document.getElementById('loader').style.display = 'none';
                state.isLoaded = true;

                // Dispatch event so animations know to begin
                const event = new Event('world-booted');
                window.dispatchEvent(event);
            }
        });

        // Zoom into the canvas slightly via WebGL scale trick? No, let's keep it simple CSS
        gsap.fromTo('#webgl-container',
            { scale: 1.1, filter: "brightness(0.2) contrast(1.5)" },
            { scale: 1, filter: "brightness(1) contrast(1)", duration: 2.5, ease: "timeWarp" }
        );
    });
};


/* ----- E. GSAP SCENE DIRECTIVES ----- */
// We map complex scroll scrubbing to specific DOM nodes here
const initMasterTimeline = () => {

    // Parallax Helpers
    const parallaxItems = document.querySelectorAll('.parallax');
    parallaxItems.forEach(el => {
        let speed = parseFloat(el.getAttribute('data-speed'));
        let yMove = (1 - speed) * 300; // The variance

        gsap.to(el, {
            y: yMove,
            ease: "none",
            scrollTrigger: {
                scroller: scrollWrapper,
                trigger: el,
                start: "top bottom",
                end: "bottom top",
                scrub: 1 // smooth scrubbing
            }
        });
    });

    // Intro Sequence (Triggers on world boot)
    window.addEventListener('world-booted', () => {
        let tl = gsap.timeline();

        tl.to('#scene-intro .char', {
            y: 0,
            opacity: 1,
            duration: 1.2,
            stagger: 0.03,
            ease: "expo.out"
        })
            .to('#scene-intro .line', {
                y: 0,
                opacity: 1,
                duration: 1,
                stagger: 0.1,
                ease: "power2.out"
            }, "-=0.8")
            .to('.hud-nav, .hud-progress-frame', {
                opacity: 1,
                duration: 1
            }, "-=0.5");
    });

    // Dilation Scene - Interactive Velocity Stretch
    // This watches the velocity and applies it specifically to a DOM node
    const dilator = document.getElementById('stretch-element-1');
    gsap.ticker.add(() => {
        if (!state.isLoaded || !dilator) return;

        // Squeeze and stretch calculation based purely on momentum
        // clamp to avoid breaking bounds
        let push = Math.abs(state.scroll.velocity) * 0.05;
        let scaleX = 1 + push;
        let scaleY = Math.max(0.2, 1 - (push * 0.3));
        let skew = state.scroll.velocity * 0.1;

        // Manually apply to avoid GSAP overwrite conflicts
        dilator.style.transform = `scale(${scaleX}, ${scaleY}) skewY(${skew}deg)`;
        dilator.style.letterSpacing = `${push * 10}px`;
    });

    // Fragments Scene - Memory Reveal
    const fragments = document.querySelectorAll('.frag-item');
    fragments.forEach((frag, i) => {
        gsap.fromTo(frag,
            { opacity: 0, y: 150, filter: 'url(#glitch) blur(10px)' },
            {
                opacity: 1,
                y: 0,
                filter: 'blur(0px)',
                duration: 1.5,
                ease: 'back.out(1.7)',
                scrollTrigger: {
                    scroller: scrollWrapper,
                    trigger: frag,
                    start: 'top 80%',
                    toggleActions: 'play none none reverse'
                }
            }
        );
    });

    // Horizon Scene - Sticky Black Hole Pin
    ScrollTrigger.create({
        scroller: scrollWrapper,
        trigger: "#scene-horizon",
        start: "top top",
        end: "+=150vh", // Pin for 1.5 viewport heights
        pin: "#horizon-pin",
        pinSpacing: true, // creates the scroll gap
        animation: gsap.to('.event-horizon', {
            scale: 6, // Black hole engulfs the screen
            boxShadow: "inset 0 0 100px #000, 0 0 200px rgba(0,0,0,1)",
            ease: "power1.in"
        }),
        scrub: true
    });

    // Infinite Loop Scene - Marquee Scrubber
    gsap.to('#marquee-1', {
        xPercent: -50,
        ease: "none",
        scrollTrigger: {
            scroller: scrollWrapper,
            trigger: "#scene-loop",
            start: "top bottom",
            end: "bottom top",
            scrub: 1
        }
    });

    gsap.to('#marquee-2', {
        xPercent: 50,
        ease: "none",
        scrollTrigger: {
            scroller: scrollWrapper,
            trigger: "#scene-loop",
            start: "top bottom",
            end: "bottom top",
            scrub: 1.5
        }
    });

    gsap.to('#marquee-3', {
        xPercent: -60,
        ease: "none",
        scrollTrigger: {
            scroller: scrollWrapper,
            trigger: "#scene-loop",
            start: "top bottom",
            end: "bottom top",
            scrub: 2.5
        }
    });

    // --- NEW SCENE ANIMATIONS ---

    // Scene 02.5: Hourglass
    ScrollTrigger.create({
        scroller: scrollWrapper,
        trigger: ".scene-02-5-hourglass",
        start: "top bottom",
        end: "bottom top",
        onUpdate: self => {
            if (window.CHRONOS_EFFECTS && window.CHRONOS_EFFECTS.Hourglass) {
                window.CHRONOS_EFFECTS.Hourglass.setScrollData(self.progress, state.scroll.velocity);
            }
        }
    });

    // Scene 03.5: Timeline
    const timelineNodes = document.querySelectorAll('.timeline-node');
    timelineNodes.forEach((node, i) => {
        ScrollTrigger.create({
            scroller: scrollWrapper,
            trigger: node,
            start: "top center+=20%",
            onEnter: () => {
                if (window.CHRONOS_EFFECTS && window.CHRONOS_EFFECTS.Timeline) {
                    window.CHRONOS_EFFECTS.Timeline.activateNode(i);
                }
            },
            onEnterBack: () => {
                if (window.CHRONOS_EFFECTS && window.CHRONOS_EFFECTS.Timeline) {
                    window.CHRONOS_EFFECTS.Timeline.activateNode(i);
                }
            }
        });
    });

    // Scene 04.5: Quantum Tunnel
    const metrics = document.querySelectorAll('.metric-value');
    ScrollTrigger.create({
        scroller: scrollWrapper,
        trigger: ".scene-04-5-quantum",
        start: "top center",
        onEnter: () => {
            metrics.forEach(el => {
                let target = parseFloat(el.getAttribute('data-val'));
                gsap.to({ val: 0 }, {
                    val: target,
                    duration: 3,
                    ease: "power2.out",
                    onUpdate: function () {
                        el.innerText = target % 1 === 0 ? Math.floor(this.targets()[0].val) : this.targets()[0].val.toFixed(2);
                    }
                });
            });
        }
    });

    // Scene 06.5: Dali Clock
    ScrollTrigger.create({
        scroller: scrollWrapper,
        trigger: ".scene-06-5-dali",
        start: "top bottom",
        end: "bottom top",
        scrub: true,
        onUpdate: self => {
            if (window.CHRONOS_EFFECTS && window.CHRONOS_EFFECTS.Dali) {
                window.CHRONOS_EFFECTS.Dali.setMeltFactor(self.progress * 1.5);
            }
        }
    });

    // Scene 08: End Fingerprint Generation
    ScrollTrigger.create({
        scroller: scrollWrapper,
        trigger: "#scene-end",
        start: "top center",
        onEnter: () => {
            if (window.CHRONOS_EFFECTS && window.CHRONOS_EFFECTS.Fingerprint) {
                window.CHRONOS_EFFECTS.Fingerprint.generate();
            }
        }
    });

    // Global Scene Transition Controller
    const sections = document.querySelectorAll('section');
    sections.forEach((sec, i) => {
        ScrollTrigger.create({
            scroller: scrollWrapper,
            trigger: sec,
            start: "top center+=20%",
            onEnter: () => {
                if (window.CHRONOS_EFFECTS && window.CHRONOS_EFFECTS.Transition) {
                    window.CHRONOS_EFFECTS.Transition.updateSceneIndicator(i + 1);
                    if (i > 0) window.CHRONOS_EFFECTS.Transition.triggerTransition();
                }
            },
            onEnterBack: () => {
                if (window.CHRONOS_EFFECTS && window.CHRONOS_EFFECTS.Transition) {
                    window.CHRONOS_EFFECTS.Transition.updateSceneIndicator(i + 1);
                }
            }
        });
    });

    // Random floating Kanji animation
    gsap.utils.toArray('.floating-kanji span').forEach(span => {
        gsap.to(span, {
            y: () => (Math.random() * -800) - 200,
            x: () => (Math.random() - 0.5) * 500,
            rotation: () => (Math.random() - 0.5) * 360,
            ease: "none",
            scrollTrigger: {
                scroller: scrollWrapper,
                trigger: span.parentElement, // trigger on the kanji wrapper
                start: "top bottom",
                end: "bottom top",
                scrub: Math.random() * 2 + 1
            }
        });
    });

    // Rewind Button Logic
    document.getElementById('btn-rewind').addEventListener('click', () => {
        // Shoot back up to the top, manipulating the custom momentum
        gsap.to(state.scroll, {
            target: 0,
            y: 0,
            duration: 3,
            ease: "expo.inOut"
        });

        // Trigger a huge glitch via SVG filter assignment globally
        document.body.style.filter = "url(#glitch)";
        setTimeout(() => document.body.style.filter = "none", 3000);

        if (window.AudioEngine_Rewind) window.AudioEngine_Rewind();
    });

    // Global Time Wasted Counter Tool
    setInterval(() => {
        if (state.isLoaded) {
            state.timeWasted += 1;
            document.getElementById('time-wasted').innerText = state.timeWasted;
        }
    }, 1000);

    // Global HUD Clock
    const clockNode = document.getElementById('global-clock');
    const updateClock = () => {
        const d = new Date();
        clockNode.innerText = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}:${String(d.getMilliseconds()).padStart(3, '0')}`;
        requestAnimationFrame(updateClock);
    };
    updateClock();
};

/* ----- F. HUD & CURSOR TRACKER ----- */
const initCursor = () => {
    const dot = document.querySelector('.cursor-dot');
    const ring = document.querySelector('.cursor-ring');

    let ringX = window.innerWidth / 2;
    let ringY = window.innerHeight / 2;

    window.addEventListener('mousemove', (e) => {
        state.mouse.x = e.clientX;
        state.mouse.y = e.clientY;

        // Hard tether the dot to the exact mouse pixel
        dot.style.transform = `translate3d(${state.mouse.x}px, ${state.mouse.y}px, 0) translate(-50%, -50%)`;
    });

    // Smooth physics loop for the ring
    const renderRing = () => {
        ringX += (state.mouse.x - ringX) * 0.15;
        ringY += (state.mouse.y - ringY) * 0.15;
        ring.style.transform = `translate3d(${ringX}px, ${ringY}px, 0) translate(-50%, -50%)`;
        requestAnimationFrame(renderRing);
    };
    renderRing();

    // Interaction states
    document.documentElement.addEventListener('mousedown', () => document.body.classList.add('cursor-active'));
    document.documentElement.addEventListener('mouseup', () => document.body.classList.remove('cursor-active'));

    // Add magnetic hover interactions to buttons
    const magneticElements = document.querySelectorAll('button, .audio-toggle, .rewind-btn');
    magneticElements.forEach(el => {
        el.addEventListener('mouseenter', () => document.body.classList.add('cursor-active'));
        el.addEventListener('mouseleave', () => document.body.classList.remove('cursor-active'));
    });
};


/* ----- BOOTSTRAP ----- */
document.addEventListener("DOMContentLoaded", () => {
    initCursor();
    initSmoothScroll();
    initLoaderSequence();
    initMasterTimeline();

    // Toggle mute
    document.getElementById('audio-toggle').addEventListener('click', function (e) {
        this.classList.toggle('muted');
        if (window.AudioEngine_ToggleMute) {
            window.AudioEngine_ToggleMute();
        }
    });
});
