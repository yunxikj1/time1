/* =========================================================================
   CANVAS.JS - THE RAW WEBGL SHADING ENGINE (USING TWGL.JS)
   This script drives massive computational fluid and noise shaders to represent
   the abstract bending of space-time, acting as the background for the entire scene.
   ========================================================================= */

const canvas = document.getElementById("time-canvas");
const gl = canvas.getContext("webgl2", { alpha: false, antialias: false, powerPreference: "high-performance" });

if (!gl) {
    console.error("WebGL 2 not supported. Falling back to simple background.");
    document.getElementById("webgl-container").style.background = "linear-gradient(#050505, #111)";
}

/* -------- 1. GLSL SHADER CODE -------- */

// Vertex Shader: A simple full-screen triangle setup
const vs = `#version 300 es
in vec4 position;
void main() {
  gl_Position = position;
}
`;

// Fragment Shader: Ultra-complex procedural noise & fluid generation
// Represents melting clocks, temporal distortion, and event horizons
const fs = `#version 300 es
precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform vec2 u_mouse;
uniform float u_scrollVelocity;
uniform float u_scrollProgress; // 0.0 to 1.0 mapping global scroll
uniform vec3 u_colorBase;
uniform vec3 u_colorAccent;

out vec4 outColor;

// ============== NOISE FUNCTIONS ==============
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
  const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

  vec3 i  = floor(v + dot(v, C.yyy) );
  vec3 x0 = v - i + dot(i, C.xxx) ;

  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min( g.xyz, l.zxy );
  vec3 i2 = max( g.xyz, l.zxy );

  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;

  i = mod289(i); 
  vec4 p = permute( permute( permute( 
             i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
           + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

  float n_ = 0.142857142857;
  vec3  ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_ );

  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4( x.xy, y.xy );
  vec4 b1 = vec4( x.zw, y.zw );

  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

  vec3 p0 = vec3(a0.xy,h.x);
  vec3 p1 = vec3(a0.zw,h.y);
  vec3 p2 = vec3(a1.xy,h.z);
  vec3 p3 = vec3(a1.zw,h.w);

  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), 
                                dot(p2,x2), dot(p3,x3) ) );
}

float fbm(vec3 x) {
    float v = 0.0;
    float a = 0.5;
    vec3 shift = vec3(100.0);
    for (int i = 0; i < 6; ++i) { // upgraded to 6 octaves
        v += a * snoise(x);
        x = x * 2.0 + shift;
        a *= 0.5;
    }
    return v;
}

float clockMelt(vec2 uv, float t) {
    vec2 q = vec2(0.);
    q.x = fbm( vec3(uv + 0.00, t) );
    q.y = fbm( vec3(uv + vec2(1.0), t) );

    vec2 r = vec2(0.);
    float distortionForce = 1.0 + u_scrollVelocity * 6.0;
    
    r.x = fbm( vec3(uv + 1.0*q + vec2(1.7,9.2)+ 0.15*t * distortionForce, t) );
    r.y = fbm( vec3(uv + 1.0*q + vec2(8.3,2.8)+ 0.126*t * distortionForce, t) );

    return fbm( vec3(uv + r * 1.5, t) );
}

// Particle stars for deep space
float starField(vec2 p) {
    vec2 pos = fract(p * 20.0);
    vec2 id = floor(p * 20.0);
    float n = fract(sin(dot(id, vec2(12.9898, 78.233))) * 43758.5453123);
    float size = 0.02 + n * 0.05;
    float dist = length(pos - vec2(n, fract(n * 34.0)));
    float star = smoothstep(size, 0.0, dist) * smoothstep(0.9, 1.0, n);
    return star * (0.5 + 0.5 * sin(u_time * 2.0 + n * 10.0)); // subtle blink
}

void main() {
    vec2 st = gl_FragCoord.xy / u_resolution.xy;
    st.x *= u_resolution.x / u_resolution.y;

    vec2 mst = u_mouse.xy / u_resolution.xy;
    mst.x *= u_resolution.x / u_resolution.y;
    mst.y = 1.0 - mst.y;

    float baseTime = u_time * 0.1 * (1.0 + u_scrollProgress * 2.0); 

    float distToMouse = distance(st, mst);
    float mouseForce = exp(-distToMouse * 4.0) * 0.5;

    // Intense warping
    vec2 warpedSt = st + vec2(
        clockMelt(st + vec2(0.0), baseTime),
        clockMelt(st + vec2(5.2), baseTime)
    ) * (0.15 + mouseForce * 0.3);

    float noiseVal = fbm(vec3(warpedSt * 3.0, baseTime * 1.5));
    
    // Aurora effect for Quantum zone
    float aurora = fbm(vec3(st * 4.0 + vec2(baseTime, -baseTime * 1.5), baseTime * 0.5));
    aurora = pow(abs(aurora), 3.0) * 2.0;

    float contour = abs(fract(noiseVal * 10.0) - 0.5);
    contour = smoothstep(0.4, 0.45, contour);

    vec3 voidColor = mix(u_colorBase, vec3(0.02, 0.05, 0.1), u_scrollProgress);
    vec3 memoryColor = mix(u_colorAccent, vec3(0.0, 1.0, 0.98),  pow(u_scrollProgress, 2.0)); // Cyan shift near bottom
    
    vec3 finalColor = mix(voidColor, memoryColor, smoothstep(0.2, 0.8, noiseVal));
    
    // Add Quantum Aurora if near middle/bottom
    vec3 auroraColor = vec3(0.0, 1.0, 0.98) * aurora * smoothstep(0.3, 0.7, u_scrollProgress);
    finalColor += auroraColor;
    
    // Starfield for deep space
    float stars = starField(st + vec2(0.0, baseTime * 0.5));
    finalColor += vec3(stars) * (1.0 - u_scrollProgress); // fade out stars as we go down

    float sparks = pow(smoothstep(0.6, 1.0, noiseVal), 5.0) * (u_scrollVelocity * 2.5);
    finalColor += sparks * vec3(1.0, 0.8, 0.6);

    finalColor = mix(finalColor, vec3(0.0), contour * 0.6);

    vec2 uvNorm = gl_FragCoord.xy / u_resolution.xy;
    uvNorm = uvNorm * 2.0 - 1.0;
    float vignette = max(0.0, 1.0 - dot(uvNorm, uvNorm) * 0.6); // slight vignette intensity increase
    finalColor *= vignette;

    outColor = vec4(finalColor, 1.0);
}
`;

/* -------- 2. GL CONTEXT & BUFFER SETUP -------- */
// Twgl.js makes compiling shaders and setting up buffers trivial
// Provide full-screen quad geometry
const programInfo = twgl.createProgramInfo(gl, [vs, fs]);

const arrays = {
    position: {
        numComponents: 2,
        data: [
            -1, -1,
            1, -1,
            -1, 1,
            -1, 1,
            1, -1,
            1, 1,
        ],
    },
};

const bufferInfo = twgl.createBufferInfoFromArrays(gl, arrays);

/* -------- 3. STATE & UNIFORMS -------- */

// Convert hex string arrays to normalized RGB vec3 arrays
function hexToRgbNorm(hex) {
    let r = 0, g = 0, b = 0;
    if (hex.length == 4) {
        r = parseInt(hex[1] + hex[1], 16);
        g = parseInt(hex[2] + hex[2], 16);
        b = parseInt(hex[3] + hex[3], 16);
    } else if (hex.length == 7) {
        r = parseInt(hex.substring(1, 3), 16);
        g = parseInt(hex.substring(3, 5), 16);
        b = parseInt(hex.substring(5, 7), 16);
    }
    return [r / 255.0, g / 255.0, b / 255.0];
}

// These match the CSS tokens natively
const colorBase = hexToRgbNorm("#030303");
const colorAccent = hexToRgbNorm("#b39b82");

const uniforms = {
    u_resolution: [gl.canvas.width, gl.canvas.height],
    u_time: 0,
    u_mouse: [gl.canvas.width / 2, gl.canvas.height / 2],
    u_scrollVelocity: 0,
    u_scrollProgress: 0,
    u_colorBase: colorBase,
    u_colorAccent: colorAccent,
};

/* -------- 4. INTERACTION LISTENERS -------- */
// Track mouse for shader interaction
window.addEventListener('mousemove', (e) => {
    // We smooth this in the render loop to prevent jitter
    targetMouse.x = e.clientX;
    targetMouse.y = e.clientY;
});

window.addEventListener('touchmove', (e) => {
    if (e.touches.length > 0) {
        targetMouse.x = e.touches[0].clientX;
        targetMouse.y = e.touches[0].clientY;
    }
});

let currentMouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
let targetMouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

// Resizing
function resizeCanvas() {
    // Force CSS size to match window
    gl.canvas.style.width = '100vw';
    gl.canvas.style.height = '100vh';

    // Calculate physical pixels based on device ratio for crispness
    const displayWidth = Math.floor(window.innerWidth * window.devicePixelRatio);
    const displayHeight = Math.floor(window.innerHeight * window.devicePixelRatio);

    // Only resize if necessary
    if (gl.canvas.width !== displayWidth || gl.canvas.height !== displayHeight) {
        gl.canvas.width = displayWidth;
        gl.canvas.height = displayHeight;
    }

    // Update uniforms and viewport
    uniforms.u_resolution = [gl.canvas.width, gl.canvas.height];
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
}

window.addEventListener('resize', resizeCanvas);
// Run once on load
resizeCanvas();

/* -------- 5. MAIN RENDER LOOP -------- */
let then = 0;

function render(now) {
    now *= 0.001; // convert to seconds
    const deltaTime = now - then;
    then = now;

    // Handle Resize checks continuously in case of DOM shifts
    resizeCanvas();

    // 5.1 Mouse Smoothing
    // Ease the current mouse position towards target
    currentMouse.x += (targetMouse.x - currentMouse.x) * 0.1;
    currentMouse.y += (targetMouse.y - currentMouse.y) * 0.1;
    uniforms.u_mouse = [currentMouse.x, currentMouse.y];

    // 5.2 Scroll Hooks (Connected from main.js)
    // We expect main.js to expose window.__SCROLL_MOMENTUM and window.__GLOBAL_PROGRESS
    let sVel = window.__SCROLL_MOMENTUM || 0;
    let sProg = window.__GLOBAL_PROGRESS || 0;

    // Smooth the velocity read
    uniforms.u_scrollVelocity += (sVel - uniforms.u_scrollVelocity) * 0.1;
    uniforms.u_scrollProgress += (sProg - uniforms.u_scrollProgress) * 0.1;

    // 5.3 Update time
    uniforms.u_time = now;

    // 5.4 GL Execute
    gl.useProgram(programInfo.program);
    twgl.setBuffersAndAttributes(gl, programInfo, bufferInfo);
    twgl.setUniforms(programInfo, uniforms);

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    requestAnimationFrame(render);
}

// Boot the eternal loop
requestAnimationFrame(render);

// Log to signify engine completely engaged
console.log("🌀 WEBGL Chrono-Shader Engine Booted.");
