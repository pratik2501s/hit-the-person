import "./styles.css";
import { startGame } from "./game";
import { buildAppShell } from "./ui/shell";

const root = document.querySelector("#app");
if (!root) throw new Error("#app missing");

root.innerHTML = buildAppShell();
startGame();
