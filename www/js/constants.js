(function() {
	'use strict';

	angular
		.module('ikonnect.constants', [])

		.constant('fb', {
			url: "https://kronos-ikonnect.firebaseIO.com"
		})

		.constant('beaconInfo', {
			brIdentifier: 'estimote',
			radIdentifier: 'intouch',
			brUuid: 'D09BCF16-84FA-486A-B2A1-40415D6CDC3E',
			radUuid: 'CAF267A0-9D08-4BA0-B4D2-3AE39B50E2B2',
			brMajor: 300,
			brMinor: [10, 20, 30, 50, 60],
			brNotifyEntryStateOnDisplay: true,
			ranging: 'off'
		})

		.constant('currentEmp', {
			'uuid': '',
			'status': '',
			'currentRegion': '',
			'currentArea': '',
			'currentSegment': 0,
			'transfers': [],
			'punches': []
		});
})();
