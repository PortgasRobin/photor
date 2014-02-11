(function() {

    // Server side
    if (!window) {
        return;
    }

    var prefixes = {
            'transform': 'transform',
            'OTransform': '-o-transform',
            'msTransform': '-ms-transform',
            'MozTransform': '-moz-transform',
            'WebkitTransform': '-webkit-transform'
        },
        data = [],
        evt = getSupportedEvents(),
        handlers = [],
        params;


    /*
     * Returns supported property for css-transform
     *
     * @return {String} string key
     */
    function getSupportedTransform() {
        for (var key in prefixes) {
            if (document.createElement('div').style[key] !== undefined) {
                return key;
            }
        }

        return false;
    }

    /*
     * Кроссбраузерно добавляет обработчики событий
     *
     * @param {HTMLElement} element HTMLElement
     * @param {event} e Событие
     * @param {function} handler Обработчик события
     * @param {bool} capture Capturing
     */
    function eventManager(element, e, handler, capture, off) {
        capture = !!capture;

        if (off) {

            if (element.removeEventListener) {
                element.removeEventListener(e, handler, capture);
            } else {
                if (element.detachEvent) {
                    element.detachEvent('on' + e, handler);
                } else {
                    element[e] = undefined;
                }
            }

        } else {

            if (element.addEventListener) {
                element.addEventListener(e, handler, capture);
            } else {
                if (element.attachEvent) {
                    element.attachEvent('on' + e, handler);
                } else {
                    element[e] = handler;
                }
            }

        }
    }


    /*
     * Проверяет наличие класса у нативного HTML-элемент
     *
     * @param {HTMLElement} element HTMLElement
     * @param {string} className Имя класса
     */
    function hasClass(element, className) {
        var classNames = ' ' + element.className + ' ';

        className = ' ' + className + ' ';

        if (classNames.replace(/[\n\t]/g, ' ').indexOf(className) > -1) {
            return true;
        }

        return false;
    }

    /*
     * Возвращает массив поддерживаемых событий
     * Если браузер поддерживает pointer events или подключена handjs, вернет события указателя.
     * Если нет, используем события мыши
     *
     * @return {Array} Массив с названиями событий
     */
    function getSupportedEvents() {
        var touchEnabled = !!('ontouchstart' in window);

        if (touchEnabled) {
            return ['touchstart', 'touchmove', 'touchend', 'touchcancel'];
        }

        return ['mousedown', 'mousemove', 'mouseup', 'mouseleave'];
    }

    function debounce(fn, timeout, invokeAsap, ctx) {
        if (arguments.length == 3 && typeof invokeAsap != 'boolean') {
            ctx = invokeAsap;
            invokeAsap = false;
        }

        var timer;

        return function() {
            var args = arguments;

            ctx = ctx || this;
            if (invokeAsap && !timer) {
                fn.apply(ctx, args);
            }

            clearTimeout(timer);

            timer = setTimeout(function() {
                if (!invokeAsap) {
                    fn.apply(ctx, args);
                }
                timer = null;
            }, timeout);
        };
    }

    /*
     * Throttle декоратор
     *
     * @param {function} fn Функция
     * @param {number} timeout Таймаут в миллисекундах
     * @param {object} ctx Контекст вызова
     */
    function throttle(fn, timeout, ctx) {
        var timer, args, needInvoke;

        return function() {
            args = arguments;
            needInvoke = true;
            ctx = ctx || this;

            if (!timer) {
                (function() {
                    if (needInvoke) {
                        fn.apply(ctx, args);
                        needInvoke = false;
                        timer = setTimeout(arguments.callee, timeout);
                    } else {
                        timer = null;
                    }
                })();
            }
        };
    }

    /*
     * Устанавливает обработчики управления указателем (touch, mouse, pen)
     *
     * @param {string|number} galleryId Id галереи (ключ для массива с объектами инстансов галереи)
     */
    function bindControl(galleryId) {
        var p = data[galleryId],
            control = p.control,
            thumbs = p.thumbs,
            touch = {};

        /*
         * Обработчик touch start
         *
         * @param {event} e Событие pointerdown
         */
        handlers.onStart = function(e) {
            // запоминаем координаты и время
            touch.x1 = e.clientX || e.touches && e.touches[0].clientX;
            touch.y1 = e.clientY || e.touches && e.touches[0].clientY;
            touch.t1 = new Date();
            touch.isPressed = true;

            // Запоминаем элемент, на котором вызвано событие
            touch.isThumbs = hasClass(this, params.thumbs);
            touch.thumbsStartX = p.thumbsIndent;

            p.root.addClass(params.mod.dragging);

            control.css('transition-duration', '0s');
            thumbs.css('transition-duration', '0s');
        };

        /*
         * Обработчик touch move
         *
         * @param {event} e Событие pointermove
         */
        handlers.onMove = function(e) {
            if (touch.isPressed) {
                // смещения
                touch.shiftX = (e.clientX || e.touches && e.touches[0].clientX) - touch.x1;
                touch.shiftY = (e.clientY || e.touches && e.touches[0].clientY) - touch.y1;

                // абсолютные значения смещений
                touch.shiftXAbs = Math.abs(touch.shiftX);
                touch.shiftYAbs = Math.abs(touch.shiftY);

                // Detect multitouch
                touch.isMultitouch = touch.isMultitouch || (e.touches && e.touches.length) > 1;

                if (touch.isMultitouch) {
                    end();

                    return;
                }

                // если мы ещё не определились
                if (!touch.isSlide && !touch.isScroll) {
                    // если вертикальное смещение - скроллим пока не отпустили палец
                    if (touch.shiftYAbs >= 5 && touch.shiftYAbs > touch.shiftXAbs) {
                        touch.isScroll = true;
                    }

                    // если горизонтальное - слайдим
                    if (touch.shiftXAbs >= 5 && touch.shiftXAbs > touch.shiftYAbs) {
                        touch.isSlide = true;
                    }
                }

                // если слайдим
                if (touch.isSlide) {
                    // запрещаем скролл
                    e.preventDefault();

                    if (touch.isThumbs) {
                        if (p.thumbsDragging) {
                            thumbsMove();
                        }
                    } else {
                        slidesMove();
                    }
                }
            }
        };

        /*
         * Обработчик touch end
         *
         * @param {event} e Событие pointerup
         */
        handlers.onEnd = function(e) {
            // Ловим клик
            if (!touch.isSlide && !touch.isScroll && touch.isPressed) {

                // Назад
                if (hasClass(e.target, params.prev)) {
                    methods.prev(galleryId);
                }

                // Вперед
                if (hasClass(e.target, params.next)) {
                    methods.next(galleryId);
                }

                // Клик по миниатюре
                if (hasClass(e.target, params.thumbImg)) {
                    methods.go(galleryId, parseInt(e.target.getAttribute('data-rel')));
                }

                e.stopPropagation();
                e.preventDefault(); // Нужно для отмены зума по doubletap
            }

            end();
        };

        /*
         * Завершение перемещения
         */
        function end() {
            if (touch.isSlide) {
                if (touch.isThumbs) {
                    thumbsEnd();
                } else {
                    slidesEnd();
                }
            }

            touch = {};
        }

        /*
         * Движение слайдов во время перетаскивания
         */
        function slidesMove() {
            if ((p.current == 0 && touch.shiftX > 0) || (p.current == p.count && touch.shiftX < 0)) {
                touch.shiftX = touch.shiftX / 3;
            }

            p.layer.css(methods.setIndent(100 * (touch.shiftX / p.controlWidth - p.current)));
        }

        /*
         * Завершение движения слайдов
         */
        function slidesEnd() {
            // Transition executes if delta more then 5% of container width
            if (Math.abs(touch.shiftX) > p.controlWidth * 0.05) {
                if (touch.shiftX < 0) {
                    methods.next(galleryId);
                } else {
                    methods.prev(galleryId);
                }
            } else {
                methods.go(galleryId, p.current);
            }
        }

        /*
         * Движение миниатюр при перетаскивании
         */
        function thumbsMove() {
            p.thumbsIndent = touch.shiftX + touch.thumbsStartX;
            p.thumbsLayer.css(methods.setIndent(p.thumbsIndent, 'px'));
        }

        /*
         * Завершение движения миниатюр
         */
        function thumbsEnd() {
            if (p.thumbsDragging && touch.isSlide) {
                var direction = touch.shiftX < 0 ? -1 : 1;

                touch.t2 = new Date();
                p.thumbsIndent = calcTailAnimation(p.thumbsIndent, direction);

                p.thumbsLayer
                    .css('transition-duration', '.24s')
                    .css(methods.setIndent(p.thumbsIndent, 'px'));
            }
        }

        /*
         * Вычисление конечной координаты слоя с миниатюрами с учетом движения по инерции
         *
         * @param {number} currentIndent Текущее положение слоя с миниатюрами в пикселях
         * @param {number} direction Направление движения (-1|1)
         * @returns {number} Значение координаты слоя с миниатюрами в пикселях
         */
        function calcTailAnimation(currentIndent, direction) {
            var speed = Math.abs(10 * touch.shiftX / (touch.t2 - touch.t1)),
                tail, limit;

            tail = direction * parseInt(Math.pow(speed, 2)) + currentIndent;
            limit = p.thumbs.outerWidth() - p.thumbsLayer.outerWidth();

            if (tail > 0) {
                return 0;
            }

            if (tail < limit) {
                return limit;
            }

            return tail;
        }

        // Touch-события
        p.events.push({
            element: control[0],
            event: evt[0],
            handler: handlers.onStart
        }, {
            element: control[0],
            event: evt[1],
            handler: handlers.onMove,
            capture: true
        }, {
            element: control[0],
            event: evt[2],
            handler: handlers.onEnd
        }, {
            element: control[0],
            event: evt[3],
            handler: handlers.onEnd
        }, {
            element: thumbs[0],
            event: evt[0],
            handler: handlers.onStart
        }, {
            element: thumbs[0],
            event: evt[1],
            handler: handlers.onMove,
            capture: true
        }, {
            element: thumbs[0],
            event: evt[2],
            handler: handlers.onEnd
        }, {
            element: thumbs[0],
            event: evt[3],
            handler: handlers.onEnd
        });

        // Отмена перехода по ссылке миниатюры
        for (var i = 0; i < p.thumb.length; i++) {
            p.events.push({
                element: p.thumb[i],
                event: 'click',
                handler: function() {
                    e.preventDefault();
                }
            });
        }

        // Отмена встроенного перетаскивания для картинок
        for (var j = 0; j < p.thumbImg.length; j++) {
            p.events.push({
                element: p.thumbImg[j],
                event: 'dragstart',
                handler: function() {
                    e.preventDefault();
                }
            });
        }
    }

    /*
     * Устанавливает обработчик изменения размера окна
     *
     * @param {string|number} galleryId Id галереи (ключ для массива с объектами инстансов галереи)
     */
    function bindResize(galleryId) {
        var p = data[galleryId];

        // eventManager(window, true, 'resize', handlers.resize);

        /*
         * Resize handler
         */
        function resize() {
            p.viewportWidth = p.viewport.outerWidth();
            p.viewportHeight = p.viewport.outerHeight();
            p.controlWidth = p.control.outerWidth();
            p.controlHeight = p.control.outerHeight();
            p.thumbsWidth = p.thumbs.outerWidth();
            p.thumbsHeight = p.thumbs.outerHeight();

            p.slide.each(function(i) {
                methods.position(galleryId, i);
            });

            methods.setCurrentThumb(galleryId, p.current, 1);
        }

        handlers.resize = debounce(resize, 84);
        p.events.push({
            element: window,
            event: 'resize',
            handler: handlers.resize
        });
    }

    /*
     * Устанавливает обработчики управления с клавиатуры
     *
     * @param {string|number} galleryId Id галереи (ключ для массива с объектами инстансов галереи)
     */
    function bindKeyboard(galleryId) {
        var p = data[galleryId];

        handlers.keydown = function(e) {
            var key = e.which || e.keyCode;

            switch(key) {
                // Space
                case 32:
                    methods.next(galleryId);
                    break;

                // Left
                case 37:
                    methods.prev(galleryId);
                    break;

                // Right
                case 39:
                    methods.next(galleryId);
                    break;
            }
        };

        // eventManager(window, true, 'keydown', handlers.keydown, false);
        p.events.push({
            element: window,
            event: 'keydown',
            handler: handlers.keydown
        });
    }

    function bindTransitionEnd(galleryId) {
        var p = data[galleryId];

        handlers.transitionEnd = function(e) {
            p.layer.css('transition-duration', '0s');

            for (var i = 0; i < p.count; i++) {
                var elem = p.root.find('.' + params.slide + '.' + params.slideIdPrefix + i);

                if (i < p.current - 1 || i > p.current + 1) {
                    elem.addClass('_hidden');
                } else {
                    elem.removeClass('_hidden');
                }
            }
        };

        // eventManager(p.layer[0], 'transitionend', handlers.transitionEnd, false);
        p.events.push({
            element: window,
            event: 'transitionEnd',
            handler: handlers.transitionEnd
        });

    }

    var methods = {
        init: function(options) {
            params = $.extend({

                current: 0,
                count: 0,
                loadingRange: 2,
                slideIdPrefix: '_',
                transform: getSupportedTransform()

            }, options);

            return this.each(function(i) {
                var root = $(this),
                    galleryId = this.id || i,
                    p = {}, // Current instance of gallery
                    content = '',
                    count = 0,
                    thumbs = [];

                // Get elements
                p.root        = root;
                p.control     = root.find('.' + params.control);
                p.next        = root.find('.' + params.next);
                p.prev        = root.find('.' + params.prev);
                p.thumbs      = root.find('.' + params.thumbs);
                p.thumbsLayer = root.find('.' + params.thumbsLayer);
                p.thumb       = root.find('.' + params.thumb);
                p.thumbImg    = root.find('.' + params.thumbImg);
                p.thumbFrame  = root.find('.' + params.thumbFrame);
                p.viewport    = root.find('.' + params.viewport);
                p.layer       = root.find('.' + params.layer);

                // Images info
                p.gallery = [];
                p.thumb.each(function(j) {
                    var self = $(this),
                        thumbImg = self.find('.' + params.thumbImg)[0];

                    p.gallery.push({
                        url: this.href,
                        width: 0,
                        height: 0,
                        loaded: false,
                        alt: thumbImg.alt
                    });
                    content += methods.getTemplate(j);
                    count++;

                    $(thumbImg)
                        .attr('data-rel', j)
                        .addClass(params.slideIdPrefix + j);

                    // Thumbs init
                    thumbs[j] = thumbImg.src;
                });
                p.layer.html(content);

                p.slide = root.find('.' + params.slide);
                p.slide.each(function(i) {
                    $(this).css('left', i * 100 + '%');
                });

                // Settings
                p.current = params.current;
                p.count = count - 1;
                p.thumbsDragging = false;
                p.thumbsIndent = 0;
                p.events = [];

                p.viewportWidth = p.viewport.outerWidth();
                p.viewportHeight = p.viewport.outerHeight();
                p.controlWidth = p.control.outerWidth();
                p.controlHeight = p.control.outerHeight();
                p.thumbsWidth = p.thumbs.outerWidth();
                p.thumbsHeight = p.thumbs.outerHeight();
                p.thumbSrc = thumbs;

                data[galleryId] = p;
                root.attr('data-photor-id', galleryId);

                methods.loadThumbs(galleryId);
                methods.handlers(galleryId);
                methods.go(galleryId, p.current, 0);

            });
        },

        destroy: function(galleryId) {

            if (typeof galleryId != 'undefined') {
                // Удаляем один инстанс галереи
                unbindInstance(galleryId);
            } else {
                // Удаляем все инстансы
                for (var key in data) {
                    unbindInstance(key);
                }
            }

            /*
             * Удалить обработчики для указанного инстанса галереи
             *
             * @param {string|number} galleryId Id галереи (ключ для массива с объектами инстансов галереи)
             */
            function unbindInstance(id) {
                var p = data[id];

                for (var i = 0, len = p.events.length; i < len; i++) {
                    eventManager(p.events[i].element, p.events[i].event, p.events[i].handler, p.events[i].capture, 1);
                }
            }
        },

        handlers: function(galleryId) {
            var p = data[galleryId];

            bindControl(galleryId);
            bindResize(galleryId);
            bindTransitionEnd(galleryId);

            if (params.keyboard) {
                bindKeyboard(galleryId);
            }

            console.log(p.events);

            for (var i = 0, len = p.events.length; i < len; i++) {
                eventManager(p.events[i].element, p.events[i].event, p.events[i].handler, p.events[i].capture);
            }

        },

        go: function(galleryId, target, delay) {
            var p = data[galleryId];

            if (delay === undefined) {
                delay = params.delay;
            }

            p.layer
                .css('transition-duration', delay + 'ms')
                .css(methods.setIndent(-target * 100));

            p.current = target;

            // Mark slide as current
            methods.setCurrentThumb(galleryId, target);
            p.slide.removeClass(params.mod.current);
            p.slide
                .filter('.' + params.slideIdPrefix + target)
                .addClass(params.mod.current);

            // Load slide's range
            methods.loadSlides(galleryId, target);
            methods.checkButtons(galleryId);
        },

        next: function(galleryId) {
            var p = data[galleryId];

            if (p.current < p.count) {
                methods.go(galleryId, p.current + 1);
            } else {
                methods.go(galleryId, p.current);
            }
        },

        prev: function(galleryId) {
            var p = data[galleryId];

            if (p.current > 0) {
                methods.go(galleryId, p.current - 1);
            } else {
                methods.go(galleryId, p.current);
            }
        },

        loadSlides: function(galleryId, target) {
            var p = data[galleryId],
                range = params.loadingRange,
                from = target - 1 < 0 ? 0 : target - 1,
                to = target + 1 > p.count ? p.count : target + 1;

            for (var i = from; i <= to; i++) {
                if (!p.gallery[i].loaded) {
                    methods.loadSlide(galleryId, i);
                }
            }

            // console.log(p.gallery);
        },

        loadSlide: function(galleryId, target) {
            var p = data[galleryId],
                slide = p.root.find('.' + params.slide + '.' + params.slideIdPrefix + target),
                slideImg = slide.find('.' + params.slideImg),
                alt = p.gallery[target].alt,
                url = p.gallery[target].url,
                img = document.createElement('img');

            (function(rel) {
                var image = $(img);

                image
                    .on('load', function() {
                        p.gallery[rel].loaded = true;
                        p.gallery[rel].width = this.width;
                        p.gallery[rel].height = this.height;

                        slide.removeClass(params.mod.loading);

                        methods.position(galleryId, rel);
                    })
                    .on('error', function() {
                        $.error('Image wasn\'t loaded: ' + this.src);
                    });

                img.src = url;

                slideImg.css('background-image', 'url(' + img.src + ')');

                if (alt) {
                    slideImg
                        .addClass(params.mod.alt)
                        .attr('data-alt', alt);
                }

            })(target);
        },

        loadThumbs: function(galleryId) {
            var p = data[galleryId],
                count = p.count,
                images = p.thumbSrc,
                img = document.createElement('img'),
                loaded = 0;

            p.galleryThumbs = [];
            p.galleryThumbsLoaded = false;

            for (var i = 0; i <= count; i++) {
                (function(i) {
                    var image = $(img);

                    image
                        .on('load', function() {
                            loaded++;

                            if (loaded == count) {
                                p.galleryThumbsLoaded = true;
                                methods.getThumbsSize(galleryId);
                            }
                        })
                        .on('error', function() {
                            $.error('Image wasn\'t loaded: ' + this.src);
                        });

                    img.src = images[i];
                })(i);
            }
        },

        getThumbsSize: function(galleryId) {
            var p = data[galleryId],
                thumb = p.thumb;

            thumb.each(function(i) {
                var self = $(this);

                p.galleryThumbs[i] = {};
                p.galleryThumbs[i].width = self.outerWidth();
                p.galleryThumbs[i].height = self.outerHeight();
                p.galleryThumbs[i].top = self.position().top + parseInt(self.css('margin-top'));
                p.galleryThumbs[i].left = self.position().left + parseInt(self.css('margin-left'));
            });

            methods.setCurrentThumb(galleryId, p.current, 1);
        },

        setCurrentThumb: function(galleryId, target, noEffects) {
            var p = data[galleryId],
                frame = p.thumbFrame,
                styles = {},
                current = p.galleryThumbs[target],
                thumbsW = p.thumbs.outerWidth(),
                layerW = p.thumbsLayer.outerWidth(),
                delay = noEffects ? '0s' : '.24s',
                indent, validatedIndent;

            p.thumbsDragging = thumbsW < layerW;

            if (p.galleryThumbsLoaded) {
                styles.width = current.width + 'px';
                styles.height = current.height + 'px';

                if (params.transform) {
                    styles[prefixes[params.transform]] = 'translate3d(' + current.left + 'px, ' + current.top + 'px, 0)';
                } else {
                    styles.top = current.top + 'px';
                    styles.left = current.left + 'px';
                }

                indent = -1 * (current.left - 0.5 * (thumbsW - current.width));
                validatedIndent = validateIndent(indent);
                p.thumbsIndent = validatedIndent;

                frame
                    .css('transition-duration', delay)
                    .css(styles);

                p.thumbsLayer
                    .css('transition-duration', delay)
                    .css(methods.setIndent(validatedIndent, 'px'));

            }

            /*
             * Validates recommended indent (inscribes layer into the container correctly)
             *
             * @param {number} indent of layer in the container
             * @returns {number} correct indent
             */
            function validateIndent(indent) {
                var limit = thumbsW - layerW;

                return indent > 0 || !p.thumbsDragging ? 0 : indent < limit ? limit : indent;
            }

        },

        position: function(galleryId, target) {
            var p = data[galleryId],
                slide = p.root.find('.' + params.slide + '.' + params.slideIdPrefix + target),
                img = p.gallery[target],
                viewportRatio = p.viewportWidth / p.viewportHeight,
                imgRatio = img.width / img.height;

            // Algorithm
            if (p.viewportWidth > img.width && p.viewportHeight > img.height) {
                slide
                    .removeClass(params.mod.auto)
                    .addClass(params.mod.center);
            } else {
                slide
                    .removeClass(params.mod.center)
                    .addClass(params.mod.auto);
            }

            // Orientation
            if (imgRatio >= viewportRatio) {
                slide
                    .removeClass(params.mod.portrait)
                    .addClass(params.mod.landscape);
            } else {
                slide
                    .removeClass(params.mod.landscape)
                    .addClass(params.mod.portrait);
            }
        },

        checkButtons: function(galleryId) {
            var p = data[galleryId];

            if (p.current == 0) {
                p.prev.addClass(params.mod.disabled);
            } else {
                p.prev.removeClass(params.mod.disabled);
            }
            if (p.current == p.count) {
                p.next.addClass(params.mod.disabled);
            } else {
                p.next.removeClass(params.mod.disabled);
            }
        },

        setIndent: function(value, meter) {
            var result = {};

            meter = meter || '%';

            if (params.transform) {
                result[prefixes[params.transform]] = 'translate3d(' + value + meter + ', 0, 0)';
            } else {
                result.left = value + '%';
            }

            return result;
        },

        getTemplate: function(id) {
            return '<div class="' + params.slide + ' ' + params.slideIdPrefix + id + ' ' + params.mod.loading + '" data-id="' + id + '"><div class="' + params.slideImg + '"></div></div>';
        }
    };

    $.fn.photor = function(method) {

        if ( methods[method] ) {
            return methods[method].apply(this, Array.prototype.slice.call(arguments, 1));
        } else if (typeof method === 'object' || ! method) {
            return methods.init.apply(this, arguments);
        } else {
            $.error('Unknown method: ' +  method);
        }

    };

})(jQuery);


// Клик по случайной миниатюре, проверить позицию рамочки
// Клик по случайной миниатюре, проверить размер рамочки соответствует размеру изображения
// Если миниатюры не помещаются в экран, проверить разрешен ли драг
// Если миниатюры помещаются в экран, проверить запрещен ли драг
// После инициализации без явно указанного параметра, выбрана первая миниатюра