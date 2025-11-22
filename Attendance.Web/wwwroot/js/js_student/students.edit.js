// students.index.js
// Full-page SignalR client + DOM update for Students list
// - tries multiple CDNs to load SignalR if not present
// - connects to /hubs/studentHub
// - listeners: StudentCreated, StudentUpdated, StudentDeleted, StudentRestored, StudentHardDeleted
// - updates rows safely and shows notify messages

(function () {
    // --------------------------
    // showNotify (global)
    // --------------------------
    window.showNotify = function (message, type = 'success') {
        try {
            const container = document.createElement('div');
            container.className = 'fixed top-5 left-1/2 -translate-x-1/2 z-[99999] pointer-events-auto';
            const box = document.createElement('div');

            if (type === 'error') {
                box.className = 'bg-rose-600 text-white px-5 py-3 rounded shadow-lg';
            } else if (type === 'info') {
                box.className = 'bg-gray-700 text-white px-5 py-3 rounded shadow-lg';
            } else {
                box.className = 'bg-teal-600 text-white px-5 py-3 rounded shadow-lg';
            }

            box.textContent = message;
            container.appendChild(box);
            document.body.appendChild(container);

            // auto remove
            setTimeout(() => {
                try { container.remove(); } catch (e) { /* ignore */ }
            }, 3000);
        } catch (e) {
            // fallback: alert for very old browsers or unexpected errors
            try { console.warn('showNotify error', e); } catch { }
        }
    };

    // --------------------------
    // Helpers: find Row, update DOM
    // --------------------------
    function findRowById(id) {
        if (id === undefined || id === null) return null;
        return document.querySelector(`#row-${id}`) || document.querySelector(`#student-row-${id}`);
    }

    function updateRowFromDto(student) {
        const row = findRowById(student.id);
        if (!row) return false;

        // update data-* attributes
        try {
            row.setAttribute('data-firstname', student.firstName || '');
            row.setAttribute('data-lastname', student.lastName || '');
            row.setAttribute('data-nationalcode', student.nationalCode || '');
            row.setAttribute('data-grade', student.grade || '');
            row.setAttribute('data-school', student.schoolName || '');
            row.setAttribute('data-coach', student.coachName || '');
            row.setAttribute('data-photo', student.photo || '/uploads/students/default.png');
            row.setAttribute('data-isactive', (student.isActive ? 'true' : 'false'));
            row.setAttribute('data-inactivereason', student.inactiveReason || '');
        } catch (e) {
            // ignore attribute set failures
        }

        // update visible cells (based on column order in RowPartial)
        try {
            const tds = row.querySelectorAll('td');
            if (tds.length >= 9) {
                const img = tds[0].querySelector('img');
                if (img) img.src = student.photo || '/uploads/students/default.png';

                tds[1].textContent = student.firstName || '';
                tds[2].textContent = student.lastName || '';
                tds[3].textContent = student.nationalCode || '';
                tds[4].textContent = student.grade || '';
                tds[5].textContent = student.schoolName || '';
                tds[6].textContent = student.coachName || '';

                const statusCell = tds[7];
                if (statusCell) {
                    statusCell.innerHTML = student.isActive
                        ? '<span class="inline-block px-2 py-1 font-bold text-sm text-teal-800 bg-teal-100 rounded">فعال</span>'
                        : '<span class="inline-block px-2 py-1 font-bold text-sm text-rose-800 bg-rose-100 rounded">غیرفعال</span>';
                }

                const reasonCell = tds[8];
                if (reasonCell) {
                    if (!student.isActive && student.inactiveReason) {
                        reasonCell.innerHTML = `<div class="max-w-xs mx-auto break-words text-sm text-pink-800 bg-pink-100 px-2 py-1 rounded">${student.inactiveReason}</div>`;
                    } else {
                        reasonCell.innerHTML = `<span class="text-slate-400">داده ثبت نشده</span>`;
                    }
                }
            }
        } catch (e) {
            console.warn('updateRowFromDto partial update failed', e);
        }

        // highlight change
        try {
            const prev = row.style.backgroundColor;
            row.style.transition = 'background-color .6s ease';
            row.style.backgroundColor = 'rgba(167, 243, 208, 0.6)';
            setTimeout(() => { row.style.backgroundColor = prev || ''; }, 900);
        } catch (e) { /* ignore */ }

        return true;
    }

    // --------------------------
    // Script loader: tries several urls sequentially
    // --------------------------
    function tryLoadSignalR(done) {
        if (window.signalR) return done();

        const urls = [
            // encoded @ for jsdelivr
            'https://cdn.jsdelivr.net/npm/%40microsoft/signalr@7.0.7/dist/browser/signalr.min.js',
            // unpkg
            'https://unpkg.com/@microsoft/signalr@7.0.7/dist/browser/signalr.min.js',
            // alternative jsdelivr (unencoded) - may be blocked by Razor if inlined, but OK as external string
            'https://cdn.jsdelivr.net/npm/@microsoft/signalr@7.0.7/dist/browser/signalr.min.js',
            // cdnjs fallback
            'https://cdnjs.cloudflare.com/ajax/libs/microsoft-signalr/7.0.7/signalr.min.js'
        ];

        let i = 0;
        function tryNext() {
            if (window.signalR) return done();
            if (i >= urls.length) {
                console.error('All SignalR CDN attempts failed.');
                try { window.showNotify && window.showNotify('ارتباط real-time برقرار نشد — SignalR بارگیری نشد.', 'error'); } catch (e) { }
                return done();
            }
            const url = urls[i++];
            const s = document.createElement('script');
            s.src = url;
            s.async = false; // preserve order
            s.onload = function () {
                if (window.signalR) {
                    console.info('Loaded SignalR from:', url);
                    return done();
                } else {
                    console.warn('Loaded script from', url, 'but window.signalR not defined. Trying next.');
                    tryNext();
                }
            };
            s.onerror = function (e) {
                console.warn('Failed to load signalR from', url, e);
                tryNext();
            };
            document.head.appendChild(s);
        }

        tryNext();
    }

    // --------------------------
    // Main: run after signalR attempted loaded
    // --------------------------
    function main() {
        if (typeof window.signalR === 'undefined') {
            console.warn('SignalR is not available. Real-time updates will be disabled.');
            return;
        }

        // Use the hub path you configured on server
        const hubUrl = '/hubs/studentHub';

        const connection = new signalR.HubConnectionBuilder()
            .withUrl(hubUrl)
            .withAutomaticReconnect()
            .build();

        async function startConnection() {
            try {
                await connection.start();
                console.log('SignalR connected');
            } catch (err) {
                console.error('SignalR start failed:', err);
                setTimeout(startConnection, 3000);
            }
        }

        connection.onclose(async () => {
            console.warn('SignalR connection closed. Reconnecting...');
            await startConnection();
        });

        // Listeners
        connection.on('StudentCreated', function (student) {
            try { window.showNotify && window.showNotify('دانش‌آموز جدید ایجاد شد.', 'success'); } catch { }
            // Optional: fetch and prepend a new rendered row partial if you want
        });

        connection.on('StudentUpdated', function (student) {
            try {
                const updated = updateRowFromDto(student);
                window.showNotify && window.showNotify('اطلاعات دانش‌آموز به‌روز شد.', 'success');
                if (!updated) {
                    // row not present on page; optionally trigger a small reload or leave it
                    // console.info('Updated student not present on this page:', student.id);
                }
            } catch (e) { console.warn(e); }
        });

        connection.on('StudentDeleted', function (payload) {
            try {
                const id = (payload && (payload.id || payload.Id)) || null;
                const row = findRowById(id);
                if (row) {
                    row.classList.add('bg-rose-50', 'text-rose-700');
                    const statusCell = row.querySelectorAll('td')[7];
                    if (statusCell) statusCell.innerHTML = '<span class="inline-block px-2 py-1 font-bold text-sm text-rose-800 bg-rose-100 rounded">غیرفعال</span>';
                }
                window.showNotify && window.showNotify('دانش‌آموز غیرفعال شد.', 'info');
            } catch (e) { console.warn(e); }
        });

        connection.on('StudentRestored', function (payload) {
            try {
                const id = (payload && (payload.id || payload.Id)) || null;
                const row = findRowById(id);
                if (row) {
                    row.classList.remove('bg-rose-50', 'text-rose-700');
                    const statusCell = row.querySelectorAll('td')[7];
                    if (statusCell) statusCell.innerHTML = '<span class="inline-block px-2 py-1 font-bold text-sm text-teal-800 bg-teal-100 rounded">فعال</span>';
                }
                window.showNotify && window.showNotify('دانش‌آموز فعال شد.', 'success');
            } catch (e) { console.warn(e); }
        });

        connection.on('StudentHardDeleted', function (payload) {
            try {
                const id = (payload && (payload.id || payload.Id)) || null;
                const row = findRowById(id);
                if (row) {
                    row.style.transition = 'all .4s ease';
                    row.style.opacity = '0';
                    row.style.height = '0px';
                    setTimeout(() => { try { row.remove(); } catch (e) { } }, 420);
                }
                window.showNotify && window.showNotify('دانش‌آموز حذف شد.', 'info');
            } catch (e) { console.warn(e); }
        });

        // Start
        startConnection();
    }

    // --------------------------
    // Kickoff on DOMContentLoaded
    // --------------------------
    document.addEventListener('DOMContentLoaded', function () {
        tryLoadSignalR(main);
    });

})();
