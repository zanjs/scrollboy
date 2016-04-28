/**
 * Scrollboy
 * auth By Julian
 * youyadaojia@gmail.com
 * 2016年04月28日17:52:55
 */

;(function() {
    'use strict';

    var
        sr,
        Tools,
        _requestAnimationFrame;

    this.ScrollBoy = (function() {

        /**
         * 组件配置参数
         * -------------
         * 这个对象的签名可以被直接传递到滚动条构造,
         * 或作为第二个参数.
         */

        ScrollBoy.prototype.defaults = {

            //            'bottom', 'left', 'top', 'right'
            origin      : 'bottom',

            //            可以是任何有效的CSS距离, e.g. '5rem', '10%', '20vw', etc.
            distance    : '20px',

            //            时间（毫秒）。
            duration    : 500,
            delay       : 0,

            //            起始的角度,将这些所有轴坐标都归 0.
            rotate      : { x: 0, y: 0, z: 0 },

            //            起始不透明度值，转换到所计算的不透明前.
            opacity     : 0,

            //            起始刻度值，将这个值转换为1
            scale       : 0.9,

            //            Accepts any valid CSS easing, e.g. 'ease', 'ease-in-out', 'linear', etc.
            easing      : 'cubic-bezier(0.6, 0.2, 0.1, 1)',

            //            When null, `<html>` is assumed to be the reveal container. You can pass a
            //            DOM node as a custom container, e.g. document.querySelector('.fooContainer')
            //            or a selector, e.g. '.fooContainer'
            container   : null,

            //            true/false to control reveal animations on mobile.
            mobile      : true,

            //            true:  reveals occur every time elements become visible
            //            false: reveals occur once as elements become visible
            reset       : false,

            //            'always' — delay for all reveal animations
            //            'once'   — delay only the first time reveals occur
            //            'onload' - delay only for animations triggered by first load
            useDelay    : 'always',

            //            Change when an element is considered in the viewport. The default value
            //            of 0.20 means 20% of an element must be visible for its reveal to occur.
            viewFactor  : 0.2,

            //            Pixel values that alter the container boundaries.
            //            e.g. Set `{ top: 48 }`, if you have a 48px tall fixed toolbar.
            viewOffset  : { top: 0, right: 0, bottom: 0, left: 0 },

            //            Callbacks that fire for each completed element reveal, and if
            //            `config.reset = true`, for each completed element reset. When creating your
            //            callbacks, remember they are passed the element’s DOM node that triggered
            //            it as the first argument.
            afterReveal : function(domEl) {},
            afterReset  : function(domEl) {}
        };



        function ScrollBoy(config) {

            // Support instantiation without the `new` keyword.
            if (typeof this == 'undefined' || Object.getPrototypeOf(this) !== ScrollBoy.prototype) {
                return new ScrollBoy(config)
            }

            sr = this; // Save reference to instance.
            sr.tools = new Tools(); // *required utilities

            if (sr.isSupported()) {

                sr.tools.extend(sr.defaults, config || {});

                _resolveContainer(sr.defaults);

                sr.store = {
                    elements   : {},
                    containers : []
                };

                sr.sequences   = {};
                sr.history     = [];
                sr.uid         = 0;
                sr.initialized = false;
            }

            // Note: IE9 only supports console if devtools are open.
            else if (typeof console !== 'undefined' && console !== null) {
                console.log('ScrollBoy is not supported in this browser.');
            }

            return sr
        }



        /**
         * Check if client supports CSS Transform and CSS Transition.
         * @return {boolean}
         */
        ScrollBoy.prototype.isSupported = function() {
            var style = document.documentElement.style;
            return 'WebkitTransition' in style && 'WebkitTransform' in style
                || 'transition' in style && 'transform' in style
        };



        /**
         * Creates a reveal set, a group of elements that will animate when they
         * become visible. If [interval] is provided, a new sequence is created
         * that will ensure elements reveal in the order they appear in the DOM.
         *
         * @param {string|Node} [selector] The element (node) or elements (selector) to animate.
         * @param {Object}      [config]   Override the defaults for this reveal set.
         * @param {number}      [interval] Time between sequenced element animations (milliseconds).
         * @param {boolean}     [sync]     Used internally when updating reveals for async content.
         *
         * @return {Object} The current ScrollBoy instance.
         */
        ScrollBoy.prototype.reveal = function(selector, config, interval, sync) {

            var
                container,
                elements,
                elem,
                elemId,
                sequence,
                sequenceId;

            // Resolve container.
            if (config && config.container) {
                container = _resolveContainer(config);
            } else {
                container = sr.defaults.container;
            }

            // Let’s check to see if a DOM node was passed in as the first argument,
            // otherwise query the container for all elements matching the selector.
            if (sr.tools.isNode(selector)) {
                elements = [selector];
            } else {
                elements = Array.prototype.slice.call(container.querySelectorAll(selector));
            }

            if (!elements.length) {
                console.log('ScrollBoy: reveal on "'+ selector + '" failed, no elements found.');
                return sr
            }

            // No custom configuration was passed, but a sequence interval instead.
            // let’s shuffle things around to make sure everything works.
            if (config && typeof config == 'number') {
                interval = config;
                config = {};
            }

            // Prepare a new sequence if an interval is passed.
            if (interval && typeof interval == 'number') {
                sequenceId = _nextUid();

                sequence = sr.sequences[sequenceId] = {
                    id       : sequenceId,
                    interval : interval,
                    elemIds  : [],
                    active   : false
                }
            }

            // Begin main loop to configure ScrollBoy elements.
            for (var i = 0; i < elements.length; i++) {

                // Check if the element has already been configured and grab it from the store.
                elemId = elements[i].getAttribute('data-sr-id');
                if (elemId) {
                    elem = sr.store.elements[elemId];
                }

                // Otherwise, let’s do some basic setup.
                else {
                    elem = {
                        id        : _nextUid(),
                        domEl     : elements[i],
                        seen      : false,
                        revealing : false
                    };
                    elem.domEl.setAttribute('data-sr-id', elem.id);
                }

                // Sequence only setup
                if (sequence) {

                    elem.sequence = {
                        id    : sequence.id,
                        index : sequence.elemIds.length
                    };

                    sequence.elemIds.push(elem.id);
                }

                // New or existing element, it’s time to update its configuration, styles,
                // and send the updates to our store.
                _configure(elem, config || {});
                _style(elem);
                _updateStore(elem);

                // We need to make sure elements are set to visibility: visible, even when
                // on mobile and `config.mobile == false`, or if unsupported.
                if (sr.tools.isMobile() && !elem.config.mobile || !sr.isSupported()) {
                    elem.domEl.setAttribute('style', elem.styles.inline);
                    elem.disabled = true;
                }

                // Otherwise, proceed normally.
                else if (!elem.revealing) {
                    elem.domEl.setAttribute('style',
                        elem.styles.inline
                      + elem.styles.transform.initial
                    );
                }
            }

            // Each `reveal()` is recorded so that when calling `sync()` while working
            // with asynchronously loaded content, it can re-trace your steps but with
            // all your new elements now in the DOM.

            // Since `reveal()` is called internally by `sync()`, we don’t want to
            // record or intiialize each reveal during syncing.
            if (!sync && sr.isSupported()) {
                _record(selector, config);

                // We push initialization to the event queue using setTimeout, so that we can
                // give ScrollBoy room to process all reveal calls before putting things into motion.
                
                if (sr.initTimeout) {
                    window.clearTimeout(sr.initTimeout);
                }
                sr.initTimeout = window.setTimeout(_init, 0);
            }

            return sr
        };



        /**
         * Re-runs `reveal()` for each record stored in history, effectively capturing
         * any content loaded asynchronously that matches existing reveal set selectors.
         *
         * @return {Object} The current ScrollBoy instance.
         */
        ScrollBoy.prototype.sync = function() {
            if (sr.history.length && sr.isSupported()) {
                for (var i = 0; i < sr.history.length; i++) {
                    var record = sr.history[i];
                    sr.reveal(record.selector, record.config, record.interval, true);
                };
                _init();
            } else {
                console.log('ScrollBoy: sync failed, no reveals found.');
            }
            return sr
        };



        /**
         * Private Methods
         * ---------------
         * These methods remain accessible only to the ScrollBoy instance, even
         * though they only "exist" during instantiation outside of the constructors scope.
         * --
         * http://stackoverflow.com/questions/111102/how-do-javascript-closures-work
         */

        function _resolveContainer(config) {
            var container = config.container;

            // Check if our container is defined by a selector.
            if (container && typeof container == 'string') {
                return config.container = window.document.querySelector(container);
            }

            // Check if our container is defined by a node.
            else if (container && !sr.tools.isNode(container)) {
                console.log('ScrollBoy: Invalid container provided, using <html> instead.');
                config.container = null;
            }

            // Otherwise use <html> by default.
            if (container == null) {
                config.container = window.document.documentElement;
            }

            return config.container
        }



        /**
         * A consistent way of creating unique IDs.
         * @returns {number}
         */
        function _nextUid() {
            return ++sr.uid;
        }



        function _configure(elem, config) {

            // If the element hasn’t already been configured, let’s use a clone of the
            // defaults extended by the configuration passed as the second argument.
            if (!elem.config) {
                elem.config = sr.tools.extendClone(sr.defaults, config);
            }

            // Otherwise, let’s use a clone of the existing element configuration extended
            // by the configuration passed as the second argument.
            else {
                elem.config = sr.tools.extendClone(elem.config, config);
            }

            // Infer CSS Transform axis from origin string.
            if (elem.config.origin === 'top' || elem.config.origin === 'bottom') {
                elem.config.axis = 'Y';
            } else {
                elem.config.axis = 'X';
            }

            // Let’s make sure our our pixel distances are negative for top and left.
            // e.g. config.origin = 'top' and config.distance = '25px' starts at `top: -25px` in CSS.
            if (elem.config.origin === 'top' || elem.config.origin === 'left') {
                elem.config.distance = '-' + elem.config.distance;
            }
        }



        function _style(elem) {
            var computed = window.getComputedStyle(elem.domEl);

            if (!elem.styles) {
                elem.styles = {
                    transition : {},
                    transform  : {},
                    computed   : {}
                };

                // Capture any existing inline styles, and add our visibility override.
                
                elem.styles.inline  = elem.domEl.getAttribute('style') || '';
                elem.styles.inline += '; visibility: visible; ';

                // grab the elements existing opacity.
                elem.styles.computed.opacity = computed.opacity;

                // grab the elements existing transitions.
                if (!computed.transition || computed.transition == 'all 0s ease 0s') {
                    elem.styles.computed.transition = '';
                } else {
                    elem.styles.computed.transition = computed.transition + ', ';
                }
            }

            // Create transition styles
            elem.styles.transition.instant = _generateTransition(elem, 0);
            elem.styles.transition.delayed = _generateTransition(elem, elem.config.delay);

            // Generate transform styles, first with the webkit prefix.
            elem.styles.transform.initial = ' -webkit-transform:';
            elem.styles.transform.target  = ' -webkit-transform:';
            _generateTransform(elem);

            // And again without any prefix.
            elem.styles.transform.initial += 'transform:';
            elem.styles.transform.target  += 'transform:';
            _generateTransform(elem);

        }



        function _generateTransition(elem, delay) {
            var config = elem.config;

            return '-webkit-transition: ' + elem.styles.computed.transition +
                     '-webkit-transform ' + config.duration / 1000 + 's '
                                          + config.easing + ' '
                                          + delay / 1000 + 's, opacity '
                                          + config.duration / 1000 + 's '
                                          + config.easing + ' '
                                          + delay / 1000 + 's; ' +

                           'transition: ' + elem.styles.computed.transition +
                             'transform ' + config.duration / 1000 + 's '
                                          + config.easing + ' '
                                          + delay / 1000 + 's, opacity '
                                          + config.duration / 1000 + 's '
                                          + config.easing + ' '
                                          + delay / 1000 + 's; '
        }



        function _generateTransform(elem) {
            var config    = elem.config;
            var transform = elem.styles.transform;

            if (parseInt(config.distance)) {
                transform.initial += ' translate' + config.axis + '(' + config.distance + ')';
                transform.target  += ' translate' + config.axis + '(0)';
            }
            if (config.scale) {
                transform.initial += ' scale(' + config.scale + ')';
                transform.target  += ' scale(1)';
            }
            if (config.rotate.x) {
                transform.initial += ' rotateX(' + config.rotate.x + 'deg)';
                transform.target  += ' rotateX(0)';
            }
            if (config.rotate.y) {
                transform.initial += ' rotateY(' + config.rotate.y + 'deg)';
                transform.target  += ' rotateY(0)';
            }
            if (config.rotate.z) {
                transform.initial += ' rotateZ(' + config.rotate.z + 'deg)';
                transform.target  += ' rotateZ(0)';
            }
            transform.initial += '; opacity: ' + config.opacity + ';';
            transform.target  += '; opacity: ' + elem.styles.computed.opacity + ';';
        }



        function _updateStore(elem) {
            var container = elem.config.container;

            // If this element’s container isn’t already in the store, let’s add it.
            if (container && sr.store.containers.indexOf(container) == -1) {
                sr.store.containers.push(elem.config.container);
            }

            // Update the element stored with our new element.
            sr.store.elements[elem.id] = elem;
        };



        function _record(selector, config, interval) {

            // Save the `reveal()` arguments that triggered this `_record()` call, so we
            // can re-trace our steps when calling the `sync()` method.
            var record = {
                selector : selector,
                config   : config,
                interval : interval
            };
            sr.history.push(record);
        }



        function _init() {
            if (sr.isSupported()) {

                // Initial animate call triggers valid reveal animations on first load.
                // Subsequent animate calls are made inside the event handler.
                _animate();

                // Then we loop through all container nodes in the store and bind event
                // listeners to each.
                for (var i = 0; i < sr.store.containers.length; i++) {
                    sr.store.containers[i].addEventListener('scroll', _handler);
                    sr.store.containers[i].addEventListener('resize', _handler);
                }

                // Let’s also do a one-time binding of window event listeners.
                if (!sr.initialized) {
                    window.addEventListener('scroll', _handler);
                    window.addEventListener('resize', _handler);
                    sr.initialized = true;
                }
            }
            return sr
        }



        function _handler() {
            _requestAnimationFrame(_animate);
        }



        function _setActiveSequences() {

            var
                active,
                elem,
                elemId,
                sequence;

            // Loop through all sequences
            sr.tools.forOwn(sr.sequences, function(sequenceId) {
                sequence = sr.sequences[sequenceId];
                active   = false;

                // For each sequenced elemenet, let’s check visibility and if
                // any are visible, set it’s sequence to active.
                for (var i = 0; i < sequence.elemIds.length; i++) {
                    elemId = sequence.elemIds[i]
                    elem   = sr.store.elements[elemId];
                    if (_isElemVisible(elem) && !active) {
                        active = true;
                    }
                }

                sequence.active = active;
            });
        }



        function _animate() {

            var
                delayed,
                elem;

            _setActiveSequences();

            // Loop through all elements in the store
            sr.tools.forOwn(sr.store.elements, function(elemId) {

                elem = sr.store.elements[elemId];
                delayed = _shouldUseDelay(elem);

                // Let’s see if we should reveal, and if so, whether to use delay.
                if (_shouldReveal(elem)) {
                    if (delayed) {
                        elem.domEl.setAttribute('style',
                            elem.styles.inline
                          + elem.styles.transform.target
                          + elem.styles.transition.delayed
                        );
                    } else {
                        elem.domEl.setAttribute('style',
                            elem.styles.inline
                          + elem.styles.transform.target
                          + elem.styles.transition.instant
                        );
                    }

                    // Let’s queue the `afterReveal` callback and tag the element.
                    _queueCallback('reveal', elem, delayed);
                    elem.revealing = true;
                    elem.seen = true;

                    if (elem.sequence) {
                        _queueNextInSequence(elem, delayed);
                    }
                }

                // If we got this far our element shouldn’t reveal, but should it reset?
                else if (_shouldReset(elem)) {
                    elem.domEl.setAttribute('style',
                        elem.styles.inline
                      + elem.styles.transform.initial
                      + elem.styles.transition.instant
                    );
                    _queueCallback('reset', elem);
                    elem.revealing = false;
                }
            });
        }



        /**
         * Sequence callback that triggers the next element.
         */
        function _queueNextInSequence(elem, delayed) {

            var
                elapsed  = 0,
                delay    = 0,
                sequence = sr.sequences[elem.sequence.id];

            // We’re processing a sequenced element, so let's block other elements in this sequence.
            sequence.blocked = true;

            // Since we’re triggering animations a part of a sequence after animations on first load,
            // we need to check for that condition and explicitly add the delay to our timer.
            if (delayed && elem.config.useDelay == 'onload') {
                delay = elem.config.delay;
            }

            // If a sequence timer is already running, capture the elapsed time and clear it.
            if (elem.sequence.timer) {
                elapsed = Math.abs(elem.sequence.timer.started - new Date());
                window.clearTimeout(elem.sequence.timer);
            }

            // Start a new timer.
            elem.sequence.timer = { started: new Date() };
            elem.sequence.timer.clock = window.setTimeout(function() {

                // Sequence interval has passed, so unblock the sequence and re-run the handler.
                sequence.blocked = false;
                elem.sequence.timer = null;
                _handler();

            }, Math.abs(sequence.interval) + delay - elapsed);
        }



        function _queueCallback(type, elem, delayed) {

            var
                elapsed  = 0,
                duration = 0,
                callback = 'after';

            // Check which callback we’re working with.
            switch (type) {

                case 'reveal':
                    duration = elem.config.duration;
                    if (delayed) {
                        duration += elem.config.delay;
                    }
                    callback += 'Reveal';
                    break

                case 'reset':
                    duration = elem.config.duration;
                    callback += 'Reset';
                    break
            }

            // If a timer is already running, capture the elapsed time and clear it.
            if (elem.timer) {
                elapsed = Math.abs(elem.timer.started - new Date());
                window.clearTimeout(elem.timer.clock);
            }

            // Start a new timer.
            elem.timer = { started: new Date() };
            elem.timer.clock = window.setTimeout(function() {

                // The timer completed, so let’s fire the callback and null the timer.
                elem.config[callback](elem.domEl);
                elem.timer = null;

            }, duration - elapsed);
        }



        function _shouldReveal(elem) {
            if (elem.sequence) {
                var sequence = sr.sequences[elem.sequence.id];
                return sequence.active
                    && !sequence.blocked
                    && !elem.revealing
                    && !elem.disabled
            }
            return _isElemVisible(elem)
                && !elem.revealing
                && !elem.disabled
        }



        function _shouldUseDelay(elem) {
            var config = elem.config.useDelay;
            return config === 'always'
                || (config === 'onload' && !sr.initialized)
                || (config === 'once' && !elem.seen)
        }



        function _shouldReset(elem) {
            if (elem.sequence) {
                var sequence = sr.sequences[elem.sequence.id];
                return !sequence.active
                    && elem.config.reset
                    && elem.revealing
                    && !elem.disabled
            }
            return !_isElemVisible(elem)
                && elem.config.reset
                && elem.revealing
                && !elem.disabled
        }



        function _getContainer(container) {
            return {
                width  : container.clientWidth,
                height : container.clientHeight
            }
        }



        function _getScrolled(container) {

            // Return the container scroll values, plus the its offset.
            if (container && container !== window.document.documentElement) {
                var offset = _getOffset(container);
                return {
                    x : container.scrollLeft + offset.left,
                    y : container.scrollTop  + offset.top
                }
            }

            // Otherwise, default to the window object’s scroll values.
            else {
                return {
                    x : window.pageXOffset,
                    y : window.pageYOffset
                }
            }
        }



        function _getOffset(domEl) {

            var
                offsetTop    = 0,
                offsetLeft   = 0,

                // Grab the element’s dimensions.
                offsetHeight = domEl.offsetHeight,
                offsetWidth  = domEl.offsetWidth;

            // Now calculate the distance between the element and its parent, then
            // again for the parent to its parent, and again etc... until we have the
            // total distance of the element to the document’s top and left origin.
            do {
                if (!isNaN(domEl.offsetTop)) {
                    offsetTop += domEl.offsetTop;
                }
                if (!isNaN(domEl.offsetLeft)) {
                    offsetLeft += domEl.offsetLeft;
                }
            } while (domEl = domEl.offsetParent);

            return {
                top    : offsetTop,
                left   : offsetLeft,
                height : offsetHeight,
                width  : offsetWidth
            }
        }



        function _isElemVisible(elem) {

            var
                offset     = _getOffset(elem.domEl),
                container  = _getContainer(elem.config.container),
                scrolled   = _getScrolled(elem.config.container),
                vF         = elem.config.viewFactor,

                // 定义元素的几何.
                elemHeight = offset.height,
                elemWidth  = offset.width,
                elemTop    = offset.top,
                elemLeft   = offset.left,
                elemBottom = elemTop  + elemHeight,
                elemRight  = elemLeft + elemWidth;

            return confirmBounds() || isPositionFixed()

            function confirmBounds() {

                var
                    // Define the element’s functional boundaries using its view factor.
                    top        = elemTop    + elemHeight * vF,
                    left       = elemLeft   + elemWidth  * vF,
                    bottom     = elemBottom - elemHeight * vF,
                    right      = elemRight  - elemWidth  * vF,

                    // Define the container functional boundaries using its view offset.
                    viewTop    = scrolled.y + elem.config.viewOffset.top,
                    viewLeft   = scrolled.x + elem.config.viewOffset.left,
                    viewBottom = scrolled.y - elem.config.viewOffset.bottom + container.height,
                    viewRight  = scrolled.x - elem.config.viewOffset.right  + container.width;

                return top    < viewBottom
                    && bottom > viewTop
                    && left   > viewLeft
                    && right  < viewRight
            }

            function isPositionFixed() {
                return (window.getComputedStyle(elem.domEl).position === 'fixed')
            }
        }



        return ScrollBoy

    })();


    /**
     * tools.js
     * ---------------
     * 扩展
     */

    Tools = (function() {

        Tools.prototype.isObject = function(object) {
            return object !== null && typeof object === 'object' && object.constructor == Object
        };

        Tools.prototype.isNode = function(object) {
            return typeof Node === 'object'
                ? object instanceof Node
                : object && typeof object === 'object'
                         && typeof object.nodeType === 'number'
                         && typeof object.nodeName === 'string'
        };

        Tools.prototype.forOwn = function(object, callback) {
            if (!this.isObject(object)) {
                throw new TypeError('Expected "object", but received "' + typeof object + '".');
            } else {
                for (var property in object) {
                    if (object.hasOwnProperty(property)) {
                        callback(property);
                    }
                }
            }
        };

        Tools.prototype.extend = function(target, source) {
            this.forOwn(source, function(property) {
                if (this.isObject(source[property])) {
                    if (!target[property] || !this.isObject(target[property])) {
                        target[property] = {};
                    }
                    this.extend(target[property], source[property]);
                } else {
                    target[property] = source[property];
                }
            }.bind(this));
            return target
        };

        Tools.prototype.extendClone = function(target, source) {
            return this.extend(this.extend({}, target), source)
        };

        Tools.prototype.isMobile = function() {
            return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
        };

        function Tools() {};
        return Tools

    })();



    _requestAnimationFrame = window.requestAnimationFrame       ||
                             window.webkitRequestAnimationFrame ||
                             window.mozRequestAnimationFrame;



}).call(this);



!
function(e, t) {
	"function" == typeof define && define.amd ? define(t) : "object" == typeof exports ? module.exports = t(require, exports, module) : e.scrollReveal = t()
} (this,
function() {
	return window.scrollReveal = function(e) {
		"use strict";
		function t(t) {
			return r = this,
			r.elems = {},
			r.serial = 1,
			r.blocked = !1,
			r.config = o(r.defaults, t),
			r.isMobile() && !r.config.mobile || !r.isSupported() ? void r.destroy() : (r.config.viewport === e.document.documentElement ? (e.addEventListener("scroll", a, !1), e.addEventListener("resize", a, !1)) : r.config.viewport.addEventListener("scroll", a, !1), void r.init(!0))
		}
		var i, o, a, r;
		return t.prototype = {
			defaults: {
				enter: "bottom",
				move: "8px",
				over: "0.6s",
				wait: "0s",
				easing: "ease",
				scale: {
					direction: "up",
					power: "5%"
				},
				rotate: {
					x: 0,
					y: 0,
					z: 0
				},
				opacity: 0,
				mobile: !1,
				reset: !1,
				viewport: e.document.documentElement,
				delay: "once",
				vFactor: .6,
				complete: function() {}
			},
			init: function(e) {
				var t, i, o;
				o = Array.prototype.slice.call(r.config.viewport.querySelectorAll("[data-sr]")),
				o.forEach(function(e) {
					t = r.serial++,
					i = r.elems[t] = {
						domEl: e
					},
					i.config = r.configFactory(i),
					i.styles = r.styleFactory(i),
					i.seen = !1,
					e.removeAttribute("data-sr"),
					e.setAttribute("style", i.styles.inline + i.styles.initial)
				}),
				r.scrolled = r.scrollY(),
				r.animate(e)
			},
			animate: function(e) {
				function t(e) {
					var t = r.elems[e];
					setTimeout(function() {
						t.domEl.setAttribute("style", t.styles.inline),
						t.config.complete(t.domEl),
						delete r.elems[e]
					},
					t.styles.duration)
				}
				var i, o, a;
				for (i in r.elems) r.elems.hasOwnProperty(i) && (o = r.elems[i], a = r.isElemInViewport(o), a ? ("always" === r.config.delay || "onload" === r.config.delay && e || "once" === r.config.delay && !o.seen ? o.domEl.setAttribute("style", o.styles.inline + o.styles.target + o.styles.transition) : o.domEl.setAttribute("style", o.styles.inline + o.styles.target + o.styles.reset), o.seen = !0, o.config.reset || o.animating || (o.animating = !0, t(i))) : !a && o.config.reset && o.domEl.setAttribute("style", o.styles.inline + o.styles.initial + o.styles.reset));
				r.blocked = !1
			},
			configFactory: function(e) {
				var t = {},
				i = {},
				a = e.domEl.getAttribute("data-sr").split(/[, ]+/);
				return a.forEach(function(e, i) {
					switch (e) {
					case "enter":
						t.enter = a[i + 1];
						break;
					case "wait":
						t.wait = a[i + 1];
						break;
					case "move":
						t.move = a[i + 1];
						break;
					case "ease":
						t.move = a[i + 1],
						t.ease = "ease";
						break;
					case "ease-in":
						if ("up" == a[i + 1] || "down" == a[i + 1]) {
							t.scale.direction = a[i + 1],
							t.scale.power = a[i + 2],
							t.easing = "ease-in";
							break
						}
						t.move = a[i + 1],
						t.easing = "ease-in";
						break;
					case "ease-in-out":
						if ("up" == a[i + 1] || "down" == a[i + 1]) {
							t.scale.direction = a[i + 1],
							t.scale.power = a[i + 2],
							t.easing = "ease-in-out";
							break
						}
						t.move = a[i + 1],
						t.easing = "ease-in-out";
						break;
					case "ease-out":
						if ("up" == a[i + 1] || "down" == a[i + 1]) {
							t.scale.direction = a[i + 1],
							t.scale.power = a[i + 2],
							t.easing = "ease-out";
							break
						}
						t.move = a[i + 1],
						t.easing = "ease-out";
						break;
					case "hustle":
						if ("up" == a[i + 1] || "down" == a[i + 1]) {
							t.scale.direction = a[i + 1],
							t.scale.power = a[i + 2],
							t.easing = "cubic-bezier( 0.6, 0.2, 0.1, 1 )";
							break
						}
						t.move = a[i + 1],
						t.easing = "cubic-bezier( 0.6, 0.2, 0.1, 1 )";
						break;
					case "over":
						t.over = a[i + 1];
						break;
					case "flip":
					case "pitch":
						t.rotate = t.rotate || {},
						t.rotate.x = a[i + 1];
						break;
					case "spin":
					case "yaw":
						t.rotate = t.rotate || {},
						t.rotate.y = a[i + 1];
						break;
					case "roll":
						t.rotate = t.rotate || {},
						t.rotate.z = a[i + 1];
						break;
					case "reset":
						t.reset = "no" == a[i - 1] ? !1 : !0;
						break;
					case "scale":
						if (t.scale = {},
						"up" == a[i + 1] || "down" == a[i + 1]) {
							t.scale.direction = a[i + 1],
							t.scale.power = a[i + 2];
							break
						}
						t.scale.power = a[i + 1];
						break;
					case "vFactor":
					case "vF":
						t.vFactor = a[i + 1];
						break;
					case "opacity":
						t.opacity = a[i + 1];
						break;
					default:
						return
					}
				}),
				i = o(i, r.config),
				i = o(i, t),
				"top" === i.enter || "bottom" === i.enter ? i.axis = "Y": ("left" === i.enter || "right" === i.enter) && (i.axis = "X"),
				("top" === i.enter || "left" === i.enter) && (i.move = "-" + i.move),
				i
			},
			styleFactory: function(e) {
				function t() {
					0 !== parseInt(s.move) && (o += " translate" + s.axis + "(" + s.move + ")", r += " translate" + s.axis + "(0)"),
					0 !== parseInt(s.scale.power) && ("up" === s.scale.direction ? s.scale.value = 1 - .01 * parseFloat(s.scale.power) : "down" === s.scale.direction && (s.scale.value = 1 + .01 * parseFloat(s.scale.power)), o += " scale(" + s.scale.value + ")", r += " scale(1)"),
					s.rotate.x && (o += " rotateX(" + s.rotate.x + ")", r += " rotateX(0)"),
					s.rotate.y && (o += " rotateY(" + s.rotate.y + ")", r += " rotateY(0)"),
					s.rotate.z && (o += " rotateZ(" + s.rotate.z + ")", r += " rotateZ(0)"),
					o += "; opacity: " + s.opacity + "; ",
					r += "; opacity: 1; "
				}
				var i, o, a, r, n, s = e.config,
				c = 1e3 * (parseFloat(s.over) + parseFloat(s.wait));
				return i = e.domEl.getAttribute("style") ? e.domEl.getAttribute("style") + "; visibility: visible; ": "visibility: visible; ",
				n = "-webkit-transition: -webkit-transform " + s.over + " " + s.easing + " " + s.wait + ", opacity " + s.over + " " + s.easing + " " + s.wait + "; transition: transform " + s.over + " " + s.easing + " " + s.wait + ", opacity " + s.over + " " + s.easing + " " + s.wait + "; -webkit-perspective: 1000;-webkit-backface-visibility: hidden;",
				a = "-webkit-transition: -webkit-transform " + s.over + " " + s.easing + " 0s, opacity " + s.over + " " + s.easing + " 0s; transition: transform " + s.over + " " + s.easing + " 0s, opacity " + s.over + " " + s.easing + " 0s; -webkit-perspective: 1000; -webkit-backface-visibility: hidden; ",
				o = "transform:",
				r = "transform:",
				t(),
				o += "-webkit-transform:",
				r += "-webkit-transform:",
				t(),
				{
					transition: n,
					initial: o,
					target: r,
					reset: a,
					inline: i,
					duration: c
				}
			},
			getViewportH: function() {
				var t = r.config.viewport.clientHeight,
				i = e.innerHeight;
				return r.config.viewport === e.document.documentElement && i > t ? i: t
			},
			scrollY: function() {
				return r.config.viewport === e.document.documentElement ? e.pageYOffset: r.config.viewport.scrollTop + r.config.viewport.offsetTop
			},
			getOffset: function(e) {
				var t = 0,
				i = 0;
				do isNaN(e.offsetTop) || (t += e.offsetTop),
				isNaN(e.offsetLeft) || (i += e.offsetLeft);
				while (e = e.offsetParent);
				return {
					top: t,
					left: i
				}
			},
			isElemInViewport: function(t) {
				function i() {
					var e = n + a * c,
					t = s - a * c,
					i = r.scrolled + r.getViewportH(),
					o = r.scrolled;
					return i > e && t > o
				}
				function o() {
					var i = t.domEl,
					o = i.currentStyle || e.getComputedStyle(i, null);
					return "fixed" === o.position
				}
				var a = t.domEl.offsetHeight,
				n = r.getOffset(t.domEl).top,
				s = n + a,
				c = t.config.vFactor || 0;
				return i() || o()
			},
			isMobile: function() {
				var t = navigator.userAgent || navigator.vendor || e.opera;
				return /(ipad|playbook|silk|android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows (ce|phone)|xda|xiino/i.test(t) || /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(t.substr(0, 4)) ? !0 : !1
			},
			isSupported: function() {
				for (var e = document.createElement("sensor"), t = "Webkit,Moz,O,".split(","), i = ("transition " + t.join("transition,")).split(","), o = 0; o < i.length; o++) if ("" === !e.style[i[o]]) return ! 1;
				return ! 0
			},
			destroy: function() {
				var e = r.config.viewport,
				t = Array.prototype.slice.call(e.querySelectorAll("[data-sr]"));
				t.forEach(function(e) {
					e.removeAttribute("data-sr")
				})
			}
		},
		a = function() {
			r.blocked || (r.blocked = !0, r.scrolled = r.scrollY(), i(function() {
				r.animate()
			}))
		},
		o = function(e, t) {
			for (var i in t) t.hasOwnProperty(i) && (e[i] = t[i]);
			return e
		},
		i = function() {
			return e.requestAnimationFrame || e.webkitRequestAnimationFrame || e.mozRequestAnimationFrame ||
			function(t) {
				e.setTimeout(t, 1e3 / 60)
			}
		} (),
		t
	} (window),
	scrollReveal
});;