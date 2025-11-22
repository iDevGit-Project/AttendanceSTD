(function () {
    const skeleton = document.getElementById('studentsTableSkeleton');
    const tableWrapper = document.getElementById('studentsTableWrapper');
    const tbody = document.getElementById('studentsTable');

    // آدرس سرور (از Razor value)
    const refreshRowsUrl = '@refreshRowsUrl';
    const listPagedUrl = '@listPagedUrl';

    // حداقل زمان نمایش اسکلت (ms) — برای جلوگیری از flicker خیلی کوتاه
    const minSkeletonMs = 600;

    // timeout کلی برای درخواست (ms) — اگر سرور دیر پاسخ داد، پیام خطا نشان داده شود
    const fetchTimeoutMs = 15000;

    // کمک‌کننده: timeout برای fetch
    function fetchWithTimeout(url, options = {}, timeout = fetchTimeoutMs) {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        return fetch(url, { ...options, signal: controller.signal })
            .finally(() => clearTimeout(id));
    }

    // اگر سرور HTML ردیف‌ها را برمی‌گرداند (مثل RefreshAll) مستقیم innerHTML بزن
    // اگر JSON بازگشت، باید rows را بسازیم؛ این تابع یک fallback ساده از JSON به HTML انجام می‌دهد.
    function renderRowsFromJson(json) {
        if (!Array.isArray(json.students)) return '';
        return json.students.map(s => {
            const img = (s.photo || '/uploads/students/default.png').replace(/"/g, '&quot;');
            const fname = (s.firstName || '').replace(/"/g, '&quot;');
            const lname = (s.lastName || '').replace(/"/g, '&quot;');
            const nat = (s.nationalCode || '').replace(/"/g, '&quot;');
            const grade = (s.grade || '').replace(/"/g, '&quot;');
            const school = (s.schoolName || '').replace(/"/g, '&quot;');
            const coach = (s.coachName || '').replace(/"/g, '&quot;');
            const id = s.id;
            const status = s.isActive
                ? '<span class="inline-block px-2 py-1 text-xs font-bold text-teal-800 rounded bg-teal-100">فعال</span>'
                : '<span class="inline-block px-2 py-1 text-xs text-rose-800 rounded font-bold bg-rose-100">غیرفعال</span>';
            const actions = s.isActive
                ? `<button type="button" class="open-student-modal inline-block bg-slate-100 text-slate-800 px-2 py-1 rounded hover:bg-blue-200 font-bold transition" data-id="${id}" data-firstname="${fname}" data-lastname="${lname}" data-photo="${img}">جزئیات</button>
                               <button type="button" class="open-edit-modal inline-block bg-slate-100 text-amber-500 px-2 py-1 rounded hover:bg-amber-100 font-bold transition" data-id="${id}">ویرایش</button>
                               <button type="button" class="open-delete-modal inline-block bg-slate-100 text-rose-600 px-2 py-1 rounded hover:bg-rose-100 font-bold transition" data-id="${id}" data-name="${fname} ${lname}">غیرفعال</button>`
                : `<button type="button" class="open-student-modal inline-block bg-slate-100 text-slate-800 px-2 py-1 rounded hover:bg-blue-200 font-bold transition" data-id="${id}" data-firstname="${fname}" data-lastname="${lname}" data-photo="${img}">جزئیات</button>
                               <button type="button" class="open-restore-modal inline-block bg-slate-100 text-teal-500 px-2 py-1 rounded hover:bg-teal-100 font-bold transition" data-id="${id}">فعالسازی</button>`;

            return `<tr id="row-${id}" data-student-id="${id}" class="border-b hover:bg-slate-50">
                            <td class="px-2 py-1 align-middle"><img src="${img}" alt="عکس ${fname} ${lname}" class="w-10 h-10 object-cover rounded-full border" /></td>
                            <td class="px-2 py-1 text-sm align-middle">${fname}</td>
                            <td class="px-2 py-1 text-sm align-middle">${lname}</td>
                            <td class="px-2 py-1 text-sm align-middle">${nat}</td>
                            <td class="px-2 py-1 text-sm align-middle">${grade}</td>
                            <td class="px-2 py-1 text-sm align-middle">${school}</td>
                            <td class="px-2 py-1 text-sm align-middle">${coach}</td>
                            <td class="px-2 py-1 text-sm align-middle text-center">${status}</td>
                            <td class="px-2 py-1 text-sm align-middle">${actions}</td>
                        </tr>`;
        }).join('');
    }

    // اصلی: بارگذاری ردیف‌ها از سرور (پیش‌فرض تلاش با refreshRowsUrl که Partial HTML برمی‌گرداند)
    async function loadRowsAndShow() {
        const t0 = performance.now();
        try {
            // دو انتخاب: اول تلاش برای دریافت HTML از RefreshAll (partial rows)
            let res = null;
            try {
                res = await fetchWithTimeout(refreshRowsUrl + '?_ts=' + Date.now(), { credentials: 'same-origin' }, fetchTimeoutMs);
            } catch (err) {
                // اگر refreshRowsUrl موجود نبود یا خطا داشت، به لیست پِیجد fallback می‌کنیم
                console.warn('RefreshAll failed, will fallback to listPaged.', err);
            }

            let html = '';
            if (res && res.ok) {
                // بررسی content-type (html یا json)
                const ct = res.headers.get('content-type') || '';
                if (ct.indexOf('text/html') !== -1) {
                    html = await res.text(); // برگشت مستقیم ردیف‌های HTML (RowPartial ها)
                } else if (ct.indexOf('application/json') !== -1) {
                    const json = await res.json();
                    html = renderRowsFromJson(json);
                } else {
                    // اگر نوع مشخص نبود، سعی می‌کنیم متن را بگیریم و تشخیص دهیم
                    const txt = await res.text();
                    if (txt.trim().startsWith('<')) {
                        html = txt;
                    } else {
                        try {
                            const json = JSON.parse(txt);
                            html = renderRowsFromJson(json);
                        } catch (e) {
                            console.error('Unknown response from refreshRowsUrl:', txt);
                            html = '<tr><td colspan="9" class="px-3 py-4 text-center text-rose-600">خطا در بارگذاری اطلاعات</td></tr>';
                        }
                    }
                }
            } else {
                // fallback: call listPaged (JSON) to build rows
                const fallbackRes = await fetchWithTimeout(listPagedUrl + '?page=1&pageSize=50&_ts=' + Date.now(), { credentials: 'same-origin' }, fetchTimeoutMs);
                if (!fallbackRes.ok) throw new Error('Fallback listPaged failed: ' + fallbackRes.status);
                const json = await fallbackRes.json();
                html = renderRowsFromJson(json);
            }

            // حداقل زمان اسکلت را رعایت کن (برای جلوگیری از flicker)
            const elapsed = Math.max(0, performance.now() - t0);
            const wait = Math.max(0, minSkeletonMs - elapsed);
            if (wait > 0) await new Promise(r => setTimeout(r, wait));

            // جایگزینی tbody و نمایش جدول
            if (tbody) tbody.innerHTML = html;
            if (skeleton) skeleton.classList.add('hidden');
            if (tableWrapper) tableWrapper.classList.remove('hidden');

            // اگر در صفحه تابعِ bindAjaxForm یا سایر callbackها وجود دارد، اجرا کن (اختیاری)
            try { if (typeof bindAjaxForm === 'function') bindAjaxForm(); } catch (e) { /* ignore */ }
            try { if (typeof refreshInactiveCountOnPage === 'function') refreshInactiveCountOnPage(); } catch (e) { /* ignore */ }
        } catch (err) {
            console.error('Error loading rows:', err);
            // نمایش پیام خطا به کاربر داخل جدول
            if (tbody) tbody.innerHTML = '<tr><td colspan="9" class="px-3 py-4 text-center text-rose-600">خطا در دریافت اطلاعات. لطفاً دوباره تلاش کنید.</td></tr>';
            if (skeleton) skeleton.classList.add('hidden');
            if (tableWrapper) tableWrapper.classList.remove('hidden');
        }
    }

    // اجرا وقتی DOM آماده شد
    document.addEventListener('DOMContentLoaded', function () {
        // نمایش اسکلت و پنهان کردن جدول واقعی (حتماً اگر CSS دیگری دارد override شود)
        if (skeleton) skeleton.classList.remove('hidden');
        if (tableWrapper) tableWrapper.classList.add('hidden');

        // شروع بارگذاری async ردیف‌ها
        loadRowsAndShow();
    });
})();