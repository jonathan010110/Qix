import "./styles.css"
import { Player } from "./player"

const player = new Player({x:300,y:300}, "canvas");

let lastTime = performance.now();
function gameLoop(currentTime: number) {
  const dt = (currentTime - lastTime) / 1000; // Convert to seconds
  lastTime = currentTime;
  
  player.update(dt);
  
  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);