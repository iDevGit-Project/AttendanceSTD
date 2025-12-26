// SessionDetails.printWithSwal.js
(function () {
    const wait = (ms) => new Promise(r => setTimeout(r, ms));

    function showSwalFallback(type, title, html, options = {}) {
        if (typeof Swal !== 'undefined') {
            return Swal.fire(Object.assign({
                icon: type,
                title: title,
                html: `<div style="direction: rtl;">${html}</div>`,
                confirmButtonText: 'قبول و بازگشت'
            }, options));
        } else {
            alert(title + "\n" + html);
            return Promise.resolve();
        }
    }

    function extractRealStatus(cell) {
        const select = cell.querySelector('select');
        if (select && select.selectedIndex >= 0) {
            return select.options[select.selectedIndex].text.trim();
        }

        const checkedRadio = cell.querySelector('input[type="radio"]:checked');
        if (checkedRadio) {
            const lbl = cell.querySelector(`label[for="${checkedRadio.id}"]`);
            return lbl ? lbl.innerText.trim() : checkedRadio.value;
        }

        if (cell.dataset?.status) return cell.dataset.status.trim();

        const span = cell.querySelector('span');
        if (span) return span.innerText.trim();

        return cell.innerText.trim();
    }

    function createStatusCell(text) {
        const td = document.createElement('td');
        td.style.textAlign = 'center';
        td.style.padding = '4px 8px';
        td.style.fontWeight = '600';
        td.innerText = text;

        const lower = text.toLowerCase();
        if (lower.includes('حاضر')) td.style.color = '#008000';
        else if (lower.includes('غایب')) td.style.color = '#ff0000';
        else if (lower.includes('تأخیر')) td.style.color = '#ffa500';

        return td;
    }

    window.printSessionDetailsWithSwal = async function () {
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: 'در حال آماده‌سازی گزارش...',
                allowOutsideClick: false,
                showConfirmButton: false,
                didOpen: () => Swal.showLoading()
            });
        }

        try {
            const tbody = document.getElementById('session-details-table-body');
            if (!tbody) {
                Swal.close();
                await showSwalFallback('error', 'خطا!', 'جدول پیدا نشد');
                return;
            }

            const rows = Array.from(tbody.rows).filter(r => !r.querySelector('[colspan]'));
            if (!rows.length) {
                Swal.close();
                await showSwalFallback('warning', 'هشدار!', 'داده‌ای برای چاپ وجود ندارد');
                return;
            }

            // 🔴🔴🔴 نقطه کلیدی رفع باگ 🔴🔴🔴
            Swal.close();
            await wait(0); // اجازه reset کامل state Swal

            const { value: sessionName, isConfirmed } = await Swal.fire({
                title: 'نام جلسه',
                text: 'لطفاً نام جلسه را وارد کنید',
                input: 'text',
                inputPlaceholder: 'مثلاً جلسه کلاس ۱۰۱',
                showCancelButton: true,
                confirmButtonText: 'تأیید',
                cancelButtonText: 'انصراف',
                allowOutsideClick: false,
                inputValidator: v => !v?.trim() ? 'نام جلسه نمی‌تواند خالی باشد' : null
            });

            if (!isConfirmed) return;

            const printTable = document.createElement('table');
            printTable.style.width = '100%';
            printTable.style.borderCollapse = 'collapse';

            const thead = document.createElement('thead');
            const hr = document.createElement('tr');
            ['تصویر', 'نام و نام خانوادگی', 'پایه', 'مدرسه', 'وضعیت حضور']
                .forEach(t => {
                    const th = document.createElement('th');
                    th.innerText = t;
                    th.style.border = '1px solid #ddd';
                    th.style.padding = '6px';
                    hr.appendChild(th);
                });
            thead.appendChild(hr);
            printTable.appendChild(thead);

            const tb = document.createElement('tbody');

            rows.forEach(r => {
                const c = r.cells;
                const tr = document.createElement('tr');

                const imgTd = document.createElement('td');
                const img = c[0].querySelector('img');
                if (img) {
                    const ic = img.cloneNode();
                    ic.style.width = '40px';
                    ic.style.height = '40px';
                    ic.style.objectFit = 'cover';
                    imgTd.appendChild(ic);
                }
                tr.appendChild(imgTd);

                [1, 2, 3].forEach(i => {
                    const td = document.createElement('td');
                    td.innerText = c[i].innerText.trim();
                    tr.appendChild(td);
                });

                tr.appendChild(createStatusCell(extractRealStatus(c[4])));
                tb.appendChild(tr);
            });

            printTable.appendChild(tb);

            const now = new Date();
            const faDate = now.toLocaleDateString('fa-IR');
            const faTime = now.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });

            const html = `
            <html lang="fa" dir="rtl">
            <head>
                <meta charset="utf-8"/>
                <title>${sessionName}</title>
                <style>
                    body { font-family: IRANYekan, sans-serif; }
                    table { width:100%; border-collapse:collapse; }
                    th,td { border:1px solid #ddd; padding:6px; text-align:center }
                    th { background:#f5f5f5 }
                </style>
            </head>
            <body>
                <h2 style="text-align:center">${sessionName}</h2>
                ${printTable.outerHTML}
                <div style="text-align:center;margin-top:10px;font-size:12px">
                    تاریخ و ساعت چاپ: ${faDate} - ${faTime}
                </div>
            </body>
            </html>`;

            const w = window.open('', '_blank');
            w.document.write(html);
            w.document.close();
            w.focus();
            w.print();
            setTimeout(() => w.close(), 1500);

        } catch (e) {
            Swal.close();
            console.error(e);
            await showSwalFallback('error', 'خطا!', e.message || e);
        }
    };
})();
