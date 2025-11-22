// ExportTables.printWithSwal.js
(function () {
    // helper small timeout
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
            // fallback ساده در صورت نبود SweetAlert2
            alert(title + "\n" + (typeof html === 'string' ? html.replace(/<\/?[^>]+(>|$)/g, "") : String(html)));
            return Promise.resolve();
        }
    }

    // تابع اصلی: آماده‌سازی + نمایش Loading (Swal) + چاپ
    window.printStudentTableWithSwal = async function () {
        // نمایش مودال Loading با Swal
        if (typeof Swal === 'undefined') {
            alert('برای نمایش پیام‌ها نیاز به SweetAlert2 دارید (Swal).');
            // ادامه می‌دهیم اما بدون Swal (نیاز به fallback بیشتر در پروژۀ شما وجود دارد)
        }

        // show loading modal
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: 'گزارش در حال آماده سازی...',
                allowOutsideClick: false,
                showConfirmButton: false,
                didOpen: () => { Swal.showLoading(); }
            });
        } else {
            // fallback: فقط منتظر می‌مانیم (حداقل تجربه)
            console.info('Loading (no Swal)');
        }

        try {
            // پیدا کردن tbody (شما tbody را با id="students-table-body" دارید)
            const tbody = document.getElementById('students-table-body');
            if (!tbody) {
                await showSwalFallback('error', 'خطا!', 'جدول دانش‌آموزان (tbody با id="students-table-body") پیدا نشد.');
                return;
            }

            // انتخاب ردیف‌های واقعی (حذفِ ردیف پیام "اطلاعات ثبت نشده" که colspan دارد)
            const allRows = Array.from(tbody.rows || []);
            const dataRows = allRows.filter(row => !row.querySelector('td[colspan]'));

            if (!dataRows.length) {
                await showSwalFallback('warning', 'هشدار!', 'هیچ داده‌ای برای چاپ وجود ندارد.');
                return;
            }

            // پیدا کردن <table> بالاسری و هدر (thead)
            const table = tbody.closest('table');
            if (!table) {
                await showSwalFallback('error', 'خطا!', 'ساختار جدول معتبر نیست (table یافت نشد).');
                return;
            }

            // تعیین ایندکس ستون‌هایی که باید حذف شوند:
            // ما سعی می‌کنیم به صورت هوشمند از متن هدر استفاده کنیم (پایدارتر از ایندکس صریح)
            const headerCells = Array.from(table.querySelectorAll('thead tr th'));
            const excludeIdx = new Set();

            headerCells.forEach((th, idx) => {
                const txt = (th.textContent || '').trim().replace(/\s+/g, ' ').toLowerCase();
                if (txt.includes('تصویر') || txt.includes('عکس') || txt.includes('عملیات') || txt.includes('وضعیت')) {
                    excludeIdx.add(idx);
                }
            });

            // اگر هیچ هدر متناظر پیدا نشد، fallback ایندکس‌ها (محافظه‌کارانه)
            if (excludeIdx.size === 0) {
                // فرض: ستون تصویر در index 0 و عملیات در آخر
                excludeIdx.add(0);
                excludeIdx.add(Math.max(0, headerCells.length - 1));
            }

            // ساخت جدول موقت برای چاپ (تنها ستون‌های مدنظر)
            const printTable = document.createElement('table');
            printTable.style.width = '100%';
            printTable.style.borderCollapse = 'collapse';
            printTable.className = table.className || '';

            // کپی هوشمند thead بدون ستون‌های exclude
            const thead = table.querySelector('thead');
            if (thead) {
                const newThead = document.createElement('thead');
                Array.from(thead.rows).forEach(row => {
                    const newRow = document.createElement('tr');
                    Array.from(row.cells).forEach((cell, idx) => {
                        if (!excludeIdx.has(idx)) {
                            const c = cell.cloneNode(true);
                            // حذف هر تصویر/آیکون/دکمه داخل سلول هدر در صورت وجود
                            Array.from(c.querySelectorAll('img, svg, button, a')).forEach(n => n.remove());
                            newRow.appendChild(c);
                        }
                    });
                    newThead.appendChild(newRow);
                });
                printTable.appendChild(newThead);
            }

            // کپی tbody (فقط ردیف‌های داده‌ای واقعی)
            const newTbody = document.createElement('tbody');
            for (const row of dataRows) {
                const newRow = document.createElement('tr');
                const cells = Array.from(row.cells);
                cells.forEach((cell, idx) => {
                    if (!excludeIdx.has(idx)) {
                        const c = cell.cloneNode(true);
                        // حذف تگ‌های غیر مرتبط مثل <img>, <button>, <a>, <input>
                        Array.from(c.querySelectorAll('img, svg, button, a, input, select, textarea')).forEach(n => n.remove());
                        // trim کردن whitespace اضافی
                        // همچنین اگر سلول حاوی المان‌هایی با داده اضافی است می‌تونیم textContent رو جایگزین کنیم:
                        // c.innerHTML = c.textContent.trim();
                        newRow.appendChild(c);
                    }
                });
                newTbody.appendChild(newRow);
            }
            printTable.appendChild(newTbody);

            // --- آماده‌سازی چاپ انجام شد؛ اندکی تاخیر نمایشی جهت UX ---
            await wait(1200); // کاربر چند صدم ثانیه لود را مشاهده کند

            // بستن Loading
            if (typeof Swal !== 'undefined') Swal.close();

            // نمایش پیام کوتاه آماده‌باش
            if (typeof Swal !== 'undefined') {
                await Swal.fire({
                    icon: 'success',
                    title: 'انجام شد.',
                    html: '<div dir="rtl">سیستم در حال پردازش نهایی گزارش...</div>',
                    showConfirmButton: false,
                    timer: 1600
                });
            }

            // ساخت سند چاپ و باز کردن پنجره
            const now = new Date();
            const faDate = now.toLocaleDateString('fa-IR');
            const time = now.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });

            const headerHtml = `<div style="text-align:center; font-size:18px; font-weight:bold; margin-bottom:10px; font-family: IRANYekan,sans-serif;">گزارش دانش‌آموزان</div>`;
            const footerHtml = `<div style="text-align:center; font-size:12px; margin-top:20px; font-family: IRANYekan,sans-serif; color:#333;">تاریخ و ساعت چاپ: ${faDate} - ${time}</div>`;

            const docHtml = `
                <html lang="fa" dir="rtl">
                <head>
                    <meta charset="utf-8"/>
                    <title>گزارش دانش‌آموزان</title>
                    <style>
                        @font-face {
                            font-family: 'IRANYekan';
                            src: url('/fonts/IRANYekanXFaNum-Regular.woff2') format('truetype');
                        }
                        body { font-family: 'IRANYekan', sans-serif; direction: rtl; margin: 20px; color: #111; }
                        table { width: 100%; border-collapse: collapse; font-size: 13px; }
                        th, td { border: 1px solid #ddd; padding: 8px; text-align: right; }
                        th { background: #f8f9fa; font-weight: 600; }
                        tr:nth-child(even) { background: #fbfbfb; }
                        .print-header { margin-bottom: 12px; }
                        .print-footer { margin-top: 12px; font-size: 12px; color: #444; }
                        @media print {
                            body { margin: 6mm; }
                        }
                    </style>
                </head>
                <body>
                    ${headerHtml}
                    ${printTable.outerHTML}
                    ${footerHtml}
                </body>
                </html>
            `;

            // باز کردن پنجره جدید و نوشتن سند
            const printWindow = window.open('', '_blank', 'width=1200,height=900,scrollbars=yes');
            if (!printWindow) {
                await showSwalFallback('error', 'خطا!', 'باز شدن پنجره چاپ مسدود شد. لطفاً Popup Blocker را بررسی کنید.');
                return;
            }
            printWindow.document.open();
            printWindow.document.write(docHtml);
            printWindow.document.close();

            // وقتی صفحه باز شد => چاپ
            const doPrint = () => {
                try {
                    printWindow.focus();
                    printWindow.print();
                } catch (e) {
                    console.error('print error', e);
                } finally {
                    // بسته شدن امن پنجره بعد از تاخیری کوتاه
                    setTimeout(() => {
                        try { printWindow.close(); } catch (e) { /* ignore */ }
                    }, 1400);
                }
            };

            // اگر load بخورد صبر کن، وگرنه از fallback استفاده کن
            if (printWindow.document.readyState === 'complete') {
                doPrint();
            } else {
                printWindow.onload = doPrint;
                // fallback هر 1s اگر onload فعال نشد
                setTimeout(() => {
                    if (!printWindow.closed) doPrint();
                }, 2200);
            }

            // پیام نهایی (غیرتلقّی، صرفاً اطلاع)
            await showSwalFallback('success', 'گزارش شما با موفقیت ساخته شد.', 'عملیات موفق.');

        } catch (err) {
            // بستن loading اگر هنوز باز است
            if (typeof Swal !== 'undefined') Swal.close();
            console.error(err);
            await showSwalFallback('error', 'خطا!', `خطا هنگام آماده‌سازی چاپ: ${err?.message || err}`);
        }
    };
})();
