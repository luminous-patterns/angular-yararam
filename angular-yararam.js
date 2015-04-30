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
                        $onComplete.bind(window, model),
                        $onError.bind(window, model)
                    );

            case 'save':
                return $http
                    .put(url, data)
                    .then(
                        $onComplete.bind(window, model, options),
                        $onError.bind(window, model, options)
                    );

            case 'create':
                return $http
                    .post(url, data)
                    .then(
                        $onComplete.bind(window, model, options),
                        $onError.bind(window, model, options)
                    );

            case 'delete':
                return $http
                    .delete(url)
                    .then(
                        $onComplete.bind(window, model, options),
                        $onError.bind(window, model, options)
                    );

        }

    }

    function $onComplete (model, response, options) {

        model.$syncing = false;

        // Update the model attributes to match the server
        model.$attributes = model.$parse(response.data);

        // Update the previous attributes
        model.$$previousAttributes = angular.copy(model.$attributes);

        var idAttribute = model.$idAttribute;

        if (idAttribute) {
            model.$id = response.data[idAttribute];
        }

        if (options.onComplete) {
            options.onComplete(model, response);
        }

        return model;

    }

    function $onError (model, response, options) {

        model.$syncing = false;

        // Update the model attributes to match the server
        model.$attributes = model.$parse(response.data);

        // Update the previous attributes
        model.$$previousAttributes = angular.copy(model.$attributes);

        var idAttribute = model.idAttribute;

        if (idAttribute) {
            model.$id = response.data[idAttribute];
        }

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
        this.$idAttribute = 'ID';

        // The model's unique ID
        this.$id = null;

        // Keep track of syncing
        this.$syncing = false;

        // Defaults
        this.$defaults = {};

        // Are we creating a new model or loading an existing one
        if (arguments.length < 1) {
            this.$attributes = {};
        }
        else {

            if (typeof arguments[0] === 'object') {
                this.$attributes = this.$parse(arguments[0]);
                if (this.$idAttribute in this.$attributes) {
                    $setID(this, this.$attributes[this.$idAttribute]);
                }
            }
            else {
                $setID(this, arguments[0]);
                this.$attributes = {};
            }

        }

        // Keep a copy of the original attributes
        this.$$previousAttributes = angular.copy(this.$attributes);

    }

    angular.extend(YararamModel.prototype, {

        $getEndpoint: function () {
            return this.$getRootEndpoint() + '/' + this.$id;
        },

        $getRootEndpoint: function () {
            return this.$endPoint;
        },

        $parse: function (response, options) {
            return response;
        },

        $isNew: function () {
            return this.$id ? false : true;
        },

        $get: function (attr) {
            return attr in this.$attributes ? this.$attributes[attr] : null;
        },

        $set: function (attr, val) {
            this.$attributes[attr] = val;
            return this;
        },

        $undoChanges: function () {
            this.$attributes = angular.copy(this.$$previousAttributes);
            return this;
        },

        $sync: function () {
            return $YararamSync.$sync.apply(this, arguments);
        },

        $delete: function () {
            if (!this.id) {
                return $deleteModel(this);
            }
            return this.$sync('delete');
        },

        $save: function (options) {

            var method = 'save';

            if (this.$isNew()) {
                method = 'create';
            }

            return this
                .$sync(method, options)
                .then(
                    this.$onSyncSuccess.bind(this, options),
                    this.$onSyncError.bind(this, options)
                );

        },

        $load: function (options) {

            if (this.$isNew()) {
                return $q(angular.noop);
            }

            return this
                .$sync('load')
                .then(
                    this.$onSyncSuccess.bind(this, options),
                    this.$onSyncError.bind(this, options)
                );

        },

        $setDefaults: function (defaults) {

            var _this = this;

            this.$defaults = angular.copy(defaults);

            angular.forEach(this.$defaults, function (value, key) {
                if (!_this.$attributes[key]) {
                    _this.$attributes[key] = value;
                }
            });

          return this;

        },

    });

    function $setID (model, ID) {
        model.$id = ID;
    }

    function $onSyncSuccess (response) {
        var attrs = this.$parse(response);
        if (angular.isObject(attrs)) {
            // @TODO: update attributes
        }
    }

    function $onSyncError () {
        // @TODO: handle error
    }

    function $deleteModel (model) {
        model.$attributes = {};
        model.$$previousAttributes = {};
        model.$id = null;
        return this;
    }

    YararamModel.$extend = $extend;

    return YararamModel;

}

angular.module('ngYararam').factory('$YararamModel', $YararamModel);

$YararamCollection.$inject = ['$YararamSync', '$http', '$q'];
function $YararamCollection (  $YararamSync,   $http,   $q) {

    var array = [];
    var slice = array.slice;

    function YararamCollection (options) {

        // Model cache
        this.$models = [];

        // Specify custom end point for loading collection
        if ('endPoint' in options) {
            this.$endPoint = options.$endPoint;
        }

        // Length
        this.$length = 0;

        // Query string for searching
        this.$queryStringParts = {};

    }

    angular.extend(YararamCollection.prototype, {

        // Get a model from the collection by it's index
        $at: function (index) {
            return this.$models[index];
        },

        // Add a model to the collection
        $add: function (model) {

            var _this = this;

            // Add the model to this.models
            this.$models.push(model);

            // Increment length property
            this.$length++;

            return this;

        },

        // Return the end point for this collection
        $getEndPoint: function () {
            var $model = new this.$model;
            return this.$endPoint
                ? this.$endPoint
                : $model.$getRootEndpoint();
        },

        // Return the query string to append to GET requests
        $getQuery: function () {
            return !angular.equals(this.$queryStringParts, {})
                ? '?' + this.$getQueryString()
                : '';
        },

        // Return the query string
        $getQueryString: function () {
            return angular.map(this.$queryStringParts, function (v,k) {
                return k + '=' + encodeURIComponent(v);
            }).join('&');
        },

        // Add query string params
        $query: function (parts) {
            this.$queryStringParts = angular.extend(this.$queryStringParts, parts);
            return this;
        },

        // Reset the query string params
        $resetQuery: function () {
            this.$queryStringParts = {};
            return this;
        },

        // Empty the collection
        $empty: function () {
            this.$models.splice(0, this.$length);
            this.$length = 0;
            return this;
        },

        // Fetch the collection from the server
        $load: function () {

            var _this = this;

            // Prepare the URL where this collection can be fetched from
            var url = this.$getEndPoint() + this.$getQuery();

            // Fetch the collection
            return $http.get(url).then(function (response) {

                var models = response.data;

                // Empty the collection
                _this.$empty();

                // For each model returned by the server
                angular.forEach(models, function (data) {

                    // Turn it in to a real model
                    var model = new _this.$model(data);

                    // Add it to the collection
                    _this.$add(model);

                });

            });

        },

    });

    YararamCollection.$extend = $extend;

    return YararamCollection;

}

angular.module('ngYararam').factory('$YararamCollection', $YararamCollection);

// The helper method to correctly set up the prototype chain for our models and
// collections.  This little gold nugget was snatched with love from the
// backbone.js (http://backbonejs.org/) source.
function $extend (protoProps, staticProps) {

    var parent = this;
    var child;

    // The constructor function for the new subclass is either defined by you
    // (the "constructor" property in your extend definition), or defaulted by
    // us to simply call the parent’s constructor.
    if (protoProps && protoProps.hasOwnProperty('constructor')) {
        child = protoProps.constructor;
    }
    else {
        child = function () {
            return parent.apply(this, arguments);
        };
    }

    // Add static properties to the constructor function, if supplied.
    angular.extend(child, parent, staticProps);

    // Set the prototype chain to inherit from parent, without calling parent's
    // constructor function.
    var Surrogate = function () {
        this.constructor = child;
    };

    Surrogate.prototype = parent.prototype;
    child.prototype = new Surrogate;

    // Add prototype properties (instance properties) to the subclass, if
    // supplied.
    if (protoProps) {
        angular.extend(child.prototype, protoProps);
    }

    // Set a convenience property in case the parent’s prototype is needed
    // later.
    child.__super__ = parent.prototype;

    return child;

}

})(window, window.angular);