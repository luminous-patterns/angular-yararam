/**
 * Yet Another REST Active Record Angular Module
 * (c) 2015 Cal Milne
 * @version v0.1.0
 * @link https://github.com/mycetophorae/angular-yararam
 * @license MIT
 */

(function (window, angular, undefined) {'use strict';

angular.module('ngYararam', ['ng']);

$YararamModel.$inject = ['$http', '$q'];
function $YararamModel (  $http,   $q) {

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

    // This is the main function used when syncing the model with the server
    function sync(model, method) {

        if (model.syncing) {
            return $q(angular.noop).then(function() {
                return model;
            });
        }

        var url = method !== 'create' ? model.getEndpoint() : model.getRootEndpoint();
        var data = model.parse(model.attributes);

        var onComplete = function(response) {

            model.syncing = false;

            if (method === 'delete') {
                return deleteModel(model);
            }

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

            return model;

        };

        model.syncing = true;

        switch (method) {

            case 'load':
                return $http.get(url).then(onComplete);

            case 'save':
                return $http.post(url, data).then(onComplete);

            case 'create':
                return $http.post(url, data).then(onComplete);

            case 'delete':
                return $http.delete(url).then(onComplete);

        }

    }

    function setID(model, ID) {
        model.id = ID;
    }

    function deleteModel(model) {
        model.attributes = {};
        model._previousAttributes = {};
        model.id = null;
        model.$emit('delete');
        return this;
    }

    YararamModel.prototype.getEndpoint = function() {
        return this.getRootEndpoint() + '/' + this.id;
    };

    YararamModel.prototype.getRootEndpoint = function() {
        return this.endPoint;
    };

    YararamModel.prototype.parse = function(data) {
        return angular.extend({}, data);
    };

    YararamModel.prototype.isNew = function() {
        return this.id ? false : true;
    };

    YararamModel.prototype.get = function(attr) {
        return attr in this.attributes ? this.attributes[attr] : null;
    };

    YararamModel.prototype.set = function(attr, val) {
        this.attributes[attr] = val;
        return this;
    };

    YararamModel.prototype.undoChanges = function() {
        this.attributes = angular.copy(this._previousAttributes);
        return this;
    };

    YararamModel.prototype.$delete = function() {
        if (!this.id) {
            return deleteModel(this);
        }
        return sync(this, 'delete');
    };

    YararamModel.prototype.$save = function() {

        if (this.isNew()) {
            return sync(this, 'create');
        }

        return sync(this, 'save');

    };

    YararamModel.prototype.$load = function() {

        if (this.isNew()) {
            return $q(angular.noop);
        }

        return sync(this, 'load');

    };

    YararamModel.prototype.$on = function(eventName, callback, context) {

        var cache = this._events;

        if (!cache[eventName]) {
            cache[eventName] = [];
        }

        cache[eventName].push([callback, context]);

        return this;

    };

    YararamModel.prototype.$off = function(eventName, callback) {

        var cache = this._events;

        if (!cache[eventName]) {
            return this;
        }

        angular.forEach(cache[eventName], function(handler, index) {

            if (handler[0] === callback) {
                cache[eventName].splice(index, 1);
            }

        });

        return this;

    };

    YararamModel.prototype.$emit = function(eventName) {
      
        var args = slice.call(arguments, 1);
        var cache = this._events;

        if (!cache[eventName]) {
            return this;
        }

        angular.forEach(cache[eventName], function(handler) {

            var callback = handler[0];
            var context = handler[1];

            callback.apply(context, args);

        });

        return this;

    };

    // Set defaults
    YararamModel.prototype.setDefaults = function(defaults) {

        var self = this;

        this.defaults = angular.copy(defaults);

        angular.forEach(this.defaults, function(value, key) {
            if (!self.attributes[key]) {
                self.attributes[key] = value;
            }
        });

      return this;

    };

    return YararamModel;

}

angular.module('ngYararam').factory('$YararamModel', $YararamModel);

$YararamCollection.$inject = ['$http', '$q'];
function $YararamCollection (  $http,   $q) {

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
    var onModelDelete = function(model) {

        var self = this;

        // Find the deleted model
        angular.forEach(this.models, function(m, index) {

            if (m === model) {

            // Remove it from this.models
            self.models.splice(index, 1);

            // Update the collection length property
            self.length--;

            }

        });

    };

    // Get a model from the collection by it's index
    YararamCollection.prototype.at = function(index) {
        return this.models[index];
    };

    // Add a model to the collection
    YararamCollection.prototype.add = function(model) {

        var self = this;

        // Add the model to this.models
        this.models.push(model);

        // Increment length property
        this.length++;

        // Listen out for when this model is deleted
        model.$on('delete', function() {
            self.$emit('model:delete', model);
        });

        return this;

    };

    // Return the end point for this collection
    YararamCollection.prototype.getEndPoint = function() {
        return this.endPoint
            ? this.endPoint
            : this.model.getRootEndpoint();
    };

    // Return the query string to append to GET requests
    YararamCollection.prototype.getQuery = function() {
        return !_.isEmpty(this.queryStringParts)
            ? '?' + this.getQueryString()
            : '';
    };

    // Return the query string
    YararamCollection.prototype.getQueryString = function() {
        return _.map(this.queryStringParts, function(v,k) { 
            return k + '=' + encodeURIComponent(v);
        }).join('&');
    };

    // Add query string params
    YararamCollection.prototype.query = function(parts) {
        this.queryStringParts = _.extend(this.queryStringParts, parts);
        return this;
    };

    // Reset the query string params
    YararamCollection.prototype.resetQuery = function() {
        this.queryStringParts = {};
        return this;
    };

    // Empty the collection
    YararamCollection.prototype.empty = function() {
        this.models.splice(0, this.length);
        this.length = 0;
        return this;
    };

    // Fetch the collection from the server
    YararamCollection.prototype.$load = function() {

        var self = this;

        // Prepare the URL where this collection can be fetched from
        var url = this.getEndPoint() + this.getQuery();

        // Fetch the collection
        return $http.get(url).then(function(response) {

            var models = response.data;

            // Empty the collection
            self.empty();

            // For each model returned by the server
            angular.forEach(models, function(data) {

                // Turn it in to a real model
                var model = new self.modelClass(data);

                // Add it to the collection
                self.add(model);

            });

        });

    };

    // Bind events
    YararamCollection.prototype.$on = function(eventName, callback, context) {

        var cache = this._events;

        if (!cache[eventName]) {
            cache[eventName] = [];
        }

        cache[eventName].push([callback, context]);

        return this;

    };

    // Unbind events
    YararamCollection.prototype.$off = function(eventName, callback) {

        var cache = this._events;

        if (!cache[eventName]) {
            return this;
        }

        angular.forEach(cache[eventName], function(handler, index) {

            if (handler[0] === callback) {
            cache[eventName].splice(index, 1);
            }

        });

        return this;

    };

    // Emit events
    YararamCollection.prototype.$emit = function(eventName) {

        var args = slice.call(arguments, 1);
        var cache = this._events;

        if (!cache[eventName]) {
            return this;
        }

        angular.forEach(cache[eventName], function(handler) {

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