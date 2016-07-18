var ConnectionMonitor, INTERNAL,
  bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

INTERNAL = require('./internal');

ConnectionMonitor = (function() {
  var clamp, now, secondsSince;

  ConnectionMonitor.pollInterval = {
    min: 3,
    max: 30
  };

  ConnectionMonitor.staleThreshold = 6;

  function ConnectionMonitor(consumer) {
    this.consumer = consumer;
    this.visibilityDidChange = bind(this.visibilityDidChange, this);
    this.start();
  }

  ConnectionMonitor.prototype.connected = function() {
    this.reset();
    this.pingedAt = now();
    return delete this.disconnectedAt;
  };

  ConnectionMonitor.prototype.disconnected = function() {
    return this.disconnectedAt = now();
  };

  ConnectionMonitor.prototype.ping = function() {
    return this.pingedAt = now();
  };

  ConnectionMonitor.prototype.reset = function() {
    this.reconnectAttempts = 0;
    return this.consumer.connection.isOpen();
  };

  ConnectionMonitor.prototype.start = function() {
    this.reset();
    delete this.stoppedAt;
    this.startedAt = now();
    return this.poll();
  };

  ConnectionMonitor.prototype.stop = function() {
    return this.stoppedAt = now();
  };

  ConnectionMonitor.prototype.poll = function() {
    return setTimeout((function(_this) {
      return function() {
        if (!_this.stoppedAt) {
          _this.reconnectIfStale();
          return _this.poll();
        }
      };
    })(this), this.getInterval());
  };

  ConnectionMonitor.prototype.getInterval = function() {
    var interval, max, min, ref;
    ref = this.constructor.pollInterval, min = ref.min, max = ref.max;
    interval = 5 * Math.log(this.reconnectAttempts + 1);
    return clamp(interval, min, max) * 1000;
  };

  ConnectionMonitor.prototype.reconnectIfStale = function() {
    if (this.connectionIsStale()) {
      this.reconnectAttempts++;
      if (!this.disconnectedRecently()) {
        return this.consumer.connection.reopen();
      }
    }
  };

  ConnectionMonitor.prototype.connectionIsStale = function() {
    var ref;
    return secondsSince((ref = this.pingedAt) != null ? ref : this.startedAt) > this.constructor.staleThreshold;
  };

  ConnectionMonitor.prototype.disconnectedRecently = function() {
    return this.disconnectedAt && secondsSince(this.disconnectedAt) < this.constructor.staleThreshold;
  };

  ConnectionMonitor.prototype.visibilityDidChange = function() {
    if (this.appComponent.visibilityState === 'visible') {
      return setTimeout((function(_this) {
        return function() {
          if (_this.connectionIsStale() || !_this.consumer.connection.isOpen()) {
            return _this.consumer.connection.reopen();
          }
        };
      })(this), 200);
    }
  };

  ConnectionMonitor.prototype.toJSON = function() {
    var connectionIsStale, interval;
    interval = this.getInterval();
    connectionIsStale = this.connectionIsStale();
    return {
      startedAt: this.startedAt,
      stoppedAt: this.stoppedAt,
      pingedAt: this.pingedAt,
      reconnectAttempts: this.reconnectAttempts,
      connectionIsStale: connectionIsStale,
      interval: interval
    };
  };

  now = function() {
    return new Date().getTime();
  };

  secondsSince = function(time) {
    return (now() - time) / 1000;
  };

  clamp = function(number, min, max) {
    return Math.max(min, Math.min(max, number));
  };

  return ConnectionMonitor;

})();

module.exports = ConnectionMonitor;
