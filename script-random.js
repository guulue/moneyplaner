(function () {
	const form = document.getElementById('calculatorForm');
	const resultsEl = document.getElementById('results');
	const fvEl = document.getElementById('fv');
	const totalContribEl = document.getElementById('totalContrib');
	const interestEarnedEl = document.getElementById('interestEarned');
	const totalWithdrawnEl = document.getElementById('totalWithdrawn');
	const scheduleBody = document.querySelector('#schedule tbody');
	const withdrawScheduleBody = document.querySelector('#withdrawSchedule tbody');

	const fmt = new Intl.NumberFormat('th-TH', {
		style: 'currency',
		currency: 'THB',
		maximumFractionDigits: 2
	});

	function parsePositiveNumber(input) {
		const value = Number(input.value);
		return Number.isFinite(value) && value >= 0 ? value : 0;
	}

	function generateRandomRates({ baseRatePercent, deviationPercent, totalYears }) {
		const rates = [];
		const devRatio = (deviationPercent || 0) / 100;
		const base = baseRatePercent;
		const delta = base * devRatio;
		const min = Math.max(0, base - delta);
		const max = base + delta;

		for (let y = 1; y <= totalYears; y++) {
			const r = min + Math.random() * (max - min); // หน่วยเป็น %
			rates.push(r / 100); // เก็บเป็นอัตราทศนิยม
		}
		return rates;
	}

	function calculate({
		principal,
		baseRatePercent,
		deviationPercent,
		compoundsPerYear,
		monthlyContribution,
		years,
		withdrawRatePercent
	}) {
		const totalInvestYears = years;
		const totalWithdrawYears = 50;
		const totalYears = totalInvestYears + totalWithdrawYears;

		// สร้างอัตราดอกเบี้ยแบบสุ่มสำหรับทุกปี (ทั้งช่วงสะสมและช่วงถอน)
		const yearlyRates = generateRandomRates({
			baseRatePercent,
			deviationPercent,
			totalYears
		});

		const totalMonths = Math.round(totalInvestYears * 12);

		let balance = principal;
		let totalContribution = principal;

		const investRows = [];
		const withdrawRows = [];

		// ช่วงสะสมเงิน (DCA)
		for (let month = 1; month <= totalMonths; month++) {
			const yearIndex = Math.ceil(month / 12) - 1; // 0-based
			const annualRate = yearlyRates[yearIndex]; // ทศนิยม เช่น 0.08

			// growth factor ตามอัตราดอกเบี้ยของปีนั้น ๆ
			const monthlyGrowthFactor = Math.pow(1 + annualRate / compoundsPerYear, compoundsPerYear / 12);

			// ดอกเบี้ยทบต้นรายเดือน
			balance *= monthlyGrowthFactor;

			// เติมเงินปลายเดือน
			if (monthlyContribution > 0) {
				balance += monthlyContribution;
				totalContribution += monthlyContribution;
			}

			// บันทึกเมื่อจบปี
			if (month % 12 === 0) {
				const yearNumber = month / 12;
				const interestEarned = balance - totalContribution;
				const usedAnnualRatePercent = yearlyRates[yearNumber - 1] * 100;

				investRows.push({
					year: yearNumber,
					ratePercent: usedAnnualRatePercent,
					totalContribution,
					interestEarned,
					endingBalance: balance
				});
			}
		}

		// ช่วงถอนเงิน 50 ปี
		const withdrawRate = (withdrawRatePercent || 0) / 100;
		let totalWithdrawn = 0;

		if (withdrawRate > 0) {
			for (let i = 1; i <= totalWithdrawYears; i++) {
				const overallYearIndex = totalInvestYears + i - 1; // 0-based index ใน yearlyRates
				const annualRate = yearlyRates[overallYearIndex];
				const yearlyGrowthFactor = Math.pow(1 + annualRate / compoundsPerYear, compoundsPerYear);

				const yearNumberFromStart = totalInvestYears + i;

				// ยอดต้นปี = ยอดปลายปีของปีก่อนหน้า
				const startOfYearBalance = balance;

				// ให้เงินเติบโตทั้งปีด้วยอัตราของปีนั้น
				balance *= yearlyGrowthFactor;

				// ถอนเป็นเปอร์เซ็นต์ของยอดปลายปีก่อนถอน
				const withdrawAmount = balance * withdrawRate;
				balance -= withdrawAmount;
				totalWithdrawn += withdrawAmount;

				const usedAnnualRatePercent = annualRate * 100;

				withdrawRows.push({
					yearFromStart: yearNumberFromStart,
					ratePercent: usedAnnualRatePercent,
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
			schedule: investRows,
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
				<td>${row.ratePercent.toFixed(2)}%</td>
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
				<td>${row.ratePercent.toFixed(2)}%</td>
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
		const baseRatePercent = parsePositiveNumber(document.getElementById('rate'));
		const deviationPercent = parsePositiveNumber(document.getElementById('deviation'));
		const n = parsePositiveNumber(document.getElementById('n')) || 1;
		const contribution = parsePositiveNumber(document.getElementById('contribution'));
		const years = parsePositiveNumber(document.getElementById('years')) || 10;
		const withdrawRatePercent = parsePositiveNumber(document.getElementById('withdrawRate'));

		const output = calculate({
			principal,
			baseRatePercent,
			deviationPercent,
			compoundsPerYear: n,
			monthlyContribution: contribution,
			years,
			withdrawRatePercent
		});

		fvEl.textContent = fmt.format(output.futureValue);
		totalContribEl.textContent = fmt.format(output.totalContribution);
		interestEarnedEl.textContent = fmt.format(output.interestEarned);
		totalWithdrawnEl.textContent = fmt.format(output.totalWithdrawn || 0);

		renderSchedule(output.schedule);
		renderWithdrawSchedule(output.withdrawSchedule);

		resultsEl.classList.remove('hidden');
	});
})();

