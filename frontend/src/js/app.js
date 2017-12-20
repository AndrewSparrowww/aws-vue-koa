$(document).ready(function() {
  var router = new VueRouter({
    routes: [{
      name: 'login',
      path: '/login',
      component: importComponent('login/avk-login')
    }, {
      name: 'logout',
      path: '/logout',
      beforeEnter: function(to, from, next) {
        app.state = 'normal';
        next('/login');
      }
    }, {
      name: 'dashboard',
      path: '/dashboard',
      beforeEnter: function(to, from, next) {
        if(app)
          app.buckets_objects = null;
        next();
      },
      components: {
        default: importComponent('buckets/avk-buckets'),
        nav: importComponent('nav/avk-nav')
      }
    }, {
      name: 'buckets-objects',
      path: '/buckets/:bucket',
      components: {
        default: importComponent('buckets-objects/avk-buckets-objects'),
        nav: importComponent('nav/avk-nav')
      }
    }, {
      name: 'upload',
      path: '/upload',
      components: {
        default: importComponent('upload/avk-upload'),
        nav: importComponent('nav/avk-nav')
      }
    }]
  });

  var app = new Vue({
    router: router,
    data: {
      // global
      app_loaded: false,
      app_page: '',
      state: 'normal', // normal, loading, error
      // login
      access_key_id: '',
      secret_access_key: '',
      region: '',
      // dashboard
      buckets: null,
      // buckets objects
      buckets_objects: null,
      list_start_after: [],
      // delete
      deleting: {},
      // upload
      files_to_upload: [],
      selected_acl: 'public-read',
      acl_options: [
        'private',
        'public-read',
        'public-read-write',
        'authenticated-read',
        'aws-exec-read',
        'bucket-owner-read',
        'bucket-owner-full-control'
      ],
    },
    computed: {
      is_loading: function() {
        return this.state === 'loading';
      }
    },
    created: function() {
      this.goToLoginIfUnknownPath();
      this.app_loaded = true;
    },
    methods: {
      navbarGoTo: function(url) {
        if(this.is_loading)
          return false;
        $('.button-collapse').sideNav('hide');
        this.$router.push(url);
      },
      goToDashboard: function() {
        if(this.is_loading)
          return false;
        this.$router.push('/dashboard');
      },
      goToLoginIfUnknownPath: function() {
        var matched = router.getMatchedComponents(location);
        if(!matched.length)
          router.push('/login');
      },
      listObjects: function(bucket, mode) {
        if(app.is_loading)
          return false;
        app.state = 'loading';

        function successResponse(response) {
          return response.json().then(function(buckets_objects) {
            var root = new String(app.$route.params.bucket);
            root.breadcrumbs = '';

            app.buckets_objects = buckets_objects;
            app.buckets_objects.prefix_array = app.buckets_objects.Prefix.split('/').filter(function(identity) {
              return identity;
            });

            app.buckets_objects.prefix_array = [
              root
            ].concat(
              app.buckets_objects.prefix_array.reduce(function(acc, prefix) {
                var pref = new String(prefix);
                acc.push(pref);
                pref.breadcrumbs = acc.join('/') + '/';
                return acc;
              }, [])
            );

            if(bucket.start_after)
              app.list_start_after.push(bucket.start_after);
            else
              app.list_start_after = [];
          }).catch(errorResponse);
        }

        function errorResponse(error) {
          console.log(error);
        }

        function cleanUpResponse() {
          app.state = 'normal';
        }

        if(mode === 'previous') {
          bucket.prefix = bucket.prefix.match(/[^\/]+/g);
          if(bucket.prefix) {
            bucket.prefix.pop();
            bucket.prefix = bucket.prefix.join('/');
            if(bucket.prefix)
              bucket.prefix += '/';
          } else
            bucket.prefix = ''
        }

        var querystring = app.serializeQueryString([
          ['bucket', app.$route.params.bucket],
          ['max_keys', 10],
          ['delimiter', '/'],
          ['prefix', bucket.prefix],
          ['start_after', bucket.start_after || '']
        ]);

        fetch('/api/list_objects?' + querystring).then(function(response) {
          return response.status === 200
            ? successResponse(response)
            : errorResponse(response)
        }).then(cleanUpResponse);
      },
      nextPage: function() {
        app.listObjects({
          prefix: app.buckets_objects.Prefix,
          start_after: [].concat(
            app.buckets_objects.CommonPrefixes.map(function(p) { return p.Prefix; }),
            app.buckets_objects.Contents.map(function(c) { return c.Key; })
          ).pop()
        });
      },
      previousPage: function() {
        app.listObjects({
          prefix: app.buckets_objects.Prefix,
          start_after: (app.list_start_after.pop(), app.list_start_after.pop())
        });
      },
      getObject: function(content) {
        var querystring = app.serializeQueryString([
          ['bucket', app.$route.params.bucket],
          ['key', content.Key]
        ]);

        window.open('/api/get_object/' + content.Key + '?' + querystring);
      },
      serializeQueryString: function(qs) {
        return [
          ['access_key_id', app.access_key_id],
          ['secret_access_key', app.secret_access_key],
          ['region', app.region]
        ].concat(qs).reduce(function(acc, query) {
          return acc.concat(encodeURIComponent(query[0]) + '=' + encodeURIComponent(query[1]));
        }, []).join('&');
      }
    }
  }).$mount('#app');

  router.afterEach(function(to, from) {
    router.app.state = 'normal';
    router.app.app_page = to.name;
    router.app.goToLoginIfUnknownPath();
  });

  // Bugfix: if the hash does not start with "#/" vue-router will not process it properly.
  window.addEventListener('hashchange', function(event) {
    if(!/#\//.test(event.newURL))
      location = event.newURL.replace(/#(.)/, '#/$1');
  });
});
