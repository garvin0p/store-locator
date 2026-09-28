/**
 * Store Locator — store detail page enhancements (design 19.0.1.1.0).
 *
 * Two progressive enhancements for the server-rendered detail page:
 *  1. Photo gallery lightbox — every [data-sl-lightbox] tile inside
 *     [data-sl-gallery] opens a fullscreen viewer with prev/next arrows,
 *     a counter, keyboard support (Esc / ← / →) and backdrop close.
 *  2. Opening hours "today" highlight — rows carrying data-day="<Weekday>"
 *     matching the visitor's current weekday get the .is-today class.
 *
 * Loaded through web.assets_frontend; plain ES module, no Owl needed.
 */

(function () {
    'use strict';

    // ------------------------------------------------------------------
    // Lightbox
    // ------------------------------------------------------------------
    const WEEKDAYS = [
        'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
    ];

    function buildLightbox() {
        const overlay = document.createElement('div');
        overlay.className = 'sl-lightbox';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-label', 'Photo gallery');
        overlay.innerHTML =
            '<img class="sl-lightbox-img" alt=""/>' +
            '<button type="button" class="sl-lightbox-btn sl-lightbox-prev" aria-label="Previous photo">' +
                '<span class="fa fa-chevron-left" aria-hidden="true"></span></button>' +
            '<button type="button" class="sl-lightbox-btn sl-lightbox-next" aria-label="Next photo">' +
                '<span class="fa fa-chevron-right" aria-hidden="true"></span></button>' +
            '<button type="button" class="sl-lightbox-btn sl-lightbox-close" aria-label="Close gallery">' +
                '<span class="fa fa-times" aria-hidden="true"></span></button>' +
            '<span class="sl-lightbox-counter" aria-live="polite"></span>';
        document.body.appendChild(overlay);
        return overlay;
    }

    function initGalleryLightbox() {
        const gallery = document.querySelector('[data-sl-gallery]');
        if (!gallery) {
            return;
        }
        const tiles = Array.prototype.slice.call(gallery.querySelectorAll('[data-sl-lightbox]'));
        if (!tiles.length) {
            return;
        }

        const overlay = buildLightbox();
        const imgEl = overlay.querySelector('.sl-lightbox-img');
        const counterEl = overlay.querySelector('.sl-lightbox-counter');
        let current = 0;
        let lastFocus = null;

        function show(index) {
            current = (index + tiles.length) % tiles.length;
            const tileImg = tiles[current].querySelector('img');
            if (!tileImg) {
                return;
            }
            imgEl.src = tileImg.dataset.full || tileImg.currentSrc || tileImg.src;
            imgEl.alt = tileImg.alt || '';
            counterEl.textContent = (current + 1) + ' / ' + tiles.length;
        }

        function open(index) {
            lastFocus = document.activeElement;
            show(index);
            overlay.classList.add('sl-lightbox-open');
            document.body.style.overflow = 'hidden';
            overlay.querySelector('.sl-lightbox-close').focus();
        }

        function close() {
            overlay.classList.remove('sl-lightbox-open');
            document.body.style.overflow = '';
            if (lastFocus && lastFocus.focus) {
                lastFocus.focus();
            }
        }

        tiles.forEach((tile, index) => {
            tile.addEventListener('click', () => open(index));
        });

        overlay.addEventListener('click', (ev) => {
            if (ev.target === overlay) {
                close();
            }
        });
        overlay.querySelector('.sl-lightbox-close').addEventListener('click', close);
        overlay.querySelector('.sl-lightbox-prev').addEventListener('click', () => show(current - 1));
        overlay.querySelector('.sl-lightbox-next').addEventListener('click', () => show(current + 1));

        document.addEventListener('keydown', (ev) => {
            if (!overlay.classList.contains('sl-lightbox-open')) {
                return;
            }
            if (ev.key === 'Escape') {
                close();
            } else if (ev.key === 'ArrowLeft') {
                show(current - 1);
            } else if (ev.key === 'ArrowRight') {
                show(current + 1);
            }
        });
    }

    // ------------------------------------------------------------------
    // "Today" highlight in the opening hours table
    // ------------------------------------------------------------------
    function highlightToday() {
        const today = WEEKDAYS[new Date().getDay()];
        document.querySelectorAll('.sl-hours-row[data-day]').forEach((row) => {
            if (row.getAttribute('data-day') === today) {
                row.classList.add('is-today');
            }
        });
    }

    // ------------------------------------------------------------------
    // Boot (works whether the bundle runs before or after DOM ready)
    // ------------------------------------------------------------------
    function boot() {
        highlightToday();
        if (!document.body.classList.contains('editor_enable')) {
            initGalleryLightbox();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
