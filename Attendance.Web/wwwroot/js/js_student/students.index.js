(function () {
    // --------------------------
    // showNotify (global) - keep as before
    // --------------------------
    window.showNotify = function (message, type = 'success') {
        const container = document.createElement('div');
        container.className = 'fixed top-5 left-1/2 -translate-x-1/2 z-[99999] pointer-events-auto';
        const box = document.createElement('div');
        box.className = (type === 'error')
            ? 'bg-rose-600 text-white px-5 py-3 rounded shadow-lg'
            : (type === 'info')
                ? 'bg-gray-700 text-white px-5 py-3 rounded shadow-lg'
                : 'bg-teal-600 text-white px-5 py-3 rounded shadow-lg';

        box.textContent = message;
        container.appendChild(box);
        document.body.appendChild(container);

        // fade out / remove
        setTimeout(() => {
            try { container.remove(); } catch (e) { /* ignore */ }
        }, 3000);
    };

    // --------------------------
    // Utility: dynamically load script (synchronous order)
    // --------------------------
    function loadScriptSync(url, onLoad, onError) {
        const s = document.createElement('script');
        s.src = url;
        s.async = false; // preserve execution order
        s.onload = () => onLoad && onLoad();
        s.onerror = (e) => onError && onError(e);
        document.head.appendChild(s);
    }

    // --------------------------
    // Ensure SignalR is available, otherwise load from CDN
    // --------------------------
    function ensureSignalR(done) {
        if (window.signalR) {
            return done();
        }

        const cdnUrl = 'https://cdn.jsdelivr.net/npm/@microsoft/signalr@9.0.6/dist/browser/signalr.min.js';

        loadScriptSync(cdnUrl, function () {
            if (window.signalR) {
                done();
            } else {
                console.error('signalR loaded but window.signalR is undefined.');
                done();
            }
        }, function (err) {
            console.error('Failed to load signalR from CDN:', err);
            done();
        });
    }

    // --------------------------
    // Helpers to find and update rows (keep existing behavior)
    // --------------------------
    function findRowById(id) {
        if (id === undefined || id === null) return null;
        return document.querySelector(`#row-${id}`) || document.querySelector(`#student-row-${id}`);
    }

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

        // update visible cells (best-effort based on known partial structure)
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

            const paymentCell = tds[7];
            if (paymentCell) {
                // if your columns differ adjust index
                paymentCell.innerHTML = student.paymentStatus === 1
                    ? '<span class="inline-block px-2 py-1 font-bold text-sm text-emerald-700 bg-emerald-100 rounded">پرداخت شده</span>'
                    : (student.paymentStatus === 2
                        ? '<span class="inline-block px-2 py-1 font-bold text-sm text-amber-700 bg-amber-100 rounded">در حال پرداخت</span>'
                        : '<span class="inline-block px-2 py-1 font-bold text-sm text-rose-700 bg-rose-100 rounded">پرداخت نشده</span>');
            }

            const statusCell = tds[8];
            if (statusCell) {
                statusCell.innerHTML = student.isActive
                    ? '<span class="inline-block px-2 py-1 font-bold text-sm text-teal-800 bg-teal-100 rounded">فعال</span>'
                    : '<span class="inline-block px-2 py-1 font-bold text-sm text-rose-800 bg-rose-100 rounded">غیرفعال</span>';
            }
        }

        // highlight
        try {
            const prev = row.style.backgroundColor;
            row.style.transition = 'background-color .6s ease';
            row.style.backgroundColor = 'rgba(167, 243, 208, 0.6)';
            setTimeout(() => { row.style.backgroundColor = prev || ''; }, 900);
        } catch (e) { /* ignore */ }

        return true;
    }

    // --------------------------
    // AJAX: fetch partial HTML and replace sections
    // --------------------------
    const defaultHeaders = { 'X-Requested-With': 'XMLHttpRequest' };

    async function fetchAndReplace(url) {
        const loader = document.getElementById('students-loader');
        try {
            if (loader) loader.classList.remove('hidden');

            const res = await fetch(url, { headers: defaultHeaders, credentials: 'same-origin' });
            if (!res.ok) {
                console.error('AJAX fetch failed', res.status);
                window.showNotify && window.showNotify('خطا در بارگذاری داده‌ها.', 'error');
                return;
            }

            const html = await res.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            // 1) replace tbody
            const newTbody = doc.querySelector('#students-table-body');
            const tbody = document.querySelector('#students-table-body');
            if (newTbody && tbody) {
                tbody.innerHTML = newTbody.innerHTML;
            }

            // 2) replace stat cards (the grid inside the stats wrapper)
            // find the stats container in current doc (first .grid inside the stat wrapper)
            const currentStatsParent = document.querySelector('.bg-slate-100\\/50 .grid') || document.querySelector('.grid');
            const newStats = doc.querySelector('.bg-slate-100\\/50 .grid') || doc.querySelector('.grid');
            if (currentStatsParent && newStats) {
                currentStatsParent.innerHTML = newStats.innerHTML;
            } else {
                // fallback: try to replace first three stat cards by index
                const curCards = document.querySelectorAll('.bg-slate-100\\/50 .grid > div, .grid > div');
                const newCards = doc.querySelectorAll('.bg-slate-100\\/50 .grid > div, .grid > div');
                if (curCards.length === newCards.length && curCards.length > 0) {
                    newCards.forEach((c, i) => curCards[i].innerHTML = c.innerHTML);
                }
            }

            // 3) replace pagination block (the parent div.mt-4 that contains page numbers)
            const newPaginationBlock = doc.querySelector('div.mt-4.flex.items-center.justify-between.gap-2') || doc.querySelector('div.mt-4');
            const curPaginationBlock = document.querySelector('div.mt-4.flex.items-center.justify-between.gap-2') || document.querySelector('div.mt-4');
            if (newPaginationBlock && curPaginationBlock) {
                curPaginationBlock.innerHTML = newPaginationBlock.innerHTML;
            }

            // re-bind events for dynamic elements if necessary (no heavy reinit here)
        } catch (err) {
            console.error('fetchAndReplace error', err);
            window.showNotify && window.showNotify('خطا هنگام دریافت اطلاعات از سرور.', 'error');
        } finally {
            if (loader) loader.classList.add('hidden');
        }
    }

    // debounce helper
    function debounce(fn, delay) {
        let t = null;
        return function (...args) {
            clearTimeout(t);
            t = setTimeout(() => fn.apply(this, args), delay);
        };
    }

    // --------------------------
    // Main: runs after SignalR is ensured
    // --------------------------
    function main() {
        // ---------- SignalR setup (as before) ----------
        if (typeof window.signalR === 'undefined') {
            console.warn('SignalR is not available. Real-time updates will be disabled.');
        } else {
            const connection = new signalR.HubConnectionBuilder()
                .withUrl('/hubs/studentHub')
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

            connection.on('StudentCreated', function (student) {
                window.showNotify && window.showNotify('دانش‌آموز جدید ایجاد شد.', 'success');
            });

            connection.on('StudentUpdated', function (student) {
                updateRowFromDto(student);
                window.showNotify && window.showNotify('اطلاعات دانش‌آموز به‌روز شد.', 'success');
            });

            connection.on('StudentDeleted', function (payload) {
                const id = (payload && (payload.id || payload.Id)) || null;
                const row = findRowById(id);
                if (row) {
                    row.classList.add('bg-rose-50', 'text-rose-700');
                    const statusCell = row.querySelectorAll('td')[7];
                    if (statusCell) statusCell.innerHTML = '<span class="inline-block px-2 py-1 font-bold text-sm text-rose-800 bg-rose-100 rounded">غیرفعال</span>';
                    window.showNotify && window.showNotify('دانش‌آموز غیرفعال شد.', 'info');
                } else {
                    window.showNotify && window.showNotify('دانش‌آموز غیرفعال شد.', 'info');
                }
            });

            connection.on('StudentRestored', function (payload) {
                const id = (payload && (payload.id || payload.Id)) || null;
                const row = findRowById(id);
                if (row) {
                    row.classList.remove('bg-rose-50', 'text-rose-700');
                    const statusCell = row.querySelectorAll('td')[7];
                    if (statusCell) statusCell.innerHTML = '<span class="inline-block px-2 py-1 font-bold text-sm text-teal-800 bg-teal-100 rounded">فعال</span>';
                    window.showNotify && window.showNotify('دانش‌آموز فعال شد.', 'success');
                } else {
                    window.showNotify && window.showNotify('دانش‌آموز فعال شد.', 'success');
                }
            });

            connection.on('StudentHardDeleted', function (payload) {
                const id = (payload && (payload.id || payload.Id)) || null;
                const row = findRowById(id);
                if (row) {
                    row.style.transition = 'all .4s ease';
                    row.style.opacity = '0';
                    row.style.height = '0px';
                    setTimeout(() => {
                        try { row.remove(); } catch (e) { /* ignore */ }
                    }, 420);
                    window.showNotify && window.showNotify('دانش‌آموز حذف شد.', 'info');
                } else {
                    window.showNotify && window.showNotify('دانش‌آموز حذف شد.', 'info');
                }
            });

            startConnection();
        }

        // --------------------------
        // Bind UI: search input, pageSize selector, pagination links (AJAX)
        // --------------------------
        const searchInput = document.getElementById('studentSearchInput');
        const pageSizeSelector = document.getElementById('pageSizeSelector');

        // helper to build URL for Index with params (replace the old function)
        // جهت جستجوی در لحظه برای یافتن اطلاعات دانش آموز
        function buildIndexUrl({ page = 1, pageSize = (pageSizeSelector ? pageSizeSelector.value : 5), search = (searchInput ? searchInput.value : '') } = {}) {
            // use relative path to avoid Razor inside external JS
            const basePath = '/Students/Index'; // <-- اگر اپت در Area است این را اصلاح کن (مثلا '/AreaName/Students/Index')
            const params = new URLSearchParams();
            params.set('page', String(page));
            params.set('pageSize', String(pageSize));
            if (search && String(search).trim() !== '') params.set('search', String(search).trim());
            return basePath + '?' + params.toString();
        }


        // debounce search -> fetch page 1
        if (searchInput) {
            const onSearch = debounce(() => {
                const url = buildIndexUrl({ page: 1, pageSize: pageSizeSelector ? pageSizeSelector.value : 5, search: searchInput.value });
                fetchAndReplace(url);
            }, 450);

            searchInput.addEventListener('input', onSearch);

            // optional: pressing Enter triggers immediate search
            searchInput.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const url = buildIndexUrl({ page: 1, pageSize: pageSizeSelector ? pageSizeSelector.value : 5, search: searchInput.value });
                    fetchAndReplace(url);
                }
            });
        }

        // change pageSize -> fetch current page with new pageSize (keep search)
        if (pageSizeSelector) {
            pageSizeSelector.addEventListener('change', function () {
                const url = buildIndexUrl({ page: 1, pageSize: this.value, search: searchInput ? searchInput.value : '' });
                fetchAndReplace(url);
            });
        }

        // delegate clicks on pagination links (works after replacements too because we listen on document)
        document.addEventListener('click', function (e) {
            const a = e.target.closest('a');
            if (!a) return;

            // detect pagination anchors by checking for asp-route-page in rendered HTML it's converted to a normal href
            // Safer: check if href contains 'page=' param or link is inside pagination container
            const parentPag = a.closest('nav') || a.closest('div.mt-4');
            if (!parentPag) return;

            // try to extract page number from href or from asp-route-page attribute if present
            const href = a.getAttribute('href') || '';
            const m = href.match(/[?&]page=(\d+)/);
            let targetPage = 1;
            if (m) targetPage = parseInt(m[1], 10);
            else {
                // fallback: data-page attribute?
                const dp = a.getAttribute('data-page');
                if (dp) targetPage = parseInt(dp, 10);
            }

            // if this link is a pagination control, intercept
            if (href.includes('page=') || parentPag.classList.contains('pagination') || a.closest('nav')) {
                e.preventDefault();
                const url = buildIndexUrl({ page: targetPage, pageSize: pageSizeSelector ? pageSizeSelector.value : 5, search: searchInput ? searchInput.value : '' });
                fetchAndReplace(url);
            }
        });
    }

    // --------------------------
    // DOM ready -> ensure SignalR -> run main
    // --------------------------
    document.addEventListener('DOMContentLoaded', function () {
        ensureSignalR(main);
    });

})();

//(function () {
//    // --------------------------
//    // showNotify (global)
//    // --------------------------
//    window.showNotify = function (message, type = 'success') {
//        const container = document.createElement('div');
//        container.className = 'fixed top-5 left-1/2 -translate-x-1/2 z-[99999] pointer-events-auto';
//        const box = document.createElement('div');
//        box.className = (type === 'error')
//            ? 'bg-rose-600 text-white px-5 py-3 rounded shadow-lg'
//            : (type === 'info')
//                ? 'bg-gray-700 text-white px-5 py-3 rounded shadow-lg'
//                : 'bg-teal-600 text-white px-5 py-3 rounded shadow-lg';

//        box.textContent = message;
//        container.appendChild(box);
//        document.body.appendChild(container);

//        // fade out / remove
//        setTimeout(() => {
//            try { container.remove(); } catch (e) { /* ignore */ }
//        }, 3000);
//    };

//    // --------------------------
//    // Utility: dynamically load script (synchronous order)
//    // --------------------------
//    function loadScriptSync(url, onLoad, onError) {
//        const s = document.createElement('script');
//        s.src = url;
//        s.async = false; // preserve execution order
//        s.onload = () => onLoad && onLoad();
//        s.onerror = (e) => onError && onError(e);
//        document.head.appendChild(s);
//    }

//    // --------------------------
//    // Ensure SignalR is available, otherwise load from CDN
//    // --------------------------
//    function ensureSignalR(done) {
//        if (window.signalR) {
//            return done();
//        }

//        // CDN URL with encoded @ to avoid Razor issues if this script is inlined
//        const cdnUrl = 'https://cdn.jsdelivr.net/npm/@microsoft/signalr@9.0.6/dist/browser/signalr.min.js';

//        loadScriptSync(cdnUrl, function () {
//            if (window.signalR) {
//                done();
//            } else {
//                console.error('signalR script loaded but window.signalR is still undefined.');
//                done(); // still call done so rest of app doesn't block forever
//            }
//        }, function (err) {
//            console.error('Failed to load signalR from CDN:', err);
//            done(); // call done anyway (no SignalR available)
//        });
//    }

//    // --------------------------
//    // DOM ready -> ensure SignalR -> run main
//    // --------------------------
//    document.addEventListener('DOMContentLoaded', function () {
//        ensureSignalR(main);
//    });

//    // --------------------------
//    // Helpers to find and update rows
//    // --------------------------
//    function findRowById(id) {
//        if (id === undefined || id === null) return null;
//        return document.querySelector(`#row-${id}`) || document.querySelector(`#student-row-${id}`);
//    }

//    function updateRowFromDto(student) {
//        const row = findRowById(student.id);
//        if (!row) return false;

//        // update data-* attributes
//        row.setAttribute('data-firstname', student.firstName || '');
//        row.setAttribute('data-lastname', student.lastName || '');
//        row.setAttribute('data-nationalcode', student.nationalCode || '');
//        row.setAttribute('data-grade', student.grade || '');
//        row.setAttribute('data-school', student.schoolName || '');
//        row.setAttribute('data-coach', student.coachName || '');
//        row.setAttribute('data-photo', student.photo || '/uploads/students/default.png');
//        row.setAttribute('data-isactive', (student.isActive ? 'true' : 'false'));
//        row.setAttribute('data-inactivereason', student.inactiveReason || '');

//        // update visible cells (based on column order in RowPartial)
//        const tds = row.querySelectorAll('td');
//        if (tds.length >= 9) {
//            const img = tds[0].querySelector('img');
//            if (img) img.src = student.photo || '/uploads/students/default.png';

//            tds[1].textContent = student.firstName || '';
//            tds[2].textContent = student.lastName || '';
//            tds[3].textContent = student.nationalCode || '';
//            tds[4].textContent = student.grade || '';
//            tds[5].textContent = student.schoolName || '';
//            tds[6].textContent = student.coachName || '';

//            const statusCell = tds[7];
//            if (statusCell) {
//                statusCell.innerHTML = student.isActive
//                    ? '<span class="inline-block px-2 py-1 font-bold text-sm text-teal-800 bg-teal-100 rounded">فعال</span>'
//                    : '<span class="inline-block px-2 py-1 font-bold text-sm text-rose-800 bg-rose-100 rounded">غیرفعال</span>';
//            }

//            const reasonCell = tds[8];
//            if (reasonCell) {
//                if (!student.isActive && student.inactiveReason) {
//                    reasonCell.innerHTML = `<div class="max-w-xs mx-auto break-words text-sm text-pink-800 bg-pink-100 px-2 py-1 rounded">${student.inactiveReason}</div>`;
//                } else {
//                    reasonCell.innerHTML = `<span class="text-slate-400"> --- </span>`;
//                }
//            }
//        }

//        // highlight
//        try {
//            const prev = row.style.backgroundColor;
//            row.style.transition = 'background-color .6s ease';
//            row.style.backgroundColor = 'rgba(167, 243, 208, 0.6)';
//            setTimeout(() => { row.style.backgroundColor = prev || ''; }, 900);
//        } catch (e) { /* ignore */ }

//        return true;
//    }

//    // --------------------------
//    // Main: runs after SignalR is ensured
//    // --------------------------
//    function main() {
//        // if signalR is not available, we still set up a noop to avoid runtime errors
//        if (typeof window.signalR === 'undefined') {
//            console.warn('SignalR is not available. Real-time updates will be disabled.');
//            return;
//        }

//        // Create connection to the correct hub path (user changed to /hubs/studentHub)
//        const connection = new signalR.HubConnectionBuilder()
//            .withUrl('/hubs/studentHub')
//            .withAutomaticReconnect()
//            .build();

//        // start with retry logic
//        async function startConnection() {
//            try {
//                await connection.start();
//                console.log('SignalR connected');
//            } catch (err) {
//                console.error('SignalR start failed:', err);
//                setTimeout(startConnection, 3000);
//            }
//        }

//        connection.onclose(async () => {
//            console.warn('SignalR connection closed. Reconnecting...');
//            await startConnection();
//        });

//        // --------------------------
//        // SignalR listeners (same behavior as before)
//        // --------------------------
//        connection.on('StudentCreated', function (student) {
//            // notify; optionally you could fetch and insert a new row partial if desired
//            window.showNotify && window.showNotify('دانش‌آموز جدید ایجاد شد.', 'success');
//        });

//        connection.on('StudentUpdated', function (student) {
//            updateRowFromDto(student);
//            window.showNotify && window.showNotify('اطلاعات دانش‌آموز به‌روز شد.', 'success');
//        });

//        connection.on('StudentDeleted', function (payload) {
//            const id = (payload && (payload.id || payload.Id)) || null;
//            const row = findRowById(id);
//            if (row) {
//                row.classList.add('bg-rose-50', 'text-rose-700');
//                const statusCell = row.querySelectorAll('td')[7];
//                if (statusCell) statusCell.innerHTML = '<span class="inline-block px-2 py-1 font-bold text-sm text-rose-800 bg-rose-100 rounded">غیرفعال</span>';
//                window.showNotify && window.showNotify('دانش‌آموز غیرفعال شد.', 'info');
//            } else {
//                window.showNotify && window.showNotify('دانش‌آموز غیرفعال شد.', 'info');
//            }
//        });

//        connection.on('StudentRestored', function (payload) {
//            const id = (payload && (payload.id || payload.Id)) || null;
//            const row = findRowById(id);
//            if (row) {
//                row.classList.remove('bg-rose-50', 'text-rose-700');
//                const statusCell = row.querySelectorAll('td')[7];
//                if (statusCell) statusCell.innerHTML = '<span class="inline-block px-2 py-1 font-bold text-sm text-teal-800 bg-teal-100 rounded">فعال</span>';
//                window.showNotify && window.showNotify('دانش‌آموز فعال شد.', 'success');
//            } else {
//                window.showNotify && window.showNotify('دانش‌آموز فعال شد.', 'success');
//            }
//        });

//        connection.on('StudentHardDeleted', function (payload) {
//            const id = (payload && (payload.id || payload.Id)) || null;
//            const row = findRowById(id);
//            if (row) {
//                row.style.transition = 'all .4s ease';
//                row.style.opacity = '0';
//                row.style.height = '0px';
//                setTimeout(() => {
//                    try { row.remove(); } catch (e) { /* ignore */ }
//                }, 420);
//                window.showNotify && window.showNotify('دانش‌آموز حذف شد.', 'info');
//            } else {
//                window.showNotify && window.showNotify('دانش‌آموز حذف شد.', 'info');
//            }
//        });

//        // --------------------------
//        // Start the connection
//        // --------------------------
//        startConnection();
//    }

//})();
