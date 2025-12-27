// SessionDetails.printWithSwal.js
(function () {

    const wait = (ms) => new Promise(r => setTimeout(r, ms));

    function extractRealStatus(cell) {
        const select = cell.querySelector('select');
        if (select && select.selectedIndex >= 0) {
            return select.options[select.selectedIndex].text.trim();
        }
        return cell.innerText.trim();
    }

    function createStatusCell(text) {
        const td = document.createElement('td');
        td.innerText = text;
        td.style.textAlign = 'center';
        td.style.fontWeight = '600';
        td.style.border = '1px solid #ddd'; // ✅ FIX

        const lower = text.toLowerCase();
        if (lower.includes('حاضر')) td.style.color = 'green';
        else if (lower.includes('غایب')) td.style.color = 'red';
        else if (lower.includes('تأخیر')) td.style.color = 'orange';

        return td;
    }

    function createLateMinutesCell(statusText, row) {
        const td = document.createElement('td');
        td.style.textAlign = 'center';
        td.style.border = '1px solid #ddd'; // ✅ FIX

        if (!statusText.includes('تأخیر')) {
            td.innerText = '—';
            return td;
        }

        const input = row.querySelector('input.late-minutes');
        const val = input?.value?.trim();

        td.innerText = val && parseInt(val) >= 0 ? val : '—';
        return td;
    }

    window.printSessionDetailsWithSwal = async function () {

        //  Loading فقط برای آماده‌سازی اولیه
        Swal.fire({
            title: 'در حال آماده‌سازی گزارش...',
            allowOutsideClick: false,
            showConfirmButton: false,
            didOpen: () => Swal.showLoading()
        });

        try {
            const tbody = document.getElementById('session-details-table-body');
            if (!tbody) {
                Swal.close();
                return;
            }

            const rows = Array.from(tbody.rows).filter(r => !r.querySelector('td[colspan]'));
            if (!rows.length) {
                Swal.close();
                return;
            }

            //  بستن قطعی Loading قبل از Swal بعدی (حل مشکل دکمه تأیید)
            Swal.close();
            await wait(50);

            //  دریافت نام جلسه (بدون Loading)
            const { value: sessionName } = await Swal.fire({
                title: 'نام جلسه خود را وارد نمایید.',
                input: 'text',
                inputPlaceholder: 'مثلاً جلسه ریاضی',
                confirmButtonText: 'تأیید',
                cancelButtonText: 'انصراف',
                showCancelButton: true,
                allowOutsideClick: false,
                inputValidator: v => !v ? 'نام جلسه الزامی است' : null
            });

            if (!sessionName) return;

            // ---------- ساخت جدول ----------
            const table = document.createElement('table');
            table.style.width = '100%';
            table.style.borderCollapse = 'collapse';
            table.style.fontSize = '13px';

            const thead = document.createElement('thead');
            const hr = document.createElement('tr');

            [
                'تصویر',
                'نام و نام خانوادگی',
                'پایه تحصیلی',
                'نام مدرسه',
                'وضعیت حضور',
                'مدت تأخیر (دقیقه)'
            ].forEach(t => {
                const th = document.createElement('th');
                th.innerText = t;
                th.style.border = '1px solid #ddd';
                th.style.padding = '6px';
                th.style.background = '#f1f5f9';
                hr.appendChild(th);
            });

            thead.appendChild(hr);
            table.appendChild(thead);

            const tbodyNew = document.createElement('tbody');

            rows.forEach(row => {
                const cells = row.cells;
                const tr = document.createElement('tr');

                // تصویر
                const imgTd = document.createElement('td');
                imgTd.style.border = '1px solid #ddd';
                imgTd.style.textAlign = 'center';

                const img = cells[0].querySelector('img');
                if (img) {
                    const clone = img.cloneNode(true);
                    clone.style.width = '36px';
                    clone.style.height = '36px';
                    clone.style.objectFit = 'cover';
                    imgTd.appendChild(clone);
                }
                tr.appendChild(imgTd);

                // متن‌ها
                [1, 2, 3].forEach(i => {
                    const td = document.createElement('td');
                    td.innerText = cells[i].innerText.trim();
                    td.style.border = '1px solid #ddd';
                    td.style.textAlign = 'center';
                    tr.appendChild(td);
                });

                const statusText = extractRealStatus(cells[4]);
                tr.appendChild(createStatusCell(statusText));
                tr.appendChild(createLateMinutesCell(statusText, row));

                tbodyNew.appendChild(tr);
            });

            table.appendChild(tbodyNew);

            // ---------- چاپ ----------
            const now = new Date();
            const faDate = now.toLocaleDateString('fa-IR');
            const time = now.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });

            const html = `
            <html lang="fa" dir="rtl">
            <head>
                <meta charset="utf-8"/>
                <title>${sessionName}</title>
                <style>
                       @font-face {
                            font-family: 'IRANYekan';
                            src: url('/fonts/IRANYekanXFaNum-Regular.woff2') format('truetype');
                        }
                    body { font-family: IRANYekan; margin: 20px; }
                    tr:nth-child(even){ background:#fafafa }
                </style>
            </head>
            <body>
                <h2 style="text-align:center">${sessionName}</h2>
                ${table.outerHTML}
                <div style="text-align:center;margin-top:12px;font-size:12px">
                    تاریخ و ساعت چاپ: ${faDate} - ${time}
                </div>
            </body>
            </html>`;

            const w = window.open('', '_blank', 'width=1200,height=900');
            w.document.write(html);
            w.document.close();
            w.focus();
            w.print();
            setTimeout(() => w.close(), 1200);

        } catch (e) {
            Swal.close();
            console.error(e);
        }
    };
})();
