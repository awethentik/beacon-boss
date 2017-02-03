(function() {
	'use strict';

	angular
		.module('ikonnect.controllers',
			['ikonnect.services', 'ikonnect.constants', 'ikonnect.filters', 'ionic.cloud'])
		.controller('LoginCtrl', LoginCtrl)
		.controller("AppCtrl", AppCtrl)
		.constant('FirebaseUrl', 'https://kronos-ikonnect.firebaseIO.com/');



	LoginCtrl.$inject = ['$rootScope', '$firebaseAuth', '$state', '$ionicHistory', '$ionicLoading', '$ionicPopup', 'FirebaseUrl'];
	function LoginCtrl($rootScope, $firebaseAuth, $state, $ionicHistory, $ionicLoading, $ionicPopup, FirebaseUrl) {
		var vm = this;

		var ref = new Firebase(FirebaseUrl);
		vm.auth = $firebaseAuth(ref);

		vm.auth.$onAuth(function(authData) {
			if (authData) {
				$state.go("mobile");
			} else {
				console.log("Client unauthenticated.")
			}
		});

		vm.user = {};
		vm.signin = signIn;
		vm.authData = ref.getAuth();

		$ionicHistory.nextViewOptions({
			historyRoot: true
		});

		function signIn() {
			$ionicLoading.show({
				content: 'Signing in...',
				animation: 'fade-in',
				showBackdrop: false,
				maxWidth: 200,
				showDelay: 0
			});
			vm.auth.$authWithPassword({
				"email": vm.user.email,
				"password": "123456"
			}).then(function(authData) {
				$ionicLoading.hide();
				$rootScope.auth = authData;
				$state.go("mobile");
			}).catch(function(error) {
				$ionicLoading.hide();
				$ionicPopup.alert({
					title: "Oops! Can't login.",
					template: "Try again using your Kronos email address."
				});
				console.log("Login Failed!", error);
			});
		}
	}

	AppCtrl.$inject = ['$rootScope', '$scope', '$window', '$filter', '$ionicPlatform', '$ionicDeploy', '$ionicModal', '$ionicLoading', '$ionicPopup', '$cordovaDevice', '$cordovaLocalNotification', '$cordovaToast', '$cordovaBatteryStatus', 'bleServices', '$cordovaNetwork', '$cordovaInAppBrowser', '$firebaseObject', 'FirebaseUrl', 'currentAuth', 'diagnosticServices'];
	function AppCtrl($rootScope, $scope, $window, $filter, $ionicPlatform, $ionicDeploy, $ionicModal, $ionicLoading, $ionicPopup, $cordovaDevice, $cordovaLocalNotification, $cordovaToast, $cordovaBatteryStatus, bleServices, $cordovaNetwork, $cordovaInAppBrowser, $firebaseObject, FirebaseUrl, currentAuth, diagnosticServices) {

		var vm = this;

		$rootScope.ranging = 'off';
		getDayColor();

		$ionicLoading.show({
			content: 'Loading',
			animation: 'fade-in',
			showBackdrop: true,
			maxWidth: 200,
			showDelay: 0
		});

		$ionicDeploy.channel = 'staging';
		$ionicDeploy.check().then(function(snapshotAvailable) {
			// When snapshotAvailable is true, you can apply the snapshot
			if (snapshotAvailable){
				$ionicDeploy.download().then(function() {
					return $ionicDeploy.extract();
				}).then(function(){
					return $ionicPopup.show({
						title: 'Update available',
						subTitle: 'An update was just downloaded. Would you like to restart your app to use the latest features?',
						buttons: [
							{ text: 'Not now' },
							{
								text: 'Restart',
								onTap: function(e) {
									$ionicDeploy.load();
								}
							}
						]
					});
				});
			}
		});

		$ionicPlatform.ready(function() {
			$ionicPlatform.on('pause', function() {
				vm.appStatus = 'paused';
				//console.log('paused');
			});

			$ionicPlatform.on('resume', function () {
				if (vm.empSchedule && vm.appStatus == 'paused') {
					//console.log('resuming now');
					vm.appStatus == 'active';
					vm.today = moment().format("MM-DD-YYYY");
					vm.currentDay = currentUser.child("/schedule/" + vm.today);
					vm.log = fb.child("log/" + currentAuth.uid + "/" + vm.today);

					vm.resetView();

					vm.log.push().set({
						battery: $rootScope.battery,
						transaction: {
							"timestamp": moment().format("MM-DD-YYYY hh:mm a"),
							"connection": $rootScope.connection,
							"type": "app resumed"
						}
					});
				}
			});
		});

		var fb = new Firebase(FirebaseUrl);
		var currentUser = fb.child("users/"+currentAuth.uid);
		var schedule = currentUser.child("schedule");
		vm.empSchedule = $firebaseObject(schedule);

		//vm.lastUpdated = moment();
		vm.appVersion = '0.7.1';
		currentUser.update({
			"app": {
				"version": vm.appVersion
			}
		});


		vm.today = moment().format("MM-DD-YYYY");
		vm.log = fb.child("log/"+currentAuth.uid+"/"+vm.today);
		vm.currentDay = currentUser.child("schedule/"+vm.today);
		vm.currentUser = currentUser.child("user");
		vm.user = $firebaseObject(vm.currentUser);
		vm.dayCompare = $filter('dayCompare');
		vm.intouchState = "inactive";

		vm.resetView = resetView;
		function resetView(){
			vm.intouchState = "inactive";
			bleServices.stopMonitoringForRegion();
			bleServices.stopRangingBeaconsInRegion();
			// setup next
			vm.setupSegment();
			// check status
			vm.checkSegment();
			//get day color
			getDayColor();
		}

		vm.takeSurvey = takeSurvey;
		function takeSurvey(day){

			//update shift status
			vm.currentDay.child('survey').update({"taken": true});

			//check battery status + record punch transaction
			vm.log.push().set({
				battery: $rootScope.battery,
				transaction: {
					"timestamp": moment().format("MM-DD-YYYY hh:mm a"),
					"connection": $rootScope.connection,
					"type": "take survey " + day,
					"confirmed": true
				}
			});

			if (ionic.Platform.isAndroid()){
				vm.surveyOptions = {
					location: 'no',
					clearcache: 'no',
					toolbar: 'yes'
				};
			}

			if (ionic.Platform.isIOS()){
				vm.surveyOptions = {
					location: 'no',
					clearcache: 'no',
					toolbar: 'yes'
				};
			}

			$cordovaInAppBrowser.open(vm.survey.link, "_self", vm.surveyOptions);
		}

		vm.groups = {};
		vm.empSchedule.$loaded().then(function(data){
			if (!vm.user.notifications) {
				//console.log('setup notes');
				vm.setNotifications(data);
			}

			angular.forEach(data, function(value, key) {
				if (vm.dayCompare(key) == "Today"){
					vm.groups[key] = true;
				} else {
					vm.groups[key] = false;
				}
			});
		});

		vm.createSegment = createSegment;
		function createSegment() {
			//transfer time
			var shortTime = moment().format("h:mm a");
			var timestamp = moment().format("MM-DD-YYYY hh:mm a");
			var segment = {
				"location" : {
					id: false,
					label: false
				},
				"in" : {
					"time" : shortTime,
					"timestamp": timestamp,
					"type" : "transfer",
					"location": "none"
				},
				"out" : {
					"time" : moment(vm.scheduledOut).format("h:mm a"),
					"type" : vm.empSchedule[vm.today].segments[vm.currentSegment].out.type

				},
				"status": "working"
			};

			console.log(vm.segmentPriority, vm.totalSegments);

			if (vm.segmentPriority != vm.totalSegments) {
				//not last segment

				//new sub-segment
				var increment = Number(0.1);
				console.log(increment);
				var newPriority = Number(vm.segmentPriority) + Number(increment);
				console.log('new p middle', newPriority);

				//update last segment priority to match length
				vm.currentDay.child('segments').orderByPriority().limitToLast(1).on("value", function(snapshot){
					var key = Object.keys(snapshot.val())[0];
					vm.currentDay.child('segments/'+key).setPriority(vm.totalSegments+1, function(){
						console.log('last segment updated');
					});
				});

			} else {
				//last segment
				console.log('last segment', segment);
				var increment = Number(1);
				console.log(increment);
				var newPriority = Number(vm.totalSegments) + Number(increment);
				console.log('new p end', newPriority);
			}
			//create new empty segment in database
			var newSegment = vm.currentDay.child('segments').push(segment);
			//set new segment
			newSegment.setPriority(newPriority, function(error) {
				//close out current segment
				var oldSegment = {
					"time" : shortTime,
					"timestamp": timestamp,
					"type" : "transfer"
				}
				vm.currentDay.child('segments/'+vm.currentSegment+'/out').set(oldSegment);
				vm.currentDay.child('segments/'+vm.currentSegment+'/status').set("completed");
				// turn on ranging and open beacon modal
			}).then(function(){
				vm.openModal();
			});

		}

		vm.toggleGroup = toggleGroup;
		function toggleGroup(group) {
			vm.groups[group] = !vm.groups[group];
		}

		vm.getDayColor = getDayColor;
		function getDayColor(){
			var timeOfDay = 'morning';
			var currentHour = moment().hour();
			if (currentHour < 12){
				timeOfDay = 'morning';
			} else if (currentHour >= 12 && currentHour < 17){
				timeOfDay = 'afternoon';
			} else {
				timeOfDay = 'night';
			}
			vm.dayColor = timeOfDay;
		}

		$ionicModal.fromTemplateUrl('templates/beacons.html', {
			scope: $scope,
			animation: 'slide-in-up'
		}).then(function(modal) {
			vm.modal = modal;
		});
		vm.openModal = function() {
			bleServices.toggleRanging('on');
			vm.modal.show();
		};
		vm.closeModal = closeModal;
		function closeModal() {
			bleServices.toggleRanging('off');
			vm.modal.hide();
			if (vm.segmentType == "transfer"){
				$cordovaToast.showLongBottom('Transfer Complete!');
			} else {
				$cordovaToast.showLongBottom('Location Recorded!');
			}
		};

		vm.setupSegment = setupSegment;
		function setupSegment(){
			vm.currentDay.child('segments').once("value", function(snapshot) {
				var counter = 1;
				var timestamp = moment();
				vm.currentSegment = "";
				vm.priorSegment = "";
				vm.totalSegments = snapshot.numChildren();
				snapshot.forEach(function(childSnapshot) {
					//get segment key and area
					vm.currentSegment = childSnapshot.key();
					vm.currentArea = vm.empSchedule[vm.today].segments[vm.currentSegment].location.id;
					//setup in time
					vm.inTimeStamp = childSnapshot.child('in/timestamp').exists();
					vm.scheduledIn = moment(vm.empSchedule[vm.today].segments[vm.currentSegment].in.time, 'h:mm A');
					vm.inEarly = moment(vm.scheduledIn).subtract(10, 'm');
					vm.inLate = moment(vm.scheduledIn).add(10, 'm');
					//setup out time
					vm.outTimeStamp = childSnapshot.child('out/timestamp').exists();
					vm.scheduledOut = moment(vm.empSchedule[vm.today].segments[vm.currentSegment].out.time, 'h:mm A');
					vm.outEarly = moment(vm.scheduledOut).subtract(10, 'm');
					vm.outLate = moment(vm.scheduledOut).add(10, 'm');
					//get priority and segment type
					vm.segmentPriority = childSnapshot.getPriority();
					vm.segmentType = vm.empSchedule[vm.today].segments[vm.currentSegment].out.type;

					if (counter < vm.totalSegments && moment(timestamp).isBefore(vm.outLate) && !vm.outTimeStamp) {
						//any uncompleted segment + time hasn't passed
						console.log(vm.segmentPriority, 'Loop is going to break.');
						if (!vm.inTimeStamp){
							//new segment so punch-in first
							//reset shift status and available action to unstarted
							//console.log('reset', vm.inTimeStamp);
							vm.availableAction = '';
						}
						counter++;
						return true;

					} else if (counter == vm.totalSegments) {
						//last segment
						console.log(vm.segmentPriority, 'Loop is going to break for end of day.');
						counter++;
						//make sure last segment's priority is in-sync with # of segments
						vm.currentDay.child('segments/'+vm.currentSegment).setPriority(vm.totalSegments, function(){
							//console.log('last segment updated to match length');
						});
						return true;

					} else {
						console.log(vm.segmentPriority, 'Loop is going to continue.');
						//set prior segment key to determine shift status
						vm.priorSegment = vm.currentSegment;
						counter++;
					}
				});
			});

		}


		vm.punchIn = punchIn;
		function punchIn(day) {
			//turn off intouch monitoring
			bleServices.stopMonitoringForRegion();
			vm.intouchState = "inactive";
			vm.availableAction = '';

			//turn on ranging and open beacon modal
			vm.openModal();

			//check battery status + record punch transaction
			vm.log.push().set({
				battery: $rootScope.battery,
				transaction: {
					"timestamp": moment().format("MM-DD-YYYY hh:mm a"),
					"connection": $rootScope.connection,
					"type": "stop-intouch-punch-in",
					"confirmed": true
				}
			});

			//confirm to user + save to DB
			$cordovaToast.showLongBottom('Punch Accepted!').then(function(success) {
				// success
				// record timestamp
				vm.currentDay.child('segments/'+vm.currentSegment+'/in').update({
					"timestamp": moment().format("MM-DD-YYYY hh:mm a")
				});

				//change segment status to working
				vm.currentDay.child('segments/'+vm.currentSegment).update({
					"status": "working"
				});

				//check status
				vm.checkSegment();

			}, function (error) {
				// error
			});

			//remove local notification
			var notificationId = vm.today.replace(/-/g,'');
			$cordovaLocalNotification.clear(notificationId+"1");
		}

		vm.punchOut = punchOut;
		function punchOut(day) {
			//turn off intouch monitoring
			bleServices.stopMonitoringForRegion();
			//vm.empStatus = 'stopped';
			vm.intouchState = "inactive";
			vm.availableAction = '';

			//check battery status + record punch transaction
			vm.log.push().set({
				battery: $rootScope.battery,
				transaction: {
					"timestamp": moment().format("MM-DD-YYYY hh:mm a"),
					"connection": $rootScope.connection,
					"type": "punch-out",
					"confirmed": true
				}
			});

			$cordovaToast.showLongBottom('Punch Accepted!').then(function(success) {
				// success
				// record timestamp
				vm.currentDay.child('segments/'+vm.currentSegment+'/out').update({
					"timestamp": moment().format("MM-DD-YYYY hh:mm a")
				});

				//change segment status to working
				vm.currentDay.child('segments/'+vm.currentSegment).update({
					"status": "completed"
				});

				//setup next
				vm.setupSegment();

			}, function (error) {
				// error
			});

			//remove local notification
			var notificationId = vm.today.replace(/-/g,'');
			$cordovaLocalNotification.clear(notificationId+"2");
		}

		vm.transfer = transfer;
		function transfer(t) {
			console.log('transferring');
			if (t == "planned"){
				var timestamp = moment().format("MM-DD-YYYY hh:mm a");
				//complete existing and move to next segment
				vm.currentDay.child('segments/'+vm.currentSegment+'/out').update({
					"timestamp": timestamp
				});

				//check battery status + record punch transaction
				vm.log.push().set({
					battery: $rootScope.battery,
					transaction: {
						"timestamp": moment().format("MM-DD-YYYY hh:mm a"),
						"connection": $rootScope.connection,
						"type": "transfer-planned"
					}
				});

				$cordovaToast.showLongBottom('Transfer Complete!').then(function(success) {
					// success
					// get next segment id + check in
					//vm.currentDay.child('segments').orderByPriority.startAt(vm.currentSegment).on("value", function(snapshot){
					//	var key = snapshot.key();
					//	console.log(key);
					//	snapshot.forEach(function(data) {
					//		console.log("The key is " + data.key());
					//	});
					//});

					//change segment status to working
					vm.currentDay.child('segments/'+vm.currentSegment).update({
						"status": "completed"
					});

					vm.currentDay.child('segments').orderByKey().startAt(vm.currentSegment).limitToFirst(2).on("child_added", function(snapshot) {
						//get next segment key
						var nextSegment = snapshot.key();
						if(vm.currentSegment != nextSegment){
							//set timestamp in
							vm.currentDay.child('segments/'+nextSegment+'/in').update({
								"timestamp": timestamp
							});
						}
						//console.log(snapshot.key(), snapshot.val());
					});

					// setup next
					vm.setupSegment();
					// check status
					vm.checkSegment();
					// turn on ranging and open beacon modal
					vm.openModal();

				}, function (error) {
					// error
				});
			} else {
				//start new segment
				vm.createSegment();
			}
		}

		vm.turnOffMonitoring = turnOffMonitoring;
		function turnOffMonitoring() {
			console.log('turn off monitoring');
			bleServices.stopMonitoringForRegion();
			vm.intouchState = "inactive";
			//reset back to previous status
			vm.availableAction = "";
		}

		vm.doRefresh = doRefresh;
		function doRefresh() {
			//console.log('refreshed');
			vm.today = moment().format("MM-DD-YYYY");
			vm.currentDay = currentUser.child("/schedule/"+vm.today);
			vm.log = fb.child("log/"+currentAuth.uid+"/"+vm.today);

			vm.resetView();

			vm.log.push().set({
				battery: $rootScope.battery,
				transaction: {
					"timestamp": moment().format("MM-DD-YYYY hh:mm a"),
					"connection": $rootScope.connection,
					"type": "app refreshed"
				}
			});
			//Stop the ion-refresher from spinning
			$scope.$broadcast('scroll.refreshComplete');
		}

		vm.setNotifications = setNotifications;
		function setNotifications(schedule) {
			//set notification
			//console.log('called set notifications');
			var notifications = [];

			angular.forEach(schedule, function(value, key) {

				var notificationId = key.replace(/-/g,'');

				//console.log(value, key);
				var counter = 0;

				angular.forEach(value.segments, function(s, n) {

					console.log(s, n);

					//setup punch-in notification
					var startId = notificationId+counter+"1";
					var startTime = moment(key+" "+s.in.time, "MM-DD-YYYY hh:mm a").subtract(5, 'm');
					//console.log(startTime);
					if (s.in.type == "punch"){
						//punch
						var startShift = {
							id: Number(startId),
							title: 'Your shift starts '+ s.in.location +' at '+s.in.time,
							text: "Open app to punch in.",
							at: startTime.toDate(),
							data: {
								'type': 'punch-in'
							}
						};
					} else {
						//transfer
						var startShift = {
							id: Number(startId),
							title: 'Transfer to '+ s.in.location +' at '+s.in.time,
							text: "Open app to transfer.",
							at: startTime.toDate(),
							data: {
								'type': 'transfer-in'
							}
						};
					}
					notifications.push(startShift);

					//setup punch-out notification
					if (s.out.type == "punch"){
						var endId = notificationId+counter+"2";
						var endTime = moment(key+" "+s.out.time, "MM-DD-YYYY hh:mm a").subtract(5, 'm');
						//console.log(endTime);
						var endShift = {
							id: Number(endId),
							title: 'Your shift ends at '+s.out.time,
							text: "Open app to punch out.",
							at: endTime.toDate(),
							data: {
								'type': 'punch-out'
							}
						};
						notifications.push(endShift);
					}
					counter++;

				});
			});

			$cordovaLocalNotification.schedule(notifications);
			//update notification status
			vm.currentUser.update({
				"notifications": true
			});
		}

		vm.bluetoothMsg = {
			title: "Oops! Looks like your bluetooth is currently off.",
			template: "Enable/switch on your bluetooth to take advantage of this apps features."
		};

		vm.locationMsg = {
			title: "Oops! Looks like your location services are currently off.",
			template: "Enable/switch on your location to take advantage of this apps features."
		}

		vm.featurePopup = function(msg){
			vm.alertPopup = $ionicPopup.alert(msg);
		};

		vm.popupClose = function(){
			vm.alertPopup.close();
		};

		vm.currentRegions = {};
		vm.didRangeBeaconsInRegionLog = [];
		//vm.colorFilter = colorFilter;
		vm.area = "";

		vm.assignProximity = assignProximity;
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

		vm.confirmArea = confirmArea;
		function confirmArea(minor) {
			//turn off beacon ranging
			bleServices.toggleRanging('off');

			//reset beacons list
			vm.currentRegions.beacons = [];
			//get current segment
			vm.setupSegment();

			//console.log('minor', minor);
			vm.currentArea = minor;
			minor = Number(minor);

			//update work neighborhood color + status
			switch(minor){
				case 90:
					vm.area = "blue";
					break;
				case 20:
					vm.area = "red-north";
					break;
				case 21:
					vm.area = "red-south";
					break;
				case 70:
					vm.area = "yellow";
					break;
				case 50:
					vm.area = "green";
					break;
				case 80:
					vm.area = "purple-west";
					break;
				case 100:
					vm.area = "purple-east";
					break;
				default:
					vm.area = "unknown";
			}

			vm.currentDay.child('segments/'+vm.currentSegment).update({
				"location": {
					"id": minor,
					"label": vm.area
				}
			});

			//close modal after selection
			vm.closeModal();

			//record work neighborhood selection
			vm.log.push().set({
				battery: $rootScope.battery,
				transaction: {
					"timestamp": moment().format("MM-DD-YYYY hh:mm a"),
					"connection": $rootScope.connection,
					"type": "location",
					"location": vm.area
				}
			});

			//$state.go('mobile.schedule');
		}

		vm.checkBluetooth = checkBluetooth;
		function checkBluetooth(){
			cordova.plugins.diagnostic.getBluetoothState(function(state){
				console.log('bluetooth:', state);
				vm.bluetoothState = state;
				diagnosticServices.bluetoothStateChange();
				if(state === cordova.plugins.diagnostic.bluetoothState.POWERED_ON){
					console.log("Bluetooth is able to connect");
				} else if (state != 'unknown'){
					vm.featurePopup(vm.bluetoothMsg);
				}
			}, function(error){
				console.error(error);
			});
		}

		vm.checkLocation = checkLocation;
		function checkLocation(){
			cordova.plugins.diagnostic.isLocationEnabled(function(state){
				console.log('location:', state);
				vm.locationState = state;
				diagnosticServices.locationStateChange();
				if(state === true){
					console.log("Location is turned on");
				} else {
					vm.featurePopup(vm.locationMsg);
				}
			}, function(error){
				console.error(error);
			});
		}

		vm.checkSegment = checkSegment;
		function checkSegment(){
			var timestamp = moment();
			//start logic
			if(moment(timestamp).isBefore(vm.inEarly)) {
				//early - show modal
				vm.earlyMsg = {
					title: "Hey looks like your early",
					template: "You can't punch in until " + moment(vm.inEarly).format("h:mm a")
				};
				vm.featurePopup(vm.earlyMsg);
				vm.log.push().set({
					battery: $rootScope.battery,
					transaction: {
						"timestamp": moment().format("MM-DD-YYYY hh:mm a"),
						"connection": $rootScope.connection,
						"type": "early-arrival",
						"confirmed": false
					}
				});
			} else {
				if (vm.empSchedule[vm.today].segments[vm.currentSegment].status == 'working' && moment(timestamp).isBefore(vm.outEarly)) {
					console.log('offer new transfer');
					vm.availableAction = "new-transfer";
				} else if (vm.empSchedule[vm.today].segments[vm.currentSegment].status == 'completed' && vm.segmentPriority === vm.totalSegments && !vm.empSchedule[vm.today].survey.taken) {
					vm.availableAction = "survey";
				} else {
					//reset
					vm.intouchState = 'CLRegionStateOutside';
					//look for intouch
					bleServices.startMonitoringForRegion();
					//check battery status + record transaction
					vm.log.push().set({
						battery: $rootScope.battery,
						transaction: {
							"timestamp": moment().format("MM-DD-YYYY hh:mm a"),
							"connection": $rootScope.connection,
							"type": "start-intouch-search",
							"confirmed": false
						}
					});
				}
			}
		}

		vm.empSchedule.$loaded().then(function() {
			$ionicLoading.hide();

			vm.survey = $firebaseObject(vm.currentDay.child("survey"));

			vm.currentDay.once("value", function(snapshot) {
				var scheduled = snapshot.exists();
				if (scheduled) {
					$ionicPlatform.ready(function() {
						//device info
						var device = currentUser.child("device");
						var deviceInfo = $cordovaDevice.getDevice();
						device.set(deviceInfo);

						//check bluetooth status
						vm.checkBluetooth();

						//check location status
						vm.checkLocation();

						cordova.plugins.diagnostic.isLocationAuthorized(function(enabled){
							if (enabled){
								console.log('location authorized');
								$ionicLoading.hide();
								vm.setupSegment();
								vm.checkSegment();
							} else {
								cordova.plugins.diagnostic.requestLocationAuthorization(function(status){
									console.log('loc status post request', status);
									$ionicLoading.hide();
									vm.setupSegment(1);
									vm.checkSegment();
								}, function(error){
									console.error(error);
								}, 'always');
							}
						}, function(error){
							console.error("The following error occurred: "+error);
						});

					});
				}
			});

			//$rootScope.$on('$cordovaInAppBrowser:exit', function(e, event){
			//	ionic.Platform.exitApp();
			//});

			$rootScope.$on('$diagnosticService:bluetoothStateChanged', function(e, event){
				//set new bluetooth state
				vm.bluetoothState = event;
				if (vm.bluetoothState === 'powered_on'){
					//close dialog
					vm.popupClose();
				} else if (vm.bluetoothState === 'powered_off') {
					//open dialog
					vm.featurePopup(vm.bluetoothMsg);
				}
			});

			$rootScope.$on('$diagnosticService:locationStateChanged', function(e, event){
				//console.log(event);
				//set new location state
				vm.locationState = event;
				if((device.platform === "Android" && vm.locationState !== cordova.plugins.diagnostic.locationMode.LOCATION_OFF) || (device.platform === "iOS") && (vm.locationState === cordova.plugins.diagnostic.permissionStatus.GRANTED || vm.locationState === cordova.plugins.diagnostic.permissionStatus.GRANTED_WHEN_IN_USE)){
					//close dialog
					vm.popupClose();
				} else {
					//open dialog
					vm.featurePopup(vm.locationMsg);
				}

			});

			$rootScope.$on("$cordovaBeacon:didRangeBeaconsInRegion", function (event, pluginResult) {
				vm.currentRegions = pluginResult;
				//console.log(vm.currentRegions.beacons);
				//console.log(vm.currentRegions.beacons[0].minor, vm.currentArea);
				//console.log(Number(vm.currentRegions.beacons[0].minor) == vm.currentArea);
			});

			$rootScope.$on("$cordovaBeacon:didDetermineStateForRegion", function (event, pluginResult) {
				//console.log(pluginResult.state, vm.empSchedule[vm.today].status);
				var timestamp = moment();
				vm.intouchState = pluginResult.state;

				if (vm.intouchState === 'CLRegionStateInside') {
					if (moment(timestamp).isBetween(vm.inEarly, vm.outEarly) && vm.empSchedule[vm.today].segments[vm.currentSegment].in.timestamp === undefined){
						//starting segment
						//console.log('in ontime', 'let punch-in');
						vm.availableAction = "punch-in";
					//} else if (moment(timestamp).isBetween(vm.inLate, vm.outEarly) && vm.empSchedule[vm.today].segments[vm.currentSegment].in.timestamp === undefined) {
					//	//starting segment late
					//	console.log('late in-time','let punch-in');
					//	vm.availableAction = "punch-in";
					} else if (moment(timestamp).isBetween(vm.outEarly, vm.outLate) && vm.empSchedule[vm.today].segments[vm.currentSegment].out.timestamp === undefined) {
						//ending segment
						//console.log('out ontime');
						if (vm.segmentType == 'transfer'){
							//turn off intouch monitoring
							bleServices.stopMonitoringForRegion();
							//show transfer button
							//console.log('planned transfer');
							vm.availableAction = "planned-transfer";
						} else {
							//show punch out button
							//console.log('punch-out');
							vm.availableAction = "punch-out";
						}
					} else if (moment(timestamp).isAfter(vm.outLate) && vm.segmentPriority === vm.totalSegments && vm.empSchedule[vm.today].segments[vm.currentSegment].out.timestamp === undefined) {
						//last segment - ending day late
						//console.log('last segment - ending day late','let punch-out');
						vm.availableAction = "punch-out";
					} else {
						//turn off intouch monitoring
						bleServices.stopMonitoringForRegion();
						//console.log('all set - offer new-transfer');
						vm.availableAction = "new-transfer";
					}
				}
			});
		});

		$ionicPlatform.ready(function() {

			$rootScope.connection = $cordovaNetwork.getNetwork();
			$rootScope.battery = {
				"charging": $window.navigator.battery._isPlugged,
				"level": $window.navigator.battery._level
			};

			//$rootScope.$on('$cordovaLocalNotification:schedule', function (event, notification, state) {
			//	console.log('schedule', notification);
			//});
			//$rootScope.$on('$cordovaLocalNotification:trigger', function (event, notification, state) {
			//	console.log('trigger', notification);
			//});

			$rootScope.$on('$cordovaLocalNotification:click', function (event, notification, state) {
				//notification data
				var noteData = JSON.parse(notification.data);
				switch (noteData.type) {
					case 'punch-in':
						//fire punch-in
						//punchIn();
						//ranging on
						//bleServices.toggleRanging('on');
						//bring to foreground
						//$state.go('mobile');
						vm.log.push().set({
							battery: $rootScope.battery,
							transaction: {
								"timestamp": moment().format("MM-DD-YYYY hh:mm a"),
								"connection": $rootScope.connection,
								"type": "punch-in-notification",
								"confirmed": true
							}
						});
						break;
					case 'punch-out':
						//check battery status + record punch transaction
						vm.log.push().set({
							battery: $rootScope.battery,
							transaction: {
								"timestamp": moment().format("MM-DD-YYYY hh:mm a"),
								"connection": $rootScope.connection,
								"type": "punch-out-notification",
								"confirmed": false
							}
						});
						break;
					case 'late-punch-in':
						//check battery status + record punch transaction
						vm.log.push().set({
							battery: $rootScope.battery,
							transaction: {
								"timestamp": moment().format("MM-DD-YYYY hh:mm a"),
								"connection": $rootScope.connection,
								"type": "late punch-in",
								"confirmed": false
							}
						});
						break;
					case 'start-work':
						//check battery status + record transaction
						vm.log.push().set({
							battery: $rootScope.battery,
							transaction: {
								"timestamp": moment().format("MM-DD-YYYY hh:mm a"),
								"connection": $rootScope.connection,
								"type": "start-work",
								"confirmed": false
							}
						});
						break;
					default:
						console.log('what notification was that?');
				}
			});


			$rootScope.$on("$cordovaBatteryStatus:status", function(event, args) {
				//console.log('battery status');
				$rootScope.battery = {
					"charging": args.isPlugged,
					"level": args.level
				};
			});
		});
	}

})();
