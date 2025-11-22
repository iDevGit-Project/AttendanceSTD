// students.signalr.js
(function () {
    // ---- تنظیمات ----
    const HUB_URL = '/hubs/studentHub'; // مسیر هاب (مطابق برنامه شما)
    const ROW_PREFIX = 'row-'; // id format: row-{id}
    const PAGE_CHECK_SELECTOR = '[data-current-page]'; // optional: اگر در DOM صفحه فعلی را نشان می‌دهی

    // helper: showNotify (اگر در پروژه‌ات وجود دارد از آن استفاده کن)
    window.showNotify = window.showNotify || function (message, type = 'success') {
        const container = document.createElement('div');
        container.className = 'fixed top-5 left-1/2 -translate-x-1/2 z-[99999]';
        const box = document.createElement('div');
        box.className = (type === 'error') ? 'bg-rose-600 text-white px-5 py-3 rounded shadow-lg' : 'bg-teal-600 text-white px-5 py-3 rounded shadow-lg';
        box.textContent = message;
        container.appendChild(box);
        document.body.appendChild(container);
        setTimeout(() => container.remove(), 3000);
    };

    // اتصال SignalR
    async function createConnection() {
        if (typeof signalR === 'undefined') {
            console.warn('signalR client not loaded; real-time disabled.');
            return null;
        }

        const conn = new signalR.HubConnectionBuilder()
            .withUrl(HUB_URL)
            .withAutomaticReconnect()
            .build();

        conn.onclose(err => {
            console.warn('SignalR connection closed', err);
        });

        return conn;
    }

    // helper: find row by id
    function findRow(id) {
        return document.getElementById(ROW_PREFIX + id) || null;
    }

    // helper: create row HTML string consistent with _RowStudentPartial
    function createRowHtml(student) {
        // student: dto with fields matching StudentListItemViewModel
        // IMPORTANT: keep this HTML aligned with server partial.
        const photo = student.photo || '/uploads/students/default.png';
        const inactiveHtml = (!student.isActive && student.inactiveReason) ?
            `<div class="max-w-xs mx-auto break-words text-sm text-pink-800 bg-pink-100 px-2 py-1 rounded">${escapeHtml(student.inactiveReason)}</div>` :
            `<span class="text-slate-400"> --- </span>`;

        const statusHtml = student.isActive
            ? '<span class="inline-block px-2 py-1 font-bold text-sm text-teal-800 bg-teal-100 rounded">فعال</span>'
            : '<span class="inline-block px-2 py-1 font-bold text-sm text-rose-700 bg-rose-100 rounded">غیرفعال</span>';

        // عملیات: دقت کن کلاس‌ها/nameها مشابه Partial باشند
        return `
<tr id="${ROW_PREFIX}${student.id}" data-student-id="${student.id}" class="border-b hover:bg-blue-50/50 ${student.isActive ? '' : 'bg-rose-50 text-rose-700'}">
  <td class="px-2 py-2 align-middle">
    <img src="${escapeHtml(photo)}" alt="عکس ${escapeHtml(student.firstName)} ${escapeHtml(student.lastName)}" class="w-10 h-10 object-cover rounded-full border" />
  </td>
  <td class="px-2 py-2 text-sm align-middle">${escapeHtml(student.firstName)}</td>
  <td class="px-2 py-2 text-sm align-middle">${escapeHtml(student.lastName)}</td>
  <td class="px-2 py-2 text-sm align-middle">${escapeHtml(student.nationalCode || '')}</td>
  <td class="px-2 py-2 text-sm align-middle">${escapeHtml(student.grade || '')}</td>
  <td class="px-2 py-2 text-sm align-middle">${escapeHtml(student.schoolName || '')}</td>
  <td class="px-2 py-2 text-sm align-middle">${escapeHtml(student.coachName || '')}</td>
  <td class="px-2 py-2 text-sm align-middle text-center">${statusHtml}</td>
  <td class="px-2 py-2 text-sm align-middle">${/* عملیات (لینک‌ها) */ ''}
    <a href="/Students/Details/${student.id}" class="inline-block bg-slate-100 text-slate-800 px-2 py-1 text-sm rounded hover:bg-blue-200 font-bold transition">جزئیات</a>
    <a href="/Students/Edit/${student.id}" class="inline-block bg-slate-100 text-amber-500 px-2 py-1 rounded text-sm hover:bg-amber-100 font-bold transition">ویرایش</a>
    ${student.isActive ?
        `<form asp-controller="Students" asp-action="DeleteConfirmed" method="post" class="inline delete-form">
            <input type="hidden" name="Id" value="${student.id}" />
            <input type="hidden" name="InactiveReason" class="inactive-reason-input" value="" />
            <button type="button" class="student-delete-btn inline-block bg-slate-100 text-rose-700 px-2 py-1 rounded text-sm hover:bg-rose-100 font-bold transition" data-id="${student.id}" data-name="${escapeHtml(student.firstName + ' ' + (student.lastName||''))}">غیرفعال</button>
         </form>` :
        `<form class="inline restore-form" method="post" action="/Students/Restore">
            <input type="hidden" name="id" value="${student.id}" />
            <button type="submit" class="inline-block bg-slate-100 text-teal-500 px-2 py-1 rounded text-sm hover:bg-teal-100 font-bold transition">فعالسازی</button>
         </form>`
    }
  </td>
  <td class="px-2 py-2 text-sm align-middle">${inactiveHtml}</td>
</tr>
        `;
    }

    // helper: escape HTML
    function escapeHtml(unsafe) {
        if (!unsafe && unsafe !== 0) return '';
        return String(unsafe)
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');
    }

    // update existing row from DTO
    function updateRow(student) {
        const row = findRow(student.id);
        if (!row) return false;

        // Update attributes & visible cells (simple approach: replace innerHTML of row)
        const newRowHtml = createRowHtml(student);
        // create a temporary container and replace the row element
        const tmp = document.createElement('tbody');
        tmp.innerHTML = newRowHtml;
        const newRow = tmp.querySelector('tr');
        if (newRow) {
            row.replaceWith(newRow);
            animateRow(newRow);
            return true;
        }
        return false;
    }

    function addRowToTop(student) {
        const tbody = document.querySelector('table tbody');
        if (!tbody) return;
        const exists = findRow(student.id);
        if (exists) return updateRow(student);

        const html = createRowHtml(student);
        const tmp = document.createElement('tbody');
        tmp.innerHTML = html;
        const newRow = tmp.querySelector('tr');
        if (newRow) {
            // prepend
            tbody.insertBefore(newRow, tbody.firstChild);
            animateRow(newRow);

            // if more rows than pageSize, remove last row (simple logic)
            const pageSize = parseInt(document.querySelector('[data-page-size]')?.getAttribute('data-page-size') || '20', 10);
            const rows = tbody.querySelectorAll('tr');
            if (rows.length > pageSize) {
                const last = rows[rows.length - 1];
                last.remove();
            }
        }
    }

    function removeRow(id) {
        const row = findRow(id);
        if (row) {
            // animate remove
            row.style.transition = 'opacity .35s, height .35s';
            row.style.opacity = '0';
            row.style.height = '0px';
            setTimeout(() => row.remove(), 380);
        }
    }

    function animateRow(row) {
        row.style.transition = 'background-color .6s ease';
        const prev = row.style.backgroundColor;
        row.style.backgroundColor = 'rgba(167, 243, 208, 0.6)';
        setTimeout(() => row.style.backgroundColor = prev || '', 900);
    }

    // Start everything
    (async function main() {
        const conn = await createConnection();
        if (!conn) return;

        // Register handlers
        conn.on('StudentCreated', function (student) {
            // if current page is 1: prepend, otherwise show notify
            const currentPage = parseInt(document.querySelector('[data-current-page]')?.getAttribute('data-current-page') || '1', 10);
            if (currentPage === 1) {
                addRowToTop(student);
            }
            showNotify('دانش‌آموز جدید ایجاد شد.', 'success');
        });

        conn.on('StudentUpdated', function (student) {
            const ok = updateRow(student);
            if (!ok) {
                // ردیف پیدا نشد (مثلاً صفحه دیگری) — فقط نوتیف نمایش بده
                showNotify('اطلاعات دانش‌آموز به‌روز شد.', 'success');
            } else {
                showNotify('اطلاعات دانش‌آموز به‌روز شد.', 'success');
            }
        });

        conn.on('StudentDeactivated', function (payload) {
            // mark as inactive visually
            const id = payload.id || payload.Id;
            const row = findRow(id);
            if (row) {
                row.classList.add('bg-rose-50', 'text-rose-700');
                // update status cell
                const tds = row.querySelectorAll('td');
                if (tds && tds.length >= 9) {
                    tds[7].innerHTML = '<span class="inline-block px-2 py-1 font-bold text-sm text-rose-700 bg-rose-100 rounded">غیرفعال</span>';
                    tds[8].innerHTML = payload.reason ? `<div class="max-w-xs mx-auto break-words text-sm text-pink-800 bg-pink-100 px-2 py-1 rounded">${escapeHtml(payload.reason)}</div>` : '<span class="text-slate-400"> --- </span>';
                }
                animateRow(row);
            }
            showNotify('دانش‌آموز غیرفعال شد.', 'info');
        });

        conn.on('StudentRestored', function (payload) {
            const id = payload.id || payload.Id;
            const row = findRow(id);
            if (row) {
                row.classList.remove('bg-rose-50', 'text-rose-700');
                const tds = row.querySelectorAll('td');
                if (tds && tds.length >= 9) {
                    tds[7].innerHTML = '<span class="inline-block px-2 py-1 font-bold text-sm text-teal-800 bg-teal-100 rounded">فعال</span>';
                    tds[8].innerHTML = '<span class="text-slate-400"> --- </span>';
                }
                animateRow(row);
            }
            showNotify('دانش‌آموز فعال شد.', 'success');
        });

        conn.on('StudentHardDeleted', function (payload) {
            const id = payload.id || payload.Id;
            removeRow(id);
            showNotify('دانش‌آموز حذف شد.', 'info');
        });

        // start connection
        try {
            await conn.start();
            console.log('SignalR connected');
        } catch (err) {
            console.error('SignalR start error', err);
        }
    })();

})();

//// wwwroot/js/students.signalr.js
//(function () {
//    'use strict';

//    // مطمئن شو signalr client موجود است
//    if (!window.signalR && !window.SignalR) {
//        console.warn('SignalR client not found. Please include @microsoft/signalr script before students.signalr.js');
//        return;
//    }

//    const signalr = window.signalR || window.SignalR; // compatibility
//    const hubUrl = '/hubs/students';

//    // helper notify (fallback to console)
//    const notify = function (msg, type = 'info', t = 1000) {
//        if (typeof window.StudentsNotify === 'function') return window.StudentsNotify(msg, type, t);
//        if (typeof window.showNotify === 'function') return window.showNotify(msg, type, t);
//        console.log(type, msg);
//    };

//    // build connection
//    const connection = new signalr.HubConnectionBuilder()
//        .withUrl(hubUrl, {
//            // اگر auth cookies استفاده می‌کنی، نیازی به accessTokenFactory نیست.
//            // اگر token-based auth داری، از accessTokenFactory برای ارسال توکن استفاده کن.
//            // accessTokenFactory: () => getYourToken()
//        })
//        .withAutomaticReconnect() // reconnect خودکار
//        .configureLogging(signalr.LogLevel.Information)
//        .build();

//    // Handlers - باید با ساختار payloadی که سرور ارسال می‌کند سازگار باشند
//    // === جایگذاری/استفاده: این بلاک را مستقیماً بجای یا داخل connection.on('StudentUpdated', ...) قرار بده ===
//    connection.on('StudentUpdated', function (student) {
//        try {
//            console.debug('[SignalR] StudentUpdated received:', student);

//            // 1) Notify user (try different notify helpers, safe fallback to console)
//            try {
//                if (typeof window.showNotify === 'function') {
//                    window.showNotify('اطلاعات دانش‌آموز بروزرسانی شد.', 'success', 2000);
//                } else if (typeof window.StudentsNotify === 'function') {
//                    window.StudentsNotify('اطلاعات دانش‌آموز بروزرسانی شد.', 'info', 2500);
//                } else if (window.StudentsClient && typeof window.StudentsClient.showNotify === 'function') {
//                    window.StudentsClient.showNotify('اطلاعات دانش‌آموز بروزرسانی شد.', 'info', 3000);
//                } else {
//                    console.log('success', 'اطلاعات دانش‌آموز بروزرسانی شد.');
//                }
//            } catch (notifyErr) {
//                console.warn('[SignalR] notify failed:', notifyErr);
//            }

//            // 2) Prefer calling the existing updateRowWithStudent function if available
//            if (typeof window.updateRowWithStudent === 'function') {
//                try {
//                    window.updateRowWithStudent(student, !!student.isActive);
//                    console.debug('[SignalR] updateRowWithStudent invoked.');
//                    return; // done
//                } catch (err) {
//                    console.error('[SignalR] updateRowWithStudent threw:', err);
//                    // fallthrough to manual DOM update
//                }
//            }

//            // 3) Try manual partial DOM update (no full page refresh) — safe and defensive
//            try {
//                const id = student && (student.id ?? student.Id ?? student.ID);
//                if (typeof id !== 'undefined' && id !== null) {
//                    const trById = document.getElementById('row-' + id);
//                    const trByData = document.querySelector(`tr[data-student-id='${id}']`);
//                    const row = trById || trByData;

//                    if (row) {
//                        // cells order (based on your RowPartial):
//                        // 0: img, 1:firstName, 2:lastName, 3:nationalCode, 4:grade, 5:schoolName, 6:coachName, 7:status, 8:actions, 9:inactiveReason
//                        const tds = Array.from(row.querySelectorAll('td'));
//                        // safe setters with checks
//                        if (tds[0]) {
//                            const img = tds[0].querySelector('img');
//                            if (img && student.photo) img.src = student.photo;
//                        }
//                        if (tds[1]) tds[1].textContent = student.firstName ?? '';
//                        if (tds[2]) tds[2].textContent = student.lastName ?? '';
//                        if (tds[3]) tds[3].textContent = student.nationalCode ?? '';
//                        if (tds[4]) tds[4].textContent = student.grade ?? '';
//                        if (tds[5]) tds[5].textContent = student.schoolName ?? '';
//                        if (tds[6]) tds[6].textContent = student.coachName ?? '';

//                        // status cell (replace innerHTML safely)
//                        if (tds[7]) {
//                            const isActive = !!student.isActive;
//                            if (isActive) {
//                                tds[7].innerHTML = '<span class="inline-block px-2 py-1 text-xs font-bold text-teal-800 bg-teal-100 rounded">فعال</span>';
//                                row.classList.remove('bg-rose-50', 'text-rose-700');
//                            } else {
//                                tds[7].innerHTML = '<span class="inline-block px-2 py-1 text-xs font-bold text-rose-800 bg-rose-100 rounded">غیرفعال</span>';
//                                row.classList.add('bg-rose-50', 'text-rose-700');
//                            }
//                        }

//                        // actions cell: keep existing buttons (they usually have data-* attributes)
//                        // but ensure their data-* attributes reflect new values so modals get correct dataset
//                        if (tds[8]) {
//                            // update data-* attributes on buttons inside actions cell if exist
//                            const btns = tds[8].querySelectorAll('button[data-id]');
//                            btns.forEach(btn => {
//                                try {
//                                    btn.setAttribute('data-id', id);
//                                    if (btn.classList.contains('open-student-modal')) {
//                                        btn.setAttribute('data-firstname', student.firstName ?? '');
//                                        btn.setAttribute('data-lastname', student.lastName ?? '');
//                                        btn.setAttribute('data-fathername', student.fatherName ?? '');
//                                        btn.setAttribute('data-school', student.schoolName ?? '');
//                                        btn.setAttribute('data-grade', student.grade ?? '');
//                                        btn.setAttribute('data-coach', student.coachName ?? '');
//                                        btn.setAttribute('data-nationalcode', student.nationalCode ?? '');
//                                        btn.setAttribute('data-photo', student.photo ?? '/uploads/students/default.png');
//                                        btn.setAttribute('data-class', student.className ?? '');
//                                        btn.setAttribute('data-isactive', (!!student.isActive).toString());
//                                        btn.setAttribute('data-inactivereason', student.inactiveReason ?? '');
//                                    }
//                                } catch (e) { /* ignore per-button errors */ }
//                            });
//                        }

//                        // inactive reason cell (last)
//                        if (tds[9]) {
//                            if (!student.isActive && (student.inactiveReason ?? '').toString().trim() !== '') {
//                                tds[9].innerHTML = `<div class="max-w-xs mx-auto break-words text-sm text-rose-800 bg-rose-50 px-2 py-1 rounded">${String(student.inactiveReason)}</div>`;
//                            } else {
//                                tds[9].innerHTML = `<span class="text-slate-400">عدم اطلاع رسانی</span>`;
//                            }
//                        }

//                        console.debug('[SignalR] Row updated via DOM patch for id=' + id);
//                        return;
//                    }
//                }
//            } catch (domErr) {
//                console.error('[SignalR] manual DOM update failed:', domErr);
//                // fallthrough to rebuild
//            }

//            // 4) Fallback: rebuild current page (server-paged). Safe if function exists.
//            try {
//                if (typeof window.rebuildTableBodyFromServerPaged === 'function') {
//                    const page = (window.StudentsClient && window.StudentsClient.currentPage) || (typeof currentPage !== 'undefined' ? currentPage : 1);
//                    const pageSize = (document.getElementById('studentsPageSize')?.value ? parseInt(document.getElementById('studentsPageSize').value, 10) : ((window.StudentsClient && window.StudentsClient.defaultPageSize) || 50));
//                    const q = (document.getElementById('studentSearchInput')?.value || '').trim();
//                    window.rebuildTableBodyFromServerPaged(page, pageSize, q, (window.StudentsClient?.pageShowInactive === true || window.StudentsClient?.pageShowInactive === 'true'));
//                    console.debug('[SignalR] Called rebuildTableBodyFromServerPaged as fallback.');
//                    return;
//                }
//            } catch (rebuildErr) {
//                console.error('[SignalR] rebuildTableBodyFromServerPaged failed:', rebuildErr);
//            }

//            // 5) last resort: full page refresh (very safe, ولی درصورت لزوم)
//            try {
//                console.warn('[SignalR] No safe update possible, performing full page reload as last resort.');
//                location.reload();
//            } catch (reloadErr) {
//                console.error('[SignalR] final reload failed:', reloadErr);
//            }

//        } catch (outerErr) {
//            console.error('[SignalR] StudentUpdated outer handler error:', outerErr);
//        }
//    });

//    connection.on('StudentDeleted', function () {
//        if (typeof rebuildTableBodyFromServerPaged === 'function') {
//            rebuildTableBodyFromServerPaged(window.StudentsClient?.currentPage || 1,
//                (document.getElementById('studentsPageSize')?.value ? parseInt(document.getElementById('studentsPageSize').value, 10) : defaultPageSize),
//                (document.getElementById('studentSearchInput')?.value || '').trim(),
//                (window.StudentsClient?.pageShowInactive === true || window.StudentsClient?.pageShowInactive === 'true'));
//        }
//    });


//    connection.on('StudentDeleted', function (payload) {
//        try {
//            console.debug('SignalR StudentDeleted', payload);
//            const id = payload?.id || payload;
//            const reason = payload?.inactiveReason;
//            // سعی کن ردیف را حذف یا آپدیت کنی
//            const row = document.getElementById('row-' + id) || document.querySelector(`tr[data-student-id='${id}']`);
//            if (row) {
//                // mark as inactive if you prefer OR remove row
//                // اینجا ما status و علت را آپدیت می‌کنیم (ایمن و idempotent)
//                row.classList.add('bg-rose-50', 'text-rose-700');

//                // وضعیت
//                const statusCell = row.querySelector('td:nth-child(9)');
//                if (statusCell) statusCell.innerHTML = '<span class="inline-block px-2 py-1 text-xs font-bold text-rose-800 bg-rose-100 rounded">غیرفعال</span>';

//                // علت (ستون آخر)
//                const reasonCell = row.querySelector('td:last-child');
//                if (reasonCell) {
//                    reasonCell.innerHTML = reason && reason.trim() !== ''
//                        ? `<div class="max-w-xs mx-auto break-words text-sm text-rose-800 bg-rose-50 px-2 py-1 rounded">${escapeHtml(reason)}</div>`
//                        : `<span class="text-slate-400">داده ثبت نشده</span>`;
//                }
//                return;
//            }

//            // اگر ردیف نبود، بازسازی صفحه جاری
//            if (typeof rebuildTableBodyFromServerPaged === 'function') {
//                rebuildTableBodyFromServerPaged(window.StudentsClient?.currentPage || 1,
//                    (document.getElementById('studentsPageSize')?.value ? parseInt(document.getElementById('studentsPageSize').value, 10) : window.StudentsClient?.defaultPageSize || 50),
//                    (document.getElementById('studentSearchInput')?.value || '').trim(),
//                    (window.StudentsClient?.pageShowInactive === true || window.StudentsClient?.pageShowInactive === 'true'));
//            }
//        } catch (e) {
//            console.warn('Error handling StudentDeleted signal:', e);
//        }
//    });

//    connection.on('StudentRestored', function (student) {
//        try {
//            console.debug('SignalR StudentRestored', student);
//            if (student && typeof updateRowWithStudent === 'function') {
//                updateRowWithStudent(student, !!student.isActive);
//                return;
//            }
//            if (typeof rebuildTableBodyFromServerPaged === 'function') {
//                rebuildTableBodyFromServerPaged(window.StudentsClient?.currentPage || 1,
//                    (document.getElementById('studentsPageSize')?.value ? parseInt(document.getElementById('studentsPageSize').value, 10) : window.StudentsClient?.defaultPageSize || 50),
//                    (document.getElementById('studentSearchInput')?.value || '').trim(),
//                    (window.StudentsClient?.pageShowInactive === true || window.StudentsClient?.pageShowInactive === 'true'));
//            }
//        } catch (e) {
//            console.warn('Error handling StudentRestored signal:', e);
//        }
//    });

//    // helpers
//    function escapeHtml(s) {
//        if (!s) return '';
//        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
//    }

//    // اعلان پیام در بالا، مرکز و مقداری پایین تر(Global)
//    window.notifyBottom = function (msg, type = 'info', t = 3500) {
//        try {
//            const el = document.createElement('div');
//            el.textContent = msg;

//            // اعمال style مستقیم برای موقعیت و وسط کردن
//            el.style.position = 'fixed';
//            el.style.top = '12px'; // فاصله از بالا
//            el.style.left = '50%'; // وسط افقی
//            el.style.transform = 'translateX(-50%)'; // دقیقاً وسط
//            el.style.zIndex = 9999;
//            el.style.padding = '8px 16px';
//            el.style.transition = 'all 0.3s ease-out';

//            el.className = `
//            fixed top-[80px] left-1/2
//            -translate-x-1/2
//            px-4 py-2 rounded shadow-lg text-sm font-bold text-teal-600
//            opacity-0 translate-y-[-10px]
//            transition-all duration-300 ease-out
//            z-[9999]
//            ${type === 'success' ? 'bg-teal-50' : type === 'warning' ? 'bg-amber-400' : 'bg-teal-50'}
//        `;

//            document.body.appendChild(el);

//            // نمایش با انیمیشن
//            requestAnimationFrame(() => {
//                el.classList.remove('opacity-0', 'translate-y-4');
//                el.classList.add('opacity-100', 'translate-y-0');
//            });

//            // مخفی شدن بعد از مدت زمان t
//            setTimeout(() => {
//                el.classList.remove('opacity-100', 'translate-y-0');
//                el.classList.add('opacity-0', 'translate-y-4');
//                el.addEventListener('transitionend', () => el.remove(), { once: true });
//            }, t);

//        } catch (e) {
//            console.error('notifyBottom error:', e);
//            console.log(type, msg);
//        }
//    };

//    // اتصال و مدیریت reconnect
//    connection.start()
//        .then(() => {
//            console.info('SignalR connected to', hubUrl);
//            notifyBottom('دریافت آخرین بروزرسانی ها.', 'success', 4000);
//        })
//        .catch(err => {
//            console.warn('SignalR connection error', err);
//            // فقط لاگ، پیام طولانی نده
//        });


//    /* ===== SignalR -> بروزرسانی اطلاعات مربوط به جدول دانش آموزان شامل: تعداد صفحات جاری جدول، دانش آموزان غیرفعال، فعال و غیره =====
//   Place this near your SignalR handlers (after your connection.on(...) registrations).
//   Safe: will not change other logic, only updates DOM counters after events.
//*/
//    (function () {
//        'use strict';

//        // helper: read current page / pageSize / search from DOM or fallbacks
//        function readPagingParams() {
//            const page = (typeof window.StudentsClient !== 'undefined' && window.StudentsClient.currentPage) || (typeof currentPage !== 'undefined' && currentPage) || 1;
//            const pageSizeEl = document.getElementById('studentsPageSize');
//            const pageSize = pageSizeEl ? parseInt(pageSizeEl.value || pageSizeEl.getAttribute('value') || '') || (typeof defaultPageSize !== 'undefined' ? defaultPageSize : 50)
//                : (typeof defaultPageSize !== 'undefined' ? defaultPageSize : 50);
//            const searchEl = document.getElementById('studentSearchInput');
//            const search = searchEl ? (searchEl.value || '') : '';
//            return { page, pageSize, search };
//        }

//        // fetch a light-weight paged response to extract totalCount / totalPages
//        async function fetchTotalsFromServer(showInactive) {
//            try {
//                // listPagedUrl must be defined in your page JS (var created earlier)
//                if (typeof listPagedUrl === 'undefined' || !listPagedUrl) return null;

//                const { search } = readPagingParams();
//                // ask for 1 item only to get totals (server returns totalCount/totalPages)
//                const url = `${listPagedUrl}?page=1&pageSize=1&showInactive=${!!showInactive}&search=${encodeURIComponent(search)}`;
//                const res = await fetch(url, { credentials: 'same-origin' });
//                if (!res.ok) {
//                    // non-fatal: log and return null
//                    console.warn('fetchTotalsFromServer: failed to fetch totals', res.status);
//                    return null;
//                }
//                const json = await res.json();
//                return json || null;
//            } catch (err) {
//                console.warn('fetchTotalsFromServer error', err);
//                return null;
//            }
//        }

//        // update DOM counters if present
//        function applyTotalsToDom(totals, showInactive) {
//            try {
//                if (!totals) {
//                    // still try to refresh inactive count if function exists
//                    if (typeof refreshInactiveCountOnPage === 'function') {
//                        try { refreshInactiveCountOnPage(!!showInactive); } catch (e) { /* ignore */ }
//                    }
//                    return;
//                }

//                const totalCountEl = document.getElementById('studentsTotalCount');
//                if (totalCountEl && (typeof totals.totalCount !== 'undefined' || typeof totals.totalCount === 'number')) {
//                    totalCountEl.textContent = String(totals.totalCount ?? totals.totalCount === 0 ? '0' : totalCountEl.textContent);
//                } else if (totalCountEl && typeof totals.totalCount === 'undefined' && typeof totals.totalCount === 'number') {
//                    totalCountEl.textContent = String(totals.totalCount);
//                }

//                const inactiveCountEl = document.getElementById('studentsInactiveCount');
//                if (inactiveCountEl && typeof totals.inactiveCount !== 'undefined') {
//                    inactiveCountEl.textContent = String(totals.inactiveCount);
//                }

//                const totalPagesEl = document.getElementById('studentsTotalPages');
//                if (totalPagesEl && typeof totals.totalPages !== 'undefined') {
//                    totalPagesEl.textContent = String(totals.totalPages);
//                }

//                // current page element typically shows "X صفحه" in markup,
//                // keep its numeric part updated if element exists
//                const currentPageEl = document.getElementById('studentsCurrentPage');
//                if (currentPageEl) {
//                    const pageNum = (typeof window.StudentsClient !== 'undefined' && window.StudentsClient.currentPage) || (typeof currentPage !== 'undefined' && currentPage) || 1;
//                    // if the element contains text like "1 صفحه / 10"، we just replace the leading number:
//                    const raw = currentPageEl.textContent || '';
//                    // try to preserve surrounding text; replace first number found
//                    const replaced = raw.replace(/\d+/, String(pageNum));
//                    currentPageEl.textContent = replaced;
//                }
//            } catch (err) {
//                console.warn('applyTotalsToDom error', err);
//            }
//        }

//        // public: refresh counts (calls server for totals and also refreshInactiveCountOnPage)
//        async function refreshSummaryCounts(showInactive = (typeof pageShowInactive !== 'undefined' ? (pageShowInactive === true || pageShowInactive === 'true') : false)) {
//            try {
//                // refresh inactive counter using your existing helper (non-blocking)
//                if (typeof refreshInactiveCountOnPage === 'function') {
//                    try { await refreshInactiveCountOnPage(showInactive); } catch (e) { /* ignore */ }
//                }

//                // then fetch totals (totalCount / totalPages)
//                const totals = await fetchTotalsFromServer(showInactive);
//                if (totals) {
//                    // Ensure expected field names: ListPaged returns { totalCount, inactiveCount, currentPage, totalPages }
//                    applyTotalsToDom(totals, showInactive);
//                }
//            } catch (err) {
//                console.warn('refreshSummaryCounts error', err);
//            }
//        }

//        // attach to SignalR events (use existing event names you already handle)
//        // safe: if connection variable or .on missing, do nothing
//        try {
//            if (typeof connection !== 'undefined' && connection && typeof connection.on === 'function') {
//                const mkHandler = function () {
//                    return async function () {
//                        // keep call small and non-blocking
//                        try {
//                            // showInactive param read from pageShowInactive if available
//                            const si = (typeof pageShowInactive !== 'undefined') ? (pageShowInactive === true || pageShowInactive === 'true') : false;
//                            await refreshSummaryCounts(si);
//                        } catch (e) {
//                            console.warn('SignalR summary refresh handler error', e);
//                        }
//                    };
//                };

//                // common event names — if your hub uses other names, add them here
//                const eventsToBind = ['StudentUpdated', 'StudentCreated', 'StudentDeleted', 'StudentRestored'];
//                eventsToBind.forEach(ev => {
//                    try { connection.on(ev, mkHandler()); } catch (e) { /* ignore if event already bound or not used */ }
//                });

//                // optionally call once at load to sync counts immediately
//                // (non-blocking)
//                (async () => { await refreshSummaryCounts(); })();
//            } else {
//                // if no connection object, at least call refresh once
//                (async () => { await refreshSummaryCounts(); })();
//            }
//        } catch (err) {
//            console.warn('setup refreshSummaryCounts failed', err);
//        }

//        // expose for debugging
//        window.refreshStudentSummaryCounts = refreshSummaryCounts;

//    })();

//    connection.onreconnecting((error) => {
//        console.warn('SignalR reconnecting...', error);
//        notifyBottom('در حال تلاش برای ارتباط مجدد...', 'warning', 2000);
//    });

//    connection.onreconnected((connectionId) => {
//        console.info('SignalR reconnected, id=', connectionId);
//        notifyBottom('ارتباط بازسازی شد.', 'success', 1500);
//    });

//    // در صورت نیاز اکسپورت کن تا از کنسول قابل کنترل باشد
//    window.StudentsSignalR = { connection };
//})();
