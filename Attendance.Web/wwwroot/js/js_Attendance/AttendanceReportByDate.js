// AttendanceReportByDate.js
(function () {

    // 🔹 تبدیل شمسی به میلادی (مخصوص همین گزارش)
    function shamsiToGregorian(shamsi) {
        if (!shamsi) return null;

        const parts = shamsi.split('/');
        if (parts.length !== 3) return null;

        const jy = parseInt(parts[0], 10);
        const jm = parseInt(parts[1], 10);
        const jd = parseInt(parts[2], 10);

        if (!jy || !jm || !jd) return null;

        const g = jalali_to_gregorian(jy, jm, jd);
        return `${g[0]}-${String(g[1]).padStart(2, '0')}-${String(g[2]).padStart(2, '0')}`;
    }

    // 🔹 هسته تبدیل
    function jalali_to_gregorian(jy, jm, jd) {
        var gy;
        if (jy > 979) {
            gy = 1600;
            jy -= 979;
        } else {
            gy = 621;
        }

        var days =
            (365 * jy) +
            (parseInt(jy / 33) * 8) +
            parseInt(((jy % 33) + 3) / 4) +
            78 +
            jd +
            (jm < 7 ? (jm - 1) * 31 : ((jm - 7) * 30) + 186);

        gy += 400 * parseInt(days / 146097);
        days %= 146097;

        if (days > 36524) {
            gy += 100 * parseInt(--days / 36524);
            days %= 36524;
            if (days >= 365) days++;
        }

        gy += 4 * parseInt(days / 1461);
        days %= 1461;

        if (days > 365) {
            gy += parseInt((days - 1) / 365);
            days = (days - 1) % 365;
        }

        var gd = days + 1;
        var sal_a = [
            0, 31,
            (gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0) ? 29 : 28,
            31, 30, 31, 30, 31, 31, 30, 31, 30, 31
        ];

        var gm;
        for (gm = 0; gm < 13; gm++) {
            var v = sal_a[gm];
            if (gd <= v) break;
            gd -= v;
        }

        return [gy, gm, gd];
    }

    window.submitAttendanceReport = function () {
        const fromShamsi = document.getElementById('fromShamsi').value.trim();
        const toShamsi = document.getElementById('toShamsi').value.trim();

        if (!fromShamsi || !toShamsi) {
            Swal.fire({
                icon: 'warning',
                title: 'توجه',
                text: 'لطفاً بازه زمانی را کامل وارد کنید'
            });
            return;
        }

        const fromG = shamsiToGregorian(fromShamsi);
        const toG = shamsiToGregorian(toShamsi);

        if (!fromG || !toG) {
            Swal.fire({
                icon: 'error',
                title: 'خطا',
                text: 'فرمت تاریخ شمسی نادرست است'
            });
            return;
        }

        document.getElementById('fromGregorian').value = fromG;
        document.getElementById('toGregorian').value = toG;

        document.getElementById('report-form').submit();
    };

})();
