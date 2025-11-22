// wwwroot/js/loader.js
// Global Loader: fade + scale + shadow + min display time
// Usage: Loader.show("متن"); Loader.hide();
(function () {
    'use strict';

    // Configurable defaults
    const DEFAULTS = {
        MIN_DISPLAY_MS: 2500,       // حداقل زمان نمایش (میلی‌ثانیه)
        TRANSITION_MS: 420,        // مدت transition fade + scale (میلی‌ثانیه)
        BACKDROP_COLOR: 'rgba(100,116,139,0.55)', // رنگ پس‌زمینه overlay
        BOX_BG: 'rgba(248,250,252)',   // رنگ background جعبه‌ی داخلی
        BOX_SHADOW: '#2563eb', // سایه جعبه (قابل تغییر)
        SPINNER_COLOR: '#14b8a6'   // رنگ اسپینر (تیل Tailwind-like)
    };

    let loaderEl = null;
    let boxEl = null;
    let textMainEl = null;
    let textSubEl = null;
    let lastShownAt = 0;
    let visible = false;

    // Helper: create DOM once (singleton)
    function createLoaderIfNeeded() {
        if (loaderEl) return loaderEl;

        // overlay
        loaderEl = document.createElement('div');
        loaderEl.id = 'global-loader';
        loaderEl.style.position = 'fixed';
        loaderEl.style.top = '0';
        loaderEl.style.left = '0';
        loaderEl.style.right = '0';
        loaderEl.style.bottom = '0';
        loaderEl.style.display = 'flex';
        loaderEl.style.alignItems = 'center';
        loaderEl.style.justifyContent = 'center';
        loaderEl.style.background = DEFAULTS.BACKDROP_COLOR;
        loaderEl.style.backdropFilter = 'blur(6px)';
        loaderEl.style.webkitBackdropFilter = 'blur(6px)';
        loaderEl.style.zIndex = '99999';
        loaderEl.style.opacity = '0';
        loaderEl.style.pointerEvents = 'none';
        loaderEl.style.transition = `opacity ${DEFAULTS.TRANSITION_MS}ms cubic-bezier(.2,.9,.2,1)`;

        // box (card)
        boxEl = document.createElement('div');
        boxEl.style.padding = '14px 18px';
        boxEl.style.borderRadius = '12px';
        boxEl.style.background = DEFAULTS.BOX_BG;
        boxEl.style.boxShadow = DEFAULTS.BOX_SHADOW;
        boxEl.style.display = 'flex';
        boxEl.style.alignItems = 'center';
        boxEl.style.gap = '12px';
        boxEl.style.transform = 'scale(0.96)';
        boxEl.style.transition = `transform ${DEFAULTS.TRANSITION_MS}ms cubic-bezier(.2,.9,.2,1), opacity ${DEFAULTS.TRANSITION_MS}ms cubic-bezier(.2,.9,.2,1)`;
        boxEl.style.opacity = '0';

        // spinner (SVG)
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '28');
        svg.setAttribute('height', '28');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.style.flex = '0 0 auto';
        svg.style.display = 'block';

        svg.innerHTML = `
            <circle cx="12" cy="12" r="10" stroke="${DEFAULTS.SPINNER_COLOR}" stroke-width="3" fill="none" opacity="0.18"></circle>
            <path fill="${DEFAULTS.SPINNER_COLOR}" d="M4 12a8 8 0 018-8v8z" opacity="0.9">
                <animateTransform attributeName="transform" attributeType="XML" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite"/>
            </path>
        `;

        // texts
        const texts = document.createElement('div');
        texts.style.display = 'flex';
        texts.style.flexDirection = 'column';
        texts.style.gap = '3px';
        texts.style.minWidth = '160px';

        textMainEl = document.createElement('div');
        textMainEl.textContent = 'اطلاعات در حال بارگذاری';
        textMainEl.style.fontSize = '0.95rem';
        textMainEl.style.fontWeight = '900';
        textMainEl.style.color = '#0f172a'; // slate-900

        textSubEl = document.createElement('div');
        textSubEl.textContent = 'لطفاً منتظر بمانید...';
        textSubEl.style.fontSize = '0.78rem';
        textSubEl.style.color = '#475569'; // slate-600

        texts.appendChild(textMainEl);
        texts.appendChild(textSubEl);

        boxEl.appendChild(svg);
        boxEl.appendChild(texts);

        loaderEl.appendChild(boxEl);
        document.body.appendChild(loaderEl);

        return loaderEl;
    }

    // Show loader (message optional, options optional)
    // options: { minDisplayMs, transitionMs, spinnerColor, backdropColor }
    function show(message, options) {
        createLoaderIfNeeded();

        if (options && typeof options.minDisplayMs === 'number') {
            // override temporal min display for this show only
            Loader.config.MIN_DISPLAY_MS = options.minDisplayMs;
        }

        if (options && typeof options.transitionMs === 'number') {
            loaderEl.style.transition = `opacity ${options.transitionMs}ms cubic-bezier(.2,.9,.2,1)`;
            boxEl.style.transition = `transform ${options.transitionMs}ms cubic-bezier(.2,.9,.2,1), opacity ${options.transitionMs}ms cubic-bezier(.2,.9,.2,1)`;
        }

        if (options && options.spinnerColor) {
            // change spinner color by updating path and circle stroke
            const circle = loaderEl.querySelector('circle');
            const path = loaderEl.querySelector('path');
            if (circle) circle.setAttribute('stroke', options.spinnerColor);
            if (path) path.setAttribute('fill', options.spinnerColor);
        }

        if (options && options.backdropColor) {
            loaderEl.style.background = options.backdropColor;
        }

        if (message) {
            textMainEl.textContent = message;
        }

        // show overlay
        requestAnimationFrame(() => {
            loaderEl.style.pointerEvents = 'all';
            loaderEl.classList.remove('hidden');
            // start from invisible small state
            loaderEl.style.opacity = '0';
            boxEl.style.transform = 'scale(0.96)';
            boxEl.style.opacity = '0';
            // force reflow then animate to visible
            void loaderEl.offsetWidth;
            loaderEl.style.opacity = '1';
            boxEl.style.transform = 'scale(1)';
            boxEl.style.opacity = '1';
        });

        lastShownAt = Date.now();
        visible = true;
    }

    // Hide loader (respect MIN_DISPLAY_MS)
    // force parameter to bypass min display
    function hide(force) {
        if (!loaderEl || !visible) return;

        const now = Date.now();
        const minMs = (Loader && Loader.config && typeof Loader.config.MIN_DISPLAY_MS === 'number') ? Loader.config.MIN_DISPLAY_MS : DEFAULTS.MIN_DISPLAY_MS;
        const elapsed = now - lastShownAt;
        const wait = force ? 0 : Math.max(0, minMs - elapsed);

        setTimeout(() => {
            // start hide animation
            loaderEl.style.opacity = '0';
            boxEl.style.transform = 'scale(0.96)';
            boxEl.style.opacity = '0';

            // after transition, remove pointer events
            const tms = (Loader && Loader.config && typeof Loader.config.TRANSITION_MS === 'number') ? Loader.config.TRANSITION_MS : DEFAULTS.TRANSITION_MS;
            // ensure we cleanup after transition end (fallback timeout too)
            const cleanup = function () {
                if (!loaderEl) return;
                loaderEl.style.pointerEvents = 'none';
                visible = false;
            };

            // use transitionend if available, otherwise fallback
            let done = false;
            const onEnd = function () {
                if (done) return;
                done = true;
                cleanup();
                boxEl.removeEventListener('transitionend', onEnd);
            };
            boxEl.addEventListener('transitionend', onEnd);
            setTimeout(() => { if (!done) onEnd(); }, tms + 40);
        }, wait);
    }

    // Expose Loader
    window.Loader = window.Loader || {
        show,
        hide,
        // allow runtime config change if needed
        config: {
            MIN_DISPLAY_MS: DEFAULTS.MIN_DISPLAY_MS,
            TRANSITION_MS: DEFAULTS.TRANSITION_MS
        }
    };
})();
