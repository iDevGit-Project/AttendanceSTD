// students.summary.sync.js
(function () {
    'use strict';

    // debounce helper
    function debounce(fn, ms = 400) {
        let t = null;
        return function (...args) {
            clearTimeout(t);
            t = setTimeout(() => fn.apply(this, args), ms);
        };
    }

    // read current UI params
    function readPagingParams() {
        const page = (window.StudentsClient && window.StudentsClient.currentPage) || (typeof currentPage !== 'undefined' && currentPage) || 1;
        const pageSizeEl = document.getElementById('studentsPageSize');
        const pageSize = pageSizeEl ? parseInt(pageSizeEl.value || pageSizeEl.getAttribute('value') || '') || (typeof defaultPageSize !== 'undefined' ? defaultPageSize : 50)
            : (typeof defaultPageSize !== 'undefined' ? defaultPageSize : 50);
        const searchEl = document.getElementById('studentSearchInput');
        const search = searchEl ? (searchEl.value || '') : '';
        return { page, pageSize, search };
    }

    // listPagedUrl fallback
    const listPagedEndpoint = (typeof listPagedUrl !== 'undefined' && listPagedUrl)
        ? listPagedUrl
        : (window.StudentsConfig && window.StudentsConfig.urls && window.StudentsConfig.urls.listPaged)
            ? window.StudentsConfig.urls.listPaged
            : '/Students/ListPaged';

    // fetch totals from server (light request page=1&pageSize=1)
    async function fetchTotalsFromServer(showInactive = (typeof pageShowInactive !== 'undefined' ? (pageShowInactive === true || pageShowInactive === 'true') : false)) {
        try {
            const { search } = readPagingParams();
            const url = `${listPagedEndpoint}?page=1&pageSize=1&showInactive=${!!showInactive}&search=${encodeURIComponent(search)}`;
            const res = await fetch(url, { credentials: 'same-origin' });
            if (!res.ok) return null;
            const json = await res.json();
            return json;
        } catch (err) {
            console.warn('fetchTotalsFromServer error', err);
            return null;
        }
    }

    // apply totals to DOM (safe, non-throwing)
    function applyTotalsToDom(totals, showInactive) {
        try {
            if (!totals) {
                if (typeof refreshInactiveCountOnPage === 'function') {
                    try { refreshInactiveCountOnPage(!!showInactive); } catch (e) { /* ignore */ }
                }
                return;
            }

            const totalCountEl = document.getElementById('studentsTotalCount');
            if (totalCountEl && typeof totals.totalCount !== 'undefined') totalCountEl.textContent = String(totals.totalCount);

            const inactiveCountEl = document.getElementById('studentsInactiveCount');
            if (inactiveCountEl && typeof totals.inactiveCount !== 'undefined') inactiveCountEl.textContent = String(totals.inactiveCount);

            const totalPagesEl = document.getElementById('studentsTotalPages');
            if (totalPagesEl && typeof totals.totalPages !== 'undefined') totalPagesEl.textContent = String(totals.totalPages);

            const currentPageEl = document.getElementById('studentsCurrentPage');
            if (currentPageEl) {
                const pageNum = (window.StudentsClient && window.StudentsClient.currentPage) || (typeof currentPage !== 'undefined' && currentPage) || 1;
                const raw = currentPageEl.textContent || '';
                const replaced = raw.replace(/\d+/, String(pageNum));
                currentPageEl.textContent = replaced;
            }
        } catch (err) {
            console.warn('applyTotalsToDom error', err);
        }
    }

    // full refresh function (debounced)
    const doRefreshSummaryCounts = debounce(async function (showInactive = (typeof pageShowInactive !== 'undefined' ? (pageShowInactive === true || pageShowInactive === 'true') : false)) {
        try {
            if (typeof refreshInactiveCountOnPage === 'function') {
                try { await refreshInactiveCountOnPage(showInactive); } catch (e) { /* ignore */ }
            }
            const totals = await fetchTotalsFromServer(showInactive);
            if (totals) applyTotalsToDom(totals, showInactive);
        } catch (err) {
            console.warn('doRefreshSummaryCounts error', err);
        }
    }, 350);

    // expose
    window.refreshStudentSummaryCounts = function (showInactive) {
        return doRefreshSummaryCounts(showInactive);
    };

    // -----------------------------
    // 1) SignalR binding (safe retry)
    // -----------------------------
    (function attachToSignalR(retries = 8, delay = 250) {
        let attempts = 0;
        function tryAttach() {
            attempts++;
            try {
                if (typeof connection !== 'undefined' && connection && typeof connection.on === 'function') {
                    const events = ['StudentUpdated', 'StudentCreated', 'StudentDeleted', 'StudentRestored'];
                    events.forEach(ev => {
                        try {
                            connection.on(ev, async function () {
                                const si = (typeof pageShowInactive !== 'undefined') ? (pageShowInactive === true || pageShowInactive === 'true') : false;
                                doRefreshSummaryCounts(si);
                            });
                        } catch (e) { /* ignore duplicate binding */ }
                    });
                    // initial sync
                    doRefreshSummaryCounts();
                    return;
                }
            } catch (err) {
                /* ignore */
            }
            if (attempts < retries) {
                setTimeout(tryAttach, delay);
            } else {
                // final attempt: still try refresh once
                doRefreshSummaryCounts();
            }
        }
        tryAttach();
    })();

    // -----------------------------
    // 2) Hook fetch to detect CRUD calls to /Students/
    // -----------------------------
    (function patchFetch() {
        if (!window.fetch) return;
        const _fetch = window.fetch.bind(window);
        window.fetch = async function (input, init) {
            const method = (init && init.method) ? (init.method || 'GET').toUpperCase() : 'GET';
            const url = (typeof input === 'string') ? input : (input && input.url) ? input.url : '';
            try {
                const res = await _fetch(input, init);
                try {
                    // consider POST/PUT/DELETE to Students endpoints as triggers
                    if (res && res.ok && /\/Students(\/|\\|$|[?])/i.test(url) && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
                        const si = (typeof pageShowInactive !== 'undefined') ? (pageShowInactive === true || pageShowInactive === 'true') : false;
                        doRefreshSummaryCounts(si);
                    } else {
                        // also watch common ajax partial-confirm endpoints
                        if (res && res.ok && /DeletePartialConfirmed|EditPartial|RestorePartialConfirmed|Create/i.test(url)) {
                            const si = (typeof pageShowInactive !== 'undefined') ? (pageShowInactive === true || pageShowInactive === 'true') : false;
                            doRefreshSummaryCounts(si);
                        }
                    }
                } catch (e) { /* ignore */ }
                return res;
            } catch (err) {
                throw err;
            }
        };
    })();

    // -----------------------------
    // 3) Hook XHR for legacy code
    // -----------------------------
    (function patchXHR() {
        if (!window.XMLHttpRequest) return;
        const XHR = window.XMLHttpRequest;
        const open = XHR.prototype.open;
        const send = XHR.prototype.send;

        XHR.prototype.open = function (method, url) {
            this.__students_xhr_method = (method || '').toUpperCase();
            this.__students_xhr_url = (url || '');
            return open.apply(this, arguments);
        };

        XHR.prototype.send = function (body) {
            try {
                this.addEventListener('load', function () {
                    try {
                        const url = this.__students_xhr_url || '';
                        const method = this.__students_xhr_method || 'GET';
                        if (this.status >= 200 && this.status < 300) {
                            if (/\/Students(\/|\\|$|[?])/i.test(url) && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
                                const si = (typeof pageShowInactive !== 'undefined') ? (pageShowInactive === true || pageShowInactive === 'true') : false;
                                doRefreshSummaryCounts(si);
                            } else if (/DeletePartialConfirmed|EditPartial|RestorePartialConfirmed|Create/i.test(url)) {
                                const si = (typeof pageShowInactive !== 'undefined') ? (pageShowInactive === true || pageShowInactive === 'true') : false;
                                doRefreshSummaryCounts(si);
                            }
                        }
                    } catch (e) { /* ignore inner */ }
                }, false);
            } catch (e) { /* ignore */ }
            return send.apply(this, arguments);
        };
    })();

    // -----------------------------
    // 4) Optional: MutationObserver fallback (if DOM rows change without XHR/fetch/SignalR)
    // -----------------------------
    (function observeTableMutations() {
        try {
            const tbody = document.getElementById('studentsTable') || document.querySelector('table tbody');
            if (!tbody || typeof MutationObserver === 'undefined') return;
            const mo = new MutationObserver(debounce(function (mutations) {
                // when many mutates, fetch totals to be safe
                const si = (typeof pageShowInactive !== 'undefined') ? (pageShowInactive === true || pageShowInactive === 'true') : false;
                doRefreshSummaryCounts(si);
            }, 600));
            mo.observe(tbody, { childList: true, subtree: false });
        } catch (e) { /* ignore */ }
    })();

    // done
})();
