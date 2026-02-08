(function () {
	const form = document.getElementById('calculatorForm');
	const resultsEl = document.getElementById('results');
	const fvEl = document.getElementById('fv');
	const totalContribEl = document.getElementById('totalContrib');
	const interestEarnedEl = document.getElementById('interestEarned');
	const scheduleBody = document.querySelector('#schedule tbody');
	const withdrawScheduleBody = document.querySelector('#withdrawSchedule tbody');
	const totalWithdrawnEl = document.getElementById('totalWithdrawn');
	const exportPdfBtn = document.getElementById('exportPdfBtn');

	const fmt = new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 2 });

	let lastOutput = null;
	let lastParams = null;

	function parsePositiveNumber(input) {
		const value = Number(input.value);
		return Number.isFinite(value) && value >= 0 ? value : 0;
	}

	function calculate({ principal, annualRatePercent, compoundsPerYear, monthlyContribution, years, withdrawRatePercent }) {
		const annualRate = annualRatePercent / 100;
		const totalMonths = Math.round(years * 12);

		// แปลงอัตรานอมินัล r ที่ทบ n ครั้ง/ปี ให้เทียบเท่ารายเดือน
		const monthlyGrowthFactor = Math.pow(1 + annualRate / compoundsPerYear, compoundsPerYear / 12);
		const yearlyGrowthFactor = Math.pow(1 + annualRate / compoundsPerYear, compoundsPerYear);

		let balance = principal;
		let totalContribution = principal;
		const rows = [];
		const withdrawRows = [];

		for (let month = 1; month <= totalMonths; month++) {
			// ทบต้นรายเดือนแบบอัตราเทียบเท่า
			balance *= monthlyGrowthFactor;

			// เติมเงินปลายเดือน
			if (monthlyContribution > 0) {
				balance += monthlyContribution;
				totalContribution += monthlyContribution;
			}

			// บันทึกเมื่อจบปี
			if (month % 12 === 0) {
				const yearIndex = month / 12;
				const interestEarned = balance - totalContribution;
				rows.push({
					year: yearIndex,
					totalContribution,
					interestEarned,
					endingBalance: balance
				});
			}
		}

		// ช่วงถอนเงิน 50 ปี หลังจากสะสมครบปีที่กำหนด
		const withdrawRate = (withdrawRatePercent || 0) / 100;
		let totalWithdrawn = 0;

		if (withdrawRate > 0) {
			for (let i = 1; i <= 50; i++) {
				const yearNumberFromStart = years + i;
				// ยอดต้นปีคือยอดปลายปีของปีก่อนหน้า
				let startOfYearBalance = balance;

				// ให้เงินเติบโตทั้งปี
				balance *= yearlyGrowthFactor;

				// ถอนเป็นเปอร์เซ็นต์ของยอดปลายปีก่อนถอน
				const withdrawAmount = balance * withdrawRate;
				balance -= withdrawAmount;
				totalWithdrawn += withdrawAmount;

				withdrawRows.push({
					yearFromStart: yearNumberFromStart,
					startOfYearBalance,
					withdrawAmount,
					monthlyWithdraw: withdrawAmount / 12,
					endingBalance: balance
				});
			}
		}

		return {
			futureValue: balance,
			totalContribution,
			interestEarned: balance - totalContribution,
			schedule: rows,
			withdrawSchedule: withdrawRows,
			totalWithdrawn
		};
	}

	function renderSchedule(rows) {
		scheduleBody.innerHTML = '';
		for (const row of rows) {
			const tr = document.createElement('tr');
			tr.innerHTML = `
				<td>${row.year}</td>
				<td>${fmt.format(row.totalContribution)}</td>
				<td>${fmt.format(row.interestEarned)}</td>
				<td>${fmt.format(row.endingBalance)}</td>
			`;
			scheduleBody.appendChild(tr);
		}
	}

	function renderWithdrawSchedule(rows) {
		withdrawScheduleBody.innerHTML = '';
		for (const row of rows) {
			const tr = document.createElement('tr');
			tr.innerHTML = `
				<td>${row.yearFromStart}</td>
				<td>${fmt.format(row.startOfYearBalance)}</td>
				<td>${fmt.format(row.withdrawAmount)}</td>
				<td>${fmt.format(row.monthlyWithdraw)}</td>
				<td>${fmt.format(row.endingBalance)}</td>
			`;
			withdrawScheduleBody.appendChild(tr);
		}
	}

	form.addEventListener('submit', function (e) {
		e.preventDefault();
		const principal = parsePositiveNumber(document.getElementById('principal'));
		const rate = parsePositiveNumber(document.getElementById('rate'));
		const n = parsePositiveNumber(document.getElementById('n')) || 1;
		const contribution = parsePositiveNumber(document.getElementById('contribution'));
		const years = parsePositiveNumber(document.getElementById('years')) || 10;
		const withdrawRatePercent = parsePositiveNumber(document.getElementById('withdrawRate'));

		const output = calculate({
			principal,
			annualRatePercent: rate,
			compoundsPerYear: n,
			monthlyContribution: contribution,
			years,
			withdrawRatePercent
		});

		lastOutput = output;
		lastParams = { principal, rate, n, contribution, years, withdrawRatePercent };

		fvEl.textContent = fmt.format(output.futureValue);
		totalContribEl.textContent = fmt.format(output.totalContribution);
		interestEarnedEl.textContent = fmt.format(output.interestEarned);
		renderSchedule(output.schedule);
		totalWithdrawnEl.textContent = fmt.format(output.totalWithdrawn || 0);
		renderWithdrawSchedule(output.withdrawSchedule || []);
		resultsEl.classList.remove('hidden');
	});

	function exportToPdf() {
		if (!lastOutput || !lastParams) return;
		exportPdfBtn.disabled = true;
		exportPdfBtn.textContent = 'กำลังสร้าง PDF...';

		const doExport = function () {
			const report = buildPdfReport();
			const el = document.createElement('div');
			el.innerHTML = report;
			el.style.cssText = 'position:fixed;top:0;left:0;z-index:99999;width:794px;max-width:100vw;background:#fff;overflow:auto;';
			document.body.appendChild(el);
			el.scrollIntoView({ behavior: 'instant' });

			const filename = 'รายงานแผนเกษียณ_' + new Date().toISOString().slice(0, 10) + '.pdf';
			const margin = 10;
			const scale = 2;

			html2canvas(el, {
				scale: scale,
				useCORS: true,
				allowTaint: true,
				logging: false
			}).then(function (canvas) {
				const imgData = canvas.toDataURL('image/jpeg', 0.95);
				const imgWidth = 210 - margin * 2;
				const imgHeight = (canvas.height * imgWidth) / canvas.width;
				const pdf = new jspdf.jsPDF({
					orientation: 'portrait',
					unit: 'mm',
					format: [210, imgHeight + margin * 2]
				});
				pdf.addImage(imgData, 'JPEG', margin, margin, imgWidth, imgHeight);
				pdf.save(filename);
			}).catch(function (err) {
				console.error(err);
			}).finally(function () {
				document.body.removeChild(el);
				exportPdfBtn.disabled = false;
				exportPdfBtn.textContent = 'Export รายงานแผนเกษียณ (PDF)';
			});
		};

		if (document.fonts && document.fonts.ready) {
			document.fonts.ready.then(function () { setTimeout(doExport, 50); });
		} else {
			setTimeout(doExport, 50);
		}
	}

	function buildPdfReport() {
		const p = lastParams;
		const o = lastOutput;
		const compoundLabels = { 1: 'ปีละครั้ง', 4: 'ไตรมาสละครั้ง', 12: 'เดือนละครั้ง', 365: 'รายวัน' };

		let scheduleRows = '';
		(o.schedule || []).forEach(function (r) {
			scheduleRows += '<tr><td>' + r.year + '</td><td style="text-align:right">' + fmt.format(r.totalContribution) + '</td><td style="text-align:right">' + fmt.format(r.interestEarned) + '</td><td style="text-align:right">' + fmt.format(r.endingBalance) + '</td></tr>';
		});

		let withdrawRows = '';
		(o.withdrawSchedule || []).forEach(function (r) {
			withdrawRows += '<tr><td>' + r.yearFromStart + '</td><td style="text-align:right">' + fmt.format(r.startOfYearBalance) + '</td><td style="text-align:right">' + fmt.format(r.withdrawAmount) + '</td><td style="text-align:right">' + fmt.format(r.monthlyWithdraw) + '</td><td style="text-align:right">' + fmt.format(r.endingBalance) + '</td></tr>';
		});

		const dateStr = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });

		return `
		<div class="pdf-report" style="font-family: 'Sarabun', 'Segoe UI', sans-serif; color: #1e293b; padding: 16px; background: #fff;">
			<style>
				.pdf-report h1 { font-size: 22px; color: #0f172a; margin: 0 0 4px 0; border-bottom: 3px solid #10b981; padding-bottom: 8px; }
				.pdf-report .meta { color: #64748b; font-size: 12px; margin-bottom: 20px; }
				.pdf-report h2 { font-size: 16px; color: #334155; margin: 20px 0 10px 0; }
				.pdf-report .params { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; }
				.pdf-report .params table { width: 100%; font-size: 13px; }
				.pdf-report .params td { padding: 4px 8px; }
				.pdf-report .params td:first-child { color: #64748b; width: 45%; }
				.pdf-report .cards { display: flex; flex-wrap: wrap; gap: 12px; margin: 16px 0; }
				.pdf-report .card { background: linear-gradient(135deg, #f0fdf4, #ecfdf5); border: 1px solid #a7f3d0; border-radius: 10px; padding: 14px 18px; min-width: 140px; }
				.pdf-report .card .label { font-size: 11px; color: #047857; }
				.pdf-report .card .value { font-size: 18px; font-weight: 700; color: #065f46; }
				.pdf-report table.data { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 20px; }
				.pdf-report table.data th, .pdf-report table.data td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: right; }
				.pdf-report table.data th { background: #0f172a; color: #f8fafc; font-weight: 600; }
				.pdf-report table.data th:first-child, .pdf-report table.data td:first-child { text-align: left; }
				.pdf-report table.data tr:nth-child(even) { background: #f8fafc; }
			</style>
			<h1>รายงานแผนเกษียณ</h1>
			<p class="meta">จัดทำเมื่อ ${dateStr} | โหมดดอกเบี้ยคงที่ (DCA รายเดือน)</p>

			<h2>พารามิเตอร์ที่ใช้</h2>
			<div class="params">
				<table>
					<tr><td>เงินตั้งต้น (บาท)</td><td>${fmt.format(p.principal)}</td></tr>
					<tr><td>อัตราดอกเบี้ยต่อปี (%)</td><td>${p.rate}%</td></tr>
					<tr><td>การทบต้น</td><td>${compoundLabels[p.n] || p.n + ' ครั้ง/ปี'}</td></tr>
					<tr><td>เติมเงินประจำต่อเดือน (บาท)</td><td>${fmt.format(p.contribution)}</td></tr>
					<tr><td>ระยะเวลา DCA / สะสมเงิน (ปี)</td><td>${p.years} ปี</td></tr>
					<tr><td>เปอร์เซ็นต์ถอนต่อปีหลังหยุด DCA (%)</td><td>${p.withdrawRatePercent}%</td></tr>
				</table>
			</div>

			<h2>สรุปผลการคำนวณ</h2>
			<div class="cards">
				<div class="card"><div class="label">มูลค่าในอนาคต (หลังสะสมครบ)</div><div class="value">${fmt.format(o.futureValue)}</div></div>
				<div class="card"><div class="label">เงินต้นรวมที่ใส่</div><div class="value">${fmt.format(o.totalContribution)}</div></div>
				<div class="card"><div class="label">ดอกเบี้ยที่ได้รับ</div><div class="value">${fmt.format(o.interestEarned)}</div></div>
				<div class="card"><div class="label">รวมเงินที่ถอนได้ใน 50 ปี</div><div class="value">${fmt.format(o.totalWithdrawn || 0)}</div></div>
			</div>

			<h2>ตารางสรุปรายปี (ช่วงสะสม DCA)</h2>
			<table class="data">
				<thead><tr><th>ปี</th><th>เงินต้นสะสม (บาท)</th><th>ดอกเบี้ยสะสม (บาท)</th><th>ยอดรวมปลายปี (บาท)</th></tr></thead>
				<tbody>${scheduleRows}</tbody>
			</table>

			<h2>ตารางถอนเงิน 50 ปี หลังหยุด DCA</h2>
			<table class="data">
				<thead><tr><th>ปี</th><th>ยอดต้นปีก่อนถอน (บาท)</th><th>ยอดถอนต่อปี (บาท)</th><th>ยอดถอนต่อเดือน (บาท)</th><th>ยอดคงเหลือปลายปี (บาท)</th></tr></thead>
				<tbody>${withdrawRows}</tbody>
			</table>

			<p style="font-size: 10px; color: #94a3b8;">สูตร: FV = P(1 + r/n)^(nt) + PMT × [((1 + r/n)^(nt) - 1) / (r/n)]</p>
		</div>`;
	}

	if (exportPdfBtn) {
		exportPdfBtn.addEventListener('click', function () {
			exportToPdf();
		});
	}
})();

