// wwwroot/js/students.delete.signalr.js
(function () {
    'use strict';

    if (!window.signalR && !window.SignalR) {
        console.warn('SignalR client not found. Please include @microsoft/signalr script before students.delete.signalr.js');
        return;
    }

    const signalr = window.signalR || window.SignalR;
    const hubUrl = '/hubs/students';

    // helper notify با انیمیشن Tailwind
    function notify(msg, type = 'info', duration = 2500) {
        try {
            const el = document.createElement('div');
            el.textContent = msg;
            el.className = `
                fixed top-[80px] left-1/2 -translate-x-1/2
                px-4 py-2 rounded shadow-lg font-bold
                transition-all duration-300 ease-out
                z-[9999] opacity-0
                ${type === 'success' ? 'bg-teal-500 text-white' :
                    type === 'warning' ? 'bg-amber-400 text-black' :
                        'bg-gray-700 text-white'}
            `;
            document.body.appendChild(el);
            requestAnimationFrame(() => {
                el.classList.remove('opacity-0');
                el.classList.add('opacity-100');
            });
            setTimeout(() => {
                el.classList.remove('opacity-100');
                el.classList.add('opacity-0');
                el.addEventListener('transitionend', () => el.remove(), { once: true });
            }, duration);
        } catch (e) {
            console.error('notify error:', e);
            console.log(type, msg);
        }
    }

    // اتصال SignalR
    const connection = new signalr.HubConnectionBuilder()
        .withUrl(hubUrl)
        .withAutomaticReconnect()
        .configureLogging(signalr.LogLevel.Information)
        .build();

    // بروزرسانی ردیف دانش‌آموز غیرفعال
    function updateDeletedRow(payload) {
        try {
            const id = payload?.id;
            const reason = payload?.inactiveReason || '';
            if (!id) return;

            const row = document.getElementById('row-' + id) || document.querySelector(`tr[data-student-id='${id}']`);
            if (!row) return;

            // کلاس‌ها و رنگ‌ها برای غیرفعال
            row.classList.add('bg-rose-50', 'text-rose-700');

            // ستون وضعیت (status)
            const statusCell = row.querySelector('td:nth-child(8)'); // ستون هشتم = وضعیت
            if (statusCell) {
                statusCell.innerHTML = '<span class="inline-block px-2 py-1 text-xs font-bold text-rose-800 bg-rose-100 rounded">غیرفعال</span>';
            }

            // ستون علت غیرفعال شدن (آخرین ستون)
            const reasonCell = row.querySelector('td:last-child');
            if (reasonCell) {
                reasonCell.innerHTML = reason.trim() !== ''
                    ? `<div class="max-w-xs mx-auto break-words text-sm text-rose-800 bg-rose-50 px-2 py-1 rounded">${escapeHtml(reason)}</div>`
                    : `<span class="text-slate-400">عدم اطلاع رسانی</span>`;
            }

            notify('دانش‌آموز با موفقیت غیرفعال شد.', 'success', 3000);
        } catch (err) {
            console.error('updateDeletedRow error:', err);
        }
    }

    // escapeHtml امن برای متن‌ها
    function escapeHtml(s) {
        if (!s) return '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // دریافت رویداد StudentDeleted
    connection.on('StudentDeleted', function (payload) {
        updateDeletedRow(payload);
    });

    // reconnect / reconnected پیام‌ها
    connection.onreconnecting((error) => {
        notify('در حال تلاش برای ارتباط مجدد...', 'warning', 2000);
    });

    connection.onreconnected(() => {
        notify('ارتباط با سرور بازسازی شد.', 'success', 1500);
    });

    // شروع اتصال
    connection.start()
        .then(() => console.info('SignalR connected to', hubUrl))
        .catch(err => console.error('SignalR connection error', err));

    // expose برای دسترسی از کنسول
    window.StudentsDeleteSignalR = { connection, updateDeletedRow };

})();
