// wwwroot/js/students.detail.js
// Student details modal (delegated) - enhanced: client-side cache, deep-linking, internal scroll (mobile),
// print button, image hover zoom, Escape keyboard support, improved backdrop/shadow, responsive
(function () {
    'use strict';

    // ---------- client-side cache for student details ----------
    const StudentDetailsCache = new Map(); // key: id (string), value: student object

    /**
     * Try to obtain student details.
     * - id: numeric or string id
     * - dataset: optional DOMStringMap (from button.dataset) to use as immediate source
     * Returns Promise<object|null>
     */
    function getStudentDetails(id, dataset) {
        if (!id) return Promise.resolve(null);
        const key = String(id);

        // 1) cached
        if (StudentDetailsCache.has(key)) {
            try {
                return Promise.resolve(StudentDetailsCache.get(key));
            } catch (e) {
                // fallthrough to re-fetch or dataset
                console.warn('StudentDetailsCache read error', e);
            }
        }

        // 2) dataset (immediate): if dataset has at least firstname/lastname or nationalcode, accept it
        if (dataset && (dataset.firstname || dataset.lastname || dataset.nationalcode)) {
            try {
                // normalize DOMStringMap into plain object
                const fromDs = {};
                for (const k in dataset) {
                    if (Object.prototype.hasOwnProperty.call(dataset, k)) {
                        fromDs[k] = dataset[k];
                    }
                }
                StudentDetailsCache.set(key, fromDs);
                return Promise.resolve(fromDs);
            } catch (e) {
                console.warn('getStudentDetails: dataset -> cache failed', e);
            }
        }

        // 3) try server endpoint if configured: window.StudentsConfig.urls.detailsJson
        const detailsUrl = (window.StudentsConfig && window.StudentsConfig.urls && window.StudentsConfig.urls.detailsJson) || null;
        if (!detailsUrl) {
            return Promise.resolve(null);
        }

        // build url (append id param safely)
        let url;
        try {
            url = detailsUrl.indexOf('?') === -1 ? `${detailsUrl}?id=${encodeURIComponent(key)}` : `${detailsUrl}&id=${encodeURIComponent(key)}`;
        } catch (e) {
            url = detailsUrl;
        }

        return fetch(url, { credentials: 'same-origin' })
            .then(res => {
                if (!res.ok) return null;
                const ctype = (res.headers.get('content-type') || '').toLowerCase();
                if (!ctype.includes('application/json')) return null;
                return res.json();
            })
            .then(json => {
                if (json) {
                    try { StudentDetailsCache.set(key, json); } catch (e) { /* ignore cache set errors */ }
                    return json;
                }
                return null;
            })
            .catch(err => {
                console.warn('getStudentDetails fetch error', err);
                return null;
            });
    }

    // ---------- deep-linking helpers ----------
    function setUrlStudentParam(id) {
        if (!id) return;
        try {
            const url = new URL(window.location.href);
            url.searchParams.set('student', String(id));
            window.history.replaceState({}, '', url.toString());
        } catch (e) {
            console.warn('setUrlStudentParam error', e);
        }
    }

    function removeUrlStudentParam() {
        try {
            const url = new URL(window.location.href);
            if (!url.searchParams.has('student')) return;
            url.searchParams.delete('student');
            window.history.replaceState({}, '', url.toString());
        } catch (e) {
            console.warn('removeUrlStudentParam error', e);
        }
    }

    // Helper: safe escape (used where needed)
    function esc(s) {
        if (s === null || s === undefined) return '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // Build modal HTML string (Tailwind classes + a few inline styles)
    function buildModalHtml() {
        return `
<div id="student-detail-modal" class="fixed inset-0 z-[100000] hidden" aria-hidden="true">
  <!-- backdrop: darker + stronger blur for depth -->
  <div class="students-detail-backdrop absolute inset-0 bg-slate-500/55"></div>

  <div class="relative flex items-center justify-center min-h-screen px-4 py-6">
    <!-- card: stronger shadow for depth; we'll animate opacity/transform in JS -->
    <div role="dialog" aria-modal="true" aria-labelledby="student-detail-title"
         class="student-detail-card transform transition-all duration-300 ease-[cubic-bezier(.2,.9,.2,1)] max-w-3xl w-full mx-auto rounded-lg bg-white overflow-hidden"
         style="opacity:0; transform: translateY(12px) scale(.995);">
      
      <header class="flex items-start justify-between gap-3 p-4 md:p-6 border-b">
        <div>
          <h2 id="student-detail-title" class="text-lg font-semibold text-slate-900">اطلاعات دانش‌آموز</h2>
          <p id="student-detail-subtitle" class="text-sm text-slate-500 mt-1"></p>
        </div>
        <div class="flex items-center gap-2">
          <button type="button" aria-label="بستن" data-modal-close class="text-slate-500 hover:text-slate-800 rounded px-2 py-1 transition">✕</button>
        </div>
      </header>

      <!-- content area: has internal scroll for tall content (mobile-friendly) -->
      <div class="p-4 md:p-6" style="max-height: calc(100vh - 120px); overflow:auto; -webkit-overflow-scrolling: touch;">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
          <div class="flex flex-col items-center md:items-start gap-3">
            <!-- image: smaller + hover zoom + smooth transition -->
            <img id="student-detail-photo" src="/uploads/students/default.png" alt="عکس دانش‌آموز"
                 class="w-16 h-16 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded object-cover border transition-transform duration-200 ease-out hover:scale-115" />
            <div class="text-center md:text-left">
              <div id="student-detail-name" class="text-base font-bold text-slate-900"></div>
              <div id="student-detail-class" class="text-sm text-slate-500 mt-1"></div>
            </div>
          </div>

          <div class="md:col-span-2">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div class="p-3 rounded border bg-slate-50">
                <div class="text-xs text-slate-500">نام پدر</div>
                <div id="student-detail-father" class="text-sm font-medium text-slate-800"></div>
              </div>
              <div class="p-3 rounded border bg-slate-50">
                <div class="text-xs text-slate-500">کد ملی</div>
                <div id="student-detail-national" class="text-sm font-medium text-slate-800"></div>
              </div>

              <div class="p-3 rounded border bg-slate-50">
                <div class="text-xs text-slate-500">پایه</div>
                <div id="student-detail-grade" class="text-sm font-medium text-slate-800"></div>
              </div>
              <div class="p-3 rounded border bg-slate-50">
                <div class="text-xs text-slate-500">مدرسه</div>
                <div id="student-detail-school" class="text-sm font-medium text-slate-800"></div>
              </div>

              <div class="p-3 rounded border bg-slate-50">
                <div class="text-xs text-slate-500">مربی</div>
                <div id="student-detail-coach" class="text-sm font-medium text-slate-800"></div>
              </div>
              <div class="p-3 rounded border bg-slate-50">
                <div class="text-xs text-slate-500">وضعیت</div>
                <div id="student-detail-status" class="text-sm font-medium"></div>
              </div>
            </div>

            <div class="mt-4 p-3 rounded border bg-rose-50 text-rose-800 hidden" id="student-detail-inactivereason">
              <div class="text-xs text-rose-700 font-medium">علت غیرفعال‌سازی</div>
              <div class="text-sm mt-1" id="student-detail-inactivereason-text"></div>
            </div>


          </div>
        </div>
      </div>

      <footer class="flex items-center justify-center gap-3 p-4 md:p-6">
        <div class="text-sm text-slate-500"> </div>
        <div class="flex items-center gap-2">
          <!-- print button -->
          <button type="button" data-modal-close class="px-4 py-2 rounded bg-slate-100 text-slate-700 hover:bg-slate-200 transition">بازگشت</button>
        </div>
      </footer>

    </div>
  </div>
</div>
        `;
    }

    // Ensure modal exists in DOM
    function ensureModalExists() {
        let existing = document.getElementById('student-detail-modal');
        if (existing) return existing;

        try {
            const html = buildModalHtml();
            if (!html || typeof html !== 'string') {
                console.warn('ensureModalExists: buildModalHtml did not return HTML string.');
                return null;
            }

            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const newRoot = doc.getElementById('student-detail-modal') || doc.body.firstElementChild;
            if (!newRoot) {
                console.warn('ensureModalExists: parsed HTML has no root element.');
                return null;
            }

            const toAppend = newRoot.cloneNode(true);
            document.body.appendChild(toAppend);

            const appended = document.getElementById('student-detail-modal');
            if (!appended) {
                const maybe = document.body.lastElementChild;
                if (maybe && (maybe.id === 'student-detail-modal' || maybe.querySelector('#student-detail-modal'))) {
                    return document.getElementById('student-detail-modal') || maybe;
                }
                console.warn('ensureModalExists: could not locate appended modal in DOM after append.');
                return null;
            }
            return appended;
        } catch (err) {
            console.error('ensureModalExists exception', err);
            return null;
        }
    }

    // Populate modal with dataset (safe guards) + list all other data-* in "extra"
    function populateModalFromDataset(modalRoot, ds) {
        if (!modalRoot) {
            modalRoot = ensureModalExists();
        }
        if (!modalRoot) {
            console.warn('populateModalFromDataset: modalRoot not available.');
            return;
        }

        ds = ds || {};

        const setText = (id, val) => {
            const el = modalRoot.querySelector('#' + id);
            if (!el) return;
            el.textContent = val ?? '';
        };

        const photoEl = modalRoot.querySelector('#student-detail-photo');
        if (photoEl) photoEl.src = ds.photo || (window.StudentDefaultPhoto || '/uploads/students/default.png');

        setText('student-detail-name', `${ds.firstname || ''} ${ds.lastname || ''}`.trim());
        setText('student-detail-subtitle', ds.class || '');
        setText('student-detail-class', ds.class || '');
        setText('student-detail-father', ds.fathername || '');
        setText('student-detail-national', ds.nationalcode || '');
        setText('student-detail-grade', ds.grade || '');
        setText('student-detail-school', ds.school || '');
        setText('student-detail-coach', ds.coach || '');

        const st = modalRoot.querySelector('#student-detail-status');
        if (st) {
            const active = (ds.isactive === 'true' || ds.isactive === true || ds.isactive === '1' || ds.isactive === 1);
            st.innerHTML = active
                ? `<span class="inline-block px-2 py-1 text-sm font-bold text-teal-800 bg-teal-100 rounded">فعال</span>`
                : `<span class="inline-block px-2 py-1 text-sm font-bold text-rose-800 bg-rose-100 rounded">غیرفعال</span>`;
        }

        const inactWrap = modalRoot.querySelector('#student-detail-inactivereason');
        const inactText = modalRoot.querySelector('#student-detail-inactivereason-text');
        if (ds.inactivereason && ds.inactivereason.trim().length > 0) {
            if (inactWrap) inactWrap.classList.remove('hidden');
            if (inactText) inactText.textContent = ds.inactivereason;
        } else {
            if (inactWrap) inactWrap.classList.add('hidden');
            if (inactText) inactText.textContent = '';
        }

        // Extra: list all other data-* keys (human-friendly)
        const extra = modalRoot.querySelector('#student-detail-extra');
        if (extra) {
            extra.innerHTML = ''; // clear

            const skip = new Set(['firstname', 'lastname', 'photo', 'class', 'fathername', 'nationalcode', 'grade', 'school', 'coach', 'isactive', 'inactivereason']);

            const keys = Object.keys(ds);
            keys.sort((a, b) => {
                if (a === 'id') return -1;
                if (b === 'id') return 1;
                return a.localeCompare(b);
            });

            keys.forEach(k => {
                if (!k || skip.has(k)) return;
                const raw = ds[k];
                if (raw === null || raw === undefined || String(raw).trim() === '') return;
                const human = k.replace(/([A-Z])/g, ' $1').replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                const row = document.createElement('div');
                row.className = 'flex items-start justify-between gap-3 py-1';
                row.innerHTML = `<div class="text-sm text-slate-500">${esc(human)}</div><div class="text-sm text-slate-800 text-right break-all">${esc(String(raw))}</div>`;
                extra.appendChild(row);
            });

            if (!extra.firstChild) {
                extra.innerHTML = `<div class="text-sm text-slate-500">اطلاعات بیشتری موجود نیست.</div>`;
            }
        }
    }

    // Animation helpers (open/close with smooth transitions)
    function openModal(element) {
        const root = element;
        root.classList.remove('hidden');
        root.setAttribute('aria-hidden', 'false');

        const card = root.querySelector('.student-detail-card');
        if (!card) return;

        const ms = 320;
        const easing = 'cubic-bezier(.2,.9,.2,1)';

        root.style.transition = `opacity ${ms}ms ${easing}`;
        card.style.transition = `transform ${ms}ms ${easing}, opacity ${ms}ms ${easing}`;

        root.style.opacity = '0';
        card.style.opacity = '0';
        card.style.transform = 'translateY(12px) scale(.995)';

        void root.offsetWidth;
        requestAnimationFrame(() => {
            root.style.opacity = '1';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0) scale(1)';
        });
    }

    function closeModal(element) {
        const root = element;
        const card = root.querySelector('.student-detail-card');
        if (!card) {
            root.classList.add('hidden');
            root.setAttribute('aria-hidden', 'true');
            try { removeUrlStudentParam(); } catch (e) { }
            return;
        }

        const ms = 320;
        const easing = 'cubic-bezier(.2,.9,.2,1)';

        root.style.transition = `opacity ${ms}ms ${easing}`;
        card.style.transition = `transform ${ms}ms ${easing}, opacity ${ms}ms ${easing}`;

        root.style.opacity = '1';
        card.style.opacity = '1';
        card.style.transform = 'translateY(0) scale(1)';

        void root.offsetWidth;
        requestAnimationFrame(() => {
            root.style.opacity = '0';
            card.style.opacity = '0';
            card.style.transform = 'translateY(10px) scale(.995)';
        });

        let finished = false;
        function onEnd(ev) {
            // we listen for the root opacity transition end
            if (ev.target !== root) return;
            if (ev.propertyName !== 'opacity') return;
            if (finished) return;
            finished = true;
            root.removeEventListener('transitionend', onEnd);
            try { root.classList.add('hidden'); root.setAttribute('aria-hidden', 'true'); } catch (e) { }
            try { const rel = root.__releaseFocus; if (typeof rel === 'function') rel(); } catch (e) { }
            try { removeUrlStudentParam(); } catch (e) { }
        }
        root.addEventListener('transitionend', onEnd);

        setTimeout(() => {
            if (!finished) {
                finished = true;
                try { root.classList.add('hidden'); root.setAttribute('aria-hidden', 'true'); } catch (e) { }
                try { const rel = root.__releaseFocus; if (typeof rel === 'function') rel(); } catch (e) { }
                try { removeUrlStudentParam(); } catch (e) { }
            }
        }, ms + 80);
    }

    // Focus trap helpers
    function getTabbable(container) {
        if (!container) return [];
        const sel = 'a[href], area[href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])';
        return Array.from(container.querySelectorAll(sel)).filter(el => (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
    }

    function trapFocus(modalRoot, opener) {
        const tabbables = getTabbable(modalRoot);
        if (!tabbables || tabbables.length === 0) {
            try { opener && opener.focus && opener.focus(); } catch (e) { }
            return function () { };
        }
        let idx = 0;
        tabbables[0].focus();

        function handleKey(e) {
            if (e.key === 'Tab') {
                if (tabbables.length === 1) { e.preventDefault(); tabbables[0].focus(); return; }
                if (e.shiftKey) idx = (idx - 1 + tabbables.length) % tabbables.length;
                else idx = (idx + 1) % tabbables.length;
                e.preventDefault();
                tabbables[idx].focus();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                const closeBtn = modalRoot.querySelector('[data-modal-close]');
                if (closeBtn) closeBtn.click();
            }
        }

        document.addEventListener('keydown', handleKey);
        return function release() {
            document.removeEventListener('keydown', handleKey);
            try { if (opener && typeof opener.focus === 'function') opener.focus(); } catch (e) { }
        };
    }

    function cleanupModal(modalRoot) {
        try {
            const rel = modalRoot.__releaseFocus;
            if (typeof rel === 'function') rel();
        } catch (e) { }
        // keep DOM hidden for performance
    }

    // Print helper: opens new window with modal inner content and calls print
    function printModalContent(modalRoot) {
        try {
            if (!modalRoot) return;
            // clone modal card content only (so we avoid printing backdrop)
            const card = modalRoot.querySelector('.student-detail-card');
            if (!card) return;
            const clone = card.cloneNode(true);

            // small print stylesheet: ensure readable
            const printStyles = `
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial; padding: 20px; color: #111827; }
                    .student-detail-card { box-shadow: none !important; border: none !important; max-width: 900px; margin: 0 auto; }
                    img { max-width: 120px; height: auto; border-radius: 9999px; }
                    .text-slate-500 { color: #6b7280; }
                </style>
            `;

            const win = window.open('', '_blank', 'noopener,noreferrer');
            if (!win) {
                alert('امکان باز کردن پنجرهٔ چاپ وجود ندارد. لطفاً تنظیمات مرورگر را بررسی کنید.');
                return;
            }
            win.document.write('<!doctype html><html><head><meta charset="utf-8"><title>چاپ اطلاعات دانش‌آموز</title>' + printStyles + '</head><body>');
            win.document.body.appendChild(clone);
            win.document.write('</body></html>');
            win.document.close();
            // give browser a moment to render
            setTimeout(() => {
                try { win.focus(); win.print(); win.close(); } catch (e) { console.warn('print exception', e); }
            }, 250);
        } catch (e) {
            console.error('printModalContent error', e);
        }
    }

    // Main open flow when a button clicked
    function handleOpenFromButton(btn) {
        if (!btn) return;
        const root = ensureModalExists();
        if (!root) {
            console.error('handleOpenFromButton: modal root could not be created.');
            return;
        }

        // Use cached/dataset/server data source
        const btnId = (btn && (btn.dataset && (btn.dataset.id || btn.getAttribute('data-id')))) || null;

        getStudentDetails(btnId, btn && btn.dataset ? btn.dataset : null)
            .then(student => {
                // if details from cache or server available use them, otherwise fallback to dataset
                const src = student || (btn && btn.dataset ? (function (ds) { const o = {}; for (const k in ds) { if (Object.prototype.hasOwnProperty.call(ds, k)) o[k] = ds[k]; } return o; })(btn.dataset) : {});
                try {
                    populateModalFromDataset(root, src || {});
                } catch (e) {
                    console.error('populateModalFromDataset failed after getStudentDetails', e);
                    try { populateModalFromDataset(root, btn && btn.dataset ? btn.dataset : {}); } catch (e2) { console.warn(e2); }
                }

                // attach close handlers idempotently
                const closeButtons = root.querySelectorAll('[data-modal-close]');
                closeButtons.forEach(cb => {
                    if (!cb.__bound) {
                        cb.addEventListener('click', function (ev) {
                            ev.preventDefault();
                            closeModal(root);
                        });
                        cb.__bound = true;
                    }
                });

                // attach print button (idempotent)
                const printBtn = root.querySelector('[data-action="print"]');
                if (printBtn && !printBtn.__bound) {
                    printBtn.addEventListener('click', function (ev) {
                        ev.preventDefault();
                        printModalContent(root);
                    });
                    printBtn.__bound = true;
                }

                // backdrop click to close
                const backdrop = root.querySelector('.students-detail-backdrop');
                if (backdrop && !backdrop.__bound) {
                    backdrop.addEventListener('click', function (ev) {
                        if (ev.target === backdrop) closeModal(root);
                    });
                    backdrop.__bound = true;
                }

                openModal(root);

                // set deep-link param in URL
                const openId = btnId || (src && src.id) || null;
                if (openId) {
                    try { setUrlStudentParam(openId); } catch (e) { }
                }

                try { if (root.__releaseFocus && typeof root.__releaseFocus === 'function') root.__releaseFocus(); } catch (e) { }
                root.__releaseFocus = trapFocus(root, btn);
                root.__opener = btn;
            })
            .catch(err => {
                console.warn('getStudentDetails error', err);
                // fallback to dataset populate + open
                try {
                    populateModalFromDataset(root, btn && btn.dataset ? btn.dataset : {});
                } catch (e) { console.warn(e); }
                openModal(root);
                try { root.__releaseFocus = trapFocus(root, btn); } catch (e) { }
                const openId = (btn && (btn.dataset && (btn.dataset.id || btn.getAttribute('data-id')))) || null;
                if (openId) { try { setUrlStudentParam(openId); } catch (e) { } }
            });
    }

    // Delegated click handler for opening
    document.addEventListener('click', function (e) {
        const btn = e.target.closest('.open-student-modal');
        if (btn) {
            e.preventDefault();
            handleOpenFromButton(btn);
        }
    });

    // Global Escape handler (additional safety)
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            const root = document.getElementById('student-detail-modal');
            if (root && root.getAttribute('aria-hidden') === 'false') {
                e.preventDefault();
                closeModal(root);
            }
        }
    });

    // Expose small API
    window.StudentDetailModal = {
        openFromDataset: function (dataset) {
            const fakeBtn = { dataset: dataset };
            handleOpenFromButton(fakeBtn);
        },
        close: function () {
            const root = document.getElementById('student-detail-modal');
            if (root) closeModal(root);
        },
        ensureModalExists: ensureModalExists,
        print: function () {
            const root = document.getElementById('student-detail-modal');
            if (root) printModalContent(root);
        }
    };

    // On page load: if ?student=<id> present => open modal for that id
    (function tryOpenFromUrlOnLoad() {
        try {
            const url = new URL(window.location.href);
            const sid = url.searchParams.get('student');
            if (!sid) return;
            // Ensure modal exists
            const root = ensureModalExists();
            if (!root) return;
            // Use our getStudentDetails (from step1) to fetch/cache
            getStudentDetails(sid, null).then(student => {
                try {
                    populateModalFromDataset(root, student || { id: sid });
                    openModal(root);
                    // focus trap
                    try { root.__releaseFocus = trapFocus(root, null); } catch (e) { /* ignore */ }
                    // do not push another url change (it already contains param)
                } catch (e) {
                    console.warn('tryOpenFromUrlOnLoad populate/open failed', e);
                }
            }).catch(err => {
                console.warn('tryOpenFromUrlOnLoad getStudentDetails error', err);
                // fallback: populate with id only
                try {
                    populateModalFromDataset(root, { id: sid });
                    openModal(root);
                    try { root.__releaseFocus = trapFocus(root, null); } catch (e) { }
                } catch (e) { console.warn(e); }
            });
        } catch (e) {
            // ignore invalid URL or other errors
        }
    })();

})();

