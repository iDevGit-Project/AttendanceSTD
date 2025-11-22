// students.harddelete.js
(function () {
    'use strict';

    const S = window.StudentsClient || {};
    const notify = (msg, type = 'info', t = 3500) => {
        if (S && typeof S.showNotify === 'function') return S.showNotify(msg, type, t);
        // fallback
        console[type === 'error' ? 'error' : 'log'](type, msg);
    };

    const backdrop = document.getElementById('modalBackdropAjax');
    const ajaxModal = document.getElementById('ajasmodal');
    const ajaxContent = document.getElementById('modalContentAjax');

    const animMs = 200;

    function prepare() {
        if (!ajaxModal) return;
        ajaxModal.style.transition = `opacity ${animMs}ms ease, transform ${animMs}ms ease`;
        if (ajaxModal.classList.contains('hidden')) {
            ajaxModal.style.opacity = 0;
            ajaxModal.style.transform = 'translateY(8px) scale(0.995)';
        }
        if (backdrop) {
            backdrop.style.transition = `opacity ${animMs}ms ease`;
            backdrop.style.opacity = 0;
        }
    }
    prepare();

    function openModal() {
        if (!ajaxModal) return;
        if (backdrop) { backdrop.classList.remove('hidden'); void backdrop.offsetWidth; backdrop.style.opacity = '0.45'; }
        ajaxModal.classList.remove('hidden');
        ajaxModal.style.opacity = '0';
        ajaxModal.style.transform = 'translateY(10px) scale(0.995)';
        void ajaxModal.offsetWidth;
        requestAnimationFrame(() => {
            ajaxModal.style.opacity = '1';
            ajaxModal.style.transform = 'translateY(0) scale(1)';
        });
    }

    function 
    () {
        if (!ajaxModal) return;
        ajaxModal.style.opacity = '0';
        ajaxModal.style.transform = 'translateY(8px) scale(0.995)';
        if (backdrop) backdrop.style.opacity = '0';
        setTimeout(() => {
            try { ajaxModal.classList.add('hidden'); if (backdrop) backdrop.classList.add('hidden'); if (ajaxContent) ajaxContent.innerHTML = ''; } catch (e) { }
        }, animMs + 30);
    }

    // load partial
    async function loadHardDeletePartial(id) {
        if (!id) { notify('شناسهٔ دانش‌آموز نامعتبر است.', 'error'); return; }
        const url = (window.StudentsConfig && window.StudentsConfig.urls && window.StudentsConfig.urls.hardDeletePartial)
            ? `${window.StudentsConfig.urls.hardDeletePartial}?id=${encodeURIComponent(id)}`
            : `/Students/HardDeletePartial?id=${encodeURIComponent(id)}`;

        try {
            const res = await fetch(url, { credentials: 'same-origin' });
            if (!res.ok) {
                if (res.status === 404) notify('فرم حذف کامل پیدا نشد.', 'error');
                else notify('خطا در بارگذاری فرم حذف کامل.', 'error');
                return;
            }
            const html = await res.text();
            if (!ajaxContent) { notify('کانتینر مودال پیدا نشد.', 'error'); return; }
            ajaxContent.innerHTML = html;
            bindForm();
            openModal();
        } catch (err) {
            console.error('loadHardDeletePartial error', err);
            notify('خطای شبکه در بارگذاری فرم حذف کامل.', 'error');
        }
    }

    // bind the injected form
    function bindForm() {
        const form = ajaxContent.querySelector('#hardDeleteStudentForm') || ajaxContent.querySelector('form');
        if (!form) return;

        if (form.__students_harddelete_bound) return;
        form.__students_harddelete_bound = true;

        const cancelBtn = form.querySelector('#hardDeleteCancelBtn');
        if (cancelBtn) cancelBtn.addEventListener('click', function (ev) { ev.preventDefault(); closeModal(); });

        form.addEventListener('submit', async function (ev) {
            ev.preventDefault();
            try {
                const fd = new FormData(form);

                // ensure anti-forgery token present
                if (!fd.has('__RequestVerificationToken')) {
                    const tokenInput = document.querySelector('input[name="__RequestVerificationToken"]');
                    if (tokenInput && tokenInput.value) fd.append('__RequestVerificationToken', tokenInput.value);
                }

                const action = form.getAttribute('action') || '/Students/HardDeleteConfirmed';
                const res = await fetch(action, { method: 'POST', body: fd, credentials: 'same-origin' });

                const contentType = (res.headers.get('content-type') || '').toLowerCase();

                if (contentType.includes('application/json')) {
                    const json = await res.json();
                    if (res.ok && json.success) {
                        notify(json.message || 'حذف کامل انجام شد.', 'success', 3500);
                        // remove row from DOM if exists
                        try {
                            const id = json.id || fd.get('id') || fd.get('Id');
                            if (id) {
                                const row = document.getElementById('row-' + id) || document.querySelector(`tr[data-student-id='${id}']`);
                                if (row) row.remove();
                                else {
                                    // fallback: rebuild page if function exists
                                    if (typeof rebuildTableBodyFromServerPaged === 'function') {
                                        await rebuildTableBodyFromServerPaged(window.StudentsClient?.currentPage || 1,
                                            (document.getElementById('studentsPageSize')?.value ? parseInt(document.getElementById('studentsPageSize').value, 10) : window.StudentsClient?.defaultPageSize || 50),
                                            (document.getElementById('studentSearchInput')?.value || '').trim(),
                                            (window.StudentsClient?.pageShowInactive === true || window.StudentsClient?.pageShowInactive === 'true'));
                                    }
                                }
                            }
                        } catch (e) { console.warn('remove row after hard delete error', e); }

                        closeModal();
                        return;
                    } else {
                        const msg = json && (json.message || json.error) ? (json.message || json.error) : 'خطا در حذف کامل.';
                        notify(msg, 'error');
                        return;
                    }
                }

                // if returned HTML (validation or other), inject and rebind
                if (!res.ok) {
                    const txt = await res.text();
                    if (ajaxContent) {
                        ajaxContent.innerHTML = txt;
                        const newForm = ajaxContent.querySelector('#hardDeleteStudentForm') || ajaxContent.querySelector('form');
                        if (newForm) newForm.__students_harddelete_bound = false;
                        bindForm();
                    }
                    notify('خطا در حذف کامل (سرور یا اعتبارسنجی).', 'error');
                    return;
                }

                // fallback partial
                const txt = await res.text();
                if (ajaxContent) {
                    ajaxContent.innerHTML = txt;
                    const newForm = ajaxContent.querySelector('#hardDeleteStudentForm') || ajaxContent.querySelector('form');
                    if (newForm) newForm.__students_harddelete_bound = false;
                    bindForm();
                }
            } catch (err) {
                console.error('hard delete form submit exception', err);
                notify('خطای شبکه در حذف کامل.', 'error');
            }
        });
    }

    // delegate click on a hard-delete button in table rows
    document.addEventListener('click', function (e) {
        const btn = e.target.closest('.open-hard-delete-modal, .open-hard-delete-btn');
        if (!btn) return;
        const id = btn.dataset?.id || btn.getAttribute('data-id');
        if (!id) { notify('شناسهٔ دانش‌آموز نامعتبر است.', 'error'); return; }
        loadHardDeletePartial(id);
    });

    // close on backdrop or Esc
    if (backdrop) backdrop.addEventListener('click', function (ev) { if (ev.target === backdrop) closeModal(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { if (ajaxModal && !ajaxModal.classList.contains('hidden')) closeModal(); } });

    // export for console
    window.StudentsHardDelete = { load: loadHardDeletePartial, open: openModal, close: closeModal };

})();
