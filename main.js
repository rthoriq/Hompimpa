// GANTI dengan URL Space kamu
const API_BASE_URL = "https://moordgg-hompimpaa.hf.space";

const video = document.getElementById("video");
const canvas = document.getElementById("overlay");
const btnStart = document.getElementById("btnStartCamera");
const btnCapture = document.getElementById("btnCapture");
const statusEl = document.getElementById("status");
const rawJsonEl = document.getElementById("rawJson");

let stream = null;

// ====== Helper: tulis status ======
function setStatus(msg) {
  statusEl.textContent = msg;
  console.log("[STATUS]", msg);
}

// ====== Start camera ======
btnStart.addEventListener("click", async () => {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
      audio: false,
    });
    video.srcObject = stream;
    await video.play();

    // Atur ukuran canvas sama seperti video
    video.addEventListener(
      "loadedmetadata",
      () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      },
      { once: true }
    );

    btnCapture.disabled = false;
    setStatus("Kamera aktif. Klik 'Capture & Deteksi' untuk mengirim frame.");
  } catch (err) {
    console.error(err);
    setStatus("Gagal mengakses kamera: " + err.message);
  }
});

// ====== Capture frame ke Blob ======
function captureFrameToBlob() {
  return new Promise((resolve, reject) => {
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = video.videoWidth;
    tempCanvas.height = video.videoHeight;

    const ctx = tempCanvas.getContext("2d");
    if (!ctx) {
      reject(new Error("Tidak bisa mendapatkan canvas context"));
      return;
    }

    ctx.drawImage(video, 0, 0);

    tempCanvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Gagal capture frame"));
        }
      },
      "image/jpeg",
      0.8
    );
  });
}

// ====== Gambar bounding box di canvas ======
function drawDetections(detections) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Bersihkan overlay
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.lineWidth = 2;
  ctx.font = "16px system-ui";
  ctx.textBaseline = "top";

  detections.forEach((det) => {
    const x = det.x1;
    const y = det.y1;
    const w = det.x2 - det.x1;
    const h = det.y2 - det.y1;

    // Kotak
    ctx.strokeStyle = "#22c55e";
    ctx.strokeRect(x, y, w, h);

    // Label
    const label = `${det.class_name} (${(det.confidence * 100).toFixed(1)}%)`;
    const textWidth = ctx.measureText(label).width;
    const textHeight = 18;

    ctx.fillStyle = "rgba(34,197,94,0.9)";
    ctx.fillRect(x, y - textHeight, textWidth + 8, textHeight);

    ctx.fillStyle = "#020617";
    ctx.fillText(label, x + 4, y - textHeight + 2);
  });
}

// ====== Kirim frame ke API ======
btnCapture.addEventListener("click", async () => {
  if (!video.srcObject) {
    setStatus("Kamera belum aktif.");
    return;
  }

  btnCapture.disabled = true;
  setStatus("Mengambil frame & mengirim ke API...");

  try {
    const blob = await captureFrameToBlob();
    const formData = new FormData();
    formData.append("file", blob, "frame.jpg");

    const resp = await fetch(`${API_BASE_URL}/predict`, {
      method: "POST",
      body: formData,
    });

    if (!resp.ok) {
      throw new Error(`Prediction failed: ${resp.status}`);
    }

    const data = await resp.json();
    rawJsonEl.textContent = JSON.stringify(data, null, 2);

    drawDetections(data.detections);
    setStatus(`Deteksi selesai. Jumlah objek: ${data.detections.length}`);
  } catch (err) {
    console.error(err);
    setStatus("Error saat deteksi: " + err.message);
  } finally {
    btnCapture.disabled = false;
  }
});
