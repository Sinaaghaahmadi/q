/* رجیستری بازی‌های بت آسا — ترتیب، ترتیب نمایش لابی است */
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
import poker from "./poker.js";
import backgammon from "./backgammon.js";

export const games = [crash, mines, plinko, backgammon, dice, wheel, hilo, poker, keno, limbo, tower, coinflip];
