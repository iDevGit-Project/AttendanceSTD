// students.js
(function () {
    // helper showNotify (global)
    window.showNotify = function (message, type = 'success') {
        const container = document.createElement('div');
        container.className = 'fixed top-5 left-1/2 -translate-x-1/2 z-[99999]';
        const box = document.createElement('div');
        box.className = (type === 'error') ? 'bg-rose-600 text-white px-5 py-3 rounded shadow-lg' : 'bg-teal-600 text-white px-5 py-3 rounded shadow-lg';
        box.textContent = message;
        container.appendChild(box);
        document.body.appendChild(container);
        setTimeout(() => {
            container.remove();
        }, 3000);
    };

    // Start SignalR connection
    const connection = new signalR.HubConnectionBuilder()
        .withUrl('/hubs/students')
        .withAutomaticReconnect()
        .build();

    async function start() {
        try {
            await connection.start();
            console.log('SignalR connected');
        } catch (err) {
            console.error(err);
            setTimeout(start, 5000);
        }
    }
    connection.onclose(() => start());
    start();

    // Helpers to find row by id with fallback
    function findRowById(id) {
        return document.querySelector(`#row-${id}`) || document.querySelector(`#student-row-${id}`);
    }

    // Update row DOM safely based on DTO structure
    function updateRowFromDto(student) {
        const row = findRowById(student.id);
        if (!row) return false;

        // update data-* attributes
        row.setAttribute('data-firstname', student.firstName || '');
        row.setAttribute('data-lastname', student.lastName || '');
        row.setAttribute('data-nationalcode', student.nationalCode || '');
        row.setAttribute('data-grade', student.grade || '');
        row.setAttribute('data-school', student.schoolName || '');
        row.setAttribute('data-coach', student.coachName || '');
        row.setAttribute('data-photo', student.photo || '/uploads/students/default.png');
        row.setAttribute('data-isactive', (student.isActive ? 'true' : 'false'));
        row.setAttribute('data-inactivereason', student.inactiveReason || '');

        // update visible cells (based on column order in RowPartial)
        const tds = row.querySelectorAll('td');
        if (tds.length >= 9) {
            // tds[0] image, tds[1] firstname, tds[2] lastname, tds[3] national, tds[4] grade, tds[5] school, tds[6] coach, tds[7] status, tds[8] reason
            const img = tds[0].querySelector('img');
            if (img) img.src = student.photo || '/uploads/students/default.png';

            tds[1].textContent = student.firstName || '';
            tds[2].textContent = student.lastName || '';
            tds[3].textContent = student.nationalCode || '';
            tds[4].textContent = student.grade || '';
            tds[5].textContent = student.schoolName || '';
            tds[6].textContent = student.coachName || '';

            // status
            const statusCell = tds[7];
            statusCell.innerHTML = student.isActive
                ? '<span class="inline-block px-2 py-1 font-bold text-sm text-teal-800 bg-teal-100 rounded">فعال</span>'
                : '<span class="inline-block px-2 py-1 font-bold text-sm text-rose-800 bg-rose-100 rounded">غیرفعال</span>';

            // inactive reason
            const reasonCell = tds[8];
            if (!student.isActive && student.inactiveReason) {
                reasonCell.innerHTML = `<div class="max-w-xs mx-auto break-words text-sm text-pink-800 bg-pink-100 px-2 py-1 rounded">${student.inactiveReason}</div>`;
            } else {
                reasonCell.innerHTML = `<span class="text-slate-400">داده ثبت نشده</span>`;
            }
        }

        // highlight
        row.style.transition = 'background-color .6s ease';
        const prev = row.style.backgroundColor;
        row.style.backgroundColor = 'rgba(167, 243, 208, 0.6)';
        setTimeout(() => row.style.backgroundColor = prev || '', 900);

        return true;
    }

    // SignalR listeners
    connection.on('StudentCreated', function (student) {
        // Option: if currently on Index, you may want to prepend a new row or refresh list.
        // Simpler: show notify and optionally reload or fetch new partial row.
        showNotify('دانش‌آموز جدید ایجاد شد.');
        // TODO: you can implement logic to prepend new row using server-rendered partial via fetch if desired.
    });

    connection.on('StudentUpdated', function (student) {
        const updated = updateRowFromDto(student);
        showNotify('اطلاعات دانش‌آموز به‌روز شد.');
        // if row not found, do nothing (or consider reloading page)
    });

    connection.on('StudentDeleted', function (payload) {
        const id = payload.id || payload.Id;
        const row = findRowById(id);
        if (row) {
            // soft-remove: mark as inactive visually
            row.classList.add('bg-rose-50', 'text-rose-700');
            const statusCell = row.querySelectorAll('td')[7];
            if (statusCell) statusCell.innerHTML = '<span class="inline-block px-2 py-1 font-bold text-sm text-rose-800 bg-rose-100 rounded">غیرفعال</span>';
            showNotify('دانش‌آموز غیرفعال شد.', 'info');
        } else {
            showNotify('دانش‌آموز غیرفعال شد.', 'info');
        }
    });

    connection.on('StudentRestored', function (payload) {
        const id = payload.id || payload.Id;
        const row = findRowById(id);
        if (row) {
            row.classList.remove('bg-rose-50', 'text-rose-700');
            const statusCell = row.querySelectorAll('td')[7];
            if (statusCell) statusCell.innerHTML = '<span class="inline-block px-2 py-1 font-bold text-sm text-teal-800 bg-teal-100 rounded">فعال</span>';
            showNotify('دانش‌آموز فعال شد.');
        } else {
            showNotify('دانش‌آموز فعال شد.');
        }
    });

    connection.on('StudentHardDeleted', function (payload) {
        const id = payload.id || payload.Id;
        const row = findRowById(id);
        if (row) {
            // animate removal
            row.style.transition = 'all .4s ease';
            row.style.opacity = '0';
            row.style.height = '0px';
            setTimeout(() => row.remove(), 420);
            showNotify('دانش‌آموز حذف شد.', 'info');
        } else {
            showNotify('دانش‌آموز حذف شد.', 'info');
        }
    });

})();
