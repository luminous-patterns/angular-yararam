/**
 * Yet Another REST Active Record Angular Module
 * (c) 2015 Cal Milne
 * @version v0.1.0
 * @link https://github.com/mycetophorae/angular-yararam
 * @license MIT
 */

(function (window, angular, undefined) {'use strict';

angular.module('ngYararamSync', ['ng']);

$YararamSync.$inject = ['$http', '$q'];
function $YararamSync (  $http,   $q) {

    function $sync (model, method, options) {

        if (model.syncing) {
            return $q(angular.noop).then(function () {
                return model;
            });
        }

        var url = method !== 'create' ? model.getEndpoint() : model.getRootEndpoint();
        var data = model.attributes;

        model.syncing = true;

        switch (method) {

            case 'load':
                return $http
                    .get(url)
                    .then(
                        onComplete.bind(model), 
                        onError.bind(model)
                    );

            case 'save':
                return $http
                    .put(url, data)
                    .then(
                        onComplete.bind(window, model, options), 
                        onError.bind(window, model, options)
                    );

            case 'create':
                return $http
                    .post(url, data)
                    .then(
                        onComplete.bind(window, model, options), 
                        onError.bind(window, model, options)
                    );

            case 'delete':
                return $http
                    .delete(url)
                    .then(
                        onComplete.bind(window, model, options), 
                        onError.bind(window, model, options)
                    );

        }

    }

    function onComplete (model, response, options) {

        model.syncing = false;

        // Update the model attributes to match the server
        model.attributes = model.parse(response.data);

        // Update the previous attributes
        model._previousAttributes = angular.copy(model.attributes);

        var idAttribute = model.idAttribute;

        if (idAttribute) {
            setID(model, response.data[idAttribute]);
        }

        if (options.onComplete) {
            options.onComplete(model, response);
        }

        return model;

    }

    function onError (model, response, options) {

        model.syncing = false;

        // Update the model attributes to match the server
        model.attributes = model.parse(response.data);

        // Update the previous attributes
        model._previousAttributes = angular.copy(model.attributes);

        var idAttribute = model.idAttribute;

        if (idAttribute) {
            setID(model, response.data[idAttribute]);
        }

        // Emit a 'sync' event on this model
        model.$emit('sync');

        if (options.onComplete) {
            options.onComplete(model, response);
        }

        return model;

    }

    return {
        $sync: $sync,
    };

}

angular.module('ngYararamSync').service('$YararamSync', $YararamSync);

angular.module('ngYararam', ['ngYararamSync']);

$YararamModel.$inject = ['$YararamSync', '$q'];
function $YararamModel (  $YararamSync,   $q) {

    var array = [];
    var slice = array.slice;

    function YararamModel () {

        // The name of the ID attribute property for the model
        this.idAttribute = 'ID';

        // The RESTful end point for the model
        this.endPoint = '';

        // The model's unique ID
        this.id = null;

        // Keep track of syncing
        this.syncing = false;

        // Event handler cache
        this._events = {};

        // Defaults
        this.defaults = {};

        // Are we creating a new model or loading an existing one
        if (arguments.length < 1) {
            this.attributes = {};
        }
        else {

            if (typeof arguments[0] === 'object') {
                this.attributes = this.parse(arguments[0]);
                if (this.idAttribute in this.attributes) {
                    setID(this, this.attributes[this.idAttribute]);
                }
            }
            else {
                setID(this, arguments[0]);
                this.attributes = {};
            }

        }

        // Keep a copy of the original attributes
        this._previousAttributes = angular.copy(this.attributes);

    }

    function setID (model, ID) {
        model.id = ID;
    }

    function deleteModel (model) {
        model.attributes = {};
        model._previousAttributes = {};
        model.id = null;
        model.$emit('delete');
        return this;
    }

    YarramModel.prototype.onSyncSuccess = function (response) {
        var attrs = this.parse(response);
        if (angular.isObject(attrs)) {
            // @TODO: update attributes
        }
    };

    YarramModel.prototype.onSyncError = function () {
        // @TODO: handle error
    };

    YararamModel.prototype.getEndpoint = function () {
        return this.getRootEndpoint() + '/' + this.id;
    };

    YararamModel.prototype.getRootEndpoint = function () {
        return this.endPoint;
    };

    YararamModel.prototype.parse = function (response, options) {
        return response;
    };

    YararamModel.prototype.$isNew = function () {
        return this.id ? false : true;
    };

    YararamModel.prototype.$get = function (attr) {
        return attr in this.attributes ? this.attributes[attr] : null;
    };

    YararamModel.prototype.$set = function (attr, val) {
        this.attributes[attr] = val;
        return this;
    };

    YararamModel.prototype.$undoChanges = function () {
        this.attributes = angular.copy(this._previousAttributes);
        return this;
    };

    YararamModel.prototype.$sync = function () {
        return $YararamSync.$sync.apply(this, arguments);
    };

    YararamModel.prototype.$delete = function () {
        if (!this.id) {
            return deleteModel(this);
        }
        return this.$sync('delete');
    };

    YararamModel.prototype.$save = function (options) {

        var method = 'save';

        if (this.$isNew()) {
            method = 'create';
        }

        return this
            .$sync(method, options)
            .then(
                this.onSyncSuccess.bind(this, options),
                this.onSyncError.bind(this, options)
            );

    };

    YararamModel.prototype.$load = function (options) {

        if (this.$isNew()) {
            return $q(angular.noop);
        }

        return this
            .$sync('load')
            .then(
                this.onSyncSuccess.bind(this, options),
                this.onSyncError.bind(this, options)
            );

    };

    YararamModel.prototype.$on = function (eventName, callback, context) {

        var cache = this._events;

        if (!cache[eventName]) {
            cache[eventName] = [];
        }

        cache[eventName].push([callback, context]);

        return this;

    };

    YararamModel.prototype.$off = function (eventName, callback) {

        var cache = this._events;

        if (!cache[eventName]) {
            return this;
        }

        if (null == callback) {
            delete cache[eventName];
            return this;
        }

        angular.forEach(cache[eventName], function (handler, index) {

            if (handler[0] === callback) {
                cache[eventName].splice(index, 1);
            }

        });

        return this;

    };

    YararamModel.prototype.$emit = function (eventName) {
      
        var args = slice.call(arguments, 1);
        var cache = this._events;

        if (!cache[eventName]) {
            return this;
        }

        angular.forEach(cache[eventName], function (handler) {

            var callback = handler[0];
            var context = handler[1];

            callback.apply(context, args);

        });

        return this;

    };

    // Set defaults
    YararamModel.prototype.setDefaults = function (defaults) {

        var _this = this;

        this.defaults = angular.copy(defaults);

        angular.forEach(this.defaults, function (value, key) {
            if (!_this.attributes[key]) {
                _this.attributes[key] = value;
            }
        });

      return this;

    };

    return YararamModel;

}

angular.module('ngYararam').factory('$YararamModel', $YararamModel);

$YararamCollection.$inject = ['$YararamSync', '$q'];
function $YararamCollection (  $YararamSync,   $q) {

    var array = [];
    var slice = array.slice;

    function YararamCollection(options) {

        // Event handler cache
        this._events = {};

        // Model cache
        this.models = [];

        // Specify custom end point for loading collection
        if ('endPoint' in options) {
            this.endPoint = options.endPoint;
        }

        // Length
        this.length = 0;

        // Query string for searching
        this.queryStringParts = {};

        // What type of models does this collection contain
        this.modelClass = options.class;
        this.model = new options.class();

        // Listen out for deletes
        this.$on('model:delete', onModelDelete, this);

    }

    // When a model is deleted
    var onModelDelete = function (model) {

        var _this = this;

        // Find the deleted model
        angular.forEach(this.models, function (m, index) {

            if (m === model) {

            // Remove it from this.models
            _this.models.splice(index, 1);

            // Update the collection length property
            _this.length--;

            }

        });

    };

    // Get a model from the collection by it's index
    YararamCollection.prototype.at = function (index) {
        return this.models[index];
    };

    // Add a model to the collection
    YararamCollection.prototype.add = function (model) {

        var _this = this;

        // Add the model to this.models
        this.models.push(model);

        // Increment length property
        this.length++;

        // Listen out for when this model is deleted
        model.$on('delete', function () {
            _this.$emit('model:delete', model);
        });

        return this;

    };

    // Return the end point for this collection
    YararamCollection.prototype.getEndPoint = function () {
        return this.endPoint
            ? this.endPoint
            : this.model.getRootEndpoint();
    };

    // Return the query string to append to GET requests
    YararamCollection.prototype.getQuery = function () {
        return !_.isEmpty(this.queryStringParts)
            ? '?' + this.getQueryString()
            : '';
    };

    // Return the query string
    YararamCollection.prototype.getQueryString = function () {
        return _.map(this.queryStringParts, function (v,k) { 
            return k + '=' + encodeURIComponent(v);
        }).join('&');
    };

    // Add query string params
    YararamCollection.prototype.query = function (parts) {
        this.queryStringParts = _.extend(this.queryStringParts, parts);
        return this;
    };

    // Reset the query string params
    YararamCollection.prototype.resetQuery = function () {
        this.queryStringParts = {};
        return this;
    };

    // Empty the collection
    YararamCollection.prototype.empty = function () {
        this.models.splice(0, this.length);
        this.length = 0;
        return this;
    };

    // Fetch the collection from the server
    YararamCollection.prototype.$load = function () {

        var _this = this;

        // Prepare the URL where this collection can be fetched from
        var url = this.getEndPoint() + this.getQuery();

        // Fetch the collection
        return $http.get(url).then(function (response) {

            var models = response.data;

            // Empty the collection
            _this.empty();

            // For each model returned by the server
            angular.forEach(models, function (data) {

                // Turn it in to a real model
                var model = new _this.modelClass(data);

                // Add it to the collection
                _this.add(model);

            });

        });

    };

    // Bind events
    YararamCollection.prototype.$on = function (eventName, callback, context) {

        var cache = this._events;

        if (!cache[eventName]) {
            cache[eventName] = [];
        }

        cache[eventName].push([callback, context]);

        return this;

    };

    // Unbind events
    YararamCollection.prototype.$off = function (eventName, callback) {

        var cache = this._events;

        if (!cache[eventName]) {
            return this;
        }

        if (null == callback) {
            delete cache[eventName];
            return this;
        }

        angular.forEach(cache[eventName], function (handler, index) {

            if (handler[0] === callback) {
                cache[eventName].splice(index, 1);
            }

        });

        return this;

    };

    // Emit events
    YararamCollection.prototype.$emit = function (eventName) {

        var args = slice.call(arguments, 1);
        var cache = this._events;

        if (!cache[eventName]) {
            return this;
        }

        angular.forEach(cache[eventName], function (handler) {

            var callback = handler[0];
            var context = handler[1];

            callback.apply(context, args);

        });

        return this;

    };

    return YararamCollection;

}

angular.module('ngYararam').factory('$YararamCollection', $YararamCollection);

})(window, window.angular);