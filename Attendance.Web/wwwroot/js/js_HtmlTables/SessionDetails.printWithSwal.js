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
            alert(title + "\n" + (typeof html === 'string' ? html.replace(/<\/?[^>]+(>|$)/g, "") : String(html)));
            return Promise.resolve();
        }
    }

    function extractRealStatus(cell) {
        // 1️⃣ select (dropdown)
        const select = cell.querySelector('select');
        if (select && select.selectedIndex >= 0) {
            return select.options[select.selectedIndex].text.trim();
        }

        // 2️⃣ radio buttons
        const checkedRadio = cell.querySelector('input[type="radio"]:checked');
        if (checkedRadio) {
            const lbl = cell.querySelector(`label[for="${checkedRadio.id}"]`);
            return lbl ? lbl.innerText.trim() : checkedRadio.value;
        }

        // 3️⃣ data-status attribute
        if (cell.dataset && cell.dataset.status) {
            return cell.dataset.status.trim();
        }

        // 4️⃣ span / badge
        const span = cell.querySelector('span');
        if (span) {
            return span.innerText.trim();
        }

        // 5️⃣ fallback
        return cell.innerText.trim();
    }

    function createStatusCell(text) {
        const td = document.createElement('td');
        td.style.textAlign = 'center';
        td.style.padding = '4px 8px';
        td.style.fontWeight = '600';
        td.innerText = text;

        // رنگ‌بندی وضعیت
        const lower = text.toLowerCase();
        if (lower.includes('حاضر')) {
            td.style.color = '#008000';
        } else if (lower.includes('غایب')) {
            td.style.color = '#FF0000';
        } else if (lower.includes('تأخیر')) {
            td.style.color = '#FFA500';
        } else {
            td.style.color = '#000';
        }

        return td;
    }

    window.printSessionDetailsWithSwal = async function () {
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: 'در حال آماده‌سازی گزارش...',
                allowOutsideClick: false,
                showConfirmButton: false,
                didOpen: () => { Swal.showLoading(); }
            });
        }

        try {
            const tbody = document.getElementById('session-details-table-body');
            if (!tbody) {
                await showSwalFallback('error', 'خطا!', 'جدول دانش‌آموزان پیدا نشد.');
                return;
            }

            const dataRows = Array.from(tbody.rows || []).filter(r => !r.querySelector('td[colspan]'));
            if (!dataRows.length) {
                await showSwalFallback('warning', 'هشدار!', 'هیچ داده‌ای برای چاپ وجود ندارد.');
                return;
            }

            const table = tbody.closest('table');
            if (!table) {
                await showSwalFallback('error', 'خطا!', 'ساختار جدول معتبر نیست.');
                return;
            }

            // دریافت نام جلسه از کاربر
            const { value: sessionName } = await Swal.fire({
                title: 'نام جلسه',
                input: 'text',
                inputLabel: 'لطفاً نام جلسه را وارد کنید',
                inputPlaceholder: 'مثلاً جلسه کلاس ۱۰۱',
                showCancelButton: true,
                confirmButtonText: 'تأیید',
                cancelButtonText: 'انصراف',
                inputValidator: value => !value ? 'نام جلسه الزامی است' : null
            });
            if (!sessionName) {
                Swal.close();
                return;
            }

            // ساخت جدول موقت چاپ
            const printTable = document.createElement('table');
            printTable.style.width = '100%';
            printTable.style.borderCollapse = 'collapse';
            printTable.style.fontSize = '13px';

            // thead
            const thead = document.createElement('thead');
            const headRow = document.createElement('tr');
            ['تصویر', 'نام و نام خانوادگی', 'پایه تحصیلی', 'نام مدرسه', 'وضعیت حضور'].forEach(txt => {
                const th = document.createElement('th');
                th.innerText = txt;
                th.style.border = '1px solid #ddd';
                th.style.padding = '6px';
                th.style.background = '#f8f9fa';
                headRow.appendChild(th);
            });
            thead.appendChild(headRow);
            printTable.appendChild(thead);

            // tbody
            const newTbody = document.createElement('tbody');
            for (const row of dataRows) {
                const cells = Array.from(row.cells);
                const tr = document.createElement('tr');

                // تصویر کوچک‌تر
                const imgCell = document.createElement('td');
                const img = cells[0].querySelector('img');
                if (img) {
                    const imgClone = img.cloneNode(true);
                    imgClone.style.width = '40px';
                    imgClone.style.height = '40px';
                    imgClone.style.objectFit = 'cover';
                    imgCell.appendChild(imgClone);
                }
                imgCell.style.border = '1px solid #ddd';
                imgCell.style.padding = '4px';
                imgCell.style.textAlign = 'center';
                tr.appendChild(imgCell);

                // نام و نام خانوادگی
                const nameCell = document.createElement('td');
                nameCell.innerText = cells[1].innerText.trim();
                nameCell.style.border = '1px solid #ddd';
                nameCell.style.padding = '4px';
                tr.appendChild(nameCell);

                // پایه تحصیلی
                const gradeCell = document.createElement('td');
                gradeCell.innerText = cells[2].innerText.trim();
                gradeCell.style.border = '1px solid #ddd';
                gradeCell.style.padding = '4px';
                tr.appendChild(gradeCell);

                // نام مدرسه
                const schoolCell = document.createElement('td');
                schoolCell.innerText = cells[3].innerText.trim();
                schoolCell.style.border = '1px solid #ddd';
                schoolCell.style.padding = '4px';
                tr.appendChild(schoolCell);

                // وضعیت حضور واقعی
                const statusText = extractRealStatus(cells[4]);
                tr.appendChild(createStatusCell(statusText));

                newTbody.appendChild(tr);
            }
            printTable.appendChild(newTbody);

            await wait(800);
            Swal.close();

            const now = new Date();
            const faDate = now.toLocaleDateString('fa-IR');
            const time = now.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });

            const headerHtml = `<div style="text-align:center; font-size:18px; font-weight:bold; margin-bottom:10px; font-family: IRANYekan,sans-serif;">${sessionName}</div>`;
            const footerHtml = `<div style="text-align:center; font-size:12px; margin-top:12px; font-family: IRANYekan,sans-serif; color:#333;">تاریخ و ساعت چاپ: ${faDate} - ${time}</div>`;

            const docHtml = `
                <html lang="fa" dir="rtl">
                <head>
                    <meta charset="utf-8"/>
                    <title>${sessionName}</title>
                    <style>
                        @font-face {
                            font-family: 'IRANYekan';
                            src: url('/fonts/IRANYekanXFaNum-Regular.woff2') format('truetype');
                        }
                        body { font-family: 'IRANYekan', sans-serif; direction: rtl; margin: 20px; color: #111; }
                        table { width: 100%; border-collapse: collapse; font-size: 13px; }
                        th, td { border: 1px solid #ddd; padding: 6px; text-align: right; }
                        th { background: #f8f9fa; font-weight: 600; }
                        tr:nth-child(even) { background: #fbfbfb; }
                        @media print { body { margin: 6mm; } }
                    </style>
                </head>
                <body>
                    ${headerHtml}
                    ${printTable.outerHTML}
                    ${footerHtml}
                </body>
                </html>
            `;

            const printWindow = window.open('', '_blank', 'width=1200,height=900,scrollbars=yes');
            if (!printWindow) {
                await showSwalFallback('error', 'خطا!', 'باز شدن پنجره چاپ مسدود شد.');
                return;
            }
            printWindow.document.open();
            printWindow.document.write(docHtml);
            printWindow.document.close();

            const doPrint = () => {
                try { printWindow.focus(); printWindow.print(); }
                catch (e) { console.error(e); }
                finally { setTimeout(() => { try { printWindow.close(); } catch (e) { } }, 1400); }
            };
            if (printWindow.document.readyState === 'complete') doPrint();
            else { printWindow.onload = doPrint; setTimeout(() => { if (!printWindow.closed) doPrint(); }, 2200); }

        } catch (err) {
            if (typeof Swal !== 'undefined') Swal.close();
            console.error(err);
            await showSwalFallback('error', 'خطا!', `خطا هنگام آماده‌سازی چاپ: ${err?.message || err}`);
        }
    };
})();
