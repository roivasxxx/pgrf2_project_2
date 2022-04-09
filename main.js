import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.121.1/examples/jsm/controls/OrbitControls.js";
let controls;
const raycaster = new THREE.Raycaster();
raycaster.params.Line.threshold = 0.001;
const pointer = new THREE.Vector2();
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, 600 / 600, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
controls = new OrbitControls(camera, renderer.domElement);
renderer.setClearColor("#000000");

const geomDim = 19;

const geometry = new THREE.PlaneGeometry(5, 5, geomDim, geomDim); //geomDims

const material = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  side: THREE.DoubleSide,
  wireframe: true,
});
const plane = new THREE.Mesh(geometry, material);
const vertices = plane.geometry.attributes.position.array;
const arrHelper = vertices.length / (geomDim + 1);
console.log(vertices, vertices.length, geomDim, arrHelper, "HELPER<<<<");
let previous;
let current;

renderer.setSize(600, 600);
document.body.appendChild(renderer.domElement);

//gets z values from vertices 1d array
//transforms to 2d array of z values
const verticesTo2DArray = (vertices) => {
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
};

let dampening = 0.95;

//rippling effect
const ripple = () => {
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
  plane.geometry.attributes.position.needsUpdate = true;
  renderer.render(scene, camera);
  setTimeout(() => window.requestAnimationFrame(ripple), 50);
  //window.requestAnimationFrame(ripple);
};

console.log(verticesTo2DArray(vertices));

scene.add(plane);
plane.rotation.x = -Math.PI / 3;
plane.rotation.y = -Math.PI / 30;
camera.position.z = 10;
renderer.render(scene, camera);

const threeVerticesToXYZ = (vertices) => {
  const temp = [];
  for (let i = 0; i < vertices.length; i += 3) {
    temp.push({ x: vertices[i], y: vertices[i + 1], z: vertices[i + 2] });
  }
  return temp;
};

function onPointerMove(event) {
  pointer.x = (event.clientX / 600) * 2 - 1;
  pointer.y = -(event.clientY / 600) * 2 + 1;
}

function onClick(event) {
  raycaster.setFromCamera(pointer, camera);
  const intersects = raycaster.intersectObject(plane);
  if (intersects) {
    console.log(intersects);
    console.log(plane.worldToLocal(intersects[0].point));
  }
}

//renderer.setSize(window.innerWidth, window.innerHeight);

// console.log(threeVerticesToXYZ(vertices));
console.log(vertices);
console.log(geometry.attributes);

// function render() {
//   renderer.render(scene, camera);

//   window.requestAnimationFrame(render);
// }
function keyDown(event) {
  if (event.key === "r") {
    console.log("????");
    previous[2][2] = -5;
  }
}
window.addEventListener("pointermove", onPointerMove);
window.addEventListener("click", onClick);
window.addEventListener("keydown", keyDown);

window.onload = () => {
  current = verticesTo2DArray(vertices);
  previous = verticesTo2DArray(vertices);
  ripple();
};
