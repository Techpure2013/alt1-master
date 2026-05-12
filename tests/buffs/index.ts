import * as a1lib from "alt1/base";
import { webpackImages, ImgRefData } from "alt1/base";
import * as OCR from "alt1/ocr";
import BuffReader from "alt1/buffs";

globalThis.OCR = OCR;
globalThis.ImageDetect = a1lib.ImageDetect;
globalThis.a1lib = a1lib;

let tests = webpackImages({
	test1080p: import("./imgs/test1080p.data.png"),
	newui: import("./imgs/new.data.png"),
	more3: import("./imgs/more3.data.png"),
	dark59m: import("./imgs/59mdarker.data.png"),
	screen59m: import("./imgs/59mscreen.data.png"),
	mscreen1: import("./imgs/mscreenshot1.data.png"),
	bright1: import("./imgs/1bright.data.png"),
	bright2: import("./imgs/2bright.data.png"),
	bright3: import("./imgs/3bright.data.png"),
	bright4: import("./imgs/4bright.data.png"),
	bright5: import("./imgs/5bright.data.png"),
	bright6: import("./imgs/6bright.data.png"),
	bright7: import("./imgs/7bright.data.png"),
	bright8: import("./imgs/8bright.data.png"),
	bright9: import("./imgs/9bright.data.png"),
	bright10: import("./imgs/10bright.data.png"),
	debuff28: import("./imgs/2.8bright.data.png"),
	debuff30: import("./imgs/debuff30.data.png"),
	cap1: import("./imgs/capture_1_debuff.data.png"),
	cap2: import("./imgs/capture_2_debuff.data.png"),
	cap3: import("./imgs/capture_3_debuff.data.png"),
	cap4: import("./imgs/capture_4_debuff.data.png"),
	cap5: import("./imgs/capture_5_debuff.data.png"),
	cap6: import("./imgs/capture_6_debuff.data.png"),
	cap7: import("./imgs/capture_7_debuff.data.png"),
	buff32m: import("./imgs/32mreadsas62m.data.png"),
	buff37m: import("./imgs/37mreadas372.data.png"),
	buff45m: import("./imgs/buff45m.data.png"),
	buff47m: import("./imgs/buff47m.data.png"),
	buff49m: import("./imgs/buff49m.data.png"),
	parens: import("./imgs/parens.data.png"),
	parens2: import("./imgs/parens2.data.png"),
	parens3: import("./imgs/parens3.data.png"),
	familiarTimer30m: import("./imgs/familiarTimer30m.data.png"),
	famtimer: import("./imgs/famtimer.data.png"),
	famtimer2: import("./imgs/famtimer2.data.png"),
	dismember14: import("./imgs/14dismember.data.png"),
	glowbuff: import("./imgs/buffs_2026-05-10T21-43-07.data.png"),
	bigbar: import("./imgs/bigbar.data.png"),
});

type Expected = { buffs: (string | null)[], debuffs: (string | null)[] };
let expected: { [key: string]: Expected } = {
	test1080p: {
		buffs: [null, "60", "18m", "170m", null, "1K", "94%", null],
		debuffs: ["1.3"]
	},
	newui: {
		buffs: ["16", "50", null, null],
		debuffs: ["2.9"]
	},
	more3: {
		buffs: ["3", "9", "50", null, null, null],
		debuffs: ["3.3"]
	},
	dark59m: {
		buffs: ["50", "4m", "59m", null],
		debuffs: []
	},
	screen59m: {
		buffs: ["50", "5m", "59m", null],
		debuffs: []
	},
	mscreen1: {
		buffs: ["50", "6m", null],
		debuffs: []
	},
	bright1: { buffs: ["1", "50", "39m", null], debuffs: [] },
	bright2: { buffs: ["2", "50", "38m", null], debuffs: [] },
	bright3: { buffs: ["3", "50", "38m", null], debuffs: [] },
	bright4: { buffs: ["4", "50", "36m", null], debuffs: [] },
	bright5: { buffs: ["5", "50", "36m", null], debuffs: [] },
	bright6: { buffs: ["6", "50", "35m", null], debuffs: [] },
	bright7: { buffs: ["7", "50", "29m", null], debuffs: [] },
	bright8: { buffs: ["8", "50", "29m", null], debuffs: [] },
	bright9: { buffs: ["9", "50", "29m", null], debuffs: [] },
	bright10: { buffs: ["10", "50", "28m", null], debuffs: [] },
	debuff28: {
		buffs: ["50", "2m", "2m", "56m", null, "8", "3", "4"],
		debuffs: ["2.8", "1"]
	},
	debuff30: { buffs: ["50", null], debuffs: ["3.0"] },
	cap1: { buffs: [], debuffs: ["2.0"] },
	cap2: { buffs: [], debuffs: ["2.0"] },
	cap3: { buffs: [], debuffs: ["2.0"] },
	cap4: { buffs: [], debuffs: ["2.0"] },
	cap5: { buffs: [], debuffs: ["3.5"] },
	cap6: { buffs: [], debuffs: ["3.5"] },
	cap7: { buffs: [], debuffs: ["3.5"] },
	buff32m: { buffs: ["50", "32m", null], debuffs: [] },
	buff37m: { buffs: ["50", "37m", null], debuffs: [] },
	buff45m: { buffs: ["50", "45m", null], debuffs: [] },
	buff47m: { buffs: ["50", "47m", null], debuffs: [] },
	buff49m: { buffs: ["50", "49m", null], debuffs: [] },
	parens: { buffs: [null, "16(2)", "4", "60", "216m", null], debuffs: [] },
	parens2: { buffs: ["11(2)", "4", "4m"], debuffs: [] },
	parens3: { buffs: ["6(3)", "4", "5m"], debuffs: [] },
	familiarTimer30m: { buffs: ["5", "7", "16", "3", "11m", null, "30m"], debuffs: ["2.9"] },
	famtimer: { buffs: ["53", null, "34"], debuffs: ["2.9"] },
	famtimer2: { buffs: ["53", null, "63m"], debuffs: ["2.9"] },
	dismember14: { buffs: ["14", "4", "8m", "8", "8"], debuffs: [] },
	glowbuff: { buffs: ["10", "2"], debuffs: [] },
	bigbar: { buffs: [null, "25", "2", "60", "89m", "6%", "3", "3", "3", "3", "3", "3"], debuffs: [] }
};


export default async function run() {
	await tests.promise;

	let totalPass = 0;
	let totalFail = 0;

	for (let testid in tests.raw) {
		console.log(`\n========== ${testid} ==========`);
		let img = new ImgRefData(tests[testid]);
		let imgdata = img.toData();
		imgdata.show();

		let exp = expected[testid];

		for (let isDebuff of [false, true]) {
			let label = isDebuff ? "DEBUFF" : "BUFF";
			let expValues = isDebuff ? exp.debuffs : exp.buffs;
			let reader = new BuffReader();
			reader.debuffs = isDebuff;

			let found = reader.find(img);

			if (!found || !reader.pos) {
				console.log(`  ${label}: not found`);
				for (let e of expValues) {
					if (e !== null) { console.log(`    FAIL: expected "${e}" but bar not found`); totalFail++; }
				}
				continue;
			}

			console.log(`  ${label} found: pos=[${reader.pos.x},${reader.pos.y}]`);

			// Use getCaptRect to match live behavior (includes padLeft for dim buffs)
			let captRect = reader.getCaptRect()!;
			let cropX = captRect.x;
			let cropY = captRect.y;
			let cropW = Math.min(captRect.width, imgdata.width - cropX);
			let cropH = Math.min(captRect.height, imgdata.height - cropY);
			let croppedBuffer = imgdata.clone({ x: cropX, y: cropY, width: cropW, height: cropH });

			let buffs: any[] | null = null;
			try { buffs = reader.read(croppedBuffer); } catch (e) {
				console.log(`  ${label} read ERROR: ${e}`); continue;
			}

			if (!buffs) { console.log(`  ${label}: read returned null`); continue; }

			let maxIdx = Math.max(buffs.length, expValues.length);
			for (let i = 0; i < maxIdx; i++) {
				let expVal = i < expValues.length ? expValues[i] : null;
				let actual = "";

				if (i < buffs.length) {
					try {
						let argResult = buffs[i].readArg("arg" as any);
						actual = argResult.arg || "";
					} catch (e) { actual = `ERROR: ${e}`; }
				}

				let status = "";
				if (expVal === null && actual === "") {
					status = "PASS (no timer)";
					totalPass++;
				} else if (expVal === null && actual !== "") {
					status = `FAIL: expected no timer, got "${actual}"`;
					totalFail++;
				} else if (expVal !== null && actual === "") {
					status = `FAIL: expected "${expVal}", got nothing`;
					totalFail++;
				} else if (expVal !== null && actual === expVal) {
					status = `PASS ✓`;
					totalPass++;
				} else {
					status = `FAIL: expected "${expVal}", got "${actual}"`;
					totalFail++;
				}

				console.log(`    ${label} ${i}: ${status}${actual ? ` [read: "${actual}"]` : ""}`);
			}
		}
	}

	console.log("\n==================================================");
	console.log(`RESULTS: ${totalPass} PASS, ${totalFail} FAIL`);
	console.log("==================================================");
}
