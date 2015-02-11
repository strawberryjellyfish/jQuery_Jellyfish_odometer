//============================================================================//
//  jQuery Jellyfish Counter
//  an animated odometer style counter originally developed for use in my
//  Jellyfish Counter Widget for WordPress
//  http://strawberryjellyfish.com/wordpress-plugins/jellyfish-counter/
//
//  Version 0.7
//  Copyright (C) 2015 Robert Miller
//  http://strawberryjellyfish.com
//============================================================================//
//
//  This program is free software: you can redistribute it and/or modify
//  it under the terms of the GNU General Public License as published by
//  the Free Software Foundation, either version 3 of the License, or
//  (at your option) any later version.
//
//  This program is distributed in the hope that it will be useful,
//  but WITHOUT ANY WARRANTY; without even the implied warranty of
//  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
//  GNU General Public License for more details.
//
//  You should have received a copy of the GNU General Public License
//  along with this program.  If not, see <http://www.gnu.org/licenses/>.
//============================================================================//


// the semi-colon before function invocation is a safety net against concatenated
// scripts and/or other plugins which may not be closed properly.
;
(function($, window, document, undefined) {

    "use strict";

    var jellyfishOdometer = function(elem, options) {
        this._name = jellyfishOdometer;
        this.elem = elem;
        this.$elem = $(elem);
        this.options = options;
        this.metadata = this.$elem.data();
        //this.metadata = this.$elem.data('jellyfish-counter-options');
    };

    // default parameters, will be overridden by any params supplied at
    // object creation via param hash or data attributes on target element
    jellyfishOdometer.prototype = {
        defaults: {
            format: '',
            digits: 6,
            tenths: true,
            digitHeight: 40,
            digitPadding: 0,
            digitWidth: 30,
            bustedness: 2,
            digitStyle: '',
            alignment: 'center',
            flat: false,
            digitClass: null,
            tenthDigitClass: null,
            digitContainerClass: null,
            counterClass: null,
            waitTime: 10,
            startValue: 0,
            direction: 'up',
            timestamp: false,
            interval: 1,
            intervalClockIncrement: 0.05,
            tickAmount: 0.05,
            random: false,
            randomLow: 0,
            randomHigh: 1,
            active: true,
            initialisedFunction: null,
            completedFunction: null,
        },

        // Init() is run on counter creation, it shouln't be called manually
        init: function() {
            this.digitInfo = new Array();
            this.intervalClock = 0;
            this.currentValue = 0;

            // merge options from defaults, arguments and data attributes
            this.config = $.extend({}, this.defaults, this.options, this.metadata);

            // calculate some other default settings
            if (this.config.format) {
                this.config.digits = (this.config.format.match(/0/g) || []).length;
            } else {
                this.config.format = new Array(this.config.digits + 1).join('0');
            }

            // if we have a timestamp, caculate the number of ticks since then and
            // add to the start value to get the current total of a continuous counter
            if (this.config.timestamp) {
                this.config.tenths = false;
                var startedAt = Date.parse( this.config.timestamp );
                var secondsPassed = ( new Date().getTime() - startedAt ) / 1000;
                this.config.startValue = this.config.startValue + ( secondsPassed / this.config.interval );
            }

            // set up styles based on config options,
            // these will override styles in jellyfish-counter.css
            this.style = {
                digits: "height:" + this.config.digitHeight + "px; width:" + this.config.digitWidth +
                    "px; padding:" + this.config.digitPadding + "px; font-size:" +
                    (this.config.digitHeight - (2 * this.config.digitPadding)) + "px; line-height:" +
                    (this.config.digitHeight - (2 * this.config.digitPadding)) + "px; " + this.config.digitStyle,

                columns: "height:" + this.config.digitHeight + "px; width:" + this.config.digitWidth + "px;"
            };

            // pair map highlight divs to desired CSS classes
            this.highlights = [
                "jcw-highlight-1 jcw-highlight",
                "jcw-highlight-2 jcw-highlight",
                "jcw-highlight-3 jcw-highlight",
                "jcw-highlight-4 jcw-sidehighlight",
                "jcw-highlight-5 jcw-sidelowlight",
                "jcw-highlight-6 jcw-lowlight",
                "jcw-highlight-7 jcw-lowlight",
                "jcw-highlight-8 jcw-lowlight"
            ];

            // Initially draw the counter and set to the start value
            this._drawOdometer(this.element, this.config);
            this.set(this.config.startValue);

            // Counter is initialised and drawn with initial value,
            // fire of the initicalisedFunction() if it exists
            if ($.isFunction(this.config.initialisedFunction)) {
                this.config.initialisedFunction();
            }

            // Start counting, if not already finished
            if ((this.config.endValue != this.config.startValue) && this.config.active) {
                this._update(this.element, this.config);
            }

            return this;
        },

        // Remove the counter from the dom
        destroy: function() {
            if (this.timeout) clearTimeout(this.timeout);
            this.$elem.remove();
        },

        // sets the current value of the counter
        // newValue must not be less than 0 but doesn't have to be an integer
        set: function(newValue) {
            if (newValue < 0) newValue = 0;
            this.currentValue = newValue;
            if (this.config.tenths) newValue = newValue * 10;
            var integerValue = Math.floor(newValue);
            var fraction = newValue - integerValue;
            integerValue = String(integerValue);
            for (var i = 0; i < this.config.digits; i++) {
                var digit = integerValue.substring(integerValue.length - i - 1, integerValue.length - i) || 0;
                this._setDigitValue(this.config.digits - i - 1, digit, fraction);
                if (digit != 9) fraction = 0;
            }
        },

        // returns the current value of the counter
        get: function() {
            return this.currentValue;
        },

        // starts a counter if it still has some counting to do
        // if the counter has already finished you need to reset() first
        start: function() {
            this.config.active = true;
            this._update();
        },

        // stops/pauses an active counter, can be resumed with start()
        stop: function() {
            this.config.active = false;
            if (this.timeout) clearTimeout(this.timeout);
        },

        // resets a counter to it's initial (start) value,
        // continuous counters will reset to the value they had at page load
        reset: function() {
            this.intervalClock = 0;
            this.set(this.config.startValue);
        },

        // reverses the counter
        // start and end values are swapped around so the original start
        // value is now the end value and vice versa and the count direction reverses
        reverse: function() {
            this.stop();
            var currentStart = this.config.startValue;
            var currentEnd = this.config.endValue;
            this.config.direction = this.config.direction == 'down' ? 'up' : 'down';
            this.config.startValue = currentEnd;
            this.config.endValue = currentStart;
            this.start();
        },

        // Adds v to the current total and update the counter
        increment: function(v) {
            var currentState = this.config.active;
            this.stop();
            this.intervalClock = 1;
            this.currentValue += v | 1;
            this.config.active = true;
            this._update();
            this.config.active = currentState;
        },

        // Subtract v to the current total and update the counter
        decrement: function(v) {
            var currentState = this.config.active;
            this.stop();
            this.intervalClock = 1;
            this.currentValue -= v | 1;
            this.config.active = true;
            this._update();
            this.config.active = currentState;
        },


        // left pad a string with zeros
        _zeroPad: function(str, max) {
            str = str.toString();
            return str.length < max ? this._zeroPad("0" + str, max) : str;
        },

        // Set digit div content and vertical position based on value
        _setDigitValue: function(digit, val, frac) {
            var di = this.digitInfo[digit];
            var px = Math.floor(this.config.digitHeight * frac);
            px += di.offset;
            if (val != di.last_val) {
                var tmp = di.digitA;
                di.digitA = di.digitB;
                di.digitB = tmp;
                di.digitA.innerHTML = val;
                di.digitB.innerHTML = (1 + Number(val)) % 10;
                di.last_val = val;
                di.last_px = this.config.digitHeight;
            }
            if (px != di.last_px) {
                di.digitA.style.top = (0 - px) + "px";
                di.digitB.style.top = (0 - px + this.config.digitHeight) + "px";
                di.last_px = px;
            }
        },

        // add a digit div to the dom
        _drawDigit: function(i) {
            var digitClass = this.config.digitClass ? 
                "jcw-digit " + this.config.digitClass : "jcw-digit";
            var digitDivA = document.createElement("div");
            digitDivA.setAttribute("id", "odometer_digit_" + i + "a");
            digitDivA.className = digitClass;
            digitDivA.style.cssText = this.style.digits;

            var digitDivB = document.createElement("div");
            digitDivB.setAttribute("id", "odometer_digit_" + i + "b");
            digitDivB.className = digitClass;
            digitDivB.style.cssText = this.style.digits;

            var digitColDiv = document.createElement("div");
            digitColDiv.className = this.config.digitContainerClass ? 
                "jcw-digit " + this.config.digitContainerClass : "jcw-digit-container";
            digitColDiv.style.cssText = this.style.columns;

            digitColDiv.appendChild(digitDivB);
            digitColDiv.appendChild(digitDivA);
            var offset = Math.floor(Math.random() * this.config.bustedness);
            this.digitInfo.push({
                digitA: digitDivA,
                digitB: digitDivB,
                last_val: -1,
                last_px: -1,
                offset: offset
            });
            return digitColDiv;
        },

        // add highlight/lowlight divs to the digit div
        // would probably be cleaner using transparent css gradients but this
        // produces a decent stylised effect with greater old browser support
        _drawHighLights: function(digitColDiv) {
            if (!this.config.flat) {
                for (var j in this.highlights) {
                    var hdiv = document.createElement("div");
                    hdiv.innerHTML = "<p></p>"; // For Dumb IE
                    hdiv.className = this.highlights[j];
                    digitColDiv.appendChild(hdiv);
                }
            }
        },

        // render the complete odometer into the dom
        _drawOdometer: function() {
            switch (this.config.alignment) {
                case 'left':
                    this.elem.className += ' jcw-left';
                    break;
                case 'right':
                    this.elem.className += ' jcw-right';
                    break;
                case 'inline':
                    this.elem.className += ' jcw-inline';
                    break;
                default:
                    this.elem.className += ' jcw-center';
            }
            var odometerDiv = document.createElement("div");
            odometerDiv.className = "jcw-odometer-div";
            this.$elem.append(odometerDiv);

            for (var i = 0; i < this.config.format.length; i++) {
                var character = this.config.format.charAt(i);
                if (character == '0') {
                    var digitColDiv = this._drawDigit(i);
                } else {
                    var separator = document.createElement("div");
                    separator.innerHTML = character;
                    separator.className = this.config.digitClass ? 
                        "jcw-digit " + this.config.digitClass : "jcw-digit";
                    separator.style.cssText = this.style.digits;
                    var digitColDiv = document.createElement("div");
                    digitColDiv.className = this.config.counterClass ? 
                        "jcw-digit-container " + this.config.counterClass : "jcw-digit-container";
                    digitColDiv.style.cssText = this.style.columns;
                    digitColDiv.appendChild(separator);
                }
                this._drawHighLights(digitColDiv);
                odometerDiv.appendChild(digitColDiv);
            };

            if (this.config.tenths) {
                this.digitInfo[this.config.digits - 1].digitA.className = this.config.tenthDigitClass ? 
                    "jcw-tenth " + this.config.tenthDigitClass : "jcw-tenth";
                this.digitInfo[this.config.digits - 1].digitB.className = this.config.tenthDigitClass ? 
                    "jcw-tenth " + this.config.tenthDigitClass : "jcw-tenth";
            }

            if (this.currentValue >= 0) this.set(this.currentValue);
        },

        // cancel any timeout, remove the counter and redraw it 
        // (useful if digit count has changed)
        redraw: function() {
            if (this.timeout) clearTimeout(this.timeout);
            var existing = this.$elem.children('div .jcw-odometer-div');
            if (existing.length) {
                existing.remove()
                this.digitInfo = new Array();
                this.intervalClock = 0;
                // Ensure format string and number of digits are still in sync
                var formatSize = (this.config.format.match(/0/g) || []).length;
                var formatDiff = (this.config.format || []).length - formatSize;
                this.config.format = this._zeroPad(this.config.format, this.config.digits + formatDiff);
                this._drawOdometer();
                this.set(this.currentValue);
            }
        },

        // Do the counting!
        // The maths isn't precise here as JavaScript execution speed varies
        // greatly depending on applications, devices and load...
        _update: function() {
            if (this.config.active) {
                if (this.config.timestamp) {
                    // continuous counter
                    var tickAmount = this.config.random ?
                        Math.max(this.config.randomLow, Math.min((Math.random() * this.config.randomHigh), this.config.randomHigh)) : this.config.tickAmount;
                    this.currentValue = (this.config.direction == 'down') ?
                        this.currentValue - tickAmount : this.currentValue + tickAmount;
                    this.intervalClock += this.config.intervalClockIncrement;
                    if (this.intervalClock >= 1) {
                        this.intervalClock = 0;
                        this.currentValue = Math.round(this.currentValue);
                        this.config.waitTime = this.config.interval * 1000;
                    } else {
                        this.config.waitTime = 1;
                    }
                } else {
                    // regular non persistent counter
                    this.currentValue = (this.config.direction == 'down') ?
                        this.currentValue - 0.01 : this.currentValue + 0.01;
                }

                // check we are still counting, update the counter and reset the timeout
                if (this.config.direction != 'down' &&
                    (!this.config.endValue || (this.currentValue < this.config.endValue)) ||
                    (this.config.direction == 'down' && (this.currentValue > this.config.endValue))) {

                    this.set(this.currentValue);
                    if (this.timeout) {
                        clearTimeout(this.timeout);
                    }
                    var that = this;
                    this.timeout = window.setTimeout(function() {
                        that._update();
                    }, this.config.waitTime);
                } else {
                    // reached the end value, stop and trigger completed function
                    this.config.active = false;
                    if (this.config.endValue && $.isFunction(this.config.completedFunction)) {
                        if ((this.config.direction != 'down' && this.currentValue >= this.config.endValue) ||
                            (this.config.direction == 'down' && this.currentValue <= this.config.endValue)) {

                            this.config.completedFunction.call(this, this.CurrentValue);
                        }
                    }
                }
            }
        }
    };


    $.fn.jellyfishOdometer = function(methodOrOptions, args) {
        var getterMethods = ['get'];
        if (typeof methodOrOptions === 'object' || !methodOrOptions) {
            return this.each(function() {
                if (!$.data(this, 'plugin_jellyfishOdometer')) {
                    $.data(this, 'plugin_jellyfishOdometer', new jellyfishOdometer(this, methodOrOptions).init());
                }
            });
        } else if (methodOrOptions != 'init' && methodOrOptions.indexOf('_') == -1) {
            var instance = $.data(this[0], 'plugin_jellyfishOdometer');

            if ($.inArray(methodOrOptions, getterMethods) > -1 ||
                (args == undefined && typeof instance[methodOrOptions] != 'function')) {
                // this is a get method or get property we can't use this.each
                // because we want to return data not this, so we'll default
                // to returning data for the first instance as it doesn't
                // make sense asking for properties from a collection.

                if (instance instanceof jellyfishOdometer) {
                    if (typeof instance[methodOrOptions] == 'function') {
                        return instance[methodOrOptions].call(instance);
                    } else if (methodOrOptions in instance.config) {
                        // return property
                        return instance.config[methodOrOptions];
                    } else {
                        $.error(methodOrOptions + ' does not exist as a method or property on jellyfishOdometer (' + this[0].id + ')');
                    }
                }
            } else {
                return this.each(function() {
                    var instance = $.data(this, 'plugin_jellyfishOdometer');
                    if (instance instanceof jellyfishOdometer) {
                        if (typeof instance[methodOrOptions] == 'function') {
                            instance[methodOrOptions].call(instance, args);
                        } else if (methodOrOptions in instance.config) {
                            instance.config[methodOrOptions] = args;
                        } else {
                            $.error(methodOrOptions + ' does not exist as a method or property on jellyfishOdometer (' + this.id + ')');
                        }
                    }
                });
            }
        }
    };

})(jQuery, window, document);