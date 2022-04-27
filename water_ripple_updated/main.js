import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.121.1/examples/jsm/controls/OrbitControls.js";
import { GUI } from "https://cdn.jsdelivr.net/npm/three@0.121.1/examples/jsm/libs/dat.gui.module.js";

let renderer, scene, camera, controls;
let SHADOW_MAP_RES = 1024;
var WATER_SIZE = 10;
var res = 80;
var dampening = 0.92;
var DISTURB_AMOUNT = 0.5;
const materials = [];
let waterMesh, groundPlaneMesh;
let waterMeshEdgeIndices = [];
let field1 = [];
let field2 = [];
let sourceField = [];
let velocityField = [];
let container;

const guiPickableAlgos = [
  "Algoritmus dle Hugo Elias",
  "Algoritmus dle Muller GDC2008",
];

const algoFunctions = {
  "Algoritmus dle Hugo Elias": rippleHugo,
  "Algoritmus dle Muller GDC2008": rippleMuller,
};

let pickedAlgo = {
  id: "Algoritmus dle Hugo Elias",
  fun: algoFunctions["Algoritmus dle Hugo Elias"],
};

function setupThreejsScene() {
  console.info("Scene setup");
  //create renderer
  renderer = new THREE.WebGLRenderer({
    antialias: true,
  });

  renderer.setSize(window.innerWidth, window.innerHeight - 5);
  renderer.setClearColor("#000000");
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.type = true;

  container = document.createElement("div");
  document.body.appendChild(container);
  container.appendChild(renderer.domElement);
  //create scene
  scene = new THREE.Scene();

  //create camera
  camera = new THREE.PerspectiveCamera(
    25,
    renderer.domElement.width / renderer.domElement.height,
    0.1,
    1000
  );
  camera.position.set(8, 8, 15);
  camera.lookAt(new THREE.Vector3(0, 0, 0));

  //create controls for camera
  controls = new OrbitControls(camera, renderer.domElement);
  controls.userPanSpeed = 0.2;
  //controls.autoRotate = true;
  controls.modifierKey = "alt";

  //setup lights111111
  scene.add(new THREE.AmbientLight(0x111111));
  //0xffff44
  const keyLight = new THREE.SpotLight(0xffff6b, 0.6);
  keyLight.position.set(5, 15, -15);
  keyLight.target.position.set(0, 0, 0);
  keyLight.castShadow = true;
  keyLight.shadow.camera.near = 10;
  keyLight.shadow.camera.far = 30;
  keyLight.shadow.camera.fov = 30;
  //keyLight.shadowCameraVisible = true;
  keyLight.shadow.bias = 0.00001;

  keyLight.shadow.mapSize.width = SHADOW_MAP_RES;
  keyLight.shadow.mapSize.height = SHADOW_MAP_RES;
  scene.add(keyLight);

  const fillLight = new THREE.SpotLight(0xff0044, 0.4);
  fillLight.position.set(5, 2, 15);
  fillLight.target.position.set(0, 0, 0);
  scene.add(fillLight);

  //create plane for intersection test
  var groundPlaneGeom = new THREE.PlaneGeometry(WATER_SIZE, WATER_SIZE, 1, 1);
  groundPlaneGeom.applyMatrix4(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
  var groundPlaneMaterial = new THREE.MeshPhongMaterial();
  materials.push(groundPlaneMaterial);
  groundPlaneMesh = new THREE.Mesh(groundPlaneGeom, groundPlaneMaterial);
  groundPlaneMesh.castShadow = false;
  groundPlaneMesh.receiveShadow = false;
  groundPlaneMesh.visible = false;
  scene.add(groundPlaneMesh);
}

function setupWaterScene() {
  //create a height-field water sim from the plane
  var waterGeom = new THREE.PlaneGeometry(
    WATER_SIZE,
    WATER_SIZE,
    res - 1,
    res - 1
  );
  waterGeom.applyMatrix4(new THREE.Matrix4().makeRotationX(-Math.PI / 2));

  const material = new THREE.MeshPhongMaterial({
    color: 0x0091e6,
    emissive: 0x95c4d0,
    specular: 0xe2d4d4,
    shininess: 30,
    wireframe: false,
  });

  materials.push(material);
  waterMesh = new THREE.Mesh(waterGeom, material);
  waterMesh.castShadow = true;
  waterMesh.receiveShadow = true;
  scene.add(waterMesh);
}

function setupGui() {
  const gui = new GUI({ width: 300 });
  console.log(pickedAlgo);

  const effectController = {
    // mouseDisplacement: 25,
    // viscosity: 0.98,
    dampening,
    algoritmus: guiPickableAlgos[0],
    wireframe: false,
  };

  const algoChanger = (change) => {
    effectController.algoritmus = change;
    pickedAlgo = !change
      ? {
          id: "Algoritmus dle Hugo Elias",
          fun: algoFunctions["Algoritmus dle Hugo Elias"],
        }
      : { id: change, fun: algoFunctions[change] };
    console.log(change);
    resetGeometry();
  };

  const dampeningChanger = () => {
    dampening = effectController.dampening;
  };

  const wireframeChanger = () => {
    waterMesh.material.wireframe = effectController.wireframe;
  };

  gui
    .add(effectController, "algoritmus", guiPickableAlgos)
    .onChange(algoChanger);
  gui
    .add(effectController, "dampening", 0.6, 0.9999, 0.01)
    .onChange(dampeningChanger);
  gui.add(effectController, "wireframe").onChange(wireframeChanger);

  dampeningChanger();
  algoChanger();
}
function window_onResize(event) {
  //update camera projection
  camera.aspect = window.innerWidth / (window.innerHeight - 5);
  camera.updateProjectionMatrix();

  //update renderer size
  renderer.setSize(window.innerWidth, window.innerHeight - 5);
}
var isDisturbing = false;
function window_onMouseDown(event) {
  let intersectPoint = new THREE.Vector3();
  intersectPoint = detectIntersection(event);
  if (intersectPoint) {
    isDisturbing = true;
    const vertexId = calcVertexId(intersectPoint.x, intersectPoint.z);
    disturb(vertexId, DISTURB_AMOUNT);
  }
}

function setMouseCoords(x, y) {
  mouseCoords.set(
    (x / renderer.domElement.clientWidth) * 2 - 1,
    -(y / renderer.domElement.clientHeight) * 2 + 1
  );
}

function window_onMouseMove(event) {
  if (!event.isPrimary) return;

  setMouseCoords(event.clientX, event.clientY);
}

var mousePosNorm = new THREE.Vector2();

function detectIntersection(event) {
  let projector = new THREE.Vector3();
  let raycaster = new THREE.Raycaster();

  projector.set(
    (event.clientX / window.innerWidth) * 2 - 1,
    -(event.clientY / window.innerHeight) * 2 + 1,
    0.5
  ); // z = 0.5 important!

  projector.unproject(camera);

  raycaster.set(camera.position, projector.sub(camera.position).normalize());
  let intersectInfo = raycaster.intersectObject(groundPlaneMesh);

  //get intersection point and vertexId
  if (intersectInfo && intersectInfo[0]) {
    return intersectInfo[0].point;
  }
}

function calcVertexId(x, z) {
  //calculate vertex id using x and z
  var half = WATER_SIZE / 2.0;
  var row = Math.floor(((z + half) / WATER_SIZE) * res);
  var col = Math.floor(((x + half) / WATER_SIZE) * res);
  return row * res + col;
}

window.onload = () => {
  setupThreejsScene();
  setupWaterScene();
  initArrays();
  setupGui();
  container.addEventListener("mousemove", window_onMouseDown, false);
  container.addEventListener("click", window_onMouseDown, false);

  for (let i = 0; i < res; i++) {
    waterMeshEdgeIndices.push(i);
  }
  for (let i = res; i < res * res - res; i += res) {
    waterMeshEdgeIndices.push(i);
    waterMeshEdgeIndices.push(i - 1);
  }

  for (let i = res * res - res - 1; i < res * res; i++) {
    waterMeshEdgeIndices.push(i);
  }

  animate();
};

function update() {
  waterMesh.geometry.verticesNeedUpdate = true;
  waterMesh.geometry.computeFaceNormals(); //must call this first before computeVertexNormals()
  waterMesh.geometry.computeVertexNormals();
  waterMesh.geometry.normalsNeedUpdate = true;
}

function initArrays() {
  for (let i = 0; i < res * res; i++) {
    field1[i] = 0;
    field2[i] = 0;
    sourceField[i] = 0;
    velocityField[i] = 0;
  }
}

function rippleHugo() {
  let idx;
  var v = waterMesh.geometry.vertices;
  var resMinusOne = res - 1;

  for (let i = 1; i < resMinusOne; i++) {
    for (let j = 1; j < resMinusOne; j++) {
      idx = i * res + j;
      field2[idx] =
        (field1[(i - 1) * res + j] +
          field1[(i + 1) * res + j] +
          field1[i * res + (j - 1)] +
          field1[i * res + (j + 1)]) /
          2.0 -
        field2[idx];
      field2[idx] *= dampening;
    }
  }

  //update vertex heights
  for (let i = 1; i < resMinusOne; i++) {
    for (let j = 1; j < resMinusOne; j++) {
      idx = i * res + j;
      v[idx].y = field2[idx];
    }
  }

  update();

  //swap buffers
  let temp;
  for (let i = 1; i < resMinusOne; i++) {
    for (let j = 1; j < resMinusOne; j++) {
      idx = i * res + j;
      temp = field2[idx];
      field2[idx] = field1[idx];
      field1[idx] = temp;
    }
  }
}

function rippleMuller() {
  let idx;
  var v = waterMesh.geometry.vertices;
  var resMinusOne = res - 1;

  //propagate
  for (let i = 1; i < resMinusOne; i++) {
    for (let j = 1; j < resMinusOne; j++) {
      idx = i * res + j;
      velocityField[idx] +=
        (v[(i - 1) * res + j].y +
          v[(i + 1) * res + j].y +
          v[i * res + (j - 1)].y +
          v[i * res + (j + 1)].y) /
          4.0 -
        v[idx].y;
      velocityField[idx] *= dampening;
    }
  }
  //update vertex heights
  for (let i = 1; i < resMinusOne; i++) {
    for (let j = 1; j < resMinusOne; j++) {
      idx = i * res + j;
      v[idx].y += velocityField[idx];
    }
  }

  //update mesh
  update();
}

function resetGeometry() {
  const v = waterMesh.geometry.vertices;
  for (let i = 0; i < res * res; i++) {
    v[i].y = 0;
  }
}

function disturb(idx, amount) {
  pickedAlgo.id === "Algoritmus dle Hugo Elias"
    ? !waterMeshEdgeIndices.includes(idx) && (field1[idx] = amount)
    : (velocityField[idx] = amount);
}

function animate() {
  pickedAlgo.fun();
  renderer.render(scene, camera);

  requestAnimationFrame(animate);
}
