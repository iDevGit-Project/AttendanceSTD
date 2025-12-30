(function () {
    function shamsiToGregorian(shamsi) {
        if (!shamsi) return null;

        const parts = shamsi.split('/');
        if (parts.length !== 3) return null;

        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const d = parseInt(parts[2], 10);

        // استفاده از Intl (بدون کتابخانه خارجی)
        const formatter = new Intl.DateTimeFormat('en-US-u-ca-gregory', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });

        const date = new Date(
            new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
                year: 'numeric',
                month: 'numeric',
                day: 'numeric'
            }).formatToParts(new Date(y, m - 1, d))
                .map(p => p.value).join('')
        );

        if (isNaN(date)) return null;

        return date.toISOString().split('T')[0]; // yyyy-MM-dd
    }
    function statusText(status, late) {
        if (status === 1) return '<span style="color:green">حاضر</span>';
        if (status === 2) return '<span style="color:red">غایب</span>';
        if (status === 3)
            return `<span style="color:orange">تأخیر (${late ?? 0} دقیقه)</span>`;
        if (status === 4) return '<span style="color:#555">غیبت موجه</span>';
        return '-';
    }

    document.getElementById('btnLoadReport').addEventListener('click', async () => {
        const fromShamsi = document.getElementById('fromDate').value.trim();
        const toShamsi = document.getElementById('toDate').value.trim();

        if (!fromShamsi || !toShamsi) {
            Swal.fire('خطا', 'بازه تاریخ را کامل وارد کنید', 'warning');
            return;
        }

        const from = shamsiToGregorian(fromShamsi);
        const to = shamsiToGregorian(toShamsi);

        if (!from || !to) {
            Swal.fire('خطا', 'فرمت تاریخ نامعتبر است', 'error');
            return;
        }

        Swal.fire({
            title: 'در حال دریافت اطلاعات...',
            allowOutsideClick: false,
            showConfirmButton: false,
            didOpen: () => Swal.showLoading()
        });

        const res = await fetch(`/Attendance/AttendanceReportByDate?from=${from}&to=${to}`);
        const data = await res.json();

        Swal.close();

        const tbody = document.getElementById('report-body');
        tbody.innerHTML = '';

        if (!data.length) {
            tbody.innerHTML = `
            <tr>
                <td colspan="3" class="text-center py-6 text-slate-500">
                    داده‌ای یافت نشد
                </td>
            </tr>`;
            return;
        }

        data.forEach(x => {
            tbody.insertAdjacentHTML('beforeend', `
            <tr>
                <td class="px-3 py-2 text-right">
                    <img src="${x.photo ?? '/uploads/students/default.png'}"
                         class="h-10 w-10 rounded object-cover">
                </td>
                <td class="px-3 py-2 text-center">${x.studentName}</td>
                <td class="px-3 py-2 text-center">
                    ${statusText(x.status, x.lateMinutes)}
                </td>
            </tr>
        `);
        });
    });


})();
