// wwwroot/js/students.createedit.signalr.js
(function () {
    'use strict';

    if (!window.signalR && !window.SignalR) {
        console.warn('SignalR client not found. Please include @microsoft/signalr script before students.createedit.signalr.js');
        return;
    }

    const signalr = window.signalR || window.SignalR;
    const hubUrl = '/hubs/students';

    // helper notify با Tailwind و انیمیشن
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
        }
    }

    // اتصال SignalR
    const connection = new signalr.HubConnectionBuilder()
        .withUrl(hubUrl)
        .withAutomaticReconnect()
        .configureLogging(signalr.LogLevel.Information)
        .build();

    // بروزرسانی یا اضافه کردن ردیف دانش‌آموز
    function updateOrAddStudentRow(student) {
        try {
            if (!student || !student.id) return;

            const id = student.id;
            let row = document.getElementById('row-' + id) || document.querySelector(`tr[data-student-id='${id}']`);

            if (!row) {
                // اگر ردیف نبود، یک ردیف جدید بساز
                const tbody = document.querySelector('#studentsTable tbody');
                if (!tbody) return;

                row = document.createElement('tr');
                row.id = 'row-' + id;
                row.dataset.studentId = id;
                row.innerHTML = `
                    <td><img src="${student.photo || '/uploads/students/default.png'}" class="w-8 h-8 rounded-full"/></td>
                    <td>${student.firstName ?? ''}</td>
                    <td>${student.lastName ?? ''}</td>
                    <td>${student.nationalCode ?? ''}</td>
                    <td>${student.grade ?? ''}</td>
                    <td>${student.schoolName ?? ''}</td>
                    <td>${student.coachName ?? ''}</td>
                    <td>
                        <span class="inline-block px-2 py-1 text-xs font-bold text-${student.isActive ? 'teal' : 'rose'}-800 bg-${student.isActive ? 'teal' : 'rose'}-100 rounded">
                            ${student.isActive ? 'فعال' : 'غیرفعال'}
                        </span>
                    </td>
                    <td>
                        <!-- دکمه‌ها و data-* -->
                        <button class="open-student-modal" data-id="${id}" data-firstname="${student.firstName}" data-lastname="${student.lastName}" data-fathername="${student.fatherName}" data-school="${student.schoolName}" data-grade="${student.grade}" data-coach="${student.coachName}" data-nationalcode="${student.nationalCode}" data-photo="${student.photo}" data-isactive="${!!student.isActive}" data-inactivereason="${student.inactiveReason ?? ''}">ویرایش</button>
                    </td>
                    <td>${student.inactiveReason ?? '<span class="text-slate-400">عدم اطلاع رسانی</span>'}</td>
                `;
                tbody.prepend(row);
                notify('دانش‌آموز جدید اضافه شد.', 'success', 3000);
                return;
            }

            // اگر ردیف وجود داشت، اطلاعاتش بروزرسانی شود
            const tds = Array.from(row.querySelectorAll('td'));
            if (tds[0]) tds[0].querySelector('img').src = student.photo || '/uploads/students/default.png';
            if (tds[1]) tds[1].textContent = student.firstName ?? '';
            if (tds[2]) tds[2].textContent = student.lastName ?? '';
            if (tds[3]) tds[3].textContent = student.nationalCode ?? '';
            if (tds[4]) tds[4].textContent = student.grade ?? '';
            if (tds[5]) tds[5].textContent = student.schoolName ?? '';
            if (tds[6]) tds[6].textContent = student.coachName ?? '';
            if (tds[7]) {
                tds[7].innerHTML = `<span class="inline-block px-2 py-1 text-xs font-bold text-${student.isActive ? 'teal' : 'rose'}-800 bg-${student.isActive ? 'teal' : 'rose'}-100 rounded">${student.isActive ? 'فعال' : 'غیرفعال'}</span>`;
            }
            if (tds[8]) {
                const btn = tds[8].querySelector('button');
                if (btn) {
                    btn.dataset.firstname = student.firstName ?? '';
                    btn.dataset.lastname = student.lastName ?? '';
                    btn.dataset.fathername = student.fatherName ?? '';
                    btn.dataset.school = student.schoolName ?? '';
                    btn.dataset.grade = student.grade ?? '';
                    btn.dataset.coach = student.coachName ?? '';
                    btn.dataset.nationalcode = student.nationalCode ?? '';
                    btn.dataset.photo = student.photo ?? '/uploads/students/default.png';
                    btn.dataset.isactive = (!!student.isActive).toString();
                    btn.dataset.inactivereason = student.inactiveReason ?? '';
                }
            }
            if (tds[9]) tds[9].innerHTML = student.inactiveReason ?? '<span class="text-slate-400">عدم اطلاع رسانی</span>';

            notify('اطلاعات دانش‌آموز بروزرسانی شد.', 'success', 2500);

        } catch (err) {
            console.error('updateOrAddStudentRow error:', err);
        }
    }

    // دریافت رویدادها
    connection.on('StudentCreated', updateOrAddStudentRow);
    connection.on('StudentUpdated', updateOrAddStudentRow);

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
    window.StudentsCreateEditSignalR = { connection, updateOrAddStudentRow };

})();
