(function() {
  'use strict';

  angular
      .module('ikonnect', ['ionic', 'ionic.cloud', 'ngCordova', 'firebase', 'ikonnect.controllers', 'ikonnect.services', 'ngAnimate', 'angularMoment'])

      .config(function($ionicCloudProvider) {
          $ionicCloudProvider.init({
              "core": {
                  "app_id": "9661991f"
              }
          });
      })

      .run(function ($ionicPlatform) {
          $ionicPlatform.ready(function () {
              // Hide the accessory bar by default (remove this to show the accessory bar above the keyboard
              // for form inputs)
              if (window.cordova && window.cordova.plugins && window.cordova.plugins.Keyboard) {
                  cordova.plugins.Keyboard.hideKeyboardAccessoryBar(true);
                  cordova.plugins.Keyboard.disableScroll(true);
              }

              if (window.StatusBar) {
                  // org.apache.cordova.statusbar required
                  StatusBar.styleDefault();
              }
          });
      })

      .config(function ($stateProvider, $urlRouterProvider) {

        // Ionic uses AngularUI Router which uses the concept of states
        // Learn more here: https://github.com/angular-ui/ui-router
        // Set up the various states which the app can be in.
        // Each state's controller can be found in controllers.js

        $stateProvider

            .state('login', {
              url: '/login',
              templateUrl: 'templates/login.html',
              controller: 'LoginCtrl',
              controllerAs: 'vm'
              //resolve: {
              //  // controller will not be loaded until $waitForAuth resolves
              //  // Auth refers to our $firebaseAuth wrapper in the example above
              //  "currentAuth": ["Auth",
              //      function (Auth) {
              //          // $waitForAuth returns a promise so the resolve waits for it to complete
              //          return Auth.$waitForAuth();
              //      }]
              //}
            })

          // setup an abstract state for the tabs directive
            .state('mobile', {
                url: '/mobile',
                //abstract: true,
                //cache: false,
                templateUrl: 'templates/mobile.html',
                controller: 'AppCtrl',
                controllerAs: 'vm',
                resolve: {
                    // controller will not be loaded until $requireAuth resolves
                    // Auth refers to our $firebaseAuth wrapper in the example above
                    "currentAuth": ["Auth",
                        function (Auth) {
                            // $requireAuth returns a promise so the resolve waits for it to complete
                            // If the promise is rejected, it will throw a $stateChangeError (see above)
                            return Auth.$requireAuth();
                        }]
                }
            })

            .state('mobile.schedule', {
              url: '/schedule',
              views: {
                'tab-schedule': {
                  templateUrl: 'templates/schedule.html',
                  controller: 'ScheduleCtrl',
                  controllerAs: 'vm',
                  resolve: {
                    // controller will not be loaded until $requireAuth resolves
                    // Auth refers to our $firebaseAuth wrapper in the example above
                    "currentAuth": ["Auth",
                        function (Auth) {
                            // $requireAuth returns a promise so the resolve waits for it to complete
                            // If the promise is rejected, it will throw a $stateChangeError (see above)
                            return Auth.$requireAuth();
                        }]
                    }
                }
              }
            })

            .state('mobile.beacons', {
              url: '/beacons',
              views: {
                'tab-beacons': {
                  templateUrl: 'templates/beacons.html',
                  controller: 'BeaconCtrl as vm'
                }
              }
            })

            .state('mobile.beacons.detail', {
              url: '/beacons/:itemId',
              views: {
                'tab-chats': {
                  templateUrl: 'templates/connection-detail.html',
                  controller: 'BeaconDetailCtrl'
                }
              }
            })

            .state('mobile.punches', {
              url: '/punches',
              views: {
                'tab-punches': {
                  templateUrl: 'templates/punches.html',
                  controller: 'PunchesCtrl as vm'
                }
              }
            })

            .state('mobile.punches.detail', {
              url: '/punches/:itemId',
              views: {
                'tab-chats': {
                  templateUrl: 'templates/connection-detail.html',
                  controller: 'ConnectionDetailCtrl'
                }
              }
            })

        // if none of the above states are matched, use this as the fallback
        $urlRouterProvider.otherwise('/login');

      });
})();
