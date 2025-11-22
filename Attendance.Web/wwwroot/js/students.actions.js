(function () {
    'use strict';

    // -------------------------
    // Helpers
    // -------------------------
    function safeBool(v) {
        return v === true || v === 'true' || v === 'True';
    }
    function qsel(id) { return document.getElementById(id); }
    function debounce(fn, ms) {
        let t = null;
        return function (...a) { clearTimeout(t); t = setTimeout(() => fn.apply(this, a), ms); };
    }
    function dispatchEvent(name, detail) {
        try {
            document.dispatchEvent(new CustomEvent(name, { detail }));
        } catch (e) {
            // fallback برای مرورگرهای خیلی قدیمی
            const ev = document.createEvent('CustomEvent');
            ev.initCustomEvent(name, false, false, detail);
            document.dispatchEvent(ev);
        }
    }

    // -------------------------
    // Read config from server (اگر window.StudentsConfig موجود باشد از آن استفاده می‌کنیم)
    // -------------------------
    const cfg = window.StudentsConfig || {};
    const urls = cfg.urls || {};
    const pageShowInactive = safeBool(cfg.pageShowInactive) || (window.location.search || '').includes('showInactive=true') || false;
    let currentPage = parseInt(cfg.currentPage ?? 1, 10) || 1;
    let defaultPageSize = parseInt(cfg.defaultPageSize ?? 50, 10) || 50;

    // expose a small namespace برای تعامل با بقیه اسکریپت‌ها
    window.StudentsIndex = window.StudentsIndex || {
        cfg, urls,
        get showInactive() { return pageShowInactive; },
        get currentPage() { return currentPage; },
        set currentPage(v) { currentPage = parseInt(v || 1, 10) || 1; },
        get defaultPageSize() { return defaultPageSize; },
        // helper برای بروز کردن متن شمارش‌ها در DOM (اگر المان‌ها وجود داشته باشند)
        updateCounts: function (totalCount, inactiveCount, currentPageLocal, totalPages) {
            if (typeof totalCount !== 'undefined') qsel('studentsTotalCount') && (qsel('studentsTotalCount').textContent = String(totalCount));
            if (typeof inactiveCount !== 'undefined') qsel('studentsInactiveCount') && (qsel('studentsInactiveCount').textContent = String(inactiveCount));
            if (typeof currentPageLocal !== 'undefined') qsel('studentsCurrentPage') && (qsel('studentsCurrentPage').textContent = String(currentPageLocal));
            if (typeof totalPages !== 'undefined') qsel('studentsTotalPages') && (qsel('studentsTotalPages').textContent = String(totalPages));
        },
        // subscribe helpers (optional convenience)
        onSearch: function (handler) { document.addEventListener('students.search', e => handler(e.detail)); },
        onPageSize: function (handler) { document.addEventListener('students.pagesize', e => handler(e.detail)); },
        onRefresh: function (handler) { document.addEventListener('students.refresh', e => handler(e.detail)); },
        onToggleInactive: function (handler) { document.addEventListener('students.toggleInactive', e => handler(e.detail)); }
    };

    // -------------------------
    // Bind UI controls (Search, PageSize, Refresh, Toggle)
    // -------------------------
    (function bindControls() {
        // Search input (debounced) => dispatch 'students.search'
        const searchInput = qsel('studentSearchInput');
        if (searchInput) {
            const deb = debounce(function () {
                const q = (searchInput.value || '').trim();
                dispatchEvent('students.search', { query: q });
            }, 400);
            searchInput.addEventListener('input', deb);
        }

        // Page size select => dispatch 'students.pagesize'
        const pageSizeSelect = qsel('studentsPageSize');
        if (pageSizeSelect) {
            pageSizeSelect.addEventListener('change', function () {
                const v = parseInt(pageSizeSelect.value || defaultPageSize, 10) || defaultPageSize;
                // update local default
                defaultPageSize = v;
                dispatchEvent('students.pagesize', { pageSize: v });
            });
        }

        // Refresh all button => dispatch 'students.refresh'
        const refreshBtn = qsel('refresh-all-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', function (ev) {
                ev.preventDefault();
                dispatchEvent('students.refresh', { source: 'refresh-button' });
            });
        }

        // Toggle inactive button/link => dispatch 'students.toggleInactive'
        const toggleBtn = qsel('toggleInactiveBtn');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', function (ev) {
                // publish the intent — سپس اگر لینک است، ناوبری انجام می‌شود (بدون جلوگیری)
                dispatchEvent('students.toggleInactive', { element: toggleBtn });
                // اگر بخواهی جلو نیروی ناوبری را بگیری، دیگر اسکریپت‌ها می‌توانند به این رویداد گوش دهند و ev.preventDefault را فراخوانند
            });
        }
    })();

    // -------------------------
    // expose small utility functions (اختیاری برای تست در console)
    // -------------------------
    window.StudentsIndex.debug = function () {
        return {
            cfg: window.StudentsIndex.cfg,
            urls: window.StudentsIndex.urls,
            showInactive: window.StudentsIndex.showInactive,
            currentPage: window.StudentsIndex.currentPage,
            defaultPageSize: window.StudentsIndex.defaultPageSize
        };
    };

    // روی صفحه لود شده، یک رویداد init منتشر کن (تا بقیه اسکریپت‌ها بدانند آماده‌اند)
    dispatchEvent('students.index.ready', {
        showInactive: window.StudentsIndex.showInactive,
        currentPage: window.StudentsIndex.currentPage,
        defaultPageSize: window.StudentsIndex.defaultPageSize,
        urls: window.StudentsIndex.urls
    });

})(); 


// ================= Details modal with smooth open/close animations =================
(function () {
    'use strict';

    // helpers
    const qs = (s, root = document) => root.querySelector(s);
    const qsa = (s, root = document) => Array.from((root || document).querySelectorAll(s));
    const byId = id => document.getElementById(id);

    function safeText(v) { return v == null ? '' : String(v); }

    // modal elements (IDs from your Index view)
    const modal = byId('studentModal'); // main modal container
    const backdrop = byId('studentModalBackdrop') || byId('studentDetailsBackdrop'); // semi-transparent backdrop
    const closeBtn = byId('modalCloseBtn');
    const closeFooter = byId('modalCloseFooter');
    // also support close buttons with class "close-student-modal" (e.g. in other partials)
    const closeClassSelector = '.close-student-modal';

    // animation parameters
    const animDuration = 250; // ms (smooth but snappy)
    const animEasing = 'cubic-bezier(.2,.9,.2,1)';

    // apply initial inline styles required for animation (only once)
    function prepareModalForAnimation() {
        if (!modal) return;
        modal.style.transition = `opacity ${animDuration}ms ${animEasing}, transform ${animDuration}ms ${animEasing}`;
        modal.style.willChange = 'opacity, transform';
        // ensure starting hidden state doesn't flash
        if (modal.classList.contains('hidden')) {
            modal.style.opacity = 0;
            modal.style.transform = 'translateY(8px) scale(0.995)';
        }
        if (backdrop) {
            backdrop.style.transition = `opacity ${animDuration}ms ${animEasing}`;
            backdrop.style.willChange = 'opacity';
            if (backdrop.classList.contains('hidden')) backdrop.style.opacity = 0;
        }
    }
    prepareModalForAnimation();

    // open modal: set content previously filled, then animate in
    function openDetailFromDataset(ds) {
        const id = ds.id || ds['studentId'] || ds['id'];
        // if client modal not present, fallback to server detail page
        if (!modal) {
            if (id) window.location.href = `/Students/Details/${encodeURIComponent(id)}`;
            return;
        }

        // populate fields (safe)
        modal.querySelector('#modalPhoto')?.setAttribute('src', safeText(ds.photo || '/uploads/students/default.png'));
        modal.querySelector('#modalName') && (modal.querySelector('#modalName').textContent = `${safeText(ds.firstname || '')} ${safeText(ds.lastname || '')}`.trim());
        modal.querySelector('#modalFirstName') && (modal.querySelector('#modalFirstName').textContent = safeText(ds.firstname || ''));
        modal.querySelector('#modalLastName') && (modal.querySelector('#modalLastName').textContent = safeText(ds.lastname || ''));
        modal.querySelector('#modalFatherName') && (modal.querySelector('#modalFatherName').textContent = safeText(ds.fathername || ''));
        modal.querySelector('#modalNationalCode') && (modal.querySelector('#modalNationalCode').textContent = safeText(ds.nationalcode || ''));
        modal.querySelector('#modalGrade') && (modal.querySelector('#modalGrade').textContent = safeText(ds.grade || ''));
        modal.querySelector('#modalCoach') && (modal.querySelector('#modalCoach').textContent = safeText(ds.coach || ''));
        modal.querySelector('#modalSchool') && (modal.querySelector('#modalSchool').textContent = safeText(ds.school || ''));
        modal.querySelector('#modalId') && (modal.querySelector('#modalId').textContent = safeText(id || ''));
        modal.querySelector('#modalSubTitle') && (modal.querySelector('#modalSubTitle').textContent = ds.class ? `کلاس: ${safeText(ds.class)}` : '');

        // inactive reason (optional element with id modalInactiveReason)
        const ir = safeText(ds.inactivereason || ds.inactiveReason || '');
        const irEl = modal.querySelector('#modalInactiveReason');
        if (irEl) {
            irEl.textContent = ir;
            irEl.style.display = ir ? '' : 'none';
        }

        // show backdrop then modal (sequenced for nicer effect)
        if (backdrop) {
            backdrop.classList.remove('hidden');
            // ensure layout updated
            requestAnimationFrame(() => {
                backdrop.style.opacity = '0';
                // small delay to allow removal of hidden to take effect in some browsers
                requestAnimationFrame(() => backdrop.style.opacity = '0.75');
            });
        }

        modal.classList.remove('hidden');
        // start from slightly below and transparent
        modal.style.opacity = '0';
        modal.style.transform = 'translateY(10px) scale(0.995)';
        // animate in next frame
        requestAnimationFrame(() => {
            modal.style.opacity = '1';
            modal.style.transform = 'translateY(0) scale(1)';
            // set focus for accessibility
            setTimeout(() => {
                const focusable = modal.querySelector('button, [tabindex], a, input, textarea');
                try { focusable?.focus?.(); } catch (e) { /* ignore */ }
            }, animDuration + 10);
        });
    }

    // close modal: animate out then add hidden
    function closeDetailModal() {
        if (!modal) return;
        // animate out
        modal.style.opacity = '0';
        modal.style.transform = 'translateY(8px) scale(0.995)';
        if (backdrop) backdrop.style.opacity = '0';
        // after animation remove from view
        setTimeout(() => {
            try {
                modal.classList.add('hidden');
                // clear inline styles if you prefer (keep transitions)
                // modal.style.opacity = ''; modal.style.transform = '';
            } catch (e) { /* ignore */ }
            if (backdrop) backdrop.classList.add('hidden');
        }, animDuration + 10);
    }

    // delegated click handler to open modal from buttons with class .open-student-modal
    document.addEventListener('click', function (e) {
        const btn = e.target.closest('.open-student-modal');
        if (!btn) return;
        const ds = btn.dataset || {};
        // if dataset has at least a name/photo or id then populate modal
        if (ds && (ds.firstname || ds.lastname || ds.photo || ds.inactivereason || ds.nationalcode || ds.id)) {
            openDetailFromDataset(ds);
            return;
        }
        // else fallback to server details
        const id = ds.id || btn.getAttribute('data-id');
        if (id) window.location.href = `/Students/Details/${encodeURIComponent(id)}`;
    });

    // close bindings: close buttons and backdrop clicks
    if (closeBtn) closeBtn.addEventListener('click', closeDetailModal);
    if (closeFooter) closeFooter.addEventListener('click', closeDetailModal);
    // any element with class close-student-modal should close the modal
    qsa(closeClassSelector).forEach(el => el.addEventListener('click', closeDetailModal));

    // backdrop click closes only when clicking on backdrop itself (not children)
    if (backdrop) {
        backdrop.addEventListener('click', function (ev) {
            if (ev.target === backdrop) closeDetailModal();
        });
    }

    // Escape key closes modal (and also close ajax modal if present)
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' || e.key === 'Esc') {
            // prefer to close detail modal if open
            if (modal && !modal.classList.contains('hidden')) {
                closeDetailModal();
                return;
            }
            // also try to close ajax modal if exists
            const ajaxBackdrop = byId('modalBackdropAjax');
            const ajaxModal = byId('ajasmodal');
            if (ajaxModal && !ajaxModal.classList.contains('hidden')) {
                // try to close via closeAjaxModal if defined
                if (typeof closeAjaxModal === 'function') {
                    try { closeAjaxModal(); } catch (e) { ajaxBackdrop.classList.add('hidden'); ajaxModal.classList.add('hidden'); }
                } else {
                    ajaxBackdrop?.classList.add('hidden');
                    ajaxModal?.classList.add('hidden');
                }
            }
        }
    });

    // expose functions for debugging
    window.StudentsDetailsModal = {
        open: openDetailFromDataset,
        close: closeDetailModal
    };

})();

// ================= GetAll action handler =================
// هدف: واکشی کل لیست دانش‌آموزان از سرور (بر اساس وضعیت فعال/غیرفعال) و بازسازی tbody جدول
async function loadStudents(showInactive = false) {
    try {
        const url = `/Students/GetAll?showInactive=${showInactive}`;
        const response = await fetch(url, { method: 'GET' });
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

        const data = await response.json();
        const tbody = document.querySelector('#studentsTable tbody');
        if (!tbody) return;

        // پاک کردن جدول فعلی
        tbody.innerHTML = '';

        // اگر هیچ دانش‌آموزی نبود:
        if (!data.students || data.students.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="11" class="text-center py-4 text-gray-500">هیچ دانش‌آموزی یافت نشد.</td>
                </tr>`;
            return;
        }

        // بازسازی سطرها
        data.students.forEach(s => {
            const tr = document.createElement('tr');
            tr.className = 'border-b hover:bg-gray-50';

            tr.innerHTML = `
                <td class="p-2 text-center">${s.id}</td>
                <td class="p-2">
                    <div class="flex items-center gap-2">
                        <img src="${s.photo}" alt="عکس" class="w-8 h-8 rounded-full object-cover">
                        <span>${s.firstName ?? ''} ${s.lastName ?? ''}</span>
                    </div>
                </td>
                <td class="p-2 text-center">${s.fatherName ?? '-'}</td>
                <td class="p-2 text-center">${s.nationalCode ?? '-'}</td>
                <td class="p-2 text-center">${s.grade ?? '-'}</td>
                <td class="p-2 text-center">${s.schoolName ?? '-'}</td>
                <td class="p-2 text-center">${s.coachName ?? '-'}</td>
                <td class="p-2 text-center">${s.className ?? '-'}</td>
                <td class="p-2 text-center">
                    <span class="px-2 py-1 rounded text-xs font-semibold ${s.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">
                        ${s.isActive ? 'فعال' : 'غیرفعال'}
                    </span>
                </td>
                <td class="p-2 text-center">
                    <button class="open-student-modal text-blue-600 hover:text-blue-900" 
                        data-id="${s.id}" 
                        data-firstname="${s.firstName}" 
                        data-lastname="${s.lastName}" 
                        data-fathername="${s.fatherName}" 
                        data-nationalcode="${s.nationalCode}" 
                        data-grade="${s.grade}" 
                        data-school="${s.schoolName}" 
                        data-coach="${s.coachName}" 
                        data-photo="${s.photo}" 
                        data-class="${s.className}">
                        مشاهده
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });

    } catch (err) {
        console.error('❌ خطا در دریافت اطلاعات:', err);
        Swal.fire({
            icon: 'error',
            title: 'خطا',
            text: 'در دریافت اطلاعات دانش‌آموزان مشکلی پیش آمد.',
        });
    }
}

// مثال استفاده (در زمان بارگذاری صفحه)
document.addEventListener('DOMContentLoaded', () => {
    // مقدار اولیه: فقط فعال‌ها
    loadStudents(false);

    // اگر دکمه‌ی تغییر وضعیت فعال/غیرفعال وجود دارد:
    const toggle = document.getElementById('showInactiveToggle');
    if (toggle) {
        toggle.addEventListener('change', () => {
            loadStudents(toggle.checked);
        });
    }
});

// ================= EditPartial (GET + AJAX POST) with smooth ajax-modal =================
(function () {
    'use strict';

    const S = window.StudentsClient || {}; // optional helper namespace (has showNotify, escAttr)
    const notify = (msg, type = 'info', t = 3500) => {
        // اصلاح شده: همیشه دسترسی به notify داشته باشیم
        if (S.showNotify) {
            S.showNotify(msg, type, t);
        } else {
            console.log(type, msg);
        }
    };

    // modal containers from your Index view
    const ajaxBackdrop = document.getElementById('modalBackdropAjax');
    const ajaxModal = document.getElementById('ajasmodal');
    const ajaxContent = document.getElementById('modalContentAjax');

    // animation params (match details modal feel)
    const animMs = 250;
    const animEasing = 'cubic-bezier(.2,.9,.2,1)';

    // prepare modal style once (set transitions etc.)
    function prepareAjaxModal() {
        if (!ajaxModal) return;
        ajaxModal.style.transition = `opacity ${animMs}ms ${animEasing}, transform ${animMs}ms ${animEasing}`;
        ajaxModal.style.willChange = 'opacity, transform';
        if (ajaxModal.classList.contains('hidden')) {
            ajaxModal.style.opacity = 0;
            ajaxModal.style.transform = 'translateY(8px) scale(0.995)';
        }
        if (ajaxBackdrop) {
            ajaxBackdrop.style.transition = `opacity ${animMs}ms ${animEasing}`;
            ajaxBackdrop.style.willChange = 'opacity';
            if (ajaxBackdrop.classList.contains('hidden')) ajaxBackdrop.style.opacity = 0;
        }
    }
    prepareAjaxModal();

    function openAjaxModal() {
        if (!ajaxModal) return;

        if (ajaxBackdrop) {
            ajaxBackdrop.classList.remove('hidden');
            ajaxBackdrop.style.opacity = '0';
            void ajaxBackdrop.offsetWidth;
            requestAnimationFrame(() => {
                ajaxBackdrop.style.opacity = '0.65';
            });
        }

        ajaxModal.classList.remove('hidden');
        ajaxModal.style.opacity = '0';
        ajaxModal.style.transform = 'translateY(10px) scale(0.995)';
        void ajaxModal.offsetWidth;

        requestAnimationFrame(() => {
            ajaxModal.style.opacity = '1';
            ajaxModal.style.transform = 'translateY(0) scale(1)';
            setTimeout(() => {
                try {
                    const focusable = ajaxModal.querySelector('input, textarea, select, button, [tabindex]');
                    focusable?.focus?.();
                } catch (e) { }
            }, animMs + 10);
        });
    }

    function closeAjaxModal() {
        if (!ajaxModal) return;

        ajaxModal.style.opacity = '0';
        ajaxModal.style.transform = 'translateY(8px) scale(0.995)';
        if (ajaxBackdrop) ajaxBackdrop.style.opacity = '0';

        setTimeout(() => {
            try {
                ajaxModal.classList.add('hidden');
                ajaxBackdrop && ajaxBackdrop.classList.add('hidden');
                if (ajaxContent) ajaxContent.innerHTML = '';
            } catch (e) { }
        }, animMs + 20);
    }

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

    async function loadEditPartial(id) {
        if (!id) return notify('شناسهٔ دانش‌آموز معتبر نیست.', 'error');
        const url = (window.StudentsConfig && window.StudentsConfig.urls && window.StudentsConfig.urls.editPartial)
            ? `${window.StudentsConfig.urls.editPartial}?id=${encodeURIComponent(id)}`
            : `/Students/EditPartial?id=${encodeURIComponent(id)}`;
        try {
            const res = await fetch(url, { credentials: 'same-origin' });
            if (!res.ok) {
                if (res.status === 404) return notify('فرم ویرایش پیدا نشد.', 'error');
                return notify('خطا در بارگذاری فرم ویرایش.', 'error');
            }
            const html = await res.text();
            if (!ajaxContent) return notify('کانتینر مودال آژاکس پیدا نشد.', 'error');
            ajaxContent.innerHTML = html;
            bindEditForm();
            prepareAjaxModal();
            openAjaxModal();
        } catch (err) {
            console.error('loadEditPartial error', err);
            notify('خطای شبکه در بارگذاری فرم ویرایش.', 'error');
        }
    }

    function bindEditForm() {
        const editForm = document.getElementById('editStudentForm') || ajaxContent?.querySelector('#editStudentForm');
        if (!editForm) return;

        const cancelBtn = editForm.querySelector('#editCancelBtn') || editForm.querySelector('[data-action="cancel"]');
        if (cancelBtn) cancelBtn.addEventListener('click', function (ev) { ev.preventDefault(); closeAjaxModal(); });

        if (editForm.__students_edit_bound) return;
        editForm.__students_edit_bound = true;

        editForm.addEventListener('submit', async function (ev) {
            ev.preventDefault();
            try {
                const fd = new FormData(editForm);
                if (!fd.has('__RequestVerificationToken')) {
                    const token = readAntiForgeryToken();
                    if (token) fd.append('__RequestVerificationToken', token);
                }
                const action = editForm.getAttribute('action') || (window.StudentsConfig && window.StudentsConfig.urls && window.StudentsConfig.urls.editPartial) || '/Students/EditPartial';
                const res = await fetch(action, { method: 'POST', body: fd, credentials: 'same-origin' });

                const contentType = (res.headers.get('content-type') || '').toLowerCase();

                if (contentType.includes('application/json')) {
                    const json = await res.json();
                    if (json.success) {
                        // 🟢 اصلاح: همیشه notify اجرا شود حتی بعد از rebind
                        window.StudentsNotify
                            ? window.StudentsNotify(json.message || 'ویرایش با موفقیت انجام شد.', 'success')
                            : notify(json.message || 'ویرایش با موفقیت انجام شد.', 'success');

                        try {
                            if (json.student && typeof updateRowWithStudent === 'function') {
                                updateRowWithStudent(json.student, !!json.student.isActive);
                            } else {
                                if (typeof rebuildTableBodyFromServerPaged === 'function') {
                                    await rebuildTableBodyFromServerPaged(
                                        window.StudentsClient?.currentPage || 1,
                                        (document.getElementById('studentsPageSize')?.value ? parseInt(document.getElementById('studentsPageSize').value, 10) : window.StudentsClient?.defaultPageSize || 50),
                                        (document.getElementById('studentSearchInput')?.value || '').trim(),
                                        (window.StudentsClient?.pageShowInactive === true || window.StudentsClient?.pageShowInactive === 'true')
                                    );
                                }
                            }
                        } catch (e) {
                            console.warn('Error updating row after edit:', e);
                        }
                        closeAjaxModal();
                        return;
                    } else {
                        notify(json.message || 'خطا در ذخیره‌سازی.', 'error');
                        return;
                    }
                }

                if (!res.ok) {
                    const html = await res.text();
                    if (ajaxContent) {
                        ajaxContent.innerHTML = html;
                        if (editForm) editForm.__students_edit_bound = false;
                        bindEditForm();
                    }
                    notify('خطای اعتبارسنجی در فرم. لطفاً مقادیر را بررسی کن.', 'warning');
                    return;
                }

                const html = await res.text();
                if (ajaxContent) {
                    ajaxContent.innerHTML = html;
                    editForm.__students_edit_bound = false;
                    bindEditForm();
                }
            } catch (err) {
                console.error('editForm submit exception', err);
                notify('خطای شبکه در ارسال فرم ویرایش.', 'error');
            }
        });
    }

    document.addEventListener('click', function (e) {
        const btn = e.target.closest('.open-edit-modal');
        if (!btn) return;
        const id = btn.dataset?.id || btn.getAttribute('data-id');
        if (!id) {
            notify('شناسهٔ دانش‌آموز معتبر نیست.', 'error');
            return;
        }
        loadEditPartial(id);
    });

    if (ajaxBackdrop) {
        ajaxBackdrop.addEventListener('click', function (ev) {
            if (ev.target === ajaxBackdrop) closeAjaxModal();
        });
    }
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            if (ajaxModal && !ajaxModal.classList.contains('hidden')) closeAjaxModal();
        }
    });

    // expose for debug
    window.StudentsEditPartial = {
        load: loadEditPartial,
        open: openAjaxModal,
        close: closeAjaxModal
    };

    // global notify helper for reliability
    window.StudentsNotify = window.StudentsNotify || ((msg, type = 'info', t = 3500) => {
        // ✅ از متغیر S استفاده نکن، مستقیماً به global دسترسی پیدا کن
        if (window.StudentsClient?.showNotify) {
            window.StudentsClient.showNotify(msg, type, t);
        } else if (window.showNotify) {
            window.showNotify(msg, type, t);
        } else {
            console.log(type, msg);
        }
    });

})();

// ================= Delete / DeletePartial (AJAX) with smooth modal animations + Notify for InactiveReason (fixed fallback) =================


// ================= Create (GET + AJAX POST) with smooth ajax-modal =================
(function () {
    'use strict';

    // helper notify: prefer window.StudentsNotify, then window.showNotify, then console
    // helper notify: prefer StudentsNotify, showNotify, showTailwindAlert, showLocalNotification, notifyBottom, then console
    const notify = function (msg, type = 'info', t = 3500) {
        try {
            if (typeof window.StudentsNotify === 'function') {
                return window.StudentsNotify(msg, type, t);
            }
            if (typeof window.showNotify === 'function') {
                return window.showNotify(msg, type, t);
            }
            if (typeof window.showTailwindAlert === 'function') {
                // showTailwindAlert(type, title, message, options)
                return window.showTailwindAlert(type, type === 'success' ? 'موفق' : (type === 'error' ? 'خطا' : 'اطلاع'), msg, { timer: t });
            }
            if (typeof window.showLocalNotification === 'function') {
                return window.showLocalNotification({ message: msg, type: type, timeout: t });
            }
            if (typeof window.notifyBottom === 'function') {
                return window.notifyBottom(msg, type, t);
            }

            // fallback: create a simple visual toast at top-right (non-intrusive)
            (function simpleToast(message, kind, timeout) {
                try {
                    const containerId = 'students-simple-toast-container';
                    let container = document.getElementById(containerId);
                    if (!container) {
                        container = document.createElement('div');
                        container.id = containerId;
                        container.style.position = 'fixed';
                        container.style.top = '16px';
                        container.style.right = '16px';
                        container.style.zIndex = 99999;
                        document.body.appendChild(container);
                    }
                    const el = document.createElement('div');
                    el.textContent = message;
                    el.style.marginTop = '6px';
                    el.style.padding = '8px 12px';
                    el.style.borderRadius = '8px';
                    el.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
                    el.style.color = '#fff';
                    el.style.fontSize = '13px';
                    el.style.opacity = '0';
                    el.style.transition = 'opacity 200ms ease, transform 200ms ease';
                    el.style.transform = 'translateY(-6px)';
                    if (kind === 'success') el.style.background = '#16a34a';
                    else if (kind === 'warning') el.style.background = '#f59e0b';
                    else if (kind === 'error') el.style.background = '#ef4444';
                    else el.style.background = '#374151';
                    container.appendChild(el);
                    requestAnimationFrame(() => { el.style.opacity = '1'; el.style.transform = 'translateY(0)'; });
                    setTimeout(() => {
                        el.style.opacity = '0';
                        el.style.transform = 'translateY(-6px)';
                        el.addEventListener('transitionend', function () { try { el.remove(); } catch (e) { } }, { once: true });
                    }, timeout || 3000);
                } catch (e) {
                    // if DOM not ready, fallback to console
                    console[kind === 'error' ? 'error' : 'log'](kind, message);
                }
            })(msg, type, t);

        } catch (e) {
            // ultimate fallback
            console[type === 'error' ? 'error' : 'log'](type, msg);
        }
    };

    // read antiforgery token helper (reuse existing if present)
    function readAntiForgeryTokenLocal() {
        if (typeof readAntiForgeryToken === 'function') {
            try { const v = readAntiForgeryToken(); if (v) return v; } catch (e) { /* ignore */ }
        }
        const tpl = document.getElementById('antiForgeryTokenTemplate');
        if (tpl) {
            const inp = tpl.querySelector('input[name="__RequestVerificationToken"]');
            if (inp && inp.value) return inp.value;
        }
        const any = document.querySelector('input[name="__RequestVerificationToken"]');
        if (any && any.value) return any.value;
        return null;
    }

    // get the create form on the page (safe selectors)
    const form = document.querySelector('form[asp-action="Create"], form[action$="/Students/Create"], form[action$="/Create"]');

    if (!form) return; // nothing to do on pages without Create form

    // avoid double-binding
    if (form.__students_create_bound) return;
    form.__students_create_bound = true;

    // optional: show a lightweight client-side submit handler that uses fetch
    form.addEventListener('submit', async function (ev) {
        ev.preventDefault();

        // basic HTML5 validation if used
        if (typeof form.checkValidity === 'function' && !form.checkValidity()) {
            try { form.reportValidity(); } catch (e) { /* ignore */ }
            notify('لطفاً فیلدهای مورد نیاز را تکمیل کنید.', 'warning', 2500);
            return;
        }

        try {
            const fd = new FormData(form);

            // ensure antiforgery token exists in FormData
            if (!fd.has('__RequestVerificationToken')) {
                const token = readAntiForgeryTokenLocal();
                if (token) fd.append('__RequestVerificationToken', token);
            }

            const action = form.getAttribute('action') || window.location.href;
            const opts = { method: 'POST', body: fd, credentials: 'same-origin' };

            const res = await fetch(action, opts);

            // If server returns JSON (rare here) — handle it
            const contentType = (res.headers.get('content-type') || '').toLowerCase();

            if (contentType.includes('application/json')) {
                const json = await res.json();
                if (res.ok && json && json.success) {
                    notify(json.message || 'دانش‌آموز با موفقیت ثبت شد.', 'success', 2200);
                    // try to refresh table & counters
                    if (typeof rebuildTableBodyFromServerPaged === 'function') {
                        try { await rebuildTableBodyFromServerPaged(1, (document.getElementById('studentsPageSize')?.value ? parseInt(document.getElementById('studentsPageSize').value, 10) : (typeof defaultPageSize !== 'undefined' ? defaultPageSize : 50)), (document.getElementById('studentSearchInput')?.value || '')); } catch (e) { /* ignore */ }
                    } else {
                        // fallback: reload page if no table refresh function
                        setTimeout(() => { window.location.href = (window.StudentsConfig && window.StudentsConfig.urls && window.StudentsConfig.urls.index) ? window.StudentsConfig.urls.index : '/Students'; }, 350);
                    }
                    return;
                } else {
                    // show server message or generic
                    notify((json && (json.message || json.error)) || 'خطا در ثبت اطلاعات.', 'error', 4000);
                    return;
                }
            }

            // otherwise read text (likely HTML). If server redirected, fetch follows redirect;
            // if res.redirected === true and res.url points to index page we can assume success.
            const text = await res.text();

            // debug helpers (optional logs) - you can comment these out later
            // console.log('Create submit: status=', res.status, ' redirected=', res.redirected, ' url=', res.url);
            // console.log('Create submit: returned snippet=', text.trim().slice(0,120));

            // If returned content is full HTML (likely redirect to Index -> success)
            if (/<\s*html[\s>]/i.test(text) || res.redirected) {
                notify('دانش‌آموز با موفقیت ثبت شد.', 'success', 2000);

                // prefer to refresh table via existing function (non-blocking)
                if (typeof rebuildTableBodyFromServerPaged === 'function') {
                    try {
                        // keep current page or go to first page — use currentPage if available
                        const cp = (typeof window.StudentsClient !== 'undefined' && window.StudentsClient.currentPage) ? window.StudentsClient.currentPage : 1;
                        const ps = (document.getElementById('studentsPageSize')?.value ? parseInt(document.getElementById('studentsPageSize').value, 10) : (typeof defaultPageSize !== 'undefined' ? defaultPageSize : 50));
                        await rebuildTableBodyFromServerPaged(cp, ps, (document.getElementById('studentSearchInput')?.value || '').trim());
                    } catch (e) {
                        // fallback to reload
                        setTimeout(() => { window.location.href = (window.StudentsConfig && window.StudentsConfig.urls && window.StudentsConfig.urls.index) ? window.StudentsConfig.urls.index : '/Students'; }, 400);
                    }
                } else {
                    // fallback: do a gentle redirect to index (so UI consistent)
                    setTimeout(() => { window.location.href = (window.StudentsConfig && window.StudentsConfig.urls && window.StudentsConfig.urls.index) ? window.StudentsConfig.urls.index : '/Students'; }, 350);
                }
                return;
            }

            // If response contains an HTML form (validation errors), replace current form with returned one
            try {
                const parser = new DOMParser();
                const doc = parser.parseFromString(text, 'text/html');
                const newForm = doc.querySelector('form[asp-action="Create"], form[action$="/Students/Create"], form[action$="/Create"]') || doc.querySelector('form');
                if (newForm) {
                    // replace form in-place
                    form.replaceWith(newForm);
                    // clear binding flag and re-run this module so new form gets bound
                    newForm.__students_create_bound = false;
                    // re-run binding for the new form instance
                    setTimeout(() => {
                        // try to re-bind by reloading this script block: call this IIFE again
                        try { if (typeof window.__students_create_rebind === 'function') window.__students_create_rebind(); } catch (e) { /* ignore */ }
                        // show warning to user
                        notify('خطا در فرم: لطفاً مقادیر را بررسی کنید.', 'warning', 3000);
                    }, 20);
                    return;
                }
            } catch (e) {
                // parsing failed -> fallback below
            }

            // fallback: show success and refresh
            notify('عملیات انجام شد.', 'success', 1600);
            if (typeof rebuildTableBodyFromServerPaged === 'function') {
                try { await rebuildTableBodyFromServerPaged(1, (document.getElementById('studentsPageSize')?.value ? parseInt(document.getElementById('studentsPageSize').value, 10) : (typeof defaultPageSize !== 'undefined' ? defaultPageSize : 50)), (document.getElementById('studentSearchInput')?.value || '').trim()); } catch (e) { setTimeout(() => { window.location.reload(); }, 400); }
            } else {
                setTimeout(() => { window.location.reload(); }, 400);
            }
        } catch (err) {
            console.error('Create submit exception', err);
            notify('خطای شبکه در ارسال فرم. لطفاً اتصال را بررسی کنید.', 'error', 4000);
        }
    });

    // tiny rebind helper to allow replacement form to re-bind: safe global pointer
    window.__students_create_rebind = function () {
        try {
            // re-run this IIFE by re-attaching a minimal handler
            const f = document.querySelector('form[asp-action="Create"], form[action$="/Students/Create"], form[action$="/Create"]');
            if (!f) return;
            // if not already bound, call this module's binding logic by simulating load:
            if (!f.__students_create_bound) {
                // remove possible old listeners by cloning
                const clone = f.cloneNode(true);
                f.parentNode.replaceChild(clone, f);
                // now call this IIFE again by creating a new script event:
                // (simple approach: dispatch a custom event that triggers this function to run again)
                // but easiest is to call location.reload() fallback if rebind complexities arise.
                // Try to attach same handler by calling this module again:
                // (we achieve that by simply re-invoking the outer function via setTimeout)
                setTimeout(() => { try { (function () { /* no-op: outer IIFE already in file; best to reload */ window.location.reload(); })(); } catch (e) { window.location.reload(); } }, 50);
            }
        } catch (e) {
            console.warn('rebind helper error', e);
        }
    };

})();

// ================= RestorePartial (GET + AJAX POST) with smooth ajax-modal =================


// ================= ListPaged =================
(function () {
    'use strict';
    const inactiveCountUrl = window.StudentsConfig?.urls?.inactiveCount || '@Url.Action("InactiveCount","Students")'.replace(/@Url\.Action\("InactiveCount","Students"\)/g, '/Students/InactiveCount');
    const listPagedUrl = window.StudentsConfig?.urls?.listPaged || '@Url.Action("ListPaged","Students")'.replace(/@Url\.Action\("ListPaged","Students"\)/g, '/Students/ListPaged');
    const restorePartialUrl = window.StudentsConfig?.urls?.restorePartial || '@Url.Action("RestorePartial","Students")'.replace(/@Url\.Action\("RestorePartial","Students"\)/g, '/Students/RestorePartial');
    const restorePartialConfirmedUrl = window.StudentsConfig?.urls?.restorePartialConfirmed || '@Url.Action("RestorePartialConfirmed","Students")'.replace(/@Url\.Action\("RestorePartialConfirmed","Students"\)/g, '/Students/RestorePartialConfirmed');
    const deletePartialUrlBase = window.StudentsConfig?.urls?.deletePartial || '@Url.Action("DeletePartial","Students")'.replace(/@Url\.Action\("DeletePartial","Students"\)/g, '/Students/DeletePartial');
    const deletePartialConfirmedUrl = window.StudentsConfig?.urls?.deleteConfirmed || '@Url.Action("DeletePartialConfirmed","Students")'.replace(/@Url\.Action\("DeletePartialConfirmed","Students"\)/g, '/Students/DeletePartialConfirmed');
    const editPartialUrlBase = window.StudentsConfig?.urls?.editPartial || '@Url.Action("EditPartial","Students")'.replace(/@Url\.Action\("EditPartial","Students"\)/g, '/Students/EditPartial');
    const listPagedDefaultPageSize = (window.StudentsConfig && window.StudentsConfig.defaultPageSize) || 50;
    let pageShowInactive = (typeof window.StudentsClient !== 'undefined' && (window.StudentsClient.pageShowInactive === true || window.StudentsClient.pageShowInactive === 'true')) ? true : (typeof window.pageShowInactive !== 'undefined' ? (window.pageShowInactive === true || window.pageShowInactive === 'true') : false);
    let currentPage = (window.StudentsClient && window.StudentsClient.currentPage) ? window.StudentsClient.currentPage : (typeof window.currentPage !== 'undefined' ? window.currentPage : 1);
    let defaultPageSize = (window.StudentsClient && window.StudentsClient.defaultPageSize) ? window.StudentsClient.defaultPageSize : listPagedDefaultPageSize;

    function ensureNotify() {
        if (typeof window.showNotify === 'function') return window.showNotify;
        if (typeof window.showTailwindAlert === 'function') return (msg, type = 'info', t = 3000) => window.showTailwindAlert(type, type === 'success' ? 'موفق' : (type === 'error' ? 'خطا' : 'اطلاع'), msg, { timer: t });
        return (msg, type = 'info') => console.log(type, msg);
    }
    const notify = ensureNotify();

    if (!window.notifyBottom) {
        window.notifyBottom = function (msg, type = 'info', t = 2000) {
            try {
                const el = document.createElement('div');
                el.textContent = msg;
                el.style.position = 'fixed';
                el.style.top = '88px'; 
                el.style.left = '50%';
                el.style.transform = 'translateX(-50%)';
                el.style.padding = '10px 14px';
                el.style.borderRadius = '8px';
                el.style.zIndex = 9999;
                el.style.opacity = '0';
                el.style.transition = 'opacity 260ms ease, transform 260ms ease';
                el.style.color = '#fff';
                el.style.fontSize = '14px';
                el.style.pointerEvents = 'auto';
                if (type === 'success') el.style.background = '#16a34a';
                else if (type === 'warning') el.style.background = '#f59e0b';
                else if (type === 'error') el.style.background = '#ef4444';
                else el.style.background = '#374151';
                document.body.appendChild(el);
                requestAnimationFrame(() => {
                    el.style.opacity = '1';
                    el.style.transform = 'translateX(-50%) translateY(0)';
                });
                setTimeout(() => {
                    el.style.opacity = '0';
                    el.style.transform = 'translateX(-50%) translateY(-6px)';
                    el.addEventListener('transitionend', () => { try { el.remove(); } catch (e) { } }, { once: true });
                }, t);
            } catch (e) { console.log(type, msg); }
        };
    }

    function escAttr(s) { if (s === null || s === undefined) return ''; return String(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
    function findRowById(id) {
        if (id === null || typeof id === 'undefined') return null;
        const el = document.getElementById('row-' + id) || document.querySelector(`tr[data-student-id='${id}']`);
        return el;
    }

    function buildActionCellHtml(student, isActive = true) {
        const id = escAttr(student.id);
        const first = escAttr(student.firstName || '');
        const last = escAttr(student.lastName || '');
        const school = escAttr(student.schoolName || '');
        const grade = escAttr(student.grade || '');
        const coach = escAttr(student.coachName || '');
        const nat = escAttr(student.nationalCode || '');
        const photo = escAttr(student.photo || '/uploads/students/default.png');
        const father = escAttr(student.fatherName || '');
        const className = escAttr(student.className || '');
        const inactReasonAttr = escAttr(student.inactiveReason || '');
        const isActiveAttr = (student.isActive ? 'true' : 'false');
        const viewBtn = `<button type="button"
        class="open-student-modal inline-block bg-slate-100 text-slate-800 px-2 py-1 text-sm rounded hover:bg-blue-200 font-bold transition"
        data-id="${id}"
        data-firstname="${first}"
        data-lastname="${last}"
        data-fathername="${father}"
        data-school="${school}"
        data-grade="${grade}"
        data-coach="${coach}"
        data-nationalcode="${nat}"
        data-photo="${photo}"
        data-class="${className}"
        data-isactive="${isActiveAttr}"
        data-inactivereason="${inactReasonAttr}">
    جزئیات
    </button>`;
        const hardDeleteBtn = `<button type="button"
        class="open-hard-delete-modal inline-block bg-pink-600 text-slate-100 px-2 py-1 rounded text-sm hover:bg-pink-800 transition"
        data-id="${id}"
        data-name="${first} ${last}">
    حذف دائم
    </button>`;

        if (isActive) {
            const editBtn = `<button type="button" class="open-edit-modal inline-block bg-slate-100 text-amber-500 px-2 py-1 rounded text-sm  hover:bg-amber-100 font-bold transition" data-id="${id}">ویرایش</button>`;
            const deleteBtn = `<button type="button" class="open-delete-modal inline-block bg-slate-100 text-rose-600 px-2 py-1 rounded text-sm hover:bg-rose-100 font-bold transition" data-id="${id}" data-name="${first} ${last}">غیرفعال</button>`;
            return `${viewBtn} ${editBtn} ${deleteBtn} ${hardDeleteBtn}`;
        } else {
            const restoreBtn = `<button type="button" class="open-restore-modal inline-block bg-slate-100 text-teal-500 px-2 py-1 rounded text-sm hover:bg-teal-100 font-bold transition" data-id="${id}">فعالسازی</button>`;
            return `${viewBtn} ${restoreBtn} ${hardDeleteBtn}`;
        }
    }

    function buildRowHtmlFromData(student) {
        const img = escAttr(student.photo || '/uploads/students/default.png');
        const fname = escAttr(student.firstName || '');
        const lname = escAttr(student.lastName || '');
        const nat = escAttr(student.nationalCode || '');
        const grade = escAttr(student.grade || '');
        const school = escAttr(student.schoolName || '');
        const coach = escAttr(student.coachName || '');
        const className = escAttr(student.className || '');
        const id = escAttr(student.id);
        const inactReasonRaw = student.inactiveReason || '';
        const inactReason = escAttr(inactReasonRaw);

        const statusHtml = student.isActive
            ? '<span class="inline-block px-2 py-1 text-sm font-bold text-teal-800 bg-teal-100 rounded">فعال</span>'
            : '<span class="inline-block px-2 py-1 text-sm font-bold text-rose-800 bg-rose-100 rounded">غیرفعال</span>';

        const actions = buildActionCellHtml(student, !!student.isActive);

        const rowClass = student.isActive ? 'border-b hover:bg-slate-50' : 'border-b hover:bg-slate-50 bg-rose-50 text-rose-700';

        return `
            <tr id="row-${id}" data-student-id="${id}" class="${rowClass}">
                <td class="px-2 py-1 align-middle">
                    <img src="${img}" alt="عکس ${fname} ${lname}" class="w-10 h-10 object-cover rounded-full border" />
                </td>
                <td class="px-2 py-1 text-sm align-middle">${fname}</td>
                <td class="px-2 py-1 text-sm align-middle">${lname}</td>
                <td class="px-2 py-1 text-sm align-middle">${nat}</td>
                <td class="px-2 py-1 text-sm align-middle">${grade}</td>
                <td class="px-2 py-1 text-sm align-middle">${school}</td>
                <td class="px-2 py-1 text-sm align-middle">${coach}</td>
                <td class="px-2 py-1 text-sm align-middle text-center">${statusHtml}</td>
                <td class="px-4 py-3 align-middle space-x-1 rtl:space-x-reverse">${actions}</td>
                <td class="px-2 py-1 text-sm align-middle text-center">
                    ${(!student.isActive && inactReasonRaw.trim() !== '')
                ? `<div class="max-w-xs mx-auto break-words text-sm text-rose-800 bg-rose-50 px-2 py-1 rounded">${inactReason}</div>`
                : `<span class="text-slate-400">داده ثبت نشده</span>`}
                </td>
            </tr>
        `;
    }
    function updateRowWithStudent(student, assumeActive) {
        try {
            const oldRow = document.getElementById('row-' + student.id);
            if (!oldRow) {
                if (typeof rebuildTableBodyFromServerPaged === 'function') {
                    const ps = (document.getElementById('studentsPageSize')?.value ? parseInt(document.getElementById('studentsPageSize').value, 10) : defaultPageSize);
                    rebuildTableBodyFromServerPaged(currentPage, ps, (document.getElementById('studentSearchInput')?.value || ''), pageShowInactive === true);
                }
                return;
            }
            const newRowHtml = buildRowHtmlFromData(student);
            const wrapper = document.createElement('tbody');
            wrapper.innerHTML = newRowHtml;
            const newTr = wrapper.querySelector('tr');
            if (newTr) oldRow.replaceWith(newTr);
        } catch (e) {
            console.warn('updateRowWithStudent failed', e);
        }
    }
    const backdropAjax = document.getElementById('modalBackdropAjax');
    const ajaxModal = document.getElementById('ajasmodal');
    const modalContentAjax = document.getElementById('modalContentAjax');

    const animMs = 250;
    const animEasing = 'cubic-bezier(.2,.9,.2,1)';

    function prepareAjaxModal() {
        if (!ajaxModal) return;
        ajaxModal.style.transition = `opacity ${animMs}ms ${animEasing}, transform ${animMs}ms ${animEasing}`;
        ajaxModal.style.willChange = 'opacity, transform';
        if (ajaxModal.classList.contains('hidden')) {
            ajaxModal.style.opacity = 0;
            ajaxModal.style.transform = 'translateY(8px) scale(0.995)';
        }
        if (backdropAjax) {
            backdropAjax.style.transition = `opacity ${animMs}ms ${animEasing}`;
            backdropAjax.style.willChange = 'opacity';
            if (backdropAjax.classList.contains('hidden')) backdropAjax.style.opacity = 0;
        }
    }
    prepareAjaxModal();

    function openAjaxModal() {
        if (!ajaxModal) return;
        if (backdropAjax) {
            backdropAjax.classList.remove('hidden');
            backdropAjax.style.opacity = '0';
            void backdropAjax.offsetWidth;
            requestAnimationFrame(() => backdropAjax.style.opacity = '0.65');
        }
        ajaxModal.classList.remove('hidden');
        ajaxModal.style.opacity = '0';
        ajaxModal.style.transform = 'translateY(10px) scale(0.995)';
        void ajaxModal.offsetWidth;
        requestAnimationFrame(() => {
            ajaxModal.style.opacity = '1';
            ajaxModal.style.transform = 'translateY(0) scale(1)';
            setTimeout(() => {
                try { (ajaxModal.querySelector('input, textarea, select, button, [tabindex]') || ajaxModal).focus(); } catch (e) { }
            }, animMs + 10);
        });
    }

    function closeAjaxModal() {
        if (!ajaxModal) return;
        ajaxModal.style.opacity = '0';
        ajaxModal.style.transform = 'translateY(8px) scale(0.995)';
        if (backdropAjax) backdropAjax.style.opacity = '0';
        setTimeout(() => {
            try {
                ajaxModal.classList.add('hidden');
                if (backdropAjax) backdropAjax.classList.add('hidden');
                if (modalContentAjax) modalContentAjax.innerHTML = '';
            } catch (e) { /* ignore */ }
        }, animMs + 20);
    }

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

    async function loadPartial(url) {
        try {
            const res = await fetch(url, { credentials: 'same-origin' });
            if (!res.ok) {
                if (res.status === 404) notify('فرم مورد نظر پیدا نشد.', 'error');
                else notify('خطا در بارگذاری فرم.', 'error');
                console.error('loadPartial error', res.status, url);
                return null;
            }
            const html = await res.text();
            return html;
        } catch (err) {
            console.error('Network error loadPartial', err);
            notify('خطای شبکه در بارگذاری فرم.', 'error');
            return null;
        }
    }

    async function loadEditPartial(id) {
        if (!id) { notify('شناسهٔ دانش‌آموز نامعتبر است.', 'error'); return; }
        const url = (window.StudentsConfig && window.StudentsConfig.urls && window.StudentsConfig.urls.editPartial) ? `${window.StudentsConfig.urls.editPartial}?id=${encodeURIComponent(id)}` : `${editPartialUrlBase}?id=${encodeURIComponent(id)}`;
        const html = await loadPartial(url);
        if (!html) return;
        if (!modalContentAjax) { notify('کانتینر مودال پیدا نشد.', 'error'); return; }
        modalContentAjax.innerHTML = html;
        bindAjaxForms();
        openAjaxModal();
    }

    async function loadDeletePartial(id) {
        if (!id) { notify('شناسهٔ دانش‌آموز نامعتبر است.', 'error'); return; }
        const url = (window.StudentsConfig && window.StudentsConfig.urls && window.StudentsConfig.urls.deletePartial) ? `${window.StudentsConfig.urls.deletePartial}?id=${encodeURIComponent(id)}` : `${deletePartialUrlBase}?id=${encodeURIComponent(id)}`;
        const html = await loadPartial(url);
        if (!html) return;
        if (!modalContentAjax) { notify('کانتینر مودال پیدا نشد.', 'error'); return; }
        modalContentAjax.innerHTML = html;
        bindAjaxForms();
        openAjaxModal();
    }

    async function loadRestorePartial(id) {
        if (!id) { notify('شناسهٔ دانش‌آموز نامعتبر است.', 'error'); return; }
        const url = (window.StudentsConfig && window.StudentsConfig.urls && window.StudentsConfig.urls.restorePartial) ? `${window.StudentsConfig.urls.restorePartial}?id=${encodeURIComponent(id)}` : `${restorePartialUrl}?id=${encodeURIComponent(id)}`;
        const html = await loadPartial(url);
        if (!html) return;
        if (!modalContentAjax) { notify('کانتینر مودال پیدا نشد.', 'error'); return; }
        modalContentAjax.innerHTML = html;
        bindAjaxForms();
        openAjaxModal();
    }

    function bindAjaxForms() {
        try {
            const editForm = modalContentAjax.querySelector('#editStudentForm');
            if (editForm && !editForm.__students_edit_bound) {
                editForm.__students_edit_bound = true;
                const cancel = editForm.querySelector('#editCancelBtn') || editForm.querySelector('[data-action="cancel"]');
                if (cancel) cancel.addEventListener('click', (ev) => { ev.preventDefault(); closeAjaxModal(); });

                editForm.addEventListener('submit', async function (ev) {
                    ev.preventDefault();
                    try {
                        const fd = new FormData(editForm);
                        if (!fd.has('__RequestVerificationToken')) {
                            const token = readAntiForgeryToken();
                            if (token) fd.append('__RequestVerificationToken', token);
                        }
                        const action = editForm.getAttribute('action') || editPartialUrlBase;
                        const res = await fetch(action, { method: 'POST', body: fd, credentials: 'same-origin' });
                        const cType = (res.headers.get('content-type') || '').toLowerCase();

                        if (cType.includes('application/json')) {
                            const json = await res.json();
                            if (json.success) {
                                notify(json.message || 'ویرایش با موفقیت انجام شد.', 'success');
                                try {
                                    if (json.student && typeof updateRowWithStudent === 'function') updateRowWithStudent(json.student, !!json.student.isActive);
                                    else if (typeof rebuildTableBodyFromServerPaged === 'function') {
                                        const ps = (document.getElementById('studentsPageSize')?.value ? parseInt(document.getElementById('studentsPageSize').value, 10) : defaultPageSize);
                                        await rebuildTableBodyFromServerPaged(currentPage, ps, (document.getElementById('studentSearchInput')?.value || ''), pageShowInactive === true);
                                    }
                                } catch (e) { console.warn(e); }
                                try { await refreshInactiveCountOnPage(pageShowInactive === true); } catch (e) { }
                                closeAjaxModal();
                                return;
                            } else {
                                notify(json.message || 'خطا در ذخیره‌سازی.', 'error');
                                return;
                            }
                        }

                        if (!res.ok) {
                            const html = await res.text();
                            modalContentAjax.innerHTML = html;
                            bindAjaxForms();
                            notify('خطای اعتبارسنجی در فرم. لطفاً مقادیر را بررسی کن.', 'warning');
                            return;
                        }
                        const html = await res.text();
                        modalContentAjax.innerHTML = html;
                        bindAjaxForms();
                    } catch (err) {
                        console.error('Edit submit exception', err);
                        notify('خطای شبکه در ارسال فرم ویرایش.', 'error');
                    }
                });
            }

            const deleteForm = modalContentAjax.querySelector('#deleteStudentForm') || modalContentAjax.querySelector('form[data-purpose="delete"]') || modalContentAjax.querySelector('form');
            if (deleteForm && !deleteForm.__students_delete_bound) {
                deleteForm.__students_delete_bound = true;
                const cancel = deleteForm.querySelector('#deleteCancelBtn') || deleteForm.querySelector('[data-action="cancel"]');
                if (cancel) cancel.addEventListener('click', (ev) => { ev.preventDefault(); closeAjaxModal(); });
                (function attachReasonEnteredNotify(form) {
                    try {
                        const reasonEl =
                            form.querySelector('textarea[name="InactiveReason"]') ||
                            form.querySelector('#deleteInactiveReason') ||
                            form.querySelector('textarea');
                        if (!reasonEl) return;
                        reasonEl.__notify_shown = false;
                        const onInput = function () {
                            try {
                                const v = (reasonEl.value || '').trim();
                                if (v.length > 0 && !reasonEl.__notify_shown) {
                                    notify('علت غیرفعال‌سازی ثبت شد.', 'success', 2800);
                                    reasonEl.__notify_shown = true;
                                }
                                if (v.length === 0) reasonEl.__notify_shown = false;
                            } catch (e) { console.warn(e); }
                        };
                        reasonEl.addEventListener('input', onInput);
                        reasonEl.addEventListener('paste', () => setTimeout(onInput, 50));
                    } catch (e) { }
                })(deleteForm);

                deleteForm.addEventListener('submit', async function (ev) {
                    ev.preventDefault();
                    const reasonInput = deleteForm.querySelector('textarea[name="InactiveReason"], textarea#deleteInactiveReason');
                    if (reasonInput) {
                        const val = (reasonInput.value || '').trim();
                        if (!val) {
                            const errDiv = deleteForm.querySelector('#inactiveReasonError') || deleteForm.querySelector('.inactive-reason-error');
                            if (errDiv) { errDiv.textContent = 'لطفاً دلیل غیرفعال‌سازی را وارد کنید.'; errDiv.classList.remove('hidden'); }
                            notify('لطفاً دلیل غیرفعال‌سازی را وارد کنید.', 'warning');
                            return;
                        } else {
                            const errDiv = deleteForm.querySelector('#inactiveReasonError') || deleteForm.querySelector('.inactive-reason-error');
                            if (errDiv) { errDiv.textContent = ''; errDiv.classList.add('hidden'); }
                        }
                    }

                    try {
                        const fd = new FormData(deleteForm);
                        if (!fd.has('__RequestVerificationToken')) {
                            const token = readAntiForgeryToken();
                            if (token) fd.append('__RequestVerificationToken', token);
                        }
                        const action = deleteForm.getAttribute('action') || deletePartialConfirmedUrl;
                        const res = await fetch(action, { method: 'POST', body: fd, credentials: 'same-origin' });

                        const cType = (res.headers.get('content-type') || '').toLowerCase();

                        if (cType.includes('application/json')) {
                            const json = await res.json();
                            if (res.ok && json.success) {
                                notify(json.message || 'عملیات با موفقیت انجام شد.', 'success');
                                const idFromJson = json.id || fd.get('id') || fd.get('Id');
                                if (idFromJson) {
                                    const r = findRowById(idFromJson);
                                    if (r) r.remove();
                                    else if (typeof rebuildTableBodyFromServerPaged === 'function') {
                                        const ps = (document.getElementById('studentsPageSize')?.value ? parseInt(document.getElementById('studentsPageSize').value, 10) : defaultPageSize);
                                        await rebuildTableBodyFromServerPaged(currentPage, ps, (document.getElementById('studentSearchInput')?.value || ''), pageShowInactive === true);
                                    }
                                } else {
                                    if (typeof rebuildTableBodyFromServerPaged === 'function') {
                                        const ps = (document.getElementById('studentsPageSize')?.value ? parseInt(document.getElementById('studentsPageSize').value, 10) : defaultPageSize);
                                        await rebuildTableBodyFromServerPaged(currentPage, ps, (document.getElementById('studentSearchInput')?.value || ''), pageShowInactive === true);
                                    }
                                }
                                try { await refreshInactiveCountOnPage(pageShowInactive === true); } catch (e) { }
                                closeAjaxModal();
                                return;
                            } else {
                                const msg = json.message || json.error || 'خطا در انجام عملیات.';
                                notify(msg, 'error');
                                const errDiv = modalContentAjax.querySelector('#inactiveReasonError') || modalContentAjax.querySelector('.inactive-reason-error');
                                if (errDiv) { errDiv.textContent = msg; errDiv.classList.remove('hidden'); }
                                return;
                            }
                        }

                        if (!res.ok) {
                            const txt = await res.text();
                            if (modalContentAjax) {
                                modalContentAjax.innerHTML = txt;
                                const newForm = modalContentAjax.querySelector('#deleteStudentForm') || modalContentAjax.querySelector('form');
                                if (newForm) newForm.__students_delete_bound = false;
                                bindAjaxForms();
                            }
                            notify('خطا در حذف (اعتبارسنجی یا سرور).', 'warning');
                            return;
                        }
                        const txt = await res.text();
                        if (modalContentAjax) {
                            modalContentAjax.innerHTML = txt;
                            const newForm = modalContentAjax.querySelector('#deleteStudentForm') || modalContentAjax.querySelector('form');
                            if (newForm) newForm.__students_delete_bound = false;
                            bindAjaxForms();
                        }
                    } catch (err) {
                        console.error('Delete submit exception', err);
                        notify('خطای شبکه در ارسال فرم حذف.', 'error');
                    }
                });
            }
            const restoreForm = modalContentAjax.querySelector('#restoreStudentForm');
            if (restoreForm && !restoreForm.__students_restore_bound) {
                restoreForm.__students_restore_bound = true;
                const cancel = restoreForm.querySelector('#deleteCancelBtn') || restoreForm.querySelector('[data-action="cancel"]');
                if (cancel) cancel.addEventListener('click', (ev) => { ev.preventDefault(); closeAjaxModal(); });

                restoreForm.addEventListener('submit', async function (ev) {
                    ev.preventDefault();
                    try {
                        const fd = new FormData(restoreForm);
                        if (!fd.has('__RequestVerificationToken')) {
                            const token = readAntiForgeryToken();
                            if (token) fd.append('__RequestVerificationToken', token);
                        }
                        const action = restoreForm.getAttribute('action') || restorePartialConfirmedUrl;
                        const res = await fetch(action, { method: 'POST', body: fd, credentials: 'same-origin' });
                        if (!res.ok) {
                            notify('خطا در فعال‌سازی (کد: ' + res.status + ')', 'error');
                            return;
                        }
                        const json = await res.json();
                        if (!json.success) {
                            notify(json.message || 'خطا در فعال‌سازی.', 'error');
                            return;
                        }
                        notify(json.message || 'دانش‌آموز با موفقیت فعال شد.', 'success');
                        const wasShowingInactive = pageShowInactive === true;
                        if (wasShowingInactive) {
                            const existingRow = document.getElementById('row-' + json.id);
                            if (existingRow) existingRow.remove();
                            else if (typeof rebuildTableBodyFromServerPaged === 'function') {
                                const ps = (document.getElementById('studentsPageSize')?.value ? parseInt(document.getElementById('studentsPageSize').value, 10) : defaultPageSize);
                                await rebuildTableBodyFromServerPaged(currentPage, ps, (document.getElementById('studentSearchInput')?.value || ''), pageShowInactive === true);
                            }
                        } else {
                            if (document.getElementById('row-' + json.id)) {
                                if (json.student && typeof updateRowWithStudent === 'function') updateRowWithStudent(json.student, !!json.student.isActive);
                            } else {
                                if (typeof rebuildTableBodyFromServerPaged === 'function') {
                                    const ps = (document.getElementById('studentsPageSize')?.value ? parseInt(document.getElementById('studentsPageSize').value, 10) : defaultPageSize);
                                    await rebuildTableBodyFromServerPaged(currentPage, ps, (document.getElementById('studentSearchInput')?.value || ''), pageShowInactive === true);
                                }
                            }
                        }
                        try { await refreshInactiveCountOnPage(pageShowInactive === true); } catch (e) { }
                        closeAjaxModal();
                    } catch (err) {
                        console.error('restore submit exception', err);
                        notify('خطای شبکه در فعال‌سازی.', 'error');
                    }
                });
            }
        } catch (err) {
            console.error('bindAjaxForms exception', err);
        }
    } 

    document.addEventListener('click', function (e) {
        const editBtn = e.target.closest('.open-edit-modal');
        if (editBtn) {
            const id = editBtn.dataset.id;
            if (id) loadEditPartial(id);
            return;
        }
        const deleteBtn = e.target.closest('.open-delete-modal');
        if (deleteBtn) {
            const id = deleteBtn.dataset.id;
            if (id) loadDeletePartial(id);
            return;
        }
        const restoreBtn = e.target.closest('.open-restore-modal');
        if (restoreBtn) {
            const id = restoreBtn.dataset.id;
            if (id) loadRestorePartial(id);
            return;
        }
        const viewBtn = e.target.closest('.open-student-modal');
        if (viewBtn) {
            openDetailFromDataset(viewBtn.dataset);
            return;
        }
    });

    const backdropDetail = document.getElementById('studentModalBackdrop') || document.getElementById('studentDetailsBackdrop');
    const modalDetail = document.getElementById('studentModal');
    const closeBtnDetail = document.getElementById('modalCloseBtn');
    const closeFooterDetail = document.getElementById('modalCloseFooter');

    const modalPhoto = document.getElementById('modalPhoto');
    const modalName = document.getElementById('modalName');
    const modalFirstName = document.getElementById('modalFirstName');
    const modalLastName = document.getElementById('modalLastName');
    const modalFatherName = document.getElementById('modalFatherName');
    const modalNationalCode = document.getElementById('modalNationalCode');
    const modalGrade = document.getElementById('modalGrade');
    const modalCoach = document.getElementById('modalCoach');
    const modalSchool = document.getElementById('modalSchool');
    const modalId = document.getElementById('modalId');
    const modalSubTitle = document.getElementById('modalSubTitle');

    function openDetailFromDataset(dataset) {
        if (!dataset) return;
        const id = dataset.id || '';
        const firstname = dataset.firstname || '';
        const lastname = dataset.lastname || '';
        const fathername = dataset.fathername || '';
        const school = dataset.school || '';
        const grade = dataset.grade || '';
        const coach = dataset.coach || '';
        const nationalcode = dataset.nationalcode || '';
        const photo = dataset.photo || '/uploads/students/default.png';
        const className = dataset.class || '';
        const inactiveReason = dataset.inactivereason || '';
        const isActive = dataset.isactive === 'true' || dataset.isactive === true;

        if (modalPhoto) modalPhoto.src = photo;
        if (modalName) modalName.textContent = firstname + ' ' + lastname;
        if (modalFirstName) modalFirstName.textContent = firstname;
        if (modalLastName) modalLastName.textContent = lastname;
        if (modalFatherName) modalFatherName.textContent = fathername;
        if (modalNationalCode) modalNationalCode.textContent = nationalcode;
        if (modalGrade) modalGrade.textContent = grade;
        if (modalCoach) modalCoach.textContent = coach;
        if (modalSchool) modalSchool.textContent = school;
        if (modalId) modalId.textContent = id;
        if (modalSubTitle) modalSubTitle.textContent = className ? `کلاس: ${className}` : '';

        const detailsContent = document.getElementById('studentDetailsContent');
        if (detailsContent) {
            const html = `
                <div class="space-y-2">
                    <div><strong>نام کامل:</strong> ${firstname} ${lastname}</div>
                    <div><strong>نام پدر:</strong> ${fathername}</div>
                    <div><strong>کد ملی:</strong> ${nationalcode}</div>
                    <div><strong>پایه:</strong> ${grade}</div>
                    <div><strong>مدرسه:</strong> ${school}</div>
                    <div><strong>مربی:</strong> ${coach}</div>
                    <div><strong>کلاس:</strong> ${className}</div>
                    <div><strong>وضعیت:</strong> ${isActive ? 'فعال' : 'غیرفعال'}</div>
                    ${(!isActive && inactiveReason) ? `<div><strong>علت غیرفعال‌سازی:</strong> <div class="mt-1 text-sm text-rose-800 bg-rose-50 p-2 rounded">${escAttr(inactiveReason)}</div></div>` : ''}
                </div>
            `;
            detailsContent.innerHTML = html;
        }

        if (backdropDetail) backdropDetail.classList.remove('hidden');
        if (modalDetail) modalDetail.classList.remove('hidden');
    }

    function closeDetailModal() {
        if (backdropDetail) backdropDetail.classList.add('hidden');
        if (modalDetail) modalDetail.classList.add('hidden');
    }

    if (closeBtnDetail) closeBtnDetail.addEventListener('click', closeDetailModal);
    if (closeFooterDetail) closeFooterDetail.addEventListener('click', closeDetailModal);
    if (backdropDetail) backdropDetail.addEventListener('click', function (ev) { if (ev.target === backdropDetail) closeDetailModal(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDetailModal(); });

    async function rebuildTableBodyFromServerPaged(page = 1, pageSize = defaultPageSize, search = '', showInactive = (pageShowInactive === true)) {
        try {
            page = parseInt(page, 10) || 1;
            pageSize = parseInt(pageSize, 10) || defaultPageSize;
            const url = `${listPagedUrl}?page=${page}&pageSize=${pageSize}&showInactive=${encodeURIComponent(showInactive)}&search=${encodeURIComponent(search)}`;
            const res = await fetch(url, { credentials: 'same-origin' });
            if (!res.ok) {
                console.error('Failed to fetch paged students list:', res.status);
                notify('خطا در دریافت فهرست.', 'error');
                return;
            }
            const json = await res.json();
            const students = json.students || [];
            const tbody = document.querySelector('#studentsTable') || document.querySelector('#studentsTable tbody') || document.querySelector('table tbody');
            if (!tbody) {
                console.warn('students tbody not found');
                return;
            }

            tbody.innerHTML = students.map(s => buildRowHtmlFromData(s)).join('');

            currentPage = json.currentPage || page;
            const totalPages = json.totalPages || 1;
            const totalCount = json.totalCount || 0;
            const inactiveCount = json.inactiveCount || 0;

            const totalCountEl = document.getElementById('studentsTotalCount');
            if (totalCountEl) totalCountEl.textContent = totalCount;
            const inactiveCountEl = document.getElementById('studentsInactiveCount');
            if (inactiveCountEl) inactiveCountEl.textContent = inactiveCount;
            const currentPageEl = document.getElementById('studentsCurrentPage');
            if (currentPageEl) currentPageEl.textContent = currentPage;
            const totalPagesEl = document.getElementById('studentsTotalPages');
            if (totalPagesEl) totalPagesEl.textContent = totalPages;

            bindAjaxForms();
            await refreshInactiveCountOnPage(showInactive);
            updatePaginationControls(totalPages, currentPage);
        } catch (err) {
            console.error('Error rebuilding paged table body:', err);
            notify('خطای شبکه هنگام دریافت فهرست. لطفاً اتصال را بررسی کنید.', 'error');
        }
    }

    function updatePaginationControls(totalPages, currentPageLocal) {
        const container = document.getElementById('paginationContainer');
        if (!container) return;
        container.innerHTML = '';

        const prev = document.createElement('button');
        prev.className = 'bg-slate-200 px-2 py-1 rounded hover:bg-slate-300 transition';
        prev.textContent = 'قبلی';
        prev.disabled = currentPageLocal <= 1;
        prev.addEventListener('click', () => {
            if (currentPageLocal > 1) rebuildTableBodyFromServerPaged(currentPageLocal - 1, (document.getElementById('studentsPageSize')?.value ? parseInt(document.getElementById('studentsPageSize').value, 10) : defaultPageSize), (document.getElementById('studentSearchInput')?.value || ''));
        });
        container.appendChild(prev);

        const maxButtons = 7;
        const half = Math.floor(maxButtons / 2);
        let start = Math.max(1, currentPageLocal - half);
        let end = Math.min(totalPages, start + maxButtons - 1);
        if (end - start < maxButtons - 1) start = Math.max(1, end - maxButtons + 1);

        if (start > 1) {
            const firstBtn = document.createElement('button');
            firstBtn.className = 'px-2 py-1 rounded border mx-0.5';
            firstBtn.textContent = '1';
            firstBtn.addEventListener('click', () => rebuildTableBodyFromServerPaged(1, (document.getElementById('studentsPageSize')?.value ? parseInt(document.getElementById('studentsPageSize').value, 10) : defaultPageSize), (document.getElementById('studentSearchInput')?.value || '')));
            container.appendChild(firstBtn);
            if (start > 2) {
                const dots = document.createElement('span');
                dots.className = 'px-2 py-1 text-sm text-slate-800';
                dots.textContent = '...';
                container.appendChild(dots);
            }
        }

        for (let i = start; i <= end; i++) {
            const btn = document.createElement('button');
            btn.className = `px-2 py-1 rounded ${i === currentPageLocal ? 'bg-slate-100 text-blue-800' : 'bg-white text-blue-800'}`;
            btn.textContent = i;
            btn.addEventListener('click', () => rebuildTableBodyFromServerPaged(i, (document.getElementById('studentsPageSize')?.value ? parseInt(document.getElementById('studentsPageSize').value, 10) : defaultPageSize), (document.getElementById('studentSearchInput')?.value || '')));
            container.appendChild(btn);
        }

        if (end < totalPages) {
            if (end < totalPages - 1) {
                const dots2 = document.createElement('span');
                dots2.className = 'px-2 text-sm text-slate-800';
                dots2.textContent = '...';
                container.appendChild(dots2);
            }
            const lastBtn = document.createElement('button');
            lastBtn.className = 'px-2 py-2 rounded mx-0.5';
            lastBtn.textContent = totalPages;
            lastBtn.addEventListener('click', () => rebuildTableBodyFromServerPaged(totalPages, (document.getElementById('studentsPageSize')?.value ? parseInt(document.getElementById('studentsPageSize').value, 10) : defaultPageSize), (document.getElementById('studentSearchInput')?.value || '')));
            container.appendChild(lastBtn);
        }

        const next = document.createElement('button');
        next.className = 'bg-slate-200 px-2 py-1 rounded hover:bg-slate-300 transition';
        next.textContent = 'بعدی';
        next.disabled = currentPageLocal >= totalPages;
        next.addEventListener('click', () => {
            if (currentPageLocal < totalPages) rebuildTableBodyFromServerPaged(currentPageLocal + 1, (document.getElementById('studentsPageSize')?.value ? parseInt(document.getElementById('studentsPageSize').value, 10) : defaultPageSize), (document.getElementById('studentSearchInput')?.value || ''));
        });
        container.appendChild(next);
    }

    function debounce(fn, delay = 350) {
        let t = null;
        return function (...args) { clearTimeout(t); t = setTimeout(() => fn.apply(this, args), delay); };
    }
    const searchInput = document.getElementById('studentSearchInput');
    const pageSizeSelect = document.getElementById('studentsPageSize');
    function currentPageSize() {
        if (pageSizeSelect) {
            const v = parseInt(pageSizeSelect.value, 10);
            if (!isNaN(v) && v > 0) return v;
        }
        return defaultPageSize;
    }
    const debouncedSearch = debounce(function () {
        const q = searchInput ? (searchInput.value || '').trim() : '';
        rebuildTableBodyFromServerPaged(1, currentPageSize(), q);
    }, 400);
    if (searchInput) searchInput.addEventListener('input', debouncedSearch);
    if (pageSizeSelect) pageSizeSelect.addEventListener('change', function () {
        rebuildTableBodyFromServerPaged(1, currentPageSize(), (searchInput ? searchInput.value.trim() : ''));
    });

    (function attachToggleInactiveHandler() {
        const container = document; // delegated
        container.addEventListener('click', function (e) {
            const btn = e.target.closest('#toggleInactiveBtn');
            if (!btn) return;

            e.preventDefault();

            try {
                pageShowInactive = !(pageShowInactive === true || pageShowInactive === 'true');

                const ps = (document.getElementById('studentsPageSize')?.value ? parseInt(document.getElementById('studentsPageSize').value, 10) : defaultPageSize);
                const q = (document.getElementById('studentSearchInput')?.value || '').trim();

                try {
                    const newUrl = new URL(window.location.href);
                    newUrl.searchParams.set('showInactive', pageShowInactive ? 'true' : 'false');
                    newUrl.searchParams.set('page', '1'); 
                    window.history.replaceState({}, '', newUrl.toString());
                } catch (ignore) {  }

                rebuildTableBodyFromServerPaged(1, ps, q, pageShowInactive === true);
                refreshInactiveCountOnPage(pageShowInactive === true).catch(() => { });

            } catch (err) {
                console.error('toggleInactive handler error', err);
            }
        });
    })();

    function setToggleInactiveButton(count, currentShowInactive) {
        const btn = document.getElementById('toggleInactiveBtn');
        if (!btn) return;
        const isAnchor = btn.tagName.toLowerCase() === 'a';
        if (count > 0) {
            const href = currentShowInactive ? (window.StudentsConfig?.urls?.showInactiveFalse || `/Students/Index?showInactive=false`) : (window.StudentsConfig?.urls?.showInactiveTrue || `/Students/Index?showInactive=true`);
            const text = currentShowInactive ? 'نمایش رکوردهای فعال' : 'نمایش رکوردهای غیرفعال';
            if (isAnchor) {
                btn.href = href;
                btn.classList.remove('opacity-50', 'cursor-not-allowed');
                btn.textContent = text;
            } else {
                const a = document.createElement('a');
                a.id = btn.id;
                a.className = btn.className;
                a.href = href;
                a.textContent = text;
                btn.replaceWith(a);
            }
        } else {
            if (isAnchor) {
                const b = document.createElement('button');
                b.id = btn.id;
                b.className = 'px-2 py-1 rounded border text-sm opacity-50 cursor-not-allowed pointer-events-none';
                b.disabled = true;
                b.setAttribute('aria-disabled', 'true');
                b.textContent = 'نمایش رکوردهای غیرفعال';
                btn.replaceWith(b);
            } else {
                btn.disabled = true;
                btn.classList.add('opacity-50', 'cursor-not-allowed');
                btn.setAttribute('aria-disabled', 'true');
                btn.textContent = 'نمایش رکوردهای غیرفعال';
            }
        }
    }

    async function refreshInactiveCountOnPage(currentShowInactive = false) {
        try {
            const res = await fetch(inactiveCountUrl, { credentials: 'same-origin' });
            if (!res.ok) return;
            const json = await res.json();
            const count = parseInt(json.count || 0, 10);
            setToggleInactiveButton(count, currentShowInactive);
            const inactiveCountEl = document.getElementById('studentsInactiveCount');
            if (inactiveCountEl) inactiveCountEl.textContent = count;
        } catch (err) {
            console.error('Error fetching inactive count:', err);
        }
    }

    try { refreshInactiveCountOnPage(pageShowInactive === true); } catch (e) { }
    (function setupSignalR() {
        if (typeof signalR === 'undefined') return;

        try {
            const hubUrl = (window.StudentsConfig && window.StudentsConfig.urls && window.StudentsConfig.urls.hub) || '/hubs/students';
            const connection = new signalR.HubConnectionBuilder().withUrl(hubUrl).withAutomaticReconnect().build();

            connection.on('StudentUpdated', function (student) {
                try {
                    if (!student) return;
                    const r = findRowById(student.id);
                    if (r) {
                        updateRowWithStudent(student, !!student.isActive);
                    } else {
                        if (typeof rebuildTableBodyFromServerPaged === 'function') {
                            const ps = (document.getElementById('studentsPageSize')?.value ? parseInt(document.getElementById('studentsPageSize').value, 10) : defaultPageSize);
                            rebuildTableBodyFromServerPaged(currentPage, ps, (document.getElementById('studentSearchInput')?.value || ''), pageShowInactive === true);
                        }
                    }
                    notify('اطلاعات دانش‌آموز بروز شد.', 'success');
                } catch (e) { console.warn(e); }
            });

            connection.on('StudentRestored', function (student) {
                try {
                    if (!student) return;
                    if (pageShowInactive === true) {
                        const r = findRowById(student.id);
                        if (r) r.remove();
                        else if (typeof rebuildTableBodyFromServerPaged === 'function') {
                            const ps = (document.getElementById('studentsPageSize')?.value ? parseInt(document.getElementById('studentsPageSize').value, 10) : defaultPageSize);
                            rebuildTableBodyFromServerPaged(currentPage, ps, (document.getElementById('studentSearchInput')?.value || ''), pageShowInactive === true);
                        }
                    } else {
                        if (document.getElementById('row-' + student.id)) updateRowWithStudent(student, !!student.isActive);
                        else {
                            const tbody = document.querySelector('#studentsTable') || document.querySelector('table tbody');
                            if (tbody) { tbody.insertAdjacentHTML('afterbegin', buildRowHtmlFromData(student)); bindAjaxForms(); }
                        }
                    }
                    refreshInactiveCountOnPage(pageShowInactive === true);
                    window.notifyBottom?.('دانش‌آموز فعال شد.', 'success', 1800);
                } catch (e) { console.warn(e); }
            });

            connection.on('StudentDeleted', function (data) {
                try {
                    const id = data && (data.id || data);
                    if (!id) return;
                    const r = findRowById(id);
                    if (r) r.remove();
                    else if (typeof rebuildTableBodyFromServerPaged === 'function') {
                        const ps = (document.getElementById('studentsPageSize')?.value ? parseInt(document.getElementById('studentsPageSize').value, 10) : defaultPageSize);
                        rebuildTableBodyFromServerPaged(currentPage, ps, (document.getElementById('studentSearchInput')?.value || ''), pageShowInactive === true);
                    }
                    refreshInactiveCountOnPage(pageShowInactive === true);
                    window.notifyBottom?.('دانش‌آموز غیرفعال شد.', 'warning', 1800);
                } catch (e) { console.warn(e); }
            });

            connection.start()
                .then(() => {
                    console.info('SignalR connected to', hubUrl);
                })
                .catch(err => {
                    console.warn('SignalR connection error', err);
                });

            connection.onreconnecting((error) => {
                console.warn('SignalR reconnecting...', error);
                window.notifyBottom?.('در حال تلاش برای ارتباط مجدد...', 'warning', 2000);
            });

            connection.onreconnected((connectionId) => {
                console.info('SignalR reconnected, id=', connectionId);
                window.notifyBottom?.('ارتباط بازسازی شد.', 'success', 1500);
            });

            window.StudentsSignalR = { connection };
        } catch (e) { console.warn('SignalR setup failed', e); }
    })();

    try {
        const ps = (document.getElementById('studentsPageSize')?.value ? parseInt(document.getElementById('studentsPageSize').value, 10) : defaultPageSize);
        rebuildTableBodyFromServerPaged(currentPage, ps, (document.getElementById('studentSearchInput')?.value || ''), pageShowInactive === true);
    } catch (e) {
        console.warn('initial rebuild error', e);
    }

    window.StudentsClient = window.StudentsClient || {};
    Object.assign(window.StudentsClient, {
        rebuildTableBodyFromServerPaged,
        buildRowHtmlFromData,
        buildActionCellHtml,
        updateRowWithStudent,
        refreshInactiveCountOnPage,
        setToggleInactiveButton,
        currentPage: currentPage,
        defaultPageSize: defaultPageSize,
        pageShowInactive: pageShowInactive
    });

})();

// ========== Tailwind-Alert ==========
(function () {
    'use strict';

    // ----------------- inject CSS once -----------------
    if (!document.getElementById('tf-alert-styles')) {
        const style = document.createElement('style');
        style.id = 'tf-alert-styles';
        style.textContent = `
                /* container */
                .tf-alert-container { position: fixed; top: 1.25rem; left: 50%; transform: translateX(-50%); z-index: 9999; width: calc(100% - 2rem); max-width: 42rem; display:flex; flex-direction:column; gap:0.6rem; align-items:center; pointer-events:none; }

                /* card */
                .tf-alert {
                  pointer-events:auto;
                  display: flex;
                  align-items: center;
                  gap: 0.9rem;
                  padding: 0.85rem 1rem;
                  border-radius: 0.75rem;
                  box-shadow: 0 10px 30px rgba(2,6,23,0.12);
                  width: 100%;
                  color: white;
                  transform-origin: top center;
                  opacity: 0;
                  transform: translateY(-10px) scale(0.995);
                  transition: opacity 260ms cubic-bezier(.2,.9,.2,1), transform 260ms cubic-bezier(.2,.9,.2,1);
                  font-family: inherit;
                }

                /* show/hide classes */
                .tf-alert.show { opacity: 1; transform: translateY(0) scale(1); }
                .tf-alert.hide { opacity: 0; transform: translateY(-10px) scale(0.995); }

                /* icon circle */
                .tf-alert .icon-wrap {
                  min-width:44px; min-height:44px;
                  border-radius:9999px;
                  display:flex; align-items:center; justify-content:center;
                  background: rgba(255,255,255,0.12);
                  flex-shrink:0;
                  box-shadow: inset 0 -1px 0 rgba(255,255,255,0.03);
                }
                .tf-alert .icon { font-size:1.1rem; }

                /* text area: title + message */
                .tf-alert .text {
                  display:flex;
                  flex-direction:column;
                  gap:2px;
                  text-align: right;
                  overflow: hidden;
                }
                .tf-alert .title {
                  font-weight: 700;
                  font-size: 1.1rem;
                  line-height: 2.0;
                  letter-spacing: 0.2px;
                }
                .tf-alert .msg {
                  font-size: 0.875rem;
                  opacity: 0.95;
                  line-height: 1.2;
                }

                /* close button */
                .tf-alert .tf-close {
                  margin-left: 0.5rem;
                  background: transparent;
                  border: none;
                  color: rgba(255,255,255,0.9);
                  cursor: pointer;
                  font-size: 1rem;
                  padding: 0.2rem;
                  border-radius: 0.25rem;
                }

                /* types */
                .tf-alert.success { background: linear-gradient(#22c55e); }
                .tf-alert.error   { background: linear-gradient(#db2777); }
                .tf-alert.warning { background: linear-gradient(#f59e0b); }
                .tf-alert.info    { background: linear-gradient(#3b82f6); }

                /* responsive: smaller paddings on narrow screens */
                @media (max-width:420px) {
                  .tf-alert { padding: 0.7rem 0.8rem; border-radius: 0.6rem; }
                  .tf-alert .icon-wrap { min-width:40px; min-height:40px; }
                  .tf-alert .title { font-size: 0.98rem; }
                  .tf-alert .msg { font-size: 0.82rem; }
                }
        `;
        document.head.appendChild(style);
    }

    // ----------------- container -----------------
    function ensureContainer() {
        let c = document.querySelector('.tf-alert-container');
        if (!c) {
            c = document.createElement('div');
            c.className = 'tf-alert-container';
            c.setAttribute('aria-live', 'polite');
            c.setAttribute('role', 'status');
            document.body.appendChild(c);
        }
        return c;
    }

    // ----------------- icon map -----------------
    function iconFor(type) {
        switch ((type || 'info').toLowerCase()) {
            case 'success': return '✔';
            case 'error': return '✖';
            case 'warning': return '⚠';
            default: return 'ℹ';
        }
    }

    // ----------------- main show function -----------------
    function showTailwindAlert(type = 'success', title = 'عملیات موفق', message = '', duration = 4200) {
        const container = ensureContainer();
        const id = 'tf-alert-' + Date.now() + '-' + Math.floor(Math.random() * 10000);
        const el = document.createElement('div');
        el.className = `tf-alert ${type}`;
        el.id = id;
        el.setAttribute('role', 'alert');
        el.innerHTML = `            
            <div class="text">
                <div class="title">${String(title)}</div>
                <div class="msg">${String(message)}</div>
            </div>
        `;

        // timer control
        let removed = false;
        let tHandle = null;
        function clearTimer() { if (tHandle) { clearTimeout(tHandle); tHandle = null; } }
        function startTimer(ms) { clearTimer(); tHandle = setTimeout(remove, ms); }

        function remove() {
            if (removed) return;
            removed = true;
            el.classList.remove('show');
            el.classList.add('hide');
            clearTimer();
            setTimeout(() => { try { el.remove(); } catch (e) { } }, 260);
        }

        // pause on hover
        el.addEventListener('mouseenter', () => clearTimer());
        el.addEventListener('mouseleave', () => startTimer(duration));

        // close button
        el.querySelector('.tf-close')?.addEventListener('click', (e) => { e.preventDefault(); remove(); });

        // prepend to container so newest is on top (like image)
        container.prepend(el);

        // animate in next frame
        requestAnimationFrame(() => { el.classList.add('show'); startTimer(duration); });

        return { id, remove };
    }

    // ------------- compatibility: override global showNotify safely -------------
    // keep original if exists
    if (!window._orig_showNotify && typeof window.showNotify === 'function') window._orig_showNotify = window.showNotify;
    // expose
    window.showTailwindAlert = showTailwindAlert;
    // Override showNotify to call our alert with default titles
    window.showNotify = function (message, type = 'info', duration = 2500) {
        const t = (type || 'info').toLowerCase();
        const titleMap = { success: 'عملیات موفق', error: 'عملیات خطا', warning: 'هشدار', info: 'اطلاع رسانی' };
        const title = titleMap[t] || 'اطلاع رسانی';
        return showTailwindAlert(t, title, message, duration);
    };

    // for debugging from console
    window._tfAlert = { show: showTailwindAlert, container: ensureContainer };
})();

// === SAFELY expose functions globally so SignalR handler can call them ===
try {
    if (typeof updateRowWithStudent === 'function') {
        window.updateRowWithStudent = updateRowWithStudent;
    }
} catch (e) { /* ignore */ }

try {
    if (typeof rebuildTableBodyFromServerPaged === 'function') {
        window.rebuildTableBodyFromServerPaged = rebuildTableBodyFromServerPaged;
    }
} catch (e) { /* ignore */ }

// optional: expose a tiny helper to log availability (won't break anything)
window._students_helpers = window._students_helpers || {};
window._students_helpers.updateRowWithStudentExists = typeof window.updateRowWithStudent === 'function';
window._students_helpers.rebuildExists = typeof window.rebuildTableBodyFromServerPaged === 'function';

