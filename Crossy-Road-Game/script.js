const counterDOM = document.getElementById("counter");
const coinCounterDOM = document.getElementById("coinCounter");
const endDOM = document.getElementById("end");

const scene = new THREE.Scene();

const distance = 500;
const camera = new THREE.OrthographicCamera(
    window.innerWidth / -2,
    window.innerWidth / 2,
    window.innerHeight / 2,
    window.innerHeight / -2,
    0.1,
    10000
);

camera.rotation.x = (50 * Math.PI) / 180;
camera.rotation.y = (20 * Math.PI) / 180;
camera.rotation.z = (10 * Math.PI) / 180;

const initialCameraPositionY = -Math.tan(camera.rotation.x) * distance;
const initialCameraPositionX =
    Math.tan(camera.rotation.y) *
    Math.sqrt(distance ** 2 + initialCameraPositionY ** 2);
camera.position.y = initialCameraPositionY;
camera.position.x = initialCameraPositionX;
camera.position.z = distance;

const zoom = 2;
const chickenSize = 15;
const positionWidth = 42;
const columns = 17;
const boardWidth = positionWidth * columns;
const stepTime = 200;

let lanes;
let currentLane;
let currentColumn;
let coinsCollected = 0;

let previousTimestamp;
let startMoving;
let moves;
let stepStartTimestamp;

// ---------- Soft coin sound ----------
let audioCtx;
function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}
function playCoinSound() {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.15);
}

// ---------- Coin object ----------
function createCoin() {
    const geometry = new THREE.CylinderGeometry(4 * zoom, 4 * zoom, 1 * zoom, 16);
    const material = new THREE.MeshPhongMaterial({ color: 0xffd700, flatShading: true });
    const coin = new THREE.Mesh(geometry, material);
    coin.castShadow = true;
    coin.receiveShadow = true;
    coin.rotation.x = Math.PI / 2;
    return coin;
}

// ---------- Resize handler ----------
function onResize() {
    camera.left = window.innerWidth / -2;
    camera.right = window.innerWidth / 2;
    camera.top = window.innerHeight / 2;
    camera.bottom = window.innerHeight / -2;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onResize);

// ---------- Touch / swipe controls ----------
let touchStartX = 0, touchStartY = 0;
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    initAudio();
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    if (touchStartX === 0 && touchStartY === 0) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartX;
    const dy = touch.clientY - touchStartY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    if (absDx < 20 && absDy < 20) return;
    if (absDx > absDy) {
        if (dx > 0) move('right');
        else move('left');
    } else {
        if (dy > 0) move('backward');
        else move('forward');
    }
    touchStartX = 0;
    touchStartY = 0;
}, { passive: false });

// ---------- Car / Truck / Tree / Chicken (exactly as before) ----------
function Texture(width, height, rects) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.fillStyle = "rgba(0,0,0,0.6)";
    rects.forEach((rect) => {
        context.fillRect(rect.x, rect.y, rect.w, rect.h);
    });
    return new THREE.CanvasTexture(canvas);
}

function Wheel() {
    const wheel = new THREE.Mesh(
        new THREE.BoxBufferGeometry(12 * zoom, 33 * zoom, 12 * zoom),
        new THREE.MeshLambertMaterial({ color: 0x333333, flatShading: true })
    );
    wheel.position.z = 6 * zoom;
    return wheel;
}

const carFrontTexture = new Texture(40, 80, [{ x: 0, y: 10, w: 30, h: 60 }]);
const carBackTexture = new Texture(40, 80, [{ x: 10, y: 10, w: 30, h: 60 }]);
const carRightSideTexture = new Texture(110, 40, [
    { x: 10, y: 0, w: 50, h: 30 },
    { x: 70, y: 0, w: 30, h: 30 },
]);
const carLeftSideTexture = new Texture(110, 40, [
    { x: 10, y: 10, w: 50, h: 30 },
    { x: 70, y: 10, w: 30, h: 30 },
]);

const truckFrontTexture = new Texture(30, 30, [{ x: 15, y: 0, w: 10, h: 30 }]);
const truckRightSideTexture = new Texture(25, 30, [{ x: 0, y: 15, w: 10, h: 10 }]);
const truckLeftSideTexture = new Texture(25, 30, [{ x: 0, y: 5, w: 10, h: 10 }]);

const vechicleColors = [0xa52523, 0xbdb638, 0x78b14b];

function Car() {
    const car = new THREE.Group();
    const color = vechicleColors[Math.floor(Math.random() * vechicleColors.length)];
    const main = new THREE.Mesh(
        new THREE.BoxBufferGeometry(60 * zoom, 30 * zoom, 15 * zoom),
        new THREE.MeshPhongMaterial({ color, flatShading: true })
    );
    main.position.z = 12 * zoom;
    main.castShadow = true;
    main.receiveShadow = true;
    car.add(main);

    const cabin = new THREE.Mesh(
        new THREE.BoxBufferGeometry(33 * zoom, 24 * zoom, 12 * zoom),
        [
            new THREE.MeshPhongMaterial({ color: 0xcccccc, flatShading: true, map: carBackTexture }),
            new THREE.MeshPhongMaterial({ color: 0xcccccc, flatShading: true, map: carFrontTexture }),
            new THREE.MeshPhongMaterial({ color: 0xcccccc, flatShading: true, map: carRightSideTexture }),
            new THREE.MeshPhongMaterial({ color: 0xcccccc, flatShading: true, map: carLeftSideTexture }),
            new THREE.MeshPhongMaterial({ color: 0xcccccc, flatShading: true }),
            new THREE.MeshPhongMaterial({ color: 0xcccccc, flatShading: true }),
        ]
    );
    cabin.position.x = 6 * zoom;
    cabin.position.z = 25.5 * zoom;
    cabin.castShadow = true;
    cabin.receiveShadow = true;
    car.add(cabin);

    const frontWheel = new Wheel();
    frontWheel.position.x = -18 * zoom;
    car.add(frontWheel);

    const backWheel = new Wheel();
    backWheel.position.x = 18 * zoom;
    car.add(backWheel);

    car.castShadow = true;
    car.receiveShadow = false;
    return car;
}

function Truck() {
    const truck = new THREE.Group();
    const color = vechicleColors[Math.floor(Math.random() * vechicleColors.length)];

    const base = new THREE.Mesh(
        new THREE.BoxBufferGeometry(100 * zoom, 25 * zoom, 5 * zoom),
        new THREE.MeshLambertMaterial({ color: 0xb4c6fc, flatShading: true })
    );
    base.position.z = 10 * zoom;
    truck.add(base);

    const cargo = new THREE.Mesh(
        new THREE.BoxBufferGeometry(75 * zoom, 35 * zoom, 40 * zoom),
        new THREE.MeshPhongMaterial({ color: 0xb4c6fc, flatShading: true })
    );
    cargo.position.x = 15 * zoom;
    cargo.position.z = 30 * zoom;
    cargo.castShadow = true;
    cargo.receiveShadow = true;
    truck.add(cargo);

    const cabin = new THREE.Mesh(
        new THREE.BoxBufferGeometry(25 * zoom, 30 * zoom, 30 * zoom),
        [
            new THREE.MeshPhongMaterial({ color, flatShading: true }),
            new THREE.MeshPhongMaterial({ color, flatShading: true, map: truckFrontTexture }),
            new THREE.MeshPhongMaterial({ color, flatShading: true, map: truckRightSideTexture }),
            new THREE.MeshPhongMaterial({ color, flatShading: true, map: truckLeftSideTexture }),
            new THREE.MeshPhongMaterial({ color, flatShading: true }),
            new THREE.MeshPhongMaterial({ color, flatShading: true }),
        ]
    );
    cabin.position.x = -40 * zoom;
    cabin.position.z = 20 * zoom;
    cabin.castShadow = true;
    cabin.receiveShadow = true;
    truck.add(cabin);

    const frontWheel = new Wheel();
    frontWheel.position.x = -38 * zoom;
    truck.add(frontWheel);

    const middleWheel = new Wheel();
    middleWheel.position.x = -10 * zoom;
    truck.add(middleWheel);

    const backWheel = new Wheel();
    backWheel.position.x = 30 * zoom;
    truck.add(backWheel);

    return truck;
}

const threeHeights = [20, 45, 60];

function Three() {
    const three = new THREE.Group();

    const trunk = new THREE.Mesh(
        new THREE.BoxBufferGeometry(15 * zoom, 15 * zoom, 20 * zoom),
        new THREE.MeshPhongMaterial({ color: 0x4d2926, flatShading: true })
    );
    trunk.position.z = 10 * zoom;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    three.add(trunk);

    const height = threeHeights[Math.floor(Math.random() * threeHeights.length)];
    const crown = new THREE.Mesh(
        new THREE.BoxBufferGeometry(30 * zoom, 30 * zoom, height * zoom),
        new THREE.MeshLambertMaterial({ color: 0x7aa21d, flatShading: true })
    );
    crown.position.z = (height / 2 + 20) * zoom;
    crown.castShadow = true;
    crown.receiveShadow = false;
    three.add(crown);

    return three;
}

function Chicken() {
    const chicken = new THREE.Group();

    const body = new THREE.Mesh(
        new THREE.BoxBufferGeometry(chickenSize * zoom, chickenSize * zoom, 20 * zoom),
        new THREE.MeshPhongMaterial({ color: 0xffffff, flatShading: true })
    );
    body.position.z = 10 * zoom;
    body.castShadow = true;
    body.receiveShadow = true;
    chicken.add(body);

    const rowel = new THREE.Mesh(
        new THREE.BoxBufferGeometry(2 * zoom, 4 * zoom, 2 * zoom),
        new THREE.MeshLambertMaterial({ color: 0xf0619a, flatShading: true })
    );
    rowel.position.z = 21 * zoom;
    rowel.castShadow = true;
    rowel.receiveShadow = false;
    chicken.add(rowel);

    return chicken;
}

function Road() {
    const road = new THREE.Group();
    const createSection = (color) =>
        new THREE.Mesh(
            new THREE.PlaneBufferGeometry(boardWidth * zoom, positionWidth * zoom),
            new THREE.MeshPhongMaterial({ color })
        );
    const middle = createSection(0x454a59);
    middle.receiveShadow = true;
    road.add(middle);
    const left = createSection(0x393d49);
    left.position.x = -boardWidth * zoom;
    road.add(left);
    const right = createSection(0x393d49);
    right.position.x = boardWidth * zoom;
    road.add(right);
    return road;
}

function Grass() {
    const grass = new THREE.Group();
    const createSection = (color) =>
        new THREE.Mesh(
            new THREE.BoxBufferGeometry(boardWidth * zoom, positionWidth * zoom, 3 * zoom),
            new THREE.MeshPhongMaterial({ color })
        );
    const middle = createSection(0xbaf455);
    middle.receiveShadow = true;
    grass.add(middle);
    const left = createSection(0x99c846);
    left.position.x = -boardWidth * zoom;
    grass.add(left);
    const right = createSection(0x99c846);
    right.position.x = boardWidth * zoom;
    grass.add(right);
    grass.position.z = 1.5 * zoom;
    return grass;
}

const laneTypes = ["car", "truck", "forest"];
const laneSpeeds = [2, 2.5, 3];

function Lane(index) {
    this.index = index;
    this.type = index <= 0 ? "field" : laneTypes[Math.floor(Math.random() * laneTypes.length)];

    this.coins = [];

    switch (this.type) {
        case "field": {
            this.mesh = new Grass();
            this.occupiedPositions = new Set();
            if (index > 0) {
                for (let i = 0; i < 3; i++) {
                    const pos = Math.floor(Math.random() * columns);
                    if (!this.occupiedPositions.has(pos)) {
                        const coin = createCoin();
                        coin.position.x = (pos * positionWidth + positionWidth / 2) * zoom - (boardWidth * zoom) / 2;
                        coin.position.z = 2.5 * zoom;
                        this.mesh.add(coin);
                        this.coins.push({ mesh: coin, column: pos });
                    }
                }
            }
            break;
        }
        case "forest": {
            this.mesh = new Grass();
            this.occupiedPositions = new Set();
            this.threes = [1, 2, 3, 4].map(() => {
                const three = new Three();
                let position;
                do {
                    position = Math.floor(Math.random() * columns);
                } while (this.occupiedPositions.has(position));
                this.occupiedPositions.add(position);
                three.position.x = (position * positionWidth + positionWidth / 2) * zoom - (boardWidth * zoom) / 2;
                this.mesh.add(three);
                return three;
            });
            for (let i = 0; i < 2; i++) {
                let pos;
                do {
                    pos = Math.floor(Math.random() * columns);
                } while (this.occupiedPositions.has(pos));
                const coin = createCoin();
                coin.position.x = (pos * positionWidth + positionWidth / 2) * zoom - (boardWidth * zoom) / 2;
                coin.position.z = 2.5 * zoom;
                this.mesh.add(coin);
                this.coins.push({ mesh: coin, column: pos });
            }
            break;
        }
        case "car": {
            this.mesh = new Road();
            this.direction = Math.random() >= 0.5;
            const occupiedPositions = new Set();
            this.vechicles = [1, 2, 3].map(() => {
                const vechicle = new Car();
                let position;
                do {
                    position = Math.floor((Math.random() * columns) / 2);
                } while (occupiedPositions.has(position));
                occupiedPositions.add(position);
                vechicle.position.x = (position * positionWidth * 2 + positionWidth / 2) * zoom - (boardWidth * zoom) / 2;
                if (!this.direction) vechicle.rotation.z = Math.PI;
                this.mesh.add(vechicle);
                return vechicle;
            });
            this.speed = laneSpeeds[Math.floor(Math.random() * laneSpeeds.length)];
            break;
        }
        case "truck": {
            this.mesh = new Road();
            this.direction = Math.random() >= 0.5;
            const occupiedPositions = new Set();
            this.vechicles = [1, 2].map(() => {
                const vechicle = new Truck();
                let position;
                do {
                    position = Math.floor((Math.random() * columns) / 3);
                } while (occupiedPositions.has(position));
                occupiedPositions.add(position);
                vechicle.position.x = (position * positionWidth * 3 + positionWidth / 2) * zoom - (boardWidth * zoom) / 2;
                if (!this.direction) vechicle.rotation.z = Math.PI;
                this.mesh.add(vechicle);
                return vechicle;
            });
            this.speed = laneSpeeds[Math.floor(Math.random() * laneSpeeds.length)];
            break;
        }
    }
}

// ---------- Coin collection ----------
function collectCoinOnCurrentCell() {
    const lane = lanes[currentLane];
    if (!lane.coins || lane.coins.length === 0) return;
    for (let i = lane.coins.length - 1; i >= 0; i--) {
        const coinData = lane.coins[i];
        if (coinData.column === currentColumn) {
            lane.mesh.remove(coinData.mesh);
            lane.coins.splice(i, 1);
            coinsCollected++;
            coinCounterDOM.textContent = '🪙 ' + coinsCollected;
            playCoinSound();
            break;
        }
    }
}

// ---------- Lane generation ----------
const generateLanes = () =>
    [-9, -8, -7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
        .map((index) => {
            const lane = new Lane(index);
            lane.mesh.position.y = index * positionWidth * zoom;
            scene.add(lane.mesh);
            return lane;
        })
        .filter((lane) => lane.index >= 0);

const addLane = () => {
    const index = lanes.length;
    const lane = new Lane(index);
    lane.mesh.position.y = index * positionWidth * zoom;
    scene.add(lane.mesh);
    lanes.push(lane);
};

const chicken = new Chicken();
scene.add(chicken);

const hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 0.6);
scene.add(hemiLight);

const initialDirLightPositionX = -100;
const initialDirLightPositionY = -100;
const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
dirLight.position.set(initialDirLightPositionX, initialDirLightPositionY, 200);
dirLight.castShadow = true;
dirLight.target = chicken;
scene.add(dirLight);

dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
const d = 500;
dirLight.shadow.camera.left = -d;
dirLight.shadow.camera.right = d;
dirLight.shadow.camera.top = d;
dirLight.shadow.camera.bottom = -d;

const backLight = new THREE.DirectionalLight(0x000000, 0.4);
backLight.position.set(200, 200, 50);
backLight.castShadow = true;
scene.add(backLight);

// ---------- Init ----------
const initaliseValues = () => {
    lanes.forEach((lane) => scene.remove(lane.mesh));
    lanes = generateLanes();
    currentLane = 0;
    currentColumn = Math.floor(columns / 2);
    coinsCollected = 0;
    coinCounterDOM.textContent = '🪙 0';
    previousTimestamp = null;
    startMoving = false;
    moves = [];
    stepStartTimestamp = null;
    chicken.position.x = 0;
    chicken.position.y = 0;
    camera.position.y = initialCameraPositionY;
    camera.position.x = initialCameraPositionX;
    dirLight.position.x = initialDirLightPositionX;
    dirLight.position.y = initialDirLightPositionY;
};
initaliseValues();

// ---------- Renderer ----------
const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
});
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// ---------- Retry & Keyboard ----------
document.querySelector("#retry").addEventListener("click", () => {
    initaliseValues();
    endDOM.style.visibility = "hidden";
});

window.addEventListener("keydown", (event) => {
    if (event.keyCode == "38" || event.keyCode == "87") { // up / W
        move("forward");
    } else if (event.keyCode == "40" || event.keyCode == "83") { // down / S
        move("backward");
    } else if (event.keyCode == "37" || event.keyCode == "65") { // left / A
        move("left");
    } else if (event.keyCode == "39" || event.keyCode == "68") { // right / D
        move("right");
    }
});

// ---------- Movement logic ----------
function move(direction) {
    const finalPositions = moves.reduce(
        (position, move) => {
            if (move === "forward") return { lane: position.lane + 1, column: position.column };
            if (move === "backward") return { lane: position.lane - 1, column: position.column };
            if (move === "left") return { lane: position.lane, column: position.column - 1 };
            if (move === "right") return { lane: position.lane, column: position.column + 1 };
        },
        { lane: currentLane, column: currentColumn }
    );

    if (direction === "forward") {
        if (
            lanes[finalPositions.lane + 1].type === "forest" &&
            lanes[finalPositions.lane + 1].occupiedPositions.has(finalPositions.column)
        )
            return;
        if (!stepStartTimestamp) startMoving = true;
        addLane();
    } else if (direction === "backward") {
        if (finalPositions.lane === 0) return;
        if (
            lanes[finalPositions.lane - 1].type === "forest" &&
            lanes[finalPositions.lane - 1].occupiedPositions.has(finalPositions.column)
        )
            return;
        if (!stepStartTimestamp) startMoving = true;
    } else if (direction === "left") {
        if (finalPositions.column === 0) return;
        if (
            lanes[finalPositions.lane].type === "forest" &&
            lanes[finalPositions.lane].occupiedPositions.has(finalPositions.column - 1)
        )
            return;
        if (!stepStartTimestamp) startMoving = true;
    } else if (direction === "right") {
        if (finalPositions.column === columns - 1) return;
        if (
            lanes[finalPositions.lane].type === "forest" &&
            lanes[finalPositions.lane].occupiedPositions.has(finalPositions.column + 1)
        )
            return;
        if (!stepStartTimestamp) startMoving = true;
    }
    moves.push(direction);
}

// ---------- Animation ----------
function animate(timestamp) {
    requestAnimationFrame(animate);

    if (!previousTimestamp) previousTimestamp = timestamp;
    const delta = timestamp - previousTimestamp;
    previousTimestamp = timestamp;

    // Move vehicles
    lanes.forEach((lane) => {
        if (lane.type === "car" || lane.type === "truck") {
            const aBitBefore = (-boardWidth * zoom) / 2 - positionWidth * 2 * zoom;
            const aBitAfter = (boardWidth * zoom) / 2 + positionWidth * 2 * zoom;
            lane.vechicles.forEach((vechicle) => {
                if (lane.direction) {
                    vechicle.position.x =
                        vechicle.position.x < aBitBefore
                            ? aBitAfter
                            : (vechicle.position.x -= (lane.speed / 16) * delta);
                } else {
                    vechicle.position.x =
                        vechicle.position.x > aBitAfter
                            ? aBitBefore
                            : (vechicle.position.x += (lane.speed / 16) * delta);
                }
            });
        }
    });

    if (startMoving) {
        stepStartTimestamp = timestamp;
        startMoving = false;
    }

    if (stepStartTimestamp) {
        const moveDeltaTime = timestamp - stepStartTimestamp;
        const moveDeltaDistance = Math.min(moveDeltaTime / stepTime, 1) * positionWidth * zoom;
        const jumpDeltaDistance = Math.sin(Math.min(moveDeltaTime / stepTime, 1) * Math.PI) * 8 * zoom;
        switch (moves[0]) {
            case "forward": {
                const positionY = currentLane * positionWidth * zoom + moveDeltaDistance;
                camera.position.y = initialCameraPositionY + positionY;
                dirLight.position.y = initialDirLightPositionY + positionY;
                chicken.position.y = positionY;
                chicken.position.z = jumpDeltaDistance;
                break;
            }
            case "backward": {
                const positionY = currentLane * positionWidth * zoom - moveDeltaDistance;
                camera.position.y = initialCameraPositionY + positionY;
                dirLight.position.y = initialDirLightPositionY + positionY;
                chicken.position.y = positionY;
                chicken.position.z = jumpDeltaDistance;
                break;
            }
            case "left": {
                const positionX =
                    (currentColumn * positionWidth + positionWidth / 2) * zoom -
                    (boardWidth * zoom) / 2 -
                    moveDeltaDistance;
                camera.position.x = initialCameraPositionX + positionX;
                dirLight.position.x = initialDirLightPositionX + positionX;
                chicken.position.x = positionX;
                chicken.position.z = jumpDeltaDistance;
                break;
            }
            case "right": {
                const positionX =
                    (currentColumn * positionWidth + positionWidth / 2) * zoom -
                    (boardWidth * zoom) / 2 +
                    moveDeltaDistance;
                camera.position.x = initialCameraPositionX + positionX;
                dirLight.position.x = initialDirLightPositionX + positionX;
                chicken.position.x = positionX;
                chicken.position.z = jumpDeltaDistance;
                break;
            }
        }
        if (moveDeltaTime > stepTime) {
            switch (moves[0]) {
                case "forward": currentLane++; counterDOM.innerHTML = currentLane; break;
                case "backward": currentLane--; counterDOM.innerHTML = currentLane; break;
                case "left": currentColumn--; break;
                case "right": currentColumn++; break;
            }
            moves.shift();
            stepStartTimestamp = moves.length === 0 ? null : timestamp;
            collectCoinOnCurrentCell();
        }
    }

    // Hit test
    if (lanes[currentLane].type === "car" || lanes[currentLane].type === "truck") {
        const chickenMinX = chicken.position.x - (chickenSize * zoom) / 2;
        const chickenMaxX = chicken.position.x + (chickenSize * zoom) / 2;
        const vechicleLength = { car: 60, truck: 105 }[lanes[currentLane].type];
        lanes[currentLane].vechicles.forEach((vechicle) => {
            const carMinX = vechicle.position.x - (vechicleLength * zoom) / 2;
            const carMaxX = vechicle.position.x + (vechicleLength * zoom) / 2;
            if (chickenMaxX > carMinX && chickenMinX < carMaxX) {
                endDOM.style.visibility = "visible";
            }
        });
    }

    renderer.render(scene, camera);
}

// Canvas reference for touch events
const canvas = renderer.domElement;

requestAnimationFrame(animate);
