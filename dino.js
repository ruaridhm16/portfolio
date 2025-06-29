// Basic Dino Game Clone
const canvas = document.getElementById("dinoCanvas");
const ctx = canvas.getContext("2d");

let dino = { x: 50, y: 100, vy: 0, width: 20, height: 20, gravity: 2, jump: -25, grounded: true };
let cactus = { x: 600, y: 110, width: 20, height: 40 };
let score = 0;

function drawDino() {
  ctx.fillStyle = "#333";
  ctx.fillRect(dino.x, dino.y, dino.width, dino.height);
}

function drawCactus() {
  ctx.fillStyle = "#228b22";
  ctx.fillRect(cactus.x, cactus.y, cactus.width, cactus.height);
}

function update() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Gravity
  if (!dino.grounded) {
    dino.vy += dino.gravity;
    dino.y += dino.vy;
    if (dino.y >= 100) {
      dino.y = 100;
      dino.vy = 0;
      dino.grounded = true;
    }
  }

  // Move cactus
  cactus.x -= 5;
  if (cactus.x < -cactus.width) {
    cactus.x = canvas.width;
    score++;
  }

  // Collision detection
  if (
    dino.x < cactus.x + cactus.width &&
    dino.x + dino.width > cactus.x &&
    dino.y + dino.height > cactus.y
  ) {
    alert("Game Over! Score: " + score);
    document.location.reload();
  }

  drawDino();
  drawCactus();
  requestAnimationFrame(update);
}

document.addEventListener("keydown", function (e) {
  if ((e.code === "Space" || e.code === "ArrowUp") && dino.grounded) {
    dino.vy = dino.jump;
    dino.grounded = false;
  }
});

update();
