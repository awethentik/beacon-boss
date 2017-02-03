(function() {
  'use strict';

  angular
      .module('ikonnect.services', ['ikonnect.constants'])
      .constant('FirebaseUrl', 'https://kronos-ikonnect.firebaseIO.com/')
      .factory('Auth', Auth)
      .factory('diagnosticServices', diagnosticServices)
      .factory('geoServices', geoServices)
      .factory('bleServices', bleServices)
      //.factory('punchIn', punchIn)
      .factory('empSchedule', empSchedule);


  Auth.$inject = ['FirebaseUrl', '$firebaseAuth'];
  function Auth(FirebaseUrl, $firebaseAuth) {
    var ref = new Firebase(FirebaseUrl);
    return $firebaseAuth(ref);
  }

  empSchedule.$inject = ['FirebaseUrl', '$firebaseObject'];
  function empSchedule(FirebaseUrl, $firebaseObject) {
    var scheduleRef = new Firebase(FirebaseUrl+"schedule");
    return $firebaseObject(scheduleRef);
  }

  diagnosticServices.$inject = ['$rootScope'];
  function diagnosticServices($rootScope) {
    var services = {
      bluetoothStateChange: registerBluetoothStateChangeHandler,
      locationStateChange: registerLocationStateChangeHandler
    };

    function registerBluetoothStateChangeHandler(){
      cordova.plugins.diagnostic.registerBluetoothStateChangeHandler(function(state){
        $rootScope.$emit('$diagnosticService:bluetoothStateChanged', state);
      });
    }

    function registerLocationStateChangeHandler() {
      cordova.plugins.diagnostic.registerLocationStateChangeHandler(function (state) {
        $rootScope.$emit('$diagnosticService:locationStateChanged', state);
      });
    }

    return services;
  }

  geoServices.$inject = ['$q', '$log'];
  function geoServices($q, $log){

    var services = {
      addOrUpdate: addOrUpdate,
      remove: remove,
      removeAll: removeAll,
      initialize: initialize,
      getWatched: getWatched,
      TransitionType: {
        ENTER: 1,
        EXIT: 2,
        BOTH: 3
      }
    };

    return services;

    function addOrUpdate(options) {
      window.geofence.addOrUpdate({
        id:             options.id, //A unique identifier of geofence
        latitude:       options.latitude, //Geo latitude of geofence
        longitude:      options.longitude, //Geo longitude of geofence
        radius:         options.radius, //Radius of geofence in meters
        transitionType: options.transitionType, //Type of transition 1 - Enter, 2 - Exit, 3 - Both
        notification: {         //Notification object
          id:             options.notification.id, //optional should be integer, id of notification
          title:          options.notification.title, //Title of notification
          text:           options.notification.text, //Text of notification
          openAppOnClick: options.notification.openAppOnClick //is main app activity should be opened after clicking on notification
        }
      }).then(function () {
        console.log('Geofence successfully added');
      }, function (reason) {
        console.log('Adding geofence failed', reason);
      });
    }

    function remove(ids) {
      var deferred = $q.defer();
      $log.log("Mocked geofence plugin remove", ids);
      deferred.resolve();
      return deferred.promise;
    }

    function removeAll(ids) {
      var deferred = $q.defer();
      $log.log("Mocked geofence plugin removeAll");
      deferred.resolve();
      return deferred.promise;
    }

    function initialize() {
      window.geofence.initialize().then(function () {
        console.log("Successful initialization");
      }, function (error) {
        console.log("Error", error);
      });
    }

    function getWatched() {
      var deferred = $q.defer();
      window.geofence.getWatched().then(function (geofences) {
        console.log("Watched:", geofences);
        deferred.resolve(geofences);
      });
      return deferred.promise;
    }

  }

  bleServices.$inject = ['$rootScope', '$cordovaBeacon', 'beaconInfo'];
  function bleServices($rootScope, $cordovaBeacon, beaconInfo) {

    var services = {
      requestAlwaysAuthorization: requestAlwaysAuthorization,
      getAuthorizationStatus: getAuthorizationStatus,
      startMonitoringForRegion: startMonitoringForRegion,
      stopMonitoringForRegion: stopMonitoringForRegion,
      startRangingBeaconsInRegion: startRangingBeaconsInRegion,
      stopRangingBeaconsInRegion: stopRangingBeaconsInRegion,
      isBluetoothEnabled: isBluetoothEnabled,
      toggleRanging: toggleRanging
    };

    return services;

    function requestAlwaysAuthorization() {
      $cordovaBeacon.requestAlwaysAuthorization();
    }

    function getAuthorizationStatus() {
      $cordovaBeacon.getAuthorizationStatus();
    }

    //look for any InTouch
    function startMonitoringForRegion() {
      console.log('monitoring started', beaconInfo);
      $cordovaBeacon.startMonitoringForRegion($cordovaBeacon.createBeaconRegion(
          beaconInfo.radIdentifier, beaconInfo.radUuid, '', '', beaconInfo.brNotifyEntryStateOnDisplay
      ));
    }

    function stopMonitoringForRegion() {
      console.log('monitoring stopped');
      $cordovaBeacon.stopMonitoringForRegion($cordovaBeacon.createBeaconRegion(
          beaconInfo.radIdentifier, beaconInfo.radUuid, '', '', beaconInfo.brNotifyEntryStateOnDisplay
      ));
    }

    function startRangingBeaconsInRegion() {
      //console.log('started ranging', beaconInfo);
      $cordovaBeacon.startRangingBeaconsInRegion($cordovaBeacon.createBeaconRegion(
          beaconInfo.brIdentifier, beaconInfo.brUuid, beaconInfo.brMajor, '', beaconInfo.brNotifyEntryStateOnDisplay
      ));
    }

    function stopRangingBeaconsInRegion() {
      //console.log('ranging stopped');
      $cordovaBeacon.stopRangingBeaconsInRegion($cordovaBeacon.createBeaconRegion(
          beaconInfo.brIdentifier, beaconInfo.brUuid, beaconInfo.brMajor, '', beaconInfo.brNotifyEntryStateOnDisplay
      ));
    }

    function isBluetoothEnabled() {
      $cordovaBeacon.isBluetoothEnabled();
    }

    function toggleRanging(status) {
      if (status == 'on') {
        $rootScope.ranging = 'on';
        console.log('ranging on');
        services.startRangingBeaconsInRegion();
      } else if (status == 'off') {
        $rootScope.ranging = 'off';
        console.log('ranging off');
        services.stopRangingBeaconsInRegion();
      }
    }

  }
})();

