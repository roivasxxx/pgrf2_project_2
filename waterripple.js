import { GUI } from "https://cdn.jsdelivr.net/npm/three@0.121.1/examples/jsm/libs/dat.gui.module.js";

let camera, scene, renderer;
let waterMesh;
let meshRay;
let mouseMoved = false;
const mouseCoords = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
const WIDTH = 128;
const geomDim = WIDTH - 1;
// Water size in system units
const BOUNDS = 512;
const BOUNDS_HALF = BOUNDS * 0.5;
let current, previous, vertices;
let edgeVertices;
let arrHelper;
let dampening = 0.95;

let mouseDisplacement = -25;

let clicked = false;
const arrowHelper = new THREE.ArrowHelper(
  new THREE.Vector3(),
  new THREE.Vector3(),
  25,
  0xffff00
);

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

  scene.add(arrowHelper);

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
  container.addEventListener("click", () => {
    clicked = true;
  });
  window.addEventListener("resize", onWindowResize);

  const gui = new GUI();

  const effectController = {
    mouseDisplacement: 25,
    viscosity: 0.98,
  };

  const valuesChanger = function () {
    mouseDisplacement = -effectController.mouseDisplacement;
  };

  gui
    .add(effectController, "mouseDisplacement", 25, 100, 5)
    .onChange(valuesChanger);
  gui
    .add(effectController, "viscosity", 0.9, 0.999, 0.001)
    .onChange(valuesChanger);

  valuesChanger();
  initWater();
}

function initWater() {
  const materialColor = 0x0040c0;

  const geometry = new THREE.PlaneGeometry(BOUNDS, BOUNDS, geomDim, geomDim);

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

  vertices = waterMesh.geometry.attributes.position.array;
  arrHelper = vertices.length / (geomDim + 1);
  current = verticesTo2DArray(vertices);
  previous = verticesTo2DArray(vertices);
  edgeVertices = getEdgeVertices(previous);
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
  ripple();
  if (clicked) {
    raycaster.setFromCamera(mouseCoords, camera);

    const intersects = raycaster.intersectObject(waterMesh);

    if (intersects.length > 0) {
      console.log(intersects[0]);
      arrowHelper.position.copy(intersects[0].point);
      //previous[Math.floor(point.x)][Math.floor(point.z)] = -25;
      const intersectedVertices = [
        intersects[0].face.a,
        intersects[0].face.b,
        intersects[0].face.c,
      ];
      for (let i = 0; i < intersectedVertices.length; i++) {
        const vert = intersectedVertices[i];
        if (!edgeVertices.includes(vert)) {
          const vertCoords = get2DVertex(vert);
          previous[vertCoords.i][vertCoords.j] = mouseDisplacement;
          break;
        }
      }

      //uniforms[ 'mousePos' ].value.set( point.x, point.z );
    } else {
      //uniforms[ 'mousePos' ].value.set( 10000, 10000 );
    }
    clicked = false;
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

function verticesTo2DArray(vertices) {
  const arr1 = [];
  for (let i = 0; i < geomDim + 1; i++) {
    //50 geomDims+1
    const arr2 = [];
    for (let j = 2; j < arrHelper; j += 3) {
      //j< vertices.length/geomDims+1

      arr2.push(vertices[j + i * arrHelper]); //j< vertices.length/geomDims+1
    }
    arr1.push(arr2);
  }
  return arr1;
}
//rippling effect
function ripple() {
  for (let i = 1; i < geomDim; i++) {
    //geomDim
    for (let j = 1; j < geomDim; j++) {
      //geomDim
      current[i][j] =
        (previous[i - 1][j] +
          previous[i + 1][j] +
          previous[i][j - 1] +
          previous[i][j + 1]) /
          2 -
        current[i][j];
      current[i][j] *= dampening;
      vertices[2 + j * 3 + i * arrHelper] = current[i][j]; ////j< vertices.length/geomDims+1
    }
  }
  //console.log("HERE: ", plane.geometry.attributes.position);
  const temp = previous;
  previous = current;
  current = temp;
  waterMesh.geometry.attributes.position.needsUpdate = true;
  waterMesh.geometry.computeVertexNormals();
}

//TODO - PRVNI RADEK+SLOUPEC, POSLEDNI RADEK+ SLOUPEC
function getEdgeVertices(vertices2D) {
  const edgeVertices = [];
  let k = 0;
  //first row
  for (let i = 0; i < vertices2D.length; i++) {
    edgeVertices.push(k);
    k++;
  }
  //first - last column
  for (let i = 1; i < vertices2D.length - 1; i++) {
    edgeVertices.push(k);
    edgeVertices.push(k + vertices2D[i].length - 1);
    k += vertices2D[i].length;
  }
  //last row
  for (let i = 0; i < vertices2D.length; i++) {
    edgeVertices.push(k);
    k++;
  }
  return edgeVertices;
}

function get2DVertex(index) {
  let k = 0;
  for (let i = 0; i < previous.length; i++) {
    for (let j = 0; j < previous[i].length; j++) {
      if (k === index) return { i, j };
      k++;
    }
  }
}
