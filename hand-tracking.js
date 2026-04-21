const video = document.getElementById("webcam");

let handCallback = () => {};
window.onHandUpdate = function (cb) {
  handCallback = cb;
};

async function init() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: true,
  });

  video.srcObject = stream;

  const hands = new Hands({
    locateFile: (file) =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
  });

  hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 0,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.7,
  });

  hands.onResults((results) => {
    if (!results.multiHandLandmarks.length) return;

    const landmarks = results.multiHandLandmarks[0];

    const index = landmarks[8];
    const thumb = landmarks[4];

    const dx = index.x - thumb.x;
    const dy = index.y - thumb.y;

    const distance = Math.sqrt(dx * dx + dy * dy);

    const isPinching = distance < 0.05;

    handCallback({
      x: index.x,
      y: index.y,
      isPinching,
      landmarks: landmarks,
    });
  });

  const camera = new Camera(video, {
    onFrame: async () => {
      await hands.send({ image: video });
    },
    width: 640,
    height: 480,
  });

  camera.start();
}

init();
