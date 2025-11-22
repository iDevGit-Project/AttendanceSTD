// wwwroot/js/students.delete.js
// ================= students.delete.js =================
// بارگذاری Partial Delete، ارسال فرم حذف (AJAX)، محافظت در برابر درج HTML کامل صفحه در مودال
(function () {
    'use strict';

    // ---------- helper: notify (سازگار با پروژه‌ی شما) ----------
    function ensureNotify() {
        if (typeof window.StudentsNotify === 'function') return window.StudentsNotify;
        if (typeof window.showNotify === 'function') return window.showNotify;
        if (typeof window.showTailwindAlert === 'function') {
            return function (msg, type = 'info', t = 3000) {
                window.showTailwindAlert(type, type === 'success' ? 'موفق' : (type === 'error' ? 'خطا' : 'اطلاع'), msg, { timer: t });
            };
        }
        if (typeof window.notifyBottom === 'function') {
            return function (msg, type = 'info', t = 3000) { return window.notifyBottom(msg, type, t); };
        }
        if (typeof window.showLocalNotification === 'function') {
            return function (msg, type = 'info', t = 3000) { return window.showLocalNotification({ message: msg, type: type, timeout: t }); };
        }
        // fallback ساده
        return function (msg, type = 'info', t = 3000) {
            try {
                const id = 'students-delete-toast';
                let c = document.getElementById(id);
                if (!c) { c = document.createElement('div'); c.id = id; c.style.position = 'fixed'; c.style.top = '18px'; c.style.left = '50%'; c.style.transform = 'translateX(-50%)'; c.style.zIndex = 99999; document.body.appendChild(c); }
                const el = document.createElement('div'); el.textContent = msg;
                el.style.background = (type === 'success' ? '#16a34a' : (type === 'error' ? '#ef4444' : '#374151'));
                el.style.color = '#fff'; el.style.padding = '8px 12px'; el.style.borderRadius = '8px'; el.style.marginTop = '6px';
                el.style.boxShadow = '0 6px 18px rgba(0,0,0,0.08)';
                c.appendChild(el);
                setTimeout(() => { try { el.remove(); } catch (e) { } }, t || 3000);
            } catch (e) { console.log(type, msg); }
        };
    }
    const notify = ensureNotify();

    // ---------- helpers ----------
    function esc(s) { return s === null || s === undefined ? '' : String(s); }

    function findRowById(id) {
        if (!id && id !== 0) return null;
        return document.getElementById('row-' + id) || document.querySelector(`tr[data-student-id="${id}"]`);
    }

    // خواندن token antiforgery از صفحه (در صورت وجود)
    function readAntiForgeryToken() {
        const tpl = document.getElementById('antiForgeryTokenTemplate');
        if (tpl) {
            const inp = tpl.querySelector('input[name="__RequestVerificationToken"]');
            if (inp && inp.value) return inp.value;
        }
        const any = document.querySelector('input[name="__RequestVerificationToken"]');
        if (any && any.value) return any.value;
        return null;
    }

    // ---------- Modal container (unique ids to avoid conflicts) ----------
    const WRAPPER_ID = 'students-delete-ajax-wrapper';

    function ensureModalContainer() {
        let wrapper = document.getElementById(WRAPPER_ID);
        if (wrapper) return wrapper;

        wrapper = document.createElement('div');
        wrapper.id = WRAPPER_ID;
        wrapper.className = 'students-delete-ajax-container';
        wrapper.style.zIndex = 99950;
        document.body.appendChild(wrapper);
        return wrapper;
    }

    function closeDeleteModal(clearContent = true) {
        const wrapper = document.getElementById(WRAPPER_ID);
        if (!wrapper) return;
        // add small animation if you want — for now instant hide
        try {
            if (clearContent) wrapper.innerHTML = '';
            wrapper.remove();
        } catch (e) { try { wrapper.parentNode && wrapper.parentNode.removeChild(wrapper); } catch (er) { } }
    }

    // ---------- load Partial (GET) and display it ----------

    async function loadDeletePartial(id) {
        if (!id && id !== 0) { notify('شناسهٔ دانش‌آموز نامعتبر است.', 'error'); return; }

        const url = (window.StudentsConfig && window.StudentsConfig.urls && window.StudentsConfig.urls.deletePartial)
            ? `${window.StudentsConfig.urls.deletePartial}?id=${encodeURIComponent(id)}`
            : `/Students/DeletePartial?id=${encodeURIComponent(id)}`;

        try {
            const res = await fetch(url, { credentials: 'same-origin' });
            if (!res.ok) {
                if (res.status === 404) notify('فرم مورد نظر پیدا نشد.', 'error');
                else notify('خطا در بارگذاری فرم.', 'error');
                return;
            }

            const cType = (res.headers.get('content-type') || '').toLowerCase();
            const text = await res.text();

            // اگر سرور HTML کامل صفحه را بازگردانده (مثلاً redirect به Index) => نریز داخل مودال
            if (res.redirected || /<\s*html[\s>]/i.test(text)) {
                // احتمالاً redirect یا صفحه Index برگشته — رفرش صفحه
                try {
                    // اگر fetch دنبال ریدایرکت کرده، res.url ممکن است مقصد باشد
                    if (res.redirected && res.url) {
                        window.location.href = res.url;
                        return;
                    }
                } catch (e) { /* ignore */ }
                // fallback: رفرش صفحه کن
                window.location.reload();
                return;
            }

            // در غیر این صورت محتوای Partial را درون wrapper قرار بده
            const wrapper = ensureModalContainer();
            wrapper.innerHTML = text;

            // اتصال دکمه های انصراف (data-modal-close) به بستن مودال
            wrapper.querySelectorAll('[data-modal-close]').forEach(btn => {
                btn.addEventListener('click', function (ev) {
                    ev.preventDefault();
                    closeDeleteModal(true);
                });
            });

            // backdrop click: اگر المانی با id student-delete-backdrop وجود داشت که هدف کلیک بود => ببند
            const backdrop = wrapper.querySelector('#student-delete-backdrop');
            if (backdrop) {
                backdrop.addEventListener('click', function (ev) {
                    if (ev.target === backdrop) closeDeleteModal(true);
                });
            }

            // bind form submit inside the loaded partial
            bindDeleteForm(wrapper);

        } catch (err) {
            console.error('Network error loadDeletePartial', err);
            notify('خطای شبکه در بارگذاری فرم.', 'error');
        }
    }

    // ---------- bind delete form (AJAX POST) ----------
    function bindDeleteForm(wrapper) {
        if (!wrapper) return;
        const form = wrapper.querySelector('#deleteStudentForm') || wrapper.querySelector('form');
        if (!form) {
            console.warn('delete form not found in partial');
            return;
        }

        // prevent double-binding
        if (form.__students_delete_bound) return;
        form.__students_delete_bound = true;

        const confirmBtn = form.querySelector('#student-delete-confirm-btn') || form.querySelector('button[type="submit"]');

        form.addEventListener('submit', async function (ev) {
            ev.preventDefault();

            // client-side simple validation for reason
            const reasonEl = form.querySelector('textarea[name="Reason"], #deleteReason');
            if (reasonEl) {
                const v = (reasonEl.value || '').trim();
                if (!v) {
                    const errDiv = form.querySelector('#inactiveReasonError') || form.querySelector('.inactive-reason-error');
                    if (errDiv) { errDiv.textContent = 'لطفاً دلیل غیرفعال‌سازی را وارد کنید.'; errDiv.classList.remove('hidden'); }
                    notify('لطفاً دلیل غیرفعال‌سازی را وارد کنید.', 'warning');
                    try { reasonEl.focus(); } catch (e) { }
                    return;
                } else {
                    const errDiv = form.querySelector('#inactiveReasonError') || form.querySelector('.inactive-reason-error');
                    if (errDiv) { errDiv.textContent = ''; errDiv.classList.add('hidden'); }
                }
            }

            // prepare FormData (supports files if any)
            const fd = new FormData(form);
            if (!fd.has('__RequestVerificationToken')) {
                const token = readAntiForgeryToken();
                if (token) fd.append('__RequestVerificationToken', token);
            }

            // disable button to prevent double submit
            if (confirmBtn) try { confirmBtn.disabled = true; confirmBtn.setAttribute('aria-disabled', 'true'); } catch (e) { }

            notify('در حال غیرفعال‌سازی...', 'info', 2000);

            try {
                const action = form.getAttribute('action') || '/Students/Delete';
                const res = await fetch(action, { method: 'POST', body: fd, credentials: 'same-origin' });

                const cType = (res.headers.get('content-type') || '').toLowerCase();

                // اگر JSON بازگشت
                if (cType.includes('application/json')) {
                    const json = await res.json();
                    if (res.ok && json && json.success) {
                        notify(json.message || 'دانش‌آموز با موفقیت غیرفعال شد.', 'success', 1800);

                        // حذف ردیف از جدول یا بازسازی جدول
                        const idFromJson = json.id || fd.get('Id') || fd.get('id') || fd.get('Id');
                        if (idFromJson) {
                            const row = findRowById(idFromJson);
                            if (row) row.remove();
                            else if (typeof rebuildTableBodyFromServerPaged === 'function') {
                                const ps = (document.getElementById('studentsPageSize')?.value ? parseInt(document.getElementById('studentsPageSize').value, 10) : (window.StudentsClient && window.StudentsClient.defaultPageSize ? window.StudentsClient.defaultPageSize : 50));
                                try { rebuildTableBodyFromServerPaged(window.StudentsClient && window.StudentsClient.currentPage ? window.StudentsClient.currentPage : 1, ps, (document.getElementById('studentSearchInput')?.value || ''), window.StudentsClient && window.StudentsClient.pageShowInactive === true); } catch (e) { }
                            }
                        } else {
                            // fallback: rebuild or reload
                            if (typeof rebuildTableBodyFromServerPaged === 'function') {
                                const ps = (document.getElementById('studentsPageSize')?.value ? parseInt(document.getElementById('studentsPageSize').value, 10) : (window.StudentsClient && window.StudentsClient.defaultPageSize ? window.StudentsClient.defaultPageSize : 50));
                                try { rebuildTableBodyFromServerPaged(window.StudentsClient && window.StudentsClient.currentPage ? window.StudentsClient.currentPage : 1, ps, (document.getElementById('studentSearchInput')?.value || ''), window.StudentsClient && window.StudentsClient.pageShowInactive === true); } catch (e) { }
                            }
                        }

                        // refresh inactive count (if available)
                        try { if (typeof refreshInactiveCountOnPage === 'function') refreshInactiveCountOnPage(window.StudentsClient && window.StudentsClient.pageShowInactive === true); } catch (e) { }

                        // signalR hint handled on server side normally; we just close modal
                        closeDeleteModal(true);
                        return;
                    } else {
                        // JSON but failure -> show message
                        const msg = (json && (json.message || json.error)) || 'خطا در انجام عملیات.';
                        notify(msg, 'error', 4000);
                        const errDiv = form.querySelector('#inactiveReasonError') || form.querySelector('.inactive-reason-error');
                        if (errDiv) { errDiv.textContent = msg; errDiv.classList.remove('hidden'); }
                        return;
                    }
                }

                // اگر HTML برگشت — احتمالاً view با validation errors یا به اشتباه صفحه Index کامل برگشته
                const text = await res.text();

                // اگر HTML کامل صفحه است => نریز داخل مودال، ریدایرکت یا reload کن
                if (res.redirected || /<\s*html[\s>]/i.test(text)) {
                    try {
                        if (res.redirected && res.url) {
                            window.location.href = res.url;
                            return;
                        }
                    } catch (e) { /* ignore */ }
                    // fallback: reload
                    window.location.reload();
                    return;
                }

                // در غیر این صورت HTML یک partial view (مثلاً فرم با خطاهای اعتبارسنجی) است:
                // جایگزین کردن محتوای modal با HTML برگشتی و دوباره bind کردن فرم
                try {
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(text, 'text/html');
                    const newForm = doc.querySelector('#deleteStudentForm') || doc.querySelector('form');
                    if (newForm) {
                        // replace wrapper content
                        wrapper.innerHTML = text;
                        // rebind events on new content
                        bindDeleteForm(wrapper);
                        // attach data-modal-close on new buttons
                        wrapper.querySelectorAll('[data-modal-close]').forEach(btn => {
                            btn.addEventListener('click', function (ev) { ev.preventDefault(); closeDeleteModal(true); });
                        });
                        notify('خطای اعتبارسنجی: لطفاً مقادیر فرم را بررسی کنید.', 'warning', 3000);
                        return;
                    }
                } catch (e) {
                    console.warn('Failed to parse returned HTML for delete form', e);
                }

                // fallback generic
                notify('خطا در حذف. لطفاً مجدداً تلاش کنید.', 'error', 3000);

            } catch (err) {
                console.error('Delete submit exception', err);
                notify('خطای شبکه در ارسال فرم حذف.', 'error', 4000);
            } finally {
                if (confirmBtn) try { confirmBtn.disabled = false; confirmBtn.removeAttribute('aria-disabled'); } catch (e) { }
            }
        }, { once: false });
    }

    // ---------- delegated click: open delete partial when button clicked ----------
    document.addEventListener('click', function (e) {
        const btn = e.target.closest('.open-delete-modal, [data-action="open-delete"], [data-open-delete]'); // چندین selector محتمل
        if (!btn) return;
        e.preventDefault();
        const id = btn.dataset.id || btn.getAttribute('data-id') || btn.getAttribute('data-student-id');
        if (!id) { notify('شناسهٔ دانش‌آموز نامعتبر است.', 'error'); return; }
        loadDeletePartial(id);
    });

    // ---------- also expose API to open modal programmatically ----------
    window.StudentsDelete = window.StudentsDelete || {};
    window.StudentsDelete.open = function (id) { return loadDeletePartial(id); };
    window.StudentsDelete.close = function () { return closeDeleteModal(true); };

})();
