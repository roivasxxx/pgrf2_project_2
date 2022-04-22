import { GUI } from "https://cdn.jsdelivr.net/npm/three@0.121.1/examples/jsm/libs/dat.gui.module.js";

let camera, scene, renderer;
let waterMesh;
let meshRay;
let mouseMoved = false;
const mouseCoords = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
const WIDTH = 128;

// Water size in system units
const BOUNDS = 512;
const BOUNDS_HALF = BOUNDS * 0.5;
init();
animate();
function init() {
  const container = document.createElement("div");
  document.body.appendChild(container);

  renderer = new THREE.WebGLRenderer();
  renderer.setClearColor("#000000");
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    1,
    3000
  );
  camera.position.set(0, 200, 350);
  camera.lookAt(0, 0, 0);

  const light1 = new THREE.DirectionalLight(0xffffff, 1.0);
  light1.position.set(300, 400, 175);
  scene.add(light1);

  const light2 = new THREE.DirectionalLight(0x40a040, 0.6);
  light2.position.set(-100, 350, -200);
  scene.add(light2);

  container.appendChild(renderer.domElement);
  container.addEventListener("pointermove", onPointerMove);
  container.addEventListener("click", () => console.log("Clicked"));
  window.addEventListener("resize", onWindowResize);

  const gui = new GUI();

  const effectController = {
    mouseSize: 20.0,
    viscosity: 0.98,
  };

  const valuesChanger = function () {};

  gui
    .add(effectController, "mouseSize", 1.0, 100.0, 1.0)
    .onChange(valuesChanger);
  gui
    .add(effectController, "viscosity", 0.9, 0.999, 0.001)
    .onChange(valuesChanger);

  valuesChanger();
  initWater();
}

function initWater() {
  const materialColor = 0x0040c0;

  const geometry = new THREE.PlaneGeometry(
    BOUNDS,
    BOUNDS,
    WIDTH - 1,
    WIDTH - 1
  );

  // material: make a THREE.ShaderMaterial clone of THREE.MeshPhongMaterial, with customized vertex shader
  const material = new THREE.MeshPhongMaterial({
    color: materialColor,
  });
  material.lights = true;
  material.color = new THREE.Color(materialColor);
  material.specular = new THREE.Color(0x111111);
  material.shininess = 50;

  waterMesh = new THREE.Mesh(geometry, material);
  waterMesh.rotation.x = -Math.PI / 2;
  waterMesh.matrixAutoUpdate = false;
  waterMesh.updateMatrix();

  scene.add(waterMesh);

  const geometryRay = new THREE.PlaneGeometry(BOUNDS, BOUNDS, 1, 1);
  meshRay = new THREE.Mesh(
    geometryRay,
    new THREE.MeshBasicMaterial({ color: 0xffffff, visible: false })
  );
  meshRay.rotation.x = -Math.PI / 2;
  meshRay.matrixAutoUpdate = false;
  meshRay.updateMatrix();
  scene.add(meshRay);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
}

function setMouseCoords(x, y) {
  mouseCoords.set(
    (x / renderer.domElement.clientWidth) * 2 - 1,
    -(y / renderer.domElement.clientHeight) * 2 + 1
  );
  mouseMoved = true;
}

function onPointerMove(event) {
  if (event.isPrimary === false) return;

  setMouseCoords(event.clientX, event.clientY);
}

function animate() {
  requestAnimationFrame(animate);

  render();
}

function render() {
  if (mouseMoved) {
    raycaster.setFromCamera(mouseCoords, camera);

    const intersects = raycaster.intersectObject(meshRay);

    if (intersects.length > 0) {
      const point = intersects[0].point;
      //uniforms[ 'mousePos' ].value.set( point.x, point.z );
    } else {
      //uniforms[ 'mousePos' ].value.set( 10000, 10000 );
    }

    mouseMoved = false;
  } else {
    //uniforms[ 'mousePos' ].value.set( 10000, 10000 );
  }

  // Do the gpu computation
  //gpuCompute.compute();

  // Get compute output in custom uniform
  //waterUniforms[ 'heightmap' ].value = gpuCompute.getCurrentRenderTarget( heightmapVariable ).texture;

  // Render
  renderer.render(scene, camera);
}
