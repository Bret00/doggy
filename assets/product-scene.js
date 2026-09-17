import * as T from "./three.module.min.js";
import { RoundedBoxGeometry } from "./rounded-box-geometry.js";
import { RoomEnvironment } from "./room-environment.js";

function markUnavailable(container) {
  container.classList.remove("scene-ready");
  const note = container.querySelector(".scene-unavailable");
  if (note) note.hidden = false;
}

function mountScene(container, mode) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let rotation = { current: 0 };

  const scene = new T.Scene();
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.setClearColor(0, 0);
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.5;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  const canvas = renderer.domElement;
  canvas.setAttribute("role", "img");
  canvas.setAttribute(
    "aria-label",
    mode === "hero"
      ? "3D illustration of the black dog backseat extender. Drag horizontally or use the left and right arrow keys to rotate. Press Home to reset."
      : "Scroll-controlled 3D illustration of the dog backseat extender"
  );
  if (mode === "hero") canvas.tabIndex = 0;
  container.appendChild(canvas);

  const camera = new T.PerspectiveCamera(32, 1, 0.1, 70);
  camera.position.set(6.8, 5.5, 8.3);
  camera.lookAt(0, 0.8, 0);

  const pmrem = new T.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, 0.04);
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.85;
  room.dispose();

  scene.add(new T.AmbientLight(0xffffff, 0.6));
  const key = new T.DirectionalLight(0xfff4e5, 5);
  key.position.set(2.5, 8, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -7;
  key.shadow.camera.right = 7;
  key.shadow.camera.top = 7;
  key.shadow.camera.bottom = -7;
  key.shadow.normalBias = 0.06;
  key.shadow.bias = -0.0003;
  key.shadow.radius = 4;
  scene.add(key);
  const fill = new T.DirectionalLight(0xe7edff, 2.5);
  fill.position.set(-5, 3, 2);
  scene.add(fill);
  const rim = new T.DirectionalLight(0xffc5a3, 3.6);
  rim.position.set(0, 4, -4);
  scene.add(rim);

  const textures = [];
  function makeTexture(size, draw) {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const context = c.getContext("2d");
    if (!context) throw new Error("Canvas unavailable");
    draw(context);
    const texture = new T.CanvasTexture(c);
    texture.wrapS = texture.wrapT = T.RepeatWrapping;
    textures.push(texture);
    return texture;
  }
  const grain = makeTexture(256, (ctx) => {
    ctx.fillStyle = "#7e7e7e";
    ctx.fillRect(0, 0, 256, 256);
    let seed = 53;
    for (let i = 0; i < 14000; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const x = seed % 256;
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const y = seed % 256;
      const v = 80 + (seed % 100);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.beginPath();
      ctx.ellipse(x, y, 0.5 + (seed % 8) / 5, 0.4 + (seed % 5) / 5, seed % 7, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  grain.repeat.set(5, 4);
  const woven = makeTexture(128, (ctx) => {
    ctx.fillStyle = "#333";
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = "#aaa";
    ctx.lineWidth = 1;
    for (let i = 0; i < 128; i += 4) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 128);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(128, i);
      ctx.stroke();
    }
  });
  woven.repeat.set(2, 12);
  const meshMap = makeTexture(128, (ctx) => {
    ctx.clearRect(0, 0, 128, 128);
    ctx.strokeStyle = "#252823";
    ctx.lineWidth = 2.5;
    for (let i = 0; i <= 128; i += 8) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 128);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(128, i);
      ctx.stroke();
    }
  });
  meshMap.repeat.set(4, 4);
  meshMap.colorSpace = T.SRGBColorSpace;

  const leather = new T.MeshStandardMaterial({ color: 0x282925, roughness: 0.64, metalness: 0.03, bumpMap: grain, bumpScale: 0.018 });
  const darkLeather = new T.MeshStandardMaterial({ color: 0x131714, roughness: 0.82, bumpMap: grain, bumpScale: 0.025 });
  const band = new T.MeshStandardMaterial({ color: 0x151915, roughness: 0.88, bumpMap: woven, bumpScale: 0.015 });
  const tan = new T.MeshStandardMaterial({ color: 0xc79472, roughness: 0.69, bumpMap: grain, bumpScale: 0.008 });
  const blackMetal = new T.MeshStandardMaterial({ color: 0x242924, roughness: 0.33, metalness: 0.65 });
  const thread = new T.MeshStandardMaterial({ color: 0x4b4d42, roughness: 0.85 });
  const silver = new T.MeshStandardMaterial({ color: 0x999c99, metalness: 0.95, roughness: 0.22 });
  const boardMaterial = new T.MeshStandardMaterial({ color: 0x8e7c63, roughness: 0.98 });
  const meshMaterial = new T.MeshStandardMaterial({ map: meshMap, transparent: true, alphaTest: 0.3, side: T.DoubleSide, roughness: 0.9, depthWrite: true });

  const model = new T.Group();
  scene.add(model);
  const upper = new T.Group();
  model.add(upper);
  const core = new T.Group();
  model.add(core);
  const lower = new T.Group();
  model.add(lower);

  function box(w, h, d, x, y, z, material, parent = upper, radius = 0.025) {
    const m = new T.Mesh(new RoundedBoxGeometry(w, h, d, 3, radius), material);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  function cord(points, material = thread, radius = 0.007, parent = upper) {
    const curve = new T.CatmullRomCurve3(points.map((p) => new T.Vector3(p[0], p[1], p[2])));
    const m = new T.Mesh(new T.TubeGeometry(curve, Math.max(8, points.length * 5), radius, 5, false), material);
    parent.add(m);
    return m;
  }

  for (let i = 0; i < 3; i++) {
    const x = (i - 1) * 1.6;
    box(1.58, 0.095, 2.68, x, 0, 0, leather);
    box(1.54, 0.095, 2.61, x, -0.11, 0, boardMaterial, core, 0.018);
    cord([[x - 0.71, 0.053, -1.24], [x + 0.71, 0.053, -1.24], [x + 0.71, 0.053, 1.24], [x - 0.71, 0.053, 1.24], [x - 0.71, 0.053, -1.24]], thread, 0.007);
  }
  box(4.86, 0.095, 2.8, 0, -0.23, 0, darkLeather, lower, 0.04);
  for (let i = 0; i < 3; i++) {
    const x = (i - 1) * 1.6;
    box(1.6, 1.76, 0.072, x, 0.85, -1.36, leather);
    cord([[x - 0.7, 0.06, -1.315], [x - 0.7, 1.66, -1.315], [x + 0.7, 1.66, -1.315], [x + 0.7, 0.06, -1.315]], thread, 0.006);
  }
  box(4.88, 0.065, 0.1, 0, 1.75, -1.36, band);
  for (const side of [-1, 1]) {
    box(0.075, 1.34, 2.74, side * 2.4, 0.65, 0, leather);
    box(0.1, 0.06, 2.79, side * 2.4, 1.34, 0, band);
    for (const z of [-0.88, 0.88]) {
      const strap = box(0.07, 0.6, 0.025, side * 2.44, 1.67, z, band);
      strap.rotation.z = -side * 0.13;
      box(0.15, 0.08, 0.04, side * 2.46, 1.9, z, silver);
    }
    cord([[side * 2.44, 1.92, -0.88], [side * 2.51, 2.47, -0.3], [side * 2.51, 2.59, 0.05], [side * 2.49, 2.26, 0.5], [side * 2.44, 1.92, 0.88]], band, 0.03);
  }
  box(1.65, 1.4, 0.065, -1.57, 0.67, 1.37, leather);
  box(1.65, 1.4, 0.065, 1.57, 0.67, 1.37, leather);
  const mesh = new T.Mesh(new T.PlaneGeometry(1.43, 1.29), meshMaterial);
  mesh.position.set(0, 0.67, 1.382);
  upper.add(mesh);
  box(4.86, 0.07, 0.095, 0, 1.4, 1.37, band);
  box(1.45, 0.065, 0.095, 0, 0.03, 1.37, band);
  for (const x of [-0.73, 0.73]) box(0.06, 1.42, 0.09, x, 0.68, 1.37, band);
  for (const x of [1.03, 1.93]) {
    box(0.72, 0.62, 0.135, x, 0.4, 1.455, leather, upper, 0.06);
    box(0.72, 0.045, 0.13, x, 0.7, 1.47, band);
    cord([[x - 0.31, 0.67, 1.53], [x - 0.31, 0.12, 1.53], [x + 0.31, 0.12, 1.53], [x + 0.31, 0.67, 1.53]], thread, 0.006);
  }
  for (const z of [-1.36, 1.37])
    for (const x of [-1.96, -1.16, 1.16, 1.96]) {
      const wallHeight = z < 0 ? 1.75 : 1.4;
      box(0.16, 0.34, 0.024, x, wallHeight - 0.13, z + (z > 0 ? 0.045 : 0.049), tan, upper, 0.07);
      cord([[x - 0.052, wallHeight - 0.22, z + 0.065], [x + 0.052, wallHeight - 0.06, z + 0.065], [x - 0.052, wallHeight - 0.06, z + 0.065], [x + 0.052, wallHeight - 0.22, z + 0.065]], thread, 0.003);
      box(0.065, 0.36, 0.04, x, wallHeight + 0.1, z, band);
    }
  for (const z of [-1.36, 1.37])
    for (const center of [-1.56, 1.56]) {
      const y = z < 0 ? 1.75 : 1.4;
      const path = new T.CatmullRomCurve3([
        new T.Vector3(center - 0.4, y + 0.17, z),
        new T.Vector3(center - 0.4, y + 0.68, z - 0.12),
        new T.Vector3(center - 0.3, y + 0.84, z - 0.21),
        new T.Vector3(center + 0.3, y + 0.84, z - 0.21),
        new T.Vector3(center + 0.4, y + 0.68, z - 0.12),
        new T.Vector3(center + 0.4, y + 0.17, z),
      ]);
      const shape = new T.Shape();
      shape.moveTo(-0.034, -0.008);
      shape.lineTo(0.034, -0.008);
      shape.lineTo(0.034, 0.008);
      shape.lineTo(-0.034, 0.008);
      shape.closePath();
      const strap = new T.Mesh(new T.ExtrudeGeometry(shape, { steps: 32, bevelEnabled: false, extrudePath: path }), band);
      strap.castShadow = true;
      upper.add(strap);
      box(0.14, 0.095, 0.075, center - 0.4, y + 0.42, z - 0.04, blackMetal);
    }
  for (const x of [-0.84, 0.84]) {
    box(0.13, 0.07, 0.15, x, 0.07, -1.1, blackMetal);
    box(0.071, 0.03, 0.065, x, 0.116, -1.09, new T.MeshStandardMaterial({ color: 0xbb402d, roughness: 0.7 }));
  }
  const shadow = new T.Mesh(new T.PlaneGeometry(35, 35), new T.ShadowMaterial({ opacity: 0.15 }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -0.38;
  shadow.receiveShadow = true;
  scene.add(shadow);

  let isVisible = true;
  let pointerDown = false;
  let lastX = 0;
  let targetY = mode === "hero" ? -0.48 : -0.4;
  let smoothY = targetY;
  let smoothX = 0;
  let smoothExplode = 0;

  const onDown = (e) => {
    if (mode !== "hero") return;
    pointerDown = true;
    lastX = e.clientX;
    canvas.setPointerCapture(e.pointerId);
  };
  const onMove = (e) => {
    if (!pointerDown) return;
    const dx = e.clientX - lastX;
    lastX = e.clientX;
    rotation.current += dx * 0.008;
  };
  const onUp = () => { pointerDown = false; };
  const onKey = (e) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); rotation.current += e.key === "ArrowLeft" ? -0.2 : 0.2; }
    if (e.key === "Home") { e.preventDefault(); rotation.current = 0; }
  };
  const onLost = (e) => { e.preventDefault(); markUnavailable(container); };
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);
  canvas.addEventListener("keydown", onKey);
  canvas.addEventListener("webglcontextlost", onLost);

  const resize = () => {
    const { width, height } = container.getBoundingClientRect();
    if (width <= 0 || height <= 0) return;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.fov = width / height < 0.8 ? 40 : 32;
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();

  const visibility = new IntersectionObserver((entries) => { isVisible = entries[0].isIntersecting; }, { rootMargin: "150px" });
  visibility.observe(container);

  const story = document.querySelector(".design-story");
  const hero = container.closest(".hero");
  let animation = 0;
  let lastFrame = 0;
  const clamp = (x) => Math.max(0, Math.min(1, x));
  const smoothstep = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };

  function draw(time) {
    animation = requestAnimationFrame(draw);
    if (!isVisible || document.hidden || time - lastFrame < 28) return;
    lastFrame = time;
    let progress = 0, explode = 0, tilt = 0;
    if (mode === "story" && story) {
      const r = story.getBoundingClientRect();
      progress = clamp(-r.top / (story.offsetHeight - innerHeight));
      targetY = -0.48 + smoothstep(progress / 0.28) * 1.0 + smoothstep((progress - 0.48) / 0.28) * 1.7 + smoothstep((progress - 0.77) / 0.23) * 3.25;
      explode = smoothstep((progress - 0.23) / 0.1) * (1 - smoothstep((progress - 0.45) / 0.12));
      tilt = explode * 0.15;
    } else if (hero) {
      const r = hero.getBoundingClientRect();
      progress = clamp(-r.top / r.height);
      targetY = -0.48 + progress * 0.9;
      tilt = progress * 0.08;
    }
    const speed = reduced.matches ? 1 : 0.07;
    smoothY += (targetY + rotation.current - smoothY) * speed;
    smoothX += (tilt - smoothX) * speed;
    smoothExplode += (explode - smoothExplode) * speed;
    model.rotation.set(smoothX, smoothY, mode === "hero" ? -0.055 : 0);
    model.position.y = (reduced.matches ? 0 : Math.sin(time * 0.00065) * 0.035) + (mode === "hero" ? -0.18 : 0);
    upper.position.y = smoothExplode * 0.7;
    core.position.y = -smoothExplode * 0.05;
    lower.position.y = -smoothExplode * 0.78;
    shadow.position.y = -0.39 - smoothExplode * 0.85;
    const scale = mode === "story" ? 1 - smoothExplode * 0.08 : 1;
    model.scale.setScalar(scale);
    renderer.render(scene, camera);
  }
  renderer.render(scene, camera);
  container.classList.add("scene-ready");
  animation = requestAnimationFrame(draw);

  const resetButton = mode === "hero" ? document.querySelector("[data-scene-reset]") : null;
  const onReset = () => { rotation.current = 0; };
  if (resetButton) resetButton.addEventListener("click", onReset);

  return function cleanup() {
    cancelAnimationFrame(animation);
    observer.disconnect();
    visibility.disconnect();
    canvas.removeEventListener("pointerdown", onDown);
    canvas.removeEventListener("pointermove", onMove);
    canvas.removeEventListener("pointerup", onUp);
    canvas.removeEventListener("pointercancel", onUp);
    canvas.removeEventListener("keydown", onKey);
    canvas.removeEventListener("webglcontextlost", onLost);
    if (resetButton) resetButton.removeEventListener("click", onReset);
    scene.traverse((obj) => {
      if (obj.isMesh) {
        obj.geometry.dispose();
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((m) => m.dispose());
      }
    });
    textures.forEach((t) => t.dispose());
    environment.dispose();
    pmrem.dispose();
    renderer.dispose();
    canvas.remove();
  };
}

document.querySelectorAll("[data-product-scene]").forEach((container) => {
  try {
    mountScene(container, container.getAttribute("data-mode") || "hero");
  } catch (err) {
    markUnavailable(container);
  }
});
