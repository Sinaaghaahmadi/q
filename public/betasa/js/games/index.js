/* رجیستری بازی‌های بتاسا — ترتیب، ترتیب نمایش لابی است */
import coinflip from "./coinflip.js";
import dice from "./dice.js";
import hilo from "./hilo.js";
import wheel from "./wheel.js";
import mines from "./mines.js";
import tower from "./tower.js";
import keno from "./keno.js";
import crash from "./crash.js";
import limbo from "./limbo.js";
import plinko from "./plinko.js";

export const games = [crash, mines, plinko, dice, wheel, hilo, keno, limbo, tower, coinflip];
