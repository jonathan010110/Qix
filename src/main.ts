const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const config = {
  margin: 70,
  borderWidth: 4,
  gridSize: 25, // 0 = kein Grid
};

function playfieldRect() {
  const m = config.margin;
  return {
    x: m,
    y: m,
    w: canvas.width - 2 * m,
    h: canvas.height - 2 * m,
  };
}

function clear() {
  ctx.fillStyle = "#0b0c10";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawGrid(r, step) {
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;

  for (let x = r.x; x <= r.x + r.w; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, r.y);
    ctx.lineTo(x, r.y + r.h);
    ctx.stroke();
  }

  for (let y = r.y; y <= r.y + r.h; y += step) {
    ctx.beginPath();
    ctx.moveTo(r.x, y);
    ctx.lineTo(r.x + r.w, y);
    ctx.stroke();
  }
}

function drawPlayfield() {
  const r = playfieldRect();

  // Innenfläche
  ctx.fillStyle = "#161826";
  ctx.fillRect(r.x, r.y, r.w, r.h);

  // Grid (optional)
  if (config.gridSize > 0) drawGrid(r, config.gridSize);

  // Rahmen
  ctx.strokeStyle = "#e6e6f0";
  ctx.lineWidth = config.borderWidth;
  ctx.strokeRect(r.x, r.y, r.w, r.h);
}

function loop() {
  clear();
  drawPlayfield();
  requestAnimationFrame(loop);
}

loop();
