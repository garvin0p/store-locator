/**
 * Store Locator — detail gallery and share interactions.
 * Vanilla JS so it does not alter the existing Owl locator component.
 */
(function () {
    'use strict';

    function initGallery(root) {
        const main = root.querySelector('.sl-detail-gallery-main-image');
        const stage = root.querySelector('.sl-detail-gallery-stage');
        const thumbs = Array.from(root.querySelectorAll('.sl-detail-gallery-thumb:not(.sl-detail-gallery-more)'));
        const counter = root.querySelector('.sl-detail-gallery-counter');
        const prev = root.querySelector('[data-gallery-prev]');
        const next = root.querySelector('[data-gallery-next]');
        const more = root.querySelector('.sl-detail-gallery-more');
        const lightbox = root.querySelector('.sl-gallery-lightbox');
        const lightboxImage = root.querySelector('.sl-gallery-lightbox-image');
        const lightboxClose = root.querySelector('[data-gallery-lightbox-close]');

        if (!main || !thumbs.length) {
            return;
        }

        let index = Math.max(0, thumbs.findIndex((thumb) => thumb.classList.contains('is-active')));
        if (index < 0) index = 0;

        const getUrl = (i) => thumbs[i] ? thumbs[i].getAttribute('data-image-url') : null;
        const getCaption = (i) => thumbs[i] ? (thumbs[i].getAttribute('data-image-caption') || '') : '';

        const render = (nextIndex) => {
            const total = thumbs.length;
            index = (nextIndex + total) % total;
            const url = getUrl(index);
            if (!url) return;

            main.src = url;
            main.alt = getCaption(index) || main.alt || 'Store photo';
            if (counter) counter.textContent = (index + 1) + ' / ' + total;

            thumbs.forEach((thumb, i) => {
                thumb.classList.toggle('is-active', i === index);
                thumb.setAttribute('aria-current', i === index ? 'true' : 'false');
            });
        };

        thumbs.forEach((thumb, i) => {
            thumb.addEventListener('click', () => render(i));
        });

        if (prev) prev.addEventListener('click', () => render(index - 1));
        if (next) next.addEventListener('click', () => render(index + 1));

        if (more) {
            more.addEventListener('click', () => {
                const target = parseInt(more.getAttribute('data-gallery-more-index') || '0', 10);
                render(Number.isNaN(target) ? 0 : target);
            });
        }

        const openLightbox = () => {
            if (!lightbox || !lightboxImage) return;
            lightboxImage.src = main.src;
            lightboxImage.alt = main.alt;
            lightbox.classList.add('is-open');
            lightbox.setAttribute('aria-hidden', 'false');
            document.body.classList.add('sl-lightbox-open');
        };
        const closeLightbox = () => {
            if (!lightbox) return;
            lightbox.classList.remove('is-open');
            lightbox.setAttribute('aria-hidden', 'true');
            document.body.classList.remove('sl-lightbox-open');
        };

        if (stage) stage.addEventListener('click', (event) => {
            if (event.target.closest('.sl-detail-gallery-control')) return;
            openLightbox();
        });
        if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);
        if (lightbox) lightbox.addEventListener('click', (event) => {
            if (event.target === lightbox) closeLightbox();
        });
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') closeLightbox();
            if (event.key === 'ArrowLeft') {
                if (lightbox && lightbox.classList.contains('is-open')) render(index - 1);
            }
            if (event.key === 'ArrowRight') {
                if (lightbox && lightbox.classList.contains('is-open')) render(index + 1);
            }
        });

        render(index);
    }

    function initShareButtons() {
        document.querySelectorAll('.sl-share-store').forEach((button) => {
            if (button.dataset.slShareBound === '1') return;
            button.dataset.slShareBound = '1';

            button.addEventListener('click', async () => {
                const relativeUrl = button.getAttribute('data-share-url') || window.location.pathname;
                const shareUrl = new URL(relativeUrl, window.location.origin).href;
                const title = button.getAttribute('data-share-title') || document.title;

                try {
                    if (navigator.share) {
                        await navigator.share({title, url: shareUrl});
                        return;
                    }
                    await navigator.clipboard.writeText(shareUrl);
                    const original = button.innerHTML;
                    button.innerHTML = '<i class="fa fa-check"></i> Link Copied';
                    window.setTimeout(() => { button.innerHTML = original; }, 1800);
                } catch (error) {
                    // User cancelled native share or clipboard is not available.
                }
            });
        });
    }

    function boot() {
        document.querySelectorAll('.sl-detail-gallery').forEach(initGallery);
        initShareButtons();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
