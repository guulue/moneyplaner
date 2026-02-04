(function () {
	const form = document.getElementById('calculatorForm');
	const resultsEl = document.getElementById('results');
	const fvEl = document.getElementById('fv');
	const totalContribEl = document.getElementById('totalContrib');
	const interestEarnedEl = document.getElementById('interestEarned');
	const scheduleBody = document.querySelector('#schedule tbody');
	const withdrawScheduleBody = document.querySelector('#withdrawSchedule tbody');
	const totalWithdrawnEl = document.getElementById('totalWithdrawn');

	const fmt = new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 2 });

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

		fvEl.textContent = fmt.format(output.futureValue);
		totalContribEl.textContent = fmt.format(output.totalContribution);
		interestEarnedEl.textContent = fmt.format(output.interestEarned);
		renderSchedule(output.schedule);
		totalWithdrawnEl.textContent = fmt.format(output.totalWithdrawn || 0);
		renderWithdrawSchedule(output.withdrawSchedule || []);
		resultsEl.classList.remove('hidden');
	});
})();

