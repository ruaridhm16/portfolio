import {
    PoseLandmarker,
    FilesetResolver
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35";

let poseLandmarker = null;

async function createLandmarker() {
    const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm"
    );
    poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
            modelAssetPath:
                "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task",
            delegate: "GPU"
        },
        runningMode: "VIDEO",
        numPoses: 1
    });
}

const landmarkerReady = createLandmarker();
landmarkerReady.catch(() => {});

const L = {
    nose: 0,
    lShoulder: 11, rShoulder: 12,
    lElbow: 13, rElbow: 14,
    lWrist: 15, rWrist: 16,
    lIndex: 19, rIndex: 20,
    lHip: 23, rHip: 24,
    lKnee: 25, rKnee: 26,
    lAnkle: 27, rAnkle: 28
};
const ARM_WIDTH = 0.30;
const LEG_WIDTH = 0.34;
const ARM_LIMB_PAIRS = [
    [L.lShoulder, L.lElbow], [L.lElbow, L.lWrist], [L.lWrist, L.lIndex],
    [L.rShoulder, L.rElbow], [L.rElbow, L.rWrist], [L.rWrist, L.rIndex]
];
const LEG_LIMB_PAIRS = [
    [L.lHip, L.lKnee], [L.lKnee, L.lAnkle],
    [L.rHip, L.rKnee], [L.rKnee, L.rAnkle]
];

const ARM_JOINTS = [
    L.lShoulder, L.rShoulder, L.lElbow, L.rElbow,
    L.lWrist, L.rWrist, L.lIndex, L.rIndex
];
const LEG_JOINTS = [L.lHip, L.rHip, L.lKnee, L.rKnee, L.lAnkle, L.rAnkle];

const USED_INDICES = [
    L.nose, L.lShoulder, L.rShoulder, L.lElbow, L.rElbow,
    L.lWrist, L.rWrist, L.lIndex, L.rIndex,
    L.lHip, L.rHip, L.lKnee, L.rKnee, L.lAnkle, L.rAnkle
];

function dist(a, b) {
    return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

const FIGURE_COLOR = "#4C47E2";
const TORSO_COLOR = "#332F99";
const OUTLINE_COLOR = "#A29DF0";

function torsoPoints(P, inflate) {
    const pts = [P[L.lShoulder], P[L.rShoulder], P[L.rHip], P[L.lHip]];
    if (!inflate) return pts;
    const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    return pts.map(([x, y]) => {
        const dx = x - cx, dy = y - cy;
        const len = Math.hypot(dx, dy) || 1;
        return [x + (dx / len) * inflate, y + (dy / len) * inflate];
    });
}
function fillPolygon(c, pts) {
    c.beginPath();
    c.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
    c.closePath();
    c.fill();
}
function strokeGroup(c, P, pairs, width) {
    c.lineWidth = width;
    c.beginPath();
    for (const [a, b] of pairs) {
        c.moveTo(P[a][0], P[a][1]);
        c.lineTo(P[b][0], P[b][1]);
    }
    c.stroke();
}
function fillCircleGroup(c, P, indices, radius) {
    c.beginPath();
    for (const idx of indices) {
        const [x, y] = P[idx];
        c.moveTo(x + radius, y);
        c.arc(x, y, radius, 0, Math.PI * 2);
    }
    c.fill();
}

const SQUIRCLE_SEGMENTS = 40;
const SQUIRCLE_EXPONENT = 4;
const SQUIRCLE_UNIT = Array.from({ length: SQUIRCLE_SEGMENTS + 1 }, (_, i) => {
    const t = (i / SQUIRCLE_SEGMENTS) * Math.PI * 2;
    const ct = Math.cos(t), st = Math.sin(t);
    return [
        Math.sign(ct) * Math.pow(Math.abs(ct), 2 / SQUIRCLE_EXPONENT),
        Math.sign(st) * Math.pow(Math.abs(st), 2 / SQUIRCLE_EXPONENT)
    ];
});
function squircle(c, cx, cy, rx, ry) {
    c.beginPath();
    for (let i = 0; i < SQUIRCLE_UNIT.length; i++) {
        const x = cx + SQUIRCLE_UNIT[i][0] * rx;
        const y = cy + SQUIRCLE_UNIT[i][1] * ry;
        if (i === 0) c.moveTo(x, y);
        else c.lineTo(x, y);
    }
    c.closePath();
    c.fill();
}

const JITTER_THRESHOLD = 0.02;
const SMOOTHING_MIN = 0.35;
const SMOOTHING_MAX = 0.95;
const CATCHUP_DISTANCE = 0.06;

function updateTarget(targetLandmarks, landmarks) {
    if (!targetLandmarks) {
        return landmarks.map((lm) => ({ ...lm }));
    }
    for (let i = 0; i < landmarks.length; i++) {
        const cur = landmarks[i];
        const prev = targetLandmarks[i];
        if (Math.hypot(cur.x - prev.x, cur.y - prev.y) > JITTER_THRESHOLD) {
            targetLandmarks[i] = cur;
        }
    }
    return targetLandmarks;
}

function easeTowardTarget(renderLandmarks, targetLandmarks) {
    if (!renderLandmarks) {
        return targetLandmarks.map((lm) => ({ ...lm }));
    }
    for (let i = 0; i < targetLandmarks.length; i++) {
        const r = renderLandmarks[i], t = targetLandmarks[i];
        const d = Math.hypot(t.x - r.x, t.y - r.y);
        const alpha = Math.min(
            SMOOTHING_MAX,
            SMOOTHING_MIN + (d / CATCHUP_DISTANCE) * (SMOOTHING_MAX - SMOOTHING_MIN)
        );
        r.x += (t.x - r.x) * alpha;
        r.y += (t.y - r.y) * alpha;
    }
    return renderLandmarks;
}

export function init(root = document, onClose = null) {
    const video = root.getElementById("video");
    const canvas = root.getElementById("overlay");
    const ctx = canvas.getContext("2d");
    const fillLayer = document.createElement("canvas");
    const fillCtx = fillLayer.getContext("2d");
    const placeholder = root.getElementById("placeholder");
    const startBtn = root.getElementById("btn-start");
    const statusEl = root.getElementById("status");
    const stage = root.getElementById("stage");
    const liveIndicator = root.getElementById("live-indicator");
    const stopBtn = root.getElementById("btn-stop");
    const hideCameraBtn = root.getElementById("btn-hide-camera");
    const closeBtn = root.getElementById("btn-close");
    const mainEl = root.querySelector("main");

    const contentRoot = root.host || document.documentElement;

    let running = false;
    let targetLandmarks = null;
    let renderLandmarks = null;
    let growRevealTimer = null;

    closeBtn.addEventListener("click", () => {
        if (onClose) {
            onClose();
        } else {
            window.location.href = "../index.html";
        }
    });

    function growStageToVideo(videoWidth, videoHeight) {
        const startRect = stage.getBoundingClientRect();
        stage.style.width = `${startRect.width}px`;
        stage.style.height = `${startRect.height}px`;
        stage.offsetHeight;

        const main = stage.parentElement;
        const mainStyle = getComputedStyle(main);
        const availableWidth =
            main.clientWidth - parseFloat(mainStyle.paddingLeft) - parseFloat(mainStyle.paddingRight);
        let targetWidth = Math.min(960, availableWidth);
        let targetHeight = targetWidth * (videoHeight / videoWidth);

        const otherContentHeight = contentRoot.scrollHeight - startRect.height;
        const maxStageHeight = Math.max(200, window.innerHeight - otherContentHeight - 56);
        if (targetHeight > maxStageHeight) {
            targetHeight = maxStageHeight;
            targetWidth = targetHeight * (videoWidth / videoHeight);
        }

        stage.style.width = `${targetWidth}px`;
        stage.style.height = `${targetHeight}px`;
    }

    function resetStageSize() {
        const prevWidth = stage.style.width;
        const prevHeight = stage.style.height;
        stage.style.width = "";
        stage.style.height = "";
        const restingRect = stage.getBoundingClientRect();
        stage.style.width = prevWidth;
        stage.style.height = prevHeight;
        stage.offsetHeight;

        stage.style.width = `${restingRect.width}px`;
        stage.style.height = `${restingRect.height}px`;

        stage.addEventListener("transitionend", function onShrinkDone(e) {
            if (e.target !== stage || e.propertyName !== "height") return;
            stage.removeEventListener("transitionend", onShrinkDone);
            stage.style.width = "";
            stage.style.height = "";
        });
    }

    async function startCamera() {
        startBtn.disabled = true;
        statusEl.textContent = "Setting up stuff...";
        stage.classList.add("setting-up");
        mainEl.classList.add("camera-active");

        const [modelResult, cameraResult] = await Promise.allSettled([
            landmarkerReady,
            navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 960 },
                    height: { ideal: 720 },
                    facingMode: "user"
                },
                audio: false
            })
        ]);

        if (modelResult.status === "rejected") {
            statusEl.textContent = "Couldn't load the pose model - try refreshing.";
            startBtn.disabled = false;
            stage.classList.remove("setting-up");
            mainEl.classList.remove("camera-active");
            console.error(modelResult.reason);
            return;
        }
        if (cameraResult.status === "rejected") {
            statusEl.textContent = "Camera access denied.";
            startBtn.disabled = false;
            stage.classList.remove("setting-up");
            mainEl.classList.remove("camera-active");
            console.error(cameraResult.reason);
            return;
        }

        video.srcObject = cameraResult.value;
        await new Promise((resolve) => (video.onloadedmetadata = resolve));
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        growStageToVideo(video.videoWidth, video.videoHeight);
        stage.classList.add("active");
        stage.classList.remove("tracking-visible");
        stage.classList.remove("setting-up");

        placeholder.classList.add("hidden");
        liveIndicator.hidden = false;
        stopBtn.hidden = false;
        hideCameraBtn.hidden = false;
        running = true;
        requestAnimationFrame(predictLoop);

        clearTimeout(growRevealTimer);
        growRevealTimer = setTimeout(() => {
            stage.classList.add("tracking-visible");
        }, 720);
    }

    function toggleCameraVisibility() {
        const hidden = stage.classList.toggle("camera-hidden");
        hideCameraBtn.textContent = hidden ? "Show camera" : "Hide camera";
    }

    function stopCamera() {
        running = false;
        clearTimeout(growRevealTimer);
        if (video.srcObject) {
            video.srcObject.getTracks().forEach((track) => track.stop());
            video.srcObject = null;
        }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        targetLandmarks = null;
        renderLandmarks = null;

        stage.classList.remove("camera-hidden");
        stage.classList.remove("active");
        stage.classList.remove("tracking-visible");
        stage.classList.remove("setting-up");
        mainEl.classList.remove("camera-active");
        hideCameraBtn.textContent = "Hide camera";
        liveIndicator.hidden = true;
        stopBtn.hidden = true;
        hideCameraBtn.hidden = true;

        placeholder.classList.remove("hidden");
        resetStageSize();
        statusEl.textContent = "";
        startBtn.disabled = false;
    }

    function drawStickFigure(landmarks) {
        if (landmarks.length < 29) return;

        if (fillLayer.width !== canvas.width || fillLayer.height !== canvas.height) {
            fillLayer.width = canvas.width;
            fillLayer.height = canvas.height;
        } else {
            fillCtx.clearRect(0, 0, fillLayer.width, fillLayer.height);
        }

        const P = {};
        for (const idx of USED_INDICES) {
            const lm = landmarks[idx];
            P[idx] = [lm.x * canvas.width, lm.y * canvas.height];
        }

        const unit = dist(P[L.lShoulder], P[L.rShoulder]);
        const headRadiusX = Math.max(19, unit * 0.34);
        const headRadiusY = Math.max(24, unit * 0.44);
        const outlineWidth = Math.max(3, unit * 0.05);
        const nose = P[L.nose];

        const draw = (c, color, grow, torsoColor) => {
            c.lineCap = "round";
            c.lineJoin = "round";
            c.strokeStyle = color;
            c.fillStyle = torsoColor;

            fillPolygon(c, torsoPoints(P, grow));

            c.fillStyle = color;
            strokeGroup(c, P, ARM_LIMB_PAIRS, unit * ARM_WIDTH + grow * 2);
            strokeGroup(c, P, LEG_LIMB_PAIRS, unit * LEG_WIDTH + grow * 2);
            fillCircleGroup(c, P, ARM_JOINTS, (unit * ARM_WIDTH) / 2 + grow);
            fillCircleGroup(c, P, LEG_JOINTS, (unit * LEG_WIDTH) / 2 + grow);

            squircle(c, nose[0], nose[1], headRadiusX + grow, headRadiusY + grow);
        };

        draw(ctx, OUTLINE_COLOR, outlineWidth, OUTLINE_COLOR);
        draw(fillCtx, FIGURE_COLOR, 0, TORSO_COLOR);

        ctx.globalAlpha = 0.6;
        ctx.drawImage(fillLayer, 0, 0);
        ctx.globalAlpha = 1;
    }

    function predictLoop() {
        if (!running) return;
        const nowMs = performance.now();
        poseLandmarker.detectForVideo(video, nowMs, (result) => {
            if (result.landmarks.length > 0) {
                targetLandmarks = updateTarget(targetLandmarks, result.landmarks[0]);
            } else {
                targetLandmarks = null;
                renderLandmarks = null;
            }
        });

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (targetLandmarks) {
            renderLandmarks = easeTowardTarget(renderLandmarks, targetLandmarks);
            drawStickFigure(renderLandmarks);
        }

        requestAnimationFrame(predictLoop);
    }

    startBtn.addEventListener("click", startCamera);
    hideCameraBtn.addEventListener("click", toggleCameraVisibility);
    stopBtn.addEventListener("click", stopCamera);

    return function cleanup() {
        stopCamera();
    };
}
