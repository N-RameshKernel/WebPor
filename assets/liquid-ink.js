(function () {
  const canvas = document.getElementById("liquid-ink-canvas");
  if (!canvas) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const gl = canvas.getContext("webgl", {
    alpha: true,
    antialias: false,
    premultipliedAlpha: false,
    powerPreference: "high-performance"
  });
  if (!gl) return;
  gl.clearColor(0, 0, 0, 0);

  // Vertex Shader
  const vsSource = `
    attribute vec2 a_pos;
    varying vec2 v_uv;
    void main() {
      v_uv = (a_pos + 1.0) * 0.5;
      gl_Position = vec4(a_pos, 0.0, 1.0);
    }
  `;

  // Fragment Shader (Metaball Smooth-Min + Noise + Iridescent Rim)
  const N = 32; // Total active metaball capacity
  const fsSource = `
    precision highp float;
    #define N ${N}
    #define K 0.034
    varying vec2 v_uv;
    uniform vec3 u_balls[N];
    uniform float u_time;
    uniform float u_aspect;
    uniform vec3 u_colorA;
    uniform vec3 u_colorB;
    uniform vec3 u_colorC;

    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    float vnoise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
        mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
        f.y
      );
    }

    void main() {
      vec2 p = (v_uv - 0.5) * vec2(u_aspect, 1.0);

      // Evaluate metaball potential field
      float S = 0.0;
      for (int i = 0; i < N; i++) {
        vec3 b = u_balls[i];
        if (b.z <= 0.001) continue;
        vec2 v = p - b.xy;
        float d = length(v) - b.z;
        if (d > 0.45) continue;
        S += exp(-d / K);
      }

      float f = 0.7;
      if (S > 1e-9) {
        f = -K * log(S);
      }

      // Procedural viscous organic ripple
      f += (vnoise(p * 15.0 + vec2(u_time * 0.25, -u_time * 0.2)) - 0.5) * 0.013;

      float inside = 1.0 - smoothstep(-0.004, 0.007, f);
      float rim = exp(-pow((f + 0.003) / 0.006, 2.0));

      // Iridescent 3-color phase cycle
      float ph = mod(u_time * 0.35 + p.x * 0.3 + p.y * 0.2, 3.0);
      float d0 = min(abs(ph - 0.0), 3.0 - abs(ph - 0.0));
      float d1 = min(abs(ph - 1.0), 3.0 - abs(ph - 1.0));
      float d2 = min(abs(ph - 2.0), 3.0 - abs(ph - 2.0));
      vec3 w = vec3(1.0 - smoothstep(0.2, 0.8, d0), 1.0 - smoothstep(0.2, 0.8, d1), 1.0 - smoothstep(0.2, 0.8, d2));
      w /= (w.x + w.y + w.z + 1e-5);

      vec3 colorInside = w.x * u_colorA + w.y * u_colorB + w.z * u_colorC;
      vec3 rimCol = w.x * u_colorB + w.y * u_colorC + w.z * u_colorA;

      vec3 finalCol = mix(colorInside * inside, rimCol, rim * 0.95);
      float alpha = clamp(max(inside * 0.34, rim * 0.50), 0.0, 0.50);
      gl_FragColor = vec4(finalCol, alpha);
    }
  `;

  function compileShader(type, src) {
    const s = gl.createShader(type);
    if (!s) return null;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error("Liquid ink shader compilation failed:", gl.getShaderInfoLog(s));
      gl.deleteShader(s);
      return null;
    }
    return s;
  }

  const vertexShader = compileShader(gl.VERTEX_SHADER, vsSource);
  const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fsSource);
  if (!vertexShader || !fragmentShader) return;

  const prog = gl.createProgram();
  if (!prog) return;
  gl.attachShader(prog, vertexShader);
  gl.attachShader(prog, fragmentShader);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error("Liquid ink shader link failed:", gl.getProgramInfoLog(prog));
    return;
  }
  gl.useProgram(prog);

  // Full-screen quad buffer
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1, -1,  1, -1, -1,  1,
    -1,  1,  1, -1,  1,  1
  ]), gl.STATIC_DRAW);

  const posLoc = gl.getAttribLocation(prog, "a_pos");
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  // Uniform locations
  const uBallsLoc = gl.getUniformLocation(prog, "u_balls");
  const uTimeLoc = gl.getUniformLocation(prog, "u_time");
  const uAspectLoc = gl.getUniformLocation(prog, "u_aspect");
  const uColorALoc = gl.getUniformLocation(prog, "u_colorA");
  const uColorBLoc = gl.getUniformLocation(prog, "u_colorB");
  const uColorCLoc = gl.getUniformLocation(prog, "u_colorC");

  // Palette colors (normalized RGB): Neon Lime, Lilac Purple, Warm Gold
  gl.uniform3f(uColorALoc, 0.78, 1.00, 0.18); // #C8FF2E
  gl.uniform3f(uColorBLoc, 0.72, 0.64, 0.96); // #B9A3F5
  gl.uniform3f(uColorCLoc, 0.91, 0.73, 0.24); // #E8B93C

  let width = 0, height = 0, aspect = 1;
  function handleResize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    aspect = width / height;
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  window.addEventListener("resize", handleResize);
  handleResize();

  // Coordinate transforms (Screen pixels -> Shader field space)
  const toFieldX = (x) => (x / width - 0.5) * aspect;
  const toFieldY = (y) => 0.5 - y / height;

  const TRAIL_COUNT = 22;
  const SPLAT_COUNT = 10;
  const trail = Array.from({ length: TRAIL_COUNT }, () => ({ x: 0, y: 0, r0: 0, age: 99 }));
  let trailHead = 0;
  const splats = [];

  const pointer = {
    active: false,
    tx: 0, ty: 0,
    hx: 0, hy: 0,
    lx: 0, ly: 0,
    was: false,
    speed: 0
  };

  function spawnSplatter(x, y, count, force, minR, maxR) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = force * (0.4 + Math.random() * 0.8);
      if (splats.length >= SPLAT_COUNT) splats.shift();
      splats.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r0: minR + Math.random() * (maxR - minR),
        age: 0,
        life: 0.6 + Math.random() * 0.4
      });
    }
  }

  function addTrailPoint(x, y, r) {
    const p = trail[trailHead];
    p.x = x; p.y = y; p.r0 = r; p.age = 0;
    trailHead = (trailHead + 1) % TRAIL_COUNT;
  }

  // Pointer event listeners
  window.addEventListener("pointermove", (e) => {
    if (e.pointerType === "touch") return;
    pointer.active = true;
    pointer.tx = toFieldX(e.clientX);
    pointer.ty = toFieldY(e.clientY);
  }, { passive: true });

  window.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "touch") return;
    pointer.active = true;
    pointer.tx = toFieldX(e.clientX);
    pointer.ty = toFieldY(e.clientY);
    spawnSplatter(pointer.tx, pointer.ty, 6, 0.45, 0.035, 0.07);
  }, { passive: true });

  document.documentElement.addEventListener("mouseleave", () => { pointer.active = false; });
  window.addEventListener("blur", () => { pointer.active = false; });

  // Touch Support
  window.addEventListener("touchstart", (e) => {
    const t = e.touches[0];
    if (!t) return;
    pointer.active = true;
    pointer.tx = toFieldX(t.clientX);
    pointer.ty = toFieldY(t.clientY);
  }, { passive: true });

  window.addEventListener("touchmove", (e) => {
    const t = e.touches[0];
    if (!t) return;
    pointer.tx = toFieldX(t.clientX);
    pointer.ty = toFieldY(t.clientY);
  }, { passive: true });

  window.addEventListener("touchend", () => { pointer.active = false; }, { passive: true });

  const ballData = new Float32Array(N * 3);
  let lastTime = performance.now();

  function animate(time) {
    requestAnimationFrame(animate);
    const dt = Math.min(0.05, (time - lastTime) / 1000);
    lastTime = time;

    if (pointer.active) {
      if (!pointer.was) {
        pointer.hx = pointer.tx;
        pointer.hy = pointer.ty;
        pointer.lx = pointer.hx;
        pointer.ly = pointer.hy;
      }
      const ease = 1 - Math.exp(-18 * dt);
      pointer.hx += (pointer.tx - pointer.hx) * ease;
      pointer.hy += (pointer.ty - pointer.hy) * ease;

      const dist = Math.hypot(pointer.hx - pointer.lx, pointer.hy - pointer.ly);
      const spd = dt > 0 ? dist / dt : 0;
      pointer.speed += (spd - pointer.speed) * 0.2;

      const radius = 0.05 + 0.035 * Math.min(1, pointer.speed / 1.4);
      const steps = Math.min(6, Math.max(1, Math.ceil(dist / (radius * 0.8))));

      for (let i = 1; i <= steps; i++) {
        const frac = i / steps;
        addTrailPoint(
          pointer.lx + (pointer.hx - pointer.lx) * frac,
          pointer.ly + (pointer.hy - pointer.ly) * frac,
          radius
        );
      }
      pointer.lx = pointer.hx;
      pointer.ly = pointer.hy;
    } else {
      pointer.speed *= 0.9;
    }
    pointer.was = pointer.active;

    let ballIdx = 0;
    const TRAIL_LIFETIME = 0.55;

    // Update trail balls
    for (let i = 0; i < TRAIL_COUNT; i++) {
      const pt = trail[i];
      pt.age += dt;
      const progress = Math.max(0, 1 - pt.age / TRAIL_LIFETIME);
      const r = pt.r0 * Math.pow(progress, 1.4);
      ballData[ballIdx * 3 + 0] = pt.x;
      ballData[ballIdx * 3 + 1] = pt.y;
      ballData[ballIdx * 3 + 2] = r > 0.001 ? r : 0;
      ballIdx++;
    }

    // Update splatters
    for (let i = splats.length - 1; i >= 0; i--) {
      const sp = splats[i];
      sp.age += dt;
      if (sp.age >= sp.life) {
        splats.splice(i, 1);
        continue;
      }
      const friction = Math.exp(-2.6 * dt);
      sp.vx *= friction;
      sp.vy *= friction;
      sp.x += sp.vx * dt;
      sp.y += sp.vy * dt;
    }

    for (let i = 0; i < SPLAT_COUNT; i++) {
      const sp = splats[i];
      if (sp) {
        const progress = Math.max(0, 1 - sp.age / sp.life);
        const r = sp.r0 * Math.pow(progress, 1.2);
        ballData[ballIdx * 3 + 0] = sp.x;
        ballData[ballIdx * 3 + 1] = sp.y;
        ballData[ballIdx * 3 + 2] = r > 0.001 ? r : 0;
      } else {
        ballData[ballIdx * 3 + 0] = 0;
        ballData[ballIdx * 3 + 1] = 0;
        ballData[ballIdx * 3 + 2] = 0;
      }
      ballIdx++;
    }

    gl.uniform3fv(uBallsLoc, ballData);
    gl.uniform1f(uTimeLoc, time / 1000);
    gl.uniform1f(uAspectLoc, aspect);

    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  requestAnimationFrame(animate);
})();
