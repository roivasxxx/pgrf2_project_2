import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.121.1/examples/jsm/controls/OrbitControls.js";
import { GUI } from "https://cdn.jsdelivr.net/npm/three@0.121.1/examples/jsm/libs/dat.gui.module.js";

let renderer, scene, camera, controls;
let SHADOW_MAP_RES = 1024;
let WATER_SIZE = 10;
let res = 80;
let dampening = 0.92;
let disturbAmount = -0.5;
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

/**
 * funkce pro vytvoření scény
 */
function setupThreejsScene() {
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

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(
    25,
    renderer.domElement.width / renderer.domElement.height,
    0.1,
    1000
  );
  camera.position.set(8, 8, 15);
  camera.lookAt(new THREE.Vector3(0, 0, 0));

  controls = new OrbitControls(camera, renderer.domElement);
  controls.userPanSpeed = 0.2;
  controls.modifierKey = "alt";

  scene.add(new THREE.AmbientLight(0x111111, 0.2));

  const keyLight = new THREE.SpotLight(0xffff44, 0.5);
  keyLight.position.set(5, 15, -15);
  keyLight.target.position.set(0, 0, 0);
  keyLight.castShadow = true;
  keyLight.shadow.camera.near = 10;
  keyLight.shadow.camera.far = 30;
  keyLight.shadow.camera.fov = 30;
  keyLight.shadow.bias = 0.00001;

  keyLight.shadow.mapSize.width = SHADOW_MAP_RES;
  keyLight.shadow.mapSize.height = SHADOW_MAP_RES;
  scene.add(keyLight);

  const fillLight = new THREE.SpotLight(0xff0044, 0.4);
  fillLight.position.set(5, 2, 15);
  fillLight.target.position.set(0, 0, 0);
  scene.add(fillLight);

  let groundPlaneGeom = new THREE.PlaneGeometry(WATER_SIZE, WATER_SIZE, 1, 1);
  groundPlaneGeom.applyMatrix4(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
  let groundPlaneMaterial = new THREE.MeshPhongMaterial();
  materials.push(groundPlaneMaterial);
  groundPlaneMesh = new THREE.Mesh(groundPlaneGeom, groundPlaneMaterial);
  groundPlaneMesh.castShadow = false;
  groundPlaneMesh.receiveShadow = false;
  groundPlaneMesh.visible = false;
  scene.add(groundPlaneMesh);
}

/**
 * vytvoření waterMesh
 */
function setupWaterScene() {
  let waterGeom = new THREE.PlaneGeometry(
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

/**
 * funkce pro nastavení lil-gui https://www.npmjs.com/package/lil-gui
 */
function setupGui() {
  const gui = new GUI({ width: 300 });
  console.log(pickedAlgo);

  const effectController = {
    dampening,
    algoritmus: guiPickableAlgos[0],
    wireframe: false,
    "disturb amount": -disturbAmount,
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

  const disturbAmountChanger = () => {
    disturbAmount = -effectController["disturb amount"];
  };

  gui
    .add(effectController, "algoritmus", guiPickableAlgos)
    .onChange(algoChanger);
  gui
    .add(effectController, "dampening", 0.6, 0.9999, 0.01)
    .onChange(dampeningChanger);
  gui.add(effectController, "wireframe").onChange(wireframeChanger);
  gui
    .add(effectController, "disturb amount", 0.1, 2, 0.1)
    .onChange(disturbAmountChanger);

  dampeningChanger();
  algoChanger();
}

/**
 * funkce pohybu myši
 * @param {Event} event - html mouseEvent
 */
function onMouseMove(event) {
  let intersectPoint = new THREE.Vector3();
  intersectPoint = detectIntersection(event);
  if (intersectPoint) {
    const vertexId = calcVertexId(intersectPoint.x, intersectPoint.z);
    disturb(vertexId, disturbAmount);
  }
}

/**
 * resize okna
 */
function onResize() {
  camera.aspect = window.innerWidth / (window.innerHeight - 5);
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight - 5);
}

/**
 * stisknutí klávesy pro resetování vertexů waterMeshe
 * @param {Event} event - html event
 */
function onKeyDown(event) {
  if (event.code === "KeyR") resetGeometry();
}

/**
 *
 * @param {Event} event - html event, v tomto případě mouseMove
 * @returns bod intersekce pomocné meshe a myši
 */
function detectIntersection(event) {
  let projector = new THREE.Vector3();
  let raycaster = new THREE.Raycaster();

  projector.set(
    (event.clientX / window.innerWidth) * 2 - 1,
    -(event.clientY / window.innerHeight) * 2 + 1,
    0.5
  );

  projector.unproject(camera);

  raycaster.set(camera.position, projector.sub(camera.position).normalize());
  let intersectInfo = raycaster.intersectObject(groundPlaneMesh);

  //get intersection point and vertexId
  if (intersectInfo && intersectInfo[0]) {
    return intersectInfo[0].point;
  }
}

/**
 *
 * @param {Number} x - X-ová souřadnice
 * @param {Number} z -  Z-ová souřadnice
 * @returns index vertexu ve waterMesh
 */
function calcVertexId(x, z) {
  let half = WATER_SIZE / 2.0;
  let row = Math.floor(((z + half) / WATER_SIZE) * res);
  let col = Math.floor(((x + half) / WATER_SIZE) * res);
  return row * res + col;
}

/**
 * inicializace listenerů a scény
 */
window.onload = () => {
  setupThreejsScene();
  setupWaterScene();
  initArrays();
  setupGui();
  container.addEventListener("mousemove", onMouseMove, false);
  window.addEventListener("resize", onResize);
  window.addEventListener("keydown", onKeyDown);

  /*naplnění indexů vertexů, které jsou na kraji arraye
    nutno udělat, aby se krajní vertexy nezasekly, jelikož nejsou updatovány
  */
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

/**
 * funkce pro inicializaci arrayů
 */
function initArrays() {
  for (let i = 0; i < res * res; i++) {
    field1[i] = 0;
    field2[i] = 0;
    sourceField[i] = 0;
    velocityField[i] = 0;
  }
}

/**
 * funkce naimplementována dle https://web.archive.org/web/20160116150939/http://freespace.virgin.net/hugo.elias/graphics/x_water.htm
 */
function rippleHugo() {
  let idx;
  let v = waterMesh.geometry.vertices;
  let resMinusOne = res - 1;

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

  for (let i = 1; i < resMinusOne; i++) {
    for (let j = 1; j < resMinusOne; j++) {
      idx = i * res + j;
      v[idx].y = field2[idx];
    }
  }

  update();

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

/**
 * funkce naimplementována dle https://archive.org/stream/GDC2008Fischer/GDC2008-Fischer_djvu.txt
 */
function rippleMuller() {
  let idx;
  let v = waterMesh.geometry.vertices;
  let resMinusOne = res - 1;

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

/**
 * funkce pro reset Y-nových souřadnic waterMeshe
 */
function resetGeometry() {
  const v = waterMesh.geometry.vertices;
  for (let i = 0; i < res * res; i++) {
    v[i].y = 0;
  }
}

/**
 *
 * @param {Number} idx - index vertexu
 * @param {Number} amount - hodnota pro disturbování vertexu
 */
function disturb(idx, amount) {
  pickedAlgo.id === "Algoritmus dle Hugo Elias"
    ? !waterMeshEdgeIndices.includes(idx) && (field1[idx] = amount)
    : (velocityField[idx] = amount);
}

/**
 * funkce, která využívá https://developer.mozilla.org/en-US/docs/Web/API/window/requestAnimationFrame
 * pro přerenderování canvasu
 */
function animate() {
  pickedAlgo.fun();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
