/* =========================================================================
   EFFECTS.JS - ADVANCED SCENE EFFECTS & CANVAS RENDERERS
   ========================================================================= */

/* -------- 1. HOURGLASS ENGINE -------- */
class HourglassEngine {
    constructor() {
        this.svg = document.getElementById('hourglass-svg');
        if (!this.svg) return;

        this.sandTopPath = document.getElementById('sand-top-path');
        this.sandBotPath = document.getElementById('sand-bot-path');
        this.particlesGroup = document.getElementById('sand-particles');
        this.grainCounter = document.getElementById('grain-counter');

        this.grainsFallen = 0;
        this.lastSpawnTime = 0;
        this.activeParticles = [];
        this.scrollVelocity = 0;
        this.progress = 0; // 0 to 1 inside the scene

        this.render = this.render.bind(this);
        requestAnimationFrame(this.render);
    }

    setScrollData(progress, velocity) {
        this.progress = Math.max(0, Math.min(1, progress));
        this.scrollVelocity = Math.abs(velocity);
    }

    spawnGrain() {
        // SVG circle
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        const r = 1 + Math.random() * 1.5;
        const x = 95 + Math.random() * 10;
        const y = 205;

        circle.setAttribute("cx", x);
        circle.setAttribute("cy", y);
        circle.setAttribute("r", r);
        circle.setAttribute("fill", "var(--color-sand-gold, #d4a857)");
        circle.setAttribute("opacity", 0.8 * Math.random() + 0.2);

        this.particlesGroup.appendChild(circle);

        this.activeParticles.push({
            el: circle,
            x: x,
            y: y,
            vy: 2 + Math.random() * 2,
            vx: (Math.random() - 0.5) * 1.5,
            life: 1.0
        });

        this.grainsFallen++;
        if (this.grainCounter) {
            this.grainCounter.innerText = Math.floor(this.grainsFallen + this.progress * 50000).toLocaleString();
        }
    }

    updateSandLevels() {
        // Adjust the height of top and bottom sand based on scene progress (0 -> 1)
        // Top sand goes down, Bottom sand builds up

        // Top sand logic (goes from y=25 to y=193)
        let topY = 25 + (168 * this.progress);
        this.sandTopPath.setAttribute("d", `M25,${topY} L175,${topY} C175,100 128,158 108,193 L92,193 C72,158 25,100 25,${topY} Z`);

        // Bottom sand logic (goes from y=375 to y=207)
        let botY = 375 - (168 * this.progress);
        this.sandBotPath.setAttribute("d", `M108,${Math.max(207, botY)} L92,${Math.max(207, botY)} C72,242 25,300 25,375 L175,375 C175,300 128,242 108,${Math.max(207, botY)} Z`);
    }

    render(time) {
        // Spawn based on velocity and progress
        if (this.progress > 0.05 && this.progress < 0.95 && this.scrollVelocity > 5) {
            if (time - this.lastSpawnTime > (2000 / Math.max(10, this.scrollVelocity))) {
                let spawnCount = Math.min(5, Math.ceil(this.scrollVelocity / 100));
                for (let i = 0; i < spawnCount; i++) this.spawnGrain();
                this.lastSpawnTime = time;

                // Audio click trigger
                if (window.AudioEngine_PlaySandClick) {
                    window.AudioEngine_PlaySandClick();
                }
            }
        }

        // Update active particles
        for (let i = this.activeParticles.length - 1; i >= 0; i--) {
            let p = this.activeParticles[i];
            p.y += p.vy;
            p.x += p.vx;

            p.el.setAttribute("cx", p.x);
            p.el.setAttribute("cy", p.y);

            // Remove when reaching bottom sand level
            let botY = 375 - (168 * this.progress);
            if (p.y > Math.max(botY, 207)) {
                this.particlesGroup.removeChild(p.el);
                this.activeParticles.splice(i, 1);
            }
        }

        this.updateSandLevels();
        requestAnimationFrame(this.render);
    }
}

/* -------- 2. TIMELINE ANIMATOR -------- */
class TimelineAnimator {
    constructor() {
        this.nodes = document.querySelectorAll('.timeline-node');
        this.line = document.querySelector('.timeline-line');
        this.nowClock = document.getElementById('timeline-now-clock');
        this.activeIndex = -1;

        if (this.nowClock) {
            setInterval(this.updateClock.bind(this), 100);
        }
    }

    updateClock() {
        const d = new Date();
        this.nowClock.innerText = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
    }

    activateNode(index) {
        if (index === this.activeIndex) return;
        this.activeIndex = index;

        this.nodes.forEach((node, i) => {
            if (i <= index) {
                node.classList.add('is-active');
            } else {
                node.classList.remove('is-active');
            }
        });

        if (this.line) {
            let pct = (index + 1) / this.nodes.length;
            this.line.style.transform = `scaleY(${pct})`;
        }
    }
}

/* -------- 3. DALI MELTING CLOCK RENDERER -------- */
class MeltingClockRenderer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;

        this.ctx = this.canvas.getContext('2d');
        this.width = 800;
        this.height = 600;
        this.canvas.width = this.width;
        this.canvas.height = this.height;

        this.meltFactor = 0; // 0 to 1
        this.render = this.render.bind(this);
        requestAnimationFrame(this.render);
    }

    setMeltFactor(factor) {
        // smooth it slightly
        this.meltFactor += (Math.max(0, Math.min(1, factor)) - this.meltFactor) * 0.1;
    }

    drawClockBase(x, y, r, phaseOffs) {
        this.ctx.save();
        this.ctx.translate(x, y);

        let points = [];
        const numPoints = 60;

        // Generate points for distorted circle
        for (let i = 0; i < numPoints; i++) {
            let angle = (i / numPoints) * Math.PI * 2;
            let nx = Math.cos(angle);
            let ny = Math.sin(angle);

            // Melt distortion applies mostly to lower half (y > 0)
            let meltWeight = Math.max(0, ny) * this.meltFactor;
            let distY = meltWeight * r * 1.5;
            let distX = Math.sin(angle * 3 + phaseOffs) * meltWeight * r * 0.3;

            points.push({
                x: nx * r + distX,
                y: ny * r + distY
            });
        }

        // Draw clock face
        this.ctx.beginPath();
        this.ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            // Smooth curve
            let xc = (points[i].x + points[i >= points.length - 1 ? 0 : i + 1].x) / 2;
            let yc = (points[i].y + points[i >= points.length - 1 ? 0 : i + 1].y) / 2;
            this.ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
        }
        this.ctx.closePath();

        let grad = this.ctx.createRadialGradient(0, -r * 0.5, r * 0.1, 0, 0, r * 1.5);
        grad.addColorStop(0, "#f4e1c1");
        grad.addColorStop(1, "#c19a6b");

        this.ctx.fillStyle = grad;
        this.ctx.fill();
        this.ctx.lineWidth = 10;
        this.ctx.strokeStyle = "#5c4e40";
        this.ctx.stroke();

        // Draw ticks
        this.ctx.fillStyle = "#332211";
        for (let i = 0; i < 12; i++) {
            let p = points[i * 5];
            this.ctx.beginPath();
            this.ctx.arc(p.x * 0.85, p.y * 0.85, 4, 0, Math.PI * 2);
            this.ctx.fill();
        }

        // Calculate center for hands, pull it down as it melts
        let centerX = 0;
        let centerY = this.meltFactor * r * 0.5;

        // Draw hands
        let d = new Date();
        let s = d.getSeconds() + d.getMilliseconds() / 1000;
        let m = d.getMinutes() + s / 60;
        let h = (d.getHours() % 12) + m / 60;

        const drawHand = (angle, length, width, color) => {
            this.ctx.save();
            this.ctx.translate(centerX, centerY);
            this.ctx.rotate(angle);

            this.ctx.beginPath();
            // Hands bend downwards if melting
            let hPoints = [];
            for (let j = 0; j <= 10; j++) {
                let t = j / 10;
                let py = -length * t;
                // calculate global coords to apply melt
                let gx = centerX + (-py) * Math.sin(angle);
                let gy = centerY + (-py) * Math.cos(angle);

                let mw = Math.max(0, gy / r) * this.meltFactor;

                hPoints.push({
                    x: 0,
                    y: py + (mw * length * 0.5) // Bend downwards
                });
            }

            this.ctx.moveTo(0, 0);
            for (let j = 1; j < hPoints.length; j++) {
                this.ctx.lineTo(hPoints[j].x, hPoints[j].y);
            }

            this.ctx.strokeStyle = color;
            this.ctx.lineWidth = width;
            this.ctx.lineCap = "round";
            this.ctx.stroke();
            this.ctx.restore();
        };

        drawHand((h / 12) * Math.PI * 2, r * 0.5, 8, "#332211");
        drawHand((m / 60) * Math.PI * 2, r * 0.7, 5, "#332211");
        drawHand((s / 60) * Math.PI * 2, r * 0.8, 2, "#d4a857");

        this.ctx.restore();
    }

    render() {
        if (!this.canvas) return;
        this.ctx.clearRect(0, 0, this.width, this.height);

        // Draw 3 melting clocks
        this.drawClockBase(this.width * 0.5, this.height * 0.35, 120, 0);
        this.drawClockBase(this.width * 0.2, this.height * 0.7, 80, 2);
        this.drawClockBase(this.width * 0.8, this.height * 0.6, 90, 4);

        requestAnimationFrame(this.render);
    }
}

/* -------- 4. SCENE TRANSITION CONTROLLER -------- */
class SceneTransitionController {
    constructor() {
        this.maskLeft = document.querySelector('.mask-left');
        this.maskRight = document.querySelector('.mask-right');
        this.sceneInd = document.querySelector('.current-scene');
        this.isAnimating = false;
    }

    updateSceneIndicator(index) {
        if (this.sceneInd) {
            this.sceneInd.innerText = String(index).padStart(2, '0');
        }
    }

    triggerTransition() {
        if (!this.maskLeft || this.isAnimating) return;
        this.isAnimating = true;

        // Quick close and open
        gsap.to([this.maskLeft, this.maskRight], {
            scaleX: 1,
            duration: 0.4,
            ease: "power2.inOut",
            onComplete: () => {
                gsap.to([this.maskLeft, this.maskRight], {
                    scaleX: 0,
                    duration: 0.5,
                    ease: "power2.inOut",
                    delay: 0.1,
                    onComplete: () => {
                        this.isAnimating = false;
                    }
                });
            }
        });
    }
}

/* -------- 5. TIME FINGERPRINT GENERATOR -------- */
class TimeFingerprintGenerator {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = 300;
        this.canvas.height = 300;

        // Data points
        this.nodes = [];
    }

    recordData(vel, progress) {
        if (Math.random() > 0.95 && vel > 10) {
            this.nodes.push({
                radius: 50 + (progress * 100),
                angle: (vel % 360) * (Math.PI / 180),
                intensity: Math.min(1, vel / 1000)
            });
        }
    }

    generate() {
        if (!this.canvas) return;
        this.ctx.clearRect(0, 0, 300, 300);
        this.ctx.translate(150, 150);

        this.ctx.strokeStyle = "rgba(179, 155, 130, 0.4)";
        this.ctx.lineWidth = 1;

        this.nodes.forEach(n => {
            this.ctx.beginPath();
            let x = Math.cos(n.angle) * n.radius;
            let y = Math.sin(n.angle) * n.radius;

            // Draw fingerprint-like loops
            let loopR = 10 + n.intensity * 40;
            this.ctx.ellipse(x, y, loopR, loopR * 0.3, n.angle, 0, Math.PI * 2);
            this.ctx.stroke();
        });

        this.ctx.translate(-150, -150);
    }
}

// Export instances to global window object
window.CHRONOS_EFFECTS = {
    Hourglass: new HourglassEngine(),
    Timeline: new TimelineAnimator(),
    Dali: new MeltingClockRenderer('dali-canvas'),
    Transition: new SceneTransitionController(),
    Fingerprint: new TimeFingerprintGenerator('fingerprint-canvas')
};
