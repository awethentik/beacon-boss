function PunchesCtrl($scope, $stateParams) {
	//punch stuff
}

angular.module('ikonnect.controllers', [])

.controller("AppCtrl", ['$scope', '$rootScope', '$ionicPlatform', '$cordovaLocalNotification', '$cordovaDevice', '$state', function($scope, $rootScope, $ionicPlatform, $cordovaLocalNotification, $cordovaDevice, $state) {

	$scope.currentEmp = {
		'uuid': '',
		'status': '',
		'currentRegion': '',
		'currentArea': '',
		'currentSegment': 0,
		'schedule': {
			'shifts': [{
				'date': '02/19/2016',
				'shift': [{
					'in': {
						'time': '7:40 PM',
						'status': 'unconfirmed'
					},
					'out': {
						'time': '12:00 PM',
						'status': 'unconfirmed'
					},
					'area': 'blue',
					'status': 'unconfirmed'
				}, {
					'in': {
						'time': '12:30 AM',
						'status': 'unconfirmed'
					},
					'out': {
						'time': '5:30 PM',
						'status': 'unconfirmed'
					},
					'area': 'green',
					'status': 'unconfirmed'
				}]
			}]
		},
		'transfers': [],
		'punches': []
	};

	$scope.currentEmp.schedule.shifts[0].shift[0].in.time = moment().format('h:mm A');
	$scope.currentEmp.schedule.shifts[0].shift[0].out.time = moment().add(1, 'm').format('h:mm A');

	$scope.currentEmp.schedule.shifts[0].shift[1].in.time = moment().add(2, 'm').format('h:mm A');
	$scope.currentEmp.schedule.shifts[0].shift[1].out.time = moment().add(3, 'm').format('h:mm A');

	$rootScope.ranging = 'off';

	$scope.didRangeBeaconsInRegionLog = [];
	$scope.currentRegions = [];

	$scope.toggleRanging = function(status){
		console.log('status', status);
		if (status == 'on'){
			$rootScope.ranging = 'on';
			$scope.startRangingBeaconsInRegion();
		} else {
			$rootScope.ranging = 'off';
			$scope.stopRangingBeaconsInRegion();
		}
		//$scope.$apply();
	};

	$scope.setNext = function() {
		setTimeout(function(){
			$scope.startMonitoringForRegion();
		}, 60000);
	};

	$scope.punchIn = function(){
		var nowTime = moment();
		$scope.currentEmp.schedule.shifts[0].shift[$scope.currentEmp.currentSegment].in.time = nowTime.format('h:mm A');
		var scheduledTime = moment($scope.currentEmp.schedule.shifts[0].shift[$scope.currentEmp.currentSegment].in.time, 'h:mm A');
		var inEarly = moment(scheduledTime).subtract(10, 'm');
		var inLate = moment(scheduledTime).add(10, 'm');

		if (moment(nowTime).isBetween(inEarly, inLate)){
			//hold status
			$scope.currentEmp.status = 'pending';

			$scope.stopMonitoringForRegion();

			var timeFormat = moment(nowTime).format('MMMM Do YYYY, h:mm:ss a');

			var currentPunch = {
				'type' : 'in',
				'timestamp': timeFormat,
				'clock': 'intouch'
			};

			//record punch timestamp
			$scope.currentEmp.punches.push(currentPunch);

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
				console.log('Punch-in notification triggered');
				var now = new Date().getTime();
				var sec_from_now = new Date(now + 60000);
				$cordovaLocalNotification.schedule({
					id: 302,
					title: 'Ready to punch-out for a break?',
					text: "Tap to confirm",
					at: sec_from_now,
					data: {
						'timestamp': nowTime,
						'type': 'punch-out'
					}
				})
			});
		}
	}

	$rootScope.$on("$cordovaBeacon:didRangeBeaconsInRegion", function (event, pluginResult) {
		//console.log('detected');
		//$scope.didRangeBeaconsInRegionLog.push(pluginResult);
		$scope.currentRegions = pluginResult;

		$scope.$apply();
	});

	$rootScope.$on("$cordovaBeacon:didDetermineStateForRegion", function (event, pluginResult) {
		console.log(pluginResult, $scope.currentEmp.status);

		if (pluginResult.state === 'CLRegionStateInside' && $scope.currentEmp.status === 'out'){
			$scope.punchIn();
		} else if (pluginResult.state === 'CLRegionStateInside' && $scope.currentEmp.status === 'in')  {

		}

		$scope.$apply();
	});

	$rootScope.$on('$cordovaLocalNotification:click', function(event, notification, state) {
		//confirmed so do something
		//console.log(JSON.parse(notification.data));
		//notification data
		var noteData = JSON.parse(notification.data);
		switch(noteData.type){
			case 'punch-in':
				//confirm punch
				$scope.currentEmp.schedule.shifts[0].shift[$scope.currentEmp.currentSegment].in.status = 'confirmed';
				$scope.currentEmp.status = 'in';
				//ranging on
				$scope.toggleRanging('on');
				//bring to foreground
				$state.go('mobile.beacons');
				break;
			case 'punch-out':
				//record punch timestamp
				var nowTime = moment().format('MMMM Do YYYY, h:mm:ss a');
				var currentPunch = {
					'type' : 'out',
					'timestamp': nowTime,
					'clock': 'intouch'
				}
				$scope.currentEmp.punches.push(currentPunch);
				//confirm punch
				$scope.currentEmp.schedule.shifts[0].shift[$scope.currentEmp.currentSegment].out.status = 'confirmed';
				$scope.currentEmp.status = 'out';
				//monitoring off
				$scope.stopMonitoringForRegion();
				//ranging off
				$scope.toggleRanging('off');
				//setup next segment
				console.log($scope.currentEmp.currentSegment+1);
				console.log($scope.currentEmp.schedule.shifts.shift.length);
				console.log(($scope.currentEmp.currentSegment+1) > $scope.currentEmp.schedule.shifts.shift.length);
				if (($scope.currentEmp.currentSegment+1) > $scope.currentEmp.schedule.shifts.shift.length){
					$scope.currentEmp.currentSegment++;
					$scope.setNext();
				}
				break;
			default:
				console.log('nope');
		}
	});

	//set uuid of current employee
	//$ionicPlatform.ready(function() {
	//	$cordovaBeacon.requestWhenInUseAuthorization();
		//$scope.currentEmp.uuid = $cordovaDevice.getUUID();
	//});
}])

.controller('PunchesCtrl', PunchesCtrl)
.controller('ScheduleCtrl', ['$scope', '$rootScope', '$ionicPlatform', function($scope, $rootScope, $ionicPlatform) {
	//var nowTime = moment().format('h:mm A');

	console.log($scope.currentEmp);

	//status: out|in|break
	$scope.currentEmp.status = 'out';
	//area: unknown|blue|green|red|yellow|purple|cafe
	$scope.currentEmp.area = 'unknown';

	// =========/ Events
	$ionicPlatform.ready(function() {
		$cordovaBeacon.requestWhenInUseAuthorization();
		$scope.startMonitoringForRegion();
	});
}])

.controller("BeaconCtrl", ['$scope', '$rootScope', '$cordovaLocalNotification', '$cordovaDevice', function($scope, $rootScope, $cordovaLocalNotification, $cordovDevice) {
	//beacon stuff

	$scope.beacons = {};

	var brIdentifier = 'estimote';
	var brUuid = 'D09BCF16-84FA-486A-B2A1-40415D6CDC3E';
	var brMajor = 300;
	var brMinor = [10, 20, 30, 40, 50, 60];
	var brNotifyEntryStateOnDisplay = true;

	function findIndexByKeyValue(obj, key, value) {
		for (var i = 0; i < obj.length; i++) {
			if (obj[i][key] == value) {
				return i;
			}
		}
		return null;
	}

	$scope.confirmArea = function (minor) {
		$scope.currentEmp.schedule.shifts[0].shift[$scope.currentEmp.currentSegment].status = 'confirmed';
		$scope.toggleRanging('off');
		switch(minor){
			case '10':
				$scope.currentEmp.schedule.shifts[0].shift[$scope.currentEmp.currentSegment].area = 'blue';
				$scope.currentEmp.currentArea = 'blue';
				break;
			case '20':
				$scope.currentEmp.schedule.shifts[0].shift[$scope.currentEmp.currentSegment].area = 'red';
				$scope.currentEmp.currentArea = 'red';
				break;
			case '30':
				$scope.currentEmp.schedule.shifts[0].shift[$scope.currentEmp.currentSegment].area = 'yellow';
				$scope.currentEmp.currentArea = 'yellow';
				break;
			case '50':
				$scope.currentEmp.schedule.shifts[0].shift[$scope.currentEmp.currentSegment].area = 'green';
				$scope.currentEmp.currentArea = 'green';
				break;
			case '60':
				$scope.currentEmp.schedule.shifts[0].shift[$scope.currentEmp.currentSegment].area = 'purple';
				$scope.currentEmp.currentArea = 'purple';
				break;
		}
		$scope.currentRegions.beacons = [];

	};

	$scope.assignProximity = function(v) {
		var proximity = v.proximity;
		console.log(proximity);
		switch(proximity){
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
	};

	$scope.outsideRegion = [];
	$scope.didDetermineStateForRegionLog = [];

	function transfer(beacon){
		console.log(beacon);
		var nowTime = moment().format('h:mm A');
		var deliveryTime = moment().format('h:mm A').add(1, 'm');

		$cordovaLocalNotification.schedule({
			id: 301,
			title: 'Want to transfer into '+$scope.currentEmp.currentArea+'?',
			text: "Tap to confirm",
			at: deliveryTime,
			data: {
				customProperty: 'custom value'
			}
		}).then(function (result) {
			console.log('Transfer notification triggered');
		});
		//change currentSegment
		//$scope.currentEmp.currentSegment++;
		var currentTransfer = {
			'type' : 'out',
			'timestamp': nowTime,
			'area': $scope.currentEmp.currentArea
		}
		$scope.currentEmp.transfers.push(currentTransfer);

	}

	function updateArea(newArea){
		switch (newArea) {
			case 'estimote10':
				$scope.currentEmp.currentArea = 'green';
				break;
			case 'estimote20':
				$scope.currentEmp.currentArea = 'blue';
				break;
			case 'estimote30':
				$scope.currentEmp.currentArea = 'yellow';
				break;
			case 'estimote40':
				$scope.currentEmp.currentArea = 'red';
				break;
			case 'estimote50':
				$scope.currentEmp.currentArea = 'cafe';
				break;
			case 'estimote60':
				$scope.currentEmp.currentArea = 'purple';
				break;
		}
	}

	//$scope.clearLogs = function() {
	//	$scope.didStartMonitoringForRegionLog = '';
	//	$scope.didDetermineStateForRegionLog = [];
	//	$scope.didRangeBeaconsInRegionLog = '';
	//};
}])

.controller('BeaconDetailCtrl', function($scope, $stateParams) {
})
