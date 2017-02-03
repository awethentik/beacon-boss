(function() {
	'use strict';

	angular
		.module('ikonnect.controllers', ['ikonnect.services', 'ikonnect.constants'])
		.controller('LoginCtrl', LoginCtrl)
		.controller("AppCtrl", AppCtrl)
		.controller('PunchesCtrl', PunchesCtrl)
		.controller('ScheduleCtrl', ScheduleCtrl)
		.controller("BeaconCtrl", BeaconCtrl)
		.controller('BeaconDetailCtrl', BeaconDetailCtrl)
		.constant('FirebaseUrl', 'https://kronos-ikonnect.firebaseIO.com/');

	LoginCtrl.$inject = ['$rootScope', '$firebaseAuth', '$state', 'FirebaseUrl'];
	function LoginCtrl($rootScope, $firebaseAuth, $state, FirebaseUrl) {
		var vm = this;

		var ref = new Firebase(FirebaseUrl);
		vm.auth = $firebaseAuth(ref);

		//console.log(vm.auth.$getAuth());
		$rootScope.auth = vm.auth.$getAuth();

		if($rootScope.auth != null){
			$state.go("mobile.schedule");
		}

		vm.user = {};
		vm.signin = signIn;


		function signIn() {
			vm.auth.$authWithPassword({
				"email": vm.user.email,
				"password": "123456"
			}).then(function(authData) {
				//console.log(authData);
				console.log("Authenticated successfully with payload:", authData);
				$rootScope.auth = authData;
				$state.go("mobile.schedule");
			}).catch(function(error) {
				console.log("Login Failed!", error);
			});
		}

	}

	AppCtrl.$inject = ['$rootScope', '$ionicPlatform', '$cordovaLocalNotification', '$cordovaBatteryStatus', '$state', 'bleServices', 'currentEmp', 'FirebaseUrl'];
	function AppCtrl($rootScope, $ionicPlatform, $cordovaLocalNotification, $cordovaBatteryStatus, $state, bleServices, currentEmp, FirebaseUrl) {

		var vm = this;

		$rootScope.currentEmp = currentEmp;
		$rootScope.ranging = 'off';

		var fb = new Firebase(FirebaseUrl);
		fb = fb.child("users/"+$rootScope.auth.uid+"/");

		$rootScope.$on("$cordovaBatteryStatus:status", function(event, args) {
			$rootScope.battery = {
				"charging": args.isPlugged,
				"level": args.level
			};
		});

		$rootScope.$on('$cordovaLocalNotification:click', function (event, notification, state) {
			var log = fb.child("log/");
			//notification data
			var noteData = JSON.parse(notification.data);
			var today = moment().format("MM-DD-YYYY");
			switch (noteData.type) {
				case 'punch-in':
					//confirm punch
					console.log('punched in');
					var todayIn = fb.child("/schedule/"+today+"/in/");
					todayIn.update({
						"status": "confirmed"
					});
					//$rootScope.currentEmp.schedule[today].in.status = 'confirmed';
					$rootScope.currentEmp.status = 'in';
					//check battery status + record punch transaction
					log.push().set({
						battery: $rootScope.battery,
						transaction: {
							"timestamp": Date.now(),
							"connection":"unknown",
							"type": "punch-in",
							"confirmed": true
						}
					});
					//ranging on
					bleServices.toggleRanging('on');
					//bring to foreground
					$state.go('mobile.beacons');
					break;
				case 'punch-out':
					//search for intouch
					bleServices.startMonitoringForRegion();
					//check battery status + record punch transaction
					log.push().set({
						battery: $rootScope.battery,
						transaction: {
							"timestamp": Date.now(),
							"connection":"unknown",
							"type": "punch-out",
							"confirmed": true
						}
					});
					//setup next segment
					//console.log($rootScope.currentEmp.currentSegment + 1);
					//console.log($rootScope.currentEmp.schedule.shifts.shift.length);
					//console.log(($rootScope.currentEmp.currentSegment + 1) > $rootScope.currentEmp.schedule.shifts.shift.length);

					//not needed for phase 1
					//if (($rootScope.currentEmp.currentSegment + 1) > $rootScope.currentEmp.schedule.shifts.shift.length) {
					//	$rootScope.currentEmp.currentSegment++;
					//	setNext();
					//}
					break;
				case 'start-day':
					//search for intouch
					bleServices.startMonitoringForRegion();
					break;
				default:
					console.log('nope');
			}
		});

		function setNext() {
			setTimeout(function () {
				bleServices.startMonitoringForRegion();
			}, 60000);
		}
	}

	PunchesCtrl.$inject = ['$rootScope', 'bleServices'];
	function PunchesCtrl($rootScope, bleServices) {
		//punch stuff
	}

	ScheduleCtrl.$inject = ['$rootScope', '$ionicPlatform', '$cordovaLocalNotification', 'bleServices', '$cordovaDevice', '$cordovaBeacon', '$firebaseObject', 'FirebaseUrl'];
	function ScheduleCtrl($rootScope, $ionicPlatform, $cordovaLocalNotification, bleServices, $cordovaDevice, $cordovaBeacon, $firebaseObject, FirebaseUrl) {

		var vm = this;
		//fb schedule
		var fb = new Firebase(FirebaseUrl);
		//var scheduleRef = new Firebase("https://kronos-ikonnect.firebaseIO.com/users/"+$rootScope.currentEmp.auth.uid+"/schedule");
		vm.empSchedule = $firebaseObject(fb.child("users/"+$rootScope.auth.uid+"/schedule"));

		$rootScope.currentEmp.schedule = vm.empSchedule;
		//status: out|in|break
		$rootScope.currentEmp.status = 'out';
		//area: unknown|blue|green|red|yellow|purple|cafe
		$rootScope.currentEmp.area = 'unknown';

		function punchStart() {

			console.log('punch start');

			var nowTime = moment();
			var today = moment().format("MM-DD-YYYY");
			//var today = moment(nowTime, "MM-DD-YYYY");
			//$scope.currentEmp.schedule.shifts[0].shift[$scope.currentEmp.currentSegment].in.time = nowTime.format('h:mm A');

			//console.log(today);
			//console.log($rootScope.currentEmp.schedule[today]);

			var scheduledTime = moment($rootScope.currentEmp.schedule[today].in.time, 'h:mm A');
			var inEarly = moment(scheduledTime).subtract(30, 'm');
			var inLate = moment(scheduledTime).add(30, 'm');

			var scheduledOut = moment($rootScope.currentEmp.schedule[today].out.time, 'h:mm A');
			var outEarly = new Date(moment(scheduledOut).subtract(30, 'm'));
			//var outLate = moment(scheduledOut).add(30, 'm');

			if (moment(nowTime).isBetween(inEarly, inLate)) {
				//hold status

				bleServices.stopMonitoringForRegion();

				var timeFormat = moment(nowTime).format('MMMM Do YYYY, h:mm:ss a');

				var currentPunch = {
					'type': 'in',
					'timestamp': timeFormat,
					'clock': 'intouch'
				};

				//record punch timestamp
				$rootScope.currentEmp.punches.push(currentPunch);

				//set notification
				$cordovaLocalNotification.schedule({
					id: 300,
					title: 'Ready to punch-in?',
					text: "Tap to confirm",
					data: {
						'timestamp': nowTime,
						'type': 'punch-in'
					}
				}).then(function (result) {
					//console.log('Punch-in notification triggered');
					//var now = new Date().getTime();
					//var sec_from_now = new Date(now + 600000);
					console.log(outEarly);

					$cordovaLocalNotification.schedule({
						id: 302,
						title: 'Ready to punch-out?',
						text: "Tap to confirm",
						at: outEarly,
						data: {
							'timestamp': nowTime,
							'type': 'punch-out'
						}
					})
				});
			}
		}

		vm.empSchedule.$loaded().then(function() {
			console.log('loaded', vm.empSchedule); // "bar"
			// =========/ Events

			$ionicPlatform.ready(function() {
				//device info
				var device = fb.child("users/"+$rootScope.auth.uid+"/device/");
				var deviceInfo = $cordovaDevice.getDevice();
				device.set(deviceInfo);

				//console.log('ScheduleCtrl ready');
				var schedule = fb.child("users/"+$rootScope.auth.uid+"/schedule/");

				var log = fb.child("users/"+$rootScope.auth.uid+"/log/");
				cordova.plugins.diagnostic.requestLocationAuthorization(function(status){
					//console.log('ble started');
					//console.log("Authorization status is now: "+status);
					schedule.once("value", function(snapshot) {

						snapshot.forEach(function(childSnapshot) {
							var key = childSnapshot.key();
							var notifier  = Number(key.replace('-',''));
							var childData = childSnapshot.val();
							var startDate = key.replace('-','/');
							//var startTime = new Date(startDate +" "+ childData.in.time).getMilliseconds();
							var startTime = Date.parse(startDate +" "+ childData.in.time);
							var notification = {
								id: msgCount,
								title: 'Ready to start your day'+msgCount+'?',
								text: "Tap to confirm",
								//at: startTime,
								data: {
									'timestamp': Date.now(),
									'type': 'start-day'
								}
							}
							console.log(startTime);
							console.log(key, childData.in.time);
							console.log(notification);
							notifications.push(notification);
							msgCount++;
						});
						console.log(notifications);
					});
				}, function(error){
					//console.log('error');
					console.error(error);
				}, 'always');


			});
			$rootScope.$on("$cordovaBeacon:didDetermineStateForRegion", function (event, pluginResult) {
				console.log(pluginResult.state, $rootScope.currentEmp.status);
				if (pluginResult.state === 'CLRegionStateInside' && $rootScope.currentEmp.status === 'out') {
					//change status so duplicate messages don't appear
					$rootScope.currentEmp.status = 'pending';
					//fire punch-in
					punchStart();
				} else if (pluginResult.state === 'CLRegionStateInside' && $rootScope.currentEmp.status === 'in') {
					//change status so duplicate messages don't appear
					$rootScope.currentEmp.status = 'pending';

					var today = moment().format("MM-DD-YYYY");
					var todayOut = fb.child("users/"+$rootScope.auth.uid+"/schedule/"+today+"/out/");
					todayOut.update({
						"status": "confirmed"
					});

					var nowTime = moment().format('MMMM Do YYYY, h:mm:ss a');
					var currentPunch = {
						'type': 'out',
						'timestamp': nowTime,
						'clock': 'intouch'
					}
					$rootScope.currentEmp.punches.push(currentPunch);
					//confirm punch
					//$rootScope.currentEmp.schedule.shifts[0].shift[$rootScope.currentEmp.currentSegment].out.status = 'confirmed';
					//monitoring off
					bleServices.stopMonitoringForRegion();
					//ranging off
					bleServices.toggleRanging('off');
					//change status user is punched out
					$rootScope.currentEmp.status = 'out';
					//go to end of day survey
					var surveyLink = fb.child("users/"+$rootScope.auth.uid+"/survey/");
					window.open(surveyLink, "_blank", "location=yes");

				} else if (pluginResult.state === 'CLRegionStateOutside' && $rootScope.currentEmp.status === 'in') {
					//not intouch detected
					console.log($rootScope.currentEmp.status, "out/in no intouch detected");
				} else if (pluginResult.state === 'CLRegionStateOutside' && $rootScope.currentEmp.status === 'out') {
					//not intouch detected
					console.log($rootScope.currentEmp.status, "out/out no intouch detected");
				}
			});
		});
	}

	BeaconCtrl.$inject = ['$rootScope', 'bleServices', '$state', 'FirebaseUrl'];
	function BeaconCtrl($rootScope, bleServices, $state, FirebaseUrl) {

		var vm = this;
		//beacon stuff
		//console.log(vm);
		vm.currentRegions = {};
		vm.toggleRanging = bleServices.toggleRanging;
		vm.didRangeBeaconsInRegionLog = [];
		vm.assignProximity = assignProximity;
		vm.confirmArea = confirmArea;

		var fb = new Firebase(FirebaseUrl);

		function assignProximity(v) {
			var proximity = v.proximity;
			switch (proximity) {
				case 'ProximityImmediate':
					proximity = 0;
					break;
				case 'ProximityNear':
					proximity = 1;
					break;
				case 'ProximityFar':
					proximity = 2;
					break;
				default:
					proximity = 3;
					break;
			}
			return proximity;
		}

		function confirmArea(minor) {
			var today = moment().format("MM-DD-YYYY");
			var log = fb.child("users/"+$rootScope.auth.uid+"/log/");
			var todayStatus = fb.child("users/"+$rootScope.auth.uid+"/schedule/"+today+"/");
			todayStatus.update({
				"status": "confirmed"
			});
			//$rootScope.currentEmp.schedule[today].status = 'confirmed';
			vm.toggleRanging('off');
			switch(minor){
				case '90':
					//$rootScope.currentEmp.schedule[today].area = 'blue';
					todayStatus.update({
						"area": "blue"
					});
					$rootScope.currentEmp.currentArea = 'blue';
					break;
				case '20':
					//$rootScope.currentEmp.schedule[today].area = 'red';
					todayStatus.update({
						"area": "red"
					});
					$rootScope.currentEmp.currentArea = 'red';
					break;
				case '70':
					//$rootScope.currentEmp.schedule[today].area = 'yellow';
					todayStatus.update({
						"area": "yellow"
					});
					$rootScope.currentEmp.currentArea = 'yellow';
					break;
				case '50':
					//$rootScope.currentEmp.schedule[today].area = 'green';
					todayStatus.update({
						"area": "green"
					});
					$rootScope.currentEmp.currentArea = 'green';
					break;
				case '80':
					//$rootScope.currentEmp.schedule[today].area = 'purple front';
					todayStatus.update({
						"area": "purple front"
					});
					$rootScope.currentEmp.currentArea = 'purple-front';
					break;
				case '100':
					//$rootScope.currentEmp.schedule[today].area = 'purple back';
					todayStatus.update({
						"area": "purple back"
					});
					$rootScope.currentEmp.currentArea = 'purple-back';
					break;
			}

			log.push().set({
				battery: $rootScope.battery,
				transaction: {
					"timestamp": Date.now(),
					"connection":"unknown",
					"type": "area",
					"neighborhood": $rootScope.currentEmp.currentArea,
					"confirmed": true
				}
			});

			$state.go('mobile.schedule');
			vm.currentRegions.beacons = [];
		}

		$rootScope.$on("$cordovaBeacon:didRangeBeaconsInRegion", function (event, pluginResult) {
			vm.currentRegions = pluginResult;
		});

		return vm;
	}

	BeaconDetailCtrl.$inject = ['$stateParams'];
	function BeaconDetailCtrl($stateParams) {
		//detail page placeholder
	}

	function findIndexByKeyValue(obj, key, value) {
		for (var i = 0; i < obj.length; i++) {
			if (obj[i][key] == value) {
				return i;
			}
		}
		return null;
	}


})();
