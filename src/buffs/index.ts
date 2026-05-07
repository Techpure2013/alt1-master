import * as a1lib from "alt1/base";
import * as OCR from "alt1/ocr";
import { webpackImages, ImgRef } from "alt1/base";
import type { ColortTriplet } from "alt1/ocr";

var imgs = webpackImages({
	buff: require("./imgs/buffborder.data.png"),
	debuff: require("./imgs/debuffborder.data.png"),
	buff_alt: require("./imgs/buffborder_alt.data.png"),
	debuff_alt: require("./imgs/debuffborder_alt.data.png"),
});

var font = require("../fonts/aa_8px_new.fontmeta.json");
var font2 = require("../fonts/aa_8px_buff2.fontmeta.json");
var fontLow = require("../fonts/aa_8px_buff2_low.fontmeta.json");

function negmod(a: number, b: number) {
	return ((a % b) + b) % b;
}


export type BuffTextTypes = "time" | "timearg" | "arg";

export class Buff {
	isdebuff: boolean;
	buffer: ImageData;
	bufferx: number;
	buffery: number;
	constructor(buffer: ImageData, x: number, y: number, isdebuff: boolean) {
		this.buffer = buffer;
		this.bufferx = x;
		this.buffery = y;
		this.isdebuff = isdebuff;
	}
	readArg(type: BuffTextTypes) {
		return BuffReader.readArg(this.buffer, this.bufferx + 2, this.buffery + 25, type);
	}
	readTime() {
		return BuffReader.readTime(this.buffer, this.bufferx + 2, this.buffery + 25);
	}
	compareBuffer(img: ImageData) {
		return BuffReader.compareBuffer(this.buffer, this.bufferx + 1, this.buffery + 1, img);
	}
	countMatch(img: ImageData, aggressive?: boolean) {
		return BuffReader.countMatch(this.buffer, this.bufferx + 1, this.buffery + 1, img, aggressive);
	}
}

export default class BuffReader {
	pos: { x: number, y: number, maxhor: number, maxver: number } | null = null;
	debuffs = false;

	static buffsize = 27;
	static gridsize = 30;

	find(img?: ImgRef) {
		if (!img) { img = a1lib.captureHoldFullRs(); }
		if (!img) { return null; }
		var poslist = img.findSubimage(this.debuffs ? imgs.debuff : imgs.buff);
		var poslist_alt = img.findSubimage(this.debuffs ? imgs.debuff_alt : imgs.buff_alt);
		for (var ai = 0; ai < poslist_alt.length; ai++) { poslist.push(poslist_alt[ai]); }
		if (poslist.length == 0) { return null; }
		type BuffPos = { n: number, x: number, y: number }
		var grids: BuffPos[] = [];
		for (var a in poslist) {
			var ongrid = false;
			for (var b in grids) {
				if (negmod(grids[b].x - poslist[a].x, BuffReader.gridsize) == 0 && negmod(grids[b].x - poslist[a].x, BuffReader.gridsize) == 0) {
					grids[b].x = Math.min(grids[b].x, poslist[a].x);
					grids[b].y = Math.min(grids[b].y, poslist[a].y);
					grids[b].n++;
					ongrid = true;
					break;
				}
			}
			if (!ongrid) { grids.push({ x: poslist[a].x, y: poslist[a].y, n: 1 }); }
		}
		var max = 0;
		var above2 = 0;
		var best: BuffPos | null = null;
		for (var a in grids) {
			console.log("buff grid [" + grids[a].x + "," + grids[a].y + "], n:" + grids[a].n);
			if (grids[a].n > max) { max = grids[a].n; best = grids[a]; }
			if (grids[a].n >= 2) { above2++; }
		}
		if (above2 > 1) { console.log("Warning, more than one possible buff bar location"); }
		if (!best) { return null; }
		this.pos = { x: best.x, y: best.y, maxhor: Math.max(5, best.n), maxver: 1 };
		return true;
	}
	getCaptRect() {
		if (!this.pos) { return null; }
		return new a1lib.Rect(this.pos.x, this.pos.y, (this.pos.maxhor + 1) * BuffReader.gridsize, (this.pos.maxver + 1) * BuffReader.gridsize);
	}
	read(buffer?: ImageData) {
		if (!this.pos) { throw new Error("no pos"); }
		var r: Buff[] = [];
		var rect = this.getCaptRect();
		if (!rect) { return null; }
		if (!buffer) { buffer = a1lib.capture(rect.x, rect.y, rect.width, rect.height); }
		var maxhor = 0;
		var maxver = 0;
		for (var ix = 0; ix <= this.pos.maxhor; ix++) {
			for (var iy = 0; iy <= this.pos.maxver; iy++) {
				var x = ix * BuffReader.gridsize;
				var y = iy * BuffReader.gridsize;

				if (x + BuffReader.buffsize > buffer.width || y + BuffReader.buffsize > buffer.height) { break; }

				//Have to require exact match here as we get transparency bs otherwise
				var match = buffer.pixelCompare((this.debuffs ? imgs.debuff : imgs.buff), x, y) == 0;
				if (!match) {
					match = buffer.pixelCompare((this.debuffs ? imgs.debuff_alt : imgs.buff_alt), x, y) == 0;
				}
				if (!match) { break; }
				r.push(new Buff(buffer, x, y, this.debuffs));
				maxhor = Math.max(maxhor, ix);
				maxver = Math.max(maxver, iy);
			}
		}
		this.pos.maxhor = Math.max(5, maxhor + 2);
		this.pos.maxver = Math.max(1, maxver + 1);
		return r;
	}

	static compareBuffer(buffer: ImageData, ox: number, oy: number, buffimg: ImageData) {
		var r = BuffReader.countMatch(buffer, ox, oy, buffimg, true);
		if (r.failed > 0) { return false; }
		if (r.tested < 50) { return false; }
		return true;
	}

	static countMatch(buffer: ImageData, ox: number, oy: number, buffimg: ImageData, agressive?: boolean) {
		var r = { tested: 0, failed: 0, skipped: 0, passed: 0 };
		var data1 = buffer.data;
		var data2 = buffimg.data;
		for (var y = 0; y < buffimg.height; y++) {
			for (var x = 0; x < buffimg.width; x++) {
				var i1 = buffer.pixelOffset(ox + x, oy + y);
				var i2 = buffimg.pixelOffset(x, y);

				if (data2[i2 + 3] != 255) { r.skipped++; continue; }//transparent buff pixel

				var R1 = data1[i1], G1 = data1[i1 + 1], B1 = data1[i1 + 2];
				var lum = (R1 + G1 + B1) / 3;
				var maxc = Math.max(R1, G1, B1);
				var minc = Math.min(R1, G1, B1);
				var sat = maxc > 0 ? ((maxc - minc) / maxc) * 255 : 0;

				if (lum > 140 && sat < 60) { r.skipped++; continue; }//bright low-sat pixel - part of buff time text
				if (lum < 50) { r.skipped++; continue; }//dark pixel - part of buff time text shadow

				var d = a1lib.ImageDetect.coldif(data1[i1], data1[i1 + 1], data1[i1 + 2], data2[i2], data2[i2 + 1], data2[i2 + 2], 255);
				r.tested++;
				if (d > 35) {
					r.failed++;
					if (agressive) { return r; }
				}
				else {
					r.passed++;
				}
			}
		}
		return r;
	}


	static isolateBuffer(buffer: ImageData, ox: number, oy: number, buffimg: ImageData) {
		var count = BuffReader.countMatch(buffer, ox, oy, buffimg);
		if (count.passed < 50) { return; }

		var removed = 0;
		var data1 = buffer.data;
		var data2 = buffimg.data;
		for (var y = 0; y < buffimg.height; y++) {
			for (var x = 0; x < buffimg.width; x++) {
				var i1 = buffer.pixelOffset(ox + x, oy + y);
				var i2 = buffimg.pixelOffset(x, y);

				if (data2[i2 + 3] != 255) { continue; }//transparent buff pixel

				var R1 = data1[i1], G1 = data1[i1 + 1], B1 = data1[i1 + 2];
				var lum1 = (R1 + G1 + B1) / 3;
				var maxc1 = Math.max(R1, G1, B1);
				var minc1 = Math.min(R1, G1, B1);
				var sat1 = maxc1 > 0 ? ((maxc1 - minc1) / maxc1) * 255 : 0;

				//==== new buffer has text on it ====
				if ((lum1 > 140 && sat1 < 60) || lum1 < 50) {
					continue;
				}

				//==== old buf has text on it, use the new one ====
				var R2 = data2[i2], G2 = data2[i2 + 1], B2 = data2[i2 + 2];
				var lum2 = (R2 + G2 + B2) / 3;
				var maxc2 = Math.max(R2, G2, B2);
				var minc2 = Math.min(R2, G2, B2);
				var sat2 = maxc2 > 0 ? ((maxc2 - minc2) / maxc2) * 255 : 0;
				if ((lum2 > 140 && sat2 < 60) || lum2 < 50) {
					data2[i2 + 0] = data1[i1 + 0];
					data2[i2 + 1] = data1[i1 + 1];
					data2[i2 + 2] = data1[i1 + 2];
					data2[i2 + 3] = data1[i1 + 3];
					removed++;
				}

				var d = a1lib.ImageDetect.coldif(data1[i1], data1[i1 + 1], data1[i1 + 2], data2[i2], data2[i2 + 1], data2[i2 + 2], 255);
				if (d > 5) {
					data2[i2 + 0] = data2[i2 + 1] = data2[i2 + 2] = data2[i2 + 3] = 0;
					removed++;
				}
			}
		}
		if (removed > 0) { console.log(removed + " pixels remove from buff template image"); }
	}

	static readArg(buffer: ImageData, ox: number, oy: number, type: BuffTextTypes) {
		var lines: string[] = [];
		var firstResult: any = null;
		var firstResultY = oy;
		// Initial scan: dy=-10 (second line) and dy=0 (main line)
		for (var dy = -10; dy < 10; dy += 10) {
			var result = OCR.readLine(buffer, font, [255, 255, 255], ox, oy + dy, true);
			if (result.text) {
				if (!firstResult) { firstResult = result; firstResultY = oy + dy; }
				lines.push(result.text);
			}
		}
		// Fallback: oy-2 (old UI text position)
		if (lines.length === 0) {
			for (var dy = -10; dy < 10; dy += 10) {
				var result = OCR.readLine(buffer, font, [255, 255, 255], ox, oy - 2 + dy, true);
				if (result.text) {
					if (!firstResult) { firstResult = result; firstResultY = oy - 2 + dy; }
					lines.push(result.text);
				}
			}
			if (lines.length > 0) { oy = oy - 2; }
		}

		// Font1 retry system (dy=0 only)
		if (lines.length === 0) {
			var colors: ColortTriplet[] = [[255, 255, 255], [210, 210, 210]];
			for (var ci = 0; ci < colors.length && lines.length === 0; ci++) {
				for (var ddy = -2; ddy <= 2 && lines.length === 0; ddy++) {
					for (var ddx = 0; ddx <= 3 && lines.length === 0; ddx++) {
						var retryResult = OCR.readLine(buffer, font, colors[ci], ox + ddx, oy + ddy, true);
						if (retryResult.text) { lines.push(retryResult.text); }
					}
				}
			}
			// Last resort: backward at limited offsets
			if (lines.length === 0) {
				for (var ddy = -2; ddy <= 2 && lines.length === 0; ddy++) {
					for (var ddx = 0; ddx <= 1 && lines.length === 0; ddx++) {
						var retryResult = OCR.readLine(buffer, font, [255, 255, 255], ox + ddx, oy + ddy, true, true);
						if (retryResult.text && retryResult.text.trim() === retryResult.text) {
							lines.push(retryResult.text);
						}
					}
				}
			}
		}

		// Cache baseLine for reuse in decimal/second pass/m-detection/%
		var baseLine = OCR.readLine(buffer, font, [255, 255, 255], ox, oy, true);

		// Font2 system - only when font1 found <=1 char
		var joinedLen = lines.join("").length;
		if (joinedLen <= 1) {
			var botC = "";
			var botCY = -1;
			var topT = "";
			var parenFound = false;
			var botColors: ColortTriplet[] = [[255, 255, 255], [210, 210, 210], [255, 255, 0], [255, 152, 31]];

			// Scan entire buff with font2 — check each result for parens
			var bestParenLine = "";
			var bestParenY = -1;
			for (var bci = 0; bci < botColors.length; bci++) {
				for (var boy = 0; boy <= oy + 5; boy++) {
					for (var bcb = 0; bcb < 2; bcb++) {
						// Try font2 and fontLow (low threshold, no shadow, has "()" chars)
						for (var bfi = 0; bfi < 2; bfi++) {
						var br = OCR.readLine(buffer, bfi === 0 ? font2 : fontLow, botColors[bci], ox, boy, bcb === 0);
						if (!br.text) { continue; }
						// Keep longest overall for fallback
						if (br.text.length > botC.length) { botC = br.text; botCY = boy; }
						// Check for direct parens in cleaned text (only when font1 found nothing)
						var cleaned = br.text.replace(/[^0-9mhrK%()]/g, "");
						if (joinedLen === 0 && /^\d?\(\d/.test(cleaned) && cleaned.length > bestParenLine.length) {
							if (cleaned.indexOf(")") === -1) { cleaned += ")"; }
							bestParenLine = cleaned;
							bestParenY = boy;
						}
						// Check for dot pattern (font2 reads "(" as ".")
						var raw = br.text.replace(/ /g, "");
						if (raw.length >= 4 && raw.length <= 9) {
							// Situation 1: digit + dots + digit + dots — only when font1 found nothing (prevents debuff false positives)
							if (joinedLen === 0) {
								var dp1 = raw.match(/^(\d)\.{1,3}(\d)\.{1,3}$/);
								if (dp1) {
									var pl = dp1[1] + "(" + dp1[2] + ")";
									if (pl.length > bestParenLine.length) { bestParenLine = pl; bestParenY = boy; }
								}
							}
							// Situation 1b: dots + digit + dots — only when font1 found nothing (prevents debuff false positives)
							var dp2 = (joinedLen === 0) ? raw.match(/^\.{2,3}(\d)\.{1,3}$/) : null;
							if (dp2) {
								var pl2 = "(" + dp2[1] + ")";
								// Isolate buffer: grayscale with contrast stretch — use pixelOffset for correct pixel access
								var ld: string | null = null;
								var isoData = new ImageData(buffer.width, buffer.height);
								for (var iy = 0; iy < buffer.height; iy++) {
									for (var ix = 0; ix < buffer.width; ix++) {
										var srcI = buffer.pixelOffset(ix, iy);
										var dstI = (iy * buffer.width + ix) * 4;
										var iAvg = (buffer.data[srcI] + buffer.data[srcI+1] + buffer.data[srcI+2]) / 3;
										var iVal = iAvg > 200 ? 255 : (iAvg < 80 ? 0 : Math.round((iAvg - 80) * 255 / 120));
										isoData.data[dstI] = isoData.data[dstI+1] = isoData.data[dstI+2] = iVal;
										isoData.data[dstI+3] = 255;
									}
								}
								// Scan isolated buffer for leading digit — only at x=ox to ox+3 (before the parens area)
								var isoFonts = [font, font2, fontLow];
								for (var liy = boy - 4; liy <= boy && !ld; liy++) {
									if (liy < 0) { continue; }
									for (var ldx = 0; ldx <= 3 && !ld; ldx++) {
										for (var lfi = 0; lfi < isoFonts.length && !ld; lfi++) {
											var lr = OCR.readLine(isoData, isoFonts[lfi], [255, 255, 255], ox + ldx, liy, true);
											if (lr.text && /^\d$/.test(lr.text)) {
												ld = lr.text;
											}
										}
									}
								}
								// Pixel-level digit detection: check text pixel pattern at (ox, boy-2..boy-1)
								if (!ld) {
									var textPat: string[] = [];
									for (var ppy = boy - 2; ppy <= boy - 1; ppy++) {
										var pr = "";
										for (var ppx = ox; ppx < ox + 6 && ppx < buffer.width; ppx++) {
											if (ppy < 0 || ppy >= buffer.height) { pr += "0"; continue; }
											var ppi = buffer.pixelOffset(ppx, ppy);
											var ppR = buffer.data[ppi], ppG = buffer.data[ppi+1], ppB = buffer.data[ppi+2];
											var ppLum = (ppR + ppG + ppB) / 3;
											var ppMax = Math.max(ppR, ppG, ppB), ppMin = Math.min(ppR, ppG, ppB);
											var ppSat = ppMax > 0 ? ((ppMax - ppMin) / ppMax) * 255 : 0;
											pr += (ppLum > 140 && ppSat < 60) ? "1" : "0";
										}
										textPat.push(pr);
									}
									// "6" pattern: top row has text-gap-text (T?.Tx), bottom has .TTT.
									if (textPat.length === 2 && textPat[0][0] === "1" && textPat[0][2] === "0" && textPat[0][3] === "1" &&
										textPat[1][0] === "0" && textPat[1][1] === "1" && textPat[1][2] === "1" && textPat[1][3] === "1") {
										ld = "6";
									}
								}
								if (!ld) { ld = BuffReader.bestDigit(isoData, ox, boy, "1"); }
								if (ld) { pl2 = ld + pl2; }
								if (pl2.length >= bestParenLine.length) { bestParenLine = pl2; bestParenY = boy; }
							}
						}
						} // bfi
					}
				}
			}

			// If parens found, determine timer line
			if (bestParenLine && /^\d?\(\d+\)$/.test(bestParenLine)) {
				botC = bestParenLine;
				parenFound = true;
				// Situation 2: parens start with "(" — timer is on line above
				if (bestParenLine[0] === "(") {
					// Scan around bestParenY - 10 for timer
					for (var tci = 0; tci < botColors.length; tci++) {
						for (var toy = bestParenY - 12; toy <= bestParenY - 8; toy++) {
							if (toy < 0) { continue; }
							var tr = OCR.readLine(buffer, font2, botColors[tci], ox, toy, true);
							if (tr.text && tr.text.length > topT.length) { topT = tr.text; }
						}
					}
					topT = topT.replace(/[^0-9mhrK%]/g, "");
					// False-1 correction
					if (topT.length >= 1 && topT[0] === "1") {
						var bd = BuffReader.bestDigit(buffer, ox, bestParenY - 10, "1");
						if (bd) { topT = bd + topT.substring(1); }
					}
				}
			} else {
				// No parens found — clean botC for fallback, scan top for timer
				botC = botC.replace(/[^0-9mhrK%()]/g, "");
				if (/^\d?\(\d/.test(botC) && botC.indexOf(")") === -1) { botC += ")"; }
				for (var tci = 0; tci < botColors.length; tci++) {
					for (var toy = oy - 20; toy <= oy - 5; toy++) {
						if (toy < 0) { continue; }
						var tr = OCR.readLine(buffer, font2, botColors[tci], ox, toy, true);
						if (tr.text && tr.text.length > topT.length) { topT = tr.text; }
					}
				}
				topT = topT.replace(/[^0-9mhrK%]/g, "");

				// Grayscale fallback: try to find "(" on grayscale buffer
				if (lines.join("").length <= 1 && botC.indexOf("(") === -1) {
					var grayData = new ImageData(buffer.width, buffer.height);
					for (var gi = 0; gi < buffer.data.length; gi += 4) {
						var avg = (buffer.data[gi] + buffer.data[gi + 1] + buffer.data[gi + 2]) / 3;
						grayData.data[gi] = grayData.data[gi + 1] = grayData.data[gi + 2] = avg;
						grayData.data[gi + 3] = buffer.data[gi + 3];
					}
					var grayBotC = "";
					for (var gboy = 0; gboy <= oy + 5; gboy++) {
						var gbr = OCR.readLine(grayData, font2, [255, 255, 255], ox, gboy, true);
						if (gbr.text && gbr.text.length > grayBotC.length) { grayBotC = gbr.text; }
						gbr = OCR.readLine(grayData, font, [255, 255, 255], ox, gboy, true);
						if (gbr.text && gbr.text.length > grayBotC.length) { grayBotC = gbr.text; }
					}
					grayBotC = grayBotC.replace(/[^0-9mhrK%()]/g, "");
					var gpIdx = grayBotC.indexOf("(");
					if (gpIdx !== -1) {
						var gBefore = grayBotC.substring(0, gpIdx);
						var gAfter = grayBotC.substring(gpIdx + 1).replace(/\).*$/, "");
						if (/^\d{0,2}$/.test(gBefore) && /^\d{0,1}$/.test(gAfter)) {
							if (gAfter.length === 0) {
								for (var gcx = ox + 3; gcx <= ox + 15; gcx++) {
									var gc = OCR.readChar(grayData, font2, [255, 255, 255], gcx, oy, true);
									if (gc && /[0-9]/.test(gc.chr)) { gAfter = gc.chr; break; }
									gc = OCR.readChar(grayData, font, [255, 255, 255], gcx, oy, true);
									if (gc && /[0-9]/.test(gc.chr)) { gAfter = gc.chr; break; }
								}
							}
							if (gAfter.length > 0) {
								botC = gBefore + "(" + gAfter + ")";
								parenFound = true;
							}
						}
					}
				}
			}

			// Override: apply parens result
			if (parenFound && /^\d?\(\d+\)$/.test(botC)) {
				lines = [];
				if (topT) { lines.push(topT); }
				lines.push(botC);
			} else {
				if (lines.length === 0 && topT) { lines.push(topT); }
			}
		}

		var r = { time: 0, arg: "" };
		if (type == "timearg" && lines.length > 1) { r.arg = lines.pop()!; }
		var str = lines.join("");
		if (type == "arg") { r.arg = str; }
		else {
			var m;
			if (m = str.match(/^(\d+)hr($|\s?\()/i)) { r.time = +m[1] * 60 * 60; }
			else if (m = str.match(/^(\d+)m($|\s?\()/i)) { r.time = +m[1] * 60; }
			else if (m = str.match(/^(\d+)($|\s?\()/)) { r.time = +m[1]; }
		}

		// Decimal detection (X.Y debuff timers)
		if (str.length === 1 && /\d/.test(str)) {
			var baseEndX = baseLine.debugArea.w > 0 ? baseLine.debugArea.x + baseLine.debugArea.w : ox + 8;
			for (var dotOff = 3; dotOff <= 6; dotOff++) {
				var dotResult = OCR.readLine(buffer, font, [255, 255, 255], baseEndX + dotOff, oy, true);
				if (dotResult.text && /^\d$/.test(dotResult.text)) {
					str = str + "." + dotResult.text;
					r.arg = str;
					break;
				}
			}
		}

		// Second canblend pass - extend 1-2 digit readings
		if (str.length >= 1 && str.length <= 2 && /^\d+$/.test(str)) {
			// Use firstResult's xend if available (correct position when text found at different y)
			var endX = baseLine.debugArea.w > 0 ? baseLine.debugArea.x + baseLine.debugArea.w : ox + str.length * 7;
			var secondPassY = oy;
			if (firstResult && firstResult.fragments && firstResult.fragments.length > 0) {
				endX = firstResult.fragments[firstResult.fragments.length - 1].xend;
				secondPassY = firstResultY;
			}
			var suffix = OCR.readLine(buffer, font, [255, 255, 255], endX, secondPassY, true);
			if (!suffix.text) { suffix = OCR.readLine(buffer, font, [255, 255, 255], endX, secondPassY, false); }
			// For single digit, try x/y offsets with both fonts (handles "1" truncation + y-shifted text)
			if (str.length === 1 && !suffix.text) {
				for (var soff = 0; soff <= 2 && !suffix.text; soff++) {
					for (var syoff = 0; syoff <= 2 && !suffix.text; syoff++) {
						if (soff === 0 && syoff === 0) { continue; }
						suffix = OCR.readLine(buffer, font, [255, 255, 255], endX + soff, secondPassY - syoff, true);
						if (!suffix.text) {
							var sf2 = OCR.readLine(buffer, font2, [255, 255, 255], endX + soff, secondPassY - syoff, true);
							if (sf2.text && /^[0-9]/.test(sf2.text)) {
								var f2d = sf2.text.match(/^[0-9]+/);
								if (f2d) { suffix = { text: f2d[0], fragments: sf2.fragments, debugArea: sf2.debugArea }; }
							}
						}
					}
				}
			}
			if (suffix.text) {
				if (str.length === 2) {
					if (/^[mhrK%]/.test(suffix.text)) { str = str + suffix.text.charAt(0); r.arg = str; }
				} else {
					str = str + suffix.text; r.arg = str;
				}
			}
			// Trailing-1 recovery: try offsets when str ends with "1"
			if (str.endsWith("1") && /^\d+$/.test(str)) {
				for (var roff = 2; roff >= 0; roff--) {
					var rr = OCR.readLine(buffer, font, [255, 255, 255], endX + roff, oy, true);
					if (rr.text && rr.text.length >= 1 && rr.text.trim() === rr.text && rr.text !== "1") {
						str = str + rr.text; r.arg = str; break;
					}
				}
			}
		}

		// Stacked buff parens: if timer was found on upper line, scan for parens on lower line near oy
		if (/^\d+$/.test(str) && str.length >= 1 && firstResult && firstResultY < oy) {
			var spFound = false;
			// Method 1: font2 on raw buffer with dot pattern
			for (var pry = oy - 4; pry <= oy + 4 && !spFound; pry++) {
				if (pry < 0 || pry >= buffer.height) { continue; }
				for (var prx = -1; prx <= 1 && !spFound; prx++) {
					for (var prcb = 0; prcb < 2 && !spFound; prcb++) {
						var prr = OCR.readLine(buffer, font2, [255, 255, 255], ox + prx, pry, prcb === 0);
						if (prr.text) {
							var prRaw = prr.text.replace(/ /g, "");
							var prDp = prRaw.match(/^\.{1,3}(\d)\.{1,3}$/);
							if (prDp) { str = str + "(" + prDp[1] + ")"; r.arg = str; spFound = true; }
						}
					}
				}
			}
			// Create isolated buffer for methods 2-3
			var spIso = new ImageData(buffer.width, buffer.height);
			if (!spFound) {
				for (var siy = 0; siy < buffer.height; siy++) {
					for (var six = 0; six < buffer.width; six++) {
						var siSrc = buffer.pixelOffset(six, siy);
						var siDst = (siy * buffer.width + six) * 4;
						var siAvg = (buffer.data[siSrc] + buffer.data[siSrc+1] + buffer.data[siSrc+2]) / 3;
						var siVal = siAvg > 200 ? 255 : (siAvg < 80 ? 0 : Math.round((siAvg - 80) * 255 / 120));
						spIso.data[siDst] = spIso.data[siDst+1] = spIso.data[siDst+2] = siVal;
						spIso.data[siDst+3] = 255;
					}
				}
				var spFonts = [font2, font, fontLow];
				for (var pry = oy - 4; pry <= oy + 4 && !spFound; pry++) {
					for (var prx = -1; prx <= 1 && !spFound; prx++) {
						for (var spfi = 0; spfi < spFonts.length && !spFound; spfi++) {
							var srl = OCR.readLine(spIso, spFonts[spfi], [255, 255, 255], ox + prx, pry, true);
							if (srl.text) {
								var src2 = srl.text.replace(/[^0-9()]/g, "");
								if (/\(\d\)/.test(src2)) {
									var srm = src2.match(/\((\d)\)/);
									if (srm) {
										str = str + "(" + srm[1] + ")"; r.arg = str; spFound = true;
									}
								}
							}
						}
					}
				}
			}
			// Method 3: pixel-level white cluster detection on iso buffer
			if (!spFound) {
				for (var wpy = oy - 3; wpy <= oy + 2 && !spFound; wpy++) {
					if (wpy < 0 || wpy >= buffer.height) { continue; }
					var wStart = -1;
					var wCount = 0;
					for (var wpx = ox + 3; wpx < ox + 25 && !spFound; wpx++) {
						if (wpx >= buffer.width) { break; }
						var wpi = buffer.pixelOffset(wpx, wpy);
						var wR = buffer.data[wpi], wG = buffer.data[wpi+1], wB = buffer.data[wpi+2];
						if (wR > 230 && wG > 230 && wB > 230) {
							if (wStart === -1) { wStart = wpx; }
							wCount++;
						} else {
							if (wCount >= 3 && wStart > ox + 2) {
								// Bright cluster found — try readChar on iso buffer for the digit
								// Read the shadow line BELOW the cluster to identify the digit
								var wDigit = "";
								if (wpy + 1 < buffer.height) {
									// Build shadow pattern at y+1 (dark pixels = shadow of text above)
									var wShadow = "";
									for (var wpx2 = wStart - 1; wpx2 < wStart + wCount + 2 && wpx2 < buffer.width; wpx2++) {
										if (wpx2 < 0) { wShadow += "0"; continue; }
										var wsi = buffer.pixelOffset(wpx2, wpy + 1);
										var wsl = (buffer.data[wsi] + buffer.data[wsi+1] + buffer.data[wsi+2]) / 3;
										wShadow += wsl < 50 ? "1" : "0";
									}
									// Try readLine on raw buffer at the shadow row
									var srl = OCR.readLine(buffer, font2, [255, 255, 255], wStart, wpy + 1, true);
									// Also try bestDigit at y+1 (shadow position)
									var sbd = BuffReader.bestDigit(buffer, wStart, wpy + 1, "17");
									if (sbd) { wDigit = sbd; }
								}
								if (!wDigit) {
									var wbd = BuffReader.bestDigit(spIso, wStart, wpy, "17");
									if (!wbd) { wbd = BuffReader.bestDigit(buffer, wStart, wpy, "17"); }
									wDigit = wbd || "";
								}
								if (wDigit) {
									str = str + "(" + wDigit + ")";
									r.arg = str;
									spFound = true;
								}
							}
							wStart = -1;
							wCount = 0;
						}
					}
				}
			}
			// Method 4: grayscale scan for "(" near oy
			if (!spFound) {
				var grayData = new ImageData(buffer.width, buffer.height);
				for (var gi = 0; gi < buffer.data.length; gi += 4) {
					var avg = (buffer.data[gi] + buffer.data[gi + 1] + buffer.data[gi + 2]) / 3;
					grayData.data[gi] = grayData.data[gi + 1] = grayData.data[gi + 2] = avg;
					grayData.data[gi + 3] = buffer.data[gi + 3];
				}
				for (var pry = oy - 4; pry <= oy + 4 && !spFound; pry++) {
					for (var prx = -1; prx <= 1 && !spFound; prx++) {
						var grl = OCR.readLine(grayData, font2, [255, 255, 255], ox + prx, pry, true);
						if (grl.text) {
							var spc = grl.text.replace(/[^0-9()]/g, "");
							if (/^\d?\(\d\)$/.test(spc)) { str = str + spc.replace(/^\d/, ""); r.arg = str; spFound = true; }
							var spRaw = grl.text.replace(/ /g, "");
							var spDp = spRaw.match(/^\.{1,3}(\d)\.{1,3}$/);
							if (spDp) { str = str + "(" + spDp[1] + ")"; r.arg = str; spFound = true; }
						}
						grl = OCR.readLine(grayData, font, [255, 255, 255], ox + prx, pry, true);
						if (grl.text) {
							var spc2 = grl.text.replace(/[^0-9()]/g, "");
							if (/^\d?\(\d\)$/.test(spc2)) { str = str + spc2.replace(/^\d/, ""); r.arg = str; spFound = true; }
						}
					}
				}
			}
		}

		// "m" suffix detection via stroke groups
		if (/^\d+$/.test(str) && str.length >= 1) {
			var endpointX = baseLine.debugArea.w > 0 ? baseLine.debugArea.x + baseLine.debugArea.w : ox + str.length * 7;
			var strokeGroups = 0;
			var inBright = false;
			var firstBrightCol = -1;
			var brightColCount = 0;
			for (var sc = 0; sc < 14; sc++) {
				var sx = endpointX + sc;
				if (sx >= buffer.width) { break; }
				var hasBright = false;
				for (var sy = oy - 2; sy <= oy + 8; sy++) {
					if (sy < 0 || sy >= buffer.height) { continue; }
					var si = buffer.pixelOffset(sx, sy);
					var sR = buffer.data[si], sG = buffer.data[si + 1], sB = buffer.data[si + 2];
					var sLum = (sR + sG + sB) / 3;
					var sMax = Math.max(sR, sG, sB);
					var sMin = Math.min(sR, sG, sB);
					var sSat = sMax > 0 ? ((sMax - sMin) / sMax) * 255 : 0;
					if (sLum > 150 && sSat < 40) { hasBright = true; break; }
				}
				if (hasBright) {
					brightColCount++;
					if (firstBrightCol === -1) { firstBrightCol = sc; }
					if (!inBright) { strokeGroups++; inBright = true; }
				} else { inBright = false; }
			}

			// Bright icon check for single digits (prevent false "m" on stack counts)
			var isBrightIcon = false;
			if (str.length === 1) {
				var brightPixCount = 0;
				for (var biy = oy - 20; biy < oy - 5; biy++) {
					for (var bix = ox; bix < ox + 25; bix++) {
						if (bix < 0 || biy < 0 || bix >= buffer.width || biy >= buffer.height) { continue; }
						var bii = buffer.pixelOffset(bix, biy);
						var biR = buffer.data[bii], biG = buffer.data[bii + 1], biB = buffer.data[bii + 2];
						var biLum = (biR + biG + biB) / 3;
						var biMax = Math.max(biR, biG, biB);
						var biMin = Math.min(biR, biG, biB);
						var biSat = biMax > 0 ? ((biMax - biMin) / biMax) * 255 : 0;
						if (biLum > 150 && biSat < 40) { brightPixCount++; }
					}
				}
				if (brightPixCount > 60) { isBrightIcon = true; }
			}

			var isMinuteTimer = str.length >= 3 || (str.length === 2 && parseInt(str) >= 20);
			var mThreshold = isMinuteTimer ? 2 : 3;
			if (strokeGroups >= mThreshold && !isBrightIcon) { str = str + "m"; r.arg = str; }

			// Gap digit recovery: if 2-digit + firstBrightCol >= 2
			if (str.length === 2 && /^\d{2}$/.test(str) && firstBrightCol >= 2) {
				for (var gd = 0; gd < firstBrightCol; gd++) {
					var gc1 = OCR.readChar(buffer, font, [255, 255, 255], endpointX + gd, oy, true);
					if (gc1 && /[2-9]/.test(gc1.chr)) { str = str + gc1.chr; r.arg = str; break; }
				}
			}
		}

		// "%" suffix detection
		if (/^\d{2}$/.test(str)) {
			var pctEndX = baseLine.debugArea.w > 0 ? baseLine.debugArea.x + baseLine.debugArea.w : ox + 14;
			var brightPctPix = 0;
			for (var py = oy - 2; py <= oy + 8; py++) {
				for (var px = pctEndX; px < pctEndX + 10; px++) {
					if (px < 0 || py < 0 || px >= buffer.width || py >= buffer.height) { continue; }
					var pi = buffer.pixelOffset(px, py);
					var pR = buffer.data[pi], pG = buffer.data[pi + 1], pB = buffer.data[pi + 2];
					var pLum = (pR + pG + pB) / 3;
					var pMax = Math.max(pR, pG, pB);
					var pMin = Math.min(pR, pG, pB);
					var pSat = pMax > 0 ? ((pMax - pMin) / pMax) * 255 : 0;
					if (pLum > 150 && pSat < 40) { brightPctPix++; }
				}
			}
			if (brightPctPix >= 80) { str = str + "%"; r.arg = str; }
		}

		if (type === "arg") { r.arg = str; }
		return r;
	}

	private static bestDigit(buffer: ImageData, ox: number, oy: number, exclude: string): string | null {
		var best: { chr: string, sizescore: number } | null = null;
		var fonts = [font2, font, fontLow];
		for (var fi = 0; fi < fonts.length; fi++) {
			for (var ddx = 0; ddx <= 6; ddx++) {
				for (var ddy = -2; ddy <= 2; ddy++) {
					for (var cb = 0; cb < 2; cb++) {
						var rc = OCR.readChar(buffer, fonts[fi], [255, 255, 255], ox + ddx, oy + ddy, cb === 0);
						if (rc && /[0-9]/.test(rc.chr) && exclude.indexOf(rc.chr) === -1) {
							if (!best || rc.sizescore > best.sizescore) {
								best = { chr: rc.chr, sizescore: rc.sizescore };
							}
						}
					}
				}
			}
		}
		return best ? best.chr : null;
	}

	static readTime(buffer: ImageData, ox: number, oy: number) {
		return this.readArg(buffer, ox, oy, "time").time;
	}

	static matchBuff(state: Buff[], buffimg: ImageData) {
		for (var a in state) {
			if (state[a].compareBuffer(buffimg)) { return state[a]; }
		}
		return null;
	}

	static matchBuffMulti(state: Buff[], buffinfo: BuffInfo) {
		if (buffinfo.final) {//cheap way if we known exactly what we're searching for
			return BuffReader.matchBuff(state, buffinfo.imgdata);
		}
		else {//expensive way if we are not sure the template is final
			var bestindex = -1;
			var bestscore = 0;
			if (buffinfo.imgdata) {
				for (var a = 0; a < state.length; a++) {
					var count = BuffReader.countMatch(state[a].buffer, state[a].bufferx + 1, state[a].buffery + 1, buffinfo.imgdata, false);
					if (count.passed > bestscore) {
						bestscore = count.passed;
						bestindex = a;
					}
				}
			}
			if (bestscore < 50) { return null; }

			//update the isolated buff
			if (buffinfo.canimprove) {
				BuffReader.isolateBuffer(state[bestindex].buffer, state[bestindex].bufferx + 1, state[bestindex].buffery + 1, buffinfo.imgdata);
			}
			return state[bestindex];
		}
	}
}

export class BuffInfo {
	imgdata: ImageData;
	isdebuff: boolean;

	buffid: string;
	final: boolean;
	canimprove: boolean;

	constructor(imgdata: ImageData, debuff: boolean, id: string, canimprove: boolean) {
		this.imgdata = imgdata;
		this.isdebuff = debuff;

		this.buffid = id;
		this.final = !!id && !canimprove;
		this.canimprove = canimprove;
	}
}
