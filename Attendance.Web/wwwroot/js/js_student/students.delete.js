// students.modal.delete.js
// Reusable AJAX modal loader for DeletePartial — animated open/close, backdrop, focus, Esc, data-modal-close support
(function () {
    'use strict';

    // scroll lock helpers to avoid page shift when modal opens
    let __modalScrollLockCount = 0;
    function lockBodyScroll() {
        try {
            __modalScrollLockCount++;
            if (__modalScrollLockCount > 1) return;
            // scrollbar width compensation
            const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
            if (scrollBarWidth > 0) {
                // apply padding-right to body to compensate for removed scrollbar
                document.body.style.paddingRight = scrollBarWidth + 'px';
            }
            // prevent scroll
            document.documentElement.style.overflow = 'hidden';
            document.body.style.overflow = 'hidden';
        } catch (e) { /* ignore */ }
    }
    function unlockBodyScroll() {
        try {
            __modalScrollLockCount = Math.max(0, __modalScrollLockCount - 1);
            if (__modalScrollLockCount > 0) return;
            // restore
            document.body.style.overflow = '';
            document.documentElement.style.overflow = '';
            document.body.style.paddingRight = '';
        } catch (e) { /* ignore */ }
    }

    // safeFocus: focus without causing browser to scroll (if supported)
    function safeFocus(el) {
        try {
            if (!el) return;
            if (typeof el.focus === 'function') {
                // try focus with preventScroll when available
                el.focus({ preventScroll: true });
                // some browsers ignore the option; also reset scroll position manually if needed
            }
        } catch (e) {
            try { el.focus(); } catch (e2) { /* ignore */ }
        }
    }


    const BACKDROP_ID = 'modalBackdropAjax';
    const ROOT_ID = 'ajasmodal';
    const CONTENT_ID = 'modalContentAjax';
    const ANIM_MS = 240;

    const backdrop = document.getElementById(BACKDROP_ID);
    const modalRoot = document.getElementById(ROOT_ID);
    const modalContent = document.getElementById(CONTENT_ID);

    // safety: if containers missing, warn and stop wiring
    if (!modalRoot || !modalContent || !backdrop) {
        console.warn('students.modal.delete: modal container(s) not found. Expected ids:', BACKDROP_ID, ROOT_ID, CONTENT_ID);
        return;
    }

    // --- helpers for open / close with smooth animation ---
    function prepareShow() {
        lockBodyScroll(); // <--- اضافه شود
        // make sure visible
        backdrop.classList.remove('hidden');
        modalRoot.classList.remove('hidden');

        // initial states for animation
        backdrop.style.transition = `opacity ${ANIM_MS}ms ease`;
        backdrop.style.opacity = '0';

        modalContent.style.transition = `opacity ${ANIM_MS}ms ease, transform ${ANIM_MS}ms ease`;
        modalContent.style.transformOrigin = 'top center';
        modalContent.style.opacity = '0';
        modalContent.style.transform = 'translateY(8px) scale(0.995)';

        // force reflow
        void backdrop.offsetWidth;
        void modalContent.offsetWidth;
    }

    function animateIn() {
        requestAnimationFrame(() => {
            backdrop.style.opacity = '0.65';
            modalContent.style.opacity = '1';
            modalContent.style.transform = 'translateY(0) scale(1)';
            // focus first interactive element after animation short delay
            setTimeout(() => {
                try {
                    const first = modalContent.querySelector('textarea, input, button, [tabindex]');
                    if (first) safeFocus(first); // <-- use safeFocus
                } catch (e) { /* ignore */ }
            }, ANIM_MS + 10);
        });
    }

    function animateOutAndHide() {
        try {
            backdrop.style.opacity = '0';
            modalContent.style.opacity = '0';
            modalContent.style.transform = 'translateY(8px) scale(0.995)';
        } catch (e) { /* ignore */ }

        setTimeout(() => {
            try {
                backdrop.classList.add('hidden');
                modalRoot.classList.add('hidden');
                // clear content to avoid duplicate IDs and to free memory
                modalContent.innerHTML = '';
                // reset inline styles
                backdrop.style.opacity = '';
                backdrop.style.transition = '';
                modalContent.style.opacity = '';
                modalContent.style.transform = '';
                modalContent.style.transition = '';
            } catch (e) { /* ignore */ }
            unlockBodyScroll(); // <--- اضافه شود
        }, ANIM_MS + 20);
    }

    // public-ish functions (exposed on window for debug or external calls)
    function openAjaxModalWithHtml(html) {
        modalContent.innerHTML = html;
        prepareShow();
        // small delay so user sees overlay before content animates in
        // (makes UX feel smoother when fetch is fast)
        setTimeout(animateIn, 10);
    }

    function closeAjaxModalSmooth() {
        animateOutAndHide();
    }

    // expose for debug/other modules
    window.StudentsDeleteModal = window.StudentsDeleteModal || {};
    window.StudentsDeleteModal.open = openAjaxModalWithHtml;
    window.StudentsDeleteModal.close = closeAjaxModalSmooth;

    // --- delegated click handler: open delete partial ---
    document.addEventListener('click', async function (ev) {
        const btn = ev.target.closest && ev.target.closest('.open-delete-modal');
        if (!btn) return;

        ev.preventDefault();

        // build URL: prefer data-url then data-id
        const dataUrl = btn.getAttribute('data-url') || (btn.dataset && btn.dataset.url) || null;
        const id = btn.getAttribute('data-id') || (btn.dataset && btn.dataset.id) || null;
        const url = dataUrl || (id ? `/Students/DeletePartial?id=${encodeURIComponent(id)}` : null);

        if (!url) {
            console.error('open-delete-modal: missing data-url or data-id on button', btn);
            return;
        }

        // show minimal loading skeleton quickly
        modalContent.innerHTML = `<div class="p-6 text-center">
            <div class="inline-block mb-3 w-6 h-6 border-4 border-t-blue-600 rounded-full animate-spin"></div>
            <div class="text-sm text-slate-600">در حال بارگذاری...</div>
        </div>`;
        prepareShow();
        // fade in backdrop quickly (so user sees progress)
        requestAnimationFrame(() => {
            backdrop.style.opacity = '0.12'; // very subtle initial
            void backdrop.offsetWidth;
            backdrop.style.opacity = '0.65';
        });

        try {
            const res = await fetch(url, { credentials: 'same-origin' });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const html = await res.text();

            // If server returned JSON (e.g. error), try to handle gracefully
            const cType = (res.headers.get('content-type') || '').toLowerCase();
            if (cType.includes('application/json')) {
                try {
                    const json = JSON.parse(html);
                    const msg = (json && (json.message || json.error)) || 'خطا در بارگذاری فرم.';
                    // close and show notify
                    animateOutAndHide();
                    if (typeof window.StudentsNotify === 'function') window.StudentsNotify(msg, 'error');
                    else if (typeof window.showNotify === 'function') window.showNotify(msg, 'error');
                    else console.error(msg);
                    return;
                } catch (e) { /* ignore and try treat as HTML */ }
            }

            // inject partial and animate in
            modalContent.innerHTML = html;
            // ensure content starts from hidden state
            modalContent.style.opacity = '0';
            modalContent.style.transform = 'translateY(8px) scale(0.995)';
            // animate
            setTimeout(animateIn, 12);

        } catch (err) {
            console.error('Failed to load DeletePartial:', err);
            // hide modal and notify
            animateOutAndHide();
            if (typeof window.StudentsNotify === 'function') window.StudentsNotify('خطا در بارگذاری فرم حذف. لطفاً دوباره تلاش کنید.', 'error');
            else if (typeof window.showNotify === 'function') window.showNotify('خطا در بارگذاری فرم حذف. لطفاً دوباره تلاش کنید.', 'error');
            else console.error(err);
        }
    });

    // delegated clicks to close modal:
    // - any element inside partial with [data-modal-close] OR data-action="cancel" OR class .modal-close
    document.addEventListener('click', function (ev) {
        const c = ev.target.closest && ev.target.closest('[data-modal-close], [data-action="cancel"], .modal-close');
        if (!c) return;
        // if clicked inside the ajax modal content area, close smoothly
        const inside = c.closest && (c.closest('#' + CONTENT_ID) || c.closest('#' + ROOT_ID));
        if (inside) {
            ev.preventDefault();
            animateOutAndHide();
        }
    });

    // click on backdrop closes modal
    backdrop.addEventListener('click', function (ev) {
        if (ev.target === backdrop) {
            animateOutAndHide();
        }
    });

    // close on Escape
    document.addEventListener('keydown', function (ev) {
        if (ev.key === 'Escape' || ev.key === 'Esc') {
            if (!modalRoot.classList.contains('hidden')) animateOutAndHide();
        }
    });

    // When modal form does a non-AJAX POST and server returns HTML (redirect to Index),
    // browser will navigate — nothing extra required here.
    // If you want to close modal when form is submitted via non-AJAX, ensure the submit handler
    // disables the submit button and shows loader (students.delete.js covers that).
})();

//// wwwroot/js/students.delete.js
//// Manage UX for DeletePartial modal form (non-AJAX POST). Delegated handlers.
//// - validate InactiveReason
//// - prevent double submit
//// - handle "cancel" button to close modal smoothly
//// - show existing loader (id="students-loader") if present, or create small inline loader
//(function () {
//    'use strict';

//    // small helper: find the modal root for an element (closest container)
//    function findModalRoot(el) {
//        if (!el) return null;
//        // prefer explicit modal container classes/ids commonly used
//        const selectors = ['.student-delete-modal', '.modal', '#ajasmodal', '[data-modal-root]'];
//        let node = el;
//        while (node && node !== document.documentElement) {
//            for (const sel of selectors) {
//                if (node.matches && node.matches(sel)) return node;
//            }
//            node = node.parentElement;
//        }
//        // fallback: try to find global ajax modal container
//        const globalAjax = document.getElementById('ajasmodal') || document.getElementById('ajaxModal') || document.getElementById('modalContentAjax');
//        return globalAjax || null;
//    }

//    // smooth hide of a modal element (fade + scale)
//    function closeModalSmooth(root) {
//        try {
//            if (!root) return;
//            // if root is the inner content (not overlay), try to find overlay wrapper
//            // we will apply transform + opacity transitions
//            root.style.transition = 'opacity 220ms ease, transform 220ms ease';
//            root.style.transformOrigin = 'top center';
//            root.style.opacity = '0';
//            root.style.transform = 'translateY(8px) scale(0.995)';
//            // if overlay exists as parent with backdrop, hide it after transition
//            setTimeout(() => {
//                // try to hide root or its parent overlay
//                root.classList.add('hidden');
//                // if global ajax modal container exists, also clear content to avoid duplicates
//                const global = document.getElementById('modalContentAjax') || document.getElementById('ajasmodal');
//                try {
//                    if (global && global.contains(root) && global !== root) {
//                        // if global has inner content region, clear it
//                        if (global.querySelector) {
//                            const inner = global.querySelector('#modalContentAjax') || global.querySelector('.modal-content') || null;
//                            if (inner) inner.innerHTML = '';
//                        }
//                    }
//                } catch (e) { /* ignore */ }
//            }, 240);
//        } catch (e) { /* ignore */ }
//    }

//    // Try to close the main ajax modal container if exists
//    function closeGlobalAjaxModal() {
//        const backdrop = document.getElementById('modalBackdropAjax') || document.getElementById('studentModalBackdrop') || null;
//        const ajaxModal = document.getElementById('ajasmodal') || document.getElementById('ajaxModal') || null;
//        if (ajaxModal && !ajaxModal.classList.contains('hidden')) {
//            // animate
//            ajaxModal.style.transition = 'opacity 220ms ease, transform 220ms ease';
//            ajaxModal.style.opacity = '0';
//            ajaxModal.style.transform = 'translateY(8px) scale(0.995)';
//            if (backdrop) backdrop.style.opacity = '0';
//            setTimeout(() => {
//                try {
//                    ajaxModal.classList.add('hidden');
//                    if (backdrop) backdrop.classList.add('hidden');
//                    const content = document.getElementById('modalContentAjax');
//                    if (content) content.innerHTML = '';
//                } catch (e) { /* ignore */ }
//            }, 260);
//            return true;
//        }
//        return false;
//    }

//    // loader helpers (prefer existing #students-loader)
//    function showLoaderImmediate() {
//        const loader = document.getElementById('students-loader');
//        if (loader) {
//            loader.classList.remove('hidden');
//            loader.style.opacity = '1';
//            return;
//        }
//        // fallback: create small overlay
//        let f = document.getElementById('students-delete-inline-loader');
//        if (!f) {
//            f = document.createElement('div');
//            f.id = 'students-delete-inline-loader';
//            f.className = 'fixed inset-0 z-50 flex items-center justify-center';
//            f.style.background = 'rgba(255,255,255,0.6)';
//            f.innerHTML = '<div class="p-3 rounded bg-white shadow">در حال ارسال...</div>';
//            document.body.appendChild(f);
//        }
//        f.style.display = 'flex';
//    }

//    function hideLoaderImmediate() {
//        const loader = document.getElementById('students-loader');
//        if (loader) {
//            loader.style.opacity = '0';
//            // keep hidden by small delay if css transitions exist
//            setTimeout(() => loader.classList.add('hidden'), 240);
//            return;
//        }
//        const f = document.getElementById('students-delete-inline-loader');
//        if (f) f.style.display = 'none';
//    }

//    // show field error
//    function showReasonError(form, msg) {
//        try {
//            const err = form.querySelector('#inactiveReasonError') || form.querySelector('.inactive-reason-error');
//            if (err) {
//                err.textContent = msg || 'لطفاً دلیل غیرفعال‌سازی را وارد کنید.';
//                err.classList.remove('hidden');
//            } else {
//                alert(msg || 'لطفاً دلیل غیرفعال‌سازی را وارد کنید.');
//            }
//        } catch (e) { /* ignore */ }
//    }

//    function hideReasonError(form) {
//        try {
//            const err = form.querySelector('#inactiveReasonError') || form.querySelector('.inactive-reason-error');
//            if (err) {
//                err.textContent = '';
//                err.classList.add('hidden');
//            }
//        } catch (e) { /* ignore */ }
//    }

//    // Delegated submit handling for the delete form
//    document.addEventListener('submit', function (ev) {
//        try {
//            const form = ev.target;
//            if (!form || form.id !== 'student-delete-form') return;
//            // perform client-side validation and UX, but keep POST default behavior
//            // we only prevent default if validation fails
//            const reasonEl = form.querySelector('textarea[name="InactiveReason"], #deleteInactiveReason');
//            const submitBtn = form.querySelector('button[type="submit"], #student-delete-confirm-btn');
//            const val = reasonEl ? (reasonEl.value || '').trim() : '';
//            if (!val) {
//                ev.preventDefault();
//                showReasonError(form, 'لطفاً دلیل غیرفعال‌سازی را وارد کنید.');
//                if (reasonEl) reasonEl.focus();
//                return;
//            }

//            // valid -> proceed: disable submit, show loader, allow normal POST
//            try {
//                if (submitBtn) {
//                    submitBtn.disabled = true;
//                    submitBtn.classList.add('opacity-60', 'cursor-not-allowed');
//                }
//                showLoaderImmediate();
//                // Let the browser submit the form (no preventDefault)
//                // In case of single-page submission (AJAX elsewhere) the form will still behave normally.
//            } catch (e) {
//                // if anything goes wrong, don't block submission
//            }
//        } catch (e) {
//            console.error('student-delete submit handler error', e);
//        }
//    }, true /* useCapture to intercept before other handlers if any */);

//    // hide error on input
//    document.addEventListener('input', function (ev) {
//        try {
//            const t = ev.target;
//            if (!t) return;
//            if (t.matches && (t.matches('#deleteInactiveReason') || t.matches('textarea[name="InactiveReason"]') || t.closest && t.closest('#student-delete-form'))) {
//                const form = t.closest('#student-delete-form');
//                if (form) hideReasonError(form);
//            }
//        } catch (e) { /* ignore */ }
//    }, true);

//    // Delegated click handler for cancel button(s) inside delete modal
//    document.addEventListener('click', function (ev) {
//        try {
//            const btn = ev.target.closest && ev.target.closest('[data-modal-close], button[data-action="cancel"], .student-delete-modal [data-modal-close]');
//            if (!btn) return;
//            // ensure this cancel belongs to our delete form/modal
//            const form = btn.closest && btn.closest('#student-delete-form');
//            // Prevent default navigation
//            ev.preventDefault();

//            // prefer to close local modal smoothly
//            let root = null;
//            if (form) root = findModalRoot(form);
//            if (!root) {
//                // if no form context, try to find any nearest modal element
//                root = findModalRoot(btn);
//            }

//            if (root && root.classList) {
//                closeModalSmooth(root);
//            } else {
//                // try global ajax modal close
//                const closed = closeGlobalAjaxModal();
//                if (!closed) {
//                    // fallback: remove inner content if it looks like ajax modal
//                    const content = document.getElementById('modalContentAjax') || document.getElementById('modalContent');
//                    if (content) content.innerHTML = '';
//                }
//            }

//        } catch (e) { console.error('delete-cancel handler error', e); }
//    }, true);

//    // In case form submission was prevented by other code and we need to re-enable the submit button,
//    // provide a small helper to re-enable buttons (can be called from outside)
//    window.StudentsDelete = window.StudentsDelete || {};
//    window.StudentsDelete.reenableSubmit = function (formSelector = '#student-delete-form') {
//        try {
//            const f = document.querySelector(formSelector);
//            if (!f) return;
//            const btn = f.querySelector('button[type="submit"], #student-delete-confirm-btn');
//            if (btn) {
//                btn.disabled = false;
//                btn.classList.remove('opacity-60', 'cursor-not-allowed');
//            }
//            hideLoaderImmediate();
//        } catch (e) { /* ignore */ }
//    };

//    // Optional: If the server returns JSON errors via AJAX (rare), handle them gracefully:
//    // We don't attach AJAX submit here (by design) — but expose a helper that other scripts can call.
//    window.StudentsDelete.handleServerResponse = function (resJson, formSelector = '#student-delete-form') {
//        try {
//            const f = document.querySelector(formSelector);
//            if (!f) return;
//            if (!resJson) return;
//            if (resJson.success) {
//                // success: close modal
//                const root = findModalRoot(f) || document.getElementById('modalContentAjax');
//                if (root) closeModalSmooth(root);
//                hideLoaderImmediate();
//                // notify if provided (use global notify if exists)
//                if (typeof window.StudentsNotify === 'function') window.StudentsNotify(resJson.message || 'انجام شد', 'success');
//                else if (typeof window.showNotify === 'function') window.showNotify(resJson.message || 'انجام شد', 'success');
//            } else {
//                // show message
//                const err = resJson.message || resJson.error || 'خطایی رخ داد.';
//                showReasonError(f, err);
//                window.StudentsDelete.reenableSubmit(formSelector);
//            }
//        } catch (e) { console.error('handleServerResponse error', e); }
//    };

//})();
