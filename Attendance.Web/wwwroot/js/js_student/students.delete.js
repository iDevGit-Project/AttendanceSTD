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

